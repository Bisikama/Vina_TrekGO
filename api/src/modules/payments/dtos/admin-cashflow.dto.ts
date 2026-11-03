import { z } from 'zod'
import type { FinancialEffect, TransactionKind, TransactionSource } from './user-transactions.dto'

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}(:?\d{2})?)?)?$/

export type AdminGatewayFilter = 'BOTH' | 'vnpay' | 'payos'
export type SupportedAdminGateway = 'vnpay' | 'payos'
export type AdminTransactionDirection = 'CASH_IN' | 'CASH_OUT'

export type AdminTransactionCategory =
  | 'BOOKING_PAYMENT'
  | 'RENTAL_INITIAL'
  | 'RENTAL_EXTENSION'
  | 'TRAIL_PURCHASE'
  | 'DEPOSIT_REFUND'
  | 'BOOKING_CANCEL_REFUND'
  | 'RENTAL_CANCEL_REFUND'
  | 'TRAIL_REFUND'
  | 'TECHNICAL_REVERSAL'

export const AdminTransactionCategoryEnum = [
  'BOOKING_PAYMENT',
  'RENTAL_INITIAL',
  'RENTAL_EXTENSION',
  'TRAIL_PURCHASE',
  'DEPOSIT_REFUND',
  'BOOKING_CANCEL_REFUND',
  'RENTAL_CANCEL_REFUND',
  'TRAIL_REFUND',
  'TECHNICAL_REVERSAL',
] as const

export const AdminGatewayFilterSchema = z
  .enum(['ALL', 'BOTH', 'all', 'both', 'vnpay', 'VNPAY', 'payos', 'PAYOS', 'PayOS'])
  .optional()
  .default('BOTH')
  .transform((val): AdminGatewayFilter => {
    const normalized = val.toLowerCase()
    if (normalized === 'vnpay') return 'vnpay'
    if (normalized === 'payos') return 'payos'
    return 'BOTH'
  })

export function resolveAllowedGateways(filter: AdminGatewayFilter = 'BOTH'): SupportedAdminGateway[] {
  if (filter === 'vnpay') return ['vnpay']
  if (filter === 'payos') return ['payos']
  return ['vnpay', 'payos']
}

export const AdminTransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    gateway: AdminGatewayFilterSchema,
    source: z.enum(['RENTAL', 'BOOKING', 'TRAIL_ACCESS']).optional(),
    kind: z.enum(['PAYMENT', 'REFUND']).optional(),
    direction: z.enum(['CASH_IN', 'CASH_OUT']).optional(),
    category: z.enum(AdminTransactionCategoryEnum).optional(),
    status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']).optional(),
    reconcileStatus: z.enum(['IDLE', 'SCHEDULED', 'RUNNING', 'NEEDS_REVIEW', 'RESOLVED']).optional(),
    executionMode: z.enum(['PROVIDER_API', 'MANUAL_BANK_TRANSFER']).optional(),
    manualStatus: z
      .enum(['AWAITING_RECIPIENT', 'READY', 'PROCESSING', 'NEEDS_REVIEW', 'COMPLETED'])
      .optional(),
    userId: z.string().uuid().optional(),
    search: z.string().trim().min(1).max(120).optional(),
    from: z
      .string()
      .trim()
      .regex(ISO_8601_REGEX, { message: 'from must be a valid ISO-8601 date string' })
      .refine((val) => !isNaN(Date.parse(val)), { message: 'from must be a valid date' })
      .optional(),
    to: z
      .string()
      .trim()
      .regex(ISO_8601_REGEX, { message: 'to must be a valid ISO-8601 date string' })
      .refine((val) => !isNaN(Date.parse(val)), { message: 'to must be a valid date' })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from).getTime() <= new Date(data.to).getTime()
      }
      return true
    },
    {
      message: "'from' must be earlier than or equal to 'to'",
      path: ['from'],
    },
  )
  .refine(
    (data) => {
      const effectiveKind =
        data.kind ??
        (data.direction === 'CASH_IN'
          ? 'PAYMENT'
          : data.direction === 'CASH_OUT'
            ? 'REFUND'
            : undefined)
      if (data.kind && data.direction) {
        if (
          (data.kind === 'PAYMENT' && data.direction !== 'CASH_IN') ||
          (data.kind === 'REFUND' && data.direction !== 'CASH_OUT')
        ) {
          return false
        }
      }
      if (effectiveKind === 'REFUND' && data.status === 'EXPIRED') {
        return false
      }
      return true
    },
    {
      message: "status 'EXPIRED' is not applicable when kind is 'REFUND' or direction conflicts with kind",
      path: ['status'],
    },
  )

export type AdminTransactionsQueryDto = z.infer<typeof AdminTransactionsQuerySchema>

export const AdminCashflowSummaryQuerySchema = z
  .object({
    gateway: AdminGatewayFilterSchema,
    source: z.enum(['RENTAL', 'BOOKING', 'TRAIL_ACCESS']).optional(),
    from: z
      .string()
      .trim()
      .regex(ISO_8601_REGEX, { message: 'from must be a valid ISO-8601 date string' })
      .refine((val) => !isNaN(Date.parse(val)), { message: 'from must be a valid date' })
      .optional(),
    to: z
      .string()
      .trim()
      .regex(ISO_8601_REGEX, { message: 'to must be a valid ISO-8601 date string' })
      .refine((val) => !isNaN(Date.parse(val)), { message: 'to must be a valid date' })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from).getTime() <= new Date(data.to).getTime()
      }
      return true
    },
    {
      message: "'from' must be earlier than or equal to 'to'",
      path: ['from'],
    },
  )

export type AdminCashflowSummaryQueryDto = z.infer<typeof AdminCashflowSummaryQuerySchema>

export interface AdminTransactionBreakdownDto {
  /** Tiền dịch vụ: Vé Booking / Phí thuê thiết bị (RENTAL_FEE) / Phí gia hạn / Phí mở khóa Trail */
  serviceFeeAmount: string
  /** Tiền thuê thiết bị (RENTAL_FEE + gia hạn) nếu source = RENTAL, ngược lại 0.00 */
  rentalFeeAmount: string
  /** Tiền cọc thiết bị (RENTAL_DEPOSIT) thu vô hoặc phần tiền cọc gốc liên quan đến khoản hoàn */
  depositAmount: string
  /** Tiền khấu trừ cọc giữ lại (hư hỏng/mất đồ/trả trễ) hoặc phí phạt hủy giữ lại */
  deductionAmount: string
  /** Đánh dấu giao dịch gia hạn thuê thiết bị */
  isExtension: boolean
}

export interface AdminTransactionItemDto {
  id: string
  kind: TransactionKind
  direction: AdminTransactionDirection
  category: AdminTransactionCategory
  source: TransactionSource
  sourceId: string | null
  paymentId: string
  refundId: string | null
  invoiceId: string
  invoiceNo: string | null
  user: {
    id: string
    fullName: string | null
    email: string
  }
  amount: string
  currency: string
  breakdown: AdminTransactionBreakdownDto
  status: string
  financialEffect: FinancialEffect
  paymentGateway: string | null
  providerEnvironment: string | null
  paymentMethod: string | null
  transactionRef: string | null
  payosOrderCode: string | null
  reconcileStatus: string
  reconciliationRequired: boolean
  executionMode: string | null
  confirmationSource: string | null
  refundPurpose: string | null
  manualRefundStatus: string | null
  canSimulateSandbox: boolean
  description: string
  createdAt: string
  completedAt: string | null
}

export interface AdminTransactionsResponseDto {
  appliedFilters?: {
    gateway: AdminGatewayFilter
    gatewaysIncluded: SupportedAdminGateway[]
    source: TransactionSource | null
    kind: TransactionKind | null
    category: AdminTransactionCategory | null
    status: string | null
  }
  items: AdminTransactionItemDto[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface AdminCashflowBreakdownBySourceDto {
  source: TransactionSource
  inflowAmount: string
  inflowCount: number
  outflowAmount: string
  outflowCount: number
  netAmount: string
  serviceFeeAmount?: string
  depositCollectedAmount?: string
  depositRefundedAmount?: string
  retainedDeductionAmount?: string
}

export interface AdminCashflowBreakdownByGatewayDto {
  gateway: string
  environment?: 'SANDBOX' | 'PRODUCTION'
  inflowAmount: string
  inflowCount: number
  outflowAmount: string
  outflowCount: number
  netAmount: string
}

export interface AdminCashflowSummaryResponseDto {
  appliedFilters?: {
    gateway: AdminGatewayFilter
    gatewaysIncluded: SupportedAdminGateway[]
    source: TransactionSource | null
  }
  currency: string
  period: {
    from: string | null
    to: string | null
  }
  totals: {
    totalInflowAmount: string
    totalInflowCount: number
    totalOutflowAmount: string
    totalOutflowCount: number
    netCashflowAmount: string
    pendingInflowAmount: string
    pendingInflowCount: number
    pendingOutflowAmount: string
    pendingOutflowCount: number
    reconciliationRequiredCount: number
    serviceRevenueAmount?: string
    bookingInflowAmount?: string
    rentalFeeInflowAmount?: string
    rentalExtensionInflowAmount?: string
    rentalDepositInflowAmount?: string
    trailAccessInflowAmount?: string
    depositOutflowAmount?: string
    bookingCancellationOutflowAmount?: string
    rentalCancellationOutflowAmount?: string
    technicalReversalOutflowAmount?: string
    retainedDepositDeductionAmount?: string
    activeDepositHeldAmount?: string
    payosManualRefundPendingCount?: number
    vnpaySandboxPendingRefundCount?: number
  }
  bySource: AdminCashflowBreakdownBySourceDto[]
  byGateway: AdminCashflowBreakdownByGatewayDto[]
}

export interface AdminPaymentDetailResponseDto {
  paymentId: string
  invoiceId: string
  invoiceNo: string
  invoiceStatus: string
  source: TransactionSource
  sourceId: string | null
  owner: {
    id: string
    fullName: string | null
    email: string
  }
  amount: string
  currency: string
  breakdown: AdminTransactionBreakdownDto
  status: string
  paymentGateway: string
  providerEnvironment: string | null
  paymentMethod: string | null
  transactionRef: string | null
  merchantRequestRef: string | null
  payosOrderCode: string | null
  payosPaymentLinkId: string | null
  applicationStatus: string | null
  applicationReasonCode: string | null
  reconcileStatus: string
  reconciliationRequired: boolean
  retryCount: number
  lastCheckedAt: string | null
  lastErrorCode: string | null
  createdAt: string
  paidAt: string | null
  allocations: Array<{
    id: string
    rentalOrderLineId: string
    component: string
    amount: string
  }>
  refunds: Array<{
    refundId: string
    amount: string
    currency: string
    status: string
    purpose: string
    reconcileStatus: string
    reconciliationRequired: boolean
    executionMode: string
    confirmationSource: string | null
    manualRefundStatus: string | null
    canSimulateSandbox: boolean
    refundTransactionRef: string | null
    createdAt: string
    refundedAt: string | null
  }>
}

export interface AdminRefundDetailResponseDto {
  refundId: string
  paymentId: string
  invoiceId: string
  invoiceNo: string
  source: TransactionSource
  sourceId: string | null
  owner: {
    id: string
    fullName: string | null
    email: string
  }
  amount: string
  currency: string
  breakdown: AdminTransactionBreakdownDto
  status: string
  purpose: string
  reason: string | null
  reasonCode: string | null
  paymentGateway: string
  providerEnvironment: string | null
  executionMode: string
  confirmationSource: string | null
  reconcileStatus: string
  reconciliationRequired: boolean
  refundTransactionRef: string | null
  merchantRefundRef: string | null
  canSimulateSandbox: boolean
  createdAt: string
  refundedAt: string | null
  sourcePayment: {
    paymentId: string
    amount: string
    status: string
    paymentGateway: string
    paymentMethod: string | null
    transactionRef: string | null
    payosOrderCode: string | null
    paidAt: string | null
  }
  allocations: Array<{
    id: string
    paymentAllocationId: string
    component: string
    amount: string
  }>
  manualRefund: {
    manualStatus: string
    version: number
    assignedAdminId: string | null
    claimedAt: string | null
    recipient: {
      bankBin: string | null
      accountNumber: string | null
      accountHolderName: string | null
      ownershipConfirmedAt: string | null
      vietQrImageUrl: string | null
    } | null
    bankTransactionRef: string | null
    transferredAt: string | null
    confirmedBy: string | null
    evidenceMediaId: string | null
    evidenceMediaUrl: string | null
    note: string | null
  } | null
}
