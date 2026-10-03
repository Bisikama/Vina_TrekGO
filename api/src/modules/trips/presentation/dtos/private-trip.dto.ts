import { z } from 'zod'
const uuid = z.string().uuid()
const time = z.string().datetime({ offset: true })
const capacity = z.number().int().min(1).max(2147483647)
export const privateVersionSchema = z.object({ expectedVersion: z.number().int().min(1) }).strict()
export const privateCreateSchema = z
  .object({
    type: z.enum(['PERSONAL', 'SYSTEM']),
    trailRef: uuid,
    destinationId: uuid,
    title: z.string().trim().min(1).max(220),
    description: z.string().max(5000).optional(),
    startAt: time,
    endAt: time,
    pickupPointId: uuid,
    capacity,
    checkpointIds: z.array(uuid).min(1).max(100),
  })
  .strict()
export const privateUpdateSchema = privateCreateSchema
  .pick({ title: true, description: true, startAt: true, endAt: true, pickupPointId: true, capacity: true })
  .partial()
  .extend(privateVersionSchema.shape)
  .strict()
export const privateInviteSchema = privateVersionSchema.extend({ expiresAt: time.optional() })
export const privateCancelSchema = privateVersionSchema.extend({ reason: z.string().trim().max(2000).optional() })
export const privatePageSchema = z
  .object({ page: z.coerce.number().int().min(1).max(100000).default(1), status: z.literal('ACTIVE').optional() })
  .strict()
export const privatePickupSchema = z
  .object({ page: z.coerce.number().int().min(1).max(100000).default(1), destinationId: uuid })
  .strict()
