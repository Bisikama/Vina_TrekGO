import { Button, EmptyState, ErrorAlert, InfoBanner, LoadingState, ScreenHeader, ScreenShell, StatusBadge, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { cancellationError } from '../cancellation-session';
import { BookingFlowButton, flowStyles as s } from '../components/BookingFlowUI';
import { REFUND_INTERVAL, REFUND_LIMIT, REFUND_TIMEOUT, refundLabel, refundMoney } from '../refund.utils';
import { getTripCancellation, listTripCancellations, type TripCancellationDetail, type TripCancellationRequest } from '../services/trip-cancellation.api';

const labels: Record<string, string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt hủy', REJECTED: 'Đã từ chối', PENDING_REVIEW: 'Chờ Admin xem xét', PROCESSING: 'Đang xử lý', COMPLETED: 'Đã xử lý hủy', ACTION_REQUIRED: 'Cần hỗ trợ thêm' };
export function TripCancellationsScreen() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  if (!accessToken || user?.role !== 'LEADER') return <ScreenShell style={s.canvas}><ScreenHeader title="Yêu cầu hủy chuyến" onBack={() => router.back()} /><EmptyState title="Dành cho Leader" description="Đăng nhập tài khoản Leader để xem các yêu cầu của bạn." /></ScreenShell>;
  return <CancellationContent key={user.id} token={accessToken} />;
}

function CancellationContent({ token }: { token: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [list, setList] = useState<{ page: number; status: string; items: TripCancellationRequest[]; total: number } | null>(null);
  const [detail, setDetail] = useState<TripCancellationDetail | null>(null);
  const [error, setError] = useState('');
  const [loadingAttempt, setLoadingAttempt] = useState<number | null>(0);
  const [attempt, setAttempt] = useState(0);
  const loading = loadingAttempt === attempt;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') setAttempt((n) => n + 1); });
    return () => sub.remove();
  }, []);
  const items = list?.page === page && list.status === status ? list.items : [];
  const current = detail?.id === selected ? detail : null;
  useFocusEffect(useCallback(() => {
    let active = true, reads = 0;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = setTimeout(() => { active = false; clearTimeout(timer); setLoadingAttempt(null); }, REFUND_TIMEOUT);
    async function refresh() {
      try {
        if (selected) {
          const next = await getTripCancellation(token, selected);
          if (!active) return;
          setDetail(next);
          if (++reads < REFUND_LIMIT && next.status === 'APPROVED' && (next.executionStatus === 'PROCESSING' || next.refunds.some((r) => ['PENDING', 'PROCESSING'].includes(r.status)))) timer = setTimeout(refresh, REFUND_INTERVAL);
          else clearTimeout(deadline);
        } else {
          const next = await listTripCancellations(token, page, status);
          if (!active) return;
          setList({ page, status, items: next.items, total: next.total });
          clearTimeout(deadline);
        }
        setError('');
      } catch (cause) { if (active) { setError(cancellationError(cause)); clearTimeout(deadline); } }
      finally { if (active) setLoadingAttempt(null); }
    }
    setLoadingAttempt(attempt);
    void refresh();
    return () => { active = false; clearTimeout(timer); clearTimeout(deadline); };
  }, [token, page, status, selected, attempt]));
  return <ScreenShell scrollable style={s.canvas} contentContainerStyle={s.content}>
    <ScreenHeader title="Yêu cầu hủy chuyến" onBack={() => selected ? setSelected(null) : router.back()} />
    <View style={s.row}><Text style={s.title}>{selected ? 'Kết quả & tiến độ' : 'Theo dõi yêu cầu'}</Text><BookingFlowButton label="Tải lại" loading={loading} size="sm" onPress={() => setAttempt((n) => n + 1)} /></View>
    {error ? <ErrorAlert message={error} /> : null}
    {loading && (selected ? !current : !items.length) ? <LoadingState label="Đang tải yêu cầu…" /> : null}
    {!selected && <>
      <View style={s.row}>{[['', 'Tất cả'], ['PENDING', 'Chờ duyệt'], ['APPROVED', 'Đã duyệt'], ['REJECTED', 'Từ chối']].map(([value, label]) => <Button key={value} label={label} variant="secondary" style={{ borderRadius: 24, backgroundColor: status === value ? '#9fe870' : '#ffffff' }} size="sm" onPress={() => { setStatus(value); setPage(1); }} />)}</View>
      {!loading && !items.length && !error && <EmptyState title="Chưa có yêu cầu hủy chuyến" />}
      {items.map((item) => <SurfaceCard key={item.id} style={s.card}>
        <StatusBadge label={labels[item.status]} tone={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warning'} />
        <Text style={s.heading}>{item.trip.title}</Text><Text style={s.body}>{item.reason}</Text><Text style={s.muted}>Gửi lúc {new Date(item.requestedAt).toLocaleString('vi-VN')}</Text>
        <BookingFlowButton label="Xem kết quả và tiến độ" onPress={() => setSelected(item.id)} />
      </SurfaceCard>)}
      {list && list.total > 20 && <View style={s.row}><BookingFlowButton label="Trước" appearance="outline" disabled={loading || page <= 1} onPress={() => setPage((n) => n - 1)} /><Text style={s.body}>Trang {page} / {Math.ceil(list.total / 20)}</Text><BookingFlowButton label="Sau" appearance="outline" disabled={loading || page * 20 >= list.total} onPress={() => setPage((n) => n + 1)} /></View>}
    </>}
    {selected && current && <>
      <SurfaceCard style={s.card}>
        <Text style={s.title}>{current.trip.title}</Text><StatusBadge label={labels[current.status]} tone={current.status === 'APPROVED' ? 'success' : current.status === 'REJECTED' ? 'danger' : 'warning'} />
        <Text style={s.muted}>Lý do yêu cầu</Text><Text style={s.body}>{current.reason}</Text>
        {current.reviewNote && <View style={s.inset}><Text style={s.heading}>Phản hồi của Admin</Text><Text style={s.body}>{current.reviewNote}</Text></View>}
        {current.status === 'PENDING' && <InfoBanner tone="warning" message="Chuyến tạm ngừng nhận đăng ký trong khi chờ Admin duyệt yêu cầu. Đặt chỗ chưa bị hủy ở bước này." style={s.banner} />}
        {current.status === 'REJECTED' && <InfoBanner message="Yêu cầu hủy chưa được chấp nhận. Các đặt chỗ khách đã tự hủy trước đó không được khôi phục." style={s.banner} />}
        {current.status === 'APPROVED' && <><Text style={s.heading}>{labels[current.executionStatus] ?? 'Đang kiểm tra tiến độ'}</Text><Text style={s.body}>Đặt chỗ chờ xử lý: {current.remainingBookings}</Text><Text style={s.body}>Đơn thuê cần hỗ trợ: {current.actionRequiredRentals}</Text></>}
      </SurfaceCard>
      {current.status === 'APPROVED' && <SurfaceCard style={s.card}>
        <Text style={s.heading}>Khoản hoàn liên quan</Text><Text style={s.body}>Gồm khoản hoàn vé và thuê thiết bị. Trạng thái hủy và trạng thái hoàn tiền được theo dõi riêng.</Text>
        {current.refunds.length ? current.refunds.map((refund) => <View key={refund.status} style={s.inset}><StatusBadge label={refundLabel(refund.status)} tone={refund.status === 'SUCCEEDED' ? 'success' : refund.status === 'FAILED' ? 'danger' : 'warning'} /><Text style={s.money}>{refundMoney(refund._sum.amount ?? '0')}</Text><Text style={s.body}>{refund._count._all} khoản hoàn</Text></View>) : <Text style={s.body}>Chưa có thông tin khoản hoàn.</Text>}
        <Text style={s.muted}>Mở chi tiết đặt chỗ để xem riêng khoản hoàn tiền vé.</Text>
      </SurfaceCard>}
      <BookingFlowButton label="Quay lại danh sách" appearance="outline" onPress={() => setSelected(null)} />
    </>}
  </ScreenShell>;
}
