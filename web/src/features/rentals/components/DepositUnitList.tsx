/* eslint-disable @next/next/no-img-element */
"use client";

import type { ReactNode } from "react";

import type { RentalAssessmentItem } from "@/features/rentals/services/deduction-review.api";
import type { RentalDepositItem } from "@/features/rentals/services/user-rental.api";
import { splitGradeName } from "@/features/rentals/services/rental-display";

import { dateTime, money, shortCode } from "./RentalSectionNav";

export type DepositUnitInfo = {
  unitId: string;
  productId?: string;
  productName?: string;
  assetCode?: string;
  handedOverAt?: string | null;
  returnedAt?: string | null;
};

type Visual = { name: string; imageUrl?: string };

type Props = {
  items: RentalDepositItem[];
  units: DepositUnitInfo[];
  visuals: Record<string, Visual>;
  assessments: RentalAssessmentItem[];
  currency: string;
  badge: (item: RentalDepositItem) => { label: string; tone: string };
  reasonText: (reason?: string | null) => string | null;
  /** Khối khiếu nại/đồng ý khoản trừ đặt ngay dưới từng thiết bị. */
  renderExtra: (item: RentalDepositItem) => ReactNode;
};

const REFUND_STATUS: Record<string, string> = {
  PENDING: "Đã gửi yêu cầu hoàn",
  PROCESSING: "Cổng thanh toán đang xử lý",
  SUCCEEDED: "Đã hoàn tiền",
  FAILED: "Hoàn tiền thất bại · TrekGo đang hỗ trợ",
};

/** Kết quả kiểm định của kho, viết bằng lời cho khách. */
function inspectionSummary(item: RentalDepositItem, currency: string, assessment?: RentalAssessmentItem) {
  const status = item.inspectionStatus;
  if (assessment && assessment.outcome === "NORMAL") {
    return { tone: "text-emerald-800", title: "Kiểm định đạt", lines: ["Thiết bị trả về bình thường, không phát sinh khấu trừ."] };
  }
  if (assessment) {
    const findingCount = assessment.findings.reduce((sum, finding) => sum + (finding.quantity || 1), 0);
    const assessed = assessment.findings.reduce((sum, finding) => sum + finding.amount, 0);
    const lines = [
      findingCount
        ? `Kho ghi nhận ${findingCount} lỗi hư hại${assessed ? ` · mức trừ theo quy định ${money(assessed, currency)}` : ""}.`
        : "Kho ghi nhận thiết bị có vấn đề khi kiểm định.",
    ];
    if (assessment.approvedDeduction > 0) lines.push(`Khoản trừ đã duyệt: ${money(assessment.approvedDeduction, currency)}.`);
    else if (assessment.proposedDeduction > 0) lines.push(`Đề xuất trừ ${money(assessment.proposedDeduction, currency)} · đang chờ duyệt.`);
    return { tone: "text-red-700", title: "Kiểm định ghi nhận lỗi", lines };
  }
  if (status === "FINAL_PASS") return { tone: "text-emerald-800", title: "Kiểm định đạt", lines: ["Không phát sinh khấu trừ."] };
  if (status === "FINAL_ISSUE") return { tone: "text-red-700", title: "Kiểm định ghi nhận lỗi", lines: ["Chi tiết lỗi xem ở phần khoản trừ bên dưới."] };
  if (status === "PENDING") {
    const lines = [];
    if (item.inventoryCustodyReceivedAt) lines.push(`Kho nhận lúc ${dateTime(item.inventoryCustodyReceivedAt)}.`);
    if (item.inspectionDueAt) lines.push(`Hạn kiểm định ${dateTime(item.inspectionDueAt)}.`);
    return { tone: "text-amber-800", title: "Kho đang kiểm định", lines: lines.length ? lines : ["Thiết bị đã về kho, đang chờ kiểm định."] };
  }
  return { tone: "text-slate-600", title: "Chưa về kho", lines: ["Thiết bị chưa được kho nhận lại."] };
}

export function DepositUnitList({ items, units, visuals, assessments, currency, badge, reasonText, renderExtra }: Props) {
  const unitById = new Map(units.map((unit) => [unit.unitId, unit]));
  const assessmentByUnit = new Map(assessments.map((assessment) => [assessment.unit.id, assessment]));

  // Gom theo sản phẩm (tên + hạng), giữ thứ tự xuất hiện; món không rõ tên xếp cuối.
  const groups: { key: string; name: string; grade: string | null; imageUrl?: string; items: RentalDepositItem[] }[] = [];
  items.forEach((item) => {
    const unit = unitById.get(item.unitId);
    const rawName = unit?.productName ?? "";
    const { base, grade } = rawName ? splitGradeName(rawName) : { base: "Thiết bị khác", grade: null };
    const key = rawName || "~unknown";
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = {
        key,
        name: base,
        grade,
        imageUrl: unit?.productId ? visuals[unit.productId]?.imageUrl : undefined,
        items: [],
      };
      groups.push(group);
    }
    group.items.push(item);
  });
  groups.sort((a, b) => Number(a.key === "~unknown") - Number(b.key === "~unknown"));

  return (
    <div className="mt-5 space-y-4">
      {groups.map((group) => (
        <section key={group.key} className="overflow-hidden rounded-2xl border border-slate-200">
          <header className="flex items-center gap-3 bg-slate-50 px-4 py-3">
            {group.imageUrl ? (
              <img src={group.imageUrl} alt={group.name} className="h-11 w-11 rounded-lg object-cover" />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-lg">⛺</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-900">{group.name}</p>
              <p className="text-xs text-slate-500">
                {group.grade ? `${group.grade} · ` : ""}
                {group.items.length} thiết bị
              </p>
            </div>
          </header>

          <ul className="divide-y divide-slate-100">
            {group.items.map((item, index) => {
              const unit = unitById.get(item.unitId);
              const inspection = inspectionSummary(item, currency, assessmentByUnit.get(item.unitId));
              const state = badge(item);
              const deposit = item.depositAmount ?? item.amount ?? 0;
              const deduction = item.deduction || item.approvedDeduction || 0;
              const reason = reasonText(item.reason);
              return (
                <li key={item.unitId} className="px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800">
                      Thiết bị {index + 1}
                      <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                        {item.assetCode || unit?.assetCode || shortCode(item.unitId)}
                      </span>
                    </p>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${state.tone}`}>{state.label}</span>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kiểm định của kho</p>
                      <p className={`mt-1 text-sm font-bold ${inspection.tone}`}>{inspection.title}</p>
                      {inspection.lines.map((line) => (
                        <p key={line} className="mt-0.5 text-xs leading-5 text-slate-600">{line}</p>
                      ))}
                      {unit?.returnedAt ? (
                        <p className="mt-1 text-[11px] text-slate-400">Thu hồi từ bạn lúc {dateTime(unit.returnedAt)}</p>
                      ) : null}
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tiền cọc</p>
                      <dl className="mt-1 space-y-0.5 text-xs text-slate-600">
                        <div className="flex justify-between gap-3"><dt>Cọc đã đóng</dt><dd className="font-semibold tabular-nums text-slate-800">{money(deposit, currency)}</dd></div>
                        {deduction > 0 ? (
                          <div className="flex justify-between gap-3"><dt>Khấu trừ</dt><dd className="font-semibold tabular-nums text-red-700">−{money(deduction, currency)}</dd></div>
                        ) : null}
                        {item.refundAmount ? (
                          <div className="flex justify-between gap-3"><dt>Hoàn lại</dt><dd className="font-semibold tabular-nums text-emerald-800">{money(item.refundAmount, currency)}</dd></div>
                        ) : null}
                      </dl>
                      {item.refundStatus ? (
                        <p className={`mt-1.5 text-xs font-semibold ${item.refundStatus === "SUCCEEDED" ? "text-emerald-800" : item.refundStatus === "FAILED" ? "text-red-700" : "text-amber-800"}`}>
                          {REFUND_STATUS[item.refundStatus] ?? item.refundStatus}
                        </p>
                      ) : null}
                      {reason ? <p className="mt-1 text-[11px] text-slate-500">{reason}</p> : null}
                      {item.simulationNotice ? <p className="mt-1 text-[11px] text-slate-400">{item.simulationNotice}</p> : null}
                    </div>
                  </div>

                  {renderExtra(item)}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
