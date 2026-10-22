import { InvoiceType } from '@prisma/client'

const COMMON_REASONS = [
  'LATE_PAYMENT',
  'DUPLICATE_PAYMENT',
  'DOMAIN_NOT_ELIGIBLE',
] as const

const RENTAL_REASONS = [
  'PAYMENT_TIMESTAMP_UNTRUSTED',
  'PRIMARY_RENTAL_LOCATION_NOT_VERIFIED',
  'HOLD_EXPIRED_BEFORE_PROCESSING',
  'POST_DUE_PAYMENT',
  'EXTENSION_NOT_APPLICABLE',
  'EXTENSION_ACCEPTANCE_MISSING',
  'HANDOVER_DOCUMENT_REQUIRED_FOR_APPENDIX',
  'EXTENSION_DOCUMENT_LIMIT',
] as const

export type TechnicalReversalReason = (typeof COMMON_REASONS)[number] | (typeof RENTAL_REASONS)[number]

const commonReasons: ReadonlySet<string> = new Set(COMMON_REASONS)
const rentalReasons: ReadonlySet<string> = new Set(RENTAL_REASONS)

/** Chỉ Rental nhận thêm lý do riêng; Booking và Trail giữ nguyên hợp đồng hoàn kỹ thuật. */
export function isTechnicalReversalReason(invoiceType: InvoiceType, reason: unknown): reason is TechnicalReversalReason {
  if (typeof reason !== 'string') return false
  if (!['BOOKING', 'TRAIL_ACCESS', 'RENTAL'].includes(invoiceType)) return false
  return commonReasons.has(reason) || (invoiceType === 'RENTAL' && rentalReasons.has(reason))
}
