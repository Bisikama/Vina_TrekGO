import { Prisma } from '@prisma/client'
import { AppError, TRIP_PRICING_ERROR_CODES as TP } from '../../../shared/errors'

export type CostCategory =
  | 'TRANSPORT'
  | 'STAFF'
  | 'FOOD'
  | 'ACCOMMODATION'
  | 'ACCESS'
  | 'SAFETY'
  | 'LOGISTICS'
  | 'OTHER'

export type CostKind = 'FIXED' | 'VARIABLE' | 'STEP'
export type CostBasis =
  | 'PER_TRIP'
  | 'PER_DAY'
  | 'PER_PERSON'
  | 'PER_PERSON_PER_DAY'
  | 'PER_CAPACITY_UNIT'
  | 'PER_GROUP_TIER'
export type StepOperation = 'ADDITIVE' | 'REPLACEMENT'

export interface StepTierInput {
  triggerMinPax: number
  triggerMaxPax: number
  operation: StepOperation
  amount: string
  note?: string | null
}

export interface CostItemInput {
  category: CostCategory
  name: string
  kind: CostKind
  basis: CostBasis
  unitPrice: string
  quantity: number
  durationUnits: number
  capacityPerUnit?: number | null
  extraNonPayingPax: number
  includedInPrice: boolean
  isEnabled: boolean
  sourceNote?: string | null
  stepTiers?: StepTierInput[]
}

export interface FeePolicyConfig {
  policyVersion: string
  platformFeeBps: number
  paymentFeeBps: number
  defaultContingencyBps: number
  defaultTargetMarginBps: number
  roundingStepVnd: string
}

export interface PricingCalcInput {
  maxPax: number
  targetPax: number
  targetMarginBps: number
  contingencyBps: number
  selectedPrice?: string | null
  selectedMinPax?: number | null
  items: CostItemInput[]
  feePolicy: FeePolicyConfig
}

export type ScenarioStatus = 'LOSS' | 'BREAK_EVEN' | 'PROFIT_BELOW_TARGET' | 'TARGET_MET'

export interface ScenarioRow {
  pax: number
  revenue: string
  fixedCost: string
  variableCost: string
  operatingCost: string
  contingencyCost: string
  totalCost: string
  feeAmount: string
  profit: string
  marginBps: number
  status: ScenarioStatus
  stepTriggered: boolean
  stepTriggers: string[]
}

export interface RiskInterval {
  minPax: number
  maxPax: number
  type: 'LOSS_IN_OPERATING_RANGE' | 'MARGIN_BELOW_TARGET_AFTER_STEP_COST'
  message: string
}

export interface PricingEvaluationResult {
  calcVersion: string
  feePolicy: FeePolicyConfig & { totalFeeBps: number }
  summary: {
    baseFixedCost: string
    unitVariableCost: string
    contingencyBps: number
    targetPax: number
    targetMarginBps: number
    evaluatedPrice: string
    suggestedPriceAtTargetPax: string
    firstBreakEvenPax: number | null
    firstTargetPax: number | null
    atTargetPax: ScenarioRow
  }
  riskIntervals: RiskInterval[]
  scenarios: ScenarioRow[]
  includedServices: string[]
  excludedServices: string[]
  generatedPriceExplanation: string
}

const BPS_DENOM = new Prisma.Decimal(10000)
const ZERO = new Prisma.Decimal(0)

function invalidPlan(message: string, details?: Record<string, unknown>): never {
  throw AppError.fromCode(TP.COST_PLAN_INVALID, { message, details })
}

export function validateCostItems(items: CostItemInput[], maxPax: number): void {
  if (maxPax <= 0 || !Number.isInteger(maxPax)) {
    throw AppError.fromCode(TP.PAX_INVALID, { message: 'maxPax phải là số nguyên dương.' })
  }

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    const path = `items[${idx}]`

    if (item.kind === 'FIXED' && !['PER_TRIP', 'PER_DAY'].includes(item.basis)) {
      invalidPlan(`Khoản chi FIXED chỉ hỗ trợ PER_TRIP hoặc PER_DAY (${item.name}).`, { field: path })
    }
    if (item.kind === 'VARIABLE' && !['PER_PERSON', 'PER_PERSON_PER_DAY'].includes(item.basis)) {
      invalidPlan(`Khoản chi VARIABLE chỉ hỗ trợ PER_PERSON hoặc PER_PERSON_PER_DAY (${item.name}).`, { field: path })
    }
    if (item.kind === 'STEP' && !['PER_CAPACITY_UNIT', 'PER_GROUP_TIER'].includes(item.basis)) {
      invalidPlan(`Khoản chi STEP chỉ hỗ trợ PER_CAPACITY_UNIT hoặc PER_CAPACITY_GROUP_TIER (${item.name}).`, {
        field: path,
      })
    }

    const unitPrice = new Prisma.Decimal(item.unitPrice)
    if (unitPrice.isNegative() || !unitPrice.isInteger()) {
      invalidPlan(`Đơn giá phải là số nguyên không âm (${item.name}).`, { field: `${path}.unitPrice` })
    }

    if (item.kind === 'STEP' && item.basis === 'PER_CAPACITY_UNIT') {
      if (!item.capacityPerUnit || !Number.isInteger(item.capacityPerUnit) || item.capacityPerUnit <= 0) {
        invalidPlan(`Khoản chi PER_CAPACITY_UNIT bắt buộc có capacityPerUnit > 0 (${item.name}).`, {
          field: `${path}.capacityPerUnit`,
        })
      }
      if (unitPrice.isZero() && item.includedInPrice && item.isEnabled) {
        invalidPlan(`Khoản chi PER_CAPACITY_UNIT trong giá vé phải có đơn giá > 0 (${item.name}).`, {
          field: `${path}.unitPrice`,
        })
      }
    }

    if (item.kind === 'STEP' && item.basis === 'PER_GROUP_TIER') {
      const tiers = item.stepTiers ?? []
      if (!tiers.length) {
        invalidPlan(`Khoản chi PER_GROUP_TIER bắt buộc khai báo ít nhất 1 bậc stepTiers (${item.name}).`, {
          field: `${path}.stepTiers`,
        })
      }
      const ops = new Set(tiers.map((t) => t.operation))
      if (ops.size > 1) {
        invalidPlan(`Các bậc của cùng một khoản chi phải cùng là ADDITIVE hoặc REPLACEMENT (${item.name}).`, {
          field: `${path}.stepTiers`,
        })
      }
      const sorted = [...tiers].sort((a, b) => a.triggerMinPax - b.triggerMinPax)
      for (let tIdx = 0; tIdx < sorted.length; tIdx++) {
        const tier = sorted[tIdx]
        if (
          tier.triggerMinPax < 1 ||
          tier.triggerMaxPax > maxPax ||
          tier.triggerMinPax > tier.triggerMaxPax
        ) {
          invalidPlan(
            `Bậc khách [${tier.triggerMinPax}..${tier.triggerMaxPax}] nằm ngoài phạm vi 1..${maxPax} (${item.name}).`,
            { field: `${path}.stepTiers[${tIdx}]` },
          )
        }
        const amt = new Prisma.Decimal(tier.amount)
        if (amt.isNegative() || !amt.isInteger()) {
          invalidPlan(`Số tiền bậc chi phí phải là số nguyên không âm (${item.name}).`, {
            field: `${path}.stepTiers[${tIdx}].amount`,
          })
        }
        if (tIdx > 0 && tier.triggerMinPax <= sorted[tIdx - 1].triggerMaxPax) {
          invalidPlan(`Các bậc khách trong ${item.name} bị chồng lấp.`, { field: `${path}.stepTiers` })
        }
      }

      if (sorted[0].operation === 'REPLACEMENT') {
        if (sorted[0].triggerMinPax !== 1 || sorted[sorted.length - 1].triggerMaxPax !== maxPax) {
          invalidPlan(
            `Bậc chi phí REPLACEMENT của "${item.name}" phải phủ kín từ 1 đến ${maxPax} khách để không bị hụt chi phí.`,
            { field: `${path}.stepTiers` },
          )
        }
        for (let tIdx = 1; tIdx < sorted.length; tIdx++) {
          if (sorted[tIdx].triggerMinPax !== sorted[tIdx - 1].triggerMaxPax + 1) {
            invalidPlan(
              `Bậc chi phí REPLACEMENT của "${item.name}" bị hổng ở khoảng khách ${sorted[tIdx - 1].triggerMaxPax + 1}.`,
              { field: `${path}.stepTiers` },
            )
          }
        }
      }
    }
  }

  const activeIncluded = items.filter((i) => i.includedInPrice && i.isEnabled)
  if (!activeIncluded.length) {
    invalidPlan('Cần ít nhất một khoản chi phí hợp lệ nằm trong giá vé (includedInPrice = true).')
  }
}

function evalItemAtPax(
  item: CostItemInput,
  pax: number,
): { fixedPart: Prisma.Decimal; variablePart: Prisma.Decimal } {
  if (!item.includedInPrice || !item.isEnabled) {
    return { fixedPart: ZERO, variablePart: ZERO }
  }

  const unitPrice = new Prisma.Decimal(item.unitPrice)
  const qty = new Prisma.Decimal(item.quantity)
  const dur = new Prisma.Decimal(item.durationUnits)
  const effectivePax = pax + item.extraNonPayingPax

  if (item.kind === 'FIXED') {
    if (item.basis === 'PER_TRIP') {
      return { fixedPart: unitPrice.mul(qty), variablePart: ZERO }
    }
    return { fixedPart: unitPrice.mul(qty).mul(dur), variablePart: ZERO }
  }

  if (item.kind === 'VARIABLE') {
    const perUnit = item.basis === 'PER_PERSON' ? unitPrice.mul(qty) : unitPrice.mul(qty).mul(dur)
    return {
      fixedPart: perUnit.mul(item.extraNonPayingPax),
      variablePart: perUnit.mul(pax),
    }
  }

  // STEP
  if (item.basis === 'PER_CAPACITY_UNIT') {
    const cap = item.capacityPerUnit!
    const units = Math.ceil(effectivePax / cap)
    return {
      fixedPart: unitPrice.mul(units).mul(qty).mul(dur),
      variablePart: ZERO,
    }
  }

  // PER_GROUP_TIER
  const tiers = item.stepTiers ?? []
  const op = tiers[0]?.operation ?? 'ADDITIVE'
  if (op === 'REPLACEMENT') {
    const matched = tiers.find((t) => pax >= t.triggerMinPax && pax <= t.triggerMaxPax)
    return {
      fixedPart: matched ? new Prisma.Decimal(matched.amount) : ZERO,
      variablePart: ZERO,
    }
  }

  // ADDITIVE
  let total = unitPrice.mul(qty)
  for (const tier of tiers) {
    if (pax >= tier.triggerMinPax && pax <= tier.triggerMaxPax) {
      total = total.add(new Prisma.Decimal(tier.amount))
    }
  }
  return { fixedPart: total, variablePart: ZERO }
}

function ceilToStep(value: Prisma.Decimal, step: Prisma.Decimal): Prisma.Decimal {
  if (value.lte(0)) return step
  const quotient = value.div(step)
  const ceiled = quotient.ceil()
  return ceiled.mul(step)
}

export function evaluateTripPricing(input: PricingCalcInput): PricingEvaluationResult {
  const { maxPax, targetPax, targetMarginBps, contingencyBps, items, feePolicy } = input

  if (!Number.isInteger(targetPax) || targetPax < 1 || targetPax > maxPax) {
    throw AppError.fromCode(TP.PAX_INVALID, {
      message: `targetPax (${targetPax}) phải nằm trong khoảng 1..${maxPax}.`,
    })
  }
  if (
    input.selectedMinPax !== undefined &&
    input.selectedMinPax !== null &&
    (!Number.isInteger(input.selectedMinPax) || input.selectedMinPax < 1 || input.selectedMinPax > maxPax)
  ) {
    throw AppError.fromCode(TP.PAX_INVALID, {
      message: `selectedMinPax (${input.selectedMinPax}) phải nằm trong khoảng 1..${maxPax}.`,
    })
  }
  if (contingencyBps < 0 || contingencyBps > 10000 || targetMarginBps < 0) {
    throw AppError.fromCode(TP.COST_PLAN_INVALID, {
      message: 'contingencyBps và targetMarginBps không được âm.',
    })
  }

  const totalFeeBps = feePolicy.platformFeeBps + feePolicy.paymentFeeBps
  if (totalFeeBps + targetMarginBps >= 10000) {
    throw AppError.fromCode(TP.IMPOSSIBLE, {
      details: { totalFeeBps, targetMarginBps },
    })
  }

  validateCostItems(items, maxPax)

  const roundingStep = new Prisma.Decimal(feePolicy.roundingStepVnd || '10000')
  const contingencyFactor = BPS_DENOM.add(contingencyBps).div(BPS_DENOM)

  // Compute costs at each N = 1..maxPax
  const costByPax: Array<{
    pax: number
    fixedCost: Prisma.Decimal
    variableCost: Prisma.Decimal
    operatingCost: Prisma.Decimal
    contingencyCost: Prisma.Decimal
    totalCost: Prisma.Decimal
    stepTriggers: string[]
  }> = []

  for (let n = 1; n <= maxPax; n++) {
    let fixedCost = ZERO
    let variableCost = ZERO
    const stepTriggers: string[] = []

    for (const item of items) {
      const { fixedPart, variablePart } = evalItemAtPax(item, n)
      fixedCost = fixedCost.add(fixedPart)
      variableCost = variableCost.add(variablePart)

      if (n > 1 && item.kind === 'STEP' && item.includedInPrice && item.isEnabled) {
        const prev = evalItemAtPax(item, n - 1)
        if (fixedPart.gt(prev.fixedPart)) {
          stepTriggers.push(item.name)
        }
      }
    }

    const operatingCost = fixedCost.add(variableCost)
    const totalCost = operatingCost.mul(contingencyFactor).round()
    const contingencyCost = totalCost.sub(operatingCost)

    costByPax.push({
      pax: n,
      fixedCost,
      variableCost,
      operatingCost,
      contingencyCost,
      totalCost,
      stepTriggers,
    })
  }

  // Calculate suggestedPrice at targetPax
  const targetCostRow = costByPax[targetPax - 1]
  const netShareBps = new Prisma.Decimal(10000 - totalFeeBps - targetMarginBps)
  const rawSuggested = targetCostRow.totalCost
    .mul(BPS_DENOM)
    .div(new Prisma.Decimal(targetPax).mul(netShareBps))
  const suggestedPriceDecimal = ceilToStep(rawSuggested, roundingStep)

  const evaluatedPriceDecimal =
    input.selectedPrice && new Prisma.Decimal(input.selectedPrice).gt(0)
      ? new Prisma.Decimal(input.selectedPrice)
      : suggestedPriceDecimal

  if (!evaluatedPriceDecimal.isInteger() || evaluatedPriceDecimal.lte(0)) {
    throw AppError.fromCode(TP.COST_PLAN_INVALID, {
      message: 'Giá vé đánh giá phải là số nguyên dương.',
    })
  }

  const scenarios: ScenarioRow[] = []
  let firstBreakEvenPax: number | null = null
  let firstTargetPax: number | null = null

  for (const row of costByPax) {
    const revenue = evaluatedPriceDecimal.mul(row.pax)
    const feeAmount = revenue.mul(totalFeeBps).div(BPS_DENOM).round()
    const profit = revenue.sub(feeAmount).sub(row.totalCost)
    const marginBps = revenue.gt(0) ? profit.mul(BPS_DENOM).div(revenue).floor().toNumber() : 0

    let status: ScenarioStatus
    if (profit.lt(0)) {
      status = 'LOSS'
    } else if (marginBps >= targetMarginBps) {
      status = 'TARGET_MET'
    } else if (profit.eq(0) || marginBps < 200) {
      status = 'BREAK_EVEN'
    } else {
      status = 'PROFIT_BELOW_TARGET'
    }

    if (firstBreakEvenPax === null && profit.gte(0)) {
      firstBreakEvenPax = row.pax
    }
    if (firstTargetPax === null && marginBps >= targetMarginBps) {
      firstTargetPax = row.pax
    }

    scenarios.push({
      pax: row.pax,
      revenue: revenue.toFixed(0),
      fixedCost: row.fixedCost.toFixed(0),
      variableCost: row.variableCost.toFixed(0),
      operatingCost: row.operatingCost.toFixed(0),
      contingencyCost: row.contingencyCost.toFixed(0),
      totalCost: row.totalCost.toFixed(0),
      feeAmount: feeAmount.toFixed(0),
      profit: profit.toFixed(0),
      marginBps,
      status,
      stepTriggered: row.stepTriggers.length > 0,
      stepTriggers: row.stepTriggers,
    })
  }

  // Detect risk intervals (loss after minPax/firstBreakEven, or margin below target after firstTargetPax due to step costs)
  const riskIntervals: RiskInterval[] = []
  const effectiveMinPax = input.selectedMinPax ?? firstBreakEvenPax ?? 1

  let lossStart: number | null = null
  for (let n = effectiveMinPax; n <= maxPax; n++) {
    const sc = scenarios[n - 1]
    const isLoss = new Prisma.Decimal(sc.profit).lt(0)
    if (isLoss && lossStart === null) {
      lossStart = n
    } else if (!isLoss && lossStart !== null) {
      riskIntervals.push({
        minPax: lossStart,
        maxPax: n - 1,
        type: 'LOSS_IN_OPERATING_RANGE',
        message: `Quy mô đoàn từ ${lossStart} đến ${n - 1} khách bị lỗ âm tại mức giá ${evaluatedPriceDecimal.toFixed(0)}đ/người.`,
      })
      lossStart = null
    }
  }
  if (lossStart !== null) {
    riskIntervals.push({
      minPax: lossStart,
      maxPax,
      type: 'LOSS_IN_OPERATING_RANGE',
      message: `Quy mô đoàn từ ${lossStart} đến ${maxPax} khách bị lỗ âm tại mức giá ${evaluatedPriceDecimal.toFixed(0)}đ/người.`,
    })
  }

  if (firstTargetPax !== null && firstTargetPax < maxPax) {
    let subTargetStart: number | null = null
    for (let n = firstTargetPax + 1; n <= maxPax; n++) {
      const sc = scenarios[n - 1]
      const belowTarget = sc.marginBps < targetMarginBps && new Prisma.Decimal(sc.profit).gte(0)
      if (belowTarget && subTargetStart === null) {
        subTargetStart = n
      } else if (!belowTarget && subTargetStart !== null) {
        riskIntervals.push({
          minPax: subTargetStart,
          maxPax: n - 1,
          type: 'MARGIN_BELOW_TARGET_AFTER_STEP_COST',
          message: `Quy mô đoàn từ ${subTargetStart} đến ${n - 1} khách không đạt biên lợi nhuận mục tiêu (${(targetMarginBps / 100).toFixed(0)}%) do phát sinh chi phí bậc.`,
        })
        subTargetStart = null
      }
    }
    if (subTargetStart !== null) {
      riskIntervals.push({
        minPax: subTargetStart,
        maxPax,
        type: 'MARGIN_BELOW_TARGET_AFTER_STEP_COST',
        message: `Quy mô đoàn từ ${subTargetStart} đến ${maxPax} khách không đạt biên lợi nhuận mục tiêu (${(targetMarginBps / 100).toFixed(0)}%) do phát sinh chi phí bậc.`,
      })
    }
  }

  // Base fixed cost (at N=1) and unit variable cost (for 1 person) for Simulator subtitle
  const baseFixedCost = costByPax[0].fixedCost
  let unitVariableCost = ZERO
  for (const item of items) {
    if (item.includedInPrice && item.isEnabled && item.kind === 'VARIABLE') {
      const u = new Prisma.Decimal(item.unitPrice).mul(item.quantity)
      unitVariableCost = unitVariableCost.add(item.basis === 'PER_PERSON_PER_DAY' ? u.mul(item.durationUnits) : u)
    }
  }

  const includedServices = items
    .filter((i) => i.includedInPrice && i.isEnabled)
    .map((i) => i.name.trim())
  const excludedServices = items
    .filter((i) => !i.includedInPrice && i.isEnabled)
    .map((i) => (i.sourceNote?.trim() ? `${i.name.trim()} (${i.sourceNote.trim()})` : i.name.trim()))

  const atTarget = scenarios[targetPax - 1]
  const generatedPriceExplanation = [
    `[CostPlan pricing-v1] Giá vé: ${evaluatedPriceDecimal.toFixed(0)} VND/khách`,
    `Khách mục tiêu: ${targetPax} (Tối thiểu: ${effectiveMinPax}, Tối đa: ${maxPax})`,
    `Chi phí vận hành tại ${targetPax} khách: ${atTarget.operatingCost} VND + Dự phòng ${(contingencyBps / 100).toFixed(1)}%: ${atTarget.contingencyCost} VND`,
    `Phí nền tảng & thanh toán (${(totalFeeBps / 100).toFixed(1)}%): ${atTarget.feeAmount} VND | Lợi nhuận dự kiến: ${atTarget.profit} VND (${(atTarget.marginBps / 100).toFixed(2)}%)`,
  ].join(' | ')

  return {
    calcVersion: 'pricing-v1',
    feePolicy: {
      ...feePolicy,
      totalFeeBps,
    },
    summary: {
      baseFixedCost: baseFixedCost.toFixed(0),
      unitVariableCost: unitVariableCost.toFixed(0),
      contingencyBps,
      targetPax,
      targetMarginBps,
      evaluatedPrice: evaluatedPriceDecimal.toFixed(0),
      suggestedPriceAtTargetPax: suggestedPriceDecimal.toFixed(0),
      firstBreakEvenPax,
      firstTargetPax,
      atTargetPax: atTarget,
    },
    riskIntervals,
    scenarios,
    includedServices,
    excludedServices,
    generatedPriceExplanation,
  }
}
