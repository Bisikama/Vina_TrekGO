import axios from 'axios';
import { apiClient } from '@/lib/axios';

export type Participant = {
  id?: string;
  fullName: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  checkinStatus?: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'NO_SHOW';
  checkinMethod?: 'QR' | 'MANUAL' | null;
  checkedInAt?: string | null;
  checkinCode?: string | null;
  linkageStatus?: 'CLAIMED' | 'INVITATION_PENDING' | 'UNLINKED';
  pendingInvitationId?: string | null;
  recipientDisplay?: string | null;
  actions?: {
    canSelfClaim?: boolean;
    canInvite?: boolean;
    canRevoke?: boolean;
  };
};
export type PublicTrip = {
  id: string; title: string; description: string | null; status: string; startAt: string; endAt: string;
  destination: { id: string; name: string }; leader: { id: string; fullName: string } | null;
  pricePerPax: string | null; currency: string; capacity: number; remainingSlots: number;
  pickup: { id: string; name: string; address: string } | null;
  routes: { id: string; snapshotName: string; snapshotDifficulty: string | null; snapshotDistanceKm: string | null }[];
  checkpoints: { id: string; name: string; isRequired: boolean }[];
  transportAvailable: boolean; transport: { vehicleType: string }[];
};
export type Checkout = { type: 'QR' | 'REDIRECT'; url: string | null; qrData: string | null };
export type PaymentGateway = 'momo' | 'vnpay';
export type PaymentOption = { gateway: PaymentGateway; environment: string };
export type Booking = {
  id: string; status: string; version: number; participantCount: number; expiresAt: string; confirmedAt: string | null;
  pricePerPax: string; totalAmount: string; currency: string; canEditParticipants: boolean; canCancel: boolean; rentalEligible: boolean;
  trip: { id: string; title: string; startAt: string; endAt: string; status: string };
  pickup: { id: string; name: string; address: string }; participants: Participant[];
  transport: { vehicleType: string; plateNumber?: string | null; driverName?: string | null; driverPhone?: string | null; meetingAt?: string }[];
  paymentSummary: { paymentId: string; status: string; applicationStatus: string | null; applicationReasonCode: string | null; reconciliationRequired: boolean; checkout: Checkout | null; providerEnvironment: string | null; gateway: string | null } | null;
  refunds: { refundId: string; status: string; amount: string }[];
};
export type BookingSummary = Pick<Booking, 'id' | 'status' | 'participantCount' | 'totalAmount' | 'currency' | 'expiresAt' | 'trip'>;
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
const config = { baseURL: '' }; // Same-origin Next rewrite; shared token/refresh interceptors remain in use.
const headers = (key: string) => ({ ...config, headers: { 'Idempotency-Key': key } });
const input = (participants: Participant[]) => ({ participantCount: participants.length, participants: participants.map((p) => ({
  ...(p.id ? { id: p.id } : {}), fullName: p.fullName.trim(), ...(p.phone?.trim() ? { phone: p.phone.trim() } : {}),
  ...(p.dateOfBirth && p.dateOfBirth.trim() ? { dateOfBirth: p.dateOfBirth.trim().slice(0, 10) } : {}),
  ...(p.emergencyContactName?.trim() ? { emergencyContactName: p.emergencyContactName.trim() } : {}),
  ...(p.emergencyContactPhone?.trim() ? { emergencyContactPhone: p.emergencyContactPhone.trim() } : {}),
})) });
export const bookingApi = {
  trips: async (params: Record<string, string | number> = {}) => (await apiClient.get<Page<PublicTrip>>('/api/v1/trips', { ...config, params })).data,
  trip: async (id: string) => (await apiClient.get<PublicTrip>(`/api/v1/trips/${id}`, config)).data,
  create: async (tripId: string, participants: Participant[], key: string) => (await apiClient.post<Booking>(`/api/v1/trips/${tripId}/bookings`, input(participants), headers(key))).data,
  detail: async (id: string) => (await apiClient.get<Booking>(`/api/v1/bookings/${id}`, config)).data,
  list: async (page: number, status: string) => (await apiClient.get<Page<BookingSummary>>('/api/v1/bookings', { ...config, params: { page, ...(status ? { status } : {}) } })).data,
  update: async (booking: Booking, participants: Participant[]) => (await apiClient.patch<Booking>(`/api/v1/bookings/${booking.id}/participants`, { ...input(participants), expectedVersion: booking.version }, config)).data,
  paymentOptions: async () => (await apiClient.get<{ gateways: PaymentOption[] }>('/api/v1/payments/options', config)).data,
  pay: async (id: string, key: string, gateway: PaymentGateway) => (await apiClient.post<{ checkout: Checkout | null; status: string; providerEnvironment: string; gateway: string }>(`/api/v1/bookings/${id}/payments`, { paymentMethod: 'REDIRECT', gateway }, headers(key))).data,
  cancel: async (id: string, reason: string, key: string) => (await apiClient.post(`/api/v1/bookings/${id}/cancel`, { reason }, headers(key))).data,
  selfClaim: async (bookingId: string, participantId: string) => (await apiClient.post(`/api/v1/bookings/${bookingId}/participants/${participantId}/self-claim`, { confirmParticipantIdentity: true }, config)).data,
  invite: async (bookingId: string, participantId: string, recipientEmail: string, key = (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))) => (await apiClient.post(`/api/v1/bookings/${bookingId}/participants/${participantId}/invitations`, { recipientEmail }, headers(key))).data,
  revokeInvitation: async (invitationId: string) => (await apiClient.post(`/api/v1/booking-participant-invitations/${invitationId}/revoke`, {}, config)).data,
};
export function bookingError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data?.error;
    const messages: Record<string, string> = {
      UNAUTHENTICATED: 'Vui lòng đăng nhập để tiếp tục.', FORBIDDEN: 'Bạn không có quyền thao tác đặt chỗ này.',
      ACTIVE_BOOKING_EXISTS: 'Bạn đã có đặt chỗ cho chuyến này. Hãy mở đặt chỗ để cập nhật thành viên.',
      CAPACITY_CONFLICT: 'Chuyến đi không còn đủ chỗ. Vui lòng giảm số người hoặc chọn chuyến khác.',
      BOOKING_HOLD_EXPIRED: 'Thời gian giữ chỗ đã hết. Vui lòng tạo đặt chỗ mới.',
      BOOKING_VERSION_CONFLICT: 'Đặt chỗ đã thay đổi. Vui lòng tải lại trước khi sửa.',
      PAYMENT_ATTEMPT_IN_PROGRESS: 'Giao dịch đang được xử lý. Vui lòng chờ kết quả trước khi sửa thành viên.',
      PAYMENT_PROVIDER_UNAVAILABLE: 'Cổng thanh toán đang tạm thời không khả dụng. Vui lòng thử lại sau.',
      BOOKING_POLICY_UNAVAILABLE: 'Chuyến đi chưa sẵn sàng nhận đặt chỗ. Vui lòng thử lại sau.',
      BOOKING_CANCELLATION_POLICY_INVALID: 'Chính sách hoàn tiền chưa được cấu hình. Vui lòng liên hệ hỗ trợ.',
      INVALID_STATE_TRANSITION: 'Trạng thái hiện tại không cho phép thao tác này.',
      VALIDATION_ERROR: 'Vui lòng kiểm tra thông tin thành viên và dữ liệu đã nhập.',
      INVITATION_RECIPIENT_UNAVAILABLE: 'Email bạn đồng hành chưa đăng ký tài khoản TrekGo hoặc không khả dụng.',
      PENDING_INVITATION_EXISTS: 'Đang có một lời mời chờ xác nhận cho thành viên này.',
      PARTICIPANT_ALREADY_LINKED: 'Thành viên này đã được liên kết với một tài khoản.',
      PARTICIPANT_CLAIM_NOT_ALLOWED: 'Vé này chưa sẵn sàng để liên kết hoặc đã điểm danh.',
    };
    if (body?.details?.reason === 'USE_SELF_CLAIM') {
      return { message: 'Đây là tài khoản của chính bạn. Vui lòng bấm nút "Tự nhận vé" thay vì gửi thư mời cho chính mình.', bookingId: undefined };
    }
    return { message: messages[body?.code] ?? body?.message ?? 'Không kết nối được máy chủ. Bạn có thể thử lại.', bookingId: body?.details?.bookingId as string | undefined };
  }
  return { message: 'Không thể thực hiện thao tác. Vui lòng thử lại.', bookingId: undefined };
}
export const money = (value: string | number) => `${Number(value).toLocaleString('vi-VN')} ₫`;
export const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short' });
export const statusLabels: Record<string, string> = { PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', EXPIRED: 'Hết hạn', CANCELLED: 'Đã hủy', CHECKED_IN: 'Đã check-in', PARTIAL_CHECKIN: 'Check-in một phần', COMPLETED: 'Hoàn thành', NO_SHOW: 'Vắng mặt' };
