"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getStaffInventoryErrorMessage } from "@/features/rentals/services/staff-inventory.api";
import type {
  PreparationTaskPriority,
  PreparationTaskStatus,
  PreparationTaskSummary,
} from "@/features/rentals/services/staff-preparation.api";
import {
  getPreparationOrderBrief,
  getPreparationTasks,
  type PreparationOrderBrief,
} from "@/features/rentals/services/staff-preparation.api";
import { orderShortCode, PREPARATION_STATUS, splitGradeName } from "@/features/rentals/services/rental-display";

type Column = {
  key: "new" | "picking" | "packing" | "ready";
  title: string;
  hint: string;
  statuses: PreparationTaskStatus[];
};

const columns: Column[] = [
  { key: "new", title: "1. ĐƠN MỚI", hint: "Nhận việc trước khi soạn thiết bị", statuses: ["OPEN"] },
  { key: "picking", title: "2. SOẠN & KIỂM TRA", hint: "Chọn đúng thiết bị và chụp ảnh tình trạng", statuses: ["PICKING", "CONDITION_CAPTURED"] },
  { key: "packing", title: "3. ĐÓNG GÓI", hint: "Đóng kiện, chuyển sang sẵn sàng giao", statuses: ["PACKED"] },
  { key: "ready", title: "4. SẴN SÀNG GIAO", hint: "Chờ hoặc đã giao cho nhân viên giao hàng", statuses: ["READY", "TRANSFERRED"] },
];

function formatDateTime(value: string | null) {
  if (!value) return "Chưa có hạn xử lý";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatAgo(value: string, now: number) {
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

const PRIORITY_BADGE: Record<PreparationTaskPriority, { label: string; tone: string } | null> = {
  URGENT: { label: "Khẩn", tone: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  HIGH: { label: "Sắp tới hạn", tone: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" },
  NORMAL: null,
  LOW: null,
};

type SortKey = "HANDOVER_ASC" | "HANDOVER_DESC" | "CREATED_DESC" | "PRIORITY";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "HANDOVER_ASC", label: "Ngày giao khách gần nhất" },
  { value: "HANDOVER_DESC", label: "Ngày giao khách xa nhất" },
  { value: "CREATED_DESC", label: "Đơn mới đặt nhất" },
  { value: "PRIORITY", label: "Theo mức ưu tiên kho" },
];

const timeOf = (value?: string | null) => (value ? new Date(value).getTime() : Number.NaN);

/** Sắp theo ngày; đơn chưa có dữ liệu ngày luôn xuống cuối. "PRIORITY" giữ thứ tự backend trả. */
function sortTasks(tasks: PreparationTaskSummary[], briefs: Record<string, PreparationOrderBrief>, key: SortKey) {
  if (key === "PRIORITY") return tasks;
  const pick = (task: PreparationTaskSummary) =>
    key === "CREATED_DESC" ? timeOf(briefs[task.orderId]?.createdAt) : timeOf(briefs[task.orderId]?.handoverAt);
  const direction = key === "HANDOVER_ASC" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const [x, y] = [pick(a), pick(b)];
    if (Number.isNaN(x) && Number.isNaN(y)) return 0;
    if (Number.isNaN(x)) return 1;
    if (Number.isNaN(y)) return -1;
    return (x - y) * direction;
  });
}

/** "Hôm nay", "Ngày mai", "Còn 3 ngày", "Đã qua 1 ngày" theo lịch Việt Nam. */
function dayDistance(value: string, now: number) {
  const day = (time: number) => Math.floor((time + 7 * 3_600_000) / 86_400_000);
  const diff = day(new Date(value).getTime()) - day(now);
  if (diff === 0) return "hôm nay";
  if (diff === 1) return "ngày mai";
  return diff > 0 ? `còn ${diff} ngày` : `đã qua ${-diff} ngày`;
}

const isUrgent = (task: PreparationTaskSummary) => task.priority === "URGENT" || task.status === "BLOCKED";

function TaskCard({ task, now, brief }: { task: PreparationTaskSummary; now: number; brief?: PreparationOrderBrief }) {
  const lines = task.requiredLineSummary.map((line) => ({ ...splitGradeName(line.productName), quantity: line.quantity }));
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  const statusInfo = PREPARATION_STATUS[task.status] ?? { label: "Đang cập nhật", tone: "bg-slate-100 text-slate-600" };
  const transferred = task.status === "TRANSFERRED";
  const percent = task.progress.required
    ? Math.round((task.progress.picked / task.progress.required) * 100)
    : 0;
  const priorityBadge = task.isOverdue
    ? { label: "Quá hạn", tone: "bg-red-600 text-white" }
    : task.status === "BLOCKED"
      ? null
      : task.priority
        ? PRIORITY_BADGE[task.priority]
        : null;
  const highlighted = isUrgent(task) || task.priority === "HIGH";

  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm ${isUrgent(task) ? "border-red-200 ring-1 ring-red-100" : highlighted ? "border-amber-200" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold text-slate-900">Đơn {orderShortCode(task.orderId)}</p>
        <div className="flex flex-wrap justify-end gap-1">
          {priorityBadge ? (
            <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityBadge.tone}`}>{priorityBadge.label}</span>
          ) : null}
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusInfo.tone}`}>{statusInfo.label}</span>
        </div>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-slate-950">{task.pickup.name}</h3>
      {brief?.handoverAt ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-900">
          Giao khách: <strong className="tabular-nums">{formatDateTime(brief.handoverAt)}</strong>
          <span className="text-emerald-700"> · {dayDistance(brief.handoverAt, now)}</span>
        </p>
      ) : null}
      {brief?.createdAt ? (
        <p className="mt-1 text-[11px] text-slate-600">
          Đặt đơn: <strong className="tabular-nums">{formatDateTime(brief.createdAt)}</strong>
          {brief.paidAt ? <span className="text-slate-400"> · thanh toán {formatDateTime(brief.paidAt)}</span> : null}
        </p>
      ) : null}
      {brief?.dueAt ? (
        <p className="mt-1 text-[11px] text-slate-600">Khách trả: <strong className="tabular-nums">{formatDateTime(brief.dueAt)}</strong></p>
      ) : null}
      <p className="mt-1 text-[11px] text-slate-600">Kho: <strong>{task.inventoryLocation.name}</strong></p>
      {task.sentToInventoryAt ? (
        <p className="mt-1 text-[11px] text-slate-600">
          Tới kho: <strong>{formatDateTime(task.sentToInventoryAt)}</strong>
          <span className="text-slate-400"> · {formatAgo(task.sentToInventoryAt, now)}</span>
        </p>
      ) : null}
      <p className={`mt-1 text-[11px] ${task.isOverdue ? "text-red-700" : "text-slate-600"}`}>Hạn: <strong>{formatDateTime(task.deadline)}</strong></p>
      <div className="mt-3 rounded-lg bg-[#edf3ff] p-3 text-[11px] text-slate-700">
        {lines.length ? (
          <>
            <p className="mb-1.5 font-semibold text-slate-500">{lines.length} món · {totalUnits} thiết bị</p>
            <ul className="space-y-1">
              {lines.map((line, index) => (
                <li key={`${line.base}-${index}`} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-800">{line.base}</span>
                    {line.grade ? <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] text-emerald-800">{line.grade}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">×{line.quantity}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          "Chưa có dòng thiết bị"
        )}
      </div>

      {transferred ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">
          ✓ Đã soạn đủ {task.progress.required} thiết bị và giao cho nhân viên giao hàng
        </p>
      ) : (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-500">
            <span>Đã soạn</span><span>{task.progress.picked}/{task.progress.required}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200">
            <div className="h-1.5 rounded-full bg-emerald-700" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <Link href={`/staff/orders/${encodeURIComponent(task.id)}`} className="mt-4 block w-full rounded-lg bg-[#0d5b3a] px-3 py-2 text-center text-[11px] font-bold text-white hover:bg-[#09482e]">
        {task.status === "OPEN" ? "Nhận & soạn ngay" : transferred ? "Xem lại" : "Tiếp tục"}
      </Link>
    </article>
  );
}

export function StaffWorkQueue() {
  const [tasks, setTasks] = useState<PreparationTaskSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [briefs, setBriefs] = useState<Record<string, PreparationOrderBrief>>({});
  const [sortKey, setSortKey] = useState<SortKey>("HANDOVER_ASC");

  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPreparationTasks({ pageSize: 100, signal });
      setTasks(result.items);
      setNow(Date.now());
      // Ngày tạo đơn, ngày giao khách… nằm ở chi tiết đơn; tải song song, đơn nào lỗi thì bỏ qua.
      const orderIds = [...new Set(result.items.map((task) => task.orderId))];
      const settled = await Promise.allSettled(orderIds.map((orderId) => getPreparationOrderBrief(orderId, signal)));
      if (signal?.aborted) return;
      setBriefs(
        Object.fromEntries(settled.flatMap((entry) => (entry.status === "fulfilled" ? [[entry.value.orderId, entry.value]] : []))),
      );
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
    const sorted = sortTasks(tasks, briefs, sortKey);
    if (!keyword) return sorted;
    return sorted.filter((task) =>
      `${orderShortCode(task.orderId)} ${task.orderCode} ${task.pickup.name} ${task.inventoryLocation.name}`
        .toLowerCase()
        .includes(keyword.replace(/^#/, "")),
    );
  }, [briefs, search, sortKey, tasks]);

  // Thứ tự theo lựa chọn sắp xếp (mặc định ngày giao khách gần nhất); nhóm cần xử lý gấp vẫn tách lên đầu.
  const urgentTasks = useMemo(() => visibleTasks.filter(isUrgent), [visibleTasks]);
  const overdueCount = urgentTasks.filter((task) => task.isOverdue).length;
  const blockedCount = urgentTasks.filter((task) => task.status === "BLOCKED").length;

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">Kho vận › Luồng thuê thiết bị</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Chuẩn bị đơn thuê</h1>
            <p className="mt-2 text-sm text-slate-600">Các đơn đã thanh toán cần kho soạn và đóng gói. Đồ khách trả nằm ở mục Tiếp nhận hoàn trả.</p>
          </div>
          <button type="button" onClick={() => void loadTasks()} disabled={loading} className="rounded-lg bg-[#0d5b3a] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>

        <section className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 min-w-[220px] flex-1 rounded-lg bg-[#edf3ff] px-4 text-xs outline-none" placeholder="Tìm theo mã đơn, điểm nhận hoặc kho" />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Sắp xếp
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </section>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {!loading && !error && tasks.length === 0 && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Chưa có đơn cần chuẩn bị. Đơn thuê xuất hiện ở đây sau khi khách thanh toán thành công.
          </div>
        )}

        {urgentTasks.length > 0 && (
          <section className="mt-5 rounded-xl border border-red-200 bg-red-50/60 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-red-800">Cần xử lý trước ({urgentTasks.length})</h2>
              <p className="text-[11px] text-red-700">
                {[overdueCount ? `${overdueCount} đơn quá hạn` : null, blockedCount ? `${blockedCount} đơn đang bị chặn` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {urgentTasks.map((task) => <TaskCard key={task.id} task={task} now={now} brief={briefs[task.orderId]} />)}
            </div>
          </section>
        )}

        <section className="mt-5 grid items-start gap-4 xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = visibleTasks.filter((task) => !isUrgent(task) && column.statuses.includes(task.status));
            return (
              <div key={column.key} className="rounded-xl bg-[#eaf0fc] p-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold">{column.title}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold">{columnTasks.length}</span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">{column.hint}</p>
                <div className="mt-3 space-y-3">{columnTasks.map((task) => <TaskCard key={task.id} task={task} now={now} brief={briefs[task.orderId]} />)}</div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
