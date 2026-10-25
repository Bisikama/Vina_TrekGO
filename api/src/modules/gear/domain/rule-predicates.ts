/**
 * AI Gear Advisor V3.1.5 — Rule Predicates & Metadata Definitions (Pure TypeScript)
 * Zero NestJS, Prisma, AI SDK, or I/O imports.
 * Exactly implements MASTER V3.1.5 Section D, D1, D2, and Section 7.1.
 */

import {
  GearCategory,
  GearRuleCategory,
  CoreGearCategory,
  GearCondition,
  isCoreGearCategory,
  isExtendedGearCategory,
} from './gear.types'

export interface TripContext {
  temp_min_c: number
  temp_max_c: number
  temp_min_night_c: number
  rain_prob_pct: number
  difficulty: number
  days: number
  terrain: string[]
}

export type PredicateOutcome = 'true' | 'false' | 'skip'

export interface RuleEvaluationTrace {
  ruleId: string
  category: GearRuleCategory
  outcome: PredicateOutcome
  contextApplies: boolean
  missingAttributes: string[]
  renderedReason?: string
}

export interface RuleDefinition {
  id: string
  category: GearRuleCategory
  itemDependencies: readonly string[]
  tripDependencies: readonly (keyof TripContext)[]
  templateVi: string
  contextApplies: (trip: TripContext) => boolean
  evaluate: (
    attributes: Record<string, unknown>,
    trip: TripContext,
  ) => {
    outcome: PredicateOutcome
    missingAttributes: string[]
    values?: Record<string, unknown>
  }
}

export class UnsupportedCoreCategoryError extends Error {
  readonly code = 'GEAR_CATEGORY_REQUIRES_PLAN'
  constructor(
    public readonly category: string,
    public readonly itemId?: string,
  ) {
    super(
      `Category '${category}' is an extended category and requires plan evaluation, not supported in core gear check.`,
    )
    this.name = 'UnsupportedCoreCategoryError'
  }
}

export class InvalidAttributeValueError extends Error {
  readonly code = 'INVALID_ATTRIBUTE_VALUE'
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'InvalidAttributeValueError'
  }
}

export interface CoreGearItemInput {
  id: string
  category: CoreGearCategory
  name?: string
  condition: string
  attributes: Record<string, unknown>
}

export const CORE_CATEGORY_ALLOWED_FIELDS: Record<CoreGearCategory, Record<string, 'number' | 'boolean'>> = {
  JACKET: {
    waterproof_mm: 'number',
    temp_rating_c: 'number',
    weight_g: 'number',
    windproof: 'boolean',
  },
  FOOTWEAR: {
    waterproof: 'boolean',
    ankle_support: 'boolean',
    grip_level: 'number',
    weight_g: 'number',
  },
  PANTS: {
    waterproof_mm: 'number',
    temp_rating_c: 'number',
    insulated: 'boolean',
  },
  BACKPACK: {
    capacity_l: 'number',
    rain_cover: 'boolean',
    waterproof: 'boolean',
    weight_g: 'number',
  },
  SLEEPING_BAG: {
    temp_rating_c: 'number',
    weight_g: 'number',
  },
}

/**
 * Validates and normalizes raw item input at the domain boundary.
 * Rejects extended categories with UnsupportedCoreCategoryError ('GEAR_CATEGORY_REQUIRES_PLAN').
 * Rejects malformed types (strings for numbers/booleans, NaN, Infinity) with InvalidAttributeValueError.
 * Preserves known 0 and known false.
 */
export function normalizeCoreGearItemInput(item: unknown): CoreGearItemInput {
  if (!item || typeof item !== 'object') {
    throw new InvalidAttributeValueError('item', 'Item must be a non-null object.')
  }

  const raw = item as Record<string, unknown>
  if (!raw.id || typeof raw.id !== 'string' || raw.id.trim() === '') {
    throw new InvalidAttributeValueError('id', 'Item id is mandatory and cannot be empty.')
  }
  const id = raw.id.trim()
  const categoryStr = typeof raw.category === 'string' ? raw.category.trim() : ''

  if (isExtendedGearCategory(categoryStr)) {
    throw new UnsupportedCoreCategoryError(categoryStr, id)
  }

  if (!isCoreGearCategory(categoryStr)) {
    throw new UnsupportedCoreCategoryError(categoryStr, id)
  }
  const category: CoreGearCategory = categoryStr

  if (
    !raw.condition ||
    typeof raw.condition !== 'string' ||
    !['new', 'good', 'worn', 'poor', 'NEW', 'GOOD', 'WORN', 'POOR'].includes(raw.condition.trim())
  ) {
    throw new InvalidAttributeValueError('condition', 'Valid condition (new, good, worn, poor) is mandatory.')
  }
  const condition = raw.condition.trim().toLowerCase()

  // B04-07: Explicit null, array or primitive attributes must be rejected with typed error.
  // Absent attributes (undefined) is tolerated as unknown attributes ({}).
  if (raw.attributes !== undefined) {
    if (raw.attributes === null || typeof raw.attributes !== 'object' || Array.isArray(raw.attributes)) {
      throw new InvalidAttributeValueError(
        'attributes',
        'attributes must be a valid object when provided; explicit null, array or primitive is not allowed.',
      )
    }
  }

  const rawAttrs = (raw.attributes ?? {}) as Record<string, unknown>

  const allowedFields = CORE_CATEGORY_ALLOWED_FIELDS[category]
  const normalizedAttrs: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(rawAttrs)) {
    const expectedType = allowedFields[key]
    if (!expectedType) {
      throw new InvalidAttributeValueError(key, `Field '${key}' is not allowed for core category '${category}'.`)
    }

    if (val === null || val === undefined) {
      normalizedAttrs[key] = null
      continue
    }

    if (expectedType === 'number') {
      if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
        const valRepr =
          typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
            ? String(val)
            : JSON.stringify(val)
        throw new InvalidAttributeValueError(
          key,
          `Field '${key}' must be a finite number, received '${typeof val}' (${valRepr}).`,
        )
      }
      if (key === 'waterproof_mm' || key === 'temp_rating_c' || key === 'weight_g' || key === 'capacity_l') {
        if (!Number.isInteger(val)) {
          throw new InvalidAttributeValueError(key, `Field '${key}' must be an integer, received ${val}.`)
        }
      }
      if (key === 'waterproof_mm' || key === 'weight_g' || key === 'capacity_l') {
        if (val < 0) {
          throw new InvalidAttributeValueError(key, `Field '${key}' must be non-negative, received ${val}.`)
        }
      }
      if (key === 'grip_level') {
        if (val < 1 || val > 5 || !Number.isInteger(val)) {
          throw new InvalidAttributeValueError(
            key,
            `Field 'grip_level' must be an integer between 1 and 5, received ${val}.`,
          )
        }
      }
      normalizedAttrs[key] = val
    } else if (expectedType === 'boolean') {
      if (typeof val !== 'boolean') {
        const valRepr =
          typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
            ? String(val)
            : JSON.stringify(val)
        throw new InvalidAttributeValueError(
          key,
          `Field '${key}' must be a boolean, received '${typeof val}' (${valRepr}).`,
        )
      }
      normalizedAttrs[key] = val
    }
  }

  return {
    id,
    category,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    condition,
    attributes: normalizedAttrs,
  }
}

export function isMissingValue(value: unknown): boolean {
  return value === null || value === undefined
}

export function getSafeNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val)) return val
  return null
}

function renderTemplate(template: string, values: Record<string, unknown>): string {
  let rendered = template
  for (const [key, val] of Object.entries(values)) {
    const strVal = typeof val === 'number' || typeof val === 'string' ? String(val) : val ? JSON.stringify(val) : ''
    rendered = rendered.split(`{${key}}`).join(strVal)
  }
  return rendered
}

export const CANONICAL_RULE_DEFINITIONS: Record<string, RuleDefinition> = {
  R01: {
    id: 'R01',
    category: 'JACKET',
    itemDependencies: ['waterproof_mm'],
    tripDependencies: ['rain_prob_pct'],
    templateVi: 'Mưa {rain}% cần áo chống nước ≥ 5000mm, áo bạn chỉ {wp}mm — nước sẽ ngấm khi đi lâu.',
    contextApplies: (trip) => trip.rain_prob_pct >= 60,
    evaluate: (attrs, trip) => {
      const wp = getSafeNumber(attrs.waterproof_mm)
      const rain = getSafeNumber(trip.rain_prob_pct)
      if (wp === null || rain === null) {
        return {
          outcome: 'skip',
          missingAttributes: wp === null ? ['waterproof_mm'] : [],
        }
      }
      const condition = rain >= 60 && wp < 5000
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { rain, wp },
      }
    },
  },

  R02: {
    id: 'R02',
    category: 'JACKET',
    itemDependencies: ['waterproof_mm'],
    tripDependencies: ['rain_prob_pct'],
    templateVi: 'Mưa vừa phải nhưng áo chỉ {wp}mm — nên mang thêm áo mưa dự phòng.',
    contextApplies: (trip) => trip.rain_prob_pct >= 30 && trip.rain_prob_pct < 60,
    evaluate: (attrs, trip) => {
      const wp = getSafeNumber(attrs.waterproof_mm)
      const rain = getSafeNumber(trip.rain_prob_pct)
      if (wp === null || rain === null) {
        return {
          outcome: 'skip',
          missingAttributes: wp === null ? ['waterproof_mm'] : [],
        }
      }
      const condition = rain >= 30 && rain < 60 && wp < 3000
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { wp },
      }
    },
  },

  R03: {
    id: 'R03',
    category: 'JACKET',
    itemDependencies: ['temp_rating_c'],
    tripDependencies: ['temp_min_c'],
    templateVi: 'Nhiệt độ thấp nhất {t}°C mà áo chỉ chịu được {r}°C — nguy cơ lạnh, đặc biệt khi dừng nghỉ.',
    contextApplies: (trip) => trip.temp_min_c <= 10,
    evaluate: (attrs, trip) => {
      const r = getSafeNumber(attrs.temp_rating_c)
      const t = getSafeNumber(trip.temp_min_c)
      if (r === null || t === null) {
        return {
          outcome: 'skip',
          missingAttributes: r === null ? ['temp_rating_c'] : [],
        }
      }
      const condition = t <= 10 && r > t
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { t, r },
      }
    },
  },

  R04: {
    id: 'R04',
    category: 'JACKET',
    itemDependencies: ['temp_rating_c'],
    tripDependencies: ['temp_min_c'],
    templateVi: 'Áo sát ngưỡng chịu lạnh — nên mặc thêm lớp giữa (fleece).',
    contextApplies: (trip) => trip.temp_min_c <= 15,
    evaluate: (attrs, trip) => {
      const r = getSafeNumber(attrs.temp_rating_c)
      const t = getSafeNumber(trip.temp_min_c)
      if (r === null || t === null) {
        return {
          outcome: 'skip',
          missingAttributes: r === null ? ['temp_rating_c'] : [],
        }
      }
      const condition = t <= 15 && r > t + 5
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: {},
      }
    },
  },

  R05: {
    id: 'R05',
    category: 'JACKET',
    itemDependencies: ['temp_rating_c', 'weight_g'],
    tripDependencies: ['temp_min_c'],
    templateVi: 'Trời nóng mà áo dày/nặng ({w}g) — mang theo sẽ thừa, cân nhắc để nhà.',
    contextApplies: (trip) => trip.temp_min_c >= 25,
    evaluate: (attrs, trip) => {
      const r = getSafeNumber(attrs.temp_rating_c)
      const w = getSafeNumber(attrs.weight_g)
      const t = getSafeNumber(trip.temp_min_c)
      if (r === null || w === null || t === null) {
        const missing: string[] = []
        if (r === null) missing.push('temp_rating_c')
        if (w === null) missing.push('weight_g')
        return { outcome: 'skip', missingAttributes: missing }
      }
      const condition = t >= 25 && r < 10 && w > 600
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { w },
      }
    },
  },

  R06: {
    id: 'R06',
    category: 'JACKET',
    itemDependencies: ['weight_g'],
    tripDependencies: ['difficulty'],
    templateVi: 'Đường khó mà áo nặng {w}g — tốn sức, nên chọn áo nhẹ hơn.',
    contextApplies: (trip) => trip.difficulty >= 4,
    evaluate: (attrs, trip) => {
      const w = getSafeNumber(attrs.weight_g)
      const d = getSafeNumber(trip.difficulty)
      if (w === null || d === null) {
        return {
          outcome: 'skip',
          missingAttributes: w === null ? ['weight_g'] : [],
        }
      }
      const condition = d >= 4 && w > 900
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { w },
      }
    },
  },

  R07: {
    id: 'R07',
    category: 'FOOTWEAR',
    itemDependencies: ['waterproof'],
    tripDependencies: ['rain_prob_pct'],
    templateVi: 'Mưa {rain}% mà giày không chống nước — chân ướt cả ngày rất dễ phồng rộp.',
    contextApplies: (trip) => trip.rain_prob_pct >= 60,
    evaluate: (attrs, trip) => {
      const wp = attrs.waterproof
      const rain = getSafeNumber(trip.rain_prob_pct)
      if (typeof wp !== 'boolean' || rain === null) {
        return {
          outcome: 'skip',
          missingAttributes: typeof wp !== 'boolean' ? ['waterproof'] : [],
        }
      }
      const condition = rain >= 60 && wp === false
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { rain },
      }
    },
  },

  R08: {
    id: 'R08',
    category: 'FOOTWEAR',
    itemDependencies: ['ankle_support'],
    tripDependencies: ['difficulty'],
    templateVi: 'Đường độ khó {d}/5 cần giày cổ cao bảo vệ mắt cá chân.',
    contextApplies: (trip) => trip.difficulty >= 4,
    evaluate: (attrs, trip) => {
      const ankle = attrs.ankle_support
      const d = getSafeNumber(trip.difficulty)
      if (typeof ankle !== 'boolean' || d === null) {
        return {
          outcome: 'skip',
          missingAttributes: typeof ankle !== 'boolean' ? ['ankle_support'] : [],
        }
      }
      const condition = d >= 4 && ankle === false
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { d },
      }
    },
  },

  R09: {
    id: 'R09',
    category: 'FOOTWEAR',
    itemDependencies: ['grip_level'],
    tripDependencies: ['terrain'],
    templateVi: 'Địa hình trơn/đá mà đế giày bám chỉ {g}/5 — đi chậm, cẩn thận.',
    contextApplies: (trip) => {
      if (!Array.isArray(trip.terrain)) return false
      return trip.terrain.some((t) => t.toLowerCase() === 'muddy' || t.toLowerCase() === 'rocky')
    },
    evaluate: (attrs, trip) => {
      const grip = getSafeNumber(attrs.grip_level)
      if (grip === null || !Array.isArray(trip.terrain)) {
        return {
          outcome: 'skip',
          missingAttributes: grip === null ? ['grip_level'] : [],
        }
      }
      const hasMuddyOrRocky = trip.terrain.some((t) => t.toLowerCase() === 'muddy' || t.toLowerCase() === 'rocky')
      const condition = hasMuddyOrRocky && grip < 3
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { g: grip },
      }
    },
  },

  R10: {
    id: 'R10',
    category: 'FOOTWEAR',
    itemDependencies: ['waterproof'],
    tripDependencies: ['days', 'rain_prob_pct'],
    templateVi: 'Đi {n} ngày, có mưa mà giày không chống nước — không khô kịp qua đêm.',
    contextApplies: (trip) => trip.days >= 3 && trip.rain_prob_pct >= 30,
    evaluate: (attrs, trip) => {
      const wp = attrs.waterproof
      const days = getSafeNumber(trip.days)
      const rain = getSafeNumber(trip.rain_prob_pct)
      if (typeof wp !== 'boolean' || days === null || rain === null) {
        return {
          outcome: 'skip',
          missingAttributes: typeof wp !== 'boolean' ? ['waterproof'] : [],
        }
      }
      const condition = days >= 3 && rain >= 30 && wp === false
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { n: days },
      }
    },
  },

  R11: {
    id: 'R11',
    category: 'FOOTWEAR',
    itemDependencies: ['grip_level'],
    tripDependencies: ['difficulty'],
    templateVi: 'Đường khó cần đế bám tốt hơn (hiện tại {g}/5).',
    contextApplies: (trip) => trip.difficulty >= 4,
    evaluate: (attrs, trip) => {
      const grip = getSafeNumber(attrs.grip_level)
      const d = getSafeNumber(trip.difficulty)
      if (grip === null || d === null) {
        return {
          outcome: 'skip',
          missingAttributes: grip === null ? ['grip_level'] : [],
        }
      }
      const condition = d >= 4 && grip < 3
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { g: grip },
      }
    },
  },

  R12: {
    id: 'R12',
    category: 'PANTS',
    itemDependencies: ['waterproof_mm'],
    tripDependencies: ['rain_prob_pct'],
    templateVi: 'Mưa {rain}% cần quần chống nước ≥ 3000mm (hiện {wp}mm).',
    contextApplies: (trip) => trip.rain_prob_pct >= 60,
    evaluate: (attrs, trip) => {
      const wp = getSafeNumber(attrs.waterproof_mm)
      const rain = getSafeNumber(trip.rain_prob_pct)
      if (wp === null || rain === null) {
        return {
          outcome: 'skip',
          missingAttributes: wp === null ? ['waterproof_mm'] : [],
        }
      }
      const condition = rain >= 60 && wp < 3000
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { rain, wp },
      }
    },
  },

  R13: {
    id: 'R13',
    category: 'PANTS',
    itemDependencies: ['temp_rating_c'],
    tripDependencies: ['temp_min_c'],
    templateVi: '{t}°C mà quần chỉ chịu được {r}°C — chân sẽ lạnh, nhất là khi nghỉ.',
    contextApplies: (trip) => trip.temp_min_c <= 10,
    evaluate: (attrs, trip) => {
      const r = getSafeNumber(attrs.temp_rating_c)
      const t = getSafeNumber(trip.temp_min_c)
      if (r === null || t === null) {
        return {
          outcome: 'skip',
          missingAttributes: r === null ? ['temp_rating_c'] : [],
        }
      }
      const condition = t <= 10 && r > t
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { t, r },
      }
    },
  },

  R14: {
    id: 'R14',
    category: 'PANTS',
    itemDependencies: ['insulated', 'temp_rating_c'],
    tripDependencies: ['temp_min_c'],
    templateVi: 'Trời lạnh mà quần không lót giữ ấm — nên mặc thêm quần giữ nhiệt bên trong.',
    contextApplies: (trip) => trip.temp_min_c <= 12,
    evaluate: (attrs, trip) => {
      const insulated = attrs.insulated
      const r = getSafeNumber(attrs.temp_rating_c)
      const t = getSafeNumber(trip.temp_min_c)
      if (typeof insulated !== 'boolean' || r === null || t === null) {
        const missing: string[] = []
        if (typeof insulated !== 'boolean') missing.push('insulated')
        if (r === null) missing.push('temp_rating_c')
        return { outcome: 'skip', missingAttributes: missing }
      }
      const condition = t <= 12 && insulated === false && r > 10
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: {},
      }
    },
  },

  R15: {
    id: 'R15',
    category: 'BACKPACK',
    itemDependencies: ['capacity_l'],
    tripDependencies: ['days'],
    templateVi: 'Đi 1 ngày cần tối thiểu ~15L (nước, áo mưa, đồ ăn) — balo {c}L quá nhỏ.',
    contextApplies: (trip) => trip.days === 1,
    evaluate: (attrs, trip) => {
      const c = getSafeNumber(attrs.capacity_l)
      const days = getSafeNumber(trip.days)
      if (c === null || days === null) {
        return {
          outcome: 'skip',
          missingAttributes: c === null ? ['capacity_l'] : [],
        }
      }
      const condition = days === 1 && c < 15
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { c },
      }
    },
  },

  R16: {
    id: 'R16',
    category: 'BACKPACK',
    itemDependencies: ['capacity_l'],
    tripDependencies: ['days'],
    templateVi: 'Đi {n} ngày cần tối thiểu ~35L — balo {c}L không đủ.',
    contextApplies: (trip) => trip.days >= 2 && trip.days <= 3,
    evaluate: (attrs, trip) => {
      const c = getSafeNumber(attrs.capacity_l)
      const days = getSafeNumber(trip.days)
      if (c === null || days === null) {
        return {
          outcome: 'skip',
          missingAttributes: c === null ? ['capacity_l'] : [],
        }
      }
      const condition = days >= 2 && days <= 3 && c < 35
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { n: days, c },
      }
    },
  },

  R17: {
    id: 'R17',
    category: 'BACKPACK',
    itemDependencies: ['capacity_l'],
    tripDependencies: ['days'],
    templateVi: 'Đi {n} ngày cần tối thiểu ~50L (có túi ngủ, lều) — balo {c}L không đủ.',
    contextApplies: (trip) => trip.days >= 4,
    evaluate: (attrs, trip) => {
      const c = getSafeNumber(attrs.capacity_l)
      const days = getSafeNumber(trip.days)
      if (c === null || days === null) {
        return {
          outcome: 'skip',
          missingAttributes: c === null ? ['capacity_l'] : [],
        }
      }
      const condition = days >= 4 && c < 50
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { n: days, c },
      }
    },
  },

  R18: {
    id: 'R18',
    category: 'BACKPACK',
    itemDependencies: ['rain_cover', 'waterproof'],
    tripDependencies: ['rain_prob_pct'],
    templateVi: 'Mưa {rain}% mà balo không chống nước/không có áo mưa balo — đồ bên trong ướt hết.',
    contextApplies: (trip) => trip.rain_prob_pct >= 50,
    evaluate: (attrs, trip) => {
      const rc = attrs.rain_cover
      const wp = attrs.waterproof
      const rain = getSafeNumber(trip.rain_prob_pct)
      const missing: string[] = []
      if (typeof rc !== 'boolean') missing.push('rain_cover')
      if (typeof wp !== 'boolean') missing.push('waterproof')
      if (missing.length > 0 || rain === null) {
        return { outcome: 'skip', missingAttributes: missing }
      }
      const condition = rain >= 50 && rc === false && wp === false
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { rain },
      }
    },
  },

  R19: {
    id: 'R19',
    category: 'BACKPACK',
    itemDependencies: ['capacity_l'],
    tripDependencies: ['days'],
    templateVi: 'Balo {c}L quá to so với chuyến {n} ngày — nặng và cồng kềnh không cần thiết.',
    contextApplies: () => true,
    evaluate: (attrs, trip) => {
      const c = getSafeNumber(attrs.capacity_l)
      const days = getSafeNumber(trip.days)
      if (c === null || days === null) {
        return {
          outcome: 'skip',
          missingAttributes: c === null ? ['capacity_l'] : [],
        }
      }
      const condition = c > days * 20 + 30
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { c, n: days },
      }
    },
  },

  R20: {
    id: 'R20',
    category: 'SLEEPING_BAG',
    itemDependencies: ['temp_rating_c'],
    tripDependencies: ['temp_min_night_c'],
    templateVi: 'Đêm lạnh nhất {t}°C mà túi ngủ chỉ chịu được {r}°C — nguy cơ mất ngủ vì lạnh.',
    contextApplies: () => true,
    evaluate: (attrs, trip) => {
      const r = getSafeNumber(attrs.temp_rating_c)
      const t = getSafeNumber(trip.temp_min_night_c)
      if (r === null || t === null) {
        return {
          outcome: 'skip',
          missingAttributes: r === null ? ['temp_rating_c'] : [],
        }
      }
      const condition = r > t + 3
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { t, r },
      }
    },
  },

  R21: {
    id: 'R21',
    category: 'SLEEPING_BAG',
    itemDependencies: ['temp_rating_c'],
    tripDependencies: ['temp_min_night_c'],
    templateVi: 'Túi ngủ sát ngưỡng — nên mang thêm lớp lót túi ngủ (liner).',
    contextApplies: () => true,
    evaluate: (attrs, trip) => {
      const r = getSafeNumber(attrs.temp_rating_c)
      const t = getSafeNumber(trip.temp_min_night_c)
      if (r === null || t === null) {
        return {
          outcome: 'skip',
          missingAttributes: r === null ? ['temp_rating_c'] : [],
        }
      }
      const condition = t < r && r <= t + 3
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: {},
      }
    },
  },

  R22: {
    id: 'R22',
    category: 'SLEEPING_BAG',
    itemDependencies: ['temp_rating_c'],
    tripDependencies: ['temp_min_night_c'],
    templateVi: 'Đêm nóng mà túi ngủ quá ấm — sẽ hầm, cân nhắc chỉ mang liner.',
    contextApplies: (trip) => trip.temp_min_night_c >= 22,
    evaluate: (attrs, trip) => {
      const r = getSafeNumber(attrs.temp_rating_c)
      const t = getSafeNumber(trip.temp_min_night_c)
      if (r === null || t === null) {
        return {
          outcome: 'skip',
          missingAttributes: r === null ? ['temp_rating_c'] : [],
        }
      }
      const condition = t >= 22 && r < 12
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: {},
      }
    },
  },

  R23: {
    id: 'R23',
    category: 'SLEEPING_BAG',
    itemDependencies: ['weight_g'],
    tripDependencies: ['days'],
    templateVi: 'Túi ngủ {w}g quá nặng cho chuyến {n} ngày phải vác bộ.',
    contextApplies: (trip) => trip.days >= 3,
    evaluate: (attrs, trip) => {
      const w = getSafeNumber(attrs.weight_g)
      const days = getSafeNumber(trip.days)
      if (w === null || days === null) {
        return {
          outcome: 'skip',
          missingAttributes: w === null ? ['weight_g'] : [],
        }
      }
      const condition = w > 2200 && days >= 3
      return {
        outcome: condition ? 'true' : 'false',
        missingAttributes: [],
        values: { w, n: days },
      }
    },
  },
}

export const GENERAL_RULE_TEMPLATES = {
  R24: 'Đồ đã xuống cấp — giảm một mức đánh giá so với thông số.',
  R25: 'Thiếu dữ liệu: {attributes} — bỏ qua các quy tắc cần thông số này.',
  R26: 'Thiếu {category} trong bộ đồ đã chọn — nên bổ sung hoặc thuê trước chuyến đi.',
  R27: 'Nhiệt độ thấp nhất {t}°C mà chưa có áo khoác được đánh giá PHÙ HỢP — nên thuê áo đủ ấm.',
  R28: 'Mưa {rain}% và có áo khoác KHÔNG NÊN — nên thuê áo mưa bộ hoặc áo chống nước cao.',
}

export function renderGeneralTemplate(
  ruleId: 'R24' | 'R25' | 'R26' | 'R27' | 'R28',
  params: Record<string, unknown>,
): string {
  const tpl = GENERAL_RULE_TEMPLATES[ruleId]
  return renderTemplate(tpl, params)
}

export function renderRuleReason(ruleId: string, values: Record<string, unknown>): string {
  const def = CANONICAL_RULE_DEFINITIONS[ruleId]
  if (!def) return ''
  return renderTemplate(def.templateVi, values)
}
