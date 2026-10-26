"use client";

import React from "react";
import Link from "next/link";

export interface PageShellProps {
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "5xl" | "6xl" | "7xl" | "full";
  withTopOffset?: boolean;
  className?: string;
}

const maxWidthClasses: Record<NonNullable<PageShellProps["maxWidth"]>, string> = {
  sm: "max-w-3xl",
  md: "max-w-4xl",
  lg: "max-w-5xl",
  "5xl": "max-w-5xl",
  xl: "max-w-6xl",
  "6xl": "max-w-6xl",
  "2xl": "max-w-7xl",
  "7xl": "max-w-7xl",
  full: "max-w-[1440px]",
};

export function PageShell({
  children,
  maxWidth = "xl",
  withTopOffset = true,
  className = "",
}: PageShellProps) {
  return (
    <div
      className={`min-h-screen bg-[#F7F7F4] text-[#1F2937] px-4 sm:px-6 lg:px-8 pb-20 ${
        withTopOffset ? "pt-24 sm:pt-28" : "pt-6 sm:pt-8"
      } ${className}`}
    >
      <div className={`mx-auto ${maxWidthClasses[maxWidth]} space-y-6`}>
        {children}
      </div>
    </div>
  );
}

export interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  description,
  backHref,
  backLabel = "Quay lại",
  actions,
  badge,
  className = "",
}: PageHeaderProps) {
  const effectiveSubtitle = subtitle ?? description;

  return (
    <header className={`space-y-3 ${className}`}>
      {backHref && (
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] hover:text-[#125238] transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            {backLabel}
          </Link>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-widest text-[#2F6B4F]">
              {eyebrow}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F2937]">
              {title}
            </h1>
            {badge}
          </div>
          {effectiveSubtitle && (
            <p className="text-sm text-[#6B7280] leading-relaxed">
              {effectiveSubtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
