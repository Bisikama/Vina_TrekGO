import { z } from 'zod';

export const RentalBookingIdParamSchema = z.object({
  bookingId: z.string().uuid(),
});
export type RentalBookingIdParamDto = z.infer<typeof RentalBookingIdParamSchema>;

export const RentalAvailabilityQuerySchema = z.object({
  bookingId: z.string().uuid(),
  productId: z.string().uuid(),
});

export type RentalAvailabilityQueryDto = z.infer<
  typeof RentalAvailabilityQuerySchema
>;

export const RentalQuoteBodySchema = z.object({
  bookingId: z.string().uuid(),
  recipientParticipantId: z.string().uuid().optional(),
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