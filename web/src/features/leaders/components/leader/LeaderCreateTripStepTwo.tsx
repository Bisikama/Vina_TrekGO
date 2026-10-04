"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RouteOption = {
  id: string;
  name: string;
  location: string;
  distance: string;
  completionRate: string;
  duration: string;
  difficulty: string;
  imageUrl: string;
};

type Checkpoint = {
  id: number;
  name: string;
  km: string;
  elevation: string;
  eta: string;
  note: string;
  required: boolean;
  highlighted?: boolean;
};

const routeOptions: RouteOption[] = [
  {
    id: "VFRS-TR-042",
    name: "Sống Lưng Khủng Long Tà Xùa",
    location: "Huyện Bắc Yên, Tỉnh Sơn La",
    distance: "14.5 km",
    completionRate: "16.8%",
    duration: "2N1Đ",
    difficulty: "Cấp 3 – Vừa phải",
    imageUrl:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "VFRS-TR-067",
    name: "Đỉnh Lảo Thẩn – Nóc nhà Y Tý",
    location: "Bát Xát, Lào Cai",
    distance: "16 km",
    completionRate: "9.8%",
    duration: "2N1Đ",
    difficulty: "Cấp 2 – Nhẹ",
    imageUrl:
      "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "VFRS-TR-091",
    name: "Pu Ta Leng – Rừng Rêu Cổ Thụ",
    location: "Tam Đường, Lai Châu",
    distance: "35 km",
    completionRate: "7.4%",
    duration: "3N2Đ",
    difficulty: "Cấp 4 – Thử thách",
    imageUrl:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=80",
  },
];

const initialCheckpoints: Checkpoint[] = [
  {
    id: 1,
    name: "Điểm xuất phát: Chân bản Công Tra",
    km: "Km 0.0",
    elevation: "1.250m",
    eta: "08:30 Ngày 1",
    note: "Trạm kiểm lâm & Điểm danh quân số",
    required: true,
  },
  {
    id: 2,
    name: "Trạm nghỉ 1: Rừng trúc & Mỏm Đầu Rùa",
    km: "Km 4.2",
    elevation: "1.780m",
    eta: "11:30 Ngày 1",
    note: "Tiếp nước sạch & Ăn trưa dã ngoại",
    required: true,
  },
  {
    id: 3,
    name: "Lán nghỉ đêm Sống Lưng Khủng Long",
    km: "Km 8.5",
    elevation: "2.100m",
    eta: "16:00 Ngày 1",
    note: "Hạ trại, sơ cứu y tế, sóng bộ đàm VFRS",
    required: true,
    highlighted: true,
  },
  {
    id: 4,
    name: "Đỉnh Gió Tà Xùa – Mốc săn mây",
    km: "Km 12.0",
    elevation: "2.650m",
    eta: "06:15 Ngày 2",
    note: "Đón bình minh & Check-in đỉnh",
    required: true,
  },
  {
    id: 5,
    name: "Điểm kết thúc: Bản Háng Đồng",
    km: "Km 14.5",
    elevation: "1.400m",
    eta: "13:30 Ngày 2",
    note: "Bàn giao xe trung chuyển & Hoàn thành chuyến",
    required: true,
  },
];

export function LeaderCreateTripStepTwo() {
  const router = useRouter();

  const [selectedRouteId, setSelectedRouteId] = useState(
    "VFRS-TR-042",
  );

  const [checkpoints, setCheckpoints] =
    useState<Checkpoint[]>(initialCheckpoints);

  const [saved, setSaved] = useState(false);
  const [createCustomRoute, setCreateCustomRoute] =
    useState(false);

  const selectedRoute =
    routeOptions.find(
      (route) => route.id === selectedRouteId,
    ) ?? routeOptions[0];

  function selectRoute(routeId: string) {
    setSelectedRouteId(routeId);
    const route = routeOptions.find((item) => item.id === routeId);
    if (route) {
      window.sessionStorage.setItem(
        "leader-create-trip-route",
        JSON.stringify(route),
      );
    }
  }

  function toggleCheckpoint(id: number) {
    setCheckpoints((current) =>
      current.map((checkpoint) =>
        checkpoint.id === id
          ? {
              ...checkpoint,
              required: !checkpoint.required,
            }
          : checkpoint,
      ),
    );
  }

  function addCheckpoint() {
    setCheckpoints((current) => [
      ...current,
      {
        id: current.length + 1,
        name: `Trạm dừng mới ${current.length + 1}`,
        km: "Chưa đặt",
        elevation: "Chưa đặt",
        eta: "Chưa đặt",
        note: "Bấm để cập nhật thông tin trạm dừng",
        required: false,
      },
    ]);
  }

  function saveDraft() {
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Quản lý dẫn đoàn
              <span className="mx-2">›</span>
              Tạo chuyến đi mới
              <span className="mx-2">›</span>
              <strong className="text-[#125238]">
                Bước 2: Cung đường & Trạm dừng
              </strong>
            </div>

            <div className="flex gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#125238]">
                BƯỚC 2/3
              </span>

              <button
                type="button"
                onClick={saveDraft}
                className="rounded-xl bg-[#eef3fb] px-4 py-2 text-xs font-bold text-slate-700"
              >
                ▣ Lưu nháp
              </button>
            </div>
          </div>

          <div className="mt-4">
            <h1 className="text-3xl font-bold text-slate-950">
              Thiết lập Cung đường & Trạm dừng
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Chọn cung đường đã xác minh và thiết lập các
              checkpoint an toàn cho đoàn.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
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
                    Thông tin cơ bản
                  </strong>
                  <p className="text-xs">Đã hoàn thành</p>
                </div>
              </div>
            </button>

            <div className="rounded-xl bg-[#eef3fb] p-4 text-[#125238]">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2f6b4f] font-bold text-white">
                  2
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase">
                    Bước 2 đang thực hiện
                  </p>
                  <strong className="text-sm">
                    Cung đường & Trạm dừng
                  </strong>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-bold">
                  3
                </span>

                <div>
                  <p className="text-[10px] font-bold uppercase">
                    Bước 3
                  </p>
                  <strong className="text-sm">
                    Xem lại & Công khai
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-950">
                  1. Lựa chọn Cung đường cho Chuyến đi
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Sử dụng kho dữ liệu GPS đã xác minh hoặc
                  tự vẽ cung đường độc lập.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCreateCustomRoute(false)}
                  className={`rounded-xl border p-4 text-left ${
                    !createCustomRoute
                      ? "border-[#2f6b4f] bg-emerald-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-4 w-4 rounded-full border-4 ${
                        !createCustomRoute
                          ? "border-[#125238]"
                          : "border-slate-300"
                      }`}
                    />

                    <strong className="text-sm text-slate-900">
                      Cung đường đã thẩm định
                    </strong>

                    <span className="ml-auto rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-[#125238]">
                      VFRS Verified
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Dữ liệu trắc diện, nguồn nước và tọa độ
                    cứu hộ đã được chuẩn hóa.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateCustomRoute(true)}
                  className={`rounded-xl border p-4 text-left ${
                    createCustomRoute
                      ? "border-[#2f6b4f] bg-emerald-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-4 w-4 rounded-full border-4 ${
                        createCustomRoute
                          ? "border-[#125238]"
                          : "border-slate-300"
                      }`}
                    />

                    <strong className="text-sm text-slate-900">
                      Tạo cung đường riêng
                    </strong>

                    <span className="ml-auto rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                      Tự thiết lập
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Nhập GPX/KML hoặc số hóa thủ công các
                    điểm mốc và waypoint.
                  </p>
                </button>
              </div>

              {createCustomRoute ? (
                <div className="mt-5 rounded-xl border border-dashed border-[#2f6b4f] bg-emerald-50 p-8 text-center">
                  <div className="text-3xl">⇧</div>

                  <h3 className="mt-3 font-bold text-slate-950">
                    Tải dữ liệu cung đường
                  </h3>

                  <p className="mt-2 text-xs text-slate-500">
                    Kéo thả tệp GPX hoặc KML vào đây.
                  </p>

                  <button
                    type="button"
                    className="mt-4 rounded-xl bg-[#125238] px-5 py-3 text-sm font-bold text-white"
                  >
                    Chọn tệp GPX/KML
                  </button>
                </div>
              ) : (
                <>
                  <label className="mt-5 flex h-12 items-center gap-3 rounded-xl bg-[#eef3fb] px-4">
                    <span>⌕</span>

                    <input
                      className="w-full bg-transparent text-sm outline-none"
                      placeholder="Tìm cung đường, địa phương..."
                      defaultValue="Sống Lưng Khủng Long Tà Xùa"
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "Tây Bắc",
                      "Đông Bắc",
                      "Tây Nguyên",
                      "Độ khó Cấp 3",
                    ].map((filter, index) => (
                      <span
                        key={filter}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          index === 0
                            ? "bg-[#125238] text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {filter}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 space-y-3">
                    {routeOptions.map((route) => {
                      const selected =
                        selectedRouteId === route.id;

                      return (
                        <button
                          key={route.id}
                          type="button"
                          onClick={() => selectRoute(route.id)}
                          className={`flex w-full flex-col gap-4 rounded-xl border p-3 text-left transition sm:flex-row ${
                            selected
                              ? "border-[#2f6b4f] bg-emerald-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div
                            className="h-28 w-full shrink-0 rounded-lg bg-cover bg-center sm:w-44"
                            style={{
                              backgroundImage: `url("${route.imageUrl}")`,
                            }}
                          >
                            <span className="m-2 inline-flex rounded bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white">
                              #{route.id}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between gap-3">
                              <div>
                                <h3 className="font-bold text-slate-950">
                                  {route.name}
                                </h3>

                                <p className="mt-1 text-xs text-slate-500">
                                  ⌖ {route.location}
                                </p>
                              </div>

                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                  selected
                                    ? "bg-[#125238] text-white"
                                    : "bg-slate-200 text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2">
                              <div>
                                <span className="text-[10px] text-slate-400">
                                  Cự ly
                                </span>
                                <strong className="block text-xs">
                                  {route.distance}
                                </strong>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-400">
                                  Độ dốc TB
                                </span>
                                <strong className="block text-xs">
                                  {route.completionRate}
                                </strong>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-400">
                                  Thời lượng
                                </span>
                                <strong className="block text-xs">
                                  {route.duration}
                                </strong>
                              </div>
                            </div>

                            <span className="mt-3 inline-flex rounded bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-800">
                              {route.difficulty}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-950">
                      2. Trạm dừng & Checkpoints An toàn
                    </h2>

                    <span className="rounded-full bg-[#125238] px-2 py-1 text-[10px] font-bold text-white">
                      {checkpoints.length} MỐC
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Thiết lập các mốc kiểm soát đoàn, ETA và
                    trạm bắt buộc.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addCheckpoint}
                  className="rounded-xl bg-[#125238] px-4 py-2 text-xs font-bold text-white"
                >
                  ＋ Thêm trạm
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {checkpoints.map((checkpoint) => (
                  <article
                    key={checkpoint.id}
                    className={`rounded-xl border p-4 ${
                      checkpoint.highlighted
                        ? "border-orange-300 bg-orange-50"
                        : "border-blue-100 bg-[#eef3fb]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="cursor-grab text-slate-400">
                        ⠿
                      </span>

                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-white ${
                          checkpoint.highlighted
                            ? "bg-orange-500"
                            : "bg-[#2f6b4f]"
                        }`}
                      >
                        {checkpoint.id}
                      </span>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-950">
                          {checkpoint.name}
                        </h3>

                        <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                          <div>
                            <span className="text-slate-400">
                              Khoảng cách
                            </span>
                            <strong className="block text-slate-900">
                              {checkpoint.km}
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-400">
                              Cao độ
                            </span>
                            <strong className="block text-slate-900">
                              {checkpoint.elevation}
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-400">
                              ETA dự kiến
                            </span>
                            <strong className="block text-slate-900">
                              {checkpoint.eta}
                            </strong>
                          </div>
                        </div>

                        <span className="mt-3 inline-flex rounded-md bg-white/80 px-2 py-1 text-[10px] text-slate-600">
                          {checkpoint.note}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          toggleCheckpoint(checkpoint.id)
                        }
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                          checkpoint.required
                            ? "bg-[#125238]"
                            : "bg-slate-300"
                        }`}
                        aria-label="Đổi trạng thái bắt buộc"
                      >
                        <span
                          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                            checkpoint.required
                              ? "left-6"
                              : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="sticky top-20 hidden space-y-5 xl:block">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-950">
                  Bản đồ Lộ trình & Trắc diện cao độ
                </h2>

                <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold">
                  Địa hình
                </span>
              </div>

              <div className="relative mt-4 h-72 overflow-hidden rounded-xl bg-[#eaf1ff]">
                <svg
                  viewBox="0 0 360 250"
                  className="h-full w-full"
                  aria-label="Bản đồ cung đường mô phỏng"
                >
                  <path
                    d="M0 45 C70 20 120 80 190 45 S300 15 360 50"
                    fill="none"
                    stroke="#c8d6e8"
                    strokeWidth="1"
                  />
                  <path
                    d="M0 100 C90 60 140 130 220 85 S300 70 360 105"
                    fill="none"
                    stroke="#c8d6e8"
                    strokeWidth="1"
                  />
                  <path
                    d="M0 170 C80 120 150 190 230 150 S310 140 360 170"
                    fill="none"
                    stroke="#c8d6e8"
                    strokeWidth="1"
                  />

                  <polyline
                    points="25,215 95,185 170,135 245,70 325,205"
                    fill="none"
                    stroke="#125238"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <circle
                    cx="25"
                    cy="215"
                    r="8"
                    fill="#125238"
                  />
                  <circle
                    cx="95"
                    cy="185"
                    r="7"
                    fill="#2f6b4f"
                  />
                  <circle
                    cx="170"
                    cy="135"
                    r="10"
                    fill="#f59e0b"
                  />
                  <circle
                    cx="245"
                    cy="70"
                    r="13"
                    fill="#dc2626"
                  />
                  <circle
                    cx="325"
                    cy="205"
                    r="8"
                    fill="#125238"
                  />

                  <text
                    x="12"
                    y="239"
                    fontSize="11"
                    fill="#334155"
                  >
                    CP1 0km
                  </text>

                  <text
                    x="72"
                    y="174"
                    fontSize="11"
                    fill="#334155"
                  >
                    CP2 4.2km
                  </text>

                  <text
                    x="140"
                    y="118"
                    fontSize="11"
                    fill="#92400e"
                  >
                    CP3 8.5km
                  </text>

                  <text
                    x="218"
                    y="48"
                    fontSize="11"
                    fill="#991b1b"
                  >
                    Đỉnh 2.650m
                  </text>

                  <text
                    x="305"
                    y="229"
                    fontSize="11"
                    fill="#334155"
                  >
                    CP5
                  </text>
                </svg>

                <span className="absolute bottom-3 left-3 rounded-md bg-[#125238] px-2 py-1 text-[10px] font-bold text-white">
                  ● GPS Tracking VFRS sẵn sàng
                </span>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[10px] text-slate-400">
                    Tổng cự ly
                  </span>
                  <strong className="block text-sm">
                    {selectedRoute.distance}
                  </strong>
                </div>

                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[10px] text-slate-400">
                    Độ cao đỉnh
                  </span>
                  <strong className="block text-sm text-red-600">
                    2.650m
                  </strong>
                </div>

                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[10px] text-slate-400">
                    Trạm bắt buộc
                  </span>
                  <strong className="block text-sm">
                    {
                      checkpoints.filter(
                        (checkpoint) =>
                          checkpoint.required,
                      ).length
                    }
                    /{checkpoints.length}
                  </strong>
                </div>

                <div className="rounded-lg bg-slate-50 p-2">
                  <span className="text-[10px] text-slate-400">
                    Thời gian
                  </span>
                  <strong className="block text-sm">
                    ~14 giờ
                  </strong>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-950">
                Quy chuẩn An toàn Trạm dừng VFRS
              </h2>

              <div className="mt-4 space-y-4 text-xs leading-5 text-slate-600">
                <p>
                  ⚠ <strong>Check-in bắt buộc CP3:</strong>{" "}
                  Toàn đoàn phải hoàn thành trước 18:00 ngày
                  đầu tiên.
                </p>

                <p>
                  ◉ <strong>Đoạn Sống Lưng:</strong> bắt buộc
                  liên lạc bộ đàm VHF 144.500MHz.
                </p>

                <p>
                  ☎ Cứu hộ phản ứng nhanh:{" "}
                  <strong className="text-red-600">
                    1800-9988
                  </strong>
                </p>
              </div>
            </section>
          </aside>
        </div>

        <footer className="sticky bottom-0 z-30 mt-6 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() =>
              router.push("/leader/create-trip")
            }
            className="h-11 rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700"
          >
            ← Quay lại Bước 1
          </button>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 md:inline">
              ● Đã tự động lưu lúc 10:42
            </span>

            <button
              type="button"
              onClick={saveDraft}
              className="h-11 rounded-xl bg-[#eef3fb] px-5 text-sm font-bold text-slate-700"
            >
              Lưu bản nháp
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/leader/create-trip/review",
                )
              }
              className="h-11 rounded-xl bg-[#125238] px-6 text-sm font-bold text-white shadow-sm hover:bg-[#2f6b4f]"
            >
              Tiếp tục: Xem lại & Công khai →
            </button>
          </div>
        </footer>
      </div>

      {saved && (
        <div className="fixed bottom-24 right-6 z-[80] rounded-xl bg-[#125238] px-5 py-4 text-sm font-semibold text-white shadow-2xl">
          ✓ Đã lưu bản nháp cung đường.
        </div>
      )}
    </main>
  );
}