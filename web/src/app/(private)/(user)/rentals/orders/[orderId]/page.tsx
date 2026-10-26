import { RentalOrderDetailPage } from "@/features/rentals/components/RentalOrderDetailPage";
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) { const { orderId } = await params; return <RentalOrderDetailPage orderId={orderId} />; }
