import { z } from 'zod';

const displayValue = z.string().max(1000).nullable();
export const CorrectionBodySchema = z.strictObject({
  reason: z.string().trim().min(10).max(500),
  expectedVersion: z.number().int().positive(),
  corrections: z.array(z.strictObject({
    field: z.enum(['recipientNotes', 'remarks']),
    oldValue: displayValue,
    newValue: displayValue,
  })).min(1).max(10),
});
export const RetryRenderBodySchema = z.strictObject({
  reason: z.string().trim().min(10).max(500),
});
export type CorrectionBody = z.infer<typeof CorrectionBodySchema>;
export type RetryRenderBody = z.infer<typeof RetryRenderBodySchema>;
