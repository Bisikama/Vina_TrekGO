import { z } from 'zod'
export const inviteCodeSchema = z.string().regex(/^[A-Z0-9]{6}$/)
export const joinPrivateSchema = z.object({}).strict().optional()
export const memberVersionSchema = z.object({ expectedMemberVersion: z.number().int().min(1) }).strict()
export const removeMemberQuerySchema = z.object({ expectedMemberVersion: z.coerce.number().int().min(1) }).strict()
export const memberPageSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['ACTIVE', 'LEFT', 'REMOVED', 'COMPLETED', 'NO_SHOW', 'ALL']).default('ACTIVE'),
  })
  .strict()
