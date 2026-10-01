import type { ReactNode } from "react";

import { StaffDeliveryShell } from "@/features/rentals/components/delivery/StaffDeliveryShell";

export default function DeliveryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <StaffDeliveryShell>
      {children}
    </StaffDeliveryShell>
  );
}