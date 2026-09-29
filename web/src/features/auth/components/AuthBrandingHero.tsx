"use client";

import React from "react";
import Image from "next/image";

export const AuthBrandingHero = () => {
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col justify-between p-10 lg:p-14 text-white">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1470&auto=format&fit=crop"
          alt="Background Trekking Mountain"
          fill
          priority
          className="object-cover object-center"
        />
        {/* Gradient overlays to match the design (dark green tint) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-[#154B36]/40 to-[#0F2A1E]/90 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[#0F2A1E]/30" />
      </div>

      {/* Top Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15l7-7 4 4 7-7M5 19h14" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-white tracking-tight">Trekking System</span>
              <div className="w-2 h-2 rounded-full bg-[#4ADE80]"></div>
            </div>
            <p className="text-[11px] text-gray-300 font-medium">Hệ thống Quản lý & Khám phá Chinh phục Núi</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-xs font-semibold text-white/90">Bảo trợ An toàn VFRS</span>
        </div>
      </div>

      {/* Main Content (Middle) */}
      <div className="relative z-10 flex-1 flex flex-col justify-center mt-12 mb-12">
        <div>
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 mb-6">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[11px] font-bold tracking-widest text-emerald-100 uppercase">Khám phá thiên nhiên hoang dã</span>
          </div>
          
          <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] tracking-tight">
            Every trail<br />
            <span className="text-[#4ADE80]">starts here.</span>
          </h1>
          
          <p className="mt-6 text-base lg:text-lg text-gray-200 leading-relaxed max-w-md font-medium">
            Nền tảng kết nối hành trình leo núi, quản lý đoàn trekking chuyên nghiệp, thuê trang bị chuẩn kiểm định và bảo hộ an toàn thời gian thực.
          </p>
        </div>

        <div className="mt-8">
          <div className="inline-flex items-center gap-3 bg-black/40 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4ADE80] animate-pulse"></div>
            <span className="text-sm font-medium text-white/90">
              18 đoàn đang trên cung đường • Thời tiết Tà Xùa: 14°C quang mây
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
          <div className="text-2xl lg:text-3xl font-bold text-white mb-1">12,500+</div>
          <div className="text-sm text-gray-300">Trekker tin dùng</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
          <div className="text-2xl lg:text-3xl font-bold text-white mb-1">45+ Tuyến leo</div>
          <div className="text-sm text-gray-300 line-clamp-2">Fansipan, Tà Xùa, Lảo Thẩn</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
          <div className="text-2xl lg:text-3xl font-bold text-white mb-1">100% Leader</div>
          <div className="text-sm text-gray-300 line-clamp-2">Chứng chỉ WFA & Cứu hộ</div>
        </div>
      </div>
    </div>
  );
};

