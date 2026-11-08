import type { GearCategory } from './gear.types'

/** Nhãn tiếng Việt dùng chung cho API attribute-schema, cảnh báo đánh giá và hướng dẫn. */
export const GEAR_CATEGORY_LABELS: Record<GearCategory, string> = {
  JACKET: 'Áo khoác',
  FOOTWEAR: 'Giày',
  PANTS: 'Quần',
  BACKPACK: 'Balo',
  SLEEPING_BAG: 'Túi ngủ',
  TENT: 'Lều',
  TREKKING_POLE: 'Gậy trekking',
  RAIN_GEAR: 'Đồ đi mưa',
}

export const GEAR_ATTRIBUTE_META: Record<string, { label: string; unit: string | null }> = {
  waterproof_mm: { label: 'Chống nước', unit: 'mm' },
  temp_rating_c: { label: 'Chịu lạnh', unit: '°C' },
  weight_g: { label: 'Trọng lượng', unit: 'g' },
  windproof: { label: 'Cản gió', unit: null },
  waterproof: { label: 'Chống nước', unit: null },
  ankle_support: { label: 'Hỗ trợ cổ chân', unit: null },
  grip_level: { label: 'Độ bám', unit: '/5' },
  insulated: { label: 'Giữ nhiệt', unit: null },
  capacity_l: { label: 'Dung tích', unit: 'L' },
  rain_cover: { label: 'Áo trùm mưa', unit: null },
  sleeping_places: { label: 'Sức chứa', unit: 'người' },
  flysheet_waterproof_mm: { label: 'Chống nước mái', unit: 'mm' },
  floor_waterproof_mm: { label: 'Chống nước đáy', unit: 'mm' },
  adjustable: { label: 'Điều chỉnh', unit: null },
  length_min_cm: { label: 'Dài tối thiểu', unit: 'cm' },
  length_max_cm: { label: 'Dài tối đa', unit: 'cm' },
  coverage: { label: 'Phạm vi che', unit: null },
}

export const GEAR_OPTION_LABELS: Record<string, Record<string, string>> = {
  coverage: { UPPER_BODY: 'Thân trên', FULL_BODY: 'Toàn thân' },
}

export function gearAttributeLabel(field: string): string {
  return GEAR_ATTRIBUTE_META[field]?.label ?? field
}

/** Giá trị kèm đơn vị: `5000 mm`, `-2°C`, `Có`, `Toàn thân`. */
export function formatGearAttributeValue(field: string, value: unknown): string {
  if (value === true) return 'Có'
  if (value === false) return 'Không'
  if (value === null || value === undefined || value === '') return 'chưa rõ'
  if (typeof value === 'string') return GEAR_OPTION_LABELS[field]?.[value] ?? value
  const text = typeof value === 'number' ? String(value) : JSON.stringify(value)
  const unit = GEAR_ATTRIBUTE_META[field]?.unit
  if (!unit) return text
  return unit.startsWith('°') || unit.startsWith('/') ? `${text}${unit}` : `${text} ${unit}`
}

type ConstraintLike = { field: string; op: 'GTE' | 'LTE' | 'EQ' | 'IN'; expected: unknown }

/** Tiêu chí ở dạng đọc được: `Chống nước tối thiểu 5000 mm`, `Chịu lạnh tới 5°C`, `Chống nước: Có`. */
export function describeGearConstraint(constraint: ConstraintLike): string {
  const label = gearAttributeLabel(constraint.field)
  const expected = formatGearAttributeValue(constraint.field, constraint.expected)
  if (constraint.op === 'GTE') return `${label} tối thiểu ${expected}`
  if (constraint.op === 'LTE') {
    return constraint.field === 'temp_rating_c' ? `${label} tới ${expected}` : `${label} tối đa ${expected}`
  }
  return `${label}: ${expected}`
}

/** Câu báo món đồ không đạt một tiêu chí, ví dụ `Chống nước 3000 mm – yêu cầu tối thiểu 5000 mm`. */
export function describeGearConstraintFailure(constraint: ConstraintLike, actual: unknown): string {
  const label = gearAttributeLabel(constraint.field)
  const value = formatGearAttributeValue(constraint.field, actual)
  const expected = formatGearAttributeValue(constraint.field, constraint.expected)
  if (constraint.op === 'GTE') return `${label} ${value} – yêu cầu tối thiểu ${expected}`
  if (constraint.op === 'LTE') {
    return constraint.field === 'temp_rating_c'
      ? `${label} ${value} – yêu cầu chịu được ${expected} trở xuống`
      : `${label} ${value} – yêu cầu tối đa ${expected}`
  }
  return `${label}: ${value} – yêu cầu ${expected}`
}

/**
 * Lý do của tiêu chí cho người dùng: bỏ mã quy tắc (`R01: `) và tên trường kỹ thuật trong ngoặc
 * (`(ankle_support)`, `(grip_level >= 3)`).
 */
export function humanizeConstraintRationale(rationale: string | undefined | null): string | null {
  if (!rationale) return null
  const text = rationale
    .replace(/^R\d+\s*:\s*/, '')
    .replace(/\s*\([a-z_]+(\s*[<>=]+\s*[\d.]+)?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text || null
}
