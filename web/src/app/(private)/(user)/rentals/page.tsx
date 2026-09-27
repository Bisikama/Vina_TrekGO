import { RentalCatalogPage } from "@/features/rentals/components/RentalCatalogPage";

type RentalsPageProps = {
  searchParams: Promise<{
    bookingId?: string | string[];
  }>;
};

export default async function RentalsPage({
  searchParams,
}: RentalsPageProps) {
  const query = await searchParams;

  const bookingId =
    typeof query.bookingId === "string"
      ? query.bookingId
      : process.env.NEXT_PUBLIC_DEMO_BOOKING_ID ??
        "booking_001";

  return <RentalCatalogPage bookingId={bookingId} />;
}