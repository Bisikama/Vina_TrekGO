import { describe, it, before as beforeAll, after as afterAll } from 'node:test'
import { expect } from 'expect'
import { randomUUID } from 'crypto'
import { writeFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { createConnection, Connection, Model } from 'mongoose'
import { NotificationsService } from '../src/modules/notifications/notifications.service'
import {
  Notification,
  NotificationSchema,
  NotificationDocument,
  NotificationType,
  MongoNotificationStatus,
} from '../src/modules/notifications/schemas/notification.schema'
import { BookingNotificationConsumer } from '../src/modules/notifications/consumers/booking-notification.consumer'
import { PrismaService } from '../src/shared/services/prisma.service'
import { bookingNotificationEvents } from '../src/modules/notifications/consumers/booking-notification.projection'

const url = process.env.M8_TEST_DATABASE_URL
const mongo = process.env.M8_TEST_MONGO_URL
if (url && (new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/cf01_test_invitation_m8'))
  throw new Error('M8 requires isolated localhost PostgreSQL')
if (
  mongo &&
  (new URL(mongo).hostname !== '127.0.0.1' || !new URL(mongo).pathname.startsWith('/cf01_test_invitation_m8'))
)
  throw new Error('M8 requires isolated localhost MongoDB')
const suite = url && mongo ? describe : describe.skip
suite('M8 real PostgreSQL/Mongo notification delivery', () => {
  const db = new PrismaClient({ datasourceUrl: url })
  let connection: Connection,
    model: Model<NotificationDocument>,
    service: NotificationsService,
    worker: BookingNotificationConsumer
  const event = (eventType: string, payload: object, status: 'PENDING' | 'PROCESSED' | 'FAILED' = 'PENDING') =>
    db.bookingOutboxEvent.create({
      data: {
        eventType,
        payload,
        aggregateType: 'M8_TEST',
        aggregateId: randomUUID(),
        deduplicationKey: randomUUID(),
        status,
      },
    })
  const payload = () => ({
    tripId: randomUUID(),
    invitationId: randomUUID(),
    recipientUserId: randomUUID(),
    buyerUserId: randomUUID(),
    participantId: randomUUID(),
    bookingId: randomUUID(),
    userId: randomUUID(),
    hostUserId: randomUUID(),
    email: 'SECRET_EMAIL',
    checkinCode: 'SECRET_QR',
    payment: 'SECRET_PAYMENT',
  })
  beforeAll(async () => {
    // Isolate copied historical fixtures; test-created events below remain unreceipted.
    await db.$executeRawUnsafe(`INSERT INTO booking_notification_receipts(event_id, consumer, completed_at)
      SELECT id, 'booking-notifications-v1', now() FROM booking_outbox_events
      ON CONFLICT (event_id, consumer) DO UPDATE SET completed_at=EXCLUDED.completed_at, last_error=NULL`)
    connection = await createConnection(mongo!, { serverSelectionTimeoutMS: 5000 }).asPromise()
    model = connection.model<NotificationDocument>(Notification.name, NotificationSchema)
    service = new NotificationsService(model)
    worker = new BookingNotificationConsumer(db as unknown as PrismaService, service)
  })
  afterAll(async () => {
    await connection?.close()
    await db.$disconnect()
  })

  it('drains more than 100 events across ticks and racing workers without duplicates, independent of global status', async () => {
    const ids: string[] = []
    for (let i = 0; i < 107; i++)
      ids.push((await event('PUBLIC_PARTICIPANT_INVITED', payload(), i % 2 ? 'PROCESSED' : 'PENDING')).id)
    await worker.processBookingEvents()
    expect(await model.countDocuments({ 'metadata.outboxEventId': { $in: ids } })).toBe(100)
    await Promise.all([
      worker.processBookingEvents(),
      new BookingNotificationConsumer(db as unknown as PrismaService, service).processBookingEvents(),
    ])
    expect(await model.countDocuments({ 'metadata.outboxEventId': { $in: ids } })).toBe(107)
    expect(
      await db.bookingNotificationReceipt.count({ where: { eventId: { in: ids }, completedAt: { not: null } } }),
    ).toBe(107)
    expect(await db.bookingOutboxEvent.count({ where: { id: { in: ids }, status: 'PENDING' } })).toBe(54)
  })

  it('routes only approved audiences, deduplicates self-claim and never leaks private fields', async () => {
    for (const type of bookingNotificationEvents) {
      const p = payload(),
        e = await event(type, p)
      await worker.processBookingEvents()
      const docs = await model.find({ 'metadata.outboxEventId': e.id }).lean()
      // PRIVATE_TRIP_CANCELLED/UPDATED báo thành viên ACTIVE của Trip; tripId ngẫu nhiên nên không có ai.
      const audience = ['PRIVATE_TRIP_CANCELLED', 'PRIVATE_TRIP_UPDATED'].includes(type)
        ? []
        : type.endsWith('INVITED')
          ? [p.recipientUserId]
          : type === 'PUBLIC_PARTICIPANT_CLAIMED'
            ? [p.buyerUserId, p.recipientUserId]
            : [p.userId]
      expect(docs.map((d) => d.userId).sort()).toEqual(audience.sort())
      for (const secret of ['SECRET_EMAIL', 'SECRET_QR', 'SECRET_PAYMENT', p.hostUserId])
        expect(JSON.stringify(docs)).not.toContain(secret)
      if (type === 'PUBLIC_PARTICIPANT_CLAIMED') {
        expect(JSON.stringify(docs.find((d) => d.userId === p.recipientUserId))).not.toContain(p.bookingId)
        expect(docs.find((d) => d.userId === p.buyerUserId)!.metadata!.target.kind).toBe('BOOKING_PARTICIPANT')
      }
    }
    const p = payload()
    const e = await event('PUBLIC_PARTICIPANT_CLAIMED', { ...p, buyerUserId: p.recipientUserId })
    await worker.processBookingEvents()
    expect(await model.countDocuments({ 'metadata.outboxEventId': e.id })).toBe(1)
  })

  it('retries a crash after Mongo insert before receipt without re-notifying or resetting read state', async () => {
    const p = payload(),
      e = await event('PUBLIC_PARTICIPANT_INVITED', p)
    const deliver = service.deliverBookingEvent.bind(service)
    service.deliverBookingEvent = async (...args) => {
      service.deliverBookingEvent = deliver
      await deliver(...args)
      throw new Error('Simulated crash before PostgreSQL receipt')
    }
    await worker.processBookingEvents()
    service.deliverBookingEvent = deliver
    const receipt = await db.bookingNotificationReceipt.findUniqueOrThrow({
      where: { eventId_consumer: { eventId: e.id, consumer: 'booking-notifications-v1' } },
    })
    expect(receipt.completedAt).toBeNull()
    expect(receipt.attempts).toBe(1)
    const doc = await model.findOne({ 'metadata.outboxEventId': e.id }).lean()
    await service.markAsRead(doc!._id.toString(), p.recipientUserId)
    await db.bookingNotificationReceipt.update({
      where: { eventId_consumer: { eventId: e.id, consumer: 'booking-notifications-v1' } },
      data: { nextAttemptAt: new Date(0) },
    })
    await worker.processBookingEvents()
    expect(await model.countDocuments({ 'metadata.outboxEventId': e.id })).toBe(1)
    expect((await model.findById(doc!._id).lean())!.status).toBe('READ')
    expect(
      (
        await db.bookingNotificationReceipt.findUniqueOrThrow({
          where: { eventId_consumer: { eventId: e.id, consumer: 'booking-notifications-v1' } },
        })
      ).completedAt,
    ).not.toBeNull()
    await expect(service.markAsRead(doc!._id.toString(), p.buyerUserId)).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
    })
  })

  it('recognizes legacy deliveries and retries malformed events without starving valid backlog', async () => {
    const p = payload(),
      old = await event('PRIVATE_TRIP_MEMBER_JOINED', p, 'PROCESSED')
    await service.createNotification({
      userId: p.userId,
      title: 'Legacy',
      content: 'Legacy',
      notificationType: NotificationType.BOOKING_CONFIRMED,
      status: MongoNotificationStatus.READ,
      metadata: { outboxEventId: old.id },
    })
    const bad = await event('PUBLIC_PARTICIPANT_INVITED', { tripId: p.tripId })
    const good = await event('PRIVATE_TRIP_MEMBER_INVITED', payload(), 'FAILED')
    await worker.processBookingEvents()
    expect(await model.countDocuments({ 'metadata.outboxEventId': old.id })).toBe(1)
    expect((await model.findOne({ 'metadata.outboxEventId': old.id }).lean())!.status).toBe('READ')
    expect(await model.countDocuments({ 'metadata.outboxEventId': bad.id })).toBe(0)
    expect(await model.countDocuments({ 'metadata.outboxEventId': good.id })).toBe(1)
    const pending = await db.bookingNotificationReceipt.findUniqueOrThrow({
      where: { eventId_consumer: { eventId: bad.id, consumer: 'booking-notifications-v1' } },
    })
    expect(pending).toMatchObject({ completedAt: null, lastError: 'DELIVERY_FAILED' })
    expect(+pending.nextAttemptAt).toBeGreaterThan(Date.now())
  })

  it('completes a partial two-recipient delivery without duplicating legacy recipient records', async () => {
    const p = payload(),
      e = await event('PUBLIC_PARTICIPANT_CLAIMED', p)
    await service.createNotification({
      userId: p.recipientUserId,
      title: 'Existing',
      content: 'Existing',
      notificationType: NotificationType.PUBLIC_PARTICIPANT_CLAIMED,
      status: MongoNotificationStatus.ARCHIVED,
      metadata: { outboxEventId: e.id },
    })
    const deliver = service.deliverBookingEvent.bind(service)
    service.deliverBookingEvent = async (id, semantic, data) => {
      if (id === e.id && data.userId === p.buyerUserId) throw new Error('Buyer delivery unavailable')
      return deliver(id, semantic, data)
    }
    await worker.processBookingEvents()
    service.deliverBookingEvent = deliver
    expect(await model.countDocuments({ 'metadata.outboxEventId': e.id })).toBe(1)
    await db.bookingNotificationReceipt.update({
      where: { eventId_consumer: { eventId: e.id, consumer: 'booking-notifications-v1' } },
      data: { nextAttemptAt: new Date(0) },
    })
    await worker.processBookingEvents()
    expect(await model.countDocuments({ 'metadata.outboxEventId': e.id })).toBe(2)
    expect((await service.getUserNotifications(p.recipientUserId)).items).toHaveLength(0)
    expect((await service.getUnreadCount(p.buyerUserId)).unreadCount).toBe(1)
    const list = await service.getUserNotifications(p.buyerUserId)
    if (process.env.M8_CAPTURE_EXAMPLES === 'true')
      writeFileSync('contracts/invitation-inbox/notification.local.json', JSON.stringify(list, null, 2) + '\n')
    await service.markAllAsRead(p.buyerUserId)
    expect((await service.getUnreadCount(p.buyerUserId)).unreadCount).toBe(0)
    await service.archive(list.items[0].id, p.buyerUserId)
    expect((await service.getUserNotifications(p.buyerUserId)).items).toHaveLength(0)
  })
})
