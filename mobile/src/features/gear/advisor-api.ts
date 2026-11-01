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
};

export type PlanGuidance = {
  available: boolean;
  message?: string;
  isLatestEvaluation?: boolean;
  needsReevaluation?: boolean;
  items?: {
    itemId: string;
    nameAtEvaluation: string | null;
    category: string;
    displayStatus: string;
    reasons?: string[];
    questions: GuidanceQuestion[];
  }[];
  requirements?: {
    requirementId: string;
    category: string;
    remainingQuantity?: number;
    warnings?: string[];
    questions?: GuidanceQuestion[];
  }[];
  contextQuestions?: {
    available: boolean;
    items: { itemId: string; nameAtEvaluation: string | null; category: string; questions: GuidanceQuestion[] }[];
  };
};

export type PreparationStatus = "HAVE" | "NOT_HAVE" | "CHECK_LATER";
export type PreparationSelections = {
  planId: string;
  choices: { category: GearCategory; status: PreparationStatus }[];
  version: number;
  updatedAt: string | null;
};

export type GearTripCandidate = { id: string; title: string; startAt?: string; type: "PUBLIC" | "PRIVATE" };

export function gearErrorCode(error: unknown) {
  return error instanceof ApiError ? error.code ?? null : null;
}

export function gearErrorMessage(error: unknown, fallback = "Không kết nối được Gear Advisor.") {
  return error instanceof Error ? error.message : fallback;
}

export const gearAdvisorApi = {
  async listTripCandidates(accessToken: string): Promise<GearTripCandidate[]> {
    const [bookings, privateTrips] = await Promise.allSettled([
      apiRequest<Envelope<{ items: { trip: { id: string; title: string; startAt?: string } }[] }>>(
        "/api/v1/bookings?page=1&pageSize=50",
        { method: "GET", accessToken },
      ),
      apiRequest<Envelope<{ items: { id: string; title: string; startAt?: string }[] }>>(
        "/api/v1/me/private-trips?page=1&pageSize=50",
        { method: "GET", accessToken },
      ),
    ]);
    const result = new Map<string, GearTripCandidate>();
    if (bookings.status === "fulfilled") {
      for (const booking of unwrap(bookings.value).items ?? []) {
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
      await apiRequest<Envelope<Record<string, unknown>>>(
        `/api/v1/gear/plans/prefill?tripId=${encodeURIComponent(tripId)}`,
        { method: "GET", accessToken },
      ),
    );
  },

  async listPlans(accessToken: string): Promise<GearPlan[]> {
    const data = unwrap(
      await apiRequest<Envelope<GearPlan[] | { items: GearPlan[] }>>("/api/v1/gear/plans", { method: "GET", accessToken }),
    );
    return Array.isArray(data) ? data : data?.items ?? [];
  },

  async getPlan(planId: string, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<GearPlan>>(`/api/v1/gear/plans/${encodeURIComponent(planId)}`, { method: "GET", accessToken }),
    );
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

  async updatePlan(planId: string, input: { expectedInputRevision: number; selectedItemIds: string[] }, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<GearPlan>>(`/api/v1/gear/plans/${encodeURIComponent(planId)}`, {
        method: "PATCH",
        accessToken,
        body: JSON.stringify(input),
      }),
    );
  },

  async evaluate(planId: string, input: { expectedInputRevision: number; confirmedClimate: ConfirmedClimate }, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<Record<string, unknown>>>(`/api/v1/gear/plans/${encodeURIComponent(planId)}/evaluate`, {
        method: "POST",
        accessToken,
        body: JSON.stringify(input),
      }),
    );
  },

  async guidance(planId: string, revision: number, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<PlanGuidance>>(
        `/api/v1/gear/plans/${encodeURIComponent(planId)}/revisions/${revision}/guidance`,
        { method: "GET", accessToken },
      ),
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

  async getSelections(planId: string, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<PreparationSelections>>(
        `/api/v1/gear/plans/${encodeURIComponent(planId)}/preparation-selections`,
        { method: "GET", accessToken },
      ),
    );
  },

  async putSelections(planId: string, input: { expectedVersion: number; choices: PreparationSelections["choices"] }, accessToken: string) {
    return unwrap(
      await apiRequest<Envelope<PreparationSelections>>(
        `/api/v1/gear/plans/${encodeURIComponent(planId)}/preparation-selections`,
        { method: "PUT", accessToken, body: JSON.stringify(input) },
      ),
    );
  },
};

/** Tìm trong phản hồi prefill một object có các trường khí hậu (cấu trúc có thể lồng nhau). */
export function findSuggestedClimate(value: unknown, depth = 0): Partial<ConfirmedClimate> | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  const record = value as Record<string, unknown>;
  const keys: (keyof ConfirmedClimate)[] = ["temp_min_c", "temp_max_c", "temp_min_night_c", "rain_prob_pct"];
  const hits = keys.filter((key) => typeof record[key] === "number");
  if (hits.length >= 2) return Object.fromEntries(hits.map((key) => [key, record[key] as number])) as Partial<ConfirmedClimate>;
  for (const child of Object.values(record)) {
    const found = findSuggestedClimate(child, depth + 1);
    if (found) return found;
  }
  return null;
}
