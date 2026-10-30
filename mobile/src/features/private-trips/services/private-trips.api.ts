import { apiRequest } from "@/lib/api-client";
import type {
  CreateInviteResponse,
  CreatePrivateTripPayload,
  InvitePreviewData,
  JoinTripResponse,
  LeaveTripResponse,
  MyPrivateTripsResponse,
  PickupPointOption,
  PrivateTrip,
  PurchaseTrailPayload,
  PurchaseTrailResponse,
  RemoveMemberResponse,
  TrailAccessResponse,
  TripMember,
  TripMembersResponse,
  TripRoomData,
  UpdatePrivateTripPayload,
} from "../types";

// ─── NHÓM A: DỮ LIỆU ĐẦU VÀO ĐỂ TẠO CHUYẾN ────────────────────────────────────

/** GET /me/personal-trails — Lấy danh sách cung đường cá nhân */
export async function getPersonalTrails(page = 1) {
  return apiRequest<any[]>(`/api/v1/me/personal-trails?page=${page}`);
}

/** GET /me/trail-accesses — Lấy danh sách cung đường hệ thống đã mua quyền */
export async function getSystemTrailAccesses(page = 1) {
  return apiRequest<any[]>(`/api/v1/me/trail-accesses?page=${page}`);
}

export interface GetSystemTrailsParams {
  destinationId?: string;
  keyword?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "EXTREME" | string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED" | string;
  minDistance?: number;
  maxDistance?: number;
  page?: number;
  pageSize?: number;
}

/** GET /system-trails — Lấy danh sách cung đường hệ thống (có phân trang & lọc) */
export async function getSystemTrails(
  paramsOrDestinationId?: GetSystemTrailsParams | string,
  page = 1,
  pageSize = 20,
) {
  const query = new URLSearchParams();
  if (typeof paramsOrDestinationId === "string") {
    if (paramsOrDestinationId) query.set("destinationId", paramsOrDestinationId);
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));
  } else if (paramsOrDestinationId && typeof paramsOrDestinationId === "object") {
    if (paramsOrDestinationId.destinationId) query.set("destinationId", paramsOrDestinationId.destinationId);
    if (paramsOrDestinationId.keyword) query.set("keyword", paramsOrDestinationId.keyword);
    if (paramsOrDestinationId.difficulty) query.set("difficulty", paramsOrDestinationId.difficulty);
    if (paramsOrDestinationId.status) query.set("status", paramsOrDestinationId.status);
    if (paramsOrDestinationId.minDistance !== undefined) query.set("minDistance", String(paramsOrDestinationId.minDistance));
    if (paramsOrDestinationId.maxDistance !== undefined) query.set("maxDistance", String(paramsOrDestinationId.maxDistance));
    query.set("page", String(paramsOrDestinationId.page ?? page));
    query.set("pageSize", String(paramsOrDestinationId.pageSize ?? pageSize));
  } else {
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));
  }
  return apiRequest<{ items: any[]; pagination?: any }>(
    `/api/v1/system-trails?${query.toString()}`,
  );
}

/** GET /system-trails/{idOrCode} — Lấy chi tiết cung đường hệ thống (3D Map) */
export async function getSystemTrailDetail(idOrCode: string) {
  return apiRequest<any>(
    `/api/v1/system-trails/${encodeURIComponent(idOrCode)}`,
  );
}

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── TRAIL PURCHASE SESSION CACHE (Idempotent Session Reuse) ─────────────────

export interface TrailPurchaseSession {
  idempotencyKey: string;
  paymentMethod: "REDIRECT" | "QR";
  gateway: "vnpay" | "momo";
  checkoutUrl?: string;
  expiresAt: string; // ISO string từ Backend
}

const SESSION_STORAGE_PREFIX = "@trekgo/trail-purchase-session:";
const activeTrailSessions = new Map<string, TrailPurchaseSession>();

/** Lấy thông tin phiên thanh toán đang hoạt động cho cung đường */
export async function getTrailPurchaseSession(
  trailId: string,
): Promise<TrailPurchaseSession | null> {
  const mem = activeTrailSessions.get(trailId);
  const now = Date.now();
  if (mem) {
    if (new Date(mem.expiresAt).getTime() > now) {
      return mem;
    }
    activeTrailSessions.delete(trailId);
  }

  try {
    const raw = await AsyncStorage.getItem(`${SESSION_STORAGE_PREFIX}${trailId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as TrailPurchaseSession;
      if (new Date(parsed.expiresAt).getTime() > now) {
        activeTrailSessions.set(trailId, parsed);
        return parsed;
      }
      await AsyncStorage.removeItem(`${SESSION_STORAGE_PREFIX}${trailId}`);
    }
  } catch {
    // Không ném lỗi storage
  }
  return null;
}

/** Lưu thông tin phiên thanh toán đang chờ */
export async function saveTrailPurchaseSession(
  trailId: string,
  session: TrailPurchaseSession,
): Promise<void> {
  activeTrailSessions.set(trailId, session);
  try {
    await AsyncStorage.setItem(
      `${SESSION_STORAGE_PREFIX}${trailId}`,
      JSON.stringify(session),
    );
  } catch {
    // Không ném lỗi storage
  }
}

/** Xóa phiên thanh toán khi giao dịch hoàn tất hoặc hủy */
export async function clearTrailPurchaseSession(trailId: string): Promise<void> {
  activeTrailSessions.delete(trailId);
  try {
    await AsyncStorage.removeItem(`${SESSION_STORAGE_PREFIX}${trailId}`);
  } catch {
    // Không ném lỗi storage
  }
}

// Giữ lại alias để tương thích ngược
export const clearTrailIdempotencyKey = clearTrailPurchaseSession;

/** GET /trails/{trailId}/access — Kiểm tra quyền truy cập của User với System Trail */
export async function checkTrailAccess(trailId: string) {
  return apiRequest<TrailAccessResponse>(`/api/v1/trails/${trailId}/access`);
}

/** POST /trails/{trailId}/purchase — Mua quyền sử dụng System Trail qua cổng VNPAY */
export async function purchaseTrailAccess(
  trailId: string,
  payload: PurchaseTrailPayload = { paymentMethod: "REDIRECT", gateway: "vnpay" },
  customIdempotencyKey?: string,
) {
  const now = Date.now();
  const existingSession = await getTrailPurchaseSession(trailId);

  let idempotencyKey: string;
  let methodToSend: "REDIRECT" | "QR" = payload.paymentMethod || "REDIRECT";
  let gatewayToSend: "vnpay" | "momo" = payload.gateway || "vnpay";

  // Kiểm tra nếu phiên cũ vẫn còn hiệu lực (< 15 phút)
  if (existingSession && new Date(existingSession.expiresAt).getTime() > now) {
    idempotencyKey = customIdempotencyKey || existingSession.idempotencyKey;
    methodToSend = existingSession.paymentMethod;
    gatewayToSend = existingSession.gateway;
  } else {
    // Tạo key mới nếu chưa có hoặc đã hết hạn
    const cleanTrailId = trailId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
    idempotencyKey = customIdempotencyKey || `mob-${cleanTrailId}-${now}`;
  }

  try {
    // Backend schema: .strict() - chỉ gửi đúng 2 trường paymentMethod & gateway
    const res = await apiRequest<PurchaseTrailResponse>(
      `/api/v1/trails/${trailId}/purchase`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          paymentMethod: methodToSend,
          gateway: gatewayToSend,
        }),
      },
    );

    const checkoutUrl = res.checkout?.url || res.checkout?.paymentUrl;
    if (res.paymentId || checkoutUrl) {
      const expiresAt =
        res.expiresAt ||
        res.checkout?.expiresAt ||
        new Date(now + 14 * 60 * 1000).toISOString();

      await saveTrailPurchaseSession(trailId, {
        idempotencyKey,
        paymentMethod: methodToSend,
        gateway: gatewayToSend,
        checkoutUrl,
        expiresAt,
      });
    }

    return res;
  } catch (error: any) {
    const errCode = error?.code || (error as any)?.details?.code;

    // Nếu bị lỗi payload khác nhau do đổi method, xóa key cũ để lần sau tạo key mới
    if (errCode === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD") {
      await clearTrailPurchaseSession(trailId);
    }

    // Nếu người dùng đã mở khóa trước đó (ACTIVE)
    if (errCode === "PAYMENT_INVALID_STATE") {
      await clearTrailPurchaseSession(trailId);
    }

    throw error;
  }
}

/** GET /private-trip-options/pickup-points — Lấy điểm đón theo địa điểm */
export async function getPickupPoints(destinationId: string, page = 1) {
  return apiRequest<PickupPointOption[]>(
    `/api/v1/private-trip-options/pickup-points?destinationId=${encodeURIComponent(
      destinationId,
    )}&page=${page}`,
  );
}

// ─── NHÓM B: QUẢN LÝ CHUYẾN ĐI (DÀNH CHO HOST) ────────────────────────────────

function extractTripItems(payload: any): PrivateTrip[] {
  if (!payload) return [];
  let rawList: any[] = [];
  if (Array.isArray(payload)) {
    rawList = payload;
  } else if (payload && typeof payload === "object") {
    if (Array.isArray(payload.items)) {
      rawList = payload.items;
    } else if (Array.isArray(payload.trips)) {
      rawList = payload.trips;
    } else if (Array.isArray(payload.data)) {
      rawList = payload.data;
    } else if (Array.isArray(payload.results)) {
      rawList = payload.results;
    } else if (payload.data && typeof payload.data === "object") {
      if (Array.isArray(payload.data.items)) {
        rawList = payload.data.items;
      } else if (Array.isArray(payload.data.trips)) {
        rawList = payload.data.trips;
      } else if (Array.isArray(payload.data.data)) {
        rawList = payload.data.data;
      } else if (Array.isArray(payload.data.results)) {
        rawList = payload.data.results;
      }
    }
  }

  return rawList
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const tripObj =
        item.trip && typeof item.trip === "object" ? { ...item.trip, ...item } : item;
      const tripId = tripObj.id || tripObj._id || item.tripId;
      if (!tripId) return null;

      return {
        ...tripObj,
        id: String(tripId),
        title: tripObj.title || tripObj.name || "Chuyến đi riêng",
        description: tripObj.description ?? null,
        startAt: tripObj.startAt || tripObj.startDate || new Date().toISOString(),
        endAt: tripObj.endAt || tripObj.endDate || new Date().toISOString(),
        maxPax: Number(tripObj.maxPax || tripObj.capacity || 10),
        pickupPointId: tripObj.pickupPointId || "",
        destinationId: tripObj.destinationId || "",
        status: (tripObj.status || "OPEN").toUpperCase(),
        version: typeof tripObj.version === "number" ? tripObj.version : 1,
        inviteCode: tripObj.inviteCode || undefined,
      } as PrivateTrip;
    })
    .filter((t): t is PrivateTrip => t !== null);
}

/** POST /private-trips — Tạo chuyến đi riêng mới */
export async function createPrivateTrip(payload: CreatePrivateTripPayload) {
  const res = await apiRequest<any>("/api/v1/private-trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res && res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
    return res.data as PrivateTrip;
  }
  return res as PrivateTrip;
}

/** GET /private-trips — Lấy danh sách chuyến đi do mình tạo */
/** GET /me/private-trips - Active memberships, including host and invited member. */
export async function getMyPrivateTrips(
  page = 1,
): Promise<PrivateTrip[]> {
  const map = new Map<string, PrivateTrip>();

  // 1. Gọi trực tiếp endpoint chính: GET /api/v1/private-trips?page=1
  try {
    const rawPrivate = await apiRequest<any>(`/api/v1/private-trips?page=${page}`);
    const items = extractTripItems(rawPrivate);
    for (const item of items) {
      map.set(item.id, item);
    }

    // Nếu có phân trang và còn các trang tiếp theo, tự động tải hết để hiển thị đầy đủ
    let total = 0;
    if (typeof rawPrivate?.total === "number") total = rawPrivate.total;
    else if (typeof rawPrivate?.data?.total === "number") total = rawPrivate.data.total;
    const pageSize = rawPrivate?.pageSize || rawPrivate?.data?.pageSize || items.length;

    if (page === 1 && total > items.length && pageSize > 0) {
      const totalPages = Math.ceil(total / pageSize);
      for (let p = 2; p <= totalPages; p++) {
        try {
          const nextRaw = await apiRequest<any>(`/api/v1/private-trips?page=${p}`);
          const nextItems = extractTripItems(nextRaw);
          for (const item of nextItems) {
            map.set(item.id, item);
          }
        } catch {
          // Bỏ qua lỗi trang phụ
        }
      }
    }
  } catch (err) {
    console.warn("[getMyPrivateTrips] /api/v1/private-trips error:", err);
  }

  // 2. Gọi thêm /api/v1/me/private-trips phòng trường hợp có chuyến tham gia với tư cách member
  try {
    const rawMe = await apiRequest<any>(`/api/v1/me/private-trips?page=${page}`);
    const meItems = extractTripItems(rawMe);
    for (const item of meItems) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
  } catch {
    // Không bắt buộc nếu backend không có endpoint này
  }

  return Array.from(map.values());
}

/** GET /private-trips/:id — Chi tiết chuyến đi dành cho Host, tự động fallback sang /private-trips/:id/room cho Member */
export async function getPrivateTripDetail(tripId: string): Promise<PrivateTrip> {
  try {
    const res = await apiRequest<any>(`/api/v1/private-trips/${tripId}`);
    let raw = res;
    if (res && typeof res === "object" && "data" in res && res.data) {
      raw = res.data;
    }
    if (raw && typeof raw === "object" && "trip" in raw && raw.trip) {
      raw = { ...raw.trip, ...raw };
    }
    return raw as PrivateTrip;
  } catch (err: any) {
    // Nếu 404 hoặc không phải Host (chẳng hạn tài khoản tham gia với tư cách Member), lấy qua phòng chuyến đi /private-trips/:id/room
    try {
      const roomRes = await apiRequest<any>(`/api/v1/private-trips/${tripId}/room`);
      const roomData = roomRes?.data ?? roomRes;
      const t = roomData?.trip ?? roomData;
      return {
        ...t,
        maxPax: t.capacity ?? t.maxPax ?? 1,
        pickupPoint: t.pickupPoint ?? undefined,
        tripTrailPlansViaTripId: roomData.plannedRoutes?.map((r: any) => ({
          snapshotName: r.name,
          snapshotDifficulty: r.difficulty,
          snapshotDistanceKm: r.distanceKm,
          snapshotElevationGainM: r.elevationGainM,
          snapshotGeojson: r.geojson,
        })),
        tripCheckpointsViaTripId: roomData.requiredCheckpoints,
        viewer: roomData.viewer,
        permissions: roomData.permissions,
        activeMemberCount: t.activeMemberCount,
      } as PrivateTrip;
    } catch {
      throw err;
    }
  }
}

export async function updatePrivateTrip(
  tripId: string,
  payload: UpdatePrivateTripPayload,
) {
  return apiRequest<PrivateTrip>(`/api/v1/private-trips/${tripId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** POST /private-trips/:id/invitations — Tạo mã mời / link mời */
export async function createTripInvite(
  tripId: string,
  expectedVersion: number,
  expiresAt?: string,
) {
  return apiRequest<CreateInviteResponse>(
    `/api/v1/private-trips/${tripId}/invitations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion,
        ...(expiresAt ? { expiresAt } : {}),
      }),
    },
  );
}

/** POST /private-trips/:id/invitations/revoke — Thu hồi mã mời */
export async function revokeTripInvite(tripId: string, expectedVersion: number) {
  return apiRequest<{ tripId: string; revokedCount: number; tripVersion: number }>(
    `/api/v1/private-trips/${tripId}/invitations/revoke`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion }),
    },
  );
}

/** POST /private-trips/:id/cancel — Hủy chuyến đi (kèm lý do) */
export async function cancelPrivateTrip(
  tripId: string,
  expectedVersion: number,
  reason: string,
) {
  return apiRequest<PrivateTrip>(`/api/v1/private-trips/${tripId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedVersion, reason }),
  });
}

// ─── NHÓM C: THÀNH VIÊN, LỜI MỜI VÀ PHÒNG CHỜ ─────────────────────────────────

/** GET /private-trip-invitations/:code — Xem trước lời mời (Public Preview) */
export async function previewTripInvite(code: string) {
  return apiRequest<InvitePreviewData>(
    `/api/v1/private-trip-invitations/${encodeURIComponent(code)}`,
  );
}

/** POST /private-trip-invitations/:code/join — Xác nhận tham gia chuyến đi */
export async function joinPrivateTripByCode(code: string, accessToken?: string) {
  return apiRequest<JoinTripResponse>(
    `/api/v1/private-trip-invitations/${encodeURIComponent(code)}/join`,
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

/** GET /private-trips/:id/room — Xem Phòng chờ chuyến đi (Trip Room) */
export async function getPrivateTripRoom(tripId: string) {
  const res = await apiRequest<any>(`/api/v1/private-trips/${tripId}/room`);
  if (res && res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
    return res.data as TripRoomData;
  }
  return res as TripRoomData;
}

/** GET /private-trips/:id/members — Lấy danh sách thành viên trong chuyến đi */
export async function getPrivateTripMembers(
  tripId: string,
  params: { page?: number; pageSize?: number; status?: "ACTIVE" | "ALL" | string } = {},
): Promise<TripMembersResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page || 1));
  query.set("pageSize", String(params.pageSize || 50));
  if (params.status) query.set("status", params.status);

  return apiRequest<TripMembersResponse>(
    `/api/v1/private-trips/${tripId}/members?${query.toString()}`,
  );
}

/** POST /private-trips/:id/leave — Thành viên tự rời nhóm */
export async function leavePrivateTripRoom(
  tripId: string,
  expectedMemberVersion: number,
) {
  return apiRequest<LeaveTripResponse>(`/api/v1/private-trips/${tripId}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedMemberVersion }),
  });
}

/** DELETE /private-trips/:id/members/:memberId — Host loại thành viên khỏi chuyến */
export async function removePrivateTripMember(
  tripId: string,
  memberId: string,
  expectedMemberVersion: number,
) {
  return apiRequest<RemoveMemberResponse>(
    `/api/v1/private-trips/${tripId}/members/${memberId}?expectedMemberVersion=${expectedMemberVersion}`,
    {
      method: "DELETE",
    },
  );
}
