import {
  buildTripRequirements,
  isRuleContextApplicable,
  lookupClimateEstimate,
  PlanRequirement,
  resolvePlanCoverage,
  TripContext,
} from '../src/modules/gear/domain';
import { CoreGearItemInput } from '../src/modules/gear/domain/pure-gear-engine';

describe('Phase 05: Coverage & Requirement Builder Unit Tests', () => {
  const baseTrip: TripContext = {
    temp_min_c: 8,
    temp_max_c: 20,
    temp_min_night_c: 6,
    rain_prob_pct: 65,
    difficulty: 4,
    days: 3,
    terrain: ['mountain', 'rocky', 'muddy'],
  };

  describe('Section 1: Climate Estimate Registry', () => {
    it('returns canonical climate estimate for known destination and month', () => {
      const estimate = lookupClimateEstimate('Bidoup Nui Ba', 11);
      expect(estimate).not.toBeNull();
      expect(estimate?.destination).toBe('bidoup');
      expect(estimate?.month).toBe(11);
      expect(estimate?.temp_min_c).toBe(12);
      expect(estimate?.source).toBe('CLIMATE_ESTIMATE');
      expect(estimate?.sourceReference).toContain('LamDong');
    });

    it('returns null for unknown destination, requiring user declaration', () => {
      const estimate = lookupClimateEstimate('Unknown Mountain X', 5);
      expect(estimate).toBeNull();
    });

    it('returns null for invalid month (< 1 or > 12)', () => {
      expect(lookupClimateEstimate('bidoup', 0)).toBeNull();
      expect(lookupClimateEstimate('bidoup', 13)).toBeNull();
    });
  });

  describe('Section 2: Rule Context Applicability (MASTER 7.1)', () => {
    it('accurately evaluates rain rules (R01, R02, R18)', () => {
      expect(isRuleContextApplicable('R01', { ...baseTrip, rain_prob_pct: 60 })).toBe(true);
      expect(isRuleContextApplicable('R01', { ...baseTrip, rain_prob_pct: 59 })).toBe(false);

      expect(isRuleContextApplicable('R02', { ...baseTrip, rain_prob_pct: 45 })).toBe(true);
      expect(isRuleContextApplicable('R02', { ...baseTrip, rain_prob_pct: 25 })).toBe(false);

      expect(isRuleContextApplicable('R18', { ...baseTrip, rain_prob_pct: 50 })).toBe(true);
      expect(isRuleContextApplicable('R18', { ...baseTrip, rain_prob_pct: 49 })).toBe(false);
    });

    it('accurately evaluates cold temperature rules (R03, R04, R14)', () => {
      expect(isRuleContextApplicable('R03', { ...baseTrip, temp_min_c: 10 })).toBe(true);
      expect(isRuleContextApplicable('R03', { ...baseTrip, temp_min_c: 11 })).toBe(false);

      expect(isRuleContextApplicable('R04', { ...baseTrip, temp_min_c: 15 })).toBe(true);
      expect(isRuleContextApplicable('R04', { ...baseTrip, temp_min_c: 16 })).toBe(false);
    });

    it('accurately evaluates difficulty and terrain rules (R06, R08, R09)', () => {
      expect(isRuleContextApplicable('R06', { ...baseTrip, difficulty: 4 })).toBe(true);
      expect(isRuleContextApplicable('R06', { ...baseTrip, difficulty: 3 })).toBe(false);

      expect(isRuleContextApplicable('R09', { ...baseTrip, terrain: ['muddy'] })).toBe(true);
      expect(isRuleContextApplicable('R09', { ...baseTrip, terrain: ['rocky'] })).toBe(true);
      expect(isRuleContextApplicable('R09', { ...baseTrip, terrain: ['forest', 'flat'] })).toBe(false);
    });

    it('accurately evaluates backpack days duration rules (R15, R16, R17)', () => {
      expect(isRuleContextApplicable('R15', { ...baseTrip, days: 1 })).toBe(true);
      expect(isRuleContextApplicable('R16', { ...baseTrip, days: 2 })).toBe(true);
      expect(isRuleContextApplicable('R16', { ...baseTrip, days: 3 })).toBe(true);
      expect(isRuleContextApplicable('R17', { ...baseTrip, days: 4 })).toBe(true);
    });
  });

  describe('Section 3: Requirement Builder', () => {
    it('always produces baseline REQUIRED for JACKET, FOOTWEAR, and BACKPACK (R26)', () => {
      const requirements = buildTripRequirements(baseTrip);
      const categories = requirements.map((r) => r.category);

      expect(categories).toContain('JACKET');
      expect(categories).toContain('FOOTWEAR');
      expect(categories).toContain('BACKPACK');

      const jacket = requirements.find((r) => r.category === 'JACKET')!;
      expect(jacket.priority).toBe('REQUIRED');
      expect(jacket.quantity).toBe(1);

      // Rain >= 60% -> R01 waterproof_mm >= 5000 (canonical MASTER)
      const wpConstraint = jacket.constraints.find((c) => c.field === 'waterproof_mm');
      expect(wpConstraint).toBeDefined();
      expect(wpConstraint?.expected).toBe(5000);

      // Temp <= 10 -> R03 temp_rating_c <= 8
      const tempConstraint = jacket.constraints.find((c) => c.field === 'temp_rating_c');
      expect(tempConstraint).toBeDefined();
      expect(tempConstraint?.expected).toBe(8);
    });

    it('verifies R01 jacket 5000mm is COVERED_BY_OWNED and R07 boots waterproof=false is rejected', () => {
      const probeTrip: TripContext = {
        temp_min_c: 20,
        temp_max_c: 28,
        temp_min_night_c: 18,
        rain_prob_pct: 65,
        difficulty: 1,
        days: 1,
        terrain: ['forest'],
      };

      const reqs = buildTripRequirements(probeTrip);
      const items: CoreGearItemInput[] = [
        {
          id: 'jacket-5000',
          category: 'JACKET',
          condition: 'GOOD',
          attributes: { waterproof_mm: 5000 },
        },
        {
          id: 'boots-not-wp',
          category: 'FOOTWEAR',
          condition: 'GOOD',
          attributes: { waterproof: false, grip_level: 5 },
        },
      ];

      const res = resolvePlanCoverage(items, reqs, probeTrip);
      const jacketCov = res.requirements.find((r) => r.category === 'JACKET')!;
      expect(jacketCov.status).toBe('COVERED_BY_OWNED');

      const footwearCov = res.requirements.find((r) => r.category === 'FOOTWEAR')!;
      expect(footwearCov.status).toBe('NEEDS_REPLACEMENT');
    });

    it('marks all-null attributes as UNKNOWN instead of COVERED_BY_OWNED', () => {
      const probeTrip: TripContext = {
        temp_min_c: 20,
        temp_max_c: 25,
        temp_min_night_c: 18,
        rain_prob_pct: 20,
        difficulty: 1,
        days: 1,
        terrain: ['forest'],
      };

      const reqs = buildTripRequirements(probeTrip);
      const items: CoreGearItemInput[] = [
        {
          id: 'jacket-empty',
          category: 'JACKET',
          condition: 'GOOD',
          attributes: {},
        },
      ];

      const res = resolvePlanCoverage(items, reqs, probeTrip);
      const jacketCov = res.requirements.find((r) => r.category === 'JACKET')!;
      expect(jacketCov.status).toBe('UNKNOWN');
    });

    it('requires two physical items for quantity 2 requirement', () => {
      const reqWithQty2: PlanRequirement = {
        id: 'req_tent_qty2',
        category: 'TENT',
        priority: 'REQUIRED',
        quantity: 2,
        constraints: [],
        source: 'USER_REQUEST',
        description: '2 lều cắm trại',
      };

      const items: CoreGearItemInput[] = [
        {
          id: 'tent-1',
          category: 'TENT',
          condition: 'GOOD',
          attributes: { capacity_persons: 2 },
        },
      ];

      const res = resolvePlanCoverage(items, [reqWithQty2], baseTrip);
      const tentCov = res.requirements.find((r) => r.requirementId === 'req_tent_qty2')!;
      expect(tentCov.status).toBe('NEEDS_REPLACEMENT');
      expect(res.summary.isFullyCovered).toBe(false);
    });

    it('preserves distinct checklist items when multiple requirements share the same category', () => {
      const tentReq1: PlanRequirement = {
        id: 'req_tent_1',
        category: 'TENT',
        priority: 'REQUIRED',
        quantity: 1,
        constraints: [],
        source: 'USER_REQUEST',
        description: 'Lều 1',
      };
      const tentReq2: PlanRequirement = {
        id: 'req_tent_2',
        category: 'TENT',
        priority: 'REQUIRED',
        quantity: 1,
        constraints: [],
        source: 'USER_REQUEST',
        description: 'Lều 2',
      };

      const res = resolvePlanCoverage([], [tentReq1, tentReq2], baseTrip);
      expect(res.requirements.length).toBe(2);
      expect(res.checklist.length).toBe(2);
      expect(res.checklist.map((c) => c.requirementId)).toEqual(['req_tent_1', 'req_tent_2']);
    });

    it('produces deterministic item assignment independent of candidate input order', () => {
      const req: PlanRequirement = {
        id: 'req_tent_single',
        category: 'TENT',
        priority: 'REQUIRED',
        quantity: 1,
        constraints: [],
        source: 'USER_REQUEST',
        description: 'Lều đơn',
      };

      const itemA: CoreGearItemInput = {
        id: 'item-a',
        category: 'TENT',
        condition: 'GOOD',
        attributes: { capacity_persons: 2 },
      };
      const itemB: CoreGearItemInput = {
        id: 'item-b',
        category: 'TENT',
        condition: 'GOOD',
        attributes: { capacity_persons: 2 },
      };

      const resOrder1 = resolvePlanCoverage([itemA, itemB], [req], baseTrip);
      const resOrder2 = resolvePlanCoverage([itemB, itemA], [req], baseTrip);

      expect(resOrder1.requirements[0].assignedItemIds).toEqual(['item-a']);
      expect(resOrder2.requirements[0].assignedItemIds).toEqual(['item-a']);
    });

    it('allows explicit user/trip needs to be added without forcing arbitrary requirements', () => {
      const explicitTent: PlanRequirement = {
        id: 'req_tent',
        category: 'TENT',
        priority: 'REQUIRED',
        quantity: 1,
        constraints: [{ field: 'capacity_persons', op: 'GTE', expected: 2 }],
        source: 'USER_REQUEST',
        description: 'Lều 2 người tự túc',
      };

      const requirements = buildTripRequirements(baseTrip, [explicitTent]);
      expect(requirements.map((r) => r.category)).toContain('TENT');
    });
  });

  describe('Section 4: Pure Coverage Resolver', () => {
    it('rejects duplicate item IDs with explicit error', () => {
      const duplicateItems: CoreGearItemInput[] = [
        { id: 'item-1', category: 'JACKET', condition: 'GOOD', attributes: { waterproof_mm: 12000 } },
        { id: 'item-1', category: 'JACKET', condition: 'GOOD', attributes: { waterproof_mm: 12000 } },
      ];
      const requirements = buildTripRequirements(baseTrip);

      expect(() => resolvePlanCoverage(duplicateItems, requirements, baseTrip)).toThrow(
        /Duplicate item ID detected/i,
      );
    });

    it('resolves multi-item case: assigns good jacket to requirement without forcing rental despite bad jacket', () => {
      const items: CoreGearItemInput[] = [
        // Bad jacket: fails waterproof (only 2000mm vs required 10000mm)
        {
          id: 'jacket-bad',
          category: 'JACKET',
          condition: 'GOOD',
          attributes: { waterproof_mm: 2000, temp_rating_c: 5, windproof: true },
        },
        // Good jacket: satisfies all constraints
        {
          id: 'jacket-good',
          category: 'JACKET',
          condition: 'GOOD',
          attributes: { waterproof_mm: 15000, temp_rating_c: 0, windproof: true, weight_g: 400 },
        },
        // Good footwear
        {
          id: 'footwear-1',
          category: 'FOOTWEAR',
          condition: 'GOOD',
          attributes: { waterproof: true, ankle_support: true, grip_level: 5 },
        },
        // Good backpack (45L for 3-day trip, rain_cover true)
        {
          id: 'backpack-1',
          category: 'BACKPACK',
          condition: 'GOOD',
          attributes: { capacity_l: 45, rain_cover: true, waterproof: false },
        },
      ];

      const requirements = buildTripRequirements(baseTrip);
      const result = resolvePlanCoverage(items, requirements, baseTrip);

      const jacketCoverage = result.requirements.find((r) => r.category === 'JACKET')!;
      expect(jacketCoverage.status).toBe('COVERED_BY_OWNED');
      expect(jacketCoverage.assignedItemIds).toEqual(['jacket-good']);
      expect(jacketCoverage.recommendedAction).toBe('USE_OWNED');

      // Fully covered: 3 required, 3 covered by owned
      expect(result.summary.requiredCount).toBe(3);
      expect(result.summary.coveredOwnedCount).toBe(3);
      expect(result.summary.plannedRentalCount).toBe(0);
      expect(result.summary.isFullyCovered).toBe(true);
    });

    it('flags UNKNOWN when item has missing relevant technical attribute', () => {
      const items: CoreGearItemInput[] = [
        {
          id: 'jacket-incomplete',
          category: 'JACKET',
          condition: 'GOOD',
          attributes: { waterproof_mm: null, temp_rating_c: 5, windproof: true },
        },
      ];

      const requirements = buildTripRequirements(baseTrip);
      const result = resolvePlanCoverage(items, requirements, baseTrip);

      const jacketCoverage = result.requirements.find((r) => r.category === 'JACKET')!;
      expect(jacketCoverage.status).toBe('UNKNOWN');
      expect(jacketCoverage.recommendedAction).toBe('COMPLETE_ATTRIBUTES');
      expect(jacketCoverage.missingFields).toContain('waterproof_mm');
    });

    it('flags NEEDS_REPLACEMENT when user owns item in category but condition is POOR or fails constraints', () => {
      const items: CoreGearItemInput[] = [
        {
          id: 'jacket-poor',
          category: 'JACKET',
          condition: 'POOR',
          attributes: { waterproof_mm: 15000, temp_rating_c: 0, windproof: true, weight_g: 400 },
        },
      ];

      const requirements = buildTripRequirements(baseTrip);
      const result = resolvePlanCoverage(items, requirements, baseTrip);

      const jacketCoverage = result.requirements.find((r) => r.category === 'JACKET')!;
      expect(jacketCoverage.status).toBe('NEEDS_REPLACEMENT');
      expect(jacketCoverage.recommendedAction).toBe('RENT');
    });

    it('rejects hot-heavy jacket under R05 (hot trip) in coverage with NEEDS_REPLACEMENT', () => {
      const hotTrip: TripContext = {
        temp_min_c: 30,
        temp_max_c: 35,
        temp_min_night_c: 25,
        rain_prob_pct: 0,
        difficulty: 1,
        days: 1,
        terrain: ['trail'],
      };
      const items: CoreGearItemInput[] = [
        {
          id: 'jacket-hot-heavy',
          category: 'JACKET',
          condition: 'GOOD',
          attributes: { temp_rating_c: 5, weight_g: 700, waterproof_mm: 5000 },
        },
      ];

      const requirements = buildTripRequirements(hotTrip);
      const result = resolvePlanCoverage(items, requirements, hotTrip);

      const jacketCoverage = result.requirements.find((r) => r.category === 'JACKET')!;
      expect(jacketCoverage.status).toBe('NEEDS_REPLACEMENT');
      expect(jacketCoverage.recommendedAction).toBe('RENT');
    });

    it('flags MISSING with RENT action when user owns no items for a required category', () => {
      const requirements = buildTripRequirements(baseTrip);
      const result = resolvePlanCoverage([], requirements, baseTrip);

      for (const req of result.requirements) {
        expect(req.status).toBe('MISSING');
        expect(req.recommendedAction).toBe('RENT');
      }
      expect(result.summary.plannedRentalCount).toBe(0);
      expect(result.summary.unresolvedCount).toBe(3);
      expect(result.summary.isFullyCovered).toBe(false);
    });

    it('enforces 1-to-1 physical item assignment (item cannot be assigned to two slots)', () => {
      const items: CoreGearItemInput[] = [
        {
          id: 'backpack-multi',
          category: 'BACKPACK',
          condition: 'GOOD',
          attributes: { capacity_l: 50, rain_cover: true, waterproof: false },
        },
      ];

      // Two backpack requirements
      const requirements: PlanRequirement[] = [
        {
          id: 'req_backpack_1',
          category: 'BACKPACK',
          priority: 'REQUIRED',
          quantity: 1,
          constraints: [{ field: 'capacity_l', op: 'GTE', expected: 35 }],
          source: 'SYSTEM_BASELINE',
          description: 'Balo chính',
        },
        {
          id: 'req_backpack_2',
          category: 'BACKPACK',
          priority: 'REQUIRED',
          quantity: 1,
          constraints: [{ field: 'capacity_l', op: 'GTE', expected: 35 }],
          source: 'SYSTEM_BASELINE',
          description: 'Balo phụ',
        },
      ];

      const result = resolvePlanCoverage(items, requirements, baseTrip);
      const cov1 = result.requirements.find((r) => r.requirementId === 'req_backpack_1')!;
      const cov2 = result.requirements.find((r) => r.requirementId === 'req_backpack_2')!;

      expect(cov1.status).toBe('COVERED_BY_OWNED');
      expect(cov1.assignedItemIds).toEqual(['backpack-multi']);
      // Second requirement cannot reuse the same physical item
      expect(cov2.status).toBe('MISSING');
      expect(cov2.assignedItemIds).toEqual([]);
    });
  });
});

