import { z } from 'zod';

export const CreateInventoryLocationSchema = z.object({
  code: z.string().min(3).max(60).describe('Mã định danh kho (ví dụ: INV-HCM-01)'),
  name: z.string().min(3).max(160).describe('Tên kho (ví dụ: Kho Trung Tâm HCM)'),
  address: z.string().min(5).describe('Địa chỉ chi tiết của kho'),
  latitude: z.number().min(-90).max(90).optional().describe('Vĩ độ (GPS)'),
  longitude: z.number().min(-180).max(180).optional().describe('Kinh độ (GPS)'),
});

export type CreateInventoryLocationDto = z.infer<typeof CreateInventoryLocationSchema>;
