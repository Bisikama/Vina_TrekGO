"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, useCurrentUser } from "@/features/auth";
import { Button } from "@/components/ui";
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

const HEADER_ICONS = {
  compass: "m16 8-3 5-5 3 3-5 5-3ZM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  mountain: "m2 20 7-15 4 8 3-6 6 13H2Zm4-8 3 2 2-2",
  ticket: "M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Zm10 0v3m0 3v2m0 3v3",
  calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 11 3 3 5-5",
  map: "m9 3 6 3 6-3v15l-6 3-6-3-6 3V6l6-3Zm0 0v15m6-12v15",
  invite: "M14 3h7v18h-7M3 12h13m-5-5 5 5-5 5",
  backpack: "M8 7V5a4 4 0 0 1 8 0v2M7 7h10a3 3 0 0 1 3 3v11H4V10a3 3 0 0 1 3-3Zm1 8h8v6H8v-6Zm0-4h8",
  badge: "m12 2 3 2 4 .5.5 4 2 3-2 3-.5 4-4 .5-3 2-3-2-4-.5-.5-4-2-3 2-3 .5-4L9 4l3-2Zm-4 10 3 3 5-6",
  mail: "M3 5h18v14H3V5Zm0 0 9 8 9-8",
  phone: "M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  logout: "M9 4H4v16h5m5-12 4 4-4 4m-6-4h10",
};

function HeaderIcon({ name, className = "h-4 w-4" }: { name: keyof typeof HEADER_ICONS; className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={HEADER_ICONS[name]} /></svg>;
}

const HEADER_LINKS = [
  { href: "/explore", label: "Khám phá", icon: "compass" },
  { href: "/trips", label: "Chuyến đi", icon: "mountain" },
  { href: "/bookings", label: "Đặt chỗ & Vé", icon: "ticket" },
  { href: "/my-trips", label: "Chuyến đi của tôi", icon: "calendar" },
  { href: "/my-routes", label: "Cung đường của tôi", icon: "map" },
  { href: "/invite", label: "Nhập mã mời", icon: "invite" },
  { href: "/rentals", label: "Thuê thiết bị", icon: "backpack" },
  { href: "/leader-registration", label: "Trở thành Leader", icon: "badge" },
] as const;

function HeaderNavLink({ item, pathname, mobile = false }: { item: typeof HEADER_LINKS[number]; pathname: string; mobile?: boolean }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return <Link href={item.href} aria-current={active ? "page" : undefined}
    className={`group inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border bg-white px-2.5 text-xs font-semibold text-[#125238] transition duration-150 hover:border-emerald-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${mobile ? "whitespace-normal py-3" : "whitespace-nowrap"} ${active ? "border-emerald-200 shadow-[inset_0_-3px_0_#2F6B4F] ring-2 ring-white/20" : "border-white/80 shadow-sm"}`}>
    <HeaderIcon name={item.icon} className={`h-4 w-4 shrink-0 ${active ? "text-[#125238]" : "text-[#2F6B4F]/75"}`} />
    <span>{item.label}</span>
  </Link>;
}

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

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      document.getElementById("user-menu-toggle")?.focus();
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest("#user-site-header")) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [mobileMenuOpen]);

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
      <header id="user-site-header" className="sticky top-0 z-[100] w-full max-w-full border-b border-[#37765A] bg-[#125238] shadow-[0_3px_16px_rgba(18,82,56,0.14)]">
        {/* Main Navbar */}
        <div className="mx-auto flex h-18 max-w-[1920px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/dashboard" aria-label="Vina TrekGO · Trang chủ" className="flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white p-1 shadow-sm">
              <Image
                src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg"
                alt="Logo"
                width={32}
                height={32}
                className="object-cover h-full w-full"
              />
            </div>

            <div className="hidden whitespace-nowrap min-[360px]:block">
              <div className="text-base font-extrabold leading-none tracking-tight text-white">
                VinaTrekGO
              </div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-emerald-200">
                Trekking System
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Điều hướng chính" className="hidden min-w-0 items-center gap-1.5 min-[114rem]:flex">
            {HEADER_LINKS.map((item) => <HeaderNavLink key={item.href} item={item} pathname={pathname} />)}
          </nav>

          {/* Right Actions */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Nút Lời mời ngay trên Header */}
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setInvitationsOpen((prev) => !prev);
                setMobileMenuOpen(false);
                setFeedback(null);
                void loadAllInvitations();
              }}
              aria-expanded={invitationsOpen}
              aria-label={totalPendingCount ? `Lời mời, ${totalPendingCount} lời mời đang chờ` : "Mở hộp thư lời mời"}
              style={{ color: "#125238" }}
              className={`shrink-0 rounded-xl border-emerald-100 px-3 text-xs text-[#125238] ${
                invitationsOpen
                  ? "ring-2 ring-emerald-200/35"
                  : totalPendingCount > 0
                  ? "border-amber-300"
                  : ""
              }`}
            >
              <span className="inline-flex items-center gap-2"><HeaderIcon name="mail" /><span className="hidden sm:inline">Lời mời</span>
              {totalPendingCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-white">
                  {totalPendingCount}
                </span>
              )}
              </span>
            </Button>

            <a
              href="tel:18009988"
              aria-label="Gọi hỗ trợ SOS 1800-9988"
              className="hidden min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-red-400/40 bg-[#DC2626] px-3 text-xs font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:flex"
            >
              <HeaderIcon name="phone" className="h-3.5 w-3.5" /><span>SOS <span className="hidden xl:inline">1800-9988</span></span>
            </a>

            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/5 p-1.5 sm:gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-emerald-100 ring-2 ring-white/40">
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

                <div className="hidden max-w-[110px] text-left sm:block" title={displayName}>
                  <div className="truncate text-[12px] font-bold leading-tight text-white">
                    {displayName}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] font-medium text-emerald-200">
                    {user?.role === "LEADER" ? "Leader" : "Trekker"}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  window.location.href = "/public/login";
                }}
                className="shrink-0 border-l border-white/20 px-2.5 text-xs text-emerald-100 hover:bg-white/10 hover:text-white max-sm:hidden"
                aria-label="Đăng xuất"
                title="Đăng xuất"
                style={{ color: "#D1FAE5" }}
              >
                <HeaderIcon name="logout" />
              </Button>
            </div>

            {/* Compact navigation below the desktop breakpoint. */}
            <Button
              variant="secondary"
              size="md"
              id="user-menu-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
              aria-expanded={mobileMenuOpen}
              aria-controls="user-mobile-navigation"
              style={{ paddingInline: 0, color: "#125238" }}
              className="w-11 shrink-0 rounded-xl border-emerald-100 px-0 text-[#125238] lg:hidden"
            >
              <HeaderIcon name={mobileMenuOpen ? "close" : "menu"} className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="hidden border-t border-white/10 bg-[#104A32] lg:block min-[114rem]:hidden">
          <nav aria-label="Điều hướng chính" className="mx-auto flex max-w-[1920px] items-center justify-start gap-1.5 overflow-x-auto px-6 py-3 xl:justify-center">
            {HEADER_LINKS.map((item) => <HeaderNavLink key={item.href} item={item} pathname={pathname} />)}
          </nav>
        </div>

        {/* Responsive navigation uses the same links and colors. */}
        {mobileMenuOpen && (
          <div id="user-mobile-navigation" className="absolute inset-x-0 top-full max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-white/15 bg-[#125238] px-4 pb-4 pt-4 shadow-xl lg:hidden">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Khám phá & quản lý hành trình</p>
            <nav aria-label="Điều hướng trên màn hình nhỏ" className="grid grid-cols-2 gap-2">
              {HEADER_LINKS.map((item) => <HeaderNavLink key={item.href} item={item} pathname={pathname} mobile />)}
            </nav>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-3 sm:hidden">
              <div className="truncate text-xs font-bold text-white">
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
            <a href="tel:18009988" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300/30 bg-red-600 px-3 text-xs font-bold text-white md:hidden"><HeaderIcon name="phone" />SOS · 1800-9988</a>
          </div>
        )}

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
