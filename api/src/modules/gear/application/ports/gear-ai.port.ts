import { DomainExtractionResult } from '../../domain/gear-extraction-schema'

export const GEAR_AI_PORT = Symbol('GEAR_AI_PORT')

export interface GearExtractionAiRequest {
  sourceType: 'IMAGE' | 'LINK'
  imageBase64?: string
  imageBuffer?: Buffer
  mimeType?: string
  textContent?: string
}

export interface GearExtractionMetadata {
  promptVersion: string
  promptHash: string
  modelVersion: string
  schemaVersion: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  latencyMs: number
}

export interface GearExtractionAiResult {
  extraction: DomainExtractionResult
  metadata: GearExtractionMetadata
}

export interface GearAdviceAiRequest {
  planId: string
  revision: number
  tripContext: Record<string, unknown>
  requirements: unknown[]
  coverage: Record<string, unknown>
  options?: unknown[]
  approvedClaims?: Array<{
    id: string
    category: string
    textVi: string
    factRefs?: string[]
    isMandatory?: boolean
  }>
}

export interface GearAdviceAiResult {
  source: 'AI' | 'CACHE' | 'RULE_FALLBACK'
  narrativeVi: string
  selectedClaimIds?: string[]
  claimIds?: string[]
  factRefs: string[]
  actionRefs: string[]
  candidateRefs: string[]
  disclaimerVi: string
  metadata?: {
    modelVersion: string
    promptVersion: string
    latencyMs?: number
    tokenUsage?: Record<string, unknown>
  }
}

export interface GearAiPort {
  extractGear(request: GearExtractionAiRequest): Promise<GearExtractionAiResult>
  generateAdvice?(request: GearAdviceAiRequest): Promise<GearAdviceAiResult>
}
