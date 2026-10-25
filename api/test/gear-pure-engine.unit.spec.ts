/**
 * AI Gear Advisor V3.1.3 — Pure Engine Unit Tests (Prompt 03 & Prompt 03-FIX)
 * Zero NestJS, Prisma, AI SDK, network, I/O, or system time.
 * Comprehensive coverage of S03-01 through S03-06 regressions,
 * R01–R28 compound boundaries, per-rule false-one-variable, null dependencies,
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
} from '../src/modules/gear/domain';

describe('Gear Advisor V3.1.3 — Pure Engine & Constraint Evaluator (Prompt 03-FIX)', () => {
  const baseTrip: TripContext = {
    temp_min_c: 8,
    temp_max_c: 16,
    temp_min_night_c: 9,
    rain_prob_pct: 85,
    difficulty: 3,
    days: 2,
    terrain: ['muddy', 'rocky'],
  };

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
          baseTrip
        );
      }).toThrow(UnsupportedCoreCategoryError);
    });

    it('evaluateGearItem throws UnsupportedCoreCategoryError for TREKKING_POLE and RAIN_GEAR', () => {
      expect(() => {
        evaluateGearItem(
          {
            id: 'pole-1',
            category: 'TREKKING_POLE' as any,
            condition: 'good',
            attributes: {},
          },
          baseTrip
        );
      }).toThrow(UnsupportedCoreCategoryError);

      expect(() => {
        evaluateGearItem(
          {
            id: 'rain-1',
            category: 'RAIN_GEAR' as any,
            condition: 'good',
            attributes: {},
          },
          baseTrip
        );
      }).toThrow(UnsupportedCoreCategoryError);
    });

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
      ];

      const withTent: any[] = [
        ...goodTrio,
        { id: 'tent-1', category: 'TENT', condition: 'good', attributes: {} },
      ];

      expect(() => {
        evaluateGearCheck(withTent, baseTrip);
      }).toThrow(UnsupportedCoreCategoryError);
    });
  });

  // =========================================================================
  // S03-02 Regression: Per-Subject Constraint Evaluation (No Flat Merge)
  // =========================================================================
  describe('S03-02: Per-Subject Constraint Evaluation Without Flat Merge', () => {
    it('evaluates two tents independently: neither satisfies both capacity and weight', () => {
      const tLow = {
        id: 't-low',
        category: 'TENT' as GearCategory,
        attributes: { sleeping_places: 1, weight_g: 1800 },
      };
      const tHigh = {
        id: 't-high',
        category: 'TENT' as GearCategory,
        attributes: { sleeping_places: 4, weight_g: 3500 },
      };

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
      ];

      const resLow = evaluateSubjectRequirementConstraints(tLow, 'req-tent', constraints);
      expect(resLow.subjectId).toBe('t-low');
      expect(resLow.status).toBe('NOT_SATISFIED');
      expect(resLow.constraintResults.find((c) => c.field === 'sleeping_places')?.status).toBe(
        'NOT_SATISFIED'
      );
      expect(resLow.constraintResults.find((c) => c.field === 'weight_g')?.status).toBe(
        'SATISFIED'
      );

      const resHigh = evaluateSubjectRequirementConstraints(tHigh, 'req-tent', constraints);
      expect(resHigh.subjectId).toBe('t-high');
      expect(resHigh.status).toBe('NOT_SATISFIED');
      expect(resHigh.constraintResults.find((c) => c.field === 'sleeping_places')?.status).toBe(
        'SATISFIED'
      );
      expect(resHigh.constraintResults.find((c) => c.field === 'weight_g')?.status).toBe(
        'NOT_SATISFIED'
      );
    });

    it('order permutation does not alter per-subject evaluation results', () => {
      const tLow = {
        id: 't-low',
        category: 'TENT' as GearCategory,
        attributes: { sleeping_places: 1, weight_g: 1800 },
      };
      const tHigh = {
        id: 't-high',
        category: 'TENT' as GearCategory,
        attributes: { sleeping_places: 4, weight_g: 3500 },
      };

      const constraints = [
        {
          id: 'c-cap',
          field: 'sleeping_places',
          operator: 'GTE' as const,
          expected: 2,
          source: 'USER_REQUEST' as const,
          reference: 'User pref',
        },
        {
          id: 'c-wt',
          field: 'weight_g',
          operator: 'LTE' as const,
          expected: 2000,
          source: 'USER_REQUEST' as const,
          reference: 'User pref',
        },
      ];

      const eval1 = [
        evaluateSubjectRequirementConstraints(tLow, 'req-1', constraints),
        evaluateSubjectRequirementConstraints(tHigh, 'req-1', constraints),
      ];

      const eval2 = [
        evaluateSubjectRequirementConstraints(tHigh, 'req-1', constraints),
        evaluateSubjectRequirementConstraints(tLow, 'req-1', constraints),
      ];

      const eval1Low = eval1.find((e) => e.subjectId === 't-low')!;
      const eval2Low = eval2.find((e) => e.subjectId === 't-low')!;
      expect(eval1Low.status).toBe(eval2Low.status);

      const eval1High = eval1.find((e) => e.subjectId === 't-high')!;
      const eval2High = eval2.find((e) => e.subjectId === 't-high')!;
      expect(eval1High.status).toBe(eval2High.status);
    });
  });

  // =========================================================================
  // S03-03 Regression: Checklist Prioritizes Gap Precedence
  // =========================================================================
  describe('S03-03: Checklist Status Projection Prioritizes Gap Precedence', () => {
    it('sets status to rent_suggested when category has gap, even if a suitable item exists', () => {
      const tripRain85: TripContext = { ...baseTrip, rain_prob_pct: 85 };
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
      ];

      const res = evaluateGearCheck(items, tripRain85);

      // Verify R28 gap exists
      expect(res.gaps.some((g) => g.ruleId === 'R28')).toBe(true);

      const jacketChecklist = res.checklist.find((c) => c.category === 'JACKET')!;
      // Representative is j-good (SUITABLE)
      expect(jacketChecklist.representativeItemId).toBe('j-good');
      expect(jacketChecklist.verdict).toBe('SUITABLE');
      // But status is rent_suggested due to gap R28 precedence!
      expect(jacketChecklist.status).toBe('rent_suggested');
    });

    it('sets status to suitable when category has no gap and item is suitable', () => {
      const tripDry: TripContext = { ...baseTrip, rain_prob_pct: 20 };
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
      ];

      const res = evaluateGearCheck(items, tripDry);
      const jacketChecklist = res.checklist.find((c) => c.category === 'JACKET')!;
      expect(jacketChecklist.representativeItemId).toBe('j-good');
      expect(jacketChecklist.status).toBe('suitable');
    });
  });

  // =========================================================================
  // S03-04 Regression: Typed Constraint Evaluator & Provenance
  // =========================================================================
  describe('S03-04: Typed Constraint Normalization, Unit & Provenance Validation', () => {
    const subjectPole = {
      id: 'pole-1',
      category: 'TREKKING_POLE' as GearCategory,
      attributes: { length_min_cm: 100, adjustable: true },
    };

    it('rejects unit mismatch: length_min_cm with unit mm throws ConstraintValidationError', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'length_min_cm',
            operator: 'GTE',
            expected: 500,
            unit: 'mm', // mismatch: canonical is 'cm'
            source: 'USER_REQUEST',
            reference: 'User input',
          },
          subjectPole
        );
      }).toThrow(ConstraintValidationError);
    });

    it('rejects invalid operator: BOGUS throws ConstraintValidationError', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'length_min_cm',
            operator: 'BOGUS',
            expected: 100,
            source: 'USER_REQUEST',
            reference: 'User input',
          },
          subjectPole
        );
      }).toThrow(ConstraintValidationError);
    });

    it('rejects cross-category field: sleeping_places on TREKKING_POLE throws ConstraintValidationError', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'sleeping_places',
            operator: 'GTE',
            expected: 2,
            source: 'USER_REQUEST',
            reference: 'User input',
          },
          subjectPole
        );
      }).toThrow(ConstraintValidationError);
    });

    it('rejects non-finite expected values: NaN or Infinity throws ConstraintValidationError', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'length_min_cm',
            operator: 'GTE',
            expected: NaN,
            source: 'USER_REQUEST',
            reference: 'User input',
          },
          subjectPole
        );
      }).toThrow(ConstraintValidationError);

      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'length_min_cm',
            operator: 'GTE',
            expected: Infinity,
            source: 'USER_REQUEST',
            reference: 'User input',
          },
          subjectPole
        );
      }).toThrow(ConstraintValidationError);
    });

    it('rejects missing or empty provenance reference', () => {
      expect(() => {
        evaluateRequirementConstraint(
          {
            id: 'c1',
            field: 'length_min_cm',
            operator: 'GTE',
            expected: 100,
            source: 'USER_REQUEST',
            reference: '   ', // empty
          },
          subjectPole
        );
      }).toThrow(ConstraintValidationError);
    });

    it('preserves known 0 and known false in constraint evaluation', () => {
      const subject = {
        id: 'j-0',
        category: 'JACKET' as GearCategory,
        attributes: { waterproof_mm: 0, windproof: false },
      };

      const resWp = evaluateRequirementConstraint(
        {
          id: 'c-wp',
          field: 'waterproof_mm',
          operator: 'EQ',
          expected: 0,
          source: 'MANUFACTURER_FACT',
          reference: 'Spec doc',
        },
        subject
      );
      expect(resWp.status).toBe('SATISFIED');
      expect(resWp.actual).toBe(0);

      const resWind = evaluateRequirementConstraint(
        {
          id: 'c-wind',
          field: 'windproof',
          operator: 'EQ',
          expected: false,
          source: 'MANUFACTURER_FACT',
          reference: 'Spec doc',
        },
        subject
      );
      expect(resWind.status).toBe('SATISFIED');
      expect(resWind.actual).toBe(false);
    });

    it('returns UNKNOWN (actual: null) when attribute is missing without defaulting to 0', () => {
      const subject = {
        id: 'j-null',
        category: 'JACKET' as GearCategory,
        attributes: {},
      };

      const res = evaluateRequirementConstraint(
        {
          id: 'c-wp',
          field: 'waterproof_mm',
          operator: 'GTE',
          expected: 5000,
          source: 'TRIP_OFFICIAL',
          reference: 'Requirement',
        },
        subject
      );
      expect(res.status).toBe('UNKNOWN');
      expect(res.actual).toBeNull();
    });
  });

  // =========================================================================
  // S03-05 Regression: Input Validation at Domain Boundary
  // =========================================================================
  describe('S03-05: Input Validation & Numeric Coercion Prevention', () => {
    it('rejects string for numeric attribute: waterproof_mm = "invalid"', () => {
      expect(() => {
        evaluateGearItem(
          {
            id: 'j-bad',
            category: 'JACKET',
            condition: 'good',
            attributes: { waterproof_mm: 'invalid' },
          },
          baseTrip
        );
      }).toThrow(InvalidAttributeValueError);
    });

    it('rejects NaN and Infinity for numeric attributes', () => {
      expect(() => {
        evaluateGearItem(
          {
            id: 'j-nan',
            category: 'JACKET',
            condition: 'good',
            attributes: { waterproof_mm: NaN },
          },
          baseTrip
        );
      }).toThrow(InvalidAttributeValueError);

      expect(() => {
        evaluateGearItem(
          {
            id: 'j-inf',
            category: 'JACKET',
            condition: 'good',
            attributes: { waterproof_mm: Infinity },
          },
          baseTrip
        );
      }).toThrow(InvalidAttributeValueError);
    });

    it('rejects non-boolean value for boolean attribute', () => {
      expect(() => {
        evaluateGearItem(
          {
            id: 'j-bool',
            category: 'JACKET',
            condition: 'good',
            attributes: { windproof: 'true' },
          },
          baseTrip
        );
      }).toThrow(InvalidAttributeValueError);
    });

    it('rejects grip_level = 0 (invalid in API domain 1..5)', () => {
      expect(() => {
        evaluateGearItem(
          {
            id: 'f-grip0',
            category: 'FOOTWEAR',
            condition: 'good',
            attributes: { grip_level: 0 },
          },
          baseTrip
        );
      }).toThrow(InvalidAttributeValueError);
    });

    it('rejects unknown attribute keys for the category', () => {
      expect(() => {
        evaluateGearItem(
          {
            id: 'j-unknown',
            category: 'JACKET',
            condition: 'good',
            attributes: { unknown_prop: 123 },
          },
          baseTrip
        );
      }).toThrow(InvalidAttributeValueError);
    });
  });

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
      });

      // R01: rain >= 60 && wp < 5000
      expect(evaluateGearItem(makeJacket(4999), { ...baseTrip, rain_prob_pct: 60 }).verdict).toBe(
        'NOT_SUITABLE'
      );
      expect(evaluateGearItem(makeJacket(5000), { ...baseTrip, rain_prob_pct: 60 }).verdict).toBe(
        'SUITABLE'
      );

      // R02: rain >= 30 && rain < 60 && wp < 3000
      expect(evaluateGearItem(makeJacket(2999), { ...baseTrip, rain_prob_pct: 59 }).verdict).toBe(
        'NOT_SUITABLE'
      );
      expect(evaluateGearItem(makeJacket(3000), { ...baseTrip, rain_prob_pct: 59 }).verdict).toBe(
        'SUITABLE'
      );
      expect(evaluateGearItem(makeJacket(2999), { ...baseTrip, rain_prob_pct: 30 }).verdict).toBe(
        'NOT_SUITABLE'
      );
      expect(evaluateGearItem(makeJacket(2000), { ...baseTrip, rain_prob_pct: 29 }).verdict).toBe(
        'SUITABLE'
      );
    });

    // R03 & R04
    it('R03 & R04 temp boundaries', () => {
      const makeJacket = (rating: number) => ({
        id: 'j',
        category: 'JACKET' as const,
        condition: 'good',
        attributes: { waterproof_mm: 10000, temp_rating_c: rating, weight_g: 500 },
      });

      // R03: temp_min <= 10 && rating > temp_min
      const trip10 = { ...baseTrip, temp_min_c: 10, rain_prob_pct: 0 };
      expect(evaluateGearItem(makeJacket(11), trip10).verdict).toBe('NOT_SUITABLE');
      expect(evaluateGearItem(makeJacket(10), trip10).verdict).toBe('SUITABLE');

      // R04: temp_min <= 15 && rating > temp_min + 5
      const trip12 = { ...baseTrip, temp_min_c: 12, rain_prob_pct: 0 };
      expect(evaluateGearItem(makeJacket(18), trip12).verdict).toBe('NOT_SUITABLE'); // 18 > 12+5=17
      expect(evaluateGearItem(makeJacket(17), trip12).verdict).toBe('SUITABLE');
    });

    // R05 & R06
    it('R05 & R06 warm weather and difficulty boundaries', () => {
      // R05: temp_min >= 25 && rating < 10 && weight > 600
      const tripWarm = { ...baseTrip, temp_min_c: 25, rain_prob_pct: 0 };
      const jacketR05True: CoreGearItemInput = {
        id: 'j',
        category: 'JACKET',
        condition: 'good',
        attributes: { waterproof_mm: 10000, temp_rating_c: 9, weight_g: 601 },
      };
      expect(evaluateGearItem(jacketR05True, tripWarm).verdict).toBe('NOT_SUITABLE');

      const jacketR05FalseRating: CoreGearItemInput = {
        ...jacketR05True,
        attributes: { waterproof_mm: 10000, temp_rating_c: 10, weight_g: 601 },
      };
      expect(evaluateGearItem(jacketR05FalseRating, tripWarm).verdict).toBe('SUITABLE');

      const jacketR05FalseWeight: CoreGearItemInput = {
        ...jacketR05True,
        attributes: { waterproof_mm: 10000, temp_rating_c: 9, weight_g: 600 },
      };
      expect(evaluateGearItem(jacketR05FalseWeight, tripWarm).verdict).toBe('SUITABLE');

      // R06: difficulty >= 4 && weight > 900
      const tripHard = { ...baseTrip, difficulty: 4, rain_prob_pct: 0 };
      const jacketR06True: CoreGearItemInput = {
        id: 'j',
        category: 'JACKET',
        condition: 'good',
        attributes: { waterproof_mm: 10000, temp_rating_c: 5, weight_g: 901 },
      };
      expect(evaluateGearItem(jacketR06True, tripHard).verdict).toBe('NOT_SUITABLE');

      const jacketR06FalseWeight: CoreGearItemInput = {
        ...jacketR06True,
        attributes: { waterproof_mm: 10000, temp_rating_c: 5, weight_g: 900 },
      };
      expect(evaluateGearItem(jacketR06FalseWeight, tripHard).verdict).toBe('SUITABLE');
    });

    // R07–R11 (FOOTWEAR)
    it('R07–R11 Footwear boundaries', () => {
      // R07: rain >= 60 && waterproof === false
      const tripRain = { ...baseTrip, rain_prob_pct: 60 };
      const fwR07True: CoreGearItemInput = {
        id: 'f',
        category: 'FOOTWEAR',
        condition: 'good',
        attributes: { waterproof: false, ankle_support: true, grip_level: 4, weight_g: 800 },
      };
      expect(evaluateGearItem(fwR07True, tripRain).verdict).toBe('NOT_SUITABLE');

      const fwR07False: CoreGearItemInput = {
        ...fwR07True,
        attributes: { waterproof: true, ankle_support: true, grip_level: 4, weight_g: 800 },
      };
      expect(evaluateGearItem(fwR07False, tripRain).verdict).toBe('SUITABLE');

      // R08: difficulty >= 4 && ankle_support === false
      const tripDiff4 = { ...baseTrip, difficulty: 4, rain_prob_pct: 0 };
      const fwR08True: CoreGearItemInput = {
        id: 'f',
        category: 'FOOTWEAR',
        condition: 'good',
        attributes: { waterproof: true, ankle_support: false, grip_level: 4, weight_g: 800 },
      };
      expect(evaluateGearItem(fwR08True, tripDiff4).verdict).toBe('NOT_SUITABLE');

      // R09: terrain has muddy/rocky && grip_level < 3
      const tripMuddy = { ...baseTrip, terrain: ['muddy'], rain_prob_pct: 0, difficulty: 2 };
      const fwR09True: CoreGearItemInput = {
        id: 'f',
        category: 'FOOTWEAR',
        condition: 'good',
        attributes: { waterproof: true, ankle_support: true, grip_level: 2, weight_g: 800 },
      };
      expect(evaluateGearItem(fwR09True, tripMuddy).verdict).toBe('NOT_SUITABLE');

      const fwR09False: CoreGearItemInput = {
        ...fwR09True,
        attributes: { waterproof: true, ankle_support: true, grip_level: 3, weight_g: 800 },
      };
      expect(evaluateGearItem(fwR09False, tripMuddy).verdict).toBe('SUITABLE');

      // R10: days >= 3 && rain >= 30 && waterproof === false
      const tripDays3 = { ...baseTrip, days: 3, rain_prob_pct: 30 };
      expect(evaluateGearItem(fwR07True, tripDays3).verdict).toBe('NOT_SUITABLE');

      // R11: difficulty >= 4 && grip_level < 3
      expect(evaluateGearItem(fwR09True, tripDiff4).verdict).toBe('NOT_SUITABLE');
    });

    // R12–R14 (PANTS)
    it('R12–R14 Pants boundaries', () => {
      // R12: rain >= 60 && wp < 3000
      const tripRain = { ...baseTrip, rain_prob_pct: 60 };
      const pR12True: CoreGearItemInput = {
        id: 'p',
        category: 'PANTS',
        condition: 'good',
        attributes: { waterproof_mm: 2999, temp_rating_c: 5, insulated: true },
      };
      expect(evaluateGearItem(pR12True, tripRain).verdict).toBe('NOT_SUITABLE');

      const pR12False: CoreGearItemInput = {
        ...pR12True,
        attributes: { waterproof_mm: 3000, temp_rating_c: 5, insulated: true },
      };
      expect(evaluateGearItem(pR12False, tripRain).verdict).toBe('SUITABLE');

      // R13: temp_min <= 10 && rating > temp_min
      const tripCold = { ...baseTrip, temp_min_c: 10, rain_prob_pct: 0 };
      const pR13True: CoreGearItemInput = {
        id: 'p',
        category: 'PANTS',
        condition: 'good',
        attributes: { waterproof_mm: 5000, temp_rating_c: 11, insulated: true },
      };
      expect(evaluateGearItem(pR13True, tripCold).verdict).toBe('NOT_SUITABLE');

      // R14: temp_min <= 12 && insulated === false && rating > 10
      const trip12 = { ...baseTrip, temp_min_c: 12, rain_prob_pct: 0 };
      const pR14True: CoreGearItemInput = {
        id: 'p',
        category: 'PANTS',
        condition: 'good',
        attributes: { waterproof_mm: 5000, temp_rating_c: 11, insulated: false },
      };
      expect(evaluateGearItem(pR14True, trip12).verdict).toBe('NOT_SUITABLE');
    });

    // R15–R19 (BACKPACK)
    it('R15–R19 Backpack boundaries', () => {
      // R15: days == 1 && cap < 15
      const trip1Day = { ...baseTrip, days: 1, rain_prob_pct: 0 };
      const bp14: CoreGearItemInput = {
        id: 'b',
        category: 'BACKPACK',
        condition: 'good',
        attributes: { capacity_l: 14, rain_cover: true, waterproof: true, weight_g: 500 },
      };
      expect(evaluateGearItem(bp14, trip1Day).verdict).toBe('NOT_SUITABLE');

      const bp15: CoreGearItemInput = {
        ...bp14,
        attributes: { capacity_l: 15, rain_cover: true, waterproof: true, weight_g: 500 },
      };
      expect(evaluateGearItem(bp15, trip1Day).verdict).toBe('SUITABLE');

      // R16: 2 <= days <= 3 && cap < 35
      const trip2Day = { ...baseTrip, days: 2, rain_prob_pct: 0 };
      const bp34: CoreGearItemInput = {
        ...bp14,
        attributes: { capacity_l: 34, rain_cover: true, waterproof: true, weight_g: 1000 },
      };
      expect(evaluateGearItem(bp34, trip2Day).verdict).toBe('NOT_SUITABLE');

      const bp35: CoreGearItemInput = {
        ...bp14,
        attributes: { capacity_l: 35, rain_cover: true, waterproof: true, weight_g: 1000 },
      };
      expect(evaluateGearItem(bp35, trip2Day).verdict).toBe('SUITABLE');

      // R17: days >= 4 && cap < 50
      const trip4Day = { ...baseTrip, days: 4, rain_prob_pct: 0 };
      const bp49: CoreGearItemInput = {
        ...bp14,
        attributes: { capacity_l: 49, rain_cover: true, waterproof: true, weight_g: 1500 },
      };
      expect(evaluateGearItem(bp49, trip4Day).verdict).toBe('NOT_SUITABLE');

      // R18: rain >= 50 && rain_cover === false && waterproof === false
      const tripRain50 = { ...baseTrip, rain_prob_pct: 50 };
      const bpR18True: CoreGearItemInput = {
        ...bp14,
        attributes: { capacity_l: 35, rain_cover: false, waterproof: false, weight_g: 1000 },
      };
      expect(evaluateGearItem(bpR18True, tripRain50).verdict).toBe('NOT_SUITABLE');

      // R19: cap > days * 20 + 30 (for 2 days: > 2*20+30 = 70)
      const bp71: CoreGearItemInput = {
        ...bp14,
        attributes: { capacity_l: 71, rain_cover: true, waterproof: true, weight_g: 2000 },
      };
      expect(evaluateGearItem(bp71, trip2Day).verdict).toBe('NOT_SUITABLE');
      const bp70: CoreGearItemInput = {
        ...bp14,
        attributes: { capacity_l: 70, rain_cover: true, waterproof: true, weight_g: 2000 },
      };
      expect(evaluateGearItem(bp70, trip2Day).verdict).toBe('SUITABLE');
    });

    // R20–R23 (SLEEPING_BAG)
    it('R20–R23 Sleeping Bag boundaries', () => {
      // R20: rating > night + 3 (for night 9: rating > 12)
      const tripNight9 = { ...baseTrip, temp_min_night_c: 9 };
      const sbR20True: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 13, weight_g: 1000 },
      };
      expect(evaluateGearItem(sbR20True, tripNight9).verdict).toBe('NOT_SUITABLE');

      const sbR20At12: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 12, weight_g: 1000 },
      };
      // Rating 12 is R21 true (9 < 12 <= 12), not R20
      expect(evaluateGearItem(sbR20At12, tripNight9).reasons).toEqual([
        'Túi ngủ sát ngưỡng — nên mang thêm lớp lót túi ngủ (liner).',
      ]);

      // R21: night < rating <= night + 3 (for night 9: 9 < rating <= 12)
      const sbR21True: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 11, weight_g: 1000 },
      };
      expect(evaluateGearItem(sbR21True, tripNight9).verdict).toBe('NOT_SUITABLE');

      const sbR21False: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 9, weight_g: 1000 },
      };
      expect(evaluateGearItem(sbR21False, tripNight9).verdict).toBe('SUITABLE');

      // R22: night >= 22 && rating < 12
      const tripNight22 = { ...baseTrip, temp_min_night_c: 22 };
      const sbR22True: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 10, weight_g: 1000 },
      };
      expect(evaluateGearItem(sbR22True, tripNight22).verdict).toBe('NOT_SUITABLE');

      // R23: weight > 2200 && days >= 3
      const tripDays3 = { ...baseTrip, days: 3 };
      const sbR23True: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 5, weight_g: 2201 },
      };
      expect(evaluateGearItem(sbR23True, tripDays3).verdict).toBe('NOT_SUITABLE');

      const sbR23False: CoreGearItemInput = {
        id: 's',
        category: 'SLEEPING_BAG',
        condition: 'good',
        attributes: { temp_rating_c: 5, weight_g: 2200 },
      };
      expect(evaluateGearItem(sbR23False, tripDays3).verdict).toBe('SUITABLE');
    });

    // R24: Condition poor invariant across verdicts and conditions
    it('R24 condition poor overrides SUITABLE verdict to NOT_SUITABLE with R24 reason', () => {
      const perfectJacket: CoreGearItemInput = {
        id: 'j',
        category: 'JACKET',
        condition: 'poor',
        attributes: { waterproof_mm: 10000, temp_rating_c: 5, weight_g: 400 },
      };
      const res = evaluateGearItem(perfectJacket, baseTrip);
      expect(res.verdict).toBe('NOT_SUITABLE');
      expect(res.reasons).toEqual([GENERAL_RULE_TEMPLATES.R24]);

      // Conditions new, good, worn do not trigger R24
      for (const cond of ['new', 'good', 'worn']) {
        const item = { ...perfectJacket, condition: cond };
        expect(evaluateGearItem(item, baseTrip).verdict).toBe('SUITABLE');
      }
    });

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
      ];

      const res = evaluateGearCheck(itemsNoJacket, baseTrip);
      const r26Gaps = res.gaps.filter((g) => g.ruleId === 'R26');
      expect(r26Gaps.length).toBe(1);
      expect(r26Gaps[0].category).toBe('JACKET');
    });

    // R27: Cold trip without suitable jacket
    it('R27 gap is generated when temp_min <= 0 and no jacket is suitable', () => {
      const tripCold: TripContext = { ...baseTrip, temp_min_c: -2, rain_prob_pct: 0 };
      const items: CoreGearItemInput[] = [
        {
          id: 'j-cold-bad',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 5000, temp_rating_c: 5, weight_g: 500 }, // rating 5 > temp -2 => R03 NOT_SUITABLE
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
      ];

      const res = evaluateGearCheck(items, tripCold);
      expect(res.gaps.some((g) => g.ruleId === 'R27')).toBe(true);
    });

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
      ];

      const res80 = evaluateGearCheck(makeItems(), { ...baseTrip, rain_prob_pct: 80 });
      expect(res80.gaps.some((g) => g.ruleId === 'R28')).toBe(true);

      const res79 = evaluateGearCheck(makeItems(), { ...baseTrip, rain_prob_pct: 79 });
      expect(res79.gaps.some((g) => g.ruleId === 'R28')).toBe(false);
    });

    // Null and Undefined per Dependency (Relevant vs Non-Relevant Trips)
    it('null dependency on relevant trip causes NOT_SUITABLE via R25; non-relevant trip does not', () => {
      const tripRelevant = { ...baseTrip, rain_prob_pct: 60 };
      const jacketNullWp: CoreGearItemInput = {
        id: 'j',
        category: 'JACKET',
        condition: 'good',
        attributes: { waterproof_mm: null, temp_rating_c: 5, weight_g: 500 },
      };
      const resRelevant = evaluateGearItem(jacketNullWp, tripRelevant);
      expect(resRelevant.verdict).toBe('NOT_SUITABLE');
      expect(resRelevant.reasons.some((r) => r.includes('Thiếu dữ liệu: waterproof_mm'))).toBe(
        true
      );

      const tripNonRelevant = { ...baseTrip, rain_prob_pct: 20 };
      const resNonRelevant = evaluateGearItem(jacketNullWp, tripNonRelevant);
      expect(resNonRelevant.verdict).toBe('SUITABLE');
      expect(resNonRelevant.missingAttributes).toContain('waterproof_mm');
      expect(resNonRelevant.reasons.length).toBe(0);
    });
  });

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
    ];

    it('Fixture 1: rating = 13 => exactly 3 NOT_SUITABLE, gap R28, isReady = false, checklist JACKET rent_suggested', () => {
      const res = evaluateGearCheck(fixtureItems, baseTrip);

      expect(res.items.find((i) => i.itemId === 'fix-jacket')?.verdict).toBe('NOT_SUITABLE');
      expect(res.items.find((i) => i.itemId === 'fix-footwear')?.verdict).toBe('NOT_SUITABLE');
      expect(res.items.find((i) => i.itemId === 'fix-pants')?.verdict).toBe('SUITABLE');
      expect(res.items.find((i) => i.itemId === 'fix-backpack')?.verdict).toBe('SUITABLE');
      expect(res.items.find((i) => i.itemId === 'fix-sleeping')?.verdict).toBe('NOT_SUITABLE');

      const notSuitable = res.items.filter((i) => i.verdict === 'NOT_SUITABLE');
      expect(notSuitable.length).toBe(3);

      expect(res.gaps.length).toBe(1);
      expect(res.gaps[0].ruleId).toBe('R28');
      expect(res.isReady).toBe(false);

      // S03-03: Checklist JACKET status is rent_suggested due to gap R28
      const jacketChecklist = res.checklist.find((c) => c.category === 'JACKET')!;
      expect(jacketChecklist.status).toBe('rent_suggested');
      expect(jacketChecklist.representativeItemId).toBe('fix-jacket');
    });

    it('Fixture 2: rating = 11 => exactly 3 NOT_SUITABLE, gap R28, isReady = false, checklist JACKET rent_suggested', () => {
      const items2 = fixtureItems.map((it) =>
        it.id === 'fix-sleeping'
          ? { ...it, attributes: { ...it.attributes, temp_rating_c: 11 } }
          : it
      );
      const res = evaluateGearCheck(items2, baseTrip);

      expect(res.items.find((i) => i.itemId === 'fix-sleeping')?.verdict).toBe('NOT_SUITABLE');
      expect(res.items.filter((i) => i.verdict === 'NOT_SUITABLE').length).toBe(3);
      expect(res.gaps.length).toBe(1);
      expect(res.gaps[0].ruleId).toBe('R28');
      expect(res.isReady).toBe(false);

      const jacketChecklist = res.checklist.find((c) => c.category === 'JACKET')!;
      expect(jacketChecklist.status).toBe('rent_suggested');
    });
  });

  // =========================================================================
  // Independent Template & Rendering Parity Tests
  // =========================================================================
  describe('Independent Template & Rendering Parity (MASTER D1 & D2)', () => {
    it('verifies all 5 general templates against independent string constants', () => {
      expect(GENERAL_RULE_TEMPLATES.R24).toBe(
        'Đồ đã xuống cấp — giảm một mức đánh giá so với thông số.'
      );
      expect(GENERAL_RULE_TEMPLATES.R25).toBe(
        'Thiếu dữ liệu: {attributes} — bỏ qua các quy tắc cần thông số này.'
      );
      expect(GENERAL_RULE_TEMPLATES.R26).toBe(
        'Thiếu {category} trong bộ đồ đã chọn — nên bổ sung hoặc thuê trước chuyến đi.'
      );
      expect(GENERAL_RULE_TEMPLATES.R27).toBe(
        'Nhiệt độ thấp nhất {t}°C mà chưa có áo khoác được đánh giá PHÙ HỢP — nên thuê áo đủ ấm.'
      );
      expect(GENERAL_RULE_TEMPLATES.R28).toBe(
        'Mưa {rain}% và có áo khoác KHÔNG NÊN — nên thuê áo mưa bộ hoặc áo chống nước cao.'
      );
    });

    it('rendered templates expand all placeholders without trailing braces', () => {
      const r25 = renderGeneralTemplate('R25', { attributes: 'waterproof_mm' });
      expect(r25).toBe('Thiếu dữ liệu: waterproof_mm — bỏ qua các quy tắc cần thông số này.');
      expect(r25.includes('{')).toBe(false);

      const r26 = renderGeneralTemplate('R26', { category: 'JACKET' });
      expect(r26).toBe('Thiếu JACKET trong bộ đồ đã chọn — nên bổ sung hoặc thuê trước chuyến đi.');
      expect(r26.includes('{')).toBe(false);

      const r27 = renderGeneralTemplate('R27', { t: -2 });
      expect(r27).toBe(
        'Nhiệt độ thấp nhất -2°C mà chưa có áo khoác được đánh giá PHÙ HỢP — nên thuê áo đủ ấm.'
      );
      expect(r27.includes('{')).toBe(false);

      const r28 = renderGeneralTemplate('R28', { rain: 85 });
      expect(r28).toBe(
        'Mưa 85% và có áo khoác KHÔNG NÊN — nên thuê áo mưa bộ hoặc áo chống nước cao.'
      );
      expect(r28.includes('{')).toBe(false);
    });

    it('rendered rule reasons have no raw placeholder brackets', () => {
      const r01 = renderRuleReason('R01', { rain: 80, wp: 3000 });
      expect(r01).toBe(
        'Mưa 80% cần áo chống nước ≥ 5000mm, áo bạn chỉ 3000mm — nước sẽ ngấm khi đi lâu.'
      );
      expect(r01.includes('{')).toBe(false);
    });
  });

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
      };
      const origTrip = { ...baseTrip };
      const itemSnap = JSON.stringify(origItem);
      const tripSnap = JSON.stringify(origTrip);

      evaluateGearItem(origItem, origTrip);
      evaluateGearCheck([origItem], origTrip);

      expect(JSON.stringify(origItem)).toBe(itemSnap);
      expect(JSON.stringify(origTrip)).toBe(tripSnap);
    });

    it('evaluation is 100% deterministic across consecutive runs', () => {
      const items: CoreGearItemInput[] = [
        {
          id: 'j',
          category: 'JACKET',
          condition: 'good',
          attributes: { waterproof_mm: 5000, temp_rating_c: 5, weight_g: 400 },
        },
      ];

      const res1 = JSON.stringify(evaluateGearCheck(items, baseTrip));
      const res2 = JSON.stringify(evaluateGearCheck(items, baseTrip));
      expect(res1).toBe(res2);
    });
  });
});

