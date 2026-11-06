import { apiClient } from "@/lib/axios";

import { getEquipmentUnits } from "@/features/rentals/services/staff-inventory.api";
import type { EquipmentUnit, EquipmentUnitCounts } from "@/features/rentals/types/rental";

// Các api thật cho màn Kho vật tư của Admin.

function unwrap<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export type AdminRentalOrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "READY_FOR_HANDOVER"
  | "ACTIVE"
  | "RETURN_PENDING"
  | "RETURN_PROCESSING"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export type AdminRentalOrderSummary = {
  id: string;
  tripId: string;
  /** Tên chuyến và tên chủ đơn (có từ #163). */
  tripTitle?: string | null;
  customerName?: string | null;
  bookingId: string | null;
  status: AdminRentalOrderStatus;
  financialStatus: string;
  exceptionStatus: string;
  totalAmount: number;
  currency: string;
  rentalStartAt: string;
  rentalEndAt: string;
  createdAt: string;
  linesCount: number;
};

/** GET /api/v1/admin/rental-orders — lọc theo một trạng thái. */
export async function listAdminRentalOrders(
  status: AdminRentalOrderStatus,
  signal?: AbortSignal,
): Promise<{ items: AdminRentalOrderSummary[]; totalItems: number }> {
  const response = await apiClient.get<unknown>("/api/v1/admin/rental-orders", {
    params: { status, page: 1, pageSize: 20 },
    signal,
  });
  const data = unwrap<{ items: AdminRentalOrderSummary[]; pagination?: { totalItems?: number } }>(response.data);
  const items = data.items ?? [];
  return { items, totalItems: data.pagination?.totalItems ?? items.length };
}

const UNIT_PAGE_SIZE = 100;
const UNIT_MAX_PAGES = 30;

/** GET /api/v1/staff/equipment-units — gom toàn bộ thiết bị (tối đa 3.000) để tính tồn theo sản phẩm. */
export async function getAllEquipmentUnits(signal?: AbortSignal): Promise<{
  items: EquipmentUnit[];
  counts: EquipmentUnitCounts;
  totalItems: number;
}> {
  const first = await getEquipmentUnits({ page: 1, pageSize: UNIT_PAGE_SIZE, signal });
  const items = [...first.items];
  const totalPages = Math.min(first.pagination.totalPages ?? 1, UNIT_MAX_PAGES);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await getEquipmentUnits({ page, pageSize: UNIT_PAGE_SIZE, signal });
    items.push(...next.items);
  }
  return { items, counts: first.counts, totalItems: first.pagination.totalItems ?? items.length };
}
