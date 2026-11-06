import { ErrorAlert, InfoBanner, ModalShell, SurfaceCard, Textarea } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/lib/api-client';
import { Link, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { cancelBookingOnce, cancellationError, getCancellationAttempt } from '../cancellation-session';
import { refundMoney } from '../refund.utils';
import { bookingApiService } from '../services/booking.api';
import type { BookingDetail, CancelBookingResponse, CancellationPreview } from '../types';
import { BookingFlowButton, flowStyles as s } from './BookingFlowUI';
import { BookingRefunds } from './BookingRefunds';

export interface CancelBookingModalProps {
  visible: boolean;
  bookingId: string;
  totalAmount?: string;
  onClose: () => void;
  onSuccess: (result: CancelBookingResponse) => void;
}
const REASONS = ['Thay đổi lịch cá nhân', 'Lý do sức khỏe', 'Không thể tham gia chuyến đi'];

export function CancelBookingModal(props: CancelBookingModalProps) {
  const { user, accessToken } = useAuth();
  if (!props.visible) return null;
  if (!user?.id || !accessToken) return <ModalShell visible onClose={props.onClose} title="Vui lòng đăng nhập"><Text style={s.body}>Đăng nhập lại để xem điều kiện hủy đặt chỗ.</Text><BookingFlowButton label="Đóng" onPress={props.onClose} /></ModalShell>;
  const scope = user.id + ':' + props.bookingId;
  return <CancellationForm key={scope} {...props} scope={scope} token={accessToken} />;
}

function CancellationForm({ bookingId, onClose, onSuccess, scope, token }: CancelBookingModalProps & { scope: string; token: string }) {
  const saved = getCancellationAttempt(scope);
  const [reason, setReason] = useState(saved?.reason ?? '');
  const [result, setResult] = useState<CancelBookingResponse | null>(saved?.result ?? null);
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [alreadyCancelled, setAlreadyCancelled] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(!!saved && !saved.result);
  const [error, setError] = useState('');
  const active = useRef(true);
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const check = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setPreview(null);
    setError('');
    try {
      const next = await bookingApiService.cancellationPreview(bookingId, token);
      if (!active.current || request !== generation.current) return;
      setPreview(next);
    } catch (cause) {
      if (!active.current || request !== generation.current) return;
      if (cause instanceof ApiError && [409, 410].includes(cause.status)) {
        try {
          const booking = await bookingApiService.getBookingDetail(bookingId, token, 8000);
          if (!active.current || request !== generation.current) return;
          if (booking.status === 'CANCELLED') { setAlreadyCancelled(booking); return; }
        } catch { /* Keep the preview error and never guess a refund. */ }
      }
      if (active.current && request === generation.current) setError(cancellationError(cause));
    } finally {
      if (active.current && request === generation.current) setLoading(false);
    }
  }, [bookingId, token]);

  useEffect(() => {
    if (result) return;
    const timer = setTimeout(() => void check(), 0);
    return () => clearTimeout(timer);
  }, [check, result]);

  async function confirm() {
    if (pending.current || loading || !preview?.canCancel || !reason.trim() || reason.trim().length > 500) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await cancelBookingOnce(scope, bookingId, reason, token);
      if (!active.current) return;
      setResult(response);
      setUncertain(false);
      onSuccess(response);
    } catch (cause) {
      if (!active.current) return;
      const retained = getCancellationAttempt(scope);
      setUncertain(!!retained);
      if (!retained) await check();
      if (active.current) setError(cancellationError(cause));
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  const close = () => { if (!pending.current) onClose(); };
  const locked = busy || uncertain;
  return <ModalShell visible onClose={close} closeOnOverlayPress={!busy} style={{ maxHeight: '92%', borderRadius: 24, backgroundColor: '#ffffff', padding: 0 }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flexShrink: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} style={{ flexGrow: 0 }}>
        <Text style={s.title}>{result || alreadyCancelled ? 'Đặt chỗ đã hủy' : 'Hủy đặt chỗ'}</Text>
        {result || alreadyCancelled ? <>
          {!result && <InfoBanner tone="info" message="Đặt chỗ này đã được hủy. Bạn có thể theo dõi khoản hoàn bên dưới." style={s.banner} />}
          <BookingRefunds bookingId={bookingId} booking={alreadyCancelled} cancellation={result} />
          <BookingFlowButton label="Xong" onPress={close} fullWidth />
        </> : <>
          <Text style={s.body}>Hủy đặt chỗ sẽ hủy vé của tất cả người tham gia trong đơn.</Text>
          {loading ? <Text accessibilityLiveRegion="polite" style={s.body}>Đang kiểm tra điều kiện hủy và số tiền dự kiến hoàn…</Text> : null}
          {error ? <ErrorAlert message={error} onRetry={!busy ? () => void check() : undefined} /> : null}
          {preview && <SurfaceCard style={[s.inset, { borderWidth: 0 }]}>
            <Text style={s.muted}>Số tiền dự kiến được hoàn</Text>
            <Text style={s.money}>{refundMoney(preview.refundableAmount, preview.currency)}</Text>
            <Text style={s.muted}>Số tiền được tính lại theo chính sách khi bạn xác nhận hủy.</Text>
          </SurfaceCard>}
          {preview?.tripCancellationPending && <InfoBanner tone="warning" title="Chuyến đang chờ duyệt hủy" message="Nếu bạn tự hủy lúc này, mức hoàn được tính theo chính sách hiện tại. Bạn sẽ không nhận thêm khoản hoàn nếu chuyến được duyệt hủy sau đó." style={s.banner} />}
          {preview && !preview.canCancel && <InfoBanner tone="warning" title="Chưa thể hủy đặt chỗ" message="Cần xử lý các đơn thuê liên quan trước. Kiểm tra lại sau khi đã hoàn tất." style={s.banner} />}
          {preview?.rentals.map((rental, index) => <View key={rental.orderId ?? String(index)} style={s.inset}>
            <Text style={s.body}>{rental.ownedByViewer ? 'Đơn thuê của bạn cần được xử lý trước.' : 'Đơn thuê của thành viên cần được xử lý trước.'}</Text>
            {rental.ownedByViewer && rental.orderId && <Link href={('/rental-orders/' + encodeURIComponent(rental.orderId)) as Href} style={{ color: '#163300', fontWeight: '700', paddingVertical: 12 }}>Xem đơn thuê →</Link>}
          </View>)}
          {uncertain && <InfoBanner title="Chưa nhận được kết quả" message="Bạn có thể kiểm tra lại hoặc gửi lại cùng yêu cầu. Nội dung được giữ nguyên để tránh hủy nhiều lần." style={s.banner} />}
          <Text style={s.heading}>Lý do hủy</Text>
          <View style={{ gap: 8 }}>
            {REASONS.map((item) => <Pressable key={item} disabled={locked} onPress={() => setReason(item)} accessibilityRole="button" accessibilityState={{ selected: reason === item, disabled: locked }} style={{ minHeight: 44, justifyContent: 'center', padding: 12, borderRadius: 16, backgroundColor: reason === item ? '#e2f6d5' : '#e8ebe6', opacity: locked ? 0.6 : 1 }}><Text style={s.body}>{item}</Text></Pressable>)}
          </View>
          <Textarea value={reason} onChangeText={setReason} editable={!locked} maxLength={500} placeholder="Nhập lý do hủy, tối đa 500 ký tự" accessibilityLabel="Lý do hủy đặt chỗ" style={{ fontSize: 16, lineHeight: 24, color: '#0e0f0c' }} containerStyle={{ borderRadius: 12 }} />
          <BookingFlowButton label={uncertain ? 'Gửi lại cùng yêu cầu' : 'Xác nhận hủy đặt chỗ'} loading={busy} disabled={loading || !preview?.canCancel || !reason.trim()} onPress={() => void confirm()} fullWidth />
          <BookingFlowButton label="Giữ đặt chỗ / Quay lại" appearance="quiet" disabled={busy} onPress={close} fullWidth />
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </ModalShell>;
}
