"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, useCurrentUser } from "@/features/auth";
import {
  bookingApiService,
  formatBookingDateTime,
  getBookingErrorMessage,
  type PublicParticipantInvitation,
} from "@/features/bookings/services/booking.api";
import {
  privateTripMembershipApi,
  type DirectMemberInvitationItem,
} from "@/features/trips/services/private-trip-membership.api";

const PUBLIC_INVITE_LABELS: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  ACCEPTED: "Đã nhận vé",
  DECLINED: "Đã từ chối",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Đã hết hạn",
  INVALIDATED: "Không còn hiệu lực",
};

const PRIVATE_INVITE_LABELS: Record<string, string> = {
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã tham gia",
  DECLINED: "Đã từ chối",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Đã hết hạn",
  INVALIDATED: "Không còn hiệu lực",
};

export const UserHeader = () => {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const { getCurrentUser } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [invitationsOpen, setInvitationsOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<"ALL" | "TICKET" | "PRIVATE">("ALL");
  const [publicInvites, setPublicInvites] = useState<PublicParticipantInvitation[]>([]);
  const [privateInvites, setPrivateInvites] = useState<DirectMemberInvitationItem[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  const loadAllInvitations = useCallback(async () => {
    if (!accessToken) return;
    setInvitesLoading(true);
    try {
      const [pubRes, privRes] = await Promise.allSettled([
        bookingApiService.listMyTicketInvitations({ page: 1, pageSize: 20 }),
        privateTripMembershipApi.getMyDirectInvitations({ pageSize: 20 }),
      ]);
      if (pubRes.status === "fulfilled") {
        setPublicInvites(pubRes.value.items || []);
      }
      if (privRes.status === "fulfilled") {
        setPrivateInvites(privRes.value?.items || []);
      }
    } finally {
      setInvitesLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadAllInvitations();
  }, [loadAllInvitations, pathname]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMobileMenuOpen(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  const handleAcceptTicket = async (inv: PublicParticipantInvitation) => {
    setBusyId(inv.id);
    setFeedback(null);
    try {
      await bookingApiService.acceptTicketInvitation(inv.id);
      setFeedback({
        type: "success",
        message: `Đã nhận vé chuyến "${inv.trip.title}" thành công!`,
      });
      await loadAllInvitations();
      window.dispatchEvent(new Event("trekgo:invitations-updated"));
    } catch (err) {
      setFeedback({
        type: "error",
        message: getBookingErrorMessage(err, "Không thể nhận vé lúc này.").message,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclineTicket = async (inv: PublicParticipantInvitation) => {
    setBusyId(inv.id);
    setFeedback(null);
    try {
      await bookingApiService.declineTicketInvitation(inv.id);
      setFeedback({
        type: "success",
        message: `Đã từ chối vé chuyến "${inv.trip.title}".`,
      });
      await loadAllInvitations();
      window.dispatchEvent(new Event("trekgo:invitations-updated"));
    } catch (err) {
      setFeedback({
        type: "error",
        message: getBookingErrorMessage(err, "Không thể từ chối lời mời.").message,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleAcceptPrivate = async (inv: DirectMemberInvitationItem) => {
    setBusyId(inv.id);
    setFeedback(null);
    try {
      const res = await privateTripMembershipApi.acceptDirectInvitation(inv.id);
      await loadAllInvitations();
      if (res.canEnterRoom) {
        setFeedback({
          type: "success",
          message: "Đã tham gia chuyến đi riêng! Đang chuyển tới phòng chờ...",
        });
        setTimeout(() => {
          setInvitationsOpen(false);
          router.push(`/trip-room/${res.tripId}`);
        }, 800);
      } else {
        setFeedback({
          type: "error",
          message: "Lời mời đã xử lý nhưng bạn hiện chưa thể vào phòng chờ.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.error?.message || "Không thể chấp nhận lời mời này.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclinePrivate = async (inv: DirectMemberInvitationItem) => {
    setBusyId(inv.id);
    setFeedback(null);
    try {
      await privateTripMembershipApi.declineDirectInvitation(inv.id, "NOT_INTERESTED");
      setFeedback({
        type: "success",
        message: `Đã từ chối lời mời chuyến "${inv.trip?.title || "riêng tư"}".`,
      });
      await loadAllInvitations();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.error?.message || "Không thể từ chối lời mời này.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const pendingPublicCount = publicInvites.filter((i) => i.status === "PENDING").length;
  const pendingPrivateCount = privateInvites.filter((i) => i.status === "PENDING").length;
  const totalPendingCount = pendingPublicCount + pendingPrivateCount;

  const displayName =
    user?.fullName || user?.name || user?.email?.split("@")[0] || "Đang tải...";

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-[100] w-full max-w-full">
        {/* Top thin bar */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-[#F8FAFC] px-4 py-1.5 text-[10px] font-medium text-gray-500 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="truncate">Khám phá vùng lõi núi Việt Nam</span>
            <span className="hidden items-center gap-1.5 lg:flex whitespace-nowrap">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              Hệ thống cảnh báo an toàn hoạt động tốt
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="whitespace-nowrap">Bà Đen 28°C, Nắng đẹp</span>
            <span className="hidden md:inline whitespace-nowrap">Đang theo dõi 124 đoàn</span>
          </div>
        </div>

        {/* Main Navbar */}
        <div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white overflow-hidden text-white shadow-sm">
              <Image
                src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg"
                alt="Logo"
                width={32}
                height={32}
                className="object-cover h-full w-full"
              />
            </div>

            <div className="whitespace-nowrap">
              <div className="text-sm font-extrabold leading-none tracking-tight text-[#0F172A]">
                VinaTrekGO
              </div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-[#1B5E41]">
                Trekking System
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-3 2xl:gap-5 text-xs 2xl:text-[13px] font-bold text-gray-600 xl:flex min-w-0">
            <Link
              href="/explore"
              className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
            >
              Khám phá
            </Link>

            <Link
              href="/trips"
              className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
            >
              Chuyến đi
            </Link>

            <Link
              href="/bookings"
              className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
            >
              Đặt chỗ & Vé
            </Link>

            <Link
              href="/my-trips"
              className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
            >
              Chuyến đi của tôi
            </Link>

            <Link
              href="/my-routes"
              className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
            >
              Cung đường của tôi
            </Link>

            <Link
              href="/invite"
              className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
            >
              Nhập mã mời
            </Link>

            <Link
              href="/rentals"
              className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
            >
              Thuê thiết bị
            </Link>

            <Link
              href="/leader-registration"
              className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
            >
              Trở thành Leader
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Nút Lời mời ngay trên Header */}
            <button
              type="button"
              onClick={() => {
                setInvitationsOpen((prev) => !prev);
                setFeedback(null);
                void loadAllInvitations();
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                invitationsOpen
                  ? "border-[#125238] bg-[#125238] text-white"
                  : totalPendingCount > 0
                  ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>Lời mời</span>
              {totalPendingCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-white">
                  {totalPendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              className="hidden items-center gap-1.5 rounded-full bg-[#DC2626] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-red-700 md:flex whitespace-nowrap shrink-0"
            >
              SOS 1800-9988
            </button>

            <div className="flex items-center gap-2.5 sm:gap-3 border-l border-gray-200 pl-2.5 sm:pl-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200">
                  <Image
                    src={
                      user?.avatar ||
                      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop"
                    }
                    alt="User Avatar"
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                  />
                </div>

                <div className="hidden text-left sm:block max-w-[110px] 2xl:max-w-[150px]">
                  <div className="text-[12px] font-bold leading-tight text-gray-900 truncate">
                    {displayName}
                  </div>
                  <div className="text-[10px] font-medium text-gray-500 truncate">
                    {user?.role === "LEADER" ? "Leader" : "Trekker"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  logout();
                  window.location.href = "/public/login";
                }}
                className="hidden sm:inline-flex cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
              >
                Đăng xuất
              </button>
            </div>

            {/* Mobile Hamburger Button (< xl) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Mở menu điều hướng"
              aria-expanded={mobileMenuOpen}
              className="inline-flex xl:hidden items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors shrink-0 cursor-pointer"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Responsive Dropdown Menu for < xl screens */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-gray-100 bg-white px-4 pt-3 pb-4 shadow-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[13px] font-bold text-gray-700">
              <Link
                href="/explore"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
              >
                Khám phá
              </Link>
              <Link
                href="/trips"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
              >
                Chuyến đi
              </Link>
              <Link
                href="/bookings"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
              >
                Đặt chỗ & Vé
              </Link>
              <Link
                href="/my-trips"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
              >
                Chuyến đi của tôi
              </Link>
              <Link
                href="/my-routes"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
              >
                Cung đường của tôi
              </Link>
              <Link
                href="/invite"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
              >
                Nhập mã mời
              </Link>
              <Link
                href="/rentals"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
              >
                Thuê thiết bị
              </Link>
              <Link
                href="/leader-registration"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
              >
                Trở thành Leader
              </Link>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 sm:hidden">
              <div className="text-xs font-bold text-gray-800 truncate">
                {displayName} ({user?.role === "LEADER" ? "Leader" : "Trekker"})
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  window.location.href = "/public/login";
                }}
                className="cursor-pointer whitespace-nowrap rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        )}

        {/* Tracking Sub-bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#154B36] px-4 py-2 text-[11px] font-medium text-white sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30 whitespace-nowrap shrink-0">
              GPS TRACKING ON
            </span>
            <span className="hidden md:inline truncate opacity-90">
              Thời tiết Núi Bà Đen (Tây Ninh): 28°C • Độ ẩm 65% • Nắng ráo, mây quang đãng
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 opacity-90 shrink-0 ml-auto">
            <span className="hidden sm:inline whitespace-nowrap">
              Vệ tinh Garmin InReach Sẵn sàng
            </span>
            <span className="sm:border-l sm:border-white/20 sm:pl-4 whitespace-nowrap">
              Trung tâm điều phối 1800-9988
            </span>
          </div>
        </div>
      </header>

      {/* HỘP THƯ LỜI MỜI TRÊN HEADER */}
      {invitationsOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-end bg-black/40 p-4 pt-20 backdrop-blur-xs"
          onClick={() => setInvitationsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">
                  Hộp thư lời mời của bạn
                </h3>
                <p className="text-xs text-gray-500">
                  Nhận vé đồng hành từ bạn bè hoặc tham gia chuyến đi riêng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvitationsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-5 py-2.5">
              <button
                type="button"
                onClick={() => setInviteTab("ALL")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  inviteTab === "ALL"
                    ? "bg-[#125238] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                Tất cả ({publicInvites.length + privateInvites.length})
              </button>
              <button
                type="button"
                onClick={() => setInviteTab("TICKET")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  inviteTab === "TICKET"
                    ? "bg-[#125238] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                Vé đồng hành ({publicInvites.length})
              </button>
              <button
                type="button"
                onClick={() => setInviteTab("PRIVATE")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  inviteTab === "PRIVATE"
                    ? "bg-[#125238] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                Chuyến đi riêng ({privateInvites.length})
              </button>
            </div>

            {feedback && (
              <div
                className={`mx-5 mt-3 rounded-xl p-3 text-xs font-bold ${
                  feedback.type === "success"
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {feedback.message}
              </div>
            )}

            <div className="max-h-[65vh] overflow-y-auto p-5 space-y-3">
              {invitesLoading && publicInvites.length === 0 && privateInvites.length === 0 ? (
                <div className="py-10 text-center text-xs text-gray-500">
                  Đang tải danh sách lời mời...
                </div>
              ) : (
                <>
                  {/* Lời mời nhận vé đồng hành (Public Trip) */}
                  {(inviteTab === "ALL" || inviteTab === "TICKET") &&
                    publicInvites.map((inv) => {
                      const isPending = inv.status === "PENDING";
                      const isBusy = busyId === inv.id;
                      return (
                        <div
                          key={`pub-${inv.id}`}
                          className={`rounded-xl border p-4 space-y-2.5 ${
                            isPending
                              ? "border-amber-300 bg-amber-50/40"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-[#125238] uppercase tracking-wider">
                              Vé đồng hành · Tour ghép đoàn
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                isPending
                                  ? "bg-amber-100 text-amber-900"
                                  : inv.status === "ACCEPTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {PUBLIC_INVITE_LABELS[inv.status] || inv.status}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-extrabold text-gray-900">
                              {inv.trip.title}
                            </h4>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Người gửi: <strong>{inv.senderDisplay}</strong> · Tên trên vé:{" "}
                              <strong>{inv.participantName}</strong>
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Khởi hành: {formatBookingDateTime(inv.trip.startAt)}
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            {inv.actions?.canAccept && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAcceptTicket(inv)}
                                className="rounded-lg bg-[#125238] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1F4A36] disabled:opacity-50 cursor-pointer"
                              >
                                {isBusy ? "Đang xử lý..." : "Xác nhận nhận vé"}
                              </button>
                            )}
                            {inv.actions?.canDecline && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDeclineTicket(inv)}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                              >
                                Từ chối
                              </button>
                            )}
                            {inv.status === "ACCEPTED" && (
                              <Link
                                href="/bookings"
                                onClick={() => setInvitationsOpen(false)}
                                className="rounded-lg border border-[#125238] px-3 py-1.5 text-xs font-bold text-[#125238] hover:bg-emerald-50"
                              >
                                Mở vé & Mã QR →
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {/* Lời mời chuyến đi riêng (Private Trip) */}
                  {(inviteTab === "ALL" || inviteTab === "PRIVATE") &&
                    privateInvites.map((inv) => {
                      const isPending = inv.status === "PENDING";
                      const isBusy = busyId === inv.id;
                      return (
                        <div
                          key={`priv-${inv.id}`}
                          className={`rounded-xl border p-4 space-y-2.5 ${
                            isPending
                              ? "border-emerald-300 bg-emerald-50/30"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                              Lời mời Chuyến đi riêng
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                isPending
                                  ? "bg-emerald-100 text-emerald-900"
                                  : inv.status === "ACCEPTED"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {PRIVATE_INVITE_LABELS[inv.status] || inv.status}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-extrabold text-gray-900">
                              {inv.trip?.title || "Chuyến đi riêng tư"}
                            </h4>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Host mời: <strong>{inv.senderDisplay || "Host chuyến đi"}</strong>
                            </p>
                            {inv.trip?.startAt && (
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                Khởi hành: {formatBookingDateTime(inv.trip.startAt)}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleAcceptPrivate(inv)}
                                  className="rounded-lg bg-[#125238] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1F4A36] disabled:opacity-50 cursor-pointer"
                                >
                                  {isBusy ? "Đang xử lý..." : "Chấp nhận tham gia"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleDeclinePrivate(inv)}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                            {inv.status === "ACCEPTED" && inv.tripId && (
                              <Link
                                href={`/trip-room/${inv.tripId}`}
                                onClick={() => setInvitationsOpen(false)}
                                className="rounded-lg border border-[#125238] px-3 py-1.5 text-xs font-bold text-[#125238] hover:bg-emerald-50"
                              >
                                Vào phòng chờ →
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {((inviteTab === "ALL" &&
                    publicInvites.length === 0 &&
                    privateInvites.length === 0) ||
                    (inviteTab === "TICKET" && publicInvites.length === 0) ||
                    (inviteTab === "PRIVATE" && privateInvites.length === 0)) && (
                    <div className="py-10 text-center text-xs text-gray-500">
                      Hiện tại không có lời mời nào trong mục này.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
