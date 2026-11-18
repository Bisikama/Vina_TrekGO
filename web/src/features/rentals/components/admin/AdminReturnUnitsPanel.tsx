"use client";

import { useEffect, useState } from "react";

import { SurfaceCard, SurfaceSectionHeader } from "@/components/ui";
import { ReturnEvidenceGallery } from "@/features/rentals/components/staff/ReturnEvidenceGallery";
import { splitGradeName } from "@/features/rentals/services/rental-display";
import {
  getStaffReturn,
  listDamageAssessmentRules,
  type StaffReturnDetail,
  type StaffReturnUnit,
} from "@/features/rentals/services/staff-returns.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { formatDateTime, formatMoney } from "@/features/rentals/components/admin/admin-rental-labels";

const STAGE: Record<string, { label: string; tone: string }> = {
  AWAITING_RECEIPT: { label: "Chờ kho nhận", tone: "bg-[#F7F7F4] text-[#404943] border-[#E5E7EB]" },
  AWAITING_FINAL_INSPECTION: { label: "Chờ kiểm định cuối", tone: "bg-[#FEF3C7] text-[#92400E] border-amber-200" },
  AWAITING_ADMIN: { label: "Chờ Admin xử lý", tone: "bg-[#FEF3C7] text-[#92400E] border-amber-200" },
  WAITING_CLEANING: { label: "Chờ vệ sinh", tone: "bg-blue-50 text-[#2563EB] border-blue-200" },
  READY: { label: "Sẵn sàng cho thuê", tone: "bg-[#DCFCE7] text-[#166534] border-emerald-200" },
  CLOSED_DAMAGED: { label: "Đã đóng · hư hỏng", tone: "bg-[#FEE2E2] text-[#991B1B] border-red-200" },
  CLOSED_LOST: { label: "Đã đóng · thất lạc", tone: "bg-[#FEE2E2] text-[#991B1B] border-red-200" },
  MISSING: { label: "Thiếu / thất lạc", tone: "bg-[#FEE2E2] text-[#991B1B] border-red-200" },
};

const OUTCOME: Record<string, string> = {
  NORMAL: "Bình thường",
  PASS: "Đạt",
  ISSUE: "Có vấn đề",
  DAMAGED: "Hư hỏng",
  MISSING: "Thiếu",
};

const DEPOSIT_STATUS: Record<string, string> = {
  HELD: "Đang giữ",
  REVIEW_REQUIRED: "Chờ duyệt",
  REFUND_PENDING: "Chờ hoàn",
  REFUND_FAILED: "Hoàn lỗi",
  DEDUCTED: "Đã khấu trừ",
  REFUNDED: "Đã hoàn",
  SETTLED: "Đã quyết toán",
};

type Props = {
  /** id nhiệm vụ THU HỒI (deliveryTasks có taskType RETURN). */
  returnTaskId: string;
  currency: string;
};

/**
 * Kiểm định & cọc theo từng thiết bị cho Admin: giao hàng ghi nhận lúc thu hồi,
 * kết quả kiểm định cuối của kho (lỗi theo quy tắc, ghi chú, ảnh) và cọc của món đó.
 */
export function AdminReturnUnitsPanel({ returnTaskId, currency }: Props) {
  const [detail, setDetail] = useState<StaffReturnDetail>();
  const [ruleNames, setRuleNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getStaffReturn(returnTaskId)
      .then(async (value) => {
        if (!active) return;
        setDetail(value);
        const productIds = [...new Set((value.units ?? []).flatMap((unit) => (unit.productId ? [unit.productId] : [])))];
        const rules = await Promise.allSettled(productIds.map((id) => listDamageAssessmentRules(id)));
        if (!active) return;
        setRuleNames(
          Object.fromEntries(
            rules.flatMap((result) => (result.status === "fulfilled" ? result.value.map((rule) => [rule.id, rule.name]) : [])),
          ),
        );
      })
      .catch((reason) => {
        if (active) setError(getRentalApiErrorMessage(reason, "Không tải được kết quả kiểm định."));
      });
    return () => {
      active = false;
    };
  }, [returnTaskId]);

  const units = [...(detail?.units ?? [])].sort((a, b) =>
    (a.productName ?? "~").localeCompare(b.productName ?? "~", "vi"),
  );

  return (
    <SurfaceCard>
      <SurfaceSectionHeader
        title="Kiểm định & cọc theo thiết bị"
        subtitle="Kết quả giao hàng ghi nhận khi thu hồi, kiểm định cuối của kho và tiền cọc từng món"
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!error && !detail ? <p className="text-sm text-[#6B7280]">Đang tải...</p> : null}
      {detail && units.length === 0 ? <p className="text-sm text-[#6B7280]">Chưa có thiết bị trả về.</p> : null}
      <div className="divide-y divide-[#E5E7EB]">
        {units.map((unit) => (
          <UnitRow key={unit.unitId} unit={unit} ruleNames={ruleNames} currency={currency} />
        ))}
      </div>
    </SurfaceCard>
  );
}

function UnitRow({ unit, ruleNames, currency }: { unit: StaffReturnUnit; ruleNames: Record<string, string>; currency: string }) {
  const name = unit.productName ? splitGradeName(unit.productName) : { base: "Thiết bị", grade: null };
  const stage = STAGE[unit.stage] ?? { label: unit.stage, tone: STAGE.AWAITING_RECEIPT.tone };
  const observation = unit.deliveryObservation;
  const final = unit.finalInspection;
  const findingTotal = final?.findings.reduce((sum, finding) => sum + finding.amount, 0) ?? 0;

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[#1F2937]">
            {name.base}
            {name.grade ? <span className="ml-2 text-xs font-normal text-[#6B7280]">{name.grade}</span> : null}
          </p>
          <p className="text-xs text-[#6B7280]">
            <span className="font-mono">{unit.assetCode ?? "—"}</span>
            {unit.returnedAt ? ` · Thu hồi ${formatDateTime(unit.returnedAt)}` : ""}
            {unit.inventoryReceivedAt ? ` · Kho nhận ${formatDateTime(unit.inventoryReceivedAt)}` : ""}
          </p>
        </div>
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${stage.tone}`}>{stage.label}</span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg bg-[#F7F7F4] p-3 text-xs text-[#4B5563]">
          <p className="font-semibold text-[#1F2937]">Giao hàng ghi nhận khi thu hồi</p>
          {observation ? (
            <>
              <p className={`mt-1 font-medium ${observation.outcome === "NORMAL" ? "text-emerald-700" : "text-red-700"}`}>
                {OUTCOME[observation.outcome] ?? observation.outcome}
                {observation.visibleDamage ? " · có hư hỏng nhìn thấy" : ""}
              </p>
              {observation.accessoryObservations.length ? <p className="mt-1">Phụ kiện: {observation.accessoryObservations.join(", ")}</p> : null}
              {observation.notes ? <p className="mt-1">Ghi chú: {observation.notes}</p> : null}
              {observation.evidenceIds.length ? <ReturnEvidenceGallery ids={observation.evidenceIds} label="Ảnh giao hàng chụp" /> : null}
            </>
          ) : (
            <p className="mt-1">Chưa có ghi nhận.</p>
          )}
        </div>

        <div className="rounded-lg bg-[#F7F7F4] p-3 text-xs text-[#4B5563]">
          <p className="font-semibold text-[#1F2937]">Kiểm định cuối của kho</p>
          {final ? (
            <>
              <p className={`mt-1 font-medium ${final.outcome === "NORMAL" ? "text-emerald-700" : "text-red-700"}`}>
                {OUTCOME[final.outcome] ?? final.outcome}
              </p>
              {final.findings.length ? (
                <ul className="mt-1 space-y-0.5">
                  {final.findings.map((finding) => (
                    <li key={finding.ruleId} className="flex justify-between gap-2">
                      <span>
                        {ruleNames[finding.ruleId] ?? "Lỗi theo quy tắc"}
                        {finding.quantity > 1 ? ` ×${finding.quantity}` : ""}
                      </span>
                      <span className="tabular-nums text-red-700">{formatMoney(finding.amount, currency)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-2 border-t border-[#E5E7EB] pt-0.5 font-medium text-[#1F2937]">
                    <span>Tổng mức trừ theo quy tắc</span>
                    <span className="tabular-nums">{formatMoney(findingTotal, currency)}</span>
                  </li>
                </ul>
              ) : null}
              {final.notes ? <p className="mt-1">Ghi chú kho: {final.notes}</p> : null}
              {final.evidenceIds.length ? <ReturnEvidenceGallery ids={final.evidenceIds} label="Ảnh kiểm định" /> : null}
            </>
          ) : (
            <p className="mt-1">{unit.stage === "AWAITING_RECEIPT" || unit.stage === "MISSING" ? "Chưa về kho." : "Chưa kiểm định."}</p>
          )}
        </div>

        <div className="rounded-lg bg-[#F7F7F4] p-3 text-xs text-[#4B5563]">
          <p className="font-semibold text-[#1F2937]">Tiền cọc</p>
          {unit.deposit ? (
            <dl className="mt-1 space-y-0.5">
              <div className="flex justify-between gap-2"><dt>Cọc</dt><dd className="tabular-nums text-[#1F2937]">{formatMoney(unit.deposit.depositAmount, currency)}</dd></div>
              <div className="flex justify-between gap-2"><dt>Khấu trừ</dt><dd className="tabular-nums text-red-700">{formatMoney(unit.deposit.deductionAmount, currency)}</dd></div>
              <div className="flex justify-between gap-2"><dt>Hoàn lại</dt><dd className="tabular-nums text-emerald-700">{formatMoney(unit.deposit.refundAmount, currency)}</dd></div>
              <div className="flex justify-between gap-2 border-t border-[#E5E7EB] pt-0.5"><dt>Trạng thái</dt><dd className="font-medium text-[#1F2937]">{DEPOSIT_STATUS[unit.deposit.status] ?? unit.deposit.status}</dd></div>
            </dl>
          ) : (
            <p className="mt-1">Chưa quyết toán.</p>
          )}
          {unit.exceptionCase ? (
            <p className="mt-2 text-amber-800">Có hồ sơ xử lý: {unit.exceptionCase.reason}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
