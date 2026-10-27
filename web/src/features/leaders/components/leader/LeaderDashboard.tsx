"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useLeaderPublicTrips } from "../../hooks/useLeaderPublicTrips";
import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/features/auth";

function Metric({
  title,
  value,
  suffix,
  detail,
  tone = "green",
}: {
  title: string;
  value: string;
  suffix?: string;
  detail: string;
  tone?: "green" | "amber" | "dark";
}) {
  const color =
    tone === "amber"
      ? "text-amber-700"
      : tone === "dark"
        ? "text-slate-950"
        : "text-[#125238]";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,.05)]">
      <p className="text-xs font-semibold text-slate-700">
        {title}
      </p>

      <div className="mt-4 flex items-end gap-2">
        <strong
          className={`text-4xl tabular-nums ${color}`}
        >
          {value}
        </strong>

        {suffix && (
          <span className="pb-1 text-xs text-slate-600">
            {suffix}
          </span>
        )}
      </div>

      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
        {detail}
      </p>
    </article>
  );
}

export function LeaderDashboard() {
  const user = useAuthStore((state) => state.user);
  const displayName = user?.fullName || user?.email?.split("@")[0] || "Leader";

  const { trips: apiTrips, isLoading } = useLeaderPublicTrips({ page: 1, pageSize: 20 });
  const [slotsMap, setSlotsMap] = useState<Record<string, { capacity: number; remainingSlots: number }>>({});

  useEffect(() => {
    async function loadSlots() {
      try {
        const res = await apiClient.get<any>("/api/v1/trips", { params: { pageSize: 50 } });
        const items = res.data?.items || res.data || [];
        const map: Record<string, { capacity: number; remainingSlots: number }> = {};
        for (const item of items) {
          if (item?.id) {
            map[item.id] = {
              capacity: Number(item.capacity) || 15,
              remainingSlots: Number(item.remainingSlots !== undefined ? item.remainingSlots : item.capacity),
            };
          }
        }
        setSlotsMap(map);
      } catch (err) {
        console.error("Lỗi khi tải thông tin số chỗ chuyến đi:", err);
      }
    }
    loadSlots();
  }, []);

  const stats = useMemo(() => {
    const activeTrips = apiTrips.filter((t) => t.status === "IN_PROGRESS");
    const upcomingTrips = apiTrips.filter((t) => t.status === "OPEN" || t.status === "FULL");
    const totalTrekkers = apiTrips.reduce((acc, t) => {
      const slotInfo = slotsMap[t.id];
      const cap = t.capacity || slotInfo?.capacity || 15;
      const rem = slotInfo !== undefined ? slotInfo.remainingSlots : cap;
      return acc + Math.max(0, cap - rem);
    }, 0);

    return {
      activeCount: activeTrips.length,
      upcomingCount: upcomingTrips.length,
      totalTrekkers,
      totalTrips: apiTrips.length,
    };
  }, [apiTrips, slotsMap]);

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
      <section className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-[#0b4b31]">
            Tổng quan điều hành Leader
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Chào mừng trở lại, Leader {displayName}! Quản lý các chuyến đi thực địa và thành viên an toàn.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/leader/trips"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            ♙ Chuyến đi của tôi
          </Link>

          <Link
            href="/leader/create-trip"
            className="rounded-lg bg-[#125238] px-5 py-2 text-sm font-bold text-white hover:bg-[#0e3f2b] transition"
          >
            ⊕ Tạo chuyến đi mới
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Chuyến đi đang hoạt động"
          value={stats.activeCount.toString().padStart(2, "0")}
          suffix="chuyến thực địa"
          detail={
            stats.activeCount > 0
              ? `● ${stats.activeCount} đoàn đang trên cung đường`
              : "Hiện không có chuyến đang diễn ra"
          }
        />

        <Metric
          title="Chuyến đi sắp tới"
          value={stats.upcomingCount.toString().padStart(2, "0")}
          suffix="tour sắp tới"
          detail={`${stats.upcomingCount} chuyến đã lên lịch`}
          tone="amber"
        />

        <Metric
          title="Tổng số thành viên"
          value={stats.totalTrekkers.toString()}
          suffix="Trekkers"
          detail={`${stats.totalTrekkers} thành viên đã đăng ký tham gia`}
          tone="dark"
        />

        <Metric
          title="Tổng số chuyến đi"
          value={stats.totalTrips.toString().padStart(2, "0")}
          suffix="chuyến đi"
          detail={`Tổng cộng ${stats.totalTrips} chuyến đi đã tạo`}
          tone="dark"
        />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,.05)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              ◉ Danh sách chuyến đi gần đây
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý các chuyến đi do bạn phụ trách dẫn đoàn
            </p>
          </div>

          <Link
            href="/leader/trips"
            className="text-xs font-semibold text-[#125238] hover:underline"
          >
            Xem tất cả chuyến đi →
          </Link>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Đang tải danh sách chuyến đi...
            </div>
          ) : apiTrips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
              <p className="text-sm font-medium text-slate-600">
                Bạn chưa có chuyến đi nào.
              </p>
              <Link
                href="/leader/create-trip"
                className="mt-3 inline-block rounded-lg bg-[#125238] px-4 py-2 text-xs font-bold text-white hover:bg-[#0e3f2b] transition"
              >
                ⊕ Tạo chuyến đi mới ngay
              </Link>
            </div>
          ) : (
            apiTrips.map((trip) => {
              const title = trip.title || "Chuyến đi chưa đặt tên";
              const place = trip.trails?.[0]?.snapshotName || "Khu vực leo núi";
              const dateObj = new Date(trip.startAt);
              const dateStr = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString("vi-VN")
                : "Chưa xác định";
              const statusMap: Record<string, string> = {
                DRAFT: "Bản nháp",
                OPEN: "Đang mở đăng ký",
                FULL: "Đã chốt đoàn",
                CLOSED: "Đã đóng",
                IN_PROGRESS: "Đang diễn ra",
                COMPLETED: "Đã hoàn thành",
                CANCELLED: "Đã hủy",
              };
              const isNotOpenYet =
                trip.status === "OPEN" &&
                Boolean(trip.registrationOpenAt) &&
                new Date(trip.registrationOpenAt!).getTime() > Date.now();
              const statusLabel = isNotOpenYet
                ? "Chưa tới thời gian mở form"
                : statusMap[trip.status] || trip.status;
              const slotInfo = slotsMap[trip.id];
              const totalCap = trip.capacity || slotInfo?.capacity || 15;
              const rem =
                slotInfo !== undefined ? slotInfo.remainingSlots : totalCap;
              const occupied = Math.max(0, totalCap - rem);
              const progress =
                totalCap > 0
                  ? Math.min(100, Math.round((occupied / totalCap) * 100))
                  : 0;
              const image =
                "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=500&auto=format&fit=crop";

              return (
                <article
                  key={trip.id}
                  className="grid gap-4 rounded-xl bg-[#edf2fc] p-4 md:grid-cols-[140px_1fr_auto] md:items-center"
                >
                  <div className="relative h-24 overflow-hidden rounded-lg">
                    <Image
                      src={image}
                      alt={title}
                      fill
                      sizes="140px"
                      className="object-cover"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">
                        {title}
                      </h3>

                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-[#125238]">
                        {statusLabel}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-600">
                      ◷ Khởi hành: <b>{dateStr}</b> · ⛰ <b>{place}</b>
                    </p>

                    <div className="mt-3 flex items-center gap-3 max-w-md">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-[#125238] transition-all"
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </div>

                      <span className="text-xs font-semibold text-slate-700">
                        {occupied}/{totalCap} thành viên
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:flex-col shrink-0">
                    {trip.status === "DRAFT" ? (
                      <>
                        <Link
                          href={`/leader/create-trip?tripId=${trip.id}`}
                          className="rounded-lg bg-[#125238] px-4 py-2 text-xs font-bold text-white text-center hover:bg-[#0e3f2b] transition"
                        >
                          Tiếp tục chỉnh nháp
                        </Link>

                        <Link
                          href={`/leader/create-trip/review?tripId=${trip.id}`}
                          className="rounded-lg bg-white border border-slate-200 px-4 py-2 text-xs text-center font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Xem lại &amp; Xuất bản
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`/leader/trips/${trip.id}`}
                          className="rounded-lg bg-[#125238] px-4 py-2 text-xs font-bold text-white text-center hover:bg-[#0e3f2b] transition"
                        >
                          Quản lý đoàn
                        </Link>

                        <Link
                          href={`/leader/create-trip/review?tripId=${trip.id}`}
                          className="rounded-lg bg-white border border-slate-200 px-4 py-2 text-xs text-center font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Lịch trình
                        </Link>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
