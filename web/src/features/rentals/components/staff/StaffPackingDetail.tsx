"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import {
  getPreparationTask,
  getRentalDeliveryAssignees,
  markPreparationReady,
  packPreparationTask,
  requestPreparationTransfer,
} from "@/features/rentals/services/staff-preparation.api";
import { getStaffInventoryErrorMessage } from "@/features/rentals/services/staff-inventory.api";
import type { PreparationTaskDetail, RentalAssignee } from "@/features/rentals/services/staff-preparation.api";
import { RentalThreeCanvas } from "@/features/rentals/components/visuals/RentalThreeCanvas";

export function StaffPackingDetail({ orderId: taskId }: { orderId: string }) {
  const [detail, setDetail] = useState<PreparationTaskDetail | null>(null);
  const [assignees, setAssignees] = useState<RentalAssignee[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [deliveryTaskId, setDeliveryTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pack" | "ready" | "transfer" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [task, staff] = await Promise.all([
        getPreparationTask(taskId, signal),
        getRentalDeliveryAssignees(signal),
      ]);
      setDetail(task);
      setAssignees(staff.items);
      setSelectedStaffId((current) => current || staff.items[0]?.id || "");
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

  async function pack() {
    if (!detail || busy) return;
    setBusy("pack");
    setError(null);
    try {
      await packPreparationTask(taskId, {
        unitIds: detail.pickedUnits.map((unit) => unit.unitId),
        expectedVersion: detail.task.version,
      });
      await load();
    } catch (packError) {
      setError(getStaffInventoryErrorMessage(packError, "Không thể đóng gói task."));
    } finally {
      setBusy(null);
    }
  }

  async function ready() {
    if (!detail?.package || busy) return;
    setBusy("ready");
    setError(null);
    try {
      const result = await markPreparationReady(taskId, {
        packageId: detail.package.id,
        expectedVersion: detail.task.version,
      });
      setDeliveryTaskId(result.deliveryTaskId);
      await load();
    } catch (readyError) {
      setError(getStaffInventoryErrorMessage(readyError, "Không thể đánh dấu package READY."));
    } finally {
      setBusy(null);
    }
  }

  async function transfer() {
    if (!detail?.package || !selectedStaffId || busy) return;
    setBusy("transfer");
    setError(null);
    try {
      await requestPreparationTransfer(taskId, {
        packageId: detail.package.id,
        toStaffId: selectedStaffId,
        expectedVersion: detail.task.version,
      });
      await load();
    } catch (transferError) {
      setError(getStaffInventoryErrorMessage(transferError, "Không thể giao package cho Staff Delivery."));
    } finally {
      setBusy(null);
    }
  }

  if (loading && !detail) return <main className="p-8 text-sm text-slate-600">Đang tải package...</main>;
  if (!detail) return <main className="p-8"><p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error ?? "Không tìm thấy task."}</p></main>;

  const evidenceComplete = detail.progress.evidenceComplete ?? 0;
  const canPack =
    detail.progress.required > 0 &&
    detail.progress.picked === detail.progress.required &&
    evidenceComplete === detail.progress.picked &&
    !detail.package;
  const isReady = detail.task.status === "READY" || detail.task.status === "TRANSFERRED";

  return (
    <main>
      <div className="space-y-5">
        <Link href={`/staff/orders/${encodeURIComponent(taskId)}`} className="text-xs font-bold text-emerald-100/65">← Quay lại kiểm tra</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-[#eef4ef]">Đóng gói & bàn giao vận chuyển</h1>
            <p className="mt-2 text-sm text-emerald-100/60">Đơn #{detail.task.id.replaceAll("-", "").slice(-6).toUpperCase()} · {detail.pickupContext.name}</p>
          </div>
        </div>

        <ol className="flex flex-wrap items-center gap-3 text-sm font-bold text-emerald-100/65" aria-label="Tiến trình đóng gói">
          <li className="flex items-center gap-2"><b className="grid h-8 w-8 place-items-center rounded-full bg-[#f58b36] text-[#271205]">✓</b>Đóng gói & tạo QR</li>
          <li className="h-px w-8 bg-emerald-700" />
          <li className="flex items-center gap-2"><b className={`grid h-8 w-8 place-items-center rounded-full ${detail.package ? "bg-[#f58b36] text-[#271205]" : "bg-[#173a2a]"}`}>{detail.package ? "✓" : "2"}</b>Sẵn sàng giao</li>
          <li className="h-px w-8 bg-emerald-700" />
          <li className="flex items-center gap-2 text-white"><b className="grid h-8 w-8 place-items-center rounded-full bg-[#f58b36] text-[#271205]">3</b>Bàn giao custody</li>
        </ol>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[22px] border border-emerald-800/60 bg-[#0f1c15] p-5">
          <h2 className="font-black">Thiết bị trong kiện</h2>
          <div className="mt-4 space-y-2">
            {detail.pickedUnits.map((unit) => (
              <div key={unit.unitId} className="flex items-center justify-between rounded-xl bg-[#14241b] p-3 text-sm text-emerald-50">
                <span><strong>{unit.assetCode}</strong> · {unit.condition}</span>
                <span className={unit.evidenceCaptured ? "font-bold text-emerald-300" : "text-red-300"}>{unit.evidenceCaptured ? "✓ Có ảnh" : "Thiếu ảnh"}</span>
              </div>
            ))}
          </div>

          {!detail.package && (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-[#123d27] p-4 text-sm text-emerald-200">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-800" />
              <span>Tôi đã đối chiếu đủ asset, ảnh ngoại quan và niêm phong kiện.</span>
            </label>
          )}

          {!detail.package && (
            <button type="button" onClick={() => void pack()} disabled={!confirmed || !canPack || Boolean(busy)} className="mt-4 rounded-lg bg-[#0d5b3a] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
              {busy === "pack" ? "Đang tạo package..." : "Đóng gói & tạo QR"}
            </button>
          )}

          {!canPack && !detail.package && (
            <p className="mt-3 text-xs text-orange-300">Backend chỉ cho đóng gói khi đã pick đủ và mọi unit đều có ảnh tình trạng.</p>
          )}
        </section>

        <aside className="overflow-hidden rounded-[22px] border border-emerald-800/60 bg-[#0f1c15] text-center">
          <div className="h-[300px]"><RentalThreeCanvas variant="package" /></div>
          <div className="space-y-1 px-5 pb-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Package</p>
            <p className="font-mono text-xl font-black text-white">{detail.package?.code || "CHƯA TẠO KIỆN"}</p>
            <p className="text-xs text-emerald-100/60">{detail.pickedUnits.length} thiết bị · <b className="text-emerald-300">{detail.package?.status || detail.task.status}</b></p>
          </div>
        </aside>
        </div>

        {detail.package && (
          <section className="grid gap-5 rounded-[22px] border border-emerald-800/60 bg-[#0f1c15] p-5 md:grid-cols-[180px_1fr]">
            <div className="rounded-xl bg-white p-3"><QRCodeSVG value={detail.package.qrValue} size={150} /></div>
            <div>
              <p className="text-xs font-bold uppercase text-emerald-100/60">Mã QR custody thật</p>
              <h2 className="mt-2 font-mono text-2xl font-black">{detail.package.code}</h2>
              <p className="mt-2 text-sm text-emerald-100/60">{detail.package.unitIds.length} thiết bị · trạng thái {detail.package.status}</p>

              {!isReady && (
                <button type="button" onClick={() => void ready()} disabled={Boolean(busy) || detail.package.status !== "PACKED"} className="mt-5 rounded-lg bg-[#0d5b3a] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                  {busy === "ready" ? "Đang tạo task giao..." : "Đánh dấu READY & tạo task Staff Delivery"}
                </button>
              )}
            </div>
          </section>
        )}

        {isReady && (
          <section className="rounded-[22px] border-2 border-[#f58b36] bg-[#0f1c15] p-5">
            <h2 className="font-black text-white">Bàn giao custody cho Staff Delivery</h2>
            <p className="mt-2 text-sm text-emerald-100/60">Backend đã tạo task outbound cho Staff Delivery{deliveryTaskId ? `: ${deliveryTaskId}` : "."}</p>
            {detail.pendingTransfer ? (
              <div className="mt-4 rounded-lg bg-white p-4 text-sm text-slate-700">
                <p><strong>Đã chuyển cho:</strong> {detail.pendingTransfer.toStaff.displayName}</p>
                <p className="mt-1 font-mono text-xs"><strong>Custody transfer:</strong> {detail.pendingTransfer.id}</p>
                <p className="mt-2 text-xs text-slate-500">Staff Delivery mở app, nhận task và quét package để xác nhận custody.</p>
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-white p-4">
                <label className="text-xs font-bold text-slate-600">Chọn Staff Delivery nhận package</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)} className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {assignees.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayName} · {staff.activeTaskCount} task</option>)}
                  </select>
                  <button type="button" onClick={() => void transfer()} disabled={!selectedStaffId || Boolean(busy)} className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
                    {busy === "transfer" ? "Đang chuyển..." : "Tạo bàn giao custody"}
                  </button>
                </div>
                {assignees.length === 0 && <p className="mt-2 text-xs text-red-700">Chưa có tài khoản Staff Delivery ACTIVE.</p>}
              </div>
            )}
            <Link href="/staff/work-queue" className="mt-4 inline-block rounded-lg bg-emerald-900 px-4 py-2 text-sm font-black text-white">Về hàng đợi</Link>
          </section>
        )}
      </div>
    </main>
  );
}
