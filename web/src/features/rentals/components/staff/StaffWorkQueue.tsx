"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getStaffInventoryErrorMessage } from "@/features/rentals/services/staff-inventory.api";
import type {
  PreparationTaskStatus,
  PreparationTaskSummary,
} from "@/features/rentals/services/staff-preparation.api";
import { getPreparationTasks } from "@/features/rentals/services/staff-preparation.api";

type Column = {
  key: "new" | "picking" | "packing" | "ready";
  title: string;
  hint: string;
  statuses: PreparationTaskStatus[];
};

const columns: Column[] = [
  { key: "new", title: "1. ĐƠN MỚI", hint: "Nhận task trước khi soạn thiết bị", statuses: ["OPEN"] },
  { key: "picking", title: "2. SOẠN & KIỂM TRA", hint: "Pick đúng asset và lưu ảnh ngoại quan", statuses: ["PICKING", "CONDITION_CAPTURED"] },
  { key: "packing", title: "3. ĐÓNG GÓI", hint: "Đóng kiện và tạo mã package", statuses: ["PACKED"] },
  { key: "ready", title: "4. SẴN SÀNG GIAO", hint: "Task Staff Delivery đã được tạo", statuses: ["READY", "TRANSFERRED"] },
];

function formatDateTime(value: string | null) {
  if (!value) return "Chưa có hạn xử lý";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function TaskCard({ task }: { task: PreparationTaskSummary }) {
  const items = task.requiredLineSummary
    .map((line) => `${line.productName} ×${line.quantity}`)
    .join(" · ");
  const percent = task.progress.required
    ? Math.round((task.progress.picked / task.progress.required) * 100)
    : 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-black text-slate-900">{task.orderCode}</p>
          <p className="mt-1 text-[10px] text-slate-500">Task {task.id.slice(0, 8)}</p>
        </div>
        <span className="rounded-md bg-orange-50 px-2 py-1 text-[9px] font-black text-orange-700">{task.status}</span>
      </div>

      <h3 className="mt-3 text-sm font-black text-slate-950">{task.pickup.name}</h3>
      <p className="mt-1 text-[11px] text-slate-600">Kho: <strong>{task.inventoryLocation.name}</strong></p>
      <p className="mt-1 text-[11px] text-slate-600">Hạn: <strong>{formatDateTime(task.deadline)}</strong></p>
      <div className="mt-3 rounded-lg bg-[#edf3ff] p-3 text-[11px] leading-5 text-slate-700">{items || "Chưa có dòng thiết bị"}</div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500">
          <span>Đã pick</span><span>{task.progress.picked}/{task.progress.required}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200">
          <div className="h-1.5 rounded-full bg-emerald-700" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <Link href={`/staff/orders/${encodeURIComponent(task.id)}`} className="mt-4 block w-full rounded-lg bg-[#0d5b3a] px-3 py-2 text-center text-[11px] font-black text-white hover:bg-[#09482e]">
        {task.status === "OPEN" ? "Nhận & soạn ngay" : "Mở task"}
      </Link>
    </article>
  );
}

export function StaffWorkQueue() {
  const [tasks, setTasks] = useState<PreparationTaskSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPreparationTasks({ pageSize: 100, signal });
      setTasks(result.items);
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(getStaffInventoryErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadTasks(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadTasks]);

  const visibleTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter((task) =>
      `${task.orderCode} ${task.id} ${task.pickup.name} ${task.inventoryLocation.name}`.toLowerCase().includes(keyword),
    );
  }, [search, tasks]);

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">Kho vận › Luồng thuê thiết bị</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Chuẩn bị Rental Order</h1>
            <p className="mt-2 text-sm text-slate-600">Dữ liệu thật từ Inventory Task. Luồng trả thiết bị không hiển thị tại đây.</p>
          </div>
          <button type="button" onClick={() => void loadTasks()} disabled={loading} className="rounded-lg bg-[#0d5b3a] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-lg bg-[#edf3ff] px-4 text-xs outline-none" placeholder="Tìm theo mã đơn, task, điểm nhận hoặc kho" />
        </section>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {!loading && !error && tasks.length === 0 && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Chưa có task chuẩn bị. Rental Order phải thanh toán thành công trước khi Backend tạo task kho.
          </div>
        )}

        <section className="mt-5 grid items-start gap-4 xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = visibleTasks.filter((task) => column.statuses.includes(task.status));
            return (
              <div key={column.key} className="rounded-xl bg-[#eaf0fc] p-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black">{column.title}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold">{columnTasks.length}</span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">{column.hint}</p>
                <div className="mt-3 space-y-3">{columnTasks.map((task) => <TaskCard key={task.id} task={task} />)}</div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
