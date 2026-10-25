import { AppError } from '../src/shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../src/shared/errors/codes/gear.error-codes'
import { PrismaUserGearRepository } from '../src/modules/gear/infrastructure/adapters/prisma-user-gear.repository'
import { PrismaGearExtractionDraftRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-extraction-draft.repository'
import { PrismaGearExtractionCacheAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-gear-extraction-cache.adapter'
import { PrismaGearConcurrencyLeaseAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-gear-concurrency-lease.adapter'
import { PrismaGearPlanRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-plan.repository'
import { PrismaGearPlanRevisionRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-plan-revision.repository'
import { PrismaGearQuoteLinkRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-quote-link.repository'

describe('Gear Repositories Unit Tests (Mock Prisma)', () => {
  describe('PrismaUserGearRepository', () => {
    let repo: PrismaUserGearRepository
    let mockPrisma: any

    beforeEach(() => {
      mockPrisma = {
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
        userGearItem: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          updateMany: jest.fn(),
          findFirstOrThrow: jest.fn(),
          deleteMany: jest.fn(),
        },
      }
      repo = new PrismaUserGearRepository(mockPrisma)
    })

    it('should scope findByIdAndUser to given userId', async () => {
      mockPrisma.userGearItem.findFirst.mockResolvedValue({
        id: 'item-1',
        userId: 'user-a',
        name: 'Trek Jacket',
        category: 'JACKET',
        brand: 'Quechua',
        condition: 'GOOD',
        attributes: { waterproof_mm: 5000 },
        photoRef: null,
        source: 'MANUAL',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const item = await repo.findByIdAndUser('item-1', 'user-a')
      expect(item).not.toBeNull()
      expect(mockPrisma.userGearItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'item-1', userId: 'user-a' },
        include: { photos: { orderBy: { position: 'asc' } } },
      })
    })

    it('should return null when item does not belong to user (foreign or missing)', async () => {
      mockPrisma.userGearItem.findFirst.mockResolvedValue(null)

      const item = await repo.findByIdAndUser('item-1', 'user-b')
      expect(item).toBeNull()
      expect(mockPrisma.userGearItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'item-1', userId: 'user-b' },
        include: { photos: { orderBy: { position: 'asc' } } },
      })
    })

    it('should throw GEAR_ITEM_NOT_FOUND when deleting foreign/missing item', async () => {
      mockPrisma.userGearItem.deleteMany.mockResolvedValue({ count: 0 })

      await expect(repo.delete('item-foreign', 'user-a')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_ITEM_NOT_FOUND }),
      )
    })

    it('should perform atomic scoped PATCH and retain explicit null in attributes', async () => {
      mockPrisma.userGearItem.findFirst.mockResolvedValue({
        id: 'item-1',
        userId: 'user-a',
        name: 'Old Name',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 5000, weight_g: 500 },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockPrisma.userGearItem.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.userGearItem.findFirstOrThrow.mockResolvedValue({
        id: 'item-1',
        userId: 'user-a',
        name: 'New Name',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 8000, weight_g: null },
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const updated = await repo.patch(
        'item-1',
        'user-a',
        {
          name: 'New Name',
          attributes: { waterproof_mm: 8000, weight_g: null },
        },
        1,
      )

      expect(mockPrisma.userGearItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1', userId: 'user-a', version: 1 },
          data: expect.objectContaining({
            name: 'New Name',
            attributes: { waterproof_mm: 8000, weight_g: null },
            version: { increment: 1 },
          }),
        }),
      )
      expect(updated.version).toBe(2)
    })

    it('should reject patch with GEAR_ITEM_VERSION_CONFLICT when expectedVersion mismatches', async () => {
      mockPrisma.userGearItem.findFirst.mockResolvedValue({
        id: 'item-1',
        userId: 'user-a',
        name: 'Jacket',
        category: 'JACKET',
        version: 3,
      })

      await expect(repo.patch('item-1', 'user-a', { name: 'Conflict Name' }, 2)).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_ITEM_VERSION_CONFLICT }),
      )
    })
  })

  describe('PrismaGearExtractionDraftRepository', () => {
    let repo: PrismaGearExtractionDraftRepository
    let mockPrisma: any

    beforeEach(() => {
      mockPrisma = {
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
        gearExtractionDraft: {
          create: jest.fn(),
          findFirst: jest.fn(),
          updateMany: jest.fn(),
        },
        userGearItem: {
          create: jest.fn(),
          findFirst: jest.fn(),
        },
      }
      repo = new PrismaGearExtractionDraftRepository(mockPrisma)
    })

    it('should throw GEAR_DRAFT_EXPIRED when draft is past expiry', async () => {
      mockPrisma.gearExtractionDraft.findFirst.mockResolvedValue({
        id: 'draft-1',
        userId: 'user-a',
        status: 'READY',
        sourceType: 'IMAGE',
        expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
      })

      await expect(
        repo.confirmDraft('draft-1', 'user-a', 'hash-1', {
          userId: 'user-a',
          name: 'Jacket',
          category: 'JACKET',
          brand: null,
          condition: 'GOOD',
          attributes: {},
          photoRef: null,
          source: 'AI_IMAGE',
        }),
      ).rejects.toThrow(expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_DRAFT_EXPIRED }))
    })

    it('should return existing item on idempotent replay (same confirmationPayloadHash)', async () => {
      mockPrisma.gearExtractionDraft.findFirst.mockResolvedValue({
        id: 'draft-1',
        userId: 'user-a',
        status: 'CONFIRMED',
        sourceType: 'IMAGE',
        confirmationPayloadHash: 'hash-abc',
        confirmedItemId: 'item-created-1',
        expiresAt: new Date(Date.now() + 60000),
      })

      mockPrisma.userGearItem.findFirst.mockResolvedValue({
        id: 'item-created-1',
        userId: 'user-a',
        name: 'Jacket',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: {},
        source: 'AI_IMAGE',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await repo.confirmDraft('draft-1', 'user-a', 'hash-abc', {
        userId: 'user-a',
        name: 'Jacket',
        category: 'JACKET',
        brand: null,
        condition: 'GOOD',
        attributes: {},
        photoRef: null,
        source: 'AI_IMAGE',
      })

      expect(result.replayed).toBe(true)
      expect(result.item.id).toBe('item-created-1')
      expect(mockPrisma.userGearItem.create).not.toHaveBeenCalled()
    })

    it('should throw GEAR_DRAFT_PAYLOAD_MISMATCH on different confirmationPayloadHash', async () => {
      mockPrisma.gearExtractionDraft.findFirst.mockResolvedValue({
        id: 'draft-1',
        userId: 'user-a',
        status: 'CONFIRMED',
        sourceType: 'IMAGE',
        confirmationPayloadHash: 'hash-original',
        confirmedItemId: 'item-1',
        expiresAt: new Date(Date.now() + 60000),
      })

      await expect(
        repo.confirmDraft('draft-1', 'user-a', 'hash-different', {
          userId: 'user-a',
          name: 'Jacket Different',
          category: 'JACKET',
          brand: null,
          condition: 'GOOD',
          attributes: {},
          photoRef: null,
          source: 'AI_IMAGE',
        }),
      ).rejects.toThrow(expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_DRAFT_PAYLOAD_MISMATCH }))
    })

    it('should create new item and map IMAGE to AI_IMAGE on first confirmation', async () => {
      mockPrisma.gearExtractionDraft.findFirst.mockResolvedValue({
        id: 'draft-1',
        userId: 'user-a',
        status: 'READY',
        sourceType: 'IMAGE',
        expiresAt: new Date(Date.now() + 60000),
        version: 1,
      })

      mockPrisma.userGearItem.create.mockResolvedValue({
        id: 'new-item-1',
        userId: 'user-a',
        name: 'Extracted Jacket',
        category: 'JACKET',
        condition: 'GOOD',
        attributes: { waterproof_mm: 5000 },
        source: 'AI_IMAGE',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockPrisma.gearExtractionDraft.updateMany.mockResolvedValue({ count: 1 })

      const result = await repo.confirmDraft('draft-1', 'user-a', 'hash-new', {
        userId: 'user-a',
        name: 'Extracted Jacket',
        category: 'JACKET',
        brand: null,
        condition: 'GOOD',
        attributes: { waterproof_mm: 5000 },
        photoRef: null,
        source: 'AI_IMAGE',
      })

      expect(result.replayed).toBe(false)
      expect(result.item.id).toBe('new-item-1')
      expect(mockPrisma.userGearItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'AI_IMAGE',
          }),
        }),
      )
    })
  })

  describe('PrismaGearConcurrencyLeaseAdapter', () => {
    let leaseAdapter: PrismaGearConcurrencyLeaseAdapter
    let mockPrisma: any

    beforeEach(() => {
      mockPrisma = {
        gearExtractionLease: {
          create: jest.fn(),
          findUnique: jest.fn(),
          updateMany: jest.fn(),
        },
      }
      leaseAdapter = new PrismaGearConcurrencyLeaseAdapter(mockPrisma)
    })

    it('should acquire lease when resource has no existing record', async () => {
      mockPrisma.gearExtractionLease.findUnique.mockResolvedValue(null)
      mockPrisma.gearExtractionLease.create.mockResolvedValue({
        resourceKey: 'res-1',
        ownerToken: 'token-a',
        fencingToken: 1,
      })

      const res = await leaseAdapter.acquireLease('res-1', 'token-a', 30000)
      expect(res.acquired).toBe(true)
      expect(res.fencingToken).toBe(1)
    })

    it('should reject acquisition when lease is held by another active token', async () => {
      mockPrisma.gearExtractionLease.findUnique.mockResolvedValue({
        resourceKey: 'res-1',
        ownerToken: 'token-other',
        fencingToken: 1,
        leaseExpiresAt: new Date(Date.now() + 20000), // active
      })

      const res = await leaseAdapter.acquireLease('res-1', 'token-a', 30000)
      expect(res.acquired).toBe(false)
    })

    it('should allow takeover when lease is expired, incrementing fencingToken', async () => {
      mockPrisma.gearExtractionLease.findUnique.mockResolvedValue({
        resourceKey: 'res-1',
        ownerToken: 'token-stale',
        fencingToken: 1,
        leaseExpiresAt: new Date(Date.now() - 5000), // expired
      })

      mockPrisma.gearExtractionLease.updateMany.mockResolvedValue({ count: 1 })

      const res = await leaseAdapter.acquireLease('res-1', 'token-new', 30000)
      expect(res.acquired).toBe(true)
      expect(res.fencingToken).toBe(2)
      expect(mockPrisma.gearExtractionLease.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resourceKey: 'res-1',
            fencingToken: 1,
          }),
          data: expect.objectContaining({
            ownerToken: 'token-new',
            fencingToken: { increment: 1 },
          }),
        }),
      )
    })

    it('should prevent stale holder from releasing lease after takeover', async () => {
      mockPrisma.gearExtractionLease.updateMany.mockResolvedValue({ count: 0 })

      // Stale holder tries to release with old fencing token 1
      const released = await leaseAdapter.releaseLease('res-1', 'token-stale', 1)
      expect(released).toBe(false)
      expect(mockPrisma.gearExtractionLease.updateMany).toHaveBeenCalledWith({
        where: {
          resourceKey: 'res-1',
          ownerToken: 'token-stale',
          fencingToken: 1,
          leaseExpiresAt: { gt: expect.any(Date) },
        },
        data: {
          ownerToken: '',
          leaseExpiresAt: new Date(0),
        },
      })
    })
  })

  describe('PrismaGearExtractionCacheAdapter (Owner-Scoped Identity)', () => {
    let cacheAdapter: PrismaGearExtractionCacheAdapter
    let mockPrisma: any

    beforeEach(() => {
      mockPrisma = {
        gearExtractionCache: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
        },
      }
      cacheAdapter = new PrismaGearExtractionCacheAdapter(mockPrisma)
    })

    it('should query cache strictly with ownerScope in unique key', async () => {
      mockPrisma.gearExtractionCache.findUnique.mockResolvedValue({
        id: 'cache-1',
        ownerScope: 'user-123',
        contentHash: 'hash-abc',
        promptVersion: '3.1.1',
        modelVersion: 'gemini-1.5-pro',
        schemaVersion: '1.0',
        status: 'SUCCESS',
        resultJson: { name: 'Cached Jacket' },
        expiresAt: new Date(Date.now() + 60000),
      })

      const cached = await cacheAdapter.getCache('user-123', 'hash-abc', '3.1.1', 'gemini-1.5-pro', '1.0')

      expect(cached).not.toBeNull()
      expect(mockPrisma.gearExtractionCache.findUnique).toHaveBeenCalledWith({
        where: {
          ownerScope_contentHash_promptVersion_modelVersion_schemaVersion: {
            ownerScope: 'user-123',
            contentHash: 'hash-abc',
            promptVersion: '3.1.1',
            modelVersion: 'gemini-1.5-pro',
            schemaVersion: '1.0',
          },
        },
      })
    })

    it('should return null when cache entry is expired', async () => {
      mockPrisma.gearExtractionCache.findUnique.mockResolvedValue({
        id: 'cache-1',
        ownerScope: 'user-123',
        contentHash: 'hash-abc',
        promptVersion: '3.1.1',
        modelVersion: 'gemini-1.5-pro',
        schemaVersion: '1.0',
        status: 'SUCCESS',
        expiresAt: new Date(Date.now() - 1000), // expired
      })

      const cached = await cacheAdapter.getCache('user-123', 'hash-abc', '3.1.1', 'gemini-1.5-pro', '1.0')
      expect(cached).toBeNull()
    })
  })

  describe('PrismaGearPlanRepository (CAS Isolation)', () => {
    let planRepo: PrismaGearPlanRepository
    let mockPrisma: any

    beforeEach(() => {
      mockPrisma = {
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
        gearPlan: {
          findFirst: jest.fn(),
          updateMany: jest.fn(),
          findFirstOrThrow: jest.fn(),
        },
      }
      planRepo = new PrismaGearPlanRepository(mockPrisma)
    })

    it('should update semantic context and increment inputRevision on matching expectedInputRevision', async () => {
      mockPrisma.gearPlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        userId: 'user-a',
        inputRevision: 1,
        progressVersion: 1,
      })

      mockPrisma.gearPlan.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.gearPlan.findFirstOrThrow.mockResolvedValue({
        id: 'plan-1',
        userId: 'user-a',
        title: 'Plan Updated',
        contextMode: 'TRIP',
        tripId: null,
        selectedItemIds: [],
        preferences: {},
        canonicalContext: { confirmedClimate: { rain_prob_pct: 70 } },
        inputRevision: 2,
        evaluatedRevision: null,
        progressVersion: 1,
        progressJson: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const updated = await planRepo.updateSemanticCAS('plan-1', 'user-a', 1, {
        title: 'Plan Updated',
        canonicalContext: { confirmedClimate: { rain_prob_pct: 70 } },
      })

      expect(updated.inputRevision).toBe(2)
      expect(mockPrisma.gearPlan.updateMany).toHaveBeenCalledWith({
        where: { id: 'plan-1', userId: 'user-a', inputRevision: 1 },
        data: expect.objectContaining({
          inputRevision: { increment: 1 },
        }),
      })
    })

    it('should reject semantic update with GEAR_PLAN_CAS_CONFLICT on stale revision', async () => {
      mockPrisma.gearPlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        userId: 'user-a',
        inputRevision: 3, // Current is 3
      })

      await expect(planRepo.updateSemanticCAS('plan-1', 'user-a', 2, { title: 'Stale update' })).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT }),
      )
    })

    it('should update progressVersion WITHOUT incrementing inputRevision', async () => {
      mockPrisma.gearPlan.findFirst.mockResolvedValue({
        id: 'plan-1',
        userId: 'user-a',
        inputRevision: 2,
        progressVersion: 1,
      })

      mockPrisma.gearPlan.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.gearPlan.findFirstOrThrow.mockResolvedValue({
        id: 'plan-1',
        userId: 'user-a',
        title: 'Plan',
        contextMode: 'TRIP',
        tripId: null,
        selectedItemIds: [],
        preferences: {},
        canonicalContext: {},
        inputRevision: 2, // UNCHANGED!
        evaluatedRevision: null,
        progressVersion: 2, // Incremented!
        progressJson: [{ step: 'CHECKLIST_DONE' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const updated = await planRepo.updateProgressCAS('plan-1', 'user-a', 1, [{ step: 'CHECKLIST_DONE' }])

      expect(updated.progressVersion).toBe(2)
      expect(updated.inputRevision).toBe(2)
      expect(mockPrisma.gearPlan.updateMany).toHaveBeenCalledWith({
        where: { id: 'plan-1', userId: 'user-a', progressVersion: 1 },
        data: expect.objectContaining({
          progressVersion: { increment: 1 },
        }),
      })
    })
  })

  describe('PrismaGearPlanRevisionRepository (Immutable Snapshots)', () => {
    let revRepo: PrismaGearPlanRevisionRepository
    let mockPrisma: any

    beforeEach(() => {
      mockPrisma = {
        gearPlanRevision: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
      }
      revRepo = new PrismaGearPlanRevisionRepository(mockPrisma)
    })

    it('should return existing revision on idempotent save with same contentHash', async () => {
      mockPrisma.gearPlanRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        planId: 'plan-1',
        revision: 1,
        contentHash: 'hash-identical',
        inputSnapshot: { rain: 80 },
        resultSnapshot: { isReady: false },
        contextVersion: '3.1.1',
        ruleVersions: {},
        createdAt: new Date(),
      })

      const saved = await revRepo.saveRevision({
        planId: 'plan-1',
        revision: 1,
        contentHash: 'hash-identical',
        inputSnapshot: { rain: 80 },
        resultSnapshot: { isReady: false },
        contextVersion: '3.1.1',
        ruleVersions: {},
      })

      expect(saved.id).toBe('rev-1')
      expect(mockPrisma.gearPlanRevision.create).not.toHaveBeenCalled()
    })

    it('should throw GEAR_PLAN_CAS_CONFLICT when saving same revision with different contentHash', async () => {
      mockPrisma.gearPlanRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        planId: 'plan-1',
        revision: 1,
        contentHash: 'hash-original',
      })

      await expect(
        revRepo.saveRevision({
          planId: 'plan-1',
          revision: 1,
          contentHash: 'hash-divergent',
          inputSnapshot: {},
          resultSnapshot: {},
          contextVersion: '3.1.1',
          ruleVersions: {},
        }),
      ).rejects.toThrow(expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT }))
    })
  })

  describe('PrismaGearQuoteLinkRepository (Ownership Verification)', () => {
    let quoteRepo: PrismaGearQuoteLinkRepository
    let mockPrisma: any

    beforeEach(() => {
      mockPrisma = {
        gearPlanRevision: {
          findUnique: jest.fn(),
        },
        rentalQuote: {
          findUnique: jest.fn(),
        },
        gearQuoteLink: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn(),
        },
        gearPlanOptionSet: {
          findMany: jest.fn(),
        },
        rentalQuoteLine: {
          findMany: jest.fn(),
        },
      }
      quoteRepo = new PrismaGearQuoteLinkRepository(mockPrisma)
    })

    it('should throw GEAR_QUOTE_NOT_FOUND if quote does not exist', async () => {
      mockPrisma.gearPlanRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        plan: { userId: 'user-a' },
      })
      mockPrisma.rentalQuote.findUnique.mockResolvedValue(null)

      await expect(quoteRepo.linkQuote('rev-1', 'quote-missing', 'user-a')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_QUOTE_NOT_FOUND }),
      )
    })

    it('should throw GEAR_QUOTE_NOT_OWNED if quote belongs to another user', async () => {
      mockPrisma.gearPlanRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        plan: { userId: 'user-a' },
      })
      mockPrisma.rentalQuote.findUnique.mockResolvedValue({
        id: 'quote-1',
        userId: 'user-b', // Foreign user!
      })

      await expect(quoteRepo.linkQuote('rev-1', 'quote-1', 'user-a')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_QUOTE_NOT_OWNED }),
      )
    })

    it('should link quote when user owns the quote and revision', async () => {
      mockPrisma.gearPlanRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        plan: { userId: 'user-a' },
      })
      mockPrisma.rentalQuote.findUnique.mockResolvedValue({
        id: 'quote-1',
        userId: 'user-a',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60000),
      })

      mockPrisma.gearPlanOptionSet.findMany.mockResolvedValue([
        {
          id: 'set-1',
          expiresAt: new Date(Date.now() + 60000),
          optionsJson: [
            {
              id: 'opt-1',
              rentalLines: [{ productId: 'prod-1', quantity: 1 }],
            },
          ],
        },
      ])

      mockPrisma.rentalQuoteLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          quoteId: 'quote-1',
          productId: 'prod-1',
          quantity: 1,
        },
      ])

      mockPrisma.gearQuoteLink.upsert.mockResolvedValue({
        id: 'link-1',
        planRevisionId: 'rev-1',
        quoteId: 'quote-1',
        userId: 'user-a',
        verifiedAt: new Date(),
        createdAt: new Date(),
      })

      const linked = await quoteRepo.linkQuote('rev-1', 'quote-1', 'user-a')
      expect(linked.quoteId).toBe('quote-1')
      expect(mockPrisma.gearQuoteLink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            planRevisionId_quoteId: {
              planRevisionId: 'rev-1',
              quoteId: 'quote-1',
            },
          },
        }),
      )
    })

    it('should reject when quote has wrong quantity for the same product (e.g. quote qty 999 vs option qty 1)', async () => {
      mockPrisma.gearPlanRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        plan: { userId: 'user-a' },
      })
      mockPrisma.rentalQuote.findUnique.mockResolvedValue({
        id: 'quote-1',
        userId: 'user-a',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60000),
      })
      mockPrisma.gearPlanOptionSet.findMany.mockResolvedValue([
        {
          id: 'set-1',
          expiresAt: new Date(Date.now() + 60000),
          optionsJson: [
            {
              id: 'opt-1',
              rentalLines: [{ productId: 'prod-1', quantity: 1 }],
            },
          ],
        },
      ])
      mockPrisma.rentalQuoteLine.findMany.mockResolvedValue([
        {
          id: 'line-1',
          quoteId: 'quote-1',
          productId: 'prod-1',
          quantity: 999, // Mismatched quantity!
        },
      ])

      await expect(quoteRepo.linkQuote('rev-1', 'quote-1', 'user-a')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE }),
      )
    })

    it('should reject when quote mixes products from mutually exclusive options', async () => {
      mockPrisma.gearPlanRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        plan: { userId: 'user-a' },
      })
      mockPrisma.rentalQuote.findUnique.mockResolvedValue({
        id: 'quote-1',
        userId: 'user-a',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60000),
      })
      mockPrisma.gearPlanOptionSet.findMany.mockResolvedValue([
        {
          id: 'set-1',
          expiresAt: new Date(Date.now() + 60000),
          optionsJson: [
            {
              id: 'opt-p-only',
              rentalLines: [{ productId: 'P', quantity: 1 }],
            },
            {
              id: 'opt-q-only',
              rentalLines: [{ productId: 'Q', quantity: 1 }],
            },
          ],
        },
      ])
      mockPrisma.rentalQuoteLine.findMany.mockResolvedValue([
        { id: 'line-1', quoteId: 'quote-1', productId: 'P', quantity: 1 },
        { id: 'line-2', quoteId: 'quote-1', productId: 'Q', quantity: 1 },
      ])

      await expect(quoteRepo.linkQuote('rev-1', 'quote-1', 'user-a')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE }),
      )
    })

    it('should fail closed when optionSets is empty', async () => {
      mockPrisma.gearPlanRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        plan: { userId: 'user-a' },
      })
      mockPrisma.rentalQuote.findUnique.mockResolvedValue({
        id: 'quote-1',
        userId: 'user-a',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60000),
      })
      mockPrisma.gearPlanOptionSet.findMany.mockResolvedValue([]) // Empty option sets!

      await expect(quoteRepo.linkQuote('rev-1', 'quote-1', 'user-a')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE }),
      )
    })

    it('should reject when all option sets are expired with GEAR_OPTION_SET_EXPIRED', async () => {
      mockPrisma.gearPlanRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        plan: { userId: 'user-a' },
      })
      mockPrisma.rentalQuote.findUnique.mockResolvedValue({
        id: 'quote-1',
        userId: 'user-a',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60000),
      })
      mockPrisma.gearPlanOptionSet.findMany.mockResolvedValue([
        {
          id: 'set-expired',
          expiresAt: new Date(Date.now() - 10000),
          optionsJson: [],
        },
      ])

      await expect(quoteRepo.linkQuote('rev-1', 'quote-1', 'user-a')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_OPTION_SET_EXPIRED }),
      )
    })
  })
})
