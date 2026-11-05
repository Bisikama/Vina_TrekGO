import type { PaymentGateway } from './types';

export const paymentGatewayLabels: Record<PaymentGateway, string> = {
  vnpay: 'VNPay',
  momo: 'MoMo',
  payos: 'Chuyển khoản VietQR (PayOS)',
};

// A redirect only requests a server refresh; its query parameters never settle a payment.
export function isPayosReturnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const params = url.searchParams;
    const isCheckout = url.hostname === 'pay.payos.vn';
    return !isCheckout && (url.protocol === 'https:' || url.protocol === 'http:') &&
      (params.get('gateway') === 'payos' ||
        (params.has('orderCode') && params.has('id') && params.has('cancel')));
  } catch {
    return false;
  }
}
