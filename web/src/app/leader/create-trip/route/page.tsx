import { Suspense } from "react";
import { LeaderCreateTripStepTwo } from "@/features/leaders/components/leader/LeaderCreateTripStepTwo";

export default function LeaderCreateTripRoutePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Đang tải...</div>}>
      <LeaderCreateTripStepTwo />
    </Suspense>
  );
}
