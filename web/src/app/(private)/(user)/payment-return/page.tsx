'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const resultCode = searchParams.get('resultCode');
  const message = searchParams.get('message');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const transId = searchParams.get('transId');

  const isSuccess = resultCode === '0';

  return (
    <div className="min-h-screen bg-[#F7F7F4] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full bg-white rounded-3xl p-8 shadow-sm border border-gray-200 text-center">
        {/* Biểu tượng trạng thái */}
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            isSuccess ? 'bg-emerald-100 text-[#125238]' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isSuccess ? (
            <svg
              className="h-12 w-12 text-[#125238]"
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
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
        </div>

        {/* Tiêu đề & Nội dung */}
        <div className="mt-5">
          <span
            className={`inline-block rounded-full px-3.5 py-1 text-xs font-bold border ${
              isSuccess
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {isSuccess ? '✓ Giao dịch đã xác thực thành công' : '⏳ Giao dịch chưa hoàn tất'}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold text-gray-900">
            {isSuccess ? 'Thanh Toán Thành Công!' : 'Thanh Toán Chưa Hoàn Tất'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isSuccess
              ? 'Hệ thống đã ghi nhận thanh toán từ cổng đối tác. Vé điện tử và mã QR kiểm lâm sẽ được cập nhật trong đơn đặt chỗ của bạn.'
              : message ||
                'Bạn đã hủy thao tác hoặc chưa hoàn tất quy trình thanh toán trên cổng MoMo / Ngân hàng.'}
          </p>
        </div>

        {/* Bảng chi tiết giao dịch */}
        {(amount || transId || orderId) && (
          <div className="mt-6 rounded-2xl bg-gray-50 border border-gray-100 p-4 text-xs text-left space-y-2.5">
            {amount && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Số tiền:</span>
                <span className="font-extrabold text-[#125238] text-sm">
                  {Number(amount).toLocaleString('vi-VN')}₫
                </span>
              </div>
            )}
            {transId && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Mã giao dịch đối tác:</span>
                <span className="font-mono font-semibold text-gray-800">{transId}</span>
              </div>
            )}
            {orderId && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Mã tham chiếu đơn:</span>
                <span className="font-mono text-gray-600 text-[11px] truncate max-w-[200px]">
                  {orderId}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Các nút điều hướng */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/bookings"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#125238] px-6 py-3 text-xs font-bold text-white shadow-md shadow-emerald-900/10 transition hover:bg-[#2f6b4f]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-6 py-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
          >
            Khám phá thêm chuyến đi
          </Link>
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
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
