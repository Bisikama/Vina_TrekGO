import { z } from 'zod';

export const CreateRentalProductSchema = z
  .object({
    categoryId: z.string().uuid(),
    sku: z.string().min(1).max(80),
    name: z.string().min(1).max(200),
    description: z.string().optional().nullable(),
    dailyPrice: z.number().int().min(0),
    currency: z.string().default('VND'),
    // Bắt buộc khi ADMIN tạo; STAFF_INVENTORY không gửi (kiểm ở use-case vì phụ thuộc role).
    replacementValue: z.number().int().min(0).optional(),
    depositPolicy: z
      .object({
        type: z.enum(['FIXED', 'PERCENT_REPLACEMENT_VALUE']),
        amount: z.number().int().min(0).optional(),
        percentage: z.number().min(0).max(100).optional(),
      })
      .optional(),
    imageMediaIds: z.array(z.string().uuid()).optional(),
    spec: z.any().optional(),
    recommendationTags: z.array(z.string()).optional(),
    requiresDeepInspectionAfterReturn: z.boolean().optional(),
    // Hạng: chỉ gửi grade = mở nhóm mới; gửi thêm gradeGroupId = vào nhóm sẵn có.
    grade: z.enum(['LIKE_NEW', 'GOOD_USED']).optional(),
    gradeGroupId: z.string().uuid().optional(),
  })
  .refine((body) => body.gradeGroupId === undefined || body.grade !== undefined, {
    message: 'gradeGroupId requires grade',
    path: ['grade'],
  });

export type CreateRentalProductDto = z.infer<typeof CreateRentalProductSchema>;
