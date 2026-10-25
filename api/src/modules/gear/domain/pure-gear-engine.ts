/**
 * AI Gear Advisor V3.1.5 — Pure Gear Engine & Constraint Evaluator (Pure TypeScript)
 * Zero NestJS, Prisma, AI SDK, I/O, network, system time, or random imports.
 * Exactly implements MASTER V3.1.5 Section 6, 7, 8, Phụ lục A (Section D, E, F).
 */

import {
  CoreGearCategory,
  GearCategory,
  GearCondition,
  GearVerdict,
  CORE_GEAR_CATEGORIES,
  isCoreGearCategory,
} from './gear.types'
import {
  TripContext,
  RuleEvaluationTrace,
  CANONICAL_RULE_DEFINITIONS,
  GENERAL_RULE_TEMPLATES,
  renderGeneralTemplate,
  renderRuleReason,
  normalizeCoreGearItemInput,
  CoreGearItemInput,
  UnsupportedCoreCategoryError,
  InvalidAttributeValueError,
} from './rule-predicates'
import {
  RequirementConstraintInput,
  ConstraintEvaluationResult,
  SubjectRequirementEvaluationResult,
  ConstraintValidationError,
  evaluateRequirementConstraint,
  evaluateSubjectRequirementConstraints,
} from './constraint-evaluator'

export type { CoreGearItemInput }

export type GearItemInput = CoreGearItemInput

export interface GearItemEvaluationResult {
  itemId: string
  category: CoreGearCategory
  verdict: GearVerdict
  reasons: string[]
  missingAttributes: string[]
  traces: RuleEvaluationTrace[]
}

export interface GearCheckGap {
  ruleId: string
  category: GearCategory
  message: string
}

export interface GearChecklistRow {
  category: CoreGearCategory
  representativeItemId: string | null
  verdict: GearVerdict | null
  status: 'suitable' | 'not_suitable' | 'missing' | 'rent_suggested'
  reasons: string[]
  missingAttributes: string[]
}

export interface SubjectConstraintBinding {
  subjectId: string
  category: GearCategory
  requirementId: string
  constraints: RequirementConstraintInput[]
}

export interface GearCheckOptions {
  subjectConstraints?: SubjectConstraintBinding[]
}

export interface GearCheckResult {
  isReady: boolean
  items: GearItemEvaluationResult[]
  gaps: GearCheckGap[]
  checklist: GearChecklistRow[]
  subjectConstraintEvaluations?: SubjectRequirementEvaluationResult[]
  rentalSuggestions: unknown[]
  aiAdvice: null
}

const MANDATORY_CATEGORIES: readonly CoreGearCategory[] = ['JACKET', 'FOOTWEAR', 'BACKPACK']

/**
 * Pure evaluation function for a single gear item against a Trip context.
 * Strict boundary validation: extended categories throw UnsupportedCoreCategoryError ('GEAR_CATEGORY_REQUIRES_PLAN').
 * Evaluates category rules R01–R23, applies R25 (applicable skip) and R24 (condition=poor).
 * Zero side effects, zero mutation.
 */
export function evaluateGearItem(rawItem: CoreGearItemInput, trip: TripContext): GearItemEvaluationResult {
  // 1. Boundary validation and normalization
  const item = normalizeCoreGearItemInput(rawItem)

  const traces: RuleEvaluationTrace[] = []
  const reasons: string[] = []
  const allMissingAttrSet = new Set<string>()
  const applicableMissingAttrSet = new Set<string>()

  let hasApplicableSkip = false
  let hasTruePredicate = false

  // Collect all rules for this category
  const categoryRules = Object.values(CANONICAL_RULE_DEFINITIONS).filter((r) => r.category === item.category)

  for (const rule of categoryRules) {
    const applies = rule.contextApplies(trip)
    const evalResult = rule.evaluate(item.attributes, trip)

    for (const m of evalResult.missingAttributes) {
      allMissingAttrSet.add(m)
      if (applies) {
        applicableMissingAttrSet.add(m)
      }
    }

    let renderedReason: string | undefined

    if (evalResult.outcome === 'skip') {
      if (applies) {
        hasApplicableSkip = true
      }
    } else if (evalResult.outcome === 'true') {
      hasTruePredicate = true
      renderedReason = renderRuleReason(rule.id, evalResult.values ?? {})
      reasons.push(renderedReason)
    }

    traces.push({
      ruleId: rule.id,
      category: rule.category,
      outcome: evalResult.outcome,
      contextApplies: applies,
      missingAttributes: evalResult.missingAttributes,
      renderedReason,
    })
  }

  // Determine intermediate verdict from category rules
  let verdict: GearVerdict = hasTruePredicate ? 'NOT_SUITABLE' : 'SUITABLE'

  const sortedApplicableMissing = Array.from(applicableMissingAttrSet).sort()
  const sortedAllMissing = Array.from(allMissingAttrSet).sort()

  // R25: Applicable skip makes item NOT_SUITABLE and appends reason R25 (once!)
  // "item còn rule áp dụng được (contextApplies=true) bị skip thì NOT_SUITABLE kèm reason R25"
  if (hasApplicableSkip) {
    verdict = 'NOT_SUITABLE'
    const r25Reason = renderGeneralTemplate('R25', {
      attributes: sortedApplicableMissing.join(', '),
    })
    reasons.push(r25Reason)

    traces.push({
      ruleId: 'R25',
      category: 'GENERAL',
      outcome: 'skip',
      contextApplies: true,
      missingAttributes: sortedApplicableMissing,
      renderedReason: r25Reason,
    })
  }

  // R24: Condition poor check (evaluated at the end, overrides verdict to NOT_SUITABLE)
  const isPoorCondition = String(item.condition).trim().toLowerCase() === 'poor'

  if (isPoorCondition) {
    verdict = 'NOT_SUITABLE'
    const r24Reason = GENERAL_RULE_TEMPLATES.R24
    reasons.push(r24Reason)

    traces.push({
      ruleId: 'R24',
      category: 'GENERAL',
      outcome: 'true',
      contextApplies: true,
      missingAttributes: [],
      renderedReason: r24Reason,
    })
  } else {
    traces.push({
      ruleId: 'R24',
      category: 'GENERAL',
      outcome: 'false',
      contextApplies: true,
      missingAttributes: [],
    })
  }

  return {
    itemId: item.id,
    category: item.category,
    verdict,
    reasons,
    missingAttributes: sortedAllMissing,
    traces,
  }
}

/**
 * Pure evaluation function for overall gear check across a list of selected core items.
 * Evaluates individual items, checks R26, R27, R28 gaps, computes isReady and builds core checklist.
 * Prioritizes gap status ('rent_suggested') in checklist projection even when category items exist.
 * Zero side effects, zero mutation, zero flat merge.
 */
export function evaluateGearCheck(
  items: CoreGearItemInput[],
  trip: TripContext,
  options?: GearCheckOptions,
): GearCheckResult {
  // B04-07: Reject duplicate item IDs before evaluation
  const seenItemIds = new Set<string>()
  for (const it of items) {
    const rawId =
      it && typeof it === 'object' && 'id' in it && typeof (it as any).id === 'string' ? (it as any).id.trim() : ''
    if (rawId) {
      if (seenItemIds.has(rawId)) {
        throw new InvalidAttributeValueError('id', `Duplicate item id '${rawId}' detected in gear check input.`)
      }
      seenItemIds.add(rawId)
    }
  }

  // 1. Boundary validation: all items must be core gear categories
  const normalizedItems: CoreGearItemInput[] = items.map((it) => normalizeCoreGearItemInput(it))

  // 2. Evaluate all individual items
  const evaluatedItems: GearItemEvaluationResult[] = normalizedItems.map((item) => evaluateGearItem(item, trip))

  const gaps: GearCheckGap[] = []

  // 3. R26: Check mandatory categories (JACKET, FOOTWEAR, BACKPACK)
  const selectedCategories = new Set(normalizedItems.map((i) => i.category))

  for (const mandCat of MANDATORY_CATEGORIES) {
    if (!selectedCategories.has(mandCat)) {
      gaps.push({
        ruleId: 'R26',
        category: mandCat,
        message: renderGeneralTemplate('R26', { category: mandCat }),
      })
    }
  }

  // 4. R27: temp_min_c <= 0 and NO jacket with final verdict SUITABLE
  const jacketItems = evaluatedItems.filter((i) => i.category === 'JACKET')
  const hasSuitableJacket = jacketItems.some((i) => i.verdict === 'SUITABLE')

  if (trip.temp_min_c <= 0 && !hasSuitableJacket) {
    gaps.push({
      ruleId: 'R27',
      category: 'JACKET',
      message: renderGeneralTemplate('R27', { t: trip.temp_min_c }),
    })
  }

  // 5. R28: rain_prob_pct >= 80 and at least one jacket with final verdict NOT_SUITABLE
  const hasNotSuitableJacket = jacketItems.some((i) => i.verdict === 'NOT_SUITABLE')

  if (trip.rain_prob_pct >= 80 && hasNotSuitableJacket) {
    gaps.push({
      ruleId: 'R28',
      category: 'JACKET',
      message: renderGeneralTemplate('R28', { rain: trip.rain_prob_pct }),
    })
  }

  // 6. Evaluate optional subject-bound requirement constraints without flat merge (S03-02)
  let subjectConstraintEvaluations: SubjectRequirementEvaluationResult[] | undefined
  if (options?.subjectConstraints && options.subjectConstraints.length > 0) {
    subjectConstraintEvaluations = options.subjectConstraints.map((binding) => {
      const targetItem = normalizedItems.find((it) => it.id === binding.subjectId)
      if (!targetItem) {
        throw new ConstraintValidationError(
          `Subject item '${binding.subjectId}' specified in requirement binding was not found in selected items.`,
        )
      }
      if (binding.category && targetItem.category !== binding.category) {
        throw new ConstraintValidationError(
          `Category mismatch for subject '${binding.subjectId}': item has category '${targetItem.category}', but binding specified '${binding.category}'.`,
        )
      }
      return evaluateSubjectRequirementConstraints(
        {
          id: targetItem.id,
          category: targetItem.category,
          attributes: targetItem.attributes,
        },
        binding.requirementId,
        binding.constraints,
      )
    })
  }

  // 7. Overall readiness isReady:
  // Must have at least one item, all selected items must be SUITABLE, and zero gaps.
  const allItemsSuitable = evaluatedItems.length > 0 && evaluatedItems.every((item) => item.verdict === 'SUITABLE')
  const hasNoGaps = gaps.length === 0
  const isReady = allItemsSuitable && hasNoGaps

  // 8. Core checklist (5 core categories) with S03-03 Gap Precedence:
  // Status projection prioritizes gap ('rent_suggested') even when items exist.
  const checklist: GearChecklistRow[] = CORE_GEAR_CATEGORIES.map((cat) => {
    const catItems = evaluatedItems.filter((i) => i.category === cat)
    const hasGap = gaps.some((g) => g.category === cat)

    if (catItems.length === 0) {
      return {
        category: cat,
        representativeItemId: null,
        verdict: null,
        status: hasGap ? 'rent_suggested' : 'missing',
        reasons: [],
        missingAttributes: [],
      }
    }

    // Tie-break: best item (SUITABLE before NOT_SUITABLE), then item ID ascending
    const sorted = [...catItems].sort((a, b) => {
      if (a.verdict === 'SUITABLE' && b.verdict !== 'SUITABLE') return -1
      if (a.verdict !== 'SUITABLE' && b.verdict === 'SUITABLE') return 1
      return a.itemId.localeCompare(b.itemId)
    })

    const representative = sorted[0]

    // S03-03: Gap priority overrides representative verdict
    const status: 'suitable' | 'not_suitable' | 'missing' | 'rent_suggested' = hasGap
      ? 'rent_suggested'
      : representative.verdict === 'SUITABLE'
        ? 'suitable'
        : 'not_suitable'

    return {
      category: cat,
      representativeItemId: representative.itemId,
      verdict: representative.verdict,
      status,
      reasons: representative.reasons,
      missingAttributes: representative.missingAttributes,
    }
  })

  return {
    isReady,
    items: evaluatedItems,
    gaps,
    checklist,
    subjectConstraintEvaluations,
    rentalSuggestions: [],
    aiAdvice: null,
  }
}
