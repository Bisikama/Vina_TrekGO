"use client";

import { useMemo, useState } from "react";

type InventoryStatus =
  | "reserved"
  | "available"
  | "on-tour"
  | "inspection"
  | "maintenance"
  | "damaged";

type InventoryItem = {
  id: string;
  rfid: string;
  name: string;
  brand: string;
  category: string;
  status: InventoryStatus;
  location: string;
  specification: string;
  imageIcon: string;
};

const statusConfig: Record<
  InventoryStatus,
  {
    label: string;
    className: string;
  }
> = {
  reserved: {
    label: "Đang giữ chỗ",
    className: "bg-emerald-100 text-emerald-800",
  },
  available: {
    label: "Sẵn sàng xuất",
    className: "bg-green-100 text-green-800",
  },
  "on-tour": {
    label: "Đang trên tour",
    className: "bg-blue-100 text-blue-800",
  },
  inspection: {
    label: "Chờ kiểm định",
    className: "bg-orange-100 text-orange-800",
  },
  maintenance: {
    label: "Bảo dưỡng",
    className: "bg-amber-100 text-amber-800",
  },
  damaged: {
    label: "Hỏng hóc",
    className: "bg-red-100 text-red-700",
  },
};

const initialItems: InventoryItem[] = [
  {
    id: "EQ-TN-2024-0412",
    rfid: "RF-8821",
    name: "Lều Cloud Up 2 Pro",
    brand: "Naturehike · Khung 7001",
    category: "2 Người (20D)",
    status: "reserved",
    location: "Kệ A-02-B (Tầng 2)",
    specification: "Chống nước 4000 mm",
    imageIcon: "⛺",
  },
  {
    id: "EQ-BL-2023-0198",
    rfid: "RF-9402",
    name: "Balo Atmos AG 65",
    brand: "Osprey · AntiGravity",
    category: "Size M/L (65L)",
    status: "available",
    location: "Kệ C-01-A (Tầng 1)",
    specification: "Tải trọng tối đa 25 kg",
    imageIcon: "🎒",
  },
  {
    id: "EQ-GN-2024-0055",
    rfid: "RF-1140",
    name: "Gậy Carbon FLZ",
    brand: "Black Diamond · Khóa Z",
    category: "125–140cm Carbon",
    status: "reserved",
    location: "Kệ G-01-C",
    specification: "Carbon 3 khúc",
    imageIcon: "🥾",
  },
  {
    id: "EQ-GPS-2023-0208",
    rfid: "RF-0092",
    name: "Garmin inReach Mini 2",
    brand: "Garmin · Định vị SOS vệ tinh",
    category: "Pin 14 ngày",
    status: "on-tour",
    location: "Tủ điện tử E-02",
    specification: "GPS vệ tinh hai chiều",
    imageIcon: "🛰️",
  },
  {
    id: "EQ-TN-2023-0104",
    rfid: "RF-4419",
    name: "Lều MSR Elixir 4",
    brand: "MSR Gear · Bản 4 người",
    category: "Size L (4P 68D)",
    status: "inspection",
    location: "Phòng kiểm định B",
    specification: "Chống nước 3000 mm",
    imageIcon: "🏕️",
  },
  {
    id: "EQ-BD-2022-0044",
    rfid: "RF-3312",
    name: "Bộ đàm Motorola T82",
    brand: "Motorola · Chống nước IPx4",
    category: "10km UHF 5W",
    status: "maintenance",
    location: "Xưởng kỹ thuật 01",
    specification: "16 kênh liên lạc",
    imageIcon: "📻",
  },
  {
    id: "EQ-DH-2023-0019",
    rfid: "RF-9011",
    name: "Đèn đội đầu Petzl Actik",
    brand: "Petzl · 450 Lumens",
    category: "Core USB",
    status: "damaged",
    location: "Khu cách ly vật tư",
    specification: "Pin sạc Core USB",
    imageIcon: "🔦",
  },
];

const stats = [
  {
    label: "Tổng thiết bị",
    value: "384",
    detail: "món (4 Hubs)",
    color: "text-slate-950",
    bar: "bg-[#125238]",
  },
  {
    label: "Sẵn sàng xuất",
    value: "215",
    detail: "56.0%",
    color: "text-emerald-800",
    bar: "bg-emerald-600",
  },
  {
    label: "Giữ chỗ / Soạn",
    value: "48",
    detail: "12.5%",
    color: "text-slate-950",
    bar: "bg-emerald-700",
  },
  {
    label: "Đang trên tour",
    value: "86",
    detail: "22.4%",
    color: "text-slate-950",
    bar: "bg-blue-500",
  },
  {
    label: "Chờ kiểm định",
    value: "18",
    detail: "Trong ngày",
    color: "text-amber-700",
    bar: "bg-amber-600",
  },
  {
    label: "Bảo dưỡng",
    value: "12",
    detail: "Đang sửa/khâu",
    color: "text-slate-950",
    bar: "bg-orange-400",
  },
  {
    label: "Hỏng hóc",
    value: "5",
    detail: "Lập BB",
    color: "text-red-700",
    bar: "bg-red-600",
  },
];

export function StaffInventory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    InventoryStatus | "all"
  >("all");

  const [selectedIds, setSelectedIds] = useState<string[]>([
    "EQ-TN-2024-0412",
    "EQ-BL-2023-0198",
    "EQ-GN-2024-0055",
  ]);

  const [activeItemId, setActiveItemId] = useState(
    "EQ-TN-2024-0412",
  );

  const [actionMessage, setActionMessage] = useState("");

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return initialItems.filter((item) => {
      const matchesKeyword =
        !keyword ||
        `${item.id} ${item.rfid} ${item.name} ${item.brand}`
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      return matchesKeyword && matchesStatus;
    });
  }, [search, statusFilter]);

  const activeItem =
    initialItems.find((item) => item.id === activeItemId) ??
    initialItems[0];

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  function toggleAllVisible() {
    const visibleIds = visibleItems.map((item) => item.id);
    const allSelected = visibleIds.every((id) =>
      selectedIds.includes(id),
    );

    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  function performAction(message: string) {
    setActionMessage(message);

    window.setTimeout(() => {
      setActionMessage("");
    }, 2500);
  }

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1540px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">
              Kho & Thiết bị
              <span className="mx-2">›</span>
              Quản lý Hiện vật Kho vận
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-slate-950">
                Quản lý Kho thiết bị & Vật tư
              </h1>

              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-800">
                Hub North-01 Cầu Giấy
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                performAction(
                  "Đã tạo báo cáo tồn kho demo.",
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-bold shadow-sm"
            >
              ⇩ Xuất Excel / Báo cáo
            </button>

            <button
              type="button"
              onClick={() =>
                performAction(
                  "Đã mở biểu mẫu nhập thiết bị mới.",
                )
              }
              className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white shadow-sm"
            >
              ⊕ Nhập thiết bị mới
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="mt-4 rounded-lg bg-emerald-100 px-4 py-3 text-xs font-bold text-emerald-900">
            ✓ {actionMessage}
          </div>
        )}

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[10px] text-slate-600">
                {stat.label}
              </p>

              <div className="mt-3 flex items-end gap-1">
                <strong
                  className={`text-2xl font-black ${stat.color}`}
                >
                  {stat.value}
                </strong>

                <span className="pb-1 text-[9px] text-slate-600">
                  {stat.detail}
                </span>
              </div>

              <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#e4ebf8]">
                <div
                  className={`h-full w-3/4 rounded-full ${stat.bar}`}
                />
              </div>
            </article>
          ))}
        </section>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-64 flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    ⌕
                  </span>

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Tìm mã SKU, RFID, tên thiết bị..."
                    className="h-11 w-full rounded-lg bg-[#edf3ff] pl-9 pr-4 text-xs outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as
                        | InventoryStatus
                        | "all",
                    )
                  }
                  className="h-11 rounded-lg bg-[#edf3ff] px-4 text-xs font-semibold outline-none"
                >
                  <option value="all">
                    Tình trạng: Tất cả
                  </option>
                  <option value="available">
                    Sẵn sàng xuất
                  </option>
                  <option value="reserved">
                    Đang giữ chỗ
                  </option>
                  <option value="on-tour">
                    Đang trên tour
                  </option>
                  <option value="inspection">
                    Chờ kiểm định
                  </option>
                  <option value="maintenance">
                    Bảo dưỡng
                  </option>
                  <option value="damaged">
                    Hỏng hóc
                  </option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`rounded-full px-4 py-2 ${
                    statusFilter === "all"
                      ? "bg-[#125238] text-white"
                      : "bg-[#edf3ff] text-slate-700"
                  }`}
                >
                  Tất cả 384
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter("available")
                  }
                  className={`rounded-full px-4 py-2 ${
                    statusFilter === "available"
                      ? "bg-[#125238] text-white"
                      : "bg-[#edf3ff] text-slate-700"
                  }`}
                >
                  Khả dụng 215
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter("reserved")
                  }
                  className={`rounded-full px-4 py-2 ${
                    statusFilter === "reserved"
                      ? "bg-[#125238] text-white"
                      : "bg-[#edf3ff] text-slate-700"
                  }`}
                >
                  Đang giữ chỗ 48
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter("on-tour")
                  }
                  className={`rounded-full px-4 py-2 ${
                    statusFilter === "on-tour"
                      ? "bg-[#125238] text-white"
                      : "bg-[#edf3ff] text-slate-700"
                  }`}
                >
                  Đang thuê 86
                </button>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="border-b border-slate-100 bg-[#edf3ff] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-700">
                    ☑ Đã chọn {selectedIds.length} thiết bị
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        performAction(
                          `Đã đổi trạng thái ${selectedIds.length} thiết bị.`,
                        )
                      }
                      className="rounded-lg bg-white px-3 py-2 text-[10px] font-bold"
                    >
                      ⟳ Đổi trạng thái loạt
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        performAction(
                          `Đã tạo mã QR/RFID cho ${selectedIds.length} thiết bị.`,
                        )
                      }
                      className="rounded-lg bg-white px-3 py-2 text-[10px] font-bold"
                    >
                      ▦ In mã QR / RFID
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        performAction(
                          "Zebra TC26 đã kết nối.",
                        )
                      }
                      className="rounded-lg bg-[#125238] px-3 py-2 text-[10px] font-bold text-white"
                    >
                      Kiểm kê Zebra TC26
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-[#e7eefc] text-[10px] uppercase text-slate-600">
                  <tr>
                    <th className="w-12 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={
                          visibleItems.length > 0 &&
                          visibleItems.every((item) =>
                            selectedIds.includes(item.id),
                          )
                        }
                        onChange={toggleAllVisible}
                        className="h-4 w-4 accent-[#125238]"
                      />
                    </th>
                    <th className="px-3 py-4">
                      Mã thiết bị / RFID
                    </th>
                    <th className="px-3 py-4">
                      Tên & Model
                    </th>
                    <th className="px-3 py-4">
                      Phân loại
                    </th>
                    <th className="px-3 py-4">
                      Trạng thái kho
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleItems.map((item) => {
                    const selected =
                      selectedIds.includes(item.id);

                    const active =
                      activeItem.id === item.id;

                    return (
                      <tr
                        key={item.id}
                        onClick={() =>
                          setActiveItemId(item.id)
                        }
                        className={`cursor-pointer border-b border-slate-100 transition ${
                          active
                            ? "bg-[#edf3ff]"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td
                          className="px-4 py-4"
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              toggleSelected(item.id)
                            }
                            className="h-4 w-4 accent-[#125238]"
                          />
                        </td>

                        <td className="px-3 py-4">
                          <p className="font-mono text-[11px] font-black text-emerald-900">
                            {item.id}
                          </p>
                          <p className="mt-1 font-mono text-[9px] text-slate-500">
                            RFID #{item.rfid}
                          </p>
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-emerald-700 text-lg">
                              {item.imageIcon}
                            </div>

                            <div>
                              <p className="text-xs font-black text-slate-950">
                                {item.name}
                              </p>
                              <p className="mt-1 text-[9px] text-slate-500">
                                {item.brand}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-4">
                          <span className="rounded bg-[#e4ebf8] px-3 py-1.5 text-[9px] font-semibold text-slate-700">
                            {item.category}
                          </span>
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-2 text-[9px] font-black ${
                              statusConfig[item.status]
                                .className
                            }`}
                          >
                            {
                              statusConfig[item.status]
                                .label
                            }
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {visibleItems.length === 0 && (
                <div className="p-10 text-center text-xs text-slate-500">
                  Không tìm thấy thiết bị phù hợp.
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 bg-[#edf3ff] px-4 py-3 text-[10px] text-slate-600">
              <span>
                Hiển thị 1 – {visibleItems.length} của 384
                thiết bị
              </span>

              <div className="flex gap-1">
                {["‹", "1", "2", "3", "…", "39", "›"].map(
                  (page) => (
                    <button
                      type="button"
                      key={page}
                      className={`h-8 min-w-8 rounded ${
                        page === "1"
                          ? "bg-[#125238] text-white"
                          : "bg-white"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>
            </footer>
          </section>

          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-24">
            <div className="bg-[#e7eefc] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] font-black text-emerald-900">
                    #{activeItem.id}
                  </p>

                  <h2 className="mt-2 text-xl font-black text-slate-950">
                    {activeItem.name}
                  </h2>

                  <p className="mt-1 text-[10px] text-slate-500">
                    {activeItem.brand}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-2 text-[9px] font-black ${
                    statusConfig[activeItem.status]
                      .className
                  }`}
                >
                  {statusConfig[activeItem.status].label}
                </span>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-black">
                  Ảnh thực tế hiện trạng
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    performAction(
                      "Đã mở camera Zebra TC26.",
                    )
                  }
                  className="text-[10px] font-bold text-emerald-800"
                >
                  ◉ Chụp thêm
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {["Toàn cảnh", "Đáy thiết bị", "Phụ kiện"].map(
                  (label, index) => (
                    <div
                      key={label}
                      className="flex h-24 items-end rounded-lg bg-gradient-to-br from-slate-800 via-emerald-800 to-orange-500 p-2"
                    >
                      <span className="rounded bg-black/50 px-2 py-1 text-[8px] font-bold text-white">
                        {index + 1}. {label}
                      </span>
                    </div>
                  ),
                )}
              </div>

              <section className="mt-4 rounded-xl bg-[#edf3ff] p-4">
                <h3 className="text-[10px] font-black uppercase text-slate-700">
                  Vị trí lưu kho & Nhận diện RFID
                </h3>

                <div className="mt-3 grid grid-cols-2 gap-4 text-[10px]">
                  <div>
                    <p className="text-slate-500">
                      Vị trí chính xác
                    </p>
                    <p className="mt-1 font-black">
                      ▣ {activeItem.location}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">
                      Chu kỳ vận hành
                    </p>
                    <p className="mt-1 font-black">
                      ⟳ 14 chuyến an toàn
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg bg-white p-3 text-[10px]">
                  <div>
                    <p className="text-slate-500">
                      Mã vạch EAN & RFID UHF
                    </p>
                    <p className="mt-1 font-mono font-black">
                      893524109825 · 865MHz
                    </p>
                  </div>

                  <span className="rounded bg-emerald-100 px-2 py-1 font-bold text-emerald-800">
                    {activeItem.rfid} OK
                  </span>
                </div>
              </section>

              <section className="mt-4 rounded-xl bg-[#edf3ff] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase">
                    Đơn hàng & Lộ trình gần liền
                  </h3>

                  <span className="rounded bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800">
                    Xuất hôm nay
                  </span>
                </div>

                <dl className="mt-3 space-y-3 text-[10px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      Mã đơn thuê:
                    </dt>
                    <dd className="font-black">
                      #ORD-RENT-8925
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      Tour thám hiểm:
                    </dt>
                    <dd className="font-bold">
                      Tà Xùa Săn Mây (3N2Đ)
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      Người thuê:
                    </dt>
                    <dd className="font-bold">
                      Hoàng Minh Quân
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      Mountain Leader:
                    </dt>
                    <dd className="font-bold">
                      Hoàng Thu Trang
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 rounded-lg bg-white p-3 text-[10px] font-bold text-orange-800">
                  ◷ Giờ xuất dự kiến: 13:30 · Xe-04
                </div>
              </section>

              <section className="mt-4">
                <div className="flex justify-between gap-3">
                  <h3 className="text-[10px] font-black uppercase">
                    Nhật ký kiểm định & Vận hành
                  </h3>
                  <span className="text-[9px] text-slate-500">
                    4 sự kiện gần nhất
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="rounded-lg bg-[#edf3ff] p-3">
                    <p className="text-[10px] font-black">
                      ● Kiểm định soạn đồ tour
                    </p>
                    <p className="mt-2 text-[9px] leading-5 text-slate-600">
                      Đã nhặt vào kiện #01. Tình trạng
                      ngoại quan tốt, đủ phụ kiện.
                    </p>
                  </div>

                  <div className="rounded-lg bg-orange-50 p-3">
                    <p className="text-[10px] font-black">
                      ● Hoàn trả từ Fansipan
                    </p>
                    <p className="mt-2 text-[9px] leading-5 text-slate-600">
                      Tiếp nhận hoàn trả và chuyển buồng
                      sấy tia UV.
                    </p>
                  </div>
                </div>
              </section>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    performAction(
                      `Đã tạo tem QR/RFID cho ${activeItem.id}.`,
                    )
                  }
                  className="rounded-lg bg-[#edf3ff] px-3 py-3 text-[10px] font-bold"
                >
                  ▦ In tem QR/RFID
                </button>

                <button
                  type="button"
                  onClick={() =>
                    performAction(
                      "Đã cập nhật trạng thái hiện vật.",
                    )
                  }
                  className="rounded-lg bg-[#edf3ff] px-3 py-3 text-[10px] font-bold"
                >
                  Đổi trạng thái
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  performAction(
                    `Đã lưu cập nhật cho ${activeItem.id}.`,
                  )
                }
                className="mt-2 w-full rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white"
              >
                ▣ Lưu cập nhật thông tin hiện vật
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}