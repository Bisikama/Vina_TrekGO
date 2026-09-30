import { z } from 'zod';
import { dateOnlySchema } from '../../../../../shared/utils/zod-date.util';

export const UpdateEquipmentUnitSchema = z.object({
  homeInventoryLocationId: z.string().uuid().optional(),
  serialNumber: z.string().trim().max(120).nullable().optional(),
  acquiredAt: dateOnlySchema.nullable().optional(),
  expectedVersion: z.number().int().positive('expectedVersion must be a positive integer'),
}).strict();

export type UpdateEquipmentUnitDto = z.infer<typeof UpdateEquipmentUnitSchema>;
