"use client";

import dynamic from "next/dynamic";

import type { RentalSceneVariant } from "./RentalThreeCanvas";

const RentalThreeCanvas = dynamic(
  () => import("./RentalThreeCanvas").then((module) => module.RentalThreeCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center">
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/70">
          <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
          Đang dựng địa hình
        </div>
      </div>
    ),
  },
);

type RentalThreeVisualProps = {
  variant: RentalSceneVariant;
  progress?: number;
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
  className?: string;
  checks?: string[];
  footer?: string;
  compact?: boolean;
};

export function RentalThreeVisual({
  variant,
  progress,
  eyebrow,
  title,
  description,
  badge,
  className = "",
  checks = [],
  footer,
  compact = false,
}: RentalThreeVisualProps) {
  return (
    <section className={`relative isolate overflow-hidden rounded-[30px] border border-emerald-950/10 bg-[#071b13] text-white shadow-[0_28px_70px_-38px_rgba(4,35,24,0.75)] ${compact ? "min-h-[340px]" : "min-h-[440px]"} ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(55,128,82,0.3),transparent_48%),linear-gradient(105deg,rgba(3,22,15,0.98)_0%,rgba(4,31,21,0.9)_45%,rgba(5,28,20,0.36)_100%)]" />
      <div className="absolute inset-y-0 right-0 w-full lg:w-[72%]" aria-hidden="true">
        <RentalThreeCanvas variant={variant} progress={progress} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#061a12] via-[#061a12]/88 to-transparent lg:w-[64%]" />
      <div className={`relative z-10 flex max-w-[610px] flex-col justify-center p-7 sm:px-11 sm:py-10 ${compact ? "min-h-[340px]" : "min-h-[440px]"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">{eyebrow}</p>
          {badge ? <span className="rounded-full border border-emerald-200/20 bg-white/10 px-3 py-1 text-[10px] font-bold text-emerald-100 backdrop-blur-sm">{badge}</span> : null}
        </div>
        <h2 className={`mt-3 max-w-[580px] font-black leading-[1.02] tracking-[-0.045em] ${compact ? "text-4xl sm:text-[42px]" : "text-5xl sm:text-[60px]"}`}>{title}</h2>
        <p className="mt-4 max-w-[530px] text-base leading-7 text-emerald-50/75">{description}</p>
        {checks.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {checks.map((check) => (
              <span key={check} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-bold text-emerald-50 backdrop-blur-sm">
                <span className="text-emerald-300">✓</span>{check}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-100/60">
          <span className="font-mono tracking-[0.12em]">{footer || "22°18′N · 103°46′E · HOÀNG LIÊN SƠN"}</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#071b13]/60 px-3 py-2"><span className="text-orange-400">↻</span>Kéo để xoay địa hình</span>
        </div>
      </div>
    </section>
  );
}
