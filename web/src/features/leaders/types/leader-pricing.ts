export type CostCategory =
  | 'TRANSPORT'
  | 'STAFF'
  | 'FOOD'
  | 'ACCOMMODATION'
  | 'ACCESS'
  | 'SAFETY'
  | 'LOGISTICS'
  | 'OTHER';

export type CostKind = 'FIXED' | 'VARIABLE' | 'STEP';

export type CostBasis =
  | 'PER_TRIP'
  | 'PER_DAY'
  | 'PER_PERSON'
  | 'PER_PERSON_PER_DAY'
  | 'PER_CAPACITY_UNIT'
  | 'PER_GROUP_TIER';

export type StepOperation = 'ADDITIVE' | 'REPLACEMENT';

export interface StepTierInput {
  triggerMinPax: number;
  triggerMaxPax: number;
  operation: StepOperation;
  amount: string;
  note?: string | null;
}

export interface CostItemInput {
  id?: string;
  category: CostCategory;
  name: string;
  kind: CostKind;
  basis: CostBasis;
  unitPrice: string;
  quantity: number;
  durationUnits: number;
  capacityPerUnit?: number | null;
  extraNonPayingPax: number;
  includedInPrice: boolean;
  isEnabled: boolean;
  sourceNote?: string | null;
  stepTiers?: StepTierInput[];
}

export interface FeePolicyConfig {
  policyVersion: string;
  platformFeeBps: number;
  paymentFeeBps: number;
  totalFeeBps: number;
  defaultContingencyBps: number;
  defaultTargetMarginBps: number;
  roundingStepVnd: string;
  currency?: string;
}

export type ScenarioStatus = 'LOSS' | 'BREAK_EVEN' | 'PROFIT_BELOW_TARGET' | 'TARGET_MET';

export interface ScenarioRow {
  pax: number;
  revenue: string;
  fixedCost: string;
  variableCost: string;
  operatingCost: string;
  contingencyCost: string;
  totalCost: string;
  feeAmount: string;
  profit: string;
  marginBps: number;
  status: ScenarioStatus;
  stepTriggered: boolean;
  stepTriggers: string[];
}

export interface RiskInterval {
  minPax: number;
  maxPax: number;
  type: 'LOSS_IN_OPERATING_RANGE' | 'MARGIN_BELOW_TARGET_AFTER_STEP_COST';
  message: string;
}

export interface PricingEvaluationResult {
  calcVersion: string;
  feePolicy: FeePolicyConfig;
  summary: {
    baseFixedCost: string;
    unitVariableCost: string;
    contingencyBps: number;
    targetPax: number;
    targetMarginBps: number;
    evaluatedPrice: string;
    suggestedPriceAtTargetPax: string;
    firstBreakEvenPax: number | null;
    firstTargetPax: number | null;
    atTargetPax: ScenarioRow;
  };
  riskIntervals: RiskInterval[];
  scenarios: ScenarioRow[];
  includedServices: string[];
  excludedServices: string[];
  generatedPriceExplanation: string;
}

export interface TripCostPlanResponse {
  tripId: string;
  tripVersion: number;
  tripStatus: string;
  costPlanStatus: 'DRAFT' | 'CONFIRMED' | 'PUBLISHED' | null;
  tripContext: {
    maxPax: number;
    minPax: number;
    pricePerPax: string | null;
    durationDays: number;
    startAt: string;
    endAt: string;
  };
  feePolicy: FeePolicyConfig;
  plan: {
    id: string;
    currency: string;
    targetPax: number;
    targetMarginBps: number;
    contingencyBps: number;
    selectedPrice: string | null;
    selectedMinPax: number | null;
    status: 'DRAFT' | 'CONFIRMED' | 'PUBLISHED';
    version: number;
    items: CostItemInput[];
  } | null;
  evaluation: PricingEvaluationResult | null;
  pricingVersions?: Array<{
    id: string;
    versionNo: number;
    selectedPrice: string;
    selectedMinPax: number;
    targetPax: number;
    publishedAt: string;
  }>;
}

export interface PricingPreviewInput {
  targetPax: number;
  targetMarginBps: number;
  contingencyBps: number;
  selectedPrice?: string | null;
  selectedMinPax?: number | null;
  items: CostItemInput[];
}

export interface CostPlanSaveInput extends PricingPreviewInput {
  expectedVersion: number;
}

export interface PricingConfirmInput {
  expectedVersion: number;
  selectedPrice: string;
  selectedMinPax: number;
  targetPax?: number;
}

