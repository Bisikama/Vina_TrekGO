import { z } from 'zod';

export const GenerateEquipmentLabelsSchema = z.object({
  unitIds: z.array(z.string().uuid()).min(1, 'At least one unitId is required'),
}).strict();

export type GenerateEquipmentLabelsDto = z.infer<typeof GenerateEquipmentLabelsSchema>;
