import { z } from 'zod';

export const ChangeRentalProductStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
  expectedVersion: z.number().int().min(1),
});

export type ChangeRentalProductStatusDto = z.infer<typeof ChangeRentalProductStatusSchema>;
