import type { ReactNode } from "react";

import { RentalWorkspaceShell } from "@/features/rentals/components/workspace/RentalWorkspaceShell";

export default function RentalsLayout({ children }: { children: ReactNode }) {
  return <RentalWorkspaceShell role="user">{children}</RentalWorkspaceShell>;
}
