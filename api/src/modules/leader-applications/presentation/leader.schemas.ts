import { z } from 'zod'
import env from '../../../shared/config'

const text = (max: number) => z.string().trim().max(max).nullable().optional()
const date = z.iso.date().nullable().optional()
export const submitSchema = z
  .object({
    motivation: text(5000),
    experienceSummary: text(10000),
    certificates: z
      .array(
        z
          .object({
            typeCode: z.string().trim().min(1).max(100),
            otherTypeName: text(94),
            certificateNumber: text(100),
            issuer: text(200),
            issuedAt: date,
            expiresAt: date,
            fileKey: z.uuid(),
          })
          .strict()
          .refine((c) => !c.issuedAt || !c.expiresAt || c.issuedAt <= c.expiresAt, {
            path: ['expiresAt'],
            message: 'expiresAt must be on or after issuedAt',
          }),
      )
      .max(env.LEADER_MAX_CERTIFICATES),
  })
  .strict()
export const pageSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict()
export const adminListSchema = pageSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN']).optional(),
  search: z.string().trim().max(200).optional(),
})
export const reviewSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: text(2000),
    certificateReviews: z
      .array(
        z
          .object({
            certificateId: z.uuid(),
            status: z.enum(['VERIFIED', 'REJECTED']),
            rejectionReason: text(2000),
          })
          .strict(),
      )
      .max(env.LEADER_MAX_CERTIFICATES)
      .default([]),
  })
  .strict()
export type SubmitInput = z.infer<typeof submitSchema>
export type ListInput = z.infer<typeof adminListSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
