"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuthStore } from "@/features/auth";
import { apiClient } from "@/lib/axios";

interface TripItemFromApi {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  startAt: string;
  endAt: string;
  destination?: { id?: string; name?: string } | null;
  leader?: { id?: string; fullName?: string } | null;
  pricePerPax?: string | number | null;
  capacity?: number;
  remainingSlots?: number;
  routes?: Array<{
    id?: string;
    snapshotName?: string;
    snapshotDifficulty?: string;
    snapshotDistanceKm?: string | number;
  }>;
}

const TRIP_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=800&q=80",
];

const LEADER_AVATARS = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
];

export default function PublicLandingPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const [searchLocation, setSearchLocation] = useState("");
  const [searchTime, setSearchTime] = useState("");
  const [activeRegionTab, setActiveRegionTab] = useState("all");

  const [trips, setTrips] = useState<TripItemFromApi[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [tripError, setTripError] = useState<string | null>(null);

  // Fetch trips from http://localhost:5000/api/v1/trips?page=1&pageSize=12
  useEffect(() => {
    let isMounted = true;

    const loadUpcomingTrips = async () => {
      setIsLoadingTrips(true);
      setTripError(null);
      try {
        // Direct call to port 5000 as requested
        const response = await axios.get("http://localhost:5000/api/v1/trips", {
          params: { page: 1, pageSize: 12 },
          timeout: 8000,
        });

        const items = response.data?.items || (Array.isArray(response.data) ? response.data : []);
        if (isMounted) {
          setTrips(items);
        }
      } catch (primaryErr) {
        console.warn("Direct port 5000 request failed, attempting fallback via apiClient...", primaryErr);
        try {
          const fallbackRes = await apiClient.get("/api/v1/trips", {
            params: { page: 1, pageSize: 12 },
          });
          const items = fallbackRes.data?.items || (Array.isArray(fallbackRes.data) ? fallbackRes.data : []);
          if (isMounted) {
            setTrips(items);
          }
        } catch (fallbackErr) {
          console.error("Failed to load upcoming trips from API", fallbackErr);
          if (isMounted) {
            setTripError("Không thể tải danh sách chuyến đi lúc này. Vui lòng thử lại sau.");
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingTrips(false);
        }
      }
    };

    loadUpcomingTrips();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/trips?q=${encodeURIComponent(searchLocation)}`);
  };

  const formatDateRange = (startStr: string, endStr: string) => {
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      const formatD = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
      return `${formatD(start)} - ${formatD(end)}`;
    } catch {
      return "Lịch trình mở";
    }
  };

  const getSlotBadge = (remainingSlots?: number, capacity?: number, status?: string) => {
    if (status === "FULL" || (remainingSlots !== undefined && remainingSlots <= 0)) {
      return {
        text: "Hết chỗ",
        className: "bg-rose-100 text-rose-800 border-rose-200",
      };
    }
    if (remainingSlots !== undefined && remainingSlots <= 3) {
      return {
        text: `Còn ${remainingSlots} chỗ`,
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    }
    return {
      text: remainingSlots !== undefined ? `Còn ${remainingSlots} chỗ` : "Đang mở",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
  };

  // Filter trips by region tab if requested
  const filteredTrips = trips.filter((trip) => {
    if (activeRegionTab === "all") return true;
    const destName = (trip.destination?.name || "").toLowerCase();
    const title = (trip.title || "").toLowerCase();
    const text = `${destName} ${title}`;

    if (activeRegionTab === "north") {
      return text.includes("hà nội") || text.includes("sapa") || text.includes("lào cai") || text.includes("lai châu") || text.includes("sơn la") || text.includes("y tý") || text.includes("bắc");
    }
    if (activeRegionTab === "central") {
      return text.includes("đà nẵng") || text.includes("huế") || text.includes("quảng bình") || text.includes("nha trang") || text.includes("đà lạt") || text.includes("lâm đồng") || text.includes("trung");
    }
    if (activeRegionTab === "south") {
      return text.includes("hồ chí minh") || text.includes("hcm") || text.includes("núi dinh") || text.includes("vũng tàu") || text.includes("bà đen") || text.includes("tây ninh") || text.includes("nam");
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#1F2937] flex flex-col font-sans selection:bg-[#2F6B4F] selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER / NAVBAR (Overlay over hero)
      ───────────────────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-50 transition-all bg-gradient-to-b from-black/75 via-black/40 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo with exact image from public */}
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg"
              alt="Vina TrekGo Logo"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl object-cover shadow-md border border-white/20 group-hover:scale-105 transition-transform"
            />
            <div className="flex items-center">
              <span className="font-extrabold text-2xl tracking-tight text-white drop-shadow-sm">
                Vina Trek<span className="text-[#F59E0B]">Go</span>
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-white/90">
            <Link href="/routes" className="hover:text-white transition drop-shadow-xs">
              Cung đường
            </Link>
            <a href="#chuyen-di" className="hover:text-white transition drop-shadow-xs">
              Chuyến đi
            </a>
            <Link href="/rentals" className="hover:text-white transition drop-shadow-xs">
              Thuê đồ
            </Link>
            <a href="#tinh-nang" className="hover:text-white transition drop-shadow-xs">
              Tính năng
            </a>
            <a href="#ve-chung-toi" className="hover:text-white transition drop-shadow-xs">
              Về chúng tôi
            </a>
          </nav>

          {/* Action Buttons: Đăng nhập & Đăng ký */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20">
                <span className="text-xs font-semibold text-white drop-shadow-xs">
                  {user.name}
                </span>
                <button
                  onClick={logout}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-full transition cursor-pointer"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/public/login"
                  className="px-3.5 py-2 text-sm font-medium text-white hover:text-white/80 transition cursor-pointer"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/public/register"
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#2F6B4F] hover:bg-[#1F4A36] rounded-full shadow-md transition cursor-pointer border border-emerald-400/30"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[640px] lg:min-h-[720px] flex items-center justify-center pt-24 pb-16 overflow-hidden">
        {/* Hero Background Image with Atmospheric Gradient */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-trekking.jpg"
            alt="Vina TrekGo Trekking in Vietnam Mountains"
            fill
            priority
            className="object-cover object-center scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/75" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white flex flex-col items-center">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white/90 text-xs font-medium mb-5">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            NỀN TẢNG TREKKING SỐ 1 VIỆT NAM
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-none drop-shadow-lg mb-4">
            Vina Trek<span className="text-[#F59E0B]">Go</span>
          </h1>

          {/* Tagline */}
          <p className="max-w-2xl text-base sm:text-lg text-gray-200 leading-relaxed font-normal drop-shadow-md mb-8">
            Khám phá vẻ đẹp bất tận trên những cung đường trekking Việt Nam — An toàn, độc bản và trọn vẹn từng bước chân.
          </p>

          {/* Search Bar Container */}
          <div className="w-full max-w-3xl bg-white rounded-full p-2 sm:p-2.5 shadow-2xl border border-white/20 flex flex-col sm:flex-row items-center gap-2 text-[#1F2937]">
            {/* Location Input */}
            <div className="flex-1 flex items-center gap-2.5 px-4 py-2 w-full border-b sm:border-b-0 sm:border-r border-gray-200">
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="text"
                placeholder="Bạn muốn đi đâu?"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="w-full bg-transparent text-sm text-[#1F2937] placeholder-gray-400 focus:outline-none"
              />
            </div>

            {/* Date Input */}
            <div className="flex-1 flex items-center gap-2.5 px-4 py-2 w-full">
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="text"
                placeholder="Thời gian dự kiến"
                value={searchTime}
                onChange={(e) => setSearchTime(e.target.value)}
                className="w-full bg-transparent text-sm text-[#1F2937] placeholder-gray-400 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSearchSubmit}
              className="w-full sm:w-auto px-7 py-3 bg-[#2F6B4F] hover:bg-[#1F4A36] text-white text-sm font-semibold rounded-full transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-md"
            >
              <svg className="w-4 h-4 fill-none stroke-current" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <span>Tìm kiếm</span>
            </button>
          </div>

          {/* Quick filter keywords below search bar */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-white/80">
            <span className="font-medium text-white/60">Gợi ý:</span>
            {["Núi Dinh", "Fansipan", "Tà Xùa", "Bạch Mộc Lương Tử", "Bidoup Núi Bà", "Lảo Thẩn"].map((item) => (
              <button
                key={item}
                onClick={() => setSearchLocation(item)}
                className="px-3 py-1 rounded-full bg-black/30 hover:bg-black/50 border border-white/15 backdrop-blur-xs text-white text-xs transition cursor-pointer"
              >
                {item}
              </button>
            ))}
          </div>

          {/* Bottom Right Telemetry */}
          <div className="mt-10 sm:mt-12 flex items-center justify-center gap-6 text-xs text-white/80">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15">
              <span className="font-bold text-[#F59E0B] tabular-nums">50+</span>
              <span>Cung đường khảo sát</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15">
              <span className="text-amber-400">★</span>
              <span className="font-bold text-white tabular-nums">4.9/5</span>
              <span className="text-white/60">(10k+ đánh giá)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. CORE VALUE PROPOSITION & APP SHOWCASE
          "Một nền tảng cho trọn vẹn hành trình trekking"
      ───────────────────────────────────────────────────────────── */}
      <section id="tinh-nang" className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Dark Forest Green Curved Showcase with 3 Smartphone Mockups */}
        <div className="relative bg-[#133E2B] rounded-3xl p-6 sm:p-10 lg:p-14 overflow-hidden shadow-2xl mb-16 border border-emerald-900/30">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#AEE9C6_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* 3 Smartphone Mockups */}
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-6 lg:gap-8 pt-4 pb-2">
            {/* Phone 1: App Feed / Explorer */}
            <div className="w-[240px] sm:w-[260px] h-[460px] bg-slate-900 rounded-[38px] p-2.5 shadow-2xl border-4 border-slate-700/80 flex flex-col transform md:-translate-y-2 hover:-translate-y-4 transition-all duration-300">
              <div className="relative w-full h-full bg-[#F7F7F4] rounded-[28px] overflow-hidden flex flex-col text-[#1F2937]">
                <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mt-1.5 mb-2" />
                <div className="px-3 pb-2 flex items-center justify-between border-b border-gray-200">
                  <span className="text-[11px] font-bold text-[#125238]">Khám phá cung đường</span>
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] text-emerald-800 font-bold">VN</div>
                </div>
                <div className="px-3 pt-2">
                  <div className="bg-white rounded-lg px-2 py-1 text-[10px] text-gray-400 border border-gray-200 flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="7" strokeWidth={2} />
                      <path d="M20 20l-4-4" strokeWidth={2} />
                    </svg>
                    <span>Tìm kiếm cung đường...</span>
                  </div>
                </div>
                <div className="flex gap-1 px-3 py-2 text-[9px]">
                  <span className="bg-[#2F6B4F] text-white px-2 py-0.5 rounded-full font-medium">Tất cả</span>
                  <span className="bg-white text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">Miền Bắc</span>
                  <span className="bg-white text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">Miền Nam</span>
                </div>
                <div className="mx-3 bg-white rounded-xl overflow-hidden shadow-xs border border-gray-200 mb-2">
                  <div className="relative h-20 w-full bg-gray-300">
                    <img
                      src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=400&q=80"
                      alt="Tà Xùa"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">Khó</span>
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] font-bold text-gray-800 truncate">Tà Xùa - Sống Lưng Khủng Long</p>
                    <p className="text-[9px] text-gray-500">18km • 2N1Đ • 2,865m</p>
                  </div>
                </div>
                <div className="mx-3 bg-white rounded-xl overflow-hidden shadow-xs border border-gray-200 flex-1">
                  <div className="relative h-16 w-full bg-gray-300">
                    <img
                      src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80"
                      alt="Lảo Thẩn"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-1.5">
                    <p className="text-[10px] font-bold text-gray-800 truncate">Lảo Thẩn - Nóc Nhà Y Tý</p>
                  </div>
                </div>
                <div className="h-8 bg-white border-t border-gray-200 flex items-center justify-around text-gray-400">
                  <svg className="w-3.5 h-3.5 text-[#2F6B4F]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  </svg>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                  </svg>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Phone 2 (Center Hero Phone): GPS Map Trail Navigation */}
            <div className="w-[250px] sm:w-[280px] h-[490px] bg-slate-900 rounded-[42px] p-2.5 shadow-2xl border-4 border-emerald-500/50 flex flex-col transform md:-translate-y-6 hover:-translate-y-8 transition-all duration-300 z-20">
              <div className="relative w-full h-full bg-[#E5ECE7] rounded-[32px] overflow-hidden flex flex-col text-[#1F2937]">
                <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mt-1.5 mb-2 z-10" />
                <div className="px-3 pb-2 flex items-center justify-between text-[11px] font-bold text-gray-800 z-10">
                  <span className="bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>Bạch Mộc Lương Tử</span>
                  </span>
                  <span className="bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold animate-pulse">GPS LIVE</span>
                </div>
                <div className="relative flex-1 bg-[#d8e6db] overflow-hidden">
                  <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 200 300">
                    <path d="M 0,50 Q 80,20 150,80 T 200,120" fill="none" stroke="#2F6B4F" strokeWidth="1" />
                    <path d="M 0,100 Q 100,60 160,140 T 200,180" fill="none" stroke="#2F6B4F" strokeWidth="1" />
                    <path d="M 0,160 Q 90,120 140,210 T 200,240" fill="none" stroke="#2F6B4F" strokeWidth="1" />
                  </svg>

                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 300">
                    <path
                      d="M 50,260 Q 90,210 70,160 T 130,100 T 150,40"
                      fill="none"
                      stroke="#2F6B4F"
                      strokeWidth="4"
                      strokeDasharray="4 3"
                    />
                    <circle cx="50" cy="260" r="6" fill="#1F4A36" />
                    <circle cx="70" cy="160" r="5" fill="#F59E0B" />
                    <circle cx="150" cy="40" r="7" fill="#DC2626" />
                  </svg>

                  <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-xl p-2.5 shadow-lg border border-gray-200">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                      <span>Tiến độ hành trình</span>
                      <span className="font-bold text-[#2F6B4F]">14.2 / 30 km</span>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mb-2">
                      <div className="bg-[#2F6B4F] h-full w-[48%]" />
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center text-[9px]">
                      <div>
                        <span className="block text-gray-400">Độ cao</span>
                        <span className="font-bold text-gray-800">2,150m</span>
                      </div>
                      <div>
                        <span className="block text-gray-400">Thời gian</span>
                        <span className="font-bold text-gray-800">4h 20m</span>
                      </div>
                      <div>
                        <span className="block text-gray-400">Tốc độ</span>
                        <span className="font-bold text-gray-800">3.2 km/h</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Phone 3: Porter & Preparation Screen */}
            <div className="w-[240px] sm:w-[260px] h-[460px] bg-slate-900 rounded-[38px] p-2.5 shadow-2xl border-4 border-slate-700/80 flex flex-col transform md:-translate-y-2 hover:-translate-y-4 transition-all duration-300">
              <div className="relative w-full h-full bg-[#F7F7F4] rounded-[28px] overflow-hidden flex flex-col text-[#1F2937]">
                <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mt-1.5 mb-2" />
                <div className="px-3 pb-2 flex items-center justify-between border-b border-gray-200">
                  <span className="text-[11px] font-bold text-[#125238]">Đội ngũ & Dịch vụ</span>
                  <span className="text-[10px] text-gray-400">Bước 3/4</span>
                </div>
                <div className="p-3">
                  <div className="bg-white rounded-xl p-2.5 border border-gray-200 shadow-xs mb-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#125238] flex items-center justify-center text-[10px] font-bold">
                        AP
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-800">A Páo (Porter bản địa)</p>
                        <p className="text-[9px] text-emerald-700 font-semibold">10 năm kinh nghiệm • 5.0 ★</p>
                      </div>
                    </div>
                    <span className="inline-block bg-emerald-50 text-[#125238] text-[8px] font-bold px-2 py-0.5 rounded">Đã bao gồm trong tour</span>
                  </div>

                  <div className="bg-white rounded-xl p-2.5 border border-gray-200 shadow-xs">
                    <p className="text-[10px] font-bold text-gray-800 mb-1.5">Trang bị chuẩn bị:</p>
                    <div className="space-y-1 text-[9px] text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span>
                        <span>Lều chống nước 2 lớp</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span>
                        <span>Gậy trekking carbon siêu nhẹ</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-600">✓</span>
                        <span>Túi ngủ giữ nhiệt -5°C</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto p-3 bg-white border-t border-gray-200">
                  <button className="w-full py-1.5 bg-[#2F6B4F] text-white rounded-lg text-[10px] font-bold">
                    Tiếp tục ➔
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards Section Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2F6B4F] bg-[#DCFCE7] px-3 py-1 rounded-full">
              VÌ SAO CHỌN VINA TREKGO
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1F2937] mt-3 tracking-tight">
              Một nền tảng cho trọn vẹn hành trình trekking
            </h2>
          </div>
          <p className="text-sm text-[#6B7280] max-w-md leading-relaxed">
            Chúng tôi giải quyết trọn gói từ khâu lên kế hoạch, chuẩn bị trang thiết bị, kết nối porter bản địa cho tới bảo hiểm và cứu hộ khẩn cấp trên từng dặm đường.
          </p>
        </div>

        {/* 6 Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2F6B4F] flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#1F2937] mb-2">Bản đồ & GPS offline</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Tải bản đồ độ nét cao, định vị chính xác tracklog ngay cả khi bạn hoàn toàn mất sóng điện thoại hay kết nối internet.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2F6B4F] flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#1F2937] mb-2">Cảnh báo an toàn & cứu hộ</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Hệ thống SOS tích hợp trạm kiểm lâm và đội phản ứng nhanh địa phương, sẵn sàng hỗ trợ khẩn cấp 24/7.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2F6B4F] flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#1F2937] mb-2">Cho thuê đồ chuyên dụng</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Trang thiết bị lều trại, balo trợ lực, gậy trekking đạt chuẩn outdoor quốc tế, được tiệt trùng và kiểm tra trước khi bàn giao.
            </p>
          </div>

          {/* Card 4 (Highlighted) */}
          <div className="bg-[#125238] text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <span className="inline-block bg-white/20 text-[#AEE9C6] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-3">
                Cộng đồng
              </span>
              <h3 className="text-lg font-extrabold text-white mb-2">
                Hơn 50.000+ trekker tin dùng
              </h3>
              <p className="text-xs text-gray-200 leading-relaxed mb-4">
                Tham gia mạng lưới trekker lớn nhất Việt Nam, cùng chia sẻ kinh nghiệm, tìm bạn đồng hành và khám phá những tuyến đường mới.
              </p>
            </div>
            <Link
              href="/public/register"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FEA619] hover:underline"
            >
              <span>Khám phá ngay</span>
              <span>→</span>
            </Link>
          </div>

          {/* Card 5 */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2F6B4F] flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#1F2937] mb-2">Porter bản địa</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Đội ngũ dẫn đường am hiểu từng hẻm núi, vách đá, hỗ trợ mang vác hành lý và nấu những bữa ăn ấm nóng giữa rừng.
            </p>
          </div>

          {/* Card 6 */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#2F6B4F] flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#1F2937] mb-2">Cộng đồng chất lượng</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Kho cẩm nang thực chiến, cập nhật liên tục tình trạng sạt lở, mùa hoa, thời tiết và suối cạn theo thời gian thực.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. BANNER: CÙNG ĐƯA NHỮNG CUNG ĐƯỜNG MỚI ĐẾN VỚI CỘNG ĐỒNG
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-[#EDF5F0] rounded-3xl p-6 sm:p-10 lg:p-12 border border-[#CFE3D6] shadow-xs flex flex-col lg:flex-row items-center justify-between gap-10">
          {/* Left Text */}
          <div className="max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2F6B4F] bg-white px-3 py-1 rounded-full border border-emerald-200">
              ĐÓNG GÓP TUYẾN MỚI
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2937] mt-3">
              Cùng đưa những cung đường mới đến với cộng đồng
            </h2>
            <p className="mt-3 text-sm text-[#4B5563] leading-relaxed">
              Bạn là một trekker lão luyện hay porter địa phương? Hãy cùng VinaTrekGO số hóa các cung đường mới để chia sẻ vẻ đẹp hoang sơ và nhận thù lao cộng tác hấp dẫn.
            </p>

            <ul className="mt-5 space-y-2.5 text-xs text-[#374151] font-medium">
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#2F6B4F] text-white flex items-center justify-center text-[10px]">✓</span>
                <span>Chia sẻ tracklog GPS & các điểm mốc tiếp nước, cắm trại</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#2F6B4F] text-white flex items-center justify-center text-[10px]">✓</span>
                <span>Hỗ trợ thẩm định, đánh giá mức độ khó và rủi ro địa hình</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-[#2F6B4F] text-white flex items-center justify-center text-[10px]">✓</span>
                <span>Nhận huy hiệu Chuyên gia tuyến đường & thù lao xứng đáng</span>
              </li>
            </ul>

            <div className="mt-7">
              <Link
                href="/public/register"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#2F6B4F] hover:bg-[#1F4A36] text-white font-bold text-xs sm:text-sm rounded-full shadow-md transition"
              >
                <span>Đăng ký cung đường mới</span>
                <span>➔</span>
              </Link>
            </div>
          </div>

          {/* Right Map Preview Card Graphic */}
          <div className="w-full max-w-md bg-white rounded-2xl p-4 shadow-md border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-gray-800">Tracklog Bản Đồ Số</span>
              </div>
              <span className="text-[10px] font-semibold text-gray-400">Độ phân giải 1m</span>
            </div>

            {/* Graphic Map View */}
            <div className="relative h-44 bg-[#F2F7F4] rounded-xl my-3 overflow-hidden border border-emerald-100">
              <div className="absolute inset-0 bg-[radial-gradient(#2F6B4F_1px,transparent_1px)] [background-size:14px_14px] opacity-20" />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 160">
                <path
                  d="M 30,120 Q 90,40 160,100 T 260,30"
                  fill="none"
                  stroke="#2F6B4F"
                  strokeWidth="3.5"
                />
                <circle cx="30" cy="120" r="5" fill="#1F4A36" />
                <circle cx="160" cy="100" r="4" fill="#F59E0B" />
                <circle cx="260" cy="30" r="6" fill="#DC2626" />
              </svg>

              <div className="absolute bottom-2 left-3 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] font-bold text-gray-700 shadow-xs border border-gray-200">
                Xuất phát: Trạm Kiểm Lâm
              </div>
              <div className="absolute top-2 right-3 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] font-bold text-red-700 shadow-xs border border-red-200">
                Đỉnh: 2,865m
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="bg-[#F7F7F4] p-1.5 rounded-lg border border-gray-100">
                <span className="text-gray-400 block">Độ dài</span>
                <span className="font-bold text-[#2F6B4F]">18.4 km</span>
              </div>
              <div className="bg-[#F7F7F4] p-1.5 rounded-lg border border-gray-100">
                <span className="text-gray-400 block">Điểm tiếp nước</span>
                <span className="font-bold text-gray-800">4 trạm</span>
              </div>
              <div className="bg-[#F7F7F4] p-1.5 rounded-lg border border-gray-100">
                <span className="text-gray-400 block">Khảo sát</span>
                <span className="font-bold text-emerald-600">Đã duyệt</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. TỪ Ý TƯỞNG ĐẾN ĐỈNH NÚI, CHỈ 5 BƯỚC
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#2F6B4F] bg-[#DCFCE7] px-3 py-1 rounded-full">
            QUY TRÌNH TINH GỌN
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2937] mt-3">
            Từ ý tưởng đến đỉnh núi, chỉ 5 bước
          </h2>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-[#F7F7F4] border border-[#E5E7EB] text-left hover:border-[#2F6B4F]/40 hover:bg-white transition group shadow-2xs">
              <span className="text-base font-black text-[#2F6B4F] block mb-2">01</span>
              <h3 className="text-sm font-bold text-[#1F2937] mb-1.5">Chọn cung đường</h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Tìm kiếm tuyến trekking phù hợp với thể lực, sở thích và thời gian rảnh.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-[#F7F7F4] border border-[#E5E7EB] text-left hover:border-[#2F6B4F]/40 hover:bg-white transition group shadow-2xs">
              <span className="text-base font-black text-[#2F6B4F] block mb-2">02</span>
              <h3 className="text-sm font-bold text-[#1F2937] mb-1.5">Lên kế hoạch</h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Xem dự báo thời tiết, phân tích độ cao và chuẩn bị lịch trình từng chặng.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-[#F7F7F4] border border-[#E5E7EB] text-left hover:border-[#2F6B4F]/40 hover:bg-white transition group shadow-2xs">
              <span className="text-base font-black text-[#2F6B4F] block mb-2">03</span>
              <h3 className="text-sm font-bold text-[#1F2937] mb-1.5">Thuê đồ & Dịch vụ</h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Đặt thuê lều trại, gậy leo núi và kết nối porter chỉ với vài click.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-[#F7F7F4] border border-[#E5E7EB] text-left hover:border-[#2F6B4F]/40 hover:bg-white transition group shadow-2xs">
              <span className="text-base font-black text-[#2F6B4F] block mb-2">04</span>
              <h3 className="text-sm font-bold text-[#1F2937] mb-1.5">Check-in & Đi</h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Tải bản đồ offline, kích hoạt tính năng an toàn GPS và tự tin lên đường.
              </p>
            </div>

            {/* Step 5 */}
            <div className="p-6 rounded-2xl bg-[#F7F7F4] border border-[#E5E7EB] text-left hover:border-[#2F6B4F]/40 hover:bg-white transition group shadow-2xs">
              <span className="text-base font-black text-[#2F6B4F] block mb-2">05</span>
              <h3 className="text-sm font-bold text-[#1F2937] mb-1.5">Chia sẻ</h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Ghi lại tracklog, review cảm xúc và truyền cảm hứng cho cộng đồng trekker.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. CHUYẾN ĐI SẮP KHỞI HÀNH (LIVE API CALL)
          Gọi http://localhost:5000/api/v1/trips?page=1&pageSize=12
      ───────────────────────────────────────────────────────────── */}
      <section id="chuyen-di" className="py-16 bg-[#EDF2EE] border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F6B4F] bg-[#DCFCE7] px-3 py-1 rounded-full">
                LỊCH TRÌNH MỚI NHẤT
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2937] mt-2">
                Chuyến đi sắp khởi hành
              </h2>
            </div>

            {/* Region Filter Tabs */}
            <div className="flex items-center gap-2">
              {[
                { id: "all", label: "Tất cả" },
                { id: "north", label: "Miền Bắc" },
                { id: "central", label: "Miền Trung" },
                { id: "south", label: "Miền Nam" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveRegionTab(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    activeRegionTab === tab.id
                      ? "bg-[#2F6B4F] text-white shadow-xs"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {isLoadingTrips && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 border-4 border-[#2F6B4F] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-semibold text-gray-600">Đang tải danh sách chuyến đi thực tế...</p>
            </div>
          )}

          {/* Error State */}
          {!isLoadingTrips && tripError && (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-sm text-red-700 max-w-xl mx-auto">
              <p className="font-semibold">{tripError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingTrips && !tripError && filteredTrips.length === 0 && (
            <div className="py-16 text-center bg-white rounded-2xl border border-gray-200 p-8 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#2F6B4F] flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18L14 6l-3.8 5.7 1.8 2.7H7.5L3 21z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-800">Hiện chưa có chuyến đi nào phù hợp</p>
              <p className="text-xs text-gray-500 mt-1">Vui lòng chọn khu vực khác hoặc quay lại sau.</p>
            </div>
          )}

          {/* Trips Grid from API */}
          {!isLoadingTrips && !tripError && filteredTrips.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip, idx) => {
                const totalCap = trip.capacity || 12;
                const remSlots = trip.remainingSlots ?? 0;
                const bookedSlots = Math.max(0, totalCap - remSlots);
                const progressPct = Math.min(100, Math.round((bookedSlots / totalCap) * 100));
                const badge = getSlotBadge(trip.remainingSlots, trip.capacity, trip.status);
                const imageUrl = TRIP_FALLBACK_IMAGES[idx % TRIP_FALLBACK_IMAGES.length];
                const leaderAvatar = LEADER_AVATARS[idx % LEADER_AVATARS.length];
                const destName = trip.destination?.name || "Việt Nam";
                const dateText = formatDateRange(trip.startAt, trip.endAt);
                const leaderName = trip.leader?.fullName || "Leader Bản Địa";
                const priceFormatted = trip.pricePerPax
                  ? `${Number(trip.pricePerPax).toLocaleString("vi-VN")}đ`
                  : "Liên hệ";

                return (
                  <div
                    key={trip.id}
                    className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                  >
                    {/* Image & Badges */}
                    <div className="relative h-48 w-full overflow-hidden bg-gray-200">
                      <img
                        src={imageUrl}
                        alt={trip.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Badge spots left */}
                      <div className="absolute top-3 right-3">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs ${badge.className}`}>
                          {badge.text}
                        </span>
                      </div>
                      {/* Overlay: Location & Date */}
                      <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded max-w-[85%] truncate">
                        {destName} • {dateText}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#1F2937] group-hover:text-[#2F6B4F] transition line-clamp-1">
                          {trip.title}
                        </h3>

                        {/* Leader info */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                            <img src={leaderAvatar} alt={leaderName} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs text-gray-600 truncate">
                            Leader: <strong>{leaderName}</strong> (5.0 ★)
                          </span>
                        </div>
                      </div>

                      {/* Seat Progress Bar */}
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                          <span>Số chỗ</span>
                          <span className="font-bold text-[#2F6B4F] tabular-nums">
                            {bookedSlots}/{totalCap} đã đặt
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#2F6B4F] h-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Price & Action Button */}
                      <div className="mt-4 flex items-center justify-between pt-1">
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">Chi phí trọn gói</span>
                          <span className="text-base font-black text-[#2F6B4F] tabular-nums">{priceFormatted}</span>
                        </div>
                        <Link
                          href={`/trips/${trip.id}`}
                          className="px-4 py-2 bg-[#2F6B4F] hover:bg-[#1F4A36] text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                        >
                          Tham gia
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/trips"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F6B4F] hover:underline"
            >
              <span>Xem tất cả chuyến đi sắp khởi hành</span>
              <span>➔</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. APP DOWNLOAD BANNER
          "Tải Vina TrekGo — yên tâm trên mọi cung đường"
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-gradient-to-br from-[#EAF4ED] to-[#DBECE0] rounded-3xl p-6 sm:p-10 lg:p-14 border border-[#C5DEC8] shadow-xs flex flex-col lg:flex-row items-center justify-between gap-10">
          {/* Left Text & Features */}
          <div className="max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2F6B4F] bg-white px-3 py-1 rounded-full border border-emerald-200">
              ỨNG DỤNG DI ĐỘNG
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1F2937] mt-3 tracking-tight">
              Tải Vina TrekGo — yên tâm trên mọi cung đường
            </h2>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2F6B4F] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                  ✓
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Bản đồ offline không lo mất sóng</h3>
                  <p className="text-xs text-gray-600 mt-0.5">Tải trước bản đồ để định vị vệ tinh GPS chính xác 100% khi vào vùng lõi rừng sâu.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2F6B4F] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                  ✓
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Tín hiệu cứu trợ SOS tức thì</h3>
                  <p className="text-xs text-gray-600 mt-0.5">Tự động phát tín hiệu và gửi tọa độ kinh vĩ độ khẩn cấp tới trạm cứu hộ địa phương.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2F6B4F] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                  ✓
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Kết nối trực tiếp với Porter bản địa</h3>
                  <p className="text-xs text-gray-600 mt-0.5">Dễ dàng đặt người dẫn đường, thuê lều bạt và phương tiện trung chuyển uy tín.</p>
                </div>
              </div>
            </div>

            {/* Store Buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="flex items-center gap-2.5 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-xl shadow-md transition cursor-pointer">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.66-.82 1.11-1.96.99-3.1-.96.04-2.12.64-2.8 1.44-.6.69-1.12 1.83-.98 2.94 1.08.08 2.17-.55 2.79-1.28z" />
                </svg>
                <div className="text-left">
                  <div className="text-[9px] text-gray-300 uppercase leading-none">Tải trên</div>
                  <div className="text-xs font-bold leading-tight">App Store</div>
                </div>
              </button>

              <button className="flex items-center gap-2.5 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-xl shadow-md transition cursor-pointer">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a1.996 1.996 0 01-.61-.926V2.74c0-.348.217-.676.609-.926zm11.39 11.39l2.42 2.42-11.23 6.45 8.81-8.87zm0-2.408l-8.81-8.87 11.23 6.45-2.42 2.42zm1.699 1.204l3.19-1.83a1.536 1.536 0 000-2.67l-3.19-1.83-1.63 1.63 1.63 2.7z" />
                </svg>
                <div className="text-left">
                  <div className="text-[9px] text-gray-300 uppercase leading-none">Tải trên</div>
                  <div className="text-xs font-bold leading-tight">Google Play</div>
                </div>
              </button>
            </div>
          </div>

          {/* Right Floating Phone Mockup */}
          <div className="w-[260px] sm:w-[280px] h-[480px] bg-slate-900 rounded-[40px] p-2.5 shadow-2xl border-4 border-slate-700/60 flex flex-col">
            <div className="relative w-full h-full bg-[#E5ECE7] rounded-[30px] overflow-hidden flex flex-col text-[#1F2937]">
              <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mt-1.5 mb-2 z-10" />
              <div className="px-3 pb-2 flex items-center justify-between text-[11px] font-bold text-gray-800 z-10">
                <span className="bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>Núi Dinh - Hồ Chí Minh</span>
                </span>
                <span className="bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">100% ONLINE</span>
              </div>
              <div className="relative flex-1 bg-[#D3E4D6] overflow-hidden">
                <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 200 300">
                  <path d="M 0,40 Q 90,10 160,70 T 200,100" fill="none" stroke="#2F6B4F" strokeWidth="1" />
                  <path d="M 0,90 Q 110,50 170,130 T 200,170" fill="none" stroke="#2F6B4F" strokeWidth="1" />
                </svg>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 300">
                  <path
                    d="M 40,250 Q 80,190 70,140 T 130,80 T 160,30"
                    fill="none"
                    stroke="#2F6B4F"
                    strokeWidth="4"
                    strokeDasharray="4 3"
                  />
                  <circle cx="40" cy="250" r="5" fill="#1F4A36" />
                  <circle cx="160" cy="30" r="6" fill="#DC2626" />
                </svg>

                <div className="absolute top-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-xl p-2 shadow-md border border-emerald-200 flex items-center gap-2">
                  <span className="text-emerald-600 text-sm">✓</span>
                  <div>
                    <p className="text-[10px] font-bold text-gray-800">Đang trên đúng lộ trình</p>
                    <p className="text-[8px] text-gray-500">Cách trạm nghỉ số 2: 1.2 km (+120m)</p>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-xl p-2.5 shadow-lg border border-gray-200">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-gray-500">Độ cao hiện tại</span>
                    <span className="font-extrabold text-[#2F6B4F]">2,450 m</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-gray-400">
                    <span>Pin: 85%</span>
                    <span>Tín hiệu: Mạnh</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. NEWSLETTER SUBSCRIPTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#2F6B4F] bg-[#DCFCE7] px-3 py-1 rounded-full">
            BẢN TIN KHÁM PHÁ
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1F2937] mt-3">
            Cung đường mới, chuyến đi & ưu đãi
          </h2>
          <p className="mt-2 text-sm text-[#6B7280]">
            Nhận thông báo cung đường mới mở và cẩm nang trekking thực chiến hàng tuần vào email của bạn.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert("Cảm ơn bạn đã đăng ký nhận bản tin Vina TrekGo!");
            }}
            className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              placeholder="Nhập email của bạn..."
              className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#F7F7F4] border border-[#E5E7EB] rounded-full focus:outline-none focus:border-[#2F6B4F]"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-[#2F6B4F] hover:bg-[#1F4A36] text-white text-xs sm:text-sm font-bold rounded-full transition shadow-xs cursor-pointer shrink-0"
            >
              Đăng ký
            </button>
          </form>

          <p className="mt-3 text-[11px] text-gray-400">
            Cam kết bảo mật thông tin. Bạn có thể hủy đăng ký bất cứ lúc nào.
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer id="ve-chung-toi" className="bg-[#0D1B14] text-gray-300 py-14 border-t border-emerald-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
            {/* Col 1: Brand */}
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-4">
                <Image
                  src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg"
                  alt="Vina TrekGo Logo"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-xl object-cover"
                />
                <span className="font-extrabold text-xl text-white">
                  Vina Trek<span className="text-[#F59E0B]">Go</span>
                </span>
              </Link>
              <p className="text-xs text-gray-400 leading-relaxed max-w-sm mb-4">
                Nền tảng công nghệ hỗ trợ trekking toàn diện tại Việt Nam, mang đến trải nghiệm an toàn, kết nối và trọn vẹn từng bước chân.
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition cursor-pointer">f</span>
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition cursor-pointer">ig</span>
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition cursor-pointer">yt</span>
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition cursor-pointer">tk</span>
              </div>
            </div>

            {/* Col 2: Cung đường */}
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Cung đường</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><Link href="/routes" className="hover:text-white transition">Miền Bắc</Link></li>
                <li><Link href="/routes" className="hover:text-white transition">Miền Trung</Link></li>
                <li><Link href="/routes" className="hover:text-white transition">Miền Nam</Link></li>
                <li><Link href="/routes" className="hover:text-white transition">Top đỉnh cao nhất</Link></li>
              </ul>
            </div>

            {/* Col 3: Dịch vụ */}
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Dịch vụ</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><Link href="/rentals" className="hover:text-white transition">Thuê thiết bị</Link></li>
                <li><a href="#chuyen-di" className="hover:text-white transition">Tìm porter bản địa</a></li>
                <li><a href="#" className="hover:text-white transition">Bảo hiểm trekking</a></li>
                <li><a href="#" className="hover:text-white transition">Tổ chức tour riêng</a></li>
              </ul>
            </div>

            {/* Col 4: Về chúng tôi & Hỗ trợ */}
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Về chúng tôi</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><a href="#" className="hover:text-white transition">Câu chuyện VinaTrekGO</a></li>
                <li><a href="#" className="hover:text-white transition">Quy chuẩn an toàn</a></li>
                <li><a href="#" className="hover:text-white transition">Điều khoản sử dụng</a></li>
                <li><a href="#" className="hover:text-white transition">Chính sách bảo mật</a></li>
                <li className="pt-2 text-emerald-400 font-bold">Hotline: 1900 8888</li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-6 border-t border-emerald-950/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500 gap-2">
            <div>
              © 2026 Vina TrekGo. Nền tảng trekking hàng đầu Việt Nam. All rights reserved.
            </div>
            <div className="flex gap-4">
              <a href="#" className="hover:text-gray-400 transition">Điều khoản</a>
              <a href="#" className="hover:text-gray-400 transition">Bảo mật</a>
              <a href="#" className="hover:text-gray-400 transition">Sơ đồ trang</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
