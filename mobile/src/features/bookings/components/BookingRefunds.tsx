import { ErrorAlert, InfoBanner, StatusBadge, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { cancellationError } from '../cancellation-session';
import { cancellationMessage, consistentCancellation, mergeRefunds, needsRefundTracking, REFUND_INTERVAL, REFUND_LIMIT, REFUND_TIMEOUT, refundLabel, refundMoney, refundPurpose } from '../refund.utils';
import { bookingApiService } from '../services/booking.api';
import type { BookingDetail, CancelBookingResponse } from '../types';
import { BookingFlowButton, flowStyles as s } from './BookingFlowUI';

interface Props { bookingId: string; booking?: BookingDetail | null; cancellation?: CancelBookingResponse | null }
export function BookingRefunds(props: Props) {
  const { user, accessToken } = useAuth();
  if (!user?.id || !accessToken) return null;
  return <RefundContent key={`${user.id}:${props.bookingId}`} {...props} token={accessToken} />;
}

function RefundContent({ bookingId, booking: initial = null, cancellation = null, token }: Props & { token: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<BookingDetail | null>(null);
  const [error, setError] = useState('');
  const [pollingAttempt, setPollingAttempt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const polling = pollingAttempt === attempt;
  const booking = snapshot ?? initial;
  const enabled = !!cancellation || initial?.status === 'CANCELLED' || !!initial?.refunds.length || initial?.paymentSummary?.applicationStatus === 'REJECTED';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') setAttempt((value) => value + 1); });
    return () => subscription.remove();
  }, []);

  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    let active = true, reads = 0;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = setTimeout(() => { active = false; clearTimeout(timer); setPollingAttempt(null); }, REFUND_TIMEOUT);
    async function refresh() {
      let pending = true;
      try {
        const next = await bookingApiService.getBookingDetail(bookingId, token, 8000);
        if (!active) return;
        setSnapshot(next);
        setError('');
        pending = needsRefundTracking(next, cancellation);
      } catch (cause) {
        if (!active) return;
        setError(cancellationError(cause));
      }
      reads++;
      if (!active) return;
      setPollingAttempt(pending && reads < REFUND_LIMIT ? attempt : null);
      if (pending && reads < REFUND_LIMIT) timer = setTimeout(refresh, REFUND_INTERVAL);
      else clearTimeout(deadline);
    }
    setPollingAttempt(attempt);
    void refresh();
    return () => { active = false; clearTimeout(timer); clearTimeout(deadline); };
  }, [enabled, bookingId, token, cancellation, attempt]));

  if (!enabled) return null;
  const refunds = mergeRefunds(booking?.refunds ?? [], cancellation);
  const authoritative = cancellation && booking?.refunds.find((item) => cancellation.refund ? item.refundId === cancellation.refund.refundId : item.purpose === 'BOOKING_CANCELLATION');
  const result = cancellation && authoritative ? { ...cancellation, refund: authoritative, refundProcessingStatus: authoritative.status === 'SUCCEEDED' ? 'COMPLETED' as const : 'PENDING' as const } : cancellation;
  const uncertain = !!result && !authoritative && !consistentCancellation(result);
  const pending = needsRefundTracking(booking, cancellation);
  return <SurfaceCard style={s.card}>
    <View style={s.row}><Text style={s.heading}>Khoản hoàn của bạn</Text><BookingFlowButton label="Kiểm tra lại" size="sm" loading={polling} onPress={() => setAttempt((value) => value + 1)} /></View>
    {result && <InfoBanner tone={result.refundProcessingStatus === 'COMPLETED' && !uncertain ? 'success' : 'info'} message={cancellationMessage(result)} style={s.banner} />}
    {error ? <ErrorAlert message={error} /> : null}
    {pending && <Text style={s.body}>{polling ? 'Đang kiểm tra khoản hoàn. Bạn có thể quay lại sau.' : 'Chưa có kết quả cuối cùng. Bấm Kiểm tra lại để xem thông tin mới.'}</Text>}
    {!pending && !refunds.length && !result && <Text style={s.body}>Chưa có thông tin khoản hoàn.</Text>}
    {refunds.map((refund) => <View key={refund.refundId} style={s.inset}>
      <View style={s.row}><StatusBadge tone={uncertain ? 'warning' : refund.status === 'SUCCEEDED' ? 'success' : refund.status === 'FAILED' ? 'danger' : 'warning'} label={uncertain ? 'Đang kiểm tra' : refundLabel(refund.status)} /><Text style={s.muted}>{refundPurpose(refund.purpose)}</Text></View>
      <Text style={s.money}>{refundMoney(refund.amount, refund.currency)}</Text>
      {refund.refundedAt && <Text style={s.muted}>Ghi nhận lúc {new Date(refund.refundedAt).toLocaleString('vi-VN')}</Text>}
      {refund.reconciliationRequired && <Text style={s.body}>Khoản hoàn này cần được kiểm tra thêm.</Text>}
      <Text selectable style={s.muted}>Mã hoàn: {refund.refundId}</Text>
    </View>)}
    <BookingFlowButton label="Xem lịch sử giao dịch" appearance="outline" onPress={() => router.push('/bookings/transactions' as Href)} />
  </SurfaceCard>;
}
