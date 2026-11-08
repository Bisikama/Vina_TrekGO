"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, ErrorAlert, LoadingState } from "@/components/ui";
import { useNotifications } from "../hooks/useNotifications";
import type { AppNotification } from "../services/notification.api";

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
});

/** Trang chi tiết tương ứng với đối tượng nguồn của thông báo (nếu có). */
function targetHref(n: AppNotification): string | null {
  if (!n.referenceId) return null;
  switch (n.referenceType) {
    case "BOOKING":
      return `/bookings/${n.referenceId}`;
    case "RENTAL_ORDER":
      return `/rentals/orders/${n.referenceId}`;
    default:
      return null;
  }
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function NotificationBell({ onOpen }: { onOpen?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { items, unreadCount, loading, error, hasMore, reload, loadMore, markAsRead, markAllAsRead, archive } =
    useNotifications();

  // Đóng khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      onOpen?.();
      void reload();
    }
  };

  const openItem = (n: AppNotification) => {
    void markAsRead(n.id);
    const href = targetHref(n);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        size="md"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Mở thông báo"}
        style={{ color: "#125238" }}
        className={`shrink-0 rounded-xl border-emerald-100 px-3 text-xs text-[#125238] ${open ? "ring-2 ring-emerald-200/35" : ""}`}
      >
        <span className="inline-flex items-center gap-2">
          <BellIcon />
          <span className="hidden sm:inline">Thông báo</span>
          {unreadCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-extrabold tabular-nums text-white">
              {badge}
            </span>
          )}
        </span>
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          className="fixed inset-x-4 top-20 z-[120] flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_12px_32px_rgba(18,82,56,0.18)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-[#1F2937]">Thông báo</h2>
              <p className="text-[11px] text-[#6B7280] tabular-nums">{unreadCount} chưa đọc</p>
            </div>
            <Button variant="ghost" size="sm" disabled={!unreadCount} onClick={() => void markAllAsRead()}>
              Đánh dấu đã đọc tất cả
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {error && <ErrorAlert message={error} onRetry={() => void reload()} className="m-3" />}

            {!error && loading && items.length === 0 && (
              <LoadingState message="Đang tải thông báo..." className="m-3 border-0 shadow-none" />
            )}

            {!error && !loading && items.length === 0 && (
              <EmptyState
                icon={<BellIcon />}
                title="Chưa có thông báo"
                description="Cập nhật về đặt chỗ, thuê đồ và thanh toán sẽ hiện ở đây."
                className="m-3 border-0"
              />
            )}

            {items.length > 0 && (
              <ul className="divide-y divide-[#E5E7EB]">
                {items.map((n) => {
                  const unread = n.status === "UNREAD";
                  return (
                    <li key={n.id} className={`group relative ${unread ? "bg-emerald-50/60" : "bg-white"}`}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className="flex w-full gap-3 px-4 py-3 pr-10 text-left transition-colors hover:bg-[#F7F7F4] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2F6B4F]"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-[#2F6B4F]" : "bg-transparent"}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm leading-snug text-[#1F2937] ${unread ? "font-bold" : "font-medium"}`}>
                            {n.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-[#6B7280] line-clamp-3">{n.content}</span>
                          <span className="mt-1 block text-[11px] text-[#6B7280] tabular-nums">
                            {timeFormatter.format(new Date(n.createdAt))}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void archive(n.id)}
                        aria-label={`Ẩn thông báo: ${n.title}`}
                        title="Ẩn thông báo"
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] opacity-100 transition hover:bg-black/5 hover:text-[#1F2937] focus-visible:outline-2 focus-visible:outline-[#2F6B4F] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {hasMore && !error && (
            <div className="border-t border-[#E5E7EB] p-2">
              <Button variant="ghost" size="sm" fullWidth loading={loading} onClick={() => void loadMore()}>
                Xem thêm
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
