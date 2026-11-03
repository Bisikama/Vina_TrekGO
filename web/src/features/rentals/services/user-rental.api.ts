import { apiClient } from "@/lib/axios";
import type {
  RentalDepositExplanation,
  RentalGrade,
  RentalOrderSummary,
  RentalPagination,
} from "@/features/rentals/types/rental";

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export type RentalOrderLine = {
  id: string;
  productId?: string;
  product: { id: string; sku?: string; name: string; grade?: RentalGrade | null };
  quantity: number;
  dailyPrice: number;
  depositPerUnit: number;
  feeAmount: number;
  depositAmount: number;
  /** Snapshot lúc đặt; dùng để giải thích tỷ lệ cọc, không cộng vào số tiền phải trả. */
  replacementValue?: number | null;
  depositExplanation?: RentalDepositExplanation | null;
};

export type RentalOrderDetail = {
  order: RentalOrderSummary;
  items: RentalOrderLine[];
  payment: null | {
    status: string;
    amount?: number;
    expiresAt?: string | null;
    gateway?: string | null;
  };
  trip: {
    id: string;
    rentalStartAt: string;
    dueAt: string;
    occupiedUntil: string;
  };
  pickupPoint: null | { id: string; name: string; address: string };
  returnPoint: null | { id: string; name: string; address: string };
  allowedActions: string[];
  /** Mốc thời gian thật do API trả: ORDER_CREATED | PAID | CANCELLED | COMPLETED. */
  timeline?: Array<{ type: string; at: string }>;
};

export type RentalDepositItem = {
  unitId: string;
  assetCode?: string;
  depositAmount: number;
  amount?: number;
  status: string;
  inspectionStatus?: string | null;
  refundRef?: string | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  heldReason?: string | null;
  deduction?: number | null;
  reason?: string | null;
  settlementMode?: "STANDARD" | "SANDBOX_SIMULATED" | string;
  simulationNotice?: string | null;
  /** Khiếu nại khoản trừ (xem web/docs/RENTAL_DEPOSIT_DISPUTE_FRONTEND_HANDOFF.md). */
  assessmentId?: string | null;
  exceptionCaseId?: string | null;
  reviewCaseId?: string | null;
  evidenceAccessibleAt?: string | null;
  evidenceAccessBlockedAt?: string | null;
  evidenceAccessCustomerConfirmationRequired?: boolean;
  reviewWindowEndsAt?: string | null;
  reviewStatus?: "NOT_SUBMITTED" | "SUBMITTED" | "RESOLVED" | string;
  canSubmitReview?: boolean;
  cannotSubmitReviewReason?: string | null;
  approvedDeduction?: number | null;
};

export type RentalDepositStatus = {
  collectedAmount: number;
  heldAmount: number;
  refundedAmount: number;
  refundPendingAmount: number;
  deductionAmount: number;
  items: RentalDepositItem[];
  groupedRefunds?: {
    refundRef: string;
    status: string;
    amount: number;
    itemIds: string[];
  }[];
  financialTruth?: {
    providerRefundedAmount: number;
    providerRefundPendingAmount: number;
    realMoneyReturned: boolean;
  };
  settlementMode?: "STANDARD" | "SANDBOX_SIMULATED" | string;
  notice?: string;
  warnings?: string[];
};

export type RentalTransaction = {
  id: string;
  kind: "PAYMENT" | "REFUND" | string;
  status: string;
  amount: number | string;
  currency: string;
  createdAt: string;
  sourceId?: string;
  rentalOrderId?: string;
  orderId?: string;
  reference?: string;
  paymentRef?: string;
  refundRef?: string;
  purpose?: string;
};

export type ReviewableItem = {
  productId: string;
  product: { id: string; sku?: string; name: string; images?: string[] };
  quantity: number;
  hasBeenHandedOver: boolean;
  isReviewed: boolean;
  rating: number | null;
  canReview: boolean;
  ineligibleReason: string | null;
};

export async function listMyRentalOrders(options?: {
  page?: number;
  pageSize?: number;
  status?: string;
}) {
  const response = await apiClient.get<
    Envelope<{ items: RentalOrderSummary[]; pagination: RentalPagination }>
  >("/api/v1/rental-orders", {
    params: {
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 100,
      status: options?.status || undefined,
    },
  });
  return unwrap(response.data);
}
export async function getMyRentalOrder(orderId: string) {
  const response = await apiClient.get<Envelope<RentalOrderDetail>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}`,
  );
  return unwrap(response.data);
}

export async function getRentalDeposit(orderId: string) {
  const response = await apiClient.get<Envelope<RentalDepositStatus>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/deposit`,
  );
  return unwrap(response.data);
}
export async function listRentalTransactions(options?: {
  page?: number;
  pageSize?: number;
  kind?: string;
}) {
  const response = await apiClient.get<
    Envelope<{
      items: RentalTransaction[];
      pagination?: RentalPagination;
      page?: number;
      pageSize?: number;
      total?: number;
      totalPages?: number;
    }>
  >("/api/v1/user/transactions", {
    params: {
      source: "RENTAL",
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 100,
      kind: options?.kind || undefined,
    },
  });
  return unwrap(response.data);
}
export async function getReviewableItems(orderId: string) {
  const response = await apiClient.get<Envelope<{ items: ReviewableItem[] }>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/reviewable-items`,
  );
  return unwrap(response.data);
}

export async function createRentalReview(
  orderId: string,
  input: { productId: string; rating: number; comment?: string },
) {
  const key =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? `rental-review-${crypto.randomUUID()}`
      : `rental-review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await apiClient.post(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/reviews`,
    input,
    { headers: { "Idempotency-Key": key } },
  );
  return unwrap(response.data);
}

export type RentalCancellationPreview = { tripCancellationPending?: boolean; canCancel: boolean; feeRefund: number; depositRefund: number; previewVersion: string; reason: string };
export async function previewRentalCancellation(orderId: string) {
  return unwrap((await apiClient.get<Envelope<RentalCancellationPreview>>(`/api/v1/rental-orders/${encodeURIComponent(orderId)}/cancellation-preview`)).data);
}
export async function cancelRentalOrder(orderId: string, input: { reason: string; previewVersion: string; expectedVersion: number }) {
  return unwrap((await apiClient.post(`/api/v1/rental-orders/${encodeURIComponent(orderId)}/cancel`, input)).data);
}

// Chứng từ của đơn thuê (RB-API-1001 / 1003 / 1005).
export type RentalDocumentType =
  | "HANDOVER"
  | "EXTENSION_APPENDIX"
  | "RETURN_RECEIPT"
  | "SCHEDULE_NOTICE"
  | "CORRECTION_NOTICE";

export type RentalDocumentSummary = {
  id: string;
  type: RentalDocumentType | string;
  documentNo: string;
  rootDocumentId: string | null;
  renderStatus: "PENDING_RENDER" | "READY" | "RENDER_FAILED" | string;
  downloadReady: boolean;
  issuedAt: string | null;
  version: number;
};

export type RentalDocumentDownload = {
  downloadUrl: string;
  expiresAt: string;
  fileName: string;
  contentType: string;
  sha256: string;
};

export type RentalDocumentVerification = {
  documentNo: string;
  issuedAt: string;
  verified: boolean;
  snapshotVerified: boolean;
  pdfVerified: boolean | null;
  verificationStatus: "VERIFIED" | "SNAPSHOT_ONLY" | "FAILED" | string;
};

/** GET /api/v1/rental-orders/:id/documents */
export async function listRentalOrderDocuments(orderId: string) {
  const response = await apiClient.get<Envelope<{ items: RentalDocumentSummary[]; pagination: RentalPagination }>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/documents`,
    { params: { page: 1, pageSize: 50 } },
  );
  return unwrap(response.data).items ?? [];
}

/** GET /api/v1/rental-documents/:documentId/download — đường dẫn PDF có chữ ký, hiệu lực 10 phút. */
export async function getRentalDocumentDownload(documentId: string) {
  const response = await apiClient.get<Envelope<RentalDocumentDownload>>(
    `/api/v1/rental-documents/${encodeURIComponent(documentId)}/download`,
  );
  return unwrap(response.data);
}

/** GET /api/v1/rental-documents/:documentId/verification */
export async function verifyRentalDocument(documentId: string) {
  const response = await apiClient.get<Envelope<RentalDocumentVerification>>(
    `/api/v1/rental-documents/${encodeURIComponent(documentId)}/verification`,
  );
  return unwrap(response.data);
}
