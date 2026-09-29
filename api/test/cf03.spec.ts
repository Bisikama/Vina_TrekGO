import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/shared/services/prisma.service'
import { GlobalErrorFilter } from '../src/shared/errors'
import { PrivateTripPort, PrivateTripInput } from '../src/modules/trips/application/private-trip.port'
import { PrivateTripUseCase } from '../src/modules/trips/application/use-cases/private-trip.use-case'
import { PrismaPrivateTripAdapter } from '../src/modules/trips/infrastructure/adapters/prisma-private-trip.adapter'
import { PrivateTripController } from '../src/modules/trips/presentation/controllers/private-trip.controller'
import { REQUEST_USER_KEY } from '../src/shared/constants/auth.constant'

const url = process.env.CF03_TEST_DATABASE_URL
if (url) {
  const u = new URL(url)
  if (!['127.0.0.1', 'localhost'].includes(u.hostname) || u.pathname !== '/cf03_test')
    throw new Error('Use isolated localhost cf03_test only')
}
;(url ? describe : describe.skip)('CF03 PostgreSQL + shared HTTP error contract', () => {
  const db = new PrismaClient({ datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/cf03_test' })
  const service = new PrivateTripUseCase(new PrismaPrivateTripAdapter(db as unknown as PrismaService))
  let actor: { id: string; role: string; status: string }
  let input: PrivateTripInput
  let systemId: string
  let systemPoint: string
  let app: INestApplication
  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [PrivateTripController],
      providers: [
        PrivateTripUseCase,
        { provide: PrivateTripPort, useValue: new PrismaPrivateTripAdapter(db as unknown as PrismaService) },
      ],
    }).compile()
    app = m.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    // Auth boundary fixture only: actual Supabase is not used by these isolated tests.
    app.use((req: Record<string, unknown>, _res: unknown, next: () => void) => {
      req[REQUEST_USER_KEY] = actor
      next()
    })
    await app.init()
  })
  afterAll(async () => {
    await app.close()
    await db.$disconnect()
  })
  beforeEach(async () => {
    actor = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@cf03.test`, fullName: 'Host', role: 'USER' },
    })
    const d = await db.destination.create({ data: { name: 'CF03 test' } })
    const p = await db.pickupPoint.create({
      data: {
        destinationId: d.id,
        code: randomUUID(),
        name: 'Pickup',
        address: 'Test',
        latitude: 10,
        longitude: 106,
        createdBy: actor.id,
      },
    })
    const trail = await db.personalTrail.create({
      data: {
        userId: actor.id,
        destinationId: d.id,
        title: 'Private route',
        routeGeojson: {
          type: 'LineString',
          coordinates: [
            [106, 10],
            [106, 11],
          ],
        },
      },
    })
    const point = await db.personalCheckpoint.create({
      data: { personalTrailId: trail.id, name: 'Goal', latitude: 11, longitude: 106, sequence: 1 },
    })
    const system = await db.systemTrail.create({
      data: {
        code: randomUUID(),
        name: 'Purchased route',
        destinationId: d.id,
        difficulty: 'EASY',
        distanceKm: 1,
        createdBy: actor.id,
        routeGeojson: trail.routeGeojson!,
      },
    })
    systemId = system.id
    const cp = await db.checkpoint.create({
      data: { destinationId: d.id, name: 'System goal', latitude: 11, longitude: 106 },
    })
    systemPoint = cp.id
    await db.trailCheckpoint.create({ data: { systemTrailId: system.id, checkpointId: cp.id, sequence: 1 } })
    input = {
      type: 'PERSONAL',
      trailRef: trail.id,
      destinationId: d.id,
      title: 'Private trip',
      startAt: new Date(Date.now() + 86400000 * 10).toISOString(),
      endAt: new Date(Date.now() + 86400000 * 11).toISOString(),
      pickupPointId: p.id,
      capacity: 3,
      checkpointIds: [point.id],
    }
  })
  const create = async () =>
    (await service.create(actor, input)) as { id: string; version: number; status: string; creatorId: string }
  it('creates OPEN personal snapshots with one HOST, no bookings, and keeps them private', async () => {
    const trip = await create()
    expect(trip.status).toBe('OPEN')
    expect(trip.creatorId).toBe(actor.id)
    expect(await db.booking.count({ where: { tripId: trip.id } })).toBe(0)
    expect(await db.tripMember.count({ where: { tripId: trip.id, userId: actor.id, role: 'HOST', status: 'ACTIVE' } })).toBe(1)
    expect(await db.trip.count({ where: { id: trip.id, tripType: 'PUBLIC' } })).toBe(0)
    const plan = await db.tripTrailPlan.findFirstOrThrow({ where: { tripId: trip.id } })
    expect(plan.personalTrailId).toBe(input.trailRef)
    expect(plan.systemTrailId).toBeNull()
    await db.personalTrail.update({ where: { id: input.trailRef }, data: { title: 'Changed master' } })
    expect((await db.tripTrailPlan.findUniqueOrThrow({ where: { id: plan.id } })).snapshotName).toBe('Private route')
  })
  it('requires active purchased access for SYSTEM', async () => {
    input = { ...input, type: 'SYSTEM', trailRef: systemId, checkpointIds: [systemPoint] }
    await expect(create()).rejects.toMatchObject({ code: 'TRAIL_ACCESS_REQUIRED' })
    await db.trailAccess.create({ data: { userId: actor.id, systemTrailId: systemId, status: 'ACTIVE' } })
    expect((await create()).status).toBe('OPEN')
  })
  it('rejects archived personal trail and LEADER', async () => {
    await db.personalTrail.update({ where: { id: input.trailRef }, data: { archivedAt: new Date() } })
    await expect(create()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(() => service.create({ ...actor, role: 'LEADER' }, input)).toThrow()
  })
  it('validates payload and returns shared error envelope through HTTP', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/private-trips')
      .send({ ...input, capacity: 0 })
      .expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(response.body.meta.requestId).toBeTruthy()
    const business = await request(app.getHttpServer())
      .post('/api/v1/private-trips')
      .send({ ...input, type: 'SYSTEM', trailRef: systemId, checkpointIds: [systemPoint] })
      .expect(403)
    expect(business.body.error.code).toBe('TRAIL_ACCESS_REQUIRED')
  })
  it('rejects invalid time, checkpoint order, destination and ownership', async () => {
    expect(() => service.create(actor, { ...input, startAt: input.endAt })).toThrow()
    await expect(
      service.create(actor, { ...input, checkpointIds: [...input.checkpointIds, ...input.checkpointIds] }),
    ).rejects.toMatchObject({ code: 'INVALID_TRAIL_FOR_TRIP_TYPE' })
    await expect(service.create(actor, { ...input, destinationId: randomUUID() })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    const other = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@cf03.test`, fullName: 'Other', role: 'USER' },
    })
    await expect(service.create(other, input)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
  it('creates multi-use invite, revokes previous code and checks expiry/version', async () => {
    const trip = await create()
    await expect(service.invite(actor, trip.id, 1, input.startAt)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    const first = (await service.invite(actor, trip.id, 1)) as { inviteCode: string; tripVersion: number }
    const second = (await service.invite(actor, trip.id, first.tripVersion)) as { inviteCode: string }
    expect(second.inviteCode).not.toBe(first.inviteCode)
    expect((await db.privateTripInvite.findUniqueOrThrow({ where: { code: first.inviteCode } })).status).toBe('REVOKED')
    await expect(service.invite(actor, trip.id, 1)).rejects.toMatchObject({ code: 'PRIVATE_TRIP_VERSION_CONFLICT' })
  })
  it('serializes concurrent updates and atomically writes outbox', async () => {
    const trip = await create()
    const results = await Promise.allSettled([
      service.update(actor, trip.id, { expectedVersion: 1, title: 'A' }),
      service.update(actor, trip.id, { expectedVersion: 1, title: 'B' }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: trip.id, eventType: 'PRIVATE_TRIP_UPDATED' } }),
    ).toBe(1)
  })
  it('cancels directly, revokes invites, emits cancellation and blocks further updates', async () => {
    const trip = await create()
    await service.invite(actor, trip.id, 1)
    const cancelled = (await service.cancel(actor, trip.id, 2, 'Changed plans')) as { status: string }
    expect(cancelled.status).toBe('CANCELLED')
    expect(await db.privateTripInvite.count({ where: { tripId: trip.id, status: 'ACTIVE' } })).toBe(0)
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: trip.id, eventType: 'PRIVATE_TRIP_CANCELLED' } }),
    ).toBe(1)
    await expect(service.update(actor, trip.id, { expectedVersion: 3, title: 'Blocked' })).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    })
  })
  it('reschedules, revokes invalidated invites and protects current member capacity', async () => {
    const trip = await create()
    await service.invite(actor, trip.id, 1)
    const startAt = new Date(Date.now() + 86400000).toISOString()
    await service.update(actor, trip.id, { expectedVersion: 2, startAt })
    expect(await db.privateTripInvite.count({ where: { tripId: trip.id, status: 'ACTIVE' } })).toBe(0)
    for (let i = 0; i < 2; i++) {
      const member = await db.user.create({
        data: { authUserId: randomUUID(), email: `${randomUUID()}@cf03.test`, fullName: 'Member' },
      })
      await db.tripMember.create({ data: { tripId: trip.id, userId: member.id } })
    }
    await expect(service.update(actor, trip.id, { expectedVersion: 3, capacity: 1 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    expect((await db.trip.findUniqueOrThrow({ where: { id: trip.id } })).version).toBe(3)
  })
  it('blocks other hosts, actions after start and revoked actor permission', async () => {
    const trip = await create()
    const other = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@cf03.test`, fullName: 'Other' },
    })
    await expect(service.cancel(other, trip.id, 1)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await db.trip.update({ where: { id: trip.id }, data: { startAt: new Date(Date.now() - 1000) } })
    await expect(service.invite(actor, trip.id, 1)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' })
    await db.user.update({ where: { id: actor.id }, data: { role: 'LEADER' } })
    await expect(service.read(actor, trip.id)).rejects.toMatchObject({ code: 'LEADER_CANNOT_CREATE_PRIVATE_TRIP' })
  })
})
