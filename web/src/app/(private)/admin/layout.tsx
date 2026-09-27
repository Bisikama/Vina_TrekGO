import React from "react";
import { AdminSidebar } from "@/features/core/components/admin/AdminSidebar";
import { AdminHeader } from "@/features/core/components/admin/AdminHeader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#FDFDFD]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
