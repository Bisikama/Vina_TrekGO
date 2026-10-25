import { z } from 'zod';

export const planPrefillQuerySchema = z.object({
  tripId: z.string().uuid('tripId phải là UUID hợp lệ'),
});

export type PlanPrefillQueryInput = z.infer<typeof planPrefillQuerySchema>;

export const createPlanSchema = z.object({
  title: z.string().min(1, 'Tiêu đề kế hoạch không được để trống').max(220, 'Tiêu đề tối đa 220 ký tự'),
  contextMode: z.literal('TRIP'),
  tripId: z.string().uuid('tripId phải là UUID hợp lệ'),
  selectedItemIds: z.array(z.string().uuid('Item ID phải là UUID hợp lệ')).default([]),
  preferences: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreatePlanInputDto = z.infer<typeof createPlanSchema>;

export const updatePlanInputSchema = z.object({
  expectedInputRevision: z.number().int().min(1, 'expectedInputRevision phải là số nguyên dương >= 1'),
  title: z.string().min(1).max(220).optional(),
  selectedItemIds: z.array(z.string().uuid('Item ID phải là UUID hợp lệ')).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

export type UpdatePlanInputDto = z.infer<typeof updatePlanInputSchema>;

export const updateChecklistProgressSchema = z.object({
  expectedProgressVersion: z.number().int().min(1, 'expectedProgressVersion phải là số nguyên dương >= 1'),
  items: z
    .array(
      z.object({
        requirementId: z.string().min(1, 'requirementId không được để trống'),
        isChecked: z.boolean(),
        note: z.string().max(500).optional(),
      }),
    )
    .min(1, 'Danh sách cập nhật tiến độ không được để trống'),
});

export type UpdateChecklistProgressDto = z.infer<typeof updateChecklistProgressSchema>;

export const evaluatePlanSchema = z.object({
  expectedInputRevision: z.number().int().min(1, 'expectedInputRevision phải là số nguyên dương >= 1'),
  confirmedClimate: z
    .object({
      temp_min_c: z.number().finite('temp_min_c phải là số hữu hạn'),
      temp_max_c: z.number().finite('temp_max_c phải là số hữu hạn'),
      temp_min_night_c: z.number().finite('temp_min_night_c phải là số hữu hạn'),
      rain_prob_pct: z
        .number()
        .finite('rain_prob_pct phải là số hữu hạn')
        .min(0, 'rain_prob_pct phải >= 0')
        .max(100, 'rain_prob_pct phải <= 100'),
    })
    .refine((data) => data.temp_min_c <= data.temp_max_c, {
      message: 'temp_min_c phải <= temp_max_c',
    })
    .optional(),
});

export type EvaluatePlanDto = z.infer<typeof evaluatePlanSchema>;

export const planDiffQuerySchema = z.object({
  from: z.coerce.number().int().min(1).optional(),
  to: z.coerce.number().int().min(1).optional(),
  fromRevision: z.coerce.number().int().min(1).optional(),
  toRevision: z.coerce.number().int().min(1).optional(),
});

export type PlanDiffQueryInput = z.infer<typeof planDiffQuerySchema>;

export const generatePlanOptionsSchema = z.object({
  expectedInputRevision: z.number().int().min(1).optional(),
  expectedRevision: z.number().int().min(1).optional(),
  objective: z.enum(['MIN_RENTAL_FEE', 'MIN_KNOWN_TOTAL_WEIGHT', 'BALANCED']).optional().default('MIN_RENTAL_FEE'),
  candidateLimit: z.number().int().min(1).max(50).optional().default(20),
  budgetLimit: z.number().int().min(0).optional(),
});

export type GeneratePlanOptionsDto = z.infer<typeof generatePlanOptionsSchema>;

export const generatePlanAdviceSchema = z.object({
  expectedRevision: z.number().int().min(1),
  optionRef: z.object({
    setId: z.string().uuid('setId phải là UUID hợp lệ'),
    optionId: z.string().min(1, 'optionId không được để trống'),
  }),
});

export type GeneratePlanAdviceDto = z.infer<typeof generatePlanAdviceSchema>;

export const createQuoteIntentSchema = z.object({
  expectedRevision: z.number().int().min(1),
  optionRef: z.object({
    setId: z.string().uuid('setId phải là UUID hợp lệ'),
    optionId: z.string().min(1, 'optionId không được để trống'),
  }),
});

export type CreateQuoteIntentDto = z.infer<typeof createQuoteIntentSchema>;

export const linkQuoteSchema = z.object({
  expectedRevision: z.number().int().min(1),
  quoteId: z.string().uuid('quoteId phải là UUID hợp lệ'),
});

export type LinkQuoteDto = z.infer<typeof linkQuoteSchema>;

