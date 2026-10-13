"use client";

import React, { useState } from "react";
import { TripData } from "@/features/trips/data/mockTripsData";

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
  onConfirmPayment: (paymentData: { method: string }) => void;
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
  const [paymentMethod, setPaymentMethod] = useState<
    "vnpay" | "momo" | "card" | "vietqr"
  >("vnpay");

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
    onConfirmPayment({
      method: paymentMethod,
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
          <button
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
          </button>
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

      {/* 2. CHỌN PHƯƠNG THỨC THANH TOÁN */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="font-bold text-gray-900">Chọn phương thức thanh toán</h3>
          <p className="text-xs text-gray-500">
            Mọi giao dịch đều được mã hóa bảo mật SSL 256-bit và bảo hiểm ký quỹ VFRS
          </p>
        </div>

        <div className="space-y-3">
          {/* VNPAY */}
          <label
            onClick={() => setPaymentMethod("vnpay")}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
              paymentMethod === "vnpay"
                ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <input
                type="radio"
                name="payment_method"
                checked={paymentMethod === "vnpay"}
                onChange={() => setPaymentMethod("vnpay")}
                className="h-4 w-4 accent-[#125238]"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-extrabold text-white text-xs">
                VNPAY
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">
                    VNPAY-QR (Ứng dụng Ngân hàng / Ví VNPAY)
                  </span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Hỗ trợ hơn 40 ứng dụng ngân hàng: Vietcombank, Techcombank, BIDV, MB...
                </p>
              </div>
            </div>
            <div className="hidden text-right text-xs font-semibold text-emerald-700 sm:block">
              Miễn phí giao dịch
            </div>
          </label>

          {/* VNPAY Details if selected */}
          {paymentMethod === "vnpay" && (
            <div className="ml-7 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-blue-950 text-sm">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Cổng thanh toán quốc gia VNPAY-QR</span>
              </div>
              <p className="text-gray-700">
                Sau khi bấm <strong>Xác nhận & Thanh toán ngay</strong>, hệ thống sẽ kết nối trực tiếp với cổng thanh toán VNPAY để khởi tạo phiên giao dịch cho đơn đặt chỗ của bạn.
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-medium text-gray-600">
                <span className="rounded bg-white px-2 py-0.5 border border-blue-200">VCB Digibank</span>
                <span className="rounded bg-white px-2 py-0.5 border border-blue-200">Techcombank</span>
                <span className="rounded bg-white px-2 py-0.5 border border-blue-200">BIDV SmartBanking</span>
                <span className="rounded bg-white px-2 py-0.5 border border-blue-200">MB Bank</span>
                <span className="rounded bg-white px-2 py-0.5 border border-blue-200">VietinBank iPay</span>
                <span className="rounded bg-white px-2 py-0.5 border border-blue-200">+35 Ngân hàng khác</span>
              </div>
            </div>
          )}

          {/* MoMo */}
          <label
            onClick={() => setPaymentMethod("momo")}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
              paymentMethod === "momo"
                ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <input
                type="radio"
                name="payment_method"
                checked={paymentMethod === "momo"}
                onChange={() => setPaymentMethod("momo")}
                className="h-4 w-4 accent-[#125238]"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#A50064] font-extrabold text-white text-xs">
                MoMo
              </div>
              <div>
                <span className="font-bold text-gray-900">Ví điện tử MoMo</span>
                <p className="text-xs text-gray-500">
                  Thanh toán qua ví MoMo hoặc liên kết tài khoản ngân hàng
                </p>
              </div>
            </div>
          </label>

          {/* MoMo sub-view */}
          {paymentMethod === "momo" && (
            <div className="ml-7 rounded-xl border border-pink-100 bg-pink-50/60 p-4 text-xs text-pink-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#A50064] text-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>Thanh toán siêu tốc qua Ví MoMo</span>
              </div>
              <p className="text-gray-700">
                Hệ thống sẽ kết nối đến ứng dụng Ví MoMo để bạn quét mã thanh toán hoặc liên kết tài khoản an toàn chỉ trong 1 chạm.
              </p>
            </div>
          )}

          {/* Thẻ tín dụng / Ghi nợ quốc tế */}
          <label
            onClick={() => setPaymentMethod("card")}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
              paymentMethod === "card"
                ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <input
                type="radio"
                name="payment_method"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
                className="h-4 w-4 accent-[#125238]"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 font-extrabold text-white text-[10px]">
                CARD
              </div>
              <div>
                <span className="font-bold text-gray-900">
                  Thẻ quốc tế (Visa, MasterCard, JCB)
                </span>
                <p className="text-xs text-gray-500">
                  Thanh toán trực tiếp bằng thẻ tín dụng hoặc thẻ ghi nợ quốc tế
                </p>
              </div>
            </div>
          </label>

          {/* Card Gateway notice */}
          {paymentMethod === "card" && (
            <div className="ml-7 rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-xs text-gray-900 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                <svg className="h-4 w-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Cổng thanh toán Quốc tế chuẩn PCI-DSS & 3D-Secure</span>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Khi bấm <strong>Xác nhận & Thanh toán ngay</strong>, bạn sẽ được chuyển hướng an toàn tới trang thanh toán bảo mật của ngân hàng đối tác. TrekGO <strong>không</strong> lưu trữ thông tin thẻ của bạn trên hệ thống nhằm bảo vệ tuyệt đối an toàn thông tin tài khoản.
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-gray-700">
                <span className="rounded bg-white px-2 py-1 border border-gray-200 shadow-xs">VISA</span>
                <span className="rounded bg-white px-2 py-1 border border-gray-200 shadow-xs">Mastercard</span>
                <span className="rounded bg-white px-2 py-1 border border-gray-200 shadow-xs">JCB</span>
                <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800 border border-emerald-200">Bảo mật SSL 256-bit</span>
              </div>
            </div>
          )}

          {/* Chuyển khoản VietQR */}
          <label
            onClick={() => setPaymentMethod("vietqr")}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
              paymentMethod === "vietqr"
                ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <input
                type="radio"
                name="payment_method"
                checked={paymentMethod === "vietqr"}
                onChange={() => setPaymentMethod("vietqr")}
                className="h-4 w-4 accent-[#125238]"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-800 font-extrabold text-white text-[10px]">
                VietQR
              </div>
              <div>
                <span className="font-bold text-gray-900">
                  Chuyển khoản Ngân hàng 24/7 (VietQR)
                </span>
                <p className="text-xs text-gray-500">
                  Chuyển tiền tự động nhận diện qua mã QR liên ngân hàng NAPAS
                </p>
              </div>
            </div>
          </label>

          {/* VietQR notice */}
          {paymentMethod === "vietqr" && (
            <div className="ml-7 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                <svg className="h-4 w-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Chuyển khoản liên ngân hàng tự động NAPAS 24/7</span>
              </div>
              <p className="text-gray-700">
                Hệ thống sẽ tạo mã VietQR động chứa chính xác số tiền và mã giao dịch của đơn đặt chỗ. Bạn chỉ cần mở bất kỳ ứng dụng ngân hàng nào để quét mã chuyển tiền nhanh 24/7 mà không cần gõ thủ công số tài khoản.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. NÚT ĐIỀU HƯỚNG */}
      <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
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
        </button>

        <button
          type="button"
          disabled={isProcessing || isHoldExpired}
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
              Đang kết nối cổng thanh toán...
            </>
          ) : (
            <>
              Xác nhận & Thanh toán ngay ({grandTotal.toLocaleString("vi-VN")}₫)
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
        </button>
      </div>
    </div>
  );
};
