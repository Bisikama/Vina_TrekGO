import axios from "axios";

import { apiClient } from "@/lib/axios";

type Envelope<T> = T | { data: T };

export type ReturnQueueStatus =
  | "TRANSFER_PENDING"
  | "INVENTORY_RECEIVED"
  | "WAITING_CLEANING"
  | "REVIEW_REQUIRED"
  | "COMPLETED";

export type StaffReturnSummary = {
  id: string;
  orderId: string;
  status: ReturnQueueStatus;
  normalCount: number;
  issueCount: number;
  missingCount: number;
  scheduledAt: string | null;
  version: number;
};

export type ReturnInspection = {
  id: string;
  stage: "PRELIMINARY" | "FINAL";
  outcome: string;
  notes?: string | null;
  evidenceIds: string[];
  version: number;
  findings: { ruleId: string; amount: number; quantity: number }[];
};

export type StaffReturnDetail = {
  id: string;
  orderId: string;
  status: string;
  version: number;
  pendingTransfer: {
    id: string;
    inventoryLocationId: string;
    inventoryLocationName: string;
    unitIds: string[];
    receivedUnitIds: string[];
    status: string;
    version: number;
  } | null;
  expectedUnits: {
    unitId: string;
    assetCode: string;
    productId: string;
    productName: string;
    assignmentStatus: string;
    unitStatus: string;
    unitCondition: string;
    unitVersion: number;
  }[];
  receivedUnits: { unitId: string; assetCode: string; receivedAt: string }[];
  missingUnits: { unitId: string; assetCode: string }[];
  inspection: {
    unitId: string;
    preliminary: ReturnInspection | null;
    final: ReturnInspection | null;
  }[];
  depositActions: {
    unitId: string;
    status: string;
    depositAmount: number;
    deductionAmount: number;
    refundAmount: number;
  }[];
  beforeEvidence: {
    unitId: string;
    condition: string;
    accessories: unknown;
    evidenceIds: string[];
  }[];
};

export type DamageAssessmentRule = {
  id: string;
  ruleCode: string;
  productId: string;
  name: string;
  description: string | null;
  severity: string;
  formulaType: string;
  value: number;
  requiresApproval: boolean;
  versionNo: number;
};

type Paginated<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function key(prefix: string, entityId: string, version: number) {
  return `${prefix}-${entityId}-${version}-${Date.now()}`;
}

export function getStaffReturnErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; error?: { message?: string; code?: string } }
      | undefined;
    return data?.error?.message || data?.message || error.message;
  }
  return error instanceof Error ? error.message : "Không thể xử lý yêu cầu hoàn trả.";
}

export async function listStaffReturns(status?: ReturnQueueStatus, signal?: AbortSignal) {
  const response = await apiClient.get<Envelope<Paginated<StaffReturnSummary>>>(
    "/api/v1/staff/returns",
    { params: { page: 1, pageSize: 100, status }, signal },
  );
  return unwrap(response.data);
}

export async function getStaffReturn(returnId: string, signal?: AbortSignal) {
  const response = await apiClient.get<Envelope<StaffReturnDetail>>(
    `/api/v1/staff/returns/${encodeURIComponent(returnId)}`,
    { signal },
  );
  return unwrap(response.data);
}

export async function receiveStaffReturn(detail: StaffReturnDetail) {
  if (!detail.pendingTransfer) throw new Error("Task chưa có yêu cầu bàn giao về kho.");
  const pendingUnitIds = detail.pendingTransfer.unitIds.filter(
    (unitId) => !detail.pendingTransfer?.receivedUnitIds.includes(unitId),
  );
  if (!pendingUnitIds.length) throw new Error("Không còn thiết bị chờ kho xác nhận.");
  const response = await apiClient.post<Envelope<unknown>>(
    `/api/v1/staff/returns/${encodeURIComponent(detail.id)}/receive`,
    {
      pendingTransferId: detail.pendingTransfer.id,
      inventoryLocationId: detail.pendingTransfer.inventoryLocationId,
      scannedUnitIds: pendingUnitIds,
      expectedVersion: detail.version,
    },
    { headers: { "Idempotency-Key": key("receive-return", detail.id, detail.version) } },
  );
  return unwrap(response.data);
}

export async function listDamageAssessmentRules(productId?: string) {
  const response = await apiClient.get<Envelope<{ items: DamageAssessmentRule[] }>>(
    "/api/v1/staff/damage-assessment-rules",
    { params: { productId } },
  );
  return unwrap(response.data).items;
}

export type FinalInspectionInput = {
  unitId: string;
  outcome: "PASS" | "ISSUE";
  condition: "NEW" | "GOOD" | "FAIR" | "DAMAGED";
  damage: { ruleId: string; quantity: number; notes?: string; evidenceIds: string[] }[];
  evidenceIds: string[];
  notes?: string;
};

export async function submitFinalInspection(
  returnId: string,
  expectedVersion: number,
  items: FinalInspectionInput[],
) {
  const response = await apiClient.post<
    Envelope<{
      assessments: { inspectionId: string; unitId: string; outcome: string; version: number }[];
      issues: { inspectionId: string; unitId: string; outcome: string; version: number }[];
    }>
  >(
    `/api/v1/staff/returns/${encodeURIComponent(returnId)}/final-inspection`,
    { items, expectedVersion },
    { headers: { "Idempotency-Key": key("final-inspection", returnId, expectedVersion) } },
  );
  return unwrap(response.data);
}

export async function finalizeNormalReturnUnits(
  returnId: string,
  expectedVersion: number,
  items: { unitId: string; inspectionVersion: number }[],
) {
  if (!items.length) return null;
  const versions = new Set(items.map((item) => item.inspectionVersion));
  if (versions.size !== 1) throw new Error("Các bản kiểm định không cùng phiên bản; hãy tải lại task.");
  const response = await apiClient.post<Envelope<unknown>>(
    `/api/v1/staff/returns/${encodeURIComponent(returnId)}/finalize`,
    {
      unitOutcomes: items.map((item) => ({ unitId: item.unitId, outcome: "NORMAL" })),
      inspectionVersion: items[0].inspectionVersion,
      expectedVersion,
    },
    { headers: { "Idempotency-Key": key("finalize-return", returnId, expectedVersion) } },
  );
  return unwrap(response.data);
}

export async function markReturnedUnitReady(input: {
  unitId: string;
  inspectionId: string;
  expectedVersion: number;
}) {
  const response = await apiClient.post<Envelope<unknown>>(
    `/api/v1/staff/equipment-units/${encodeURIComponent(input.unitId)}/ready`,
    {
      inspectionId: input.inspectionId,
      accessoriesChecked: true,
      expectedVersion: input.expectedVersion,
    },
    {
      headers: {
        "Idempotency-Key": key("returned-unit-ready", input.unitId, input.expectedVersion),
      },
    },
  );
  return unwrap(response.data);
}

export type RentalExceptionSummary = {
  id: string;
  orderId: string;
  order: {
    id: string;
    bookingId: string | null;
    tripId: string;
    tripTitle: string;
    customerName: string;
    exceptionStatus: string;
  };
  unit: { id: string; assetCode: string } | null;
  type: string;
  status: string;
  reason: string;
  dueAt: string | null;
  version: number;
};

export type RentalExceptionDetail = {
  case: RentalExceptionSummary & { resolution?: string | null; approvalRef?: string | null };
  assessment: ReturnInspection | null;
  refund: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    reconcileStatus: string;
    retryCount: number;
    lastErrorCode: string | null;
    lastCheckedAt: string | null;
  } | null;
  evidence: string[];
  reviews: { id: string; reason: string; evidenceIds: string[]; createdAt: string }[];
};

export async function listRentalExceptions() {
  const response = await apiClient.get<Envelope<Paginated<RentalExceptionSummary>>>(
    "/api/v1/staff/rental-exceptions",
    { params: { page: 1, pageSize: 100 } },
  );
  return unwrap(response.data);
}

export async function getRentalException(exceptionId: string) {
  const response = await apiClient.get<Envelope<RentalExceptionDetail>>(
    `/api/v1/staff/rental-exceptions/${encodeURIComponent(exceptionId)}`,
  );
  return unwrap(response.data);
}

export async function resolveRentalException(input: {
  exceptionId: string;
  decision: "APPROVE_DEDUCTION" | "REJECT_DEDUCTION" | "CONFIRM_LOST" | "CLOSE_NO_ACTION";
  reason: string;
  assessmentVersion?: number;
  expectedVersion: number;
}) {
  const response = await apiClient.post<Envelope<{ resolution: string; nextAction: string; approvalRef: string }>>(
    `/api/v1/admin/rental-exceptions/${encodeURIComponent(input.exceptionId)}/resolve`,
    {
      decision: input.decision,
      reason: input.reason,
      assessmentVersion: input.assessmentVersion,
      expectedVersion: input.expectedVersion,
    },
    { headers: { "Idempotency-Key": key("resolve-return", input.exceptionId, input.expectedVersion) } },
  );
  return unwrap(response.data);
}

export async function reconcileRentalRefund(input: {
  refundId: string;
  reason: string;
}) {
  const response = await apiClient.post<
    Envelope<{ refundId: string; reconcileStatus: string }>
  >(
    `/api/v1/admin/refunds/${encodeURIComponent(input.refundId)}/reconcile`,
    { reason: input.reason },
  );
  return unwrap(response.data);
}

export async function approveDepositSettlement(input: {
  orderId: string;
  assessmentId: string;
  approvalRef: string;
  version: number;
}) {
  const response = await apiClient.post<
    Envelope<{
      settlement: { id?: string; status?: string; outcome?: string };
      refundRef: string | null;
      deductionAmount: number;
      refundAmount: number;
      status: string;
    }>
  >(
    `/api/v1/rental-orders/${encodeURIComponent(input.orderId)}/deposit-settlement`,
    { assessmentId: input.assessmentId, approvalRef: input.approvalRef },
    { headers: { "Idempotency-Key": key("deposit-settlement", input.assessmentId, input.version) } },
  );
  return unwrap(response.data);
}
