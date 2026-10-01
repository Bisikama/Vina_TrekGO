import { z } from 'zod'

export const CreateInventoryLocationSchema = z.object({
  code: z.string().min(1, 'Mã điểm giao nhận không được để trống').max(50, 'Mã không quá 50 ký tự'),
  name: z.string().min(1, 'Tên điểm giao nhận không được để trống').max(100, 'Tên không quá 100 ký tự'),
  address: z.string().min(1, 'Địa chỉ không được để trống').max(255, 'Địa chỉ không quá 255 ký tự'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
})

export type CreateInventoryLocationDto = z.infer<typeof CreateInventoryLocationSchema>
