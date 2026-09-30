import { z } from 'zod';
import { EquipmentConditionValue } from '../../application/ports/equipment-unit.port';

const startSchema = z.object({
  action: z.literal('START'),
  reason: z.string().trim().min(1).max(500),
  notes: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().positive(),
}).strict();

const completeSchema = z.object({
  action: z.literal('COMPLETE'),
  resultingCondition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST']),
  expectedVersion: z.number().int().positive(),
}).strict();

export const ChangeEquipmentMaintenanceSchema = z.discriminatedUnion('action', [
  startSchema,
  completeSchema,
]);

export type ChangeEquipmentMaintenanceDto = z.infer<typeof ChangeEquipmentMaintenanceSchema>;
