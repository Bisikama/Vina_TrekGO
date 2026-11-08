import { apiClient } from "@/lib/axios";

export type NotificationStatus = "UNREAD" | "READ" | "ARCHIVED";

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  content: string;
  notificationType: string;
  referenceType: string | null;
  referenceId: string | null;
  status: NotificationStatus;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPage = {
  items: AppNotification[];
  total: number;
  page: number;
  pageSize: number;
};

/** Tên event socket do API phát khi có thông báo mới (namespace `/notifications`). */
export const NOTIFICATION_SOCKET_EVENT = "receive-notifications";

export const notificationApi = {
  list: async (page = 1, pageSize = 10) =>
    (await apiClient.get<NotificationPage>("/api/v1/notifications", { params: { page, pageSize } })).data,
  unreadCount: async () =>
    (await apiClient.get<{ unreadCount: number }>("/api/v1/notifications/unread-count")).data.unreadCount,
  markAsRead: async (id: string) => {
    await apiClient.patch(`/api/v1/notifications/${id}/read`);
  },
  markAllAsRead: async () => {
    await apiClient.patch("/api/v1/notifications/read-all");
  },
  archive: async (id: string) => {
    await apiClient.patch(`/api/v1/notifications/${id}/archive`);
  },
};
