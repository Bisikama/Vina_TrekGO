import { StaffPackingDetail } from "@/features/rentals/components/staff/StaffPackingDetail";

type StaffPackingPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function StaffPackingPage({
  params,
}: StaffPackingPageProps) {
  const { orderId } = await params;

  return <StaffPackingDetail orderId={orderId} />;
}