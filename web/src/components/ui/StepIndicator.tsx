"use client";

import React from "react";

export interface StepItem {
  step: number;
  label: string;
  description?: string;
}

export interface StepIndicatorProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  className = "",
}: StepIndicatorProps) {
  return (
    <nav
      aria-label="Tiến trình thực hiện"
      className={`rounded-xl bg-white border border-[#E5E7EB] px-4 py-3.5 sm:px-6 shadow-xs ${className}`}
    >
      <ol className="flex flex-wrap items-center justify-between gap-3">
        {steps.map((item, idx) => {
          const isCompleted = item.step < currentStep;
          const isCurrent = item.step === currentStep;
          const isClickable = Boolean(onStepClick && item.step < currentStep);

          return (
            <React.Fragment key={item.step}>
              <li className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick?.(item.step)}
                  className={`flex items-center gap-2.5 text-left ${
                    isClickable ? "cursor-pointer group" : "cursor-default"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-colors ${
                      isCompleted
                        ? "bg-[#16A34A] text-white"
                        : isCurrent
                        ? "bg-[#125238] text-white ring-4 ring-[#2F6B4F]/15"
                        : "bg-[#F7F7F4] border border-[#E5E7EB] text-[#6B7280]"
                    }`}
                  >
                    {isCompleted ? "✓" : item.step}
                  </span>
                  <div>
                    <span
                      className={`block text-xs sm:text-sm font-semibold ${
                        isCurrent
                          ? "text-[#125238]"
                          : isCompleted
                          ? "text-[#1F2937] group-hover:underline"
                          : "text-[#6B7280]"
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="hidden md:block text-[11px] text-[#6B7280]">
                        {item.description}
                      </span>
                    )}
                  </div>
                </button>
              </li>

              {idx < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`hidden sm:block flex-1 h-px mx-2 ${
                    isCompleted ? "bg-[#16A34A]" : "bg-[#E5E7EB]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

