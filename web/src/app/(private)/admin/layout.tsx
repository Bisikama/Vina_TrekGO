import React from "react";
import { AdminLayoutChrome } from "@/features/core/components/admin/AdminLayoutChrome";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutChrome>{children}</AdminLayoutChrome>;
}
