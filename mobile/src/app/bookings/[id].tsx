import { BookingCheckoutScreen } from "@/features/bookings/screens";
import { useLocalSearchParams } from "expo-router";

export default function BookingDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingCheckoutScreen bookingId={id} />;
}
