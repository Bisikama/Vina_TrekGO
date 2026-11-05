"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  getPreparationTask,
  getRentalDeliveryAssignees,
  markPreparationReady,
  packPreparationTask,
  requestPreparationTransfer,
} from "@/features/rentals/services/staff-preparation.api";
import { getStaffInventoryErrorMessage } from "@/features/rentals/services/staff-inventory.api";
import type { PreparationTaskDetail, RentalAssignee } from "@/features/rentals/services/staff-preparation.api";
import {
  CONDITION_LABELS,
  CUSTODY_TRANSFER_LABELS,
  orderShortCode,
  PREPARATION_STATUS,
  productLabel,
  shortId,
} from "@/features/rentals/services/rental-display";

export function StaffPackingDetail({ orderId: taskId }: { orderId: string }) {
  const [detail, setDetail] = useState<PreparationTaskDetail | null>(null);
  const [assignees, setAssignees] = useState<RentalAssignee[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
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
      await markPreparationReady(taskId, {
        packageId: detail.package.id,
        expectedVersion: detail.task.version,
      });
      await load();
    } catch (readyError) {
      setError(getStaffInventoryErrorMessage(readyError, "Chưa chuyển được kiện sang sẵn sàng giao."));
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
      setError(getStaffInventoryErrorMessage(transferError, "Chưa giao được kiện cho nhân viên giao hàng."));
    } finally {
      setBusy(null);
    }
  }

  if (loading && !detail) return <main className="p-8 text-sm text-slate-600">Đang tải kiện hàng...</main>;
  if (!detail) return <main className="p-8"><p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error ?? "Không tìm thấy việc chuẩn bị."}</p></main>;

  const evidenceComplete = detail.progress.evidenceComplete ?? 0;
  const canPack =
    detail.progress.required > 0 &&
    detail.progress.picked === detail.progress.required &&
    evidenceComplete === detail.progress.picked &&
    !detail.package;
  const isReady = detail.task.status === "READY" || detail.task.status === "TRANSFERRED";
  const isCancelled = detail.task.status === "CANCELLED";
  const statusInfo = PREPARATION_STATUS[detail.task.status] ?? { label: "Đang cập nhật", tone: "bg-slate-100 text-slate-600" };
  const productNameOf = (productId: string) =>
    productLabel(detail.requiredLines.find((line) => line.productId === productId)?.productName ?? "Thiết bị");

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-5xl">
        <Link href={`/staff/orders/${encodeURIComponent(taskId)}`} className="text-xs font-semibold text-emerald-800">← Quay lại kiểm tra</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Đóng gói & bàn giao</h1>
            <p className="mt-2 text-sm text-slate-600">Đơn {orderShortCode(detail.task.orderId)} · {detail.pickupContext.name}</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusInfo.tone}`}>
            {statusInfo.label}
          </span>
        </div>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        {isCancelled && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
            Đơn thuê này đã bị hủy. Kiện hàng và nhiệm vụ kho đã đóng, không thể tiếp tục bàn giao.
          </div>
        )}

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Thiết bị trong kiện</h2>
          <div className="mt-4 space-y-2">
            {detail.pickedUnits.map((unit) => (
              <div key={unit.unitId} className="flex items-center justify-between rounded-lg bg-[#edf3ff] p-3 text-sm">
                <span>
                  <strong className="font-semibold">{productNameOf(unit.productId)}</strong>
                  <span className="text-slate-600"> · Mã {shortId(unit.assetCode)} · {CONDITION_LABELS[unit.condition] ?? unit.condition}</span>
                </span>
                <span className={unit.evidenceCaptured ? "text-emerald-800" : "text-red-700"}>{unit.evidenceCaptured ? "✓ Có ảnh" : "Thiếu ảnh"}</span>
              </div>
            ))}
          </div>

          {!detail.package && (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-800" />
              <span>Tôi đã đối chiếu đủ thiết bị, ảnh tình trạng và niêm phong kiện.</span>
            </label>
          )}

          {!detail.package && (
            <button type="button" onClick={() => void pack()} disabled={!confirmed || !canPack || Boolean(busy)} className="mt-4 rounded-lg bg-[#0d5b3a] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              {busy === "pack" ? "Đang đóng gói..." : "Đóng gói"}
            </button>
          )}

          {!canPack && !detail.package && (
            <p className="mt-3 text-xs text-orange-800">Hệ thống chỉ cho phép đóng gói khi đã chọn đủ thiết bị và mọi thiết bị đều có ảnh tình trạng.</p>
          )}
        </section>

        {detail.package && (
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Kiện hàng</p>
            <h2 className="mt-1 text-xl font-semibold">Kiện của đơn {orderShortCode(detail.task.orderId)}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {detail.package.unitIds.length} thiết bị · {detail.package.status === "PACKED" ? "Đã đóng gói" : "Sẵn sàng giao"}
            </p>

            {!isReady && (
              <button type="button" onClick={() => void ready()} disabled={Boolean(busy) || detail.package.status !== "PACKED"} className="mt-5 rounded-lg bg-[#0d5b3a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy === "ready" ? "Đang cập nhật..." : "Sẵn sàng giao"}
              </button>
            )}
          </section>
        )}

        {!isCancelled && isReady && (
          <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-semibold text-emerald-900">Đã sẵn sàng giao</h2>
            {detail.pendingTransfer ? (
              <div className="mt-4 rounded-lg bg-white p-4 text-sm text-slate-700">
                <p>Đã giao cho <strong className="font-semibold">{detail.pendingTransfer.toStaff.displayName}</strong></p>
                <p className="mt-1 text-xs text-slate-500">
                  {CUSTODY_TRANSFER_LABELS[detail.pendingTransfer.status] ?? "Đang chờ xác nhận"}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-white p-4">
                <p className="text-sm text-emerald-800">Chọn nhân viên giao hàng nhận kiện này.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)} className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {assignees.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayName} · {staff.activeTaskCount} việc</option>)}
                  </select>
                  <button type="button" onClick={() => void transfer()} disabled={!selectedStaffId || Boolean(busy)} className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {busy === "transfer" ? "Đang giao..." : "Giao kiện"}
                  </button>
                </div>
                {assignees.length === 0 && <p className="mt-2 text-xs text-red-700">Chưa có nhân viên giao hàng đang hoạt động.</p>}
              </div>
            )}
            <Link href="/staff/work-queue" className="mt-4 inline-block rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Về hàng đợi</Link>
          </section>
        )}
      </div>
    </main>
  );
}
