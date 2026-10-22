import { z } from 'zod'

export const privateMemberInvitationStatus = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'REVOKED',
  'EXPIRED',
  'INVALIDATED',
])
export const createPrivateMemberInvitationSchema = z
  .object({
    recipientEmail: z
      .string()
      .trim()
      .email()
      .max(255)
      .transform((value) => value.toLowerCase()),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
export const privateMemberInvitationPageSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    status: privateMemberInvitationStatus.optional(),
  })
  .strict()
export const privateMemberInvitationActionSchema = z.object({}).strict()
export const declinePrivateMemberInvitationSchema = z
  .object({
    reason: z.enum(['NOT_INTERESTED', 'SCHEDULE_CONFLICT', 'OTHER']).optional(),
  })
  .strict()
export const invitationIdempotencyKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\x21-\x7e]+$/)
export type CreatePrivateMemberInvitation = z.infer<typeof createPrivateMemberInvitationSchema>
