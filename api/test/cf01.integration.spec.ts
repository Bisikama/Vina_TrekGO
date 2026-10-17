import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaTripAdapter } from '../src/modules/trips/infrastructure/adapters/prisma-trip.adapter'
import { PublicTripUseCase } from '../src/modules/trips/application/use-cases/public-trip.use-case'
import type { PrismaService } from '../src/shared/services/prisma.service'
import type { Actor, TripInput } from '../src/modules/trips/application/trip.types'

const url = process.env.CF01_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.startsWith('/cf01_test'))
    throw new Error('CF01 integration tests require an isolated localhost cf01_test database.')
}
const suite = url ? describe : describe.skip
suite('CF01 real PostgreSQL transactions', () => {
  const db = new PrismaClient({ datasourceUrl: url || 'postgresql://unused:unused@127.0.0.1:1/cf01_test' })
  const service = new PublicTripUseCase(new PrismaTripAdapter(db as unknown as PrismaService))
  let actor: Actor
  let input: TripInput
  let checkpoints: string[]
  let trails: string[]
  beforeAll(async () => {
    await db.$connect()
  })
  afterAll(async () => {
    await db.$disconnect()
  })
  beforeEach(async () => {
    const user = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@cf01.test`, fullName: 'Leader test', role: 'LEADER' },
    })
    actor = { id: user.id, role: user.role, status: user.status }
    const destination = await db.destination.create({ data: { name: 'CF01 fixture' } })
    const pickup = await db.pickupPoint.create({
      data: {
        destinationId: destination.id,
        code: randomUUID(),
        name: 'Meeting',
        address: 'Test only',
        latitude: 10,
        longitude: 106,
        createdBy: user.id,
      },
    })
    checkpoints = []
    for (let i = 0; i < 3; i++)
      checkpoints.push(
        (
          await db.checkpoint.create({
            data: { destinationId: destination.id, name: `Point ${i}`, latitude: 10 + i, longitude: 106 },
          })
        ).id,
      )
    trails = []
    for (let i = 0; i < 2; i++) {
      const trail = await db.systemTrail.create({
        data: {
          destinationId: destination.id,
          code: randomUUID(),
          name: `Trail ${i}`,
          difficulty: 'EASY',
          distanceKm: 2,
          routeGeojson: {
            type: 'LineString',
            coordinates: [
              [106, 10 + i],
              [106, 11 + i],
            ],
          },
          createdBy: user.id,
        },
      })
      await db.trailCheckpoint.createMany({
        data: [
          { systemTrailId: trail.id, checkpointId: checkpoints[i], sequence: 1 },
          { systemTrailId: trail.id, checkpointId: checkpoints[i + 1], sequence: 2 },
        ],
      })
      trails.push(trail.id)
    }
    const start = Date.now() + 86400000 * 30
    input = {
      destinationId: destination.id,
      title: 'CF01 integration',
      startAt: new Date(start).toISOString(),
      endAt: new Date(start + 3600000).toISOString(),
      pickupPointId: pickup.id,
      capacity: 8,
      price: '250000',
      priceExplanation: 'Chi phí ăn uống, vé và hướng dẫn: 250000 VND/người.',
    }
  })
  const readyTrip = async () => {
    let trip = await service.create(actor, input)
    trip = await service.setCheckpoints(actor, trip.id, trip.version, [checkpoints[0], checkpoints[2]])
    return service.setTrails(actor, trip.id, trip.version, trails)
  }
  it('persists/resumes draft, snapshots connected trails, publishes and hides draft/route data from public', async () => {
    const trip = await readyTrip()
    await expect(service.publicDetail(trip.id)).rejects.toMatchObject({ status: 404 })
    expect((await service.detail(actor, trip.id)).trails).toHaveLength(2)
    expect((await service.readiness(actor, trip.id)).canPublish).toBe(true)
    const published = await service.publish(actor, trip.id, trip.version)
    expect(published.status).toBe('OPEN')
    expect(published.publishedAt).not.toBeNull()
    expect(await service.publicDetail(trip.id)).not.toHaveProperty('trails')
    expect(await service.publicDetail(trip.id)).not.toHaveProperty('priceExplanation')
    expect((await service.detail(actor, trip.id)).priceExplanation).toBe(input.priceExplanation)
    await expect(service.update(actor, trip.id, published.version, { title: 'Forbidden' })).rejects.toMatchObject({
      status: 409,
    })
    await expect(service.publish(actor, trip.id, published.version)).rejects.toMatchObject({ status: 409 })
  })
  it('serializes simultaneous overlapping creates: exactly one succeeds', async () => {
    const result = await Promise.allSettled([service.create(actor, input), service.create(actor, input)])
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const error = result.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(error.reason.getResponse().code).toBe('LEADER_SCHEDULE_CONFLICT')
    expect(await db.trip.count({ where: { leaderId: actor.id } })).toBe(1)
  })
  it('allows adjacent intervals and different leaders, rejects overlapping update', async () => {
    const first = await service.create(actor, input)
    const next = await service.create(actor, {
      ...input,
      startAt: input.endAt,
      endAt: new Date(Date.parse(input.endAt) + 3600000).toISOString(),
    })
    await expect(service.update(actor, next.id, next.version, { startAt: input.startAt })).rejects.toMatchObject({
      status: 409,
    })
    const second = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@cf01.test`, fullName: 'Other', role: 'LEADER' },
    })
    await expect(service.create({ id: second.id, role: 'LEADER', status: 'ACTIVE' }, input)).resolves.toHaveProperty(
      'status',
      'DRAFT',
    )
    expect(first.id).not.toBe(next.id)
  })
  it('prevents lost updates from concurrent editors', async () => {
    const trip = await service.create(actor, input)
    const results = await Promise.allSettled([
      service.update(actor, trip.id, trip.version, { title: 'A' }),
      service.update(actor, trip.id, trip.version, { title: 'B' }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.getResponse().code).toBe(
      'VERSION_CONFLICT',
    )
  })
  it('rejects unauthorized actors, nonowners and users demoted after authentication', async () => {
    expect(() => service.create({ ...actor, role: 'USER' }, input)).toThrow()
    expect(() => service.create({ ...actor, role: 'ADMIN' }, input)).toThrow()
    const trip = await service.create(actor, input)
    await expect(service.detail({ ...actor, id: randomUUID() }, trip.id)).rejects.toMatchObject({ status: 403 })
    await db.user.update({ where: { id: actor.id }, data: { status: 'SUSPENDED' } })
    await expect(service.update(actor, trip.id, trip.version, { title: 'Blocked' })).rejects.toMatchObject({
      status: 403,
    })
  })
  it('preserves draft and prior selections when validation fails', async () => {
    let trip = await service.create(actor, input)
    await expect(service.publish(actor, trip.id, trip.version)).rejects.toMatchObject({ status: 422 })
    trip = await service.setCheckpoints(actor, trip.id, trip.version, [checkpoints[0]])
    expect(() => service.setCheckpoints(actor, trip.id, trip.version, [checkpoints[0], checkpoints[0]])).toThrow()
    await expect(service.setCheckpoints(actor, trip.id, trip.version, [randomUUID()])).rejects.toMatchObject({
      status: 404,
    })
    expect((await service.detail(actor, trip.id)).checkpoints.map((c) => c.sourceCheckpointId)).toEqual([
      checkpoints[0],
    ])
  })
  it('rejects PersonalTrail, other-destination checkpoint and inactive pickup', async () => {
    const personal = await db.personalTrail.create({ data: { userId: actor.id, title: 'Private', routeGeojson: {} } })
    const trip = await service.create(actor, input)
    await expect(service.setTrails(actor, trip.id, trip.version, [personal.id])).rejects.toMatchObject({ status: 422 })
    const other = await db.destination.create({ data: { name: 'Other' } })
    const point = await db.checkpoint.create({
      data: { destinationId: other.id, name: 'Other', latitude: 1, longitude: 1 },
    })
    await expect(service.setCheckpoints(actor, trip.id, trip.version, [point.id])).rejects.toMatchObject({
      status: 400,
    })
    await db.pickupPoint.update({ where: { id: input.pickupPointId }, data: { status: 'INACTIVE' } })
    await expect(service.update(actor, trip.id, trip.version, { title: 'Invalid pickup' })).rejects.toMatchObject({
      status: 400,
    })
  })
  it('detects changed source membership even without a trail version bump', async () => {
    const trip = await readyTrip()
    await db.trailCheckpoint.deleteMany({ where: { systemTrailId: trails[1], checkpointId: checkpoints[2] } })
    const readiness = await service.readiness(actor, trip.id)
    expect(readiness.issues.some((i) => i.code === 'PLAN_SOURCE_CHANGED')).toBe(true)
    await expect(service.publish(actor, trip.id, trip.version)).rejects.toMatchObject({ status: 422 })
    expect((await service.detail(actor, trip.id)).status).toBe('DRAFT')
  })
  it('one simultaneous publish succeeds and one cancellation request is persisted', async () => {
    const trip = await readyTrip()
    const results = await Promise.allSettled([
      service.publish(actor, trip.id, trip.version),
      service.publish(actor, trip.id, trip.version),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const published = await service.detail(actor, trip.id)
    const cancellations = await Promise.allSettled([
      service.cancel(actor, trip.id, published.version, 'Weather', []),
      service.cancel(actor, trip.id, published.version, 'Weather', []),
    ])
    expect(cancellations.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const requests = await db.tripCancellationRequest.findMany({ where: { tripId: trip.id } })
    expect(requests).toHaveLength(1)
    expect(requests[0].previousTripStatus).toBe('OPEN')
    expect((await service.detail(actor, trip.id)).status).toBe('CANCEL_PENDING')
  })
})
