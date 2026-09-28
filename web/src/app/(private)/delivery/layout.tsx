import type { ReactNode } from "react";
import { DeliveryShell } from "@/features/delivery/components/DeliveryShell";

export default function DeliveryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DeliveryShell>{children}</DeliveryShell>;
}
