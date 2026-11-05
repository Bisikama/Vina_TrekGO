'use client';

import { EmptyState, ErrorAlert, InfoBanner, LoadingState } from '@/components/ui';
import type { PaymentGateway, PaymentOption } from '../types/booking.types';

export const paymentGatewayLabels: Record<PaymentGateway, string> = {
  vnpay: 'VNPay', momo: 'MoMo', payos: 'Chuyển khoản VietQR (PayOS)',
};

const descriptions: Record<PaymentGateway, string> = {
  vnpay: 'Thanh toán bằng thẻ hoặc mã QR trên cổng VNPay.',
  momo: 'Thanh toán qua ví điện tử MoMo.',
  payos: 'Quét mã VietQR bằng ứng dụng ngân hàng. Đơn tự cập nhật khi nhận đủ tiền.',
};

export function BookingPaymentMethods({ options, value, onChange, disabled, loading, error, onRetry }: {
  options: PaymentOption[];
  value: PaymentGateway | undefined;
  onChange: (gateway: PaymentGateway) => void;
  disabled?: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) return <LoadingState message="Đang tải phương thức thanh toán..." className="p-4" />;
  if (error) return <ErrorAlert message={error} onRetry={onRetry} />;
  if (!options.length) return <EmptyState title="Chưa có phương thức thanh toán khả dụng" description="Vui lòng thử lại sau hoặc liên hệ hỗ trợ." />;

  const selected = options.find((option) => option.gateway === value);
  return <div className="space-y-3">
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-3 text-lg font-semibold">Chọn phương thức thanh toán</legend>
      {options.map((option) => <label key={option.gateway} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${value === option.gateway ? 'border-[#2F6B4F] bg-emerald-50 ring-2 ring-emerald-600/15' : 'border-[#E5E7EB] bg-white hover:border-[#2F6B4F]/50'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        <input type="radio" name="booking-payment-gateway" value={option.gateway} checked={value === option.gateway} onChange={() => onChange(option.gateway)} className="mt-1 h-4 w-4 accent-[#2F6B4F]" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[#1F2937]">{paymentGatewayLabels[option.gateway]}</span>
          <span className="mt-1 block text-xs leading-relaxed text-[#6B7280]">{descriptions[option.gateway]}</span>
          {option.environment === 'SANDBOX' && <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Thử nghiệm Sandbox</span>}
        </span>
      </label>)}
    </fieldset>
    {selected?.gateway === 'payos' && selected.environment === 'PRODUCTION' && <InfoBanner tone="warning">
      Đây là giao dịch chuyển khoản thật. Kiểm tra số tiền và người nhận trên trang thanh toán trước khi chuyển.
    </InfoBanner>}
  </div>;
}
