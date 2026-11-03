import { apiClient } from "@/lib/axios";

import type { RentalAssignee } from "@/features/rentals/services/staff-preparation.api";

// Các api thật dùng cho khung TrekOps (đầu trang, thẻ kho, lịch công việc, hồ sơ).

function unwrap<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

type Paginated<T> = { items: T[] };

/** GET /api/v1/notifications/unread-count — số thông báo chưa đọc của tài khoản hiện tại. */
export async function getUnreadNotificationCount(signal?: AbortSignal): Promise<number> {
  const response = await apiClient.get<unknown>("/api/v1/notifications/unread-count", { signal });
  const data = unwrap<unknown>(response.data);
  if (typeof data === "number") return data;
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    const value = record.unreadCount ?? record.count ?? record.total;
    if (typeof value === "number") return value;
  }
  return 0;
}

/** GET /api/v1/staff/rental-assignees — nhân sự kho vận / giao nhận và số việc đang giữ. */
export async function getRentalAssignees(
  role: RentalAssignee["role"],
  signal?: AbortSignal,
): Promise<RentalAssignee[]> {
  const response = await apiClient.get<unknown>("/api/v1/staff/rental-assignees", {
    params: { role, page: 1, pageSize: 100 },
    signal,
  });
  return unwrap<Paginated<RentalAssignee>>(response.data).items ?? [];
}

export const STAFF_ROLE_LABELS: Record<string, string> = {
  STAFF_INVENTORY: "Nhân viên kho vận",
  STAFF_DELIVERY: "Nhân viên giao nhận",
  ADMIN: "Quản trị viên",
};

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const last = words[words.length - 1];
  const first = words.length > 1 ? words[0] : "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || last.slice(0, 2).toUpperCase();
}
