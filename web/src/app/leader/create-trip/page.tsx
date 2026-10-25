import { Suspense } from "react";
import { LeaderCreateTripStepOne } from "@/features/leaders/components/leader/LeaderCreateTripStepOne";

export default function LeaderCreateTripPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Đang tải...</div>}>
      <LeaderCreateTripStepOne />
    </Suspense>
  );
}
