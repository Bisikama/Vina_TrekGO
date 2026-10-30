import type { ReactNode } from "react";

import { RentalWorkspaceShell } from "@/features/rentals/components/workspace/RentalWorkspaceShell";

export default function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <RentalWorkspaceShell role="staff">{children}</RentalWorkspaceShell>;
}
