import { z } from 'zod';
import { RentalDocumentType } from '@prisma/client';

const UUID = z.string().uuid();

export const ReturnIdParamSchema = z
  .object({
    returnId: UUID.optional(),
    id: UUID.optional(),
  })
  .refine((data) => Boolean(data.returnId || data.id), {
    message: 'returnId or id is required',
  })
  .transform((data) => ({
    returnId: (data.returnId ?? data.id)!,
    id: (data.id ?? data.returnId)!,
  }));
export const RentalOrderIdParamSchema = z.object({ id: UUID });
export const ExceptionIdParamSchema = z.object({ id: UUID });
export const EquipmentUnitIdParamSchema = z.object({ id: UUID });
export const RentalReturnIdempotencyKeySchema = z.string().trim().min(8).max(200);

export const ReturnScanBodySchema = z.object({
  assetCodes: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
  operationId: z.string().trim().min(8).max(200),
  expectedVersion: z.number().int().min(1),
});

const ReturnInspectionItemSchema = z.object({
  unitId: UUID,
  outcome: z.enum(['OBSERVED_RECEIVED', 'OBSERVED_ISSUE']),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST']),
  accessoryIssues: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  notes: z.string().trim().max(2000).optional(),
  evidenceIds: z.array(UUID).max(20).default([]),
});

// Canonical RB-API-602 SOT v1.3.2: observation only, never FINAL condition.
const ReturnObservationItemSchema = z.object({
  unitId: UUID,
  visibleDamage: z.boolean().optional(),
  accessoryObservations: z.array(z.string().trim().min(1).max(300)).max(50).optional().default([]),
  notes: z.string().trim().max(2000).optional(),
  evidenceIds: z.array(UUID).max(20).optional().default([]),
});
export const ReturnObservationBodySchema = z.object({
  items: z.array(ReturnObservationItemSchema).min(1).max(100),
  expectedVersion: z.number().int().min(1),
});
// Legacy request shape accepted temporarily to ease FE migration, not the canonical contract.
export const ReturnInspectionBodySchema = z.union([ReturnObservationBodySchema, z.object({
  items: z.array(ReturnInspectionItemSchema).min(1).max(100),
  expectedVersion: z.number().int().min(1),
})]);

export const ReturnToInventoryLocationBodySchema = z.object({
  unitIds: z.array(UUID).max(100),
  missingInCustodyUnitIds: z.array(UUID).max(100).optional().default([]),
  incidentNote: z.string().trim().min(3).max(2000).optional(),
  packageId: UUID.optional(),
  pendingTransferId: UUID.optional(),
  expectedVersion: z.number().int().min(1),
});

export const ReceiveReturnBodySchema = z.object({
  pendingTransferId: UUID,
  inventoryLocationId: UUID, // RB-API-604: must match the pending custody transfer destination.
  scannedUnitIds: z.array(UUID).max(100),
  incidentNote: z.string().trim().min(3).max(2000).optional(),
  expectedVersion: z.number().int().min(1),
});

const DamageInputSchema = z.object({
  ruleId: UUID,
  quantity: z.number().int().min(1).max(100).optional().default(1),
  notes: z.string().trim().max(2000).optional(),
  evidenceIds: z.array(UUID).max(20).optional().default([]),
});

const FinalInspectionItemSchema = z.object({
  unitId: UUID.optional(),
  issueUnitId: UUID.optional(), // legacy
  outcome: z.enum(['PASS', 'ISSUE']).optional(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'LOST']),
  accessories: z.array(z.string()).optional().default([]),
  damage: z.array(DamageInputSchema).max(50).optional().default([]),
  evidenceIds: z.array(UUID).max(20).default([]),
  notes: z.string().trim().max(2000).optional(),
}).refine(item => Boolean(item.unitId || item.issueUnitId), 'unitId required')
  .refine(item => !(item.outcome === 'PASS' && (item.condition === 'DAMAGED' || item.damage.length)), 'PASS_CONFLICTS_WITH_DAMAGE');

export const FinalInspectionBodySchema = z.object({
  items: z.array(FinalInspectionItemSchema).min(1).max(100),
  expectedVersion: z.number().int().min(1),
});

export const CreateDepositSettlementBodySchema = z.object({
  assessmentId: UUID,
  approvalRef: z.string().trim().min(3).max(180),
});

const FinalizeUnitOutcomeSchema = z.object({
  unitId: UUID,
  outcome: z.enum(['NORMAL', 'DAMAGED', 'LOST']),
});

export const FinalizeReturnBodySchema = z.object({
  unitOutcomes: z.array(FinalizeUnitOutcomeSchema).min(1).max(100),
  inspectionVersion: z.number().int().min(1),
  expectedVersion: z.number().int().min(1),
});

export const AssessmentReviewBodySchema = z.object({
  assessmentId: UUID,
  reason: z.string().trim().min(3).max(3000),
  evidenceIds: z.array(UUID).max(20).default([]),
});

export const ResolveExceptionBodySchema = z.object({
  decision: z.enum(['APPROVE_DEDUCTION', 'REJECT_DEDUCTION', 'CONFIRM_LOST', 'CLOSE_NO_ACTION']),
  reason: z.string().trim().min(3).max(3000),
  assessmentVersion: z.number().int().min(1).optional(),
  expectedVersion: z.number().int().min(1),
});

export const MarkUnitReadyBodySchema = z.object({
  inspectionId: UUID.optional(),
  accessoriesChecked: z.boolean(),
  expectedVersion: z.number().int().min(1),
});

export const ListExceptionsQuerySchema = z.object({
  type: z.string().trim().min(1).max(80).optional(),
  status: z.string().trim().min(1).max(80).optional(),
  assignee: UUID.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListReturnsQuerySchema = z.object({
  status: z.enum(['WAITING_CLEANING', 'REVIEW_REQUIRED', 'TRANSFER_PENDING', 'INVENTORY_RECEIVED', 'COMPLETED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const FinalizeReturnReceiptBodySchema = z.strictObject({
  returnSessionId: UUID,
  expectedVersion: z.number().int().min(1),
  remarks: z.string().trim().max(1000).optional(),
  failureEvidenceId: UUID.optional(),
  evidenceIds: z.array(UUID).optional(),
});

export const RentalDocumentIdParamSchema = z.object({ documentId: UUID });
export const RentalOrderDocumentParamsSchema = z.object({
  id: UUID,
  documentId: UUID,
});

export const ListRentalDocumentsQuerySchema = z.object({
  type: z.nativeEnum(RentalDocumentType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReturnIdParamDto = z.infer<typeof ReturnIdParamSchema>;
export type RentalOrderIdParamDto = z.infer<typeof RentalOrderIdParamSchema>;
export type ExceptionIdParamDto = z.infer<typeof ExceptionIdParamSchema>;
export type EquipmentUnitIdParamDto = z.infer<typeof EquipmentUnitIdParamSchema>;
export type ReturnScanBodyDto = z.infer<typeof ReturnScanBodySchema>;
export type ReturnInspectionBodyDto = z.infer<typeof ReturnInspectionBodySchema>;
export type ReturnToInventoryLocationBodyDto = z.infer<typeof ReturnToInventoryLocationBodySchema>;
export type ReceiveReturnBodyDto = z.infer<typeof ReceiveReturnBodySchema>;
export type FinalInspectionBodyDto = z.infer<typeof FinalInspectionBodySchema>;
export type CreateDepositSettlementBodyDto = z.infer<typeof CreateDepositSettlementBodySchema>;
export type FinalizeReturnBodyDto = z.infer<typeof FinalizeReturnBodySchema>;
export type AssessmentReviewBodyDto = z.infer<typeof AssessmentReviewBodySchema>;
export type ResolveExceptionBodyDto = z.infer<typeof ResolveExceptionBodySchema>;
export type MarkUnitReadyBodyDto = z.infer<typeof MarkUnitReadyBodySchema>;
export type ListExceptionsQueryDto = z.infer<typeof ListExceptionsQuerySchema>;
export type ListReturnsQueryDto = z.infer<typeof ListReturnsQuerySchema>;
export type FinalizeReturnReceiptBodyDto = z.infer<typeof FinalizeReturnReceiptBodySchema>;
export type RentalDocumentIdParamDto = z.infer<typeof RentalDocumentIdParamSchema>;
export type RentalOrderDocumentParamsDto = z.infer<typeof RentalOrderDocumentParamsSchema>;
export type ListRentalDocumentsQueryDto = z.infer<typeof ListRentalDocumentsQuerySchema>;
