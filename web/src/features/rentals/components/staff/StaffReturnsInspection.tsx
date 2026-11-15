"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { money, dateTime } from "@/features/rentals/components/RentalSectionNav";
import { ReturnEvidenceGallery } from "@/features/rentals/components/staff/ReturnEvidenceGallery";
import { listStaffRentalProducts } from "@/features/rentals/services/staff-products.api";
import {
  finalizeNormalReturnUnits,
  getStaffReturn,
  getStaffReturnErrorCode,
  getStaffReturnErrorMessage,
  listDamageAssessmentRules,
  listStaffReturns,
  markReturnedUnitReady,
  receiveStaffReturn,
  submitFinalInspection,
  type DamageAssessmentRule,
  type FinalInspectionInput,
  type ReturnQueueStatus,
  type ReturnUnitStage,
  type StaffReturnDetail,
  type StaffReturnSummary,
  type StaffReturnUnit,
} from "@/features/rentals/services/staff-returns.api";
import type { RentalGrade } from "@/features/rentals/types/rental";
import { orderShortCode, productLabel, shortId } from "@/features/rentals/services/rental-display";
import { uploadConditionEvidence } from "@/features/rentals/services/staff-preparation.api";

type Draft = {
  /** "" = chưa chọn: bắt buộc với món giao hàng báo có vấn đề. */
  condition: FinalInspectionInput["condition"] | "";
  notes: string;
  ruleId: string;
  evidenceIds: string;
};

const filters: { label: string; value?: ReturnQueueStatus }[] = [
  { label: "Tất cả" },
  { label: "Chờ kho nhận", value: "TRANSFER_PENDING" },
  { label: "Chờ kiểm định", value: "INVENTORY_RECEIVED" },
  { label: "Chờ vệ sinh", value: "WAITING_CLEANING" },
  { label: "Cần duyệt", value: "REVIEW_REQUIRED" },
  { label: "Hoàn tất", value: "COMPLETED" },
];

const statusLabel: Record<string, string> = {
  TRANSFER_PENDING: "Chờ kho nhận",
  INVENTORY_RECEIVED: "Chờ kiểm định cuối",
  WAITING_CLEANING: "Chờ vệ sinh",
  REVIEW_REQUIRED: "Chờ Admin xử lý",
  COMPLETED: "Hoàn tất",
};

const STAGE: Record<ReturnUnitStage, { label: string; tone: string }> = {
  AWAITING_RECEIPT: { label: "Chờ kho nhận", tone: "bg-slate-100 text-slate-700" },
  AWAITING_FINAL_INSPECTION: { label: "Chờ kiểm định cuối", tone: "bg-orange-100 text-orange-800" },
  AWAITING_ADMIN: { label: "Chờ Admin xử lý", tone: "bg-amber-100 text-amber-800" },
  WAITING_CLEANING: { label: "Chờ vệ sinh", tone: "bg-sky-100 text-sky-800" },
  READY: { label: "Sẵn sàng cho thuê", tone: "bg-emerald-100 text-emerald-800" },
  CLOSED_DAMAGED: { label: "Đã đóng · hư hỏng", tone: "bg-red-100 text-red-800" },
  CLOSED_LOST: { label: "Đã đóng · thất lạc", tone: "bg-red-100 text-red-800" },
  MISSING: { label: "Thiếu / thất lạc", tone: "bg-red-100 text-red-800" },
};

/** Thứ tự hiển thị: việc kho cần làm trước. */
const STAGE_ORDER: ReturnUnitStage[] = [
  "AWAITING_FINAL_INSPECTION",
  "WAITING_CLEANING",
  "AWAITING_RECEIPT",
  "AWAITING_ADMIN",
  "MISSING",
  "READY",
  "CLOSED_DAMAGED",
  "CLOSED_LOST",
];

const CONDITION_LABELS: Record<string, string> = {
  NEW: "Mới",
  GOOD: "Tốt",
  FAIR: "Hao mòn",
  DAMAGED: "Hư hỏng",
  LOST: "Thất lạc",
};

const FINAL_OUTCOME_LABELS: Record<string, string> = {
  NORMAL: "Đạt kiểm định",
  ISSUE: "Có vấn đề (chưa định mức)",
  DAMAGE_CONFIRMED: "Hư hỏng (đã định mức)",
  LOST_CONFIRMED: "Xác nhận thất lạc",
};

const CASE_STATUS_LABELS: Record<string, string> = {
  OPEN: "đang mở",
  UNDER_REVIEW: "Admin đang xem xét",
  RESOLVED: "đã xử lý",
  REJECTED: "đã từ chối",
  CLOSED: "đã đóng",
};

const GRADE_LABELS: Record<RentalGrade, string> = {
  LIKE_NEW: "Như mới",
  GOOD_USED: "Sử dụng tốt",
};

type GradeDraft = { decision: "KEEP" | "DOWNGRADE"; reason: string };

const splitIds = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const reportedIssue = (unit: StaffReturnUnit) => unit.deliveryObservation?.outcome === "ISSUE";

const emptyDraft = (unit: StaffReturnUnit): Draft => ({
  // Món bị giao hàng báo có vấn đề: không mặc định "Tốt", nhân viên phải tự chọn.
  condition: reportedIssue(unit) ? "" : "GOOD",
  notes: "",
  ruleId: "",
  evidenceIds: "",
});

export function StaffReturnsInspection() {
  const [filter, setFilter] = useState<ReturnQueueStatus>();
  const [tasks, setTasks] = useState<StaffReturnSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<StaffReturnDetail>();
  const [rules, setRules] = useState<DamageAssessmentRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [receiptSelections, setReceiptSelections] = useState<string[]>([]);
  const [custodyIncidentNote, setCustodyIncidentNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [uploadingUnit, setUploadingUnit] = useState<string>();
  // Sản phẩm có hạng bắt buộc gửi gradeDecision khi đưa thiết bị về AVAILABLE (RB-API-611).
  const [productGrades, setProductGrades] = useState<Record<string, RentalGrade>>({});
  const [gradeRequiredUnits, setGradeRequiredUnits] = useState<string[]>([]);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, GradeDraft>>({});

  useEffect(() => {
    let active = true;
    // Đọc hạng của sản phẩm để biết thiết bị nào cần phân hạng. Lỗi thì vẫn còn đường dự phòng:
    // server trả RENTAL_GRADE_DECISION_REQUIRED và màn hình mở ô phân hạng cho thiết bị đó.
    async function loadGrades() {
      const grades: Record<string, RentalGrade> = {};
      for (let page = 1; page <= 10; page += 1) {
        const result = await listStaffRentalProducts({ page, pageSize: 20 });
        result.items.forEach((product) => {
          if (product.grade === "LIKE_NEW" || product.grade === "GOOD_USED") grades[product.id] = product.grade;
        });
        if (page >= result.pagination.totalPages) break;
      }
      return grades;
    }
    loadGrades()
      .then((grades) => { if (active) setProductGrades(grades); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const loadList = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await listStaffReturns(filter, signal);
      setTasks(result.items);
      setSelectedId((current) =>
        current && result.items.some((item) => item.id === current)
          ? current
          : result.items[0]?.id,
      );
    } catch (loadError) {
      if (!signal?.aborted) setError(getStaffReturnErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filter]);

  const loadDetail = useCallback(async (returnId: string, signal?: AbortSignal) => {
    setError(undefined);
    try {
      const [returnDetail, damageRules] = await Promise.all([
        getStaffReturn(returnId, signal),
        listDamageAssessmentRules(),
      ]);
      setDetail(returnDetail);
      const pendingReceiptUnitIds = returnDetail.pendingTransfer?.unitIds.filter(
        (unitId) => !returnDetail.pendingTransfer?.receivedUnitIds.includes(unitId),
      ) ?? [];
      setReceiptSelections(pendingReceiptUnitIds);
      setCustodyIncidentNote("");
      setRules(damageRules);
      setDrafts((current) => {
        const next = { ...current };
        (returnDetail.units ?? []).forEach((unit) => {
          if (unit.stage === "AWAITING_FINAL_INSPECTION") next[unit.unitId] ??= emptyDraft(unit);
        });
        return next;
      });
    } catch (loadError) {
      if (!signal?.aborted) setError(getStaffReturnErrorMessage(loadError));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadList(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadList]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      if (!selectedId) {
        setDetail(undefined);
        return;
      }

      void loadDetail(selectedId, controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadDetail, selectedId]);

  const units = useMemo(() => {
    const list = [...(detail?.units ?? [])];
    return list.sort((a, b) => {
      const byStage = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
      if (byStage !== 0) return byStage;
      // Trong cùng giai đoạn: món giao hàng báo có vấn đề lên trước.
      return Number(reportedIssue(b)) - Number(reportedIssue(a));
    });
  }, [detail?.units]);
  const pendingInspection = units.filter((unit) => unit.stage === "AWAITING_FINAL_INSPECTION");
  const ruleName = useMemo(() => new Map(rules.map((rule) => [rule.id, rule.name])), [rules]);
  const pendingReceiptUnits = detail?.pendingTransfer?.unitIds.filter(
    (unitId) => !detail.pendingTransfer?.receivedUnitIds.includes(unitId),
  ) ?? [];
  const receiptShortageCount = pendingReceiptUnits.length - receiptSelections.length;

  async function run(action: () => Promise<void>, success: string | (() => string)) {
    if (!detail || busy) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
      setNotice(typeof success === "function" ? success() : success);
      await Promise.all([loadList(), loadDetail(detail.id)]);
    } catch (requestError) {
      setError(getStaffReturnErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function markUnitReady(input: {
    unitId: string;
    assetCode: string;
    inspectionId: string;
    expectedVersion: number;
    needsGrade: boolean;
  }) {
    let shortageCount = 0;
    let downgraded = false;
    await run(async () => {
      const draft: GradeDraft = gradeDrafts[input.unitId] ?? { decision: "KEEP", reason: "" };
      try {
        const result = await markReturnedUnitReady({
          unitId: input.unitId,
          inspectionId: input.inspectionId,
          expectedVersion: input.expectedVersion,
          gradeDecision: input.needsGrade
            ? draft.decision === "DOWNGRADE"
              ? { decision: "DOWNGRADE", reason: draft.reason.trim() }
              : { decision: "KEEP" }
            : undefined,
        });
        shortageCount = result?.gradeReview?.shortageOrderIds?.length ?? 0;
        downgraded = result?.gradeReview?.decision === "DOWNGRADE";
      } catch (requestError) {
        if (getStaffReturnErrorCode(requestError) === "RENTAL_GRADE_DECISION_REQUIRED") {
          setGradeRequiredUnits((current) => (current.includes(input.unitId) ? current : [...current, input.unitId]));
          throw new Error(`${input.assetCode} thuộc sản phẩm có hạng. Hãy chọn giữ hạng hoặc hạ hạng rồi bấm lại.`);
        }
        throw requestError;
      }
    }, () =>
      `Mã ${shortId(input.assetCode)} đã sẵn sàng cho thuê${downgraded ? " và chuyển sang hạng Sử dụng tốt" : ""}.` +
      (shortageCount > 0
        ? ` Hạ hạng làm thiếu hàng cho ${shortageCount} đơn đã đặt; các đơn này đã được đánh dấu cần xử lý.`
        : ""),
    );
  }

  function updateDraft(unit: StaffReturnUnit, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [unit.unitId]: { ...(current[unit.unitId] ?? emptyDraft(unit)), ...patch } }));
  }

  async function addEvidencePhotos(unit: StaffReturnUnit, files: FileList | null) {
    if (!files?.length) return;
    setUploadingUnit(unit.unitId);
    setError(undefined);
    try {
      const ids: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) throw new Error("Chỉ nhận file ảnh.");
        ids.push(await uploadConditionEvidence(file));
      }
      setDrafts((current) => {
        const draft = current[unit.unitId] ?? emptyDraft(unit);
        const merged = [...splitIds(draft.evidenceIds), ...ids];
        return { ...current, [unit.unitId]: { ...draft, evidenceIds: merged.join(",") } };
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error && !("isAxiosError" in uploadError)
        ? uploadError.message
        : getStaffReturnErrorMessage(uploadError));
    } finally {
      setUploadingUnit(undefined);
    }
  }

  async function inspectPendingUnits() {
    if (!detail || !pendingInspection.length) return;
    const items: FinalInspectionInput[] = pendingInspection.map((unit) => {
      const name = unit.productName ? productLabel(unit.productName) : `Mã ${shortId(unit.assetCode)}`;
      const draft = drafts[unit.unitId] ?? emptyDraft(unit);
      if (!draft.condition) {
        throw new Error(`${name}: giao hàng báo có vấn đề, hãy tự chọn tình trạng sau khi kiểm tra.`);
      }
      const damaged = draft.condition === "DAMAGED";
      const availableRules = rules.filter((rule) => rule.productId === unit.productId);
      if (damaged && availableRules.length === 0) {
        throw new Error(`${name} chưa có mức hư hỏng để chọn. Báo Admin bổ sung.`);
      }
      if (damaged && !draft.ruleId) throw new Error(`Hãy chọn mức hư hỏng cho ${name}.`);
      const evidenceIds = splitIds(draft.evidenceIds);
      if ((unit.evidenceRequired || damaged) && evidenceIds.length === 0) {
        throw new Error(`${name} cần ít nhất 1 ảnh bằng chứng.`);
      }
      return {
        unitId: unit.unitId,
        outcome: damaged ? "ISSUE" : "PASS",
        condition: draft.condition,
        damage: damaged
          ? [{ ruleId: draft.ruleId, quantity: 1, notes: draft.notes || undefined, evidenceIds }]
          : [],
        evidenceIds,
        notes: draft.notes || undefined,
      };
    });
    const result = await submitFinalInspection(detail.id, detail.version, items);
    const normal = result.assessments
      .filter((item) => item.outcome === "NORMAL")
      .map((item) => ({ unitId: item.unitId, inspectionVersion: item.version }));
    await finalizeNormalReturnUnits(detail.id, detail.version, normal);
  }

  const queueStatus = detail?.summary?.queueStatus;

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Hoàn trả thiết bị</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Tiếp nhận và kiểm định hoàn trả</h1>
            <p className="mt-1 text-sm text-slate-500">Nhận thiết bị khách trả về kho, kiểm định và đưa về sẵn sàng cho thuê.</p>
          </div>
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => void loadList()}
            className="rounded-lg bg-[#125238] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Làm mới
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              type="button"
              key={item.label}
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                filter === item.value ? "bg-[#125238] text-white" : "bg-white text-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {notice && <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="font-bold">Hồ sơ hoàn trả ({tasks.length})</h2>
            <div className="mt-3 space-y-2">
              {loading ? <p className="text-sm text-slate-500">Đang tải...</p> : null}
              {!loading && tasks.length === 0 ? <p className="text-sm text-slate-500">Không có hồ sơ phù hợp.</p> : null}
              {tasks.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => setSelectedId(task.id)}
                  className={`w-full rounded-lg border p-3 text-left ${
                    selectedId === task.id ? "border-emerald-700 bg-emerald-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Đơn {orderShortCode(task.orderId)}</p>
                    <span className="text-[10px] font-semibold text-slate-600">{statusLabel[task.status] ?? task.status}</span>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {task.pendingInspectionCount ? `${task.pendingInspectionCount} chờ kiểm định · ` : ""}
                    {task.deliveryReportedIssueCount
                      ? <span className="font-semibold text-orange-700">{task.deliveryReportedIssueCount} giao hàng báo vấn đề</span>
                      : "Giao hàng không báo vấn đề"}
                    {task.missingCount ? ` · ${task.missingCount} thiếu` : ""}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-4">
            {!detail ? (
              <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Chọn một hồ sơ hoàn trả.</div>
            ) : (
              <>
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-emerald-900">Hồ sơ hoàn trả</p>
                      <h2 className="mt-2 text-xl font-bold">Đơn {orderShortCode(detail.orderId)}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {queueStatus ? statusLabel[queueStatus] : "Đang cập nhật"}
                      </p>
                    </div>
                    {detail.pendingTransfer?.status === "PENDING_RECEIPT" ? (
                      <button
                        type="button"
                        disabled={busy || (receiptShortageCount > 0 && custodyIncidentNote.trim().length < 3)}
                        onClick={() => void run(
                          () => receiveStaffReturn(detail, receiptSelections, custodyIncidentNote).then(() => undefined),
                          receiptShortageCount
                            ? "Đã ghi nhận thiết bị thực nhận và mở hồ sơ sai lệch custody."
                            : "Đã xác nhận nhận thiết bị vào kho.",
                        )}
                        className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Xác nhận thực nhận {receiptSelections.length}/{pendingReceiptUnits.length}
                      </button>
                    ) : null}
                  </div>
                  {detail.summary ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        {detail.summary.totalUnits} thiết bị
                      </span>
                      {detail.summary.deliveryReportedIssueCount ? (
                        <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-800">
                          Lúc thu hồi: {detail.summary.deliveryReportedIssueCount} món có vấn đề
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                          Lúc thu hồi: không báo vấn đề
                        </span>
                      )}
                      {detail.summary.handoverReportedIssueCount ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
                          Lúc giao cho khách: ghi {detail.summary.handoverReportedIssueCount} lỗi có sẵn
                        </span>
                      ) : null}
                      {detail.summary.evidenceRequiredPendingCount ? (
                        <span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700">
                          {detail.summary.evidenceRequiredPendingCount} món bắt buộc ảnh
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {detail.summary?.handoverOrderLevelIssues?.length ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                      <p className="font-bold">Ghi chú lúc giao cho khách (không gắn món cụ thể)</p>
                      {detail.summary.handoverOrderLevelIssues.map((issue, index) => (
                        <p key={`${issue.type}-${index}`}>• {issue.description}</p>
                      ))}
                    </div>
                  ) : null}
                  {detail.pendingTransfer ? (
                    <div className="mt-3 space-y-3">
                      <p className="rounded-lg bg-blue-50 p-3 text-xs text-slate-700">
                        Điểm nhận: <strong>{detail.pendingTransfer.inventoryLocationName}</strong>
                      </p>
                      {detail.pendingTransfer.status === "PENDING_RECEIPT" ? (
                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Quét nhận từng thiết bị</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Chỉ tích những món kho thực tế nhận được. Món thiếu sẽ mở hồ sơ nội bộ, không tự quy lỗi cho khách.
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {pendingReceiptUnits.map((unitId) => {
                              const unit = detail.expectedUnits.find((item) => item.unitId === unitId);
                              const checked = receiptSelections.includes(unitId);
                              return (
                                <label key={unitId} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-xs ${checked ? "border-emerald-600 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setReceiptSelections((current) =>
                                      current.includes(unitId)
                                        ? current.filter((id) => id !== unitId)
                                        : [...current, unitId]
                                    )}
                                  />
                                  <span><strong>{unit?.productName ? productLabel(unit.productName) : "Thiết bị"}</strong><br />Mã {shortId(unit?.assetCode ?? unitId)}</span>
                                </label>
                              );
                            })}
                          </div>
                          {receiptShortageCount > 0 ? (
                            <div className="mt-3 rounded-lg bg-red-50 p-3">
                              <p className="text-xs font-semibold text-red-800">
                                Thiếu {receiptShortageCount} thiết bị so với lúc bàn giao về kho. Hãy mô tả sự việc.
                              </p>
                              <textarea
                                value={custodyIncidentNote}
                                onChange={(event) => setCustodyIncidentNote(event.target.value)}
                                placeholder="Ví dụ: niêm phong rách, không có thiết bị trong kiện khi kho mở..."
                                className="mt-2 min-h-20 w-full rounded-lg border border-red-200 bg-white p-3 text-xs"
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {!detail.units ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    API chưa trả danh sách thiết bị theo giai đoạn. Hãy khởi động lại API bản mới.
                  </div>
                ) : null}

                {units.map((unit) => {
                  const name = unit.productName ? productLabel(unit.productName) : `Mã ${shortId(unit.assetCode)}`;
                  const draft = drafts[unit.unitId] ?? emptyDraft(unit);
                  const productRules = rules.filter((rule) => rule.productId === unit.productId);
                  const grade = unit.productId ? productGrades[unit.productId] ?? null : null;
                  const needsGrade = Boolean(grade) || gradeRequiredUnits.includes(unit.unitId);
                  const gradeDraft: GradeDraft = gradeDrafts[unit.unitId] ?? { decision: "KEEP", reason: "" };
                  const downgradeReasonMissing = gradeDraft.decision === "DOWNGRADE" && gradeDraft.reason.trim().length < 3;
                  const observation = unit.deliveryObservation;
                  const flagged = reportedIssue(unit);
                  const evidenceCount = splitIds(draft.evidenceIds).length;
                  const evidenceNeeded = unit.evidenceRequired || draft.condition === "DAMAGED";
                  return (
                    <article
                      key={unit.unitId}
                      className={`rounded-xl border bg-white p-5 shadow-sm ${flagged && unit.stage === "AWAITING_FINAL_INSPECTION" ? "border-orange-300" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold">{name}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Mã {shortId(unit.assetCode)}
                            {unit.deposit ? ` · Cọc ${money(unit.deposit.depositAmount)}` : ""}
                            {unit.inventoryReceivedAt ? ` · Vào kho ${dateTime(unit.inventoryReceivedAt)}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {unit.stage === "AWAITING_FINAL_INSPECTION" && unit.evidenceRequired ? (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-semibold text-red-700">Bắt buộc ảnh</span>
                          ) : null}
                          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${STAGE[unit.stage].tone}`}>
                            {STAGE[unit.stage].label}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className={`rounded-lg border p-3 ${flagged ? "border-orange-200 bg-orange-50" : "border-emerald-100 bg-emerald-50/50"}`}>
                          <p className={`text-xs font-bold ${flagged ? "text-orange-900" : "text-emerald-900"}`}>
                            {observation
                              ? flagged
                                ? "⚠ Lúc thu hồi: nhân viên giao báo có vấn đề"
                                : "✓ Lúc thu hồi: nhân viên giao báo bình thường"
                              : "Lúc thu hồi: chưa ghi nhận"}
                          </p>
                          {observation ? (
                            <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                              {observation.visibleDamage ? <p>• Có hư hỏng nhìn thấy</p> : null}
                              {observation.accessoryObservations.map((text, index) => (
                                <p key={`${text}-${index}`}>• {text}</p>
                              ))}
                              {observation.notes ? <p>Ghi chú: {observation.notes}</p> : null}
                              {observation.observedAt ? (
                                <p className="text-slate-500">Lúc {dateTime(observation.observedAt)}</p>
                              ) : null}
                              <ReturnEvidenceGallery
                                ids={observation.evidenceIds}
                                label="Ảnh giao hàng chụp"
                                autoLoad={flagged && unit.stage === "AWAITING_FINAL_INSPECTION"}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-bold text-slate-800">Lúc giao cho khách</p>
                          {unit.handoverBaseline ? (
                            <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                              <p>Tình trạng: {CONDITION_LABELS[unit.handoverBaseline.condition] ?? unit.handoverBaseline.condition}</p>
                              {unit.handoverBaseline.notes ? <p>Ghi chú: {unit.handoverBaseline.notes}</p> : null}
                              <ReturnEvidenceGallery ids={unit.handoverBaseline.evidenceIds} label="Ảnh lúc giao" />
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] text-slate-500">Không có hồ sơ lúc giao.</p>
                          )}
                          {unit.handoverReportedIssues?.length ? (
                            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                              <p className="font-bold">⚠ Nhân viên giao đã ghi lỗi có sẵn khi giao cho khách</p>
                              {unit.handoverReportedIssues.map((issue, index) => (
                                <p key={`${issue.type}-${index}`}>• {issue.description}</p>
                              ))}
                              <p className="mt-1 text-amber-800">Lỗi này có trước kỳ thuê: không trừ cọc cho lỗi này.</p>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {unit.stage === "AWAITING_FINAL_INSPECTION" ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <select
                            value={draft.condition}
                            onChange={(event) => updateDraft(unit, { condition: event.target.value as Draft["condition"] })}
                            className={`h-11 rounded-lg px-3 text-xs ${draft.condition ? "bg-[#edf3ff]" : "border border-orange-300 bg-orange-50"}`}
                          >
                            {!draft.condition ? <option value="">Chọn tình trạng sau khi kiểm tra</option> : null}
                            <option value="GOOD">Tốt</option><option value="FAIR">Hao mòn</option><option value="DAMAGED">Hư hỏng</option>
                          </select>
                          {draft.condition === "DAMAGED" ? (
                            <select
                              value={draft.ruleId}
                              onChange={(event) => updateDraft(unit, { ruleId: event.target.value })}
                              className="h-11 rounded-lg bg-red-50 px-3 text-xs"
                            >
                              <option value="">{productRules.length ? "Chọn mức hư hỏng" : "Sản phẩm chưa có mức hư hỏng"}</option>
                              {productRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name} ({rule.severity})</option>)}
                            </select>
                          ) : <div />}
                          <input
                            value={draft.notes}
                            onChange={(event) => updateDraft(unit, { notes: event.target.value })}
                            placeholder="Ghi chú kiểm định"
                            className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs"
                          />
                          <div className={`flex h-11 items-center justify-between gap-2 rounded-lg px-3 text-xs ${evidenceNeeded && !evidenceCount ? "bg-red-50" : "bg-[#edf3ff]"}`}>
                            <span className={evidenceNeeded && !evidenceCount ? "font-semibold text-red-700" : "text-slate-600"}>
                              {uploadingUnit === unit.unitId
                                ? "Đang tải ảnh..."
                                : evidenceCount
                                  ? `Đã có ${evidenceCount} ảnh bằng chứng`
                                  : evidenceNeeded
                                    ? "Bắt buộc ít nhất 1 ảnh"
                                    : "Ảnh bằng chứng (không bắt buộc)"}
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              {evidenceCount && uploadingUnit !== unit.unitId ? (
                                <button type="button" onClick={() => updateDraft(unit, { evidenceIds: "" })} className="text-slate-500 hover:text-red-600">
                                  Xóa
                                </button>
                              ) : null}
                              <label className={`cursor-pointer rounded-md bg-white px-3 py-1.5 font-semibold text-emerald-800 shadow-sm ${uploadingUnit ? "pointer-events-none opacity-50" : ""}`}>
                                Chụp / tải ảnh
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  multiple
                                  className="hidden"
                                  onChange={(event) => {
                                    void addEvidencePhotos(unit, event.target.files);
                                    event.target.value = "";
                                  }}
                                />
                              </label>
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {unit.finalInspection ? (
                        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
                          <p className="font-semibold">
                            Kiểm định cuối: {FINAL_OUTCOME_LABELS[unit.finalInspection.outcome] ?? unit.finalInspection.outcome}
                          </p>
                          {unit.finalInspection.findings.map((finding) => (
                            <p key={finding.ruleId}>
                              • {ruleName.get(finding.ruleId) ?? "Mức hư hỏng"} × {finding.quantity}: {money(finding.amount)}
                            </p>
                          ))}
                          {unit.finalInspection.notes ? <p>Ghi chú: {unit.finalInspection.notes}</p> : null}
                          {unit.deposit && (unit.deposit.deductionAmount > 0 || unit.deposit.refundAmount > 0) ? (
                            <p>
                              Cọc: trừ {money(unit.deposit.deductionAmount)} · hoàn {money(unit.deposit.refundAmount)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {unit.stage === "WAITING_CLEANING" && unit.unitStatus === "CLEANING" && unit.finalInspection ? (
                        <div className="mt-4 space-y-3">
                          {needsGrade ? (
                            <div className="rounded-lg border border-slate-200 p-3">
                              <p className="text-xs font-bold text-slate-700">
                                Phân hạng sau khi trả{grade ? ` · hiện tại: ${GRADE_LABELS[grade]}` : ""}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-4 text-xs">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`grade-${unit.unitId}`}
                                    checked={gradeDraft.decision === "KEEP"}
                                    onChange={() => setGradeDrafts((current) => ({ ...current, [unit.unitId]: { ...gradeDraft, decision: "KEEP" } }))}
                                  />
                                  Giữ hạng
                                </label>
                                {grade !== "GOOD_USED" ? (
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name={`grade-${unit.unitId}`}
                                      checked={gradeDraft.decision === "DOWNGRADE"}
                                      onChange={() => setGradeDrafts((current) => ({ ...current, [unit.unitId]: { ...gradeDraft, decision: "DOWNGRADE" } }))}
                                    />
                                    Hạ xuống &quot;Sử dụng tốt&quot;
                                  </label>
                                ) : null}
                              </div>
                              {gradeDraft.decision === "DOWNGRADE" ? (
                                <textarea
                                  value={gradeDraft.reason}
                                  onChange={(event) => setGradeDrafts((current) => ({ ...current, [unit.unitId]: { ...gradeDraft, reason: event.target.value } }))}
                                  placeholder="Lý do hạ hạng (bắt buộc, tối thiểu 3 ký tự)"
                                  className="mt-2 min-h-16 w-full rounded-lg border border-slate-200 p-3 text-xs"
                                />
                              ) : null}
                              <p className="mt-2 text-[11px] text-slate-500">Phân hạng chỉ đổi sản phẩm của thiết bị, không ảnh hưởng tiền cọc của khách vừa trả.</p>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy || (needsGrade && downgradeReasonMissing) || unit.unitVersion === null}
                            onClick={() => void markUnitReady({
                              unitId: unit.unitId,
                              assetCode: unit.assetCode ?? unit.unitId,
                              inspectionId: unit.finalInspection!.id,
                              expectedVersion: unit.unitVersion!,
                              needsGrade,
                            })}
                            className="rounded-lg bg-[#125238] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                          >
                            Đã vệ sinh & đủ phụ kiện — sẵn sàng cho thuê
                          </button>
                        </div>
                      ) : unit.stage === "WAITING_CLEANING" ? (
                        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Đạt kiểm định, đang chờ chuyển sang vệ sinh.</p>
                      ) : unit.stage === "AWAITING_ADMIN" ? (
                        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                          Thiết bị có vấn đề, đang chờ Admin xử lý ngoại lệ và quyết toán cọc
                          {unit.exceptionCase ? ` (hồ sơ ${CASE_STATUS_LABELS[unit.exceptionCase.status] ?? unit.exceptionCase.status})` : ""}.
                          Kho không cần thao tác thêm; thiết bị tự chuyển sang hư hỏng khi quyết toán xong.
                        </p>
                      ) : unit.stage === "READY" ? (
                        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">✓ Thiết bị đã vệ sinh và sẵn sàng cho thuê.</p>
                      ) : unit.stage === "CLOSED_DAMAGED" ? (
                        <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-800">Cọc đã quyết toán; thiết bị đã chuyển sang hư hỏng để sửa chữa.</p>
                      ) : unit.stage === "MISSING" || unit.stage === "CLOSED_LOST" ? (
                        <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-800">Thiết bị chưa về kho; được xử lý trong hồ sơ thất lạc của Admin.</p>
                      ) : unit.stage === "AWAITING_RECEIPT" ? (
                        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Đang chờ kho xác nhận thực nhận ở phía trên.</p>
                      ) : null}
                    </article>
                  );
                })}

                {pendingInspection.length > 0 ? (
                  <button
                    type="button"
                    disabled={busy || Boolean(uploadingUnit) || detail.status !== "INVENTORY_RECEIVED"}
                    onClick={() => void run(inspectPendingUnits, "Đã ghi kết quả kiểm định cuối. Món đạt chuyển sang chờ vệ sinh; món có vấn đề chuyển cho Admin xử lý.")}
                    className="w-full rounded-xl bg-[#125238] px-5 py-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "Đang xử lý..." : `Hoàn tất kiểm định cuối (${pendingInspection.length} thiết bị)`}
                  </button>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
