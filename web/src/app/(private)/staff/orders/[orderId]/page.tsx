import { StaffOrderPickingDetail } from "@/features/rentals/components/staff/StaffOrderPickingDetail";

type StaffOrderPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function StaffOrderPage({
  params,
}: StaffOrderPageProps) {
  const { orderId } = await params;

  return <StaffOrderPickingDetail orderId={orderId} />;
}