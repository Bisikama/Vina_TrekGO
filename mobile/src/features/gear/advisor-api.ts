import { ApiError, apiRequest } from "@/lib/api-client";

import type { GearCategory } from "@/features/gear/types";

// Gear Advisor (web/docs/GEAR_ADVISOR_FRONTEND_HANDOFF.md). Version luôn lấy từ phản hồi thật.

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload && (payload as { data?: T }).data !== undefined) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export type ConfirmedClimate = {
  temp_min_c: number;
  temp_max_c: number;
  temp_min_night_c: number;
  rain_prob_pct: number;
};

export type ChecklistProgressEntry = { requirementId: string; isChecked: boolean; note?: string };

export type GearPlan = {
  id: string;
  title: string;
  tripId: string | null;
  selectedItemIds: string[];
  inputRevision: number;
  evaluatedRevision: number | null;
  isStale?: boolean;
  progressVersion?: number;
  progressJson?: ChecklistProgressEntry[] | { items: ChecklistProgressEntry[] } | null;
  preferences?: { selfProvidedRequirementIds?: string[]; [key: string]: unknown } | null;
  /** Thời tiết đã xác nhận ở lần đánh giá gần nhất. */
  canonicalContext?: { confirmedClimate?: ConfirmedClimate | null; [key: string]: unknown } | null;
  updatedAt?: string;
};

export type ClimateSuggestion = ConfirmedClimate & {
  source: "CLIMATE_ESTIMATE" | "FORECAST";
  /** Dự báo lấy tại điểm cao nhất của cung (m). */
  atElevationM?: number;
  sourceReference?: string;
  noteVi?: string;
};

/** Dữ liệu chuyến dùng để gợi ý (GET /gear/plans/prefill). */
export type GearPlanPrefill = {
  tripId: string;
  destination: string | null;
  startAt?: string | null;
  endAt?: string | null;
  days?: number | null;
  difficulty?: number | null;
  terrain?: string[] | null;
  /** Độ cao điểm cao nhất của cung (m); null khi cung không có dữ liệu độ cao. */
  highestElevationM?: number | null;
  suggestedClimate: ClimateSuggestion | null;
  forecastClimate: ClimateSuggestion | null;
};

export type GuidanceQuestion = {
  field: string;
  question: string;
  valueType: "number" | "boolean" | "enum" | "unknown";
  allowUnknown?: boolean;
  unit?: string;
  min?: number;
  max?: number;
  isInteger?: boolean;
  options?: string[];
};

export type RequirementStatus =
  | "COVERED_BY_OWNED"
  | "USER_DECLARED_PROVISION"
  | "PLANNED_RENTAL"
  | "NEEDS_REPLACEMENT"
  | "MISSING"
  | "UNKNOWN";

export type GuidanceRequirement = {
  requirementId: string;
  category: GearCategory | string;
  priority?: string;
  status?: RequirementStatus | string;
  recommendedAction?: string;
  quantity?: number;
  remainingQuantity?: number;
  assignedItemIds?: string[];
  warnings?: string[];
  /** Tiêu chí dạng đọc được; bản đánh giá cũ có thể chưa có. */
  criteria?: { field: string; label: string; text: string; reason: string | null }[];
  questions?: GuidanceQuestion[];
};

export type GuidanceItem = {
  itemId: string;
  nameAtEvaluation: string | null;
  category: string;
  verdict?: string | null;
  displayStatus: string;
  reasons?: string[];
  questions: GuidanceQuestion[];
};

export type PlanGuidance = {
  available: boolean;
  message?: string;
  isLatestEvaluation?: boolean;
  needsReevaluation?: boolean;
  isStale?: boolean;
  items?: GuidanceItem[];
  requirements?: GuidanceRequirement[];
  contextQuestions?: {
    available: boolean;
    items: { itemId: string; nameAtEvaluation: string | null; category: string; questions: GuidanceQuestion[] }[];
  };
};

export type PackingChecklistItem = {
  requirementId: string;
  category: string;
  title: string;
  priority: string;
  quantity: number;
  remainingQuantity: number;
  status: string;
  assignedItemIds: string[];
  /** Đồ thiết yếu (status "ESSENTIAL"): lý do theo điều kiện chuyến. */
  reason?: string;
};

/** Đồ thiết yếu không có thông số (đèn đầu, nước, sơ cứu...), chỉ để đóng gói. Bản đánh giá cũ chưa có. */
export type TripEssential = { id: string; title: string; priority: "REQUIRED" | "RECOMMENDED"; reason: string };

export type GearTripCandidate = { id: string; title: string; startAt?: string; endAt?: string; type: "PUBLIC" | "PRIVATE" };

export const selfProvidedOf = (plan: GearPlan | null) =>
  Array.isArray(plan?.preferences?.selfProvidedRequirementIds) ? plan.preferences.selfProvidedRequirementIds : [];

export const progressOf = (plan: GearPlan | null): ChecklistProgressEntry[] =>
  !plan?.progressJson ? [] : Array.isArray(plan.progressJson) ? plan.progressJson : plan.progressJson.items ?? [];

export function gearErrorCode(error: unknown) {
  return error instanceof ApiError ? error.code ?? null : null;
}

export function gearErrorMessage(error: unknown, fallback = "Không kết nối được Gear Advisor.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Booking dùng được cho Gear (cùng điều kiện với backend `hasPublicBookingAccess`). */
const GEAR_BOOKING_STATUSES = new Set(["CONFIRMED", "PARTIAL_CHECKIN", "CHECKED_IN"]);

const planPath = (planId: string) => `/api/v1/gear/plans/${encodeURIComponent(planId)}`;

export const gearAdvisorApi = {
  /** Ứng viên chuyến: vé còn hiệu lực + chuyến riêng. Backend (prefill) vẫn là nơi quyết định cuối. */
  async listTripCandidates(accessToken: string): Promise<GearTripCandidate[]> {
    type TripRef = { id: string; title: string; startAt?: string; endAt?: string };
    const [bookings, privateTrips] = await Promise.allSettled([
      apiRequest<Envelope<{ items: { status?: string; trip: TripRef }[] }>>("/api/v1/bookings?page=1&pageSize=50", {
        method: "GET",
        accessToken,
      }),
      apiRequest<Envelope<{ items: TripRef[] }>>("/api/v1/me/private-trips?page=1&pageSize=50", { method: "GET", accessToken }),
    ]);
    if (bookings.status === "rejected" && privateTrips.status === "rejected") throw bookings.reason;
    const result = new Map<string, GearTripCandidate>();
    if (bookings.status === "fulfilled") {
      for (const booking of unwrap(bookings.value).items ?? []) {
        if (booking?.status && !GEAR_BOOKING_STATUSES.has(booking.status)) continue;
        if (booking?.trip?.id) result.set(booking.trip.id, { ...booking.trip, type: "PUBLIC" });
      }
    }
    if (privateTrips.status === "fulfilled") {
      for (const trip of unwrap(privateTrips.value).items ?? []) {
        if (trip?.id) result.set(trip.id, { ...trip, type: "PRIVATE" });
      }
    }
    return [...result.values()].sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""));
  },

  async prefill(tripId: string, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<GearPlanPrefill>>(`/api/v1/gear/plans/prefill?tripId=${encodeURIComponent(tripId)}`, {
        method: "GET",
        accessToken,
      }),
    );
  },

  async listPlans(accessToken: string): Promise<GearPlan[]> {
    const data = unwrap(
      await apiRequest<Envelope<GearPlan[] | { items: GearPlan[] }>>("/api/v1/gear/plans", { method: "GET", accessToken }),
    );
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async getPlan(planId: string, accessToken: string) {
    return unwrap(await apiRequest<Envelope<GearPlan>>(planPath(planId), { method: "GET", accessToken }));
  },

  async createPlan(input: { title: string; tripId: string; selectedItemIds: string[] }, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<GearPlan>>("/api/v1/gear/plans", {
        method: "POST",
        accessToken,
        body: JSON.stringify({ ...input, contextMode: "TRIP" }),
      }),
    );
  },

  async updatePlan(
    planId: string,
    input: { expectedInputRevision: number; selectedItemIds?: string[]; selfProvidedRequirementIds?: string[] },
    accessToken: string,
  ) {
    return unwrap(
      await apiRequest<Envelope<GearPlan>>(planPath(planId), { method: "PATCH", accessToken, body: JSON.stringify(input) }),
    );
  },

  async evaluate(planId: string, input: { expectedInputRevision: number; confirmedClimate: ConfirmedClimate }, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<Record<string, unknown>>>(`${planPath(planId)}/evaluate`, {
        method: "POST",
        accessToken,
        body: JSON.stringify(input),
      }),
    );
  },

  async guidance(planId: string, revision: number, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<PlanGuidance>>(`${planPath(planId)}/revisions/${revision}/guidance`, { method: "GET", accessToken }),
    );
  },

  /** Checklist đóng gói: đồ theo yêu cầu, rồi tới đồ thiết yếu (mã `ess_*`). */
  async checklist(planId: string, revision: number, accessToken: string): Promise<PackingChecklistItem[]> {
    const data = unwrap(
      await apiRequest<Envelope<{ resultSnapshot?: { checklist?: PackingChecklistItem[]; essentials?: TripEssential[] } }>>(
        `${planPath(planId)}/revisions/${revision}`,
        { method: "GET", accessToken },
      ),
    );
    const essentials = (data?.resultSnapshot?.essentials ?? []).map(
      (essential): PackingChecklistItem => ({
        requirementId: essential.id,
        category: "ESSENTIAL",
        title: essential.title,
        priority: essential.priority === "REQUIRED" ? "REQUIRED" : "OPTIONAL",
        quantity: 1,
        remainingQuantity: 0,
        status: "ESSENTIAL",
        assignedItemIds: [],
        reason: essential.reason,
      }),
    );
    return [...(data?.resultSnapshot?.checklist ?? []), ...essentials];
  },

  async saveChecklistProgress(planId: string, expectedProgressVersion: number, items: ChecklistProgressEntry[], accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<GearPlan>>(`${planPath(planId)}/checklist-progress`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify({ expectedProgressVersion, items }),
      }),
    );
  },

  async itemVersion(itemId: string, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<{ version: number }>>(`/api/v1/gear/items/${encodeURIComponent(itemId)}`, {
        method: "GET",
        accessToken,
      }),
    ).version;
  },

  async patchItemAttributes(itemId: string, expectedVersion: number, attributes: Record<string, unknown>, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<{ version: number }>>(`/api/v1/gear/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        accessToken,
        body: JSON.stringify({ expectedVersion, attributes }),
      }),
    );
  },
};
