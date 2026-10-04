"use client";

import React, { useState } from "react";
import { TripData } from "@/features/trips/data/mockTripsData";

export interface MemberData {
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
}

export const BookingPaymentStep = ({
  trip,
  participants,
  members,
  equipmentCost,
  onBack,
  onConfirmPayment,
}: BookingPaymentStepProps) => {
  const [paymentMethod, setPaymentMethod] = useState<
    "vnpay" | "momo" | "card" | "vietqr"
  >("vnpay");

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  // Tính toán chi phí
  const memberCount = Math.max(1, participants);
  const unitPrice = trip?.price || 2850000;
  const baseTripCost = unitPrice * memberCount;
  const vat = Math.round(baseTripCost * 0.08);
  const grandTotal = baseTripCost + vat + equipmentCost;

  const tripTitle = trip?.title || "Chinh phục Đỉnh Núi Bà Đen 986m";
  const tripCode = trip?.id || "TRK-BADEN-01";
  const dateStr = trip?.date
    ? `${trip.date.start} - ${trip.date.end}/${trip.date.year} (${trip.duration})`
    : "5 - 10/2026 (6 ngày)";

  const handleSubmit = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onConfirmPayment({
        method: paymentMethod,
      });
    }, 700);
  };

  return (
    <div className="flex-1 space-y-6">
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

        {/* Danh sách thành viên tóm tắt - Không dùng emoji icon */}
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
                        {m.phone || "0912 345 678"}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">Điểm đón:</span>{" "}
                      <span className="text-gray-800">
                        {m.pickupPoint || "Bến xe Mỹ Đình, Cổng số 2, Nam Từ Liêm, Hà Nội"}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">Size áo:</span>{" "}
                      <span className="text-gray-800">
                        {m.shirtSize || "Nam - Size L (1m68 - 1m75 | 65 - 73kg)"}
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

          {/* VNPAY Preview QR if selected */}
          {paymentMethod === "vnpay" && (
            <div className="ml-7 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex flex-col items-center justify-center rounded-lg bg-white p-3 border border-blue-200 shadow-sm">
                  {/* Mock QR */}
                  <div className="h-28 w-28 bg-gray-900 p-1 flex items-center justify-center rounded">
                    <div className="h-full w-full bg-white p-1.5 flex flex-col justify-between">
                      <div className="flex justify-between">
                        <div className="h-6 w-6 bg-black"></div>
                        <div className="h-6 w-6 bg-black"></div>
                      </div>
                      <div className="flex justify-center items-center py-2">
                        <span className="text-[9px] font-extrabold text-blue-800">
                          VNPAY
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <div className="h-6 w-6 bg-black"></div>
                        <div className="h-3 w-3 bg-black"></div>
                      </div>
                    </div>
                  </div>
                  <span className="mt-1.5 text-[10px] font-bold text-gray-500">
                    Mã QR VNPAY
                  </span>
                </div>
                <div className="space-y-1.5 text-center sm:text-left">
                  <p className="font-bold text-gray-900 text-sm">
                    Quét mã để thanh toán tức thì
                  </p>
                  <p className="text-gray-600">
                    1. Mở ứng dụng Ngân hàng (VCB Digibank, VietinBank iPay, MB Bank...)
                  </p>
                  <p className="text-gray-600">
                    2. Chọn tính năng <strong>Quét mã VNPAY-QR</strong> và quét mã trên
                  </p>
                  <p className="text-gray-600">
                    3. Bấm <strong>Xác nhận & Thanh toán ngay</strong> phía dưới để hoàn tất
                  </p>
                </div>
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
            <div className="ml-7 rounded-xl border border-pink-100 bg-pink-50/50 p-4 text-xs text-pink-950">
              <p className="font-bold">Thanh toán qua ứng dụng MoMo</p>
              <p className="mt-1 text-gray-700">
                Hệ thống sẽ chuyển hướng hoặc mở ứng dụng MoMo trên điện thoại để quý khách xác nhận thanh toán an toàn.
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

          {/* Card Form */}
          {paymentMethod === "card" && (
            <div className="ml-7 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  Số thẻ tín dụng / ghi nợ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="4123 •••• •••• 9876"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-800 outline-none focus:border-emerald-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Tên chủ thẻ (In hoa không dấu) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="NGUYEN HUNG"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-800 outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Hết hạn (MM/YY) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="12/28"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-800 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      CVV <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="•••"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-800 outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
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
                  Chuyển tiền tự động nhận diện qua số tài khoản TrekGO
                </p>
              </div>
            </div>
          </label>

          {/* VietQR Bank Info */}
          {paymentMethod === "vietqr" && (
            <div className="ml-7 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-3 border border-emerald-100">
                  <p className="text-gray-500">Ngân hàng thụ hưởng</p>
                  <p className="font-bold text-gray-900">MB Bank (Ngân hàng Quân Đội)</p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-emerald-100">
                  <p className="text-gray-500">Số tài khoản</p>
                  <p className="font-extrabold text-[#125238] text-sm tracking-wider">
                    0345 6789 999
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-emerald-100">
                  <p className="text-gray-500">Chủ tài khoản</p>
                  <p className="font-bold text-gray-900">CONG TY CP TREKGO VIET NAM</p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-emerald-100">
                  <p className="text-gray-500">Nội dung chuyển khoản</p>
                  <p className="font-bold text-red-600 text-sm">
                    {`TGO ${tripCode.replace(/[^A-Za-z0-9]/g, "")}`}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 italic">
                * Vui lòng điền chính xác nội dung chuyển khoản để hệ thống xác thực tự động trong 30 giây.
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
          disabled={isProcessing}
          onClick={handleSubmit}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#125238] px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-[#2f6b4f] disabled:opacity-75 cursor-pointer"
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
              Đang xử lý giao dịch...
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
