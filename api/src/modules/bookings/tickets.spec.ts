jest.mock('@nestjs/schedule', () => ({ Interval: () => () => {}, Cron: () => () => {} }))
import { PublicInvitationsController } from './public-invitations.controller'

import { PublicInvitationsService, PublicInvitationRequestService } from './public-invitations.service'
import { BookingsService } from './bookings.service'
import { BookingsController } from './bookings.controller'
import { BookingPolicyService } from './booking-policy.service'
import { LeaderCheckinController } from './leader-checkin.controller'
import { LeaderCheckinService } from './leader-checkin.service'
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
import { InvitationInboxController } from './invitation-inbox.controller'
import { InvitationInboxService } from './invitation-inbox.service'
import { TicketsService } from './tickets.service'
import { BookingParticipationContextService } from './booking-participation-context.service'
import { ParticipantClaimService } from './participant-claim.service'
import { BookingCancellationService } from './booking-cancellation.service'
import { PaymentsPort } from '../payments/payments.port'
import { PrismaService } from '../../shared/services/prisma.service'
import { SupabaseService } from '../../shared/services/supabase.service'
import { AuthenticationGuard } from '../../shared/guards/authentication.guard'
import { AccessTokenGuard } from '../../shared/guards/access-token.guard'
import { ApiKeyGuard } from '../../shared/guards/api-key.guard'
import { GlobalErrorFilter } from '../../shared/errors'
import { TripNavigationController } from '../trips/presentation/controllers/trip-navigation.controller'
import { GetNavigationContextUseCase } from '../trips/application/use-cases/get-navigation-context.use-case'
import { SwitchTrailUseCase } from '../trips/application/use-cases/switch-trail.use-case'
import { NavigationContextPort } from '../trips/application/port/navigation-context.port'
import { PrismaNavigationContextAdapter } from '../trips/infrastructure/adapters/prisma-navigation-context.adapter'
import { TripHistoryController } from '../trips/presentation/controllers/trip-history.controller'
import { TripHistoryUseCase } from '../trips/application/use-cases/trip-history.use-case'
import { TripHistoryPort } from '../trips/application/trip-history.port'
import { PrismaTripHistoryAdapter } from '../trips/infrastructure/adapters/prisma-trip-history.adapter'

const url = process.env.PUBLIC_CLAIM_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (
    !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
    !parsed.pathname.startsWith('/cf01_test_invitation_m5')
  ) {
    throw new Error('M5 requires isolated localhost cf01_test_invitation_m5* database')
  }
}
const suite = url ? describe : describe.skip
suite('M5 real PostgreSQL and HTTP contract', () => {
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
    tokens.set(u.id, { id: u.authUserId })
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
      controllers: [
        TicketsController,
        InvitationInboxController,
        PublicInvitationsController,
        BookingsController,
        LeaderCheckinController,
        TripNavigationController,
        TripHistoryController,
      ],
      providers: [
        InvitationInboxService,
        GetNavigationContextUseCase,
        SwitchTrailUseCase,
        TripHistoryUseCase,
        { provide: NavigationContextPort, useClass: PrismaNavigationContextAdapter },
        { provide: TripHistoryPort, useClass: PrismaTripHistoryAdapter },
        PublicInvitationsService,
        {
          provide: BookingsService,
          useValue: new BookingsService(db as unknown as PrismaService, {} as BookingPolicyService),
        },
        PublicInvitationRequestService,
        ParticipantClaimService,
        TicketsService,
        LeaderCheckinService,
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
    for (const secret of ['PRIVATE_PHONE', 'PRIVATE_ID', f.p.checkinCode, f.sibling.fullName, 'totalAmount', 'invoice'])
      expect(JSON.stringify(detail.body)).not.toContain(secret)
    expect(detail.body.checkinCode).toBe(p.checkinCode)
    expect(detail.body.permissions.canCheckIn).toBe(true)
    expect(detail.headers['cache-control']).toBe('no-store')
    await request(app.getHttpServer()).get(`/me/tickets/${f.p.id}`).auth(f.other.id, { type: 'bearer' }).expect(404)
    const list = await request(app.getHttpServer())
      .get('/me/tickets?page=1&pageSize=20')
      .auth(f.buyer.id, { type: 'bearer' })
      .expect(200)
    expect(list.body.total).toBe(1)
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth(undefined, 'bearer').build())
    const m5m6Paths = Object.keys(doc.paths).filter(
      (k) =>
        k !== '/me/invitations' &&
        !k.startsWith('/leader/') &&
        !k.endsWith('/history') &&
        !k.endsWith('/navigation-context') &&
        !k.endsWith('/switch-trail'),
    )
    expect(m5m6Paths).toHaveLength(13)
    const ajv = new Ajv({ strict: false, nullable: true })
    for (const [path, method, body] of [
      ['/bookings/{id}/participants/{pid}/self-claim', 'post', results[0].body],
      ['/me/tickets', 'get', list.body],
      ['/me/tickets/{participantId}', 'get', detail.body],
    ] as const) {
      const operation = doc.paths[path][method]!
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
      const cancelledTicket = await tickets.detail(f.buyer.id, f.p.id)
      expect(cancelledTicket.bookingStatus).toBe('CANCELLED')
      expect(cancelledTicket.checkinCode).toBeNull()
      expect(cancelledTicket.permissions.canCheckIn).toBe(false)
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

  const nav = (tripId: string, actor: string) =>
    request(app.getHttpServer()).get(`/trips/${tripId}/navigation-context`).auth(actor, { type: 'bearer' })
  const history = (actor: string, query = '') =>
    request(app.getHttpServer()).get(`/me/public-trip-participations/history${query}`).auth(actor, { type: 'bearer' })

  it('M8 unified inbox uses a recipient-scoped keyset across types and microsecond ties', async () => {
    const f = await fixture()
    const sent = await invite(f).expect(201)
    const privateTrip = await db.trip.create({ data: { ...f.trip, id: randomUUID(), tripType: 'PRIVATE' } })
    const privateInvite = await db.privateTripMemberInvitation.create({
      data: {
        tripId: privateTrip.id,
        senderUserId: f.buyer.id,
        recipientUserId: f.other.id,
        recipientEmailSnapshot: f.other.email,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    await db.$executeRaw`UPDATE booking_participant_invitations SET created_at='2026-10-25T00:00:00.123456Z'::timestamptz WHERE id=${sent.body.id}::uuid`
    await db.$executeRaw`UPDATE private_trip_member_invitations SET created_at='2026-10-25T00:00:00.123456Z'::timestamptz WHERE id=${privateInvite.id}::uuid`
    const get = (actor: string, query = '') =>
      request(app.getHttpServer())
        .get('/me/invitations' + query)
        .auth(actor, { type: 'bearer' })
    const first = await get(f.other.id, '?limit=1').expect(200)
    expect(first.headers['cache-control']).toBe('no-store')
    expect(first.body).toMatchObject({
      hasMore: true,
      items: [{ id: sent.body.id, type: 'PUBLIC', previewRequired: true }],
    })
    expect(first.body.items[0].createdAt).toBe('2026-10-25T00:00:00.123456Z')
    // A new item at the head between requests must not repeat or shift the next page.
    await db.privateTripMemberInvitation.create({
      data: {
        tripId: privateTrip.id,
        senderUserId: f.buyer.id,
        recipientUserId: f.other.id,
        recipientEmailSnapshot: f.other.email,
        status: 'REVOKED',
        expiresAt: new Date(),
        createdAt: new Date('2026-10-26'),
      },
    })
    const cursor = encodeURIComponent(first.body.nextCursor)
    const second = await get(f.other.id, '?limit=1&cursor=' + cursor).expect(200)
    expect(second.body).toMatchObject({
      hasMore: false,
      nextCursor: null,
      items: [{ id: privateInvite.id, type: 'PRIVATE' }],
    })
    expect((await get(f.other.id, '?type=PUBLIC').expect(200)).body.items).toHaveLength(1)
    expect((await get(f.buyer.id).expect(200)).body.items).toHaveLength(0)
    for (const query of [
      '?limit=51',
      '?cursor=invalid',
      '?status=PENDING',
      '?userId=' + f.other.id,
      '?limit=1&type=PUBLIC&cursor=' + cursor,
      '?limit=2&cursor=' + cursor,
    ]) {
      const error = await get(f.other.id, query).expect(400)
      expect(error.body.error.code).toBe('VALIDATION_ERROR')
      expect(error.body.meta.requestId).toBeDefined()
    }
    await get(f.buyer.id, '?limit=1&cursor=' + cursor).expect(400)
    await request(app.getHttpServer()).get('/me/invitations').expect(401)
    await db.user.update({ where: { id: f.other.id }, data: { role: 'STAFF_DELIVERY' } })
    await get(f.other.id).expect(403)
    await db.user.update({ where: { id: f.other.id }, data: { role: 'LEADER' } })
    await get(f.other.id).expect(200)
    for (const secret of [f.other.email, 'PRIVATE_PHONE', 'PRIVATE_ID', 'checkinCode', 'bookingId', 'recipientUserId'])
      expect(JSON.stringify(first.body)).not.toContain(secret)
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth(undefined, 'bearer').build())
    const schema = (doc.paths['/me/invitations'].get!.responses['200'] as any).content['application/json'].schema
    const validate = new Ajv({ strict: false, nullable: true }).compile(schema)
    expect({ valid: validate(first.body), errors: validate.errors }).toEqual({ valid: true, errors: null })
    if (process.env.M8_CAPTURE_EXAMPLES === 'true')
      writeFileSync(
        'contracts/invitation-inbox/examples.local.json',
        JSON.stringify({ firstPage: first.body, nextPage: second.body }, null, 2) + '\n',
      )
  })

  it('M7 grants navigation only after accept without granting booking ownership or trail mutation', async () => {
    const f = await fixture()
    const denied = await nav(f.trip.id, f.other.id).expect(403)
    expect(denied.body).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' })
    const sent = await invite(f).expect(201)
    await action(sent.body.id, f.other.id).expect(200)
    const context = await nav(f.trip.id, f.other.id).expect(200)
    expect(context.body.accessSource).toBe('PUBLIC_PARTICIPANT')
    expect(context.headers['cache-control']).toBe('no-store')
    expect((await tickets.detail(f.other.id, f.p.id)).permissions.canNavigate).toBe(true)
    expect((await preview(sent.body.id, f.buyer.id).expect(200)).body.currentAccess.canNavigate).toBe(false)
    await request(app.getHttpServer()).get(`/bookings/${f.booking.id}`).auth(f.other.id, { type: 'bearer' }).expect(404)
    await request(app.getHttpServer())
      .post(`/trips/${f.trip.id}/switch-trail`)
      .auth(f.other.id, { type: 'bearer' })
      .send({ toPlanId: randomUUID() })
      .expect(403)
    await nav(f.trip.id, (await user()).id).expect(403)
    for (const secret of ['PRIVATE_PHONE', 'PRIVATE_ID', 'checkinCode', 'totalAmount', f.booking.id])
      expect(JSON.stringify(context.body)).not.toContain(secret)
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth(undefined, 'bearer').build())
    const schema = (doc.paths['/trips/{tripId}/navigation-context'].get!.responses['200'] as any).content[
      'application/json'
    ].schema
    const validate = new Ajv({ strict: false, nullable: true }).compile(schema)
    expect({ valid: validate(context.body), errors: validate.errors }).toEqual({ valid: true, errors: null })
    if (process.env.M7_CAPTURE_EXAMPLES === 'true')
      writeFileSync(
        'contracts/public-participation/navigation.local.json',
        JSON.stringify(context.body, null, 2) + '\n',
      )
  })

  it('M7 revokes linked access for each invalid participant, booking and trip state', async () => {
    const f = await fixture()
    await db.bookingParticipant.update({ where: { id: f.p.id }, data: { userId: f.other.id } })
    for (const status of ['OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS'] as const) {
      await db.trip.update({ where: { id: f.trip.id }, data: { status } })
      await nav(f.trip.id, f.other.id).expect(200)
    }
    for (const status of ['DRAFT', 'CANCEL_PENDING', 'COMPLETED', 'CANCELLED', 'INTERRUPTED'] as const) {
      await db.trip.update({ where: { id: f.trip.id }, data: { status } })
      await nav(f.trip.id, f.other.id).expect(403)
      expect((await tickets.detail(f.other.id, f.p.id)).permissions.canNavigate).toBe(false)
    }
    await db.trip.update({ where: { id: f.trip.id }, data: { status: 'OPEN' } })
    for (const status of ['CANCELLED', 'EXPIRED', 'COMPLETED'] as const) {
      await db.booking.update({ where: { id: f.booking.id }, data: { status } })
      await nav(f.trip.id, f.other.id).expect(403)
    }
    for (const status of ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN'] as const) {
      await db.booking.update({ where: { id: f.booking.id }, data: { status } })
      await nav(f.trip.id, f.other.id).expect(200)
    }
    for (const status of ['CANCELLED', 'NO_SHOW'] as const) {
      await db.bookingParticipant.update({ where: { id: f.p.id }, data: { status } })
      await nav(f.trip.id, f.other.id).expect(403)
    }
    await db.bookingParticipant.update({ where: { id: f.p.id }, data: { status: 'ACTIVE' } })
    await db.user.update({ where: { id: f.other.id }, data: { role: 'LEADER' } })
    await nav(f.trip.id, f.other.id).expect(200)
    await db.user.update({ where: { id: f.other.id }, data: { role: 'STAFF_DELIVERY' } })
    await nav(f.trip.id, f.other.id).expect(403)
    await history(f.other.id).expect(403)
    await db.user.update({ where: { id: f.other.id }, data: { role: 'USER', status: 'SUSPENDED' } })
    await nav(f.trip.id, f.other.id).expect(403)
    await history(f.other.id).expect(403)
  })

  it('M7 preserves legacy buyer, manager, admin and Private member access without backfilling identity', async () => {
    const f = await fixture(),
      manager = await user(),
      admin = await user()
    await db.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } })
    await db.trip.update({ where: { id: f.trip.id }, data: { creatorId: manager.id, leaderId: manager.id } })
    expect((await nav(f.trip.id, f.buyer.id).expect(200)).body.accessSource).toBe('BOOKING_BUYER')
    expect((await nav(f.trip.id, manager.id).expect(200)).body.accessSource).toBe('TRIP_MANAGER')
    expect((await nav(f.trip.id, admin.id).expect(200)).body.accessSource).toBe('ADMIN')
    expect((await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })).userId).toBeNull()
    await db.booking.update({ where: { id: f.booking.id }, data: { status: 'CANCELLED' } })
    await nav(f.trip.id, f.buyer.id).expect(403)
    // A historical cancelled buyer booking cannot shadow a valid participant in another booking.
    const second = await db.booking.create({
      data: { ...f.booking, id: randomUUID(), status: 'CONFIRMED', userId: manager.id },
    })
    await db.bookingParticipant.create({
      data: { bookingId: second.id, fullName: 'Linked buyer', userId: f.buyer.id, checkinCode: randomUUID() },
    })
    expect((await nav(f.trip.id, f.buyer.id).expect(200)).body.accessSource).toBe('PUBLIC_PARTICIPANT')
    await db.trip.update({ where: { id: f.trip.id }, data: { tripType: 'PRIVATE' } })
    await nav(f.trip.id, f.buyer.id).expect(403)
    await db.tripMember.create({ data: { tripId: f.trip.id, userId: f.other.id } })
    expect((await nav(f.trip.id, f.other.id).expect(200)).body.accessSource).toBe('PRIVATE_MEMBER')
  })

  it('M7 deduplicates linked history, keeps cancelled/no-show links and preserves buyer history', async () => {
    const f = await fixture()
    await db.bookingParticipant.update({ where: { id: f.p.id }, data: { userId: f.other.id, status: 'CANCELLED' } })
    await db.bookingParticipant.update({ where: { id: f.sibling.id }, data: { userId: f.other.id, status: 'NO_SHOW' } })
    await db.booking.update({ where: { id: f.booking.id }, data: { status: 'CANCELLED', confirmedAt: new Date() } })
    expect((await history(f.other.id).expect(200)).body.total).toBe(0)
    for (const status of ['COMPLETED', 'CANCELLED', 'INTERRUPTED'] as const) {
      await db.trip.update({ where: { id: f.trip.id }, data: { status } })
      const result = await history(f.other.id).expect(200)
      expect(result.body).toMatchObject({
        total: 1,
        totalPages: 1,
        items: [
          {
            id: f.trip.id,
            participationSource: 'PUBLIC_PARTICIPANT',
            permissions: { canNavigate: false, canRent: false, canCheckIn: false, reason: 'HISTORICAL_ONLY' },
          },
        ],
      })
      expect(result.headers['cache-control']).toBe('no-store')
      for (const secret of ['checkinCode', 'PRIVATE_PHONE', 'PRIVATE_ID', 'totalAmount', f.booking.id])
        expect(JSON.stringify(result.body)).not.toContain(secret)
    }
    expect((await history(f.buyer.id).expect(200)).body.total).toBe(0)
    const oldHistory = (actor: string) =>
      request(app.getHttpServer()).get('/me/public-trips/history').auth(actor, { type: 'bearer' })
    expect((await oldHistory(f.buyer.id).expect(200)).body.total).toBe(1)
    expect((await oldHistory(f.other.id).expect(200)).body.total).toBe(0)
    expect((await history(f.other.id, '?page=2&pageSize=1').expect(200)).body).toMatchObject({ total: 1, items: [] })
    const invalid = await history(f.other.id, `?userId=${f.buyer.id}`).expect(400)
    expect(invalid.body.error.code).toBeDefined()
    expect(invalid.body.meta.requestId).toBeDefined()
    await history(f.other.id, '?pageSize=51').expect(400)
    await request(app.getHttpServer()).get('/me/public-trip-participations/history').expect(401)
    const result = await history(f.other.id).expect(200)
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth(undefined, 'bearer').build())
    const schema = (doc.paths['/me/public-trip-participations/history'].get!.responses['200'] as any).content[
      'application/json'
    ].schema
    const validate = new Ajv({ strict: false, nullable: true }).compile(schema)
    expect({ valid: validate(result.body), errors: validate.errors }).toEqual({ valid: true, errors: null })
    if (process.env.M7_CAPTURE_EXAMPLES === 'true')
      writeFileSync(
        'contracts/public-participation/examples.local.json',
        JSON.stringify({ history: result.body, validationError: invalid.body }, null, 2) + '\n',
      )
    await db.trip.update({ where: { id: f.trip.id }, data: { tripType: 'PRIVATE' } })
    expect((await history(f.other.id).expect(200)).body.total).toBe(0)
  })

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
      const op = doc.paths[path][method]!
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
  const m9Fixture = async () => {
    const f = await fixture(),
      leader = await user()
    await db.user.update({ where: { id: leader.id }, data: { role: 'LEADER' } })
    await db.trip.update({ where: { id: f.trip.id }, data: { creatorId: leader.id, leaderId: leader.id } })
    // The buyer has exactly one ticket, intended for another account.
    await db.bookingParticipant.delete({ where: { id: f.sibling.id } })
    await db.booking.update({ where: { id: f.booking.id }, data: { participantCount: 1 } })
    return { ...f, leader }
  }
  const scan = (f: Awaited<ReturnType<typeof m9Fixture>>, code: string, actor = f.leader.id) =>
    request(app.getHttpServer())
      .post(`/leader/trips/${f.trip.id}/checkin`)
      .auth(actor, { type: 'bearer' })
      .send({ checkinCode: code })
  const contextService = new BookingParticipationContextService()
  const context = (f: Awaited<ReturnType<typeof fixture>>, actor: string) =>
    db.$transaction((tx) => contextService.lockAndRead(tx, f.trip.id, actor))

  it('M9 one-ticket gift preserves buyer ownership and exposes versioned participation without secrets', async () => {
    const f = await m9Fixture()
    const sent = await invite(f).expect(201)
    expect((await context(f, f.other.id))!.sources).toEqual([])
    await action(sent.body.id, f.other.id).expect(200)
    const before = await context(f, f.other.id)
    expect(before!.sources).toMatchObject([
      { membershipKind: 'PUBLIC_PARTICIPANT', membershipRef: f.p.id, bookingVersion: 2, sourceActive: true },
    ])
    expect((await context(f, f.buyer.id))!.sources).toMatchObject([
      { membershipKind: 'PUBLIC_BOOKING_BUYER', membershipRef: f.booking.id },
    ])
    for (const secret of ['PRIVATE_PHONE', 'PRIVATE_ID', 'checkinCode', 'payment', f.other.email])
      expect(JSON.stringify(before)).not.toContain(secret)
    const p = await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })
    await scan(f, f.p.checkinCode).expect(422)
    await scan(f, p.checkinCode, f.other.id).expect(403)
    const results = await Promise.all([scan(f, p.checkinCode), scan(f, p.checkinCode)])
    expect(results.map((r) => r.status)).toEqual([200, 200])
    expect(results.map((r) => r.body.replayed).sort()).toEqual([false, true])
    expect(
      await db.bookingOutboxEvent.count({
        where: { aggregateId: f.booking.id, eventType: 'PUBLIC_PARTICIPANT_CHECKED_IN' },
      }),
    ).toBe(1)
    const after = await context(f, f.other.id)
    expect(after!.sources[0]).toMatchObject({ bookingVersion: 3, checkinStatus: 'CHECKED_IN' })
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).userId).toBe(f.buyer.id)
    if (process.env.M9_CAPTURE_EXAMPLES === 'true')
      writeFileSync(
        'contracts/booking-checkin-m9/examples.local.json',
        JSON.stringify(
          { contextBefore: before, contextAfter: after, checkin: results.find((r) => !r.body.replayed)!.body },
          null,
          2,
        ) + '\n',
      )
  })

  it('M9 accept versus old QR scan serializes: claim wins or check-in invalidates the invitation', async () => {
    const f = await m9Fixture(),
      sent = await invite(f).expect(201)
    const [accepted, checked] = await Promise.all([action(sent.body.id, f.other.id), scan(f, f.p.checkinCode)])
    if (accepted.status === 200) {
      expect(checked.status).toBe(422)
      const p = await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })
      expect(p.userId).toBe(f.other.id)
      await scan(f, p.checkinCode).expect(200)
    } else {
      expect(accepted.status).toBe(409)
      expect(checked.status).toBe(200)
      expect((await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id: sent.body.id } })).status).toBe(
        'INVALIDATED',
      )
      expect((await context(f, f.other.id))!.sources).toEqual([])
    }
  })

  it('M9 cancel versus check-in serializes and cancelled QR cannot restore entitlement', async () => {
    for (const concurrent of [false, true]) {
      const f = await m9Fixture(),
        sent = await invite(f).expect(201)
      await action(sent.body.id, f.other.id).expect(200)
      const p = await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })
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
      const cancel = () =>
        cancellation.cancel({
          bookingId: f.booking.id,
          actorId: f.buyer.id,
          actorRole: 'USER',
          idempotencyKey: randomUUID(),
          reason: 'M9 test',
        })
      if (concurrent) {
        const [c, s] = await Promise.allSettled([cancel(), scan(f, p.checkinCode)])
        expect(s.status).toBe('fulfilled')
        if (c.status === 'rejected') {
          expect(c.reason.code).toBe('BOOKING_CANCELLATION_NOT_ALLOWED')
          expect((s as PromiseFulfilledResult<any>).value.status).toBe(200)
          continue
        }
        expect((s as PromiseFulfilledResult<any>).value.status).toBe(409)
      } else await cancel()
      await scan(f, p.checkinCode).expect(409)
      const ctx = await context(f, f.other.id)
      expect(ctx!.sources[0].sourceActive).toBe(false)
      expect((await tickets.detail(f.other.id, f.p.id)).checkinCode).toBeNull()
      const event = await db.bookingOutboxEvent.findFirstOrThrow({
        where: { aggregateId: f.booking.id, eventType: 'BOOKING_CANCELLED' },
      })
      expect(event.payload).toMatchObject({ bookingVersion: ctx!.sources[0].bookingVersion })
    }
  })

  it('M9 rejects terminal trip markers consistently and rolls check-in back when outbox fails', async () => {
    const f = await m9Fixture()
    await db.bookingParticipant.update({ where: { id: f.p.id }, data: { userId: f.other.id } })
    for (const field of ['cancelledAt', 'completedAt']) {
      await db.trip.update({ where: { id: f.trip.id }, data: { [field]: new Date() } })
      expect((await tickets.detail(f.other.id, f.p.id)).permissions.canCheckIn).toBe(false)
      await scan(f, f.p.checkinCode).expect(409)
      await db.trip.update({ where: { id: f.trip.id }, data: { [field]: null } })
    }
    await db.bookingOutboxEvent.create({
      data: {
        eventType: 'COLLISION',
        aggregateType: 'Booking',
        aggregateId: f.booking.id,
        deduplicationKey: `PUBLIC_PARTICIPANT_CHECKED_IN:${f.p.id}:2`,
        payload: {},
      },
    })
    const service = new LeaderCheckinService(db as unknown as PrismaService)
    await expect(
      service.checkin(f.leader.id, f.trip.id, { method: 'QR', checkinCode: f.p.checkinCode }),
    ).rejects.toMatchObject({ code: 'P2002' })
    expect((await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })).checkinStatus).toBe(
      'NOT_CHECKED_IN',
    )
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).version).toBe(1)
    expect(await db.auditLog.count({ where: { entityId: f.p.id } })).toBe(0)
  })

  it('Leader check-in lists participants, scans rotated QR idempotently, syncs booking status, invalidates pending invitations and blocks cancellation', async () => {
    const f = await fixture()
    const leader = f.buyer
    await db.user.update({ where: { id: leader.id }, data: { role: 'LEADER' } })

    // Non-owner cannot list or check in
    await db.user.update({ where: { id: f.other.id }, data: { role: 'LEADER' } })
    await request(app.getHttpServer())
      .get(`/leader/public-trips/${f.trip.id}/participants`)
      .auth(f.other.id, { type: 'bearer' })
      .expect(403)

    // Self-claim slot p (rotates QR) and send pending invitation on sibling slot
    await post(f).expect(200)
    const claimedP = await db.bookingParticipant.findUniqueOrThrow({ where: { id: f.p.id } })
    const pendingInvite = await request(app.getHttpServer())
      .post(`/bookings/${f.booking.id}/participants/${f.sibling.id}/invitations`)
      .auth(leader.id, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ recipientEmail: f.other.email })
      .expect(201)

    // Old pre-claim QR code is rejected with 422 CHECKIN_TOKEN_INVALID
    const invalidQr = await request(app.getHttpServer())
      .post(`/leader/trips/${f.trip.id}/checkin`)
      .auth(leader.id, { type: 'bearer' })
      .send({ checkinCode: f.p.checkinCode, method: 'QR' })
      .expect(422)
    expect(invalidQr.body.error.code).toBe('CHECKIN_TOKEN_INVALID')

    // List participants before check-in
    const listBefore = await request(app.getHttpServer())
      .get(`/leader/public-trips/${f.trip.id}/participants`)
      .auth(leader.id, { type: 'bearer' })
      .expect(200)
    expect(listBefore.body.summary).toMatchObject({
      totalParticipants: 2,
      checkedInCount: 0,
      notCheckedInCount: 2,
      noShowCount: 0,
    })

    // First QR check-in of slot p transitions booking to PARTIAL_CHECKIN
    const firstScan = await request(app.getHttpServer())
      .post(`/leader/trips/${f.trip.id}/checkin`)
      .auth(leader.id, { type: 'bearer' })
      .send({ checkinCode: claimedP.checkinCode, method: 'QR' })
      .expect(200)
    expect(firstScan.body).toMatchObject({
      alreadyCheckedIn: false,
      replayed: false,
      participant: {
        id: f.p.id,
        checkinStatus: 'CHECKED_IN',
        checkinMethod: 'QR',
        bookingStatus: 'PARTIAL_CHECKIN',
      },
      summary: {
        totalParticipants: 2,
        checkedInCount: 1,
        notCheckedInCount: 1,
      },
    })

    // Second QR scan of same code is idempotent (alreadyCheckedIn: true, replayed: true)
    const secondScan = await request(app.getHttpServer())
      .post(`/leader/trips/${f.trip.id}/checkin`)
      .auth(leader.id, { type: 'bearer' })
      .send({ checkinCode: claimedP.checkinCode, method: 'QR' })
      .expect(200)
    expect(secondScan.body).toMatchObject({
      alreadyCheckedIn: true,
      replayed: true,
    })

    // Ticket detail now shows canCheckIn: false and checkinStatus: CHECKED_IN
    const ticketAfter = await request(app.getHttpServer())
      .get(`/me/tickets/${f.p.id}`)
      .auth(leader.id, { type: 'bearer' })
      .expect(200)
    expect(ticketAfter.body.checkinStatus).toBe('CHECKED_IN')
    expect(ticketAfter.body.permissions.canCheckIn).toBe(false)

    // Manual check-in of sibling slot transitions booking to CHECKED_IN and invalidates its PENDING invitation
    const manualCheckin = await request(app.getHttpServer())
      .post(`/leader/public-trips/${f.trip.id}/participants/${f.sibling.id}/checkin`)
      .auth(leader.id, { type: 'bearer' })
      .send({ checkinStatus: 'CHECKED_IN' })
      .expect(200)
    expect(manualCheckin.body).toMatchObject({
      alreadyCheckedIn: false,
      replayed: false,
      participant: {
        id: f.sibling.id,
        checkinStatus: 'CHECKED_IN',
        checkinMethod: 'MANUAL',
        bookingStatus: 'CHECKED_IN',
      },
      summary: {
        totalParticipants: 2,
        checkedInCount: 2,
        notCheckedInCount: 0,
      },
    })
    expect(
      await db.bookingParticipantInvitation.findUniqueOrThrow({ where: { id: pendingInvite.body.id } }),
    ).toMatchObject({
      status: 'INVALIDATED',
      reason: 'PARTICIPANT_NOT_ELIGIBLE',
    })

    // Cancellation is blocked once booking has checked-in participants
    await expect(
      cancellation.cancel({
        bookingId: f.booking.id,
        actorId: leader.id,
        actorRole: 'LEADER',
        idempotencyKey: randomUUID(),
        reason: 'after checkin',
      }),
    ).rejects.toMatchObject({ code: 'BOOKING_CANCELLATION_NOT_ALLOWED' })
  })
})
