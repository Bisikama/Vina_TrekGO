import {
  useLocalSearchParams,
} from 'expo-router';

import { RentalProductDetailScreen } from '@/screens/rental-product-detail';

export default function RentalProductDetailRoute() {
  const {
    id,
    bookingId,
  } = useLocalSearchParams<{
    id?: string | string[];
    bookingId?: string | string[];
  }>();

  const resolvedProductId =
    Array.isArray(id)
      ? id[0]
      : id;

  const resolvedBookingId =
    Array.isArray(bookingId)
      ? bookingId[0]
      : bookingId;

  return (
    <RentalProductDetailScreen
      productId={
        resolvedProductId ?? ''
      }
      bookingId={
        resolvedBookingId ??
        process.env
          .EXPO_PUBLIC_DEMO_BOOKING_ID ??
        'booking_001'
      }
    />
  );
}