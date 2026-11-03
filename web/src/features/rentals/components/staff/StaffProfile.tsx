"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "@/features/auth";
import { apiClient } from "@/lib/axios";
import { getInventoryLocations } from "@/features/rentals/services/staff-inventory.api";
import {
  getUnreadNotificationCount,
  initialsOf,
  STAFF_ROLE_LABELS,
} from "@/features/rentals/services/staff-overview.api";
import {
  getPreparationTasks,
  type PreparationTaskSummary,
} from "@/features/rentals/services/staff-preparation.api";
import type { InventoryLocation } from "@/features/rentals/types/rental";

// Hồ sơ nhân viên dựng từ api thật: GET /auth/me, /inventory/tasks, /staff/inventory-locations,
// /notifications/unread-count. Backend chưa có api sửa hồ sơ nên trang chỉ để xem.

type MeProfile = {
  id?: string;
  email?: string;
  fullName?: string | null;
  phone?: string | null;
  role?: string;
  status?: string;
  createdAt?: string;
};

const PREP_LABELS: Record<string, string> = {
  OPEN: "Chờ nhận việc",
  PICKING: "Đang lấy đồ",
  CONDITION_CAPTURED: "Đã chụp tình trạng",
  PACKED: "Đã đóng gói",
  READY: "Sẵn sàng giao",
  TRANSFERRED: "Đã bàn giao",
  BLOCKED: "Bị chặn",
  CANCELLED: "Đã huỷ",
};

function unwrap<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function StaffProfile() {
  const user = useAuthStore((state) => state.user);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [tasks, setTasks] = useState<PreparationTaskSummary[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [unread, setUnread] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    Promise.allSettled([
      apiClient.get<unknown>("/api/v1/auth/me", { signal }).then((response) => {
        const data = unwrap<Record<string, unknown>>(response.data);
        return ((data && typeof data.user === "object" ? data.user : data) ?? {}) as MeProfile;
      }),
      getPreparationTasks({ pageSize: 100, signal }),
      getInventoryLocations({ pageSize: 20, signal }),
      getUnreadNotificationCount(signal),
    ]).then(([profile, prep, loc, count]) => {
      if (signal.aborted) return;
      if (profile.status === "fulfilled") setMe(profile.value);
      if (prep.status === "fulfilled") setTasks(prep.value.items ?? []);
      if (loc.status === "fulfilled") setLocations(loc.value.items ?? []);
      if (count.status === "fulfilled") setUnread(count.value);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const name = me?.fullName || user?.fullName || (me?.email || user?.email || "").split("@")[0] || "Nhân viên";
  const email = me?.email || user?.email || "—";
  const role = me?.role || user?.role || "";
  const myId = me?.id || user?.id;

  const myTasks = useMemo(
    () => tasks.filter((task) => myId && task.assignee?.id === myId),
    [myId, tasks],
  );
  const openTasks = myTasks.filter((task) => !["READY", "TRANSFERRED", "CANCELLED"].includes(task.status));
  const doneTasks = myTasks.filter((task) => ["READY", "TRANSFERRED"].includes(task.status));
  const unassigned = tasks.filter((task) => !task.assignee && task.status === "OPEN").length;

  const info: Array<[string, string]> = [
    ["Email", email],
    ["Số điện thoại", me?.phone || "Chưa cập nhật"],
    ["Vai trò", STAFF_ROLE_LABELS[role] ?? (role || "—")],
    ["Trạng thái tài khoản", me?.status === "ACTIVE" ? "Đang hoạt động" : me?.status || "—"],
    ["Ngày tạo tài khoản", formatDate(me?.createdAt)],
  ];

  return (
    <main className="min-h-[calc(100vh-70px)] bg-[#F5F7F4] px-6 py-6">
      <section className="rounded-2xl bg-gradient-to-br from-[#123f2d] to-[#1f6b4b] p-6 text-white">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-xl font-semibold">
            {initialsOf(name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Hồ sơ cá nhân</p>
            <h1 className="mt-1 text-2xl font-bold">{name}</h1>
            <p className="mt-1 text-sm text-white/75">
              {STAFF_ROLE_LABELS[role] ?? role}
              {locations[0] ? ` · ${locations[0].name}` : ""}
            </p>
          </div>
          {unread !== null && (
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
              {unread} thông báo chưa đọc
            </span>
          )}
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Việc bạn đang giữ", value: openTasks.length, hint: "Chưa sẵn sàng giao" },
          { label: "Việc bạn đã xong", value: doneTasks.length, hint: "Sẵn sàng giao hoặc đã bàn giao" },
          { label: "Việc chưa có người nhận", value: unassigned, hint: "Trong hàng đợi chung" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? "…" : stat.value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Thông tin tài khoản</h2>
          <dl className="mt-4 divide-y divide-slate-100">
            {info.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-right font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[11px] leading-5 text-slate-400">
            Muốn thay đổi thông tin tài khoản, vui lòng liên hệ quản trị viên.
          </p>

          <h2 className="mt-6 text-base font-semibold text-slate-900">Kho đang hoạt động</h2>
          {locations.length ? (
            <ul className="mt-3 space-y-2">
              {locations.map((location) => (
                <li key={location.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {location.name} <span className="font-mono text-[11px] font-normal text-slate-500">{location.code}</span>
                  </p>
                  {location.address && <p className="mt-0.5 text-xs text-slate-500">{location.address}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-400">{loading ? "Đang tải..." : "Chưa có kho nào."}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Việc chuẩn bị của tôi</h2>
            <Link href="/staff/work-queue" className="text-xs font-semibold text-emerald-700 hover:underline">
              Mở hàng đợi
            </Link>
          </div>
          {myTasks.length ? (
            <ul className="mt-3 space-y-2">
              {myTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/staff/orders/${encodeURIComponent(task.id)}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:bg-emerald-50/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">#{task.orderCode}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Hạn {formatDate(task.deadline)} · {task.progress.picked}/{task.progress.required} món
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {PREP_LABELS[task.status] ?? task.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-400">{loading ? "Đang tải..." : "Bạn chưa nhận việc chuẩn bị nào."}</p>
          )}
        </section>
      </div>
    </main>
  );
}
