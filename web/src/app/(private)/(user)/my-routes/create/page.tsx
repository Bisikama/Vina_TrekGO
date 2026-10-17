import React from "react";
import { CreateRouteLayout } from "@/features/routes/components/CreateRoute/CreateRouteLayout";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tạo Cung Đường Mới | Vina TrekGO",
  description: "Tạo cung đường cá nhân mới",
};

export default function CreateRoutePage() {
  return <CreateRouteLayout />;
}
