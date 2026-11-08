import { apiRequest } from "@/lib/api-client";

// Phương án thuê bù đồ còn thiếu (POST /gear/plans/{id}/options). Số tiền là ƯỚC TÍNH.

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload && (payload as { data?: T }).data !== undefined) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export type GearRentalLine = {
  requirementId?: string;
  category?: string;
  productId: string;
  productName: string;
  quantity: number;
  rentalFee?: number;
  /** Cọc cả dòng; `deposit` là tên cũ (deprecated). */
  depositAmount?: number;
  deposit?: number;
  depositPerUnit?: number;
  depositExplanation?: { percentageOfReplacementValue: number | null } | null;
  weight_g?: number | null;
  availableCount?: number;
  grade?: "LIKE_NEW" | "GOOD_USED" | null;
};

export type GearOptionSummary = {
  totalRentalFee?: number;
  totalDeposit?: number;
  totalKnownWeightG?: number;
  weightStatus?: "EXACT" | "PARTIAL" | "UNKNOWN";
  /** requirementId của các yêu cầu chưa tìm được đồ thuê phù hợp. */
  missingRequirements?: string[];
  isComplete?: boolean;
  searchStatus?: "OPTIMAL_WITHIN_SEARCH_SCOPE" | "BOUNDED_RECOMMENDATION" | "INFEASIBLE";
};

export type GearRentalOption = { id: string; label?: string; rentalLines: GearRentalLine[]; summary?: GearOptionSummary };

export type GearRentalOptionSet = { setId: string; expiresAt?: string; options: GearRentalOption[] };

export type GearPlanAdvice = { id: string; source: "AI" | "RULE_FALLBACK" | string; narrativeVi: string; disclaimerVi?: string };

export type GearQuoteIntent = {
  tripId: string;
  prefillRentalQuote: { tripId: string; items: { productId: string; quantity: number }[] };
};

export const lineDepositAmount = (line: GearRentalLine) =>
  typeof line.depositAmount === "number" ? line.depositAmount : typeof line.deposit === "number" ? line.deposit : null;

const planPath = (planId: string) => `/api/v1/gear/plans/${encodeURIComponent(planId)}`;

export async function generateGearRentalOptions(planId: string, expectedRevision: number, accessToken: string, budgetLimit?: number) {
  return unwrap(
    await apiRequest<Envelope<GearRentalOptionSet>>(`${planPath(planId)}/options`, {
      method: "POST",
      accessToken,
      body: JSON.stringify({ expectedRevision, objective: "BALANCED", ...(budgetLimit !== undefined ? { budgetLimit } : {}) }),
    }),
  );
}

/** Lời khuyên cho một phương án. Backend luôn trả lời khuyên (theo bộ quy tắc khi AI tắt hoặc lỗi). */
export async function generateGearAdvice(
  planId: string,
  expectedRevision: number,
  optionRef: { setId: string; optionId: string },
  accessToken: string,
) {
  return unwrap(
    await apiRequest<Envelope<GearPlanAdvice>>(`${planPath(planId)}/advice`, {
      method: "POST",
      accessToken,
      timeoutMs: 60_000,
      body: JSON.stringify({ expectedRevision, optionRef }),
    }),
  );
}

/** Kiểm phương án còn hiệu lực và lấy danh sách món để đưa vào giỏ thuê. */
export async function createGearQuoteIntent(
  planId: string,
  expectedRevision: number,
  optionRef: { setId: string; optionId: string },
  accessToken: string,
) {
  return unwrap(
    await apiRequest<Envelope<GearQuoteIntent>>(`${planPath(planId)}/quote-intents`, {
      method: "POST",
      accessToken,
      body: JSON.stringify({ expectedRevision, optionRef }),
    }),
  );
}
