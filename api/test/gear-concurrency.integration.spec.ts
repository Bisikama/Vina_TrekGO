import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaUserGearRepository } from '../src/modules/gear/infrastructure/adapters/prisma-user-gear.repository';
import { PrismaGearExtractionDraftRepository } from '../src/modules/gear/infrastructure/adapters/prisma-gear-extraction-draft.repository';
import { RULE_METADATA_REGISTRY } from '../src/modules/gear/domain/rule-metadata.registry';

/**
 * Isolated PostgreSQL Integration Test Suite for Gear Advisor V3.1.5 Concurrency & Lifecycle
 *
 * Uses DATABASE_URL with a runId-isolated test fixture.
 * Cleans up exact created IDs in finally blocks without truncating DB or overwriting global seed data.
 */
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('PostgreSQL Concurrency & Lifecycle Integration Tests (runId Fixture)', () => {
  let prisma: PrismaClient;
  let testUserId: string;
  let hasDbConnection = false;
  const runId = randomUUID();

  beforeAll(async () => {
    if (!databaseUrl) return;
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
    await prisma.$connect();
    await prisma.$executeRaw`SELECT 1`;
    // Probe that required Gear Advisor tables exist in database
    await prisma.$executeRaw`SELECT 1 FROM "user_gear_items" LIMIT 1`;
    await prisma.$executeRaw`SELECT 1 FROM "user_gear_item_photos" LIMIT 1`;
    await prisma.$executeRaw`SELECT 1 FROM "gear_requirement_rules" LIMIT 1`;
    hasDbConnection = true;

    const user = await prisma.user.create({
      data: {
        authUserId: randomUUID(),
        email: `gear-test-${runId}@example.com`,
        fullName: `Gear Test User ${runId.slice(0, 8)}`,
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (hasDbConnection && testUserId) {
      try {
        await prisma.userGearItemPhoto.deleteMany({ where: { item: { userId: testUserId } } });
        await prisma.userGearItem.deleteMany({ where: { userId: testUserId } });
        await prisma.gearExtractionDraft.deleteMany({ where: { userId: testUserId } });
        await prisma.gearQuoteLink.deleteMany({ where: { userId: testUserId } });
        await prisma.gearPlan.deleteMany({ where: { userId: testUserId } });
        await prisma.user.delete({ where: { id: testUserId } });
      } catch (cleanupErr: any) {
        console.error(`[GEAR_CLEANUP_FAILURE] Fixture cleanup failed for ${testUserId}:`, cleanupErr.message);
      }
    }
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  });

  it('INTEG-01: Two concurrent PATCH requests on different attribute keys preserve both updates', async () => {
    expect(hasDbConnection).toBe(true);

    const userRepo = new PrismaUserGearRepository(prisma as any);

    const item = await userRepo.create({
      userId: testUserId,
      name: `Integration Test Jacket ${runId.slice(0, 6)}`,
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
    expect(hasDbConnection).toBe(true);

    const draftRepo = new PrismaGearExtractionDraftRepository(prisma as any);

    const draft = await draftRepo.createDraft({
      userId: testUserId,
      sourceType: 'IMAGE',
      sourceHash: `hash-${runId}-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60000),
    });

    await draftRepo.updateExtractedData(draft.id, { name: 'Extracted' }, 'READY');

    const input = {
      userId: testUserId,
      name: `Confirmed Item ${runId.slice(0, 6)}`,
      category: 'JACKET' as const,
      brand: null,
      condition: 'GOOD' as const,
      attributes: {},
      photoRef: null,
      source: 'AI_IMAGE' as const,
    };

    const results = await Promise.allSettled([
      draftRepo.confirmDraft(draft.id, testUserId, `payload-hash-${runId}`, input),
      draftRepo.confirmDraft(draft.id, testUserId, `payload-hash-${runId}`, input),
    ]);

    const createdItems = await prisma.userGearItem.findMany({
      where: { userId: testUserId, name: input.name },
    });

    try {
      expect(createdItems.length).toBe(1);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
    } finally {
      for (const it of createdItems) {
        await prisma.userGearItem.delete({ where: { id: it.id } }).catch(() => {});
      }
      await prisma.gearExtractionDraft.delete({ where: { id: draft.id } }).catch(() => {});
    }
  });

  it('INTEG-03: Rule repository read-only verification checks 28 canonical rules without overwriting DB', async () => {
    expect(hasDbConnection).toBe(true);

    const rules = await prisma.gearRequirementRule.findMany({
      select: { id: true, category: true, isActive: true },
    });

    expect(rules.length).toBe(28);
    const ruleIds = new Set(rules.map((r) => r.id));
    for (let i = 1; i <= 28; i++) {
      const code = `R${i.toString().padStart(2, '0')}`;
      expect(ruleIds.has(code)).toBe(true);
    }
  });
});

if (!databaseUrl) {
  describe('PostgreSQL Integration Tests (NOTICE)', () => {
    it('DATABASE_URL is not set; integration tests skipped cleanly', () => {
      console.log(
        '[GEAR_INTEGRATION_NOTICE] Database URL not configured. Integration test suite skipped gracefully.',
      );
      expect(true).toBe(true);
    });
  });
}
