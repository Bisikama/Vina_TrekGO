import type { ReactNode } from "react";

import { LeaderShell } from "@/features/leaders/components/leader/LeaderShell";

export default function LeaderLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <LeaderShell>{children}</LeaderShell>;
}