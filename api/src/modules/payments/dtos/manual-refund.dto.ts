import { z } from 'zod'

export const manualRefundKey = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\x21-\x7e]+$/)
const version = z.number().int().positive()
const bank = z.string().regex(/^\d{6}$/)
const account = z.string().regex(/^\d{1,40}$/)
const reason = z.string().trim().min(1).max(500)
export const recipientSchema = z
  .object({
    expectedVersion: version,
    bankBin: bank,
    accountNumber: account,
    accountHolderName: z.string().trim().min(1).max(200),
    ownershipConfirmed: z.literal(true),
  })
  .strict()
export const claimSchema = z.object({ expectedVersion: version, accountNameChecked: z.literal(true) }).strict()
export const releaseSchema = z
  .object({ expectedVersion: version, noTransferConfirmed: z.literal(true), reason })
  .strict()
export const reviewSchema = z.object({ expectedVersion: version, reason }).strict()
export const reassignSchema = z
  .object({ expectedVersion: version, assignedAdminId: z.string().uuid(), reason })
  .strict()
export const completeSchema = z
  .object({
    expectedVersion: version,
    transferredAmount: z.string().regex(/^[1-9]\d{0,9}$/),
    sourceBankBin: bank,
    sourceAccountNumber: account,
    bankTransactionRef: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .transform((v) => v.toUpperCase()),
    transferredAt: z.string().datetime({ offset: true }),
    evidenceMediaId: z.string().uuid().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
export const refundQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    source: z.enum(['BOOKING', 'RENTAL', 'TRAIL_ACCESS']).optional(),
    purpose: z
      .enum(['BOOKING_CANCELLATION', 'RENTAL_CANCELLATION', 'TECHNICAL_REVERSAL', 'DEPOSIT', 'TRAIL_ACCESS'])
      .optional(),
    manualStatus: z.enum(['AWAITING_RECIPIENT', 'READY', 'PROCESSING', 'NEEDS_REVIEW', 'COMPLETED']).optional(),
    assignedAdminId: z.string().uuid().optional(),
  })
  .strict()
export type RefundQuery = z.infer<typeof refundQuerySchema>
export type ManualAction = 'recipient' | 'claim' | 'release' | 'review' | 'reassign' | 'complete'
export type ManualActionBody =
  | z.infer<typeof recipientSchema>
  | z.infer<typeof claimSchema>
  | z.infer<typeof releaseSchema>
  | z.infer<typeof reviewSchema>
  | z.infer<typeof reassignSchema>
  | z.infer<typeof completeSchema>
