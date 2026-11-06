import { ApiError } from '@/lib/api-client';
import { bookingApiService, generateIdempotencyKey } from './services/booking.api';
import type { CancelBookingResponse } from './types';

interface CancellationAttempt { key: string; reason: string; pending: boolean; result?: CancelBookingResponse }
const attempts = new Map<string, CancellationAttempt>();
export const getCancellationAttempt = (scope: string) => attempts.get(scope);

// Only cancellation attempts share this state. Existing payment sessions stay untouched.
export async function cancelBookingOnce(scope: string, bookingId: string, reason: string, token: string) {
  let attempt = attempts.get(scope);
  if (attempt?.result) return attempt.result;
  if (attempt?.pending) throw new Error('Yêu cầu hủy đang được gửi. Vui lòng chờ kết quả.');
  if (!attempt) {
    attempt = { key: generateIdempotencyKey(), reason: reason.trim(), pending: false };
    attempts.set(scope, attempt);
  }
  attempt.pending = true;
  try {
    const result = await bookingApiService.cancelBooking(bookingId, attempt.reason, attempt.key, token);
    attempt.result = result;
    return result;
  } catch (error) {
    // A known rejection permits a new attempt after a fresh preview.
    // A lost response keeps both key and body for the same operation.
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) attempts.delete(scope);
    throw error;
  } finally {
    attempt.pending = false;
    if (attempts.size > 100) {
      for (const [key, value] of attempts) {
        if (value.result && key !== scope) attempts.delete(key);
        if (attempts.size <= 100) break;
      }
    }
  }
}

export function cancellationError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'RELATED_RENTALS_REQUIRE_RESOLUTION') return 'Cần xử lý các đơn thuê liên quan trước khi hủy đặt chỗ.';
    if (error.status === 409) return 'Thông tin đặt chỗ đã thay đổi. Hãy kiểm tra lại điều kiện hủy.';
    if (error.code === 'BOOKING_CANCELLATION_NOT_ALLOWED') return 'Đặt chỗ này hiện không thể hủy. Hãy tải lại để kiểm tra.';
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.status === 403) return 'Bạn không có quyền xem hoặc hủy đặt chỗ này.';
    if (error.status === 404) return 'Không tìm thấy thông tin đặt chỗ.';
    if (error.status === 422) return 'Chưa xác định được mức hoàn. Vui lòng liên hệ hỗ trợ.';
    return 'Chưa nhận được kết quả. Hãy kiểm tra lại trước khi thử tiếp.';
  }
  return 'Chưa nhận được kết quả. Hãy kiểm tra lại trước khi thử tiếp.';
}
