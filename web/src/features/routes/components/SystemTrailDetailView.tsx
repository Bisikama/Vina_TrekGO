"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useStaticDataStore } from "@/lib/staticDataStore";
import {
  SystemTrail,
  purchaseTrail,
  getTrailPurchaseErrorMessage,
} from "../services/system-trails.api";
import { SystemTrailMap } from "./SystemTrailMap";

interface SystemTrailDetailViewProps {
  trail: SystemTrail;
}

export function SystemTrailDetailView({ trail }: SystemTrailDetailViewProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"REDIRECT" | "QR">("REDIRECT");
  const [gateway, setGateway] = useState<"vnpay" | "momo">("vnpay");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccessMsg, setPurchaseSuccessMsg] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const isFree = !trail.price || Number(trail.price) === 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlockedKey = `trail_unlocked:${trail.id}`;
    if (localStorage.getItem(unlockedKey) === "true") {
      setIsUnlocked(true);
    }
  }, [trail.id]);

  const handleOpenPurchaseModal = () => {
    setPurchaseError(null);
    if (!accessToken) {
      router.push("/login");
      return;
    }
    setIsPurchaseModalOpen(true);
  };

  const handleConfirmPurchase = async () => {
    try {
      setIsPurchasing(true);
      setPurchaseError(null);

      // Giữ phiên thanh toán (idempotencyKey + paymentMethod + gateway) theo trail.id trong thời gian còn hiệu lực (15 phút)
      // để tránh tạo Payment thứ 2 gây lỗi 409 PAYMENT_ATTEMPT_IN_PROGRESS
      const sessionKey = `trail-purchase-active:${trail.id}`;
      let activeKey = crypto.randomUUID();
      let activeMethod: "REDIRECT" | "QR" = paymentMethod;
      let activeGateway: "vnpay" | "momo" = gateway;

      if (typeof window !== "undefined") {
        try {
          const rawSession = sessionStorage.getItem(sessionKey);
          if (rawSession) {
            const parsed = JSON.parse(rawSession);
            const notExpired = !parsed.expiresAt || new Date(parsed.expiresAt).getTime() > Date.now();
            if (parsed.idempotencyKey && notExpired) {
              activeKey = parsed.idempotencyKey;
              activeMethod = parsed.paymentMethod || paymentMethod;
              activeGateway = parsed.gateway || gateway;
            } else {
              sessionStorage.removeItem(sessionKey);
            }
          }
        } catch {
          sessionStorage.removeItem(sessionKey);
        }
      }

      const result = await purchaseTrail(
        trail.id,
        activeMethod,
        activeGateway,
        activeKey
      );

      if (typeof window !== "undefined" && result?.paymentId) {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({
            idempotencyKey: activeKey,
            paymentMethod: activeMethod,
            gateway: activeGateway,
            expiresAt: result.expiresAt || new Date(Date.now() + 14 * 60 * 1000).toISOString(),
          })
        );
      }

      const checkoutUrl = result?.checkout?.url || result?.checkoutUrl;

      if (checkoutUrl) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "last_trail_purchase",
            JSON.stringify({
              trailId: trail.id,
              trailCode: trail.code,
              trailName: trail.name,
              price: trail.price ?? 0,
              trailAccessId: result.trailAccessId,
              paymentId: result.paymentId,
              timestamp: Date.now(),
            })
          );
          window.location.assign(checkoutUrl);
        }
        return;
      }

      if (result?.accessStatus === "ACTIVE" || isFree) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`trail_unlocked:${trail.id}`, "true");
          sessionStorage.removeItem(sessionKey);
        }
        useStaticDataStore.getState().clearStaticCache();
        void useStaticDataStore.getState().loadPrivateSources(true);
        setIsUnlocked(true);
        setPurchaseSuccessMsg(
          "Mở khóa cung đường thành công! Bạn đã có toàn quyền sử dụng bản đồ 3D và lộ trình GPS."
        );
        setIsPurchaseModalOpen(false);
        return;
      }

      setPurchaseSuccessMsg(
        "Đã ghi nhận yêu cầu thanh toán. Hệ thống đang đồng bộ trạng thái từ cổng thanh toán."
      );
      setIsPurchaseModalOpen(false);
    } catch (error) {
      console.error("Lỗi khi tạo thanh toán:", error);
      const parsed = getTrailPurchaseErrorMessage(error);
      if (
        typeof window !== "undefined" &&
        parsed.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD"
      ) {
        sessionStorage.removeItem(`trail-purchase-active:${trail.id}`);
      }
      if (parsed.code === "PAYMENT_INVALID_STATE") {
        if (typeof window !== "undefined") {
          localStorage.setItem(`trail_unlocked:${trail.id}`, "true");
        }
        useStaticDataStore.getState().clearStaticCache();
        void useStaticDataStore.getState().loadPrivateSources(true);
        setIsUnlocked(true);
      }
      setPurchaseError(parsed.message);
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
                  {isFree ? "Miễn phí" : `${Number(trail.price).toLocaleString("vi-VN")}đ`}
                </div>
              </div>
              {isUnlocked ? (
                <div className="w-full bg-emerald-500/20 border border-emerald-300/40 text-white font-bold px-6 py-3.5 rounded-xl text-sm flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Đã mở khóa lộ trình
                </div>
              ) : (
                <button 
                  onClick={handleOpenPurchaseModal}
                  className="w-full bg-white text-[#1B5E41] font-bold px-6 py-3.5 rounded-xl text-base transition-transform hover:scale-[1.02] active:scale-95 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {isFree ? "Nhận cung đường miễn phí" : "Mở khóa lộ trình (VNPAY)"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {purchaseSuccessMsg && (
          <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{purchaseSuccessMsg}</span>
            </div>
            <button
              onClick={() => setPurchaseSuccessMsg(null)}
              className="text-xs font-bold text-emerald-700 hover:underline ml-4"
            >
              Đóng
            </button>
          </div>
        )}

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
              <p className="text-sm text-gray-500 mt-1">Sở hữu toàn bộ dữ liệu lộ trình 3D và điểm check-in GPS</p>
            </div>
            
            <div className="p-6">
              <div className="flex gap-4 items-center mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0">
                  <Image src="https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80" alt={trail.name} fill className="object-cover" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 leading-tight">{trail.name}</h4>
                  <div className="text-xs text-gray-500 mt-1">Mã lộ trình: <span className="font-mono font-semibold text-gray-700">{trail.code}</span></div>
                </div>
              </div>

              {purchaseError && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-800">
                  {purchaseError}
                </div>
              )}

              {!isFree && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Phương thức thanh toán VNPAY
                  </label>
                  <div className="space-y-3">
                    <div
                      onClick={() => {
                        setPaymentMethod("REDIRECT");
                        setGateway("vnpay");
                        setPurchaseError(null);
                      }}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${
                        paymentMethod === "REDIRECT"
                          ? "border-[#1B5E41] bg-emerald-50/50 ring-2 ring-[#1B5E41]/15"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            paymentMethod === "REDIRECT" ? "border-[#1B5E41]" : "border-gray-300"
                          }`}
                        >
                          {paymentMethod === "REDIRECT" && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#1B5E41]" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-900">
                            Cổng thanh toán VNPAY (ATM / Visa / VNPAY-QR)
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Chuyển hướng sang trang thanh toán VNPAY Sandbox
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded bg-[#005BAA] text-white font-black text-[10px] shrink-0">
                        VNPAY
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        setPaymentMethod("QR");
                        setGateway("vnpay");
                        setPurchaseError(null);
                      }}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${
                        paymentMethod === "QR"
                          ? "border-[#1B5E41] bg-emerald-50/50 ring-2 ring-[#1B5E41]/15"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            paymentMethod === "QR" ? "border-[#1B5E41]" : "border-gray-300"
                          }`}
                        >
                          {paymentMethod === "QR" && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#1B5E41]" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-900">
                            Quét mã VNPAY-QR trực tiếp
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Mở thẳng giao diện mã QR ngân hàng trên VNPAY
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded bg-emerald-700 text-white font-black text-[10px] shrink-0">
                        QR
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-4 border-t border-gray-100">
                <span className="font-medium text-gray-500">Tổng thanh toán</span>
                <span className="font-extrabold text-xl text-[#1B5E41]">
                  {isFree ? "0đ (Miễn phí)" : `${Number(trail.price).toLocaleString("vi-VN")}đ`}
                </span>
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button 
                onClick={() => setIsPurchaseModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl transition-colors hover:bg-gray-200 cursor-pointer"
              >
                Đóng
              </button>
              <button 
                onClick={handleConfirmPurchase}
                disabled={isPurchasing}
                className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors shadow-lg cursor-pointer ${
                  isPurchasing
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#1B5E41] hover:bg-[#12402C] shadow-emerald-900/20"
                }`}
              >
                {isPurchasing
                  ? "Đang chuyển VNPAY..."
                  : isFree
                  ? "Mở khóa miễn phí"
                  : "Thanh toán VNPAY"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
