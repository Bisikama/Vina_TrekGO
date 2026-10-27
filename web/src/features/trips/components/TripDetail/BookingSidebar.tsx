"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { TripData } from "../../data/mockTripsData";
import { useAuth } from "@/features/auth";
import {
  bookingApiService,
  formatBookingDateTime,
  type PersonalTicket,
} from "@/features/bookings/services/booking.api";
import type { BookingSummary } from "@/features/bookings/types/booking.types";

export const BookingSidebar = ({ trip }: { trip: TripData }) => {
  const { accessToken } = useAuth();
  const [myBooking, setMyBooking] = useState<BookingSummary | null>(null);
  const [myTicket, setMyTicket] = useState<PersonalTicket | null>(null);
  const [myPendingHold, setMyPendingHold] = useState<BookingSummary | null>(null);
  const [participants, setParticipants] = useState(1);
  const [showQrModal, setShowQrModal] = useState(false);

  const nowMs = Date.now();
  const openAtMs = trip.registrationOpenAt ? new Date(trip.registrationOpenAt).getTime() : null;
  const deadlineMs = trip.registrationDeadlineAt
    ? new Date(trip.registrationDeadlineAt).getTime()
    : null;

  const isNotOpenYet = openAtMs !== null && Number.isFinite(openAtMs) && nowMs < openAtMs;
  const isPastDeadline = deadlineMs !== null && Number.isFinite(deadlineMs) && nowMs >= deadlineMs;
  const isClosedStatus =
    trip.rawStatus === "CLOSED" ||
    trip.rawStatus === "IN_PROGRESS" ||
    trip.rawStatus === "COMPLETED" ||
    trip.rawStatus === "CANCELLED" ||
    isPastDeadline;
  const isFullyBooked = trip.rawStatus === "FULL" || trip.slots.booked >= trip.slots.total;
  const isBookingDisabled = isNotOpenYet || isClosedStatus || isFullyBooked;

  useEffect(() => {
    if (!trip?.id || !accessToken) return;

    Promise.allSettled([
      bookingApiService.listMyBookings({ pageSize: 50 }),
      bookingApiService.listMyTickets({ pageSize: 50 }),
    ]).then(([bookingsRes, ticketsRes]) => {
      if (bookingsRes.status === "fulfilled") {
        const items = bookingsRes.value?.items || [];
        const confirmed = items.find(
          (b) =>
            b.trip?.id === trip.id &&
            (b.status === "CONFIRMED" ||
              b.status === "PARTIAL_CHECKIN" ||
              b.status === "CHECKED_IN" ||
              b.status === "COMPLETED")
        );
        setMyBooking(confirmed || null);

        const pending = items.find(
          (b) => b.trip?.id === trip.id && b.status === "PENDING_PAYMENT"
        );
        setMyPendingHold(pending || null);
      }

      if (ticketsRes.status === "fulfilled") {
        const ticketItems = ticketsRes.value?.items || [];
        const matchedTicket = ticketItems.find(
          (t) =>
            t.trip?.id === trip.id &&
            t.participantStatus === "ACTIVE" &&
            t.bookingStatus !== "CANCELLED" &&
            t.bookingStatus !== "EXPIRED"
        );
        setMyTicket(matchedTicket || null);
      }
    });
  }, [trip?.id, accessToken]);

  return (
    <>
      <div className="sticky top-24 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {myBooking ? (
          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 shadow-sm font-bold text-xl">
                ✓
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                  Đã đặt & xác nhận vé
                </span>
                <h3 className="mt-2 text-base font-extrabold text-gray-900">
                  Bạn đã tham gia chuyến đi này!
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Số lượng: <strong>{myBooking.participantCount} thành viên</strong>
                </p>
                <p className="text-xs font-bold text-emerald-800 mt-1">
                  Tổng đã thanh toán: {Number(myBooking.totalAmount).toLocaleString("vi-VN")}₫
                </p>
              </div>

              <Link
                href={`/bookings/${myBooking.id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B5E41] py-3 text-xs font-bold text-white shadow-md shadow-emerald-900/10 hover:bg-[#154B36] transition cursor-pointer"
              >
                Xem Chi Tiết Vé Đặt Chỗ →
              </Link>
            </div>

            <div className="text-center pt-2">
              <Link
                href="/bookings"
                className="text-xs font-bold text-emerald-800 hover:underline"
              >
                ← Xem tất cả đặt chỗ & vé của tôi
              </Link>
            </div>
          </div>
        ) : myTicket ? (
          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 shadow-sm font-bold text-xl">
                ✓
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                  Vé định danh cá nhân
                </span>
                <h3 className="mt-2 text-base font-extrabold text-gray-900">
                  Bạn đã có vé tham gia chuyến đi này!
                </h3>
                <p className="mt-1 text-xs text-gray-600">
                  Họ tên trên vé: <strong className="text-gray-900">{myTicket.participantName}</strong>
                </p>
                <p className="mt-1 text-xs font-bold text-emerald-800">
                  Trạng thái:{" "}
                  {myTicket.checkinStatus === "CHECKED_IN"
                    ? "Đã điểm danh"
                    : myTicket.checkinStatus === "NO_SHOW"
                    ? "Vắng mặt"
                    : "Chưa điểm danh"}
                </p>
              </div>

              {myTicket.checkinCode &&
                myTicket.checkinStatus !== "CHECKED_IN" &&
                myTicket.checkinStatus !== "NO_SHOW" && (
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B5E41] py-3 text-xs font-bold text-white shadow-md shadow-emerald-900/10 hover:bg-[#154B36] transition cursor-pointer"
                  >
                    Mở Mã QR Check-in
                  </button>
                )}

              <Link
                href="/bookings"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white py-2.5 text-xs font-bold text-[#1B5E41] hover:bg-emerald-50 transition cursor-pointer"
              >
                Quản lý vé của tôi →
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Price Header */}
            <div className="border-b border-gray-100 p-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Giá trọn gói / người
                  </div>
                  <div className="text-2xl font-extrabold text-[#1B5E41]">
                    {trip.price.toLocaleString("vi-VN")}đ
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                    <span>✓</span>
                    <span>Đã gồm xe đưa đón, ăn uống, vé & bảo hiểm</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                    Bảo hiểm VFRS
                  </span>
                </div>
              </div>
            </div>

            {/* Booking Form */}
            <div className="space-y-4 p-5">
              {myPendingHold && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-2">
                  <p className="text-xs font-bold text-amber-900">
                    Bạn đang có đơn giữ chỗ chờ thanh toán ({myPendingHold.participantCount} chỗ)
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Đơn giữ chỗ của bạn vẫn được phép hoàn tất thanh toán ngay cả khi form đăng ký đã đóng, miễn là còn trong thời gian giữ chỗ.
                  </p>
                  <Link
                    href={`/bookings/${myPendingHold.id}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800 transition"
                  >
                    Tiếp tục thanh toán đơn giữ chỗ →
                  </Link>
                </div>
              )}

              {/* Date Selector */}
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-700">
                  Chọn ngày khởi hành
                </label>
                <div className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                  <div className="text-sm font-bold text-gray-900">
                    {trip.date.start} – {trip.date.end}/{trip.date.year}
                  </div>
                  <div className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                    Cố định
                  </div>
                </div>
                {trip.registrationDeadlineAt && (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px]">
                    <span className="font-semibold text-stone-600">Hạn chót đăng ký:</span>
                    <span className={`font-bold ${isClosedStatus ? "text-red-600" : "text-stone-900"}`}>
                      {formatBookingDateTime(trip.registrationDeadlineAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Quy mô & Tiến độ gom chỗ */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700">Quy mô đoàn</span>
                  <span className="font-extrabold text-gray-900">
                    {trip.slots.min || 1} – {trip.slots.total} người
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-gray-500 font-medium">
                      Đã đặt: <strong className="text-gray-900">{trip.slots.booked}/{trip.slots.total} chỗ</strong>
                    </span>
                    <span className="font-bold text-emerald-700">
                      Còn {Math.max(0, trip.slots.total - trip.slots.booked)} chỗ
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-[#1B5E41] transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((trip.slots.booked / Math.max(1, trip.slots.total)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-[11px] leading-tight">
                  {trip.slots.booked >= (trip.slots.min || 1) ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <span className="text-xs">✓</span> Đã đủ số lượng tối thiểu để khởi hành ({trip.slots.booked}/{trip.slots.min || 1})
                    </span>
                  ) : (
                    <span className="text-amber-800 font-semibold flex items-center gap-1">
                      Đang gom đoàn (còn thiếu {(trip.slots.min || 1) - trip.slots.booked} người để đạt tối thiểu {trip.slots.min || 1})
                    </span>
                  )}
                </div>
              </div>

              {/* Participants Selector */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-700">
                    Số lượng thành viên
                  </label>
                  <span className="text-[10px] font-medium text-emerald-600">
                    {trip.slots.statusText ||
                      `Còn ${trip.slots.total - trip.slots.booked} chỗ`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex w-32 shrink-0 items-center rounded-xl border border-gray-200 bg-gray-50">
                    <button
                      onClick={() => setParticipants(Math.max(1, participants - 1))}
                      className="flex h-10 w-10 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                      disabled={isBookingDisabled}
                    >
                      -
                    </button>
                    <div className="flex-1 text-center font-bold text-gray-900">
                      {participants}
                    </div>
                    <button
                      onClick={() =>
                        setParticipants(
                          Math.min(
                            Math.max(1, trip.slots.total - trip.slots.booked),
                            participants + 1,
                          ),
                        )
                      }
                      className="flex h-10 w-10 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                      disabled={isBookingDisabled}
                    >
                      +
                    </button>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-[10px] font-medium text-gray-500">
                      Tổng tạm tính
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {(trip.price * participants).toLocaleString("vi-VN")}đ
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <div className="text-[11px] leading-tight text-emerald-800">
                  Giữ chỗ ưu tiên khi tạo đơn. Khi đến hạn đóng form, các đơn giữ chỗ đã tạo trước đó vẫn được phép thanh toán đến hết thời gian giữ chỗ.
                </div>
              </div>

              <Link
                href={`/bookings/${trip.id}?participants=${participants}`}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-colors ${
                  isBookingDisabled
                    ? "pointer-events-none cursor-not-allowed bg-gray-100 text-gray-400"
                    : "bg-[#1B5E41] text-white shadow-md shadow-emerald-900/10 hover:bg-[#154B36]"
                }`}
              >
                {isNotOpenYet
                  ? "Chưa tới giờ mở đăng ký"
                  : isClosedStatus
                  ? "Đã đóng form đăng ký"
                  : isFullyBooked
                  ? "Đã hết chỗ"
                  : "Đặt chuyến đi này →"}
              </Link>

              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B5E41]/10 py-2 text-xs font-bold text-[#1B5E41] transition-colors hover:bg-[#1B5E41]/20">
                Yêu cầu tư vấn thêm qua Zalo/Hotline
              </button>

              <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-gray-500">
                Bảo mật thanh toán VNPAY/Momo 100%
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL HIỂN THỊ MÃ QR CHECK-IN CHO VÉ CÁ NHÂN */}
      {showQrModal && myTicket && myTicket.checkinCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                Mã vé #{myTicket.id.slice(0, 8)}
              </span>
              <h3 className="text-lg font-bold text-gray-900 mt-1">Mã QR Điểm Danh Chuyến Đi</h3>
              <p className="text-xs text-gray-500 mt-0.5">{trip.title}</p>
            </div>

            <div className="mx-auto inline-flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-100 bg-emerald-50/40 p-4 shadow-inner">
              <QRCodeSVG
                value={myTicket.checkinCode}
                size={220}
                fgColor="#125238"
                includeMargin
              />
              <p className="mt-2 text-[11px] font-mono font-bold text-emerald-900">
                {myTicket.participantName}
              </p>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Đưa mã QR này cho Trưởng đoàn (Leader) quét tại điểm đón tập kết để xác nhận có mặt.
            </p>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full rounded-xl bg-gray-900 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition cursor-pointer"
            >
              Đóng lại
            </button>
          </div>
        </div>
      )}
    </>
  );
};
