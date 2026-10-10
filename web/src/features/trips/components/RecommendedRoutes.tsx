"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/axios";

interface RouteProps {
  id: string;
  name: string;
  location: string;
  elevation: string;
  distance: string;
  days: string;
  difficultyInfo: string;
  rating: string;
  reviewsCount: number;
  imageUrl: string;
  tag: { text: string; colorClass: string };
}

interface SystemTrailSummary {
  id: string;
  code: string;
  name: string;
  difficulty: string;
  distanceKm: number;
  elevationGainM?: number | null;
  estimatedDurationMinutes?: number | null;
  destination?: {
    name: string;
  } | null;
}

interface SystemTrailsResponse {
  items: SystemTrailSummary[];
}

const FEATURED_ROUTE: RouteProps = {
  id: "tx-khunglong",
  name: "Núi Bà Đen - Cung Đường Cột Điện",
  location: "Tây Ninh",
  elevation: "986m",
  distance: "4.5 km",
  days: "1 Ngày",
  difficultyInfo: "Trung bình khá",
  rating: "4.9",
  reviewsCount: 348,
  imageUrl: "/hero-trekking.jpg",
  tag: { text: "Nóc nhà Nam Bộ", colorClass: "bg-emerald-600 text-white font-bold" },
};

const RouteCard = ({ route }: { route: RouteProps }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full">
      <div className="relative h-48 w-full overflow-hidden">
        <Image 
          src={route.imageUrl} 
          alt={route.name} 
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="absolute top-3 right-3">
          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase ${route.tag.colorClass}`}>
            {route.tag.text}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 text-white flex items-center gap-1.5 text-[11px] font-bold">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          {route.elevation}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          {route.location}
        </div>
        <h3 className="font-extrabold text-[16px] text-gray-900 leading-tight mb-4 flex-grow">{route.name}</h3>
        
        <div className="grid grid-cols-3 gap-2 mb-4 bg-[#F8FAFC] rounded-xl p-3 border border-gray-100">
          <div>
            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Quãng đường</div>
            <div className="text-[12px] font-black text-gray-900">{route.distance}</div>
          </div>
          <div className="border-l border-r border-gray-200 px-2">
            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Thời gian</div>
            <div className="text-[12px] font-black text-gray-900">{route.days}</div>
          </div>
          <div className="pl-2">
            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1">Thể lực</div>
            <div className="text-[12px] font-black text-gray-900">{route.difficultyInfo}</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            <span className="text-[13px] font-bold text-gray-900">{route.rating}</span>
            <span className="text-[11px] text-gray-400 font-medium">({route.reviewsCount})</span>
          </div>
          <Link href={`/routes/${route.id}`} className="text-[12px] font-bold text-[#154B36] hover:text-[#0D3425]">
            Xem chi tiết
          </Link>
        </div>
      </div>
    </div>
  );
};

export const RecommendedRoutes = () => {
  const [routes, setRoutes] = useState<RouteProps[]>([FEATURED_ROUTE]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const fetchSystemTrails = async () => {
      try {
        const { data } = await apiClient.get<SystemTrailsResponse>(
          "/api/v1/system-trails?page=1&pageSize=20&status=ACTIVE",
        );
        const systemRoutes = data.items
          .filter(
            (trail) =>
              trail.code !== "TRAIL_BADEN_COTDIEN" &&
              !trail.name.toLowerCase().includes("bà đen"),
          )
          .map((trail, index) => ({
            id: trail.id,
            name: trail.name,
            location: trail.destination?.name ?? "Việt Nam",
            elevation: trail.elevationGainM ? `${trail.elevationGainM}m` : "—",
            distance: `${trail.distanceKm} km`,
            days: trail.estimatedDurationMinutes
              ? `${Math.ceil(trail.estimatedDurationMinutes / 480)}N`
              : "—",
            difficultyInfo: getDifficultyLabel(trail.difficulty),
            rating: "—",
            reviewsCount: 0,
            imageUrl: [
              "https://images.unsplash.com/photo-1698224536665-27a3c3e664ee?q=80&w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1582049019623-88c9f52f4165?q=80&w=600&auto=format&fit=crop",
            ][index % 2],
            tag: getDifficultyTag(trail.difficulty),
          }));

        if (!isCancelled) {
          setRoutes([FEATURED_ROUTE, ...systemRoutes]);
        }
      } catch (error) {
        console.error("Không thể tải danh sách cung đường hệ thống:", error);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchSystemTrails();
    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="mb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[17px] font-extrabold text-gray-900 flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#154B36]"></span>
            Cung đường đề xuất dành riêng cho bạn
          </h2>
          <span className="text-[11px] text-gray-500 font-medium">Dựa trên thể lực cấp độ 3 và lịch sử hoàn thành cung dốc đá của bạn</span>
        </div>
        <div className="flex gap-2 hidden sm:flex">
          <button className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button className="w-8 h-8 rounded-full bg-[#F0FDF4] text-[#154B36] flex items-center justify-center hover:bg-[#DCFCE7] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-gray-100 h-48 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      )}
    </div>
  );
};

const getDifficultyLabel = (difficulty: string) => {
  const labels: Record<string, string> = {
    EASY: "Dễ",
    MEDIUM: "Trung bình",
    HARD: "Khó",
    EXTREME: "Thử thách",
  };
  return labels[difficulty] ?? difficulty;
};

const getDifficultyTag = (difficulty: string): RouteProps["tag"] => {
  if (difficulty === "EXTREME") {
    return { text: "Thử thách", colorClass: "bg-red-100 text-red-800" };
  }
  return { text: getDifficultyLabel(difficulty), colorClass: "bg-emerald-100 text-emerald-800" };
};
