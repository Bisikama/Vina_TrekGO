"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SystemTrail } from "../services/system-trails.api";

interface SystemTrailListProps {
  initialTrails: SystemTrail[];
}

export function SystemTrailList({ initialTrails }: SystemTrailListProps) {
  const router = useRouter();

  const handleViewDetails = (id: string) => {
    router.push(`/explore/${id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Cửa hàng Cung đường</h2>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-gray-200 text-sm font-medium rounded-lg shadow-sm text-gray-700 hover:bg-gray-50">
            Lọc theo độ khó
          </button>
          <button className="px-4 py-2 bg-white border border-gray-200 text-sm font-medium rounded-lg shadow-sm text-gray-700 hover:bg-gray-50">
            Mới nhất
          </button>
        </div>
      </div>

      {initialTrails.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Chưa có cung đường hệ thống nào.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {initialTrails.map((trail, idx) => (
            <div key={trail.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
              <div className="relative h-48 w-full bg-[#E8F5E9] flex flex-col items-center justify-center overflow-hidden">
                <svg className="w-12 h-12 text-[#1B5E41]/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[#1B5E41]/50 font-bold text-sm tracking-widest">{trail.code}</span>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-lg text-gray-900 leading-tight">{trail.name}</h3>
                </div>
                
                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {trail.code}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                  <div>
                    <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Khoảng cách</span>
                    <span className="font-semibold text-gray-700">{trail.distanceKm} km</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Độ cao</span>
                    <span className="font-semibold text-gray-700">{trail.elevationGainM}m</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Độ khó</span>
                    <span className="font-semibold text-orange-600">
                      {trail.difficulty === "EASY" ? "Dễ" : trail.difficulty === "MEDIUM" ? "Trung bình" : trail.difficulty === "HARD" ? "Khó" : "Cực khó"}
                    </span>
                  </div>
                </div>

                <div className="mt-auto border-t border-gray-100 pt-4 flex items-center justify-between">
                  <div className="font-extrabold text-[#1B5E41]">
                    {(trail.price || 0).toLocaleString('vi-VN')}đ
                  </div>
                  <button 
                    onClick={() => handleViewDetails(trail.id)}
                    className="bg-gray-100 text-gray-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors hover:bg-gray-200 shadow-sm flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    Chi tiết
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
