import { z } from 'zod'

export const tripIdParamSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i, 'Invalid UUID')

const moneyNonNegative = z
  .string()
  .regex(/^(0|[1-9]\d{0,9})$/, 'Số tiền phải là chuỗi số nguyên không âm, tối đa 10 chữ số')

const moneyPositive = z
  .string()
  .regex(/^[1-9]\d{0,9}$/, 'Giá vé phải là chuỗi số nguyên dương, tối đa 10 chữ số')

export const stepTierSchema = z
  .object({
    triggerMinPax: z.number().int().min(1).max(10000),
    triggerMaxPax: z.number().int().min(1).max(10000),
    operation: z.enum(['ADDITIVE', 'REPLACEMENT']),
    amount: moneyNonNegative,
    note: z.string().trim().max(200).nullable().optional(),
  })
  .strict()

export const costItemSchema = z
  .object({
    category: z.enum(['TRANSPORT', 'STAFF', 'FOOD', 'ACCOMMODATION', 'ACCESS', 'SAFETY', 'LOGISTICS', 'OTHER']),
    name: z.string().trim().min(1).max(160),
    kind: z.enum(['FIXED', 'VARIABLE', 'STEP']),
    basis: z.enum([
      'PER_TRIP',
      'PER_DAY',
      'PER_PERSON',
      'PER_PERSON_PER_DAY',
      'PER_CAPACITY_UNIT',
      'PER_GROUP_TIER',
    ]),
    unitPrice: moneyNonNegative.default('0'),
    quantity: z.number().int().min(1).max(10000).default(1),
    durationUnits: z.number().int().min(1).max(365).default(1),
    capacityPerUnit: z.number().int().min(1).max(10000).nullable().optional(),
    extraNonPayingPax: z.number().int().min(0).max(1000).default(0),
    includedInPrice: z.boolean().default(true),
    isEnabled: z.boolean().default(true),
    sourceNote: z.string().trim().max(500).nullable().optional(),
    stepTiers: z.array(stepTierSchema).max(50).optional(),
  })
  .strict()

export const pricingPreviewSchema = z
  .object({
    targetPax: z.number().int().min(1).max(10000),
    targetMarginBps: z.number().int().min(0).max(9500).default(1200),
    contingencyBps: z.number().int().min(0).max(10000).default(500),
    selectedPrice: moneyPositive.nullable().optional(),
    selectedMinPax: z.number().int().min(1).max(10000).nullable().optional(),
    items: z.array(costItemSchema).min(1).max(100),
  })
  .strict()

export const costPlanSaveSchema = pricingPreviewSchema
  .extend({
    expectedVersion: z.number().int().positive(),
  })
  .strict()

export const pricingConfirmSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    selectedPrice: moneyPositive,
    selectedMinPax: z.number().int().min(1).max(10000),
    targetPax: z.number().int().min(1).max(10000).optional(),
  })
  .strict()

export type CostItemDto = z.infer<typeof costItemSchema>
export type PricingPreviewInput = z.infer<typeof pricingPreviewSchema>
export type CostPlanSaveInput = z.infer<typeof costPlanSaveSchema>
export type PricingConfirmInput = z.infer<typeof pricingConfirmSchema>
