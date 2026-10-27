"use client";

import React from "react";
import { Button, ButtonVariant } from "./Button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

const modalMaxWidths = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "md",
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2937]/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${modalMaxWidths[maxWidth]} rounded-2xl bg-white border border-[#E5E7EB] shadow-[0_12px_32px_-4px_rgba(31,41,55,0.16),0_4px_12px_-2px_rgba(31,41,55,0.08)] overflow-hidden`}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-4">
            <div>
              {title && (
                <h3 className="text-lg font-bold text-[#1F2937]">{title}</h3>
              )}
              {subtitle && (
                <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F7F7F4] hover:text-[#1F2937]"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-6 text-sm text-[#1F2937]">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-[#E5E7EB] bg-[#F7F7F4]/60 px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy bỏ",
  confirmVariant = "primary",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-[#6B7280] leading-relaxed">{description}</div>
    </Modal>
  );
}

