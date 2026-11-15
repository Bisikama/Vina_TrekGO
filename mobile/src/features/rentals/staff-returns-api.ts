import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiRequest } from "@/lib/api-client";

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
  tripTitle?: string | null;
  customerName?: string | null;
  status: ReturnQueueStatus;
  normalCount: number;
  issueCount: number;
  missingCount: number;
  /** Số món giao hàng báo có vấn đề khi nhận từ khách. */
  deliveryReportedIssueCount?: number;
  /** Số lỗi nhân viên giao ghi lúc GIAO đồ cho khách (biên bản bàn giao). */
  handoverReportedIssueCount?: number;
  /** Số món đã vào kho nhưng chưa kiểm định cuối. */
  pendingInspectionCount?: number;
  scheduledAt: string | null;
  version: number;
};

/** Giai đoạn của từng thiết bị theo góc nhìn kho (backend tính, RB-API-614 `units[].stage`). */
export type ReturnUnitStage =
  | "MISSING"
  | "AWAITING_RECEIPT"
  | "AWAITING_FINAL_INSPECTION"
  | "AWAITING_ADMIN"
  | "WAITING_CLEANING"
  | "READY"
  | "CLOSED_DAMAGED"
  | "CLOSED_LOST";

/** Một dòng "lỗi ghi nhận khi giao" trong biên bản bàn giao (RB-API-404). */
export type HandoverReportedIssue = { type: string; description: string };

export type StaffReturnUnit = {
  unitId: string;
  assetCode: string | null;
  productId: string | null;
  productName: string | null;
  assignmentStatus: string;
  unitStatus: string | null;
  unitCondition: string | null;
  unitVersion: number | null;
  stage: ReturnUnitStage;
  /** Bắt buộc ít nhất 1 ảnh khi kiểm định cuối (đúng quy tắc backend RB-API-605). */
  evidenceRequired: boolean;
  requiresDeepInspection: boolean;
  returnedAt: string | null;
  inventoryReceivedAt: string | null;
  inspectionDueAt: string | null;
  deliveryObservation: {
    outcome: "NORMAL" | "ISSUE" | string;
    /** null: ghi nhận cũ, trước khi backend lưu chi tiết này. */
    visibleDamage: boolean | null;
    accessoryObservations: string[];
    notes: string | null;
    evidenceIds: string[];
    observedAt: string | null;
  } | null;
  handoverBaseline: {
    condition: string;
    accessories: unknown;
    notes: string | null;
    evidenceIds: string[];
  } | null;
  /** Lỗi nhân viên giao ghi lúc GIAO món này cho khách: có từ trước kỳ thuê, không được trừ cọc. */
  handoverReportedIssues?: HandoverReportedIssue[];
  finalInspection: ReturnInspection | null;
  deposit: { status: string; depositAmount: number; deductionAmount: number; refundAmount: number } | null;
  exceptionCase: { id: string; caseType: string; status: string; reason: string } | null;
};

export type StaffReturnSummaryCounts = {
  totalUnits: number;
  queueStatus: ReturnQueueStatus;
  deliveryReportedIssueCount: number;
  handoverReportedIssueCount?: number;
  /** Lỗi ghi lúc giao nhưng không gắn với món cụ thể. */
  handoverOrderLevelIssues?: HandoverReportedIssue[];
  handedOverAt?: string | null;
  evidenceRequiredPendingCount: number;
  stageCounts: Record<ReturnUnitStage, number>;
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
  tripTitle?: string | null;
  customerName?: string | null;
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
    unitCondition: "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "LOST";
    unitVersion: number;
  }[];
  receivedUnits: { unitId: string; assetCode: string; receivedAt: string }[];
  missingUnits: { unitId: string; assetCode: string }[];
  inspection: {
    unitId: string;
    preliminary: ReturnInspection | null;
    final: ReturnInspection | null;
  }[];
  /** Thông tin gom sẵn cho từng thiết bị (backend mới). */
  units?: StaffReturnUnit[];
  summary?: StaffReturnSummaryCounts;
};

export type DamageAssessmentRule = {
  id: string;
  ruleCode: string;
  productId: string;
  name: string;
  severity: string;
  requiresApproval: boolean;
};

export type FinalInspectionInput = {
  unitId: string;
  outcome: "PASS" | "ISSUE";
  condition: "NEW" | "GOOD" | "FAIR" | "DAMAGED";
  damage: {
    ruleId: string;
    quantity: number;
    notes?: string;
    evidenceIds: string[];
  }[];
  evidenceIds: string[];
  notes?: string;
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

async function operationKey(scope: string, id: string, version: number) {
  const storageKey = `@trekgo/return:${scope}:${id}:${version}`;
  const stored = await AsyncStorage.getItem(storageKey);
  if (stored) return stored;
  const value = `${scope}-${id}-${version}-${Date.now()}`;
  await AsyncStorage.setItem(storageKey, value);
  return value;
}

async function mutate<T>(
  path: string,
  scope: string,
  id: string,
  version: number,
  body: Record<string, unknown>,
  accessToken: string,
) {
  const idempotencyKey = await operationKey(scope, id, version);
  const response = await apiRequest<Envelope<T>>(path, {
    method: "POST",
    accessToken,
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  return unwrap(response);
}

export const staffReturnsApi = {
  async list(accessToken: string, status?: ReturnQueueStatus) {
    const params = new URLSearchParams({ page: "1", pageSize: "100" });
    if (status) params.set("status", status);
    const response = await apiRequest<Envelope<Paginated<StaffReturnSummary>>>(
      `/api/v1/staff/returns?${params.toString()}`,
      { method: "GET", accessToken },
    );
    return unwrap(response);
  },

  async get(returnId: string, accessToken: string) {
    const response = await apiRequest<Envelope<StaffReturnDetail>>(
      `/api/v1/staff/returns/${encodeURIComponent(returnId)}`,
      { method: "GET", accessToken },
    );
    return unwrap(response);
  },

  async rules(accessToken: string, productId?: string) {
    const suffix = productId ? `?productId=${encodeURIComponent(productId)}` : "";
    const response = await apiRequest<Envelope<{ items: DamageAssessmentRule[] }>>(
      `/api/v1/staff/damage-assessment-rules${suffix}`,
      { method: "GET", accessToken },
    );
    return unwrap(response).items;
  },

  async receive(
    detail: StaffReturnDetail,
    scannedUnitIds: string[],
    incidentNote: string | undefined,
    accessToken: string,
  ) {
    if (!detail.pendingTransfer) throw new Error("Task chưa có yêu cầu bàn giao về kho.");
    return mutate(
      `/api/v1/staff/returns/${encodeURIComponent(detail.id)}/receive`,
      "receive",
      detail.id,
      detail.version,
      {
        pendingTransferId: detail.pendingTransfer.id,
        inventoryLocationId: detail.pendingTransfer.inventoryLocationId,
        scannedUnitIds,
        incidentNote: incidentNote?.trim() || undefined,
        expectedVersion: detail.version,
      },
      accessToken,
    );
  },

  async inspect(
    detail: StaffReturnDetail,
    items: FinalInspectionInput[],
    accessToken: string,
  ) {
    return mutate<{
      assessments: { inspectionId: string; unitId: string; outcome: string; version: number }[];
      issues: { inspectionId: string; unitId: string; outcome: string; version: number }[];
    }>(
      `/api/v1/staff/returns/${encodeURIComponent(detail.id)}/final-inspection`,
      "final-inspection",
      detail.id,
      detail.version,
      { items, expectedVersion: detail.version },
      accessToken,
    );
  },

  async finalizeNormal(
    detail: StaffReturnDetail,
    items: { unitId: string; inspectionVersion: number }[],
    accessToken: string,
  ) {
    if (!items.length) return null;
    const versions = new Set(items.map((item) => item.inspectionVersion));
    if (versions.size !== 1) throw new Error("Các kiểm định không cùng phiên bản. Hãy tải lại task.");
    return mutate(
      `/api/v1/staff/returns/${encodeURIComponent(detail.id)}/finalize`,
      "finalize",
      detail.id,
      detail.version,
      {
        unitOutcomes: items.map((item) => ({ unitId: item.unitId, outcome: "NORMAL" })),
        inspectionVersion: items[0].inspectionVersion,
        expectedVersion: detail.version,
      },
      accessToken,
    );
  },

  async markReady(
    input: {
      unitId: string;
      inspectionId: string;
      expectedVersion: number;
      /** Bắt buộc với sản phẩm có hạng; không gửi với sản phẩm thường. */
      gradeDecision?: { decision: "KEEP" } | { decision: "DOWNGRADE"; reason: string };
    },
    accessToken: string,
  ) {
    return mutate<{
      gradeReview: { decision: "KEEP" | "DOWNGRADE"; shortageOrderIds: string[] } | null;
    }>(
      `/api/v1/staff/equipment-units/${encodeURIComponent(input.unitId)}/ready`,
      // Body khác (có/không gradeDecision) phải dùng khoá idempotency khác.
      input.gradeDecision ? `ready-${input.gradeDecision.decision.toLowerCase()}` : "ready",
      input.unitId,
      input.expectedVersion,
      {
        inspectionId: input.inspectionId,
        accessoriesChecked: true,
        expectedVersion: input.expectedVersion,
        ...(input.gradeDecision ? { gradeDecision: input.gradeDecision } : {}),
      },
      accessToken,
    );
  },
};
