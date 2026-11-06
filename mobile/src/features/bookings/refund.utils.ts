import type { BookingDetail, CancelBookingResponse, RefundItem } from './types';

export const REFUND_INTERVAL = 2000;
export const REFUND_LIMIT = 30;
export const REFUND_TIMEOUT = 60_000;
export const refundMoney = (amount: string | number, currency = 'VND') => new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(Number(amount));
export const refundLabel = (status: string) => (({ SUCCEEDED: 'Đã ghi nhận hoàn', PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', FAILED: 'Hoàn chưa thành công', CANCELLED: 'Khoản hoàn đã hủy' } as Record<string, string>)[status] ?? 'Đang kiểm tra');
export const refundPurpose = (purpose?: string) => (({ BOOKING_CANCELLATION: 'Hoàn do hủy đặt chỗ', TECHNICAL_REVERSAL: 'Hoàn do không xác nhận được đặt chỗ' } as Record<string, string>)[purpose ?? ''] ?? 'Khoản hoàn liên quan');
export const isFinalRefund = (refund: RefundItem) => ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(refund.status);
export const noRefundRequired = (result?: CancelBookingResponse | null) => result?.refundProcessingStatus === 'NOT_REQUIRED' && !result.refund && Number(result.refundableAmount) === 0;
export const isTripPaused = (status?: string) => status === 'CANCEL_PENDING' || status === 'CANCELLED';

export function consistentCancellation(result: CancelBookingResponse) {
  if (result.refundProcessingStatus === 'NOT_REQUIRED') return noRefundRequired(result);
  if (result.refundProcessingStatus === 'COMPLETED') return result.refund?.status === 'SUCCEEDED';
  return result.refundProcessingStatus === 'PENDING' && (!result.refund || ['PENDING', 'PROCESSING', 'FAILED', 'CANCELLED'].includes(result.refund.status));
}

export function mergeRefunds(refunds: RefundItem[], cancellation?: CancelBookingResponse | null) {
  const unique = new Map<string, RefundItem>();
  if (cancellation?.refund) unique.set(cancellation.refund.refundId, cancellation.refund);
  refunds.forEach((refund) => unique.set(refund.refundId, { ...unique.get(refund.refundId), ...refund }));
  return [...unique.values()];
}

export function cancellationMessage(result: CancelBookingResponse) {
  if (noRefundRequired(result)) return 'Đã hủy đặt chỗ. Không phát sinh khoản hoàn.';
  if (result.refundProcessingStatus === 'COMPLETED' && result.refund?.status === 'SUCCEEDED') return `Đã hủy đặt chỗ. Đã ghi nhận hoàn ${refundMoney(result.refund.amount, result.refund.currency ?? result.currency)}.`;
  if (consistentCancellation(result) && result.refund?.status === 'FAILED') return 'Đã hủy đặt chỗ. Khoản hoàn chưa thành công, cần kiểm tra thêm.';
  if (consistentCancellation(result) && result.refundProcessingStatus === 'PENDING') return 'Đã hủy đặt chỗ. Khoản hoàn đang chờ xử lý.';
  return 'Đã hủy đặt chỗ. Đang kiểm tra thông tin khoản hoàn.';
}

export function needsRefundTracking(booking: BookingDetail | null, cancellation?: CancelBookingResponse | null) {
  const refunds = mergeRefunds(booking?.refunds ?? [], cancellation);
  if (refunds.some((refund) => !isFinalRefund(refund))) return true;
  if (cancellation) {
    if (noRefundRequired(cancellation)) return false;
    const authoritative = booking?.refunds.find((refund) => cancellation.refund ? refund.refundId === cancellation.refund.refundId : refund.purpose === 'BOOKING_CANCELLATION');
    if (!authoritative && !consistentCancellation(cancellation)) return true;
    const related = cancellation.refund ? refunds.find((refund) => refund.refundId === cancellation.refund?.refundId) : refunds.find((refund) => refund.purpose === 'BOOKING_CANCELLATION');
    return !related || !isFinalRefund(related);
  }
  if (booking?.paymentSummary?.status === 'SUCCEEDED' && booking.paymentSummary.applicationStatus === 'REJECTED') return !refunds.some((refund) => refund.purpose === 'TECHNICAL_REVERSAL' && refund.paymentId === booking.paymentSummary?.paymentId);
  return booking?.status === 'CANCELLED' && !refunds.some((refund) => refund.purpose === 'BOOKING_CANCELLATION');
}

export function bookingPaymentState(booking?: BookingDetail | null) {
  if (!booking) return 'VERIFYING';
  if (booking.status === 'CANCELLED') return 'CANCELLED';
  const payment = booking.paymentSummary;
  if (payment?.status === 'SUCCEEDED' && payment.applicationStatus === 'REJECTED') return 'REJECTED';
  if (payment?.status === 'SUCCEEDED' && payment.applicationStatus === 'APPLIED' && ['CONFIRMED', 'CHECKED_IN', 'PARTIAL_CHECKIN', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) return 'CONFIRMED';
  if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(payment?.status ?? '')) return 'FAILED';
  return 'VERIFYING';
}
