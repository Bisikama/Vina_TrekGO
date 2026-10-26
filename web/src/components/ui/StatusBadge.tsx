"use client";

import React from "react";

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "forest";

const toneStyles: Record<StatusTone, { badge: string; dot: string }> = {
  success: {
    badge: "bg-[#DCFCE7] text-[#166534] border-emerald-200",
    dot: "bg-[#16A34A]",
  },
  warning: {
    badge: "bg-[#FEF3C7] text-[#92400E] border-amber-200",
    dot: "bg-[#F59E0B]",
  },
  danger: {
    badge: "bg-[#FEE2E2] text-[#991B1B] border-red-200",
    dot: "bg-[#DC2626]",
  },
  info: {
    badge: "bg-blue-50 text-[#2563EB] border-blue-200",
    dot: "bg-[#2563EB]",
  },
  neutral: {
    badge: "bg-[#F7F7F4] text-[#404943] border-[#E5E7EB]",
    dot: "bg-[#6B7280]",
  },
  forest: {
    badge: "bg-[#125238] text-white border-[#125238]",
    dot: "bg-emerald-300",
  },
};

const statusConfig: Record<string, { label: string; tone: StatusTone }> = {
  // Trip & Booking Statuses
  DRAFT: { label: "Bản nháp", tone: "neutral" },
  draft: { label: "Bản nháp", tone: "neutral" },
  OPEN: { label: "Đang mở đăng ký", tone: "success" },
  open: { label: "Đang mở bán", tone: "success" },
  FULL: { label: "Đã đủ chỗ", tone: "warning" },
  CLOSED: { label: "Đã đóng đăng ký", tone: "neutral" },
  IN_PROGRESS: { label: "Đang diễn ra", tone: "forest" },
  active: { label: "Đang diễn ra", tone: "forest" },
  ACTIVE: { label: "Đang hoạt động", tone: "success" },
  COMPLETED: { label: "Đã hoàn thành", tone: "info" },
  completed: { label: "Đã hoàn thành", tone: "info" },
  CANCEL_PENDING: { label: "Chờ duyệt hủy", tone: "warning" },
  CANCELLED: { label: "Đã hủy", tone: "danger" },
  cancelled: { label: "Đã hủy", tone: "danger" },
  PENDING_PAYMENT: { label: "Chờ thanh toán", tone: "warning" },
  CONFIRMED: { label: "Đã xác nhận", tone: "success" },
  EXPIRED: { label: "Đã hết hạn", tone: "neutral" },
  CHECKED_IN: { label: "Đã check-in", tone: "success" },
  PARTIAL_CHECKIN: { label: "Check-in một phần", tone: "info" },
  NO_SHOW: { label: "Vắng mặt", tone: "danger" },
  // Invitation / Membership Statuses
  PENDING: { label: "Đang chờ", tone: "warning" },
  ACCEPTED: { label: "Đã chấp nhận", tone: "success" },
  DECLINED: { label: "Đã từ chối", tone: "danger" },
  REVOKED: { label: "Đã thu hồi", tone: "neutral" },
  LEFT: { label: "Đã rời nhóm", tone: "neutral" },
  REMOVED: { label: "Đã bị loại", tone: "danger" },
  CLAIMED: { label: "Đã nhận vé", tone: "success" },
  INVITATION_PENDING: { label: "Đã gửi lời mời", tone: "warning" },
  UNLINKED: { label: "Chưa liên kết", tone: "neutral" },
};

export interface StatusBadgeProps {
  status: string;
  customLabel?: string;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  customLabel,
  showDot = true,
  className = "",
}: StatusBadgeProps) {
  const entry = statusConfig[status] ?? {
    label: status,
    tone: "neutral" as StatusTone,
  };
  const styles = toneStyles[entry.tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide ${styles.badge} ${className}`}
    >
      {showDot && (
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      )}
      <span>{customLabel ?? entry.label}</span>
    </span>
  );
}

const difficultyConfig: Record<string, { label: string; tone: StatusTone }> = {
  EASY: { label: "Dễ", tone: "success" },
  MEDIUM: { label: "Trung bình", tone: "warning" },
  MODERATE: { label: "Trung bình", tone: "warning" },
  HARD: { label: "Thử thách", tone: "danger" },
  EXTREME: { label: "Cực khó", tone: "danger" },
};

export function DifficultyBadge({
  difficulty,
  className = "",
}: {
  difficulty?: string | null;
  className?: string;
}) {
  if (!difficulty) return null;
  const key = difficulty.toUpperCase();
  const entry = difficultyConfig[key] ?? {
    label: difficulty,
    tone: "neutral" as StatusTone,
  };
  const styles = toneStyles[entry.tone];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles.badge} ${className}`}
    >
      {entry.label}
    </span>
  );
}

export function TelemetryChip({
  icon,
  children,
  className = "",
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full bg-[#F7F7F4] border border-[#E5E7EB] px-2.5 text-xs font-medium text-[#1F2937] tabular-nums ${className}`}
    >
      {icon && <span className="text-[#2F6B4F] shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

