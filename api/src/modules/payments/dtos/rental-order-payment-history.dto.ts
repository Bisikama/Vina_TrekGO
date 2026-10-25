import { z } from 'zod'
import type { PaymentApplicationStatus, PaymentStatus, RefundPurpose, RefundStatus } from '@prisma/client'

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}(:?\d{2})?)?)?$/

export const RentalOrderPaymentHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']).optional(),
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

export type RentalOrderPaymentHistoryQueryDto = z.infer<typeof RentalOrderPaymentHistoryQuerySchema>

export interface RentalOrderPaymentRefundItemDto {
  refundId: string
  amount: string
  status: RefundStatus
  purpose: RefundPurpose
  createdAt: string
  refundedAt: string | null
}

export interface RentalOrderPaymentHistoryItemDto {
  paymentId: string
  paymentRef: string
  invoiceId: string
  purpose: string
  amount: string
  currency: string
  status: PaymentStatus
  applicationStatus: PaymentApplicationStatus | null
  paymentMethod: string | null
  paymentGateway: string
  createdAt: string
  paidAt: string | null
  refunds: RentalOrderPaymentRefundItemDto[]
}

export interface RentalOrderPaymentHistoryResponseDto {
  orderId: string
  items: RentalOrderPaymentHistoryItemDto[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
