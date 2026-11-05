"use client";

import React, { useState } from "react";
import { TripData } from "@/features/trips/data/mockTripsData";
import { Button, SurfaceCard } from "@/components/ui";
import type { PaymentGateway } from "../../types/booking.types";
import { useBookingPaymentOptions } from "../../hooks/useBookingPaymentOptions";
import { BookingPaymentMethods, paymentGatewayLabels } from "../BookingPaymentMethods";

export interface MemberData {
  id?: string;
  name: string;
  phone: string;
  sosContact: string;
  medicalNote: string;
  shirtSize: string;
  pickupPoint: string;
}

interface BookingPaymentStepProps {
  trip?: TripData | null;
  participants: number;
  members: MemberData[];
  equipmentCost: number;
  onBack: () => void;
  onConfirmPayment: (paymentData: { method: PaymentGateway }) => void;
  bookingCode?: string;
  remainingSeconds?: number;
  isHoldExpired?: boolean;
  isProcessingPayment?: boolean;
  errorMessage?: string | null;
}

export const BookingPaymentStep = ({
  trip,
  participants,
  members,
  equipmentCost,
  onBack,
  onConfirmPayment,
  bookingCode,
  remainingSeconds = 0,
  isHoldExpired = false,
  isProcessingPayment = false,
  errorMessage,
}: BookingPaymentStepProps) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentGateway>("vnpay");
  const { options, loading, error, retry } = useBookingPaymentOptions();
  const selectedGateway = options.find((option) => option.gateway === paymentMethod)?.gateway ?? options[0]?.gateway;

  const isProcessing = isProcessingPayment;

  // Tính toán chi phí
  const memberCount = Math.max(1, participants);
  const unitPrice = trip?.price || 0;
  const baseTripCost = unitPrice * memberCount;
  const vat = Math.round(baseTripCost * 0.08);
  const grandTotal = baseTripCost + vat + equipmentCost;

  const tripTitle = trip?.title || "Chuyến đi";
  const tripCode = bookingCode || trip?.id || "";
  const dateStr = trip?.date
    ? `${trip.date.start} - ${trip.date.end}/${trip.date.year} (${trip.duration})`
    : "Lịch trình mở";

  const handleSubmit = () => {
    if (!selectedGateway || isProcessing || isHoldExpired) return;
    onConfirmPayment({
      method: selectedGateway,
    });
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex-1 space-y-6">
      {/* Thông báo đếm ngược hạn giữ chỗ */}
      {remainingSeconds > 0 && !isHoldExpired && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span>Chỗ của bạn đang được tạm giữ. Vui lòng hoàn tất thanh toán trong:</span>
          </div>
          <div className="rounded-lg bg-amber-200/80 px-2.5 py-1 text-sm font-extrabold text-amber-950 font-mono">
            {timeFormatted}
          </div>
        </div>
      )}

      {/* Cảnh báo hết hạn giữ vé */}
      {isHoldExpired && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-bold text-red-800">
          Thời gian giữ chỗ đã hết hạn! Vui lòng quay lại bước trước để tạo lại lượt giữ vé mới.
        </div>
      )}


      {/* Thông báo lỗi nếu có */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. RÀ SOÁT THÔNG TIN ĐOÀN VÀ HÀNH TRÌNH */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Rà soát thông tin đặt chỗ</h3>
              <p className="text-xs text-gray-500">
                Vui lòng kiểm tra lại thông tin trước khi thực hiện thanh toán
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-emerald-700 cursor-pointer"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Sửa thông tin
          </Button>
        </div>

        {/* Chuyến đi tổng quan */}
        <div className="mt-4 rounded-xl bg-gray-50 p-4 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Mã tour: #{tripCode}
              </span>
              <h4 className="font-bold text-gray-900">{tripTitle}</h4>
              <p className="mt-0.5 text-xs text-gray-600">
                Khởi hành: <span className="font-semibold text-gray-800">{dateStr}</span> • Leader:{" "}
                <span className="font-semibold text-gray-800">
                  {trip?.leader?.name || "Leader hiện tại"}
                </span>
              </p>
            </div>
            <div className="rounded-lg bg-emerald-100/70 px-3 py-1.5 text-center sm:text-right">
              <div className="text-[11px] font-medium text-emerald-900">
                Số lượng người tham gia
              </div>
              <div className="text-base font-extrabold text-[#125238]">
                {memberCount} người
              </div>
            </div>
          </div>
        </div>

        {/* Danh sách thành viên tóm tắt */}
        <div className="mt-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
            Danh sách thành viên ({memberCount})
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {members.slice(0, memberCount).map((m, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-3.5 text-xs shadow-none"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">
                      {idx + 1}. {m.name || `Thành viên #${idx + 1}`}
                    </span>
                    {idx === 0 && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                        Trưởng đoàn
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 space-y-1.5 text-gray-600">
                    <p>
                      <span className="text-gray-500">SĐT:</span>{" "}
                      <span className="font-semibold text-gray-800">
                        {m.phone || "Chưa cung cấp"}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">Điểm đón:</span>{" "}
                      <span className="text-gray-800">
                        {m.pickupPoint || (trip?.location?.name || "Điểm tập kết của đoàn")}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">Size áo:</span>{" "}
                      <span className="text-gray-800">
                        {m.shirtSize || "Tiêu chuẩn"}
                      </span>
                    </p>
                    {m.sosContact && (
                      <p>
                        <span className="text-gray-500">Liên hệ khẩn cấp (SOS):</span>{" "}
                        <span className="text-gray-700">{m.sosContact}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SurfaceCard>
        <BookingPaymentMethods options={options} value={selectedGateway} onChange={setPaymentMethod}
          disabled={isProcessing || isHoldExpired} loading={loading} error={error} onRetry={retry} />
      </SurfaceCard>

      {/* 3. NÚT ĐIỀU HƯỚNG */}
      <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-200 cursor-pointer"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Quay lại sửa thông tin
        </Button>

        <Button
          type="button"
          disabled={isProcessing || isHoldExpired || loading || !selectedGateway}
          onClick={handleSubmit}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#125238] px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-[#2f6b4f] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isProcessing ? (
            <>
              <svg
                className="h-4 w-4 animate-spin text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Đang kết nối & chuyển hướng cổng thanh toán...
            </>
          ) : (
            <>
              Xác nhận & Thanh toán ({grandTotal.toLocaleString("vi-VN")}₫) qua {selectedGateway ? paymentGatewayLabels[selectedGateway] : "cổng thanh toán"}
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
