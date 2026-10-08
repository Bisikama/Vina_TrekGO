import React from "react";
import { CreatePrivateTripForm } from "@/features/trips/components/CreatePrivateTrip";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tổ Chức Chuyến Đi Riêng | Vina TrekGO",
  description: "Tổ chức chuyến trekking dành riêng cho bạn bè",
};

export default function CreatePrivateTripPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-8 pb-12">
      <CreatePrivateTripForm />
    </div>
  );
}
