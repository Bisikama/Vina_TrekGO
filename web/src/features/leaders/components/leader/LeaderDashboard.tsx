"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useEffect } from "react";
import { useLeaderPublicTrips } from "../../hooks/useLeaderPublicTrips";


const initialCandidates = [
  {
    id: 1,
    initials: "LT",
    name: "Lê Minh Tuấn",
    age: "29 tuổi · Hà Nội",
    trip: "Tà Xùa (25/11)",
    note: "Kinh nghiệm: Đã leo Fansipan & Lảo Thẩn",
  },
  {
    id: 2,
    initials: "MA",
    name: "Trần Mai Anh",
    age: "26 tuổi · TP.HCM",
    trip: "Pu Ta Leng (02/12)",
    note: "Kinh nghiệm: Trekker mới, thể lực tốt",
  },
  {
    id: 3,
    initials: "HĐ",
    name: "Phạm Hoàng Đức",
    age: "34 tuổi · Đà Nẵng",
    trip: "Thác K5 (14/12)",
    note: "Kinh nghiệm: Level 3, kỹ năng sơ cứu",
  },
];

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
  const [candidates, setCandidates] =
    useState(initialCandidates);
  const { trips: apiTrips, isLoading } = useLeaderPublicTrips({ page: 1, pageSize: 20 });

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
      <section className="mb-6 flex flex-col gap-4 rounded-xl border border-orange-100 bg-[#fff1e7] p-5 xl:flex-row xl:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-amber-400 text-xl">
          ♢
        </span>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-bold">
              Thông báo phân quyền VFRS
            </h2>

            <span className="rounded-full bg-amber-400 px-2 py-1 text-[10px] font-bold">
              Cấp độ 1
            </span>
          </div>

          <p className="mt-1 max-w-2xl text-sm text-slate-700">
            Tài khoản Leader cần hoàn thành sát hạch thực
            địa để được cấp quyền tạo chuyến đi công khai
            và dẫn đoàn trên 15 thành viên.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-orange-200 bg-white px-4 py-2 text-xs font-semibold">
            ⇄ Giả lập cảnh báo chưa cấp quyền
          </button>

          <button className="rounded-lg bg-amber-800 px-4 py-2 text-xs font-bold text-white">
            ♜ Nâng cấp hạng VFRS Level 2
          </button>
        </div>
      </section>

      <section className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-[#0b4b31]">
            Tổng quan điều hành
            <br />
            Leader
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Chào mừng trở lại, Leader Nguyễn Hùng! Quản lý
            các chuyến đi thực địa và thành viên an toàn.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
            ▣ Quản lý thiết bị đoàn
          </button>

          <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
            ♢ Báo cáo an toàn VFRS
          </button>

          <Link
            href="/leader/create-trip"
            className="rounded-lg bg-[#125238] px-5 py-2 text-sm font-bold text-white"
          >
            ⊕ Tạo chuyến đi mới
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Chuyến đi đang hoạt động"
          value="02"
          suffix="chuyến thực địa"
          detail="● 1 đoàn trên đỉnh Tà Xùa · GPS Live"
        />

        <Metric
          title="Chuyến đi sắp tới"
          value="05"
          suffix="tour (30 ngày tới)"
          detail="Tỷ lệ lấp đầy bình quân: 84%"
          tone="amber"
        />

        <Metric
          title="Tổng số thành viên"
          value="142"
          suffix="Trekkers an toàn"
          detail="0 sự cố chấn thương / 12 tour"
          tone="dark"
        />

        <Metric
          title="Đánh giá trung bình"
          value="4.95"
          suffix="/5.0 sao"
          detail="TOP RATED MOUNTAIN LEADER"
          tone="dark"
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                ◉ Chuyến đi sắp tới
              </h2>

              <Link
                href="/leader/trips"
                className="text-xs font-semibold text-[#125238]"
              >
                Xem tất cả chuyến đi →
              </Link>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-slate-500">Đang tải danh sách chuyến đi...</div>
              ) : apiTrips.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">Chưa có chuyến đi nào.</div>
              ) : (
                apiTrips.map((trip) => {
                  const title = trip.title || "Chuyến đi chưa đặt tên";
                  const place = trip.trails?.[0]?.snapshotName || "Khu vực leo núi";
                  const dateObj = new Date(trip.startAt);
                  const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('vi-VN') : "Chưa xác định";
                  const statusMap: Record<string, string> = {
                    DRAFT: "Bản nháp",
                    OPEN: "Đang mở đăng ký",
                    FULL: "Đã chốt đoàn",
                    CLOSED: "Đã đóng",
                    IN_PROGRESS: "Đang diễn ra",
                  };
                  const statusLabel = statusMap[trip.status] || trip.status;
                  const progress = 0; // Since we don't have current participants count yet
                  // Random unsplash nature image based on id if no cover available
                  const image = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=500&auto=format&fit=crop";

                  return (
                    <article
                      key={trip.id}
                      className="grid gap-3 rounded-xl bg-[#edf2fc] p-3 md:grid-cols-[120px_1fr_auto] md:items-center"
                    >
                      <div className="relative h-24 overflow-hidden rounded-lg">
                        <Image
                          src={image}
                          alt={title}
                          fill
                          sizes="120px"
                          className="object-cover"
                        />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">
                            {title}
                          </h3>

                          <span className="rounded-full bg-emerald-200 px-2 py-1 text-[10px] font-semibold text-emerald-900">
                            {statusLabel}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-600">
                          ◷ Khởi hành: {dateStr} · ⛰{" "}
                          {place}
                        </p>

                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-[#125238]"
                              style={{
                                width: `${progress}%`,
                              }}
                            />
                          </div>

                          <span className="text-xs font-semibold">
                            0/{trip.capacity}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 md:flex-col">
                        <Link
                          href={`/leader/trips/${trip.id}`}
                          className="rounded-lg bg-[#125238] px-4 py-2 text-xs font-bold text-white text-center"
                        >
                          Quản lý đoàn
                        </Link>

                        <Link 
                          href={`/leader/create-trip/review?tripId=${trip.id}`}
                          className="rounded-lg bg-[#dce7f7] px-4 py-2 text-xs text-center font-medium"
                        >
                          Lịch trình
                        </Link>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  ▥ Hiệu quả vận hành & Thu nhập
                </h2>

                <p className="mt-1 text-xs text-slate-600">
                  Tổng thu nhập tháng 11:{" "}
                  <b className="text-[#125238]">
                    48.500.000₫
                  </b>{" "}
                  (+18% so với T10)
                </p>
              </div>

              <div className="rounded-lg bg-[#edf2fc] p-1 text-xs">
                <button className="rounded-md bg-white px-4 py-2 font-semibold">
                  Doanh thu
                </button>

                <button className="px-4 py-2">
                  Số lượt trekker
                </button>
              </div>
            </div>

            <div className="mt-5 flex h-44 items-end gap-4 border-b border-l border-slate-200 px-4">
              {[35, 48, 44, 61, 72, 88].map(
                (height, index) => (
                  <div
                    key={index}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-[#125238] to-emerald-300"
                      style={{ height: `${height}%` }}
                    />

                    <span className="text-[10px] text-slate-500">
                      T{index + 6}
                    </span>
                  </div>
                ),
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-[#edf2fc] p-3 text-xs">
                Phụ cấp dẫn đoàn
                <b className="mt-2 block text-base">
                  31.525.000₫
                </b>
              </div>

              <div className="rounded-lg bg-[#edf2fc] p-3 text-xs">
                Thưởng an toàn VFRS
                <b className="mt-2 block text-base">
                  9.700.000₫
                </b>
              </div>

              <div className="rounded-lg bg-[#edf2fc] p-3 text-xs">
                Hoa hồng thiết bị
                <b className="mt-2 block text-base">
                  7.275.000₫
                </b>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">
                ♧ Chờ duyệt thành viên
              </h2>

              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                {candidates.length} mới
              </span>
            </div>

            <p className="mb-3 rounded-lg bg-[#edf2fc] p-3 text-xs text-slate-600">
              Yêu cầu cần phản hồi trong 24 giờ trước giờ
              đóng tour.
            </p>

            <div className="space-y-3">
              {candidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className="rounded-xl bg-[#edf2fc] p-3"
                >
                  <div className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#125238] text-xs font-bold text-white">
                      {candidate.initials}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold">
                            {candidate.name}
                          </h3>

                          <p className="text-[10px] text-slate-600">
                            {candidate.age}
                          </p>
                        </div>

                        <span className="rounded bg-[#d9e5f7] px-2 py-1 text-[9px]">
                          {candidate.trip}
                        </span>
                      </div>

                      <p className="mt-3 rounded-lg bg-white p-2 text-[11px]">
                        {candidate.note}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        setCandidates((items) =>
                          items.filter(
                            (item) =>
                              item.id !== candidate.id,
                          ),
                        )
                      }
                      className="rounded-lg bg-[#125238] py-2 text-xs font-bold text-white"
                    >
                      ✓ Duyệt
                    </button>

                    <button
                      onClick={() =>
                        setCandidates((items) =>
                          items.filter(
                            (item) =>
                              item.id !== candidate.id,
                          ),
                        )
                      }
                      className="rounded-lg bg-red-50 py-2 text-xs font-semibold text-red-700"
                    >
                      Từ chối
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {!candidates.length && (
              <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
                Đã xử lý toàn bộ yêu cầu mới.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold">
              ☆ Đánh giá gần đây
            </h2>

            <div className="mt-3 space-y-3 text-xs">
              <blockquote className="rounded-lg bg-[#edf2fc] p-3">
                <b>Hoàng Nam</b>
                <span className="float-right">★★★★★</span>

                <p className="mt-2 italic text-slate-600">
                  “Anh Hùng dẫn đoàn cực kỳ có tâm và kinh
                  nghiệm xử lý sự cố tuyệt vời.”
                </p>
              </blockquote>

              <blockquote className="rounded-lg bg-[#edf2fc] p-3">
                <b>Ngọc Linh</b>
                <span className="float-right">★★★★★</span>

                <p className="mt-2 italic text-slate-600">
                  “Chuẩn bị đồ ăn chu đáo, nhịp đi rất đều
                  và hỗ trợ các bạn nữ vượt dốc.”
                </p>
              </blockquote>
            </div>
          </section>

          <section className="rounded-xl border-l-4 border-[#125238] bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">
                ▣ VFRS Radio & Bộ đàm cứu hộ
              </h2>

              <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">
                Trực 24/7
              </span>
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Kết nối tần số cứu hộ địa phương khi dẫn tour
              khu vực đèo hiểm trở.
            </p>

            <div className="mt-3 space-y-2 text-xs">
              <p className="rounded bg-emerald-50 p-2">
                Tần số UHF khẩn cấp:
                <b className="float-right">
                  446.006 MHz
                </b>
              </p>

              <p className="rounded bg-red-50 p-2">
                Trạm cứu hộ Tây Bắc:
                <b className="float-right text-red-700">
                  1800-9988
                </b>
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}