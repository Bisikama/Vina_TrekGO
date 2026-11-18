import AsyncStorage from "@react-native-async-storage/async-storage";

import { File as DeviceFile, UploadType } from "expo-file-system";
import { Platform } from "react-native";
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
  /** Hạn dùng YYYY-MM-DD; server đã xếp món hết hạn sớm lên trước. */
  expiresAt?: string | null;
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

  /** Thông tin đơn kho cần khi soạn: ngày đặt, thanh toán, giao khách, hạn trả, điểm nhận/trả, phí/cọc. */
  async getOrderBrief(orderId: string, accessToken: string): Promise<PreparationOrderBrief> {
    const detail = unwrap(
      await apiRequest<
        Envelope<{
          order?: { createdAt?: string; dueAt?: string; rentalFee?: number; totalDeposit?: number };
          trip?: { rentalStartAt?: string; dueAt?: string };
          pickupPoint?: { name?: string; address?: string } | null;
          returnPoint?: { name?: string } | null;
          timeline?: { type: string; at: string }[];
        }>
      >(`/api/v1/rental-orders/${encodeURIComponent(orderId)}`, { method: "GET", accessToken }),
    );
    return {
      orderId,
      createdAt: detail.order?.createdAt ?? null,
      paidAt: detail.timeline?.find((step) => step.type === "PAID")?.at ?? null,
      handoverAt: detail.trip?.rentalStartAt ?? null,
      dueAt: detail.trip?.dueAt ?? detail.order?.dueAt ?? null,
      pickupName: detail.pickupPoint?.name ?? null,
      pickupAddress: detail.pickupPoint?.address ?? null,
      returnName: detail.returnPoint?.name ?? null,
      rentalFee: detail.order?.rentalFee ?? null,
      totalDeposit: detail.order?.totalDeposit ?? null,
    };
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

export type PreparationOrderBrief = {
  orderId: string;
  createdAt: string | null;
  paidAt: string | null;
  /** Giờ giao đồ cho khách (bắt đầu thuê). */
  handoverAt: string | null;
  dueAt: string | null;
  pickupName: string | null;
  pickupAddress: string | null;
  returnName: string | null;
  rentalFee: number | null;
  totalDeposit: number | null;
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
  const contentType = normalizeEvidenceMime(asset.mimeType, mediaPath, isVideo);
  const fallbackName = `condition-${Date.now()}.${MIME_EXTENSION[contentType] ?? (isVideo ? "mp4" : "jpg")}`;
  // Máy Android hay không trả fileSize cho ảnh vừa chụp; backend bắt buộc sizeBytes > 0.
  const sizeBytes = asset.fileSize || (await readEvidenceSize(asset.uri));
  if (!sizeBytes) throw new Error("Không đọc được tệp vừa chụp trên máy. Hãy chụp lại.");
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
      sizeBytes,
      captureSource: "CAMERA",
      clientCapturedAt: new Date().toISOString(),
    }),
  });
  const intent = unwrap(intentPayload);
  const fileName = asset.fileName || fallbackName;
  const fields = Object.fromEntries(
    Object.entries(intent.upload.formFields).map(([key, value]) => [key, String(value)]),
  );
  const { status, body } = await sendEvidenceFile(asset.uri, fileName, contentType, intent.upload, fields);
  if (status < 200 || status >= 300) {
    throw new Error(
      `Kho media từ chối tệp (HTTP ${status})${body ? `: ${body.slice(0, 160)}` : "."}`,
    );
  }
  let uploaded: { public_id: string; version: number; signature: string };
  try {
    uploaded = JSON.parse(body);
  } catch {
    throw new Error("Kho media trả về kết quả không hợp lệ. Vui lòng thử lại.");
  }
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

/**
 * Gửi tệp lên kho media đã ký sẵn.
 * Trên máy thật dùng File của expo-file-system (upload multipart gốc): fetch của Expo không nhận
 * part kiểu { uri, name, type } ("Unsupported FormDataPart implementation") và fetch(uri).blob()
 * hay lỗi trên Android. Trên web dùng FormData + Blob bình thường.
 */
async function sendEvidenceFile(
  uri: string,
  fileName: string,
  contentType: string,
  upload: { uploadUrl: string; method: string },
  fields: Record<string, string>,
): Promise<{ status: number; body: string }> {
  try {
    if (Platform.OS !== "web") {
      const file = new DeviceFile(uri);
      if (!file.exists) throw new Error("Không mở được tệp vừa chụp trên máy");
      const result = await file.upload(upload.uploadUrl, {
        httpMethod: (upload.method || "POST") as "POST",
        uploadType: UploadType.MULTIPART,
        fieldName: "file",
        mimeType: contentType,
        parameters: fields,
        sessionType: "foreground",
      });
      return { status: result.status, body: result.body };
    }
    const blob = await (await fetch(uri)).blob();
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    form.append("file", blob, fileName);
    const response = await fetch(upload.uploadUrl, { method: upload.method || "POST", body: form });
    return { status: response.status, body: await response.text() };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Không gửi được tệp lên kho media (${reason}).`);
  }
}

/** Đuôi tệp theo loại nội dung backend chấp nhận. */
const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/**
 * Chuẩn hoá loại tệp: iOS quay video ra .mov (video/quicktime), một số máy Android trả "image/jpg"
 * hoặc không trả mimeType. Backend chỉ nhận đúng danh sách trong MIME_EXTENSION.
 */
function normalizeEvidenceMime(mimeType: string | null | undefined, path: string, isVideo: boolean) {
  const raw = (mimeType ?? "").toLowerCase();
  if (raw === "image/jpg" || raw === "image/pjpeg") return "image/jpeg";
  if (raw === "video/mov") return "video/quicktime";
  if (MIME_EXTENSION[raw]) return raw;
  const ext = /\.([a-z0-9]+)(?:$|\?)/.exec(path)?.[1];
  const byExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  };
  if (ext && byExt[ext]) return byExt[ext];
  return isVideo ? "video/mp4" : "image/jpeg";
}

async function readEvidenceSize(uri: string): Promise<number> {
  try {
    if (Platform.OS !== "web") {
      const file = new DeviceFile(uri);
      return file.exists ? file.size : 0;
    }
    return (await (await fetch(uri)).blob()).size;
  } catch {
    return 0;
  }
}
