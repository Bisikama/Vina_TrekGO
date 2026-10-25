import { GearCategory, GearOptionObjective, CoreGearCategory, isCoreGearCategory } from './gear.types'
import { evaluateSubjectRequirementConstraints, RequirementConstraintInput } from './constraint-evaluator'
import { evaluateGearItem } from './pure-gear-engine'
import { TripContext } from './rule-predicates'

export interface PlannerNeed {
  requirementId: string
  category: GearCategory
  priority: 'REQUIRED' | 'OPTIONAL'
  quantity: number
  constraints: RequirementConstraintInput[]
  title?: string
}

export interface CandidateProduct {
  id: string
  name: string
  category: GearCategory
  dailyPrice: number
  rentalFee: number
  deposit: number
  availableCount: number
  weight_g: number | null
  attributes?: Record<string, unknown>
}

export interface OwnedAssignment {
  requirementId: string
  category: GearCategory
  itemId: string
  itemName: string
  weight_g: number | null
}

export interface RentalLine {
  requirementId: string
  category: GearCategory
  productId: string
  productName: string
  quantity: number
  dailyPrice: number
  rentalFee: number
  deposit: number
  weight_g: number | null
  availableCount: number
}

export interface PlannerOptionResult {
  id: string
  label: string
  objective: GearOptionObjective
  ownedAssignments: OwnedAssignment[]
  rentalLines: RentalLine[]
  summary: {
    totalRentalFee: number
    totalDeposit: number
    totalEstimatedUpfront: number
    totalKnownWeightG: number
    weightStatus: 'EXACT' | 'PARTIAL' | 'UNKNOWN'
    missingRequirements: string[]
    isComplete: boolean
    searchStatus: 'OPTIMAL_WITHIN_SEARCH_SCOPE' | 'BOUNDED_RECOMMENDATION' | 'INFEASIBLE'
    currency: 'VND'
    searchScope?: {
      nodesExplored: number
      nodeLimit: number
      hitNodeLimit: boolean
      hitAllocationLimit: boolean
    }
  }
}

export interface PlannerInput {
  ownedAssignments: OwnedAssignment[]
  uncoveredNeeds: PlannerNeed[]
  candidatesPerCategory: Map<string, CandidateProduct[]>
  budgetLimit?: number
  nodeLimit?: number
  tripContext?: TripContext
}

interface ProductAssignment {
  needId: string
  category: GearCategory
  product: CandidateProduct
  quantity: number
}

/**
 * Filter candidates for a specific need using strict canonical constraints.
 * A candidate MUST have technical profile attributes, pass evaluateSubjectRequirementConstraints,
 * and if tripContext is provided for Core categories, evaluate as SUITABLE against Trip predicates (e.g. R05, R06, R07).
 */
export function filterCandidatesForNeed(
  need: PlannerNeed,
  candidates: CandidateProduct[],
  tripContext?: TripContext,
): CandidateProduct[] {
  const valid: CandidateProduct[] = []

  for (const candidate of candidates) {
    if (candidate.category !== need.category) continue
    if (candidate.availableCount <= 0) continue

    const profileAttrs = candidate.attributes
    if (!profileAttrs || Object.keys(profileAttrs).length === 0) {
      // Missing technical profile / evidence -> CANNOT confirm as candidate
      continue
    }

    // 1. Explicit need constraints evaluation
    if (need.constraints && need.constraints.length > 0) {
      const evalRes = evaluateSubjectRequirementConstraints(
        {
          id: candidate.id,
          category: need.category,
          attributes: profileAttrs,
        },
        need.requirementId,
        need.constraints,
      )

      if (evalRes.status !== 'SATISFIED') {
        continue
      }
    }

    // 2. Canonical Trip Technical Predicates evaluation for Core Categories
    if (tripContext && isCoreGearCategory(candidate.category)) {
      try {
        const itemEval = evaluateGearItem(
          {
            id: candidate.id,
            category: candidate.category,
            condition: 'good',
            attributes: profileAttrs,
          },
          tripContext,
        )

        if (itemEval.verdict !== 'SUITABLE') {
          // Reject candidate if it triggers NOT_SUITABLE (e.g. R05 hot jacket, R06 heavy jacket, R25 missing applicable attrs)
          continue
        }
      } catch {
        continue
      }
    }

    valid.push(candidate)
  }

  return valid
}

/**
 * Pure combinatorial search planner for optimal gear options.
 * Solves multi-need multi-unit assignment without greedy dead-ends.
 */
export function solveDeterministicPlannerOption(
  input: PlannerInput,
  objective: 'MIN_RENTAL_FEE' | 'MIN_KNOWN_TOTAL_WEIGHT',
): PlannerOptionResult {
  const { ownedAssignments, uncoveredNeeds, candidatesPerCategory, budgetLimit } = input
  const nodeLimit = input.nodeLimit ?? 10000

  // 1. Pre-filter valid candidates for each need
  const needCandidates = new Map<string, CandidateProduct[]>()
  for (const need of uncoveredNeeds) {
    const rawCandidates = candidatesPerCategory.get(need.category) ?? []
    const validCandidates = filterCandidatesForNeed(need, rawCandidates, input.tripContext)

    // Sort valid candidates by primary objective for better branch-and-bound pruning
    if (objective === 'MIN_RENTAL_FEE') {
      validCandidates.sort((a, b) => {
        if (a.rentalFee !== b.rentalFee) return a.rentalFee - b.rentalFee
        const wA = a.weight_g ?? Infinity
        const wB = b.weight_g ?? Infinity
        if (wA !== wB) return wA - wB
        return a.id.localeCompare(b.id)
      })
    } else {
      validCandidates.sort((a, b) => {
        const aKnown = a.weight_g !== null
        const bKnown = b.weight_g !== null
        if (aKnown !== bKnown) return aKnown ? -1 : 1
        const wA = a.weight_g ?? Infinity
        const wB = b.weight_g ?? Infinity
        if (wA !== wB) return wA - wB
        if (a.rentalFee !== b.rentalFee) return a.rentalFee - b.rentalFee
        return a.id.localeCompare(b.id)
      })
    }

    needCandidates.set(need.requirementId, validCandidates)
  }

  // 2. State tracking for Combinatorial Search
  let nodesExplored = 0
  let hitNodeLimit = false
  let hitAllocationLimit = false

  // Order needs by MRV (Most Constrained Variable) to solve constrained needs first and avoid starvation
  const searchNeeds = [...uncoveredNeeds].sort((needA, needB) => {
    // 1. Priority: REQUIRED before OPTIONAL
    const pA = needA.priority === 'REQUIRED' ? 0 : 1
    const pB = needB.priority === 'REQUIRED' ? 0 : 1
    if (pA !== pB) return pA - pB

    // 2. MRV: ratio of available capacity to needed quantity
    const candsA = needCandidates.get(needA.requirementId) ?? []
    const candsB = needCandidates.get(needB.requirementId) ?? []
    const capA = candsA.reduce((sum, c) => sum + (c.availableCount ?? 0), 0)
    const capB = candsB.reduce((sum, c) => sum + (c.availableCount ?? 0), 0)
    const ratioA = capA / (needA.quantity ?? 1)
    const ratioB = capB / (needB.quantity ?? 1)
    if (ratioA !== ratioB) return ratioA - ratioB

    // 3. Smaller candidate list first
    if (candsA.length !== candsB.length) return candsA.length - candsB.length

    // 4. Deterministic tie-breaker
    return needA.requirementId.localeCompare(needB.requirementId)
  })

  interface BestSolution {
    assignments: ProductAssignment[]
    missingNeedIds: string[]
    totalFee: number
    totalKnownWeight: number
    unknownWeightCount: number
    fulfilledRequiredCount: number
    fulfilledOptionalCount: number
  }

  const state: {
    bestComplete: BestSolution | null
    bestPartial: BestSolution | null
  } = {
    bestComplete: null,
    bestPartial: null,
  }

  const currentCapacity = new Map<string, number>()
  for (const [_, list] of candidatesPerCategory) {
    for (const p of list) {
      currentCapacity.set(p.id, p.availableCount)
    }
  }

  const currentAssignments: ProductAssignment[] = []
  const currentMissingNeedIds: string[] = []

  function getCanonicalSignature(assignments: ProductAssignment[]): string {
    return [...assignments]
      .sort((x, y) => {
        const cmpNeed = x.needId.localeCompare(y.needId)
        if (cmpNeed !== 0) return cmpNeed
        return x.product.id.localeCompare(y.product.id)
      })
      .map((x) => `${x.needId}:${x.product.id}:${x.quantity}`)
      .join(';')
  }

  function isBetterSolution(
    a: BestSolution,
    b: BestSolution,
    obj: 'MIN_RENTAL_FEE' | 'MIN_KNOWN_TOTAL_WEIGHT',
  ): boolean {
    if (a.fulfilledRequiredCount !== b.fulfilledRequiredCount) {
      return a.fulfilledRequiredCount > b.fulfilledRequiredCount
    }
    if (obj === 'MIN_RENTAL_FEE') {
      if (a.totalFee !== b.totalFee) return a.totalFee < b.totalFee
      if (a.unknownWeightCount !== b.unknownWeightCount) return a.unknownWeightCount < b.unknownWeightCount
      if (a.totalKnownWeight !== b.totalKnownWeight) return a.totalKnownWeight < b.totalKnownWeight
      if (a.fulfilledOptionalCount !== b.fulfilledOptionalCount)
        return a.fulfilledOptionalCount > b.fulfilledOptionalCount
    } else {
      // MIN_KNOWN_TOTAL_WEIGHT: unknown weights must never beat known weights
      if (a.unknownWeightCount !== b.unknownWeightCount) return a.unknownWeightCount < b.unknownWeightCount
      if (a.totalKnownWeight !== b.totalKnownWeight) return a.totalKnownWeight < b.totalKnownWeight
      if (a.totalFee !== b.totalFee) return a.totalFee < b.totalFee
      if (a.fulfilledOptionalCount !== b.fulfilledOptionalCount)
        return a.fulfilledOptionalCount > b.fulfilledOptionalCount
    }
    // Deterministic canonical signature comparison
    const sigA = getCanonicalSignature(a.assignments)
    const sigB = getCanonicalSignature(b.assignments)
    return sigA.localeCompare(sigB) < 0
  }

  interface CandidateAllocation {
    product: CandidateProduct
    quantity: number
  }

  function getAllocationsForNeed(
    candidates: CandidateProduct[],
    capMap: Map<string, number>,
    neededQty: number,
    obj: 'MIN_RENTAL_FEE' | 'MIN_KNOWN_TOTAL_WEIGHT',
  ): CandidateAllocation[][] {
    const results: CandidateAllocation[][] = []
    const remainingBudget = Math.max(0, nodeLimit - nodesExplored)
    const maxAllocations = Math.max(100, Math.min(nodeLimit, remainingBudget))

    const sortedCandidates = [...candidates].sort((a, b) => {
      if (obj === 'MIN_RENTAL_FEE') {
        if (a.rentalFee !== b.rentalFee) return a.rentalFee - b.rentalFee
        const wA = a.weight_g ?? Infinity
        const wB = b.weight_g ?? Infinity
        if (wA !== wB) return wA - wB
      } else {
        const aKnown = a.weight_g !== null
        const bKnown = b.weight_g !== null
        if (aKnown !== bKnown) return aKnown ? -1 : 1
        const wA = a.weight_g ?? Infinity
        const wB = b.weight_g ?? Infinity
        if (wA !== wB) return wA - wB
        if (a.rentalFee !== b.rentalFee) return a.rentalFee - b.rentalFee
      }
      return a.id.localeCompare(b.id)
    })

    function backtrack(candIndex: number, remQty: number, currentAlloc: CandidateAllocation[]) {
      if (nodesExplored >= nodeLimit) {
        hitNodeLimit = true
        hitAllocationLimit = true
        return
      }
      if (results.length >= maxAllocations) {
        hitAllocationLimit = true
        return
      }
      if (remQty === 0) {
        nodesExplored++
        results.push([...currentAlloc])
        return
      }
      if (candIndex >= sortedCandidates.length) return

      const cand = sortedCandidates[candIndex]
      const cap = capMap.get(cand.id) ?? 0
      const maxTake = Math.min(cap, remQty)

      for (let take = maxTake; take >= 1; take--) {
        currentAlloc.push({ product: cand, quantity: take })
        backtrack(candIndex + 1, remQty - take, currentAlloc)
        currentAlloc.pop()
        if (results.length >= maxAllocations || nodesExplored >= nodeLimit) {
          hitAllocationLimit = true
          return
        }
      }

      backtrack(candIndex + 1, remQty, currentAlloc)
    }

    backtrack(0, neededQty, [])

    results.sort((allocA, allocB) => {
      const feeA = allocA.reduce((sum, item) => sum + item.product.rentalFee * item.quantity, 0)
      const feeB = allocB.reduce((sum, item) => sum + item.product.rentalFee * item.quantity, 0)
      const unkA = allocA.filter((item) => item.product.weight_g === null).reduce((sum, item) => sum + item.quantity, 0)
      const unkB = allocB.filter((item) => item.product.weight_g === null).reduce((sum, item) => sum + item.quantity, 0)
      const wA = allocA.reduce((sum, item) => sum + (item.product.weight_g ?? 0) * item.quantity, 0)
      const wB = allocB.reduce((sum, item) => sum + (item.product.weight_g ?? 0) * item.quantity, 0)

      if (obj === 'MIN_RENTAL_FEE') {
        if (feeA !== feeB) return feeA - feeB
        if (unkA !== unkB) return unkA - unkB
        if (wA !== wB) return wA - wB
      } else {
        if (unkA !== unkB) return unkA - unkB
        if (wA !== wB) return wA - wB
        if (feeA !== feeB) return feeA - feeB
      }
      return 0
    })

    return results
  }

  function search(needIndex: number, currentFee: number, currentKnownWeight: number, currentUnknownCount: number) {
    nodesExplored++
    if (nodesExplored >= nodeLimit) {
      hitNodeLimit = true
      return
    }

    // Prune if fee exceeds budgetLimit
    if (budgetLimit !== undefined && currentFee > budgetLimit) {
      return
    }

    // Prune if fee already strictly worse than best complete (or equal fee with equal/worse secondary metrics)
    if (objective === 'MIN_RENTAL_FEE' && state.bestComplete) {
      if (currentFee > state.bestComplete.totalFee) {
        return
      }
      if (
        currentFee === state.bestComplete.totalFee &&
        (currentUnknownCount > state.bestComplete.unknownWeightCount ||
          (currentUnknownCount === state.bestComplete.unknownWeightCount &&
            currentKnownWeight > state.bestComplete.totalKnownWeight))
      ) {
        return
      }
    }

    if (objective === 'MIN_KNOWN_TOTAL_WEIGHT' && state.bestComplete) {
      if (
        currentUnknownCount > state.bestComplete.unknownWeightCount ||
        (currentUnknownCount === state.bestComplete.unknownWeightCount &&
          currentKnownWeight > state.bestComplete.totalKnownWeight)
      ) {
        return
      }
      if (
        currentUnknownCount === state.bestComplete.unknownWeightCount &&
        currentKnownWeight === state.bestComplete.totalKnownWeight &&
        currentFee > state.bestComplete.totalFee
      ) {
        return
      }
    }

    if (needIndex >= searchNeeds.length) {
      // Reached leaf node
      const requiredNeeds = searchNeeds.filter((n) => n.priority === 'REQUIRED')
      const missingRequired = currentMissingNeedIds.filter((id) => requiredNeeds.some((n) => n.requirementId === id))
      const fulfilledRequired = requiredNeeds.length - missingRequired.length

      const optionalNeeds = searchNeeds.filter((n) => n.priority === 'OPTIONAL')
      const missingOptional = currentMissingNeedIds.filter((id) => optionalNeeds.some((n) => n.requirementId === id))
      const fulfilledOptional = optionalNeeds.length - missingOptional.length

      // Completeness: ALL REQUIRED needs must be met; missing optional items do NOT mark a plan as incomplete!
      const isComplete = missingRequired.length === 0
      const isWithinBudget = budgetLimit === undefined || currentFee <= budgetLimit

      const candidateSolution: BestSolution = {
        assignments: [...currentAssignments],
        missingNeedIds: [...currentMissingNeedIds],
        totalFee: currentFee,
        totalKnownWeight: currentKnownWeight,
        unknownWeightCount: currentUnknownCount,
        fulfilledRequiredCount: fulfilledRequired,
        fulfilledOptionalCount: fulfilledOptional,
      }

      if (isComplete && isWithinBudget) {
        if (!state.bestComplete || isBetterSolution(candidateSolution, state.bestComplete, objective)) {
          state.bestComplete = candidateSolution
        }
      } else {
        if (!state.bestPartial || isBetterSolution(candidateSolution, state.bestPartial, objective)) {
          state.bestPartial = candidateSolution
        }
      }
      return
    }

    const need = searchNeeds[needIndex]
    const candidates = needCandidates.get(need.requirementId) ?? []
    const neededQty = need.quantity ?? 1

    // Generate all valid integer allocations across available candidates for this need
    const allocations = getAllocationsForNeed(candidates, currentCapacity, neededQty, objective)

    for (const alloc of allocations) {
      // Apply allocation
      let allocFee = 0
      let allocKnownWeight = 0
      let allocUnknownCount = 0

      for (const item of alloc) {
        const p = item.product
        const q = item.quantity
        const cap = currentCapacity.get(p.id) ?? 0
        currentCapacity.set(p.id, cap - q)
        currentAssignments.push({
          needId: need.requirementId,
          category: need.category,
          product: p,
          quantity: q,
        })

        allocFee += p.rentalFee * q
        if (p.weight_g !== null) {
          allocKnownWeight += p.weight_g * q
        } else {
          allocUnknownCount += q
        }
      }

      search(
        needIndex + 1,
        currentFee + allocFee,
        currentKnownWeight + allocKnownWeight,
        currentUnknownCount + allocUnknownCount,
      )

      // Backtrack allocation
      for (const item of alloc) {
        currentAssignments.pop()
        const cap = currentCapacity.get(item.product.id) ?? 0
        currentCapacity.set(item.product.id, cap + item.quantity)
      }
    }

    // Branch: Leave this need unfulfilled (missing)
    currentMissingNeedIds.push(need.requirementId)
    search(needIndex + 1, currentFee, currentKnownWeight, currentUnknownCount)
    currentMissingNeedIds.pop()
  }

  // Run search
  search(0, 0, 0, 0)

  const chosen = state.bestComplete ?? state.bestPartial

  // 3. Format final option result
  const rawAssignments = chosen?.assignments ?? []
  const missingNeedIds = chosen?.missingNeedIds ?? uncoveredNeeds.map((n) => n.requirementId)

  // Group rental lines by product ID to avoid duplicate product lines
  const rentalLinesMap = new Map<string, RentalLine>()
  let totalRentalFee = 0
  let totalDeposit = 0
  let totalKnownWeightG = 0
  let hasKnownWeight = false
  let hasMissingWeight = false

  // Include owned items weight
  for (const owned of ownedAssignments) {
    if (owned.weight_g !== null) {
      totalKnownWeightG += owned.weight_g
      hasKnownWeight = true
    } else {
      hasMissingWeight = true
    }
  }

  for (const assign of rawAssignments) {
    const p = assign.product
    const qty = assign.quantity

    const existing = rentalLinesMap.get(p.id)
    if (existing) {
      existing.quantity += qty
      existing.rentalFee += p.rentalFee * qty
      existing.deposit += p.deposit * qty
    } else {
      rentalLinesMap.set(p.id, {
        requirementId: assign.needId,
        category: assign.category,
        productId: p.id,
        productName: p.name,
        quantity: qty,
        dailyPrice: p.dailyPrice,
        rentalFee: p.rentalFee * qty,
        deposit: p.deposit * qty,
        weight_g: p.weight_g,
        availableCount: p.availableCount,
      })
    }

    totalRentalFee += p.rentalFee * qty
    totalDeposit += p.deposit * qty

    if (p.weight_g !== null) {
      totalKnownWeightG += p.weight_g * qty
      hasKnownWeight = true
    } else {
      hasMissingWeight = true
    }
  }

  const rentalLines = Array.from(rentalLinesMap.values())
  const totalEstimatedUpfront = totalRentalFee + totalDeposit

  let weightStatus: 'EXACT' | 'PARTIAL' | 'UNKNOWN' = 'UNKNOWN'
  if (hasKnownWeight && !hasMissingWeight) {
    weightStatus = 'EXACT'
  } else if (hasKnownWeight) {
    weightStatus = 'PARTIAL'
  }

  // Budget & Completeness evaluation
  const requiredNeeds = uncoveredNeeds.filter((n) => n.priority === 'REQUIRED')
  const missingRequired = missingNeedIds.filter((id) => requiredNeeds.some((n) => n.requirementId === id))

  const isBudgetExceeded = budgetLimit !== undefined && totalRentalFee > budgetLimit
  const isZeroBudgetWithCost = budgetLimit === 0 && totalRentalFee > 0
  const isComplete =
    state.bestComplete !== null && missingRequired.length === 0 && !isBudgetExceeded && !isZeroBudgetWithCost

  let searchStatus: 'OPTIMAL_WITHIN_SEARCH_SCOPE' | 'BOUNDED_RECOMMENDATION' | 'INFEASIBLE'
  if (isComplete && !hitNodeLimit && !hitAllocationLimit) {
    if (objective === 'MIN_KNOWN_TOTAL_WEIGHT' && weightStatus !== 'EXACT') {
      // Cannot claim optimal weight when chosen solution contains unknown or partial weights!
      searchStatus = 'BOUNDED_RECOMMENDATION'
    } else {
      searchStatus = 'OPTIMAL_WITHIN_SEARCH_SCOPE'
    }
  } else if (!isComplete) {
    // If incomplete due to budgetLimit, it is a bounded recommendation
    if (budgetLimit !== undefined) {
      searchStatus = 'BOUNDED_RECOMMENDATION'
    } else {
      // Check if provably INFEASIBLE: a required need has zero valid candidates or insufficient total capacity
      const hasUnfulfillableRequiredNeed = requiredNeeds.some((need) => {
        const cands = needCandidates.get(need.requirementId) ?? []
        const totalCap = cands.reduce((sum, c) => sum + (c.availableCount ?? 0), 0)
        return totalCap < (need.quantity ?? 1)
      })

      if (hasUnfulfillableRequiredNeed && !hitNodeLimit && !hitAllocationLimit) {
        searchStatus = 'INFEASIBLE'
      } else {
        searchStatus = 'BOUNDED_RECOMMENDATION'
      }
    }
  } else {
    // Truncated by nodeLimit, allocation cap or budget
    searchStatus = 'BOUNDED_RECOMMENDATION'
  }

  const mappedObjective: GearOptionObjective = objective === 'MIN_RENTAL_FEE' ? 'ECONOMICAL' : 'LIGHTWEIGHT'

  const label =
    objective === 'MIN_RENTAL_FEE' ? 'Tối ưu chi phí thuê (Tiết kiệm nhất)' : 'Tối ưu trọng lượng trang bị (Siêu nhẹ)'

  const optId = objective === 'MIN_RENTAL_FEE' ? 'opt_min_fee' : 'opt_min_weight'

  return {
    id: optId,
    label,
    objective: mappedObjective,
    ownedAssignments,
    rentalLines,
    summary: {
      totalRentalFee,
      totalDeposit,
      totalEstimatedUpfront,
      totalKnownWeightG,
      weightStatus,
      missingRequirements: missingNeedIds,
      isComplete,
      searchStatus,
      currency: 'VND',
      searchScope: {
        nodesExplored,
        nodeLimit,
        hitNodeLimit,
        hitAllocationLimit,
      },
    },
  }
}
