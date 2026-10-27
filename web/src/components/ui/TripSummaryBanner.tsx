"use client";

import React from "react";
import { SurfaceCard } from "./SurfaceCard";
import { StatusBadge } from "./StatusBadge";

export interface TripMetaItem {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  highlight?: boolean;
}

export function TripMetaGrid({
  items,
  columns = 4,
  className = "",
}: {
  items: TripMetaItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const colClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <div className={`grid gap-3 ${colClass} ${className}`}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-xl bg-[#F7F7F4] border border-[#E5E7EB]/80 px-3.5 py-2.5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
            {item.label}
          </p>
          <p
            className={`mt-1 text-sm font-bold tabular-nums ${
              item.highlight ? "text-[#125238]" : "text-[#1F2937]"
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export interface TripSummaryBannerProps {
  title: string;
  status?: string;
  subtitle?: React.ReactNode;
  destinationName?: string;
  startAt?: string;
  endAt?: string;
  pickupName?: string;
  capacityLabel?: string;
  priceLabel?: string;
  leaderName?: string;
  metaItems?: TripMetaItem[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function TripSummaryBanner({
  title,
  status,
  subtitle,
  destinationName,
  startAt,
  endAt,
  pickupName,
  capacityLabel,
  priceLabel,
  leaderName,
  metaItems,
  actions,
  children,
  className = "",
}: TripSummaryBannerProps) {
  const computedMetaItems: TripMetaItem[] = metaItems ?? [
    ...(startAt
      ? [
          {
            label: "Thời gian",
            value: endAt ? `${startAt} – ${endAt}` : startAt,
          },
        ]
      : []),
    ...(pickupName
      ? [
          {
            label: "Điểm tập kết",
            value: pickupName,
          },
        ]
      : []),
    ...(capacityLabel
      ? [
          {
            label: "Sức chứa",
            value: capacityLabel,
            highlight: true,
          },
        ]
      : []),
    ...(priceLabel
      ? [
          {
            label: "Chi phí",
            value: priceLabel,
            highlight: true,
          },
        ]
      : []),
    ...(leaderName && !priceLabel
      ? [
          {
            label: "Leader",
            value: leaderName,
          },
        ]
      : []),
  ];

  const effectiveSubtitle = subtitle ?? destinationName;

  return (
    <SurfaceCard padding="md" className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {status && <StatusBadge status={status} />}
            {effectiveSubtitle && (
              <span className="text-xs font-medium text-[#6B7280]">
                {effectiveSubtitle}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
            {title}
          </h2>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {computedMetaItems.length > 0 && <TripMetaGrid items={computedMetaItems} />}
      {children}
    </SurfaceCard>
  );
}
