'use client';

import { InfoBanner } from '@/components/ui';
import { money } from '../booking.api';
import type { CancelBookingResponse } from '../types/booking.types';
import { isCancellationResultConsistent, isRefundNotRequired } from '../refund.utils';

export function BookingCancellationResult({ result }: { result: CancelBookingResponse }) {
  const refund = result.refund;
  const notRequired = isRefundNotRequired(result);
  const completed = refund?.status === 'SUCCEEDED' && result.refundProcessingStatus === 'COMPLETED';
  const consistent = isCancellationResultConsistent(result);
  let message = 'Đã hủy đặt chỗ. Đang xác minh trạng thái khoản hoàn.';
  if (notRequired) message = 'Đã hủy đặt chỗ. Không phát sinh khoản hoàn.';
  else if (completed) message = `Đã hủy đặt chỗ. Đã ghi nhận hoàn ${money(refund.amount)}.`;
  else if (consistent && refund?.status === 'FAILED') message = 'Đã hủy đặt chỗ. Hoàn không thành công, cần kiểm tra.';
  else if (result.refundProcessingStatus === 'PENDING' && (!refund || ['PENDING', 'PROCESSING'].includes(refund.status))) message = 'Đã hủy đặt chỗ. Khoản hoàn đang chờ xử lý.';
  return <div className="space-y-2" role="status">
    <InfoBanner tone={notRequired || completed ? 'success' : 'warning'}>{message}</InfoBanner>
  </div>;
}
