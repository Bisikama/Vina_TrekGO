import { GearPlanRevisionDomain } from '../../domain/gear.types';

export const GEAR_PLAN_REVISION_REPOSITORY_PORT = Symbol('GEAR_PLAN_REVISION_REPOSITORY_PORT');

export interface CreatePlanRevisionInput {
  planId: string;
  revision: number;
  contentHash: string;
  inputSnapshot: Record<string, unknown>;
  resultSnapshot: Record<string, unknown>;
  contextVersion: string;
  ruleVersions: Record<string, unknown>;
}

export interface GearPlanRevisionRepositoryPort {
  findByPlanAndRevision(planId: string, revision: number): Promise<GearPlanRevisionDomain | null>;
  saveRevision(input: CreatePlanRevisionInput): Promise<GearPlanRevisionDomain>;
}

