import { randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { resolve } from 'path'
import { PrivateMembershipController } from './presentation/controllers/private-membership.controller'
import { PrivateMembershipUseCase } from './application/use-cases/private-membership.use-case'
import { PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import request from 'supertest'
import { PrivateMemberInvitationController } from './presentation/controllers/private-member-invitation.controller'
import { PrivateMemberInvitationService } from './infrastructure/adapters/private-member-invitation.service'
import { PrivateInvitationRequestService } from './infrastructure/adapters/private-invitation-request.service'
import { PrivateMembershipPort } from './application/private-membership.port'
import { PrismaPrivateMembershipAdapter } from './infrastructure/adapters/prisma-private-membership.adapter'
import { PrismaPrivateTripAdapter } from './infrastructure/adapters/prisma-private-trip.adapter'
import { PrismaService } from '../../shared/services/prisma.service'
import { GlobalErrorFilter } from '../../shared/errors'
import { AuthenticationGuard } from '../../shared/guards/authentication.guard'
import { AccessTokenGuard } from '../../shared/guards/access-token.guard'
import { ApiKeyGuard } from '../../shared/guards/api-key.guard'
import { SupabaseService } from '../../shared/services/supabase.service'

const url = process.env.INVITATION_TEST_DATABASE_URL
if (
  url &&
  (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
    !new URL(url).pathname.startsWith('/cf01_test_invitation'))
)
  throw new Error('M2 tests require isolated localhost cf01_test_invitation database')
const suite = url ? describe : describe.skip
suite('M2 HTTP and PostgreSQL invitation flow', () => {
  const db = new PrismaClient({ datasourceUrl: url ?? 'postgresql://unused@localhost:1/cf01_test_invitation' })
  let app: INestApplication
  const memberships = new PrismaPrivateMembershipAdapter(db as unknown as PrismaService)
  const trips = new PrismaPrivateTripAdapter(db as unknown as PrismaService)
  const tokens = new Map<string, { id: string }>()
  const user = async () => {
    const row = await db.user.create({
      data: { email: `${randomUUID()}@m2.test`, fullName: 'M2 fixture', authUserId: randomUUID() },
    })
    tokens.set(row.id, { id: row.authUserId! })
    return row
  }
  const fixture = async () => {
    const [host, recipient, other] = await Promise.all([user(), user(), user()])
    const destination = await db.destination.create({ data: { name: 'M2 fixture' } })
    const trip = await db.trip.create({
      data: {
        tripType: 'PRIVATE',
        creatorId: host.id,
        destinationId: destination.id,
        title: 'M2 trip',
        status: 'OPEN',
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 172800000),
        maxPax: 1,
      },
    })
    await db.tripMember.create({ data: { tripId: trip.id, userId: host.id, role: 'HOST', status: 'ACTIVE' } })
    return { host, recipient, other, trip }
  }
  const post = (path: string, actor: string) =>
    request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${actor}`)
  const get = (path: string, actor: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${actor}`)
  const send = (f: Awaited<ReturnType<typeof fixture>>, key = randomUUID()) =>
    post(`/private-trips/${f.trip.id}/member-invitations`, f.host.id)
      .set('Idempotency-Key', key)
      .send({ recipientEmail: f.recipient.email })
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PrivateMemberInvitationController, PrivateMembershipController],
      providers: [
        PrivateMemberInvitationService,
        PrivateMembershipUseCase,
        PrivateInvitationRequestService,
        { provide: PrivateMembershipPort, useClass: PrismaPrivateMembershipAdapter },
        { provide: PrismaService, useValue: db },
      ],
    }).compile()
    app = module.createNestApplication()
    const access = new AccessTokenGuard(
      { verifyToken: async (token: string) => tokens.get(token) ?? null } as unknown as SupabaseService,
      db as unknown as PrismaService,
    )
    app.useGlobalGuards(new AuthenticationGuard(new Reflector(), access, {} as ApiKeyGuard))
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
  })

  it('registers seven bearer-protected operations and documents strict create input', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth(undefined, 'bearer').build())
    const operations = Object.entries(document.paths).filter(([path]) => path.includes('member-invitations'))
      .flatMap(([,path]) => [path.get, path.post].filter(Boolean))
    expect(operations).toHaveLength(7)
    for (const operation of operations) expect(operation!.security).toContainEqual({ bearer: [] })
    for (const operation of operations) {
      const success = operation!.responses['200'] ?? operation!.responses['201']
      expect((success as any).content['application/json'].schema.type).toBe('object')
      expect((operation!.responses['403'] as any).content['application/json'].schema.properties.error).toBeDefined()
    }
    const create = document.paths['/private-trips/{id}/member-invitations'].post!
    expect(create.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Idempotency-Key', in: 'header', required: true })]),
    )
    expect((create.requestBody as any).content['application/json'].schema.additionalProperties).toBe(false)
  })

  const accept = (id: string, actor: string) => post(`/private-trip-member-invitations/${id}/accept`, actor).send({})
  const openFixture = async () => {
    const f = await fixture()
    await db.trip.update({ where: { id: f.trip.id }, data: { maxPax: 2 } })
    return f
  }
  it('M4 executes the standalone handoff collection through HTTP with host and recipient accounts', async () => {
    const f = await openFixture()
    await app.listen(0, '127.0.0.1')
    const base = await app.getUrl()
    const evidence = process.env.INVITATION_EXPORT_EXAMPLES === 'true'
      ? resolve('contracts/private-invitations/examples.local.json') : ''
    try {
      const { stdout } = await promisify(execFile)(process.execPath, [resolve('scripts/run-private-invitation-smoke.cjs')], {
        env: { ...process.env, INVITATION_API_BASE_URL: base, INVITATION_HOST_TOKEN: f.host.id,
          INVITATION_RECIPIENT_TOKEN: f.recipient.id, INVITATION_TRIP_ID: f.trip.id,
          INVITATION_RECIPIENT_EMAIL: f.recipient.email, INVITATION_SMOKE_ALLOW_MUTATIONS: 'true',
          INVITATION_SMOKE_EVIDENCE_FILE: evidence },
        timeout: 30000,
      })
      expect(stdout).toContain('PASS expired accept')
      expect(stdout).toContain('PASS room')
    } catch { throw new Error('M4 handoff HTTP collection failed; run the runner with dedicated test fixtures for step diagnostics.') }
  }, 35000)
  const link = (f: Awaited<ReturnType<typeof fixture>>) =>
    db.privateTripInvite.create({
      data: {
        tripId: f.trip.id,
        createdBy: f.host.id,
        code: randomUUID().replaceAll('-', '').repeat(2),
        expiresAt: new Date(Date.now() + 3600000),
        maxUses: 1,
      },
    })
  it('M3 accepts once, replays current access after LEFT, and only a fresh invitation can rejoin', async () => {
    const f = await openFixture(),
      invitation = await send(f),
      legacy = await link(f)
    const results = await Promise.all([
      accept(invitation.body.id, f.recipient.id),
      accept(invitation.body.id, f.recipient.id),
    ])
    expect(results.map((r) => r.status)).toEqual([200, 200])
    const body = results[0].body
    expect(body).toMatchObject({
      invitationStatus: 'ACCEPTED',
      canEnterRoom: true,
      membershipStatus: 'ACTIVE',
      membershipVersionAtAccept: 1,
    })
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: f.trip.id, eventType: 'PRIVATE_TRIP_MEMBER_JOINED' } }),
    ).toBe(1)
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { id: legacy.id } })).usedCount).toBe(0)
    await memberships.join(f.recipient.id, legacy.code)
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { id: legacy.id } })).usedCount).toBe(0)
    await memberships.leave(f.recipient.id, f.trip.id, 1)
    const replay = await accept(invitation.body.id, f.recipient.id).expect(200)
    expect(replay.body).toMatchObject({
      canEnterRoom: false,
      membershipStatus: 'LEFT',
      membershipVersion: 2,
      membershipVersionAtAccept: 1,
      rejoined: false,
    })
    await db.tripMember.update({
      where: { id: body.memberId },
      data: { attendanceStatus: 'ABSENT', attendedAt: new Date(), attendanceMarkedBy: f.host.id },
    })
    const fresh = await send(f).expect(201)
    const rejoin = await accept(fresh.body.id, f.recipient.id).expect(200)
    expect(rejoin.body).toMatchObject({
      memberId: body.memberId,
      rejoined: true,
      membershipVersion: 3,
      membershipVersionAtAccept: 3,
    })
    expect(await db.tripMember.findUniqueOrThrow({ where: { id: body.memberId } })).toMatchObject({
      attendanceStatus: 'NOT_MARKED',
      leftAt: null,
      joinedByInviteId: null,
    })
    await db.user.update({ where: { id: f.recipient.id }, data: { role: 'LEADER' } })
    await accept(fresh.body.id, f.recipient.id).expect(200)
  })
  it('M3 two recipients compete for one slot; loser remains pending', async () => {
    const f = await openFixture(),
      first = await send(f),
      second = await send({ ...f, recipient: f.other })
    const results = await Promise.all([accept(first.body.id, f.recipient.id), accept(second.body.id, f.other.id)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('CAPACITY_CONFLICT')
    expect(await db.tripMember.count({ where: { tripId: f.trip.id, status: 'ACTIVE' } })).toBe(2)
    expect(await db.privateTripMemberInvitation.count({ where: { tripId: f.trip.id, status: 'PENDING' } })).toBe(1)
  })
  it('M3 link and direct for the same user create only one membership and one joined event', async () => {
    const f = await openFixture(),
      invitation = await send(f),
      legacy = await link(f)
    const [direct] = await Promise.all([
      accept(invitation.body.id, f.recipient.id),
      memberships.join(f.recipient.id, legacy.code),
    ])
    expect(direct.status).toBe(200)
    const row = await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: invitation.body.id } })
    expect(['ACCEPTED', 'INVALIDATED']).toContain(row.status)
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { id: legacy.id } })).usedCount).toBe(
      row.status === 'ACCEPTED' ? 0 : 1,
    )
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: f.trip.id, eventType: 'PRIVATE_TRIP_MEMBER_JOINED' } }),
    ).toBe(1)
    const member = await db.tripMember.findUniqueOrThrow({
      where: { tripId_userId: { tripId: f.trip.id, userId: f.recipient.id } },
    })
    await memberships.leave(f.recipient.id, f.trip.id, member.version)
    const replay = await accept(invitation.body.id, f.recipient.id).expect(row.status === 'ACCEPTED' ? 200 : 409)
    if (row.status === 'ACCEPTED') expect(replay.body.canEnterRoom).toBe(false)
    else expect(replay.body.error.code).toBe('INVITATION_NOT_ACTIONABLE')
  })
  it('M3 accept/revoke and accept/cancel races preserve a single consistent outcome', async () => {
    const f = await openFixture(),
      invitation = await send(f)
    const results = await Promise.all([
      accept(invitation.body.id, f.recipient.id),
      post(`/private-trip-member-invitations/${invitation.body.id}/revoke`, f.host.id).send({}),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const state = await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: invitation.body.id } })
    expect(await db.tripMember.count({ where: { tripId: f.trip.id, userId: f.recipient.id } })).toBe(
      state.status === 'ACCEPTED' ? 1 : 0,
    )
    const g = await openFixture(),
      other = await send(g)
    const race = await Promise.allSettled([
      accept(other.body.id, g.recipient.id),
      trips.cancel(g.host.id, g.trip.id, g.trip.version),
    ])
    expect(race[0].status).toBe('fulfilled')
    const after = await db.trip.findUniqueOrThrow({ where: { id: g.trip.id } })
    if (after.status !== 'CANCELLED') await trips.cancel(g.host.id, g.trip.id, after.version)
    const final = await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: other.body.id } })
    expect(['ACCEPTED', 'INVALIDATED']).toContain(final.status)
    expect(await db.tripMember.count({ where: { tripId: g.trip.id, userId: g.recipient.id } })).toBe(
      final.status === 'ACCEPTED' ? 1 : 0,
    )
  })
  it('M3 removes pending invitations and blocks removed members; accepted history never rejoins', async () => {
    const f = await openFixture(),
      invitation = await send(f)
    const member = await db.tripMember.create({ data: { tripId: f.trip.id, userId: f.recipient.id, status: 'LEFT' } })
    await memberships.remove(f.host.id, f.trip.id, member.id, member.version)
    expect((await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: invitation.body.id } })).reason).toBe(
      'MEMBER_REMOVED',
    )
    await accept(invitation.body.id, f.recipient.id).expect(409)
    const stale = await db.privateTripMemberInvitation.create({
      data: {
        tripId: f.trip.id,
        senderUserId: f.host.id,
        recipientUserId: f.recipient.id,
        recipientEmailSnapshot: f.recipient.email,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })
    const blocked = await accept(stale.id, f.recipient.id).expect(403)
    expect(blocked.body.error.details.reason).toBe('MEMBER_REMOVED')
    expect((await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe(
      'INVALIDATED',
    )
    const g = await openFixture(),
      sent = await send(g),
      accepted = await accept(sent.body.id, g.recipient.id)
    await memberships.remove(g.host.id, g.trip.id, accepted.body.memberId, accepted.body.membershipVersion)
    expect((await accept(sent.body.id, g.recipient.id).expect(200)).body).toMatchObject({
      invitationStatus: 'ACCEPTED',
      membershipStatus: 'REMOVED',
      canEnterRoom: false,
    })
  })
  it('M3 commits accept expiry, rejects wrong actor/role, validates host and body', async () => {
    const f = await openFixture(),
      invitation = await send(f),
      path = `/private-trip-member-invitations/${invitation.body.id}/accept`
    await accept(invitation.body.id, f.other.id).expect(404)
    await post(path, f.recipient.id).send({ userId: f.other.id }).expect(400)
    await db.user.update({ where: { id: f.recipient.id }, data: { role: 'LEADER' } })
    await accept(invitation.body.id, f.recipient.id).expect(403)
    await db.user.update({ where: { id: f.recipient.id }, data: { role: 'USER' } })
    await db.tripMember.updateMany({ where: { tripId: f.trip.id, userId: f.host.id }, data: { status: 'LEFT' } })
    const missing = await accept(invitation.body.id, f.recipient.id).expect(409)
    expect(missing.body.error.details.reason).toBe('HOST_MEMBERSHIP_MISSING')
    await db.privateTripMemberInvitation.update({
      where: { id: invitation.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    await accept(invitation.body.id, f.recipient.id).expect(410)
    expect((await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: invitation.body.id } })).status).toBe(
      'EXPIRED',
    )
  })
  it('M3 rolls back membership, invitation, audit and trip version when the acceptance outbox fails', async () => {
    const f = await openFixture(),
      invitation = await send(f)
    await db.bookingOutboxEvent.create({
      data: {
        deduplicationKey: `PRIVATE_TRIP_MEMBER_INVITATION_ACCEPTED:${invitation.body.id}:2`,
        eventType: 'TEST_COLLISION',
        aggregateType: 'PRIVATE_TRIP',
        aggregateId: f.trip.id,
        payload: {},
      },
    })
    await expect(memberships.accept(f.recipient.id, invitation.body.id)).rejects.toMatchObject({ code: 'P2002' })
    expect(await db.tripMember.count({ where: { tripId: f.trip.id, userId: f.recipient.id } })).toBe(0)
    expect((await db.trip.findUniqueOrThrow({ where: { id: f.trip.id } })).version).toBe(f.trip.version)
    expect((await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: invitation.body.id } })).status).toBe(
      'PENDING',
    )
    expect(await db.auditLog.count({ where: { entityId: invitation.body.id } })).toBe(1)
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: f.trip.id, eventType: 'PRIVATE_TRIP_MEMBER_JOINED' } }),
    ).toBe(0)
  })
  it('M3 link winner invalidates pending and direct retry returns current access without consuming another use', async () => {
    const f = await openFixture(),
      invitation = await send(f),
      legacy = await link(f)
    const joined = await memberships.join(f.recipient.id, legacy.code)
    expect(joined.alreadyMember).toBe(false)
    const direct = await accept(invitation.body.id, f.recipient.id).expect(200)
    expect(direct.body).toMatchObject({
      invitationStatus: 'INVALIDATED',
      resolutionReason: 'ALREADY_MEMBER',
      canEnterRoom: true,
      alreadyMember: true,
    })
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { id: legacy.id } })).usedCount).toBe(1)
    await memberships.leave(f.recipient.id, f.trip.id, direct.body.membershipVersion)
    expect((await accept(invitation.body.id, f.recipient.id).expect(409)).body.error.code).toBe(
      'INVITATION_NOT_ACTIONABLE',
    )
  })
  it('M3 rescheduling shortens stored expiry without extending it again', async () => {
    const f = await openFixture(),
      invitation = await send(f)
    const pickup = await db.pickupPoint.create({
      data: {
        code: randomUUID(),
        name: 'M3',
        address: 'test',
        latitude: 0,
        longitude: 0,
        createdBy: f.host.id,
        destinationId: f.trip.destinationId,
      },
    })
    const startAt = new Date(Date.now() + 1800000)
    const updated = await trips.update(f.host.id, f.trip.id, {
      expectedVersion: f.trip.version,
      startAt: startAt.toISOString(),
      pickupPointId: pickup.id,
    })
    const shortened = await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: invitation.body.id } })
    expect(+shortened.expiresAt).toBe(+startAt - 1000)
    await trips.update(f.host.id, f.trip.id, {
      expectedVersion: updated.version,
      startAt: f.trip.startAt.toISOString(),
    })
    expect(
      +(await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: invitation.body.id } })).expiresAt,
    ).toBe(+shortened.expiresAt)
  })
  it('creates despite full capacity, replays concurrently, emits once, never creates membership or leaks email', async () => {
    const f = await fixture(),
      key = randomUUID()
    const responses = await Promise.all([send(f, key), send(f, key)])
    expect(responses.map((r) => r.status)).toEqual([201, 201])
    expect(responses[0].body).toEqual(responses[1].body)
    const id = responses[0].body.id
    expect(responses[0].body.reservesCapacity).toBe(false)
    expect(JSON.stringify(responses[0].body)).not.toContain(f.recipient.email)
    expect(await db.tripMember.count({ where: { tripId: f.trip.id } })).toBe(1)
    expect(await db.auditLog.count({ where: { entityId: id } })).toBe(1)
    expect(await db.bookingOutboxEvent.count({ where: { aggregateId: f.trip.id } })).toBe(1)
    expect((await send(f)).status).toBe(409)
    const changed = await post(`/private-trips/${f.trip.id}/member-invitations`, f.host.id)
      .set('Idempotency-Key', key)
      .send({ recipientEmail: f.other.email })
    expect(changed.status).toBe(409)
  })
  it('enforces authentication, host and recipient scoping with strict DTO and shared error envelope', async () => {
    const f = await fixture(),
      created = await send(f),
      id = created.body.id
    await request(app.getHttpServer()).get(`/private-trip-member-invitations/${id}`).expect(401)
    const denied = await get(`/private-trip-member-invitations/${id}`, f.other.id).expect(404)
    expect(denied.body.error.code).toBe('NOT_FOUND')
    expect(denied.body.meta.requestId).toBeTruthy()
    await get(`/private-trips/${f.trip.id}/member-invitations`, f.other.id).expect(404)
    await post(`/private-trip-member-invitations/${id}/decline`, f.host.id).send({}).expect(404)
    await post(`/private-trip-member-invitations/${id}/revoke`, f.recipient.id).send({}).expect(404)
    await post(`/private-trip-member-invitations/${id}/decline`, f.recipient.id)
      .send({ recipientUserId: f.other.id })
      .expect(400)
    await post(`/private-trips/${f.trip.id}/member-invitations`, f.host.id)
      .send({ recipientEmail: f.other.email })
      .expect(400)
    expect((await get('/me/private-trip-member-invitations', f.other.id)).body.total).toBe(0)
    const preview = await get(`/private-trip-member-invitations/${id}`, f.recipient.id).expect(200)
    expect(preview.body.actions.canDecline).toBe(true)
    expect(preview.body.trip).not.toHaveProperty('tripTrailPlans')
    await db.user.update({ where: { id: f.recipient.id }, data: { email: `${randomUUID()}@changed.test` } })
    await get(`/private-trip-member-invitations/${id}`, f.recipient.id).expect(200)
  })
  it('decline/revoke race has one terminal transition and retries do not emit again', async () => {
    const f = await fixture(),
      {
        body: { id },
      } = await send(f)
    const results = await Promise.all([
      post(`/private-trip-member-invitations/${id}/decline`, f.recipient.id).send({ reason: 'OTHER' }),
      post(`/private-trip-member-invitations/${id}/revoke`, f.host.id).send({}),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const row = await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id } })
    const action = row.status === 'DECLINED' ? 'decline' : 'revoke'
    await post(`/private-trip-member-invitations/${id}/${action}`, action === 'decline' ? f.recipient.id : f.host.id)
      .send({})
      .expect(200)
    expect(await db.auditLog.count({ where: { entityId: id } })).toBe(2)
    expect(await db.bookingOutboxEvent.count({ where: { aggregateId: f.trip.id } })).toBe(2)
    await send(f).expect(201)
  })
  it('commits expiry before 410; effective list filtering works and resend replaces expired pending', async () => {
    const f = await fixture(),
      {
        body: { id },
      } = await send(f)
    await db.privateTripMemberInvitation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await get('/me/private-trip-member-invitations?status=PENDING', f.recipient.id)).body.total).toBe(0)
    expect((await get('/me/private-trip-member-invitations?status=EXPIRED', f.recipient.id)).body.total).toBe(1)
    await post(`/private-trip-member-invitations/${id}/decline`, f.recipient.id).send({}).expect(410)
    expect((await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id } })).status).toBe('EXPIRED')
    const second = await send(f).expect(201)
    await db.privateTripMemberInvitation.update({
      where: { id: second.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    await send(f).expect(201)
    expect(await db.privateTripMemberInvitation.count({ where: { tripId: f.trip.id, status: 'EXPIRED' } })).toBe(2)
  })
  it('invalidates cancelled invitations on action, preserves accepted records and host authority', async () => {
    const f = await fixture(),
      {
        body: { id },
      } = await send(f)
    await db.trip.update({ where: { id: f.trip.id }, data: { status: 'CANCELLED' } })
    await post(`/private-trip-member-invitations/${id}/revoke`, f.host.id).send({}).expect(409)
    expect((await db.privateTripMemberInvitation.findUniqueOrThrow({ where: { id } })).status).toBe('INVALIDATED')
    const g = await fixture(),
      accepted = await send(g)
    const member = await db.tripMember.create({ data: { tripId: g.trip.id, userId: g.recipient.id } })
    await db.privateTripMemberInvitation.update({
      where: { id: accepted.body.id },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
        acceptedMemberId: member.id,
        membershipVersionAtAccept: member.version,
      },
    })
    const res = await post(`/private-trip-member-invitations/${accepted.body.id}/revoke`, g.host.id)
      .send({})
      .expect(409)
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION')
    expect((await db.tripMember.findUniqueOrThrow({ where: { id: member.id } })).status).toBe('ACTIVE')
    await db.tripMember.updateMany({ where: { tripId: g.trip.id, userId: g.host.id }, data: { status: 'LEFT' } })
    await get(`/private-trips/${g.trip.id}/member-invitations`, g.host.id).expect(404)
  })
  it('serializes different keys and handles normalized ambiguous or ineligible recipients neutrally', async () => {
    const f = await fixture()
    const results = await Promise.all([send(f), send(f)])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    const g = await fixture()
    await db.user.create({
      data: {
        email: ` ${g.recipient.email.toUpperCase()} `,
        fullName: 'Duplicate normalized email',
        authUserId: randomUUID(),
      },
    })
    await send(g).expect(422)
    const h = await fixture()
    await db.user.update({ where: { id: h.recipient.id }, data: { role: 'LEADER' } })
    await send(h).expect(422)
    await db.user.update({ where: { id: h.recipient.id }, data: { role: 'USER' } })
    await db.tripMember.create({ data: { tripId: h.trip.id, userId: h.recipient.id, status: 'REMOVED' } })
    await send(h).expect(422)
    await db.tripMember.updateMany({ where: { tripId: h.trip.id, userId: h.recipient.id }, data: { status: 'LEFT' } })
    await send(h).expect(201)
  })
  it('uses earlier start for expiry and cannot replay terminal actions after losing authorization', async () => {
    const f = await fixture(),
      created = await send(f)
    await db.trip.update({ where: { id: f.trip.id }, data: { startAt: new Date(Date.now() - 1000) } })
    const preview = await get(`/private-trip-member-invitations/${created.body.id}`, f.recipient.id).expect(200)
    expect(preview.body.status).toBe('EXPIRED')
    expect(preview.body.actions.canDecline).toBe(false)
    await post(`/private-trip-member-invitations/${created.body.id}/revoke`, f.host.id).send({}).expect(410)
    const g = await fixture(),
      second = await send(g)
    await post(`/private-trip-member-invitations/${second.body.id}/revoke`, g.host.id).send({}).expect(200)
    await db.tripMember.updateMany({ where: { tripId: g.trip.id, userId: g.host.id }, data: { status: 'LEFT' } })
    await post(`/private-trip-member-invitations/${second.body.id}/revoke`, g.host.id).send({}).expect(404)
  })
  it('neutral recipient errors consume quota and rate errors include Retry-After', async () => {
    const f = await fixture()
    const path = `/private-trips/${f.trip.id}/member-invitations`
    for (const email of ['missing@m2.test', f.host.email]) {
      const res = await post(path, f.host.id)
        .set('Idempotency-Key', randomUUID())
        .send({ recipientEmail: email })
        .expect(422)
      expect(res.body.error.code).toBe('INVITATION_RECIPIENT_UNAVAILABLE')
    }
    const quota = await db.privateInvitationRateBucket.findUniqueOrThrow({
      where: { actorId_bucket: { actorId: f.host.id, bucket: 'create-minute' } },
    })
    expect(quota.count).toBe(2)
    await db.privateInvitationRateBucket.update({
      where: { actorId_bucket: { actorId: f.host.id, bucket: 'create-minute' } },
      data: { count: 1000, resetsAt: new Date(Date.now() + 60000) },
    })
    const limited = await send(f).expect(429)
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0)
    expect(limited.body.error.retryable).toBe(true)
  })
})
