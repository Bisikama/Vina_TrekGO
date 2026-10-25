type PaymentRequestSnapshot = Record<string, unknown>

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function paymentReturnPath(snapshot: unknown): string | undefined {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined

  const request = snapshot as PaymentRequestSnapshot
  const operation = nonEmptyString(request.operation)

  if (operation === 'booking-checkout') {
    const bookingId = nonEmptyString(request.bookingId)
    return bookingId ? `/payment-return?bookingId=${encodeURIComponent(bookingId)}` : undefined
  }

  if (operation === 'rental-checkout') {
    const rentalOrderId = nonEmptyString(request.rentalOrderId)
    return rentalOrderId ? `/payment-return?rentalOrderId=${encodeURIComponent(rentalOrderId)}` : undefined
  }

  if (operation === 'rental-extension-checkout') {
    const rentalOrderId = nonEmptyString(request.orderId)
    const extensionId = nonEmptyString(request.extensionId)
    if (!rentalOrderId || !extensionId) return undefined

    const query = new URLSearchParams({ rentalOrderId, extensionId })
    return `/payment-return?${query.toString()}`
  }

  return undefined
}
