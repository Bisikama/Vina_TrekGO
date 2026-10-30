/** Delivery observation only, not a FINAL condition decision. */
export type ReturnOutcome = 'OBSERVED_RECEIVED' | 'OBSERVED_ISSUE';

export interface ReturnScanCommand {
  actorUserId: string;
  orderId: string;
  assetCodes: string[];
  operationId: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface ReturnInspectionItemInput {
  unitId: string;
  outcome: ReturnOutcome;
  condition?: 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'LOST'; // observation only
  accessoryIssues: string[];
  notes?: string;
  evidenceIds: string[];
}

export interface ReturnInspectionCommand {
  actorUserId: string;
  orderId: string;
  items: ReturnInspectionItemInput[];
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface ReturnToInventoryLocationCommand {
  actorUserId: string;
  deliveryTaskId: string;
  unitIds: string[];
  /** Units accepted from the customer but lost while held by delivery staff. */
  missingInCustodyUnitIds: string[];
  incidentNote?: string;
  packageId?: string;
  pendingTransferId?: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface ReceiveReturnCommand {
  actorUserId: string;
  returnId: string;
  pendingTransferId: string;
  inventoryLocationId: string;
  scannedUnitIds: string[];
  /** Required when the warehouse acknowledges fewer units than the transfer declares. */
  incidentNote?: string;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface FinalInspectionDamageInput {
  ruleId: string;
  quantity?: number;
  notes?: string;
  evidenceIds?: string[];
}

export interface FinalInspectionItemInput {
  issueUnitId: string; // internal field; canonical API accepts unitId
  outcome?: 'PASS' | 'ISSUE';
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'LOST';
  damage: FinalInspectionDamageInput[];
  evidenceIds: string[];
  notes?: string;
}

export interface FinalInspectionCommand {
  actorUserId: string;
  returnId: string;
  items: FinalInspectionItemInput[];
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface CreateDepositSettlementCommand {
  actorUserId: string;
  orderId: string;
  assessmentId: string;
  approvalRef: string;
  idempotencyKey: string;
  now: Date;
}

export interface GetDepositQuery { actorUserId: string; orderId: string; }

export interface FinalizeReturnOutcomeInput {
  unitId: string;
  outcome: 'NORMAL' | 'DAMAGED' | 'LOST';
}

export interface FinalizeReturnCommand {
  actorUserId: string;
  returnId: string;
  unitOutcomes: FinalizeReturnOutcomeInput[];
  inspectionVersion: number;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface CreateAssessmentReviewCommand {
  actorUserId: string;
  orderId: string;
  assessmentId: string;
  reason: string;
  evidenceIds: string[];
  idempotencyKey: string;
  now: Date;
}

export type ExceptionDecision = 'APPROVE_DEDUCTION' | 'REJECT_DEDUCTION' | 'CONFIRM_LOST' | 'CLOSE_NO_ACTION';
export interface ResolveExceptionCommand {
  actorUserId: string;
  exceptionId: string;
  decision: ExceptionDecision;
  reason: string;
  assessmentVersion?: number;
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface MarkUnitReadyCommand {
  actorUserId: string;
  unitId: string;
  inspectionId?: string;
  accessoriesChecked: boolean;
  expectedVersion: number;
  gradeDecision?: {
    decision: 'KEEP' | 'DOWNGRADE';
    reason?: string;
    note?: string;
    evidenceIds?: string[];
  };
  idempotencyKey: string;
  now: Date;
}

export interface ListExceptionsQuery {
  actorUserId: string;
  actorRole: string;
  type?: string;
  status?: string;
  assignee?: string;
  page: number;
  pageSize: number;
}

export interface ListReturnsQuery {
  actorUserId: string;
  status?: string;
  page: number;
  pageSize: number;
}

export interface GetReturnQuery { actorUserId: string; actorRole: string; returnId: string; }
export interface GetExceptionQuery { actorUserId: string; actorRole: string; exceptionId: string; }
export interface GetAssessmentQuery { actorUserId: string; orderId: string; }

export interface RentalRefundEventCommand {
  eventId: string;
  refundRef: string;
  rentalOrderId: string;
  component: string;
  componentRef?: string;
  amount: number;
  currency: string;
  status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  reason?: string;
  occurredAt: Date;
  correlationId: string;
}

export interface FinalizeReturnReceiptCommand {
  actorUserId: string;
  actorRole?: string;
  orderId: string;
  returnSessionId: string;
  remarks?: string;
  userRemarks?: string;
  failureEvidenceId?: string;
  evidenceIds?: string[];
  expectedVersion: number;
  idempotencyKey: string;
  now: Date;
}

export interface ListRentalDocumentsQuery {
  orderId: string;
  actorUserId: string;
  actorRole?: string;
  type?: any;
  page?: number;
  pageSize?: number;
}

export interface GetRentalDocumentQuery {
  documentId: string;
  actorUserId: string;
  actorRole?: string;
  expectedOrderId?: string;
}

export const RENTAL_RETURN_PORT = Symbol('RENTAL_RETURN_PORT');

export interface RentalReturnPort {
  returnScan(command: ReturnScanCommand): Promise<any>;
  returnInspection(command: ReturnInspectionCommand): Promise<any>;
  returnToInventoryLocation(command: ReturnToInventoryLocationCommand): Promise<any>;
  receiveReturn(command: ReceiveReturnCommand): Promise<any>;
  finalInspection(command: FinalInspectionCommand): Promise<any>;
  createDepositSettlement(command: CreateDepositSettlementCommand): Promise<any>;
  getDeposit(query: GetDepositQuery): Promise<any>;
  finalizeReturn(command: FinalizeReturnCommand): Promise<any>;
  createAssessmentReview(command: CreateAssessmentReviewCommand): Promise<any>;
  resolveException(command: ResolveExceptionCommand): Promise<any>;
  markUnitReady(command: MarkUnitReadyCommand): Promise<any>;
  listExceptions(query: ListExceptionsQuery): Promise<any>;
  listReturns(query: ListReturnsQuery): Promise<any>;
  getReturn(query: GetReturnQuery): Promise<any>;
  getException(query: GetExceptionQuery): Promise<any>;
  getAssessment(query: GetAssessmentQuery): Promise<any>;
  processRefundEvent(command: RentalRefundEventCommand): Promise<any>;
  finalizeReturnReceipt(command: FinalizeReturnReceiptCommand): Promise<any>;
  listRentalDocuments(query: ListRentalDocumentsQuery): Promise<any>;
  getRentalDocument(query: GetRentalDocumentQuery): Promise<any>;
}
