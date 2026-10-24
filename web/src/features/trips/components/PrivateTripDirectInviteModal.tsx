"use client";

import React, { useEffect, useState } from "react";
import {
  privateTripMembershipApi,
  DirectMemberInvitationItem,
} from "../services/private-trip-membership.api";

interface Props {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
  onMemberJoined?: () => void;
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  PENDING: { label: "Đang chờ phản hồi", class: "bg-amber-50 text-amber-700 border-amber-200" },
  ACCEPTED: { label: "Đã tham gia", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DECLINED: { label: "Đã từ chối", class: "bg-slate-100 text-slate-600 border-slate-200" },
  REVOKED: { label: "Đã thu hồi", class: "bg-gray-100 text-gray-500 border-gray-200" },
  EXPIRED: { label: "Hết hạn", class: "bg-red-50 text-red-600 border-red-200" },
  INVALIDATED: { label: "Đã vô hiệu", class: "bg-red-50 text-red-500 border-red-200" },
};

export function PrivateTripDirectInviteModal({ tripId, isOpen, onClose, onMemberJoined }: Props) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [invitations, setInvitations] = useState<DirectMemberInvitationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadSentInvitations = async () => {
    setIsLoadingList(true);
    try {
      const res = await privateTripMembershipApi.getHostDirectInvitations(tripId, { pageSize: 50 });
      setInvitations(res?.items || []);
    } catch {
      // Bỏ qua lỗi tải lịch sử
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen && tripId) {
      setError(null);
      setSuccessMsg(null);
      loadSentInvitations();
    }
  }, [isOpen, tripId]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Vui lòng nhập đúng định dạng email.");
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await privateTripMembershipApi.createDirectInvitation(tripId, cleanEmail);
      setSuccessMsg(`Đã gửi lời mời thành công tới ${cleanEmail}!`);
      setEmail("");
      await loadSentInvitations();
    } catch (err: any) {
      const apiCode = err?.response?.data?.error?.code || err?.response?.data?.code;
      if (apiCode === "INVITATION_RECIPIENT_UNAVAILABLE") {
        setError("Không tìm thấy tài khoản TrekGO với email này hoặc tài khoản đã tham gia đoàn.");
      } else if (apiCode === "PENDING_INVITATION_EXISTS") {
        setError("Đã có một lời mời đang chờ gửi tới email này rồi.");
      } else {
        setError(err?.response?.data?.error?.message || err?.message || "Không thể gửi lời mời.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn thu hồi lời mời này không?")) return;
    try {
      await privateTripMembershipApi.revokeDirectInvitation(id);
      await loadSentInvitations();
    } catch (err: any) {
      alert("Không thể thu hồi: " + (err?.response?.data?.error?.message || err.message));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-lg text-emerald-800">
              ✉️
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-900">Mời Thành Viên Tham Gia Chuyến Đi</h3>
              <p className="text-xs text-gray-500">
                Gửi lời mời trực tiếp đến email tài khoản TrekGO của bạn bè
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Form Gửi Lời Mời */}
          <form onSubmit={handleSendInvite} className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Nhập email tài khoản TrekGO của người nhận
            </label>
            <div className="flex gap-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ví dụ: ban_dong_hanh@gmail.com"
                required
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <button
                type="submit"
                disabled={isSending || !email}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B5E41] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#154B36] transition disabled:opacity-50 cursor-pointer"
              >
                {isSending ? "Đang gửi..." : "Gửi lời mời"}
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                ⚠️ {error}
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                ✓ {successMsg}
              </div>
            )}
          </form>

          {/* Danh Sách Lời Mời Đã Gửi */}
          <div className="space-y-3 border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Lịch sử lời mời đã gửi ({invitations.length})
              </h4>
              <button
                type="button"
                onClick={loadSentInvitations}
                disabled={isLoadingList}
                className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                {isLoadingList ? "Đang tải..." : "Làm mới"}
              </button>
            </div>

            {invitations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
                Chưa gửi lời mời nào. Hãy nhập email ở trên để mời bạn bè tham gia!
              </div>
            ) : (
              <div className="space-y-2">
                {invitations.map((inv) => {
                  const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.PENDING;
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-slate-50/70 p-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-gray-900">
                          {inv.recipientDisplay || "Thành viên TrekGO"}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Gửi ngày: {new Date(inv.createdAt).toLocaleDateString("vi-VN")} • Hết hạn:{" "}
                          {new Date(inv.expiresAt).toLocaleDateString("vi-VN")}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.class}`}
                        >
                          {badge.label}
                        </span>

                        {inv.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(inv.id)}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 transition cursor-pointer"
                          >
                            Thu hồi
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3.5 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

