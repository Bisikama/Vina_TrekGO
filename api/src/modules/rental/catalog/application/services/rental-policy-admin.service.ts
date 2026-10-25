import { Injectable } from '@nestjs/common';
import { Prisma, RentalPolicy } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_ERROR_CODES } from 'src/shared/errors/codes/rental.error-codes';
import { RENTAL_ORDERING_ERROR_CODES } from 'src/shared/errors/codes/rental-ordering.error-codes';
import type { PublishRentalPolicyDto } from '../../presentation/dtos/rental-policy-admin.dto';

const RENTAL_POLICY_SOT_VERSION = '1.5.2';

function currentWindow(now: Date) {
  return { isActive: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] };
}

function view(policy: RentalPolicy) {
  const { id, policyCode, versionNo, createdBy, createdAt, effectiveFrom, effectiveTo,
    isActive, ...values } = policy;
  return {
    id,
    version: versionNo,
    // SOT nghiệp vụ và revision của row DB là hai khái niệm khác nhau.
    policyVersion: RENTAL_POLICY_SOT_VERSION,
    policyCode,
    ...values,
    effectiveFrom: effectiveFrom.toISOString(),
    effectiveTo: effectiveTo?.toISOString() ?? null,
    isActive,
    createdBy,
    createdAt: createdAt.toISOString(),
    rentalCutoffHours: values.cutoffHoursBeforeTrip,
    policy: values,
  };
}

@Injectable()
export class RentalPolicyAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(now = new Date()) {
    const rows = await this.prisma.rentalPolicy.findMany({
      where: currentWindow(now), orderBy: [{ effectiveFrom: 'desc' }, { versionNo: 'desc' }], take: 2,
    });
    if (rows.length !== 1) throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.RENTAL_POLICY_NOT_CONFIGURED);
    const policyView = view(rows[0]);
    const rules = (this.prisma as any).damageAssessmentRule
      ? await this.prisma.damageAssessmentRule.findMany({
          where: {
            isActive: true,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          orderBy: [{ productId: 'asc' }, { ruleCode: 'asc' }],
        })
      : [];
    return {
      ...policyView,
      damageRules: rules.map((r: any) => ({
        id: r.id,
        ruleCode: r.ruleCode,
        productId: r.productId,
        severity: r.severity,
        formulaType: r.deductionType,
        value: Number(r.deductionValue),
        description: r.description ?? null,
      })),
    };
  }

  async publish(input: PublishRentalPolicyDto, adminId: string, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      // Khóa theo policy để hai ADMIN không cùng xuất bản một version.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('rental-policy:active', 0))::text`;
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const active = await tx.rentalPolicy.findMany({
        where: { isActive: true }, orderBy: [{ effectiveFrom: 'desc' }, { versionNo: 'desc' }], take: 2,
      });
      if (active.length !== 1 || active[0].effectiveFrom > now ||
          (active[0].effectiveTo && active[0].effectiveTo <= now))
        throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.RENTAL_POLICY_NOT_CONFIGURED);
      const previous = active[0];
      if (previous.versionNo !== input.expectedVersion)
        throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT,
          { details: { expectedVersion: input.expectedVersion, currentVersion: previous.versionNo } });
      // Quy tắc hủy liên quan tiền: chưa có DTO SOT cho phép thay cấu trúc ở API này.
      if (!isDeepStrictEqual(previous.cancellationRules, input.policy.cancellationRules))
        throw AppError.fromCode('VALIDATION_ERROR', { details: { field: 'policy.cancellationRules' } });

      const closed = await tx.rentalPolicy.updateMany({
        where: { id: previous.id, isActive: true, versionNo: input.expectedVersion },
        data: { isActive: false, effectiveTo: now },
      });
      if (closed.count !== 1) throw AppError.fromCode(RENTAL_ERROR_CODES.VERSION_CONFLICT);
      const next = await tx.rentalPolicy.create({
        data: {
          ...input.policy,
          cancellationRules: input.policy.cancellationRules as Prisma.InputJsonValue,
          policyCode: previous.policyCode,
          versionNo: previous.versionNo + 1,
          effectiveFrom: now,
          effectiveTo: null,
          isActive: true,
          createdBy: adminId,
        },
      });
      const correlationId = requestId?.trim().slice(0, 120) || randomUUID();
      await tx.auditLog.create({ data: {
        userId: adminId, action: 'RENTAL_POLICY_VERSION_PUBLISHED',
        entityType: 'RentalPolicy', entityId: next.id, requestId: correlationId,
        oldValues: { id: previous.id, version: previous.versionNo },
        newValues: { id: next.id, version: next.versionNo, reason: input.reason,
          policyCode: next.policyCode, correlationId },
      } });
      return view(next);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 });
  }
}
