import { apiClient } from "@/lib/axios";

type ApiEnvelope<T> = { data: T };
type Paginated<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

export type EquipmentCondition = "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "LOST";
export type PreparationTaskStatus =
  | "OPEN"
  | "PICKING"
  | "CONDITION_CAPTURED"
  | "PACKED"
  | "READY"
  | "TRANSFERRED"
  | "BLOCKED"
  | "CANCELLED";

export type PreparationTaskSummary = {
  id: string;
  type: "PREPARE_RENTAL";
  status: PreparationTaskStatus;
  orderId: string;
  orderCode: string;
  assignee: { id: string; displayName: string } | null;
  deadline: string | null;
  trip: { id: string };
  pickup: { id: string; name: string };
  inventoryLocation: { id: string; name: string };
  progress: { required: number; picked: number; remaining?: number };
  requiredLineSummary: Array<{
    productId: string;
    productName: string;
    quantity: number;
    pickedQty: number;
  }>;
  version: number;
  allowedActions: string[];
};

export type PreparationUnit = {
  unitId: string;
  productId: string;
  assetCode: string;
  condition: EquipmentCondition;
  physicalStatus: string;
  evidenceCaptured?: boolean;
};

export type PreparationPackage = {
  id: string;
  code: string;
  orderId: string;
  status: string;
  unitIds: string[];
  qrValue: string;
  version: number;
};

export type PreparationTaskDetail = {
  task: {
    id: string;
    orderId: string;
    status: PreparationTaskStatus;
    assignee: { id: string; displayName: string } | null;
    deadline: string | null;
    version: number;
  };
  requiredLines: Array<{
    orderLineId: string;
    productId: string;
    productName: string;
    requiredQty: number;
    pickedQty: number;
    remainingQty: number;
  }>;
  pickedUnits: PreparationUnit[];
  progress: { required: number; picked: number; evidenceComplete?: number };
  package: PreparationPackage | null;
  pendingTransfer: {
    id: string;
    status: string;
    toStaff: { id: string; displayName: string };
    requestedAt: string;
  } | null;
  pickupContext: { pointId: string; name: string; scheduledAt: string };
  version: number;
};

export type PreparationCandidate = {
  id: string;
  productId: string;
  assetCode: string;
  condition: EquipmentCondition;
  physicalStatus: string;
  location: string | null;
  expectedReadyAt?: string | null;
  version?: number;
};

export type RentalAssignee = {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role: "STAFF_DELIVERY" | "STAFF_INVENTORY";
  activeTaskCount: number;
  isCurrentAssignee: boolean;
};

function unwrap<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

function idempotencyHeaders(operation: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { "Idempotency-Key": `${operation}-${suffix}` };
}

export async function getPreparationTasks(options?: {
  status?: PreparationTaskStatus;
  tripId?: string;
  pageSize?: number;
  signal?: AbortSignal;
}) {
  const response = await apiClient.get<unknown>("/api/v1/inventory/tasks", {
    params: { status: options?.status, tripId: options?.tripId, page: 1, pageSize: options?.pageSize ?? 100 },
    signal: options?.signal,
  });
  return unwrap<Paginated<PreparationTaskSummary>>(response.data);
}

export async function getPreparationTask(taskId: string, signal?: AbortSignal) {
  const response = await apiClient.get<unknown>(`/api/v1/inventory/tasks/${encodeURIComponent(taskId)}`, { signal });
  return unwrap<PreparationTaskDetail>(response.data);
}

export async function claimPreparationTask(taskId: string, expectedVersion: number) {
  const response = await apiClient.post<unknown>(
    `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/claim`,
    { expectedVersion },
    { headers: idempotencyHeaders("claim-preparation") },
  );
  return unwrap<{ taskId: string; version: number }>(response.data);
}

export async function getPreparationPickCandidates(
  taskId: string,
  options?: { productId?: string; q?: string; signal?: AbortSignal },
) {
  const response = await apiClient.get<unknown>(
    `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/pick-candidates`,
    { params: { productId: options?.productId, q: options?.q?.trim() || undefined, page: 1, pageSize: 100 }, signal: options?.signal },
  );
  return unwrap<Paginated<PreparationCandidate>>(response.data);
}

export async function pickPreparationUnits(
  taskId: string,
  input: { assetCodes: string[]; expectedVersion: number },
) {
  const response = await apiClient.post<unknown>(
    `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/pick`,
    input,
    { headers: idempotencyHeaders("pick-preparation") },
  );
  return unwrap<{ taskVersion: number }>(response.data);
}

export async function uploadConditionEvidence(file: File): Promise<string> {
  const intentResponse = await apiClient.post<unknown>("/api/v1/media/upload-intents", {
    scope: "CONDITION_EVIDENCE",
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
  Object.entries(intent.upload.formFields).forEach(([key, value]) => formData.append(key, String(value)));
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

export async function savePreparationCondition(
  taskId: string,
  input: { unitId: string; condition: EquipmentCondition; notes?: string; evidenceIds: string[]; expectedVersion: number },
) {
  const response = await apiClient.post<unknown>(
    `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/condition-snapshots`,
    input,
    { headers: idempotencyHeaders("condition-preparation") },
  );
  return unwrap<{ version: number }>(response.data);
}

export async function packPreparationTask(
  taskId: string,
  input: { unitIds: string[]; expectedVersion: number },
) {
  const response = await apiClient.post<unknown>(
    `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/pack`,
    input,
    { headers: idempotencyHeaders("pack-preparation") },
  );
  return unwrap<{ package: PreparationPackage; taskStatus: string; taskVersion: number }>(response.data);
}

export async function markPreparationReady(
  taskId: string,
  input: { packageId: string; expectedVersion: number },
) {
  const response = await apiClient.post<unknown>(
    `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/ready`,
    input,
    { headers: idempotencyHeaders("ready-preparation") },
  );
  return unwrap<{ taskId: string; taskStatus: string; orderStatus: string; deliveryTaskId: string; version: number }>(response.data);
}

export async function getRentalDeliveryAssignees(signal?: AbortSignal) {
  const response = await apiClient.get<unknown>("/api/v1/staff/rental-assignees", {
    params: { role: "STAFF_DELIVERY", page: 1, pageSize: 100 },
    signal,
  });
  return unwrap<Paginated<RentalAssignee>>(response.data);
}

export async function requestPreparationTransfer(
  taskId: string,
  input: { packageId: string; toStaffId: string; expectedVersion: number },
) {
  const response = await apiClient.post<unknown>(
    `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/transfer-request`,
    input,
    { headers: idempotencyHeaders("transfer-preparation") },
  );
  return unwrap<{ custodyTransferId: string; status: string; toStaffId: string; packageId: string; taskVersion: number }>(response.data);
}
