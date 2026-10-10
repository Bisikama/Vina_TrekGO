import { z } from 'zod';

export const RentalTripIdParamSchema = z.object({
  tripId: z.string().uuid(),
});
export type RentalTripIdParamDto = z.infer<typeof RentalTripIdParamSchema>;

export const RentalAvailabilityQuerySchema = z.object({
  tripId: z.string().uuid(),
  productId: z.string().uuid(),
  requestedReturnAt: z.string().datetime({ offset: true }).optional(),
  returnOptionId: z.string().min(1).optional(),
});

export type RentalAvailabilityQueryDto = z.infer<
  typeof RentalAvailabilityQuerySchema
>;

export const RentalQuoteBodySchema = z.object({
  tripId: z.string().uuid(),
  recipientTripMemberId: z.string().uuid().optional(),
  requestedReturnAt: z.string().datetime({ offset: true }).optional(),
  returnOptionId: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});
export type RentalQuoteBodyDto = z.infer<typeof RentalQuoteBodySchema>;

export const RentalRecommendationQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(50).default(5),
});

export type RentalRecommendationQueryDto = z.infer<
  typeof RentalRecommendationQuerySchema
>;