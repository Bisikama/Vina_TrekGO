"use client";

import { useState } from "react";
import { Button, Input, SurfaceCard } from "@/components/ui";
import type { PricingEvaluationResult } from "../../types/leader-pricing";

interface TrekkingPricingSimulatorProps {
  evaluation: PricingEvaluationResult | null;
  capacity: number;
  minPax: number;
  targetPax: number;
  selectedPrice: string;
  targetMarginPercent: number; // 0..50%
  contingencyPercent: number;  // 5%
  onTargetPaxChange: (pax: number) => void;
  onSelectedPriceChange: (price: string) => void;
  onTargetMarginChange: (margin: number) => void;
  onApplySuggestedPrice: (price: string) => void;
  onConfirm: () => void;
  isConfirming?: boolean;
  isConfirmed?: boolean;
  disabled?: boolean;
}

export function TrekkingPricingSimulator({
  evaluation,
  capacity,
  minPax,
  targetPax,
  selectedPrice,
  targetMarginPercent,
  contingencyPercent,
  onTargetPaxChange,
  onSelectedPriceChange,
  onTargetMarginChange,
  onApplySuggestedPrice,
  onConfirm,
  isConfirming = false,
  isConfirmed = false,
  disabled = false,
}: TrekkingPricingSimulatorProps) {
  const [showTable, setShowTable] = useState(false);

  const priceNum = Number(selectedPrice) || 0;
  const maxSliderPrice = Math.max(5000000, priceNum * 1.5, 3000000);
  const safeCapacity = Math.max(1, capacity);
  const safeTargetPax = Math.min(Math.max(1, targetPax), safeCapacity);

  const summary = evaluation?.summary;
  const atTarget = summary?.atTargetPax;
  const profitNum = atTarget ? Number(atTarget.profit) : 0;
  const isProfitPositive = profitNum > 0;
  const marginPct = atTarget ? (atTarget.marginBps / 100).toFixed(1) : "0";

  const suggestedPrice = summary?.suggestedPriceAtTargetPax || selectedPrice;

  return (
    <SurfaceCard padding="none" className="overflow-hidden tabular-nums">
      {/* 1. Header & Subtitle */}
      <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[#125238]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-extrabold tracking-tight text-slate-900">
              Trekking Pricing Simulator
            </h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#125238]">
            Mô phỏng thời gian thực
          </span>
        </div>

        {summary && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>
              Cố định: <strong className="text-slate-900">{Number(summary.baseFixedCost).toLocaleString("vi-VN")}đ</strong>
            </span>
            <span>•</span>
            <span>
              Biến phí: <strong className="text-slate-900">{Number(summary.unitVariableCost).toLocaleString("vi-VN")}đ</strong>/người
            </span>
            <span>•</span>
            <span>
              Phí sàn &amp; TT: <strong className="text-slate-900">{(evaluation.feePolicy.totalFeeBps / 100)}%</strong>
            </span>
            <span>•</span>
            <span>
              Dự phòng: <strong className="text-slate-900">{(summary.contingencyBps / 100)}%</strong>
            </span>
          </div>
        )}
      </div>

      {/* 2. Interactive Sliders */}
      <div className="space-y-6 p-4 sm:p-6">
        {/* Slider 1: Số khách trả tiền (targetPax) */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              Số khách dự kiến thanh toán (targetPax)
            </span>
            <span className="text-sm font-extrabold text-[#125238]">
              {safeTargetPax} người / tối đa {safeCapacity}
            </span>
          </div>
          <input
            type="range"
            aria-label="Số khách dự kiến thanh toán"
            min={1}
            max={safeCapacity}
            step={1}
            disabled={disabled}
            value={safeTargetPax}
            onChange={(e) => onTargetPaxChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer rounded-lg bg-slate-200 accent-[#2F6B4F] disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>1 khách</span>
            <span>Tối thiểu khởi hành: {Math.min(minPax, safeCapacity)} khách</span>
            <span>Tối đa: {safeCapacity} khách</span>
          </div>
        </div>

        {/* Slider 2: Giá vé mỗi người (selectedPrice) */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              Giá vé thu mỗi người (selectedPrice)
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                aria-label="Giá vé thu mỗi người"
                disabled={disabled}
                value={priceNum.toLocaleString("vi-VN")}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  onSelectedPriceChange(digits || "0");
                }}
                className="h-8! w-28! text-right font-bold text-[#125238]!"
              />
              <span className="text-xs font-semibold text-slate-600">đ/người</span>
            </div>
          </div>
          <input
            type="range"
            aria-label="Điều chỉnh giá vé mỗi người"
            min={100000}
            max={maxSliderPrice}
            step={10000}
            disabled={disabled}
            value={priceNum}
            onChange={(e) => onSelectedPriceChange(e.target.value)}
            className="h-2 w-full cursor-pointer rounded-lg bg-slate-200 accent-[#2F6B4F] disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>100.000đ</span>
            <span>Bước chỉnh: 10.000đ</span>
            <span>{maxSliderPrice.toLocaleString("vi-VN")}đ</span>
          </div>
        </div>

        {/* Slider 3: Lợi nhuận mục tiêu % (targetMarginPercent) */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              Biên lợi nhuận ròng mục tiêu
            </span>
            <span className="text-sm font-extrabold text-teal-700">
              {targetMarginPercent}% doanh thu
            </span>
          </div>
          <input
            type="range"
            aria-label="Biên lợi nhuận ròng mục tiêu"
            min={0}
            max={50}
            step={1}
            disabled={disabled}
            value={targetMarginPercent}
            onChange={(e) => onTargetMarginChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer rounded-lg bg-slate-200 accent-teal-700 disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>0% (Hòa vốn)</span>
            <span>Khuyên dùng: 12% - 20%</span>
            <span>50%</span>
          </div>
        </div>

        {/* 3. Bốn thẻ KPI kết quả */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {/* Card 1: Lợi nhuận tại targetPax */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] font-medium text-slate-600">
              Lợi nhuận tại {safeTargetPax} khách
            </div>
            <div
              className={`text-lg font-black mt-1 ${
                isProfitPositive ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {profitNum.toLocaleString("vi-VN")}đ
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-600">
              {marginPct}% doanh thu
            </div>
          </div>

          {/* Card 2: Giá đề xuất */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] font-medium text-slate-600">
              Giá đề xuất ({targetMarginPercent}%)
            </div>
            <div className="mt-1 text-lg font-black text-amber-800">
              {Number(suggestedPrice).toLocaleString("vi-VN")}đ
            </div>
            {Number(suggestedPrice) !== priceNum && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onApplySuggestedPrice(suggestedPrice)}
                className="mt-1 text-[10px] font-bold text-amber-800 enabled:hover:underline disabled:opacity-50"
              >
                ↳ Áp dụng giá này
              </button>
            )}
          </div>

          {/* Card 3: Hòa vốn sớm nhất */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] font-medium text-slate-600">
              Hòa vốn sớm nhất
            </div>
            <div className="mt-1 text-lg font-black text-blue-700">
              {summary?.firstBreakEvenPax ? `${summary.firstBreakEvenPax} khách` : "Chưa đạt"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Không bị lỗ vốn</div>
          </div>

          {/* Card 4: Đạt mục tiêu lần đầu */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] font-medium text-slate-600">
              Đạt mục tiêu {targetMarginPercent}%
            </div>
            <div className="mt-1 text-lg font-black text-purple-700">
              {summary?.firstTargetPax ? `${summary.firstTargetPax} khách` : "Chưa đạt"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Đạt biên kỳ vọng</div>
          </div>
        </div>

        {/* 4. Cảnh báo rủi ro (Risk Intervals) */}
        {evaluation?.riskIntervals && evaluation.riskIntervals.length > 0 && (
          <div className="space-y-2">
            {evaluation.riskIntervals.map((risk, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2.5 rounded-xl p-3 text-xs border ${
                  risk.type === "LOSS_IN_OPERATING_RANGE"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {risk.type === "LOSS_IN_OPERATING_RANGE" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="font-bold">
                    {risk.type === "LOSS_IN_OPERATING_RANGE"
                      ? "Cảnh báo vùng lỗ vốn:"
                      : "Lưu ý biên lợi nhuận bị hụt:"}
                  </div>
                  <div className="mt-0.5">{risk.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 5. Nút xem kịch bản chi tiết từ 1 đến maxPax */}
        {evaluation?.scenarios && evaluation.scenarios.length > 0 && (
          <div>
            <button
              type="button"
              aria-expanded={showTable}
              onClick={() => setShowTable(!showTable)}
              className="text-left text-xs font-semibold text-slate-600 transition-colors hover:text-[#125238]"
            >
              <span>{showTable ? "▲ Ẩn" : "▼ Xem"} bảng tính chi tiết từng mức khách (1 .. {capacity})</span>
            </button>

            {showTable && (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                      <th className="py-2 px-2.5">Số khách</th>
                      <th className="py-2 px-2.5">Doanh thu</th>
                      <th className="py-2 px-2.5">Tổng chi phí</th>
                      <th className="py-2 px-2.5">Lợi nhuận</th>
                      <th className="py-2 px-2.5">Biên ròng</th>
                      <th className="py-2 px-2.5">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {evaluation.scenarios.map((row) => (
                      <tr
                        key={row.pax}
                        className={`transition-colors ${
                          row.pax === safeTargetPax
                            ? "bg-emerald-50 font-bold text-[#125238]"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-2 px-2.5">{row.pax} khách</td>
                        <td className="py-2 px-2.5">{Number(row.revenue).toLocaleString("vi-VN")}đ</td>
                        <td className="py-2 px-2.5">{Number(row.totalCost).toLocaleString("vi-VN")}đ</td>
                        <td
                          className={`py-2 px-2.5 font-bold ${
                            Number(row.profit) > 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {Number(row.profit).toLocaleString("vi-VN")}đ
                        </td>
                        <td className="py-2 px-2.5">{(row.marginBps / 100).toFixed(1)}%</td>
                        <td className="py-2 px-2.5 text-[11px]">
                          {row.status === "TARGET_MET" ? (
                            <span className="text-purple-700">Đạt mục tiêu</span>
                          ) : row.status === "PROFIT_BELOW_TARGET" ? (
                            <span className="text-emerald-700">Có lãi</span>
                          ) : row.status === "BREAK_EVEN" ? (
                            <span className="text-blue-700">Hòa vốn</span>
                          ) : (
                            <span className="text-rose-700">Lỗ vốn</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 6. Nút chốt giá vé */}
        <div className="pt-2">
          <Button
            fullWidth
            loading={isConfirming}
            disabled={disabled || !evaluation}
            onClick={onConfirm}
            className="h-auto! min-h-11 py-2.5"
          >
            {isConfirming ? (
              "Đang lưu bảng giá..."
            ) : isConfirmed ? (
              <>
                <span>✓</span> Đã chốt mức giá {priceNum.toLocaleString("vi-VN")}đ/người (Bấm để cập nhật lại)
              </>
            ) : (
              <>
                <span>✓</span> Lưu dự toán &amp; Chốt mức giá vé này ({priceNum.toLocaleString("vi-VN")}đ)
              </>
            )}
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}

