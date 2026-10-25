import { z } from 'zod';
import { gearCategorySchema } from './user-gear.dto';

export const upsertProductTechnicalProfileSchema = z.object({
  category: gearCategorySchema,
  attributes: z.record(z.string(), z.unknown()),
  expectedVersion: z.number().int().min(0).optional(),
  schemaVersion: z.string().optional().default('3.1.5'),
  sources: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type UpsertProductTechnicalProfileInput = z.infer<typeof upsertProductTechnicalProfileSchema>;

