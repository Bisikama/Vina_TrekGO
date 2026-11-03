import { z } from 'zod'
import { gearCategorySchema, gearConditionSchema } from './user-gear.dto'

export const preparationSelectionSchema = z.object({
  expectedVersion: z.number().int().min(0),
  choices: z.array(z.object({ category: gearCategorySchema, status: z.enum(['HAVE', 'NOT_HAVE', 'CHECK_LATER']) }).strict()).max(8),
}).strict().refine((body) => new Set(body.choices.map((choice) => choice.category)).size === body.choices.length, { message: 'Danh mục không được trùng lặp' })

export const personalCatalogDraftSchema = z.object({
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(100).nullable().optional(),
  category: gearCategorySchema,
  attributes: z.record(z.string(), z.unknown()),
  evidence: z.record(z.string(), z.string().trim().min(1).max(1000)),
}).strict()
export const personalCatalogUpdateSchema = personalCatalogDraftSchema.extend({ expectedVersion: z.number().int().min(1) }).strict()

export const catalogVerifySchema = z.object({ expectedVersion: z.number().int().min(1) }).strict()
export const catalogSearchSchema = z.object({ q: z.string().trim().max(100).optional(), category: gearCategorySchema.optional(),
  cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict()
export const catalogCreateItemSchema = z.object({
  condition: gearConditionSchema,
  acknowledgeDuplicate: z.boolean().optional(),
}).strict()

export type PreparationSelectionInput = z.infer<typeof preparationSelectionSchema>
export type PersonalCatalogDraftInput = z.infer<typeof personalCatalogDraftSchema>
export type PersonalCatalogUpdateInput = z.infer<typeof personalCatalogUpdateSchema>
export type CatalogCreateItemInput = z.infer<typeof catalogCreateItemSchema>
