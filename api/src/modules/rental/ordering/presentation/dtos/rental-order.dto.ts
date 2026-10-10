import { z } from 'zod';

export const RentalIdempotencyKeySchema = z.string().trim().min(1).max(200);

export const CreateRentalOrderBodySchema = z.object({
  quoteId: z.string().uuid(),
});
export type CreateRentalOrderBodyDto = z.infer<typeof CreateRentalOrderBodySchema>;

export const RentalOrderIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type RentalOrderIdParamDto = z.infer<typeof RentalOrderIdParamSchema>;

export const ListRentalOrdersQuerySchema = z.object({
  tripId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  status: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListRentalOrdersQueryDto = z.infer<typeof ListRentalOrdersQuerySchema>;

export const CancelRentalOrderBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  previewVersion: z.string().trim().min(1).max(128),
  expectedVersion: z.number().int().positive(),
});
export type CancelRentalOrderBodyDto = z.infer<typeof CancelRentalOrderBodySchema>;
