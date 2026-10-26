import { RentalEntryPage } from "@/features/rentals/components/RentalEntryPage";

type RentalsPageProps = {
  searchParams: Promise<{
    tripId?: string | string[];
    bookingId?: string | string[];
  }>;
};

export default async function RentalsPage({
  searchParams,
}: RentalsPageProps) {
  const query = await searchParams;

  const legacyTripId =
    typeof query.bookingId === "string" &&
    query.bookingId !== "booking_001"
      ? query.bookingId
      : undefined;

  const tripId =
    typeof query.tripId === "string"
      ? query.tripId
      : legacyTripId;

  return <RentalEntryPage tripId={tripId} />;
}
