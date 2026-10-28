import 'reflect-metadata'
import { config as dotenv } from 'dotenv'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import mongoose from 'mongoose'
import { demoConfigSchema, DemoConfig, SOURCE } from './booking-demo.config'
import { createFixtures, hash, preflight } from './booking-demo.fixtures'
import { executeCleanup, planCleanup } from './booking-demo.cleanup'
import { syncNotifications, verifyDemo } from './booking-demo.verify'
import { Notification, NotificationSchema } from '../../src/modules/notifications/schemas/notification.schema'

export { demoConfigSchema, scenarios, startTime, demoPricing } from './booking-demo.config'
export type SeedOptions = { config: DemoConfig; mode?: 'replace' | 'dry-run' }
export type Manifest = Awaited<ReturnType<typeof createFixtures>> & {
  source: string
  batch: string
  runId: string
  configHash: string
  seededAt: string
  state: 'NOTIFICATIONS_PENDING' | 'COMPLETE' | 'REPLACED'
  oldIds: string[]
  oldEventIds: string[]
  deletedCounts: Record<string, number>
}
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

async function currentRun(db: PrismaClient, batch: string) {
  return db.auditLog.findFirst({
    where: { action: SOURCE, entityType: 'SeedBatch', newValues: { path: ['batch'], equals: batch } },
    orderBy: { id: 'desc' },
  })
}

/** Caller holds the global seed lock and has stopped API/background workers. */
export async function seedCoreflowsHappy(db: PrismaClient, options: SeedOptions) {
  const cfg = demoConfigSchema.parse(options.config)
  const prior = await currentRun(db, cfg.batch)
  const previous = prior?.newValues as unknown as Manifest | undefined
  if (previous?.state === 'NOTIFICATIONS_PENDING') throw new Error('Previous run needs --resume before replacing again')
  const legacy = cfg.replaceLegacyBatches.length
    ? await db.auditLog.findMany({
        where: {
          action: 'CF01_CF04_HAPPY_V1',
          entityType: 'SeedBatch',
          OR: cfg.replaceLegacyBatches.map((batch) => ({ newValues: { path: ['batch'], equals: batch } })),
        },
      })
    : []
  const legacyTripIds = legacy.flatMap((row) => {
    const manifest = row.newValues as any
    if (manifest?.source !== 'CF01_CF04_HAPPY_V1' || !Array.isArray(manifest.trips))
      throw new Error('Invalid legacy seed manifest')
    return manifest.trips.map((t: any) => t.tripId as string)
  })
  const oldTrips = [...new Set([...(previous?.trips.map((t) => t.id) ?? []), ...legacyTripIds])]
  if (oldTrips.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) throw new Error('Invalid trip identity in seed manifest')
  return db.$transaction(
    async (tx) => {
      if (oldTrips.length)
        await tx.$queryRaw`SELECT id FROM trips WHERE id=ANY(${oldTrips}::uuid[]) ORDER BY id FOR UPDATE`
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const ctx = await preflight(tx, cfg, now, oldTrips)
      const cleanup = await planCleanup(tx, oldTrips)
      if (options.mode === 'dry-run')
        return {
          action: 'DRY_RUN',
          batch: cfg.batch,
          deleteCounts: cleanup.counts,
          scenarios: ctx.routes.map((r) => ({
            key: r.scenario.key,
            startAt: r.startAt,
            endAt: r.endAt,
            destination: r.destination.name,
            trail: r.trail.name,
          })),
          supplementLeader: { profile: !ctx.profile, applicationAndCertificate: !ctx.approved },
        }
      await executeCleanup(tx, cleanup)
      const runId = randomUUID()
      const fixtures = await createFixtures(tx, cfg, ctx, now, runId)
      const manifest: Manifest = {
        source: SOURCE,
        batch: cfg.batch,
        runId,
        configHash: hash(cfg),
        seededAt: now.toISOString(),
        state: 'NOTIFICATIONS_PENDING',
        oldIds: cleanup.ids,
        oldEventIds: cleanup.eventIds,
        deletedCounts: cleanup.counts,
        ...fixtures,
      }
      if (prior && previous)
        await tx.auditLog.update({
          where: { id: prior.id },
          data: { newValues: asJson({ ...previous, state: 'REPLACED' }) },
        })
      await tx.auditLog.create({
        data: { action: SOURCE, entityType: 'SeedBatch', entityId: runId, newValues: asJson(manifest) },
      })
      await verifyDemo(tx, manifest)
      return { action: 'CREATED', ...manifest }
    },
    { timeout: 120000, maxWait: 15000 },
  )
}

export async function main() {
  dotenv({ quiet: true })
  const args = process.argv.slice(2)
  const usage = 'npm run seed:coreflows -- --config=<json> [--dry-run|--verify-only|--resume]'
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage)
    return
  }
  const file = args.find((arg) => arg.startsWith('--config='))?.slice(9)
  const modes = args.filter((arg) => ['--dry-run', '--verify-only', '--resume'].includes(arg))
  if (!file || modes.length > 1 || args.length !== 1 + modes.length) throw new Error(usage)
  const cfg = demoConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  if (!process.env.DATABASE_URL || !process.env.MONGODB_URI)
    throw new Error('DATABASE_URL and MONGODB_URI are required')
  const db = new PrismaClient()
  // Keep this session lock across PostgreSQL + Mongo phases. Do not use a transaction pooler.
  const lockUrl = process.env.SEED_LOCK_DATABASE_URL ?? process.env.DATABASE_URL
  if (new URL(lockUrl).port === '6543' || new URL(lockUrl).searchParams.get('pgbouncer') === 'true')
    throw new Error('Set SEED_LOCK_DATABASE_URL to a direct/session PostgreSQL connection, not a transaction pooler')
  const pool = new Pool({ connectionString: lockUrl, max: 1, connectionTimeoutMillis: 10000 })
  let lock: any
  let mongo: mongoose.Connection | undefined
  try {
    lock = await pool.connect()
    const locked = await lock.query("SELECT pg_try_advisory_lock(hashtextextended('booking-demo-v2',0)) AS acquired")
    if (!locked.rows[0].acquired) throw new Error('Another demo seed is running; retry when it completes')
    const [identity] = await db.$queryRaw<{ name: string; oid: number }[]>`
      SELECT current_database() AS name, oid::int AS oid FROM pg_database WHERE datname=current_database()`
    const lockIdentity = await lock.query(
      'SELECT current_database() AS name, oid::int AS oid FROM pg_database WHERE datname=current_database()',
    )
    if (identity.name !== lockIdentity.rows[0].name || identity.oid !== lockIdentity.rows[0].oid)
      throw new Error('SEED_LOCK_DATABASE_URL and DATABASE_URL must target the same database')
    mongo = await mongoose
      .createConnection(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        autoIndex: false,
        autoCreate: false,
      })
      .asPromise()
    await mongo.db!.admin().ping()
    const model = mongo.model<Notification>(Notification.name, NotificationSchema)
    if (modes[0] === '--dry-run') {
      console.log(JSON.stringify(await seedCoreflowsHappy(db, { config: cfg, mode: 'dry-run' }), null, 2))
      return
    }
    let row = await currentRun(db, cfg.batch)
    if (modes[0] === '--verify-only' || modes[0] === '--resume') {
      if (!row) throw new Error('No seed manifest found for configured batch')
      const manifest = row.newValues as unknown as Manifest
      if (manifest.configHash !== hash(cfg))
        throw new Error('Config differs from saved run; use original config for resume/verify')
      if (modes[0] === '--verify-only') {
        await verifyDemo(db, manifest, model)
        console.log(JSON.stringify({ action: 'VERIFIED', batch: cfg.batch, runId: manifest.runId }))
        return
      }
      if (manifest.state !== 'NOTIFICATIONS_PENDING' && manifest.state !== 'COMPLETE')
        throw new Error('Cannot resume replaced run')
    } else {
      console.log(
        'Replacing owned demo trip data, including UI changes on demo trips. Protected references block deletion.',
      )
      await seedCoreflowsHappy(db, { config: cfg })
      row = await currentRun(db, cfg.batch)
    }
    const manifest = row!.newValues as unknown as Manifest
    await syncNotifications(db, model, manifest)
    await verifyDemo(db, manifest, model)
    manifest.state = 'COMPLETE'
    await db.auditLog.update({ where: { id: row!.id }, data: { newValues: asJson(manifest) } })
    console.log(JSON.stringify({ action: 'COMPLETE', ...manifest }, null, 2))
  } finally {
    if (mongo) await mongo.close()
    await db.$disconnect()
    if (lock) {
      try {
        await lock.query("SELECT pg_advisory_unlock(hashtextextended('booking-demo-v2',0))")
      } finally {
        lock.release()
      }
    }
    await pool.end()
  }
}

export function reportFailure(error: unknown) {
  console.error(
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+|mongodb(?:\+srv)?:\/\/[^\s]+/g, '[connection redacted]')
      : 'Seed failed',
  )
  process.exitCode = 1
}
if (require.main === module) main().catch(reportFailure)
