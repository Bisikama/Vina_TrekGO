'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { bookingApi, dateTime, money } from '@/features/bookings/booking.api';
import type { Booking } from '@/features/bookings/booking.api';

function getVnpayErrorMessage(code: string | null): string {
  switch (code) {
    case '24':
      return 'Bạn đã hủy thao tác giao dịch trên cổng thanh toán VNPAY.';
    case '51':
      return 'Tài khoản của bạn không đủ số dư để thực hiện giao dịch.';
    case '11':
      return 'Đã hết thời gian chờ thanh toán trên cổng VNPAY. Vui lòng thử lại.';
    case '12':
      return 'Thẻ hoặc tài khoản ngân hàng của bạn hiện đang bị khóa.';
    case '13':
      return 'Mật khẩu xác thực (OTP) không chính xác. Vui lòng thử lại.';
    case '10':
      return 'Đã nhập thông tin thẻ/tài khoản không chính xác quá số lần quy định.';
    case '09':
      return 'Thẻ hoặc tài khoản chưa đăng ký dịch vụ Internet Banking.';
    case '07':
      return 'Giao dịch bị nghi ngờ có dấu hiệu bất thường từ phía ngân hàng.';
    case '75':
      return 'Ngân hàng thanh toán hiện đang trong thời gian bảo trì hệ thống.';
    case '79':
      return 'Nhập sai mật khẩu thanh toán quá số lần cho phép.';
    default:
      return 'Giao dịch thanh toán không thành công hoặc đã bị từ chối bởi ngân hàng.';
  }
}

function getMomoErrorMessage(code: string | null, defaultMessage?: string | null): string {
  switch (code) {
    case '1006':
      return 'Bạn đã hủy thao tác thanh toán trên ứng dụng MoMo.';
    case '1001':
      return 'Tài khoản MoMo của bạn không đủ số dư để thanh toán.';
    case '1004':
      return 'Số tiền giao dịch vượt quá hạn mức thanh toán trong ngày.';
    default:
      return defaultMessage || 'Bạn đã hủy thao tác hoặc chưa hoàn tất quy trình thanh toán trên ví MoMo.';
  }
}

type RentalPaymentReturnContext = {
  orderId: string;
  bookingId: string;
  paymentId: string;
};

function PaymentReturnContent() {
  const searchParams = useSearchParams();

  // Nhận diện cổng thanh toán
  const isVnpay = searchParams.has('vnp_ResponseCode');
  const isMomo = searchParams.has('resultCode');

  // Thông số từ VNPAY
  const vnpResponseCode = searchParams.get('vnp_ResponseCode');
  const vnpTransactionStatus = searchParams.get('vnp_TransactionStatus');
  const vnpTxnRef = searchParams.get('vnp_TxnRef');
  const vnpAmount = searchParams.get('vnp_Amount');
  const vnpTransactionNo = searchParams.get('vnp_TransactionNo');
  const vnpBankCode = searchParams.get('vnp_BankCode');
  const vnpPayDate = searchParams.get('vnp_PayDate');

  // Thông số từ MoMo
  const momoResultCode = searchParams.get('resultCode');
  const momoMessage = searchParams.get('message');
  const momoOrderId = searchParams.get('orderId');
  const momoAmount = searchParams.get('amount');
  const momoTransId = searchParams.get('transId');

  // Tham số ID đơn đặt chỗ
  const rawBookingId = searchParams.get('bookingId');
  const [rentalContext] =
    useState<RentalPaymentReturnContext | null>(() => {
      if (
        typeof window === 'undefined' ||
        rawBookingId
      ) {
        return null;
      }

      const stored = sessionStorage.getItem(
        'trekgo:rental-payment-return',
      );

      if (!stored) return null;

      try {
        const parsed = JSON.parse(
          stored,
        ) as Partial<RentalPaymentReturnContext>;

        if (
          typeof parsed.orderId === 'string' &&
          typeof parsed.bookingId === 'string' &&
          typeof parsed.paymentId === 'string'
        ) {
          return {
            orderId: parsed.orderId,
            bookingId: parsed.bookingId,
            paymentId: parsed.paymentId,
          };
        }
      } catch {
        return null;
      }

      return null;
    });

  // Load thông tin chi tiết đơn đặt chỗ và chuyến đi
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!rawBookingId) return;
    let active = true;

    bookingApi
      .detail(rawBookingId)
      .then((data) => {
        if (active) setBooking(data);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [rawBookingId]);

  // Xác định trạng thái thành công
  let isSuccess = false;
  let gatewayName = 'Cổng thanh toán';
  let failureReason = '';
  let amountFormatted = '';
  let transId = '';
  let orderRef = '';
  let bankCode = '';
  let payDateFormatted = '';

  if (isVnpay) {
    gatewayName = 'VNPAY';
    isSuccess = vnpResponseCode === '00' && (vnpTransactionStatus === '00' || !vnpTransactionStatus);
    failureReason = isSuccess ? '' : getVnpayErrorMessage(vnpResponseCode);
    if (vnpAmount) {
      const parsedAmount = Number(vnpAmount) / 100;
      if (!isNaN(parsedAmount)) amountFormatted = parsedAmount.toLocaleString('vi-VN') + '₫';
    }
    transId = vnpTransactionNo || '';
    orderRef = vnpTxnRef || '';
    bankCode = vnpBankCode || '';
    if (vnpPayDate && vnpPayDate.length === 14) {
      const year = vnpPayDate.substring(0, 4);
      const month = vnpPayDate.substring(4, 6);
      const day = vnpPayDate.substring(6, 8);
      const hour = vnpPayDate.substring(8, 10);
      const min = vnpPayDate.substring(10, 12);
      payDateFormatted = `${hour}:${min} - ${day}/${month}/${year}`;
    }
  } else if (isMomo) {
    gatewayName = 'MoMo';
    isSuccess = momoResultCode === '0';
    failureReason = isSuccess ? '' : getMomoErrorMessage(momoResultCode, momoMessage);
    if (momoAmount) {
      const parsedAmount = Number(momoAmount);
      if (!isNaN(parsedAmount)) amountFormatted = parsedAmount.toLocaleString('vi-VN') + '₫';
    }
    transId = momoTransId || '';
    orderRef = momoOrderId || '';
  } else {
    isSuccess = false;
    failureReason = 'Không tìm thấy thông tin phiên giao dịch tương ứng.';
  }

  // Lấy Trip ID để gắn vào nút "Xem chi tiết chuyến đi"
  const tripId = booking?.trip?.id;

  return (
    <div className="min-h-screen bg-[#F7F7F4] flex items-center justify-center px-4 py-16">
      <div className="max-w-xl w-full bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-200 text-center animate-fadeIn">
        {/* Biểu tượng trạng thái */}
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
            isSuccess
              ? 'bg-emerald-100 text-[#125238] shadow-lg shadow-emerald-900/10'
              : 'bg-amber-100 text-amber-700 shadow-lg shadow-amber-900/10'
          }`}
        >
          {isSuccess ? (
            <svg
              className="h-11 w-11 text-[#125238]"
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
          ) : (
            <svg
              className="h-11 w-11 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>

        {/* Tiêu đề & Nội dung phản hồi */}
        <div className="mt-6">
          <span
            className={`inline-block rounded-full px-4 py-1 text-xs font-bold border tracking-wide ${
              isSuccess
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {isSuccess
              ? rentalContext
                ? '✓ Cổng thanh toán đã tiếp nhận'
                : '✓ Giao dịch đã xác thực thành công'
              : '✗ Thanh toán chưa hoàn tất'}
          </span>

          <h1 className="mt-3.5 text-2xl sm:text-3xl font-extrabold text-gray-900">
            {isSuccess
              ? rentalContext
                ? 'Đang xác nhận đơn thuê'
                : 'Thanh Toán Thành Công!'
              : 'Thanh Toán Không Thành Công'}
          </h1>

          <p className="mt-2.5 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
            {isSuccess
              ? rentalContext
                ? `Cổng ${gatewayName} đã trả kết quả thành công. TrekGo đang tái xác minh giao dịch trước khi chuyển đơn thuê sang PAID.`
                : `Hệ thống TrekGo đã ghi nhận thanh toán từ cổng ${gatewayName}. Chỗ của bạn đã được đảm bảo và vé điện tử đã được xác nhận.`
              : failureReason}
          </p>
        </div>

        {rentalContext && (
          <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Đơn thuê thiết bị
            </span>
            <p className="mt-2 text-xs text-gray-600">
              Mã đơn: <strong className="text-gray-900">{rentalContext.orderId}</strong>
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Mã thanh toán: <strong className="text-gray-900">{rentalContext.paymentId}</strong>
            </p>
            <p className="mt-3 text-xs leading-5 text-amber-800">
              Kết quả trên trình duyệt chưa phải bằng chứng PAID. Trạng thái cuối cùng do Backend nhận webhook và đối soát.
            </p>
          </div>
        )}

        {/* Card thông tin chuyến đi đã thanh toán */}
        {booking && (
          <div className="mt-6 rounded-2xl bg-emerald-50/60 border border-emerald-100 p-4 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Thông tin chuyến đi
            </span>
            <h3 className="mt-1 font-bold text-gray-900 text-base">{booking.trip.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
              <span>📅 Khởi hành: <strong>{dateTime(booking.trip.startAt)}</strong></span>
              <span>👥 Số lượng: <strong>{booking.participantCount} người</strong></span>
              <span>💰 Tổng tiền: <strong className="text-[#125238]">{money(booking.totalAmount)}</strong></span>
            </div>
          </div>
        )}

        {/* Bảng chi tiết kết quả giao dịch đối tác */}
        <div className="mt-5 rounded-2xl bg-gray-50 border border-gray-100 p-4 sm:p-5 text-xs text-left space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200/60">
            <span className="text-gray-500 font-medium">Cổng thanh toán:</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  gatewayName === 'VNPAY' ? 'bg-[#005BAA]' : 'bg-[#A50064]'
                }`}
              />
              <span className="font-bold text-gray-800">{gatewayName} Sandbox</span>
            </div>
          </div>

          {amountFormatted && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Số tiền giao dịch:</span>
              <span className="font-extrabold text-[#125238] text-base">{amountFormatted}</span>
            </div>
          )}

          {transId && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Mã giao dịch đối tác:</span>
              <span className="font-mono font-semibold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px]">
                {transId}
              </span>
            </div>
          )}

          {orderRef && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Mã tham chiếu đơn:</span>
              <span className="font-mono text-gray-700 text-[11px] truncate max-w-[200px] bg-white px-2 py-0.5 rounded border border-gray-200">
                {orderRef}
              </span>
            </div>
          )}

          {bankCode && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Ngân hàng / Phương thức:</span>
              <span className="font-semibold text-gray-800 uppercase">{bankCode}</span>
            </div>
          )}

          {payDateFormatted && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Thời gian thanh toán:</span>
              <span className="font-medium text-gray-700">{payDateFormatted}</span>
            </div>
          )}

          {!isSuccess && isVnpay && vnpResponseCode && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-200/60">
              <span className="text-gray-500 font-medium">Mã phản hồi từ VNPAY:</span>
              <span className="font-mono font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded text-[11px]">
                Mã {vnpResponseCode}
              </span>
            </div>
          )}
        </div>

        {/* Các nút điều hướng */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          {isSuccess && rentalContext ? (
            <>
              <Link
                href={`/rentals?bookingId=${encodeURIComponent(
                  rentalContext.bookingId,
                )}`}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#125238] px-6 py-3.5 text-xs font-bold text-white shadow-md shadow-emerald-900/15 transition hover:bg-[#2f6b4f]"
              >
                Theo dõi đơn thuê
              </Link>
              <Link
                href="/"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-xs font-bold text-gray-700 transition hover:border-emerald-300 hover:text-[#125238]"
              >
                Quay lại trang chủ
              </Link>
            </>
          ) : isSuccess ? (
            <>
              {/* Nút Xem chi tiết chuyến đi đã đặt (chuyển thẳng tới trang vé & thông tin booking) */}
              <Link
                href={rawBookingId ? `/bookings/${rawBookingId}` : '/my-trips'}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#125238] px-6 py-3.5 text-xs font-bold text-white shadow-md shadow-emerald-900/15 transition hover:bg-[#2f6b4f] cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Xem chi tiết chuyến đi
              </Link>

              {/* Nút Xem bản đồ cung đường GPS 3D nếu có */}
              {tripId && (
                <Link
                  href={`/trips/${tripId}`}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-xs font-bold text-[#125238] transition hover:bg-emerald-100 cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  Bản đồ cung đường
                </Link>
              )}

              {/* Nút Quay lại trang chủ */}
              <Link
                href="/"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50 hover:border-emerald-300 hover:text-[#125238] cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Quay lại trang chủ
              </Link>
            </>
          ) : (
            <>
              {/* Nút Thử lại thanh toán */}
              {rawBookingId ? (
                <Link
                  href={`/bookings/${rawBookingId}`}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#125238] px-7 py-3.5 text-xs font-bold text-white shadow-md shadow-emerald-900/15 transition hover:bg-[#2f6b4f] cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Thử lại thanh toán
                </Link>
              ) : (
                <Link
                  href="/bookings"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#125238] px-7 py-3.5 text-xs font-bold text-white shadow-md shadow-emerald-900/15 transition hover:bg-[#2f6b4f] cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Về đơn đặt chỗ của tôi
                </Link>
              )}

              {/* Nút Quay lại trang chủ */}
              <Link
                href="/"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50 hover:text-gray-900 cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Quay lại trang chủ
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F7F4] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
            <p className="text-xs text-gray-500 font-medium">Đang xử lý kết quả giao dịch...</p>
          </div>
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
