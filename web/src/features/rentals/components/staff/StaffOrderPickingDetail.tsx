"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  claimPreparationTask,
  getPreparationPickCandidates,
  getPreparationTask,
  pickPreparationUnits,
  savePreparationCondition,
  uploadConditionEvidence,
} from "@/features/rentals/services/staff-preparation.api";
import { getStaffInventoryErrorMessage } from "@/features/rentals/services/staff-inventory.api";
import type {
  EquipmentCondition,
  PreparationCandidate,
  PreparationTaskDetail,
  PreparationUnit,
} from "@/features/rentals/services/staff-preparation.api";

const conditionOptions: EquipmentCondition[] = ["NEW", "GOOD", "FAIR", "DAMAGED", "LOST"];

export function StaffOrderPickingDetail({ orderId: taskId }: { orderId: string }) {
  const [detail, setDetail] = useState<PreparationTaskDetail | null>(null);
  const [candidates, setCandidates] = useState<PreparationCandidate[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [conditions, setConditions] = useState<Record<string, EquipmentCondition>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const task = await getPreparationTask(taskId, signal);
      const canLoadCandidates = task.task.status === "PICKING" || task.task.status === "CONDITION_CAPTURED";
      const pickCandidates = canLoadCandidates
        ? await getPreparationPickCandidates(taskId, { signal })
        : { items: [] };
      setDetail(task);
      setCandidates(pickCandidates.items);
      setSelectedCodes([]);
    } catch (loadError) {
      if (!signal?.aborted) setError(getStaffInventoryErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [load]);

  const selectedByProduct = useMemo(() => {
    const result = new Map<string, number>();
    candidates.forEach((candidate) => {
      if (selectedCodes.includes(candidate.assetCode)) {
        result.set(candidate.productId, (result.get(candidate.productId) ?? 0) + 1);
      }
    });
    return result;
  }, [candidates, selectedCodes]);

  function toggleCandidate(candidate: PreparationCandidate) {
    setSelectedCodes((current) => {
      if (current.includes(candidate.assetCode)) return current.filter((code) => code !== candidate.assetCode);
      const line = detail?.requiredLines.find((item) => item.productId === candidate.productId);
      const remaining = line?.remainingQty ?? 0;
      if ((selectedByProduct.get(candidate.productId) ?? 0) >= remaining) return current;
      return [...current, candidate.assetCode];
    });
  }

  async function run(action: string, operation: () => Promise<void>) {
    if (busyAction) return;
    setBusyAction(action);
    setError(null);
    try {
      await operation();
      await load();
    } catch (actionError) {
      setError(getStaffInventoryErrorMessage(actionError, "Không thể cập nhật task chuẩn bị."));
    } finally {
      setBusyAction(null);
    }
  }

  async function captureEvidence(unit: PreparationUnit) {
    const file = files[unit.unitId];
    if (!file || !detail) {
      setError("Hãy chọn ảnh hiện trạng trước khi xác nhận.");
      return;
    }
    await run(`evidence-${unit.unitId}`, async () => {
      const mediaId = await uploadConditionEvidence(file);
      await savePreparationCondition(taskId, {
        unitId: unit.unitId,
        condition: conditions[unit.unitId] ?? "GOOD",
        notes: notes[unit.unitId]?.trim() || undefined,
        evidenceIds: [mediaId],
        expectedVersion: detail.task.version,
      });
    });
  }

  if (loading && !detail) return <main className="p-8 text-sm text-slate-600">Đang tải task kho...</main>;

  if (!detail) {
    return <main className="p-8"><p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error ?? "Không tìm thấy task."}</p></main>;
  }

  const allPicked = detail.progress.picked === detail.progress.required && detail.progress.required > 0;
  const evidenceComplete = detail.progress.evidenceComplete ?? 0;
  const allEvidence = allPicked && evidenceComplete === detail.progress.picked;

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/staff/work-queue" className="text-xs font-bold text-emerald-800">← Hàng đợi kho</Link>
            <h1 className="mt-2 text-3xl font-black">Soạn & kiểm tra thiết bị</h1>
            <p className="mt-2 text-sm text-slate-600">Task {detail.task.id} · Order {detail.task.orderId}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-900">{detail.task.status}</span>
        </div>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Điểm nhận</p><p className="mt-2 font-black">{detail.pickupContext.name}</p></article>
          <article className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Đã pick</p><p className="mt-2 text-2xl font-black">{detail.progress.picked}/{detail.progress.required}</p></article>
          <article className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Đã có ảnh</p><p className="mt-2 text-2xl font-black">{evidenceComplete}/{detail.progress.picked}</p></article>
        </section>

        {detail.task.status === "OPEN" && (
          <section className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-5">
            <h2 className="font-black">Bước 1 · Nhận task</h2>
            <p className="mt-1 text-sm text-slate-600">Task chưa được gán. Nhận task trước khi quét thiết bị.</p>
            <button type="button" disabled={Boolean(busyAction)} onClick={() => void run("claim", () => claimPreparationTask(taskId, detail.task.version).then(() => undefined))} className="mt-4 rounded-lg bg-[#0d5b3a] px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busyAction === "claim" ? "Đang nhận..." : "Nhận task"}</button>
          </section>
        )}

        {detail.task.status !== "OPEN" && !allPicked && (
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-black">Bước 2 · Chọn asset còn khả dụng</h2>
            <div className="mt-4 space-y-4">
              {detail.requiredLines.map((line) => (
                <div key={line.orderLineId} className="rounded-xl bg-[#edf3ff] p-4">
                  <div className="flex justify-between gap-3 text-sm"><strong>{line.productName}</strong><span>Còn {line.remainingQty} cần pick</span></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {candidates.filter((candidate) => candidate.productId === line.productId).map((candidate) => (
                      <label key={candidate.id} className="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-3 text-xs">
                        <input type="checkbox" checked={selectedCodes.includes(candidate.assetCode)} onChange={() => toggleCandidate(candidate)} className="h-4 w-4 accent-emerald-800" />
                        <span><strong>{candidate.assetCode}</strong><br /><span className="text-slate-500">{candidate.condition} · {candidate.location ?? "Kho chính"}</span></span>
                      </label>
                    ))}
                    {candidates.filter((candidate) => candidate.productId === line.productId).length === 0 && <p className="text-xs text-orange-800">Không có unit khả dụng cho sản phẩm này.</p>}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" disabled={selectedCodes.length === 0 || Boolean(busyAction)} onClick={() => void run("pick", () => pickPreparationUnits(taskId, { assetCodes: selectedCodes, expectedVersion: detail.task.version }).then(() => undefined))} className="mt-4 rounded-lg bg-[#0d5b3a] px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busyAction === "pick" ? "Đang ghi nhận..." : `Xác nhận pick ${selectedCodes.length} thiết bị`}</button>
          </section>
        )}

        {detail.pickedUnits.length > 0 && (
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-black">Bước 3 · Ảnh và tình trạng trước bàn giao</h2>
            <p className="mt-1 text-sm text-slate-600">Mỗi thiết bị cần ít nhất một ảnh thật trước khi đóng gói.</p>
            <div className="mt-4 space-y-3">
              {detail.pickedUnits.map((unit) => (
                <article key={unit.unitId} className="rounded-xl bg-[#edf3ff] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{unit.assetCode}</strong><p className="text-xs text-slate-500">{unit.physicalStatus}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${unit.evidenceCaptured ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>{unit.evidenceCaptured ? "Đã lưu ảnh" : "Chưa có ảnh"}</span></div>
                  {!unit.evidenceCaptured && (
                    <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_1fr_auto]">
                      <select value={conditions[unit.unitId] ?? "GOOD"} onChange={(event) => setConditions((current) => ({ ...current, [unit.unitId]: event.target.value as EquipmentCondition }))} className="rounded-lg border bg-white px-3 py-2 text-xs">{conditionOptions.map((condition) => <option key={condition}>{condition}</option>)}</select>
                      <input type="file" accept="image/*" capture="environment" onChange={(event) => setFiles((current) => ({ ...current, [unit.unitId]: event.target.files?.[0] }))} className="rounded-lg bg-white px-3 py-2 text-xs" />
                      <input value={notes[unit.unitId] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [unit.unitId]: event.target.value }))} placeholder="Ghi chú ngoại quan" className="rounded-lg border bg-white px-3 py-2 text-xs" />
                      <button type="button" disabled={!files[unit.unitId] || Boolean(busyAction)} onClick={() => void captureEvidence(unit)} className="rounded-lg bg-[#0d5b3a] px-4 py-2 text-xs font-black text-white disabled:opacity-50">{busyAction === `evidence-${unit.unitId}` ? "Đang tải..." : "Lưu"}</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 flex justify-end">
          {allEvidence ? (
            <Link href={`/staff/orders/${encodeURIComponent(taskId)}/packing`} className="rounded-lg bg-[#0d5b3a] px-5 py-3 text-sm font-black text-white">Tiếp tục đóng gói →</Link>
          ) : (
            <p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">Cần pick đủ và chụp ảnh đủ trước khi đóng gói.</p>
          )}
        </div>
      </div>
    </main>
  );
}
