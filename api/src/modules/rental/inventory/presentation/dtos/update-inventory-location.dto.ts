import { z } from 'zod'

export const UpdateInventoryLocationSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
}).strict()

export type UpdateInventoryLocationDto = z.infer<typeof UpdateInventoryLocationSchema>
