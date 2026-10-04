import type { ReactNode } from "react";
import { DeliveryShell } from "@/features/delivery/components/DeliveryShell";

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
