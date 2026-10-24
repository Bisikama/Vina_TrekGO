import { Suspense } from "react";
import { LeaderCreateTripReview } from "@/features/leaders/components/leader/LeaderCreateTripReview";

export default function LeaderCreateTripReviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Đang tải...</div>}>
      <LeaderCreateTripReview />
    </Suspense>
  );
}
