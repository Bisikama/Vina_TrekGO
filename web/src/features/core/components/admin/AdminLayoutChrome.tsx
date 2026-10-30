"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { RentalWorkspaceShell } from "@/features/rentals/components/workspace/RentalWorkspaceShell";

import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";

export function AdminLayoutChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/rental-returns")) {
    return <RentalWorkspaceShell role="admin">{children}</RentalWorkspaceShell>;
  }

  return (
    <div className="flex min-h-screen bg-[#FDFDFD]">
      <AdminSidebar />
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
