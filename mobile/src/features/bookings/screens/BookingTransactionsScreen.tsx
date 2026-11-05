import { EmptyState, ErrorAlert, LoadingState, ScreenHeader, ScreenShell, StatusBadge, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { cancellationError } from '../cancellation-session';
import { BookingFlowButton, flowStyles as s } from '../components/BookingFlowUI';
import { REFUND_INTERVAL, REFUND_LIMIT, REFUND_TIMEOUT, refundLabel, refundMoney } from '../refund.utils';
import { bookingApiService } from '../services/booking.api';
import type { BookingTransactionsResponse } from '../types';

export function BookingTransactionsScreen() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  if (!user?.id || !accessToken) return <ScreenShell style={s.canvas}><ScreenHeader title="Giao dịch đặt chỗ" onBack={() => router.back()} /><EmptyState title="Vui lòng đăng nhập" description="Đăng nhập để xem các giao dịch của bạn." /></ScreenShell>;
  return <TransactionContent key={user.id} token={accessToken} />;
}

function TransactionContent({ token }: { token: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [snapshot, setSnapshot] = useState<{ page: number; data: BookingTransactionsResponse } | null>(null);
  const [error, setError] = useState('');
  const [loadingAttempt, setLoadingAttempt] = useState<number | null>(0);
  const [attempt, setAttempt] = useState(0);
  const loading = loadingAttempt === attempt;
  const data = snapshot?.page === page ? snapshot.data : null;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') setAttempt((n) => n + 1); });
    return () => sub.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true, reads = 0;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = setTimeout(() => { active = false; clearTimeout(timer); setLoadingAttempt(null); }, REFUND_TIMEOUT);
    async function refresh() {
      try {
        const next = await bookingApiService.listBookingTransactions(page, token);
        if (!active) return;
        setSnapshot({ page, data: next });
        setError('');
        reads++;
        if (reads < REFUND_LIMIT && next.items.some((item) => ['PENDING', 'PROCESSING'].includes(item.status))) timer = setTimeout(refresh, REFUND_INTERVAL);
        else clearTimeout(deadline);
      } catch (cause) {
        if (active) { setError(cancellationError(cause)); clearTimeout(deadline); }
      } finally { if (active) setLoadingAttempt(null); }
    }
    setLoadingAttempt(attempt);
    void refresh();
    return () => { active = false; clearTimeout(timer); clearTimeout(deadline); };
  }, [page, token, attempt]));
  return <ScreenShell scrollable style={s.canvas} contentContainerStyle={s.content}>
    <ScreenHeader title="Giao dịch đặt chỗ" onBack={() => router.back()} />
    <View style={s.row}><Text style={s.title}>Thu & hoàn tiền</Text><BookingFlowButton label="Tải lại" size="sm" loading={loading} onPress={() => setAttempt((n) => n + 1)} /></View>
    <Text style={s.body}>Mỗi lần thanh toán và mỗi khoản hoàn được ghi nhận riêng.</Text>
    {error ? <ErrorAlert message={error} /> : null}
    {loading && !data ? <LoadingState label="Đang tải giao dịch…" /> : null}
    {data && !data.items.length && <EmptyState title="Chưa có giao dịch đặt chỗ" />}
    {data?.items.map((item) => {
      const refund = item.kind === 'REFUND';
      const complete = item.status === 'SUCCEEDED';
      const label = refund ? refundLabel(item.status) : complete ? 'Đã ghi nhận thu' : item.status === 'FAILED' ? 'Thanh toán chưa thành công' : item.status === 'EXPIRED' ? 'Đã hết hạn' : item.status === 'CANCELLED' ? 'Đã hủy giao dịch' : 'Đang xử lý';
      const sign = complete && item.financialEffect !== 'NONE' ? item.financialEffect === 'CREDIT' ? '+ ' : '− ' : '';
      return <SurfaceCard key={item.kind + ':' + item.id} style={s.card}>
        <View style={s.row}><Text style={s.heading}>{refund ? 'Khoản hoàn' : 'Khoản thu'}</Text><StatusBadge label={label} tone={complete ? 'success' : item.status === 'FAILED' ? 'danger' : 'warning'} /></View>
        <Text style={s.money}>{sign}{refundMoney(item.amount, item.currency)}</Text>
        <Text style={s.body}>{refund ? 'Hoàn tiền liên quan đến đặt chỗ' : 'Thanh toán đặt chỗ chuyến đi'}</Text>
        <Text style={s.muted}>Tạo lúc {new Date(item.createdAt).toLocaleString('vi-VN')}{item.completedAt ? '\nGhi nhận lúc ' + new Date(item.completedAt).toLocaleString('vi-VN') : ''}</Text>
        <Text selectable style={s.muted}>Mã giao dịch: {item.id}</Text>
        {item.sourceId && <BookingFlowButton label="Xem đặt chỗ" appearance="outline" onPress={() => router.push(('/bookings/' + encodeURIComponent(item.sourceId!)) as Href)} />}
      </SurfaceCard>;
    })}
    {data && data.pagination.totalPages > 1 && <View style={s.row}>
      <BookingFlowButton label="Trước" appearance="outline" disabled={loading || page <= 1} onPress={() => setPage((n) => n - 1)} />
      <Text style={s.muted}>Trang {page} / {data.pagination.totalPages}</Text>
      <BookingFlowButton label="Sau" appearance="outline" disabled={loading || page >= data.pagination.totalPages} onPress={() => setPage((n) => n + 1)} />
    </View>}
  </ScreenShell>;
}
