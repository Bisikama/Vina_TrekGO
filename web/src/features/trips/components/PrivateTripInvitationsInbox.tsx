"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  privateTripMembershipApi,
  DirectMemberInvitationItem,
} from "../services/private-trip-membership.api";

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  PENDING: { label: "Chờ bạn phản hồi", class: "bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold" },
  ACCEPTED: { label: "Đã tham gia", class: "bg-blue-50 text-blue-700 border-blue-200" },
  DECLINED: { label: "Đã từ chối", class: "bg-slate-100 text-slate-500 border-slate-200" },
  REVOKED: { label: "Host đã thu hồi", class: "bg-gray-100 text-gray-500 border-gray-200" },
  EXPIRED: { label: "Đã hết hạn", class: "bg-red-50 text-red-600 border-red-200" },
  INVALIDATED: { label: "Chuyến đi đã hủy", class: "bg-red-50 text-red-500 border-red-200" },
};

export function PrivateTripInvitationsInbox() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<DirectMemberInvitationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadInbox = async () => {
    setIsLoading(true);
    try {
      const res = await privateTripMembershipApi.getMyDirectInvitations({ pageSize: 50 });
      setInvitations(res?.items || []);
    } catch {
      // Bỏ qua lỗi tải
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  const handleAccept = async (inv: DirectMemberInvitationItem) => {
    setActionLoadingId(inv.id);
    try {
      const res = await privateTripMembershipApi.acceptDirectInvitation(inv.id);
      alert("Chúc mừng bạn đã gia nhập đoàn trekking thành công!");
      router.push(`/trip-room/${res.tripId || inv.tripId}`);
    } catch (err: any) {
      alert("Không thể tham gia: " + (err?.response?.data?.error?.message || err?.message || "Lỗi không xác định"));
      loadInbox();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn từ chối lời mời này không?")) return;
    setActionLoadingId(id);
    try {
      await privateTripMembershipApi.declineDirectInvitation(id, "OTHER");
      await loadInbox();
    } catch (err: any) {
      alert("Không thể từ chối: " + (err?.response?.data?.error?.message || err?.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-gray-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mr-2" />
        Đang tải hộp thư lời mời...
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl mb-2">
          📬
        </div>
        <p className="text-sm font-bold text-gray-800">Hộp thư lời mời trống</p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
          Khi có bạn bè hoặc Host tạo chuyến đi riêng và mời email của bạn, lời mời sẽ hiển thị tại đây.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map((inv) => {
        const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.PENDING;
        const isPending = inv.status === "PENDING";
        const isBusy = actionLoadingId === inv.id;

        return (
          <div
            key={inv.id}
            className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
          >
            {/* Left info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-sm">
                  🎒
                </span>
                <span className="text-xs font-bold text-gray-500">
                  Lời mời từ Host: <strong className="text-gray-900">{inv.senderDisplay || "Host chuyến đi"}</strong>
                </span>
                <span
                  className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.class}`}
                >
                  {badge.label}
                </span>
              </div>

              <h4 className="text-base font-extrabold text-gray-900">
                {inv.trip?.title || "Chuyến đi riêng tư"}
              </h4>

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {inv.trip?.startAt && (
                  <span>
                    📅 Khởi hành: {new Date(inv.trip.startAt).toLocaleDateString("vi-VN")}
                  </span>
                )}
                <span>
                  ⏰ Hạn phản hồi: {new Date(inv.expiresAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
            </div>

            {/* Right actions */}
            {isPending && (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleDecline(inv.id)}
                  className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-red-600 transition disabled:opacity-50 cursor-pointer"
                >
                  Từ chối
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleAccept(inv)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B5E41] px-4 py-2 text-xs font-bold text-white hover:bg-[#154B36] transition disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {isBusy ? "Đang xử lý..." : "✓ Chấp nhận tham gia"}
                </button>
              </div>
            )}

            {!isPending && inv.status === "ACCEPTED" && (
              <button
                type="button"
                onClick={() => router.push(`/trip-room/${inv.tripId}`)}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer self-end sm:self-auto"
              >
                Vào phòng chuyến đi →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

