import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { GearAdviceRunDomain, GearAdviceSource } from '../../domain/gear.types';
import {
  CreateAdviceRunInput,
  GearAdviceRunRepositoryPort,
} from '../../application/ports/gear-advice-run.repository.port';

@Injectable()
export class PrismaGearAdviceRunRepository implements GearAdviceRunRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByRevision(planRevisionId: string): Promise<GearAdviceRunDomain | null> {
    const record = await this.prisma.gearAdviceRun.findFirst({
      where: { planRevisionId },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.toDomain(record) : null;
  }

  async saveAdviceRun(input: CreateAdviceRunInput): Promise<GearAdviceRunDomain> {
    const record = await this.prisma.gearAdviceRun.create({
      data: {
        planRevisionId: input.planRevisionId,
        source: input.source as any,
        contextHash: input.contextHash,
        narrativeVi: input.narrativeVi,
        factRefs: (input.factRefs ?? []) as any,
        actionRefs: (input.actionRefs ?? []) as any,
        candidateRefs: (input.candidateRefs ?? []) as any,
        disclaimerVi: input.disclaimerVi,
        latencyMs: input.latencyMs ?? null,
        tokenUsage: (input.tokenUsage ?? null) as any,
      },
    });
    return this.toDomain(record);
  }

  private toDomain(record: any): GearAdviceRunDomain {
    return {
      id: record.id,
      planRevisionId: record.planRevisionId,
      source: record.source as GearAdviceSource,
      status: 'SUCCESS',
      promptVersion: '3.1.1',
      modelVersion: 'default',
      contextHash: record.contextHash,
      narrativeVi: record.narrativeVi,
      factRefs: (record.factRefs as unknown[]) || [],
      actionRefs: (record.actionRefs as unknown[]) || [],
      candidateRefs: (record.candidateRefs as unknown[]) || [],
      disclaimerVi: record.disclaimerVi,
      latencyMs: record.latencyMs,
      tokenUsage: record.tokenUsage as Record<string, unknown> | null,
      createdAt: record.createdAt,
    };
  }
}
