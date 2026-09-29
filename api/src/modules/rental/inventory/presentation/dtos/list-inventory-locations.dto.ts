import { z } from 'zod';

export const ListInventoryLocationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

export type ListInventoryLocationsDto = z.infer<typeof ListInventoryLocationsSchema>;
