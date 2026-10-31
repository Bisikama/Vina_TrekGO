export type AttributeProvenanceEntry = { source: 'USER' | 'AI_IMAGE' | 'AI_LINK' | 'VERIFIED_CATALOG'; referenceId?: string }

export function manualAttributeProvenance(attributes: Record<string, unknown>): Record<string, AttributeProvenanceEntry> {
  return Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined)
    .map(([field]) => [field, { source: 'USER' }]))
}

export function mergeManualAttributeProvenance(
  previous: unknown, changes: Record<string, unknown>, categoryChanged: boolean,
): Record<string, AttributeProvenanceEntry> {
  const result = !categoryChanged && previous && typeof previous === 'object' && !Array.isArray(previous)
    ? { ...previous as Record<string, AttributeProvenanceEntry> } : {}
  for (const [field, value] of Object.entries(changes)) {
    if (value === undefined) continue
    if (value === null) delete result[field]
    else result[field] = { source: 'USER' }
  }
  return result
}

export function confirmedExtractionProvenance(
  attributes: Record<string, unknown>, extractedData: unknown, category: string, source: 'MANUAL' | 'AI_IMAGE' | 'AI_LINK', draftId: string,
): Record<string, AttributeProvenanceEntry> {
  const data = extractedData && typeof extractedData === 'object' && !Array.isArray(extractedData) ? extractedData as Record<string, unknown> : {}
  const extracted = typeof data.category === 'string' && data.category.toUpperCase() === category && data.attributes && typeof data.attributes === 'object' && !Array.isArray(data.attributes)
    ? data.attributes as Record<string, unknown> : {}
  const result = manualAttributeProvenance(attributes)
  if (source !== 'MANUAL') {
    for (const [field, value] of Object.entries(attributes)) {
      if (value !== null && value !== undefined && extracted[field] === value) result[field] = { source, referenceId: draftId }
    }
  }
  return result
}
