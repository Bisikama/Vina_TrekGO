"use client";

import Link from "next/link";
import { useState } from "react";

import { getGearAdvisorErrorMessage } from "@/features/rentals/services/gear-advisor.api";
import {
  generateGearRentalOptions,
  lineDepositAmount,
  type GearRentalOptionSet,
} from "@/features/rentals/services/gear-options.api";

const OPTION_LABELS: Record<string, string> = {
  opt_min_fee: "Tiết kiệm chi phí nhất",
  opt_min_weight: "Nhẹ nhất",
};

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

/** Phương án thuê đồ còn thiếu — chỉ hiển thị ước tính, chưa giữ hàng hay tạo đơn. */
export function GearRentalOptions({ planId, evaluatedRevision }: { planId: string; evaluatedRevision: number }) {
  const [optionSet, setOptionSet] = useState<GearRentalOptionSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setOptionSet(await generateGearRentalOptions(planId, evaluatedRevision));
    } catch (loadError: unknown) {
      setError(getGearAdvisorErrorMessage(loadError, "Không tạo được phương án thuê."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#FAFBF8] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Phương án thuê đồ còn thiếu</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Giá và tiền cọc là <strong>ước tính</strong> theo giá hiện tại; số chính thức có ở báo giá.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="h-10 rounded-xl border border-[#174B36] px-4 text-sm font-bold text-[#174B36] transition hover:bg-emerald-50 disabled:opacity-50"
        >
          {loading ? "Đang tìm..." : optionSet ? "Tìm lại" : "Xem phương án thuê"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {optionSet ? (
        optionSet.options.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Hiện chưa có sản phẩm cho thuê phù hợp với phần còn thiếu.</p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {optionSet.options.map((option) => {
              const deposits = option.rentalLines.map(lineDepositAmount);
              const feeTotal = option.rentalLines.reduce((sum, line) => sum + (line.rentalFee ?? 0), 0);
              const depositTotal = deposits.every((value) => value !== null)
                ? deposits.reduce<number>((sum, value) => sum + (value ?? 0), 0)
                : null;
              return (
                <div key={option.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900">{OPTION_LABELS[option.id] ?? "Phương án"}</p>
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                      Ước tính
                    </span>
                  </div>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {option.rentalLines.map((line) => {
                      const lineDeposit = lineDepositAmount(line);
                      const percent = line.depositExplanation?.percentageOfReplacementValue;
                      return (
                        <li key={`${line.productId}-${line.requirementId ?? ""}`} className="py-2.5 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-slate-800">
                              {line.productName}
                              {line.grade ? (
                                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  {line.grade === "LIKE_NEW" ? "Mới" : "Sử dụng tốt"}
                                </span>
                              ) : null}
                            </p>
                            <span className="shrink-0 text-slate-500">× {line.quantity}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {typeof line.rentalFee === "number" ? <>Phí thuê {money(line.rentalFee)}</> : null}
                            {lineDeposit !== null ? (
                              <>
                                {" "}· Cọc{" "}
                                {typeof line.depositPerUnit === "number" ? `${money(line.depositPerUnit)}/món × ${line.quantity} = ` : ""}
                                {money(lineDeposit)}
                              </>
                            ) : null}
                            {typeof percent === "number" ? <> · ≈ {percent.toLocaleString("vi-VN")}% giá trị thay thế</> : null}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  <dl className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Phí thuê (ước tính)</dt>
                      <dd className="font-bold">{money(feeTotal)}</dd>
                    </div>
                    {depositTotal !== null ? (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Tiền cọc (ước tính, hoàn lại)</dt>
                        <dd className="font-bold">{money(depositTotal)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              );
            })}
          </div>
        )
      ) : null}

      {optionSet ? (
        <p className="mt-3 text-xs text-slate-500">
          Phương án chưa giữ hàng. Để thuê, mở{" "}
          <Link href="/rentals" className="font-bold text-emerald-700 underline">danh mục thuê</Link>{" "}
          và chọn đúng các món trên.
        </p>
      ) : null}
    </div>
  );
}
