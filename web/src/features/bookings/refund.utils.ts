import type { BookingDetail, BookingRefund, CancelBookingResponse } from './types/booking.types';

export const REFUND_POLL_INTERVAL = 2000;
export const REFUND_POLL_LIMIT = 30;
export const BOOKING_POLL_TIMEOUT = 60_000;
export type RefundBooking = Pick<BookingDetail, 'id' | 'status' | 'paymentSummary' | 'refunds'>;

export function isSimulatedRefund(refund: { executionMode?: string | null; settlementMode?: string | null; confirmationSource?: string | null }): boolean {
  return refund.executionMode === 'SANDBOX_SIMULATED' || refund.settlementMode === 'SANDBOX_SIMULATED' || refund.confirmationSource === 'SANDBOX_SIMULATION';
}

export function refundStatusLabel(status: string): string {
  if (status === 'SUCCEEDED') return 'Đã ghi nhận hoàn';
  return ({ PENDING: 'Đang chờ xử lý', PROCESSING: 'Đang xử lý', FAILED: 'Hoàn không thành công', CANCELLED: 'Khoản hoàn đã hủy' } as Record<string, string>)[status] ?? 'Đang xác minh khoản hoàn';
}

export const refundPurposeLabel = (purpose: string) => ({ BOOKING_CANCELLATION: 'Hoàn do hủy đặt chỗ', TECHNICAL_REVERSAL: 'Hoàn giao dịch kỹ thuật' } as Record<string, string>)[purpose] ?? purpose;
export const isFinalRefund = (refund: Pick<BookingRefund, 'status'>) => ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(refund.status);
export const isRefundNotRequired = (result?: CancelBookingResponse | null) => result?.refundProcessingStatus === 'NOT_REQUIRED' && !result.refund && Number(result.refundableAmount) === 0;

export function isCancellationResultConsistent(result: CancelBookingResponse): boolean {
  if (result.refundProcessingStatus === 'NOT_REQUIRED') return isRefundNotRequired(result);
  if (result.refundProcessingStatus === 'COMPLETED') return result.refund?.status === 'SUCCEEDED';
  return result.refundProcessingStatus === 'PENDING' && (!result.refund || ['PENDING', 'PROCESSING', 'FAILED', 'CANCELLED'].includes(result.refund.status));
}

export function mergeBookingRefunds(refunds: BookingRefund[], cancellation?: CancelBookingResponse | null): BookingRefund[] {
  const byId = new Map<string, BookingRefund>();
  if (cancellation?.refund) byId.set(cancellation.refund.refundId, cancellation.refund);
  for (const refund of refunds) byId.set(refund.refundId, { ...byId.get(refund.refundId), ...refund });
  return [...byId.values()];
}

export function needsRefundTracking(booking: RefundBooking | null, cancellation?: CancelBookingResponse | null): boolean {
  const refunds = mergeBookingRefunds(booking?.refunds ?? [], cancellation);
  if (refunds.some((refund) => !isFinalRefund(refund))) return true;
  if (cancellation) {
    if (isRefundNotRequired(cancellation)) return false;
    const authoritative = booking?.refunds.find((refund) => cancellation.refund ? refund.refundId === cancellation.refund.refundId : refund.purpose === 'BOOKING_CANCELLATION');
    if (!authoritative && !isCancellationResultConsistent(cancellation)) return true;
    const related = cancellation.refund ? refunds.find((refund) => refund.refundId === cancellation.refund?.refundId) : refunds.find((refund) => refund.purpose === 'BOOKING_CANCELLATION');
    return !related || !isFinalRefund(related);
  }
  if (booking?.paymentSummary?.status === 'SUCCEEDED' && booking.paymentSummary.applicationStatus === 'REJECTED') {
    return !refunds.some((refund) => refund.purpose === 'TECHNICAL_REVERSAL' && refund.paymentId === booking.paymentSummary?.paymentId);
  }
  return booking?.status === 'CANCELLED' && !refunds.some((refund) => refund.purpose === 'BOOKING_CANCELLATION');
}

export function bookingPaymentState(booking: Pick<BookingDetail, 'status' | 'paymentSummary'> | null) {
  if (!booking) return 'VERIFYING';
  if (booking.status === 'CANCELLED') return 'CANCELLED';
  const payment = booking.paymentSummary;
  if (payment?.status === 'SUCCEEDED' && payment.applicationStatus === 'REJECTED') return 'REJECTED';
  if (payment?.status === 'SUCCEEDED' && payment.applicationStatus === 'APPLIED' && ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) return 'CONFIRMED';
  if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(payment?.status ?? '')) return 'FAILED';
  return 'VERIFYING';
}
