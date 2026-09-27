import { StaffDepositSettlement } from "@/features/rentals/components/staff/StaffDepositSettlement";

type StaffSettlementPageProps = {
  params: Promise<{
    returnId: string;
  }>;
};

export default async function StaffSettlementPage({
  params,
}: StaffSettlementPageProps) {
  const { returnId } = await params;

  return (
    <StaffDepositSettlement returnId={returnId} />
  );
}
