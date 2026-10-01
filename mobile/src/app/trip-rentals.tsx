import {
  Stack,
  useLocalSearchParams,
} from 'expo-router';

import { RentalCatalogScreen } from '@/screens/rental-catalog';
import { useTheme } from '@/hooks/use-theme';

export default function TripRentalsRoute() {
  const theme = useTheme();

  const { bookingId } =
    useLocalSearchParams<{
      bookingId?: string | string[];
    }>();

  const selectedBookingId =
    Array.isArray(bookingId)
      ? bookingId[0]
      : bookingId;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Kho đồ thuê',
          headerBackTitle: 'Chi tiết chuyến',
          headerTintColor: theme.primary,
          headerStyle: {
            backgroundColor:
              theme.surfaceElevated,
          },
          headerTitleStyle: {
            color: theme.text,
            fontWeight: '700',
          },
          headerShadowVisible: false,
        }}
      />

      <RentalCatalogScreen
        bookingId={
          selectedBookingId ??
          'booking_001'
        }
      />
    </>
  );
}