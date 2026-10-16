import { z } from 'zod';

export const UpdateInventoryLocationSchema = z.object({
  name: z.string().min(3).max(160).optional().describe('Tên kho (ví dụ: Kho Trung Tâm HCM)'),
  address: z.string().min(5).optional().describe('Địa chỉ chi tiết của kho'),
  latitude: z.number().min(-90).max(90).optional().describe('Vĩ độ (GPS)'),
  longitude: z.number().min(-180).max(180).optional().describe('Kinh độ (GPS)'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional().describe('Trạng thái của kho'),
});

export type UpdateInventoryLocationDto = z.infer<typeof UpdateInventoryLocationSchema>;
