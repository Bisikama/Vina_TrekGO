import { z } from 'zod';
import { dateOnlySchema } from '../../../../../shared/utils/zod-date.util';
import { EquipmentUnitStatusValue, EquipmentConditionValue } from '../../application/ports/equipment-unit.port';

const EquipmentUnitStatusEnum = z.enum([
  'AVAILABLE', 'PICKED', 'PACKED', 'RENTED', 
  'RETURN_PENDING', 'CLEANING', 'MAINTENANCE', 
  'DAMAGED', 'LOST', 'RETIRED'
]);

const EquipmentConditionEnum = z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST']);

export const ListEquipmentUnitsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().uuid().optional(),
  status: EquipmentUnitStatusEnum.optional(),
  condition: EquipmentConditionEnum.optional(),
  inventoryLocationId: z.string().uuid().optional(),
  q: z.string().optional(),
  batchCode: z.string().trim().min(1).max(60).optional(),
  expiringBefore: dateOnlySchema.optional(),
});

export type ListEquipmentUnitsDto = z.infer<typeof ListEquipmentUnitsSchema>;
