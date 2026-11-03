import { z } from 'zod'
import { createUserGearItemSchema } from './user-gear.dto'

export const imageExtractionInputSchema = z.object({
  source: z.literal('IMAGE'),
  sourceType: z.literal('IMAGE').optional(),
  uploadId: z.string().uuid('uploadId must be a valid media asset UUID'),
})

export const linkExtractionInputSchema = z.object({
  source: z.literal('LINK'),
  sourceType: z.literal('LINK').optional(),
  url: z.string().url('url must be a valid URL'),
  forceRefresh: z.boolean().optional(),
  bypassContentCache: z.boolean().optional(),
})

function preprocessExtractionPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }
  const obj = raw as Record<string, unknown>

  const topSource = typeof obj.source === 'string' ? obj.source.toUpperCase() : undefined
  const topSourceType = typeof obj.sourceType === 'string' ? obj.sourceType.toUpperCase() : undefined
  const nestedKind =
    obj.source && typeof obj.source === 'object' && !Array.isArray(obj.source)
      ? typeof (obj.source as Record<string, unknown>).kind === 'string'
        ? ((obj.source as Record<string, unknown>).kind as string).toUpperCase()
        : undefined
      : undefined

  // Reject conflicting/ambiguous inputs
  if (nestedKind && topSourceType && nestedKind !== topSourceType) {
    return { ...obj, source: '__CONFLICT_NESTED_SOURCETYPE__' }
  }
  if (topSource && topSourceType && topSource !== topSourceType) {
    return { ...obj, source: '__CONFLICT_SOURCE_SOURCETYPE__' }
  }

  // Canonical MASTER nested format: { source: { kind: 'IMAGE' | 'LINK', ... } }
  if (obj.source && typeof obj.source === 'object' && !Array.isArray(obj.source)) {
    const nested = obj.source as Record<string, unknown>
    const kind = typeof nested.kind === 'string' ? nested.kind.toUpperCase() : nested.kind
    const result: Record<string, unknown> = {
      source: kind,
      sourceType: kind,
    }
    if (nested.uploadId !== undefined || obj.uploadId !== undefined) {
      result.uploadId = nested.uploadId ?? obj.uploadId
    }
    if (nested.url !== undefined || obj.url !== undefined) {
      result.url = nested.url ?? obj.url
    }
    if (nested.forceRefresh !== undefined || obj.forceRefresh !== undefined) {
      result.forceRefresh = nested.forceRefresh ?? obj.forceRefresh
    }
    if (nested.bypassContentCache !== undefined || obj.bypassContentCache !== undefined) {
      result.bypassContentCache = nested.bypassContentCache ?? obj.bypassContentCache
    }
    return result
  }

  // Swagger flat format: { sourceType: 'IMAGE' | 'LINK', ... }
  if (obj.sourceType && !obj.source) {
    const kind = typeof obj.sourceType === 'string' ? obj.sourceType.toUpperCase() : obj.sourceType
    return {
      ...obj,
      source: kind,
      sourceType: kind,
    }
  }

  // Flat legacy format: { source: 'IMAGE' | 'LINK', ... }
  if (typeof obj.source === 'string') {
    const kind = obj.source.toUpperCase()
    return {
      ...obj,
      source: kind,
      sourceType: kind,
    }
  }

  return raw
}

export const extractionSourceUnionSchema = z.discriminatedUnion('source', [
  imageExtractionInputSchema,
  linkExtractionInputSchema,
])

export const createExtractionSchema = z.preprocess(preprocessExtractionPayload, extractionSourceUnionSchema)

export type CreateExtractionDto = z.infer<typeof extractionSourceUnionSchema>

export const confirmExtractionDraftSchema = z
  .object({
    expectedVersion: z.number().int().min(1).optional(),
    acknowledgeDuplicate: z.boolean().optional(),
    item: createUserGearItemSchema,
  })
  .strict()

export type ConfirmExtractionDraftDto = z.infer<typeof confirmExtractionDraftSchema>
