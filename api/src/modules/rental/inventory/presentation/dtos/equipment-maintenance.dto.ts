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
  // true = Ngừng sử dụng (RETIRED) thay vì đưa về kệ, vd món đạt ngưỡng hao mòn không nên cho thuê tiếp.
  retire: z.boolean().optional(),
  expectedVersion: z.number().int().positive(),
}).strict().refine((body) => !body.retire || !['DAMAGED', 'LOST'].includes(body.resultingCondition), {
  message: 'retire chỉ dùng với NEW/GOOD/FAIR (DAMAGED/LOST đã có trạng thái riêng)',
  path: ['retire'],
});

export const ChangeEquipmentMaintenanceSchema = z.discriminatedUnion('action', [
  startSchema,
  completeSchema,
]);

export type ChangeEquipmentMaintenanceDto = z.infer<typeof ChangeEquipmentMaintenanceSchema>;
