import { apiClient } from "@/lib/axios";

// Phương án thuê bù đồ còn thiếu của Gear Advisor (POST /gear/plans/{id}/options).
// Mọi số tiền là ƯỚC TÍNH theo giá tại thời điểm tạo phương án; báo giá chính thức mới là số chốt.

type Envelope<T> = T | { data: T };
const unwrap = <T,>(payload: Envelope<T>) =>
  payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: T }).data
    : (payload as T);

export type GearRentalLine = {
  requirementId?: string;
  category?: string;
  productId: string;
  productName: string;
  quantity: number;
  dailyPrice?: number;
  rentalFee?: number;
  /** Tiền cọc cả dòng. `deposit` là tên cũ (deprecated), chỉ dùng khi thiếu `depositAmount`. */
  depositAmount?: number;
  deposit?: number;
  depositPerUnit?: number;
  replacementValue?: number;
  depositExplanation?: { percentageOfReplacementValue: number | null; formula?: string } | null;
  weight_g?: number | null;
  availableCount?: number;
  grade?: "LIKE_NEW" | "GOOD_USED" | null;
};

export type GearOptionSummary = {
  totalRentalFee?: number;
  totalDeposit?: number;
  totalEstimatedUpfront?: number;
  totalKnownWeightG?: number;
  weightStatus?: "EXACT" | "PARTIAL" | "UNKNOWN";
  /** requirementId của các yêu cầu chưa tìm được đồ thuê phù hợp. */
  missingRequirements?: string[];
  isComplete?: boolean;
  searchStatus?: "OPTIMAL_WITHIN_SEARCH_SCOPE" | "BOUNDED_RECOMMENDATION" | "INFEASIBLE";
};

export type GearRentalOption = {
  id: string;
  label?: string;
  rentalLines: GearRentalLine[];
  summary?: GearOptionSummary;
};

export type GearRentalOptionSet = {
  setId: string;
  revision?: number;
  expiresAt?: string;
  options: GearRentalOption[];
};

export type GearPlanAdvice = {
  id: string;
  source: "AI" | "RULE_FALLBACK" | string;
  narrativeVi: string;
  disclaimerVi?: string;
  createdAt?: string;
};

export type GearQuoteIntent = {
  tripId: string;
  validUntil?: string;
  lines: Array<{ productId: string; productName: string; quantity: number }>;
  prefillRentalQuote: { tripId: string; items: Array<{ productId: string; quantity: number }> };
};

export const lineDepositAmount = (line: GearRentalLine) =>
  typeof line.depositAmount === "number" ? line.depositAmount : typeof line.deposit === "number" ? line.deposit : null;

export async function generateGearRentalOptions(planId: string, expectedRevision: number, budgetLimit?: number) {
  const response = await apiClient.post<Envelope<GearRentalOptionSet>>(
    `/api/v1/gear/plans/${encodeURIComponent(planId)}/options`,
    { expectedRevision, objective: "BALANCED", ...(budgetLimit !== undefined ? { budgetLimit } : {}) },
  );
  return unwrap(response.data);
}

/** Lời khuyên cho một phương án. Backend luôn trả lời khuyên (theo bộ quy tắc khi AI tắt hoặc lỗi). */
export async function generateGearAdvice(planId: string, expectedRevision: number, optionRef: { setId: string; optionId: string }) {
  const response = await apiClient.post<Envelope<GearPlanAdvice>>(
    `/api/v1/gear/plans/${encodeURIComponent(planId)}/advice`,
    { expectedRevision, optionRef },
    { timeout: 60_000 },
  );
  return unwrap(response.data);
}

/** Kiểm phương án còn hiệu lực và lấy danh sách món để đưa vào giỏ thuê. */
export async function createGearQuoteIntent(planId: string, expectedRevision: number, optionRef: { setId: string; optionId: string }) {
  const response = await apiClient.post<Envelope<GearQuoteIntent>>(
    `/api/v1/gear/plans/${encodeURIComponent(planId)}/quote-intents`,
    { expectedRevision, optionRef },
  );
  return unwrap(response.data);
}
