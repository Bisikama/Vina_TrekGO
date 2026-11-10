import { z } from 'zod'

export const publicTripImagesSchema = z.object({
  expectedVersion: z.number().int().positive(),
  mediaIds: z.array(z.string().uuid()).max(10)
    .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, 'Không được chọn ảnh trùng.'),
}).strict()
export const publicTripImageIdSchema = z.string().uuid()
export type PublicTripImagesInput = z.infer<typeof publicTripImagesSchema>

export const publicTripImageSchema = z.object({
  mediaId: z.string().uuid(),
  position: z.number().int().min(1).max(10),
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})
export type PublicTripImage = z.infer<typeof publicTripImageSchema>

export const publicTripImagesResponseSchema = z.object({
  tripId: z.string().uuid(),
  version: z.number().int().positive(),
  images: z.array(publicTripImageSchema),
  coverImage: publicTripImageSchema.nullable(),
  imageCount: z.number().int().min(0).max(10),
})
