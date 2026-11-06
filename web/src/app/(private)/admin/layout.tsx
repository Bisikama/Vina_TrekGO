import React from "react";
import { AdminSidebar } from "@/features/core/components/admin/AdminSidebar";
import { AdminHeader } from "@/features/core/components/admin/AdminHeader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh overflow-hidden bg-[#FDFDFD]">
      <AdminSidebar />
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {children}
        </main>
      </div>
    </div>
  );
}
