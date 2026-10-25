import { z } from 'zod'

const RentalReviewCommentSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => Array.from(value).length <= 2000, 'Comment must contain at most 2000 Unicode characters')
  .transform((value) => (value.length === 0 ? null : value))

export const CreateRentalReviewBodySchema = z
  .object({
    productId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: RentalReviewCommentSchema.nullable().optional().transform((value) => value ?? null),
  })
  .strict()
export type CreateRentalReviewBodyDto = z.infer<typeof CreateRentalReviewBodySchema>

export const RentalReviewOrderParamSchema = z.object({ orderId: z.string().uuid() }).strict()
export type RentalReviewOrderParamDto = z.infer<typeof RentalReviewOrderParamSchema>

export const RentalReviewProductParamSchema = z.object({ productId: z.string().uuid() }).strict()
export type RentalReviewProductParamDto = z.infer<typeof RentalReviewProductParamSchema>

export const ListProductReviewsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(10),
    rating: z.coerce.number().int().min(1).max(5).optional(),
  })
  .strict()
export type ListProductReviewsQueryDto = z.infer<typeof ListProductReviewsQuerySchema>
