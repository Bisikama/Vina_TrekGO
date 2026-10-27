"use client";

import React from "react";
import { Button } from "./Button";

export interface LoadingStateProps {
  message?: string;
  label?: string;
  className?: string;
}

export function LoadingState({
  message,
  label,
  className = "",
}: LoadingStateProps) {
  const text = message ?? label ?? "Đang tải dữ liệu...";
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-[#E5E7EB] bg-white p-10 text-center shadow-xs ${className}`}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2F6B4F] border-t-transparent" />
      <p className="mt-3 text-sm font-medium text-[#6B7280]">{text}</p>
    </div>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-white p-10 sm:p-12 text-center ${className}`}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7F4] text-[#2F6B4F] text-xl">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[#1F2937]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-xs sm:text-sm text-[#6B7280]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface ErrorAlertProps {
  message: React.ReactNode;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorAlert({
  message,
  onRetry,
  onDismiss,
  retryLabel = "Thử lại",
  className = "",
}: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 border-l-4 border-l-[#DC2626] bg-[#FEF2F2] p-4 text-sm text-[#991B1B] ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <svg
          className="h-5 w-5 shrink-0 text-[#DC2626] mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="font-medium leading-relaxed">{message}</div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <Button variant="danger" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1 text-[#991B1B] hover:bg-red-100"
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export interface InfoBannerProps {
  tone?: "info" | "success" | "warning";
  variant?: "info" | "success" | "warning";
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function InfoBanner({
  tone,
  variant,
  title,
  children,
  onDismiss,
  className = "",
}: InfoBannerProps) {
  const effectiveTone = tone ?? variant ?? "info";
  const toneStyles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-[#DCFCE7]/60 text-[#166534]",
    warning: "border-amber-200 bg-[#FEF3C7]/70 text-[#92400E]",
  }[effectiveTone];

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${toneStyles} ${className}`}
    >
      <div className="space-y-0.5">
        {title && <p className="font-bold">{title}</p>}
        <div className="text-xs sm:text-sm leading-relaxed">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-bold opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
