import { GearAdvisorEvaluationHarness } from './eval/evaluation-scorer';
import { solveDeterministicPlannerOption } from '../src/modules/gear/domain/pure-planner';

describe('Gear Advisor V3.1.5 — Phase 16 Evaluation Harness & Benchmarks', () => {
  let harness: GearAdvisorEvaluationHarness;

  beforeAll(() => {
    harness = new GearAdvisorEvaluationHarness();
  });

  describe('Benchmark 1: Field Extraction Precision, Recall & Abstention (SCORER_SELF_TEST)', () => {
    it('evaluates extraction metrics across 45 synthetic benchmark fixtures (labeled SCORER_SELF_TEST)', () => {
      // SCORER_SELF_TEST: Deterministic formula validation on synthetic fixtures
      const metrics = harness.evaluateExtraction((testCase) => {
        return {
          attributes: { ...testCase.groundTruth.attributes },
          unknownFields: [...(testCase.groundTruth.unknownFields || [])],
        };
      });

      expect(metrics.totalCases).toBe(45);
      expect(metrics.totalGroundTruthFields).toBeGreaterThan(60);
      expect(metrics.fieldPrecision).toBeGreaterThanOrEqual(0.95);
      expect(metrics.fieldRecall).toBeGreaterThanOrEqual(0.95);
      expect(metrics.unsupportedRate).toBeLessThanOrEqual(0.05);
      expect(metrics.abstentionPrecision).toBeGreaterThanOrEqual(0.9);
    });

    it('detects hallucinations and flags unsupported field fills', () => {
      // Intentionally introduce an unsupported hallucinated fill
      const metrics = harness.evaluateExtraction((testCase) => {
        const base = { ...testCase.groundTruth.attributes };
        if (testCase.id === 'TC-JKT-09') {
          // Market poncho hallucinating gore-tex 20,000mm
          base.waterproof_mm = 20000;
        }
        return {
          attributes: base,
          unknownFields: [...(testCase.groundTruth.unknownFields || [])],
        };
      });

      expect(metrics.unsupportedFields).toBeGreaterThan(0);
      expect(metrics.unsupportedRate).toBeGreaterThan(0);
    });
  });

  describe('Benchmark 2: Combinatorial Planner Optimality & Bounds', () => {
    it('solves combinatorial multi-need counterexample, enforces budget 0, and achieves 100% optimality', () => {
      const benchmark = harness.benchmarkPlanner();

      expect(benchmark.totalScenarios).toBe(5);
      expect(benchmark.counterexampleSolved).toBe(true);
      expect(benchmark.budgetConstraintEnforced).toBe(true);
      expect(benchmark.optimalMatches).toBe(5);
      expect(benchmark.optimalityScore).toBe(100);
    });

    it('proves unknown weight does not beat known 100g as 0g under MIN_KNOWN_TOTAL_WEIGHT', () => {

      const candidates = new Map<string, any[]>([
        [
          'JACKET',
          [
            {
              id: 'prod_known',
              name: 'Known 100g Jacket',
              category: 'JACKET',
              dailyPrice: 10,
              rentalFee: 10,
              deposit: 10,
              availableCount: 1,
              weight_g: 100,
              attributes: { waterproof_mm: 5000 },
            },
            {
              id: 'prod_unknown',
              name: 'Unknown Weight Jacket',
              category: 'JACKET',
              dailyPrice: 10,
              rentalFee: 10,
              deposit: 10,
              availableCount: 1,
              weight_g: null,
              attributes: { waterproof_mm: 5000 },
            },
          ],
        ],
      ]);

      const result = solveDeterministicPlannerOption(
        {
          ownedAssignments: [],
          uncoveredNeeds: [
            {
              requirementId: 'req_jkt',
              category: 'JACKET',
              priority: 'REQUIRED',
              quantity: 1,
              constraints: [],
            },
          ],
          candidatesPerCategory: candidates,
        },
        'MIN_KNOWN_TOTAL_WEIGHT',
      );

      // Known 100g item must beat unknown weight (unknown is not 0g!)
      expect(result.rentalLines[0].productId).toBe('prod_known');
      expect(result.summary.weightStatus).toBe('EXACT');
      expect(result.summary.searchStatus).toBe('OPTIMAL_WITHIN_SEARCH_SCOPE');
    });

    it('proves chosen solution with unknown weight cannot claim weight optimal (returns BOUNDED_RECOMMENDATION)', () => {

      const candidates = new Map<string, any[]>([
        [
          'JACKET',
          [
            {
              id: 'prod_unknown_only',
              name: 'Unknown Weight Jacket',
              category: 'JACKET',
              dailyPrice: 10,
              rentalFee: 10,
              deposit: 10,
              availableCount: 1,
              weight_g: null,
              attributes: { waterproof_mm: 5000 },
            },
          ],
        ],
      ]);

      const result = solveDeterministicPlannerOption(
        {
          ownedAssignments: [],
          uncoveredNeeds: [
            {
              requirementId: 'req_jkt',
              category: 'JACKET',
              priority: 'REQUIRED',
              quantity: 1,
              constraints: [],
            },
          ],
          candidatesPerCategory: candidates,
        },
        'MIN_KNOWN_TOTAL_WEIGHT',
      );

      expect(result.rentalLines[0].productId).toBe('prod_unknown_only');
      expect(result.summary.weightStatus).toBe('UNKNOWN');
      expect(result.summary.searchStatus).toBe('BOUNDED_RECOMMENDATION');
    });

    it('splits need quantity 3 across 3 products when needed', () => {

      const candidates = new Map<string, any[]>([
        [
          'TREKKING_POLE',
          [
            {
              id: 'prod_p1',
              name: 'Pole 1',
              category: 'TREKKING_POLE',
              dailyPrice: 5,
              rentalFee: 5,
              deposit: 5,
              availableCount: 1,
              weight_g: 200,
              attributes: { material: 'carbon' },
            },
            {
              id: 'prod_p2',
              name: 'Pole 2',
              category: 'TREKKING_POLE',
              dailyPrice: 5,
              rentalFee: 5,
              deposit: 5,
              availableCount: 1,
              weight_g: 200,
              attributes: { material: 'carbon' },
            },
            {
              id: 'prod_p3',
              name: 'Pole 3',
              category: 'TREKKING_POLE',
              dailyPrice: 5,
              rentalFee: 5,
              deposit: 5,
              availableCount: 1,
              weight_g: 200,
              attributes: { material: 'carbon' },
            },
          ],
        ],
      ]);

      const result = solveDeterministicPlannerOption(
        {
          ownedAssignments: [],
          uncoveredNeeds: [
            {
              requirementId: 'req_poles',
              category: 'TREKKING_POLE',
              priority: 'REQUIRED',
              quantity: 3,
              constraints: [],
            },
          ],
          candidatesPerCategory: candidates,
        },
        'MIN_RENTAL_FEE',
      );

      expect(result.summary.isComplete).toBe(true);
      const totalQty = result.rentalLines.reduce((sum: number, l: any) => sum + l.quantity, 0);
      expect(totalQty).toBe(3);
      expect(result.rentalLines.length).toBe(3);
    });

    it('proves missing optional item does not block required completeness', () => {

      const candidates = new Map<string, any[]>([
        [
          'JACKET',
          [
            {
              id: 'prod_jkt',
              name: 'Standard Jacket',
              category: 'JACKET',
              dailyPrice: 10,
              rentalFee: 10,
              deposit: 10,
              availableCount: 1,
              weight_g: 300,
              attributes: { waterproof_mm: 5000 },
            },
          ],
        ],
        ['PANTS', []], // No candidates available for optional pants
      ]);

      const result = solveDeterministicPlannerOption(
        {
          ownedAssignments: [],
          uncoveredNeeds: [
            {
              requirementId: 'req_jkt',
              category: 'JACKET',
              priority: 'REQUIRED',
              quantity: 1,
              constraints: [],
            },
            {
              requirementId: 'req_pants_opt',
              category: 'PANTS',
              priority: 'OPTIONAL',
              quantity: 1,
              constraints: [],
            },
          ],
          candidatesPerCategory: candidates,
        },
        'MIN_RENTAL_FEE',
      );

      // Required is fulfilled, so isComplete must be true!
      expect(result.summary.isComplete).toBe(true);
      expect(result.summary.missingRequirements).toContain('req_pants_opt');
    });

    it('finds equal-fee global secondary weight optimum (3g instead of 101g)', () => {

      const candidates = new Map<string, any[]>([
        [
          'JACKET',
          [
            {
              id: 'P',
              name: 'Product P',
              category: 'JACKET',
              dailyPrice: 1,
              rentalFee: 1,
              deposit: 1,
              availableCount: 1,
              weight_g: 1,
              attributes: { waterproof_mm: 100 },
            },
            {
              id: 'Q',
              name: 'Product Q',
              category: 'JACKET',
              dailyPrice: 1,
              rentalFee: 1,
              deposit: 1,
              availableCount: 1,
              weight_g: 2,
              attributes: { waterproof_mm: 10 },
            },
            {
              id: 'R',
              name: 'Product R',
              category: 'JACKET',
              dailyPrice: 1,
              rentalFee: 1,
              deposit: 1,
              availableCount: 1,
              weight_g: 100,
              attributes: { waterproof_mm: 100 },
            },
          ],
        ],
      ]);

      const result = solveDeterministicPlannerOption(
        {
          ownedAssignments: [],
          uncoveredNeeds: [
            {
              requirementId: 'NeedA',
              category: 'JACKET',
              priority: 'REQUIRED',
              quantity: 1,
              constraints: [],
            },
            {
              requirementId: 'NeedB',
              category: 'JACKET',
              priority: 'REQUIRED',
              quantity: 1,
              constraints: [
                {
                  id: 'c_test',
                  requirementId: 'NeedB',
                  category: 'JACKET',
                  field: 'waterproof_mm',
                  operator: 'GTE',
                  expected: 100,
                  source: 'TEAM_POLICY_ASSUMPTION',
                  reference: 'R_TEST',
                  evidence: 'R_TEST',
                },
              ],
            },
          ],
          candidatesPerCategory: candidates,
        },
        'MIN_RENTAL_FEE',
      );

      // Fee is 2 in both (A->P, B->R is 101g vs A->Q, B->P is 3g)
      expect(result.summary.totalRentalFee).toBe(2);
      expect(result.summary.totalKnownWeightG).toBe(3);
    });
  });

  describe('Benchmark 3: Safety & Factual Integrity Rubric', () => {
    it('enforces fact allowlists, constant server disclaimers, and forbids false safety assurances', () => {
      const compliantAdvice = [
        {
          narrativeVi: 'Lưu ý kiểm tra trang bị kỹ càng trước giờ xuất phát.',
          factRefs: ['trip.days:2', 'trip.difficulty:3', 'climate.temp_min:10'],
          actionRefs: ['RENT:prod_jkt', 'MISSING:req_pants'],
          disclaimerVi: 'Tư vấn an toàn mang tính chất tham khảo.',
          approvedFacts: ['trip.days:2', 'trip.difficulty:3', 'climate.temp_min:10'],
        },
      ];

      const rubricResult = harness.evaluateAdviceRubric(compliantAdvice);
      expect(rubricResult.score).toBe(100);
      expect(rubricResult.forbidFalseSafetyComplied).toBe(true);
      expect(rubricResult.serverDisclaimerEnforced).toBe(true);
    });

    it('refuses to pass advice when truth context / approved facts are missing (cannot score 100 without truth)', () => {
      const adviceWithoutTruth = [
        {
          narrativeVi: 'Lưu ý kiểm tra trang bị kỹ càng trước giờ xuất phát.',
          factRefs: ['trip.days:999'],
          actionRefs: ['RENT:prod_jkt'],
          disclaimerVi: 'Tư vấn an toàn mang tính chất tham khảo.',
        },
      ];

      const rubricResult = harness.evaluateAdviceRubric(adviceWithoutTruth);
      expect(rubricResult.passedCount).toBe(0);
      expect(rubricResult.score).toBe(0);
      expect(rubricResult.refusedFabricationsCount).toBe(1);
    });

    it('rejects contradictory 100% safe claim when items are missing', () => {
      const contradictoryAdvice = [
        {
          narrativeVi: 'Bạn an toàn tuyệt đối 100% không cần bổ sung gì.',
          factRefs: ['trip.days:2'],
          actionRefs: ['MISSING:req_pants'],
          disclaimerVi: 'Tư vấn an toàn mang tính chất tham khảo.',
        },
      ];

      const rubricResult = harness.evaluateAdviceRubric(contradictoryAdvice);
      expect(rubricResult.forbidFalseSafetyComplied).toBe(false);
      expect(rubricResult.score).toBe(0);
    });

    it('rejects prefixed but false fact values and yields score 0', () => {
      const fabricatedFactAdvice = [
        {
          narrativeVi: 'Lưu ý kiểm tra trang bị kỹ càng trước giờ xuất phát.',
          factRefs: ['trip.days:999', 'pricing.total_fee:1'],
          actionRefs: ['RENT:prod_jkt'],
          disclaimerVi: 'Tư vấn an toàn mang tính chất tham khảo.',
          approvedFacts: ['trip.days:4', 'pricing.total_fee:0'],
        },
      ];

      const rubricResult = harness.evaluateAdviceRubric(fabricatedFactAdvice);
      expect(rubricResult.refusedFabricationsCount).toBe(1);
      expect(rubricResult.passedCount).toBe(0);
      expect(rubricResult.score).toBe(0);
    });
  });
});

