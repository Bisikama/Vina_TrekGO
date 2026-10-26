export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface ListPreparationTasksQuery extends PageQuery {
  actorUserId: string;
  date?: string;
  status?: string;
  tripId?: string;
}

export interface GetPreparationTaskQuery {
  actorUserId: string;
  taskId: string;
}

export interface PickPreparationUnitsCommand {
  actorUserId: string;
  taskId: string;
  assetCodes: string[];
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface SavePreHandoverConditionCommand {
  actorUserId: string;
  taskId: string;
  unitId: string;
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'LOST';
  notes?: string;
  accessories?: Array<{
    name: string;
    expectedQuantity: number;
    actualQuantity: number;
  }>;
  evidenceIds: string[];
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface PackPreparationPackageCommand {
  actorUserId: string;
  taskId: string;
  unitIds: string[];
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface MarkPreparationReadyCommand {
  actorUserId: string;
  taskId: string;
  packageId: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface ReplacePreparationUnitCommand {
  actorUserId: string;
  taskId: string;
  oldUnitId: string;
  newUnitId: string;
  reason: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface ClaimPreparationTaskCommand {
  actorUserId: string;
  taskId: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface RequestPreparationTransferCommand {
  actorUserId: string;
  taskId: string;
  packageId: string;
  toStaffId: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface ListReplacementCandidatesQuery extends PageQuery {
  actorUserId: string;
  taskId: string;
  oldUnitId: string;
}

export interface ListPickCandidatesQuery extends PageQuery {
  actorUserId: string;
  taskId: string;
  productId?: string;
  q?: string;
}

export interface PreparationAssigneeView {
  id: string;
  displayName: string;
}

export interface PreparationUnitView {
  unitId: string;
  productId: string;
  assetCode: string;
  condition: string;
  physicalStatus: string;
  evidenceCaptured?: boolean;
}

export interface PreparationCandidateView {
  id: string;
  productId: string;
  assetCode: string;
  condition: string;
  physicalStatus: string;
  location: string | null;
  expectedReadyAt?: string | null;
  version?: number;
  custodian?: {
    type: 'INVENTORY_LOCATION' | 'WAREHOUSE';
    id: string;
    displayName: string;
  } | null;
}

export interface RequiredPreparationLineView {
  orderLineId: string;
  productId: string;
  productName: string;
  requiredQty: number;
  pickedQty: number;
  remainingQty: number;
}

export interface PreparationProgressView {
  required: number;
  picked: number;
  evidenceComplete: number;
  remaining?: number;
}

export interface PreparationPackageView {
  id: string;
  code: string;
  orderId: string;
  status: string;
  unitIds: string[];
  qrValue: string;
  version: number;
}

export interface PreparationTaskDetailResult {
  task: {
    id: string;
    orderId: string;
    status: string;
    assignee: PreparationAssigneeView | null;
    deadline: string | null;
    version: number;
  };
  requiredLines: RequiredPreparationLineView[];
  pickedUnits: PreparationUnitView[];
  progress: PreparationProgressView;
  package: PreparationPackageView | null;
  pendingTransfer: {
    id: string;
    status: string;
    toStaff: PreparationAssigneeView;
    requestedAt: string;
  } | null;
  pickupContext: {
    pointId: string;
    name: string;
    scheduledAt: string;
  };
  version: number;
}

export interface PaginatedPreparationTasksResult {
  items: Array<Record<string, unknown>>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface PickPreparationUnitsResult {
  pickedUnits: PreparationUnitView[];
  assignments: Array<{
    assignmentId: string;
    orderLineId: string;
    unitId: string;
  }>;
  progress: {
    required: number;
    picked: number;
    remaining: number;
  };
  taskVersion: number;
}

export interface ConditionSnapshotResult {
  id: string;
  orderId: string;
  unitId: string;
  stage: 'BEFORE';
  condition: string;
  notes: string | null;
  accessories: unknown;
  evidence: Array<{
    id: string;
    url: string | null;
    contentType: string | null;
  }>;
  createdAt: string;
  createdBy: string;
  version: number;
}

export interface PackPreparationPackageResult {
  package: PreparationPackageView;
  taskStatus: string;
  taskVersion: number;
}

export interface MarkPreparationReadyResult {
  taskId: string;
  taskStatus: string;
  orderStatus: string;
  deliveryTaskId: string;
  logisticsTaskId?: string;
  version: number;
}

export interface ReplacePreparationUnitResult {
  oldUnitId: string;
  newUnit: {
    id: string;
    productId: string;
    assetCode: string;
    physicalStatus: string;
    condition: string;
  };
  assignmentVersion: number;
  packageVersion: number | null;
  requiresNewEvidence: boolean;
  taskVersion: number;
}

export interface ClaimPreparationTaskResult {
  taskId: string;
  assignee: PreparationAssigneeView;
  version: number;
}

export interface RequestPreparationTransferResult {
  custodyTransferId: string;
  status: string;
  fromStaffId: string;
  toStaffId: string;
  packageId: string;
  taskVersion: number;
}

export interface PaginatedPreparationCandidatesResult {
  items: PreparationCandidateView[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export const PREPARATION_TASK_PORT = Symbol('PREPARATION_TASK_PORT');
export const WAREHOUSE_TASK_PORT = Symbol('WAREHOUSE_TASK_PORT');

export interface PreparationTaskPort {
  listTasks(query: ListPreparationTasksQuery): Promise<PaginatedPreparationTasksResult>;
  getTask(query: GetPreparationTaskQuery): Promise<PreparationTaskDetailResult>;
  pickUnits(command: PickPreparationUnitsCommand): Promise<PickPreparationUnitsResult>;
  savePreHandoverCondition(command: SavePreHandoverConditionCommand): Promise<ConditionSnapshotResult>;
  packPackage(command: PackPreparationPackageCommand): Promise<PackPreparationPackageResult>;
  markReady(command: MarkPreparationReadyCommand): Promise<MarkPreparationReadyResult>;
  replaceUnit(command: ReplacePreparationUnitCommand): Promise<ReplacePreparationUnitResult>;
  claimTask(command: ClaimPreparationTaskCommand): Promise<ClaimPreparationTaskResult>;
  requestTransfer(command: RequestPreparationTransferCommand): Promise<RequestPreparationTransferResult>;
  listReplacementCandidates(query: ListReplacementCandidatesQuery): Promise<PaginatedPreparationCandidatesResult>;
  listPickCandidates(query: ListPickCandidatesQuery): Promise<PaginatedPreparationCandidatesResult>;
}
