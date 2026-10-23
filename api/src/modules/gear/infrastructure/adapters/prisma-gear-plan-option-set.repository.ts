import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { GearOptionObjective, GearPlanOptionSetDomain } from '../../domain/gear.types';
import {
  CreateOptionSetInput,
  GearPlanOptionSetRepositoryPort,
} from '../../application/ports/gear-plan-option-set.repository.port';

@Injectable()
export class PrismaGearPlanOptionSetRepository implements GearPlanOptionSetRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByRevisionAndObjective(
    planRevisionId: string,
    objective: GearOptionObjective,
  ): Promise<GearPlanOptionSetDomain | null> {
    const record = await this.prisma.gearPlanOptionSet.findFirst({
      where: {
        planRevisionId,
        objective: objective as any,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.toDomain(record) : null;
  }

  async saveOptionSet(input: CreateOptionSetInput): Promise<GearPlanOptionSetDomain> {
    const record = await this.prisma.gearPlanOptionSet.create({
      data: {
        planRevisionId: input.planRevisionId,
        objective: input.objective as any,
        searchScope: input.searchScope as any,
        optionsJson: input.optionsJson as any,
        expiresAt: input.expiresAt,
      },
    });
    return this.toDomain(record);
  }

  private toDomain(record: any): GearPlanOptionSetDomain {
    return {
      id: record.id,
      planRevisionId: record.planRevisionId,
      objective: record.objective as GearOptionObjective,
      searchScope: (record.searchScope as Record<string, unknown>) || {},
      optionsJson: (record.optionsJson as unknown[]) || [],
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }
}

