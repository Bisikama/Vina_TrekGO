import { ApiError, apiRequest } from "@/lib/api-client";

/**
 * Khách xem chứng cứ và phản đối khoản trừ cọc (RB-API-609).
 * Theo web/docs/RENTAL_DEPOSIT_DISPUTE_FRONTEND_HANDOFF.md: không tự tính hạn 48 giờ, quyền gửi lấy từ 607.
 */

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export type RentalAssessmentItem = {
  inspectionId: string;
  unit: { id: string; assetCode?: string | null };
  outcome: string;
  approvedDeduction: number;
  publishedDecision: null | {
    caseId: string;
    evidenceIds: unknown[];
    evidenceAccessibleAt: string | null;
    evidenceAccessBlockedAt: string | null;
  };
  findings: { ruleId: string; amount: number; quantity: number }[];
};

export type EvidenceMedia = {
  mediaId: string;
  resourceType: "IMAGE" | "VIDEO" | string;
  url: string;
};

export type PickedEvidence = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
  type?: string | null;
};

export function newIdempotencyKey(prefix: string) {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const random =
    typeof cryptoApi?.randomUUID === "function"
      ? cryptoApi.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

/** `details.reason` (vd. USER_REVIEW_WINDOW_EXPIRED) nếu có, nếu không thì mã lỗi. */
export function getApiErrorReason(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const reason = (error.details as { reason?: unknown } | undefined)?.reason;
  if (typeof reason === "string") return reason;
  return error.code ?? null;
}

/** status 0 = không nhận được phản hồi (timeout/mất mạng): retry với cùng key và cùng body. */
export function isUnknownOutcome(error: unknown) {
  return error instanceof ApiError && error.status === 0;
}

export function evidenceIdsOf(item: RentalAssessmentItem | undefined) {
  return (item?.publishedDecision?.evidenceIds ?? []).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
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
  IDEMPOTENCY_KEY_REUSED: "Yêu cầu bị trùng với một lần gửi khác. Vui lòng tải lại.",
};

export const deductionReviewApi = {
  async getAssessment(orderId: string, accessToken: string) {
    const response = await apiRequest<Envelope<{ items: RentalAssessmentItem[] }>>(
      `/api/v1/rental-orders/${encodeURIComponent(orderId)}/assessment`,
      { method: "GET", accessToken },
    );
    return unwrap(response);
  },

  async getEvidenceMedia(mediaId: string, accessToken: string): Promise<EvidenceMedia> {
    const load = async (variant: "EVIDENCE_PREVIEW" | "VIDEO_PREVIEW") =>
      unwrap(
        await apiRequest<Envelope<EvidenceMedia>>(
          `/api/v1/media/${encodeURIComponent(mediaId)}/delivery?variant=${variant}`,
          { method: "GET", accessToken },
        ),
      );
    try {
      return await load("EVIDENCE_PREVIEW");
    } catch (error) {
      // Video không nhận variant ảnh → thử lại bằng VIDEO_PREVIEW.
      if (error instanceof ApiError && (error.status === 400 || error.code === "VALIDATION_ERROR")) {
        return load("VIDEO_PREVIEW");
      }
      throw error;
    }
  },

  async uploadEvidence(asset: PickedEvidence, accessToken: string) {
    const path = (asset.fileName || asset.uri).toLowerCase();
    const isVideo =
      asset.type === "video" ||
      asset.mimeType?.startsWith("video/") === true ||
      /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(path);
    const fileName = asset.fileName || `khieu-nai-${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
    const local = await fetch(asset.uri);
    if (!local.ok) throw new Error("Không đọc được tệp trên thiết bị.");
    const blob = await local.blob();
    const intent = unwrap(
      await apiRequest<Envelope<{
        mediaId: string;
        upload: { uploadUrl: string; method: string; formFields: Record<string, string | number> };
      }>>("/api/v1/media/upload-intents", {
        method: "POST",
        accessToken,
        body: JSON.stringify({
          scope: "EXCEPTION_EVIDENCE",
          resourceType: isVideo ? "VIDEO" : "IMAGE",
          fileName,
          contentType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
          sizeBytes: asset.fileSize || blob.size,
          captureSource: "GALLERY",
          clientCapturedAt: new Date().toISOString(),
        }),
      }),
    );
    const form = new FormData();
    Object.entries(intent.upload.formFields).forEach(([key, value]) => form.append(key, String(value)));
    form.append("file", blob, fileName);
    const uploaded = await fetch(intent.upload.uploadUrl, { method: intent.upload.method || "POST", body: form });
    if (!uploaded.ok) throw new Error("Không tải được tệp chứng cứ lên kho media.");
    const result = (await uploaded.json()) as { public_id: string; version: number; signature: string };
    await apiRequest(`/api/v1/media/${encodeURIComponent(intent.mediaId)}/complete`, {
      method: "POST",
      accessToken,
      body: JSON.stringify({ publicId: result.public_id, version: result.version, signature: result.signature }),
    });
    return intent.mediaId;
  },

  async submitReview(
    orderId: string,
    body: { assessmentId: string; reason: string; evidenceIds: string[] },
    idempotencyKey: string,
    accessToken: string,
  ) {
    return unwrap(
      await apiRequest<Envelope<unknown>>(
        `/api/v1/rental-orders/${encodeURIComponent(orderId)}/assessment-reviews`,
        {
          method: "POST",
          accessToken,
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify(body),
        },
      ),
    );
  },

  async reportAccessProblem(orderId: string, assessmentId: string, accessToken: string) {
    return apiRequest(
      `/api/v1/rental-orders/${encodeURIComponent(orderId)}/assessments/${encodeURIComponent(assessmentId)}/evidence-access-reports`,
      { method: "POST", accessToken, headers: { "Idempotency-Key": newIdempotencyKey("evidence-report") } },
    );
  },

  async confirmAccessRestored(orderId: string, assessmentId: string, accessToken: string) {
    return apiRequest(
      `/api/v1/rental-orders/${encodeURIComponent(orderId)}/assessments/${encodeURIComponent(assessmentId)}/evidence-access-confirmations`,
      { method: "POST", accessToken, headers: { "Idempotency-Key": newIdempotencyKey("evidence-confirm") } },
    );
  },
};
