import React from "react";
import { UserLayoutChrome } from "@/features/core/components/UserLayoutChrome";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UserLayoutChrome>{children}</UserLayoutChrome>;
}
