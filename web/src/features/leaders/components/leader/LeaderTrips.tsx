"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
  imageUrl: string;
};

const trips: LeaderTrip[] = [
  {
    id: "TRK-TX-2411",
    name: "Chinh phục Sống Lưng Khủng Long",
    subtitle: "Tour ghép tiêu chuẩn VFRS",
    routeName: "Sống Lưng Khủng Long",
    province: "Sơn La",
    duration: "2N1Đ",
    startDate: "23/11",
    endDate: "24/11/2024",
    registered: 15,
    capacity: 15,
    status: "active",
    revenue: 34_500_000,
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "TRK-PTL-1202",
    name: "Pu Ta Leng – Rừng Rêu Cổ Thụ",
    subtitle: "Chuyến leo kỹ thuật cao",
    routeName: "Rừng Rêu Pu Ta Leng",
    province: "Lai Châu",
    duration: "3N2Đ",
    startDate: "02/12",
    endDate: "04/12/2024",
    registered: 11,
    capacity: 12,
    status: "open",
    revenue: 46_200_000,
    imageUrl:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "TRK-K5-1214",
    name: "Băng Rừng – Chinh phục Thác K5",
    subtitle: "Trekking trải nghiệm thiên nhiên",
    routeName: "Tuyến Thác K5 – Kon Chư Răng",
    province: "Gia Lai",
    duration: "2N1Đ",
    startDate: "14/12",
    endDate: "15/12/2024",
    registered: 6,
    capacity: 15,
    status: "open",
    revenue: 16_800_000,
    imageUrl:
      "https://images.unsplash.com/photo-1443632864897-14973fa006cf?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "DRAFT-LT-0105",
    name: "Tà Năng – Phan Dũng mùa cỏ cháy",
    subtitle: "Bản nháp chưa công khai",
    routeName: "Tà Năng – Phan Dũng",
    province: "Lâm Đồng",
    duration: "3N2Đ",
    startDate: "05/01",
    endDate: "07/01/2025",
    registered: 0,
    capacity: 15,
    status: "draft",
    revenue: 0,
    imageUrl:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "TRK-FSP-1018",
    name: "Fansipan – Chạm tay nóc nhà Đông Dương",
    subtitle: "Chuyến đi đã hoàn thành",
    routeName: "Fansipan",
    province: "Lào Cai",
    duration: "2N1Đ",
    startDate: "18/10",
    endDate: "19/10/2024",
    registered: 14,
    capacity: 15,
    status: "completed",
    revenue: 39_200_000,
    imageUrl:
      "https://images.unsplash.com/photo-1464278533981-50106e6176b1?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "TRK-BD-0912",
    name: "Bidoup – Núi Bà",
    subtitle: "Chuyến đi đã hủy",
    routeName: "Bidoup – Núi Bà",
    province: "Lâm Đồng",
    duration: "2N1Đ",
    startDate: "12/09",
    endDate: "13/09/2024",
    registered: 8,
    capacity: 15,
    status: "cancelled",
    revenue: 0,
    imageUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=300&q=80",
  },
];

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
    className: "bg-slate-200 text-slate-700",
  },
  open: {
    label: "Đang mở bán",
    className: "bg-emerald-100 text-emerald-800",
  },
  active: {
    label: "Đang diễn ra",
    className: "bg-[#125238] text-white",
  },
  completed: {
    label: "Đã hoàn thành",
    className: "bg-blue-100 text-blue-800",
  },
  cancelled: {
    label: "Đã hủy",
    className: "bg-red-100 text-red-700",
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function LeaderTrips() {
  const [activeTab, setActiveTab] = useState<
    "all" | TripStatus
  >("all");

  const [search, setSearch] = useState("");

  const visibleTrips = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return trips.filter((trip) => {
      const matchesTab =
        activeTab === "all" || trip.status === activeTab;

      const matchesSearch =
        !keyword ||
        `${trip.id} ${trip.name} ${trip.routeName} ${trip.province}`
          .toLowerCase()
          .includes(keyword);

      return matchesTab && matchesSearch;
    });
  }, [activeTab, search]);

  function getCount(value: "all" | TripStatus) {
    if (value === "all") {
      return trips.length;
    }

    return trips.filter((trip) => trip.status === value).length;
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <section className="border-b border-slate-200 bg-white px-5 py-5 lg:px-8">
        <div className="mx-auto max-w-[1540px]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6b4f]">
                Quản lý vận hành
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Chuyến đi của tôi
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Theo dõi lịch khởi hành, thành viên và doanh thu
                của các chuyến trekking.
              </p>
            </div>

            <Link
              href="/leader/public-trips"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#e76f51] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#d85f43]"
            >
              ＋ Tạo chuyến đi mới
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-5 lg:px-8">
        <div className="mx-auto max-w-[1540px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex overflow-x-auto border-b border-slate-200 px-2 py-2">
              {tabs.map((tab) => {
                const selected = activeTab === tab.value;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex min-w-max items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
                      selected
                        ? "bg-[#246b4b] text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        selected
                          ? "bg-white/25 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {getCount(tab.value)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 lg:grid-cols-[minmax(320px,1fr)_220px_235px_225px]">
            <label className="flex h-14 items-center gap-3 rounded-xl bg-[#eef3fb] px-4">
              <span className="text-lg text-slate-700">⌕</span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên chuyến đi, mã tour, cung đường..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>

            <select
              aria-label="Lọc cung đường"
              className="h-14 rounded-xl border-0 bg-[#eef3fb] px-4 text-sm font-semibold text-slate-900 outline-none"
              defaultValue="all"
            >
              <option value="all">Tất cả cung đường</option>
              <option value="north">Miền Bắc</option>
              <option value="central">Miền Trung</option>
              <option value="south">Miền Nam</option>
            </select>

            <select
              aria-label="Lọc thời gian"
              className="h-14 rounded-xl border-0 bg-[#eef3fb] px-4 text-sm font-semibold text-slate-900 outline-none"
              defaultValue="november"
            >
              <option value="november">Tháng này (11/2024)</option>
              <option value="december">Tháng sau (12/2024)</option>
              <option value="all">Tất cả thời gian</option>
            </select>

            <select
              aria-label="Sắp xếp chuyến đi"
              className="h-14 rounded-xl border-0 bg-[#eef3fb] px-4 text-sm font-semibold text-slate-900 outline-none"
              defaultValue="nearest"
            >
              <option value="nearest">Khởi hành gần nhất</option>
              <option value="latest">Mới tạo gần nhất</option>
              <option value="revenue">Doanh thu cao nhất</option>
            </select>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="hidden grid-cols-[2.1fr_1.4fr_1.2fr_1.2fr_1.05fr_1fr] bg-[#eaf0fa] px-6 py-5 text-xs font-bold uppercase text-slate-800 xl:grid">
              <div>Chuyến đi &amp; mã tour</div>
              <div>Cung đường &amp; lộ trình</div>
              <div>Lịch khởi hành</div>
              <div>Tuyển thành viên</div>
              <div>Trạng thái</div>
              <div>Doanh thu</div>
            </div>

            {visibleTrips.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="text-4xl">⌕</div>

                <h2 className="mt-3 font-bold text-slate-900">
                  Không tìm thấy chuyến đi
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Hãy thử từ khóa hoặc trạng thái khác.
                </p>
              </div>
            ) : (
              visibleTrips.map((trip) => {
                const percentage = Math.round(
                  (trip.registered / trip.capacity) * 100,
                );

                const remaining =
                  trip.capacity - trip.registered;

                const cleanTripId = trip.id.replace(/^#/, "");

                return (
                  <article
                    key={trip.id}
                    className="grid gap-5 border-t border-slate-200 px-6 py-6 first:border-t-0 xl:grid-cols-[2.1fr_1.4fr_1.2fr_1.2fr_1.05fr_1fr] xl:items-center"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div
                        className="h-20 w-20 shrink-0 rounded-xl bg-cover bg-center"
                        style={{
                          backgroundImage: `url("${trip.imageUrl}")`,
                        }}
                      />

                      <div className="min-w-0">
                        <span className="inline-flex rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-[#125238]">
                          #{cleanTripId}
                        </span>

                        <h2 className="mt-2 text-base font-bold leading-6 text-slate-950">
                          {trip.name}
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                          {trip.subtitle}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="font-bold text-slate-950">
                        ⌁ {trip.routeName}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        {trip.province}
                        <span className="mx-2">·</span>
                        {trip.duration}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-950">
                        {trip.startDate}–{trip.endDate}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Khởi hành theo kế hoạch
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-4 font-bold text-slate-950">
                        <span>
                          {trip.registered}/{trip.capacity}
                        </span>

                        <span>{percentage}%</span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-[#125238]"
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                          }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        Còn {remaining} slot trống
                      </p>
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full px-4 py-2 text-xs font-bold ${
                          statusStyle[trip.status].className
                        }`}
                      >
                        {statusStyle[trip.status].label}
                      </span>

                      <div>
                        <Link
                          href={`/leader/trips/${cleanTripId}`}
                          className="mt-3 inline-flex items-center font-semibold text-[#125238] transition hover:text-[#e76f51]"
                        >
                          Quản lý đoàn →
                        </Link>
                      </div>
                    </div>

                    <div>
                      <p className="text-lg font-bold text-slate-950">
                        {formatCurrency(trip.revenue)}₫
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
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