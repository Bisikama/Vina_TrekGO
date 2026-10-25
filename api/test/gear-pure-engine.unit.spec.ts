/**
 * AI Gear Advisor V3.1.5 — Pure Engine Unit Tests (Prompt 03 Final Fix)
 * Zero NestJS, Prisma, AI SDK, network, I/O, or system time.
 * Comprehensive coverage of S03-01 through S03-06 regressions, R1-R4 review fixes,
 * R01–R28 compound boundaries, per-rule false-one-variable, null and undefined dependencies,
 * per-subject constraint evaluation, and Phụ lục F fixtures.
 */

import {
  evaluateGearItem,
  evaluateGearCheck,
  TripContext,
  CoreGearItemInput,
  CoreGearCategory,
  GearCategory,
  UnsupportedCoreCategoryError,
  InvalidAttributeValueError,
  ConstraintValidationError,
  evaluateRequirementConstraint,
  evaluateSubjectRequirementConstraints,
  CANONICAL_RULE_DEFINITIONS,
  GENERAL_RULE_TEMPLATES,
  renderGeneralTemplate,
  renderRuleReason,
  isMissingValue,
  normalizeCoreGearItemInput,
} from '../src/modules/gear/domain'
import { solveDeterministicPlannerOption } from '../src/modules/gear/domain/pure-planner'

// Independent literal string constants for all 28 templates (MASTER V3.1.5)
const INDEPENDENT_28_TEMPLATES: Record<string, string> = {
  R01: 'Mưa {rain}% cần áo chống nước ≥ 5000mm, áo bạn chỉ {wp}mm — nước sẽ ngấm khi đi lâu.',
  R02: 'Mưa vừa phải nhưng áo chỉ {wp}mm — nên mang thêm áo mưa dự phòng.',
  R03: 'Nhiệt độ thấp nhất {t}°C mà áo chỉ chịu được {r}°C — nguy cơ lạnh, đặc biệt khi dừng nghỉ.',
  R04: 'Áo sát ngưỡng chịu lạnh — nên mặc thêm lớp giữa (fleece).',
  R05: 'Trời nóng mà áo dày/nặng ({w}g) — mang theo sẽ thừa, cân nhắc để nhà.',
  R06: 'Đường khó mà áo nặng {w}g — tốn sức, nên chọn áo nhẹ hơn.',
  R07: 'Mưa {rain}% mà giày không chống nước — chân ướt cả ngày rất dễ phồng rộp.',
  R08: 'Đường độ khó {d}/5 cần giày cổ cao bảo vệ mắt cá chân.',
  R09: 'Địa hình trơn/đá mà đế giày bám chỉ {g}/5 — đi chậm, cẩn thận.',
  R10: 'Đi {n} ngày, có mưa mà giày không chống nước — không khô kịp qua đêm.',
  R11: 'Đường khó cần đế bám tốt hơn (hiện tại {g}/5).',
  R12: 'Mưa {rain}% cần quần chống nước ≥ 3000mm (hiện {wp}mm).',
  R13: '{t}°C mà quần chỉ chịu được {r}°C — chân sẽ lạnh, nhất là khi nghỉ.',
  R14: 'Trời lạnh mà quần không lót giữ ấm — nên mặc thêm quần giữ nhiệt bên trong.',
  R15: 'Đi 1 ngày cần tối thiểu ~15L (nước, áo mưa, đồ ăn) — balo {c}L quá nhỏ.',
  R16: 'Đi {n} ngày cần tối thiểu ~35L — balo {c}L không đủ.',
  R17: 'Đi {n} ngày cần tối thiểu ~50L (có túi ngủ, lều) — balo {c}L không đủ.',
  R18: 'Mưa {rain}% mà balo không chống nước/không có áo mưa balo — đồ bên trong ướt hết.',
  R19: 'Balo {c}L quá to so với chuyến {n} ngày — nặng và cồng kềnh không cần thiết.',
  R20: 'Đêm lạnh nhất {t}°C mà túi ngủ chỉ chịu được {r}°C — nguy cơ mất ngủ vì lạnh.',
  R21: 'Túi ngủ sát ngưỡng — nên mang thêm lớp lót túi ngủ (liner).',
  R22: 'Đêm nóng mà túi ngủ quá ấm — sẽ hầm, cân nhắc chỉ mang liner.',
  R23: 'Túi ngủ {w}g quá nặng cho chuyến {n} ngày phải vác bộ.',
  R24: 'Đồ đã xuống cấp — giảm một mức đánh giá so với thông số.',
  R25: 'Thiếu dữ liệu: {attributes} — bỏ qua các quy tắc cần thông số này.',
  R26: 'Thiếu {category} trong bộ đồ đã chọn — nên bổ sung hoặc thuê trước chuyến đi.',
  R27: 'Nhiệt độ thấp nhất {t}°C mà chưa có áo khoác được đánh giá PHÙ HỢP — nên thuê áo đủ ấm.',
  R28: 'Mưa {rain}% và có áo khoác KHÔNG NÊN — nên thuê áo mưa bộ hoặc áo chống nước cao.',
}

describe('Gear Advisor V3.1.5 — Pure Engine & Constraint Evaluator (Prompt 03 Final Fix)', () => {
  const baseTrip: TripContext = {
    temp_min_c: 8,
    temp_max_c: 16,
    temp_min_night_c: 9,
    rain_prob_pct: 85,
    difficulty: 3,
    days: 2,
    terrain: ['muddy', 'rocky'],
  }

  // =========================================================================
  // S03-01 Regression: Extended Categories Rejected in Core Engine
  // =========================================================================
  describe('S03-01: Extended Categories Rejected at Core Boundary', () => {
    it('evaluateGearItem throws UnsupportedCoreCategoryError for TENT', () => {
      expect(() => {
        evaluateGearItem(
          {
            id: 'tent-1',
            category: 'TENT' as any,
            condition: 'good',
            attributes: {},
          },
          baseTrip,
        )
      }).toThrow(UnsupportedCoreCategoryError)
    })

    it('evaluateGearItem throws UnsupportedCoreCategoryError for TREKKING_POLE and RAIN_GEAR', () => {
      expect(() => {
        evaluateGearItem(
          {
            id: 'pole-1',
            category: 'TREKKING_POLE' as any,
            condition: 'good',
            attributes: {},
          },
          baseTrip,
        )
      }).toThrow(UnsupportedCoreCategoryError)

      expect(() => {
        evaluateGearItem(
          {
            id: 'rain-1',
            category: 'RAIN_GEAR' as any,
            condition: 'good',
            attributes: {},
          },
          baseTrip,
        )
      }).toThrow(UnsupportedCoreCategoryError)
    })

    it('evaluateGearCheck rejects good trio + extended category, cannot be silently ready', () => {
      const goodTrio: CoreGearItemInput[] = [
        {
          id: 'j1',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 10000, temp_rating_c: 5, weight_g: 400 },
        },
        {
          id: 'f1',
          category: 'FOOTWEAR',
          condition: 'good',
          attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 800 },
        },
        {
          id: 'b1',
          category: 'BACKPACK',
          condition: 'good',
          attributes: { capacity_l: 40, rain_cover: true, waterproof: true, weight_g: 1000 },
        },
      ]

      const withTent: any[] = [...goodTrio, { id: 'tent-1', category: 'TENT', condition: 'good', attributes: {} }]

      expect(() => {
        evaluateGearCheck(withTent, baseTrip)
      }).toThrow(UnsupportedCoreCategoryError)
    })
  })

  // =========================================================================
  // S03-02 Regression: Per-Subject Constraint Evaluation (No Flat Merge)
  // =========================================================================
  describe('S03-02: Per-Subject Constraint Evaluation Without Flat Merge', () => {
    it('evaluates two tents independently: neither satisfies both capacity and weight', () => {
      const tLow = {
        id: 't-low',
        category: 'TENT' as GearCategory,
        attributes: { sleeping_places: 1, weight_g: 1800 },
      }
      const tHigh = {
        id: 't-high',
        category: 'TENT' as GearCategory,
        attributes: { sleeping_places: 4, weight_g: 3500 },
      }

      const constraints = [
        {
          id: 'c-cap',
          field: 'sleeping_places',
          operator: 'GTE' as const,
          expected: 2,
          source: 'TRIP_OFFICIAL' as const,
          reference: 'Trip Bidoup requirement',
        },
        {
          id: 'c-wt',
          field: 'weight_g',
          operator: 'LTE' as const,
          expected: 2000,
          source: 'TRIP_OFFICIAL' as const,
          reference: 'Trip Bidoup requirement',
        },
      ]

      const resLow = evaluateSubjectRequirementConstraints(tLow, 'req-tent', constraints)
      expect(resLow.subjectId).toBe('t-low')
      expect(resLow.status).toBe('NOT_SATISFIED')
      expect(resLow.constraintResults.find((c) => c.field === 'sleeping_places')?.status).toBe('NOT_SATISFIED')
      expect(resLow.constraintResults.find((c) => c.field === 'weight_g')?.status).toBe('SATISFIED')

      const resHigh = evaluateSubjectRequirementConstraints(tHigh, 'req-tent', constraints)
      expect(resHigh.subjectId).toBe('t-high')
      expect(resHigh.status).toBe('NOT_SATISFIED')
      expect(resHigh.constraintResults.find((c) => c.field === 'sleeping_places')?.status).toBe('SATISFIED')
      expect(resHigh.constraintResults.find((c) => c.field === 'weight_g')?.status).toBe('NOT_SATISFIED')
    })

    it('order permutation does not alter per-subject evaluation results', () => {
      const tLow = {
        id: 't-low',
        category: 'TENT' as GearCategory,
        attributes: { sleeping_places: 1, weight_g: 1800 },
      }
      const tHigh = {
        id: 't-high',
        category: 'TENT' as GearCategory,
        attributes: { sleeping_places: 4, weight_g: 3500 },
      }

      const constraints = [
        {
          id: 'c-cap',
          field: 'sleeping_places',
          operator: 'GTE' as const,
          expected: 2,
          source: 'TRIP_OFFICIAL' as const,
          reference: 'Trip requirement',
        },
        {
          id: 'c-wt',
          field: 'weight_g',
          operator: 'LTE' as const,
          expected: 2000,
          source: 'TRIP_OFFICIAL' as const,
          reference: 'Trip requirement',
        },
      ]

      const eval1 = [
        evaluateSubjectRequirementConstraints(tLow, 'req-1', constraints),
        evaluateSubjectRequirementConstraints(tHigh, 'req-1', constraints),
      ]

      const eval2 = [
        evaluateSubjectRequirementConstraints(tHigh, 'req-1', constraints),
        evaluateSubjectRequirementConstraints(tLow, 'req-1', constraints),
      ]

      const eval1Low = eval1.find((e) => e.subjectId === 't-low')!
      const eval2Low = eval2.find((e) => e.subjectId === 't-low')!
      expect(eval1Low.status).toBe(eval2Low.status)

      const eval1High = eval1.find((e) => e.subjectId === 't-high')!
      const eval2High = eval2.find((e) => e.subjectId === 't-high')!
      expect(eval1High.status).toBe(eval2High.status)
    })
  })

  // =========================================================================
  // S03-03 Regression: Checklist Prioritizes Gap Precedence
  // =========================================================================
  describe('S03-03: Checklist Status Projection Prioritizes Gap Precedence', () => {
    it('sets status to rent_suggested when category has gap, even if a suitable item exists', () => {
      const tripRain85: TripContext = { ...baseTrip, rain_prob_pct: 85 }
      const items: CoreGearItemInput[] = [
        {
          id: 'j-good',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 10000, temp_rating_c: 5, weight_g: 400 },
        },
        {
          id: 'j-bad',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 2000, temp_rating_c: 5, weight_g: 400 },
        },
        {
          id: 'f1',
          category: 'FOOTWEAR',
          condition: 'good',
          attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 800 },
        },
        {
          id: 'b1',
          category: 'BACKPACK',
          condition: 'good',
          attributes: { capacity_l: 35, rain_cover: true, waterproof: true, weight_g: 900 },
        },
      ]

      const res = evaluateGearCheck(items, tripRain85)

      expect(res.gaps.some((g) => g.ruleId === 'R28')).toBe(true)

      const jacketChecklist = res.checklist.find((c) => c.category === 'JACKET')!
      expect(jacketChecklist.representativeItemId).toBe('j-good')
      expect(jacketChecklist.verdict).toBe('SUITABLE')
      expect(jacketChecklist.status).toBe('rent_suggested')
    })

    it('sets status to suitable when category has no gap and item is suitable', () => {
      const tripDry: TripContext = { ...baseTrip, rain_prob_pct: 20 }
      const items: CoreGearItemInput[] = [
        {
          id: 'j-good',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 10000, temp_rating_c: 5, weight_g: 400 },
        },
        {
          id: 'f1',
          category: 'FOOTWEAR',
          condition: 'good',
          attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 800 },
        },
        {
          id: 'b1',
          category: 'BACKPACK',
          condition: 'good',
          attributes: { capacity_l: 35, rain_cover: true, waterproof: true, weight_g: 900 },
        },
      ]

      const res = evaluateGearCheck(items, tripDry)
      const jacketChecklist = res.checklist.find((c) => c.category === 'JACKET')!
      expect(jacketChecklist.representativeItemId).toBe('j-good')
      expect(jacketChecklist.status).toBe('suitable')
    })
  })

  // =========================================================================
  // R1, R2, R3 Fixes: Typed Constraint Evaluator, Provenance & Schema Boundary
  // =========================================================================
  describe('R1: Mandatory Provenance Source & Reference (No Defaults)', () => {
    const subject = {
      id: 'tent-1',
      category: 'TENT' as GearCategory,
      attributes: { weight_g: 1800 },
    }

    it('rejects when constraint.source is missing (undefined)', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'weight_g',
            operator: 'LTE',
            expected: 2000,
            reference: 'Valid reference',
          },
          subject,
        )
      }).toThrow(ConstraintValidationError)
    })

    it('rejects when constraint.source is empty or whitespace', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'weight_g',
            operator: 'LTE',
            expected: 2000,
            source: '   ',
            reference: 'Valid reference',
          },
          subject,
        )
      }).toThrow(ConstraintValidationError)
    })

    it('rejects when constraint.source is an invalid source type', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'weight_g',
            operator: 'LTE',
            expected: 2000,
            source: 'INVALID_SOURCE',
            reference: 'Valid reference',
          },
          subject,
        )
      }).toThrow(ConstraintValidationError)
    })

    it('rejects when both reference and evidence are missing', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'weight_g',
            operator: 'LTE',
            expected: 2000,
            source: 'USER_REQUEST',
          },
          subject,
        )
      }).toThrow(ConstraintValidationError)
    })

    it('rejects when reference is empty or whitespace (and evidence missing)', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'weight_g',
            operator: 'LTE',
            expected: 2000,
            source: 'USER_REQUEST',
            reference: '   ',
          },
          subject,
        )
      }).toThrow(ConstraintValidationError)
    })

    it('accepts evidence as fallback for reference', () => {
      const res = evaluateRequirementConstraint(
        {
          id: 'c1',
          field: 'weight_g',
          operator: 'LTE',
          expected: 2000,
          source: 'USER_REQUEST',
          evidence: 'Evidence text from user',
        },
        subject,
      )
      expect(res.status).toBe('SATISFIED')
      expect(res.reference).toBe('Evidence text from user')
    })

    it('validates configuration and throws ConstraintValidationError before actual check even if attribute is missing', () => {
      const subjectMissing = {
        id: 'tent-2',
        category: 'TENT' as GearCategory,
        attributes: {}, // weight_g is missing
      }
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'weight_g',
            operator: 'LTE',
            expected: 2000,
            // source missing
            reference: 'Some reference',
          },
          subjectMissing,
        )
      }).toThrow(ConstraintValidationError)
    })
  })

  describe('R2: Category Matching and Subject Identity Verification', () => {
    it('rejects when constraint.category does not match subject.category', () => {
      const subjectTent = {
        id: 't-1',
        category: 'TENT' as GearCategory,
        attributes: { weight_g: 1800 },
      }
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            category: 'JACKET', // Mismatch: subject is TENT
            field: 'weight_g',
            operator: 'LTE',
            expected: 2000,
            source: 'TRIP_OFFICIAL',
            reference: 'Official ref',
          },
          subjectTent,
        )
      }).toThrow(ConstraintValidationError)
    })

    it('evaluateGearCheck subjectConstraints rejects when subjectId does not exist in items', () => {
      const items: CoreGearItemInput[] = [
        {
          id: 'j-1',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 5000, temp_rating_c: 5, weight_g: 400 },
        },
      ]
      expect(() => {
        evaluateGearCheck(items, baseTrip, {
          subjectConstraints: [
            {
              subjectId: 'non-existent-id',
              category: 'JACKET',
              requirementId: 'req-1',
              constraints: [
                {
                  id: 'c1',
                  field: 'waterproof_mm',
                  operator: 'GTE',
                  expected: 3000,
                  source: 'TRIP_OFFICIAL',
                  reference: 'Ref',
                },
              ],
            },
          ],
        })
      }).toThrow(ConstraintValidationError)
    })

    it('evaluateGearCheck subjectConstraints rejects when binding.category !== targetItem.category', () => {
      const items: CoreGearItemInput[] = [
        {
          id: 'j-1',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 5000, temp_rating_c: 5, weight_g: 400 },
        },
      ]
      expect(() => {
        evaluateGearCheck(items, baseTrip, {
          subjectConstraints: [
            {
              subjectId: 'j-1',
              category: 'FOOTWEAR', // Mismatch: item j-1 is JACKET
              requirementId: 'req-1',
              constraints: [
                {
                  id: 'c1',
                  field: 'weight_g',
                  operator: 'LTE',
                  expected: 800,
                  source: 'TRIP_OFFICIAL',
                  reference: 'Ref',
                },
              ],
            },
          ],
        })
      }).toThrow(ConstraintValidationError)
    })
  })

  describe('R3: Schema Boundary & Canonical Type Constraints', () => {
    it('rejects decimal expected value on integer fields (e.g. sleeping_places = 2.5)', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'sleeping_places',
            operator: 'GTE',
            expected: 2.5,
            source: 'TRIP_OFFICIAL',
            reference: 'Ref',
          },
          { id: 't1', category: 'TENT', attributes: { sleeping_places: 2 } },
        )
      }).toThrow(ConstraintValidationError)
    })

    it('rejects invalid coverage enum on expected (e.g. coverage = "MAGIC")', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'coverage',
            operator: 'EQ',
            expected: 'MAGIC',
            source: 'TRIP_OFFICIAL',
            reference: 'Ref',
          },
          { id: 'r1', category: 'RAIN_GEAR', attributes: { coverage: 'FULL_BODY' } },
        )
      }).toThrow(ConstraintValidationError)
    })

    it('rejects weight_g on PANTS (PANTS has no weight_g in canonical definitions)', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'weight_g',
            operator: 'LTE',
            expected: 500,
            source: 'TRIP_OFFICIAL',
            reference: 'Ref',
          },
          { id: 'p1', category: 'PANTS', attributes: { waterproof_mm: 5000 } },
        )
      }).toThrow(ConstraintValidationError)
    })

    it('evaluates to NOT_SATISFIED when actual on integer field is decimal (e.g. sleeping_places = 2.5)', () => {
      const res = evaluateRequirementConstraint(
        {
          id: 'c1',
          field: 'sleeping_places',
          operator: 'GTE',
          expected: 2,
          source: 'TRIP_OFFICIAL',
          reference: 'Ref',
        },
        { id: 't1', category: 'TENT', attributes: { sleeping_places: 2.5 } },
      )
      expect(res.status).toBe('NOT_SATISFIED')
    })

    it('evaluates to NOT_SATISFIED when actual on numeric field with min is negative (e.g. weight_g = -1)', () => {
      const res = evaluateRequirementConstraint(
        {
          id: 'c1',
          field: 'weight_g',
          operator: 'LTE',
          expected: 2000,
          source: 'TRIP_OFFICIAL',
          reference: 'Ref',
        },
        { id: 't1', category: 'TENT', attributes: { weight_g: -1 } },
      )
      expect(res.status).toBe('NOT_SATISFIED')
    })

    it('evaluates to NOT_SATISFIED when actual coverage is invalid (e.g. coverage = "MAGIC")', () => {
      const res = evaluateRequirementConstraint(
        {
          id: 'c1',
          field: 'coverage',
          operator: 'EQ',
          expected: 'FULL_BODY',
          source: 'TRIP_OFFICIAL',
          reference: 'Ref',
        },
        { id: 'r1', category: 'RAIN_GEAR', attributes: { coverage: 'MAGIC' } },
      )
      expect(res.status).toBe('NOT_SATISFIED')
    })

    it('evaluates to NOT_SATISFIED when TREKKING_POLE length_min_cm > length_max_cm', () => {
      const res = evaluateRequirementConstraint(
        {
          id: 'c1',
          field: 'length_min_cm',
          operator: 'GTE',
          expected: 100,
          source: 'TRIP_OFFICIAL',
          reference: 'Ref',
        },
        {
          id: 'pole1',
          category: 'TREKKING_POLE',
          attributes: { length_min_cm: 140, length_max_cm: 120 }, // Relational violation: min > max
        },
      )
      expect(res.status).toBe('NOT_SATISFIED')
    })

    it('normalizeCoreGearItemInput rejects missing or empty id', () => {
      expect(() => {
        normalizeCoreGearItemInput({
          id: '',
          category: 'JACKET',
          condition: 'good',
          attributes: {},
        })
      }).toThrow(InvalidAttributeValueError)

      expect(() => {
        normalizeCoreGearItemInput({
          category: 'JACKET',
          condition: 'good',
          attributes: {},
        })
      }).toThrow(InvalidAttributeValueError)
    })

    it('normalizeCoreGearItemInput rejects missing or invalid condition', () => {
      expect(() => {
        normalizeCoreGearItemInput({
          id: 'j1',
          category: 'JACKET',
          condition: 'broken', // invalid condition
          attributes: {},
        })
      }).toThrow(InvalidAttributeValueError)

      expect(() => {
        normalizeCoreGearItemInput({
          id: 'j1',
          category: 'JACKET',
          attributes: {},
        })
      }).toThrow(InvalidAttributeValueError)
    })

    it('normalizeCoreGearItemInput rejects decimal values on integer attributes', () => {
      expect(() => {
        normalizeCoreGearItemInput({
          id: 'j1',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 5000.5 },
        })
      }).toThrow(InvalidAttributeValueError)

      expect(() => {
        normalizeCoreGearItemInput({
          id: 'j1',
          category: 'JACKET',
          condition: 'good',
          attributes: { temp_rating_c: 12.3 },
        })
      }).toThrow(InvalidAttributeValueError)

      expect(() => {
        normalizeCoreGearItemInput({
          id: 'j1',
          category: 'JACKET',
          condition: 'good',
          attributes: { weight_g: 450.5 },
        })
      }).toThrow(InvalidAttributeValueError)

      expect(() => {
        normalizeCoreGearItemInput({
          id: 'b1',
          category: 'BACKPACK',
          condition: 'good',
          attributes: { capacity_l: 35.5 },
        })
      }).toThrow(InvalidAttributeValueError)
    })
  })

  // =========================================================================
  // S03-06 Exhaustive Table-Driven Tests for R01–R23 Predicates & Boundaries
  // =========================================================================
  describe('S03-06: R01–R23 True, False-One-Variable, and Compound Boundaries', () => {
    // R01 & R02
    it('R01 & R02 boundaries', () => {
      const makeJacket = (wp: number) => ({
        id: 'j',
        category: 'JACKET' as const,
        condition: 'good',
        attributes: { waterproof_mm: wp, temp_rating_c: 5, weight_g: 500 },
      })

      // R01: rain >= 60 && wp < 5000
      expect(evaluateGearItem(makeJacket(4999), { ...baseTrip, rain_prob_pct: 60 }).verdict).toBe('NOT_SUITABLE')
      expect(evaluateGearItem(makeJacket(5000), { ...baseTrip, rain_prob_pct: 60 }).verdict).toBe('SUITABLE')

      // R02: rain >= 30 && rain < 60 && wp < 3000
      expect(evaluateGearItem(makeJacket(2999), { ...baseTrip, rain_prob_pct: 59 }).verdict).toBe('NOT_SUITABLE')
      expect(evaluateGearItem(makeJacket(3000), { ...baseTrip, rain_prob_pct: 59 }).verdict).toBe('SUITABLE')
      expect(evaluateGearItem(makeJacket(2999), { ...baseTrip, rain_prob_pct: 30 }).verdict).toBe('NOT_SUITABLE')
      expect(evaluateGearItem(makeJacket(2000), { ...baseTrip, rain_prob_pct: 29 }).verdict).toBe('SUITABLE')
    })

    // R03 & R04
    it('R03 & R04 temp boundaries', () => {
      const makeJacket = (rating: number) => ({
        id: 'j',
        category: 'JACKET' as const,
        condition: 'good',
        attributes: { waterproof_mm: 10000, temp_rating_c: rating, weight_g: 500 },
      })

      // R03: temp_min <= 10 && rating > temp_min
      const trip10 = { ...baseTrip, temp_min_c: 10, rain_prob_pct: 0 }
      expect(evaluateGearItem(makeJacket(11), trip10).verdict).toBe('NOT_SUITABLE')
      expect(evaluateGearItem(makeJacket(10), trip10).verdict).toBe('SUITABLE')

      // R04: temp_min <= 15 && rating > temp_min + 5
      const trip12 = { ...baseTrip, temp_min_c: 12, rain_prob_pct: 0 }
      expect(evaluateGearItem(makeJacket(18), trip12).verdict).toBe('NOT_SUITABLE') // 18 > 12+5=17
      expect(evaluateGearItem(makeJacket(17), trip12).verdict).toBe('SUITABLE')
    })

    // R05 & R06
    it('R05 & R06 warm weather and difficulty boundaries', () => {
      const tripWarm = { ...baseTrip, temp_min_c: 25, rain_prob_pct: 0 }
      const jacketR05True: CoreGearItemInput = {
        id: 'j',
        category: 'JACKET',
        condition: 'good',
        attributes: { waterproof_mm: 10000, temp_rating_c: 9, weight_g: 601 },
      }
      expect(evaluateGearItem(jacketR05True, tripWarm).verdict).toBe('NOT_SUITABLE')

      const jacketR05FalseRating: CoreGearItemInput = {
        ...jacketR05True,
        attributes: { waterproof_mm: 10000, temp_rating_c: 10, weight_g: 601 },
      }
      expect(evaluateGearItem(jacketR05FalseRating, tripWarm).verdict).toBe('SUITABLE')

      const jacketR05FalseWeight: CoreGearItemInput = {
        ...jacketR05True,
        attributes: { waterproof_mm: 10000, temp_rating_c: 9, weight_g: 600 },
      }
      expect(evaluateGearItem(jacketR05FalseWeight, tripWarm).verdict).toBe('SUITABLE')

      const tripHard = { ...baseTrip, difficulty: 4, rain_prob_pct: 0 }
      const jacketR06True: CoreGearItemInput = {
        id: 'j',
        category: 'JACKET',
        condition: 'good',
        attributes: { waterproof_mm: 10000, temp_rating_c: 5, weight_g: 901 },
      }
      expect(evaluateGearItem(jacketR06True, tripHard).verdict).toBe('NOT_SUITABLE')

      const jacketR06FalseWeight: CoreGearItemInput = {
        ...jacketR06True,
        attributes: { waterproof_mm: 10000, temp_rating_c: 5, weight_g: 900 },
      }
      expect(evaluateGearItem(jacketR06FalseWeight, tripHard).verdict).toBe('SUITABLE')
    })

    // R07–R11 (FOOTWEAR)
    it('R07–R11 Footwear boundaries', () => {
      const tripRain = { ...baseTrip, rain_prob_pct: 60 }
      const fwR07True: CoreGearItemInput = {
        id: 'f',
        category: 'FOOTWEAR',
        condition: 'good',
        attributes: { waterproof: false, ankle_support: true, grip_level: 4, weight_g: 800 },
      }
      expect(evaluateGearItem(fwR07True, tripRain).verdict).toBe('NOT_SUITABLE')

      const fwR07False: CoreGearItemInput = {
        ...fwR07True,
        attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 800 },
      }
      expect(evaluateGearItem(fwR07False, tripRain).verdict).toBe('SUITABLE')

      const tripDiff4 = { ...baseTrip, difficulty: 4, rain_prob_pct: 0 }
      const fwR08True: CoreGearItemInput = {
        id: 'f',
        category: 'FOOTWEAR',
        condition: 'good',
        attributes: { waterproof: true, ankle_support: false, grip_level: 4, weight_g: 800 },
      }
      expect(evaluateGearItem(fwR08True, tripDiff4).verdict).toBe('NOT_SUITABLE')

      const tripMuddy = { ...baseTrip, terrain: ['muddy'], rain_prob_pct: 0, difficulty: 2 }
      const fwR09True: CoreGearItemInput = {
        id: 'f',
        category: 'FOOTWEAR',
        condition: 'good',
        attributes: { waterproof: true, ankle_support: true, grip_level: 2, weight_g: 800 },
      }
      expect(evaluateGearItem(fwR09True, tripMuddy).verdict).toBe('NOT_SUITABLE')

      const fwR09False: CoreGearItemInput = {
        ...fwR09True,
        attributes: { waterproof: true, ankle_support: true, grip_level: 3, weight_g: 800 },
      }
      expect(evaluateGearItem(fwR09False, tripMuddy).verdict).toBe('SUITABLE')

      const tripDays3 = { ...baseTrip, days: 3, rain_prob_pct: 30 }
      expect(evaluateGearItem(fwR07True, tripDays3).verdict).toBe('NOT_SUITABLE')

      expect(evaluateGearItem(fwR09True, tripDiff4).verdict).toBe('NOT_SUITABLE')
    })

    // R12–R14 (PANTS)
    it('R12–R14 Pants boundaries', () => {
      const tripRain = { ...baseTrip, rain_prob_pct: 60 }
      const pantsR12True: CoreGearItemInput = {
        id: 'p',
        category: 'PANTS',
        condition: 'good',
        attributes: { waterproof_mm: 2999, temp_rating_c: 5, insulated: true },
      }
      expect(evaluateGearItem(pantsR12True, tripRain).verdict).toBe('NOT_SUITABLE')

      const pantsR12False: CoreGearItemInput = {
        ...pantsR12True,
        attributes: { waterproof_mm: 3000, temp_rating_c: 5, insulated: true },
      }
      expect(evaluateGearItem(pantsR12False, tripRain).verdict).toBe('SUITABLE')

      const trip10 = { ...baseTrip, temp_min_c: 10, rain_prob_pct: 0 }
      const pantsR13True: CoreGearItemInput = {
        id: 'p',
        category: 'PANTS',
        condition: 'good',
        attributes: { waterproof_mm: 5000, temp_rating_c: 11, insulated: true },
      }
      expect(evaluateGearItem(pantsR13True, trip10).verdict).toBe('NOT_SUITABLE')

      const trip12 = { ...baseTrip, temp_min_c: 12, rain_prob_pct: 0 }
      const pantsR14True: CoreGearItemInput = {
        id: 'p',
        category: 'PANTS',
        condition: 'good',
        attributes: { waterproof_mm: 5000, temp_rating_c: 11, insulated: false },
      }
      expect(evaluateGearItem(pantsR14True, trip12).verdict).toBe('NOT_SUITABLE')

      const pantsR14FalseInsulated: CoreGearItemInput = {
        ...pantsR14True,
        attributes: { waterproof_mm: 5000, temp_rating_c: 11, insulated: true },
      }
      expect(evaluateGearItem(pantsR14FalseInsulated, trip12).verdict).toBe('SUITABLE')
    })

    // R15–R19 (BACKPACK)
    it('R15–R19 Backpack boundaries', () => {
      const trip1Day = { ...baseTrip, days: 1, rain_prob_pct: 0 }
      const bpR15True: CoreGearItemInput = {
        id: 'b',
        category: 'BACKPACK',
        condition: 'good',
        attributes: { capacity_l: 14, rain_cover: true, waterproof: true, weight_g: 500 },
      }
      expect(evaluateGearItem(bpR15True, trip1Day).verdict).toBe('NOT_SUITABLE')

      const trip2Days = { ...baseTrip, days: 2, rain_prob_pct: 0 }
      const bpR16True: CoreGearItemInput = {
        id: 'b',
        category: 'BACKPACK',
        condition: 'good',
        attributes: { capacity_l: 34, rain_cover: true, waterproof: true, weight_g: 500 },
      }
      expect(evaluateGearItem(bpR16True, trip2Days).verdict).toBe('NOT_SUITABLE')

      const trip4Days = { ...baseTrip, days: 4, rain_prob_pct: 0 }
      const bpR17True: CoreGearItemInput = {
        id: 'b',
        category: 'BACKPACK',
        condition: 'good',
        attributes: { capacity_l: 49, rain_cover: true, waterproof: true, weight_g: 500 },
      }
      expect(evaluateGearItem(bpR17True, trip4Days).verdict).toBe('NOT_SUITABLE')

      const tripRain50 = { ...baseTrip, rain_prob_pct: 50 }
      const bpR18True: CoreGearItemInput = {
        id: 'b',
        category: 'BACKPACK',
        condition: 'good',
        attributes: { capacity_l: 40, rain_cover: false, waterproof: false, weight_g: 500 },
      }
      expect(evaluateGearItem(bpR18True, tripRain50).verdict).toBe('NOT_SUITABLE')

      const bpR19True: CoreGearItemInput = {
        id: 'b',
        category: 'BACKPACK',
        condition: 'good',
        attributes: { capacity_l: 71, rain_cover: true, waterproof: true, weight_g: 500 }, // 71 > 2*20+30=70
      }
      expect(evaluateGearItem(bpR19True, trip2Days).verdict).toBe('NOT_SUITABLE')
    })

    // R20–R23 (SLEEPING_BAG)
    it('R20–R23 Sleeping Bag boundaries', () => {
      const tripNight9 = { ...baseTrip, temp_min_night_c: 9 }
      const sbR20True: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 13, weight_g: 1000 }, // 13 > 9+3=12
      }
      expect(evaluateGearItem(sbR20True, tripNight9).verdict).toBe('NOT_SUITABLE')

      const sbR20False: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 8, weight_g: 1000 }, // 8 <= 9 -> neither R20 nor R21 triggers
      }
      expect(evaluateGearItem(sbR20False, tripNight9).verdict).toBe('SUITABLE')

      const tripWarmNight = { ...baseTrip, temp_min_night_c: 23 }
      const sbR22True: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 10, weight_g: 1000 },
      }
      expect(evaluateGearItem(sbR22True, tripWarmNight).verdict).toBe('NOT_SUITABLE')

      const sbR22False: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 15, weight_g: 1000 },
      }
      expect(evaluateGearItem(sbR22False, tripWarmNight).verdict).toBe('SUITABLE')

      const tripDays3 = { ...baseTrip, days: 3 }
      const sbR23True: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 5, weight_g: 2201 },
      }
      expect(evaluateGearItem(sbR23True, tripDays3).verdict).toBe('NOT_SUITABLE')

      const sbR23False: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 5, weight_g: 2200 },
      }
      expect(evaluateGearItem(sbR23False, tripDays3).verdict).toBe('SUITABLE')
    })

    // R24: Condition poor invariant across verdicts and conditions
    it('R24 condition poor overrides SUITABLE verdict to NOT_SUITABLE with R24 reason', () => {
      const perfectJacket: CoreGearItemInput = {
        id: 'j',
        category: 'JACKET',
        condition: 'poor',
        attributes: { waterproof_mm: 10000, temp_rating_c: 5, weight_g: 400 },
      }
      const res = evaluateGearItem(perfectJacket, baseTrip)
      expect(res.verdict).toBe('NOT_SUITABLE')
      expect(res.reasons).toEqual([GENERAL_RULE_TEMPLATES.R24])

      // Conditions new, good, worn do not trigger R24
      for (const cond of ['new', 'good', 'worn']) {
        const item = { ...perfectJacket, condition: cond }
        expect(evaluateGearItem(item, baseTrip).verdict).toBe('SUITABLE')
      }
    })

    // R26: Mandatory categories check
    it('R26 gap is generated only for missing mandatory categories (JACKET, FOOTWEAR, BACKPACK)', () => {
      const itemsNoJacket: CoreGearItemInput[] = [
        {
          id: 'f',
          category: 'FOOTWEAR',
          condition: 'good',
          attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 800 },
        },
        {
          id: 'b',
          category: 'BACKPACK',
          condition: 'good',
          attributes: { capacity_l: 35, rain_cover: true, waterproof: true, weight_g: 900 },
        },
      ]

      const res = evaluateGearCheck(itemsNoJacket, baseTrip)
      const r26Gaps = res.gaps.filter((g) => g.ruleId === 'R26')
      expect(r26Gaps.length).toBe(1)
      expect(r26Gaps[0].category).toBe('JACKET')
    })

    // R27: Cold trip without suitable jacket
    it('R27 gap is generated when temp_min <= 0 and no jacket is suitable', () => {
      const tripCold: TripContext = { ...baseTrip, temp_min_c: -2, rain_prob_pct: 0 }
      const items: CoreGearItemInput[] = [
        {
          id: 'j-cold-bad',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 5000, temp_rating_c: 5, weight_g: 500 },
        },
        {
          id: 'f',
          category: 'FOOTWEAR',
          condition: 'good',
          attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 800 },
        },
        {
          id: 'b',
          category: 'BACKPACK',
          condition: 'good',
          attributes: { capacity_l: 35, rain_cover: true, waterproof: true, weight_g: 900 },
        },
      ]

      const res = evaluateGearCheck(items, tripCold)
      expect(res.gaps.some((g) => g.ruleId === 'R27')).toBe(true)
    })

    // R28: Rain 80 with not suitable jacket
    it('R28 gap triggers at rain 80 with bad jacket, but not at rain 79', () => {
      const makeItems = (): CoreGearItemInput[] => [
        {
          id: 'j-bad',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 2000, temp_rating_c: 5, weight_g: 500 },
        },
        {
          id: 'f',
          category: 'FOOTWEAR',
          condition: 'good',
          attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 800 },
        },
        {
          id: 'b',
          category: 'BACKPACK',
          condition: 'good',
          attributes: { capacity_l: 35, rain_cover: true, waterproof: true, weight_g: 900 },
        },
      ]

      const res80 = evaluateGearCheck(makeItems(), { ...baseTrip, rain_prob_pct: 80 })
      expect(res80.gaps.some((g) => g.ruleId === 'R28')).toBe(true)

      const res79 = evaluateGearCheck(makeItems(), { ...baseTrip, rain_prob_pct: 79 })
      expect(res79.gaps.some((g) => g.ruleId === 'R28')).toBe(false)
    })

    // Null and Undefined per Dependency (Relevant vs Non-Relevant Trips)
    it('null dependency on relevant trip causes NOT_SUITABLE via R25; non-relevant trip does not', () => {
      const tripRelevant = { ...baseTrip, rain_prob_pct: 60 }
      const jacketNullWp: CoreGearItemInput = {
        id: 'j',
        category: 'JACKET',
        condition: 'good',
        attributes: { waterproof_mm: null, temp_rating_c: 5, weight_g: 500 },
      }
      const resRelevant = evaluateGearItem(jacketNullWp, tripRelevant)
      expect(resRelevant.verdict).toBe('NOT_SUITABLE')
      expect(resRelevant.reasons.some((r) => r.includes('Thiếu dữ liệu: waterproof_mm'))).toBe(true)

      const tripNonRelevant = { ...baseTrip, rain_prob_pct: 20 }
      const resNonRelevant = evaluateGearItem(jacketNullWp, tripNonRelevant)
      expect(resNonRelevant.verdict).toBe('SUITABLE')
      expect(resNonRelevant.missingAttributes).toContain('waterproof_mm')
      expect(resNonRelevant.reasons.length).toBe(0)
    })

    it('undefined dependency is normalized to null and behaves identically to explicit null', () => {
      const tripRelevant = { ...baseTrip, rain_prob_pct: 60 }
      const jacketUndefinedWp: CoreGearItemInput = {
        id: 'j',
        category: 'JACKET',
        condition: 'good',
        attributes: { waterproof_mm: undefined, temp_rating_c: 5, weight_g: 500 },
      }
      const resRelevant = evaluateGearItem(jacketUndefinedWp, tripRelevant)
      expect(resRelevant.verdict).toBe('NOT_SUITABLE')
      expect(resRelevant.reasons.some((r) => r.includes('Thiếu dữ liệu: waterproof_mm'))).toBe(true)
    })
  })

  // =========================================================================
  // Table-Driven Tests for Null & Undefined Across Rules R01–R23 (B04-07 Isolation)
  // =========================================================================
  describe('B04-07 Systematic Table-Driven Null & Undefined Tests for All 23 Rules (R01–R23)', () => {
    // Each entry provides sufficient suitable baseline attributes for all other fields
    // so that NO OTHER rule triggers, isolating the exact rule under test.
    const ruleDependencyMatrix: Array<{
      ruleId: string
      category: CoreGearCategory
      dep: string
      suitableBaselineAttrs: Record<string, unknown>
      relevantTrip: TripContext
    }> = [
      // JACKET rules R01–R06
      {
        ruleId: 'R01',
        category: 'JACKET',
        dep: 'waterproof_mm',
        suitableBaselineAttrs: { temp_rating_c: 20, weight_g: 400, windproof: true },
        relevantTrip: { ...baseTrip, rain_prob_pct: 70, temp_min_c: 20, difficulty: 2 },
      },
      {
        ruleId: 'R02',
        category: 'JACKET',
        dep: 'waterproof_mm',
        suitableBaselineAttrs: { temp_rating_c: 20, weight_g: 400, windproof: true },
        relevantTrip: { ...baseTrip, rain_prob_pct: 45, temp_min_c: 20, difficulty: 2 },
      },
      {
        ruleId: 'R03',
        category: 'JACKET',
        dep: 'temp_rating_c',
        suitableBaselineAttrs: { waterproof_mm: 10000, weight_g: 400, windproof: true },
        relevantTrip: { ...baseTrip, temp_min_c: 8, rain_prob_pct: 10, difficulty: 2 },
      },
      {
        ruleId: 'R04',
        category: 'JACKET',
        dep: 'temp_rating_c',
        suitableBaselineAttrs: { waterproof_mm: 10000, weight_g: 400, windproof: true },
        relevantTrip: { ...baseTrip, temp_min_c: 14, rain_prob_pct: 10, difficulty: 2 },
      },
      {
        ruleId: 'R05',
        category: 'JACKET',
        dep: 'temp_rating_c',
        suitableBaselineAttrs: { waterproof_mm: 10000, weight_g: 800, windproof: true },
        relevantTrip: { ...baseTrip, temp_min_c: 26, rain_prob_pct: 10, difficulty: 2 },
      },
      {
        ruleId: 'R05',
        category: 'JACKET',
        dep: 'weight_g',
        suitableBaselineAttrs: { waterproof_mm: 10000, temp_rating_c: 5, windproof: true },
        relevantTrip: { ...baseTrip, temp_min_c: 26, rain_prob_pct: 10, difficulty: 2 },
      },
      {
        ruleId: 'R06',
        category: 'JACKET',
        dep: 'weight_g',
        suitableBaselineAttrs: { waterproof_mm: 10000, temp_rating_c: 20, windproof: true },
        relevantTrip: { ...baseTrip, difficulty: 4, rain_prob_pct: 10, temp_min_c: 20 },
      },

      // FOOTWEAR rules R07–R11
      {
        ruleId: 'R07',
        category: 'FOOTWEAR',
        dep: 'waterproof',
        suitableBaselineAttrs: { ankle_support: true, grip_level: 4, weight_g: 600 },
        relevantTrip: { ...baseTrip, rain_prob_pct: 65, difficulty: 2, days: 1, terrain: ['easy'] },
      },
      {
        ruleId: 'R08',
        category: 'FOOTWEAR',
        dep: 'ankle_support',
        suitableBaselineAttrs: { waterproof: true, grip_level: 4, weight_g: 600 },
        relevantTrip: { ...baseTrip, difficulty: 4, rain_prob_pct: 10, days: 1, terrain: ['easy'] },
      },
      {
        ruleId: 'R09',
        category: 'FOOTWEAR',
        dep: 'grip_level',
        suitableBaselineAttrs: { waterproof: true, ankle_support: true, weight_g: 600 },
        relevantTrip: { ...baseTrip, terrain: ['muddy'], difficulty: 2, rain_prob_pct: 10, days: 1 },
      },
      {
        ruleId: 'R10',
        category: 'FOOTWEAR',
        dep: 'waterproof',
        suitableBaselineAttrs: { ankle_support: true, grip_level: 4, weight_g: 600 },
        relevantTrip: { ...baseTrip, days: 3, rain_prob_pct: 40, difficulty: 2, terrain: ['easy'] },
      },
      {
        ruleId: 'R11',
        category: 'FOOTWEAR',
        dep: 'grip_level',
        suitableBaselineAttrs: { waterproof: true, ankle_support: true, weight_g: 600 },
        relevantTrip: { ...baseTrip, difficulty: 4, rain_prob_pct: 10, days: 1, terrain: ['easy'] },
      },

      // PANTS rules R12–R14
      {
        ruleId: 'R12',
        category: 'PANTS',
        dep: 'waterproof_mm',
        suitableBaselineAttrs: { temp_rating_c: 20, insulated: true },
        relevantTrip: { ...baseTrip, rain_prob_pct: 70, temp_min_c: 20 },
      },
      {
        ruleId: 'R13',
        category: 'PANTS',
        dep: 'temp_rating_c',
        suitableBaselineAttrs: { waterproof_mm: 10000, insulated: true },
        relevantTrip: { ...baseTrip, temp_min_c: 9, rain_prob_pct: 10 },
      },
      {
        ruleId: 'R14',
        category: 'PANTS',
        dep: 'insulated',
        suitableBaselineAttrs: { waterproof_mm: 10000, temp_rating_c: 0 },
        relevantTrip: { ...baseTrip, temp_min_c: 5, rain_prob_pct: 10 },
      },

      // BACKPACK rules R15–R19
      {
        ruleId: 'R15',
        category: 'BACKPACK',
        dep: 'capacity_l',
        suitableBaselineAttrs: { rain_cover: true, waterproof: true, weight_g: 1000 },
        relevantTrip: { ...baseTrip, days: 1, rain_prob_pct: 10, difficulty: 2 },
      },
      {
        ruleId: 'R16',
        category: 'BACKPACK',
        dep: 'capacity_l',
        suitableBaselineAttrs: { rain_cover: true, waterproof: true, weight_g: 1000 },
        relevantTrip: { ...baseTrip, days: 2, rain_prob_pct: 10, difficulty: 2 },
      },
      {
        ruleId: 'R17',
        category: 'BACKPACK',
        dep: 'capacity_l',
        suitableBaselineAttrs: { rain_cover: true, waterproof: true, weight_g: 1000 },
        relevantTrip: { ...baseTrip, days: 4, rain_prob_pct: 10, difficulty: 2 },
      },
      {
        ruleId: 'R18',
        category: 'BACKPACK',
        dep: 'rain_cover',
        suitableBaselineAttrs: { capacity_l: 35, waterproof: false, weight_g: 1000 },
        relevantTrip: { ...baseTrip, days: 2, rain_prob_pct: 60, difficulty: 2 },
      },
      {
        ruleId: 'R18',
        category: 'BACKPACK',
        dep: 'waterproof',
        suitableBaselineAttrs: { capacity_l: 35, rain_cover: false, weight_g: 1000 },
        relevantTrip: { ...baseTrip, days: 2, rain_prob_pct: 60, difficulty: 2 },
      },
      {
        ruleId: 'R19',
        category: 'BACKPACK',
        dep: 'capacity_l',
        suitableBaselineAttrs: { rain_cover: true, waterproof: true, weight_g: 1000 },
        relevantTrip: { ...baseTrip, days: 2, rain_prob_pct: 10, difficulty: 2 },
      },

      // SLEEPING_BAG rules R20–R23
      {
        ruleId: 'R20',
        category: 'SLEEPING_BAG',
        dep: 'temp_rating_c',
        suitableBaselineAttrs: { weight_g: 1000 },
        relevantTrip: { ...baseTrip, temp_min_night_c: 8, days: 2 },
      },
      {
        ruleId: 'R21',
        category: 'SLEEPING_BAG',
        dep: 'temp_rating_c',
        suitableBaselineAttrs: { weight_g: 1000 },
        relevantTrip: { ...baseTrip, temp_min_night_c: -1, days: 2 },
      },
      {
        ruleId: 'R22',
        category: 'SLEEPING_BAG',
        dep: 'temp_rating_c',
        suitableBaselineAttrs: { weight_g: 1000 },
        relevantTrip: { ...baseTrip, temp_min_night_c: 24, days: 2 },
      },
      {
        ruleId: 'R23',
        category: 'SLEEPING_BAG',
        dep: 'weight_g',
        suitableBaselineAttrs: { temp_rating_c: 15 },
        relevantTrip: { ...baseTrip, days: 3, temp_min_night_c: 15 },
      },
    ]

    ruleDependencyMatrix.forEach(({ ruleId, category, dep, suitableBaselineAttrs, relevantTrip }) => {
      it(`Rule ${ruleId} (${category}) skips and reports missingAttributes=[${dep}] when ${dep} is null`, () => {
        const itemNull: CoreGearItemInput = {
          id: `item-null-${ruleId}-${dep}`,
          category,
          condition: 'good',
          attributes: { ...suitableBaselineAttrs, [dep]: null },
        }
        const res = evaluateGearItem(itemNull, relevantTrip)
        expect(res.verdict).toBe('NOT_SUITABLE')
        expect(res.missingAttributes).toContain(dep)

        const trace = res.traces.find((t) => t.ruleId === ruleId)
        expect(trace).toBeDefined()
        expect(trace?.contextApplies).toBe(true)
        expect(trace?.outcome).toBe('skip')
        expect(trace?.missingAttributes).toContain(dep)
      })

      it(`Rule ${ruleId} (${category}) skips and reports missingAttributes=[${dep}] when ${dep} is undefined`, () => {
        const itemUndef: CoreGearItemInput = {
          id: `item-undef-${ruleId}-${dep}`,
          category,
          condition: 'good',
          attributes: { ...suitableBaselineAttrs, [dep]: undefined },
        }
        const res = evaluateGearItem(itemUndef, relevantTrip)
        expect(res.verdict).toBe('NOT_SUITABLE')
        expect(res.missingAttributes).toContain(dep)

        const trace = res.traces.find((t) => t.ruleId === ruleId)
        expect(trace).toBeDefined()
        expect(trace?.contextApplies).toBe(true)
        expect(trace?.outcome).toBe('skip')
        expect(trace?.missingAttributes).toContain(dep)
      })
    })
  })

  // =========================================================================
  // B04-07 Gate03 Identity and Boundary Hardening Tests
  // =========================================================================
  describe('B04-07 Gate03 Identity & Boundary Hardening Tests', () => {
    it('normalizeCoreGearItemInput rejects attributes=null with InvalidAttributeValueError', () => {
      const itemWithNullAttrs = {
        id: 'item-null-attrs',
        category: 'JACKET',
        condition: 'good',
        attributes: null,
      }
      expect(() => normalizeCoreGearItemInput(itemWithNullAttrs)).toThrow(InvalidAttributeValueError)
    })

    it('normalizeCoreGearItemInput rejects attributes=[] array with InvalidAttributeValueError', () => {
      const itemWithArrayAttrs = {
        id: 'item-array-attrs',
        category: 'JACKET',
        condition: 'good',
        attributes: [],
      }
      expect(() => normalizeCoreGearItemInput(itemWithArrayAttrs)).toThrow(InvalidAttributeValueError)
    })

    it('normalizeCoreGearItemInput rejects primitive attributes with InvalidAttributeValueError', () => {
      const itemWithPrimitiveAttrs = {
        id: 'item-prim-attrs',
        category: 'JACKET',
        condition: 'good',
        attributes: 'invalid-string',
      }
      expect(() => normalizeCoreGearItemInput(itemWithPrimitiveAttrs)).toThrow(InvalidAttributeValueError)
    })

    it('normalizeCoreGearItemInput accepts absent attributes (undefined) and normalizes to empty object', () => {
      const itemWithUndefAttrs = {
        id: 'item-undef-attrs',
        category: 'JACKET',
        condition: 'good',
      }
      const normalized = normalizeCoreGearItemInput(itemWithUndefAttrs)
      expect(normalized.attributes).toEqual({})
    })

    it('evaluateSubjectRequirementConstraints rejects constraint when requirementId mismatches', () => {
      const subject = {
        id: 'subject-1',
        category: 'JACKET' as const,
        attributes: { waterproof_mm: 5000 },
      }
      const constraints = [
        {
          id: 'c1',
          requirementId: 'REQ_MISMATCH_999', // Mismatched requirementId
          field: 'waterproof_mm',
          operator: 'GTE' as const,
          expected: 3000,
          source: 'TRIP_OFFICIAL' as const,
          reference: 'DOC-1',
        },
      ]
      expect(() => evaluateSubjectRequirementConstraints(subject, 'REQ_ACTUAL_001', constraints)).toThrow(
        ConstraintValidationError,
      )
    })

    it('evaluateGearCheck rejects duplicate item IDs in input before evaluation', () => {
      const duplicateItems: CoreGearItemInput[] = [
        {
          id: 'same-item-id',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 5000 },
        },
        {
          id: 'same-item-id', // Duplicate!
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 8000 },
        },
      ]
      expect(() => evaluateGearCheck(duplicateItems, baseTrip)).toThrow(InvalidAttributeValueError)
    })
  })

  // =========================================================================
  // Core Fixtures Phụ Lục F Parity (with S03-03 Gap Precedence on Checklist)
  // =========================================================================
  describe('Phụ Lục F Core Fixtures Parity', () => {
    const fixtureItems: CoreGearItemInput[] = [
      {
        id: 'fix-jacket',
        category: 'JACKET',
        condition: 'good',
        attributes: { waterproof_mm: 2000, temp_rating_c: 12, weight_g: 500 },
      },
      {
        id: 'fix-footwear',
        category: 'FOOTWEAR',
        condition: 'good',
        attributes: { waterproof: false, ankle_support: true, grip_level: 4, weight_g: 800 },
      },
      {
        id: 'fix-pants',
        category: 'PANTS',
        condition: 'good',
        attributes: { waterproof_mm: 5000, temp_rating_c: 5, insulated: true },
      },
      {
        id: 'fix-backpack',
        category: 'BACKPACK',
        condition: 'good',
        attributes: { capacity_l: 40, rain_cover: true, waterproof: false, weight_g: 900 },
      },
      {
        id: 'fix-sleeping',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 13, weight_g: 1200 },
      },
    ]

    it('Fixture 1: rating = 13 => exactly 3 NOT_SUITABLE, gap R28, isReady = false, checklist JACKET rent_suggested', () => {
      const res = evaluateGearCheck(fixtureItems, baseTrip)

      expect(res.items.find((i) => i.itemId === 'fix-jacket')?.verdict).toBe('NOT_SUITABLE')
      expect(res.items.find((i) => i.itemId === 'fix-footwear')?.verdict).toBe('NOT_SUITABLE')
      expect(res.items.find((i) => i.itemId === 'fix-pants')?.verdict).toBe('SUITABLE')
      expect(res.items.find((i) => i.itemId === 'fix-backpack')?.verdict).toBe('SUITABLE')
      expect(res.items.find((i) => i.itemId === 'fix-sleeping')?.verdict).toBe('NOT_SUITABLE')

      const notSuitable = res.items.filter((i) => i.verdict === 'NOT_SUITABLE')
      expect(notSuitable.length).toBe(3)

      expect(res.gaps.length).toBe(1)
      expect(res.gaps[0].ruleId).toBe('R28')
      expect(res.isReady).toBe(false)

      const jacketChecklist = res.checklist.find((c) => c.category === 'JACKET')!
      expect(jacketChecklist.status).toBe('rent_suggested')
      expect(jacketChecklist.representativeItemId).toBe('fix-jacket')
    })

    it('Fixture 2: rating = 11 => exactly 3 NOT_SUITABLE, gap R28, isReady = false, checklist JACKET rent_suggested', () => {
      const items2 = fixtureItems.map((it) =>
        it.id === 'fix-sleeping' ? { ...it, attributes: { ...it.attributes, temp_rating_c: 11 } } : it,
      )
      const res = evaluateGearCheck(items2, baseTrip)

      expect(res.items.find((i) => i.itemId === 'fix-sleeping')?.verdict).toBe('NOT_SUITABLE')
      expect(res.items.filter((i) => i.verdict === 'NOT_SUITABLE').length).toBe(3)
      expect(res.gaps.length).toBe(1)
      expect(res.gaps[0].ruleId).toBe('R28')
      expect(res.isReady).toBe(false)

      const jacketChecklist = res.checklist.find((c) => c.category === 'JACKET')!
      expect(jacketChecklist.status).toBe('rent_suggested')
    })
  })

  // =========================================================================
  // Independent Template & Rendering Parity Tests (All 28 MASTER V3.1.5 Literals)
  // =========================================================================
  describe('Independent Template & Rendering Parity (All 28 MASTER V3.1.5 Literals)', () => {
    it('verifies all 28 literal templates against independent specification constants', () => {
      // Check 23 rule templates
      for (let i = 1; i <= 23; i++) {
        const ruleId = `R${String(i).padStart(2, '0')}`
        const def = CANONICAL_RULE_DEFINITIONS[ruleId]
        expect(def.templateVi).toBe(INDEPENDENT_28_TEMPLATES[ruleId])
      }

      // Check 5 general templates
      expect(GENERAL_RULE_TEMPLATES.R24).toBe(INDEPENDENT_28_TEMPLATES.R24)
      expect(GENERAL_RULE_TEMPLATES.R25).toBe(INDEPENDENT_28_TEMPLATES.R25)
      expect(GENERAL_RULE_TEMPLATES.R26).toBe(INDEPENDENT_28_TEMPLATES.R26)
      expect(GENERAL_RULE_TEMPLATES.R27).toBe(INDEPENDENT_28_TEMPLATES.R27)
      expect(GENERAL_RULE_TEMPLATES.R28).toBe(INDEPENDENT_28_TEMPLATES.R28)
    })

    it('rendered templates expand all placeholders without trailing braces', () => {
      const r25 = renderGeneralTemplate('R25', { attributes: 'waterproof_mm' })
      expect(r25).toBe('Thiếu dữ liệu: waterproof_mm — bỏ qua các quy tắc cần thông số này.')
      expect(r25.includes('{')).toBe(false)

      const r26 = renderGeneralTemplate('R26', { category: 'JACKET' })
      expect(r26).toBe('Thiếu JACKET trong bộ đồ đã chọn — nên bổ sung hoặc thuê trước chuyến đi.')
      expect(r26.includes('{')).toBe(false)

      const r27 = renderGeneralTemplate('R27', { t: -2 })
      expect(r27).toBe('Nhiệt độ thấp nhất -2°C mà chưa có áo khoác được đánh giá PHÙ HỢP — nên thuê áo đủ ấm.')
      expect(r27.includes('{')).toBe(false)

      const r28 = renderGeneralTemplate('R28', { rain: 85 })
      expect(r28).toBe('Mưa 85% và có áo khoác KHÔNG NÊN — nên thuê áo mưa bộ hoặc áo chống nước cao.')
      expect(r28.includes('{')).toBe(false)
    })

    it('rendered rule reasons have no raw placeholder brackets', () => {
      const r01 = renderRuleReason('R01', { rain: 80, wp: 3000 })
      expect(r01).toBe('Mưa 80% cần áo chống nước ≥ 5000mm, áo bạn chỉ 3000mm — nước sẽ ngấm khi đi lâu.')
      expect(r01.includes('{')).toBe(false)
    })
  })

  // =========================================================================
  // Immutability and Determinism Verification
  // =========================================================================
  describe('Immutability and Determinism', () => {
    it('evaluation does not mutate input item or trip objects', () => {
      const origItem: CoreGearItemInput = {
        id: 'orig',
        category: 'JACKET',
        condition: 'good',
        attributes: { waterproof_mm: 5000, temp_rating_c: 5, weight_g: 400 },
      }
      const origTrip = { ...baseTrip }
      const itemSnap = JSON.stringify(origItem)
      const tripSnap = JSON.stringify(origTrip)

      evaluateGearItem(origItem, origTrip)
      evaluateGearCheck([origItem], origTrip)

      expect(JSON.stringify(origItem)).toBe(itemSnap)
      expect(JSON.stringify(origTrip)).toBe(tripSnap)
    })

    it('evaluation is 100% deterministic across consecutive runs', () => {
      const items: CoreGearItemInput[] = [
        {
          id: 'j',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 5000, temp_rating_c: 5, weight_g: 400 },
        },
      ]

      const res1 = JSON.stringify(evaluateGearCheck(items, baseTrip))
      const res2 = JSON.stringify(evaluateGearCheck(items, baseTrip))
      expect(res1).toBe(res2)
    })
  })

  describe('F01: Deterministic Pure Planner Optimization & Scope Bounds', () => {
    const tripContext: TripContext = {
      temp_min_c: 20,
      temp_max_c: 25,
      temp_min_night_c: 18,
      rain_prob_pct: 0,
      difficulty: 1,
      days: 1,
      terrain: ['forest'],
    }

    const needA = {
      requirementId: 'need-A',
      category: 'JACKET' as GearCategory,
      priority: 'REQUIRED' as const,
      quantity: 4,
      constraints: [],
    }

    const needB = {
      requirementId: 'need-B',
      category: 'JACKET' as GearCategory,
      priority: 'REQUIRED' as const,
      quantity: 3,
      constraints: [
        {
          field: 'waterproof_mm',
          operator: 'GTE' as const,
          expected: 100,
          source: 'USER_REQUEST' as const,
          reference: 'user-pref-waterproof',
        },
      ],
    }

    const candidates: any[] = []
    for (let i = 0; i < 20; i++) {
      const pad = i < 10 ? '0' + i : '' + i
      candidates.push({
        id: 'P' + pad,
        name: 'P' + pad,
        category: 'JACKET',
        dailyPrice: 1,
        rentalFee: 1,
        deposit: 10,
        availableCount: 1,
        weight_g: 1,
        attributes: {
          waterproof_mm: i < 3 ? 100 : 10,
          temp_rating_c: 15,
          weight_g: 1,
          windproof: true,
        },
      })
    }
    candidates.push({
      id: 'S',
      name: 'S',
      category: 'JACKET',
      dailyPrice: 100,
      rentalFee: 100,
      deposit: 100,
      availableCount: 1,
      weight_g: 1,
      attributes: {
        waterproof_mm: 100,
        temp_rating_c: 15,
        weight_g: 1,
        windproof: true,
      },
    })

    const candidatesMap = new Map<string, any[]>()
    candidatesMap.set('JACKET', candidates)

    it('finds provably optimal fee 7 for counterexample A4/B3/P00..P19+S with sufficient budget', () => {
      const res = solveDeterministicPlannerOption(
        {
          ownedAssignments: [],
          uncoveredNeeds: [needA, needB],
          candidatesPerCategory: candidatesMap,
          tripContext,
          nodeLimit: 20000,
        },
        'MIN_RENTAL_FEE',
      )

      expect(res.summary.totalRentalFee).toBe(7)
      expect(res.summary.isComplete).toBe(true)
      expect(res.summary.searchStatus).toBe('OPTIMAL_WITHIN_SEARCH_SCOPE')
      expect(res.summary.searchScope?.hitNodeLimit).toBe(false)
      expect(res.summary.searchScope?.hitAllocationLimit).toBe(false)

      // Verify exact lines: 4 items for Need A (from P03..P19), 3 items for Need B (P00, P01, P02)
      const allocatedIds = new Set(res.rentalLines.map((l: any) => l.productId))
      expect(allocatedIds.has('P00')).toBe(true)
      expect(allocatedIds.has('P01')).toBe(true)
      expect(allocatedIds.has('P02')).toBe(true)
      expect(allocatedIds.has('S')).toBe(false) // S must NEVER be picked when 7 is achievable
    })

    it('correctly marks searchStatus as BOUNDED_RECOMMENDATION when nodeLimit forces search truncation', () => {
      const res = solveDeterministicPlannerOption(
        {
          ownedAssignments: [],
          uncoveredNeeds: [needA, needB],
          candidatesPerCategory: candidatesMap,
          tripContext,
          nodeLimit: 100, // Very low limit to force truncation
        },
        'MIN_RENTAL_FEE',
      )

      expect(res.summary.searchStatus).toBe('BOUNDED_RECOMMENDATION')
      expect(res.summary.searchScope?.hitNodeLimit || res.summary.searchScope?.hitAllocationLimit).toBe(true);
    });

    it('Regression D: preserves canonical tie-break on equal fee and weight (A->P, B->Q)', () => {
      const needA_tie = {
        requirementId: 'need-A',
        category: 'JACKET' as const,
        priority: 'REQUIRED' as const,
        quantity: 1,
        constraints: [],
      };
      const needB_tie = {
        requirementId: 'need-B',
        category: 'JACKET' as const,
        priority: 'REQUIRED' as const,
        quantity: 1,
        constraints: [
          {
            field: 'waterproof_mm',
            operator: 'GTE' as const,
            expected: 100,
            category: 'JACKET' as const,
            source: 'USER_REQUEST' as const,
            reference: 'user-pref-waterproof',
          },
        ],
      };

      const candP = {
        id: 'P',
        name: 'Product P',
        category: 'JACKET' as const,
        rentalFee: 1,
        depositValue: 0,
        replacementValue: 100,
        weight_g: 1,
        attributes: { waterproof_mm: 100, temp_rating_c: 15, weight_g: 1, windproof: true },
        availableCount: 1,
      };
      const candQ = {
        id: 'Q',
        name: 'Product Q',
        category: 'JACKET' as const,
        rentalFee: 1,
        depositValue: 0,
        replacementValue: 100,
        weight_g: 1,
        attributes: { waterproof_mm: 100, temp_rating_c: 15, weight_g: 1, windproof: true },
        availableCount: 1,
      };
      const candR = {
        id: 'R',
        name: 'Product R',
        category: 'JACKET' as const,
        rentalFee: 100,
        depositValue: 0,
        replacementValue: 100,
        weight_g: 1,
        attributes: { waterproof_mm: 10, temp_rating_c: 15, weight_g: 1, windproof: true },
        availableCount: 1,
      };

      const candsMap = new Map([['JACKET', [candP, candQ, candR]]]);

      const res = solveDeterministicPlannerOption(
        {
          ownedAssignments: [],
          uncoveredNeeds: [needA_tie, needB_tie],
          candidatesPerCategory: candsMap,
          tripContext,
          nodeLimit: 5000,
        },
        'MIN_RENTAL_FEE',
      );

      expect(res.summary.totalRentalFee).toBe(2);
      expect(res.summary.isComplete).toBe(true);

      // Verify canonical signature: need-A -> P, need-B -> Q (since A:P;B:Q < A:Q;B:P)
      const assignmentA = res.rentalLines.find((l: any) => l.requirementId === 'need-A');
      const assignmentB = res.rentalLines.find((l: any) => l.requirementId === 'need-B');
      expect(assignmentA?.productId).toBe('P');
      expect(assignmentB?.productId).toBe('Q');
    })
  })
})
