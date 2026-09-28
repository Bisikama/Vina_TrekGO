import { z } from 'zod';

export const UpdateRentalProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  dailyPrice: z.number().min(0).optional(),
  replacementValue: z.number().min(0).optional(),
  depositPolicy: z.object({
    type: z.enum(['FIXED', 'PERCENT_REPLACEMENT_VALUE']),
    amount: z.number().min(0).optional(),
    percentage: z.number().min(0).max(100).optional(),
  }).optional(),
  imageMediaIds: z.array(z.string()).optional(),
  spec: z.any().optional(),
  recommendationTags: z.array(z.string()).optional(),
  expectedVersion: z.number().int().min(1),
});

export type UpdateRentalProductDto = z.infer<typeof UpdateRentalProductSchema>;
