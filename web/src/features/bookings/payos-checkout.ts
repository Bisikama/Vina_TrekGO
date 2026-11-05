const RETURN_CONTEXT_KEY = 'trekgo:payos-booking-return';
const CONTEXT_TTL_MS = 60 * 60 * 1000;

export function getPayosBookingPaymentState(booking: {
  status: string;
  paymentSummary: { status: string } | null;
} | null): 'CONFIRMED' | 'PAID' | 'FAILED' | 'PENDING' {
  if (booking && ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) return 'CONFIRMED';
  if (booking?.paymentSummary?.status === 'SUCCEEDED') return 'PAID';
  if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(booking?.paymentSummary?.status ?? '')) return 'FAILED';
  return 'PENDING';
}

export function rememberPayosBookingCheckout(bookingId: string, checkoutUrl: string) {
  try {
    const linkId = new URL(checkoutUrl).pathname.split('/').filter(Boolean).at(-1);
    sessionStorage.setItem(RETURN_CONTEXT_KEY, JSON.stringify({ bookingId, linkId, createdAt: Date.now() }));
  } catch {
    // The normal return URL also carries bookingId; storage is a fallback for cancel.
  }
}

export function getPayosReturnBookingId(params: Pick<URLSearchParams, 'get'>): string | null {
  const queryId = params.get('bookingId');
  if (queryId) return queryId;
  const linkId = params.get('id');
  if (!linkId) return null;
  try {
    const context = JSON.parse(sessionStorage.getItem(RETURN_CONTEXT_KEY) || 'null');
    if (context && typeof context.bookingId === 'string' && context.linkId === linkId &&
        typeof context.createdAt === 'number' && context.createdAt <= Date.now() &&
        Date.now() - context.createdAt < CONTEXT_TTL_MS) return context.bookingId;
  } catch { /* Storage may be unavailable. Never infer payment success from the URL. */ }
  return null;
}
