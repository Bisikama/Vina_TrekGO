import axios from "axios";

import { apiClient } from "@/lib/axios";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import type { RentalPaymentCheckoutResponse, RentalPaymentGateway } from "@/features/rentals/types/rental";

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) return (payload as { data: T }).data;
  return payload as T;
}

/** Khung giờ được trả muộn hơn, server cấp qua rental-eligibility (`returnOptions`). */
export type RentalReturnOption = {
  id: string;
  pointId: string;
  pointName: string;
  method: string;
  available: boolean;
  windowStart: string;
  windowEnd: string;
};

export type RentalExtensionQuote = {
  extensionQuoteId: string;
  orderId: string;
  currentDueAt: string;
  requestedReturnAt: string;
  returnOption: { pointName?: string } | null;
  additionalFee: number;
  currency: string;
  chargedDays: number;
  expiresAt: string;
  expectedVersion: number;
  termsVersion: string;
  termsHash: string;
};

export type RentalExtensionStatus =
  | "QUOTED"
  | "PENDING_PAYMENT"
  | "APPLIED"
  | "REJECTED_CAPACITY"
  | "EXPIRED"
  | "PAYMENT_FAILED"
  | "CANCELLED";

export type RentalExtension = {
  id: string;
  status: RentalExtensionStatus;
  previousRentalEndAt: string;
  requestedRentalEndAt: string;
  additionalFee: number;
  currency: string;
  quoteExpiresAt: string;
  holdExpiresAt: string | null;
  appliedAt: string | null;
  createdAt: string;
};

export const EXTENSION_STATUS_LABELS: Record<string, string> = {
  QUOTED: "Đã báo giá",
  PENDING_PAYMENT: "Chờ thanh toán",
  APPLIED: "Đã gia hạn",
  REJECTED_CAPACITY: "Hết thiết bị cho thời gian này",
  EXPIRED: "Đã hết hạn",
  PAYMENT_FAILED: "Thanh toán thất bại",
  CANCELLED: "Đã huỷ",
};

/** Mã lỗi gia hạn → câu tiếng Việt (backend trả message tiếng Anh cho các mã này). */
const EXTENSION_ERRORS: Record<string, string> = {
  EXTENSION_LIMIT_EXCEEDED: "Đơn đã gia hạn đủ số lần cho phép.",
  EXTENSION_TOO_LATE: "Đã quá thời điểm cho phép gia hạn (quá gần hoặc đã qua hạn trả).",
  EXTENSION_RETURN_STARTED: "Kho đã bắt đầu kiểm tra đồ trả nên không gia hạn được nữa.",
  EXTENSION_RETURN_TASK_STARTED: "Nhân viên đã bắt đầu thu hồi đồ nên không gia hạn được nữa.",
  EXTENSION_INVALID_ORDER_STATE: "Đơn hiện không ở trạng thái cho phép gia hạn.",
  EXTENSION_ALREADY_PENDING: "Đơn đang có một yêu cầu gia hạn chờ thanh toán.",
  EXTENSION_END_NOT_LATER: "Giờ trả mới phải sau hạn trả hiện tại.",
  EXTENSION_QUOTE_EXPIRED: "Báo giá đã hết hạn, vui lòng xem lại phí gia hạn.",
  EXTENSION_QUOTE_NOT_FOUND: "Báo giá không còn hiệu lực, vui lòng xem lại phí gia hạn.",
  EXTENSION_HOLD_EXPIRED: "Thời gian giữ thiết bị cho lần gia hạn này đã hết.",
  EXTENSION_POLICY_NOT_CONFIGURED: "Chính sách gia hạn chưa được cấu hình cho đơn này.",
  EXTENSION_NOT_CONFIGURED: "Chính sách gia hạn chưa được cấu hình cho đơn này.",
  RENTAL_DURATION_NOT_ALLOWED: "Thời gian thuê mới vượt quá giới hạn cho phép.",
  RENTAL_RETURN_OPTION_UNAVAILABLE: "Giờ trả này nằm ngoài khung được phép trả muộn.",
  INSUFFICIENT_AVAILABLE_QUANTITY: "Không đủ thiết bị cho thời gian gia hạn này.",
  VERSION_CONFLICT: "Đơn vừa được cập nhật. Vui lòng xem lại phí gia hạn.",
};

export function getExtensionErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const code = (error.response?.data as { error?: { code?: unknown } } | undefined)?.error?.code;
    if (typeof code === "string" && EXTENSION_ERRORS[code]) return EXTENSION_ERRORS[code];
  }
  return getRentalApiErrorMessage(error, fallback);
}

export async function getRentalReturnOptions(tripId: string) {
  const response = await apiClient.get<Envelope<{ returnOptions?: RentalReturnOption[] }>>(
    `/api/v1/trips/${encodeURIComponent(tripId)}/rental-eligibility`,
  );
  return (unwrap(response.data).returnOptions ?? []).filter((option) => option.available);
}

export async function listRentalExtensions(orderId: string) {
  const response = await apiClient.get<Envelope<{ items: RentalExtension[] }>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/extensions`,
  );
  return unwrap(response.data).items ?? [];
}

export async function quoteRentalExtension(orderId: string, input: { requestedReturnAt: string; returnOptionId: string }) {
  const response = await apiClient.post<Envelope<RentalExtensionQuote>>(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/extension-quotes`,
    input,
  );
  return unwrap(response.data);
}

export async function confirmRentalExtension(
  orderId: string,
  quote: RentalExtensionQuote,
  idempotencyKey: string,
) {
  const response = await apiClient.post<
    Envelope<{ extensionId: string; status: "APPLIED" | "PENDING_PAYMENT"; additionalFee: number; holdExpiresAt: string | null }>
  >(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/extensions`,
    {
      extensionQuoteId: quote.extensionQuoteId,
      expectedVersion: quote.expectedVersion,
      acceptedTermsVersion: quote.termsVersion,
      termsHash: quote.termsHash,
    },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return unwrap(response.data);
}

export async function createRentalExtensionPayment(
  extensionId: string,
  gateway: RentalPaymentGateway,
  idempotencyKey: string,
) {
  const response = await apiClient.post<Envelope<RentalPaymentCheckoutResponse>>(
    `/api/v1/rental-extensions/${encodeURIComponent(extensionId)}/payments`,
    { paymentMethod: "REDIRECT", gateway },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return unwrap(response.data);
}
