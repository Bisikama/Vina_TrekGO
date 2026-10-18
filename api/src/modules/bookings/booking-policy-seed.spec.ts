import type { PrismaClient } from '@prisma/client'
import { loadBookingPolicySeeds, seedBookingPolicies } from '../../../prisma/seeds/booking-policy.seed'

function fakePrisma() {
  const rows: Record<string, unknown>[] = []
  const audits: Record<string, unknown>[] = []
  const now = new Date('2026-10-17T00:00:00.000Z')
  const tx = {
    $queryRaw: jest.fn((parts: TemplateStringsArray) =>
      Promise.resolve(parts.join('').includes('clock_timestamp') ? [{ now }] : []),
    ),
    bookingPolicy: {
      findFirst: jest.fn(({ where }: { where: { OR: Array<Record<string, unknown>> } }) => {
        const [byId, byVersion] = where.OR
        return Promise.resolve(
          rows.find(
            (row) =>
              row.id === byId.id ||
              (row.policyCode === byVersion.policyCode && row.versionNo === byVersion.versionNo),
          ) ?? null,
        )
      }),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.find((row) => row.id === where.id) ?? null),
      ),
      findMany: jest.fn(({ where }: { where: { policyCode: string } }) =>
        Promise.resolve(
          rows
            .filter((row) => row.policyCode === where.policyCode)
            .sort((left, right) => Number(right.versionNo) - Number(left.versionNo)),
        ),
      ),
      updateMany: jest.fn(() => {
        for (const row of rows) {
          if (
            row.policyCode === 'PUBLIC_BOOKING_DEFAULT' &&
            row.isActive === true &&
            row.publishedAt &&
            row.effectiveTo === null
          )
            row.effectiveTo = now
        }
        return Promise.resolve({ count: 1 })
      }),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: data.id ?? `generated-${rows.length + 1}`,
          createdAt: data.createdAt ?? now,
          noShowRules: null,
          participantRules: null,
          ...data,
        }
        rows.push(row)
        return Promise.resolve(row)
      }),
    },
    auditLog: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        audits.push(data)
        return Promise.resolve(data)
      }),
    },
  }
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaClient
  return { prisma, rows, audits, tx }
}

describe('booking policy seed', () => {
  it('validates the source data and is replay-safe', async () => {
    const seeds = loadBookingPolicySeeds()
    expect(seeds).toHaveLength(2)
    expect(seeds.find((seed) => seed.policy_code === 'PUBLIC_BOOKING_DEFAULT')?.cancellation_rules).toEqual({
      version: 1,
      tiers: [
        { refundPercent: 100, minHoursBeforeStart: 168 },
        { refundPercent: 80, minHoursBeforeStart: 72 },
        { refundPercent: 50, minHoursBeforeStart: 24 },
        { refundPercent: 0, minHoursBeforeStart: 0 },
      ],
    })

    const { prisma, rows, tx } = fakePrisma()
    const dryRun = await seedBookingPolicies(prisma, { dryRun: true })
    expect(dryRun.every((item) => item.action === 'WOULD_CREATE')).toBe(true)
    expect(rows).toHaveLength(0)

    const applied = await seedBookingPolicies(prisma)
    expect(applied.every((item) => item.action === 'CREATED')).toBe(true)
    expect(rows).toHaveLength(2)

    const replayed = await seedBookingPolicies(prisma)
    expect(replayed.every((item) => item.action === 'UNCHANGED')).toBe(true)
    expect(rows).toHaveLength(2)
    expect(tx.bookingPolicy.create).toHaveBeenCalledTimes(2)
  })

  it('rejects conflicting rows instead of overwriting them', async () => {
    const { prisma, rows, tx } = fakePrisma()
    await seedBookingPolicies(prisma)
    rows[0].holdTtlMinutes = 99

    await expect(seedBookingPolicies(prisma)).rejects.toThrow('existing data was not overwritten')
    expect(tx.bookingPolicy.create).toHaveBeenCalledTimes(2)
  })

  it('preserves an invalid published policy and publishes the seeded content as the next version', async () => {
    const { prisma, rows, audits } = fakePrisma()
    rows.push({
      id: 'existing-policy',
      policyCode: 'PUBLIC_BOOKING_DEFAULT',
      versionNo: 1,
      holdTtlMinutes: 15,
      cancellationRules: [],
      noShowRules: null,
      participantRules: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      effectiveTo: null,
      isActive: true,
      publishedAt: new Date('2026-10-14T00:00:00.000Z'),
      revision: 1,
      createdBy: null,
      createdAt: new Date('2026-10-14T00:00:00.000Z'),
    })

    const actions = await seedBookingPolicies(prisma)
    expect(actions).toEqual([
      expect.objectContaining({ policyCode: 'PUBLIC_BOOKING', action: 'CREATED' }),
      expect.objectContaining({ policyCode: 'PUBLIC_BOOKING_DEFAULT', versionNo: 2, action: 'PUBLISHED_NEW_VERSION' }),
    ])
    expect(rows.find((row) => row.id === 'existing-policy')?.effectiveTo).toEqual(
      new Date('2026-10-17T00:00:00.000Z'),
    )
    expect(rows.find((row) => row.versionNo === 2)?.cancellationRules).toEqual(
      loadBookingPolicySeeds()[1].cancellation_rules,
    )
    expect(audits).toHaveLength(1)
  })
})
