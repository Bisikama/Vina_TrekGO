import axios from "axios";

import { apiClient } from "@/lib/axios";

type Envelope<T> = { data: T };
type Paginated<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

export type DeliveryTaskType = "OUTBOUND" | "RETURN";
export type DeliveryTaskStatus =
  | "SCHEDULED"
  | "PACKAGE_RECEIVED"
  | "RECIPIENT_VERIFIED"
  | "HANDED_OVER"
  | "COLLECTING"
  | "RETURNED"
  | "INVENTORY_RECEIVED"
  | "NO_SHOW"
  | "REFUSED"
  | "CLOSED"
  | "BLOCKED"
  | "CANCELLED";

type Recipient = { displayName?: string; fullName?: string; name?: string; phone?: string };

/**
 * Task thu hồi gắn với lịch trả đồ sớm của khách. `RECONFIRM_REQUIRED`: chuyến đổi lịch,
 * giờ sớm tạm mất hiệu lực cho tới khi kho xác nhận lại.
 */
export type DeliveryTaskEarlyReturn = {
  requestId: string;
  status: "CONFIRMED" | "RECONFIRM_REQUIRED";
  slotAt: string;
};

export type DeliveryTaskSummary = {
  id: string;
  type: DeliveryTaskType;
  status: DeliveryTaskStatus;
  scheduledAt: string | null;
  earlyReturn?: DeliveryTaskEarlyReturn | null;
  point: { id: string; name: string; address?: string | null };
  package: { id: string; code: string; status: string } | null;
  orderSummary: {
    orderId: string;
    bookingId?: string | null;
    tripId: string;
    orderStatus: string;
    recipient?: Recipient | null;
  };
  version: number;
  allowedActions: string[];
};

export type DeliveryTaskUnit = {
  unitId: string;
  assetCode: string;
  product?: { id?: string; name?: string } | null;
  condition?: string;
  physicalStatus?: string;
  assignmentStatus?: string;
};

export type DeliveryTaskDetail = {
  task: {
    id: string;
    type: DeliveryTaskType;
    status: DeliveryTaskStatus;
    assignee: { id: string; displayName: string } | null;
    scheduledAt: string | null;
    earlyReturn?: DeliveryTaskEarlyReturn | null;
    point: { id: string; name: string; address?: string | null };
    version: number;
    allowedActions: string[];
  };
  package: { id: string; code: string; status: string; version: number } | null;
  custodyTransfer: { id: string; status: string; requestedAt: string } | null;
  units: DeliveryTaskUnit[];
  recipient?: Recipient | null;
  verificationStatus?: Record<string, unknown> | null;
};

export type RentalOrderForDelivery = {
  order: {
    id: string;
    version: number;
    status: string;
    trip?: { title?: string | null; startAt?: string | null; endAt?: string | null; type?: string | null } | null;
  };
  /** Mốc tiến trình đơn: ORDER_CREATED, PAID, PACKED, HANDED_OVER, RETURNED, CLOSED, CANCELLED, COMPLETED. */
  timeline?: { type: string; at: string }[];
};

export type ReturnScanResult = {
  returnId: string;
  returnSessionId: string;
  receivedUnits: { unitId: string; assetCode: string; receivedAt: string; duplicate: boolean }[];
  missingUnits: { unitId: string; assetCode: string }[];
  duplicates: string[];
  version: number;
  taskVersion: number;
};

export type NoShowReason =
  | "USER_NO_SHOW"
  | "USER_CHANGED_MIND"
  | "USER_REFUSED_DISCLOSED_CONDITION"
  | "SYSTEM_WRONG_EQUIPMENT"
  | "SYSTEM_DAMAGED_EQUIPMENT"
  | "SYSTEM_MISSING_EQUIPMENT";

function unwrap<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as Envelope<T>).data;
  }
  return payload as T;
}

function key(operation: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${operation}-${suffix}`;
}

function idempotency(operation: string) {
  return { headers: { "Idempotency-Key": key(operation) } };
}

export async function listDeliveryTasks(options?: { type?: DeliveryTaskType; signal?: AbortSignal }) {
  const response = await apiClient.get<Envelope<Paginated<DeliveryTaskSummary>>>("/api/v1/delivery/tasks", {
    params: { type: options?.type, page: 1, pageSize: 100 },
    signal: options?.signal,
  });
  return unwrap<Paginated<DeliveryTaskSummary>>(response.data);
}

export async function getDeliveryTask(taskId: string, signal?: AbortSignal) {
  const response = await apiClient.get<Envelope<DeliveryTaskDetail>>(
    `/api/v1/delivery/tasks/${encodeURIComponent(taskId)}`,
    { signal },
  );
  return unwrap<DeliveryTaskDetail>(response.data);
}

export async function getRentalOrderForDelivery(orderId: string, signal?: AbortSignal) {
  const response = await apiClient.get<Envelope<RentalOrderForDelivery>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}`,
    { signal },
  );
  return unwrap<RentalOrderForDelivery>(response.data);
}

export async function claimDeliveryTask(taskId: string, expectedVersion: number) {
  await apiClient.post(
    `/api/v1/delivery/tasks/${encodeURIComponent(taskId)}/claim`,
    { expectedVersion },
    idempotency("claim-delivery"),
  );
}

export async function receiveDeliveryPackage(
  taskId: string,
  input: { custodyTransferId: string; packageCode: string; expectedVersion: number },
) {
  await apiClient.post(
    `/api/v1/delivery/tasks/${encodeURIComponent(taskId)}/receive-package`,
    input,
    idempotency("receive-package"),
  );
}

export async function verifyDeliveryRecipient(taskId: string, input: { pickupCode: string; expectedVersion: number }) {
  const response = await apiClient.post<Envelope<{ verificationRef: string; expiresAt: string; taskVersion: number }>>(
    `/api/v1/delivery/tasks/${encodeURIComponent(taskId)}/verify-user`,
    input,
    idempotency("verify-recipient"),
  );
  return unwrap<{ verificationRef: string; expiresAt: string; taskVersion: number }>(response.data);
}

export async function commitRentalHandover(
  orderId: string,
  input: {
    packageId: string;
    verificationRef: string;
    recipientNotes?: string;
    reportedIssues: { unitId: string; type: string; description: string }[];
    expectedVersion: number;
  },
) {
  await apiClient.post(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/handover`,
    input,
    idempotency("commit-handover"),
  );
}

export async function markRentalNoShow(
  orderId: string,
  input: { reason: NoShowReason; notes?: string; evidenceIds: string[]; expectedVersion: number },
) {
  await apiClient.post(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/no-show`,
    input,
    idempotency("mark-no-show"),
  );
}

export async function scanRentalReturn(orderId: string, input: { assetCodes: string[]; expectedVersion: number }) {
  const response = await apiClient.post<Envelope<ReturnScanResult>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/return-scan`,
    { ...input, operationId: key("return-scan-op") },
    idempotency("return-scan"),
  );
  return unwrap<ReturnScanResult>(response.data);
}

export async function submitReturnObservations(
  orderId: string,
  input: {
    items: { unitId: string; visibleDamage: boolean; accessoryObservations: string[]; notes?: string; evidenceIds: string[] }[];
    expectedVersion: number;
  },
) {
  const response = await apiClient.post<Envelope<{ returnSessionId?: string | null }>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/return-observations`,
    input,
    idempotency("return-observations"),
  );
  return unwrap<{ returnSessionId?: string | null }>(response.data);
}

export async function finalizeReturnReceipt(
  orderId: string,
  input: { returnSessionId: string; expectedVersion: number; remarks?: string; evidenceIds: string[] },
) {
  await apiClient.post(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/return-receipts`,
    input,
    idempotency("return-receipt"),
  );
}

export async function transferReturnToInventory(
  returnTaskId: string,
  input: {
    unitIds: string[];
    missingInCustodyUnitIds: string[];
    incidentNote?: string;
    packageId?: string;
    expectedVersion: number;
  },
) {
  await apiClient.post(
    `/api/v1/delivery/tasks/${encodeURIComponent(returnTaskId)}/return-to-inventory-location`,
    input,
    idempotency("return-to-inventory"),
  );
}

/** Ảnh hiện trạng khi thu hồi đồ (scope RETURN_EVIDENCE, STAFF_DELIVERY được phép). */
export async function uploadReturnEvidence(file: File): Promise<string> {
  const intentResponse = await apiClient.post<unknown>("/api/v1/media/upload-intents", {
    scope: "RETURN_EVIDENCE",
    resourceType: "IMAGE",
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    captureSource: "CAMERA",
    clientCapturedAt: new Date().toISOString(),
  });
  const intent = unwrap<{
    mediaId: string;
    upload: { uploadUrl: string; method: string; formFields: Record<string, string | number> };
  }>(intentResponse.data);
  const formData = new FormData();
  Object.entries(intent.upload.formFields).forEach(([field, value]) => formData.append(field, String(value)));
  formData.append("file", file);
  const uploadResponse = await fetch(intent.upload.uploadUrl, { method: intent.upload.method || "POST", body: formData });
  if (!uploadResponse.ok) throw new Error("Không thể tải ảnh hiện trạng lên kho media.");
  const uploaded = (await uploadResponse.json()) as { public_id: string; version: number; signature: string };
  await apiClient.post(`/api/v1/media/${intent.mediaId}/complete`, {
    publicId: uploaded.public_id,
    version: uploaded.version,
    signature: uploaded.signature,
  });
  return intent.mediaId;
}

const deliveryErrorMessages: Record<string, string> = {
  LOGISTICS_TASK_NOT_FOUND: "Không tìm thấy nhiệm vụ, có thể đã bị hủy hoặc chuyển cho người khác.",
  TASK_ALREADY_ASSIGNED: "Nhiệm vụ này đã có nhân viên khác nhận.",
  LOGISTICS_TASK_NOT_CLAIMED: "Bạn cần nhận nhiệm vụ trước khi thao tác.",
  INVALID_LOGISTICS_TASK_STATE: "Nhiệm vụ đã chuyển sang bước khác. Hãy tải lại.",
  INVALID_RENTAL_STATE: "Đơn thuê không còn ở trạng thái cho phép thao tác này.",
  CUSTODY_MISMATCH: "Mã kiện không khớp với kiện kho đã bàn giao.",
  CUSTODY_TRANSFER_NOT_FOUND: "Kho chưa bàn giao kiện cho nhiệm vụ này.",
  PACKAGE_NOT_FOUND: "Không tìm thấy kiện hàng của đơn.",
  PACKAGE_INCOMPLETE: "Kiện hàng chưa đủ thiết bị.",
  PICKUP_CODE_INVALID_OR_EXPIRED: "Mã nhận hàng không đúng hoặc đã hết hạn. Nhờ khách mở lại mã mới trên app.",
  PICKUP_VERIFICATION_INVALID: "Xác minh người nhận không hợp lệ. Hãy xác minh lại.",
  PICKUP_VERIFICATION_EXPIRED: "Xác minh người nhận đã hết hạn. Hãy nhập lại mã nhận hàng.",
  PACKAGE_VERSION_CHANGED: "Kiện hàng vừa thay đổi. Hãy tải lại nhiệm vụ.",
  STALE_CONTEXT: "Dữ liệu đã cũ. Hãy tải lại nhiệm vụ.",
  VERSION_CONFLICT: "Dữ liệu vừa được cập nhật ở nơi khác. Hãy tải lại.",
  EVIDENCE_NOT_READY: "Ảnh hiện trạng chưa tải xong. Hãy tải lại ảnh.",
  OPERATION_CONFLICT: "Thao tác đang được xử lý. Đợi vài giây rồi tải lại.",
  RETURN_NOT_READY: "Đơn chưa bàn giao cho khách nên chưa thể thu hồi.",
  INVALID_RETURN_STATE: "Phiên thu hồi không còn ở bước này. Hãy tải lại.",
  UNIT_NOT_IN_RENTAL: "Có thiết bị không thuộc đơn thuê này.",
};

export function getDeliveryErrorMessage(error: unknown, fallback = "Không thể xử lý nhiệm vụ giao nhận.") {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
    if (error.response?.status === 403) return "Tài khoản hiện tại không có quyền giao nhận cho nhiệm vụ này.";
    const data = error.response?.data as { message?: string; error?: { code?: string; message?: string } } | undefined;
    const code = data?.error?.code;
    if (code && deliveryErrorMessages[code]) return deliveryErrorMessages[code];
    return data?.error?.message || data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
