"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  finalizeNormalReturnUnits,
  getStaffReturn,
  getStaffReturnErrorMessage,
  listDamageAssessmentRules,
  listStaffReturns,
  markReturnedUnitReady,
  receiveStaffReturn,
  submitFinalInspection,
  type DamageAssessmentRule,
  type FinalInspectionInput,
  type ReturnQueueStatus,
  type StaffReturnDetail,
  type StaffReturnSummary,
} from "@/features/rentals/services/staff-returns.api";

type Draft = {
  condition: FinalInspectionInput["condition"];
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
  INVENTORY_RECEIVED: "Đã nhận vào kho",
  WAITING_CLEANING: "Chờ vệ sinh",
  REVIEW_REQUIRED: "Cần Admin duyệt",
  COMPLETED: "Hoàn tất",
  RETURNED: "Đang chuyển về kho",
};

const splitIds = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export function StaffReturnsInspection() {
  const [filter, setFilter] = useState<ReturnQueueStatus>();
  const [tasks, setTasks] = useState<StaffReturnSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<StaffReturnDetail>();
  const [rules, setRules] = useState<DamageAssessmentRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

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
      setRules(damageRules);
      setDrafts((current) => {
        const next = { ...current };
        returnDetail.receivedUnits.forEach((unit) => {
          next[unit.unitId] ??= {
            condition: "GOOD",
            notes: "",
            ruleId: "",
            evidenceIds: "",
          };
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

  const inspectionByUnit = useMemo(
    () => new Map(detail?.inspection.map((item) => [item.unitId, item]) ?? []),
    [detail?.inspection],
  );
  const pendingInspection = useMemo(
    () =>
      detail?.receivedUnits.filter(
        (unit) => !inspectionByUnit.get(unit.unitId)?.final,
      ) ?? [],
    [detail?.receivedUnits, inspectionByUnit],
  );

  async function run(action: () => Promise<void>, success: string) {
    if (!detail || busy) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
      setNotice(success);
      await Promise.all([loadList(), loadDetail(detail.id)]);
    } catch (requestError) {
      setError(getStaffReturnErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function inspectPendingUnits() {
    if (!detail || !pendingInspection.length) return;
    const items: FinalInspectionInput[] = pendingInspection.map((unit) => {
      const expected = detail.expectedUnits.find((item) => item.unitId === unit.unitId);
      const draft = drafts[unit.unitId];
      if (!draft) throw new Error(`Thiếu kết quả kiểm định cho ${unit.assetCode}.`);
      const issue = draft.condition === "DAMAGED";
      if (issue && !draft.ruleId) {
        throw new Error(`Hãy chọn quy tắc hư hỏng cho ${unit.assetCode}.`);
      }
      const evidenceIds = splitIds(draft.evidenceIds);
      const availableRules = rules.filter((rule) => rule.productId === expected?.productId);
      if (issue && availableRules.length === 0) {
        throw new Error(`Sản phẩm ${expected?.productName ?? unit.assetCode} chưa có damage rule.`);
      }
      return {
        unitId: unit.unitId,
        outcome: issue ? "ISSUE" : "PASS",
        condition: draft.condition,
        damage: issue
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

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Rental Return</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">Tiếp nhận và kiểm định hoàn trả</h1>
            <p className="mt-1 text-sm text-slate-500">Dữ liệu trực tiếp từ Backend, không còn task mẫu.</p>
          </div>
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => void loadList()}
            className="rounded-lg bg-[#125238] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
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
              className={`rounded-full px-4 py-2 text-xs font-bold ${
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
            <h2 className="font-black">Task hoàn trả ({tasks.length})</h2>
            <div className="mt-3 space-y-2">
              {loading ? <p className="text-sm text-slate-500">Đang tải...</p> : null}
              {!loading && tasks.length === 0 ? <p className="text-sm text-slate-500">Không có task phù hợp.</p> : null}
              {tasks.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => setSelectedId(task.id)}
                  className={`w-full rounded-lg border p-3 text-left ${
                    selectedId === task.id ? "border-emerald-700 bg-emerald-50" : "border-slate-200"
                  }`}
                >
                  <p className="font-mono text-[10px] font-black text-emerald-900">{task.id}</p>
                  <p className="mt-2 text-xs font-bold">Đơn {task.orderId}</p>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {statusLabel[task.status] ?? task.status} · {task.issueCount} vấn đề · {task.missingCount} thiếu
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-4">
            {!detail ? (
              <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Chọn một task hoàn trả.</div>
            ) : (
              <>
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-black text-emerald-900">#{detail.id}</p>
                      <h2 className="mt-2 text-xl font-black">Đơn {detail.orderId}</h2>
                      <p className="mt-1 text-xs text-slate-500">{statusLabel[detail.status] ?? detail.status} · version {detail.version}</p>
                    </div>
                    {detail.pendingTransfer?.status === "PENDING_RECEIPT" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => receiveStaffReturn(detail).then(() => undefined), "Đã xác nhận nhận thiết bị vào kho.")}
                        className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white disabled:opacity-50"
                      >
                        Xác nhận nhận {detail.pendingTransfer.unitIds.length} thiết bị
                      </button>
                    ) : null}
                  </div>
                  {detail.pendingTransfer ? (
                    <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-slate-700">
                      Điểm nhận: <strong>{detail.pendingTransfer.inventoryLocationName}</strong> · transfer {detail.pendingTransfer.id}
                    </p>
                  ) : null}
                </div>

                {detail.receivedUnits.map((received) => {
                  const unit = detail.expectedUnits.find((item) => item.unitId === received.unitId);
                  const inspection = inspectionByUnit.get(received.unitId);
                  const draft = drafts[received.unitId] ?? { condition: "GOOD", notes: "", ruleId: "", evidenceIds: "" };
                  const productRules = rules.filter((rule) => rule.productId === unit?.productId);
                  return (
                    <article key={received.unitId} className="rounded-xl border bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{unit?.productName ?? received.assetCode}</h3>
                          <p className="mt-1 font-mono text-xs text-slate-500">{received.assetCode} · {unit?.unitStatus}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${inspection?.final ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>
                          {inspection?.final ? `FINAL ${inspection.final.outcome}` : "CHỜ FINAL"}
                        </span>
                      </div>
                      {!inspection?.final ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <select
                            value={draft.condition}
                            onChange={(event) => setDrafts((current) => ({ ...current, [received.unitId]: { ...draft, condition: event.target.value as Draft["condition"] } }))}
                            className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs"
                          >
                            <option value="GOOD">Tốt</option><option value="FAIR">Hao mòn</option><option value="DAMAGED">Hư hỏng</option>
                          </select>
                          {draft.condition === "DAMAGED" ? (
                            <select
                              value={draft.ruleId}
                              onChange={(event) => setDrafts((current) => ({ ...current, [received.unitId]: { ...draft, ruleId: event.target.value } }))}
                              className="h-11 rounded-lg bg-red-50 px-3 text-xs"
                            >
                              <option value="">Chọn damage rule</option>
                              {productRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name} ({rule.severity})</option>)}
                            </select>
                          ) : <div />}
                          <input
                            value={draft.notes}
                            onChange={(event) => setDrafts((current) => ({ ...current, [received.unitId]: { ...draft, notes: event.target.value } }))}
                            placeholder="Ghi chú kiểm định"
                            className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs"
                          />
                          <input
                            value={draft.evidenceIds}
                            onChange={(event) => setDrafts((current) => ({ ...current, [received.unitId]: { ...draft, evidenceIds: event.target.value } }))}
                            placeholder="Media UUID (cách nhau bằng dấu phẩy)"
                            className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs"
                          />
                        </div>
                      ) : inspection.final.outcome === "NORMAL" && unit?.unitStatus === "CLEANING" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void run(() => markReturnedUnitReady({ unitId: received.unitId, inspectionId: inspection.final!.id, expectedVersion: unit.unitVersion }).then(() => undefined), `${received.assetCode} đã AVAILABLE.`)}
                          className="mt-4 rounded-lg bg-[#125238] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                        >
                          Đã vệ sinh & đủ phụ kiện — đưa về AVAILABLE
                        </button>
                      ) : (
                        <p className="mt-4 rounded-lg bg-orange-50 p-3 text-xs text-orange-800">Thiết bị có vấn đề đang chờ Admin xử lý ngoại lệ và quyết toán.</p>
                      )}
                    </article>
                  );
                })}

                {pendingInspection.length > 0 ? (
                  <button
                    type="button"
                    disabled={busy || detail.status !== "INVENTORY_RECEIVED"}
                    onClick={() => void run(inspectPendingUnits, "Đã ghi FINAL inspection; các món đạt được chuyển sang vệ sinh.")}
                    className="w-full rounded-xl bg-[#125238] px-5 py-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busy ? "Đang xử lý..." : `Hoàn tất FINAL inspection (${pendingInspection.length} thiết bị)`}
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
