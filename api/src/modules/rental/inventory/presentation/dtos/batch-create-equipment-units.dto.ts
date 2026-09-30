import { z } from 'zod';
import { EquipmentConditionValue } from '../../application/ports/equipment-unit.port';
import { dateOnlySchema } from '../../../../../shared/utils/zod-date.util';

const EquipmentConditionEnum = z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST']);

export const BatchCreateEquipmentUnitsSchema = z.object({
  productId: z.string().uuid(),
  homeInventoryLocationId: z.string().uuid(),
  quantity: z.number().int().positive('quantity must be greater than 0'),
  assetCodeMode: z.enum(['AUTO', 'PROVIDED']),
  assetCodes: z.array(z.string().trim().min(1).max(100)).optional(),
  condition: EquipmentConditionEnum.default('GOOD'),
  acquiredAt: dateOnlySchema.optional(),
}).strict().refine(data => {
  if (data.assetCodeMode === 'PROVIDED') {
    if (!data.assetCodes || data.assetCodes.length !== data.quantity) return false;
  }
  return true;
}, {
  message: 'Number of provided asset codes does not match quantity',
  path: ['assetCodes'],
});

export type BatchCreateEquipmentUnitsDto = z.infer<typeof BatchCreateEquipmentUnitsSchema>;
