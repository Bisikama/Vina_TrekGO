import { Prisma } from '@prisma/client'
import { Model } from 'mongoose'
import type { Manifest } from './booking-demo.seed'
import { scenarios } from './booking-demo.config'
import { NotificationsService } from '../../src/modules/notifications/notifications.service'
import { bookingNotificationProjection } from '../../src/modules/notifications/consumers/booking-notification.projection'
import {
  Notification,
  NotificationType,
  ReferenceType,
} from '../../src/modules/notifications/schemas/notification.schema'
import { paymentHash } from '../../src/modules/payments/payment-utils'

type DB = Prisma.TransactionClient
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Seed verification: ${message}`)
}
async function deliveries(db: DB, manifest: Manifest) {
  const result: { eventId: string; semanticType: string; data: Partial<Notification> & { userId: string } }[] = []
  const events = await db.bookingOutboxEvent.findMany({ where: { id: { in: manifest.eventIds } } })
  assert(events.length === manifest.eventIds.length, 'missing booking events')
  for (const e of events)
    for (const d of bookingNotificationProjection(e.eventType, e.payload)) result.push({ eventId: e.id, ...d })
  const payments = await db.paymentOutboxEvent.findMany({ where: { id: { in: manifest.paymentEventIds } } })
  assert(payments.length === manifest.paymentEventIds.length, 'missing payment events')
  for (const event of payments) {
    const p = await db.payment.findUniqueOrThrow({ where: { id: event.aggregateId }, include: { invoice: true } })
    result.push({
      eventId: event.id,
      semanticType: 'PAYMENT_SUCCEEDED',
      data: {
        userId: p.invoice.userId,
        title: 'Giao dịch thanh toán thành công',
        content: `Bạn đã thanh toán ${p.amount.toFixed(0)} VND cho hóa đơn ${p.invoice.invoiceNo}.`,
        notificationType: NotificationType.PAYMENT_SUCCESS,
        referenceType: ReferenceType.PAYMENT,
        referenceId: p.id,
        metadata: { invoiceId: p.invoiceId, paymentGateway: p.paymentGateway, amount: p.amount.toString() },
      },
    })
  }
  return result
}

export async function syncNotifications(db: DB, model: Model<Notification>, manifest: Manifest) {
  // Old identities come from the committed cleanup manifest, including UI-created child records.
  if (manifest.oldIds.length || manifest.oldEventIds.length)
    await model
      .deleteMany({
        $or: [
          { referenceId: { $in: manifest.oldIds } },
          { 'metadata.outboxEventId': { $in: manifest.oldEventIds } },
          { 'metadata.tripId': { $in: manifest.oldIds } },
        ],
      })
      .exec()
  const service = new NotificationsService(model as any)
  for (const d of await deliveries(db, manifest))
    await service.deliverBookingEvent(d.eventId, d.semanticType, {
      ...d.data,
      metadata: {
        ...d.data.metadata,
        seedSource: manifest.source,
        seedBatch: manifest.batch,
        seedRunId: manifest.runId,
      },
    })
  // Record delivery only AFTER Mongo has acknowledged all upserts. Retry is safe if this write fails.
  for (const eventId of manifest.eventIds)
    await db.bookingNotificationReceipt.upsert({
      where: { eventId_consumer: { eventId, consumer: 'booking-notifications-v1' } },
      create: { eventId, consumer: 'booking-notifications-v1', completedAt: new Date(), attempts: 1 },
      update: { completedAt: new Date(), attempts: { increment: 1 }, lastError: null },
    })
}

export async function verifyDemo(db: DB, manifest: Manifest, model?: Model<Notification>) {
  const rows = await db.trip.findMany({
    where: { id: { in: manifest.trips.map((t) => t.id) } },
    include: {
      tripTrailPlansViaTripId: true,
      tripCheckpointsViaTripId: true,
      tripActiveTrailPlanViaTripId: true,
      tripCostPlanViaTripId: true,
      tripPricingVersionsViaTripId: true,
      tripTransportsViaTripId: true,
      tripMembersViaTripId: true,
      privateTripInvitesViaTripId: true,
      bookingsViaTripId: {
        include: {
          bookingParticipantsViaBookingId: { include: { invitations: true } },
          invoicesViaBookingId: {
            include: { invoiceLinesViaInvoiceId: true, paymentsViaInvoiceId: { include: { application: true } } },
          },
        },
      },
    },
  })
  assert(rows.length === 6 && manifest.trips.length === 6, 'expected six trips')
  const now = new Date()
  for (const trip of rows) {
    const key = manifest.trips.find((t) => t.id === trip.id)!.scenario
    const scenario = scenarios.find((s) => s.key === key)!
    assert(scenario && trip.startAt > now && trip.endAt > trip.startAt, `${key}: future dates`)
    assert(
      trip.tripTrailPlansViaTripId.length === 1 && trip.tripCheckpointsViaTripId.length > 0,
      `${key}: route snapshots`,
    )
    if (trip.tripType === 'PRIVATE') {
      assert(
        trip.leaderId === null && trip.bookingsViaTripId.length === 0,
        `${key}: private membership, no paid booking`,
      )
      const members = trip.tripMembersViaTripId
      assert(
        members.length === (key === 'PRIVATE_D10' ? 3 : 2) && members.filter((m) => m.role === 'HOST').length === 1,
        `${key}: private members`,
      )
      assert(
        members.every((m) => m.status === 'ACTIVE' && m.attendanceStatus === 'NOT_MARKED'),
        `${key}: member states`,
      )
      for (const link of trip.privateTripInvitesViaTripId)
        assert(
          link.usedCount === members.filter((m) => m.joinedByInviteId === link.id).length &&
            link.expiresAt! < trip.startAt,
          `${key}: invite link usage`,
        )
      const invites = await db.privateTripMemberInvitation.findMany({ where: { tripId: trip.id } })
      for (const inv of invites) {
        if (inv.status === 'ACCEPTED')
          assert(
            members.some(
              (m) =>
                m.id === inv.acceptedMemberId &&
                m.userId === inv.recipientUserId &&
                m.version === inv.membershipVersionAtAccept,
            ) && inv.respondedAt,
            `${key}: accepted membership snapshot`,
          )
        else
          assert(
            inv.status === 'PENDING' &&
              !inv.acceptedMemberId &&
              !inv.membershipVersionAtAccept &&
              !inv.respondedAt &&
              !members.some((m) => m.userId === inv.recipientUserId),
            `${key}: pending invitation`,
          )
      }
      continue
    }
    assert(
      trip.publishedAt &&
        trip.registrationOpenAt &&
        trip.registrationOpenAt <= now &&
        trip.registrationDeadlineAt! > now &&
        +trip.registrationDeadlineAt! === +trip.startAt - 48 * 3600000,
      `${key}: registration window`,
    )
    assert(
      trip.tripActiveTrailPlanViaTripId && trip.tripTransportsViaTripId.length === 1,
      `${key}: active route and transport`,
    )
    assert(
      trip.tripCostPlanViaTripId?.status === 'PUBLISHED' &&
        trip.tripPricingVersionsViaTripId.length === 1 &&
        trip.tripPricingVersionsViaTripId[0].versionNo === 1 &&
        trip.priceExplanation,
      `${key}: published pricing`,
    )
    const participants = trip.bookingsViaTripId.flatMap((b) => b.bookingParticipantsViaBookingId)
    const expected = key === 'PUBLIC_D7' ? 0 : key === 'PUBLIC_D14' ? 4 : key === 'PUBLIC_D21' ? 3 : 6
    assert(participants.length === expected, `${key}: participant count`)
    assert(trip.status === (expected === trip.maxPax ? 'FULL' : 'OPEN'), `${key}: capacity status`)
    const linked = participants.map((p) => p.userId).filter(Boolean)
    assert(new Set(linked).size === linked.length, `${key}: duplicate linked participant`)
    assert(
      new Set(trip.bookingsViaTripId.map((b) => b.userId)).size === trip.bookingsViaTripId.length,
      `${key}: duplicate buyer`,
    )
    for (const b of trip.bookingsViaTripId) {
      assert(
        b.status === 'CONFIRMED' &&
          b.confirmedAt &&
          b.confirmedAt < b.expiresAt &&
          b.participantCount === b.bookingParticipantsViaBookingId.length,
        `${key}: booking state`,
      )
      assert(
        b.bookingParticipantsViaBookingId.every((p) => p.status === 'ACTIVE' && p.checkinStatus === 'NOT_CHECKED_IN'),
        `${key}: ticket state`,
      )
      assert(b.invoicesViaBookingId.length === 1, `${key}: invoice count`)
      const invoice = b.invoicesViaBookingId[0]
      assert(
        invoice.status === 'PAID' &&
          invoice.totalAmount.equals(b.totalAmount) &&
          invoice.paymentsViaInvoiceId.length === 1 &&
          invoice.invoiceLinesViaInvoiceId
            .reduce((sum, l) => sum.plus(l.lineAmount), new Prisma.Decimal(0))
            .equals(invoice.totalAmount),
        `${key}: invoice amount`,
      )
      const p = invoice.paymentsViaInvoiceId[0]
      assert(
        p.status === 'SUCCEEDED' &&
          p.amount.equals(invoice.totalAmount) &&
          p.providerEnvironment === 'MOCK' &&
          p.application?.status === 'APPLIED' &&
          p.application.invoiceId === invoice.id,
        `${key}: payment application`,
      )
      const mock = await db.mockPaymentOperation.findUnique({
        where: {
          id: paymentHash([
            { gateway: p.paymentGateway, environment: p.providerEnvironment, merchantAccountKey: p.merchantAccountKey },
            'PAYMENT',
            p.merchantRequestRef,
          ]),
        },
      })
      assert(mock && (mock.result as any)?.event?.status === 'SUCCEEDED', `${key}: provider mock state`)
    }
    if (key === 'PUBLIC_D21') {
      const invitations = participants.flatMap((p) => p.invitations)
      assert(
        invitations.filter((i) => i.status === 'ACCEPTED').length === 1 &&
          invitations.filter((i) => i.status === 'PENDING').length === 1,
        'D21: accepted and pending invitations',
      )
      for (const i of invitations) {
        const p = participants.find((p) => p.id === i.bookingParticipantId)!
        assert(
          i.senderUserId !== i.recipientUserId &&
            i.recipientEmailSnapshot === i.recipientEmailSnapshot.trim().toLowerCase(),
          'D21: invitation recipient',
        )
        assert(
          i.status === 'ACCEPTED'
            ? p.userId === i.recipientUserId && i.respondedAt && i.version === 2
            : !p.userId && !i.respondedAt && i.version === 1 && i.expiresAt > now,
          'D21: invitation linkage',
        )
      }
    }
  }
  if (model) {
    for (const d of await deliveries(db, manifest)) {
      assert(
        (await model.countDocuments({
          userId: d.data.userId,
          'metadata.outboxEventId': d.eventId,
          'metadata.semanticType': d.semanticType,
        })) === 1,
        `notification ${d.eventId} missing or duplicate`,
      )
    }
    assert(
      (await db.bookingNotificationReceipt.count({
        where: { eventId: { in: manifest.eventIds }, consumer: 'booking-notifications-v1', completedAt: { not: null } },
      })) === manifest.eventIds.length,
      'notification receipts',
    )
    assert(
      (await model.countDocuments({ 'metadata.outboxEventId': { $in: manifest.oldEventIds } })) === 0,
      'old notifications remain',
    )
  }
}
