import { ScreenHeader, ScreenShell } from '@/components/ui';
import { CancelBookingModal } from '@/features/bookings/components/CancelBookingModal';
import { BookingFlowButton, flowStyles } from '@/features/bookings/components/BookingFlowUI';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

export default function CancelBookingScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const bookingId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  function close() {
    setVisible(false);
    router.replace((bookingId ? '/bookings/' + encodeURIComponent(bookingId) : '/bookings') as Href);
  }
  return <ScreenShell style={flowStyles.canvas}>
    <ScreenHeader title="Hủy đặt chỗ" onBack={close} />
    {!bookingId ? <><Text style={flowStyles.body}>Chưa xác định được đặt chỗ cần hủy.</Text><BookingFlowButton label="Đặt chỗ của tôi" onPress={close} /></> : <CancelBookingModal bookingId={bookingId} visible={visible} onClose={close} onSuccess={() => undefined} />}
  </ScreenShell>;
}
