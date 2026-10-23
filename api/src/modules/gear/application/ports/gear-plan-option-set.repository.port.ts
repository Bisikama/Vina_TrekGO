import { GearOptionObjective, GearPlanOptionSetDomain } from '../../domain/gear.types';

export const GEAR_PLAN_OPTION_SET_REPOSITORY_PORT = Symbol('GEAR_PLAN_OPTION_SET_REPOSITORY_PORT');

export interface CreateOptionSetInput {
  planRevisionId: string;
  objective: GearOptionObjective;
  searchScope: Record<string, unknown>;
  optionsJson: unknown[];
  expiresAt: Date;
}

export interface GearPlanOptionSetRepositoryPort {
  findByRevisionAndObjective(
    planRevisionId: string,
    objective: GearOptionObjective,
  ): Promise<GearPlanOptionSetDomain | null>;
  saveOptionSet(input: CreateOptionSetInput): Promise<GearPlanOptionSetDomain>;
}

