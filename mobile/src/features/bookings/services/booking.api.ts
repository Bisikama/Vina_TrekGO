import { ApiError, apiRequest } from "@/lib/api-client";
import type {
  BookingDetail,
  BookingListQuery,
  BookingSummary,
  CancelBookingResponse,
  PageResponse,
  Participant,
  PaymentCheckoutResponse,
  PaymentGateway,
  PaymentMethod,
  PaymentOptionsResponse,
  PublicBookingTrip,
  PublicTripsQuery,
} from "../types";

// ─── UUID / Idempotency Key Generator & Session Cache ──────────────────────────

/**
 * Generates an RFC 4122 v4 UUID string for Idempotency-Key header.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Cache lưu Idempotency-Key theo bookingId trong bộ nhớ tạm để tránh tạo đè
 * gây lỗi 409 PAYMENT_ATTEMPT_IN_PROGRESS ("A payment attempt is still unresolved")
 */
interface PaymentSessionItem {
  key: string;
  paymentMethod: PaymentMethod;
  gateway?: PaymentGateway;
  createdAt: number;
}
const bookingPaymentSessions: Record<string, PaymentSessionItem> = {};

type SessionCleanupListener = (bookingId: string) => void;
const cleanupListeners: SessionCleanupListener[] = [];
export function registerPaymentSessionCleanup(listener: SessionCleanupListener) {
  cleanupListeners.push(listener);
}

// ─── Payload Formatters ────────────────────────────────────────────────────────

/**
 * Formats participants payload:
 * - Omits id for new participants
 * - Omits empty strings to satisfy Zod validation rules
 */
export function formatParticipantsPayload(participants: Participant[]) {
  return {
    participantCount: participants.length,
    participants: participants.map((p) => {
      const item: Record<string, any> = {
        fullName: p.fullName.trim(),
        phone: p.phone ? p.phone.trim() : "",
      };
      if (p.id) {
        item.id = p.id;
      }
      return item;
    }),
  };
}

// ─── Error Message Mapping ─────────────────────────────────────────────────────

export const BOOKING_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Vui lòng đăng nhập để tiếp tục.",
  FORBIDDEN: "Bạn không có quyền thao tác đặt chỗ này.",
  ACTIVE_BOOKING_EXISTS:
    "Bạn đã có đặt chỗ đang hoạt động cho chuyến này. Đang mở đặt chỗ hiện tại của bạn...",
  CAPACITY_CONFLICT:
    "Chuyến đi không còn đủ chỗ. Vui lòng giảm số người hoặc chọn chuyến khác.",
  BOOKING_HOLD_EXPIRED: "Thời gian giữ chỗ đã hết. Vui lòng tạo đặt chỗ mới.",
  BOOKING_VERSION_CONFLICT:
    "Đặt chỗ đã thay đổi trên máy chủ. Vui lòng tải lại trước khi sửa.",
  PAYMENT_ATTEMPT_IN_PROGRESS:
    "Giao dịch thanh toán trước đó đang chờ xử lý. Vui lòng thử lại sau ít phút hoặc mở lại trang thanh toán.",
  PAYMENT_PROVIDER_UNAVAILABLE:
    "Cổng thanh toán đang tạm thời không khả dụng. Vui lòng thử lại sau.",
  BOOKING_POLICY_UNAVAILABLE:
    "Chuyến đi chưa sẵn sàng nhận đặt chỗ. Vui lòng thử lại sau.",
  BOOKING_CANCELLATION_POLICY_INVALID:
    "Chính sách hoàn tiền chưa được cấu hình. Vui lòng liên hệ hỗ trợ.",
  INVALID_STATE_TRANSITION: "Trạng thái hiện tại không cho phép thao tác này.",
  VALIDATION_ERROR:
    "Vui lòng kiểm tra thông tin thành viên và dữ liệu đã nhập.",
  NOT_FOUND: "Không tìm thấy thông tin chuyến đi hoặc đặt chỗ.",
};

export function getBookingErrorMessage(
  error: unknown,
  fallback = "Đã có lỗi xảy ra. Vui lòng thử lại.",
): { message: string; code?: string; bookingId?: string } {
  if (error instanceof ApiError) {
    const code = error.code;
    const details = error.details as any;
    const bookingId = details?.bookingId as string | undefined;

    let message = fallback;
    if (
      code === "PAYMENT_ATTEMPT_IN_PROGRESS" ||
      error.message?.toLowerCase().includes("unresolved") ||
      error.status === 409
    ) {
      message =
        "Phiên thanh toán trước đó đang chờ xử lý từ cổng thanh toán. Vui lòng thử lại sau giây lát.";
    } else if (code && BOOKING_ERROR_MESSAGES[code]) {
      message = BOOKING_ERROR_MESSAGES[code];
    } else if (error.message) {
      message = error.message;
    }

    return { message, code, bookingId };
  }

  if (error instanceof Error) {
    return { message: error.message || fallback };
  }

  return { message: fallback };
}

// ─── Booking Status Labels ─────────────────────────────────────────────────────

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã điểm danh",
  PARTIAL_CHECKIN: "Điểm danh 1 phần",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
  NO_SHOW: "Vắng mặt",
};

// ─── API Service ───────────────────────────────────────────────────────────────

/** Bóc envelope `{ data: {...} }` nếu backend bọc response */
function unwrapBooking(res: any): BookingDetail {
  if (res && res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
    return res.data as BookingDetail;
  }
  return res as BookingDetail;
}

export const bookingApiService = {
  /**
   * GET /api/v1/public-trips
   * Khám phá danh sách Public Trips mở đăng ký
   */
  getPublicTrips: async (
    query: PublicTripsQuery = {},
  ): Promise<PageResponse<PublicBookingTrip>> => {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.pageSize) params.set("pageSize", String(query.pageSize));
    if (query.destinationId) params.set("destinationId", query.destinationId);
    if (query.difficulty) params.set("difficulty", query.difficulty);
    if (query.dateFrom) params.set("dateFrom", query.dateFrom);
    if (query.dateTo) params.set("dateTo", query.dateTo);
    if (query.price !== undefined) params.set("price", String(query.price));

    const q = params.toString();
    return apiRequest<PageResponse<PublicBookingTrip>>(
      `/api/v1/public-trips${q ? `?${q}` : ""}`,
    );
  },

  /**
   * GET /api/v1/public-trips/{id}
   * Chi tiết Public Trip
   */
  getPublicTripDetail: async (tripId: string): Promise<PublicBookingTrip> => {
    return apiRequest<PublicBookingTrip>(`/api/v1/public-trips/${tripId}`);
  },

  /**
   * POST /api/v1/trips/{tripId}/bookings
   * Tạo booking & giữ chỗ tạm thời (Hold)
   */
  createBooking: async (
    tripId: string,
    participants: Participant[],
    idempotencyKey?: string,
  ): Promise<BookingDetail> => {
    const key = idempotencyKey || generateIdempotencyKey();
    const payload = formatParticipantsPayload(participants);
    const res = await apiRequest<any>(`/api/v1/trips/${tripId}/bookings`, {
      method: "POST",
      headers: {
        "Idempotency-Key": key,
      },
      body: JSON.stringify(payload),
    });
    return unwrapBooking(res);
  },

  /**
   * GET /api/v1/bookings/{id}
   * Xem chi tiết đặt chỗ và thông tin thanh toán / vé
   */
  getBookingDetail: async (bookingId: string): Promise<BookingDetail> => {
    const res = await apiRequest<any>(`/api/v1/bookings/${bookingId}`);
    return unwrapBooking(res);
  },

  /**
   * GET /api/v1/bookings
   * Danh sách đặt chỗ của người dùng hiện tại
   */
  listMyBookings: async (
    query: BookingListQuery = {},
  ): Promise<PageResponse<BookingSummary>> => {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    params.set("pageSize", String(query.pageSize || 50));
    if (query.status) params.set("status", query.status);

    const q = params.toString();
    const res = await apiRequest<any>(
      `/api/v1/bookings${q ? `?${q}` : ""}`,
    );

    let unwrapped = res;
    if (res && typeof res === "object" && "data" in res && res.data) {
      unwrapped = res.data;
    }

    if (Array.isArray(unwrapped)) {
      return {
        items: unwrapped,
        total: unwrapped.length,
        page: query.page || 1,
        pageSize: query.pageSize || 50,
      };
    }

    return {
      items: Array.isArray(unwrapped?.items) ? unwrapped.items : [],
      total: typeof unwrapped?.total === "number" ? unwrapped.total : (unwrapped?.items?.length || 0),
      page: unwrapped?.page || query.page || 1,
      pageSize: unwrapped?.pageSize || query.pageSize || 50,
    };
  },

  /**
   * PATCH /api/v1/bookings/{id}/participants
   * Cập nhật danh sách thành viên trước khi khởi hành
   */
  updateParticipants: async (
    bookingId: string,
    participants: Participant[],
    expectedVersion?: number,
  ): Promise<BookingDetail> => {
    const payload = {
      ...formatParticipantsPayload(participants),
      ...(typeof expectedVersion === "number" ? { expectedVersion } : {}),
    };
    const res = await apiRequest<any>(
      `/api/v1/bookings/${bookingId}/participants`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return unwrapBooking(res);
  },

  /**
   * GET /api/v1/payments/options
   * Lấy danh sách cổng thanh toán đang hoạt động
   */
  getPaymentOptions: async (): Promise<PaymentOptionsResponse> => {
    return apiRequest<PaymentOptionsResponse>(`/api/v1/payments/options`);
  },

  /**
   * POST /api/v1/bookings/{id}/payments
   * Khởi tạo thanh toán (Redirect / QR)
   * Tự động quản lý Idempotency-Key: tái sử dụng key trong vòng 14 phút nếu cùng phương thức
   * để không bị lỗi 409 PAYMENT_ATTEMPT_IN_PROGRESS.
   */
  createPayment: async (
    bookingId: string,
    idempotencyKey?: string,
    paymentMethod: PaymentMethod = "REDIRECT",
    gateway?: PaymentGateway,
  ): Promise<PaymentCheckoutResponse> => {
    const now = Date.now();
    const session = bookingPaymentSessions[bookingId];

    let finalKey = idempotencyKey;

    // Nếu không truyền key từ ngoài vào, tự động quản lý phiên:
    if (!finalKey) {
      if (
        session &&
        session.paymentMethod === paymentMethod &&
        session.gateway === gateway &&
        now - session.createdAt < 14 * 60 * 1000
      ) {
        // Tái sử dụng key cũ đang còn hiệu lực
        finalKey = session.key;
      } else {
        // Sinh key mới và lưu vào session
        finalKey = generateIdempotencyKey();
        bookingPaymentSessions[bookingId] = {
          key: finalKey,
          paymentMethod,
          gateway,
          createdAt: now,
        };
      }
    }

    const body: Record<string, any> = { paymentMethod };
    if (gateway) body.gateway = gateway;

    try {
      const res = await apiRequest<PaymentCheckoutResponse>(
        `/api/v1/bookings/${bookingId}/payments`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": finalKey,
          },
          body: JSON.stringify(body),
        },
      );
      return res;
    } catch (err: any) {
      // Nếu payload bị xung đột (ví dụ đổi cổng từ vnpay sang momo), xóa session cũ
      if (err?.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD") {
        delete bookingPaymentSessions[bookingId];
      }
      throw err;
    }
  },

  /**
   * Dọn dẹp key thanh toán khi booking đã thanh toán thành công hoặc đã hủy
   */
  clearBookingPaymentSession: (bookingId: string) => {
    delete bookingPaymentSessions[bookingId];
    cleanupListeners.forEach((fn) => {
      try {
        fn(bookingId);
      } catch {}
    });
  },

  /**
   * POST /api/v1/bookings/{id}/cancel
   * Hủy đặt chỗ theo chính sách hoàn tiền
   */
  cancelBooking: async (
    bookingId: string,
    reason: string,
    idempotencyKey?: string,
  ): Promise<CancelBookingResponse> => {
    const key = idempotencyKey || generateIdempotencyKey();
    const res = await apiRequest<CancelBookingResponse>(
      `/api/v1/bookings/${bookingId}/cancel`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ reason }),
      },
    );
    // Hủy xong thì giải phóng luôn session thanh toán
    delete bookingPaymentSessions[bookingId];
    return res;
  },

  /**
   * POST /api/v1/bookings/{id}/participants/{pid}/self-claim
   * Người mua tự nhận vé cho chính mình
   */
  selfClaimParticipant: async (
    bookingId: string,
    participantId: string,
  ): Promise<{
    ticketId: string;
    tripId: string;
    alreadyClaimed: boolean;
    participantStatus: string;
    bookingVersion: number;
  }> => {
    return apiRequest(
      `/api/v1/bookings/${bookingId}/participants/${participantId}/self-claim`,
      {
        method: "POST",
        body: JSON.stringify({ confirmParticipantIdentity: true }),
      },
    );
  },

  /**
   * POST /api/v1/bookings/{id}/participants/{pid}/invitations
   * Gửi vé cho bạn bè qua email
   */
  inviteParticipant: async (
    bookingId: string,
    participantId: string,
    recipientEmail: string,
    currentUserEmail?: string,
    idempotencyKey?: string,
  ): Promise<{
    id: string;
    participantId: string;
    status: string;
    recipientDisplay: string;
  }> => {
    const email = recipientEmail.trim();
    if (
      currentUserEmail &&
      email.toLowerCase() === currentUserEmail.trim().toLowerCase()
    ) {
      throw new Error(
        "Đây là email tài khoản của bạn. Vui lòng bấm 'Tự nhận vé' thay vì gửi lời mời cho chính mình.",
      );
    }
    const key = idempotencyKey || generateIdempotencyKey();
    return apiRequest(
      `/api/v1/bookings/${bookingId}/participants/${participantId}/invitations`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ recipientEmail: email }),
      },
    );
  },

  /**
   * POST /api/v1/booking-participant-invitations/{id}/revoke
   * Người mua thu hồi lời mời đang chờ
   */
  revokeInvitation: async (invitationId: string): Promise<any> => {
    return apiRequest(
      `/api/v1/booking-participant-invitations/${invitationId}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  },
};