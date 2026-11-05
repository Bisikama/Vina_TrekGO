import { InfoBanner } from '@/components/ui';
import { View } from 'react-native';
import { BookingFlowButton, flowStyles as s } from './BookingFlowUI';

export function TripCancellationNotice({ status, onRefresh, activeBooking = false }: { status?: string; onRefresh?: () => void; activeBooking?: boolean }) {
  if (status !== 'CANCEL_PENDING' && status !== 'CANCELLED') return null;
  const pending = status === 'CANCEL_PENDING';
  return <View style={{ gap: 8 }}>
    <InfoBanner tone="warning" title={pending ? 'Chuyến đang chờ duyệt hủy' : 'Chuyến đi đã hủy'} message={pending ? 'Leader đã gửi yêu cầu và đang chờ Admin xem xét. Chuyến tạm ngừng nhận đặt chỗ và thanh toán mới.' : 'Chuyến đi đã hủy. Xem khoản hoàn trong chi tiết đặt chỗ để biết kết quả của bạn.'} style={s.banner} />
    {pending && activeBooking && <InfoBanner tone="warning" message="Đặt chỗ của bạn chưa bị hủy. Nếu tự hủy lúc này, mức hoàn theo chính sách hiện tại và không được hoàn thêm khi chuyến được duyệt hủy sau đó." style={s.banner} />}
    {onRefresh && <BookingFlowButton label="Cập nhật trạng thái" appearance="outline" size="sm" onPress={onRefresh} />}
  </View>;
}
