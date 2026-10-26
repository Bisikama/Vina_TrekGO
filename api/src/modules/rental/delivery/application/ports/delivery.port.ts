export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface ListDeliveryTasksQuery extends PageQuery {
  actorUserId: string;
  date?: string;
  type?: 'OUTBOUND' | 'RETURN';
  status?: string;
}

export interface GetDeliveryTaskQuery {
  actorUserId: string;
  taskId: string;
}

export interface ClaimDeliveryTaskCommand {
  actorUserId: string;
  taskId: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface ReceivePackageCommand {
  actorUserId: string;
  taskId: string;
  custodyTransferId: string;
  packageCode: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface VerifyRecipientCommand {
  actorUserId: string;
  taskId: string;
  pickupCode: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface CommitHandoverCommand {
  actorUserId: string;
  orderId: string;
  packageId: string;
  verificationRef: string;
  recipientNotes?: string;
  reportedIssues?: Array<{
    unitId?: string;
    type: string;
    description: string;
  }>;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export type NoShowReason =
  | 'NO_SHOW'
  | 'USER_NO_SHOW'
  | 'USER_CHANGED_MIND'
  | 'USER_REFUSED_DISCLOSED_CONDITION'
  | 'SYSTEM_WRONG_EQUIPMENT'
  | 'SYSTEM_DAMAGED_EQUIPMENT'
  | 'SYSTEM_MISSING_EQUIPMENT'
  | 'OTHER_SYSTEM_FAULT';

export interface MarkNoShowCommand {
  actorUserId: string;
  orderId: string;
  reason: NoShowReason;
  notes?: string;
  evidenceIds: string[];
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface GetPickupCodeQuery {
  actorUserId: string;
  orderId: string;
  now: Date;
}

export interface GetHandoverPreviewQuery {
  actorUserId: string;
  orderId: string;
}

export type RentalAdminTaskType = 'PREPARATION' | 'WAREHOUSE' | 'OUTBOUND' | 'RETURN';

export interface AssignRentalTaskCommand {
  actorUserId: string;
  taskId: string;
  taskType: RentalAdminTaskType;
  assigneeId: string;
  reason: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface ListAdminRentalTasksQuery extends PageQuery {
  actorUserId: string;
  type?: RentalAdminTaskType;
  date?: string;
  assignment?: 'UNASSIGNED' | 'ASSIGNED' | 'ME';
}

export interface ListRentalAssigneesQuery extends PageQuery {
  actorUserId: string;
  actorRole: string;
  role: 'STAFF_INVENTORY' | 'STAFF_DELIVERY';
  taskId?: string;
}

export interface PaginationResult {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface DeliveryTaskListResult {
  items: Array<Record<string, unknown>>;
  pagination: PaginationResult;
}

export interface DeliveryTaskDetailResult {
  task: Record<string, unknown>;
  package: Record<string, unknown> | null;
  custodyTransfer: Record<string, unknown> | null;
  units: Array<Record<string, unknown>>;
  recipient: Record<string, unknown>;
  verificationStatus: Record<string, unknown>;
}

export interface ClaimDeliveryTaskResult {
  assignee: { id: string; displayName: string };
  version: number;
}

export interface ReceivePackageResult {
  task: Record<string, unknown>;
  custody: Record<string, unknown>;
}

export interface VerifyRecipientResult {
  verificationRef: string;
  recipient: Record<string, unknown>;
  expectedPackage: Record<string, unknown>;
  expiresAt: string;
  taskVersion: number;
}

export interface CommitHandoverResult {
  order: Record<string, unknown>;
  units: Array<Record<string, unknown>>;
  handoverRecord: Record<string, unknown>;
}

export interface MarkNoShowResult {
  orderId: string;
  exceptionStatus: string;
  refundPreview: {
    feeRefund: number;
    depositRefund: number;
    totalRefund: number;
    status: string | null;
    refundRef: string | null;
  };
  returnToWarehouseRequired: boolean;
  returnToInventoryLocationRequired?: boolean;
}

export interface PickupCodeResult {
  pickupCode: string;
  expiresAt: string;
  orderId: string;
  recipient: Record<string, unknown>;
  pickupPoint: Record<string, unknown>;
}

export interface HandoverPreviewResult {
  package: Record<string, unknown>;
  conditionSnapshots: Array<Record<string, unknown>>;
  recipient: Record<string, unknown>;
  pickupPoint: Record<string, unknown>;
  status: string;
}

export interface AssignRentalTaskResult {
  assignee: { id: string; displayName: string };
  taskVersion: number;
}

export interface RentalAssigneeListResult {
  items: Array<Record<string, unknown>>;
  pagination: PaginationResult;
}

export const DELIVERY_PORT = Symbol('DELIVERY_PORT');
export const LOGISTICS_PORT = Symbol('LOGISTICS_PORT');

export interface DeliveryPort {
  listTasks(query: ListDeliveryTasksQuery): Promise<DeliveryTaskListResult>;
  getTask(query: GetDeliveryTaskQuery): Promise<DeliveryTaskDetailResult>;
  claimTask(command: ClaimDeliveryTaskCommand): Promise<ClaimDeliveryTaskResult>;
  receivePackage(command: ReceivePackageCommand): Promise<ReceivePackageResult>;
  verifyRecipient(command: VerifyRecipientCommand): Promise<VerifyRecipientResult>;
  commitHandover(command: CommitHandoverCommand): Promise<CommitHandoverResult>;
  markNoShow(command: MarkNoShowCommand): Promise<MarkNoShowResult>;
  getPickupCode(query: GetPickupCodeQuery): Promise<PickupCodeResult>;
  getHandoverPreview(query: GetHandoverPreviewQuery): Promise<HandoverPreviewResult>;
  assignTask(command: AssignRentalTaskCommand): Promise<AssignRentalTaskResult>;
  listAdminTasks(query: ListAdminRentalTasksQuery): Promise<DeliveryTaskListResult>;
  listAssignees(query: ListRentalAssigneesQuery): Promise<RentalAssigneeListResult>;
}
