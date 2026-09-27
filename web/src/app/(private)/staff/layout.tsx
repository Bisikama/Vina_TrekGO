import type { ReactNode } from "react";

import { StaffShell } from "@/features/rentals/components/staff/StaffShell";

export default function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <StaffShell>{children}</StaffShell>;
}