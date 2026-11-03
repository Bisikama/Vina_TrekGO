import { GearCategory, GearCondition, isCoreGearCategory } from './gear.types';
import { TripContext } from './rule-predicates';
import { evaluateGearItem } from './pure-gear-engine';

export interface PlanGearItemInput {
  id: string;
  category: GearCategory;
  condition: GearCondition;
  attributes: Record<string, unknown>;
}

export type RequirementPriority = 'REQUIRED' | 'OPTIONAL';

export type PlanCoverageStatus =
  | 'COVERED_BY_OWNED'
  | 'PLANNED_RENTAL'
  | 'USER_DECLARED_PROVISION'
  | 'NEEDS_REPLACEMENT'
  | 'MISSING'
  | 'UNKNOWN';

export type RecommendedAction =
  | 'USE_OWNED'
  | 'RENT'
  | 'PROVIDE'
  | 'COMPLETE_ATTRIBUTES'
  | 'OPTIONAL_CONSIDER';

export interface PlanConstraint {
  id: string;
  requirementId: string;
  category: GearCategory;
  field: string;
  operator: 'GTE' | 'LTE' | 'EQ' | 'IN';
  op: 'GTE' | 'LTE' | 'EQ' | 'IN';
  expected: number | boolean | string;
  unit?: string;
  source?: string;
  reference?: string;
  evidence?: string;
  rationale?: string;
}

export function createPlanConstraint(
  reqId: string,
  category: GearCategory,
  field: string,
  op: 'GTE' | 'LTE' | 'EQ' | 'IN',
  expected: number | boolean | string,
  unit?: string,
  rationale?: string,
): PlanConstraint {
  return {
    id: `${reqId}_${field}_${op.toLowerCase()}`,
    requirementId: reqId,
    category,
    field,
    operator: op,
    op,
    expected,
    unit,
    source: 'TEAM_POLICY_ASSUMPTION',
    reference: rationale,
    evidence: rationale,
    rationale,
  };
}

export interface PlanRequirement {
  id: string;
  category: GearCategory;
  priority: RequirementPriority;
  quantity: number;
  constraints: PlanConstraint[];
  source: 'SYSTEM_BASELINE' | 'TRIP_OFFICIAL' | 'USER_REQUEST';
  description: string;
}

export interface PlanRequirementCoverage {
  requirementId: string;
  category: GearCategory;
  priority: RequirementPriority;
  quantity: number;
  remainingQuantity: number;
  status: PlanCoverageStatus;
  assignedItemIds: string[];
  missingFields: string[];
  warnings: string[];
  recommendedAction: RecommendedAction;
  constraints?: PlanConstraint[];
}

export interface PlanChecklistItem {
  requirementId: string;
  category: GearCategory;
  title: string;
  priority: RequirementPriority;
  status: PlanCoverageStatus;
  assignedItemId: string | null;
  assignedItemIds: string[];
  quantity: number;
  remainingQuantity: number;
  recommendedAction: RecommendedAction;
  missingFields: string[];
  warnings: string[];
  isChecked: boolean;
  note?: string;
  constraints?: PlanConstraint[];
}

export interface PlanCoverageSummary {
  requiredCount: number;
  coveredOwnedCount: number;
  plannedRentalCount: number;
  userDeclaredCount: number;
  unresolvedCount: number;
  unknownCount: number;
  isFullyCovered: boolean;
}

export interface PlanCoverageResult {
  requirements: PlanRequirementCoverage[];
  summary: PlanCoverageSummary;
  checklist: PlanChecklistItem[];
}

/**
 * MASTER 7.1: Trip condition applicability metadata per canonical rule.
 * Determines if a rule's condition is activated by the trip context.
 */
export function isRuleContextApplicable(ruleId: string, trip: TripContext): boolean {
  switch (ruleId) {
    case 'R01':
    case 'R07':
    case 'R12':
      return trip.rain_prob_pct >= 60;
    case 'R02':
      return trip.rain_prob_pct >= 30 && trip.rain_prob_pct < 60;
    case 'R03':
    case 'R13':
      return trip.temp_min_c <= 10;
    case 'R04':
      return trip.temp_min_c <= 15;
    case 'R05':
      return trip.temp_min_c >= 25;
    case 'R06':
    case 'R08':
    case 'R11':
      return trip.difficulty >= 4;
    case 'R09':
      return trip.terrain.some((t) => t.toLowerCase() === 'muddy' || t.toLowerCase() === 'rocky');
    case 'R10':
      return trip.days >= 3 && trip.rain_prob_pct >= 30;
    case 'R14':
      return trip.temp_min_c <= 12;
    case 'R15':
      return trip.days === 1;
    case 'R16':
      return trip.days >= 2 && trip.days <= 3;
    case 'R17':
      return trip.days >= 4;
    case 'R18':
      return trip.rain_prob_pct >= 50;
    case 'R19':
    case 'R20':
    case 'R21':
      return true;
    case 'R22':
      return trip.temp_min_night_c >= 22;
    case 'R23':
      return trip.days >= 3;
    default:
      return false;
  }
}

/**
 * Builds canonical requirements based on Trip facts and optional explicit needs.
 * Baseline REQUIRED: JACKET, FOOTWEAR, BACKPACK (R26).
 */
export function buildTripRequirements(
  tripContext: TripContext,
  explicitNeeds?: PlanRequirement[],
): PlanRequirement[] {
  const requirements: PlanRequirement[] = [];

  // 1. Baseline REQUIRED: JACKET
  const jacketConstraints: PlanConstraint[] = [];
  if (tripContext.rain_prob_pct >= 60) {
    jacketConstraints.push(
      createPlanConstraint('req_jacket', 'JACKET', 'waterproof_mm', 'GTE', 5000, 'mm', 'R01: Mưa lớn (>=60%) yêu cầu áo chống nước >= 5000mm'),
    );
  } else if (tripContext.rain_prob_pct >= 30) {
    jacketConstraints.push(
      createPlanConstraint('req_jacket', 'JACKET', 'waterproof_mm', 'GTE', 3000, 'mm', 'R02: Mưa vừa (30-59%) yêu cầu áo chống nước >= 3000mm'),
    );
  }
  if (tripContext.temp_min_c <= 10) {
    jacketConstraints.push(
      createPlanConstraint('req_jacket', 'JACKET', 'temp_rating_c', 'LTE', tripContext.temp_min_c, '°C', `R03: Nhiệt độ thấp (<=10°C) yêu cầu áo giữ ấm chịu được ${tripContext.temp_min_c}°C`),
    );
  }
  if (tripContext.temp_min_c <= 15) {
    jacketConstraints.push(
      createPlanConstraint('req_jacket', 'JACKET', 'temp_rating_c', 'LTE', tripContext.temp_min_c + 5, '°C', `R04: Trời lạnh (<=15°C) yêu cầu áo giữ ấm chịu được ${tripContext.temp_min_c + 5}°C`),
    );
  }

  requirements.push({
    id: 'req_jacket',
    category: 'JACKET',
    priority: 'REQUIRED',
    quantity: 1,
    constraints: jacketConstraints,
    source: 'SYSTEM_BASELINE',
    description: 'Áo khoác trekking bảo vệ thời tiết',
  });

  // 2. Baseline REQUIRED: FOOTWEAR
  const footwearConstraints: PlanConstraint[] = [];
  if (tripContext.rain_prob_pct >= 60) {
    footwearConstraints.push(
      createPlanConstraint('req_footwear', 'FOOTWEAR', 'waterproof', 'EQ', true, undefined, 'R07: Mưa lớn (>=60%) yêu cầu giày chống nước'),
    );
  } else if (tripContext.days >= 3 && tripContext.rain_prob_pct >= 30) {
    footwearConstraints.push(
      createPlanConstraint('req_footwear', 'FOOTWEAR', 'waterproof', 'EQ', true, undefined, 'R10: Chuyến đi dài ngày (>=3) có mưa (>=30%) yêu cầu giày chống nước'),
    );
  }

  if (tripContext.difficulty >= 4) {
    footwearConstraints.push(
      createPlanConstraint('req_footwear', 'FOOTWEAR', 'ankle_support', 'EQ', true, undefined, 'R08: Cung đường khó (>=4) yêu cầu giày có cổ bảo vệ cổ chân (ankle_support)'),
    );
  }

  const hasWetTerrain = tripContext.terrain.some(
    (t) => t.toLowerCase() === 'muddy' || t.toLowerCase() === 'rocky',
  );
  if (hasWetTerrain) {
    footwearConstraints.push(
      createPlanConstraint('req_footwear', 'FOOTWEAR', 'grip_level', 'GTE', 3, undefined, 'R09: Địa hình bùn lầy/đá dốc yêu cầu độ bám tối thiểu (grip_level >= 3)'),
    );
  } else if (tripContext.difficulty >= 4) {
    footwearConstraints.push(
      createPlanConstraint('req_footwear', 'FOOTWEAR', 'grip_level', 'GTE', 3, undefined, 'R11: Cung đường khó (>=4) yêu cầu độ bám tối thiểu (grip_level >= 3)'),
    );
  }

  requirements.push({
    id: 'req_footwear',
    category: 'FOOTWEAR',
    priority: 'REQUIRED',
    quantity: 1,
    constraints: footwearConstraints,
    source: 'SYSTEM_BASELINE',
    description: 'Giày trekking chuyên dụng theo địa hình',
  });

  // 3. Baseline REQUIRED: BACKPACK
  const backpackConstraints: PlanConstraint[] = [];
  if (tripContext.days === 1) {
    backpackConstraints.push(
      createPlanConstraint('req_backpack', 'BACKPACK', 'capacity_l', 'GTE', 15, 'lít', 'R15: Chuyến 1 ngày yêu cầu balo tối thiểu 15L'),
    );
  } else if (tripContext.days >= 2 && tripContext.days <= 3) {
    backpackConstraints.push(
      createPlanConstraint('req_backpack', 'BACKPACK', 'capacity_l', 'GTE', 35, 'lít', 'R16: Chuyến 2-3 ngày yêu cầu balo tối thiểu 35L'),
    );
  } else if (tripContext.days >= 4) {
    backpackConstraints.push(
      createPlanConstraint('req_backpack', 'BACKPACK', 'capacity_l', 'GTE', 50, 'lít', 'R17: Chuyến từ 4 ngày trở lên yêu cầu balo tối thiểu 50L'),
    );
  }
  if (tripContext.rain_prob_pct >= 50) {
    backpackConstraints.push(
      createPlanConstraint('req_backpack', 'BACKPACK', 'rain_cover', 'EQ', true, undefined, 'R18: Mưa lớn (>=50%) yêu cầu balo có áo mưa bọc (rain_cover) hoặc chống nước'),
    );
  }

  requirements.push({
    id: 'req_backpack',
    category: 'BACKPACK',
    priority: 'REQUIRED',
    quantity: 1,
    constraints: backpackConstraints,
    source: 'SYSTEM_BASELINE',
    description: 'Balo trekking chứa đồ',
  });

  // 4. Merge explicit / optional requirements if specified
  if (explicitNeeds && explicitNeeds.length > 0) {
    const existingIds = new Set(requirements.map((r) => r.id));
    for (const need of explicitNeeds) {
      if (!existingIds.has(need.id)) {
        requirements.push(need);
        existingIds.add(need.id);
      }
    }
  }

  return requirements;
}

function formatAttrValue(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  return JSON.stringify(val);
}

/**
 * Pure Plan Coverage Resolver.
 * Resolves item coverage against trip requirements deterministically.
 */
export function resolvePlanCoverage(
  items: PlanGearItemInput[],
  requirements: PlanRequirement[],
  tripContext: TripContext,
): PlanCoverageResult {
  // 1. Guard against duplicate item IDs
  const seenItemIds = new Set<string>();
  for (const item of items) {
    if (seenItemIds.has(item.id)) {
      throw new Error(`Duplicate item ID detected in coverage evaluation: ${item.id}`);
    }
    seenItemIds.add(item.id);
  }

  // 2. Index items by category
  const itemsByCategory = new Map<GearCategory, PlanGearItemInput[]>();
  for (const item of items) {
    const list = itemsByCategory.get(item.category) ?? [];
    list.push(item);
    itemsByCategory.set(item.category, list);
  }

  const assignedItemIdsGlobal = new Set<string>();
  const requirementCoverages: PlanRequirementCoverage[] = [];

  // Canonical ordering for checklist display
  const canonicalOrder: GearCategory[] = [
    'JACKET',
    'FOOTWEAR',
    'PANTS',
    'BACKPACK',
    'SLEEPING_BAG',
    'TENT',
    'TREKKING_POLE',
    'RAIN_GEAR',
  ];

  // 3. Resolve each requirement
  for (const req of requirements) {
    const requiredQty = req.quantity > 0 ? req.quantity : 1;
    // Sort candidates deterministically by ID ascending to avoid input order sensitivity
    const categoryCandidates = (itemsByCategory.get(req.category) ?? [])
      .filter((item) => !assignedItemIdsGlobal.has(item.id))
      .sort((a, b) => a.id.localeCompare(b.id));

    const assignedForReq: PlanGearItemInput[] = [];
    let bestFailureReasons: string[] = [];
    let bestMissingFields: string[] = [];
    let hasUnknownItem = false;

    // Check candidates to find compliant items up to required quantity
    for (const candidate of categoryCandidates) {
      if (assignedForReq.length >= requiredQty) break;

      let isItemCompliant = true;
      const itemMissing: string[] = [];
      const itemWarnings: string[] = [];

      // Check for empty / all-null attributes (MASTER 8: all-null attributes cannot be assumed suitable)
      const attrKeys = Object.keys(candidate.attributes ?? {});
      const hasNonEmptyAttr = attrKeys.some(
        (k) => candidate.attributes[k] !== null && candidate.attributes[k] !== undefined,
      );
      if (!hasNonEmptyAttr) {
        isItemCompliant = false;
        hasUnknownItem = true;
        itemMissing.push('attributes');
      }

      // Canonical Core Verdict Evaluation (B07: legacy items must be SUITABLE per core rules)
      if (isCoreGearCategory(candidate.category)) {
        try {
          const coreEval = evaluateGearItem(
            {
              id: candidate.id,
              category: candidate.category,
              condition: candidate.condition,
              attributes: candidate.attributes ?? {},
            },
            tripContext,
          );

          if (coreEval.verdict === 'NOT_SUITABLE') {
            isItemCompliant = false;
            itemWarnings.push(...coreEval.reasons);
          } else if (coreEval.missingAttributes.length > 0) {
            itemMissing.push(...coreEval.missingAttributes);
          }
        } catch (err: any) {
          isItemCompliant = false;
          itemWarnings.push(err.message);
        }
      }

      // Physical condition check (POOR is always rejected)
      if (candidate.condition === 'POOR') {
        isItemCompliant = false;
        itemWarnings.push('Món đồ trong tình trạng xuống cấp nghiêm trọng (POOR)');
      }

      // Check all constraints for this requirement (AND logic)
      for (const constraint of req.constraints) {
        const val = candidate.attributes[constraint.field];

        if (val === null || val === undefined) {
          itemMissing.push(constraint.field);
          isItemCompliant = false;
          continue;
        }

        if (constraint.op === 'GTE') {
          if (typeof val !== 'number' || val < (constraint.expected as number)) {
            isItemCompliant = false;
            itemWarnings.push(
              `${constraint.field} (${formatAttrValue(val)}) không đạt mức tối thiểu ${formatAttrValue(constraint.expected)}`,
            );
          }
        } else if (constraint.op === 'LTE') {
          if (typeof val !== 'number' || val > (constraint.expected as number)) {
            isItemCompliant = false;
            itemWarnings.push(
              `${constraint.field} (${formatAttrValue(val)}) vượt quá mức tối đa ${formatAttrValue(constraint.expected)}`,
            );
          }
        } else if (constraint.op === 'EQ') {
          if (val !== constraint.expected) {
            // Special exception for backpack rain_cover: waterproof=true also satisfies
            if (
              req.category === 'BACKPACK' &&
              constraint.field === 'rain_cover' &&
              candidate.attributes['waterproof'] === true
            ) {
              // satisfied via waterproof attribute
            } else {
              isItemCompliant = false;
              itemWarnings.push(
                `${constraint.field} (${formatAttrValue(val)}) không thỏa mãn điều kiện yêu cầu (${formatAttrValue(constraint.expected)})`,
              );
            }
          }
        }
      }

      if (isItemCompliant) {
        assignedForReq.push(candidate);
        assignedItemIdsGlobal.add(candidate.id);
      } else {
        if (itemMissing.length > 0) {
          hasUnknownItem = true;
          if (bestMissingFields.length === 0) bestMissingFields = itemMissing;
        }
        if (itemWarnings.length > 0 && bestFailureReasons.length === 0) {
          bestFailureReasons = itemWarnings;
        }
      }
    }

    let status: PlanCoverageStatus;
    let recommendedAction: RecommendedAction;
    const assignedIds = assignedForReq.map((i) => i.id);
    const remainingQuantity = Math.max(0, req.quantity - assignedIds.length);

    if (assignedForReq.length === requiredQty) {
      status = 'COVERED_BY_OWNED';
      recommendedAction = 'USE_OWNED';
    } else if (assignedForReq.length > 0) {
      // Partial coverage
      status = 'NEEDS_REPLACEMENT';
      recommendedAction = 'RENT';
    } else if (categoryCandidates.length > 0) {
      if (hasUnknownItem && bestMissingFields.length > 0) {
        status = 'UNKNOWN';
        recommendedAction = 'COMPLETE_ATTRIBUTES';
      } else {
        status = 'NEEDS_REPLACEMENT';
        recommendedAction = 'RENT';
      }
    } else {
      if (req.priority === 'REQUIRED') {
        status = 'MISSING';
        recommendedAction = 'RENT';
      } else {
        status = 'MISSING';
        recommendedAction = 'OPTIONAL_CONSIDER';
      }
    }

    requirementCoverages.push({
      requirementId: req.id,
      category: req.category,
      priority: req.priority,
      quantity: req.quantity,
      remainingQuantity,
      status,
      assignedItemIds: assignedIds,
      missingFields: assignedForReq.length === requiredQty ? [] : bestMissingFields,
      warnings: assignedForReq.length === requiredQty ? [] : bestFailureReasons,
      recommendedAction,
      constraints: req.constraints,
    });
  }

  // 4. Construct Checklist items preserving all requirement IDs
  const checklist: PlanChecklistItem[] = [];

  for (const cov of requirementCoverages) {
    const reqDef = requirements.find((r) => r.id === cov.requirementId);
    checklist.push({
      requirementId: cov.requirementId,
      category: cov.category,
      title: reqDef?.description ?? `Trang bị ${cov.category}`,
      priority: cov.priority,
      status: cov.status,
      assignedItemId: cov.assignedItemIds[0] ?? null,
      assignedItemIds: cov.assignedItemIds,
      quantity: cov.quantity,
      remainingQuantity: cov.remainingQuantity,
      recommendedAction: cov.recommendedAction,
      missingFields: cov.missingFields,
      warnings: cov.warnings,
      isChecked: false, // User packing check, separate from coverage status
      constraints: reqDef?.constraints ?? [],
    });
  }

  // 5. Compute summary statistics
  const requiredCount = requirementCoverages.filter((r) => r.priority === 'REQUIRED').length;
  const coveredOwnedCount = requirementCoverages.filter(
    (r) => r.status === 'COVERED_BY_OWNED' && r.priority === 'REQUIRED',
  ).length;
  const plannedRentalCount = requirementCoverages.filter(
    (r) => r.status === 'PLANNED_RENTAL' && r.priority === 'REQUIRED',
  ).length;
  const userDeclaredCount = requirementCoverages.filter(
    (r) => r.status === 'USER_DECLARED_PROVISION' && r.priority === 'REQUIRED',
  ).length;
  const unresolvedCount = requirementCoverages.filter(
    (r) =>
      (r.status === 'MISSING' || r.status === 'NEEDS_REPLACEMENT') &&
      r.priority === 'REQUIRED',
  ).length;
  const unknownCount = requirementCoverages.filter((r) => r.status === 'UNKNOWN').length;

  const isFullyCovered =
    requiredCount > 0 &&
    requirementCoverages
      .filter((r) => r.priority === 'REQUIRED')
      .every((r) => r.status === 'COVERED_BY_OWNED' || r.status === 'USER_DECLARED_PROVISION');

  return {
    requirements: requirementCoverages,
    summary: {
      requiredCount,
      coveredOwnedCount,
      plannedRentalCount,
      userDeclaredCount,
      unresolvedCount,
      unknownCount,
      isFullyCovered,
    },
    checklist,
  };
}
