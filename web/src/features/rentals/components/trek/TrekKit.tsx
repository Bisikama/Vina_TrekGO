"use client";

import { createElement, type CSSProperties, type ReactNode, useEffect, useState } from "react";

// Bộ giao diện chủ đề trekking cho Gear Advisor và Tủ đồ. Hiệu ứng dùng class `trek-*` trong globals.css
// và tự tắt khi người dùng bật "giảm chuyển động".

/** Hiện dần khi cuộn tới (fade + trượt lên), có thể đặt độ trễ để tạo hiệu ứng lần lượt. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as = "div",
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
  style?: CSSProperties;
}) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return createElement(
    as,
    {
      ref: setElement,
      className: `trek-reveal ${visible ? "is-visible" : ""} ${className}`,
      style: { ...style, "--trek-delay": `${Math.min(delay, 900)}ms` } as CSSProperties,
    },
    children,
  );
}

// Dãy núi lặp lại mỗi 1200 đơn vị để trôi ngang liền mạch.
function ridgePath(heights: number[], base: number) {
  const step = 1200 / (heights.length - 1);
  const segment = (offset: number) =>
    heights.map((height, index) => `L${offset + index * step} ${base - height}`).join(" ");
  return `M0 ${base} ${segment(0)} ${segment(1200)} L2400 ${base} Z`;
}
const FAR = [40, 70, 55, 95, 80, 120, 90, 70, 105, 85, 60, 75, 40];
const MID = [30, 55, 85, 60, 100, 75, 50, 90, 65, 110, 70, 45, 30];
const NEAR = [20, 35, 25, 50, 30, 45, 60, 35, 55, 30, 40, 25, 20];

/** Ba lớp núi trôi chậm với tốc độ khác nhau, có mặt trời/sao mờ. Đặt trong khối `relative overflow-hidden`. */
export function MountainScene({ className = "", night = false }: { className?: string; night?: boolean }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 ${className}`}>
      <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="h-full w-full">
        {night ? (
          <g fill="#ffffff">
            {[[120, 30], [300, 55], [520, 20], [760, 45], [980, 25], [1100, 60]].map(([x, y], index) => (
              <circle key={x} cx={x} cy={y} r={1.6} className="trek-twinkle" style={{ animationDelay: `${index * 400}ms` }} />
            ))}
          </g>
        ) : null}
        <g className="trek-drift-slow" style={{ transformBox: "fill-box" }}>
          <path d={ridgePath(FAR, 200)} fill="rgba(255,255,255,0.05)" />
        </g>
        <g className="trek-drift-fast" style={{ transformBox: "fill-box" }}>
          <path d={ridgePath(MID, 200)} fill="rgba(255,255,255,0.07)" />
        </g>
        <path d={ridgePath(NEAR, 200)} fill="rgba(6,32,23,0.35)" />
      </svg>
    </div>
  );
}

/** Lớp đường đồng mức (bản đồ địa hình) phủ mờ lên nền. */
export function TopoOverlay({ dark = false, className = "opacity-[0.08]" }: { dark?: boolean; className?: string }) {
  return <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${dark ? "trek-topo-dark" : "trek-topo"} ${className}`} />;
}

// Sườn núi cho thanh tiến độ: leo từ chân (trái) lên đỉnh, phần còn lại là sườn xuống.
const ASCENT: Array<[number, number]> = [
  [8, 122], [40, 112], [70, 116], [105, 92], [135, 98], [165, 72], [190, 78], [222, 50], [248, 56], [278, 24], [300, 14],
];
const DESCENT: Array<[number, number]> = [[300, 14], [322, 30], [340, 26], [372, 60], [400, 72], [412, 122]];
const ASCENT_LENGTHS = ASCENT.slice(1).map(([x, y], index) => Math.hypot(x - ASCENT[index][0], y - ASCENT[index][1]));
const ASCENT_TOTAL = ASCENT_LENGTHS.reduce((sum, length) => sum + length, 0);

function pointOnAscent(fraction: number): [number, number] {
  let remaining = Math.max(0, Math.min(1, fraction)) * ASCENT_TOTAL;
  for (let index = 0; index < ASCENT_LENGTHS.length; index += 1) {
    const length = ASCENT_LENGTHS[index];
    if (remaining <= length) {
      const [x1, y1] = ASCENT[index];
      const [x2, y2] = ASCENT[index + 1];
      const t = length ? remaining / length : 0;
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    }
    remaining -= length;
  }
  return ASCENT[ASCENT.length - 1];
}

const toPoints = (points: Array<[number, number]>) => points.map(([x, y]) => `${x},${y}`).join(" ");

/** Tiến độ dạng leo núi: người đi bộ trên sườn núi, cắm cờ khi tới đỉnh. */
export function SummitProgress({
  value,
  total,
  tone = "light",
  className = "",
}: {
  value: number;
  total: number;
  tone?: "light" | "dark";
  className?: string;
}) {
  const fraction = total > 0 ? value / total : 0;
  const done = total > 0 && value >= total;
  const [hx, hy] = pointOnAscent(fraction);
  const onDark = tone === "dark";
  const id = onDark ? "summit-dark" : "summit-light";
  return (
    <svg viewBox="0 -14 420 146" className={`w-full overflow-visible ${className}`} role="img" aria-label={`Đã sẵn sàng ${value}/${total}`}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={onDark ? "#9bd8a9" : "#2f6b4f"} stopOpacity={onDark ? 0.35 : 0.22} />
          <stop offset="100%" stopColor={onDark ? "#9bd8a9" : "#2f6b4f"} stopOpacity={onDark ? 0.12 : 0.08} />
        </linearGradient>
      </defs>
      <polygon points={`${toPoints([...ASCENT, ...DESCENT.slice(1)])} 412,130 8,130`} fill={`url(#${id}-fill)`} />
      <polyline points={toPoints([...ASCENT, ...DESCENT.slice(1)])} fill="none" stroke={onDark ? "rgba(255,255,255,.35)" : "#cbd8cf"} strokeWidth={2} className="trek-trail-dash" />
      <polyline
        points={toPoints(ASCENT)}
        fill="none"
        stroke={onDark ? "#9bd8a9" : "#2f6b4f"}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: `${ASCENT_TOTAL * fraction} ${ASCENT_TOTAL}`, transition: "stroke-dasharray 1.1s cubic-bezier(.2,.7,.2,1)" }}
      />
      {/* Cờ trên đỉnh */}
      <line x1={300} y1={14} x2={300} y2={-8} stroke={onDark ? "#ffffff" : "#1f4a36"} strokeWidth={2} />
      <path d="M300 -8 L322 -2 L300 4 Z" fill={done ? "#f59e0b" : onDark ? "rgba(255,255,255,.35)" : "#cbd5e1"} className={done ? "trek-flag" : ""} />
      {/* Người leo */}
      <g style={{ transform: `translate(${hx}px, ${hy}px)`, transition: "transform 1.1s cubic-bezier(.2,.7,.2,1)" }}>
        <circle r={10} fill={done ? "#f59e0b" : onDark ? "#9bd8a9" : "#2f6b4f"} opacity={0.35} className="trek-ping" />
        <circle r={6.5} fill={done ? "#f59e0b" : onDark ? "#9bd8a9" : "#2f6b4f"} stroke="#ffffff" strokeWidth={2} />
      </g>
    </svg>
  );
}

export type TrailStep = { id: string; label: string; hint?: string; state: "done" | "current" | "todo" };

/** Các bước như cột mốc trên đường mòn; bước hiện tại có vòng sáng nhấp nháy. */
export function TrailStepper({ steps }: { steps: TrailStep[] }) {
  return (
    <ol className="relative">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
              <svg aria-hidden="true" className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-1 overflow-visible" preserveAspectRatio="none" viewBox="0 0 2 100">
                <line x1={1} y1={0} x2={1} y2={100} stroke={step.state === "done" ? "#2f6b4f" : "#c7d3ca"} strokeWidth={2} vectorEffect="non-scaling-stroke" className={step.state === "done" ? "" : "trek-trail-dash"} />
              </svg>
            ) : null}
            <a href={`#${step.id}`} className="group flex items-start gap-3">
              <span
                className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition ${
                  step.state === "done"
                    ? "bg-[#2f6b4f] text-white"
                    : step.state === "current"
                      ? "trek-pulse bg-[#f59e0b] text-white"
                      : "border-2 border-[#c7d3ca] bg-white text-[#8aaa94]"
                }`}
              >
                {step.state === "done" ? "✓" : index + 1}
              </span>
              <span className="pt-1">
                <span className={`block text-sm font-semibold ${step.state === "todo" ? "text-[#8b9b90]" : "text-[#203c2d]"} group-hover:text-[#2f6b4f]`}>{step.label}</span>
                {step.hint ? <span className="block text-[11px] leading-4 text-[#8b9b90]">{step.hint}</span> : null}
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export type WeatherKind = "sun" | "cloud-sun" | "moon" | "rain";

/** Icon thời tiết có chuyển động nhẹ: nắng xoay, mây trôi, mưa rơi, sao lấp lánh. */
export function WeatherGlyph({ kind, className = "h-10 w-10" }: { kind: WeatherKind; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {kind === "sun" || kind === "cloud-sun" ? (
        <g className="trek-spin-slow">
          <circle cx={kind === "sun" ? 24 : 18} cy={kind === "sun" ? 24 : 18} r={kind === "sun" ? 9 : 7} fill="#fbbf24" />
          {Array.from({ length: 8 }).map((_, index) => {
            const angle = (index * Math.PI) / 4;
            const cx = kind === "sun" ? 24 : 18;
            const r1 = kind === "sun" ? 13 : 10;
            const r2 = kind === "sun" ? 17 : 13;
            return <line key={index} x1={cx + Math.cos(angle) * r1} y1={cx + Math.sin(angle) * r1} x2={cx + Math.cos(angle) * r2} y2={cx + Math.sin(angle) * r2} stroke="#f59e0b" strokeWidth={2.4} strokeLinecap="round" />;
          })}
        </g>
      ) : null}
      {kind === "moon" ? (
        <>
          <path d="M30 10a14 14 0 1 0 8 25A12 12 0 0 1 30 10z" fill="#c7d2fe" />
          <circle cx={12} cy={12} r={1.5} fill="#a5b4fc" className="trek-twinkle" />
          <circle cx={40} cy={8} r={1.2} fill="#a5b4fc" className="trek-twinkle" style={{ animationDelay: "700ms" }} />
          <circle cx={8} cy={30} r={1} fill="#a5b4fc" className="trek-twinkle" style={{ animationDelay: "1300ms" }} />
        </>
      ) : null}
      {kind === "cloud-sun" || kind === "rain" ? (
        <g className="trek-cloud">
          <path d="M14 34a8 8 0 0 1 1.2-15.9A10 10 0 0 1 34.5 20 7 7 0 0 1 34 34z" fill={kind === "rain" ? "#94a3b8" : "#e2e8f0"} />
        </g>
      ) : null}
      {kind === "rain"
        ? [16, 24, 32].map((x, index) => (
            <line key={x} x1={x} y1={37} x2={x - 2} y2={43} stroke="#38bdf8" strokeWidth={2.2} strokeLinecap="round" className="trek-rain-drop" style={{ animationDelay: `${index * 250}ms` }} />
          ))
        : null}
    </svg>
  );
}

/** Vòng chờ hình la bàn. */
export function CompassLoader({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} role="status" aria-live="polite">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
        <circle cx={20} cy={20} r={17} fill="#f4f9f4" stroke="#2f6b4f" strokeWidth={2} />
        <text x={20} y={9} textAnchor="middle" fontSize={6} fontWeight={700} fill="#2f6b4f">N</text>
        <g className="trek-needle">
          <path d="M20 9 L23 20 L20 31 L17 20 Z" fill="#2f6b4f" />
          <path d="M20 9 L23 20 L17 20 Z" fill="#ef4444" />
        </g>
        <circle cx={20} cy={20} r={2} fill="#ffffff" stroke="#2f6b4f" />
      </svg>
      {label ? <span className="text-sm font-medium text-slate-600">{label}</span> : null}
    </span>
  );
}

/** Số bước hình biển chỉ đường. */
export function TrailSign({ number, done = false }: { number: number; done?: boolean }) {
  return (
    <span
      className={`grid h-10 w-12 shrink-0 place-items-center pr-1.5 text-sm font-bold text-white shadow-sm ${done ? "bg-[#2f6b4f]" : "bg-[#b45309]"}`}
      style={{ clipPath: "polygon(0 0, 78% 0, 100% 50%, 78% 100%, 0 100%)", borderRadius: "8px 0 0 8px" }}
    >
      {done ? "✓" : String(number).padStart(2, "0")}
    </span>
  );
}
