"use client";

import { useState } from "react";
import { TripData } from "../../data/mockTripsData";

export const BookingSidebar = ({ trip }: { trip: TripData }) => {
  const [participants, setParticipants] = useState(2);
  const isFullyBooked = trip.slots.booked >= trip.slots.total;
  
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden sticky top-24">
      {/* Price Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Giá trọn gói / người</div>
            <div className="text-2xl font-extrabold text-[#1B5E41]">
              {trip.price.toLocaleString('vi-VN')}đ
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-gray-400 line-through">2.850.000đ</div>
            <div className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-100">-14% Early Bird</div>
          </div>
        </div>
      </div>

      {/* Booking Form */}
      <div className="p-5 space-y-4">
        {/* Date Selector */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2">Chọn ngày khởi hành</label>
          <div className="w-full border border-gray-200 rounded-xl p-3 flex items-center justify-between bg-gray-50/50 cursor-not-allowed">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <div className="text-sm font-bold text-gray-900">{trip.date.start} - {trip.date.end}/{trip.date.year}</div>
            </div>
            <div className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">Cố định</div>
          </div>
        </div>

        {/* Participants Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-gray-700">Số lượng thành viên</label>
            <span className="text-[10px] font-medium text-emerald-600">{trip.slots.statusText || `Còn ${trip.slots.total - trip.slots.booked} chỗ`}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl w-32 shrink-0">
              <button 
                onClick={() => setParticipants(Math.max(1, participants - 1))}
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
                disabled={isFullyBooked}
              >
                -
              </button>
              <div className="flex-1 text-center font-bold text-gray-900">{participants}</div>
              <button 
                onClick={() => setParticipants(Math.min(trip.slots.total - trip.slots.booked, participants + 1))}
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
                disabled={isFullyBooked}
              >
                +
              </button>
            </div>
            <div className="flex-1 text-right">
              <div className="text-[10px] text-gray-500 font-medium">Tổng tạm tính</div>
              <div className="text-lg font-bold text-gray-900">{(trip.price * participants).toLocaleString('vi-VN')}đ</div>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-start gap-2.5 mt-2">
          <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div className="text-[11px] text-emerald-800 leading-tight">
            Tài khoản đã xác thực. Bạn sẽ không bị trừ tiền ngay cho đến khi Leader xác nhận lịch đặt.
          </div>
        </div>

        <a 
          href={`/bookings/${trip.id}`}
          className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
            isFullyBooked 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none' 
            : 'bg-[#1B5E41] hover:bg-[#154B36] text-white shadow-md shadow-emerald-900/10'
          }`}
        >
          {isFullyBooked ? 'Đã hết chỗ' : 'Đặt chuyến đi này'}
          {!isFullyBooked && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
        </a>

        <button className="w-full py-2 rounded-xl font-bold text-xs text-[#1B5E41] bg-[#1B5E41]/10 hover:bg-[#1B5E41]/20 transition-colors flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          Yêu cầu tư vấn thêm qua Zalo/Hotline
        </button>

        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 pt-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          Bảo mật thanh toán VNPAY/Momo 100%
        </div>
      </div>
    </div>
  );
};
