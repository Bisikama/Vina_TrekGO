import { AdminRentalOrderDetail } from "@/features/rentals/components/admin/AdminRentalOrderDetail";

export default async function AdminRentalOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <AdminRentalOrderDetail orderId={orderId} />;
}
