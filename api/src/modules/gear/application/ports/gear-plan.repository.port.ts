import { GearPlanContextMode, GearPlanDomain } from '../../domain/gear.types'

export const GEAR_PLAN_REPOSITORY_PORT = Symbol('GEAR_PLAN_REPOSITORY_PORT')

export interface CreatePlanInput {
  userId: string
  title: string
  contextMode: GearPlanContextMode
  tripId?: string | null
  selectedItemIds?: string[]
  preferences?: Record<string, unknown>
  canonicalContext?: Record<string, unknown>
}

export interface SemanticCASUpdateInput {
  title?: string
  preferences?: Record<string, unknown>
  canonicalContext?: Record<string, unknown>
  selectedItemIds?: string[]
}

export interface GearPlanRepositoryPort {
  findByIdAndUser(id: string, userId: string): Promise<GearPlanDomain | null>
  findAllByUser(userId: string): Promise<GearPlanDomain[]>
  create(input: CreatePlanInput): Promise<GearPlanDomain>
  updateSemanticCAS(
    id: string,
    userId: string,
    expectedInputRevision: number,
    update: SemanticCASUpdateInput,
  ): Promise<GearPlanDomain>
  updateProgressCAS(
    id: string,
    userId: string,
    expectedProgressVersion: number,
    progressJson: unknown[],
  ): Promise<GearPlanDomain>
  setEvaluatedRevision(
    id: string,
    userId: string,
    evaluatedRevision: number,
    expectedInputRevision?: number,
    canonicalContext?: Record<string, unknown>,
  ): Promise<GearPlanDomain>
}
