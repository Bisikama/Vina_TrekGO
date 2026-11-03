import { z } from 'zod'
import { CORE_GEAR_CATEGORIES, EXTENDED_GEAR_CATEGORIES, GearCategory, GearCondition } from '../../domain/gear.types'

export const gearCategorySchema = z.enum([
  'JACKET',
  'FOOTWEAR',
  'PANTS',
  'BACKPACK',
  'SLEEPING_BAG',
  'TENT',
  'TREKKING_POLE',
  'RAIN_GEAR',
])

export const coreGearCategorySchema = z.enum(['JACKET', 'FOOTWEAR', 'PANTS', 'BACKPACK', 'SLEEPING_BAG'])

export const gearConditionSchema = z
  .enum(['NEW', 'GOOD', 'WORN', 'POOR', 'new', 'good', 'worn', 'poor'])
  .transform((val) => val.toUpperCase() as GearCondition)

export const userGearPhotoInputSchema = z.object({
  storageRef: z.string().uuid('storageRef must be a valid media asset UUID'),
  position: z.number().int().min(0).max(2),
})

// Category-specific attribute schemas
export const jacketAttributesSchema = z
  .object({
    waterproof_mm: z.number().int().min(0).nullable().optional(),
    temp_rating_c: z.number().int().nullable().optional(),
    weight_g: z.number().int().min(0).nullable().optional(),
    windproof: z.boolean().nullable().optional(),
  })
  .strict()

export const footwearAttributesSchema = z
  .object({
    waterproof: z.boolean().nullable().optional(),
    ankle_support: z.boolean().nullable().optional(),
    grip_level: z.number().int().min(1).max(5).nullable().optional(),
    weight_g: z.number().int().min(0).nullable().optional(),
  })
  .strict()

export const pantsAttributesSchema = z
  .object({
    waterproof_mm: z.number().int().min(0).nullable().optional(),
    temp_rating_c: z.number().int().nullable().optional(),
    insulated: z.boolean().nullable().optional(),
  })
  .strict()

export const backpackAttributesSchema = z
  .object({
    capacity_l: z.number().int().min(0).nullable().optional(),
    rain_cover: z.boolean().nullable().optional(),
    waterproof: z.boolean().nullable().optional(),
    weight_g: z.number().int().min(0).nullable().optional(),
  })
  .strict()

export const sleepingBagAttributesSchema = z
  .object({
    temp_rating_c: z.number().int().nullable().optional(),
    weight_g: z.number().int().min(0).nullable().optional(),
  })
  .strict()

export const tentAttributesSchema = z
  .object({
    sleeping_places: z.number().int().min(1).nullable().optional(),
    flysheet_waterproof_mm: z.number().int().min(0).nullable().optional(),
    floor_waterproof_mm: z.number().int().min(0).nullable().optional(),
    weight_g: z.number().int().min(0).nullable().optional(),
  })
  .strict()

export const trekkingPoleAttributesSchema = z
  .object({
    adjustable: z.boolean().nullable().optional(),
    length_min_cm: z.number().min(0).nullable().optional(),
    length_max_cm: z.number().min(0).nullable().optional(),
    weight_g: z.number().int().min(0).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (
        data.length_min_cm !== null &&
        data.length_min_cm !== undefined &&
        data.length_max_cm !== null &&
        data.length_max_cm !== undefined
      ) {
        return data.length_min_cm <= data.length_max_cm
      }
      return true
    },
    { message: 'length_min_cm must be <= length_max_cm' },
  )

export const rainGearAttributesSchema = z
  .object({
    waterproof_mm: z.number().int().min(0).nullable().optional(),
    coverage: z.enum(['UPPER_BODY', 'FULL_BODY']).nullable().optional(),
    weight_g: z.number().int().min(0).nullable().optional(),
  })
  .strict()

export const CANONICAL_CATEGORY_FIELD_KEYS: Record<GearCategory, readonly string[]> = {
  JACKET: ['waterproof_mm', 'temp_rating_c', 'weight_g', 'windproof'],
  FOOTWEAR: ['waterproof', 'ankle_support', 'grip_level', 'weight_g'],
  PANTS: ['waterproof_mm', 'temp_rating_c', 'insulated'],
  BACKPACK: ['capacity_l', 'rain_cover', 'waterproof', 'weight_g'],
  SLEEPING_BAG: ['temp_rating_c', 'weight_g'],
  TENT: ['sleeping_places', 'flysheet_waterproof_mm', 'floor_waterproof_mm', 'weight_g'],
  TREKKING_POLE: ['adjustable', 'length_min_cm', 'length_max_cm', 'weight_g'],
  RAIN_GEAR: ['waterproof_mm', 'coverage', 'weight_g'],
}

export function validateAttributesForCategory(category: GearCategory, rawAttrs: unknown): Record<string, unknown> {
  if (rawAttrs === null || typeof rawAttrs !== 'object' || Array.isArray(rawAttrs)) {
    throw new Error('attributes must be a non-null object')
  }

  let parsed: Record<string, unknown>
  switch (category) {
    case 'JACKET':
      parsed = jacketAttributesSchema.parse(rawAttrs)
      break
    case 'FOOTWEAR':
      parsed = footwearAttributesSchema.parse(rawAttrs)
      break
    case 'PANTS':
      parsed = pantsAttributesSchema.parse(rawAttrs)
      break
    case 'BACKPACK':
      parsed = backpackAttributesSchema.parse(rawAttrs)
      break
    case 'SLEEPING_BAG':
      parsed = sleepingBagAttributesSchema.parse(rawAttrs)
      break
    case 'TENT':
      parsed = tentAttributesSchema.parse(rawAttrs)
      break
    case 'TREKKING_POLE':
      parsed = trekkingPoleAttributesSchema.parse(rawAttrs)
      break
    case 'RAIN_GEAR':
      parsed = rainGearAttributesSchema.parse(rawAttrs)
      break
    default:
      throw new Error(`Unsupported category: ${String(category)}`)
  }

  return parsed
}

/**
 * Normalizes attributes on item creation by setting any missing canonical schema keys to null.
 */
export function normalizeCreateAttributes(category: GearCategory, rawAttrs: unknown): Record<string, unknown> {
  const parsed = validateAttributesForCategory(category, rawAttrs)
  const canonicalKeys = CANONICAL_CATEGORY_FIELD_KEYS[category] || []
  const normalized: Record<string, unknown> = {}

  for (const key of canonicalKeys) {
    normalized[key] = parsed[key] !== undefined ? parsed[key] : null
  }

  return normalized
}

export const createUserGearItemSchema = z
  .object({
    name: z.string().trim().min(1, 'name is mandatory').max(200, 'name cannot exceed 200 characters'),
    category: gearCategorySchema,
    brand: z.string().trim().max(100).nullable().optional(),
    condition: gearConditionSchema,
    attributes: z.record(z.string(), z.unknown()).default({}),
    photoRef: z.string().uuid().nullable().optional(),
    photos: z.array(userGearPhotoInputSchema).max(3).optional(),
    acknowledgeDuplicate: z.boolean().optional(),
  })
  .strict()

export type CreateUserGearItemInput = z.infer<typeof createUserGearItemSchema>

export const patchUserGearItemSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: gearCategorySchema.optional(),
    brand: z.string().trim().max(100).nullable().optional(),
    condition: gearConditionSchema.optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    photoRef: z.string().uuid().nullable().optional(),
    expectedVersion: z.number().int().min(1).optional(),
  })
  .strict()
  .refine(
    (data) => {
      // Must have at least one mutation field (excluding expectedVersion)
      const mutationKeys = Object.keys(data).filter((k) => k !== 'expectedVersion')
      if (mutationKeys.length === 0) {
        return false
      }
      // If category is changed, attributes is mandatory
      if (data.category && !data.attributes) {
        return false
      }
      return true
    },
    { message: 'PATCH payload must contain at least one mutation field; when changing category, attributes is mandatory' },
  )

export type PatchUserGearItemInput = z.infer<typeof patchUserGearItemSchema>

export const addPhotoSchema = z
  .object({
    storageRef: z.string().uuid('storageRef must be a valid media asset UUID'),
    position: z.number().int().min(0).max(2).optional(),
  })
  .strict()

export type AddPhotoInput = z.infer<typeof addPhotoSchema>

export const reorderPhotosSchema = z
  .object({
    photoOrders: z
      .array(
        z
          .object({
            photoId: z.string().uuid('photoId must be a valid UUID'),
            position: z.number().int().min(0).max(2),
          })
          .strict(),
      )
      .min(1, 'photoOrders cannot be empty')
      .max(3, 'At most 3 photos can be reordered')
      .refine(
        (orders) => {
          const ids = orders.map((o) => o.photoId)
          const positions = orders.map((o) => o.position)
          return new Set(ids).size === ids.length && new Set(positions).size === positions.length
        },
        { message: 'photoOrders must not contain duplicate photoId or duplicate position' },
      ),
  })
  .strict()

export type ReorderPhotosInput = z.infer<typeof reorderPhotosSchema>
