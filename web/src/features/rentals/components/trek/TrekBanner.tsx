"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { MountainScene, Reveal, TopoOverlay } from "./TrekKit";

/**
 * Banner chủ đề trekking dùng chung cho các tab thuê thiết bị: nền đường đồng mức, dãy núi trôi,
 * tiêu đề hai dòng (dòng 2 tô màu), nút hành động hoặc khối thông tin bên phải.
 */
export function TrekBanner({
  eyebrow,
  title,
  highlight,
  description,
  action,
  aside,
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  description?: string;
  action?: { href: string; label: string };
  aside?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0b2e22] via-[#123f30] to-[#1f5c44] px-6 pb-24 pt-8 text-white shadow-[0_20px_60px_rgba(11,46,34,.25)] sm:px-10 sm:pt-10">
      <TopoOverlay className="opacity-[0.09]" />
      <MountainScene className="h-28 sm:h-36" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.2em] text-[#bfe9c9]">{eyebrow}</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-[40px]">
            {title}
            {highlight ? (
              <>
                <br />
                <span className="bg-gradient-to-r from-[#bfe9c9] to-[#fde68a] bg-clip-text text-transparent">{highlight}</span>
              </>
            ) : null}
          </h1>
          {description ? <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/80">{description}</p> : null}
        </Reveal>
        {aside ? (
          <Reveal delay={200}>{aside}</Reveal>
        ) : action ? (
          <Reveal delay={200}>
            <Link href={action.href} className="group inline-flex items-center gap-2 rounded-2xl bg-[#f59e0b] px-5 py-3 text-sm font-bold text-[#3b2302] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#fbbf24]">
              {action.label}
              <span className="transition group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        ) : null}
      </div>
    </header>
  );
}
