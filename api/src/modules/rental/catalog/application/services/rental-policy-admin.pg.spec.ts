import { PrismaClient, RentalDayCountMode } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { RentalPolicyAdminService } from './rental-policy-admin.service';
import { PublishRentalPolicySchema } from '../../presentation/dtos/rental-policy-admin.dto';

const testUrl = process.env.RENTAL_TEST_DATABASE_URL;
if (testUrl) {
  const parsed = new URL(testUrl);
  // Chỉ DB PostgreSQL test cục bộ, tên riêng; tuyệt đối không fallback sang DATABASE_URL/Neon.
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      !parsed.pathname.slice(1).startsWith('rental_test_') ||
      testUrl === process.env.DATABASE_URL) {
    throw new Error('RENTAL_TEST_DATABASE_URL must identify a dedicated local rental_test_* database');
  }
}

const isolated = testUrl ? describe : describe.skip;

isolated('RB-API-704 concurrent publication on isolated PostgreSQL', () => {
  jest.setTimeout(30_000);
  let pool: Pool;
  let db: PrismaClient;
  const id = randomUUID();
  const code = `POLICY_TEST_${id}`;
  const admin1 = randomUUID();
  const admin2 = randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testUrl });
    db = new PrismaClient({ adapter: new PrismaPg(pool) });
    await db.$connect();
    // Bài thử cần một DB dùng riêng, trống policy active để không tác động fixture khác.
    const active = await db.rentalPolicy.count({ where: { isActive: true } });
    if (active !== 0) throw new Error('Isolated test database must have no active RentalPolicy');
    await db.user.createMany({ data: [
      { id: admin1, authUserId: randomUUID(), email: `${admin1}@rental.test`, fullName: 'Policy Admin 1', role: 'ADMIN' },
      { id: admin2, authUserId: randomUUID(), email: `${admin2}@rental.test`, fullName: 'Policy Admin 2', role: 'ADMIN' },
    ] });
    const policy = await db.rentalPolicy.create({ data: {
      policyCode: code, versionNo: 1, currency: 'VND', dayCountMode: RentalDayCountMode.CEIL_24H,
      quoteTtlMinutes: 10, paymentHoldMinutes: 15, freeCancellationHours: 24,
      cutoffHoursBeforeTrip: 24, prepBufferMinutes: 720, returnBufferMinutes: 1440,
      cleaningBufferMinutes: 0, deepInspectionBufferMinutes: 2880,
      pickupCodeTtlMinutes: 15, pickupVerificationTtlMinutes: 10,
      overdueReviewMinutes: 120, deepInspectionReviewMinutes: 2880,
      adminApprovalMinutes: 1440, userAssessmentReviewMinutes: 2880,
      lostConfirmationMinutes: null, maxRentalAfterTripHours: 48,
      extensionRequestCutoffMinutes: 120, extensionHoldMinutes: 15,
      maxExtensionCount: 2, maxTotalRentalDays: 14,
      returnInspectionSlaHours: 72, deepInspectionSlaHours: 24,
      returnToInventoryAllowanceHours: 8, postInspectionCleaningAllowanceHours: 8,
      cancellationRules: [], effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      isActive: true, createdBy: admin1,
    } });
    expect(policy.policyCode).toBe(code);
  });

  afterAll(async () => {
    if (db) {
      const created = await db.rentalPolicy.findMany({ where: { policyCode: code }, select: { id: true } });
      const policyIds = created.map((row) => row.id);
      await db.auditLog.deleteMany({ where: { action: 'RENTAL_POLICY_VERSION_PUBLISHED', entityId: { in: policyIds } } });
      await db.rentalPolicy.deleteMany({ where: { policyCode: code } });
      await db.user.deleteMany({ where: { id: { in: [admin1, admin2] } } });
      await db.$disconnect();
    }
    if (pool) await pool.end();
  });

  it('hai ADMIN cùng expectedVersion chỉ xuất bản một version và một audit', async () => {
    const service = new RentalPolicyAdminService(db as never);
    const input = PublishRentalPolicySchema.parse({
      expectedVersion: 1, reason: 'Kiểm thử hai quản trị viên xuất bản đồng thời',
      policy: {
        currency: 'VND', dayCountMode: 'CEIL_24H', quoteTtlMinutes: 10,
        paymentHoldMinutes: 15, freeCancellationHours: 24, cutoffHoursBeforeTrip: 24,
        prepBufferMinutes: 720, returnBufferMinutes: 1440, cleaningBufferMinutes: 0,
        deepInspectionBufferMinutes: 2880, pickupCodeTtlMinutes: 15,
        pickupVerificationTtlMinutes: 10, overdueReviewMinutes: 120,
        deepInspectionReviewMinutes: 2880, adminApprovalMinutes: 1440,
        userAssessmentReviewMinutes: 2880, lostConfirmationMinutes: null,
        maxRentalAfterTripHours: 48, extensionRequestCutoffMinutes: 120,
        extensionHoldMinutes: 15, maxExtensionCount: 2, maxTotalRentalDays: 14,
        returnInspectionSlaHours: 72, deepInspectionSlaHours: 24,
        returnToInventoryAllowanceHours: 8, postInspectionCleaningAllowanceHours: 8,
        cancellationRules: [],
      },
    });
    const results = await Promise.allSettled([
      service.publish(input, admin1, `${id}-1`),
      service.publish(input, admin2, `${id}-2`),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected');
    expect(failed).toMatchObject({ reason: { code: 'VERSION_CONFLICT' } });
    const rows = await db.rentalPolicy.findMany({ where: { policyCode: code }, orderBy: { versionNo: 'asc' } });
    expect(rows.map((row) => [row.versionNo, row.isActive])).toEqual([[1, false], [2, true]]);
    expect(await db.auditLog.count({ where: {
      action: 'RENTAL_POLICY_VERSION_PUBLISHED', entityId: rows[1].id,
    } })).toBe(1);
  });
});
