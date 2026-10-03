import { z } from 'zod';

export const ListStaffRentalProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

export type ListStaffRentalProductsDto = z.infer<typeof ListStaffRentalProductsSchema>;
