"use client";

import React, { useState } from "react";
import { usePrivateTrips } from "@/features/trips/hooks/usePrivateTrips";
import Link from "next/link";
import { PrivateTripMap } from "./PrivateTripMap";
import { usePrivateTripMembership } from "@/features/trips/hooks/usePrivateTripMembership";

export function PrivateTripDetailClient({ initialTrip, initialPickups }: { initialTrip: any, initialPickups?: any[] }) {
  const { busy, invite, cancel } = usePrivateTrips();
  const [inviteCode, setInviteCode] = useState("");
  const [trip, setTrip] = useState(initialTrip);

  // Lấy tên thay vì ID (sử dụng initialPickups lấy từ server)
  const pickupName = initialPickups?.find(p => p.id === trip?.pickupPointId)?.name || trip?.pickupPointId || "Đang tải...";

  const { members, loadMembers, removeMember } = usePrivateTripMembership();
  
  React.useEffect(() => {
    if (trip?.id) {
      loadMembers(trip.id, { status: 'ACTIVE' });
    }
  }, [trip?.id, loadMembers]);

  if (!trip) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start">
        <svg className="w-5 h-5 mr-3 shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>Không tìm thấy thông tin chuyến đi.</p>
      </div>
    );
  }

  const handleGenerateInvite = async () => {
    try {
      const res = await invite(trip);
      if (res?.inviteCode) {
        setInviteCode(res.inviteCode);
      }
    } catch (e) {
      // Error handled by hook
    }
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
        <svg className="w-5 h-5 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
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
            
            <div className="flex flex-wrap items-center gap-3">
              {trip.status !== 'CANCELLED' && (
                <>
                  <button
                    onClick={handleGenerateInvite}
                    disabled={busy}
                    className="flex-1 flex justify-center items-center gap-2 px-4 py-2.5 bg-[#125238] text-white rounded-xl hover:bg-[#0f402c] transition-colors text-sm font-bold shadow-sm disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Mã Mời
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-sm font-bold shadow-sm disabled:opacity-50"
                  >
                    Huỷ
                  </button>
                </>
              )}
            </div>
          </div>
          {inviteCode && (
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-200 flex flex-col gap-4 shadow-sm animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-600 shrink-0">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">Mã mời nhóm</h4>
                  <p className="text-[11px] text-emerald-700">Sao chép liên kết/mã này gửi cho bạn bè.</p>
                </div>
              </div>
              <div className="bg-white pl-6 pr-2 py-2 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between gap-3 overflow-hidden">
                <span className="font-mono text-[14px] font-black tracking-widest text-emerald-800 truncate select-all flex-1 text-center">
                  {inviteCode}
                </span>
                <button 
                  onClick={() => navigator.clipboard.writeText(inviteCode)}
                  className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl shrink-0 transition-colors cursor-pointer"
                  title="Sao chép"
                >
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
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
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
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
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h4 className="text-sm font-bold text-gray-900">Quy mô nhóm</h4>
              </div>
              <div className="mt-auto">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-black text-emerald-600">{trip.maxPax}</span>
                  <span className="text-sm font-bold text-gray-400">người</span>
                </div>
              </div>
            </div>

            {/* Card 3: Location */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200/60 shadow-sm hover:border-emerald-200 transition-all flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl text-orange-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
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
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h4 className="text-sm font-bold text-gray-900">Thành viên ({members.length})</h4>
              </div>
              <div className="mt-2 space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {members.length > 0 ? members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden">
                        {m.user?.avatarUrl ? <img src={m.user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : m.user?.fullName?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 line-clamp-1">{m.user?.fullName}</p>
                        <p className="text-[10px] font-medium text-gray-500">{m.role === 'HOST' ? 'Trưởng đoàn' : 'Thành viên'}</p>
                      </div>
                    </div>
                  </div>
                )) : (
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
                  <svg className="w-4 h-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                  Danh sách Checkpoints
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trip.tripCheckpointsViaTripId.map((cp: any, idx: number) => (
                    <div key={cp.id} className="bg-gray-50 p-3 rounded-2xl border border-gray-100 hover:bg-white hover:border-emerald-200 transition-all flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-white shrink-0 text-xs shadow-sm ${
                        idx === 0 ? "bg-emerald-500" : (idx === trip.tripCheckpointsViaTripId.length - 1 ? "bg-red-500" : "bg-orange-500")
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
    </div>
  );
}
