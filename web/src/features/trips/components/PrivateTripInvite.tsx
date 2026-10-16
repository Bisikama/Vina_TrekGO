"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivateTripMembership } from "../hooks/usePrivateTripMembership";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function PrivateTripInvite({ code }: { code: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { loadInvitation, joinTrip, invitation, busy, error } = usePrivateTripMembership();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (code) {
      loadInvitation(code);
    }
  }, [code, loadInvitation]);

  const handleJoin = async () => {
    if (!invitation?.trip?.id) return;
    try {
      // Use any for version since it's not strongly typed in the new structure yet
      const res = await joinTrip(code, (invitation.trip as any).version);
      setSuccess(true);
      // Chuyển hướng tới phòng chờ sau 2s
      setTimeout(() => {
        router.push(`/trip-room/${res.tripId}`);
      }, 2000);
    } catch (e) {
      // Error handled by hook
    }
  };

  if (busy && !invitation) return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <svg className="animate-spin h-8 w-8 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    </div>
  );
  if (error) return <div className="p-8 text-center text-red-600 font-bold bg-white rounded-2xl shadow-sm border border-red-100 max-w-lg mx-auto mt-10">{error}</div>;
  if (!invitation) return <div className="p-8 text-center text-gray-500 font-bold bg-white rounded-2xl shadow-sm max-w-lg mx-auto mt-10">Không tìm thấy lời mời.</div>;

  const trip = invitation.trip;
  
  return (
    <div className="max-w-xl mx-auto mt-10 overflow-hidden rounded-2xl bg-white shadow-xl shadow-emerald-900/5 border border-emerald-100">
      {/* Header section with abstract pattern */}
      <div className="bg-emerald-600 px-8 py-10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
            <path d="M152,-132.8C202.9,-112.5,254.2,-79.8,272.7,-34.5C291.1,10.8,276.7,68.7,243.6,115.3C210.5,161.9,158.6,197.3,103.5,206.5C48.4,215.7,-9.8,198.8,-57.8,172.1C-105.8,145.4,-143.6,108.9,-173.3,62.8C-203,16.7,-224.6,-39,-208,-83.4C-191.4,-127.8,-136.6,-160.9,-85.4,-181C-34.2,-201.1,13.4,-208.3,58.7,-197.6C104,-186.9,146.9,-158.3,152,-132.8Z" fill="white" transform="translate(200 200)" />
          </svg>
        </div>
        
        <div className="relative z-10">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl mx-auto flex items-center justify-center mb-4 border border-white/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-emerald-100 font-medium tracking-widest text-xs uppercase mb-2">Thư Mời Tham Gia</p>
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">{trip?.title || "Chuyến đi riêng tư"}</h1>
        </div>
      </div>
      
      {/* Divider */}
      <div className="relative h-6 bg-white -mt-3 flex justify-between px-4 z-20">
        <div className="w-6 h-6 bg-[#F7F7F4] rounded-full -mt-3 shadow-inner"></div>
        <div className="w-full h-0 border-t-2 border-dashed border-gray-200 mt-0.5 mx-2"></div>
        <div className="w-6 h-6 bg-[#F7F7F4] rounded-full -mt-3 shadow-inner"></div>
      </div>

      <div className="px-8 pb-10 pt-2 bg-white relative z-10">
        <div className="mb-8">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl mb-6">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-gray-500 font-bold overflow-hidden">
              {trip?.host?.displayName?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Trưởng đoàn (Host)</p>
              <p className="text-base font-bold text-gray-900">{trip?.host?.displayName || "Ẩn danh"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-xs font-bold uppercase tracking-wide">Bắt đầu</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">
                {trip?.startAt ? new Date(trip.startAt).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'}) : "Chưa rõ"}
              </p>
            </div>
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xs font-bold uppercase tracking-wide">Kết thúc</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">
                {trip?.endAt ? new Date(trip.endAt).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'}) : "Chưa rõ"}
              </p>
            </div>
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                <span className="text-xs font-bold uppercase tracking-wide">Sĩ số</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">
                {trip?.activeMemberCount || 1} / {trip?.capacity || 1} người
              </p>
            </div>
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xs font-bold uppercase tracking-wide">Tình trạng</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">
                {invitation.invite?.status === 'ACTIVE' ? 'Còn hạn' : 'Hết hạn'}
              </p>
            </div>
          </div>
        </div>

        {success ? (
          <div className="p-5 bg-emerald-100 text-emerald-800 text-center rounded-2xl font-bold flex items-center justify-center gap-2 border border-emerald-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Tham gia thành công! Đang chuyển hướng...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-8">
            <button 
              onClick={handleJoin} 
              disabled={busy || !invitation.joinable || !user}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-colors disabled:opacity-50 disabled:hover:bg-emerald-600 text-lg shadow-lg shadow-emerald-600/30 flex justify-center items-center gap-2"
            >
              {busy ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Đang xử lý...
                </>
              ) : "Xác Nhận Tham Gia"}
            </button>
            {!user && (
              <div className="w-full p-4 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-medium text-center">
                Bạn cần đăng nhập để tham gia chuyến đi này.
              </div>
            )}
            {!invitation.joinable && (
              <div className="w-full p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium text-center">
                {invitation.joinDisabledReason || "Lời mời đã hết hạn hoặc hết chỗ."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
