import axios from 'axios';
import { apiClient } from '@/lib/axios';
import type {
  BookingDetail,
  BookingListQuery,
  BookingSummary,
  PageResponse,
  Participant,
  PaymentCheckoutResponse,
  PaymentGateway,
  PaymentMethod,
  PublicBookingTrip,
  PublicTripsQuery,
} from '../types/booking.types';

const config = { baseURL: '' }; // Same-origin Next rewrite để tránh bị CORS chặn header Idempotency-Key
const headers = (key: string) => ({
  ...config,
  headers: {
    'Idempotency-Key': key,
  },
});

const formatParticipantsPayload = (participants: Participant[]) => ({
  participantCount: participants.length,
  participants: participants.map((p) => ({
    ...(p.id ? { id: p.id } : {}),
    fullName: p.fullName.trim(),
    ...(p.phone?.trim() ? { phone: p.phone.trim() } : {}),
    ...(p.dateOfBirth && p.dateOfBirth.trim()
      ? { dateOfBirth: p.dateOfBirth.trim().slice(0, 10) }
      : {}),
    ...(p.emergencyContactName?.trim()
      ? { emergencyContactName: p.emergencyContactName.trim() }
      : {}),
    ...(p.emergencyContactPhone?.trim()
      ? { emergencyContactPhone: p.emergencyContactPhone.trim() }
      : {}),
  })),
});

export const bookingApiService = {
  /**
   * GET /api/v1/trips
   * Khám phá các chuyến đi công khai mở đặt chỗ
   */
  getPublicTrips: async (
    query: PublicTripsQuery = {},
    signal?: AbortSignal
  ): Promise<PageResponse<PublicBookingTrip>> => {
    // Sanitize params according to backend tripSearchSchema.strict()
    const params: Record<string, any> = {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 12,
    };
    if (query.destinationId && query.destinationId.trim()) {
      params.destinationId = query.destinationId.trim();
    }
    if (query.dateFrom && query.dateFrom.trim()) {
      params.dateFrom = query.dateFrom.trim();
    }
    if (query.dateTo && query.dateTo.trim()) {
      params.dateTo = query.dateTo.trim();
    }
    if (query.difficulty && query.difficulty.trim()) {
      params.difficulty = query.difficulty.trim();
    }
    if (query.priceMax !== undefined && query.priceMax !== null && !isNaN(Number(query.priceMax))) {
      params.price = Number(query.priceMax);
    }
    const response = await apiClient.get<PageResponse<PublicBookingTrip>>(
      '/api/v1/trips',
      {
        ...config,
        params,
        signal,
      }
    );
    return response.data;
  },

  /**
   * GET /api/v1/trips/{id}
   * Chi tiết chuyến đi công khai để đặt chỗ
   */
  getPublicTripDetail: async (
    tripId: string,
    signal?: AbortSignal
  ): Promise<PublicBookingTrip> => {
    const response = await apiClient.get<PublicBookingTrip>(
      `/api/v1/trips/${tripId}`,
      { ...config, signal }
    );
    return response.data;
  },

  /**
   * POST /api/v1/trips/{tripId}/bookings
   * Tạo yêu cầu đặt chỗ và giữ vé tạm thời
   */
  createBooking: async (
    tripId: string,
    participants: Participant[],
    idempotencyKey: string
  ): Promise<BookingDetail> => {
    const payload = formatParticipantsPayload(participants);
    const response = await apiClient.post<BookingDetail>(
      `/api/v1/trips/${tripId}/bookings`,
      payload,
      headers(idempotencyKey)
    );
    return response.data;
  },

  /**
   * GET /api/v1/bookings/{id}
   * Xem chi tiết đặt chỗ và trạng thái thanh toán
   */
  getBookingDetail: async (
    bookingId: string,
    signal?: AbortSignal
  ): Promise<BookingDetail> => {
    const response = await apiClient.get<BookingDetail>(
      `/api/v1/bookings/${bookingId}`,
      { ...config, signal }
    );
    return response.data;
  },

  /**
   * GET /api/v1/bookings
   * Danh sách đặt chỗ của người dùng hiện tại
   */
  listMyBookings: async (
    query: BookingListQuery = {},
    signal?: AbortSignal
  ): Promise<PageResponse<BookingSummary>> => {
    const response = await apiClient.get<PageResponse<BookingSummary>>(
      '/api/v1/bookings',
      {
        ...config,
        params: query,
        signal,
      }
    );
    return response.data;
  },

  /**
   * PATCH /api/v1/bookings/{id}/participants
   * Cập nhật danh sách thành viên trước khi khởi hành
   */
  updateParticipants: async (
    bookingId: string,
    participants: Participant[],
    expectedVersion?: number
  ): Promise<BookingDetail> => {
    const payload = {
      ...formatParticipantsPayload(participants),
      expectedVersion: expectedVersion ?? 1,
    };
    const response = await apiClient.patch<BookingDetail>(
      `/api/v1/bookings/${bookingId}/participants`,
      payload,
      config
    );
    return response.data;
  },

  /**
   * POST /api/v1/bookings/{id}/payments
   * Tạo yêu cầu thanh toán (QR / Redirect)
   */
  createPayment: async (
    bookingId: string,
    idempotencyKey: string,
    paymentMethod: PaymentMethod = 'REDIRECT',
    gateway?: PaymentGateway
  ): Promise<PaymentCheckoutResponse> => {
    const response = await apiClient.post<PaymentCheckoutResponse>(
      `/api/v1/bookings/${bookingId}/payments`,
      { paymentMethod, ...(gateway ? { gateway } : {}) },
      headers(idempotencyKey)
    );
    return response.data;
  },

  /**
   * POST /api/v1/bookings/{id}/cancel
   * Hủy đặt chỗ theo chính sách hoàn tiền
   */
  cancelBooking: async (
    bookingId: string,
    reason: string,
    idempotencyKey: string
  ): Promise<{ status: string }> => {
    const response = await apiClient.post<{ status: string }>(
      `/api/v1/bookings/${bookingId}/cancel`,
      { reason },
      headers(idempotencyKey)
    );
    return response.data;
  },
};

/**
 * Tuân thủ quy chuẩn lỗi CF01 & Booking: Đọc response.data.error thay vì giả định top-level message.
 */
export function getBookingErrorMessage(
  error: unknown,
  fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.'
): { message: string; code?: string; bookingId?: string } {
  if (axios.isAxiosError(error)) {
    const errObj = error.response?.data?.error;
    const code = errObj?.code;

    const messages: Record<string, string> = {
      UNAUTHENTICATED: 'Vui lòng đăng nhập để tiếp tục thao tác.',
      FORBIDDEN: 'Bạn không có quyền thực hiện thao tác trên đặt chỗ này.',
      ACTIVE_BOOKING_EXISTS:
        'Bạn đã có đặt chỗ đang hoạt động cho chuyến này. Vui lòng kiểm tra lại.',
      CAPACITY_CONFLICT:
        'Chuyến đi không còn đủ số chỗ trống. Vui lòng giảm số người hoặc chọn chuyến khác.',
      BOOKING_HOLD_EXPIRED:
        'Thời gian giữ chỗ tạm thời đã hết hạn. Vui lòng tạo đặt chỗ mới.',
      BOOKING_VERSION_CONFLICT:
        'Thông tin đặt chỗ đã được thay đổi từ phiên khác. Vui lòng tải lại trang.',
      PAYMENT_ATTEMPT_IN_PROGRESS:
        'Giao dịch thanh toán đang được xử lý. Vui lòng đợi kết quả.',
      BOOKING_POLICY_UNAVAILABLE:
        'Chính sách chuyến đi chưa sẵn sàng để đặt chỗ. Vui lòng thử lại sau.',
      BOOKING_CANCELLATION_POLICY_INVALID:
        'Chính sách hủy tour chưa được cấu hình. Vui lòng liên hệ hỗ trợ viên.',
      INVALID_STATE_TRANSITION:
        'Trạng thái hiện tại của chuyến đi không cho phép thao tác này.',
      VALIDATION_ERROR:
        'Dữ liệu nhập không hợp lệ. Vui lòng kiểm tra lại thông tin thành viên.',
      NOT_FOUND: 'Không tìm thấy thông tin chuyến đi hoặc đặt chỗ.',
    };

    const message = messages[code] ?? errObj?.message ?? fallback;
    const bookingId = errObj?.details?.bookingId as string | undefined;

    return { message, code, bookingId };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: fallback };
}

export const formatMoneyVND = (value: string | number): string =>
  `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

export const formatBookingDateTime = (value: string): string => {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  EXPIRED: 'Hết hạn giữ chỗ',
  CANCELLED: 'Đã hủy',
  CHECKED_IN: 'Đã check-in',
  PARTIAL_CHECKIN: 'Check-in một phần',
  COMPLETED: 'Hoàn thành',
  NO_SHOW: 'Vắng mặt',
};
