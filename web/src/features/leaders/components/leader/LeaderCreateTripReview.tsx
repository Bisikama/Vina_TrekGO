"use client";
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { saveCreatedLeaderTrip } from "../../data/mockLeaderTripStore";
import { TripRouteReviewMap } from "./TripRouteReviewMap";

type SelectedRoute = {
  id: string;
  code?: string;
  name: string;
  location: string;
  distance: string;
  completionRate: string;
  duration: string;
  difficulty: string;
  imageUrl: string;
};

type DraftData = {
  title?: string;
  name?: string;
  description?: string;
  visibility?: "public" | "private";
  cancellationPolicy?: "flexible" | "standard" | "strict";
  startDate?: string;
  endDate?: string;
  meetingTime?: string;
  pickupPointId?: string;
  pickupName?: string;
  place?: string;
  price?: string;
  capacity?: number;
  difficulty?: number;
};

const defaultRoute: SelectedRoute = {
  id: "TRAIL_BADEN_COTDIEN",
  code: "TRAIL_BADEN_COTDIEN",
  name: "Núi Bà Đen - Cung Đường Cột Điện",
  location: "Thành phố Tây Ninh, Tỉnh Tây Ninh",
  distance: "4.5 km",
  completionRate: "94.2%",
  duration: "1 Ngày (4 - 6 giờ)",
  difficulty: "Cấp 2 – Vừa phải",
  imageUrl:
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=700&q=80",
};

const checkpoints = [
  {
    id: 1,
    km: "Km 0.0",
    name: "Cột số 1 (Chân núi)",
    description: "Trạm tiếp tế nước, gửi xe và khởi động khai báo đoàn",
    eta: "07:30 Ngày 1",
    required: true,
  },
  {
    id: 2,
    km: "Km 3.8",
    name: "Cột số 100 (Dốc đá cao)",
    description: "Vách đá dốc cao gồ ghề, kiểm tra an toàn gậy và đo nhịp tim",
    eta: "11:00 Ngày 1",
    required: true,
    important: true,
  },
  {
    id: 3,
    km: "Km 4.5",
    name: "Đỉnh Núi Bà Đen - Chóp 986m",
    description: "Chạm chóp mốc nóc nhà Nam Bộ, chiêm bái Phật Bà & Check-in",
    eta: "11:45 Ngày 1",
    required: true,
  },
];

const checklist = [
  "Thông tin cơ bản chuẩn chỉnh",
  "Thẩm định an toàn cung đường",
  "Tọa độ tập kết chính xác",
  "Đủ tối thiểu 2 trạm kiểm soát",
  "Chứng chỉ WFA của Leader",
  "Tỷ lệ nhân sự an toàn đạt 1:8",
];

const difficultyLabels: Record<number, string> = {
  1: "Cấp 1 – Rất nhẹ",
  2: "Cấp 2 – Nhẹ nhàng",
  3: "Cấp 3 – Vừa phải",
  4: "Cấp 4 – Thử thách",
  5: "Cấp 5 – Chuyên gia",
};

export function LeaderCreateTripReview() {
  const router = useRouter();

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [published, setPublished] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<SelectedRoute>(defaultRoute);
  const [draftData, setDraftData] = useState<DraftData>({});

  useEffect(() => {
    const storedDraft = window.sessionStorage.getItem("leader-create-trip-draft");
    if (storedDraft) {
      try {
        setDraftData(JSON.parse(storedDraft));
      } catch (err) {
        console.error("Lỗi đọc draft:", err);
      }
    }

    const storedRoute = window.sessionStorage.getItem("leader-create-trip-route");
    if (storedRoute) {
      try {
        const route = JSON.parse(storedRoute) as SelectedRoute;
        if (route.id && route.name) setSelectedRoute(route);
      } catch {
        window.sessionStorage.removeItem("leader-create-trip-route");
      }
    }
  }, []);

  function saveDraft() {
    setSaved(true);
    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  const tripTitle =
    draftData.title ||
    draftData.name ||
    `Chuyến đi ${selectedRoute.name}`;

  const tripDescription =
    draftData.description ||
    `Khám phá trọn vẹn hành trình trekking cùng Leader chuyên nghiệp theo chuẩn an toàn VFRS. Cung đường ${selectedRoute.name} (${selectedRoute.distance}) với khung cảnh thiên nhiên ngoạn mục.`;

  const startDateFormatted = draftData.startDate
    ? new Date(`${draftData.startDate}T00:00:00`).toLocaleDateString("vi-VN")
    : "Chưa xác định";

  const endDateFormatted = draftData.endDate
    ? new Date(`${draftData.endDate}T00:00:00`).toLocaleDateString("vi-VN")
    : "";

  const durationDays =
    draftData.startDate && draftData.endDate
      ? Math.max(
        1,
        Math.round(
          (new Date(`${draftData.endDate}T00:00:00`).getTime() -
            new Date(`${draftData.startDate}T00:00:00`).getTime()) /
          (1000 * 60 * 60 * 24),
        ) + 1,
      )
      : 1;

  const priceFormatted = Number(
    String(draftData.price || "2850000").replace(/\D/g, ""),
  ).toLocaleString("vi-VN");

  const totalRevenue = (
    Number(String(draftData.price || "2850000").replace(/\D/g, "")) *
    (draftData.capacity || 15)
  ).toLocaleString("vi-VN");

  function publishTrip() {
    setShowPublishModal(false);
    setPublished(true);

    saveCreatedLeaderTrip({
      id: `TRK-MOCK-${Date.now().toString().slice(-6)}`,
      name: tripTitle,
      place: draftData.place || selectedRoute.location,
      date: startDateFormatted,
      fill: `0/${draftData.capacity || 15}`,
      progress: 0,
      status: "Đang mở đăng ký",
      image: selectedRoute.imageUrl,
      price: Number(String(draftData.price || "2850000").replace(/\D/g, "")) || 2850000,
      capacity: draftData.capacity || 15,
    });
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-[#125238]">
                  BƯỚC 3/3
                </span>

                <span className="text-slate-500">
                  • Hồ sơ xác thực VFRS cấp Leader PRO
                </span>
              </div>

              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                Xem lại hồ sơ & Công khai chuyến đi
              </h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="h-11 rounded-xl bg-emerald-50 px-4 text-sm font-bold text-[#125238]"
              >
                ◉ Bản kiểm duyệt
              </button>

              <button
                type="button"
                className="h-11 rounded-xl bg-[#eef3fb] px-4 text-sm font-bold text-slate-700"
              >
                ◇ Mẫu đã xuất bản
              </button>

              <button
                type="button"
                onClick={saveDraft}
                className="h-11 rounded-xl bg-[#eef3fb] px-4 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                ▣ Lưu bản nháp
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => router.push("/leader/create-trip")}
            className="rounded-xl bg-emerald-50 p-4 text-left text-[#125238]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#125238] font-bold text-white">
                ✓
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase">Bước 1</p>
                <strong className="text-sm">Thông tin cơ bản & Lịch trình</strong>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/leader/create-trip/route")}
            className="rounded-xl bg-emerald-50 p-4 text-left text-[#125238]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#125238] font-bold text-white">
                ✓
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase">Bước 2</p>
                <strong className="text-sm">Cung đường & Trạm dừng</strong>
              </div>
            </div>
          </button>

          <div className="rounded-xl bg-[#eef3fb] p-4 text-[#125238]">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2f6b4f] font-bold text-white">
                3
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase">
                  Bước 3 hiện tại
                </p>
                <strong className="text-sm">Xem lại & Công khai</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                    Mục 01 · Thông tin đoàn
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Chi tiết chuyến đi & Quy mô
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/leader/create-trip")}
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-[#125238] hover:bg-emerald-100"
                >
                  ✎ Chỉnh sửa Bước 1
                </button>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-[210px_minmax(0,1fr)]">
                <div>
                  <div
                    className="relative h-44 rounded-xl bg-cover bg-center"
                    style={{
                      backgroundImage: `linear-gradient(to top, rgba(0,0,0,.65), transparent), url("${selectedRoute.imageUrl}")`,
                    }}
                  >
                    <span className="absolute left-3 top-3 rounded bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-800">
                      {difficultyLabels[draftData.difficulty || 3] || "Cấp 3 – Vừa phải"}
                    </span>

                    <span className="absolute bottom-3 left-3 rounded bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">
                      Mã #{selectedRoute.code || selectedRoute.id}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>
                      {draftData.visibility === "private"
                        ? "Chuyến đi Riêng tư"
                        : "Công khai VFRS"}
                    </span>
                    <strong className="text-[#125238]">✓ Đạt chuẩn</strong>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-950">
                    {tripTitle}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {tripDescription}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[#eef3fb] p-4">
                      <span className="text-xs text-slate-500">
                        Thời gian thực hiện
                      </span>

                      <strong className="mt-1 block text-sm">
                        {startDateFormatted}
                        {endDateFormatted && ` – ${endDateFormatted}`}
                      </strong>

                      <span className="text-xs text-slate-500">
                        {durationDays} ngày
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#eef3fb] p-4">
                      <span className="text-xs text-slate-500">
                        Quy mô đoàn
                      </span>

                      <strong className="mt-1 block text-sm">
                        Tối đa {draftData.capacity || 15} người
                      </strong>

                      <span className="text-xs text-orange-700">
                        Slot: 0/{draftData.capacity || 15}
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#eef3fb] p-4">
                      <span className="text-xs text-slate-500">
                        Chính sách hủy
                      </span>

                      <strong className="mt-1 block text-sm">
                        {draftData.cancellationPolicy === "strict"
                          ? "Nghiêm ngặt"
                          : draftData.cancellationPolicy === "standard"
                            ? "Tiêu chuẩn"
                            : "Linh hoạt"}
                      </strong>

                      <span className="text-xs text-slate-500">
                        {draftData.cancellationPolicy === "strict"
                          ? "Hoàn trả trước 15 ngày"
                          : draftData.cancellationPolicy === "standard"
                            ? "Hoàn trả trước 14 ngày"
                            : "Hoàn trả trước 7 ngày"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-[#eef3fb] p-4 text-xs leading-5 text-slate-600">
                    <strong className="text-slate-900">⌖ Điểm tập kết:</strong>{" "}
                    {draftData.meetingTime || "07:00"} tại{" "}
                    {draftData.pickupName || selectedRoute.location}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                    Mục 02 · Bản đồ & Trắc địa
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Cung đường & Lộ trình chi tiết
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/leader/create-trip/route")}
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-[#125238] hover:bg-emerald-100"
                >
                  ✎ Chỉnh sửa Bước 2
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4">
                <div>
                  <strong className="text-sm text-slate-950">
                    ⌁ Cung đường: {selectedRoute.name}
                  </strong>

                  <p className="mt-1 text-xs text-slate-500">
                    Mã quản lý: #{selectedRoute.code || selectedRoute.id} •{" "}
                    {selectedRoute.location} • {selectedRoute.distance} •{" "}
                    {selectedRoute.duration}
                  </p>
                </div>

                <span className="rounded-full bg-[#125238] px-3 py-1.5 text-xs font-bold text-white">
                  ◉ VFRS Verified
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ["Tổng cự ly", selectedRoute.distance],
                  ["Độ dốc TB", selectedRoute.completionRate || "94.2%"],
                  ["Cao độ đỉnh", "986m"],
                  ["Dự kiến leo", selectedRoute.duration || "~5 giờ"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[#eef3fb] p-4">
                    <span className="text-xs text-slate-500">{label}</span>
                    <strong className="mt-2 block text-lg text-slate-950">
                      {value}
                    </strong>
                  </div>
                ))}
              </div>

              <TripRouteReviewMap trailCode={selectedRoute.code || selectedRoute.id || "TRAIL_BADEN_COTDIEN"} />

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Chân núi: 42m</span>
                  <span className="font-semibold text-slate-700">
                    Trắc diện cao độ tuyến Cột Điện
                  </span>
                  <span className="font-bold text-red-600">Đỉnh: 986m</span>
                </div>

                <svg
                  viewBox="0 0 800 90"
                  className="mt-2 h-20 w-full"
                  aria-label="Biểu đồ cao độ"
                >
                  <polyline
                    points="0,85 200,68 450,42 650,22 800,8"
                    fill="none"
                    stroke="#125238"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <circle cx="800" cy="8" r="6" fill="#dc2626" />
                </svg>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                    Mục 03 · An toàn & Giám sát
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    {checkpoints.length} Trạm kiểm soát an toàn
                  </h2>
                </div>

                <span className="rounded-full bg-[#125238] px-3 py-1 text-xs font-bold text-white">
                  {checkpoints.length}/{checkpoints.length} Hợp lệ
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {checkpoints.map((checkpoint) => (
                  <article
                    key={checkpoint.id}
                    className={`flex items-center gap-3 rounded-xl border p-4 ${checkpoint.important
                        ? "border-orange-300 bg-orange-50"
                        : "border-blue-100 bg-[#eef3fb]"
                      }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white ${checkpoint.important
                          ? "bg-orange-600"
                          : "bg-[#125238]"
                        }`}
                    >
                      {checkpoint.id}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-slate-950">
                          {checkpoint.km} • {checkpoint.name}
                        </strong>

                        {checkpoint.required && (
                          <span className="rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">
                            Bắt buộc
                          </span>
                        )}

                        {checkpoint.important && (
                          <span className="rounded bg-orange-200 px-2 py-1 text-[10px] font-bold text-orange-900">
                            Mốc đêm trọng yếu
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {checkpoint.description}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400">
                        ETA dự kiến
                      </span>

                      <strong className="block text-xs text-slate-900">
                        {checkpoint.eta}
                      </strong>
                    </div>

                    <span className="text-[#125238]">✓</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                    Mục 04 · Tài chính đoàn
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Cơ cấu Giá vé & Dự toán Doanh thu
                  </h2>
                </div>

                <span className="text-xs text-slate-500">Đơn vị: VNĐ</span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-[#eef3fb] p-5">
                  <span className="text-xs text-slate-500">
                    Giá vé niêm yết/khách
                  </span>

                  <strong className="mt-2 block text-2xl text-[#125238]">
                    {priceFormatted}₫
                  </strong>

                  <span className="mt-1 block text-xs text-slate-500">
                    Bao gồm trọn gói dịch vụ
                  </span>
                </div>

                <div className="rounded-xl bg-[#eef3fb] p-5">
                  <span className="text-xs text-slate-500">
                    Dự toán doanh thu ({draftData.capacity || 15} vé)
                  </span>

                  <strong className="mt-2 block text-2xl text-slate-950">
                    {totalRevenue}₫
                  </strong>

                  <span className="mt-1 block text-xs text-orange-700">
                    Tạm giữ tại VFRS Escrow
                  </span>
                </div>

                <div className="rounded-xl bg-[#125238] p-5 text-white">
                  <span className="text-xs text-emerald-100">
                    Phụ cấp Leader dự kiến
                  </span>

                  <strong className="mt-2 block text-2xl">
                    ~11.500.000₫
                  </strong>

                  <span className="mt-1 block text-xs text-emerald-100">
                    Giải ngân sau khi kết thúc chuyến
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-xl bg-[#eef3fb] p-4 text-xs sm:grid-cols-2">
                <span>✓ Bảo hiểm cứu hộ dã ngoại 600 triệu/người</span>
                <span>✓ Phương tiện di chuyển điểm đón ↔ điểm bắt đầu</span>
                <span>✓ Toàn bộ bữa ăn chính và hỗ trợ tiếp tế</span>
                <span>✓ Phí quản lý rừng và sinh môi trường</span>
              </div>
            </section>
          </div>

          <aside className="sticky top-20 hidden space-y-5 xl:block">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-[#125238]">
                  ✓
                </span>

                <div>
                  <h2 className="font-bold text-slate-950">
                    Điều kiện xuất bản
                  </h2>

                  <p className="text-xs text-slate-500">
                    Pre-publish Checklist
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-4 rounded-xl bg-emerald-50 p-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#125238] text-sm font-bold text-[#125238]">
                  100%
                </div>

                <div>
                  <strong className="text-sm text-slate-950">
                    Hồ sơ hoàn tất xuất sắc
                  </strong>

                  <p className="mt-1 text-xs text-slate-500">
                    Đạt toàn bộ tiêu chuẩn an toàn.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {checklist.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm">
                    <span className="text-[#125238]">✓</span>
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl bg-emerald-100 p-4 text-center text-sm font-bold text-[#125238]">
                ✓ Đủ điều kiện kích hoạt mở bán tự động
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <button
                type="button"
                disabled={published}
                onClick={() => setShowPublishModal(true)}
                className="h-12 w-full rounded-xl bg-[#125238] px-5 text-sm font-bold text-white shadow-md hover:bg-[#2f6b4f] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {published
                  ? "✓ Chuyến đi đã công khai"
                  : "Công khai chuyến đi ngay"}
              </button>

              <button
                type="button"
                onClick={saveDraft}
                className="mt-3 h-11 w-full rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                ▣ Lưu bản nháp để duyệt sau
              </button>

              <button
                type="button"
                onClick={() => router.push("/leader/create-trip/route")}
                className="mt-3 h-11 w-full text-sm font-semibold text-slate-500 hover:text-[#125238]"
              >
                ← Quay lại Bước 2
              </button>
            </section>
          </aside>
        </div>

        <footer className="mt-6 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center xl:hidden">
          <button
            type="button"
            onClick={() => router.push("/leader/create-trip/route")}
            className="h-11 rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            ← Quay lại Bước 2
          </button>

          <button
            type="button"
            disabled={published}
            onClick={() => setShowPublishModal(true)}
            className="h-11 rounded-xl bg-[#125238] px-6 text-sm font-bold text-white disabled:bg-slate-400"
          >
            {published ? "✓ Đã công khai" : "Công khai chuyến đi"}
          </button>
        </footer>
      </div>

      {saved && (
        <div className="fixed bottom-6 right-6 z-[80] rounded-xl bg-[#125238] px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          ✓ Đã lưu bản nháp chuyến đi.
        </div>
      )}

      {published && (
        <div className="fixed bottom-6 right-6 z-[80] max-w-sm rounded-xl bg-[#125238] px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          ✓ Công khai chuyến đi thành công. Tour đã được thêm vào danh sách mở
          bán.
        </div>
      )}

      {showPublishModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mt-4 text-xl font-bold text-slate-950">
              Công khai chuyến đi ngay?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sau khi công khai, chuyến đi sẽ xuất hiện trên trang khám phá và
              Trekker có thể bắt đầu đăng ký.
            </p>

            <div className="mt-5 rounded-xl bg-emerald-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Mã chuyến</span>
                <strong>#{selectedRoute.code || selectedRoute.id}</strong>
              </div>

              <div className="mt-3 flex justify-between text-sm">
                <span className="text-slate-500">Trạng thái sau xuất bản</span>
                <strong className="text-[#125238]">Đang mở bán</strong>
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-600">
              <input
                type="checkbox"
                defaultChecked
                className="mt-1 h-4 w-4 accent-[#125238]"
              />
              Tôi xác nhận thông tin, cung đường và điều kiện an toàn của
              chuyến đi là chính xác.
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Kiểm tra lại
              </button>

              <button
                type="button"
                onClick={publishTrip}
                className="h-11 rounded-xl bg-[#125238] px-5 text-sm font-bold text-white hover:bg-[#2f6b4f]"
              >
                Xác nhận công khai
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}