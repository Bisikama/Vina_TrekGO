import { z } from 'zod';

export const CreateRentalProductSchema = z.object({
  categoryId: z.string().uuid(),
  sku: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  dailyPrice: z.number().min(0),
  currency: z.string().default('VND'),
  replacementValue: z.number().min(0),
  depositPolicy: z.object({
    type: z.enum(['FIXED', 'PERCENT_REPLACEMENT_VALUE']),
    amount: z.number().min(0).optional(),
    percentage: z.number().min(0).max(100).optional(),
  }),
  imageMediaIds: z.array(z.string().uuid()).optional(),
  spec: z.any().optional(),
  recommendationTags: z.array(z.string()).optional(),
  requiresDeepInspectionAfterReturn: z.boolean().optional(),
});

export type CreateRentalProductDto = z.infer<typeof CreateRentalProductSchema>;
