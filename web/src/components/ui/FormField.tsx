"use client";

import React from "react";

export interface FormFieldProps {
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-[#1F2937]">
          {label}
          {required && <span className="ml-1 text-[#DC2626]">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : (
        hint && <p className="text-xs text-[#6B7280]">{hint}</p>
      )}
    </div>
  );
}

const baseFieldClass =
  "w-full rounded-lg bg-white px-3 text-sm text-[#1F2937] placeholder:text-[#6B7280]/70 border transition-all outline-none disabled:bg-[#F7F7F4] disabled:text-[#6B7280] disabled:cursor-not-allowed";

const normalBorderClass =
  "border-[#E5E7EB] focus:border-[#2F6B4F] focus:ring-3 focus:ring-[#2F6B4F]/15";

const errorBorderClass =
  "border-[#DC2626] text-[#DC2626] focus:border-[#DC2626] focus:ring-3 focus:ring-[#DC2626]/15";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ hasError = false, className = "", ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={`h-[42px] ${baseFieldClass} ${
          hasError ? errorBorderClass : normalBorderClass
        } ${className}`}
        {...rest}
      />
    );
  }
);
Input.displayName = "Input";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ hasError = false, className = "", children, ...rest }, ref) => {
    return (
      <select
        ref={ref}
        className={`h-[42px] cursor-pointer ${baseFieldClass} ${
          hasError ? errorBorderClass : normalBorderClass
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ hasError = false, className = "", rows = 4, ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`py-2.5 ${baseFieldClass} ${
          hasError ? errorBorderClass : normalBorderClass
        } ${className}`}
        {...rest}
      />
    );
  }
);
Textarea.displayName = "Textarea";

