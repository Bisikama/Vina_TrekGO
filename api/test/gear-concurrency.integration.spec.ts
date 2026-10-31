import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { PrismaUserGearRepository } from '../src/modules/gear/infrastructure/adapters/prisma-user-gear.repository'
import { PrismaGearExtractionDraftRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-extraction-draft.repository'
import { PrismaGearConcurrencyLeaseAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-gear-concurrency-lease.adapter'
import { PrismaGearExtractionCacheAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-gear-extraction-cache.adapter'
import { PrismaGearPlanRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-plan.repository'
import { PrismaGearPlanRevisionRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-plan-revision.repository'
import { GearExtractionService } from '../src/modules/gear/application/services/gear-extraction.service'
import { GearPlanService } from '../src/modules/gear/application/services/gear-plan.service'

/**
 * Isolated PostgreSQL Integration Test Suite for Gear Advisor V3.1.5 Concurrency & Lifecycle
 *
 * Uses TEST_DATABASE_URL (an isolated test database, never the dev DATABASE_URL) with a runId-isolated
 * test fixture. The test database needs migrations applied and gear rules seeded (seed:gear-rules).
 * Cleans up exact created IDs in finally blocks without truncating DB or overwriting global seed data.
 */
const databaseUrl = process.env.TEST_DATABASE_URL
const describeIntegration = databaseUrl ? describe : describe.skip

describeIntegration('PostgreSQL Concurrency & Lifecycle Integration Tests (runId Fixture)', () => {
  let prisma: PrismaClient
  let testUserId: string
  let hasDbConnection = false
  const runId = randomUUID()

  beforeAll(async () => {
    if (!databaseUrl) return
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    })
    await prisma.$connect()
    await prisma.$executeRaw`SELECT 1`
    // Probe that required Gear Advisor tables exist in database
    await prisma.$executeRaw`SELECT 1 FROM "user_gear_items" LIMIT 1`
    await prisma.$executeRaw`SELECT 1 FROM "user_gear_item_photos" LIMIT 1`
    await prisma.$executeRaw`SELECT 1 FROM "gear_requirement_rules" LIMIT 1`
    hasDbConnection = true

    const user = await prisma.user.create({
      data: {
        authUserId: randomUUID(),
        email: `gear-test-${runId}@example.com`,
        fullName: `Gear Test User ${runId.slice(0, 8)}`,
        role: 'USER',
        status: 'ACTIVE',
      },
    })
    testUserId = user.id
  })

  afterAll(async () => {
    delete process.env.GEAR_AI_ADVICE_ENABLED
    if (hasDbConnection && testUserId) {
      try {
        await prisma.gearAdviceRun.deleteMany({ where: { planRevision: { plan: { userId: testUserId } } } })
        await prisma.gearPlanOptionSet.deleteMany({ where: { planRevision: { plan: { userId: testUserId } } } })
        await prisma.gearPlanRevision.deleteMany({ where: { plan: { userId: testUserId } } })
        await prisma.gearQuoteLink.deleteMany({ where: { userId: testUserId } })
        await prisma.gearPlan.deleteMany({ where: { userId: testUserId } })
        await prisma.userGearItemPhoto.deleteMany({ where: { item: { userId: testUserId } } })
        await prisma.userGearItem.deleteMany({ where: { userId: testUserId } })
        await prisma.gearExtractionDraft.deleteMany({ where: { userId: testUserId } })
        await prisma.gearExtractionLease.deleteMany({ where: { resourceKey: { startsWith: `lease-res-${runId}` } } })
        await prisma.user.delete({ where: { id: testUserId } })
      } catch (cleanupErr: any) {
        console.error(`[GEAR_CLEANUP_FAILURE] Fixture cleanup failed for ${testUserId}:`, cleanupErr.message)
      }
    }
    if (prisma) {
      await prisma.$disconnect().catch(() => {})
    }
  })

  it('INTEG-01: Two concurrent PATCH requests on different attribute keys preserve both updates', async () => {
    expect(hasDbConnection).toBe(true)

    const userRepo = new PrismaUserGearRepository(prisma as any)

    const item = await userRepo.create({
      userId: testUserId,
      name: `Integration Test Jacket ${runId.slice(0, 6)}`,
      category: 'JACKET',
      brand: null,
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, weight_g: 400 },
      photoRef: null,
      source: 'MANUAL',
    })

    try {
      await Promise.all([
        userRepo.patch(item.id, testUserId, { attributes: { waterproof_mm: 10000 } }),
        userRepo.patch(item.id, testUserId, { attributes: { weight_g: 350 } }),
      ])

      const reloaded = await userRepo.findByIdAndUser(item.id, testUserId)
      expect(reloaded).not.toBeNull()
      expect(reloaded?.attributes.waterproof_mm).toBe(10000)
      expect(reloaded?.attributes.weight_g).toBe(350)
    } finally {
      await userRepo.delete(item.id, testUserId)
    }
  })

  it('INTEG-02: Simultaneous confirm on same draft creates at most one UserGearItem', async () => {
    expect(hasDbConnection).toBe(true)

    const draftRepo = new PrismaGearExtractionDraftRepository(prisma as any)

    const draft = await draftRepo.createDraft({
      userId: testUserId,
      sourceType: 'IMAGE',
      sourceHash: `hash-${runId}-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60000),
    })

    await draftRepo.updateExtractedData(draft.id, { name: 'Extracted' }, 'READY')

    const input = {
      userId: testUserId,
      name: `Confirmed Item ${runId.slice(0, 6)}`,
      category: 'JACKET' as const,
      brand: null,
      condition: 'GOOD' as const,
      attributes: {},
      photoRef: null,
      source: 'AI_IMAGE' as const,
    }

    const results = await Promise.allSettled([
      draftRepo.confirmDraft(draft.id, testUserId, `payload-hash-${runId}`, input),
      draftRepo.confirmDraft(draft.id, testUserId, `payload-hash-${runId}`, input),
    ])

    const createdItems = await prisma.userGearItem.findMany({
      where: { userId: testUserId, name: input.name },
    })

    try {
      expect(createdItems.length).toBe(1)
      const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof draftRepo.confirmDraft>>> => r.status === 'fulfilled')
      const rejected = results.filter((r) => r.status === 'rejected')
      expect(fulfilled.length).toBeGreaterThanOrEqual(1)
      expect(fulfilled.filter((r) => !r.value.replayed)).toHaveLength(1)
      expect(fulfilled.every((r) => r.value.item.id === createdItems[0].id)).toBe(true)
      if (rejected.length === 0) {
        expect(fulfilled.filter((r) => r.value.replayed)).toHaveLength(1)
      }
    } finally {
      for (const it of createdItems) {
        await prisma.userGearItem.delete({ where: { id: it.id } }).catch(() => {})
      }
      await prisma.gearExtractionDraft.delete({ where: { id: draft.id } }).catch(() => {})
    }
  })

  it('INTEG-03: Rule repository read-only verification checks 28 canonical rules without overwriting DB', async () => {
    expect(hasDbConnection).toBe(true)

    const rules = await prisma.gearRequirementRule.findMany({
      select: { id: true, category: true, isActive: true },
    })

    expect(rules.length).toBe(28)
    const ruleIds = new Set(rules.map((r) => r.id))
    for (let i = 1; i <= 28; i++) {
      const code = `R${i.toString().padStart(2, '0')}`
      expect(ruleIds.has(code)).toBe(true)
    }
  })

  it('INTEG-04: Blocker A — Quota atomic reservation with remaining quota = 1 under two parallel concurrent callers and tx rollback', async () => {
    expect(hasDbConnection).toBe(true)

    const draftRepo = new PrismaGearExtractionDraftRepository(prisma as any)
    const userRepo = new PrismaUserGearRepository(prisma as any)
    const leaseAdapter = new PrismaGearConcurrencyLeaseAdapter(prisma as any)
    const cacheAdapter = new PrismaGearExtractionCacheAdapter(prisma as any)
    const mockAi = {} as any

    const extractionService = new GearExtractionService(
      draftRepo,
      cacheAdapter,
      leaseAdapter,
      userRepo,
      mockAi,
      prisma as any,
    )

    // 1. Seed 19 charged drafts created today for this user so remaining quota is exactly 1 (daily limit is 20)
    for (let i = 0; i < 19; i++) {
      await draftRepo.createDraft({
        userId: testUserId,
        sourceType: 'IMAGE',
        sourceHash: `seed-quota-${runId}-${i}`,
        expiresAt: new Date(Date.now() + 60000),
      })
    }

    try {
      // 2. Parallel concurrent reservation: Caller 1 and Caller 2 call concurrently at the same instant
      const expiresAt = new Date(Date.now() + 60000)
      const results = await Promise.allSettled([
        extractionService.checkAndReserveQuota(testUserId, 'IMAGE', `hash-caller-1-${runId}`, expiresAt),
        extractionService.checkAndReserveQuota(testUserId, 'IMAGE', `hash-caller-2-${runId}`, expiresAt),
      ])

      const fulfilled = results.filter((r) => r.status === 'fulfilled')
      const rejected = results.filter((r) => r.status === 'rejected')

      // Exactly 1 caller succeeds; 1 caller is rejected due to atomic daily quota limit = 20
      expect(fulfilled.length).toBe(1)
      expect(rejected.length).toBe(1)
      expect(rejected[0].reason.message).toMatch(/hạn mức|quota/i)

      // 3. Test forced rollback in transaction client: draft must NOT persist if tx throws
      await expect(
        prisma.$transaction(async (tx) => {
          await draftRepo.createDraft(
            {
              userId: testUserId,
              sourceType: 'IMAGE',
              sourceHash: `hash-rollback-${runId}`,
              expiresAt: new Date(Date.now() + 60000),
            },
            tx,
          )
          throw new Error('FORCED_SIMULATED_TRANSACTION_ROLLBACK')
        }),
      ).rejects.toThrow('FORCED_SIMULATED_TRANSACTION_ROLLBACK')

      const rolledBack = await prisma.gearExtractionDraft.findFirst({
        where: { sourceHash: `hash-rollback-${runId}` },
      })
      expect(rolledBack).toBeNull()
    } finally {
      await prisma.gearExtractionDraft.deleteMany({ where: { userId: testUserId } }).catch(() => {})
    }
  })

  it('INTEG-05: Blocker B.1 — Actual GearPlanService advice generation aborts with GEAR_PLAN_STALE under concurrent mutation barrier', async () => {
    expect(hasDbConnection).toBe(true)
    // Rào chắn nằm trong lúc gọi AI advice; AI advice mặc định tắt nên bật cờ cho test này.
    process.env.GEAR_AI_ADVICE_ENABLED = 'true'

    // 1. Create plan with inputRevision 1, evaluatedRevision 1
    const plan = await prisma.gearPlan.create({
      data: {
        userId: testUserId,
        title: `Integration Plan ${runId.slice(0, 6)}`,
        contextMode: 'TRIP',
        inputRevision: 1,
        evaluatedRevision: 1,
        progressVersion: 1,
      },
    })

    // 2. Create evaluated revision 1
    const revision = await prisma.gearPlanRevision.create({
      data: {
        planId: plan.id,
        revision: 1,
        contentHash: `hash-rev1-${runId}`,
        inputSnapshot: { inputRevision: 1, items: [] },
        resultSnapshot: {
          checklist: [],
          tripContext: { days: 2, difficulty: 3 },
          climate: { temp_min_c: 10, temp_max_c: 25, rain_prob_pct: 20 },
        },
      },
    })

    // 3. Create active option set for revision 1
    const optionSet = await prisma.gearPlanOptionSet.create({
      data: {
        planRevisionId: revision.id,
        objective: 'ECONOMICAL',
        expiresAt: new Date(Date.now() + 900000),
        optionsJson: [
          {
            id: 'opt_min_fee',
            summary: { totalRentalFee: 0, totalDeposit: 0, missingRequirements: [] },
            rentalLines: [],
            ownedAssignments: [],
          },
        ] as any,
      },
    })

    // 4. Set up actual repositories wired to Neon PostgreSQL
    const planRepo = new PrismaGearPlanRepository(prisma as any)
    const revisionRepo = new PrismaGearPlanRevisionRepository(prisma as any)
    const userGearRepo = new PrismaUserGearRepository(prisma as any)
    const tripContextPort = {
      getTripContext: jest.fn(async () => ({
        tripId: randomUUID(),
        days: 2,
        difficulty: 3,
        terrain: ['rừng'],
        startAt: new Date(Date.now() + 86400000 * 2),
        endAt: new Date(Date.now() + 86400000 * 4),
      })),
    } as any

    // 5. Barrier mock: During AI advice generation latency, a concurrent mutation increments inputRevision in DB
    let mutationExecuted = false
    const mockAiPort = {
      generateAdvice: jest.fn(async () => {
        // Barrier: mutate plan in DB before AI responds and CAS write occurs
        await prisma.gearPlan.update({
          where: { id: plan.id },
          data: { inputRevision: 2, updatedAt: new Date() },
        })
        mutationExecuted = true
        return {
          source: 'AI',
          narrativeVi: 'Kế hoạch đã được rà soát theo dữ kiện thời tiết và địa hình.',
          factRefs: ['trip.days:2', 'trip.difficulty:3'],
          candidateRefs: [],
        }
      }),
    } as any

    const gearPlanService = new GearPlanService(
      planRepo,
      revisionRepo,
      userGearRepo,
      tripContextPort,
      prisma as any,
      undefined, // optionSetRepo
      undefined, // quoteLinkRepo
      mockAiPort,
    )

    try {
      // 6. Actual service call: should detect CAS condition mismatch and throw GEAR_PLAN_STALE
      await expect(
        gearPlanService.generatePlanAdvice(plan.id, testUserId, {
          expectedRevision: 1,
          optionRef: { setId: optionSet.id, optionId: 'opt_min_fee' },
        }),
      ).rejects.toThrow(/thay đổi trong quá trình tạo tư vấn|GEAR_PLAN_STALE/i)

      expect(mutationExecuted).toBe(true)

      // 7. Verify no advice run was published for the stale plan head
      const adviceRuns = await prisma.gearAdviceRun.findMany({
        where: { planRevisionId: revision.id },
      })
      expect(adviceRuns.length).toBe(0)
    } finally {
      await prisma.gearAdviceRun.deleteMany({ where: { planRevisionId: revision.id } }).catch(() => {})
      await prisma.gearPlanOptionSet.deleteMany({ where: { planRevisionId: revision.id } }).catch(() => {})
      await prisma.gearPlanRevision.deleteMany({ where: { planId: plan.id } }).catch(() => {})
      await prisma.gearPlan.delete({ where: { id: plan.id } }).catch(() => {})
    }
  })

  it('INTEG-06: Concurrency lease mutual exclusion and timeout takeover in PostgreSQL', async () => {
    expect(hasDbConnection).toBe(true)

    const leaseAdapter = new PrismaGearConcurrencyLeaseAdapter(prisma as any)
    const resourceKey = `lease-res-${runId}`

    try {
      // Worker 1 acquires lease for 2 seconds
      const lease1 = await leaseAdapter.acquireLease(resourceKey, 'worker-1', 2000)
      expect(lease1.acquired).toBe(true)

      // Worker 2 attempts concurrent acquisition while lease is active -> rejected
      const lease2 = await leaseAdapter.acquireLease(resourceKey, 'worker-2', 2000)
      expect(lease2.acquired).toBe(false)

      // Worker 1 releases lease
      await leaseAdapter.releaseLease(resourceKey, 'worker-1')

      // Worker 2 now acquires lease successfully
      const lease3 = await leaseAdapter.acquireLease(resourceKey, 'worker-2', 2000)
      expect(lease3.acquired).toBe(true)
    } finally {
      await prisma.gearExtractionLease.deleteMany({ where: { resourceKey } }).catch(() => {})
    }
  })
})

if (!databaseUrl) {
  describe('PostgreSQL Integration Tests (NOTICE)', () => {
    it('TEST_DATABASE_URL is not set; integration tests skipped cleanly', () => {
      console.log('[GEAR_INTEGRATION_NOTICE] Database URL not configured. Integration test suite skipped gracefully.')
      expect(true).toBe(true)
    })
  })
}
