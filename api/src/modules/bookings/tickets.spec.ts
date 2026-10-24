import { PublicInvitationsController } from './public-invitations.controller'
import { PublicInvitationsService, PublicInvitationRequestService } from './public-invitations.service'
import { BookingsService } from './bookings.service'
import { BookingsController } from './bookings.controller'
import { BookingPolicyService } from './booking-policy.service'
import { randomUUID } from 'crypto'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { writeFileSync } from 'fs'
import Ajv from 'ajv'
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
        cancellationRules: { version: 1, tiers: [{ minHoursBeforeStart: 0, refundPercent: 100 }] },
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
        policySnapshot: { cancellationRules: { version: 1, tiers: [{ minHoursBeforeStart: 0, refundPercent: 100 }] } },
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
      controllers: [TicketsController, PublicInvitationsController, BookingsController],
      providers: [
        PublicInvitationsService,
        {
          provide: BookingsService,
          useValue: new BookingsService(db as unknown as PrismaService, {} as BookingPolicyService),
        },
        PublicInvitationRequestService,
        ParticipantClaimService,
        TicketsService,
        { provide: PrismaService, useValue: db },
      ],
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
    const list = await request(app.getHttpServer())
      .get('/me/tickets?page=1&pageSize=20')
      .auth(f.buyer.id, { type: 'bearer' })
      .expect(200)
    expect(list.body.total).toBe(1)
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth(undefined, 'bearer').build())
    expect(Object.keys(doc.paths)).toHaveLength(13)
    const ajv = new Ajv({ strict: false })
    for (const [path, method, body] of [
      ['/bookings/{id}/participants/{pid}/self-claim', 'post', results[0].body],
      ['/me/tickets', 'get', list.body],
      ['/me/tickets/{participantId}', 'get', detail.body],
    ] as const) {
      const operation = doc.paths[path]![method]!
      expect(operation.security).toEqual([{ bearer: [] }])
      const schema = (operation.responses['200'] as any).content['application/json'].schema
      const validate = ajv.compile(schema)
      expect(validate(body)).toBe(true)
    }
    if (process.env.M5_CAPTURE_EXAMPLES === 'true')
      writeFileSync(
        'contracts/public-tickets/examples.local.json',
        JSON.stringify(
          { claim: results[0].body, replay: results[1].body, list: list.body, detail: detail.body },
          null,
          2,
        ) + '\n',
      )
    await request(app.getHttpServer()).get('/me/tickets?pageSize=51').auth(f.buyer.id, { type: 'bearer' }).expect(400)
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
  it('enforces pending unique and persists lazy invalidation on cancellation or expiry before self-claim', async () => {
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
      'INVALIDATED',
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
    if (outcomes[1].status === 'rejected') throw outcomes[1].reason
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

  const invite = (
    f: Awaited<ReturnType<typeof fixture>>,
    key = randomUUID(),
    body: unknown = { recipientEmail: f.other.email },
    actor = f.buyer.id,
  ) =>
    request(app.getHttpServer())
      .post(`/bookings/${f.booking.id}/participants/${f.p.id}/invitations`)
      .auth(actor, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body)
  const action = (
    id: string,
    actor: string,
    name = 'accept',
    body: unknown = name === 'accept' ? { confirmParticipantIdentity: true } : {},
  ) =>
    request(app.getHttpServer())
      .post(`/booking-participant-invitations/${id}/${name}`)
      .auth(actor, { type: 'bearer' })
      .send(body)
  const preview = (id: string, actor: string) =>
    request(app.getHttpServer()).get(`/booking-participant-invitations/${id}`).auth(actor, { type: 'bearer' })
  const buyerDetail = (f: Awaited<ReturnType<typeof fixture>>) =>
    new BookingsService(db as unknown as PrismaService, {} as BookingPolicyService).detail(f.booking.id, f.buyer.id)

  it('M6 sends once, previews safely, accepts concurrently once and validates the six HTTP contracts', async () => {
    const f = await fixture(),
      key = randomUUID()
    await db.user.update({ where: { id: f.other.id }, data: { role: 'LEADER' } })
    const sent = await Promise.all([invite(f, key), invite(f, key)])
    expect(sent.map((r) => r.status)).toEqual([201, 201])
    expect(sent[0].body.id).toBe(sent[1].body.id)
    expect(sent.map((r) => r.headers['idempotency-replayed']).sort()).toEqual(['false', 'true'])
    const id = sent[0].body.id
    expect((await buyerDetail(f)).participants.find((p) => p.id === f.p.id)).toMatchObject({
      linkageStatus: 'INVITATION_PENDING',
      pendingInvitationId: id,
      actions: { canSelfClaim: false, canInvite: false, canRevoke: true },
    })
    const bookingResponse = await request(app.getHttpServer())
      .get('/bookings/' + f.booking.id)
      .auth(f.buyer.id, { type: 'bearer' })
      .expect(200)
    await request(app.getHttpServer())
      .get('/bookings/' + f.booking.id)
      .auth(f.other.id, { type: 'bearer' })
      .expect(404)
    const before = await preview(id, f.other.id).expect(200)
    expect(before.body.actions.canAccept).toBe(true)
    for (const secret of ['PRIVATE_PHONE', 'PRIVATE_ID', f.p.checkinCode, f.sibling.fullName, 'invoice', 'totalAmount'])
      expect(JSON.stringify(before.body)).not.toContain(secret)
    const outsider = await user()
    await preview(id, outsider.id).expect(404)
    await action(id, f.buyer.id).expect(404)
    await action(id, f.other.id, 'accept', {}).expect(400)
    // Email changes cannot transfer invitation ownership.
    await db.user.update({ where: { id: f.other.id }, data: { email: `${randomUUID()}@changed.test` } })
    const accepted = await Promise.all([action(id, f.other.id), action(id, f.other.id)])
    expect(accepted.map((r) => r.status)).toEqual([200, 200])
    expect(accepted[0].body).toMatchObject({
      status: 'ACCEPTED',
      ticketId: f.p.id,
      currentAccess: { participantActive: true },
    })
    const p = await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })
    expect(p.userId).toBe(f.other.id)
    expect(p.checkinCode).not.toBe(f.p.checkinCode)
    expect(await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).toMatchObject({
      userId: f.buyer.id,
      version: 2,
      participantCount: 2,
      totalAmount: f.booking.totalAmount,
    })
    expect(
      await db.bookingOutboxEvent.count({
        where: { aggregateId: f.booking.id, eventType: 'PUBLIC_PARTICIPANT_CLAIMED' },
      }),
    ).toBe(1)
    expect(
      await db.bookingOutboxEvent.count({
        where: { aggregateId: f.booking.id, eventType: 'PUBLIC_INVITATION_ACCEPTED' },
      }),
    ).toBe(1)
    expect((await buyerDetail(f)).participants.find((p) => p.id === f.p.id)).toMatchObject({
      linkageStatus: 'CLAIMED',
      pendingInvitationId: null,
      actions: { canInvite: false },
    })
    await action(id, f.buyer.id, 'revoke').expect(409)
    const listed = await request(app.getHttpServer())
      .get('/me/booking-participant-invitations?status=ACCEPTED')
      .auth(f.other.id, { type: 'bearer' })
      .expect(200)
    expect(listed.body.total).toBe(1)
    const g = await fixture(),
      declineId = (await invite(g).expect(201)).body.id
    const declined = await action(declineId, g.other.id, 'decline', { reason: 'IDENTITY_MISMATCH' }).expect(200)
    const h = await fixture(),
      revokeId = (await invite(h).expect(201)).body.id
    const revoked = await action(revokeId, h.buyer.id, 'revoke').expect(200)
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth(undefined, 'bearer').build()),
      ajv = new Ajv({ strict: false, nullable: true })
    const cases = [
      ['/bookings/{id}', 'get', 200, bookingResponse.body],
      ['/bookings/{id}/participants/{pid}/invitations', 'post', 201, sent[0].body],
      ['/booking-participant-invitations/{id}', 'get', 200, before.body],
      ['/me/booking-participant-invitations', 'get', 200, listed.body],
      ['/booking-participant-invitations/{id}/accept', 'post', 200, accepted[0].body],
      ['/booking-participant-invitations/{id}/decline', 'post', 200, declined.body],
      ['/booking-participant-invitations/{id}/revoke', 'post', 200, revoked.body],
    ] as const
    for (const [path, method, status, body] of cases) {
      const op = doc.paths[path]![method]!
      expect(op.security).toEqual([{ bearer: [] }])
      const validate = ajv.compile((op.responses[status] as any).content['application/json'].schema)
      expect(validate(body)).toBe(true)
    }
    if (process.env.M6_CAPTURE_EXAMPLES === 'true')
      writeFileSync(
        'contracts/public-invitations/examples.local.json',
        JSON.stringify(
          {
            buyerParticipants: bookingResponse.body.participants,
            create: sent[0].body,
            preview: before.body,
            list: listed.body,
            accept: accepted[0].body,
            decline: declined.body,
            revoke: revoked.body,
          },
          null,
          2,
        ) + '\n',
      )
  })
  it('M6 rejects forged owners, wrong roles, invalid DTOs, self-invites and ambiguous normalized emails', async () => {
    const f = await fixture()
    await invite(f, randomUUID(), { recipientEmail: f.other.email }, f.other.id).expect(404)
    await invite(f, randomUUID(), { recipientEmail: f.other.email, senderUserId: f.buyer.id }).expect(400)
    await request(app.getHttpServer())
      .post(`/bookings/${f.booking.id}/participants/${f.p.id}/invitations`)
      .send({ recipientEmail: f.other.email })
      .expect(401)
    const self = await invite(f, randomUUID(), { recipientEmail: f.buyer.email }).expect(400)
    expect(self.body.error.details.reason).toBe('USE_SELF_CLAIM')
    await db.user.update({ where: { id: f.other.id }, data: { role: 'ADMIN' } })
    expect((await invite(f).expect(422)).body.error.code).toBe('INVITATION_RECIPIENT_UNAVAILABLE')
    await db.user.update({ where: { id: f.other.id }, data: { role: 'USER' } })
    await db.user.create({
      data: { email: f.other.email.toUpperCase(), fullName: 'ambiguous', authUserId: randomUUID() },
    })
    await invite(f).expect(422)
    await db.user.update({ where: { id: f.buyer.id }, data: { role: 'ADMIN' } })
    await invite(f).expect(403)
  })
  it('M6 keeps quota on failed lookups, replays before quota and returns Retry-After with shared errors', async () => {
    const f = await fixture(),
      key = randomUUID(),
      created = await invite(f, key).expect(201)
    await invite(f, key, { recipientEmail: f.buyer.email }).expect(409)
    await db.privateInvitationRateBucket.updateMany({
      where: { actorId: f.buyer.id, bucket: 'create-minute' },
      data: { count: 10, resetsAt: new Date(Date.now() + 60000) },
    })
    await invite(f, key).expect(201)
    const limited = await invite(f).expect(429)
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0)
    expect(limited.body).toMatchObject({
      error: { code: 'INVITE_RATE_LIMITED', retryable: true },
      meta: { contractVersion: '0.2.0-final-flow' },
    })
    const g = await fixture()
    await invite(g, randomUUID(), { recipientEmail: 'missing@m6.test' }).expect(422)
    expect(
      (
        await db.privateInvitationRateBucket.findUniqueOrThrow({
          where: { actorId_bucket: { actorId: g.buyer.id, bucket: 'create-minute' } },
        })
      ).count,
    ).toBe(1)
    await db.privateInvitationRateBucket.create({
      data: {
        actorId: f.other.id,
        bucket: 'mutation-minute',
        count: 30,
        resetsAt: new Date(Date.now() + 60000),
      },
    })
    await action(created.body.id, f.other.id).expect(429)
  })
  it('M6 persists expiry/invalidation even when mutation or create returns a business error', async () => {
    const f = await fixture(),
      id = (await invite(f).expect(201)).body.id
    await db.bookingParticipantInvitation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await preview(id, f.other.id).expect(200)).body.status).toBe('EXPIRED')
    const expired = await request(app.getHttpServer())
      .get('/me/booking-participant-invitations?status=EXPIRED')
      .auth(f.other.id, { type: 'bearer' })
      .expect(200)
    expect(expired.body.total).toBe(1)
    await action(id, f.other.id, 'decline').expect(410)
    expect((await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id } })).status).toBe('EXPIRED')
    const id2 = (await invite(f).expect(201)).body.id
    await db.booking.update({ where: { id: f.booking.id }, data: { status: 'CANCELLED' } })
    await invite(f).expect(409)
    expect(await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id: id2 } })).toMatchObject({
      status: 'INVALIDATED',
      reason: 'BOOKING_NOT_ELIGIBLE',
    })
    expect((await buyerDetail(f)).participants.find((p) => p.id === f.p.id)).toMatchObject({
      linkageStatus: 'UNLINKED',
      pendingInvitationId: null,
    })
    await action(id2, f.other.id).expect(409)
  })
  it('M6 clamps expiry, supports decline/revoke replay and never revives terminal invitations', async () => {
    const f = await fixture(),
      first = await invite(f, randomUUID(), {
        recipientEmail: ` ${f.other.email.toUpperCase()} `,
        expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
      }).expect(201)
    expect(+new Date(first.body.expiresAt)).toBe(+f.trip.startAt - 1000)
    await invite(f).expect(409)
    await action(first.body.id, f.other.id, 'decline', { reason: 'IDENTITY_MISMATCH' }).expect(200)
    await action(first.body.id, f.other.id, 'decline').expect(200)
    await action(first.body.id, f.other.id).expect(409)
    const second = (await invite(f).expect(201)).body.id
    await action(second, f.other.id, 'revoke').expect(404)
    await action(second, f.buyer.id, 'revoke').expect(200)
    await action(second, f.buyer.id, 'revoke').expect(200)
    expect(
      await db.bookingOutboxEvent.count({ where: { deduplicationKey: `PUBLIC_INVITATION_REVOKED:${second}:2` } }),
    ).toBe(1)
    await post(f).expect(200)
    expect((await preview(second, f.other.id).expect(200)).body.currentAccess.participantActive).toBe(false)
  })
  it('M6 serializes external claims across bookings and durably invalidates the losing invitation', async () => {
    const f = await fixture(),
      g = await fixture()
    await db.booking.update({ where: { id: g.booking.id }, data: { tripId: f.trip.id } })
    const a = (await invite(f).expect(201)).body.id,
      b = (await invite(g, randomUUID(), { recipientEmail: f.other.email }).expect(201)).body.id
    const results = await Promise.all([action(a, f.other.id), action(b, f.other.id)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('TRIP_PARTICIPATION_EXISTS')
    expect(await db.bookingParticipant.count({ where: { userId: f.other.id, booking: { tripId: f.trip.id } } })).toBe(1)
    expect(await db.bookingParticipantInvitation.count({ where: { id: { in: [a, b] }, status: 'INVALIDATED' } })).toBe(
      1,
    )
  })
  it('M6 accept versus revoke/self-claim cannot assign a slot to two accounts', async () => {
    const f = await fixture(),
      id = (await invite(f).expect(201)).body.id
    const results = await Promise.all([action(id, f.other.id), action(id, f.buyer.id, 'revoke'), post(f)])
    const row = await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id } }),
      p = await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })
    if (row.status === 'ACCEPTED') {
      expect(p.userId).toBe(f.other.id)
      expect(results[0].status).toBe(200)
      expect(results[1].status).toBe(409)
    } else {
      expect(row.status).toBe('REVOKED')
      expect(results[0].status).toBe(409)
      expect([null, f.buyer.id]).toContain(p.userId)
    }
    expect(
      await db.bookingOutboxEvent.count({
        where: { aggregateId: f.booking.id, eventType: 'PUBLIC_PARTICIPANT_CLAIMED' },
      }),
    ).toBeLessThanOrEqual(1)
  })
  it('M6 create and self-claim reconcile stale pending recipients consistently with buyer actions', async () => {
    const f = await fixture(),
      id = (await invite(f).expect(201)).body.id
    await db.user.update({ where: { id: f.other.id }, data: { role: 'ADMIN' } })
    expect((await buyerDetail(f)).participants.find((p) => p.id === f.p.id)).toMatchObject({
      linkageStatus: 'UNLINKED',
      actions: { canSelfClaim: true, canInvite: true },
    })
    await post(f).expect(200)
    expect(await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'INVALIDATED',
      reason: 'RECIPIENT_UNAVAILABLE',
    })
    const g = await fixture(),
      old = (await invite(g).expect(201)).body.id
    await db.bookingParticipant.create({
      data: { bookingId: g.booking.id, userId: g.other.id, fullName: 'Already linked', checkinCode: randomUUID() },
    })
    const replacement = await user()
    await invite(g, randomUUID(), { recipientEmail: replacement.email }).expect(201)
    expect(await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id: old } })).toMatchObject({
      status: 'INVALIDATED',
      reason: 'TRIP_PARTICIPATION_EXISTS',
    })
    const h = await fixture(),
      pending = (await invite(h).expect(201)).body.id
    await db.trip.update({ where: { id: h.trip.id }, data: { status: 'CANCEL_PENDING' } })
    expect((await preview(pending, h.other.id).expect(200)).body).toMatchObject({
      status: 'INVALIDATED',
      actions: { canAccept: false },
    })
    await action(pending, h.other.id).expect(409)
    expect((await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id: pending } })).status).toBe(
      'INVALIDATED',
    )
  })
  it('M6 create replay after cancellation retains history without producing a new invitation', async () => {
    const f = await fixture(),
      key = randomUUID(),
      first = await invite(f, key).expect(201)
    await db.booking.update({ where: { id: f.booking.id }, data: { status: 'CANCELLED' } })
    const replay = await invite(f, key).expect(201)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    expect(replay.body).toEqual(first.body)
    expect((await preview(first.body.id, f.other.id).expect(200)).body.status).toBe('INVALIDATED')
    expect(await db.bookingParticipantInvitation.count({ where: { bookingParticipantId: f.p.id } })).toBe(1)
  })
  it('M6 accept rollback is atomic when invitation outbox fails after the claim write', async () => {
    const f = await fixture(),
      id = (await invite(f).expect(201)).body.id
    await db.bookingOutboxEvent.create({
      data: {
        eventType: 'COLLISION',
        aggregateType: 'Booking',
        aggregateId: f.booking.id,
        deduplicationKey: `PUBLIC_INVITATION_ACCEPTED:${id}:2`,
        payload: {},
      },
    })
    const service = new PublicInvitationsService(
      db as unknown as PrismaService,
      new PublicInvitationRequestService(db as unknown as PrismaService),
      claims,
    )
    await expect(service.change(f.other.id, id, 'ACCEPTED')).rejects.toMatchObject({ code: 'P2002' })
    expect(await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })).toMatchObject({
      userId: null,
      checkinCode: f.p.checkinCode,
    })
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).version).toBe(1)
    expect((await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING')
    expect(await db.auditLog.count({ where: { entityId: f.p.id } })).toBe(0)
  })
  it('M6 accept/cancel race preserves accepted history or invalidates pending; retry cannot restore access', async () => {
    const f = await fixture(),
      id = (await invite(f).expect(201)).body.id
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
    const results = await Promise.allSettled([
      action(id, f.other.id),
      cancellation.cancel({
        bookingId: f.booking.id,
        actorId: f.buyer.id,
        actorRole: 'USER',
        idempotencyKey: randomUUID(),
        reason: 'test',
      }),
    ])
    if (results[1].status === 'rejected') throw results[1].reason
    const p = await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } }),
      row = await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id } })
    if (row.status === 'ACCEPTED') {
      const replay = await action(id, f.other.id).expect(200)
      expect(replay.body.currentAccess.participantActive).toBe(false)
      expect(p.userId).toBe(f.other.id)
    } else {
      expect(row.status).toBe('INVALIDATED')
      await action(id, f.other.id).expect(409)
      expect(p.userId).toBeNull()
    }
    expect((await db.bookingParticipant.findUniqueOrThrow({ where: { id: p.id } })).checkinCode).toBe(p.checkinCode)
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).userId).toBe(f.buyer.id)
  })
})
