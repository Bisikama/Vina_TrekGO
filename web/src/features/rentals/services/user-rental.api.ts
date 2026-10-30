import { apiClient } from "@/lib/axios";
import type {
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
  product: { id: string; sku?: string; name: string };
  quantity: number;
  dailyPrice: number;
  depositPerUnit: number;
  feeAmount: number;
  depositAmount: number;
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
