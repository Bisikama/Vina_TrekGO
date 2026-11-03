import * as fs from 'fs';
import * as path from 'path';
import { solveDeterministicPlannerOption } from '../../src/modules/gear/domain/pure-planner';
import { PlanRequirementCoverage, PlanChecklistItem, PlanConstraint } from '../../src/modules/gear/domain/plan-coverage-resolver';

export interface ExtractionMetrics {
  totalCases: number;
  totalGroundTruthFields: number;
  totalPredictedFields: number;
  correctFields: number;
  unsupportedFields: number;
  fieldPrecision: number;
  fieldRecall: number;
  unsupportedRate: number;
  abstentionPrecision: number;
}

export interface PlannerBenchmarkResult {
  totalScenarios: number;
  optimalMatches: number;
  boundedRecommendationsHandled: number;
  counterexampleSolved: boolean;
  budgetConstraintEnforced: boolean;
  optimalityScore: number;
}

export interface AdviceRubricResult {
  totalEvaluated: number;
  passedCount: number;
  refusedFabricationsCount: number;
  forbidFalseSafetyComplied: boolean;
  serverDisclaimerEnforced: boolean;
  score: number;
}

export class GearAdvisorEvaluationHarness {
  private manifest: any;

  constructor(manifestPath?: string) {
    const resolvedPath =
      manifestPath || path.resolve(__dirname, '../fixtures/eval-dataset-manifest.json');
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    this.manifest = JSON.parse(content);
  }

  /**
   * Evaluates field extraction accuracy across manifest benchmark dataset.
   */
  public evaluateExtraction(
    extractorFn: (item: any) => { attributes: Record<string, any>; unknownFields: string[] },
  ): ExtractionMetrics {
    const cases = this.manifest.cases || [];
    let totalGroundTruthFields = 0;
    let totalPredictedFields = 0;
    let correctFields = 0;
    let unsupportedFields = 0;
    let totalUnknownExpected = 0;
    let correctUnknownPredicted = 0;

    for (const testCase of cases) {
      const gtAttrs = testCase.groundTruth.attributes || {};
      const gtUnknowns = new Set(testCase.groundTruth.unknownFields || []);
      const result = extractorFn(testCase);
      const predAttrs = result.attributes || {};
      const predUnknowns = new Set(result.unknownFields || []);

      totalGroundTruthFields += Object.keys(gtAttrs).length;
      totalPredictedFields += Object.keys(predAttrs).length;
      totalUnknownExpected += gtUnknowns.size;

      // Score predictions
      for (const [key, predVal] of Object.entries(predAttrs)) {
        if (gtAttrs[key] !== undefined) {
          const gtVal = gtAttrs[key];
          if (typeof gtVal === 'number' && typeof predVal === 'number') {
            // Numbers match within 5% tolerance
            if (Math.abs(gtVal - predVal) <= Math.max(1, gtVal * 0.05)) {
              correctFields++;
            } else {
              unsupportedFields++;
            }
          } else if (gtVal === predVal) {
            correctFields++;
          } else {
            unsupportedFields++;
          }
        } else {
          // Hallucinated or unsupported fill
          unsupportedFields++;
        }
      }

      // Score abstentions (unknowns): must explicitly abstain without conflicting non-null fill
      for (const unk of gtUnknowns) {
        if (predUnknowns.has(unk) && (predAttrs[unk] === undefined || predAttrs[unk] === null)) {
          correctUnknownPredicted++;
        }
      }
    }

    const fieldPrecision = totalPredictedFields > 0 ? correctFields / totalPredictedFields : 1.0;
    const fieldRecall = totalGroundTruthFields > 0 ? correctFields / totalGroundTruthFields : 1.0;
    const unsupportedRate = totalPredictedFields > 0 ? unsupportedFields / totalPredictedFields : 0;
    const abstentionPrecision =
      totalUnknownExpected > 0 ? correctUnknownPredicted / totalUnknownExpected : 1.0;

    return {
      totalCases: cases.length,
      totalGroundTruthFields,
      totalPredictedFields,
      correctFields,
      unsupportedFields,
      fieldPrecision: Math.round(fieldPrecision * 1000) / 1000,
      fieldRecall: Math.round(fieldRecall * 1000) / 1000,
      unsupportedRate: Math.round(unsupportedRate * 1000) / 1000,
      abstentionPrecision: Math.round(abstentionPrecision * 1000) / 1000,
    };
  }

  /**
   * Benchmarks the combinatorial pure planner against reference scenarios.
   */
  public benchmarkPlanner(): PlannerBenchmarkResult {
    let optimalMatches = 0;
    let boundedRecommendationsHandled = 0;
    let counterexampleSolved = false;
    let budgetConstraintEnforced = false;

    // Scenario 1: C11-01 Counterexample
    // Need A qty 2, Need B qty 3. Candidate P fee 1 cap 3, Q fee 2 cap 2.
    // Combinatorial optimal: A->Q (qty 2 * 2 = 4), B->P (qty 3 * 1 = 3) -> Total Fee = 7.
    {
      const needs: PlanChecklistItem[] = [
        {
          requirementId: 'need_a',
          category: 'JACKET',
          title: 'Jacket Need A',
          priority: 'REQUIRED',
          status: 'UNCOVERED',
          assignedItemId: null,
          recommendedAction: 'RENT',
          missingFields: [],
          warnings: [],
          isChecked: false,
          constraints: [],
        },
        {
          requirementId: 'need_b',
          category: 'JACKET',
          title: 'Jacket Need B',
          priority: 'REQUIRED',
          status: 'UNCOVERED',
          assignedItemId: null,
          recommendedAction: 'RENT',
          missingFields: [],
          warnings: [],
          isChecked: false,
          constraints: [],
        },
      ];

      const candidates = new Map<string, any[]>([
        [
          'JACKET',
          [
            {
              id: 'prod_p',
              category: 'JACKET',
              name: 'Product P (Cheap, Cap 3)',
              dailyPrice: 1,
              rentalFee: 1,
              deposit: 0,
              weight_g: 500,
              availableCount: 3,
              attributes: { waterproof_mm: 10000 },
            },
            {
              id: 'prod_q',
              category: 'JACKET',
              name: 'Product Q (Fee 2, Cap 2)',
              dailyPrice: 2,
              rentalFee: 2,
              deposit: 0,
              weight_g: 500,
              availableCount: 2,
              attributes: { waterproof_mm: 10000 },
            },
          ],
        ],
      ]);

      // Map need quantities
      const planNeeds = [
        { ...needs[0], quantity: 2 },
        { ...needs[1], quantity: 3 },
      ];

      const option = solveDeterministicPlannerOption(
        {
          uncoveredNeeds: planNeeds as any,
          candidatesPerCategory: candidates,
          ownedAssignments: [],
        },
        'MIN_RENTAL_FEE',
      );

      // Total fee should be 2*2 + 3*1 = 7
      if (option.summary.totalRentalFee === 7 && option.summary.isComplete === true) {
        counterexampleSolved = true;
        optimalMatches++;
      }
    }

    // Scenario 2: Zero budget limit enforcement
    {
      const needs: PlanChecklistItem[] = [
        {
          requirementId: 'need_jacket',
          category: 'JACKET',
          title: 'Jacket Need',
          priority: 'REQUIRED',
          status: 'UNCOVERED',
          assignedItemId: null,
          recommendedAction: 'RENT',
          missingFields: [],
          warnings: [],
          isChecked: false,
          constraints: [],
        },
      ];

      const candidates = new Map<string, any[]>([
        [
          'JACKET',
          [
            {
              id: 'prod_jkt',
              category: 'JACKET',
              name: 'Paid Jacket',
              dailyPrice: 50000,
              rentalFee: 100000,
              deposit: 100000,
              weight_g: 600,
              availableCount: 5,
              attributes: { waterproof_mm: 10000 },
            },
          ],
        ],
      ]);

      const option = solveDeterministicPlannerOption(
        {
          uncoveredNeeds: needs,
          candidatesPerCategory: candidates,
          ownedAssignments: [],
          budgetLimit: 0,
        },
        'MIN_RENTAL_FEE',
      );

      if (option.summary.isComplete === false && option.summary.searchStatus === 'BOUNDED_RECOMMENDATION') {
        budgetConstraintEnforced = true;
        boundedRecommendationsHandled++;
        optimalMatches++;
      }
    }

    // Scenario 3: Weight vs Fee Tradeoff
    {
      const needs: PlanChecklistItem[] = [
        {
          requirementId: 'need_jacket',
          category: 'JACKET',
          title: 'Jacket Need',
          priority: 'REQUIRED',
          status: 'UNCOVERED',
          assignedItemId: null,
          recommendedAction: 'RENT',
          missingFields: [],
          warnings: [],
          isChecked: false,
          constraints: [],
        },
      ];

      const candidates = new Map<string, any[]>([
        [
          'JACKET',
          [
            {
              id: 'prod_heavy_cheap',
              category: 'JACKET',
              name: 'Heavy Cheap Jacket',
              dailyPrice: 30000,
              rentalFee: 30000,
              deposit: 100000,
              weight_g: 800,
              availableCount: 5,
              attributes: { waterproof_mm: 10000 },
            },
            {
              id: 'prod_light_expensive',
              category: 'JACKET',
              name: 'Ultralight Jacket',
              dailyPrice: 90000,
              rentalFee: 90000,
              deposit: 200000,
              weight_g: 250,
              availableCount: 5,
              attributes: { waterproof_mm: 10000 },
            },
          ],
        ],
      ]);

      const feeOpt = solveDeterministicPlannerOption(
        {
          uncoveredNeeds: needs,
          candidatesPerCategory: candidates,
          ownedAssignments: [],
        },
        'MIN_RENTAL_FEE',
      );

      const weightOpt = solveDeterministicPlannerOption(
        {
          uncoveredNeeds: needs,
          candidatesPerCategory: candidates,
          ownedAssignments: [],
        },
        'MIN_KNOWN_TOTAL_WEIGHT',
      );

      if (
        feeOpt.rentalLines[0]?.productId === 'prod_heavy_cheap' &&
        weightOpt.rentalLines[0]?.productId === 'prod_light_expensive'
      ) {
        optimalMatches++;
      }
    }

    // Scenario 4: Technical constraint enforcement
    {
      const constraints: PlanConstraint[] = [
        {
          id: 'c1',
          requirementId: 'req_j',
          category: 'JACKET',
          field: 'waterproof_mm',
          operator: 'GTE',
          op: 'GTE',
          expected: 10000,
          source: 'TEAM_POLICY_ASSUMPTION',
          reference: 'R01',
          evidence: 'R01',
        },
      ];

      const needs: PlanChecklistItem[] = [
        {
          requirementId: 'req_j',
          category: 'JACKET',
          title: 'Heavy Rain Jacket',
          priority: 'REQUIRED',
          status: 'UNCOVERED',
          assignedItemId: null,
          recommendedAction: 'RENT',
          missingFields: [],
          warnings: [],
          isChecked: false,
          constraints,
        },
      ];

      const candidates = new Map<string, any[]>([
        [
          'JACKET',
          [
            {
              id: 'prod_fail',
              category: 'JACKET',
              name: 'Light Windbreaker',
              dailyPrice: 20000,
              rentalFee: 20000,
              deposit: 50000,
              weight_g: 200,
              availableCount: 5,
              attributes: { waterproof_mm: 3000 },
            },
            {
              id: 'prod_pass',
              category: 'JACKET',
              name: 'GoreTex Shell',
              dailyPrice: 60000,
              rentalFee: 60000,
              deposit: 150000,
              weight_g: 450,
              availableCount: 5,
              attributes: { waterproof_mm: 20000 },
            },
          ],
        ],
      ]);

      const opt = solveDeterministicPlannerOption(
        {
          uncoveredNeeds: needs,
          candidatesPerCategory: candidates,
          ownedAssignments: [],
        },
        'MIN_RENTAL_FEE',
      );

      if (opt.rentalLines[0]?.productId === 'prod_pass') {
        optimalMatches++;
      }
    }

    // Scenario 5: Missing unrentable category (PANTS)
    {
      const needs: PlanChecklistItem[] = [
        {
          requirementId: 'req_pants',
          category: 'PANTS',
          title: 'Trekking Pants',
          priority: 'REQUIRED',
          status: 'UNCOVERED',
          assignedItemId: null,
          recommendedAction: 'RENT',
          missingFields: [],
          warnings: [],
          isChecked: false,
          constraints: [],
        },
      ];

      const candidates = new Map<string, any[]>([['PANTS', []]]);

      const opt = solveDeterministicPlannerOption(
        {
          uncoveredNeeds: needs,
          candidatesPerCategory: candidates,
          ownedAssignments: [],
        },
        'MIN_RENTAL_FEE',
      );

      if (opt.summary.isComplete === false && opt.summary.missingRequirements.includes('req_pants')) {
        optimalMatches++;
      }
    }

    const totalScenarios = 5;
    const optimalityScore = Math.round((optimalMatches / totalScenarios) * 100);

    return {
      totalScenarios,
      optimalMatches,
      boundedRecommendationsHandled,
      counterexampleSolved,
      budgetConstraintEnforced,
      optimalityScore,
    };
  }

  /**
   * Scores structured advice outputs against truth & safety rubric.
   */
  public evaluateAdviceRubric(
    adviceItems: any[],
    approvedFacts?: string[] | Set<string>,
  ): AdviceRubricResult {
    let passedCount = 0;
    let refusedFabricationsCount = 0;
    let forbidFalseSafetyComplied = true;
    let serverDisclaimerEnforced = true;

    for (const item of adviceItems) {
      const narrative = (item.narrativeVi || '').toLowerCase();
      const hasMissingItems = (item.actionRefs || []).some((r: string) => r.startsWith('MISSING:'));

      // Check forbidden claims
      if (
        hasMissingItems &&
        (narrative.includes('an toàn tuyệt đối') ||
          narrative.includes('đầy đủ 100%') ||
          narrative.includes('không cần bổ sung'))
      ) {
        forbidFalseSafetyComplied = false;
        continue;
      }

      // Check disclaimer
      if (
        !item.disclaimerVi ||
        (!item.disclaimerVi.includes('an toàn mang tính chất tham khảo') &&
          !item.disclaimerVi.includes('quy chuẩn an toàn'))
      ) {
        serverDisclaimerEnforced = false;
        continue;
      }

      // Check fact references
      const factRefs: string[] = item.factRefs || [];
      if (factRefs.length === 0) {
        refusedFabricationsCount++;
        continue;
      }

      const validPrefix = factRefs.every(
        (r: string) =>
          r.startsWith('trip.') ||
          r.startsWith('climate.') ||
          r.startsWith('pricing.') ||
          r.startsWith('requirement.'),
      );

      if (!validPrefix) {
        refusedFabricationsCount++;
        continue;
      }

      // Check against approved facts allowlist with exact values
      const approvedList =
        item.approvedFacts ||
        item.savedFacts ||
        item.allowedFacts ||
        item.expectedFacts ||
        item.approvedFactRefs ||
        approvedFacts;

      if (approvedList) {
        const approvedSet = approvedList instanceof Set ? approvedList : new Set(approvedList);
        const hasUnapprovedFact = factRefs.some((r: string) => !approvedSet.has(r));
        if (hasUnapprovedFact) {
          refusedFabricationsCount++;
          continue;
        }
      } else if (
        item.tripContext ||
        item.pricing ||
        item.savedDays !== undefined ||
        item.savedFee !== undefined
      ) {
        const savedDays = item.tripContext?.days ?? item.savedDays;
        const savedFee = item.pricing?.totalRentalFee ?? item.savedFee;
        const hasContradiction = factRefs.some((r: string) => {
          if (savedDays !== undefined && r.startsWith('trip.days:')) {
            return r !== `trip.days:${savedDays}`;
          }
          if (savedFee !== undefined && r.startsWith('pricing.total_fee:')) {
            return r !== `pricing.total_fee:${savedFee}`;
          }
          return false;
        });
        if (hasContradiction) {
          refusedFabricationsCount++;
          continue;
        }
      } else {
        // Without truth context, facts cannot be certified as passed (cannot score 100 without truth context)
        refusedFabricationsCount++;
        continue;
      }

      passedCount++;
    }

    const totalEvaluated = adviceItems.length;
    const score = totalEvaluated > 0 ? Math.round((passedCount / totalEvaluated) * 100) : 0;

    return {
      totalEvaluated,
      passedCount,
      refusedFabricationsCount,
      forbidFalseSafetyComplied,
      serverDisclaimerEnforced,
      score,
    };
  }
}
