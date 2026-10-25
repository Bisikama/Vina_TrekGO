import { z } from 'zod';
import { createUserGearItemSchema } from './user-gear.dto';

export const imageExtractionInputSchema = z.object({
  source: z.literal('IMAGE'),
  uploadId: z.string().uuid('uploadId must be a valid media asset UUID'),
});

export const linkExtractionInputSchema = z.object({
  source: z.literal('LINK'),
  url: z.string().url('url must be a valid URL'),
  forceRefresh: z.boolean().optional(),
  bypassContentCache: z.boolean().optional(),
});

export const createExtractionSchema = z.discriminatedUnion('source', [
  imageExtractionInputSchema,
  linkExtractionInputSchema,
]);

export type CreateExtractionDto = z.infer<typeof createExtractionSchema>;

export const confirmExtractionDraftSchema = z
  .object({
    expectedVersion: z.number().int().min(1).optional(),
    acknowledgeDuplicate: z.boolean().optional(),
    item: createUserGearItemSchema,
  })
  .strict();

export type ConfirmExtractionDraftDto = z.infer<typeof confirmExtractionDraftSchema>;

