import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { AppError } from '../../../../shared/errors/app-error';
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes';
import { GearPlanContextMode, GearPlanDomain } from '../../domain/gear.types';
import {
  CreatePlanInput,
  GearPlanRepositoryPort,
  SemanticCASUpdateInput,
} from '../../application/ports/gear-plan.repository.port';

@Injectable()
export class PrismaGearPlanRepository implements GearPlanRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdAndUser(id: string, userId: string): Promise<GearPlanDomain | null> {
    const record = await this.prisma.gearPlan.findFirst({
      where: { id, userId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findAllByUser(userId: string): Promise<GearPlanDomain[]> {
    const records = await this.prisma.gearPlan.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async create(input: CreatePlanInput): Promise<GearPlanDomain> {
    const record = await this.prisma.gearPlan.create({
      data: {
        userId: input.userId,
        title: input.title,
        contextMode: input.contextMode as any,
        tripId: input.tripId ?? null,
        selectedItemIds: (input.selectedItemIds ?? []) as any,
        preferences: (input.preferences ?? {}) as any,
        canonicalContext: (input.canonicalContext ?? {}) as any,
        inputRevision: 1,
        evaluatedRevision: null,
        progressVersion: 1,
        progressJson: [] as any,
      },
    });
    return this.toDomain(record);
  }

  async updateSemanticCAS(
    id: string,
    userId: string,
    expectedInputRevision: number,
    update: SemanticCASUpdateInput,
  ): Promise<GearPlanDomain> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gearPlan.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, {
          message: 'Kế hoạch trang bị không tồn tại hoặc không thuộc quyền sở hữu của bạn',
        });
      }

      if (existing.inputRevision !== expectedInputRevision) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT, {
          message: `Xung đột phiên bản ngữ cảnh kế hoạch (hiện tại: ${existing.inputRevision}, yêu cầu: ${expectedInputRevision})`,
        });
      }

      const result = await tx.gearPlan.updateMany({
        where: {
          id,
          userId,
          inputRevision: expectedInputRevision,
        },
        data: {
          ...(update.title !== undefined ? { title: update.title } : {}),
          ...(update.preferences !== undefined ? { preferences: update.preferences as any } : {}),
          ...(update.canonicalContext !== undefined
            ? { canonicalContext: update.canonicalContext as any }
            : {}),
          ...(update.selectedItemIds !== undefined
            ? { selectedItemIds: update.selectedItemIds as any }
            : {}),
          inputRevision: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT, {
          message: 'Xung đột ghi đè ngữ cảnh kế hoạch trang bị đồng thời (CAS conflict)',
        });
      }

      const updated = await tx.gearPlan.findFirstOrThrow({
        where: { id, userId },
      });
      return this.toDomain(updated);
    });
  }

  async updateProgressCAS(
    id: string,
    userId: string,
    expectedProgressVersion: number,
    progressJson: unknown[],
  ): Promise<GearPlanDomain> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gearPlan.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, {
          message: 'Kế hoạch trang bị không tồn tại hoặc không thuộc quyền sở hữu của bạn',
        });
      }

      if (existing.progressVersion !== expectedProgressVersion) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PROGRESS_CAS_CONFLICT, {
          message: `Xung đột phiên bản tiến độ kế hoạch (hiện tại: ${existing.progressVersion}, yêu cầu: ${expectedProgressVersion})`,
        });
      }

      const result = await tx.gearPlan.updateMany({
        where: {
          id,
          userId,
          progressVersion: expectedProgressVersion,
        },
        data: {
          progressJson: progressJson as any,
          progressVersion: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PROGRESS_CAS_CONFLICT, {
          message: 'Xung đột ghi đè tiến độ kế hoạch trang bị đồng thời',
        });
      }

      const updated = await tx.gearPlan.findFirstOrThrow({
        where: { id, userId },
      });
      return this.toDomain(updated);
    });
  }

  async setEvaluatedRevision(
    id: string,
    userId: string,
    evaluatedRevision: number,
    expectedInputRevision?: number,
    canonicalContext?: Record<string, unknown>,
  ): Promise<GearPlanDomain> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gearPlan.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_NOT_FOUND, {
          message: 'Kế hoạch trang bị không tồn tại hoặc không thuộc quyền sở hữu của bạn',
        });
      }

      // Snapshot MUST exist for the plan
      const snapshot = await tx.gearPlanRevision.findUnique({
        where: {
          planId_revision: {
            planId: id,
            revision: evaluatedRevision,
          },
        },
      });

      if (!snapshot) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_REVISION_NOT_FOUND, {
          message: `Phiên bản snapshot ${evaluatedRevision} của kế hoạch chưa tồn tại, không thể xuất bản head`,
        });
      }

      // Stale evaluation cannot regress head to an older revision
      if (existing.evaluatedRevision !== null && evaluatedRevision < existing.evaluatedRevision) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT, {
          message: `Không thể cập nhật evaluatedRevision lùi về phiên bản cũ hơn (hiện tại: ${existing.evaluatedRevision}, yêu cầu: ${evaluatedRevision})`,
        });
      }

      if (expectedInputRevision !== undefined && existing.inputRevision !== expectedInputRevision) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT, {
          message: `Xung đột inputRevision khi xuất bản kết quả (hiện tại: ${existing.inputRevision}, yêu cầu: ${expectedInputRevision})`,
        });
      }

      const updateResult = await tx.gearPlan.updateMany({
        where: {
          id,
          userId,
          ...(expectedInputRevision !== undefined ? { inputRevision: expectedInputRevision } : {}),
          OR: [
            { evaluatedRevision: null },
            { evaluatedRevision: { lte: evaluatedRevision } },
          ],
        },
        data: {
          evaluatedRevision,
          ...(canonicalContext ? { canonicalContext: canonicalContext as any } : {}),
        },
      });

      if (updateResult.count === 0) {
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT);
      }

      const updated = await tx.gearPlan.findFirstOrThrow({
        where: { id, userId },
      });

      return this.toDomain(updated);
    });
  }

  private toDomain(record: any): GearPlanDomain {
    return {
      id: record.id,
      userId: record.userId,
      title: record.title,
      contextMode: record.contextMode as GearPlanContextMode,
      tripId: record.tripId,
      selectedItemIds: (record.selectedItemIds as string[]) || [],
      preferences: (record.preferences as Record<string, unknown>) || {},
      canonicalContext: (record.canonicalContext as Record<string, unknown>) || {},
      inputRevision: record.inputRevision,
      evaluatedRevision: record.evaluatedRevision,
      progressVersion: record.progressVersion,
      progressJson: (record.progressJson as unknown[]) || [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
