import { apiClient } from "@/lib/axios";

export type EarlyReturnStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "SUPERSEDED"
  | "REJECTED"
  | "EXPIRED";

export type EarlyReturn = {
  id: string;
  orderId: string;
  status: EarlyReturnStatus;
  version: number;
  requestedAt: string;
  requestedSlotAt: string;
  confirmedSlotAt: string | null;
  /** Có giá trị khi lịch đã xác nhận bị đổi Trip đưa về chờ xác nhận lại. */
  supersededAt: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  expiredAt: string | null;
  /** Chỉ có khi lịch đang xác nhận (GET của khách): tên nhân viên giao nhận sẽ đến lấy đồ. */
  assignee?: { fullName: string } | null;
};

export type AdminEarlyReturn = EarlyReturn & {
  requester: { fullName: string; phone: string | null };
  task: {
    id: string;
    status: string;
    scheduledAt: string | null;
    staff: { id: string; fullName: string } | null;
  } | null;
  order: {
    status: string;
    effectiveDueAt: string;
    outstandingUnits: number;
    returnPoint: { name: string; address: string } | null;
  };
};

export type AdminEarlyReturnFilter = "PENDING" | "CONFIRMED";

/** Trạng thái còn mở: khách chưa gửi được yêu cầu mới. */
export const OPEN_EARLY_RETURN_STATUSES: EarlyReturnStatus[] = ["PENDING", "CONFIRMED"];

export const EARLY_RETURN_STATUS_LABELS: Record<EarlyReturnStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận lịch",
  CANCELLED: "Đã huỷ",
  COMPLETED: "Đã thu hồi sớm",
  SUPERSEDED: "Thu hồi theo lịch khác",
  REJECTED: "Bị từ chối",
  EXPIRED: "Đã hết hạn",
};

function unwrap<T>(value: T | { data: T }): T {
  return value && typeof value === "object" && "data" in value ? (value as { data: T }).data : (value as T);
}
const idempotency = (key?: string) => ({ "Idempotency-Key": key ?? `early-return-${crypto.randomUUID()}` });

export async function getEarlyReturn(orderId: string) {
  const response = await apiClient.get(`/api/v1/rental-orders/${encodeURIComponent(orderId)}/early-return`);
  return unwrap<EarlyReturn | null>(response.data);
}
export async function requestEarlyReturn(orderId: string, requestedSlotAt: string, key?: string) {
  const response = await apiClient.post(
    `/api/v1/rental-orders/${encodeURIComponent(orderId)}/early-return`,
    { requestedSlotAt },
    { headers: idempotency(key) },
  );
  return unwrap<EarlyReturn>(response.data);
}
export async function cancelEarlyReturn(request: EarlyReturn, key?: string) {
  const response = await apiClient.post(
    `/api/v1/rental-early-returns/${encodeURIComponent(request.id)}/cancel`,
    { expectedVersion: request.version },
    { headers: idempotency(key) },
  );
  return unwrap<EarlyReturn>(response.data);
}
// Route staff/... cho cả nhân viên kho và Admin (backend cho phép cả hai vai trò).
export async function listEarlyReturns(status: AdminEarlyReturnFilter = "PENDING") {
  const response = await apiClient.get("/api/v1/staff/rental-early-returns", { params: { status } });
  return unwrap<AdminEarlyReturn[]>(response.data);
}
/**
 * Xác nhận lịch và chốt nhân viên giao nhận đến lấy đồ.
 * `assigneeId` bắt buộc khi task thu hồi chưa có người nhận; bỏ trống = giữ người đang nhận.
 */
export async function confirmEarlyReturn(request: EarlyReturn, assigneeId?: string, key?: string) {
  const response = await apiClient.post(
    `/api/v1/staff/rental-early-returns/${encodeURIComponent(request.id)}/confirm`,
    { expectedVersion: request.version, ...(assigneeId ? { assigneeId } : {}) },
    { headers: idempotency(key) },
  );
  return unwrap<EarlyReturn & { assignee?: { id: string; displayName: string } }>(response.data);
}
/** Giao / đổi nhân viên giao nhận cho lịch đã xác nhận (task thu hồi chưa bắt đầu). Giờ hẹn giữ nguyên. */
export async function assignEarlyReturn(request: EarlyReturn, assigneeId: string, key?: string) {
  const response = await apiClient.post(
    `/api/v1/staff/rental-early-returns/${encodeURIComponent(request.id)}/assign`,
    { expectedVersion: request.version, assigneeId },
    { headers: idempotency(key) },
  );
  return unwrap<EarlyReturn & { assignee: { id: string; displayName: string } }>(response.data);
}
export async function rejectEarlyReturn(request: EarlyReturn, reason: string, key?: string) {
  const response = await apiClient.post(
    `/api/v1/staff/rental-early-returns/${encodeURIComponent(request.id)}/reject`,
    { expectedVersion: request.version, reason },
    { headers: idempotency(key) },
  );
  return unwrap<EarlyReturn>(response.data);
}
