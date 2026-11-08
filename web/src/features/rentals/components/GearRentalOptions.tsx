"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GradeBadge } from "@/features/rentals/components/GradeBadge";
import { mergeIntoRentalCart } from "@/features/rentals/hooks/useRentalCart";
import { getGearAdvisorErrorCode, getGearAdvisorErrorMessage } from "@/features/rentals/services/gear-advisor.api";
import {
  createGearQuoteIntent,
  generateGearAdvice,
  generateGearRentalOptions,
  lineDepositAmount,
  type GearPlanAdvice,
  type GearRentalOption,
  type GearRentalOptionSet,
} from "@/features/rentals/services/gear-options.api";
import { getRentalProduct } from "@/features/rentals/services/rental.api";
import type { RentalProduct } from "@/features/rentals/types/rental";
import { GearThumb } from "./wardrobe/GearVisuals";

const OPTION_LABELS: Record<string, string> = {
  opt_min_fee: "Tiết kiệm chi phí nhất",
  opt_min_weight: "Nhẹ nhất",
};

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

function stripGradeSuffix(name: string) {
  return name
    .replace(/\s*[-–—:]\s*(rất mới|như mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i, "")
    .trim();
}

const lineKey = (option: GearRentalOption) =>
  option.rentalLines
    .map((line) => `${line.productId}x${line.quantity}`)
    .sort()
    .join("|");

/** Hai phương án trùng món thì gộp làm một thẻ để người dùng không phải so sánh hai thứ giống nhau. */
function distinctOptions(options: GearRentalOption[]) {
  const groups: Array<{ option: GearRentalOption; labels: string[] }> = [];
  for (const option of options) {
    const label = OPTION_LABELS[option.id] ?? option.label ?? "Phương án";
    const same = groups.find((group) => lineKey(group.option) === lineKey(option));
    if (same) same.labels.push(label);
    else groups.push({ option, labels: [label] });
  }
  return groups;
}

/** Phương án thuê đồ còn thiếu: ước tính, xem lời khuyên, đưa vào giỏ thuê để tạo báo giá chính thức. */
export function GearRentalOptions({
  planId,
  tripId,
  evaluatedRevision,
  requirementTitles,
  requiredIds,
}: {
  planId: string;
  tripId: string;
  evaluatedRevision: number;
  requirementTitles: Record<string, string>;
  /** Yêu cầu bắt buộc; phần thiếu ở yêu cầu không bắt buộc không làm phương án "chưa đủ". */
  requiredIds: string[];
}) {
  const router = useRouter();
  const [optionSet, setOptionSet] = useState<GearRentalOptionSet | null>(null);
  const [products, setProducts] = useState<Record<string, RentalProduct>>({});

  // Tải thông tin sản phẩm (ảnh) của các món trong phương án; lỗi thì vẫn hiện icon loại đồ.
  useEffect(() => {
    if (!optionSet) return;
    const ids = [...new Set(optionSet.options.flatMap((option) => option.rentalLines.map((line) => line.productId)))];
    let active = true;
    void Promise.all(ids.map((id) => getRentalProduct(id).then((product) => [id, product] as const).catch(() => null))).then((entries) => {
      if (active) setProducts(Object.fromEntries(entries.filter((entry): entry is readonly [string, RentalProduct] => entry !== null)));
    });
    return () => {
      active = false;
    };
  }, [optionSet]);
  const [budget, setBudget] = useState("");
  const [usedBudget, setUsedBudget] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [busyOption, setBusyOption] = useState<string | null>(null);
  const [advice, setAdvice] = useState<Record<string, GearPlanAdvice>>({});
  const [error, setError] = useState("");

  const budgetValue = budget.trim() === "" ? undefined : Number(budget);
  const budgetInvalid = budgetValue !== undefined && (!Number.isInteger(budgetValue) || budgetValue < 0);

  async function load() {
    if (budgetInvalid) return;
    setLoading(true);
    setError("");
    setAdvice({});
    try {
      setOptionSet(await generateGearRentalOptions(planId, evaluatedRevision, budgetValue));
      setUsedBudget(budgetValue);
    } catch (loadError: unknown) {
      setError(getGearAdvisorErrorMessage(loadError, "Không tạo được phương án thuê."));
    } finally {
      setLoading(false);
    }
  }

  function handleOptionError(optionError: unknown, fallback: string) {
    const code = getGearAdvisorErrorCode(optionError);
    if (code === "GEAR_OPTION_SET_EXPIRED" || code === "GEAR_OPTION_SET_NOT_FOUND") {
      setOptionSet(null);
      setError("Phương án đã hết hạn (giữ 15 phút). Bấm “Xem phương án thuê” để tính lại theo tồn kho mới.");
    } else if (code === "GEAR_PLAN_STALE") {
      setOptionSet(null);
      setError("Kế hoạch đã thay đổi. Hãy đánh giá lại trước khi chọn phương án thuê.");
    } else {
      setError(getGearAdvisorErrorMessage(optionError, fallback));
    }
  }

  async function loadAdvice(option: GearRentalOption) {
    if (!optionSet) return;
    setBusyOption(`advice:${option.id}`);
    setError("");
    try {
      const result = await generateGearAdvice(planId, evaluatedRevision, { setId: optionSet.setId, optionId: option.id });
      setAdvice((current) => ({ ...current, [option.id]: result }));
    } catch (adviceError: unknown) {
      handleOptionError(adviceError, "Không lấy được lời khuyên.");
    } finally {
      setBusyOption(null);
    }
  }

  async function rent(option: GearRentalOption) {
    if (!optionSet) return;
    setBusyOption(`rent:${option.id}`);
    setError("");
    try {
      const intent = await createGearQuoteIntent(planId, evaluatedRevision, { setId: optionSet.setId, optionId: option.id });
      const entries = await Promise.all(
        intent.prefillRentalQuote.items.map(async (item) => {
          const line = option.rentalLines.find((candidate) => candidate.productId === item.productId);
          return {
            product: products[item.productId] ?? (await getRentalProduct(item.productId)),
            quantity: item.quantity,
            availableCount: Math.max(item.quantity, line?.availableCount ?? item.quantity),
          };
        }),
      );
      mergeIntoRentalCart(intent.prefillRentalQuote.tripId || tripId, entries);
      router.push(`/rentals/quote?bookingId=${encodeURIComponent(intent.prefillRentalQuote.tripId || tripId)}`);
    } catch (rentError: unknown) {
      handleOptionError(rentError, "Không đưa được phương án vào giỏ thuê.");
      setBusyOption(null);
    }
  }

  const groups = optionSet ? distinctOptions(optionSet.options.filter((option) => option.rentalLines.length > 0)) : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#FAFBF8] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Thuê phần còn thiếu</p>
          <p className="mt-0.5 text-xs text-slate-500">
            TrekGo ghép đồ trong kho cho các yêu cầu còn thiếu. Giá và tiền cọc là <strong>ước tính</strong>; số chính thức có ở báo giá.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-slate-600">
            Ngân sách phí thuê (không bắt buộc)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={10000}
              value={budget}
              placeholder="VD: 300000"
              onChange={(event) => setBudget(event.target.value)}
              className="mt-1 block h-10 w-44 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            disabled={loading || budgetInvalid}
            onClick={() => void load()}
            className="h-10 rounded-xl border border-[#174B36] px-4 text-sm font-bold text-[#174B36] transition hover:bg-emerald-50 disabled:opacity-50"
          >
            {loading ? "Đang tìm..." : optionSet ? "Tính lại" : "Xem phương án thuê"}
          </button>
        </div>
      </div>
      {budgetInvalid ? <p className="mt-2 text-xs text-red-600">Ngân sách phải là số nguyên không âm (VND).</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {optionSet ? (
        groups.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Kho hiện chưa có sản phẩm cho thuê phù hợp với phần còn thiếu trong thời gian chuyến đi. Bạn có thể đánh dấu “Tôi tự chuẩn bị” ở yêu cầu tương ứng.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {groups.map(({ option, labels }) => (
              <OptionCard
                key={option.id}
                option={option}
                title={labels.join(" · ")}
                budget={usedBudget}
                requirementTitles={requirementTitles}
                requiredIds={requiredIds}
                products={products}
                advice={advice[option.id]}
                busy={busyOption}
                onAdvice={() => void loadAdvice(option)}
                onRent={() => void rent(option)}
              />
            ))}
          </div>
        )
      ) : null}

      {optionSet ? (
        <p className="mt-3 text-xs text-slate-500">
          Phương án chưa giữ hàng. Bấm “Thuê phương án này” để đưa các món vào giỏ thuê của chuyến; tồn kho và tiền được kiểm lại khi tạo báo giá.
        </p>
      ) : null}
    </div>
  );
}

function OptionCard({
  option,
  title,
  budget,
  requirementTitles,
  requiredIds,
  products,
  advice,
  busy,
  onAdvice,
  onRent,
}: {
  option: GearRentalOption;
  title: string;
  budget: number | undefined;
  requirementTitles: Record<string, string>;
  requiredIds: string[];
  products: Record<string, RentalProduct>;
  advice: GearPlanAdvice | undefined;
  busy: string | null;
  onAdvice: () => void;
  onRent: () => void;
}) {
  const summary = option.summary ?? {};
  const deposits = option.rentalLines.map(lineDepositAmount);
  const feeTotal = summary.totalRentalFee ?? option.rentalLines.reduce((sum, line) => sum + (line.rentalFee ?? 0), 0);
  const depositTotal =
    summary.totalDeposit ??
    (deposits.every((value) => value !== null) ? deposits.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null);
  const missing = (summary.missingRequirements ?? [])
    .filter((id) => requiredIds.includes(id))
    .map((id) => requirementTitles[id] ?? "Một yêu cầu");
  const overBudget = budget !== undefined && feeTotal > budget;
  const complete = summary.isComplete ?? missing.length === 0;
  const weightKg =
    summary.weightStatus && summary.weightStatus !== "UNKNOWN" && summary.totalKnownWeightG
      ? (summary.totalKnownWeightG / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })
      : null;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-slate-900">{title}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${complete ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
        >
          {complete ? "Đủ phần còn thiếu" : overBudget ? "Vượt ngân sách" : "Chưa đủ"}
        </span>
      </div>
      {missing.length > 0 ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {summary.searchStatus === "INFEASIBLE" ? "Kho không đủ hàng cho: " : "Chưa tìm được đồ thuê cho: "}
          <b>{missing.join(", ")}</b>
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-slate-100">
        {option.rentalLines.map((line) => {
          const lineDeposit = lineDepositAmount(line);
          const percent = line.depositExplanation?.percentageOfReplacementValue;
          return (
            <li key={`${line.productId}-${line.requirementId ?? ""}`} className="flex gap-3 py-2.5 text-sm">
              <GearThumb url={products[line.productId]?.imageUrls?.[0]} category={line.category ?? "BACKPACK"} name={line.productName} size="md" />
              <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-800">
                  {line.grade ? stripGradeSuffix(line.productName) : line.productName}
                  {line.grade ? <GradeBadge grade={line.grade} className="ml-2" /> : null}
                </p>
                <span className="shrink-0 text-slate-500">× {line.quantity}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {line.requirementId && requirementTitles[line.requirementId] ? <>Cho: {requirementTitles[line.requirementId]} · </> : null}
                {typeof line.rentalFee === "number" ? <>Phí thuê {money(line.rentalFee)}</> : null}
                {lineDeposit !== null ? <> · Cọc {money(lineDeposit)}</> : null}
                {typeof percent === "number" ? <> (≈ {percent.toLocaleString("vi-VN")}% giá trị thay thế)</> : null}
                {typeof line.weight_g === "number" ? <> · {line.weight_g.toLocaleString("vi-VN")} g</> : null}
              </p>
              </div>
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
        {weightKg ? (
          <div className="flex justify-between">
            <dt className="text-slate-500">Trọng lượng đồ thuê</dt>
            <dd className="font-semibold">
              ≈ {weightKg} kg{summary.weightStatus === "PARTIAL" ? " (một số món chưa rõ)" : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      {advice ? (
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-slate-700">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            {advice.source === "AI" ? "Lời khuyên · AI chọn từ dữ kiện đã kiểm chứng" : "Lời khuyên · theo bộ quy tắc TrekGo"}
          </p>
          <p className="mt-1 whitespace-pre-line leading-6">{advice.narrativeVi}</p>
          {advice.disclaimerVi ? <p className="mt-2 text-xs text-slate-500">{advice.disclaimerVi}</p> : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={onRent}
          className="h-10 flex-1 rounded-xl bg-[#174B36] px-4 text-sm font-bold text-white transition hover:bg-[#0F5A3B] disabled:bg-slate-300"
        >
          {busy === `rent:${option.id}` ? "Đang chuẩn bị giỏ..." : "Thuê phương án này"}
        </button>
        {!advice ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={onAdvice}
            className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === `advice:${option.id}` ? "Đang soạn..." : "Xem lời khuyên"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
