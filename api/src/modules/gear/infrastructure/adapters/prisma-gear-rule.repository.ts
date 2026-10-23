import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { GearRequirementRuleMetadata, GearRuleCategory, GearVerdict } from '../../domain/gear.types';
import { GearRuleRepositoryPort } from '../../application/ports/gear-rule.repository.port';

@Injectable()
export class PrismaGearRuleRepository implements GearRuleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<GearRequirementRuleMetadata[]> {
    const records = await this.prisma.gearRequirementRule.findMany({
      orderBy: { id: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findActive(): Promise<GearRequirementRuleMetadata[]> {
    const records = await this.prisma.gearRequirementRule.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async upsertMany(rules: readonly GearRequirementRuleMetadata[]): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (const rule of rules) {
        await tx.gearRequirementRule.upsert({
          where: { id: rule.id },
          create: {
            id: rule.id,
            category: rule.category as any,
            defaultVerdict: rule.defaultVerdict as any,
            templateVi: rule.templateVi,
            isActive: rule.isActive,
            ruleVersion: rule.ruleVersion,
          },
          update: {
            category: rule.category as any,
            defaultVerdict: rule.defaultVerdict as any,
            templateVi: rule.templateVi,
            isActive: rule.isActive,
            ruleVersion: rule.ruleVersion,
          },
        });
        count++;
      }
      return count;
    });
  }

  private toDomain(record: any): GearRequirementRuleMetadata {
    return {
      id: record.id,
      category: record.category as GearRuleCategory,
      defaultVerdict: record.defaultVerdict as GearVerdict | null,
      templateVi: record.templateVi,
      isActive: record.isActive,
      ruleVersion: record.ruleVersion,
    };
  }
}

