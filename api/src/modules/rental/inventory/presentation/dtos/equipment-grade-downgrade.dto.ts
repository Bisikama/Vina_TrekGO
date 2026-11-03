import { z } from 'zod'

export const EquipmentGradeDowngradeSchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
    note: z.string().trim().max(3000).optional(),
    evidenceIds: z.array(z.string().uuid()).max(10).optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict()

export type EquipmentGradeDowngradeDto = z.infer<typeof EquipmentGradeDowngradeSchema>

export const EquipmentIdempotencyKeySchema = z.string().trim().min(8).max(200)
