import { apiRequest } from "@/lib/api-client";

// ─── Public Trip Types ────────────────────────────────────────────────────────

export type PublicTripStatus = "DRAFT" | "OPEN" | "FULL" | "CLOSED";

export interface PublicTripDestination {
  id: string;
  name: string;
}

export interface PublicTripLeader {
  id: string;
  fullName: string;
}

export interface PublicTripPickup {
  name: string;
  address?: string;
}

export interface PublicTripRoute {
  snapshotName: string;
  snapshotDifficulty: string;
  snapshotDistanceKm: string;
}

export interface PublicTripCheckpoint {
  name: string;
  isRequired: boolean;
}

export interface PublicTrip {
  id: string;
  title: string;
  description?: string | null;
  status: PublicTripStatus;
  startAt: string;
  endAt: string;
  destination: PublicTripDestination;
  leader: PublicTripLeader;
  pricePerPax: string;
  currency: string;
  capacity: number;
  remainingSlots: number;
  pickup: PublicTripPickup;
  routes: PublicTripRoute[];
  checkpoints: PublicTripCheckpoint[];
  /** Giờ mở nhận đăng ký — server có thể không trả trên endpoint public */
  registrationOpenAt?: string | null;
  /** Hạn chót đóng form (tự động đóng sổ) */
  registrationDeadlineAt?: string | null;
  version?: number;
}

/**
 * Chuyến OPEN nhưng chưa tới giờ mở nhận đăng ký (registrationOpenAt ở tương lai).
 * Nếu server không trả registrationOpenAt (payload cũ/endpoint public) → coi như đã mở
 * để không chặn đặt chỗ nhầm.
 */
export function isRegistrationNotOpenYet(
  trip: Pick<PublicTrip, "status" | "registrationOpenAt">,
  now: Date = new Date(),
): boolean {
  if (trip.status !== "OPEN" || !trip.registrationOpenAt) return false;
  const openAt = new Date(trip.registrationOpenAt);
  return !Number.isNaN(openAt.getTime()) && now.getTime() < openAt.getTime();
}

export interface PublicTripsListResponse {
  items: PublicTrip[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicTripsFilter {
  page?: number;
  pageSize?: number;
  destinationId?: string;
  difficulty?: string;
  dateFrom?: string;
  dateTo?: string;
  price?: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Unwrap `{ data }` envelope và chuẩn hoá về { items, total, page, pageSize } */
function unwrapList(raw: any, page: number, pageSize: number): PublicTripsListResponse {
  let res = raw;
  if (res && typeof res === "object" && !Array.isArray(res) && "data" in res && res.data) {
    res = res.data;
  }
  const items: any[] = Array.isArray(res)
    ? res
    : Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res?.trips)
        ? res.trips
        : [];
  return {
    items: items.map((t) => normalizeTrip(t ?? {})),
    total: typeof res?.total === "number" ? res.total : items.length,
    page: res?.page || page,
    pageSize: res?.pageSize || pageSize,
  };
}

/** GET /api/v1/public-trips — Explore feed (public, no auth required) */
export async function getPublicTrips(
  filter: PublicTripsFilter = {},
): Promise<PublicTripsListResponse> {
  const params = new URLSearchParams();
  const targetPageSize = Math.min(filter.pageSize || 50, 50);
  const targetPage = filter.page ?? 1;
  params.set("page", String(targetPage));
  params.set("pageSize", String(targetPageSize));
  if (filter.destinationId) params.set("destinationId", filter.destinationId);
  if (filter.difficulty) params.set("difficulty", filter.difficulty);
  if (filter.dateFrom) params.set("dateFrom", filter.dateFrom);
  if (filter.dateTo) params.set("dateTo", filter.dateTo);
  if (filter.price !== undefined) params.set("price", String(filter.price));

  // Uu tien /api/v1/trips (BookingDiscoveryController tra ve day du leader, pickupPoint, remainingSlots tinh theo occupiedSeats)
  let basePath = "/api/v1/trips";
  let rawRes: any;
  try {
    rawRes = await apiRequest<any>(`${basePath}?${params.toString()}`);
  } catch (err) {
    basePath = "/api/v1/public-trips";
    rawRes = await apiRequest<any>(`${basePath}?${params.toString()}`);
  }

  // Trả về đúng trang được yêu cầu — phân trang do server đảm nhiệm
  return unwrapList(rawRes, targetPage, targetPageSize);
}

function unwrapTrip(res: any): PublicTrip {
  let raw = res;
  if (raw && raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    raw = raw.data;
  }
  if (raw && raw.trip && typeof raw.trip === "object" && !raw.title) {
    raw = { ...raw.trip, ...raw, ...raw.trip };
  }
  return normalizeTrip(raw ?? {});
}

/** Đảm bảo mọi field object/array luôn tồn tại để UI không crash */
function normalizeTrip(raw: any, fallbackId?: string): PublicTrip {
  const destination =
    raw.destination && typeof raw.destination === "object"
      ? { id: raw.destination.id ?? "", name: raw.destination.name ?? "" }
      : {
          id: raw.destinationId ?? "",
          name:
            typeof raw.destination === "string"
              ? raw.destination
              : raw.destinationName ?? "",
        };

  const leaderFullName =
    raw.leader?.fullName ||
    raw.leader?.name ||
    raw.leader?.displayName ||
    raw.leaderName ||
    raw.creator?.fullName ||
    raw.creator?.name ||
    raw.creatorName ||
    "";

  const leader = {
    id: raw.leader?.id ?? raw.leaderId ?? raw.creatorId ?? "",
    fullName: leaderFullName,
  };

  const pickupSrc = raw.pickup ?? raw.pickupPoint;
  const pickup =
    pickupSrc && typeof pickupSrc === "object"
      ? {
          name: pickupSrc.name ?? "",
          address: pickupSrc.address ?? undefined,
        }
      : {
          name: raw.pickupName ?? (typeof raw.pickup === "string" ? raw.pickup : ""),
          address: typeof raw.pickupAddress === "string" ? raw.pickupAddress : undefined,
        };

  const capacity = Number(raw.capacity ?? raw.maxPax ?? 0);
  const booked = Number(
    raw.bookedSlots ??
      raw.bookedCount ??
      raw.totalBooked ??
      raw.enrolledCount ??
      raw.bookedPax ??
      raw.participantsCount ??
      0,
  );

  const rawRemaining = raw.remainingSlots ?? raw.availableSlots ?? raw.slotsLeft;
  const remainingSlots =
    rawRemaining !== undefined && rawRemaining !== null
      ? Number(rawRemaining)
      : Math.max(0, capacity - booked);

  return {
    ...raw,
    id: raw.id ?? fallbackId ?? "",
    title: raw.title ?? raw.name ?? "Chuyến đi",
    description: raw.description ?? null,
    status: (raw.status ?? "CLOSED") as PublicTripStatus,
    startAt: raw.startAt ?? "",
    endAt: raw.endAt ?? "",
    destination,
    leader,
    pricePerPax: String(raw.pricePerPax ?? raw.price ?? "0"),
    currency: raw.currency ?? "VND",
    capacity,
    remainingSlots,
    pickup,
    routes: Array.isArray(raw.routes) ? raw.routes : [],
    checkpoints: Array.isArray(raw.checkpoints) ? raw.checkpoints : [],
  };
}

function isNotFound(err: unknown) {
  const status = (err as any)?.status;
  return status === 404 || status === 403;
}

/**
 * Fallback: chuyến public đã chốt / đang diễn ra có thể không còn hiển thị qua
 * endpoint public → dựng dữ liệu chi tiết từ booking của chính người dùng.
 */
async function getTripFromMyBookings(id: string): Promise<PublicTrip | null> {
  try {
    const res = await apiRequest<any>(`/api/v1/bookings?page=1&pageSize=50`);
    const list = res?.data ?? res;
    const items: any[] = Array.isArray(list) ? list : list?.items ?? [];
    const summary = items.find((b) => (b?.trip?.id || b?.tripId) === id);
    if (!summary) return null;

    let detail: any = summary;
    try {
      const d = await apiRequest<any>(`/api/v1/bookings/${summary.id}`);
      detail = d?.data && typeof d.data === "object" ? d.data : d;
    } catch {
      // dùng summary nếu không lấy được detail
    }

    const t = detail?.trip ?? summary.trip ?? {};
    return normalizeTrip(
      {
        ...t,
        pricePerPax: detail?.pricePerPax ?? t.pricePerPax,
        currency: detail?.currency ?? t.currency,
        pickup: detail?.pickup ?? t.pickup,
      },
      id,
    );
  } catch {
    return null;
  }
}

/** GET /api/v1/public-trips/:id — Trip detail for user (no internal priceExplanation) */
export async function getPublicTripById(id: string): Promise<PublicTrip> {
  let lastError: unknown;

  for (const path of [`/api/v1/trips/${id}`, `/api/v1/public-trips/${id}`]) {
    try {
      const res = await apiRequest<any>(path);
      const trip = unwrapTrip(res);
      // Bỏ qua response không phải dữ liệu chuyến đi (không có ngày khởi hành)
      if (trip.startAt) return { ...trip, id: trip.id || id };
    } catch (err) {
      lastError = err;
      if (!isNotFound(err)) throw err;
    }
  }

  const fromBooking = await getTripFromMyBookings(id);
  if (fromBooking) return fromBooking;

  throw lastError ?? new Error("Không tìm thấy thông tin chuyến đi.");
}
