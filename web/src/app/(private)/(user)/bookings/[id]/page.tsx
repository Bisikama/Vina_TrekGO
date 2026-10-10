import { Suspense } from "react";
import { BookingLayout } from "@/features/bookings/components/BookingFlow/BookingLayout";

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F7F7F4]">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <BookingLayout />
    </Suspense>
  );
}
