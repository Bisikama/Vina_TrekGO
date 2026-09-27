
"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Stage =
  | "new"
  | "picking"
  | "packing"
  | "ready"
  | "return";

type WorkOrder = {
  id: string;
  stage: Stage;
  trip: string;
  customer: string;
  meta: string;
  deadline: string;
  details: string;
  urgent?: boolean;
  progress?: number;
};

const initialOrders: WorkOrder[] = [
  {
    id: "ORD-RENT-8925",
    stage: "new",
    trip: "Tour Tà Xùa Săn Mây 3N2Đ",
    customer: "Hoàng Minh Quân",
    meta: "Xuất xe 14:00 tại Hub Cầu Giấy",
    deadline: "GẤP • 13:30",
    details:
      "2 lều Cloud Up 2P • 2 túi ngủ • 2 gậy leo núi",
    urgent: true,
  },
  {
    id: "ORD-RENT-8928",
    stage: "new",
    trip: "Fansipan Trekking Tour",
    customer: "Trần Thùy Linh",
    meta: "Nhóm 4 người • Khu A",
    deadline: "Hạn 15:00",
    details:
      "9 thiết bị: lều 4P, túi ngủ, balo trekking",
  },
  {
    id: "ORD-RENT-8921",
    stage: "picking",
    trip: "Đoàn Tà Xùa 18 người",
    customer: "Đặng Thị Mai",
    meta: "Vị trí kệ B2 → Kệ C1",
    deadline: "14:00 • 4/6 món",
    details:
      "Bộ đàm Motorola còn chờ quét RFID",
    progress: 67,
  },
  {
    id: "ORD-RENT-8923",
    stage: "picking",
    trip: "Lễ hội Đằng • Lào Thẩn",
    customer: "Nguyễn Văn An",
    meta: "Phụ trách 2/3 món",
    deadline: "Hạn 15:30",
    details: "Đang chờ xác nhận nhặt xong",
    progress: 72,
  },
  {
    id: "ORD-RENT-8919",
    stage: "packing",
    trip: "Đoàn Kỳ Quan San",
    customer: "Bùi Quang Huy",
    meta: "Bàn đóng gói #02",
    deadline: "Đã seal 2 kiện",
    details:
      "Đã test pin, khí khử ẩm và dán tem niêm phong",
  },
  {
    id: "ORD-RENT-8920",
    stage: "packing",
    trip: "Tour Y Tý Cỏ Cháy",
    customer: "Lý Tuấn",
    meta: "Chờ kiểm định 1 móc",
    deadline: "Hạn 16:00",
    details: "Đang chờ bàn kiểm định số 1 trống",
  },
  {
    id: "ORD-RENT-8914",
    stage: "ready",
    trip: "Sa Pa Express",
    customer: "Hoàng Nam",
    meta: "Xe #Xe-04 • Dock A",
    deadline: "Sẵn sàng xuất",
    details: "QR xác thực bàn giao tại xế sẵn sàng",
  },
  {
    id: "ORD-RENT-8911",
    stage: "ready",
    trip: "Tà Xùa Trekking Tour",
    customer: "Đội xe 16 chỗ",
    meta: "Dock B",
    deadline: "Chờ quét xe",
    details: "Quét barcode xe trước khi dispatch",
  },
  {
    id: "ORD-RENT-8890",
    stage: "return",
    trip: "Đoàn Tà Xùa",
    customer: "Hoàng Thu Trang",
    meta: "15 Trekker • Về 16:30",
    deadline: "12 món đồ",
    details:
      "Cảnh báo: 1 lều rách vải lớp ngoài 15 cm",
    urgent: true,
  },
  {
    id: "ORD-RENT-8884",
    stage: "return",
    trip: "Nhóm trekker tự do Fansipan",
    customer: "4 khách",
    meta: "Dự kiến 17:15",
    deadline: "Chờ hoàn trả",
    details: "4 gậy leo núi và 2 lều",
  },
];

const columns: Array<{
  stage: Stage;
  title: string;
  hint: string;
  dot: string;
}> = [
  {
    stage: "new",
    title: "1. ĐƠN MỚI TIẾP NHẬN",
    hint: "Cần gán nhân sự và in phiếu nhặt",
    dot: "bg-red-600",
  },
  {
    stage: "picking",
    title: "2. ĐANG NHẶT HÀNG",
    hint: "Dùng máy quét Zebra quét SKU/RFID",
    dot: "bg-amber-600",
  },
  {
    stage: "packing",
    title: "3. ĐÓNG GÓI & QA",
    hint: "Kiểm tra pin, khử khuẩn và dán tem",
    dot: "bg-emerald-700",
  },
  {
    stage: "ready",
    title: "4. SẴN SÀNG XUẤT (XE)",
    hint: "Khu vực cửa xuất kho Dock A – Dock B",
    dot: "bg-emerald-700",
  },
  {
    stage: "return",
    title: "5. TIẾP NHẬN HOÀN TRẢ",
    hint: "Kiểm tra hư hại, sấy khô và nhập kho",
    dot: "bg-amber-700",
  },
];

function OrderCard({
  order,
  onAdvance,
}: {
  order: WorkOrder;
  onAdvance: (id: string) => void;
}) {
  const finalStage =
    order.stage === "ready" ||
    order.stage === "return";

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        order.urgent
          ? "border-red-200"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-slate-900">
            #{order.id}
          </p>

          <p className="mt-0.5 text-[10px] text-slate-500">
            {order.meta}
          </p>
        </div>

        <span
          className={`rounded-md px-2 py-1 text-[9px] font-black ${
            order.urgent
              ? "bg-red-100 text-red-700"
              : "bg-orange-50 text-orange-700"
          }`}
        >
          {order.deadline}
        </span>
      </div>

      <h4 className="mt-3 text-sm font-black text-slate-950">
        {order.trip}
      </h4>

      <p className="mt-1 text-[11px] text-slate-600">
        <strong>{order.customer}</strong>
      </p>

      <div className="mt-3 rounded-lg bg-[#edf3ff] p-3 text-[11px] leading-5 text-slate-700">
        {order.details}
      </div>

      {order.progress != null && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500">
            <span>Tiến độ</span>
            <span>{order.progress}%</span>
          </div>

          <div className="h-1.5 rounded-full bg-slate-200">
            <div
              className="h-1.5 rounded-full bg-emerald-700"
              style={{
                width: `${order.progress}%`,
              }}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onAdvance(order.id)}
        className={`mt-3 w-full rounded-lg px-3 py-2 text-[11px] font-black ${
          finalStage
            ? "bg-[#e8f0ff] text-slate-700"
            : "bg-[#0d5b3a] text-white hover:bg-[#09482e]"
        }`}
      >
        {order.stage === "new" && "Nhận & Soạn ngay"}
        {order.stage === "picking" &&
          "Xác nhận nhặt xong"}
        {order.stage === "packing" &&
          "In Phiếu Bàn Giao & Dán Seal"}
        {order.stage === "ready" &&
          "Bàn Giao Cho Xe (Dispatch)"}
        {order.stage === "return" &&
          "Chuẩn Bị Cổng Tiếp Nhận"}
      </button>
    </article>
  );
}

export function StaffWorkQueue() {
  const router = useRouter();

  const [orders, setOrders] = useState(initialOrders);

  const [search, setSearch] = useState("");

  const visibleOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return orders;
    }

    return orders.filter((order) =>
      `${order.id} ${order.trip} ${order.customer}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [orders, search]);

  function advanceOrder(id: string) {
  const selectedOrder = orders.find(
    (order) => order.id === id,
  );

  if (
    selectedOrder?.stage === "new" ||
    selectedOrder?.stage === "picking"
  ) {
    router.push(`/staff/orders/${id}`);
    return;
  }

  const next: Partial<Record<Stage, Stage>> = {
    packing: "ready",
  };

  setOrders((current) =>
    current.map((order) =>
      next[order.stage] && order.id === id
        ? {
            ...order,
            stage: next[order.stage]!,
            progress: order.progress,
          }
        : order,
    ),
  );
}

  const stats = [
    {
      label: "ĐƠN HÔM NAY",
      value: "28",
      unit: "đơn xuất",
      detail: "142 thiết bị",
      valueClass: "text-slate-950",
      background: "bg-white",
    },
    {
      label: "CẦN SOẠN GẤP (< 2H)",
      value: "04",
      unit: "đơn ưu tiên",
      detail: "Xe gom khởi hành 14:00",
      valueClass: "text-red-700",
      background: "bg-red-50",
    },
    {
      label: "ĐANG NHẶT HÀNG",
      value: "05",
      unit: "đơn picking",
      detail: "2 nhân viên đang quét RFID",
      valueClass: "text-[#0d5b3a]",
      background: "bg-white",
    },
    {
      label: "SẴN SÀNG XUẤT",
      value: "11",
      unit: "kiện đã seal",
      detail: "Đã dán mã trạm Sa Pa, Y Tý",
      valueClass: "text-[#0d5b3a]",
      background: "bg-white",
    },
    {
      label: "CHỜ HOÀN TRẢ CHIỀU",
      value: "08",
      unit: "đơn về kho",
      detail: "Dự kiến 16:30",
      valueClass: "text-amber-700",
      background: "bg-white",
    },
  ];

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="text-xs text-slate-500">
          Kho Vận & Điều Phối Thực Địa
          <span className="mx-2">›</span>
          <strong className="text-[#123f2d]">
            Hàng Đợi Soạn Đồ & Xuất Trả
          </strong>
        </div>

        <section className="mt-4 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight">
                Hàng Đợi Công Việc Kho Vận
              </h1>

              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">
                v2.4 LIVE
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Điều phối quy trình soạn hàng, đóng gói,
              bàn giao xe trung chuyển và tiếp nhận hoàn
              trả thiết bị cho các đoàn trekking hôm nay.
            </p>

            <div className="mt-3 inline-flex items-center rounded-full bg-[#e7eefc] px-3 py-1.5 text-[11px] text-slate-700">
              <span className="mr-2 h-2 w-2 rounded-full bg-emerald-700" />
              Kho Hub: Cầu Giấy • Ca trực sáng
              06:00–14:30
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg bg-[#e7eefc] px-4 py-2.5 text-xs font-bold">
              Quét mã vạch / RFID
            </button>

            <button className="rounded-lg bg-[#e7eefc] px-4 py-2.5 text-xs font-bold">
              In phiếu loạt
            </button>

            <button className="rounded-lg bg-[#0d5b3a] px-4 py-2.5 text-xs font-black text-white">
              + Đơn xuất khẩn
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className={`rounded-xl border border-slate-200 p-4 shadow-sm ${stat.background}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {stat.label}
              </p>

              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className={`text-3xl font-black ${stat.valueClass}`}
                >
                  {stat.value}
                </span>

                <span className="text-xs text-slate-500">
                  {stat.unit}
                </span>
              </div>

              <p className="mt-3 text-[10px] font-medium text-slate-600">
                {stat.detail}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="h-10 min-w-[260px] flex-1 rounded-lg bg-[#edf3ff] px-4 text-xs outline-none"
              placeholder="Tìm theo mã đơn hoặc khách hàng"
            />

            <button className="rounded-lg bg-[#edf3ff] px-4 py-2.5 text-xs font-bold">
              Hôm nay: 24/11/2024
            </button>

            <button className="rounded-lg bg-[#edf3ff] px-4 py-2.5 text-xs font-bold">
              Sắp xếp: Ưu tiên giờ xe chạy
            </button>

            <button className="rounded-lg border-2 border-blue-200 bg-white px-4 py-2 text-xs font-bold text-[#0d5b3a]">
              Kanban
            </button>

            <button className="rounded-lg bg-[#edf3ff] px-4 py-2.5 text-xs font-bold">
              Danh sách
            </button>
          </div>
        </section>

        <section className="mt-5 grid items-start gap-4 xl:grid-cols-3">
          {columns.map((column) => {
            const list = visibleOrders.filter(
              (order) => order.stage === column.stage,
            );

            return (
              <div
                key={column.stage}
                className="rounded-xl bg-[#eaf0fc] p-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xs font-black">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${column.dot}`}
                    />

                    {column.title}
                  </h3>

                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold">
                    {list.length}
                  </span>
                </div>

                <p className="mt-2 text-[10px] text-slate-500">
                  {column.hint}
                </p>

                <div className="mt-3 space-y-3">
                  {list.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAdvance={advanceOrder}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[10px] text-slate-600">
          <span>
            <strong className="text-emerald-700">
              ● Đang đồng bộ máy quét RFID:
            </strong>{" "}
            Zebra TC26 #Z-02
          </span>

          <span>
            Mạng kho ổn định • Ping 12ms • 5.2 GHz
          </span>

          <span>
            F2 Quét • F4 In phiếu • Space Hoàn thành
          </span>
        </footer>
      </div>
    </main>
  );
}