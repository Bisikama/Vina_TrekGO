"use client";

import { useEffect, useState } from "react";
import { TripCard } from "./TripCard";
import { mockTripsData, type TripData } from "../data/mockTripsData";
import { listPublicTrips } from "../services";
import type { PublicTripItem } from "../types/public-trips";

function publicTripToTripData(trip: PublicTripItem): TripData {
  const startAt = new Date(trip.startAt);
  const endAt = new Date(trip.endAt);
  const startDay = startAt.getDate().toString().padStart(2, "0");
  const endDay = endAt.getDate().toString().padStart(2, "0");
  const year = startAt.getFullYear().toString();
  const duration = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24)));
  
  return {
    id: trip.id,
    duration: `${duration} ngày`,
    difficulty: { level: "medium", label: "Trung bình", color: "bg-blue-100 text-blue-700" },
    isVFRSVerified: true,
    location: { name: "Khu vực leo núi", distance: "Cung đường thực tế" },
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=500&auto=format&fit=crop",
    date: { start: startDay, end: endDay, year },
    status: { label: trip.status === 'OPEN' ? 'Đang mở đăng ký' : trip.status, color: "text-emerald-600" },
    title: trip.title,
    description: trip.description || "Chuyến đi tuyệt vời cùng Vina TrekGO",
    leader: { name: "Leader", avatar: "/images/avatars/avatar-1.png", badge: "WFA Certified", experience: "Kinh nghiệm chuyên nghiệp", rating: 5, totalTrips: 10, porters: 0 },
    slots: { booked: 0, total: trip.capacity || 15, statusText: "Còn chỗ" },
    price: Number(trip.price) || 0,
    action: { label: "Xem chi tiết", variant: "primary" as const },
  };
}

export const TripListPage = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [trips, setTrips] = useState<TripData[]>([]);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const data = await listPublicTrips({ page: 1, pageSize: 20 });
        const mapped = data.map(publicTripToTripData);
        setTrips(mapped);
      } catch (err) {
        console.error("Failed to fetch public trips:", err);
        setTrips(mockTripsData); // Fallback to mock data if API fails
      }
    };
    fetchTrips();
  }, []);

  return (
    <div className="bg-[#F7F7F4] min-h-screen">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center text-[11px] text-gray-500 font-medium mb-3 gap-2">
            <span className="hover:text-gray-900 cursor-pointer">Trang chủ</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            <span className="text-gray-900">Chuyến đi ghép đoàn công khai</span>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Chuyến Đi Khởi Hành Sắp Tới</h1>
              <p className="text-sm text-gray-600 leading-relaxed">
                Gia nhập các đoàn leo núi do Trưởng đoàn (Leader) chuyên nghiệp dẫn dắt, đạt chứng chỉ Cứu hộ Dã ngoại Quốc tế (WFA), định vị vệ tinh bảo trợ và trang bị an toàn tiêu chuẩn VFRS.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="bg-white border border-gray-200 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  38 chuyến đang mở đăng ký
                </span>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-100">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  100% Bảo hiểm & Giám sát SOS VFRS
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                  Tiêu chuẩn Leader
                </button>
                <button className="bg-[#1B5E41] hover:bg-[#154B36] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                  Yêu cầu đoàn riêng
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Điểm đến */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Điểm đến
              </label>
              <div className="relative">
                <select className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#1B5E41] focus:border-[#1B5E41] block p-2.5 font-medium pr-8 outline-none cursor-pointer">
                  <option>Tất cả điểm đến</option>
                  <option>Tây Bắc & Miền Bắc</option>
                  <option>Tây Nguyên</option>
                  <option>Miền Nam</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {/* Thời gian khởi hành */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Thời gian khởi hành
              </label>
              <div className="relative">
                <select className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#1B5E41] focus:border-[#1B5E41] block p-2.5 font-medium pr-8 outline-none cursor-pointer">
                  <option>Tháng 11 - Tháng 12, 2024</option>
                  <option>Tháng 1 - Tháng 2, 2025</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {/* Cấp độ thử thách */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                Cấp độ thử thách
              </label>
              <div className="relative">
                <select className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#1B5E41] focus:border-[#1B5E41] block p-2.5 font-medium pr-8 outline-none cursor-pointer">
                  <option>Trung bình (Sức bền ổn)</option>
                  <option>Dễ - Trung bình</option>
                  <option>Khó / Thử thách</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {/* Khoảng ngân sách */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Khoảng ngân sách
                </label>
                <div className="relative">
                  <select className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#1B5E41] focus:border-[#1B5E41] block p-2.5 font-medium pr-8 outline-none cursor-pointer">
                    <option>1.500.000đ - 3.000.000đ</option>
                    <option>Dưới 1.500.000đ</option>
                    <option>Trên 3.000.000đ</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
              <button className="bg-[#1B5E41] hover:bg-[#154B36] text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 h-[42px]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                Lọc kết quả
              </button>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2.5 rounded-lg transition-colors h-[42px] flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between border-t border-gray-100 pt-4 mt-2 gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-bold text-gray-500">Lối tắt:</span>
              <button className="bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors border border-orange-100">🔥 Săn mây Tà Xùa & Y Tý</button>
              <button className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors border border-emerald-100">🌲 Cung đường rừng Miền Nam</button>
              <button className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors border border-blue-100">⏱ Khởi hành 48h tới</button>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors border border-gray-200">✓ Chỉ đoàn còn chỗ</button>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <span className="text-[11px] font-bold text-gray-500">Chế độ xem:</span>
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setViewMode('grid')} 
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                </button>
                <button 
                  onClick={() => setViewMode('list')} 
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Info & Tags */}
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-gray-900">Hiển thị {trips.length} chuyến đi phù hợp</span>
            <div className="hidden md:flex items-center gap-2 ml-2">
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">Tây Bắc & Miền Bắc <button className="hover:text-blue-900">&times;</button></span>
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">Độ khó: Trung bình <button className="hover:text-blue-900">&times;</button></span>
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">Còn chỗ trống <button className="hover:text-blue-900">&times;</button></span>
              <button className="text-gray-500 hover:text-gray-700 text-xs font-medium ml-1">Xóa tất cả</button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 font-medium text-xs">Sắp xếp:</span>
            <select className="bg-transparent font-bold text-gray-900 outline-none cursor-pointer border-none p-0 pr-4 focus:ring-0 text-sm">
              <option>Khởi hành gần nhất</option>
              <option>Giá từ thấp đến cao</option>
              <option>Đánh giá cao nhất</option>
            </select>
          </div>
        </div>

        {/* Grid of Trips */}
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {trips.map(trip => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-10">
          <div className="text-xs text-gray-500 font-medium">
            Hiển thị trang <span className="font-bold text-gray-900">1</span> trong tổng số <span className="font-bold text-gray-900">7</span> trang (38 kết quả)
          </div>
          <div className="flex items-center gap-1">
            <button className="text-gray-400 text-xs font-bold px-3 py-2 flex items-center gap-1 cursor-not-allowed">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              Trước
            </button>
            <button className="bg-[#1B5E41] text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold">1</button>
            <button className="hover:bg-gray-100 text-gray-700 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors">2</button>
            <button className="hover:bg-gray-100 text-gray-700 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors">3</button>
            <span className="text-gray-400 px-1">...</span>
            <button className="hover:bg-gray-100 text-gray-700 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors">7</button>
            <button className="text-gray-900 hover:text-[#1B5E41] text-xs font-bold px-3 py-2 flex items-center gap-1 transition-colors">
              Sau
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>

        {/* Not Found CTA */}
        <div className="mt-12 bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-50 rounded-full opacity-50 blur-3xl pointer-events-none"></div>
          
          <div className="flex-1 relative z-10">
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-bold mb-3 border border-emerald-100 uppercase tracking-wide">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              Dành cho nhóm bạn & Doanh nghiệp
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-2">
              Chưa tìm thấy chuyến đi đúng lịch trình mong muốn?
            </h3>
            <p className="text-sm text-gray-600 max-w-2xl leading-relaxed">
              Đừng lo lắng! Trekking System kết nối bạn với hơn 120 Trưởng đoàn được kiểm định để thiết kế chuyến đi riêng phù hợp thể lực, thời gian và mục tiêu của bạn.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 relative z-10">
            <button className="bg-[#1B5E41] hover:bg-[#154B36] text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm">
              Yêu cầu tạo đoàn riêng
            </button>
            <button className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-6 py-3 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              Tư vấn tuyến đường
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
