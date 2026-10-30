import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiRequest } from "@/lib/api-client";

type Envelope<T> = T | { data: T };

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
  tripTitle?: string | null;
  assignee: { id: string; displayName: string } | null;
  deadline: string | null;
  pickup: { id: string; name: string };
  inventoryLocation: { id: string; name: string };
  progress: { required: number; picked: number; remaining?: number };
  requiredLineSummary: {
    productId: string;
    productName: string;
    quantity: number;
    pickedQty: number;
  }[];
  version: number;
  allowedActions: string[];
};

export type PreparationUnit = {
  unitId: string;
  productId: string;
  assetCode: string;
  condition: "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "LOST";
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
  requiredLines: {
    orderLineId: string;
    productId: string;
    productName: string;
    requiredQty: number;
    pickedQty: number;
    remainingQty: number;
  }[];
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
  condition: PreparationUnit["condition"];
  physicalStatus: string;
  location: string | null;
};

export type RentalDeliveryAssignee = {
  id: string;
  displayName: string;
  email?: string | null;
  role: "STAFF_DELIVERY";
  activeTaskCount: number;
};

type Paginated<T> = {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

async function operationKey(
  operation: string,
  taskId: string,
  expectedVersion: number,
) {
  const storageKey = `@trekgo/inventory:${operation}:${taskId}:${expectedVersion}`;
  const stored = await AsyncStorage.getItem(storageKey);
  if (stored) return stored;

  const key = `${operation}-${taskId}-${expectedVersion}-${Date.now()}`;
  await AsyncStorage.setItem(storageKey, key);
  return key;
}

async function mutate<T>(
  path: string,
  operation: string,
  taskId: string,
  expectedVersion: number,
  body: Record<string, unknown>,
  accessToken: string,
) {
  const idempotencyKey = await operationKey(
    operation,
    taskId,
    expectedVersion,
  );
  const response = await apiRequest<Envelope<T>>(path, {
    method: "POST",
    accessToken,
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  return unwrap(response);
}

export const staffInventoryApi = {
  async listTasks(accessToken: string, status?: PreparationTaskStatus) {
    const response = await apiRequest<Envelope<Paginated<PreparationTaskSummary>>>(
      `/api/v1/inventory/tasks?${query({ status, page: 1, pageSize: 100 })}`,
      { method: "GET", accessToken },
    );
    return unwrap(response);
  },

  async getTask(taskId: string, accessToken: string) {
    const response = await apiRequest<Envelope<PreparationTaskDetail>>(
      `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}`,
      { method: "GET", accessToken },
    );
    return unwrap(response);
  },

  async claim(taskId: string, expectedVersion: number, accessToken: string) {
    return mutate<{ taskId: string; version: number }>(
      `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/claim`,
      "claim-preparation",
      taskId,
      expectedVersion,
      { expectedVersion },
      accessToken,
    );
  },

  async listCandidates(
    taskId: string,
    productId: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<Paginated<PreparationCandidate>>>(
      `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/pick-candidates?${query({ productId, page: 1, pageSize: 100 })}`,
      { method: "GET", accessToken },
    );
    return unwrap(response);
  },

  async pick(
    taskId: string,
    assetCodes: string[],
    expectedVersion: number,
    accessToken: string,
  ) {
    return mutate<{ taskVersion: number }>(
      `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/pick`,
      "pick-preparation",
      taskId,
      expectedVersion,
      { assetCodes, expectedVersion },
      accessToken,
    );
  },

  async saveCondition(
    taskId: string,
    input: {
      unitId: string;
      condition: PreparationUnit["condition"];
      notes?: string;
      evidenceIds: string[];
      expectedVersion: number;
    },
    accessToken: string,
  ) {
    return mutate<{ version: number }>(
      `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/condition-snapshots`,
      `condition-${input.unitId}`,
      taskId,
      input.expectedVersion,
      input,
      accessToken,
    );
  },

  async pack(
    taskId: string,
    unitIds: string[],
    expectedVersion: number,
    accessToken: string,
  ) {
    return mutate<{
      package: PreparationPackage;
      taskStatus: string;
      taskVersion: number;
    }>(
      `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/pack`,
      "pack-preparation",
      taskId,
      expectedVersion,
      { unitIds, expectedVersion },
      accessToken,
    );
  },

  async markReady(
    taskId: string,
    packageId: string,
    expectedVersion: number,
    accessToken: string,
  ) {
    return mutate<{ deliveryTaskId: string; version: number }>(
      `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/ready`,
      "ready-preparation",
      taskId,
      expectedVersion,
      { packageId, expectedVersion },
      accessToken,
    );
  },

  async listDeliveryStaff(accessToken: string) {
    const response = await apiRequest<Envelope<Paginated<RentalDeliveryAssignee>>>(
      "/api/v1/staff/rental-assignees?role=STAFF_DELIVERY&page=1&pageSize=100",
      { method: "GET", accessToken },
    );
    return unwrap(response);
  },

  async requestTransfer(
    taskId: string,
    packageId: string,
    toStaffId: string,
    expectedVersion: number,
    accessToken: string,
  ) {
    return mutate<{ custodyTransferId: string; taskVersion: number }>(
      `/api/v1/inventory/tasks/${encodeURIComponent(taskId)}/transfer-request`,
      `transfer-${toStaffId}`,
      taskId,
      expectedVersion,
      { packageId, toStaffId, expectedVersion },
      accessToken,
    );
  },
};

export async function uploadInventoryEvidence(
  asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number;
    type?: string | null;
  },
  accessToken: string,
  options?: { scope?: "CONDITION_EVIDENCE" | "RETURN_EVIDENCE" },
) {
  const mediaPath = (asset.fileName || asset.uri).toLowerCase();
  const isVideo =
    asset.type === "video" ||
    asset.mimeType?.startsWith("video/") === true ||
    /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(mediaPath);
  const resourceType = isVideo ? "VIDEO" : "IMAGE";
  const fallbackName = `condition-${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
  const contentType = asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");
  const intentPayload = await apiRequest<
    Envelope<{
      mediaId: string;
      upload: {
        uploadUrl: string;
        method: string;
        formFields: Record<string, string | number>;
      };
    }>
  >("/api/v1/media/upload-intents", {
    method: "POST",
    accessToken,
    body: JSON.stringify({
      scope: options?.scope ?? "CONDITION_EVIDENCE",
      resourceType,
      fileName: asset.fileName || fallbackName,
      contentType,
      sizeBytes: asset.fileSize,
      captureSource: "CAMERA",
      clientCapturedAt: new Date().toISOString(),
    }),
  });
  const intent = unwrap(intentPayload);
  const formData = new FormData();
  Object.entries(intent.upload.formFields).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  const fileName = asset.fileName || fallbackName;
  const localFileResponse = await fetch(asset.uri);

  if (!localFileResponse.ok) {
    throw new Error("Không thể đọc tệp bằng chứng trên thiết bị.");
  }

  const fileBlob = await localFileResponse.blob();
  formData.append("file", fileBlob, fileName);

  const uploadedResponse = await fetch(intent.upload.uploadUrl, {
    method: intent.upload.method || "POST",
    body: formData,
  });
  if (!uploadedResponse.ok) {
    throw new Error("Không thể tải bằng chứng lên kho media.");
  }
  const uploaded = (await uploadedResponse.json()) as {
    public_id: string;
    version: number;
    signature: string;
  };
  await apiRequest(`/api/v1/media/${intent.mediaId}/complete`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({
      publicId: uploaded.public_id,
      version: uploaded.version,
      signature: uploaded.signature,
    }),
  });
  return intent.mediaId;
}
