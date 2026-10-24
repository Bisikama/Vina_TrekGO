import { z } from 'zod'
export const publicInvitationCreateSchema = z
  .object({
    recipientEmail: z
      .string()
      .trim()
      .email()
      .max(255)
      .transform((s) => s.toLowerCase()),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
export const publicInvitationPageSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED', 'INVALIDATED']).optional(),
  })
  .strict()
export const publicInvitationDeclineSchema = z
  .object({ reason: z.enum(['IDENTITY_MISMATCH', 'NOT_INTERESTED', 'SCHEDULE_CONFLICT', 'OTHER']).optional() })
  .strict()
export const publicInvitationRevokeSchema = z.object({}).strict()
export const publicInvitationKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\x21-\x7e]+$/)
export type PublicInvitationCreate = z.infer<typeof publicInvitationCreateSchema>
export type PublicInvitationPage = z.infer<typeof publicInvitationPageSchema>
