import { z } from 'zod';

const UUID = z.string().uuid();

export const PreparationTaskIdParamSchema = z.object({ id: UUID });
export type PreparationTaskIdParamDto = z.infer<typeof PreparationTaskIdParamSchema>;

export const InventoryLocationIdempotencyKeySchema = z.string().trim().min(8).max(200);

export const ListPreparationTasksQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['OPEN', 'PICKING', 'CONDITION_CAPTURED', 'PACKED', 'READY', 'TRANSFERRED', 'RETURN_RECEIVED', 'CLOSED', 'BLOCKED', 'CANCELLED']).optional(),
  tripId: UUID.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListPreparationTasksQueryDto = z.infer<typeof ListPreparationTasksQuerySchema>;

export const PickPreparationUnitsBodySchema = z.object({
  assetCodes: z.array(z.string().trim().min(1).max(100)).min(1).max(100).superRefine((items, ctx) => {
    const normalized = items.map((item) => item.toUpperCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'assetCodes must be unique in one request' });
    }
  }),
  expectedVersion: z.number().int().min(1),
});
export type PickPreparationUnitsBodyDto = z.infer<typeof PickPreparationUnitsBodySchema>;

const AccessorySchema = z.object({
  name: z.string().trim().min(1).max(160),
  expectedQuantity: z.number().int().min(0).max(1000),
  actualQuantity: z.number().int().min(0).max(1000),
});

export const SaveConditionSnapshotBodySchema = z.object({
  unitId: UUID,
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST']),
  notes: z.string().trim().max(2000).optional(),
  accessories: z.array(AccessorySchema).max(100).optional().default([]),
  evidenceIds: z.array(UUID).min(1).max(5),
  expectedVersion: z.number().int().min(1),
});
export type SaveConditionSnapshotBodyDto = z.infer<typeof SaveConditionSnapshotBodySchema>;

export const PackPreparationPackageBodySchema = z.object({
  unitIds: z.array(UUID).min(1).max(100).superRefine((items, ctx) => {
    if (new Set(items).size !== items.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unitIds must be unique' });
    }
  }),
  expectedVersion: z.number().int().min(1),
});
export type PackPreparationPackageBodyDto = z.infer<typeof PackPreparationPackageBodySchema>;

export const MarkPreparationReadyBodySchema = z.object({
  packageId: UUID,
  expectedVersion: z.number().int().min(1),
});
export type MarkPreparationReadyBodyDto = z.infer<typeof MarkPreparationReadyBodySchema>;

export const ReplacePreparationUnitBodySchema = z.object({
  oldUnitId: UUID,
  newUnitId: UUID,
  reason: z.string().trim().min(3).max(1000),
  expectedVersion: z.number().int().min(1),
}).refine((value) => value.oldUnitId !== value.newUnitId, {
  message: 'newUnitId must be different from oldUnitId',
  path: ['newUnitId'],
});
export type ReplacePreparationUnitBodyDto = z.infer<typeof ReplacePreparationUnitBodySchema>;

export const ClaimPreparationTaskBodySchema = z.object({
  expectedVersion: z.number().int().min(1),
});
export type ClaimPreparationTaskBodyDto = z.infer<typeof ClaimPreparationTaskBodySchema>;

export const RequestPreparationTransferBodySchema = z.object({
  packageId: UUID,
  toStaffId: UUID,
  expectedVersion: z.number().int().min(1),
});
export type RequestPreparationTransferBodyDto = z.infer<typeof RequestPreparationTransferBodySchema>;

export const ReplacementCandidatesQuerySchema = z.object({
  oldUnitId: UUID,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReplacementCandidatesQueryDto = z.infer<typeof ReplacementCandidatesQuerySchema>;

export const PickCandidatesQuerySchema = z.object({
  productId: UUID.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PickCandidatesQueryDto = z.infer<typeof PickCandidatesQuerySchema>;
