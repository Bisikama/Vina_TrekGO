"use client";

import React, { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { usePrivateTrips } from "@/features/trips/hooks/usePrivateTrips";
import Link from "next/link";
import { PrivateTripMap } from "./PrivateTripMap";
import { PrivateTripDirectInviteModal } from "../PrivateTripDirectInviteModal";
import { usePrivateTripMembership } from "@/features/trips/hooks/usePrivateTripMembership";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function PrivateTripDetailClient({ initialTrip, initialPickups }: { initialTrip: any, initialPickups?: any[] }) {
  const { user } = useAuth();
  const { busy, invite, cancel } = usePrivateTrips();
  const [inviteCode, setInviteCode] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [trip, setTrip] = useState(initialTrip);
  const [memberStatusFilter, setMemberStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [isDirectInviteModalOpen, setIsDirectInviteModalOpen] = useState(false);

  // Lấy tên thay vì ID (sử dụng initialPickups lấy từ server)
  const pickupName = initialPickups?.find(p => p.id === trip?.pickupPointId)?.name || trip?.pickupPointId || "Đang tải...";

  const { members, activeMemberCount, busy: membersBusy, loadMembers, removeMember } = usePrivateTripMembership();
  const isHost = Boolean(user?.id && trip?.hostId && user.id === trip.hostId);

  React.useEffect(() => {
    if (trip?.id) {
      loadMembers(trip.id, { status: memberStatusFilter, pageSize: 50 });
    }
  }, [trip?.id, memberStatusFilter, loadMembers]);

  if (!trip) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start">
        <svg className="w-5 h-5 mr-3 shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        <p>Không tìm thấy thông tin chuyến đi.</p>
      </div>
    );
  }

  const handleGenerateInvite = async () => {
    try {
      const res = await invite(trip);
      if (res?.inviteCode) {
        setInviteCode(res.inviteCode);
        // Link chia sẻ là URL server trả (WEB_APP_ORIGIN của môi trường deploy),
        // không ghép origin phía client để tránh link localhost khi gửi qua Zalo.
        setInviteUrl(res.inviteUrl || "");
        setInviteExpiresAt(res.expiresAt || null);
        setTrip((prev: any) => prev ? { ...prev, version: res.tripVersion } : prev);
      }
    } catch (e) {
      // Error handled by hook
    }
  };

  const getInviteUrl = () => {
    if (!inviteCode) return "";
    if (inviteUrl) return inviteUrl;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/invite/${inviteCode}`;
    }
    return `/invite/${inviteCode}`;
  };

  const handleCopyInvite = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(getInviteUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `qr-moi-chuyen-di-${trip.id?.slice(0, 8) || "trekgo"}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleCancel = async () => {
    if (confirm("Bạn có chắc chắn muốn huỷ chuyến đi này không? Mọi người sẽ không thể tham gia nữa.")) {
      try {
        await cancel(trip, "Huỷ bởi người dùng");
        setTrip({ ...trip, status: "CANCELLED" });
      } catch (e) {
        // Error handled by hook
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm">Đang Mở Đăng Ký</span>;
      case 'CANCELLED':
        return <span className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm">Đã Huỷ</span>;
      case 'IN_PROGRESS':
        return <span className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm">Đang Diễn Ra</span>;
      case 'COMPLETED':
        return <span className="px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm">Đã Hoàn Thành</span>;
      default:
        return <span className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm">{status}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  return (
    <div className="w-full mx-auto space-y-8 animate-in fade-in duration-500 pb-16">

      {/* Navigation */}
      <Link href="/my-trips" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-[#125238] transition-all hover:-translate-x-1">
        <svg className="w-5 h-5 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
        Quay lại danh sách chuyến đi
      </Link>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* === CỘT TRÁI (THÔNG TIN) === */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">

          {/* Hero Header Area */}
          <div className="relative h-48 md:h-64 w-full bg-gradient-to-br from-[#0f402c] via-[#125238] to-[#1a7550] rounded-3xl overflow-hidden shadow-sm border border-emerald-900/10 shrink-0">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-black/20 blur-2xl"></div>

            <div className="absolute bottom-0 left-0 right-0 p-8 text-white z-10">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {getStatusBadge(trip.status)}
                <span className="px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold tracking-wide uppercase border border-white/20">
                  Private
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2 drop-shadow-md line-clamp-2">
                {trip.title}
              </h1>
              {trip.description && (
                <p className="text-emerald-50 text-sm max-w-2xl font-light line-clamp-1">
                  {trip.description}
                </p>
              )}
            </div>
          </div>


          {/* Action Card */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/60 flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Quản lý chuyến đi</h3>
              <p className="text-gray-500 text-xs mt-1">Điều hành nhóm và trạng thái.</p>
            </div>

            <div className="flex flex-col gap-2.5">
              {trip.status !== 'CANCELLED' && (
                <>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleGenerateInvite}
                      disabled={busy}
                      className="flex-1 flex justify-center items-center gap-2 px-4 py-2.5 bg-[#125238] text-white rounded-xl hover:bg-[#0f402c] transition-colors text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" /></svg>
                      {inviteCode ? "Tạo lại QR mời" : "Tạo mã QR mời"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={busy}
                      className="px-4 py-2.5 bg-white text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-sm font-bold shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      Huỷ
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDirectInviteModalOpen(true)}
                    className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-emerald-50 text-[#125238] border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors text-sm font-bold shadow-sm cursor-pointer"
                  >

                    Mời bạn bè qua Email
                  </button>

                  <Link
                    href={`/trip-room/${trip.id}`}
                    className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors text-xs font-semibold"
                  >

                    Vào phòng chờ đoàn (Trip Room)
                  </Link>
                </>
              )}
            </div>
          </div>
          {inviteCode && (
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-200 flex flex-col items-center gap-4 shadow-sm animate-in fade-in zoom-in duration-300">
              <div className="w-full flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-600 shrink-0">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">Link mời tham gia nhóm</h4>
                  <p className="text-[11px] text-emerald-700">Người có link có thể tham gia khi chuyến đi còn chỗ.</p>
                </div>
              </div>
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-full">
                Tạo link mới sẽ vô hiệu link cũ (thành viên đã vào không bị ảnh hưởng). Gửi cả URL qua Zalo/email, không chỉ mã QR.
              </p>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col items-center">
                <QRCodeCanvas
                  ref={qrCanvasRef}
                  value={getInviteUrl()}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#125238"
                  level="M"
                  includeMargin={true}
                />
                {inviteExpiresAt && (
                  <p className="text-[11px] font-medium text-gray-500 mt-1">
                    Hết hạn: {new Date(inviteExpiresAt).toLocaleString("vi-VN")}
                  </p>
                )}
              </div>

              <div className="w-full grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#125238] text-white hover:bg-[#0f402c] rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Tải ảnh QR
                </button>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100/60 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  {copied ? "Đã chép link!" : "Sao chép link"}
                </button>
              </div>
            </div>
          )}

          {/* Info Cards Grid (Inside left column) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">

            {/* Card 1: Time */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200/60 shadow-sm hover:border-emerald-200 transition-all flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl text-blue-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                </div>
                <h4 className="text-sm font-bold text-gray-900">Lịch trình</h4>
              </div>
              <div className="space-y-3 mt-auto">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex justify-between items-center">
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">BẮT ĐẦU</p>
                  <p className="text-xs font-bold text-gray-900">{formatDate(trip.startAt)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex justify-between items-center">
                  <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">KẾT THÚC</p>
                  <p className="text-xs font-bold text-gray-900">{formatDate(trip.endAt)}</p>
                </div>
              </div>
            </div>

            {/* Card 2: Group Size */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200/60 shadow-sm hover:border-emerald-200 transition-all flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl text-emerald-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </div>
                <h4 className="text-sm font-bold text-gray-900">Quy mô nhóm</h4>
              </div>
              <div className="mt-auto">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-black text-emerald-600">{activeMemberCount || members.filter(m => m.status === 'ACTIVE').length}</span>
                  <span className="text-lg font-bold text-gray-400">/ {trip.maxPax} người</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Đang tham gia: <span className="font-bold text-emerald-700">{activeMemberCount || members.filter(m => m.status === 'ACTIVE').length}</span> tài khoản · Sức chứa tối đa: <span className="font-bold text-gray-700">{trip.maxPax}</span>
                </p>
              </div>
            </div>

            {/* Card 3: Location */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200/60 shadow-sm hover:border-emerald-200 transition-all flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl text-orange-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                </div>
                <h4 className="text-sm font-bold text-gray-900">Điểm tập kết</h4>
              </div>
              <div className="mt-auto">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0 shadow-sm shadow-orange-500/50"></div>
                  <p className="text-xs font-bold text-gray-800 break-words leading-relaxed">
                    {pickupName}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Participants */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200/60 shadow-sm hover:border-emerald-200 transition-all flex flex-col sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Tài khoản tham gia ({members.length})</h4>
                    <p className="text-[11px] text-gray-500">Danh sách tài khoản thành viên trong chuyến đi</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMemberStatusFilter('ACTIVE')}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${memberStatusFilter === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    Đang tham gia
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberStatusFilter('ALL')}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${memberStatusFilter === 'ALL' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    Tất cả
                  </button>
                </div>
              </div>
              <div className="mt-1 space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {members.length > 0 ? members.map(m => {
                  const accountName = m.displayName || m.user?.fullName || `Tài khoản #${m.userId?.slice(0, 8)}`;
                  const avatarUrl = m.user?.avatarUrl;
                  const canKick = isHost && m.role !== 'HOST' && m.status === 'ACTIVE' && trip.status === 'OPEN';
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-emerald-200/70 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-800 overflow-hidden shrink-0">
                          {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : accountName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-gray-900 truncate">{accountName}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${m.role === 'HOST' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}>
                              {m.role === 'HOST' ? 'Trưởng đoàn' : 'Thành viên'}
                            </span>
                            {m.status !== 'ACTIVE' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-200 text-gray-600">
                                {m.status === 'LEFT' ? 'Đã rời' : 'Đã xoá'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-gray-500 truncate mt-0.5">
                            ID tài khoản: <span className="font-mono text-gray-700">{m.userId?.slice(0, 8)}</span>
                            {m.joinedAt && ` • Tham gia: ${new Date(m.joinedAt).toLocaleDateString('vi-VN')}`}
                          </p>
                        </div>
                      </div>
                      {canKick && (
                        <button
                          type="button"
                          disabled={membersBusy}
                          onClick={async () => {
                            if (confirm(`Bạn có chắc muốn loại tài khoản "${accountName}" khỏi chuyến đi?`)) {
                              try {
                                await removeMember(trip.id, m.id, m.version);
                              } catch (err) {
                                // Handled by hook
                              }
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg shrink-0 transition cursor-pointer disabled:opacity-50"
                        >
                          Loại
                        </button>
                      )}
                    </div>
                  );
                }) : (
                  <p className="text-xs text-center text-gray-500 py-4">Chưa có thành viên nào.</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* === CỘT PHẢI (BẢN ĐỒ) === */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6 h-full min-h-[600px] lg:min-h-[800px]">

          {/* Map Section - Spans full width */}
          {/* Map Section */}
          {(trip.tripTrailPlansViaTripId?.[0]?.snapshotGeojson || trip.tripCheckpointsViaTripId?.length > 0) && (
            <div className="bg-white p-2 sm:p-4 rounded-[2rem] border border-gray-200/60 shadow-sm h-full flex flex-col">
              <div className="p-4 sm:p-6 pb-2 shrink-0">
                <h3 className="text-xl font-bold text-gray-900 mb-1">Bản đồ lộ trình 3D</h3>
                <p className="text-gray-500 text-sm">Cung đường thực tế và các điểm tập kết.</p>
              </div>

              <div className="mt-2 rounded-3xl overflow-hidden border border-gray-100 flex-1 min-h-[400px]">
                <PrivateTripMap
                  geojson={trip.tripTrailPlansViaTripId?.[0]?.snapshotGeojson}
                  checkpoints={trip.tripCheckpointsViaTripId}
                />
              </div>

              {trip.tripCheckpointsViaTripId?.length > 0 && (
                <div className="p-4 sm:p-6 pt-6 mt-4 border-t border-gray-100 shrink-0">
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                    Danh sách Checkpoints
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {trip.tripCheckpointsViaTripId.map((cp: any, idx: number) => (
                      <div key={cp.id} className="bg-gray-50 p-3 rounded-2xl border border-gray-100 hover:bg-white hover:border-emerald-200 transition-all flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-white shrink-0 text-xs shadow-sm ${idx === 0 ? "bg-emerald-500" : (idx === trip.tripCheckpointsViaTripId.length - 1 ? "bg-red-500" : "bg-orange-500")
                          }`}>
                          {cp.sequence}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-900 text-xs mb-1 line-clamp-1">{cp.name}</h5>
                          {cp.description && <p className="text-[10px] text-gray-500 line-clamp-1">{cp.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
      <PrivateTripDirectInviteModal
        tripId={trip.id}
        isOpen={isDirectInviteModalOpen}
        onClose={() => setIsDirectInviteModalOpen(false)}
        onMemberJoined={() => loadMembers(trip.id, { status: memberStatusFilter, pageSize: 50 })}
      />
    </div>
  );
}
