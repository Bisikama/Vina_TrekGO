import { randomUUID } from 'node:crypto'
import { Controller, Get, INestApplication, Param, Post, Body } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { AppError, BOOKING_ERROR_CODES as B, GlobalErrorFilter } from '../../shared/errors'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { PrismaService } from '../../shared/services/prisma.service'
import { privateInvitationExpiry } from './application/private-invitation.policy'
import {
  createPrivateMemberInvitationSchema,
  privateMemberInvitationPageSchema,
} from './presentation/dtos/private-member-invitation.dto'
import { PrivateInvitationRequestService } from './infrastructure/adapters/private-invitation-request.service'

// HTTP fixture only. No invitation business endpoints are registered in TripsModule in M1.
@Controller('foundation')
class FoundationController {
  @Post()
  create(@Body(new ZodValidationPipe(createPrivateMemberInvitationSchema)) body: unknown) {
    return body
  }
  @Get(':code')
  error(@Param('code') code: string) {
    throw AppError.fromCode(code)
  }
}

describe('Private invitation foundation contract', () => {
  let app: INestApplication
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [FoundationController] }).compile()
    app = module.createNestApplication()
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
  })
  it('normalizes email and rejects ownership injection through the shared pipe/filter', async () => {
    const good = await request(app.getHttpServer())
      .post('/foundation')
      .send({ recipientEmail: ' B@Example.com ' })
      .expect(201)
    expect(good.body.recipientEmail).toBe('b@example.com')
    const bad = await request(app.getHttpServer())
      .post('/foundation')
      .send({ recipientEmail: 'b@example.com', recipientUserId: randomUUID() })
      .expect(400)
    expect(bad.body.error.code).toBe('VALIDATION_ERROR')
    expect(bad.body.meta.requestId).toBeTruthy()
  })
  it.each([
    [B.PENDING_INVITATION_EXISTS, 409],
    [B.INVITATION_NOT_ACTIONABLE, 409],
    [B.INVITATION_RECIPIENT_UNAVAILABLE, 422],
    [B.INVITE_RATE_LIMITED, 429],
  ])('formats %s through GlobalErrorFilter', async (code, status) => {
    const res = await request(app.getHttpServer())
      .get(`/foundation/${code}`)
      .expect(status as number)
    expect(res.body.error.code).toBe(code)
    expect(res.body.error.retryable).toBe(code === B.INVITE_RATE_LIMITED)
    expect(res.body.meta.serverTime).toBeTruthy()
    expect(res.body.code).toBeUndefined()
  })
  it('caps expiry by TTL and trip start, rejects elapsed expiry, bounds paging', () => {
    const now = new Date('2026-10-21T00:00:00Z')
    const start = new Date('2026-10-22T00:00:00Z')
    expect(privateInvitationExpiry(now, start).toISOString()).toBe('2026-10-21T23:59:59.000Z')
    expect(privateInvitationExpiry(now, new Date('2026-12-01T00:00:00Z'), '2026-11-15T00:00:00Z', 3600).getTime()).toBe(
      +now + 3600000,
    )
    expect(() => privateInvitationExpiry(now, start, now.toISOString())).toThrow(AppError)
    expect(privateMemberInvitationPageSchema.safeParse({ pageSize: 51 }).success).toBe(false)
    expect(privateMemberInvitationPageSchema.parse({})).toEqual({ page: 1, pageSize: 20 })
  })
})

const url = process.env.INVITATION_TEST_DATABASE_URL
if (url) {
  const u = new URL(url)
  if (!['127.0.0.1', 'localhost'].includes(u.hostname) || !u.pathname.startsWith('/cf01_test_invitation')) {
    throw new Error('Invitation foundation tests require an isolated localhost cf01_test_invitation database')
  }
}
const databaseSuite = url ? describe : describe.skip
databaseSuite('Private invitation foundation on real PostgreSQL (apply migration before running)', () => {
  const db = new PrismaClient({ datasourceUrl: url ?? 'postgresql://unused:unused@127.0.0.1:1/cf01_test_invitation' })
  const service = new PrivateInvitationRequestService(db as unknown as PrismaService)
  let senderId: string, recipientId: string, tripId: string, memberId: string
  beforeAll(async () => {
    await db.$connect()
    const user = () =>
      db.user.create({
        data: { email: `${randomUUID()}@invitation.test`, authUserId: randomUUID(), fullName: 'Invitation test' },
      })
    senderId = (await user()).id
    recipientId = (await user()).id
    const destination = await db.destination.create({ data: { name: 'M1 isolated fixture' } })
    tripId = (
      await db.trip.create({
        data: {
          tripType: 'PRIVATE',
          creatorId: senderId,
          destinationId: destination.id,
          title: 'M1 fixture',
          status: 'OPEN',
          startAt: new Date(Date.now() + 86400000),
          endAt: new Date(Date.now() + 172800000),
          maxPax: 4,
        },
      })
    ).id
    memberId = (await db.tripMember.create({ data: { tripId, userId: recipientId } })).id
  })
  afterAll(async () => {
    await db.$disconnect()
  })
  const data = () => ({
    tripId,
    senderUserId: senderId,
    recipientUserId: recipientId,
    recipientEmailSnapshot: 'recipient@invitation.test',
    expiresAt: new Date(Date.now() + 3600000),
  })

  it('enforces one pending under concurrency but allows repeated acceptance snapshots for one member', async () => {
    const results = await Promise.allSettled([
      db.privateTripMemberInvitation.create({ data: data() }),
      db.privateTripMemberInvitation.create({ data: data() }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(failure.reason.code).toBe('P2002')
    await db.privateTripMemberInvitation.updateMany({ where: { tripId }, data: { status: 'EXPIRED' } })
    for (const version of [1, 2]) {
      await db.privateTripMemberInvitation.create({
        data: {
          ...data(),
          status: 'ACCEPTED',
          acceptedMemberId: memberId,
          membershipVersionAtAccept: version,
          respondedAt: new Date(),
        },
      })
    }
    expect(await db.privateTripMemberInvitation.count({ where: { acceptedMemberId: memberId } })).toBe(2)
    await expect(
      db.privateTripMemberInvitation.create({ data: { ...data(), tripId: randomUUID() } }),
    ).rejects.toMatchObject({ code: 'P2003' })
    await expect(db.privateTripMemberInvitation.create({ data: { ...data(), status: 'ACCEPTED' } })).rejects.toThrow()
  })
  it('commits one mutation for concurrent same-key create, scopes by actor/target and rejects changed payload', async () => {
    const key = randomUUID()
    const work = jest.fn(async (tx: Parameters<Parameters<typeof service.create>[4]>[0]) => {
      const row = await tx.privateTripMemberInvitation.create({ data: { ...data(), status: 'DECLINED' } })
      return { invitationId: row.id }
    })
    const results = await Promise.all([
      service.create(senderId, tripId, key, { email: 'a@test.com' }, work),
      service.create(senderId, tripId, key, { email: 'a@test.com' }, work),
    ])
    expect(work).toHaveBeenCalledTimes(1)
    expect(results[0].body).toEqual(results[1].body)
    expect(results.map((r) => r.replayed).sort()).toEqual([false, true])
    await expect(service.create(senderId, tripId, key, { email: 'changed@test.com' }, work)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
    })
    const quota = await db.privateInvitationRateBucket.findUniqueOrThrow({
      where: { actorId_bucket: { actorId: senderId, bucket: 'create-day' } },
    })
    expect(quota.count).toBe(1)
    await service.create(recipientId, tripId, key, { email: 'a@test.com' }, async () => ({ differentActor: true }))
    await service.create(senderId, randomUUID(), key, { email: 'a@test.com' }, async () => ({ differentTrip: true }))
  })
  it('rolls back work on failure but preserves quota, and reuses expired replay records', async () => {
    const actor = randomUUID(),
      key = randomUUID()
    await expect(
      service.create(actor, tripId, key, {}, async (tx) => {
        await tx.privateTripMemberInvitation.create({ data: { ...data(), reason: key, status: 'DECLINED' } })
        throw AppError.fromCode(B.INVITATION_RECIPIENT_UNAVAILABLE)
      }),
    ).rejects.toMatchObject({ code: B.INVITATION_RECIPIENT_UNAVAILABLE })
    expect(await db.privateTripMemberInvitation.count({ where: { reason: key } })).toBe(0)
    expect(
      (
        await db.privateInvitationRateBucket.findUniqueOrThrow({
          where: { actorId_bucket: { actorId: actor, bucket: 'create-day' } },
        })
      ).count,
    ).toBe(1)
    const first = await service.create(actor, tripId, key, {}, async () => ({ revision: 1 }))
    expect(first.replayed).toBe(false)
    await db.idempotencyRecord.updateMany({
      where: { userId: actor },
      data: { completedAt: new Date(Date.now() - 2 * 86400000) },
    })
    const again = await service.create(actor, tripId, key, {}, async () => ({ revision: 2 }))
    expect(again).toMatchObject({ replayed: false, body: { revision: 2 } })
  })
  it('uses one connection and preserves quota even when business SQL violates a foreign key', async () => {
    const singleUrl = new URL(url!)
    singleUrl.searchParams.set('connection_limit', '1')
    const single = new PrismaClient({ datasourceUrl: singleUrl.toString() })
    const isolated = new PrivateInvitationRequestService(single as unknown as PrismaService)
    const actor = randomUUID()
    try {
      await expect(
        isolated.create(actor, tripId, randomUUID(), {}, async (tx) => {
          await tx.privateTripMemberInvitation.create({ data: { ...data(), tripId: randomUUID() } })
          return { unreachable: true }
        }),
      ).rejects.toMatchObject({ code: 'P2003' })
      const result = await isolated.create(actor, tripId, randomUUID(), {}, async () => ({ recovered: true }))
      expect(result.body.recovered).toBe(true)
      expect(
        (
          await single.privateInvitationRateBucket.findUniqueOrThrow({
            where: { actorId_bucket: { actorId: actor, bucket: 'create-day' } },
          })
        ).count,
      ).toBe(2)
    } finally {
      await single.$disconnect()
    }
  })

  it('shares atomic quotas between instances, retains denied count and resets elapsed windows', async () => {
    const actor = randomUUID()
    const second = new PrivateInvitationRequestService(db as unknown as PrismaService)
    const results = await Promise.allSettled(
      Array.from({ length: 11 }, (_, i) => (i % 2 ? service : second).consumeRate(actor, 'create')),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10)
    const denied = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(denied.reason).toMatchObject({
      code: B.INVITE_RATE_LIMITED,
      details: { retryAfterSeconds: expect.any(Number) },
    })
    // Day limit is independent from minute reset and mutation budget.
    await db.privateInvitationRateBucket.updateMany({
      where: { actorId: actor, bucket: 'create-day' },
      data: { count: 50, resetsAt: new Date(Date.now() + 86400000) },
    })
    await db.privateInvitationRateBucket.updateMany({
      where: { actorId: actor, bucket: 'create-minute' },
      data: { resetsAt: new Date(0) },
    })
    await expect(service.consumeRate(actor, 'create')).rejects.toMatchObject({ code: B.INVITE_RATE_LIMITED })
    await expect(service.consumeRate(actor, 'mutation')).resolves.toBeUndefined()
    await db.privateInvitationRateBucket.updateMany({ where: { actorId: actor }, data: { resetsAt: new Date(0) } })
    await expect(service.consumeRate(actor, 'create')).resolves.toBeUndefined()
  })
})
