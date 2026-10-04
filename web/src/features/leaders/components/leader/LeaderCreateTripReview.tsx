"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { saveCreatedLeaderTrip } from "../../data/mockLeaderTripStore";

type SelectedRoute = {
  id: string;
  name: string;
  location: string;
  distance: string;
  completionRate: string;
  duration: string;
  difficulty: string;
  imageUrl: string;
};

const defaultRoute: SelectedRoute = {
  id: "VFRS-TR-042",
  name: "Sống Lưng Khủng Long Tà Xùa",
  location: "Huyện Bắc Yên, Tỉnh Sơn La",
  distance: "14.5 km",
  completionRate: "16.8%",
  duration: "2N1Đ",
  difficulty: "Cấp 3 – Vừa phải",
  imageUrl:
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=80",
};

const checkpoints = [
  {
    id: 1,
    km: "Km 0.0",
    name: "Chân bản Công Tra",
    description:
      "Trạm kiểm lâm khai báo đoàn & đối soát bảo hiểm VFRS",
    eta: "08:30 Ngày 1",
    required: true,
  },
  {
    id: 2,
    km: "Km 4.2",
    name: "Rừng trúc & Mỏm Đầu Rùa",
    description:
      "Trạm tiếp nước sạch, điểm dừng ăn trưa tăng cường năng lượng",
    eta: "11:30 Ngày 1",
    required: true,
  },
  {
    id: 3,
    km: "Km 8.5",
    name: "Lán nghỉ Sống Lưng Khủng Long",
    description:
      "Hạ trại nghỉ đêm, đo SpO2 tim mạch và kiểm tra y tế",
    eta: "16:00 Ngày 1",
    required: false,
    important: true,
  },
  {
    id: 4,
    km: "Km 12.0",
    name: "Đỉnh Gió Tà Xùa",
    description:
      "Điểm ngắm bình minh biển mây & đối soát số lượng thành viên",
    eta: "06:15 Ngày 2",
    required: true,
  },
  {
    id: 5,
    km: "Km 14.5",
    name: "Bản Háng Đồng",
    description:
      "Kết thúc cung đi bộ, xe trung chuyển đón đoàn về thị trấn Bắc Yên",
    eta: "13:30 Ngày 2",
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

export function LeaderCreateTripReview() {
  const router = useRouter();

  const [showPublishModal, setShowPublishModal] =
    useState(false);

  const [published, setPublished] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedRoute, setSelectedRoute] =
    useState<SelectedRoute>(defaultRoute);

  useEffect(() => {
    const storedRoute = window.sessionStorage.getItem(
      "leader-create-trip-route",
    );
    if (!storedRoute) return;
    try {
      const route = JSON.parse(storedRoute) as SelectedRoute;
      if (route.id && route.name) setSelectedRoute(route);
    } catch {
      window.sessionStorage.removeItem("leader-create-trip-route");
    }
  }, []);

  function saveDraft() {
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  function publishTrip() {
    setShowPublishModal(false);
    setPublished(true);
    const draft = window.sessionStorage.getItem(
      "leader-create-trip-draft",
    );
    const draftData = draft
      ? (JSON.parse(draft) as {
          name?: string;
          startDate?: string;
          place?: string;
          price?: string;
          capacity?: number;
        })
      : {};
    saveCreatedLeaderTrip({
      id: `TRK-MOCK-${Date.now().toString().slice(-6)}`,
      name: draftData.name || selectedRoute.name,
      place: draftData.place || selectedRoute.location,
      date: draftData.startDate
        ? new Date(`${draftData.startDate}T00:00:00`).toLocaleDateString(
            "vi-VN",
          )
        : "Chưa xác định",
      fill: `0/${draftData.capacity || 15}`,
      progress: 0,
      status: "Đang mở đăng ký",
      image: selectedRoute.imageUrl,
      price: Number(draftData.price?.replace(/\D/g, "")) || 2850000,
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
                className="h-11 rounded-xl bg-[#eef3fb] px-4 text-sm font-bold text-slate-700"
              >
                ▣ Lưu bản nháp
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              router.push("/leader/create-trip")
            }
            className="rounded-xl bg-emerald-50 p-4 text-left text-[#125238]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#125238] font-bold text-white">
                ✓
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase">
                  Bước 1
                </p>
                <strong className="text-sm">
                  Thông tin cơ bản & Lịch trình
                </strong>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push("/leader/create-trip/route")
            }
            className="rounded-xl bg-emerald-50 p-4 text-left text-[#125238]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#125238] font-bold text-white">
                ✓
              </span>

              <div>
                <p className="text-[10px] font-bold uppercase">
                  Bước 2
                </p>
                <strong className="text-sm">
                  Cung đường & Trạm dừng
                </strong>
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
                <strong className="text-sm">
                  Xem lại & Công khai
                </strong>
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
                  onClick={() =>
                    router.push("/leader/create-trip")
                  }
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-[#125238]"
                >
                  ✎ Chỉnh sửa Bước 1
                </button>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-[210px_minmax(0,1fr)]">
                <div>
                  <div
                    className="relative h-44 rounded-xl bg-cover bg-center"
                    style={{
                      backgroundImage:
                        'linear-gradient(to top, rgba(0,0,0,.65), transparent), url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=80")',
                    }}
                  >
                    <span className="absolute left-3 top-3 rounded bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-800">
                      Cấp 3 – Vừa phải
                    </span>

                    <span className="absolute bottom-3 left-3 rounded bg-slate-950/70 px-2 py-1 text-[10px] font-bold text-white">
                      Mã #TX-2412
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>Công khai VFRS</span>
                    <strong className="text-[#125238]">
                      ✓ Đạt chuẩn
                    </strong>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-950">
                    {selectedRoute.name} – Săn Biển Mây Đại Ngàn (
                    {selectedRoute.duration})
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Hành trình đi ngoài vượt sống núi Háng
                    Đồng với độ cao 2.650m, trải nghiệm cắm
                    trại đêm giữa sương mù Tây Bắc.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[#eef3fb] p-4">
                      <span className="text-xs text-slate-500">
                        Thời gian thực hiện
                      </span>

                      <strong className="mt-1 block text-sm">
                        12/05 – 14/05/2024
                      </strong>

                      <span className="text-xs text-slate-500">
                        3 ngày 2 đêm
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#eef3fb] p-4">
                      <span className="text-xs text-slate-500">
                        Quy mô đoàn
                      </span>

                      <strong className="mt-1 block text-sm">
                        Tối đa 15 người
                      </strong>

                      <span className="text-xs text-orange-700">
                        Slot: 0/15
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#eef3fb] p-4">
                      <span className="text-xs text-slate-500">
                        Chính sách hủy
                      </span>

                      <strong className="mt-1 block text-sm">
                        Linh hoạt
                      </strong>

                      <span className="text-xs text-slate-500">
                        Hoàn trả trước 7 ngày
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-[#eef3fb] p-4 text-xs leading-5 text-slate-600">
                    <strong className="text-slate-900">
                      ⌖ Điểm tập kết:
                    </strong>{" "}
                    20:30 tại Bến xe Mỹ Đình, Cổng số 2, Nam
                    Từ Liêm, Hà Nội.
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
                  onClick={() =>
                    router.push(
                      "/leader/create-trip/route",
                    )
                  }
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-[#125238]"
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
                    Mã quản lý: #{selectedRoute.id} •{" "}
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
                  ["Độ dốc cực đại", selectedRoute.completionRate],
                  ["Cao độ đỉnh", "2.650m"],
                  ["Dự kiến leo", "~14 giờ"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-[#eef3fb] p-4"
                  >
                    <span className="text-xs text-slate-500">
                      {label}
                    </span>

                    <strong className="mt-2 block text-lg text-slate-950">
                      {value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50">
                <div className="relative h-52">
                  <svg
                    viewBox="0 0 800 220"
                    className="h-full w-full"
                    aria-label="Bản đồ tuyến đường xem trước"
                  >
                    <path
                      d="M0 40 C150 10 220 90 360 40 S640 20 800 80"
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="2"
                    />

                    <path
                      d="M0 140 C160 80 260 190 440 120 S670 100 800 160"
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="2"
                    />

                    <polyline
                      points="60,185 210,155 365,115 535,45 730,175"
                      fill="none"
                      stroke="#125238"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {[60, 210, 365, 535, 730].map(
                      (x, index) => (
                        <circle
                          key={x}
                          cx={x}
                          cy={
                            [185, 155, 115, 45, 175][index]
                          }
                          r="10"
                          fill={
                            index === 3
                              ? "#f59e0b"
                              : "#125238"
                          }
                        />
                      ),
                    )}
                  </svg>

                  <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#125238] shadow">
                    ● Lộ trình GPS nạp thành công
                  </span>

                  <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow">
                    Chân bản Công Tra → Bản Háng Đồng
                  </span>
                </div>

              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#125238]">
                    Mục 03 · An toàn & Giám sát
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    5 Trạm kiểm soát an toàn
                  </h2>
                </div>

                <span className="rounded-full bg-[#125238] px-3 py-1 text-xs font-bold text-white">
                  5/5 Hợp lệ
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {checkpoints.map((checkpoint) => (
                  <article
                    key={checkpoint.id}
                    className={`flex items-center gap-3 rounded-xl border p-4 ${
                      checkpoint.important
                        ? "border-orange-300 bg-orange-50"
                        : "border-blue-100 bg-[#eef3fb]"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white ${
                        checkpoint.important
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

                <span className="text-xs text-slate-500">
                  Đơn vị: VNĐ
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-[#eef3fb] p-5">
                  <span className="text-xs text-slate-500">
                    Giá vé niêm yết/khách
                  </span>

                  <strong className="mt-2 block text-2xl text-[#125238]">
                    2.850.000₫
                  </strong>

                  <span className="mt-1 block text-xs text-slate-500">
                    Bao gồm trọn gói dịch vụ
                  </span>
                </div>

                <div className="rounded-xl bg-[#eef3fb] p-5">
                  <span className="text-xs text-slate-500">
                    Dự toán doanh thu
                  </span>

                  <strong className="mt-2 block text-2xl text-slate-950">
                    42.750.000₫
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
                <span>
                  ✓ Bảo hiểm cứu hộ dã ngoại 500 triệu/người
                </span>
                <span>
                  ✓ Xe giường nằm khứ hồi Hà Nội ↔ Bắc Yên
                </span>
                <span>
                  ✓ Toàn bộ 4 bữa ăn chính + 2 bữa phụ
                </span>
                <span>
                  ✓ Phí quản lý rừng và sinh môi trường
                </span>
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
                  <div
                    key={item}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span className="text-[#125238]">✓</span>

                    <span className="text-slate-700">
                      {item}
                    </span>
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
                className="mt-3 h-11 w-full rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700"
              >
                ▣ Lưu bản nháp để duyệt sau
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/leader/create-trip/route",
                  )
                }
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
            onClick={() =>
              router.push("/leader/create-trip/route")
            }
            className="h-11 rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700"
          >
            ← Quay lại Bước 2
          </button>

          <button
            type="button"
            disabled={published}
            onClick={() => setShowPublishModal(true)}
            className="h-11 rounded-xl bg-[#125238] px-6 text-sm font-bold text-white disabled:bg-slate-400"
          >
            {published
              ? "✓ Đã công khai"
              : "Công khai chuyến đi"}
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
          ✓ Công khai chuyến đi thành công. Tour đã được thêm
          vào danh sách mở bán.
        </div>
      )}

      {showPublishModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mt-4 text-xl font-bold text-slate-950">
              Công khai chuyến đi ngay?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Sau khi công khai, chuyến đi sẽ xuất hiện trên
              trang khám phá và Trekker có thể bắt đầu đăng
              ký.
            </p>

            <div className="mt-5 rounded-xl bg-emerald-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Mã chuyến
                </span>
                <strong>#TRK-TX-2412</strong>
              </div>

              <div className="mt-3 flex justify-between text-sm">
                <span className="text-slate-500">
                  Trạng thái sau xuất bản
                </span>
                <strong className="text-[#125238]">
                  Đang mở bán
                </strong>
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-600">
              <input
                type="checkbox"
                defaultChecked
                className="mt-1 h-4 w-4 accent-[#125238]"
              />

              Tôi xác nhận thông tin, cung đường và điều kiện
              an toàn của chuyến đi là chính xác.
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700"
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