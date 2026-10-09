"use client";

import React, { useState, useEffect } from "react";

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  itemTypeLabel?: string;
  itemName?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "warning";
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận xóa",
  itemTypeLabel,
  itemName,
  description,
  confirmText = "Xác nhận xóa",
  cancelText = "Hủy bỏ",
  confirmVariant = "danger",
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setErrorMessage(null);
    }
  }, [isOpen, itemName]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirm();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "Đã xảy ra lỗi trong quá trình xử lý. Vui lòng thử lại.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isWarning = confirmVariant === "warning";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                isWarning
                  ? "bg-amber-50 border border-amber-200 text-amber-600"
                  : "bg-red-50 border border-red-200 text-red-600"
              }`}
            >
              {isWarning ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
            </div>
            <div>
              <h3
                id="confirm-delete-title"
                className="font-bold text-gray-900 text-base leading-snug"
              >
                {title}
              </h3>
              {itemTypeLabel && (
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mt-0.5">
                  {itemTypeLabel}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition -mr-1 -mt-1 cursor-pointer disabled:opacity-50"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <svg
                className="w-4 h-4 shrink-0 mt-0.5"
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
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {itemName && (
            <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 flex items-center gap-3">
              <span className="text-xl">📍</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-gray-500 font-medium">Đối tượng được chọn:</div>
                <div className="text-sm font-bold text-gray-900 truncate">
                  {itemName}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-600 leading-relaxed">
            {description ||
              "Hành động này sẽ thay đổi trạng thái hoặc xóa dữ liệu khỏi hệ thống. Bạn có chắc chắn muốn tiếp tục?"}
          </p>

          <div className="bg-amber-50/70 border border-amber-200/70 rounded-lg p-3 text-[11px] text-amber-800 leading-relaxed flex items-start gap-2">
            <span className="text-amber-500 font-bold shrink-0">⚠️</span>
            <span>
              Lưu ý: Thao tác này có thể ảnh hưởng đến các dữ liệu phụ thuộc hoặc liên kết trong hệ thống.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50/70 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              isWarning
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isSubmitting && (
              <svg
                className="w-3.5 h-3.5 animate-spin text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
            <span>{isSubmitting ? "Đang xử lý..." : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
