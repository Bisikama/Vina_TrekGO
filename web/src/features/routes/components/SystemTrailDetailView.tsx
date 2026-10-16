"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SystemTrail, purchaseTrail } from "../services/system-trails.api";
import { SystemTrailMap } from "./SystemTrailMap";

interface SystemTrailDetailViewProps {
  trail: SystemTrail;
}

export function SystemTrailDetailView({ trail }: SystemTrailDetailViewProps) {
  const router = useRouter();
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"QR" | "REDIRECT">("QR");
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handleConfirmPurchase = async () => {
    try {
      setIsPurchasing(true);
      const result = await purchaseTrail(trail.id, paymentMethod);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        alert("Đã tạo giao dịch thanh toán thành công. Vui lòng thanh toán qua QR.");
        setIsPurchaseModalOpen(false);
      }
    } catch (error) {
      console.error("Lỗi khi tạo thanh toán:", error);
      alert("Có lỗi xảy ra khi tạo thanh toán. Vui lòng thử lại.");
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-[#1B5E41] py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <Image 
            src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1920&q=80" 
            alt="Mountains" 
            fill 
            className="object-cover"
          />
        </div>
        <div className="max-w-4xl mx-auto relative z-10">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Quay lại
          </button>
          
          <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-bold uppercase tracking-wider">
                  {trail.difficulty === "EASY" ? "Dễ" : trail.difficulty === "MEDIUM" ? "Trung bình" : trail.difficulty === "HARD" ? "Khó" : "Cực khó"}
                </span>
                <span className="text-[#A7F3D0] text-sm font-medium">{trail.destination?.name || trail.code}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
                {trail.name}
              </h1>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 w-full md:w-80">
              <div className="flex flex-col mb-5">
                <div className="text-white/80 text-sm font-medium mb-1">Giá mở khóa</div>
                <div className="font-extrabold text-3xl text-white tracking-tight drop-shadow-sm">
                  {trail.price === 0 || trail.price === undefined ? "Miễn phí" : `${trail.price.toLocaleString('vi-VN')}đ`}
                </div>
              </div>
              <button 
                onClick={() => setIsPurchaseModalOpen(true)}
                className="w-full bg-white text-[#1B5E41] font-bold px-6 py-3.5 rounded-xl text-base transition-transform hover:scale-[1.02] active:scale-95 shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {trail.price === 0 || trail.price === undefined ? "Nhận cung đường" : "Mở khóa lộ trình"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#1B5E41]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <span className="text-gray-500 text-sm mb-1">Khoảng cách</span>
            <span className="text-xl font-bold text-gray-900">{trail.distanceKm} km</span>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
            </div>
            <span className="text-gray-500 text-sm mb-1">Độ cao</span>
            <span className="text-xl font-bold text-gray-900">{trail.elevationGainM} m</span>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-gray-500 text-sm mb-1">Thời gian dự kiến</span>
            <span className="text-xl font-bold text-gray-900">
              {trail.estimatedDurationMinutes 
                ? (trail.estimatedDurationMinutes >= 60 
                    ? `${Math.round(trail.estimatedDurationMinutes / 60)} giờ` 
                    : `${trail.estimatedDurationMinutes} phút`) 
                : "Chưa cập nhật"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Mô tả cung đường & Bản đồ 3D</h2>
          <div className="prose max-w-none text-gray-600 mb-8">
            <p>
              {trail.description || "Đang tải dữ liệu mô tả chi tiết của cung đường này. Khi bạn mở khóa cung đường, bạn sẽ được cấp quyền truy cập vào bản đồ 3D MapLibre, các điểm checkpoint quan trọng, cảnh báo nguy hiểm và trạm y tế gần nhất dọc theo lộ trình."}
            </p>
          </div>
          
          <SystemTrailMap trail={trail} />
        </div>
      </div>

      {/* Purchase Modal */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-extrabold text-gray-900">Mở khóa cung đường</h3>
              <p className="text-sm text-gray-500 mt-1">Sở hữu toàn bộ dữ liệu lộ trình và điểm check-in</p>
            </div>
            
            <div className="p-6">
              <div className="flex gap-4 items-center mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0">
                  <Image src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80" alt={trail.name} fill className="object-cover" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 leading-tight">{trail.name}</h4>
                  <div className="text-xs text-gray-500 mt-1">Bản đồ 3D & Dữ liệu GPS</div>
                </div>
              </div>

              {trail.price !== 0 && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Phương thức thanh toán</label>
                  <div className="space-y-3">
                    <div onClick={() => setPaymentMethod('QR')} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${paymentMethod === 'QR' ? 'border-[#1B5E41] bg-emerald-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${paymentMethod === 'QR' ? 'border-[#1B5E41]' : 'border-gray-300'}`}>
                          {paymentMethod === 'QR' && <div className="w-2.5 h-2.5 rounded-full bg-[#1B5E41]" />}
                        </div>
                        <span className="font-medium text-sm text-gray-900">Chuyển khoản QR</span>
                      </div>
                      <Image src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg" width={24} height={24} alt="QR" className="rounded-md opacity-20" />
                    </div>

                    <div onClick={() => setPaymentMethod('REDIRECT')} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${paymentMethod === 'REDIRECT' ? 'border-[#1B5E41] bg-emerald-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${paymentMethod === 'REDIRECT' ? 'border-[#1B5E41]' : 'border-gray-300'}`}>
                          {paymentMethod === 'REDIRECT' && <div className="w-2.5 h-2.5 rounded-full bg-[#1B5E41]" />}
                        </div>
                        <span className="font-medium text-sm text-gray-900">Cổng thanh toán (VNPAY)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-4 border-t border-gray-100">
                <span className="font-medium text-gray-500">Tổng thanh toán</span>
                <span className="font-extrabold text-xl text-[#1B5E41]">
                  {trail.price === 0 || trail.price === undefined ? "0đ" : `${trail.price.toLocaleString('vi-VN')}đ`}
                </span>
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button 
                onClick={() => setIsPurchaseModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl transition-colors hover:bg-gray-200"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmPurchase}
                disabled={isPurchasing}
                className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors shadow-lg ${isPurchasing ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1B5E41] hover:bg-[#12402C] shadow-emerald-900/20'}`}
              >
                {isPurchasing ? 'Đang xử lý...' : 'Thanh toán ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
