import axios from "axios";

import { apiClient } from "@/lib/axios";

/**
 * Luồng khách phản đối khoản trừ cọc (RB-API-609) và xem chứng cứ đã công bố.
 * Theo web/docs/RENTAL_DEPOSIT_DISPUTE_FRONTEND_HANDOFF.md: FE không tự tính hạn 48 giờ,
 * mọi quyền và mốc thời gian đều lấy từ backend.
 */

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export type CannotSubmitReviewReason =
  | "ORDER_OWNER_ONLY"
  | "ASSESSMENT_NOT_READY"
  | "REVIEW_ALREADY_SUBMITTED"
  | "NO_APPROVED_DEDUCTION"
  | "EVIDENCE_NOT_ACCESSIBLE"
  | "EVIDENCE_ACCESS_INTERRUPTED"
  | "USER_REVIEW_WINDOW_EXPIRED"
  | "SETTLEMENT_ALREADY_STARTED";

export type RentalAssessmentItem = {
  inspectionId: string;
  unit: { id: string; assetCode?: string | null };
  outcome: string;
  proposedDeduction: number;
  approvedDeduction: number;
  publishedDecision: null | {
    caseId: string;
    resolution: string | null;
    evidenceIds: unknown[];
    evidenceAccessibleAt: string | null;
    evidenceAccessBlockedAt: string | null;
  };
  findings: { ruleId: string; amount: number; quantity: number; evidenceIds: unknown[] }[];
  reviewDueAt: string | null;
  caseId: string | null;
};

export type EvidenceMedia = {
  mediaId: string;
  resourceType: "IMAGE" | "VIDEO" | string;
  url: string;
  expiresAt?: string | null;
};

export function newIdempotencyKey(prefix: string) {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

/** Trả về `details.reason` nếu có (ví dụ USER_REVIEW_WINDOW_EXPIRED), nếu không thì `error.code`. */
export function getApiErrorReason(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  const body = error.response?.data as
    | { error?: { code?: unknown; details?: { reason?: unknown } } }
    | undefined;
  const reason = body?.error?.details?.reason;
  if (typeof reason === "string") return reason;
  const code = body?.error?.code;
  return typeof code === "string" ? code : null;
}

/** Không có phản hồi từ server (timeout/mất mạng): được phép retry với cùng key và cùng body. */
export function isUnknownOutcome(error: unknown) {
  return axios.isAxiosError(error) && !error.response && error.code !== "ERR_CANCELED";
}

export async function getRentalAssessment(orderId: string) {
  const response = await apiClient.get<Envelope<{ items: RentalAssessmentItem[] }>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/assessment`,
  );
  return unwrap(response.data);
}

/** Ảnh dùng EVIDENCE_PREVIEW; nếu media là video thì backend từ chối variant đó, khi ấy thử VIDEO_PREVIEW. */
export async function getEvidenceMedia(mediaId: string): Promise<EvidenceMedia> {
  const load = async (variant: "EVIDENCE_PREVIEW" | "VIDEO_PREVIEW") => {
    const response = await apiClient.get<Envelope<EvidenceMedia>>(
      `/api/v1/media/${encodeURIComponent(mediaId)}/delivery`,
      { params: { variant } },
    );
    return unwrap(response.data);
  };
  try {
    return await load("EVIDENCE_PREVIEW");
  } catch (error) {
    const invalidVariant =
      getApiErrorReason(error) === "VALIDATION_ERROR" ||
      (axios.isAxiosError(error) && error.response?.status === 400);
    if (invalidVariant) return load("VIDEO_PREVIEW");
    throw error;
  }
}

export function evidenceIdsOf(item: RentalAssessmentItem | undefined) {
  return (item?.publishedDecision?.evidenceIds ?? []).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

export async function uploadDisputeEvidence(file: File) {
  const isVideo = file.type.startsWith("video/");
  const intentResponse = await apiClient.post<Envelope<{
    mediaId: string;
    upload: { uploadUrl: string; method: string; formFields: Record<string, string | number> };
  }>>("/api/v1/media/upload-intents", {
    scope: "EXCEPTION_EVIDENCE",
    resourceType: isVideo ? "VIDEO" : "IMAGE",
    fileName: file.name || `khieu-nai-${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
    contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
    sizeBytes: file.size,
    captureSource: "FILE",
    clientCapturedAt: new Date().toISOString(),
  });
  const intent = unwrap(intentResponse.data);
  const data = new FormData();
  Object.entries(intent.upload.formFields).forEach(([key, value]) => data.append(key, String(value)));
  data.append("file", file);
  const uploadResponse = await fetch(intent.upload.uploadUrl, {
    method: intent.upload.method || "POST",
    body: data,
  });
  if (!uploadResponse.ok) throw new Error("Không tải được tệp chứng cứ lên kho media.");
  const uploaded = (await uploadResponse.json()) as {
    public_id: string;
    version: number;
    signature: string;
  };
  await apiClient.post(`/api/v1/media/${encodeURIComponent(intent.mediaId)}/complete`, {
    publicId: uploaded.public_id,
    version: uploaded.version,
    signature: uploaded.signature,
  });
  return intent.mediaId;
}

export async function submitAssessmentReview(
  orderId: string,
  body: { assessmentId: string; reason: string; evidenceIds: string[] },
  idempotencyKey: string,
) {
  const response = await apiClient.post(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/assessment-reviews`,
    body,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return unwrap(response.data);
}

export async function reportEvidenceAccessProblem(
  orderId: string,
  assessmentId: string,
  idempotencyKey: string,
) {
  const response = await apiClient.post(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/assessments/${encodeURIComponent(assessmentId)}/evidence-access-reports`,
    undefined,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return unwrap(response.data);
}

export async function confirmEvidenceAccessRestored(
  orderId: string,
  assessmentId: string,
  idempotencyKey: string,
) {
  const response = await apiClient.post<Envelope<{ caseId: string; status: string }>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/assessments/${encodeURIComponent(assessmentId)}/evidence-access-confirmations`,
    undefined,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return unwrap(response.data);
}

export const reviewReasonMessages: Record<string, string> = {
  ORDER_OWNER_ONLY: "Chỉ chủ đơn mới được phản đối khoản trừ.",
  ASSESSMENT_NOT_READY: "Thiết bị chưa có kết quả kiểm định cuối.",
  REVIEW_ALREADY_SUBMITTED: "Bạn đã gửi phản đối cho thiết bị này.",
  NO_APPROVED_DEDUCTION: "Thiết bị này không có khoản trừ.",
  EVIDENCE_NOT_ACCESSIBLE: "Hồ sơ chứng cứ đang được công bố. Thời hạn phản hồi chỉ bắt đầu khi bạn xem được chứng cứ.",
  EVIDENCE_ACCESS_INTERRUPTED: "Đang khôi phục quyền xem chứng cứ. Thời hạn phản hồi tạm dừng.",
  USER_REVIEW_WINDOW_EXPIRED: "Đã hết thời hạn phản đối khoản trừ.",
  SETTLEMENT_ALREADY_STARTED: "Khoản cọc đã vào quyết toán, không thể phản đối. Vui lòng liên hệ hỗ trợ.",
  IDEMPOTENCY_KEY_REUSED: "Yêu cầu bị trùng với một lần gửi khác. Vui lòng tải lại trang.",
};
