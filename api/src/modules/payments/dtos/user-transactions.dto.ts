import { z } from 'zod'

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}(:?\d{2})?)?)?$/

export const UserTransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    source: z.enum(['RENTAL', 'BOOKING', 'TRAIL_ACCESS']).optional(),
    kind: z.enum(['PAYMENT', 'REFUND']).optional(),
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
  .refine(
    (data) => {
      if (data.kind === 'REFUND' && data.status === 'EXPIRED') {
        return false
      }
      return true
    },
    {
      message: "status 'EXPIRED' is not applicable when kind is 'REFUND'",
      path: ['status'],
    },
  )

export type UserTransactionsQueryDto = z.infer<typeof UserTransactionsQuerySchema>

export type TransactionKind = 'PAYMENT' | 'REFUND'
export type TransactionSource = 'RENTAL' | 'BOOKING' | 'TRAIL_ACCESS'
export type FinancialEffect = 'DEBIT' | 'CREDIT' | 'NONE'

export interface UserTransactionItemDto {
  id: string
  kind: TransactionKind
  source: TransactionSource
  sourceId: string | null
  paymentId: string
  refundId: string | null
  invoiceId: string
  amount: string
  currency: string
  status: string
  financialEffect: FinancialEffect
  description: string
  paymentMethod: string | null
  createdAt: string
  completedAt: string | null
}

export interface UserTransactionsResponseDto {
  items: UserTransactionItemDto[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
