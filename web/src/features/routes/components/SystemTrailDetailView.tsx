"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useStaticDataStore } from "@/lib/staticDataStore";
import { apiClient } from "@/lib/axios";
import {
  SystemTrail,
  purchaseTrail,
  getTrailPurchaseErrorMessage,
} from "../services/system-trails.api";
import { SystemTrailMap } from "./SystemTrailMap";
import {
  SurfaceCard,
  DifficultyBadge,
  Button,
} from "@/components/ui";

interface SystemTrailDetailViewProps {
  trail: SystemTrail;
}

export function SystemTrailDetailView({ trail }: SystemTrailDetailViewProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

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

    // Nếu chưa đăng nhập, mặc định là chưa mở khóa
    if (!accessToken || !user?.id) {
      setIsUnlocked(false);
      return;
    }

    // 1. Kiểm tra cache localStorage theo userId cụ thể
    const userUnlockedKey = `trail_unlocked:${user.id}:${trail.id}`;
    if (localStorage.getItem(userUnlockedKey) === "true") {
      setIsUnlocked(true);
    }

    // 2. Đồng bộ quyền thực tế từ Backend API (/api/v1/me/trail-accesses)
    let isCancelled = false;
    apiClient
      .get<any[]>("/api/v1/me/trail-accesses")
      .then((res) => {
        if (isCancelled) return;
        const items = Array.isArray(res.data) ? res.data : [];
        const hasAccess = items.some(
          (a: any) =>
            (a.systemTrailId === trail.id || a.systemTrail?.id === trail.id) &&
            a.status !== "REVOKED"
        );

        if (hasAccess) {
          setIsUnlocked(true);
          localStorage.setItem(userUnlockedKey, "true");
        } else {
          // Nếu Backend báo chưa có quyền thì xóa cache cũ để tránh lưu sai
          setIsUnlocked(false);
          localStorage.removeItem(userUnlockedKey);
        }
      })
      .catch((err) => {
        console.warn("Could not sync trail access from server:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [trail.id, accessToken, user?.id]);

  const handleOpenPurchaseModal = () => {
    setPurchaseError(null);
    if (!accessToken) {
      router.push("/public/login");
      return;
    }
    setIsPurchaseModalOpen(true);
  };

  const handleConfirmPurchase = async () => {
    try {
      setIsPurchasing(true);
      setPurchaseError(null);

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
        if (typeof window !== "undefined" && user?.id) {
          localStorage.setItem(`trail_unlocked:${user.id}:${trail.id}`, "true");
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
        if (typeof window !== "undefined" && user?.id) {
          localStorage.setItem(`trail_unlocked:${user.id}:${trail.id}`, "true");
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
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Quay lại
          </button>
          
          <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DifficultyBadge difficulty={trail.difficulty} />
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
                <Button 
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={handleOpenPurchaseModal}
                  className="bg-white! text-[#1B5E41]! hover:bg-emerald-50! shadow-lg"
                >
                  {isFree ? "Nhận cung đường miễn phí" : "Mở khóa lộ trình (VNPAY)"}
                </Button>
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
              type="button"
              onClick={() => setPurchaseSuccessMsg(null)}
              className="text-xs font-bold text-emerald-700 hover:underline ml-4 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {/* 3 Metric Cards sử dụng SurfaceCard */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <SurfaceCard className="flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3 text-[#1B5E41] font-bold">
              KM
            </div>
            <span className="text-gray-500 text-sm mb-1">Khoảng cách</span>
            <span className="text-xl font-bold text-gray-900">{trail.distanceKm} km</span>
          </SurfaceCard>

          <SurfaceCard className="flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 text-blue-600 font-bold">
              M
            </div>
            <span className="text-gray-500 text-sm mb-1">Độ cao</span>
            <span className="text-xl font-bold text-gray-900">{trail.elevationGainM} m</span>
          </SurfaceCard>

          <SurfaceCard className="flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-3 text-amber-600 font-bold">
              H
            </div>
            <span className="text-gray-500 text-sm mb-1">Thời gian dự kiến</span>
            <span className="text-xl font-bold text-gray-900">
              {trail.estimatedDurationMinutes 
                ? (trail.estimatedDurationMinutes >= 60 
                    ? `${Math.round(trail.estimatedDurationMinutes / 60)} giờ` 
                    : `${trail.estimatedDurationMinutes} phút`) 
                : "Chưa cập nhật"}
            </span>
          </SurfaceCard>
        </div>

        <SurfaceCard className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Mô tả cung đường & Bản đồ 3D</h2>
          <div className="prose max-w-none text-gray-600 mb-8">
            <p>
              {trail.description || "Đang tải dữ liệu mô tả chi tiết của cung đường này. Khi bạn mở khóa cung đường, bạn sẽ được cấp quyền truy cập vào bản đồ 3D MapLibre, các điểm checkpoint quan trọng, cảnh báo nguy hiểm và trạm y tế gần nhất dọc theo lộ trình."}
            </p>
          </div>
          
          <SystemTrailMap trail={trail} />
        </SurfaceCard>
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
              <Button 
                variant="ghost"
                onClick={() => setIsPurchaseModalOpen(false)}
                className="flex-1"
              >
                Đóng
              </Button>
              <Button 
                variant="primary"
                onClick={handleConfirmPurchase}
                disabled={isPurchasing}
                loading={isPurchasing}
                className="flex-1"
              >
                {isPurchasing
                  ? "Đang chuyển VNPAY..."
                  : isFree
                  ? "Mở khóa miễn phí"
                  : "Thanh toán VNPAY"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
