import { apiRequest } from "@/lib/api-client";

export type CheckInStatus = "NOT_CHECKED_IN" | "CHECKED_IN" | "NO_SHOW";
export type CheckInMethod = "QR" | "MANUAL";

export interface LeaderPickupPoint {
  id: string;
  name: string;
  address: string;
}

export interface LeaderParticipantItem {
  id: string;
  bookingId: string;
  bookingStatus: "CONFIRMED" | "PARTIAL_CHECKIN" | "CHECKED_IN" | "COMPLETED" | "NO_SHOW";
  fullName: string;
  phone: string | null;
  dateOfBirth: string | null;
  idDocumentNo: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  participantStatus: "ACTIVE" | "NO_SHOW" | "COMPLETED";
  checkinStatus: CheckInStatus;
  checkinMethod: CheckInMethod | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  isLinkedAccount: boolean;
  linkedUserDisplay: string | null;
  buyerDisplay: string;
  buyerPhone: string | null;
  pickupPoint?: LeaderPickupPoint;
}

export interface LeaderRosterSummary {
  capacity: number;
  minPax: number;
  totalParticipants: number;
  checkedInCount: number;
  notCheckedInCount: number;
  noShowCount: number;
  progressPercent: number;
}

export interface LeaderRosterTrip {
  id: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  capacity: number;
  minPax: number;
}

export interface LeaderRosterResponse {
  trip: LeaderRosterTrip;
  summary: LeaderRosterSummary;
  items: LeaderParticipantItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CheckInPayload {
  checkinCode?: string;
  participantId?: string;
  method?: CheckInMethod;
  checkinStatus?: "CHECKED_IN" | "NO_SHOW";
}

export interface CheckInResponse {
  alreadyCheckedIn: boolean;
  replayed: boolean;
  bookingStatus: "CONFIRMED" | "PARTIAL_CHECKIN" | "CHECKED_IN" | "NO_SHOW";
  bookingVersion: number;
  participant: LeaderParticipantItem;
  summary: LeaderRosterSummary;
}

/**
 * Tạo UUID v4 theo chuẩn RFC 4122 cho header Idempotency-Key
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function unwrapCheckin<T>(res: any): T {
  if (res && typeof res === "object" && "data" in res && res.data !== null && res.data !== undefined) {
    return res.data as T;
  }
  return res as T;
}

/**
 * Lấy danh sách thành viên đoàn và thống kê tiến độ check-in dành cho Trưởng đoàn
 * GET /api/v1/leader/public-trips/:id/participants
 */
export async function fetchTripParticipants(
  tripId: string,
  params?: {
    checkinStatus?: CheckInStatus;
    search?: string;
  },
): Promise<LeaderRosterResponse> {
  const query = new URLSearchParams();
  if (params?.checkinStatus) {
    query.set("checkinStatus", params.checkinStatus);
  }
  if (params?.search && params.search.trim()) {
    query.set("search", params.search.trim());
  }

  const qs = query.toString();
  const url = `/api/v1/leader/public-trips/${encodeURIComponent(tripId)}/participants${qs ? `?${qs}` : ""}`;

  const raw = await apiRequest<any>(url, {
    method: "GET",
  });
  return unwrapCheckin<LeaderRosterResponse>(raw);
}

/**
 * Trưởng đoàn thực hiện điểm danh người tham gia (qua mã QR checkinCode hoặc thủ công participantId)
 * POST /api/v1/leader/public-trips/:id/checkin
 * Header bắt buộc: Idempotency-Key: <uuid>
 */
export async function performCheckIn(
  tripId: string,
  payload: CheckInPayload,
  idempotencyKey?: string,
): Promise<CheckInResponse> {
  const key = idempotencyKey || generateUUID();
  const url = `/api/v1/leader/public-trips/${encodeURIComponent(tripId)}/checkin`;

  const body: Record<string, any> = {};
  if (payload.checkinCode) {
    body.checkinCode = payload.checkinCode.trim();
    body.method = payload.method || "QR";
  } else if (payload.participantId) {
    body.participantId = payload.participantId;
    body.method = payload.method || "MANUAL";
    if (payload.checkinStatus) {
      body.checkinStatus = payload.checkinStatus;
    }
  }

  const raw = await apiRequest<any>(url, {
    method: "POST",
    headers: {
      "Idempotency-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return unwrapCheckin<CheckInResponse>(raw);
}
