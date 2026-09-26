import { RentalProductDetailPage } from "@/features/rentals/components/RentalProductDetailPage";

type RentalProductPageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    bookingId?: string | string[];
  }>;
};

export default async function RentalProductPage({
  params,
  searchParams,
}: RentalProductPageProps) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  const bookingId =
    typeof query.bookingId === "string"
      ? query.bookingId
      : process.env.NEXT_PUBLIC_DEMO_BOOKING_ID ??
        "booking_001";

  return (
    <RentalProductDetailPage
      productId={id}
      bookingId={bookingId}
    />
  );
}