import axios from "axios";

import { apiClient } from "@/lib/axios";
import type { GearCategory } from "@/features/rentals/services/gear.api";

// Gear Advisor (web/docs/GEAR_ADVISOR_FRONTEND_HANDOFF.md). Mọi version lấy từ phản hồi thật, không cố định.

type Envelope<T> = T | { data: T };
const unwrap = <T,>(payload: Envelope<T>) =>
  payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: T }).data
    : (payload as T);

export type ConfirmedClimate = {
  temp_min_c: number;
  temp_max_c: number;
  temp_min_night_c: number;
  rain_prob_pct: number;
};

export type GearPlan = {
  id: string;
  title: string;
  tripId: string | null;
  selectedItemIds: string[];
  inputRevision: number;
  evaluatedRevision: number | null;
  isStale?: boolean;
  progressVersion: number;
  progressJson: Array<{ requirementId: string; isChecked: boolean; note?: string }> | { items: Array<{ requirementId: string; isChecked: boolean; note?: string }> } | null;
  preferences?: { selfProvidedRequirementIds?: string[]; [key: string]: unknown } | null;
  /** Thời tiết đã xác nhận ở lần đánh giá gần nhất nằm ở `canonicalContext.confirmedClimate`. */
  canonicalContext?: { confirmedClimate?: ConfirmedClimate | null; [key: string]: unknown } | null;
  updatedAt?: string;
};

export type ClimateSuggestion = ConfirmedClimate & {
  source: "CLIMATE_ESTIMATE" | "FORECAST";
  /** Dự báo lấy tại điểm cao nhất của cung (m); thiếu khi dự báo ở tâm điểm đến. */
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

export const selfProvidedOf = (plan: GearPlan | null) =>
  Array.isArray(plan?.preferences?.selfProvidedRequirementIds) ? plan.preferences.selfProvidedRequirementIds : [];

export type PackingChecklistItem = {
  requirementId: string;
  category: string;
  title: string;
  priority: string;
  quantity: number;
  remainingQuantity: number;
  status: string;
  assignedItemIds: string[];
  exportSection?: string;
  exportDetail?: string;
  isChecked?: boolean;
  /** Đồ thiết yếu (status "ESSENTIAL"): lý do theo điều kiện chuyến. */
  reason?: string;
};

/** Đồ thiết yếu không có thông số (đèn đầu, nước, sơ cứu...), chỉ để đóng gói. Bản đánh giá cũ chưa có. */
export type TripEssential = { id: string; title: string; priority: "REQUIRED" | "RECOMMENDED"; reason: string };

/** Checklist đóng gói của một lần đánh giá: đồ theo yêu cầu, rồi tới đồ thiết yếu (mã `ess_*`). */
export async function getGearPlanChecklist(planId: string, revision: number): Promise<PackingChecklistItem[]> {
  const response = await apiClient.get<Envelope<{ resultSnapshot: { checklist?: PackingChecklistItem[]; essentials?: TripEssential[] } }>>(
    `/api/v1/gear/plans/${encodeURIComponent(planId)}/revisions/${revision}`,
  );
  const snapshot = unwrap(response.data).resultSnapshot;
  const essentials = (snapshot.essentials ?? []).map((essential): PackingChecklistItem => ({
    requirementId: essential.id,
    category: "ESSENTIAL",
    title: essential.title,
    priority: essential.priority === "REQUIRED" ? "REQUIRED" : "OPTIONAL",
    quantity: 1,
    remainingQuantity: 0,
    status: "ESSENTIAL",
    assignedItemIds: [],
    reason: essential.reason,
  }));
  return [...(snapshot.checklist ?? []), ...essentials];
}

export async function saveChecklistProgress(planId: string, expectedProgressVersion: number, items: Array<{ requirementId: string; isChecked: boolean; note?: string }>) {
  const response = await apiClient.put<Envelope<GearPlan>>(`/api/v1/gear/plans/${encodeURIComponent(planId)}/checklist-progress`, { expectedProgressVersion, items });
  return unwrap(response.data);
}

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
  requirementId?: string;
  constraintIds?: string[];
};

export type GuidanceItem = {
  itemId: string;
  nameAtEvaluation: string | null;
  versionAtEvaluation: number | null;
  category: GearCategory;
  verdict: string | null;
  displayStatus: "SUITABLE" | "NEEDS_INFORMATION" | "NEEDS_ATTENTION" | "NOT_ASSESSED" | string;
  reasons?: string[];
  questions: GuidanceQuestion[];
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
  criteria?: Array<{ field: string; label: string; text: string; reason: string | null }>;
  questions?: GuidanceQuestion[];
};

export type PlanGuidance = {
  available: boolean;
  message?: string;
  revision?: number;
  inputRevision?: number;
  evaluatedRevision?: number | null;
  isLatestEvaluation?: boolean;
  needsReevaluation?: boolean;
  isStale?: boolean;
  items?: GuidanceItem[];
  requirements?: GuidanceRequirement[];
  contextQuestions?: {
    available: boolean;
    items: Array<{
      itemId: string;
      nameAtEvaluation: string | null;
      category: string;
      questions: GuidanceQuestion[];
    }>;
  };
};

export type GearTripCandidate = {
  id: string;
  title: string;
  startAt?: string;
  endAt?: string;
  type: "PUBLIC" | "PRIVATE";
};

export function getGearAdvisorErrorMessage(error: unknown, fallback = "Không thể kết nối tới Gear Advisor.") {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (data && typeof data === "object") {
      const apiError = (data as { error?: { message?: unknown; code?: unknown } }).error;
      if (apiError && typeof apiError.message === "string") return apiError.message;
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  }
  return error instanceof Error ? error.message : fallback;
}

export function getGearAdvisorErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  const data: unknown = error.response?.data;
  const code = data && typeof data === "object" ? (data as { error?: { code?: unknown } }).error?.code : undefined;
  return typeof code === "string" ? code : null;
}

/** Booking dùng được cho Gear (cùng điều kiện với backend `hasPublicBookingAccess`). */
const GEAR_BOOKING_STATUSES = new Set(["CONFIRMED", "PARTIAL_CHECKIN", "CHECKED_IN"]);

/** Ứng viên chuyến: vé đã đặt còn hiệu lực + chuyến riêng. Backend (prefill) vẫn là nơi quyết định cuối. */
export async function listGearTripCandidates(): Promise<GearTripCandidate[]> {
  const [bookings, privateTrips] = await Promise.allSettled([
    apiClient.get<Envelope<{ items: Array<{ status?: string; trip: { id: string; title: string; startAt?: string; endAt?: string } }> }>>(
      "/api/v1/bookings?page=1&pageSize=50",
    ),
    apiClient.get<Envelope<{ items: Array<{ id: string; title: string; startAt?: string; endAt?: string }> }>>(
      "/api/v1/me/private-trips?page=1&pageSize=50",
    ),
  ]);
  const result = new Map<string, GearTripCandidate>();
  if (bookings.status === "rejected" && privateTrips.status === "rejected") throw bookings.reason;
  if (bookings.status === "fulfilled") {
    for (const booking of unwrap(bookings.value.data).items ?? []) {
      if (booking?.status && !GEAR_BOOKING_STATUSES.has(booking.status)) continue;
      if (booking?.trip?.id) result.set(booking.trip.id, { ...booking.trip, type: "PUBLIC" });
    }
  }
  if (privateTrips.status === "fulfilled") {
    for (const trip of unwrap(privateTrips.value.data).items ?? []) {
      if (trip?.id) result.set(trip.id, { ...trip, type: "PRIVATE" });
    }
  }
  return [...result.values()].sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""));
}

export async function getGearPlanPrefill(tripId: string) {
  const response = await apiClient.get<Envelope<GearPlanPrefill>>(
    `/api/v1/gear/plans/prefill?tripId=${encodeURIComponent(tripId)}`,
  );
  return unwrap(response.data);
}

export async function listGearPlans(): Promise<GearPlan[]> {
  const response = await apiClient.get<Envelope<GearPlan[] | { items: GearPlan[] }>>("/api/v1/gear/plans");
  const data = unwrap(response.data);
  return Array.isArray(data) ? data : data?.items ?? [];
}

export async function getGearPlan(planId: string) {
  const response = await apiClient.get<Envelope<GearPlan>>(`/api/v1/gear/plans/${encodeURIComponent(planId)}`);
  return unwrap(response.data);
}

export async function createGearPlan(input: { title: string; tripId: string; selectedItemIds: string[] }) {
  const response = await apiClient.post<Envelope<GearPlan>>("/api/v1/gear/plans", {
    ...input,
    contextMode: "TRIP",
  });
  return unwrap(response.data);
}

export async function updateGearPlan(
  planId: string,
  input: { expectedInputRevision: number; selectedItemIds?: string[]; title?: string; selfProvidedRequirementIds?: string[] },
) {
  const response = await apiClient.patch<Envelope<GearPlan>>(`/api/v1/gear/plans/${encodeURIComponent(planId)}`, input);
  return unwrap(response.data);
}

export async function evaluateGearPlan(planId: string, input: { expectedInputRevision: number; confirmedClimate: ConfirmedClimate }) {
  const response = await apiClient.post<Envelope<Record<string, unknown>>>(
    `/api/v1/gear/plans/${encodeURIComponent(planId)}/evaluate`,
    input,
  );
  return unwrap(response.data);
}

export async function getGearPlanGuidance(planId: string, revision: number) {
  const response = await apiClient.get<Envelope<PlanGuidance>>(
    `/api/v1/gear/plans/${encodeURIComponent(planId)}/revisions/${revision}/guidance`,
  );
  return unwrap(response.data);
}

export async function getGearItemVersion(itemId: string) {
  const response = await apiClient.get<Envelope<{ id: string; version: number }>>(
    `/api/v1/gear/items/${encodeURIComponent(itemId)}`,
  );
  return unwrap(response.data).version;
}

export async function patchGearItemAttributes(itemId: string, expectedVersion: number, attributes: Record<string, unknown>) {
  const response = await apiClient.patch<Envelope<{ id: string; version: number }>>(
    `/api/v1/gear/items/${encodeURIComponent(itemId)}`,
    { expectedVersion, attributes },
  );
  return unwrap(response.data);
}

