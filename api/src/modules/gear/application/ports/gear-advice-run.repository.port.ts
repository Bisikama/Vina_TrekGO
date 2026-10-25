import { GearAdviceRunDomain, GearAdviceSource } from '../../domain/gear.types';

export const GEAR_ADVICE_RUN_REPOSITORY_PORT = Symbol('GEAR_ADVICE_RUN_REPOSITORY_PORT');

export interface CreateAdviceRunInput {
  planRevisionId: string;
  source: GearAdviceSource;
  status?: string;
  promptVersion?: string;
  modelVersion?: string;
  contextHash: string;
  narrativeVi: string;
  factRefs: unknown[];
  actionRefs: unknown[];
  candidateRefs: unknown[];
  disclaimerVi: string;
  latencyMs?: number | null;
  tokenUsage?: Record<string, unknown> | null;
}

export interface GearAdviceRunRepositoryPort {
  findByRevision(planRevisionId: string): Promise<GearAdviceRunDomain | null>;
  saveAdviceRun(input: CreateAdviceRunInput): Promise<GearAdviceRunDomain>;
}
