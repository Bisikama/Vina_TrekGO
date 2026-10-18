import React from "react";
import { UserHeader } from "@/features/core/components/UserHeader";
import { UserFooter } from "@/features/core/components/UserFooter";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col bg-white">
      <UserHeader />
      <main className="flex-grow min-w-0">
        {children}
      </main>
      <UserFooter />
    </div>
  );
}
