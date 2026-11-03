"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuthStore } from "@/features/auth";
import {
  getPreparationTasks,
  type PreparationTaskStatus,
  type PreparationTaskSummary,
  type RentalAssignee,
} from "@/features/rentals/services/staff-preparation.api";
import {
  listStaffReturns,
  type ReturnQueueStatus,
  type StaffReturnSummary,
} from "@/features/rentals/services/staff-returns.api";
import {
  getRentalAssignees,
  initialsOf,
  STAFF_ROLE_LABELS,
} from "@/features/rentals/services/staff-overview.api";

// Lịch công việc dựng hoàn toàn từ api thật:
//  - GET /inventory/tasks          → việc chuẩn bị đơn (hạn = deadline, người nhận = assignee)
//  - GET /staff/returns            → lịch nhận hoàn trả (scheduledAt)
//  - GET /staff/rental-assignees   → nhân sự kho vận / giao nhận và số việc đang giữ
// Backend chưa có api ca trực, nên trang không hiện ca sáng/chiều.

const PREP_STATUS: Record<PreparationTaskStatus, { label: string; tone: string }> = {
  OPEN: { label: "Chờ nhận việc", tone: "bg-amber-50 text-amber-800" },
  PICKING: { label: "Đang lấy đồ", tone: "bg-blue-50 text-blue-800" },
  CONDITION_CAPTURED: { label: "Đã chụp tình trạng", tone: "bg-blue-50 text-blue-800" },
  PACKED: { label: "Đã đóng gói", tone: "bg-emerald-50 text-emerald-800" },
  READY: { label: "Sẵn sàng giao", tone: "bg-emerald-50 text-emerald-800" },
  TRANSFERRED: { label: "Đã bàn giao", tone: "bg-slate-100 text-slate-600" },
  BLOCKED: { label: "Bị chặn", tone: "bg-red-50 text-red-700" },
  CANCELLED: { label: "Đã huỷ", tone: "bg-slate-100 text-slate-500" },
};

const RETURN_STATUS: Record<ReturnQueueStatus, { label: string; tone: string }> = {
  TRANSFER_PENDING: { label: "Chờ kho nhận", tone: "bg-amber-50 text-amber-800" },
  INVENTORY_RECEIVED: { label: "Chờ kiểm định", tone: "bg-blue-50 text-blue-800" },
  WAITING_CLEANING: { label: "Chờ vệ sinh", tone: "bg-blue-50 text-blue-800" },
  REVIEW_REQUIRED: { label: "Cần duyệt", tone: "bg-red-50 text-red-700" },
  COMPLETED: { label: "Hoàn tất", tone: "bg-slate-100 text-slate-600" },
};

const DONE_PREP: PreparationTaskStatus[] = ["TRANSFERRED", "CANCELLED"];
const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

type ScheduleItem =
  | { kind: "prep"; at: Date | null; task: PreparationTaskSummary }
  | { kind: "return"; at: Date | null; task: StaffReturnSummary };

type Filter = "all" | "mine" | "overdue";

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay(); // 0 = CN
  const diff = day === 0 ? -6 : 1 - day; // tuần bắt đầu thứ Hai
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const dayMonth = (date: Date) => `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
const time = (date: Date) => date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

function isOverdue(item: ScheduleItem, now: Date) {
  if (!item.at || item.at >= now) return false;
  if (item.kind === "prep") return !["READY", ...DONE_PREP].includes(item.task.status);
  return item.task.status !== "COMPLETED";
}

function ItemCard({ item, now, myId }: { item: ScheduleItem; now: Date; myId?: string }) {
  const overdue = isOverdue(item, now);
  if (item.kind === "prep") {
    const status = PREP_STATUS[item.task.status] ?? { label: item.task.status, tone: "bg-slate-100 text-slate-600" };
    const mine = item.task.assignee?.id && item.task.assignee.id === myId;
    return (
      <Link
        href={`/staff/orders/${encodeURIComponent(item.task.id)}`}
        className={`block rounded-xl border p-3 transition hover:border-emerald-600/40 hover:bg-emerald-50/40 ${mine ? "border-emerald-600/40 bg-emerald-50/50" : "border-slate-200 bg-white"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Chuẩn bị đơn {item.at ? `· hạn ${time(item.at)}` : ""}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">#{item.task.orderCode}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${overdue ? "bg-red-50 text-red-700" : status.tone}`}>
            {overdue ? "Quá hạn" : status.label}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          Đã lấy {item.task.progress.picked}/{item.task.progress.required} món · {item.task.pickup.name}
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          {item.task.assignee ? (mine ? "Bạn đang giữ việc này" : `Người nhận: ${item.task.assignee.displayName}`) : "Chưa có người nhận"}
        </p>
      </Link>
    );
  }
  const status = RETURN_STATUS[item.task.status] ?? { label: item.task.status, tone: "bg-slate-100 text-slate-600" };
  return (
    <Link
      href="/staff/returns"
      className="block rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-500/40 hover:bg-blue-50/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
            Nhận hoàn trả {item.at ? `· ${time(item.at)}` : ""}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
            Đơn #{item.task.orderId.replace(/-/g, "").slice(-6).toUpperCase()}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${overdue ? "bg-red-50 text-red-700" : status.tone}`}>
          {overdue ? "Quá hạn" : status.label}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">
        {item.task.normalCount} bình thường · {item.task.issueCount} có lỗi · {item.task.missingCount} thiếu
      </p>
    </Link>
  );
}

export function StaffSchedule() {
  const user = useAuthStore((state) => state.user);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [filter, setFilter] = useState<Filter>("all");
  const [prepTasks, setPrepTasks] = useState<PreparationTaskSummary[]>([]);
  const [returns, setReturns] = useState<StaffReturnSummary[]>([]);
  const [assignees, setAssignees] = useState<RentalAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const [prep, ret, inventoryStaff, deliveryStaff] = await Promise.allSettled([
      getPreparationTasks({ pageSize: 100, signal }),
      listStaffReturns(undefined, signal),
      getRentalAssignees("STAFF_INVENTORY", signal),
      getRentalAssignees("STAFF_DELIVERY", signal),
    ]);
    if (signal?.aborted) return;
    const nextErrors: string[] = [];
    if (prep.status === "fulfilled") setPrepTasks(prep.value.items ?? []);
    else nextErrors.push("Không tải được việc chuẩn bị đơn.");
    if (ret.status === "fulfilled") setReturns(ret.value.items ?? []);
    else nextErrors.push("Không tải được lịch hoàn trả.");
    const staff = [
      ...(inventoryStaff.status === "fulfilled" ? inventoryStaff.value : []),
      ...(deliveryStaff.status === "fulfilled" ? deliveryStaff.value : []),
    ];
    setAssignees(staff);
    if (inventoryStaff.status === "rejected" && deliveryStaff.status === "rejected") {
      nextErrors.push("Không tải được danh sách nhân sự.");
    }
    setErrors(nextErrors);
    setNow(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const items = useMemo<ScheduleItem[]>(() => {
    const all: ScheduleItem[] = [
      ...prepTasks.map((task) => ({ kind: "prep" as const, at: toDate(task.deadline), task })),
      ...returns.map((task) => ({ kind: "return" as const, at: toDate(task.scheduledAt), task })),
    ];
    return all.filter((item) => {
      if (filter === "mine") return item.kind === "prep" && !!user?.id && item.task.assignee?.id === user.id;
      if (filter === "overdue") return isOverdue(item, now);
      return true;
    });
  }, [filter, now, prepTasks, returns, user?.id]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const dayItems = items
          .filter((item) => item.at && sameDay(item.at, date))
          .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
        return { date, items: dayItems };
      }),
    [items, weekStart],
  );
  const undated = items.filter((item) => !item.at && (item.kind === "return" ? item.task.status !== "COMPLETED" : !DONE_PREP.includes(item.task.status)));
  const weekItems = days.flatMap((day) => day.items);
  const myOpenTasks = prepTasks.filter(
    (task) => user?.id && task.assignee?.id === user.id && !["READY", ...DONE_PREP].includes(task.status),
  ).length;
  const overdueCount = [...prepTasks.map((task) => ({ kind: "prep" as const, at: toDate(task.deadline), task })), ...returns.map((task) => ({ kind: "return" as const, at: toDate(task.scheduledAt), task }))].filter((item) => isOverdue(item, now)).length;
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = sameDay(weekStart, startOfWeek(now));

  const stats = [
    { label: "Việc chuẩn bị trong tuần", value: weekItems.filter((item) => item.kind === "prep").length, hint: "Theo hạn chuẩn bị đơn" },
    { label: "Lịch nhận hoàn trả", value: weekItems.filter((item) => item.kind === "return").length, hint: "Theo giờ hẹn trả" },
    { label: "Việc bạn đang giữ", value: myOpenTasks, hint: "Chưa sẵn sàng giao" },
    { label: "Quá hạn", value: overdueCount, hint: "Cần xử lý ngay", danger: overdueCount > 0 },
  ];

  return (
    <main className="min-h-[calc(100vh-70px)] bg-[#F5F7F4] px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">Kho & Thiết bị › Điều phối kho vận</p>
          <h1 className="mt-1 text-2xl font-bold text-[#123f2d]">Lịch công việc & Điều phối</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tuần {dayMonth(weekStart)} – {dayMonth(weekEnd)}/{weekEnd.getFullYear()} · dữ liệu trực tiếp từ hệ thống
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setWeekStart((current) => addDays(current, -7))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            ‹ Tuần trước
          </button>
          <button type="button" disabled={isCurrentWeek} onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Tuần này
          </button>
          <button type="button" onClick={() => setWeekStart((current) => addDays(current, 7))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Tuần sau ›
          </button>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg bg-[#0d5b3a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#09482e] disabled:opacity-60">
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
          {errors.join(" ")}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className={`mt-2 text-3xl font-bold ${stat.danger ? "text-red-600" : "text-slate-900"}`}>{loading ? "…" : stat.value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              ["all", "Tất cả việc"],
              ["mine", "Việc của tôi"],
              ["overdue", "Quá hạn"],
            ] as Array<[Filter, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${filter === key ? "bg-[#0d5b3a] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {days.map((day) => {
            const today = sameDay(day.date, now);
            return (
              <div key={day.date.toISOString()} className={`rounded-2xl border bg-white p-4 ${today ? "border-emerald-600/50 shadow-sm" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${today ? "bg-[#0d5b3a] text-white" : "bg-slate-100 text-slate-700"}`}>
                      {dayMonth(day.date)}
                    </span>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {WEEKDAYS[day.date.getDay()]}
                      {today ? " (Hôm nay)" : ""}
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {day.items.filter((item) => item.kind === "prep").length} chuẩn bị · {day.items.filter((item) => item.kind === "return").length} hoàn trả
                  </span>
                </div>
                {day.items.length ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {day.items.map((item) => (
                      <ItemCard key={`${item.kind}-${item.task.id}`} item={item} now={now} myId={user?.id} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">{loading ? "Đang tải..." : "Không có việc trong ngày."}</p>
                )}
              </div>
            );
          })}

          {undated.length > 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Chưa có hạn / giờ hẹn ({undated.length})</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {undated.map((item) => (
                  <ItemCard key={`${item.kind}-${item.task.id}`} item={item} now={now} myId={user?.id} />
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Nhân sự & tải việc</h2>
              <span className="text-[11px] text-slate-500">{assignees.length} người</span>
            </div>
            {assignees.length ? (
              <ul className="mt-3 space-y-2">
                {[...assignees]
                  .sort((a, b) => b.activeTaskCount - a.activeTaskCount)
                  .map((person) => {
                    const me = person.id === user?.id;
                    return (
                      <li key={`${person.role}-${person.id}`} className={`flex items-center gap-3 rounded-xl p-2 ${me ? "bg-emerald-50" : ""}`}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                          {initialsOf(person.displayName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {person.displayName}
                            {me ? " (Bạn)" : ""}
                          </p>
                          <p className="truncate text-[10px] text-slate-500">{STAFF_ROLE_LABELS[person.role] ?? person.role}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${person.activeTaskCount > 0 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                          {person.activeTaskCount} việc
                        </span>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-400">{loading ? "Đang tải..." : "Chưa có dữ liệu nhân sự."}</p>
            )}
          </div>
          <p className="px-1 text-[11px] leading-5 text-slate-400">
            Lịch được dựng từ hạn chuẩn bị đơn và giờ hẹn hoàn trả. Hệ thống chưa có dữ liệu ca trực nên không hiển thị ca sáng / chiều.
          </p>
        </aside>
      </div>
    </main>
  );
}
