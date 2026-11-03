"use client";

import React from "react";

export interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  elevation?: "flat" | "card" | "floating";
  interactive?: boolean;
  as?: "div" | "section" | "article";
}

const paddingMap: Record<NonNullable<SurfaceCardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

const elevationMap: Record<NonNullable<SurfaceCardProps["elevation"]>, string> = {
  flat: "border border-[#E5E7EB]",
  card: "border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(31,41,55,0.06),0_1px_2px_-1px_rgba(31,41,55,0.04)]",
  floating:
    "border border-[#E5E7EB] shadow-[0_4px_12px_-2px_rgba(31,41,55,0.08),0_2px_6px_-2px_rgba(31,41,55,0.04)]",
};

export function SurfaceCard({
  children,
  padding = "md",
  elevation = "card",
  interactive = false,
  as: Component = "div",
  className = "",
  ...rest
}: SurfaceCardProps) {
  return (
    <Component
      className={`rounded-xl bg-white text-[#1F2937] ${paddingMap[padding]} ${elevationMap[elevation]} ${
        interactive
          ? "transition-all duration-150 hover:border-[#2F6B4F]/50 hover:shadow-md"
          : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface SurfaceSectionHeaderProps {
  stepNumber?: number | string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SurfaceSectionHeader({
  stepNumber,
  title,
  subtitle,
  action,
  className = "",
}: SurfaceSectionHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#E5E7EB] ${className}`}
    >
      <div className="flex items-center gap-3">
        {stepNumber !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#125238] text-xs font-bold text-white tabular-nums">
            {stepNumber}
          </span>
        )}
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#1F2937]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

