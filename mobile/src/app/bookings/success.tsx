import { useLocalSearchParams } from 'expo-router';

import { BookingSuccessScreen } from '@/screens/booking-success';

function getParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default function BookingSuccessRoute() {
  const params = useLocalSearchParams<{
    tripId?: string | string[];
    bookingId?: string | string[];
    amount?: string | string[];
  }>();

  const tripId =
    getParam(params.tripId) ?? 'trip_fansipan_oct';

  const bookingId =
    getParam(params.bookingId) ?? 'BKG-VTG-2026-0892';

  const parsedAmount = Number(
    getParam(params.amount),
  );

  const amount = Number.isFinite(parsedAmount)
    ? parsedAmount
    : 3_300_000;

  return (
    <BookingSuccessScreen
      tripId={tripId}
      bookingId={bookingId}
      amount={amount}
    />
  );
}