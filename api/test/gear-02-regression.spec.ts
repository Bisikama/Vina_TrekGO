import { AppError } from '../src/shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../src/shared/errors/codes/gear.error-codes';
import { PrismaUserGearRepository } from '../src/modules/gear/infrastructure/adapters/prisma-user-gear.repository';
import { PrismaGearExtractionDraftRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-extraction-draft.repository';
import { PrismaGearExtractionCacheAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-gear-extraction-cache.adapter';
import { PrismaGearConcurrencyLeaseAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-gear-concurrency-lease.adapter';
import { PrismaGearPlanRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-plan.repository';
import { PrismaGearQuoteLinkRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-quote-link.repository';

describe('Gear Step 02 Regression Tests (R02-01 to R02-13)', () => {
  // R02-01, R02-02, R02-03: Owned gear PATCH
  describe('B01: PrismaUserGearRepository PATCH Concurrency & Attributes', () => {
    it('R02-01: two attribute PATCH requests preserve both updates (no lost update)', async () => {
      let state = {
        id: 'item-a',
        userId: 'user-a',
        name: 'Jacket',
        category: 'JACKET',
        condition: 'GOOD',
        source: 'MANUAL',
        version: 1,
        brand: null,
        photoRef: null,
        attributes: { waterproof_mm: 5000, weight_g: 400 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrisma: any = {
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
        userGearItem: {
          findFirst: jest.fn(async (q) => (q.where.userId === state.userId ? { ...state } : null)),
          findFirstOrThrow: jest.fn(async (q) => ({ ...state })),
          updateMany: jest.fn(async (q) => {
            if (q.where.version === state.version) {
              state = {
                ...state,
                ...q.data,
                version: state.version + 1,
                attributes: {
                  ...state.attributes,
                  ...(q.data.attributes ?? {}),
                },
              };
              return { count: 1 };
            }
            return { count: 0 };
          }),
        },
      };

      const repo = new PrismaUserGearRepository(mockPrisma);

      // Simulate sequential patches resolving
      await repo.patch('item-a', 'user-a', { attributes: { waterproof_mm: 8000 } });
      await repo.patch('item-a', 'user-a', { attributes: { weight_g: 300 } });

      expect(state.attributes.waterproof_mm).toBe(8000);
      expect(state.attributes.weight_g).toBe(300);
    });

    it('R02-02: two PATCH requests with expectedVersion 1 cannot both succeed', async () => {
      let state = {
        id: 'item-a',
        userId: 'user-a',
        name: 'Jacket',
        category: 'JACKET',
        condition: 'GOOD',
        source: 'MANUAL',
        version: 1,
        brand: null,
        photoRef: null,
        attributes: { waterproof_mm: 5000 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrisma: any = {
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
        userGearItem: {
          findFirst: jest.fn(async (q) => ({ ...state })),
          findFirstOrThrow: jest.fn(async () => ({ ...state })),
          updateMany: jest.fn(async (q) => {
            if (q.where.version === 1 && state.version === 1) {
              state = { ...state, version: 2 };
              return { count: 1 };
            }
            return { count: 0 };
          }),
        },
      };

      const repo = new PrismaUserGearRepository(mockPrisma);

      const resA = repo.patch('item-a', 'user-a', { name: 'Name A' }, 1);
      const resB = repo.patch('item-a', 'user-a', { name: 'Name B' }, 1);

      const results = await Promise.allSettled([resA, resB]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });

    it('R02-03: null PATCH represents unknown as explicit null (key is NOT deleted)', async () => {
      let state = {
        id: 'item-a',
        userId: 'user-a',
        name: 'Jacket',
        category: 'JACKET',
        condition: 'GOOD',
        source: 'MANUAL',
        version: 1,
        brand: null,
        photoRef: null,
        attributes: { waterproof_mm: 5000 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrisma: any = {
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
        userGearItem: {
          findFirst: jest.fn(async () => ({ ...state })),
          findFirstOrThrow: jest.fn(async () => ({ ...state })),
          updateMany: jest.fn(async (q) => {
            state = { ...state, attributes: q.data.attributes, version: state.version + 1 };
            return { count: 1 };
          }),
        },
      };

      const repo = new PrismaUserGearRepository(mockPrisma);
      await repo.patch('item-a', 'user-a', { attributes: { waterproof_mm: null } });

      expect(Object.hasOwn(state.attributes, 'waterproof_mm')).toBe(true);
      expect(state.attributes.waterproof_mm).toBeNull();
    });
  });

  // R02-04, R02-05, R02-12: Draft persistence
  describe('B02: PrismaGearExtractionDraftRepository Confirm & Guards', () => {
    it('R02-04: same draft simultaneous confirm creates at most one item', async () => {
      let draft = {
        id: 'draft-a',
        userId: 'user-a',
        status: 'READY',
        sourceType: 'IMAGE',
        version: 1,
        expiresAt: new Date(Date.now() + 60000),
        confirmedItemId: null as string | null,
        confirmationPayloadHash: null as string | null,
      };
      const items: any[] = [];

      const mockPrisma: any = {
        $transaction: jest.fn(async (cb) => {
          const stagedItems: any[] = [];
          const tx = {
            userGearItem: {
              create: jest.fn(async (q) => {
                const newItem = { id: `item-${items.length + stagedItems.length + 1}`, ...q.data };
                stagedItems.push(newItem);
                return newItem;
              }),
              findFirst: jest.fn(async (q) => items.find((x) => x.id === q.where.id) || null),
            },
            gearExtractionDraft: mockPrisma.gearExtractionDraft,
          };
          const res = await cb(tx);
          items.push(...stagedItems);
          return res;
        }),
        gearExtractionDraft: {
          findFirst: jest.fn(async () => ({ ...draft })),
          updateMany: jest.fn(async (q) => {
            if (draft.status === 'READY' && draft.version === q.where.version) {
              draft = { ...draft, ...q.data, version: draft.version + 1 };
              return { count: 1 };
            }
            return { count: 0 };
          }),
        },
        userGearItem: {
          create: jest.fn(async (q) => {
            const newItem = { id: `item-${items.length + 1}`, ...q.data };
            items.push(newItem);
            return newItem;
          }),
          findFirst: jest.fn(async (q) => items.find((x) => x.id === q.where.id) || null),
        },
      };

      const repo = new PrismaGearExtractionDraftRepository(mockPrisma);
      const input = {
        userId: 'user-a',
        name: 'Jacket',
        category: 'JACKET' as const,
        brand: null,
        condition: 'GOOD' as const,
        attributes: {},
        photoRef: null,
        source: 'AI_IMAGE' as const,
      };

      const resA = repo.confirmDraft('draft-a', 'user-a', 'hash-1', input);
      const resB = repo.confirmDraft('draft-a', 'user-a', 'hash-1', input);

      const results = await Promise.allSettled([resA, resB]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');

      expect(items).toHaveLength(1);
    });

    it('R02-05: FAILED or PENDING draft cannot be confirmed', async () => {
      for (const status of ['FAILED', 'PENDING'] as const) {
        const mockPrisma: any = {
          $transaction: jest.fn(async (cb) => cb(mockPrisma)),
          gearExtractionDraft: {
            findFirst: jest.fn(async () => ({
              id: 'draft-1',
              userId: 'user-a',
              status,
              sourceType: 'IMAGE',
              expiresAt: new Date(Date.now() + 60000),
            })),
          },
          userGearItem: { create: jest.fn() },
        };

        const repo = new PrismaGearExtractionDraftRepository(mockPrisma);
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
        ).rejects.toThrow();
      }
    });

    it('R02-12: late extraction completion cannot overwrite CONFIRMED draft', async () => {
      let draft = {
        id: 'draft-a',
        userId: 'user-a',
        status: 'CONFIRMED',
        version: 3,
        confirmedItemId: 'item-1',
        sourceType: 'IMAGE',
        sourceHash: 'hash',
        expiresAt: new Date(Date.now() + 60000),
      };

      const mockPrisma: any = {
        gearExtractionDraft: {
          updateMany: jest.fn(async (q) => {
            // Guard: status must not be in CONFIRMED or FAILED
            if (q.where.status?.notIn?.includes(draft.status)) {
              return { count: 0 };
            }
            draft = { ...draft, ...q.data, version: draft.version + 1 };
            return { count: 1 };
          }),
          findUnique: jest.fn(async () => ({ ...draft })),
        },
      };

      const repo = new PrismaGearExtractionDraftRepository(mockPrisma);
      await expect(
        repo.updateExtractedData('draft-a', { name: 'Late' }, 'READY'),
      ).rejects.toThrow();

      expect(draft.status).toBe('CONFIRMED');
    });
  });

  // R02-06, R02-07, R02-08: Lease & Cache
  describe('B03/B04: Cache and Lease Concurrency & Validation', () => {
    it('R02-06: pending or failed cache result is not a hit (miss)', async () => {
      for (const status of ['PENDING', 'FAILED']) {
        const mockPrisma: any = {
          gearExtractionCache: {
            findUnique: jest.fn(async () => ({
              id: 'cache-1',
              ownerScope: 'u',
              contentHash: 'h',
              promptVersion: 'p',
              modelVersion: 'm',
              schemaVersion: 's',
              status,
              resultJson: {},
              expiresAt: new Date(Date.now() + 60000),
            })),
          },
        };

        const adapter = new PrismaGearExtractionCacheAdapter(mockPrisma);
        const hit = await adapter.getCache('u', 'h', 'p', 'm', 's');
        expect(hit).toBeNull();
      }
    });

    it('R02-07: stale cache publisher cannot overwrite when lease validation fails', async () => {
      let cache: any = null;
      const lease = {
        resourceKey: 'res',
        ownerToken: 'current-holder',
        fencingToken: 2,
        leaseExpiresAt: new Date(Date.now() + 30000),
      };

      const mockPrisma: any = {
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
        gearExtractionLease: {
          findFirst: jest.fn(async (q) => {
            if (
              q.where.resourceKey === lease.resourceKey &&
              q.where.ownerToken === lease.ownerToken &&
              q.where.fencingToken === lease.fencingToken
            ) {
              return lease;
            }
            return null;
          }),
        },
        gearExtractionCache: {
          upsert: jest.fn(async (q) => {
            cache = { id: 'c', ...q.create };
            return cache;
          }),
        },
      };

      const cacheAdapter = new PrismaGearExtractionCacheAdapter(mockPrisma);

      // Current holder with valid lease succeeds
      await cacheAdapter.setCache(
        {
          ownerScope: 'u',
          contentHash: 'h',
          promptVersion: 'p',
          modelVersion: 'm',
          schemaVersion: 's',
          status: 'SUCCESS',
          resultJson: { publisher: 'current-holder' },
          expiresAt: new Date(Date.now() + 60000),
        },
        { resourceKey: 'res', ownerToken: 'current-holder', fencingToken: 2 },
      );

      // Expired holder with stale token throws conflict
      await expect(
        cacheAdapter.setCache(
          {
            ownerScope: 'u',
            contentHash: 'h',
            promptVersion: 'p',
            modelVersion: 'm',
            schemaVersion: 's',
            status: 'SUCCESS',
            resultJson: { publisher: 'expired-holder' },
            expiresAt: new Date(Date.now() + 60000),
          },
          { resourceKey: 'res', ownerToken: 'expired-holder', fencingToken: 1 },
        ),
      ).rejects.toThrow();

      expect(cache.resultJson.publisher).toBe('current-holder');
    });

    it('R02-08: renewing old lease after takeover cannot alter the new holder', async () => {
      let lease = {
        resourceKey: 'res',
        ownerToken: 'B',
        fencingToken: 2,
        leaseExpiresAt: new Date(Date.now() + 30000),
      };

      const mockPrisma: any = {
        gearExtractionLease: {
          findUnique: jest.fn(async () => ({ ...lease })),
          updateMany: jest.fn(async (q) => {
            if (q.where.ownerToken === lease.ownerToken && q.where.fencingToken === lease.fencingToken) {
              lease = { ...lease, ...q.data };
              return { count: 1 };
            }
            return { count: 0 };
          }),
        },
      };

      const leaseAdapter = new PrismaGearConcurrencyLeaseAdapter(mockPrisma);

      // Holder A (who was taken over by B) attempts renew
      const res = await leaseAdapter.acquireLease('res', 'A', 30000);
      expect(res.acquired).toBe(false);
      expect(lease.ownerToken).toBe('B');
    });
  });

  // R02-09, R02-13: Plan evaluatedRevision guards
  describe('B05: PrismaGearPlanRepository evaluatedRevision Guards', () => {
    it('R02-09: evaluatedRevision must refer to an existing snapshot', async () => {
      const mockPrisma: any = {
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
        gearPlan: {
          findFirst: jest.fn(async () => ({
            id: 'plan-1',
            userId: 'user-a',
            inputRevision: 2,
            evaluatedRevision: null,
          })),
        },
        gearPlanRevision: {
          findUnique: jest.fn(async () => null), // Snapshot 99 does NOT exist!
        },
      };

      const repo = new PrismaGearPlanRepository(mockPrisma);
      await expect(repo.setEvaluatedRevision('plan-1', 'user-a', 99)).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND }),
      );
    });

    it('R02-13: late evaluation cannot regress evaluatedRevision from 3 to 2', async () => {
      const mockPrisma: any = {
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
        gearPlan: {
          findFirst: jest.fn(async () => ({
            id: 'plan-1',
            userId: 'user-a',
            inputRevision: 3,
            evaluatedRevision: 3,
          })),
        },
        gearPlanRevision: {
          findUnique: jest.fn(async () => ({ id: 'rev-2', revision: 2 })),
        },
      };

      const repo = new PrismaGearPlanRepository(mockPrisma);
      await expect(repo.setEvaluatedRevision('plan-1', 'user-a', 2)).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT }),
      );
    });
  });

  // R02-10, R02-11: Quote Link Ownership Chain
  describe('B06: PrismaGearQuoteLinkRepository Ownership Chain & Eligibility', () => {
    it('R02-10: quote owned by userA cannot be linked to plan revision owned by userB', async () => {
      const mockPrisma: any = {
        gearPlanRevision: {
          findUnique: jest.fn(async () => ({
            id: 'rev-1',
            plan: { userId: 'user-b' }, // Owned by User B!
          })),
        },
        rentalQuote: {
          findUnique: jest.fn(async () => ({
            id: 'quote-1',
            userId: 'user-a', // Owned by User A!
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 60000),
          })),
        },
      };

      const repo = new PrismaGearQuoteLinkRepository(mockPrisma);
      await expect(repo.linkQuote('rev-1', 'quote-1', 'user-a')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_FORBIDDEN }),
      );
    });

    it('R02-11: expired quote cannot receive a verified link', async () => {
      const mockPrisma: any = {
        gearPlanRevision: {
          findUnique: jest.fn(async () => ({
            id: 'rev-1',
            plan: { userId: 'user-a' },
          })),
        },
        rentalQuote: {
          findUnique: jest.fn(async () => ({
            id: 'quote-1',
            userId: 'user-a',
            status: 'EXPIRED',
            expiresAt: new Date(Date.now() - 60000),
          })),
        },
      };

      const repo = new PrismaGearQuoteLinkRepository(mockPrisma);
      await expect(repo.linkQuote('rev-1', 'quote-1', 'user-a')).rejects.toThrow(
        expect.objectContaining({ code: GEAR_ERROR_CODES.GEAR_QUOTE_NOT_ELIGIBLE }),
      );
    });
  });
});
