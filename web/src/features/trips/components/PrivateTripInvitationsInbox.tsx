"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  privateTripMembershipApi,
  DirectInvitationDeclineReason,
  DirectInvitationPreviewResponse,
  DirectMemberInvitationItem,
  PrivateMemberInvitationAcceptResponse,
} from "../services/private-trip-membership.api";

// Trạng thái lưu ở list chỉ để hiển thị; hiệu lực thật do preview quyết định (previewRequired)
const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  PENDING: { label: "Chờ bạn phản hồi", class: "bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold" },
  ACCEPTED: { label: "Đã tham gia", class: "bg-blue-50 text-blue-700 border-blue-200" },
  DECLINED: { label: "Đã từ chối", class: "bg-slate-100 text-slate-500 border-slate-200" },
  REVOKED: { label: "Host đã thu hồi", class: "bg-gray-100 text-gray-500 border-gray-200" },
  EXPIRED: { label: "Đã hết hạn", class: "bg-red-50 text-red-600 border-red-200" },
};

// INVALIDATED phải diễn giải theo reason — không mặc định là chuyến đã hủy
const invalidatedLabel = (reason: string | null | undefined): { label: string; class: string } => {
  switch (reason) {
    case "TRIP_CANCELLED":
      return { label: "Chuyến đi đã hủy", class: "bg-red-50 text-red-500 border-red-200" };
    case "ALREADY_MEMBER":
      return { label: "Bạn đã ở trong đoàn", class: "bg-blue-50 text-blue-700 border-blue-200" };
    case "MEMBER_REMOVED":
      return { label: "Bạn đã bị loại khỏi đoàn", class: "bg-red-50 text-red-600 border-red-200" };
    default:
      return { label: "Đã vô hiệu", class: "bg-red-50 text-red-500 border-red-200" };
  }
};

const badgeFor = (inv: DirectMemberInvitationItem) =>
  inv.status === "INVALIDATED" ? invalidatedLabel(inv.reason) : STATUS_BADGE[inv.status] || STATUS_BADGE.PENDING;

const DECLINE_REASONS: { value: DirectInvitationDeclineReason; label: string }[] = [
  { value: "NOT_INTERESTED", label: "Không quan tâm" },
  { value: "SCHEDULE_CONFLICT", label: "Trùng lịch" },
  { value: "OTHER", label: "Lý do khác" },
];

const membershipExplain = (res: PrivateMemberInvitationAcceptResponse): string => {
  if (res.membershipStatus === "REMOVED") return "Bạn đã bị loại khỏi chuyến đi này nên không thể vào phòng. Liên hệ host nếu cần xem lại.";
  if (res.membershipStatus === "LEFT") return "Bạn đã rời chuyến đi trước đó. Cần host gửi lời mời mới thì mới tham gia lại được.";
  if (res.membershipStatus === "NO_SHOW" || res.membershipStatus === "COMPLETED") return "Chuyến đi đã kết thúc với tài khoản của bạn.";
  if (res.alreadyMember) return "Bạn đã là thành viên của chuyến đi này.";
  if (res.resolutionReason) return `Lời mời không thể sử dụng (${res.resolutionReason}).`;
  return "Hiện tại bạn chưa vào được phòng chuyến đi.";
};

export function PrivateTripInvitationsInbox() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<DirectMemberInvitationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Preview trước thao tác (S06): thông tin + actions do API trả
  const [preview, setPreview] = useState<DirectInvitationPreviewResponse | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [acceptResult, setAcceptResult] = useState<{ ok: boolean; message: string; tripId?: string } | null>(null);
  const [declineReason, setDeclineReason] = useState<DirectInvitationDeclineReason>("NOT_INTERESTED");

  const loadInbox = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await privateTripMembershipApi.getMyDirectInvitations({ pageSize: 20 });
      setInvitations(res?.items || []);
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || "Không thể tải hộp thư lời mời. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  const openPreview = async (inv: DirectMemberInvitationItem) => {
    setPreviewLoadingId(inv.id);
    setPreviewError(null);
    setAcceptResult(null);
    setDeclineReason("NOT_INTERESTED");
    try {
      const data = await privateTripMembershipApi.previewDirectInvitation(inv.id);
      setPreview(data);
    } catch (err: any) {
      setPreviewError(err?.response?.data?.error?.message || "Không thể tải chi tiết lời mời.");
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleAccept = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    setPreviewError(null);
    try {
      const res = await privateTripMembershipApi.acceptDirectInvitation(invitationId);
      if (res.canEnterRoom) {
        setAcceptResult({ ok: true, message: "Tham gia thành công! Đang chuyển tới phòng chờ...", tripId: res.tripId });
        setTimeout(() => {
          closePreview();
          router.push(`/trip-room/${res.tripId}`);
        }, 1200);
      } else {
        setAcceptResult({ ok: false, message: membershipExplain(res) });
      }
      await loadInbox();
    } catch (err: any) {
      setPreviewError(err?.response?.data?.error?.message || "Không thể chấp nhận lời mời này.");
      await loadInbox();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    setPreviewError(null);
    try {
      await privateTripMembershipApi.declineDirectInvitation(invitationId, declineReason);
      closePreview();
      await loadInbox();
    } catch (err: any) {
      setPreviewError(err?.response?.data?.error?.message || "Không thể từ chối lời mời này.");
      await loadInbox();
    } finally {
      setActionLoadingId(null);
    }
  };

  const closePreview = () => {
    setPreview(null);
    setAcceptResult(null);
    setPreviewError(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-gray-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mr-2" />
        Đang tải hộp thư lời mời...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center" role="alert">
        <p className="text-sm font-bold text-red-800">{loadError}</p>
        <button
          type="button"
          onClick={loadInbox}
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#1B5E41] px-5 py-2 text-xs font-bold text-white hover:bg-[#154B36] transition cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
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
        const badge = badgeFor(inv);

        return (
          <div
            key={inv.id}
            className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
          >
            {/* Left info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
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
                    Khởi hành: {new Date(inv.trip.startAt).toLocaleDateString("vi-VN")}
                  </span>
                )}
                <span>
                  Hạn phản hồi: {new Date(inv.expiresAt).toLocaleString("vi-VN")}
                </span>
              </div>
            </div>

            {/* Right actions — luôn mở preview trước khi thao tác */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={previewLoadingId === inv.id}
                onClick={() => openPreview(inv)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B5E41] px-4 py-2 text-xs font-bold text-white hover:bg-[#154B36] transition disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {previewLoadingId === inv.id ? "Đang tải..." : "Xem lời mời"}
              </button>
            </div>
          </div>
        );
      })}

      {/* MODAL PREVIEW + THAO TÁC */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50/80 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Chi tiết lời mời</h3>
                <p className="text-xs text-gray-500">{preview.senderDisplay || "Host chuyến đi"} mời bạn tham gia</p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-1.5">
                <p className="text-sm font-bold text-gray-900">{preview.trip?.title || "Chuyến đi riêng tư"}</p>
                <div className="grid gap-1 text-xs text-gray-600">
                  {preview.trip?.startAt && (
                    <span>Khởi hành: {new Date(preview.trip.startAt).toLocaleString("vi-VN")}</span>
                  )}
                  {preview.trip?.endAt && (
                    <span>Kết thúc: {new Date(preview.trip.endAt).toLocaleString("vi-VN")}</span>
                  )}
                  <span>Lời mời hết hạn: {new Date(preview.expiresAt).toLocaleString("vi-VN")}</span>
                  {preview.recipientDisplay && <span>Người nhận: {preview.recipientDisplay}</span>}
                </div>
                <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${badgeFor(preview as DirectMemberInvitationItem).class}`}>
                  {badgeFor(preview as DirectMemberInvitationItem).label}
                </span>
              </div>

              {acceptResult && (
                <div
                  className={`rounded-xl border p-3 text-xs font-semibold ${
                    acceptResult.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                  role="status"
                >
                  {acceptResult.message}
                  {acceptResult.ok && acceptResult.tripId && (
                    <button
                      type="button"
                      onClick={() => router.push(`/trip-room/${acceptResult.tripId}`)}
                      className="mt-2 block text-[11px] underline font-bold cursor-pointer"
                    >
                      Vào phòng ngay →
                    </button>
                  )}
                </div>
              )}

              {previewError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700" role="alert">
                  {previewError}
                </div>
              )}

              {/* Nút theo actions.canAccept/canDecline/canEnterRoom từ API */}
              {preview.actions.canAccept && !acceptResult?.ok && (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-500">
                    Chấp nhận nghĩa là bạn tham gia đoàn trekking này. Lời mời không giữ chỗ — nếu đoàn đã đủ người tại thời điểm chấp nhận, bạn sẽ không vào được.
                  </p>
                  <button
                    type="button"
                    disabled={!!actionLoadingId}
                    onClick={() => handleAccept(preview.id)}
                    className="w-full rounded-xl bg-[#1B5E41] px-4 py-3 text-sm font-bold text-white hover:bg-[#154B36] transition disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoadingId === preview.id ? "Đang xử lý..." : "Chấp nhận tham gia"}
                  </button>
                </div>
              )}

              {preview.actions.canDecline && !acceptResult?.ok && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Lý do từ chối (nếu muốn)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {DECLINE_REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        disabled={!!actionLoadingId}
                        onClick={() => setDeclineReason(r.value)}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50 ${
                          declineReason === r.value
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!!actionLoadingId}
                    onClick={() => handleDecline(preview.id)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-red-600 transition disabled:opacity-50 cursor-pointer"
                  >
                    Từ chối lời mời
                  </button>
                </div>
              )}

              {preview.actions.canEnterRoom && (
                <button
                  type="button"
                  onClick={() => router.push(`/trip-room/${preview.tripId}`)}
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                >
                  Vào phòng chuyến đi →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
