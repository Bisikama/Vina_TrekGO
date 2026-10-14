import { z } from 'zod';

const UUID = z.string().uuid();

export const DeliveryTaskIdParamSchema = z.object({ id: UUID });
export type DeliveryTaskIdParamDto = z.infer<typeof DeliveryTaskIdParamSchema>;

export const RentalOrderIdParamSchema = z.object({ id: UUID });
export type RentalOrderIdParamDto = z.infer<typeof RentalOrderIdParamSchema>;

export const DeliveryIdempotencyKeySchema = z.string().trim().min(8).max(200);

export const ListDeliveryTasksQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(['OUTBOUND', 'RETURN']).optional(),
  status: z.enum([
    'SCHEDULED', 'PACKAGE_RECEIVED', 'RECIPIENT_VERIFIED', 'HANDED_OVER',
    'COLLECTING', 'RETURNED', 'INVENTORY_RECEIVED', 'NO_SHOW', 'REFUSED',
    'CLOSED', 'BLOCKED', 'CANCELLED',
  ]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListDeliveryTasksQueryDto = z.infer<typeof ListDeliveryTasksQuerySchema>;

export const ClaimDeliveryTaskBodySchema = z.object({
  expectedVersion: z.number().int().min(1),
});
export type ClaimDeliveryTaskBodyDto = z.infer<typeof ClaimDeliveryTaskBodySchema>;

export const ReceivePackageBodySchema = z.object({
  custodyTransferId: UUID,
  packageCode: z.string().trim().min(3).max(120),
  expectedVersion: z.number().int().min(1),
});
export type ReceivePackageBodyDto = z.infer<typeof ReceivePackageBodySchema>;

export const VerifyRecipientBodySchema = z.object({
  pickupCode: z.string().trim().min(1).max(128),
  expectedVersion: z.number().int().min(1),
});
export type VerifyRecipientBodyDto = z.infer<typeof VerifyRecipientBodySchema>;

const ReportedIssueSchema = z.object({
  unitId: UUID.optional(),
  type: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(1000),
});

export const CommitHandoverBodySchema = z.object({
  packageId: UUID,
  verificationRef: z.string().trim().min(8).max(180),
  recipientNotes: z.string().trim().max(2000).optional(),
  reportedIssues: z.array(ReportedIssueSchema).optional().default([]),
  expectedVersion: z.number().int().min(1),
});
export type CommitHandoverBodyDto = z.infer<typeof CommitHandoverBodySchema>;

export const MarkNoShowBodySchema = z.object({
  reason: z.enum([
    'NO_SHOW',
    'USER_NO_SHOW',
    'USER_CHANGED_MIND',
    'USER_REFUSED_DISCLOSED_CONDITION',
    'SYSTEM_WRONG_EQUIPMENT',
    'SYSTEM_DAMAGED_EQUIPMENT',
    'SYSTEM_MISSING_EQUIPMENT',
    'OTHER_SYSTEM_FAULT',
  ]),
  notes: z.string().trim().max(2000).optional(),
  evidenceIds: z.array(UUID).optional().default([]),
  expectedVersion: z.number().int().min(1),
});
export type MarkNoShowBodyDto = z.infer<typeof MarkNoShowBodySchema>;

export const AssignRentalTaskBodySchema = z.object({
  taskType: z.enum(['WAREHOUSE', 'OUTBOUND', 'RETURN']),
  assigneeId: UUID,
  reason: z.string().trim().min(3).max(1000),
  expectedVersion: z.number().int().min(1),
});
export type AssignRentalTaskBodyDto = z.infer<typeof AssignRentalTaskBodySchema>;

export const ListAdminRentalTasksQuerySchema = z.object({
  type: z.enum(['WAREHOUSE', 'OUTBOUND', 'RETURN']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignment: z.enum(['UNASSIGNED', 'ASSIGNED', 'ME']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAdminRentalTasksQueryDto = z.infer<typeof ListAdminRentalTasksQuerySchema>;

export const ListRentalAssigneesQuerySchema = z.object({
  role: z.enum(['STAFF_INVENTORY', 'STAFF_DELIVERY']),
  taskId: UUID.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListRentalAssigneesQueryDto = z.infer<typeof ListRentalAssigneesQuerySchema>;
