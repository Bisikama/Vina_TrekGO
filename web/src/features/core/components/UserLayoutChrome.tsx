"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { UserFooter } from "./UserFooter";
import { UserHeader } from "./UserHeader";

export function UserLayoutChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const rentalWorkspace = pathname.startsWith("/rentals");

  if (rentalWorkspace) return children;

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-white">
      <UserHeader />
      <main className="min-w-0 flex-grow">{children}</main>
      <UserFooter />
    </div>
  );
}
