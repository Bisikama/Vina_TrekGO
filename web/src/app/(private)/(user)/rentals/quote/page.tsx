import { RentalQuotePage } from "@/features/rentals/components/RentalQuotePage";

type RentalQuoteRouteProps = {
  searchParams: Promise<{
    bookingId?: string | string[];
    productId?: string | string[];
    quantity?: string | string[];
  }>;
};

export default async function RentalQuoteRoute({
  searchParams,
}: RentalQuoteRouteProps) {
  const query = await searchParams;

  const bookingId =
    typeof query.bookingId === "string"
      ? query.bookingId
      : process.env.NEXT_PUBLIC_DEMO_BOOKING_ID ?? "";

  const productId =
    typeof query.productId === "string"
      ? query.productId
      : "";

  const requestedQuantity =
    typeof query.quantity === "string"
      ? Number(query.quantity)
      : 1;

  const initialQuantity =
    Number.isInteger(requestedQuantity) &&
    requestedQuantity > 0
      ? requestedQuantity
      : 1;

  return (
    <RentalQuotePage
      bookingId={bookingId}
      productId={productId}
      initialQuantity={initialQuantity}
    />
  );
}
