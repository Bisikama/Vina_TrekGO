import React from "react";
import { UserHeader } from "@/features/core/components/UserHeader";
import { UserFooter } from "@/features/core/components/UserFooter";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <UserHeader />
      <main className="flex-grow">
        {children}
      </main>
      <UserFooter />
    </div>
  );
}
