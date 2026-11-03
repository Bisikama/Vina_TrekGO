"use client";

import React from "react";
import { Button } from "./Button";

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  itemLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel,
  disabled = false,
  className = "",
}: PaginationBarProps) {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1 && !disabled;
  const canNext = page < totalPages && !disabled;

  return (
    <div
      className={`flex items-center justify-center gap-4 pt-4 ${className}`}
      role="navigation"
      aria-label="Phân trang"
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
      >
        ← Trước
      </Button>
      <span className="text-xs font-semibold text-[#6B7280] tabular-nums">
        Trang <strong className="text-[#1F2937]">{page}</strong> / {totalPages}
        {itemLabel ? ` (Tổng ${total} ${itemLabel})` : ""}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
      >
        Sau →
      </Button>
    </div>
  );
}
