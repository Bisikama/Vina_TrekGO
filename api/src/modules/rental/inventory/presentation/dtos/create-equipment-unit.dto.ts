import { z } from 'zod';
import { EquipmentConditionValue } from '../../application/ports/equipment-unit.port';
import { dateOnlySchema } from '../../../../../shared/utils/zod-date.util';

const EquipmentConditionEnum = z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST']);

export const CreateEquipmentUnitSchema = z.object({
  productId: z.string().uuid(),
  homeInventoryLocationId: z.string().uuid(),
  assetCode: z.string().trim().min(1).max(100).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  condition: EquipmentConditionEnum.default('GOOD'),
  acquiredAt: dateOnlySchema.optional(),
}).strict();

export type CreateEquipmentUnitDto = z.infer<typeof CreateEquipmentUnitSchema>;
