import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError } from '../../../../shared/errors/app-error'
import { GEAR_ERROR_CODES } from '../../../../shared/errors/codes/gear.error-codes'
import { GearPlanRevisionDomain } from '../../domain/gear.types'
import {
  CreatePlanRevisionInput,
  GearPlanRevisionRepositoryPort,
} from '../../application/ports/gear-plan-revision.repository.port'

@Injectable()
export class PrismaGearPlanRevisionRepository implements GearPlanRevisionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByPlanAndRevision(planId: string, revision: number): Promise<GearPlanRevisionDomain | null> {
    const record = await this.prisma.gearPlanRevision.findUnique({
      where: {
        planId_revision: {
          planId,
          revision,
        },
      },
    })
    return record ? this.toDomain(record) : null
  }

  async findAllByPlan(planId: string): Promise<GearPlanRevisionDomain[]> {
    const records = await this.prisma.gearPlanRevision.findMany({
      where: { planId },
      orderBy: { revision: 'desc' },
    })
    return records.map((r) => this.toDomain(r))
  }

  async saveRevision(input: CreatePlanRevisionInput): Promise<GearPlanRevisionDomain> {
    const existing = await this.prisma.gearPlanRevision.findUnique({
      where: {
        planId_revision: {
          planId: input.planId,
          revision: input.revision,
        },
      },
    })

    if (existing) {
      if (existing.contentHash === input.contentHash) {
        return this.toDomain(existing)
      }
      throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT, {
        message: `Phiên bản kế hoạch ${input.revision} đã được lưu trữ bất biến với nội dung khác`,
      })
    }

    try {
      const created = await this.prisma.gearPlanRevision.create({
        data: {
          planId: input.planId,
          revision: input.revision,
          contentHash: input.contentHash,
          inputSnapshot: input.inputSnapshot as any,
          resultSnapshot: input.resultSnapshot as any,
          contextVersion: input.contextVersion,
          ruleVersions: (input.ruleVersions ?? {}) as any,
        },
      })
      return this.toDomain(created)
    } catch (err: any) {
      if (err.code === 'P2002') {
        const raceExisting = await this.prisma.gearPlanRevision.findUnique({
          where: {
            planId_revision: {
              planId: input.planId,
              revision: input.revision,
            },
          },
        })
        if (raceExisting && raceExisting.contentHash === input.contentHash) {
          return this.toDomain(raceExisting)
        }
        throw AppError.fromCode(GEAR_ERROR_CODES.GEAR_PLAN_CAS_CONFLICT)
      }
      throw err
    }
  }

  private toDomain(record: any): GearPlanRevisionDomain {
    return {
      id: record.id,
      planId: record.planId,
      revision: record.revision,
      contentHash: record.contentHash,
      inputSnapshot: (record.inputSnapshot as Record<string, unknown>) || {},
      resultSnapshot: (record.resultSnapshot as Record<string, unknown>) || {},
      contextVersion: record.contextVersion,
      ruleVersions: (record.ruleVersions as Record<string, unknown>) || {},
      createdAt: record.createdAt,
    }
  }
}
