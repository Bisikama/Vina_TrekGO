import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, Prisma } from '@prisma/client'
import mongoose from 'mongoose'
import { seedCoreflowsHappy, demoConfigSchema, startTime, demoPricing, scenarios } from '../prisma/seeds/coreflows-happy.seed'
import type { Manifest } from '../prisma/seeds/booking-demo.seed'
import { syncNotifications, verifyDemo } from '../prisma/seeds/booking-demo.verify'
import { containsOwnedId } from '../prisma/seeds/booking-demo.cleanup'
import { Notification, NotificationSchema } from '../src/modules/notifications/schemas/notification.schema'
import { loadBookingPolicySeeds } from '../prisma/seeds/booking-policy.seed'

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue
const actors = () => Object.fromEntries(['admin','leader','booker1','booker2','host','claimedMember','invitedMember'].map((k) => [k, randomUUID()]))
const baseConfig = () => ({ batch: `test_${randomUUID().slice(0, 8)}`, workersStopped: true,
  actors: actors(), routes: Object.fromEntries(scenarios.map((s) => [s.key, {
    destinationId: randomUUID(), systemTrailId: randomUUID(), pickupPointId: randomUUID(), returnPointId: randomUUID(),
  }])) })

describe('Booking demo rules', () => {
  it('requires seven distinct existing actor IDs and explicit route mappings', () => {
    const cfg = baseConfig()
    expect(demoConfigSchema.safeParse(cfg).success).toBe(true)
    cfg.actors.booker2 = cfg.actors.booker1
    expect(demoConfigSchema.safeParse(cfg).success).toBe(false)
    expect(demoConfigSchema.safeParse({ ...baseConfig(), routes: {} }).success).toBe(false)
  })
  it('rolls dates from Vietnam calendar and generates profitable published pricing', () => {
    expect(startTime(new Date('2026-10-26T18:30:00Z'), 7).toISOString()).toBe('2026-11-03T00:00:00.000Z')
    for (const capacity of [6, 12]) expect(demoPricing(capacity).evaluation.riskIntervals.filter((r) => r.type === 'LOSS_IN_OPERATING_RANGE')).toEqual([])
  })
  it('matches owned IDs exactly inside structured payloads, not arbitrary text/user names', () => {
    const id = randomUUID(), ids = new Set([id])
    expect(containsOwnedId({ result: { bookingId: id } }, ids)).toBe(true)
    expect(containsOwnedId({ note: `not-owned:${id}` }, ids)).toBe(false)
  })
})

const url = process.env.CORE_FLOWS_TEST_DATABASE_URL
const mongoUrl = process.env.CORE_FLOWS_TEST_MONGODB_URI
if (url && (!['localhost','127.0.0.1'].includes(new URL(url).hostname) || !new URL(url).pathname.startsWith('/cf04_test')))
  throw new Error('Use isolated localhost cf04_test* PostgreSQL only')
if (mongoUrl && (!['localhost','127.0.0.1'].includes(new URL(mongoUrl).hostname) || !new URL(mongoUrl).pathname.startsWith('/booking_demo_test')))
  throw new Error('Use isolated localhost booking_demo_test* MongoDB only')

;(url && mongoUrl ? describe : describe.skip)('Booking demo database lifecycle', () => {
  const db = new PrismaClient({ datasourceUrl: url })
  let mongo: mongoose.Connection
  let model: mongoose.Model<Notification>
  let cfg: ReturnType<typeof demoConfigSchema.parse>
  let first: Manifest
  let mapBefore: unknown
  let keeperTripId: string
  const sourceSnapshot = async () => ({ destinations: await db.destination.findMany(), trails: await db.systemTrail.findMany(),
    points: await db.checkpoint.findMany(), pickups: await db.pickupPoint.findMany(), links: await db.trailCheckpoint.findMany(),
    users: await db.user.findMany(), access: await db.trailAccess.findMany() })
  const complete = async (manifest: Manifest) => {
    await syncNotifications(db, model, manifest)
    await verifyDemo(db, manifest, model)
    const row = await db.auditLog.findFirstOrThrow({ where: { entityId: manifest.runId, action: 'BOOKING_DEMO_V2' } })
    await db.auditLog.update({ where: { id: row.id }, data: { newValues: json({ ...manifest, state: 'COMPLETE' }) } })
  }
  beforeAll(async () => {
    // This test owns a disposable DB. Never delete or reset an existing schema here.
    if (await db.user.count()) throw new Error('Integration test requires an empty disposable database')
    await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS auth')
    await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY)')
    // Prisma db push omits custom SQL CHECKs/partial indexes. Restore the relevant ones from existing migrations.
    for (const name of ['20261004090100_booking_payment_foundation','20261007090000_cf02_booking_holds',
      '20260929120000_cf04_private_membership','20261021120000_private_member_invitation_foundation',
      '20261023120000_public_participant_invitation']) {
      const sql = readFileSync(join(__dirname, '../prisma/migrations', name, 'migration.sql'), 'utf8')
      for (const statement of sql.match(/ALTER TABLE\s+[^;]+ADD CONSTRAINT\s+[^;]+CHECK\s*\([^;]+;|CREATE UNIQUE INDEX\s+[^;]+WHERE[^;]+;/g) ?? []) {
        await db.$executeRawUnsafe(statement)
      }
    }
    mongo = await mongoose.createConnection(mongoUrl!, { autoIndex: false, autoCreate: false }).asPromise()
    model = mongo.model<Notification>(Notification.name, NotificationSchema)
    if (await model.countDocuments()) throw new Error('Integration Mongo database must be empty')
    const raw = baseConfig()
    for (const [key,id] of Object.entries(raw.actors)) {
      const authId = randomUUID()
      await db.$executeRaw`INSERT INTO auth.users (id) VALUES (${authId}::uuid)`
      await db.user.create({ data: { id, authUserId: authId, email: `${key}@seed-test.invalid`, fullName: `Demo ${key}`,
        role: key === 'admin' ? 'ADMIN' : key === 'leader' ? 'LEADER' : 'USER' } })
    }
    const destination = await db.destination.create({ data: { name: 'Test source destination', region: 'SOUTH' } })
    const pickup = await db.pickupPoint.create({ data: { destinationId: destination.id, code: 'TEST', name: 'Test pickup',
      address: 'Test', latitude: 11, longitude: 106, createdBy: raw.actors.admin } })
    const trail = await db.systemTrail.create({ data: { destinationId: destination.id, code: 'TEST', name: 'Test source trail',
      difficulty: 'EASY', distanceKm: 5, estimatedDurationMinutes: 120, routeGeojson: { type: 'LineString', coordinates: [[106,11],[106.01,11.01]] },
      createdBy: raw.actors.admin } })
    for (let i=0;i<2;i++) {
      const point = await db.checkpoint.create({ data: { destinationId: destination.id, code: `TEST${i}`, name: `Point ${i}`,
        latitude: 11+i*0.01, longitude: 106+i*0.01 } })
      await db.trailCheckpoint.create({ data: { systemTrailId: trail.id, checkpointId: point.id, sequence: i+1, isRequired: true } })
    }
    await db.trailAccess.create({ data: { userId: raw.actors.host, systemTrailId: trail.id, sourceType: 'PROMOTION', priceSnapshot: 0,
      status: 'ACTIVE', activatedAt: new Date() } })
    const policy = loadBookingPolicySeeds()[0]
    await db.bookingPolicy.create({ data: { policyCode: policy.policy_code, versionNo: 1, holdTtlMinutes: policy.hold_ttl_minutes,
      cancellationRules: json(policy.cancellation_rules), effectiveFrom: new Date('2020-01-01'), publishedAt: new Date(), isActive: true } })
    const media = await db.mediaAsset.create({ data: { ownerUserId: raw.actors.leader, scope: 'LEADER_CERTIFICATE',
      provider: 'CLOUDINARY', resourceType: 'IMAGE', status: 'READY', providerAssetId: 'test-asset', providerPublicId: 'test-cert',
      deliveryType: 'authenticated', format: 'png' } })
    for (const key of Object.keys(raw.routes)) raw.routes[key] = { destinationId: destination.id, systemTrailId: trail.id,
      pickupPointId: pickup.id, returnPointId: pickup.id }
    cfg = demoConfigSchema.parse({ ...raw, certificateMediaId: media.id })
    const keeper = await db.trip.create({ data: { tripType: 'PRIVATE', title: 'Not seed owned', destinationId: destination.id,
      creatorId: raw.actors.admin, startAt: new Date('2035-01-01'), endAt: new Date('2035-01-02'), maxPax: 5 } })
    keeperTripId = keeper.id
    mapBefore = await sourceSnapshot()
  }, 60000)
  afterAll(async () => { await db.$disconnect(); if (mongo) await mongo.close() })

  it('dry run preserves data; replacement creates all six coherent scenarios and notifications', async () => {
    const before = await db.trip.count()
    expect((await seedCoreflowsHappy(db, { config: cfg, mode: 'dry-run' })).action).toBe('DRY_RUN')
    expect(await db.trip.count()).toBe(before)
    first = await seedCoreflowsHappy(db, { config: cfg }) as Manifest
    await complete(first)
    await complete(first) // Mongo idempotency and receipt retry
    expect(await sourceSnapshot()).toEqual(mapBefore)
    expect(await db.leaderApplication.count()).toBe(1)
    expect(await db.leaderProfile.count()).toBe(1)
  }, 60000)

  it('fails before cleanup on invalid actor or protected logical GPS reference', async () => {
    const count = await db.trip.count()
    await expect(seedCoreflowsHappy(db, { config: { ...cfg, actors: { ...cfg.actors, booker1: randomUUID() } } })).rejects.toThrow('booker1')
    const tripId = first.trips[0].id
    await db.gpsPresenceState.create({ data: { tripId, userId: cfg.actors.booker1, status: 'ONLINE' } })
    await expect(seedCoreflowsHappy(db, { config: cfg })).rejects.toThrow('gps_presence_states')
    expect(await db.trip.count()).toBe(count)
    await db.gpsPresenceState.deleteMany({ where: { tripId } })
  }, 60000)

  it('cleans UI-created bookings and invoice revisions; protects sources and unrelated trips', async () => {
    const source = await db.booking.findFirstOrThrow()
    const { id: _id, ...data } = source
    const booking = await db.booking.create({ data: { ...data, id: randomUUID(), tripId: first.trips.find((t) => t.scenario === 'PUBLIC_D7')!.id,
      status: 'PENDING_PAYMENT', confirmationIdempotencyKey: null, confirmedAt: null } })
    const inv = await db.invoice.create({ data: { invoiceNo: randomUUID(), userId: booking.userId, bookingId: booking.id,
      invoiceType: 'BOOKING', revisionNo: 1, subtotalAmount: booking.subtotalAmount, totalAmount: booking.totalAmount, status: 'CANCELLED' } })
    await db.invoice.create({ data: { invoiceNo: randomUUID(), userId: booking.userId, bookingId: booking.id,
      invoiceType: 'BOOKING', revisionNo: 2, supersedesInvoiceId: inv.id, subtotalAmount: booking.subtotalAmount,
      totalAmount: booking.totalAmount, status: 'PENDING_PAYMENT' } })
    const idempotency = await db.idempotencyRecord.create({ data: { scope: `public-invitation:create:${booking.id}:${randomUUID()}`,
      userId: booking.userId, idempotencyKey: randomUUID(), requestHash: 'a'.repeat(64), responseBody: { bookingId: booking.id } } })
    const keeperReplay = await db.idempotencyRecord.create({ data: { scope: `public-invitation:create:${keeperTripId}:${randomUUID()}`,
      userId: booking.userId, idempotencyKey: randomUUID(), requestHash: 'b'.repeat(64) } })
    const second = await seedCoreflowsHappy(db, { config: cfg }) as Manifest
    await expect(seedCoreflowsHappy(db, { config: cfg })).rejects.toThrow('--resume')
    await complete(second)
    expect(await db.trip.count({ where: { id: { in: first.trips.map((t) => t.id) } } })).toBe(0)
    expect(await db.booking.findUnique({ where: { id: booking.id } })).toBeNull()
    expect(await db.idempotencyRecord.findUnique({ where: { id: idempotency.id } })).toBeNull()
    expect(await db.idempotencyRecord.findUnique({ where: { id: keeperReplay.id } })).not.toBeNull()
    expect(await db.trip.findUnique({ where: { id: keeperTripId } })).not.toBeNull()
    expect(await sourceSnapshot()).toEqual(mapBefore)
    expect(await db.leaderApplication.count()).toBe(1)
    expect(await db.mockPaymentOperation.count()).toBe(5)
    expect(await model.countDocuments({ 'metadata.outboxEventId': { $in: first.eventIds } })).toBe(0)
  }, 60000)
})
