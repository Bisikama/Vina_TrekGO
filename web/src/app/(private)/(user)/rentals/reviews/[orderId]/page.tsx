import { RentalReviewFormPage } from "@/features/rentals/components/RentalReviewFormPage";
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) { const { orderId } = await params; return <RentalReviewFormPage orderId={orderId} />; }
