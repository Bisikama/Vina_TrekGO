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
  updatedAt?: string;
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
  requirementId?: string;
  constraintIds?: string[];
};

export type GuidanceItem = {
  itemId: string;
  nameAtEvaluation: string | null;
  versionAtEvaluation: number | null;
  category: GearCategory;
  verdict: string;
  displayStatus: "SUITABLE" | "NEEDS_INFORMATION" | "NEEDS_ATTENTION" | string;
  reasons?: string[];
  questions: GuidanceQuestion[];
};

export type GuidanceRequirement = {
  requirementId: string;
  category: GearCategory | string;
  priority?: string;
  status?: string;
  recommendedAction?: string;
  remainingQuantity?: number;
  assignedItemIds?: string[];
  warnings?: string[];
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

export type PreparationStatus = "HAVE" | "NOT_HAVE" | "CHECK_LATER";
export type PreparationSelections = {
  planId: string;
  choices: Array<{ category: GearCategory; status: PreparationStatus }>;
  version: number;
  updatedAt: string | null;
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

/** Ứng viên chuyến: vé đã đặt + chuyến riêng. Backend (prefill) mới là nơi quyết định có dùng được hay không. */
export async function listGearTripCandidates(): Promise<GearTripCandidate[]> {
  const [bookings, privateTrips] = await Promise.allSettled([
    apiClient.get<Envelope<{ items: Array<{ trip: { id: string; title: string; startAt?: string; endAt?: string } }> }>>(
      "/api/v1/bookings?page=1&pageSize=50",
    ),
    apiClient.get<Envelope<{ items: Array<{ id: string; title: string; startAt?: string; endAt?: string }> }>>(
      "/api/v1/me/private-trips?page=1&pageSize=50",
    ),
  ]);
  const result = new Map<string, GearTripCandidate>();
  if (bookings.status === "fulfilled") {
    for (const booking of unwrap(bookings.value.data).items ?? []) {
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
  const response = await apiClient.get<Envelope<Record<string, unknown>>>(
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

export async function updateGearPlan(planId: string, input: { expectedInputRevision: number; selectedItemIds?: string[]; title?: string }) {
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

export async function getPreparationSelections(planId: string) {
  const response = await apiClient.get<Envelope<PreparationSelections>>(
    `/api/v1/gear/plans/${encodeURIComponent(planId)}/preparation-selections`,
  );
  return unwrap(response.data);
}

export async function putPreparationSelections(
  planId: string,
  input: { expectedVersion: number; choices: PreparationSelections["choices"] },
) {
  const response = await apiClient.put<Envelope<PreparationSelections>>(
    `/api/v1/gear/plans/${encodeURIComponent(planId)}/preparation-selections`,
    input,
  );
  return unwrap(response.data);
}

/** Tìm trong phản hồi prefill một object có đủ 4 trường khí hậu (cấu trúc prefill có thể lồng nhau). */
export function findSuggestedClimate(value: unknown, depth = 0): Partial<ConfirmedClimate> | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  const record = value as Record<string, unknown>;
  const keys: Array<keyof ConfirmedClimate> = ["temp_min_c", "temp_max_c", "temp_min_night_c", "rain_prob_pct"];
  const hits = keys.filter((key) => typeof record[key] === "number");
  if (hits.length >= 2) {
    return Object.fromEntries(hits.map((key) => [key, record[key] as number])) as Partial<ConfirmedClimate>;
  }
  for (const child of Object.values(record)) {
    const found = findSuggestedClimate(child, depth + 1);
    if (found) return found;
  }
  return null;
}
