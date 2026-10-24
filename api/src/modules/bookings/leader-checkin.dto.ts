import { z } from 'zod'

export const leaderParticipantsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    checkinStatus: z.enum(['NOT_CHECKED_IN', 'CHECKED_IN', 'NO_SHOW']).optional(),
    search: z.string().trim().min(1).max(150).optional(),
  })
  .strict()

export const qrCheckinBodySchema = z
  .object({
    checkinCode: z.string().trim().min(1).max(160),
    method: z.literal('QR').default('QR'),
  })
  .strict()

export const manualCheckinByTripBodySchema = z
  .object({
    participantId: z.string().uuid(),
    method: z.literal('MANUAL').default('MANUAL'),
    checkinStatus: z.enum(['CHECKED_IN', 'NO_SHOW', 'NOT_CHECKED_IN']).default('CHECKED_IN'),
  })
  .strict()

export const leaderCheckinBodySchema = z.union([qrCheckinBodySchema, manualCheckinByTripBodySchema])

export const manualParticipantCheckinBodySchema = z
  .object({
    checkinStatus: z.enum(['CHECKED_IN', 'NO_SHOW', 'NOT_CHECKED_IN']).default('CHECKED_IN'),
  })
  .strict()

export type LeaderParticipantsQuery = z.infer<typeof leaderParticipantsQuerySchema>
export type LeaderCheckinInput = z.infer<typeof leaderCheckinBodySchema>
export type ManualParticipantCheckinInput = z.infer<typeof manualParticipantCheckinBodySchema>
