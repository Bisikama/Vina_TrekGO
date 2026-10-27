"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLeaderPublicTrips } from "../../hooks";
import { EmptyState, LoadingState, ErrorAlert } from "@/components/ui";

type TripStatus =
  | "draft"
  | "open"
  | "active"
  | "completed"
  | "cancelled";

type LeaderTrip = {
  id: string;
  name: string;
  subtitle: string;
  routeName: string;
  province: string;
  duration: string;
  startDate: string;
  endDate: string;
  registered: number;
  capacity: number;
  status: TripStatus;
  revenue: number;
  imageUrl?: string;
};

const tabs: Array<{
  value: "all" | TripStatus;
  label: string;
}> = [
    { value: "all", label: "Tất cả" },
    { value: "draft", label: "Bản nháp" },
    { value: "open", label: "Đang mở bán" },
    { value: "active", label: "Đang diễn ra" },
    { value: "completed", label: "Đã hoàn thành" },
    { value: "cancelled", label: "Đã hủy" },
  ];

const statusStyle: Record<
  TripStatus,
  {
    label: string;
    className: string;
  }
> = {
  draft: {
    label: "Bản nháp",
    className: "bg-stone-100 text-stone-700 border border-stone-200",
  },
  open: {
    label: "Đang mở bán",
    className: "bg-emerald-50 text-[#125238] border border-emerald-200",
  },
  active: {
    label: "Đang diễn ra",
    className: "bg-[#2F6B4F] text-white",
  },
  completed: {
    label: "Đã hoàn thành",
    className: "bg-blue-50 text-blue-800 border border-blue-200",
  },
  cancelled: {
    label: "Đã hủy",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function LeaderTrips() {
  const { trips: apiTrips, isLoading: isLoadingApi, error, refetch } = useLeaderPublicTrips();
  const [activeTab, setActiveTab] = useState<"all" | TripStatus>("all");
  const [search, setSearch] = useState("");

  const allTrips = useMemo<LeaderTrip[]>(() => {
    return (apiTrips || []).map((t) => {
      const statusMap: Record<string, TripStatus> = {
        DRAFT: "draft",
        OPEN: "open",
        FULL: "active",
        IN_PROGRESS: "active",
        COMPLETED: "completed",
        CANCELLED: "cancelled",
        CANCEL_PENDING: "cancelled",
      };

      const start = t.startAt ? new Date(t.startAt).toLocaleDateString("vi-VN") : "";
      const end = t.endAt ? new Date(t.endAt).toLocaleDateString("vi-VN") : "";
      const priceNum = Number(t.price) || 0;

      return {
        id: t.id,
        name: t.title,
        subtitle: `Hành trình ${t.checkpoints?.length || 0} trạm kiểm soát`,
        routeName: t.trails?.[0]?.snapshotName || t.title,
        province: "Điểm đến",
        duration: "Trekking Tour",
        startDate: start,
        endDate: end,
        registered: 0,
        capacity: t.capacity || 15,
        status: statusMap[t.status] || "open",
        revenue: priceNum * (t.capacity || 0),
        imageUrl:
          "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=80",
      };
    });
  }, [apiTrips]);

  const visibleTrips = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return allTrips.filter((trip) => {
      const matchesTab = activeTab === "all" || trip.status === activeTab;

      const matchesSearch =
        !keyword ||
        `${trip.id} ${trip.name} ${trip.routeName} ${trip.province}`
          .toLowerCase()
          .includes(keyword);

      return matchesTab && matchesSearch;
    });
  }, [activeTab, allTrips, search]);

  function getCount(value: "all" | TripStatus) {
    if (value === "all") {
      return allTrips.length;
    }

    return allTrips.filter((trip) => trip.status === value).length;
  }

  return (
    <main className="min-h-screen bg-[#F7F7F4]">
      <section className="border-b border-[#E5E7EB] bg-white px-5 py-5 lg:px-8">
        <div className="mx-auto max-w-[1540px]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#125238]">
                Quản lý vận hành
              </p>

              <h1 className="mt-1 text-2xl font-bold text-[#1F2937]">
                Chuyến đi của tôi
              </h1>

              <p className="mt-1 text-sm text-[#6B7280]">
                Theo dõi lịch khởi hành, thành viên và doanh thu của các chuyến trekking.
              </p>
            </div>

            <Link
              href="/leader/create-trip"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2F6B4F] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1F4A36]"
            >
              ＋ Tạo chuyến đi mới
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-5 lg:px-8">
        <div className="mx-auto max-w-[1540px] space-y-5">
          {error && <ErrorAlert message={error} onRetry={refetch} />}

          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
            <div className="flex overflow-x-auto border-b border-[#E5E7EB] px-2 py-2">
              {tabs.map((tab) => {
                const selected = activeTab === tab.value;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex min-w-max items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${selected
                        ? "bg-[#2F6B4F] text-white"
                        : "text-[#1F2937] hover:bg-[#F7F7F4]"
                      }`}
                  >
                    {tab.label}

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${selected
                          ? "bg-white/25 text-white"
                          : "bg-[#F7F7F4] text-[#6B7280]"
                        }`}
                    >
                      {getCount(tab.value)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-5 lg:grid-cols-[minmax(320px,1fr)_220px_235px_225px]">
            <label className="flex h-12 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F7F7F4] px-4 focus-within:border-[#2F6B4F] focus-within:bg-white transition">
              <span className="text-lg text-[#6B7280]">⌕</span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên chuyến đi, mã tour, cung đường..."
                className="w-full bg-transparent text-sm text-[#1F2937] outline-none placeholder:text-[#6B7280]"
              />
            </label>

            <select
              aria-label="Lọc cung đường"
              className="h-12 rounded-xl border border-[#E5E7EB] bg-[#F7F7F4] px-4 text-sm font-semibold text-[#1F2937] outline-none focus:border-[#2F6B4F] focus:bg-white"
              defaultValue="all"
            >
              <option value="all">Tất cả cung đường</option>
              <option value="north">Miền Bắc</option>
              <option value="central">Miền Trung</option>
              <option value="south">Miền Nam</option>
            </select>

            <select
              aria-label="Lọc thời gian"
              className="h-12 rounded-xl border border-[#E5E7EB] bg-[#F7F7F4] px-4 text-sm font-semibold text-[#1F2937] outline-none focus:border-[#2F6B4F] focus:bg-white"
              defaultValue="all"
            >
              <option value="all">Tất cả thời gian</option>
              <option value="this-month">Tháng này</option>
              <option value="next-month">Tháng sau</option>
            </select>

            <select
              aria-label="Sắp xếp chuyến đi"
              className="h-12 rounded-xl border border-[#E5E7EB] bg-[#F7F7F4] px-4 text-sm font-semibold text-[#1F2937] outline-none focus:border-[#2F6B4F] focus:bg-white"
              defaultValue="nearest"
            >
              <option value="nearest">Khởi hành gần nhất</option>
              <option value="latest">Mới tạo gần nhất</option>
              <option value="revenue">Doanh thu cao nhất</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
            <div className="hidden grid-cols-[2.1fr_1.4fr_1.2fr_1.2fr_1.05fr_1fr] bg-[#F7F7F4] border-b border-[#E5E7EB] px-6 py-4 text-xs font-bold uppercase text-[#6B7280] xl:grid">
              <div>Chuyến đi &amp; mã tour</div>
              <div>Cung đường &amp; lộ trình</div>
              <div>Lịch khởi hành</div>
              <div>Tuyển thành viên</div>
              <div>Trạng thái</div>
              <div>Doanh thu</div>
            </div>

            {isLoadingApi ? (
              <div className="p-6">
                <LoadingState label="Đang tải danh sách chuyến đi của Leader…" />
              </div>
            ) : visibleTrips.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Không tìm thấy chuyến đi"
                  description="Hãy thử từ khóa tìm kiếm hoặc bộ lọc trạng thái khác."
                />
              </div>
            ) : (
              visibleTrips.map((trip) => {
                const percentage = Math.round(
                  (trip.registered / trip.capacity) * 100
                );

                const remaining = trip.capacity - trip.registered;
                const cleanTripId = trip.id.replace(/^#/, "");

                return (
                  <article
                    key={trip.id}
                    className="grid gap-5 border-t border-[#E5E7EB] px-6 py-6 first:border-t-0 xl:grid-cols-[2.1fr_1.4fr_1.2fr_1.2fr_1.05fr_1fr] xl:items-center hover:bg-[#F7F7F4]/40 transition"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div
                        className="h-20 w-20 shrink-0 rounded-xl bg-cover bg-center border border-[#E5E7EB]"
                        style={{
                          backgroundImage: `url("${trip.imageUrl}")`,
                        }}
                      />

                      <div className="min-w-0">
                        <span className="inline-flex rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-[#125238] tabular-nums">
                          #{cleanTripId.slice(0, 8)}
                        </span>

                        <h2 className="mt-2 text-base font-bold leading-6 text-[#1F2937]">
                          {trip.name}
                        </h2>

                        <p className="mt-1 text-xs text-[#6B7280]">
                          {trip.subtitle}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="font-bold text-[#1F2937]">
                        ⌁ {trip.routeName}
                      </p>

                      <p className="mt-2 text-xs text-[#6B7280]">
                        {trip.province}
                        <span className="mx-2">·</span>
                        {trip.duration}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-[#1F2937] tabular-nums">
                        {trip.startDate}–{trip.endDate}
                      </p>

                      <p className="mt-2 text-xs text-[#6B7280]">
                        Khởi hành theo kế hoạch
                      </p>
                    </div>

                    <div className="tabular-nums">
                      <div className="flex items-center gap-4 font-bold text-[#1F2937]">
                        <span>
                          {trip.registered}/{trip.capacity}
                        </span>

                        <span>{percentage}%</span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                        <div
                          className="h-full rounded-full bg-[#2F6B4F]"
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                          }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-[#6B7280]">
                        Còn {remaining} slot trống
                      </p>
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full px-3.5 py-1.5 text-xs font-bold ${statusStyle[trip.status].className
                          }`}
                      >
                        {statusStyle[trip.status].label}
                      </span>

                      <div>
                        <Link
                          href={`/leader/trips/${cleanTripId}`}
                          className="mt-3 inline-flex items-center text-sm font-bold text-[#125238] transition hover:text-[#2F6B4F] hover:underline"
                        >
                          Quản lý đoàn →
                        </Link>
                      </div>
                    </div>

                    <div>
                      <p className="text-lg font-bold text-[#125238] tabular-nums">
                        {formatCurrency(trip.revenue)}₫
                      </p>

                      <p className="mt-2 text-xs text-[#6B7280]">
                        {trip.status === "completed"
                          ? "Doanh thu thực tế"
                          : trip.status === "cancelled"
                            ? "Chuyến đã hủy"
                            : "Doanh thu dự kiến"}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
