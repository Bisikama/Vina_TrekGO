"use client";

import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "@/features/auth/store/authStore";
import { AppNotification, NOTIFICATION_SOCKET_EVENT, notificationApi } from "../services/notification.api";

const PAGE_SIZE = 10;

/**
 * Hộp thông báo của user đang đăng nhập: badge chưa đọc, danh sách và cập nhật realtime.
 * Socket chỉ xác thực một lần lúc kết nối; khi token đổi (refresh) thì kết nối lại với token mới.
 */
export function useNotifications() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUnread = useCallback(async () => {
    try {
      setUnreadCount(await notificationApi.unreadCount());
    } catch {
      // badge không quan trọng tới mức phải báo lỗi
    }
  }, []);

  const loadPage = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationApi.list(nextPage, PAGE_SIZE);
      setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items.filter((n) => !prev.some((p) => p.id === n.id))]));
      setTotal(res.total);
      setPage(nextPage);
    } catch {
      setError("Không tải được thông báo. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const socket = io(`${base}/notifications`, { auth: { token: accessToken }, transports: ["websocket"] });
    // Lần đầu và mỗi lần kết nối lại: lấy badge để bù thông báo bị lỡ khi mất kết nối.
    socket.on("connect", () => void refreshUnread());
    // Socket không vào được (token sai, server tắt...): badge vẫn lấy qua REST.
    socket.on("connect_error", () => void refreshUnread());
    socket.on(NOTIFICATION_SOCKET_EVENT, (n: AppNotification) => {
      setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
      setTotal((t) => t + 1);
      if (n.status === "UNREAD") setUnreadCount((c) => c + 1);
    });
    return () => {
      socket.disconnect();
    };
  }, [accessToken, refreshUnread]);

  const markAsRead = useCallback(async (id: string) => {
    const target = items.find((n) => n.id === id);
    if (!target || target.status !== "UNREAD") return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, status: "READ", readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationApi.markAsRead(id);
    } catch {
      void refreshUnread();
    }
  }, [items, refreshUnread]);

  const markAllAsRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => (n.status === "UNREAD" ? { ...n, status: "READ", readAt: new Date().toISOString() } : n)));
    setUnreadCount(0);
    try {
      await notificationApi.markAllAsRead();
    } catch {
      void refreshUnread();
    }
  }, [refreshUnread]);

  const archive = useCallback(async (id: string) => {
    const target = items.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (target?.status === "UNREAD") setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationApi.archive(id);
    } catch {
      setError("Không lưu trữ được thông báo.");
      void loadPage(1);
      void refreshUnread();
    }
  }, [items, loadPage, refreshUnread]);

  return {
    items,
    unreadCount,
    loading,
    error,
    hasMore: items.length < total,
    reload: () => loadPage(1),
    loadMore: () => loadPage(page + 1),
    markAsRead,
    markAllAsRead,
    archive,
  };
}
