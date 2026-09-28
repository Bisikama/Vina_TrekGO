import { z } from 'zod';

export const ListRentalProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
});

export type ListRentalProductsDto = z.infer<typeof ListRentalProductsSchema>;
