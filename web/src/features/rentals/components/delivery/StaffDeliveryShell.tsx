"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuthStore } from "@/features/auth";

const navigation = [["/delivery/tasks", "Nhiệm vụ hôm nay"], ["/delivery/field", "Bàn giao hiện trường"]] as const;

export function StaffDeliveryShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const displayName = user?.fullName || user?.name || user?.email?.split("@")[0] || "Nhân viên giao nhận";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "DL";

  return (
    <div className="min-h-screen bg-[#07110c] text-[#eef5ef]">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#071b13]">
        <div className="mx-auto flex min-h-[68px] max-w-[1440px] items-center gap-4 px-5 lg:px-7">
          <Link href="/delivery/tasks" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-white ring-2 ring-orange-400/40"><Image src="/brand/vina-trekgo-badge.png" alt="" width={44} height={44} priority /></span>
            <span><b className="block text-xl font-black leading-none">Vina TrekGo</b><small className="mt-1 block text-[10px] font-bold tracking-[.18em] text-emerald-100/60">RENTAL · BASECAMP</small></span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-700 text-xs font-black">{initials}</span>
            <p className="hidden text-sm font-bold sm:block">{displayName}<span className="block text-[11px] font-medium text-emerald-100/60">Giao nhận · trực tuyến</span></p>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-7 px-5 pb-20 pt-7 lg:grid-cols-[232px_minmax(0,1fr)] lg:px-7">
        <aside className="self-start lg:sticky lg:top-[94px]">
          <p className="px-3 pb-2 text-[11px] font-black uppercase tracking-[.16em] text-emerald-100/55">Giao nhận</p>
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1">
            {navigation.map(([href, label], index) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return <Link key={href} href={href} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? "bg-[#12291d] text-white shadow-[inset_3px_0_0_#f58b36]" : "text-emerald-50/60 hover:bg-white/5 hover:text-white"}`}><i className="w-5 font-mono text-[11px] not-italic opacity-70">{String(index + 1).padStart(2, "0")}</i>{label}</Link>;
            })}
          </nav>
          <div className="mt-4 hidden rounded-2xl border border-dashed border-emerald-800 p-4 text-xs leading-5 text-emerald-100/55 lg:block">Mỗi lần bàn giao chuyển custody. Quét QR kiện trước khi giao hoặc nhận.</div>
        </aside>
        <div className="min-w-0 overflow-hidden rounded-[28px] bg-[#0a1710]">{children}</div>
      </div>
    </div>
  );
}
