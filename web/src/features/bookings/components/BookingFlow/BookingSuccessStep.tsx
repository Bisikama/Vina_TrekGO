"use client";

import React from "react";
import Link from "next/link";
import { TripData } from "@/features/trips/data/mockTripsData";
import { MemberData } from "./BookingPaymentStep";

interface BookingSuccessStepProps {
  trip?: TripData | null;
  participants: number;
  members: MemberData[];
  bookingCode: string;
  paymentMethod: string;
  equipmentCost: number;
  totalAmount?: string | number;
  checkoutUrl?: string | null;
  qrData?: string | null;
}

export const BookingSuccessStep = ({
  trip,
  participants,
  members,
  bookingCode,
  paymentMethod,
  equipmentCost,
  totalAmount,
  checkoutUrl,
  qrData,
}: BookingSuccessStepProps) => {
  const memberCount = Math.max(1, participants);
  const unitPrice = trip?.price || 0;
  const baseTripCost = unitPrice * memberCount;
  const vat = Math.round(baseTripCost * 0.08);
  const grandTotal = totalAmount ? Number(totalAmount) : (baseTripCost + vat + equipmentCost);

  const tripTitle = trip?.title || "Chuyến đi";
  const dateStr = trip?.date
    ? `${trip.date.start} - ${trip.date.end}/${trip.date.year} (${trip.duration})`
    : "Lịch trình chính thức";

  const paymentLabelMap: Record<string, string> = {
    vnpay: "VNPAY-QR (Ngân hàng / Ví điện tử)",
    momo: "Ví điện tử MoMo",
    card: "Thẻ thanh toán Quốc tế (Visa/Master/JCB)",
    vietqr: "Chuyển khoản Ngân hàng (VietQR 24/7)",
  };

  const paymentName = paymentLabelMap[paymentMethod] || "Thanh toán trực tuyến";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Banner Thành công */}
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-[#125238]">
          <svg
            className="h-10 w-10 text-[#125238]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div className="mt-4">
          <span className="inline-block rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
            ✓ Đã xác nhận & Giữ chỗ thành công (VFRS Protected)
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
            Đặt Chỗ Thành Công!
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            Cảm ơn bạn đã lựa chọn TrekGO. Vé điện tử và mã QR kiểm lâm đã được gửi về số điện thoại và email của bạn.
          </p>
        </div>

        {/* E-Ticket Card */}
        <div className="mt-8 overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-5 sm:p-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-4 gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Vé Điện Tử E-Ticket
              </span>
              <h3 className="text-lg font-bold text-gray-900">{tripTitle}</h3>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-gray-500">Mã đặt chỗ:</span>
              <p className="font-mono text-base font-extrabold text-[#125238]">
                {bookingCode}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-gray-500">Thời gian khởi hành</p>
              <p className="font-bold text-gray-900 text-sm mt-0.5">{dateStr}</p>
            </div>
            <div>
              <p className="text-gray-500">Leader phụ trách</p>
              <p className="font-bold text-gray-900 text-sm mt-0.5">
                {trip?.leader?.name || "Leader hiện tại"} ({trip?.leader?.badge || "PRO"})
              </p>
            </div>
            <div>
              <p className="text-gray-500">Số lượng thành viên</p>
              <p className="font-bold text-gray-900 text-sm mt-0.5">
                {memberCount} người tham gia
              </p>
            </div>
            <div>
              <p className="text-gray-500">Phương thức thanh toán</p>
              <p className="font-semibold text-gray-900 mt-0.5">{paymentName}</p>
            </div>
            <div className="sm:col-span-2 border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">
                Tổng tiền đã thanh toán:
              </span>
              <span className="text-xl font-extrabold text-[#125238]">
                {grandTotal.toLocaleString("vi-VN")}₫
              </span>
            </div>
          </div>
        </div>

        {/* Danh sách thành viên đăng ký */}
        <div className="mt-6 text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">
            Danh sách thành viên đăng ký ({memberCount})
          </h4>
          <div className="space-y-2">
            {members.slice(0, memberCount).map((m, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-xs border border-gray-100"
              >
                <div>
                  <span className="font-bold text-gray-900">
                    {idx + 1}. {m.name || `Thành viên #${idx + 1}`}
                  </span>
                  <span className="ml-2 text-gray-500">
                    ({m.phone || "0912 345 678"})
                  </span>
                </div>
                <div className="text-right text-gray-600">
                  <span>{m.pickupPoint || "Bến xe Mỹ Đình, Cổng số 2, Nam Từ Liêm, Hà Nội"}</span>
                  <span className="mx-1.5 text-gray-300">•</span>
                  <span className="font-semibold text-emerald-800">
                    {m.shirtSize || "Size L"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mã QR / Thông tin thanh toán từ cổng */}
        {qrData && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-left text-xs text-emerald-950">
            <h4 className="font-bold flex items-center gap-1.5 text-emerald-900">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Dữ liệu thanh toán từ cổng (QR Data)
            </h4>
            <p className="mt-1.5 font-mono text-[11px] bg-white p-2.5 rounded-lg border border-emerald-200 break-all select-all text-gray-800">
              {qrData}
            </p>
          </div>
        )}

        {/* Thông tin chuẩn bị hành trình */}
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-left text-xs text-blue-950">
          <h4 className="font-bold flex items-center gap-1.5 text-blue-900">
            <svg
              className="h-4 w-4 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Lưu ý chuẩn bị trước ngày khởi hành
          </h4>
          <ul className="mt-2 space-y-1 list-disc list-inside text-gray-700">
            <li>Leader sẽ liên hệ và thêm bạn vào nhóm Zalo trước 3 ngày khởi hành.</li>
            <li>Chuẩn bị giày trekking có độ bám tốt, áo mưa mỏng và đồ dùng cá nhân.</li>
            <li>Tập trung đúng giờ tại điểm đón đã đăng ký để khởi hành đúng lịch trình.</li>
          </ul>
        </div>

        {/* Nút hành động */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          {checkoutUrl && (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 font-bold text-white shadow-md shadow-blue-900/10 transition hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Mở cổng thanh toán (VNPay / Ngân hàng)
            </a>
          )}

          <Link
            href="/bookings"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#125238] px-8 py-3.5 font-bold text-white shadow-md shadow-emerald-900/10 transition hover:bg-[#2f6b4f]"
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Xem danh sách đặt chỗ của tôi
          </Link>

          <Link
            href="/trips"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-8 py-3.5 font-semibold text-gray-700 transition hover:bg-gray-200"
          >
            Khám phá thêm chuyến đi
          </Link>
        </div>
      </div>
    </div>
  );
};
