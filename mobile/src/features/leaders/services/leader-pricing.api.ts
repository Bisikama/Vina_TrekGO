import { apiRequest } from "@/lib/api-client";

// ─── COST PLAN & PRICING SIMULATOR TYPES ──────────────────────────────────────

export type CostCategory =
  | "TRANSPORT"
  | "FOOD"
  | "SAFETY"
  | "STAFF"
  | "ACCOMMODATION"
  | "PERMIT"
  | "EQUIPMENT"
  | "OTHER";

export type CostKind = "FIXED" | "VARIABLE" | "STEP";

export type CostBasis =
  | "PER_TRIP"
  | "PER_PERSON"
  | "PER_PERSON_PER_DAY"
  | "PER_DAY"
  | "PER_CAPACITY_UNIT";

export interface CostItem {
  id?: string;
  category: CostCategory;
  name: string;
  kind: CostKind;
  basis: CostBasis;
  unitPrice: number;
  quantity: number;
  durationUnits?: number;
  capacityPerUnit?: number;
  extraNonPayingPax?: number;
  includedInPrice: boolean;
  isEnabled: boolean;
  sourceNote?: string;
  sortOrder: number;
  stepTiers?: any[];
}

export interface PricingConfigResponse {
  platformFeeBps: number; // e.g. 800 (8%)
  paymentFeeBps: number; // e.g. 200 (2%)
  defaultContingencyBps: number; // e.g. 500 (5%)
  minPaxFloor?: number;
  maxPaxCeiling?: number;
}

export interface CostPlanSummary {
  totalFixedCost: number;
  totalVariableCostPerPax: number;
  breakEvenPax: number;
  suggestedPrice: number;
}

export interface CostPlanResponse {
  tripId: string;
  version?: number;
  tripVersion?: number;
  costPlanStatus?: string;
  status?: string;
  currency?: string;
  targetPax?: number;
  targetMarginBps?: number;
  contingencyBps?: number;
  items?: CostItem[];
  summary?: CostPlanSummary;
}

export interface SaveCostPlanPayload {
  expectedVersion: number;
  currency?: string;
  targetPax: number;
  targetMarginBps: number;
  contingencyBps: number;
  selectedPrice?: number | string | null;
  selectedMinPax?: number | null;
  items: CostItem[];
}

export interface PricingPreviewPayload {
  targetPax: number;
  targetMarginBps: number;
  contingencyBps?: number;
  selectedPrice: number;
  selectedMinPax: number;
  items?: CostItem[];
}

export interface PricingScenario {
  pax: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface PricingPreviewSummary {
  suggestedPrice: number;
  breakEvenPax: number;
  minPax: number;
  maxPax: number;
  totalCostAtTarget: number;
  netProfitAtTarget: number;
  marginPctAtTarget: number;
  isDeficit?: boolean;
  deficitAmount?: number;
}

export interface PricingPreviewResponse {
  summary: PricingPreviewSummary;
  riskIntervals?: any[];
  scenarios?: PricingScenario[];
}

export interface ConfirmPricingPayload {
  expectedVersion: number;
  selectedPrice: number;
  selectedMinPax: number;
  targetPax: number;
}

export interface ConfirmPricingResponse {
  success: boolean;
  tripId: string;
  version: number;
  priceExplanation: string;
  pricePerPax: string;
  minPax: number;
}

// ─── STANDARD 4-ITEM COST TEMPLATE (1-CLICK APPLY) ───────────────────────────

export const STANDARD_COST_TEMPLATE: CostItem[] = [
  {
    category: "TRANSPORT",
    name: "Thuê xe 16 chỗ khứ hồi",
    kind: "STEP",
    basis: "PER_CAPACITY_UNIT",
    unitPrice: 4500000,
    quantity: 1,
    durationUnits: 1,
    capacityPerUnit: 15,
    extraNonPayingPax: 0,
    includedInPrice: true,
    isEnabled: true,
    sourceNote: "Xe trung chuyển đón trả đoàn tận nơi",
    sortOrder: 1,
  },
  {
    category: "FOOD",
    name: "Suất ăn dã ngoại & Nước suối",
    kind: "VARIABLE",
    basis: "PER_PERSON_PER_DAY",
    unitPrice: 150000,
    quantity: 1,
    durationUnits: 1,
    extraNonPayingPax: 0,
    includedInPrice: true,
    isEnabled: true,
    sourceNote: "Bao gồm ăn sáng, trưa, tối dã ngoại",
    sortOrder: 2,
  },
  {
    category: "SAFETY",
    name: "Vé Vườn Quốc Gia & Bảo hiểm du lịch",
    kind: "VARIABLE",
    basis: "PER_PERSON",
    unitPrice: 180000,
    quantity: 1,
    durationUnits: 1,
    extraNonPayingPax: 0,
    includedInPrice: true,
    isEnabled: true,
    sourceNote: "Bảo hiểm tai nạn mức 100tr",
    sortOrder: 3,
  },
  {
    category: "STAFF",
    name: "Phụ cấp Porter & Dẫn đường địa phương",
    kind: "FIXED",
    basis: "PER_DAY",
    unitPrice: 700000,
    quantity: 1,
    durationUnits: 1,
    extraNonPayingPax: 0,
    includedInPrice: true,
    isEnabled: true,
    sourceNote: "Hỗ trợ dẫn đường và trang bị chung",
    sortOrder: 4,
  },
];

// ─── LOCAL FINANCIAL SIMULATION MATH (Fallback & 60fps instant UI) ──────────

export function computeLocalPricingSimulation(
  items: CostItem[],
  targetPax: number,
  targetMarginBps: number,
  selectedPrice: number,
  selectedMinPax: number,
  platformFeeBps = 800,
  paymentFeeBps = 200,
  contingencyBps = 500,
): PricingPreviewResponse {
  const activeItems = items.filter((it) => it.isEnabled && it.includedInPrice);

  let totalFixedCost = 0;
  let totalVariablePerPax = 0;

  activeItems.forEach((item) => {
    const qty = Math.max(1, item.quantity || 1);
    const duration = Math.max(1, item.durationUnits || 1);
    const price = Number(item.unitPrice) || 0;

    if (item.kind === "FIXED") {
      totalFixedCost += price * qty * duration;
    } else if (item.kind === "VARIABLE") {
      totalVariablePerPax += price * qty * duration;
    } else if (item.kind === "STEP") {
      const cap = Math.max(1, item.capacityPerUnit || 15);
      const unitsNeeded = Math.ceil(targetPax / cap);
      totalFixedCost += price * unitsNeeded * duration;
    }
  });

  const effectivePax = Math.max(1, targetPax);
  const totalBaseCostAtTarget = totalFixedCost + totalVariablePerPax * effectivePax;

  // Add contingency (e.g. 5%)
  const totalWithContingency = totalBaseCostAtTarget * (1 + contingencyBps / 10000);

  // Total fees (platform fee 8% + payment fee 2% = 10%)
  const feeRate = (platformFeeBps + paymentFeeBps) / 10000;
  const marginRate = targetMarginBps / 10000;

  // Revenue needed to cover cost + margin + fees:
  // Revenue * (1 - feeRate) = totalWithContingency * (1 + marginRate)
  const divisor = Math.max(0.1, 1 - feeRate);
  const targetRevenue = (totalWithContingency * (1 + marginRate)) / divisor;
  const suggestedPrice = Math.ceil(targetRevenue / effectivePax / 10000) * 10000;

  // Break-even calculation with selectedPrice:
  // Revenue(P) * (1 - feeRate) = totalFixedCost + (totalVariablePerPax * P)
  // P * [selectedPrice * (1 - feeRate) - totalVariablePerPax] = totalFixedCost
  const netRevenuePerPax = selectedPrice * (1 - feeRate);
  const contributionMarginPerPax = netRevenuePerPax - totalVariablePerPax;

  let breakEvenPax = 999;
  if (contributionMarginPerPax > 0) {
    breakEvenPax = Math.ceil(totalFixedCost / contributionMarginPerPax);
  }

  const revenueAtTarget = selectedPrice * effectivePax;
  const netRevenueAtTarget = revenueAtTarget * (1 - feeRate);
  const netProfitAtTarget = netRevenueAtTarget - totalBaseCostAtTarget;
  const marginPctAtTarget =
    revenueAtTarget > 0 ? (netProfitAtTarget / revenueAtTarget) * 100 : 0;

  const isDeficit = netProfitAtTarget < 0;
  const deficitAmount = isDeficit ? Math.abs(netProfitAtTarget) : 0;

  return {
    summary: {
      suggestedPrice,
      breakEvenPax: Math.max(1, breakEvenPax),
      minPax: selectedMinPax,
      maxPax: Math.max(effectivePax, 30),
      totalCostAtTarget: Math.round(totalBaseCostAtTarget),
      netProfitAtTarget: Math.round(netProfitAtTarget),
      marginPctAtTarget: Math.round(marginPctAtTarget * 10) / 10,
      isDeficit,
      deficitAmount: Math.round(deficitAmount),
    },
    scenarios: [selectedMinPax, effectivePax, Math.min(30, effectivePax + 5)].map(
      (pax) => {
        const rev = selectedPrice * pax;
        const netRev = rev * (1 - feeRate);
        const cost = totalFixedCost + totalVariablePerPax * pax;
        return {
          pax,
          revenue: rev,
          cost: Math.round(cost),
          profit: Math.round(netRev - cost),
        };
      },
    ),
  };
}

// ─── API CLIENT FUNCTIONS ───────────────────────────────────────────────────

/**
 * 1. GET /api/v1/leader/pricing-config
 * Lấy tỷ lệ phí sàn, phí thanh toán, dự phòng
 */
export async function getPricingConfig(
  accessToken: string,
): Promise<PricingConfigResponse> {
  try {
    return await apiRequest<PricingConfigResponse>(
      "/api/v1/leader/pricing-config",
      { accessToken },
    );
  } catch {
    // Fallback default config if backend hasn't mounted this endpoint yet
    return {
      platformFeeBps: 800, // 8%
      paymentFeeBps: 200, // 2%
      defaultContingencyBps: 500, // 5%
      minPaxFloor: 3,
      maxPaxCeiling: 30,
    };
  }
}

function unwrapPricing<T>(res: any): T {
  if (res && typeof res === "object" && "data" in res && res.data !== null && res.data !== undefined) {
    return res.data as T;
  }
  return res as T;
}

/**
 * 2. GET /api/v1/leader/public-trips/:id/cost-plan
 * Lấy bảng chi phí và trạng thái cost plan của chuyến đi
 */
export async function getTripCostPlan(
  tripId: string,
  accessToken: string,
): Promise<CostPlanResponse> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}/cost-plan`,
    { accessToken },
  );
  return unwrapPricing<CostPlanResponse>(raw);
}

function formatCategoryForBackend(rawCat: string): 'TRANSPORT' | 'STAFF' | 'FOOD' | 'ACCOMMODATION' | 'ACCESS' | 'SAFETY' | 'LOGISTICS' | 'OTHER' {
  if (rawCat === "PERMIT") return "ACCESS";
  if (rawCat === "EQUIPMENT") return "LOGISTICS";
  const valid = [
    "TRANSPORT",
    "STAFF",
    "FOOD",
    "ACCOMMODATION",
    "ACCESS",
    "SAFETY",
    "LOGISTICS",
    "OTHER",
  ];
  return valid.includes(rawCat) ? (rawCat as any) : "OTHER";
}

/**
 * 3. PUT /api/v1/leader/public-trips/:id/cost-plan
 * Lưu danh sách items chi phí (định dạng chuẩn Backend TG-PTR-PRICING-01)
 */
export async function saveTripCostPlan(
  tripId: string,
  payload: SaveCostPlanPayload,
  accessToken: string,
): Promise<CostPlanResponse> {
  const formattedBody: any = {
    expectedVersion: payload.expectedVersion,
    targetPax: Math.max(3, Number(payload.targetPax) || 10),
    targetMarginBps: Number(payload.targetMarginBps) || 2000,
    contingencyBps: Number(payload.contingencyBps) || 500,
    ...(payload.selectedPrice != null && Number(payload.selectedPrice) > 0
      ? { selectedPrice: String(Math.round(Number(payload.selectedPrice))) }
      : {}),
    ...(payload.selectedMinPax != null && Number(payload.selectedMinPax) >= 1
      ? { selectedMinPax: Number(payload.selectedMinPax) }
      : {}),
    items: payload.items.map((it) => {
      const item: any = {
        category: formatCategoryForBackend(it.category),
        name: it.name.trim(),
        kind: it.kind,
        basis: it.basis,
        unitPrice: String(Math.round(Number(it.unitPrice) || 0)),
        quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
        durationUnits: Math.max(1, Math.round(Number(it.durationUnits) || 1)),
        capacityPerUnit:
          it.kind === "STEP"
            ? Math.max(1, Math.round(Number(it.capacityPerUnit) || 15))
            : null,
        extraNonPayingPax: Math.max(0, Math.round(Number(it.extraNonPayingPax) || 0)),
        includedInPrice: Boolean(it.includedInPrice),
        isEnabled: Boolean(it.isEnabled),
        sourceNote: it.sourceNote ? it.sourceNote.trim() : null,
      };

      if (it.kind === "STEP" && Array.isArray(it.stepTiers) && it.stepTiers.length > 0) {
        item.stepTiers = it.stepTiers;
      }

      return item;
    }),
  };

  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}/cost-plan`,
    {
      method: "PUT",
      accessToken,
      body: JSON.stringify(formattedBody),
    },
  );
  return unwrapPricing<CostPlanResponse>(raw);
}

/**
 * 4. POST /api/v1/leader/public-trips/:id/pricing/preview
 * Tính toán real-time khi Leader kéo slider
 */
export async function previewTripPricing(
  tripId: string,
  payload: PricingPreviewPayload,
  accessToken: string,
): Promise<PricingPreviewResponse> {
  try {
    const formattedBody: any = {
      targetPax: Math.max(3, Number(payload.targetPax) || 10),
      targetMarginBps: Number(payload.targetMarginBps) || 2000,
      contingencyBps: Number(payload.contingencyBps) || 500,
      ...(payload.selectedPrice != null && Number(payload.selectedPrice) > 0
        ? { selectedPrice: String(Math.round(Number(payload.selectedPrice))) }
        : {}),
      ...(payload.selectedMinPax != null && Number(payload.selectedMinPax) >= 1
        ? { selectedMinPax: Number(payload.selectedMinPax) }
        : {}),
      items: (payload.items || []).map((it) => {
        const item: any = {
          category: formatCategoryForBackend(it.category),
          name: it.name.trim(),
          kind: it.kind,
          basis: it.basis,
          unitPrice: String(Math.round(Number(it.unitPrice) || 0)),
          quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
          durationUnits: Math.max(1, Math.round(Number(it.durationUnits) || 1)),
          capacityPerUnit:
            it.kind === "STEP"
              ? Math.max(1, Math.round(Number(it.capacityPerUnit) || 15))
              : null,
          extraNonPayingPax: Math.max(0, Math.round(Number(it.extraNonPayingPax) || 0)),
          includedInPrice: Boolean(it.includedInPrice),
          isEnabled: Boolean(it.isEnabled),
          sourceNote: it.sourceNote ? it.sourceNote.trim() : null,
        };

        if (it.kind === "STEP" && Array.isArray(it.stepTiers) && it.stepTiers.length > 0) {
          item.stepTiers = it.stepTiers;
        }

        return item;
      }),
    };

    const raw = await apiRequest<any>(
      `/api/v1/leader/public-trips/${tripId}/pricing/preview`,
      {
        method: "POST",
        accessToken,
        body: JSON.stringify(formattedBody),
      },
    );
    return unwrapPricing<PricingPreviewResponse>(raw);
  } catch {
    // Fallback seamlessly to local financial math
    return computeLocalPricingSimulation(
      payload.items || STANDARD_COST_TEMPLATE,
      payload.targetPax,
      payload.targetMarginBps,
      payload.selectedPrice,
      payload.selectedMinPax,
    );
  }
}

/**
 * 5. POST /api/v1/leader/public-trips/:id/pricing/confirm
 * Chốt giá vé chính thức và sinh tự động priceExplanation
 */
export async function confirmTripPricing(
  tripId: string,
  payload: ConfirmPricingPayload,
  accessToken: string,
): Promise<ConfirmPricingResponse> {
  const formattedBody = {
    expectedVersion: payload.expectedVersion,
    selectedPrice: String(Math.round(Number(payload.selectedPrice) || 0)),
    selectedMinPax: Number(payload.selectedMinPax),
    ...(payload.targetPax != null ? { targetPax: Number(payload.targetPax) } : {}),
  };

  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}/pricing/confirm`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify(formattedBody),
    },
  );
  return unwrapPricing<ConfirmPricingResponse>(raw);
}
