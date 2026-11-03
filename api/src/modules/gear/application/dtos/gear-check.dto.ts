import { z } from 'zod';

export const confirmedClimateSchema = z.object({
  temp_min_c: z.number().min(-50).max(60),
  temp_max_c: z.number().min(-50).max(60),
  temp_min_night_c: z.number().min(-50).max(60),
  rain_prob_pct: z.number().min(0).max(100),
}).strict().refine(
  (data) => data.temp_min_c <= data.temp_max_c,
  { message: 'temp_min_c must be <= temp_max_c' }
);

export type ConfirmedClimateInput = z.infer<typeof confirmedClimateSchema>;

export const gearCheckRequestSchema = z
  .object({
    tripId: z.string().uuid('tripId must be a valid UUID'),
    itemIds: z.array(z.string().uuid('Each itemId must be a valid UUID')),
    confirmedClimate: confirmedClimateSchema.optional(),
  })
  .strict()
  .refine(
    (data) => new Set(data.itemIds).size === data.itemIds.length,
    { message: 'itemIds must not contain duplicate IDs', path: ['itemIds'] },
  );

export type GearCheckRequestInput = z.infer<typeof gearCheckRequestSchema>;

