import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import {
  canonicalPolicy,
  policyContentSchema,
  PUBLIC_BOOKING_POLICY_CODE,
} from '../../src/modules/bookings/booking-policy'

const jsonObjectSchema = z.record(z.string(), z.unknown())
const timestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid timestamp')
const bookingPolicySeedSchema = z
  .object({
    id: z.string().uuid(),
    policy_code: z.string().min(1).max(80),
    version_no: z.number().int().positive(),
    hold_ttl_minutes: z.number().int().min(1).max(1440),
    cancellation_rules: jsonObjectSchema,
    no_show_rules: jsonObjectSchema.nullable(),
    participant_rules: jsonObjectSchema.nullable(),
    effective_from: timestampSchema,
    effective_to: timestampSchema.nullable(),
    is_active: z.boolean(),
    created_by: z.string().uuid().nullable(),
    created_at: timestampSchema,
    published_at: timestampSchema.nullable(),
    revision: z.number().int().positive(),
  })
  .strict()

const bookingPolicySeedListSchema = z.array(bookingPolicySeedSchema).min(1)
type BookingPolicySeed = z.infer<typeof bookingPolicySeedSchema>

export type BookingPolicySeedAction = {
  id: string
  policyCode: string
  versionNo: number
  action: 'CREATED' | 'WOULD_CREATE' | 'PUBLISHED_NEW_VERSION' | 'WOULD_PUBLISH_NEW_VERSION' | 'UNCHANGED'
}

export function loadBookingPolicySeeds(): BookingPolicySeed[] {
  const path = join(__dirname, 'data', 'booking_policies.json')
  const seeds = bookingPolicySeedListSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  const identities = new Set<string>()

  for (const seed of seeds) {
    const identity = `${seed.policy_code}:${seed.version_no}`
    if (identities.has(identity)) throw new Error(`Duplicate booking policy seed: ${identity}`)
    identities.add(identity)

    const effectiveFrom = new Date(seed.effective_from)
    const effectiveTo = seed.effective_to ? new Date(seed.effective_to) : null
    if (effectiveTo && effectiveTo <= effectiveFrom)
      throw new Error(`Invalid effective interval for booking policy seed: ${identity}`)
    if (seed.is_active && !seed.published_at)
      throw new Error(`Active booking policy seed must be published: ${identity}`)
  }

  const currentPolicy = seeds.find((seed) => seed.policy_code === PUBLIC_BOOKING_POLICY_CODE)
  if (!currentPolicy) throw new Error(`Missing ${PUBLIC_BOOKING_POLICY_CODE} booking policy seed`)
  policyContentSchema.parse({
    holdTtlMinutes: currentPolicy.hold_ttl_minutes,
    cancellationRules: currentPolicy.cancellation_rules,
  })

  return seeds
}

function asCreateInput(seed: BookingPolicySeed): Prisma.BookingPolicyUncheckedCreateInput {
  return {
    id: seed.id,
    policyCode: seed.policy_code,
    versionNo: seed.version_no,
    holdTtlMinutes: seed.hold_ttl_minutes,
    cancellationRules: seed.cancellation_rules as Prisma.InputJsonValue,
    ...(seed.no_show_rules === null
      ? {}
      : { noShowRules: seed.no_show_rules as Prisma.InputJsonValue }),
    ...(seed.participant_rules === null
      ? {}
      : { participantRules: seed.participant_rules as Prisma.InputJsonValue }),
    effectiveFrom: new Date(seed.effective_from),
    effectiveTo: seed.effective_to ? new Date(seed.effective_to) : null,
    isActive: seed.is_active,
    createdBy: seed.created_by,
    createdAt: new Date(seed.created_at),
    publishedAt: seed.published_at ? new Date(seed.published_at) : null,
    revision: seed.revision,
  }
}

function normalized(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalized)
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalized(item)]),
    )
  return value
}

function matchesSeed(actual: Record<string, unknown>, expected: Prisma.BookingPolicyUncheckedCreateInput) {
  const fields = [
    'id',
    'policyCode',
    'versionNo',
    'holdTtlMinutes',
    'cancellationRules',
    'noShowRules',
    'participantRules',
    'effectiveFrom',
    'effectiveTo',
    'isActive',
    'createdBy',
    'createdAt',
    'publishedAt',
    'revision',
  ]
  return fields.every((field) => {
    const expectedValue = field in expected ? expected[field as keyof typeof expected] : null
    return JSON.stringify(normalized(actual[field])) === JSON.stringify(normalized(expectedValue))
  })
}

function matchesCurrentPolicy(
  actual: { holdTtlMinutes: number; cancellationRules: Prisma.JsonValue },
  seed: BookingPolicySeed,
) {
  try {
    const current = canonicalPolicy({
      holdTtlMinutes: actual.holdTtlMinutes,
      cancellationRules: actual.cancellationRules as never,
    })
    const desired = canonicalPolicy({
      holdTtlMinutes: seed.hold_ttl_minutes,
      cancellationRules: seed.cancellation_rules as never,
    })
    return JSON.stringify(current) === JSON.stringify(desired)
  } catch {
    return false
  }
}

export async function seedBookingPolicies(
  prisma: PrismaClient,
  options: { dryRun?: boolean } = {},
): Promise<BookingPolicySeedAction[]> {
  const seeds = loadBookingPolicySeeds()
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('booking-policy:seed', 0))::text`
    const actions: BookingPolicySeedAction[] = []

    for (const seed of seeds.filter((item) => item.policy_code !== PUBLIC_BOOKING_POLICY_CODE)) {
      const expected = asCreateInput(seed)
      const existing = await tx.bookingPolicy.findFirst({
        where: {
          OR: [
            { id: seed.id },
            { policyCode: seed.policy_code, versionNo: seed.version_no },
          ],
        },
      })

      if (existing) {
        if (!matchesSeed(existing as unknown as Record<string, unknown>, expected))
          throw new Error(
            `Conflicting booking policy ${seed.policy_code} v${seed.version_no}; existing data was not overwritten.`,
          )
        actions.push({
          id: seed.id,
          policyCode: seed.policy_code,
          versionNo: seed.version_no,
          action: 'UNCHANGED',
        })
        continue
      }

      if (!options.dryRun) await tx.bookingPolicy.create({ data: expected })
      actions.push({
        id: seed.id,
        policyCode: seed.policy_code,
        versionNo: seed.version_no,
        action: options.dryRun ? 'WOULD_CREATE' : 'CREATED',
      })
    }

    const seed = seeds.find((item) => item.policy_code === PUBLIC_BOOKING_POLICY_CODE)!
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('booking-policy:PUBLIC_BOOKING_DEFAULT', 0))::text`
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`
      SELECT date_trunc('milliseconds', clock_timestamp()) AS now
    `
    const versions = await tx.bookingPolicy.findMany({
      where: { policyCode: PUBLIC_BOOKING_POLICY_CODE },
      orderBy: { versionNo: 'desc' },
    })

    if (!versions.length) {
      const expected = asCreateInput(seed)
      const idCollision = await tx.bookingPolicy.findUnique({ where: { id: seed.id } })
      if (idCollision)
        throw new Error(`Conflicting booking policy id ${seed.id}; existing data was not overwritten.`)
      if (!options.dryRun) await tx.bookingPolicy.create({ data: expected })
      actions.push({
        id: seed.id,
        policyCode: seed.policy_code,
        versionNo: seed.version_no,
        action: options.dryRun ? 'WOULD_CREATE' : 'CREATED',
      })
      return actions
    }

    const current = versions.filter(
      (policy) =>
        policy.publishedAt &&
        policy.isActive &&
        policy.effectiveFrom <= now &&
        (!policy.effectiveTo || policy.effectiveTo > now),
    )
    if (current.length > 1) throw new Error('Multiple current booking policies exist; reconcile them before seeding.')
    if (current.length === 1 && matchesCurrentPolicy(current[0], seed)) {
      actions.push({
        id: current[0].id,
        policyCode: current[0].policyCode,
        versionNo: current[0].versionNo,
        action: 'UNCHANGED',
      })
      return actions
    }
    if (
      versions.some(
        (policy) =>
          !policy.publishedAt ||
          policy.effectiveFrom > now ||
          (policy.effectiveTo !== null && policy.effectiveTo > now),
      )
    )
      throw new Error('Draft or scheduled booking policy exists; reconcile it before seeding.')

    const versionNo = versions[0].versionNo + 1
    if (options.dryRun) {
      actions.push({
        id: '(generated on publish)',
        policyCode: seed.policy_code,
        versionNo,
        action: 'WOULD_PUBLISH_NEW_VERSION',
      })
      return actions
    }

    await tx.bookingPolicy.updateMany({
      where: {
        policyCode: PUBLIC_BOOKING_POLICY_CODE,
        isActive: true,
        publishedAt: { not: null },
        effectiveTo: null,
      },
      data: { effectiveTo: now },
    })
    const desired = canonicalPolicy({
      holdTtlMinutes: seed.hold_ttl_minutes,
      cancellationRules: seed.cancellation_rules as never,
    })
    const published = await tx.bookingPolicy.create({
      data: {
        ...desired,
        policyCode: PUBLIC_BOOKING_POLICY_CODE,
        versionNo,
        noShowRules:
          seed.no_show_rules === null ? Prisma.DbNull : (seed.no_show_rules as Prisma.InputJsonValue),
        participantRules:
          seed.participant_rules === null ? Prisma.DbNull : (seed.participant_rules as Prisma.InputJsonValue),
        effectiveFrom: now,
        effectiveTo: null,
        isActive: true,
        createdBy: seed.created_by,
        publishedAt: now,
        revision: seed.revision,
      },
    })
    await tx.auditLog.create({
      data: {
        action: 'BOOKING_POLICY_PUBLISHED',
        entityType: 'BookingPolicy',
        entityId: published.id,
        newValues: {
          source: 'BOOKING_POLICY_SEED',
          versionNo,
          effectiveFrom: now.toISOString(),
          ...desired,
        },
      },
    })
    actions.push({
      id: published.id,
      policyCode: published.policyCode,
      versionNo: published.versionNo,
      action: 'PUBLISHED_NEW_VERSION',
    })

    return actions
  })
}

async function main() {
  const args = process.argv.slice(2)
  const usage = 'npm run seed:booking-policies -- [--dry-run|--validate-only]'
  if (args.includes('--help')) {
    console.log(usage)
    return
  }
  if (
    args.some((arg) => !['--dry-run', '--validate-only'].includes(arg)) ||
    (args.includes('--dry-run') && args.includes('--validate-only'))
  )
    throw new Error(usage)

  const seeds = loadBookingPolicySeeds()
  if (args.includes('--validate-only')) {
    console.log(JSON.stringify({ valid: true, count: seeds.length, databaseAccess: false }, null, 2))
    return
  }

  const prisma = new PrismaClient()
  try {
    const actions = await seedBookingPolicies(prisma, { dryRun: args.includes('--dry-run') })
    console.log(JSON.stringify({ mode: args.includes('--dry-run') ? 'DRY_RUN' : 'APPLIED', actions }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Booking policy seed failed.')
    process.exitCode = 1
  })
