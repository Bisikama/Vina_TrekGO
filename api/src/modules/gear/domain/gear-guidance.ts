import type { GearItemEvaluationResult } from './pure-gear-engine'
import type { PlanRequirementCoverage } from './plan-coverage-resolver'
import { CANONICAL_FIELD_DEFINITIONS } from './constraint-evaluator'

const QUESTIONS: Record<string, { question: string; valueType: 'number' | 'boolean' | 'enum'; unit?: string; options?: string[] }> = {
  waterproof_mm: { question: 'Độ chống nước của món đồ là bao nhiêu?', valueType: 'number', unit: 'mm' },
  temp_rating_c: { question: 'Nhiệt độ sử dụng được ghi trên món đồ là bao nhiêu?', valueType: 'number', unit: '°C' },
  weight_g: { question: 'Món đồ nặng bao nhiêu?', valueType: 'number', unit: 'g' },
  windproof: { question: 'Món đồ có cản gió không?', valueType: 'boolean' },
  waterproof: { question: 'Món đồ có chống nước không?', valueType: 'boolean' },
  ankle_support: { question: 'Giày có hỗ trợ bảo vệ cổ chân không?', valueType: 'boolean' },
  grip_level: { question: 'Độ bám của đế giày là mức mấy (1–5)?', valueType: 'number' },
  insulated: { question: 'Món đồ có lớp giữ nhiệt không?', valueType: 'boolean' },
  capacity_l: { question: 'Balo có dung tích bao nhiêu?', valueType: 'number', unit: 'lít' },
  rain_cover: { question: 'Balo có áo mưa bọc balo không?', valueType: 'boolean' },
  sleeping_places: { question: 'Lều có bao nhiêu chỗ ngủ?', valueType: 'number', unit: 'người' },
  flysheet_waterproof_mm: { question: 'Lớp ngoài của lều có độ chống nước bao nhiêu?', valueType: 'number', unit: 'mm' },
  floor_waterproof_mm: { question: 'Đáy lều có độ chống nước bao nhiêu?', valueType: 'number', unit: 'mm' },
  adjustable: { question: 'Gậy trekking có điều chỉnh được chiều dài không?', valueType: 'boolean' },
  length_min_cm: { question: 'Chiều dài tối thiểu của gậy là bao nhiêu?', valueType: 'number', unit: 'cm' },
  length_max_cm: { question: 'Chiều dài tối đa của gậy là bao nhiêu?', valueType: 'number', unit: 'cm' },
  coverage: { question: 'Áo mưa che phần thân trên hay toàn thân?', valueType: 'enum', options: ['UPPER_BODY', 'FULL_BODY'] },
}

function questionFor(field: string) {
  if (field === 'attributes') {
    return { field, question: 'Hãy bổ sung thông số của món đồ để hệ thống đánh giá.', valueType: 'unknown', allowUnknown: true }
  }
  const definition = CANONICAL_FIELD_DEFINITIONS[field]
  return {
    field,
    ...(QUESTIONS[field] ?? { question: `Vui lòng bổ sung thông tin: ${field}`, valueType: 'unknown' }),
    ...(definition?.min !== undefined ? { min: definition.min } : {}),
    ...(definition?.max !== undefined ? { max: definition.max } : {}),
    ...(definition?.valueType === 'number' ? { isInteger: definition.isInteger === true } : {}),
    allowUnknown: true,
  }
}

/** Missing per-item inputs for unresolved plan constraints, derived solely from a saved revision. */
export function buildContextQuestions(snapshot: unknown, inputSnapshot: unknown) {
  const result = snapshot as { coverage?: { requirements?: PlanRequirementCoverage[] } } | null
  const input = inputSnapshot as { items?: Array<{ id?: unknown; name?: unknown; category?: unknown; attributes?: unknown }> } | null
  if (!Array.isArray(result?.coverage?.requirements) || !Array.isArray(input?.items)) {
    return { available: false, items: [] }
  }
  const items: Array<{ itemId: string; nameAtEvaluation: string | null; category: string; questions: Array<ReturnType<typeof questionFor> & { requirementId: string; constraintIds: string[] }> }> = []
  for (const item of input.items) {
    if (!item || typeof item.id !== 'string' || typeof item.category !== 'string') continue
    const attrs = item.attributes && typeof item.attributes === 'object' && !Array.isArray(item.attributes)
      ? item.attributes as Record<string, unknown> : {}
    const questions = new Map<string, ReturnType<typeof questionFor> & { requirementId: string; constraintIds: string[] }>()
    for (const requirement of result.coverage.requirements) {
      if (requirement.category !== item.category || !(requirement.remainingQuantity > 0) || !Array.isArray(requirement.constraints)) continue
      for (const constraint of requirement.constraints) {
        const definition = CANONICAL_FIELD_DEFINITIONS[constraint.field]
        if (!definition || !definition.categories.includes(requirement.category) || attrs[constraint.field] != null) continue
        const key = `${requirement.requirementId}\0${constraint.field}`
        const current = questions.get(key)
        if (current) {
          if (!current.constraintIds.includes(constraint.id)) current.constraintIds.push(constraint.id)
        } else {
          questions.set(key, { ...questionFor(constraint.field), requirementId: requirement.requirementId, constraintIds: [constraint.id] })
        }
      }
    }
    if (questions.size) items.push({
      itemId: item.id,
      nameAtEvaluation: typeof item.name === 'string' ? item.name : null,
      category: item.category,
      questions: [...questions.values()].map((question) => ({ ...question, constraintIds: question.constraintIds.sort() })),
    })
  }
  return { available: true, items }
}

export function displayGuidanceForItem(item: Pick<GearItemEvaluationResult, 'verdict' | 'traces'> | null) {
  const traces = Array.isArray(item?.traces) ? item.traces : []
  const rulesByField = new Map<string, Set<string>>()
  for (const trace of traces) {
    if (!trace.contextApplies || trace.outcome !== 'skip' || trace.ruleId === 'R25') continue
    for (const field of trace.missingAttributes ?? []) {
      if (!rulesByField.has(field)) rulesByField.set(field, new Set())
      rulesByField.get(field)!.add(trace.ruleId)
    }
  }
  const missingAttributes = [...rulesByField].sort(([a], [b]) => a.localeCompare(b)).map(([key, rules]) => {
    const definition = CANONICAL_FIELD_DEFINITIONS[key]
    const question = QUESTIONS[key]
    return {
      key,
      type: definition?.valueType ?? 'unknown',
      ...(question?.unit ? { unit: question.unit } : {}),
      requiredBy: [...rules].sort(),
    }
  })
  const hasFailure = traces.some((trace) => trace.outcome === 'true')
  const state = item?.verdict === 'SUITABLE' ? 'READY'
    : !item?.verdict ? 'NEEDS_INFO'
      : hasFailure || !missingAttributes.length ? 'NEEDS_PREPARATION' : 'NEEDS_INFO'
  const actions = state === 'NEEDS_INFO' ? ['SUPPLEMENT_INFO']
    : state === 'NEEDS_PREPARATION' ? ['VIEW_RENTAL_OPTIONS', 'SELF_PREPARE'] : []
  return { state, actions, missingAttributes }
}

/** Add presentation to an evaluate response without mutating the immutable stored snapshot. */
export function withDisplayGuidance(snapshot: Record<string, unknown>): Record<string, unknown> {
  const coreCheck = snapshot.coreCheck as { items?: GearItemEvaluationResult[] } | undefined
  if (!coreCheck || !Array.isArray(coreCheck.items)) return snapshot
  const byId = new Map(coreCheck.items.map((item) => [item.itemId, item]))
  const itemVerdicts = Array.isArray(snapshot.itemVerdicts)
    ? snapshot.itemVerdicts.map((item: any) => ({ ...item, displayGuidance: displayGuidanceForItem(byId.get(item.itemId) ?? null) }))
    : snapshot.itemVerdicts
  return {
    ...snapshot,
    ...(Array.isArray(snapshot.itemVerdicts) ? { itemVerdicts } : {}),
    coreCheck: { ...coreCheck, items: coreCheck.items.map((item) => ({ ...item, displayGuidance: displayGuidanceForItem(item) })) },
  }
}

/** Projection only: it never alters the stored verdict or invents a technical value. */
export function buildGearGuidance(snapshot: unknown, inputSnapshot?: unknown) {
  const data = snapshot as { coreCheck?: { items?: GearItemEvaluationResult[] }; coverage?: { requirements?: PlanRequirementCoverage[] } } | null
  const input = inputSnapshot as { items?: Array<{ id?: unknown; name?: unknown; version?: unknown }> } | null | undefined
  const inputItems = Array.isArray(input?.items) ? input.items : []
  const itemById = new Map(inputItems.filter((item) => item && typeof item.id === 'string').map((item) => [item.id, item]))
  if (!Array.isArray(data?.coreCheck?.items)) {
    return { available: false, items: [], message: 'Phiên bản này không có dữ liệu đánh giá chi tiết để tạo hướng dẫn.' }
  }
  return {
    available: true,
    requirements: (Array.isArray(data.coverage?.requirements) ? data.coverage.requirements : []).map((requirement) => ({
      requirementId: requirement.requirementId,
      category: requirement.category,
      priority: requirement.priority,
      status: requirement.status,
      recommendedAction: requirement.recommendedAction,
      remainingQuantity: requirement.remainingQuantity,
      assignedItemIds: requirement.assignedItemIds,
      warnings: requirement.warnings,
      questions: [...new Set(requirement.missingFields ?? [])].sort().map(questionFor),
    })),
    items: data.coreCheck.items.map((item) => {
      const savedItem = itemById.get(item.itemId)
      const traces = Array.isArray(item.traces) ? item.traces : []
      const missing = [...new Set(traces
        .filter((trace) => trace.contextApplies && trace.outcome === 'skip' && trace.ruleId !== 'R25')
        .flatMap((trace) => trace.missingAttributes))].sort()
      const hasViolation = traces.some((trace) => trace.outcome === 'true')
      return {
        itemId: item.itemId,
        nameAtEvaluation: typeof savedItem?.name === 'string' ? savedItem.name : null,
        versionAtEvaluation: typeof savedItem?.version === 'number' && Number.isInteger(savedItem.version) && savedItem.version > 0 ? savedItem.version : null,
        category: item.category,
        verdict: item.verdict,
        displayStatus: hasViolation ? 'NEEDS_ATTENTION' : missing.length ? 'NEEDS_INFORMATION' : item.verdict === 'SUITABLE' ? 'SUITABLE' : 'NEEDS_ATTENTION',
        questions: missing.map(questionFor),
        reasons: item.reasons,
      }
    }),
  }
}
