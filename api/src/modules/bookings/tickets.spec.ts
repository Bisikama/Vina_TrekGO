import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import { Reflector } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { TicketsController } from './tickets.controller'
import { TicketsService } from './tickets.service'
import { ParticipantClaimService } from './participant-claim.service'
import { BookingCancellationService } from './booking-cancellation.service'
import { PaymentsPort } from '../payments/payments.port'
import { PrismaService } from '../../shared/services/prisma.service'
import { SupabaseService } from '../../shared/services/supabase.service'
import { AuthenticationGuard } from '../../shared/guards/authentication.guard'
import { AccessTokenGuard } from '../../shared/guards/access-token.guard'
import { ApiKeyGuard } from '../../shared/guards/api-key.guard'
import { GlobalErrorFilter } from '../../shared/errors'

const url = process.env.PUBLIC_CLAIM_TEST_DATABASE_URL
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.startsWith('/cf01_test_invitation_m5')
)
  throw new Error('M5 requires isolated localhost cf01_test_invitation_m5* database')
describe('M5 real PostgreSQL and HTTP contract', () => {
  const db = new PrismaClient({ datasourceUrl: url })
  const claims = new ParticipantClaimService(db as unknown as PrismaService)
  const tickets = new TicketsService(db as unknown as PrismaService)
  const cancellation = new BookingCancellationService(db as unknown as PrismaService, {} as PaymentsPort)
  const tokens = new Map<string, { id: string }>()
  let app: INestApplication
  const user = async () => {
    const u = await db.user.create({
      data: { email: `${randomUUID()}@m5.test`, authUserId: randomUUID(), fullName: 'Account name' },
    })
    tokens.set(u.id, { id: u.authUserId! })
    return u
  }
  const fixture = async () => {
    const buyer = await user(),
      other = await user()
    const destination = await db.destination.create({ data: { name: 'M5 destination' } })
    const pickup = await db.pickupPoint.create({
      data: {
        code: randomUUID(),
        name: 'M5 pickup',
        address: 'test',
        latitude: 0,
        longitude: 0,
        createdBy: buyer.id,
        destinationId: destination.id,
      },
    })
    const trip = await db.trip.create({
      data: {
        tripType: 'PUBLIC',
        creatorId: buyer.id,
        destinationId: destination.id,
        title: 'M5 trip',
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 172800000),
        status: 'OPEN',
        maxPax: 10,
      },
    })
    const policy = await db.bookingPolicy.create({
      data: {
        policyCode: randomUUID(),
        versionNo: 1,
        holdTtlMinutes: 15,
        effectiveFrom: new Date(),
        cancellationRules: { tiers: [{ minHoursBeforeStart: 0, refundPercent: 100 }] },
      },
    })
    const booking = await db.booking.create({
      data: {
        tripId: trip.id,
        userId: buyer.id,
        pickupPointId: pickup.id,
        returnPointId: pickup.id,
        bookingPolicyId: policy.id,
        status: 'CONFIRMED',
        participantCount: 2,
        pricePerPaxSnapshot: 100,
        subtotalAmount: 200,
        totalAmount: 200,
        policySnapshot: { cancellationRules: { tiers: [{ minHoursBeforeStart: 0, refundPercent: 100 }] } },
        expiresAt: new Date(Date.now() + 60000),
      },
    })
    const p = await db.bookingParticipant.create({
      data: {
        bookingId: booking.id,
        fullName: 'Declared traveller',
        checkinCode: randomUUID(),
        phone: 'PRIVATE_PHONE',
        idDocumentNo: 'PRIVATE_ID',
      },
    })
    const sibling = await db.bookingParticipant.create({
      data: { bookingId: booking.id, fullName: 'Other traveller', checkinCode: randomUUID() },
    })
    return { buyer, other, trip, booking, p, sibling }
  }
  const post = (
    f: Awaited<ReturnType<typeof fixture>>,
    actor = f.buyer.id,
    body: unknown = { confirmParticipantIdentity: true },
  ) =>
    request(app.getHttpServer())
      .post(`/bookings/${f.booking.id}/participants/${f.p.id}/self-claim`)
      .auth(actor, { type: 'bearer' })
      .send(body)
  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [ParticipantClaimService, TicketsService, { provide: PrismaService, useValue: db }],
    }).compile()
    app = m.createNestApplication()
    app.useGlobalGuards(
      new AuthenticationGuard(
        new Reflector(),
        new AccessTokenGuard(
          { verifyToken: async (t: string) => tokens.get(t) ?? null } as unknown as SupabaseService,
          db as unknown as PrismaService,
        ),
        {} as ApiKeyGuard,
      ),
    )
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
  })
  it('claims once under retry, rotates only once, preserves buyer/money and returns private ticket views', async () => {
    const f = await fixture()
    const results = await Promise.all([post(f), post(f)])
    expect(results.map((r) => r.status)).toEqual([200, 200])
    expect(results.map((r) => r.body.alreadyClaimed).sort()).toEqual([false, true])
    const p = await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })
    expect(p.userId).toBe(f.buyer.id)
    expect(p.checkinCode).not.toBe(f.p.checkinCode)
    expect(p.fullName).toBe(f.p.fullName)
    expect(await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).toMatchObject({
      userId: f.buyer.id,
      participantCount: 2,
      version: 2,
      totalAmount: f.booking.totalAmount,
    })
    expect(await db.auditLog.count({ where: { entityId: f.p.id } })).toBe(1)
    expect(
      await db.bookingOutboxEvent.count({
        where: { aggregateId: f.booking.id, eventType: 'PUBLIC_PARTICIPANT_CLAIMED' },
      }),
    ).toBe(1)
    const detail = await request(app.getHttpServer())
      .get(`/me/tickets/${f.p.id}`)
      .auth(f.buyer.id, { type: 'bearer' })
      .expect(200)
    for (const secret of ['PRIVATE_PHONE', 'PRIVATE_ID', p.checkinCode, f.sibling.fullName, 'totalAmount', 'invoice'])
      expect(JSON.stringify(detail.body)).not.toContain(secret)
    expect(detail.headers['cache-control']).toBe('no-store')
    await request(app.getHttpServer()).get(`/me/tickets/${f.p.id}`).auth(f.other.id, { type: 'bearer' }).expect(404)
    expect((await tickets.list(f.buyer.id, 1, 20)).total).toBe(1)
    expect((await tickets.list(f.other.id, 1, 20)).total).toBe(0)
  })
  it('requires identity confirmation, correct buyer and allowed role, with shared errors', async () => {
    const f = await fixture()
    await post(f, f.buyer.id, {}).expect(400)
    await post(f, f.buyer.id, { confirmParticipantIdentity: false }).expect(400)
    await post(f, f.buyer.id, { confirmParticipantIdentity: true, userId: f.other.id }).expect(400)
    const denied = await post(f, f.other.id).expect(404)
    expect(denied.body.error.code).toBe('NOT_FOUND')
    expect(denied.body.meta.requestId).toBeTruthy()
    await request(app.getHttpServer()).get('/me/tickets').expect(401)
    await db.user.update({ where: { id: f.buyer.id }, data: { role: 'ADMIN' } })
    await post(f).expect(403)
    await db.user.update({ where: { id: f.buyer.id }, data: { role: 'LEADER' } })
    await post(f).expect(200)
  })
  it.each(['PENDING_PAYMENT', 'CANCELLED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'] as const)(
    'rejects new claim for booking %s',
    async (status) => {
      const f = await fixture()
      await db.booking.update({ where: { id: f.booking.id }, data: { status } })
      const res = await post(f).expect(409)
      expect(res.body.error.code).toBe('PARTICIPANT_CLAIM_NOT_ALLOWED')
      expect((await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })).checkinCode).toBe(
        f.p.checkinCode,
      )
    },
  )
  it('blocks started/cancelled trips, checked-in participants and assignment to another account', async () => {
    const f = await fixture()
    await db.trip.update({ where: { id: f.trip.id }, data: { startAt: new Date(Date.now() - 1000) } })
    await post(f).expect(409)
    await db.trip.update({ where: { id: f.trip.id }, data: { startAt: f.trip.startAt, status: 'CANCEL_PENDING' } })
    await post(f).expect(409)
    await db.trip.update({ where: { id: f.trip.id }, data: { status: 'OPEN' } })
    await db.bookingParticipant.update({ where: { id: f.p.id }, data: { checkinStatus: 'CHECKED_IN' } })
    await post(f).expect(409)
    await db.bookingParticipant.update({ where: { id: f.p.id }, data: { userId: f.other.id } })
    expect((await post(f).expect(409)).body.error.code).toBe('PARTICIPANT_ALREADY_LINKED')
  })
  it('serializes different slots and detects valid participation across bookings', async () => {
    const f = await fixture()
    const results = await Promise.allSettled([
      claims.selfClaim(f.buyer.id, f.booking.id, f.p.id),
      claims.selfClaim(f.buyer.id, f.booking.id, f.sibling.id),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.code).toBe(
      'TRIP_PARTICIPATION_EXISTS',
    )
    const g = await fixture()
    const otherBooking = await db.booking.create({
      data: {
        ...Object.fromEntries(Object.entries(g.booking).filter(([k]) => !['id', 'createdAt', 'updatedAt'].includes(k))),
        userId: g.other.id,
      } as any,
    })
    await db.bookingParticipant.create({
      data: { bookingId: otherBooking.id, userId: g.buyer.id, fullName: 'existing', checkinCode: randomUUID() },
    })
    expect((await post(g).expect(409)).body.error.code).toBe('TRIP_PARTICIPATION_EXISTS')
    await db.booking.update({ where: { id: otherBooking.id }, data: { status: 'CANCELLED' } })
    await post(g).expect(200)
  })
  it('enforces pending unique, blocks self-claim then expires pending durably even on later business failure', async () => {
    const f = await fixture(),
      data = {
        bookingParticipantId: f.p.id,
        senderUserId: f.buyer.id,
        recipientUserId: f.other.id,
        recipientEmailSnapshot: f.other.email,
        expiresAt: new Date(Date.now() + 3600000),
      }
    const pending = await db.bookingParticipantInvitation.create({ data })
    await expect(db.bookingParticipantInvitation.create({ data })).rejects.toMatchObject({ code: 'P2002' })
    expect((await post(f).expect(409)).body.error.code).toBe('PENDING_INVITATION_EXISTS')
    await db.bookingParticipantInvitation.update({
      where: { id: pending.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    await db.booking.update({ where: { id: f.booking.id }, data: { status: 'CANCELLED' } })
    await post(f).expect(409)
    expect((await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe(
      'EXPIRED',
    )
    const g = await fixture()
    await db.bookingParticipantInvitation.create({
      data: {
        ...data,
        bookingParticipantId: g.p.id,
        senderUserId: g.buyer.id,
        recipientUserId: g.other.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    })
    await post(g).expect(200)
  })
  it('rolls back assignment, QR, version and audit if outbox write fails', async () => {
    const f = await fixture()
    await db.bookingOutboxEvent.create({
      data: {
        deduplicationKey: `PUBLIC_PARTICIPANT_CLAIMED:${f.p.id}:2`,
        eventType: 'TEST_COLLISION',
        aggregateType: 'Booking',
        aggregateId: f.booking.id,
        payload: {},
      },
    })
    await expect(claims.selfClaim(f.buyer.id, f.booking.id, f.p.id)).rejects.toMatchObject({ code: 'P2002' })
    expect(await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })).toMatchObject({
      userId: null,
      checkinCode: f.p.checkinCode,
    })
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).version).toBe(1)
    expect(await db.auditLog.count({ where: { entityId: f.p.id } })).toBe(0)
  })
  it('races with the real cancellation service; replay after cancellation does not restore access or rotate QR', async () => {
    const f = await fixture()
    const invoice = await db.invoice.create({
      data: {
        invoiceNo: randomUUID(),
        userId: f.buyer.id,
        invoiceType: 'BOOKING',
        bookingId: f.booking.id,
        subtotalAmount: 200,
        totalAmount: 200,
        status: 'PAID',
      },
    })
    const payment = await db.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 200,
        paymentGateway: 'TEST',
        status: 'SUCCEEDED',
        idempotencyKey: randomUUID(),
      },
    })
    await db.paymentApplication.create({ data: { invoiceId: invoice.id, paymentId: payment.id, status: 'APPLIED' } })
    const outcomes = await Promise.allSettled([
      claims.selfClaim(f.buyer.id, f.booking.id, f.p.id),
      cancellation.cancel({
        bookingId: f.booking.id,
        actorId: f.buyer.id,
        actorRole: 'USER',
        idempotencyKey: randomUUID(),
        reason: 'test',
      }),
    ])
    expect(outcomes[1].status).toBe('fulfilled')
    const current = await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe('CANCELLED')
    if (current.userId) {
      const replay = await post(f).expect(200)
      expect(replay.body.currentAccess.participantActive).toBe(false)
      expect((await tickets.detail(f.buyer.id, f.p.id)).bookingStatus).toBe('CANCELLED')
    } else await post(f).expect(409)
    expect((await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })).checkinCode).toBe(
      current.checkinCode,
    )
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).userId).toBe(f.buyer.id)
  })
})
