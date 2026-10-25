import { GearRequirementRuleMetadata } from '../../domain/gear.types';

export const GEAR_RULE_REPOSITORY_PORT = Symbol('GEAR_RULE_REPOSITORY_PORT');

export interface GearRuleRepositoryPort {
  findAll(): Promise<GearRequirementRuleMetadata[]>;
  findActive(): Promise<GearRequirementRuleMetadata[]>;
  upsertMany(rules: readonly GearRequirementRuleMetadata[]): Promise<number>;
}

