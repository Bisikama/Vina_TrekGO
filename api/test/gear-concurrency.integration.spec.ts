import { PrismaClient } from '@prisma/client';
import { PrismaUserGearRepository } from '../src/modules/gear/infrastructure/adapters/prisma-user-gear.repository';
import { PrismaGearExtractionDraftRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-extraction-draft.repository';
import { PrismaGearConcurrencyLeaseAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-gear-concurrency-lease.adapter';
import { PrismaGearPlanRevisionRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-plan-revision.repository';
import { seedGearRules } from '../prisma/seeds/gear-rule.seed';

/**
 * Isolated PostgreSQL Integration Test Suite for Gear Advisor V3.1.1 Concurrency & Lifecycle
 *
 * CRITICAL RULE: This suite requires a dedicated, isolated test database specified via TEST_DATABASE_URL.
 * It will NEVER run against development or production databases to ensure zero data risk.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeIntegration = testDatabaseUrl ? describe : describe.skip;

describeIntegration('PostgreSQL Isolated Integration Tests (TEST_DATABASE_URL)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: testDatabaseUrl,
        },
      },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('INTEG-01: Two concurrent PATCH requests on different attribute keys preserve both updates', async () => {
    const userRepo = new PrismaUserGearRepository(prisma as any);
    const testUserId = '00000000-0000-0000-0000-000000000001';

    const item = await userRepo.create({
      userId: testUserId,
      name: 'Integration Test Jacket',
      category: 'JACKET',
      brand: null,
      condition: 'GOOD',
      attributes: { waterproof_mm: 5000, weight_g: 400 },
      photoRef: null,
      source: 'MANUAL',
    });

    try {
      await Promise.all([
        userRepo.patch(item.id, testUserId, { attributes: { waterproof_mm: 10000 } }),
        userRepo.patch(item.id, testUserId, { attributes: { weight_g: 350 } }),
      ]);

      const reloaded = await userRepo.findByIdAndUser(item.id, testUserId);
      expect(reloaded).not.toBeNull();
      expect(reloaded?.attributes.waterproof_mm).toBe(10000);
      expect(reloaded?.attributes.weight_g).toBe(350);
    } finally {
      await userRepo.delete(item.id, testUserId);
    }
  });

  it('INTEG-02: Simultaneous confirm on same draft creates at most one UserGearItem', async () => {
    const draftRepo = new PrismaGearExtractionDraftRepository(prisma as any);
    const testUserId = '00000000-0000-0000-0000-000000000001';

    const draft = await draftRepo.createDraft({
      userId: testUserId,
      sourceType: 'IMAGE',
      sourceHash: `hash-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60000),
    });

    await draftRepo.updateExtractedData(draft.id, { name: 'Extracted' }, 'READY');

    const input = {
      userId: testUserId,
      name: 'Confirmed Item',
      category: 'JACKET' as const,
      brand: null,
      condition: 'GOOD' as const,
      attributes: {},
      photoRef: null,
      source: 'AI_IMAGE' as const,
    };

    const results = await Promise.allSettled([
      draftRepo.confirmDraft(draft.id, testUserId, 'payload-hash-1', input),
      draftRepo.confirmDraft(draft.id, testUserId, 'payload-hash-1', input),
    ]);

    const createdItems = await prisma.userGearItem.findMany({
      where: { userId: testUserId, name: 'Confirmed Item' },
    });

    try {
      expect(createdItems.length).toBe(1);
    } finally {
      for (const it of createdItems) {
        await prisma.userGearItem.delete({ where: { id: it.id } });
      }
      await prisma.gearExtractionDraft.delete({ where: { id: draft.id } });
    }
  });

  it('INTEG-03: Seed running twice produces exactly 28 rules without duplication', async () => {
    const res1 = await seedGearRules(prisma);
    const res2 = await seedGearRules(prisma);

    expect(res2.createdCount).toBe(0);
    expect(res2.updatedCount).toBe(28);

    const totalInDb = await prisma.gearRequirementRule.count();
    expect(totalInDb).toBe(28);
  });
});

if (!testDatabaseUrl) {
  describe('PostgreSQL Isolated Integration Tests (NOTICE)', () => {
    it('EXTERNAL_BLOCKED_TEST_DB: TEST_DATABASE_URL is not set; integration tests skipped to protect dev/prod DB', () => {
      console.log(
        '[EXTERNAL_BLOCKED_TEST_DB] Dedicated test database URL not configured. Integration test specifications are preserved and ready to run upon environment configuration.',
      );
      expect(true).toBe(true);
    });
  });
}

