"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

type Condition =
  | "good"
  | "minor"
  | "damaged"
  | "missing"
  | null;

type ReturnItem = {
  id: string;
  number: string;
  name: string;
  sku: string;
  rfid: string;
  note: string;
  beforeLabel: string;
  returnLabel: string;
  defaultCondition: Condition;
};

type ReturnOrder = {
  id: string;
  trip: string;
  leader: string;
  route: string;
  schedule: string;
  status: "inspecting" | "waiting" | "completed";
};

const returnOrders: ReturnOrder[] = [
  {
    id: "RET-2024-8890",
    trip: "Đoàn Tà Xùa Săn Mây 3N2Đ",
    leader: "Hoàng Thu Trang",
    route: "Mộc Châu → Hà Nội",
    schedule: "26/11 · 16:25",
    status: "inspecting",
  },
  {
    id: "RET-2024-8892",
    trip: "Fansipan Cung Trạm Tôn",
    leader: "Lê Quốc Anh",
    route: "Sa Pa → Hà Nội",
    schedule: "28 món · 18:17",
    status: "waiting",
  },
  {
    id: "RET-2024-8895",
    trip: "Lảo Thẩn Bốn Hoàng Hôn",
    leader: "Nguyễn Thu Hà",
    route: "Y Tý → Hà Nội",
    schedule: "14 món · 20:03",
    status: "waiting",
  },
  {
    id: "RET-2024-8884",
    trip: "Bidoup Núi Bà Trải Run",
    leader: "Trần Minh Quân",
    route: "Lâm Đồng → TP.HCM",
    schedule: "19 món · Hoàn tất",
    status: "completed",
  },
];

const returnItems: ReturnItem[] = [
  {
    id: "tent",
    number: "01",
    name: "Lều Naturehike Cloud Up 2 Pro 20D",
    sku: "NH-CLD-02P",
    rfid: "RF-8821",
    note: "Rách 15 cm ở vải lớp ngoài, cần lập biên bản bồi thường.",
    beforeLabel: "Ảnh lúc xuất kho",
    returnLabel: "Ảnh hiện trạng hôm nay",
    defaultCondition: "damaged",
  },
  {
    id: "pole",
    number: "02",
    name: "Gậy leo núi Black Diamond Trail Pro Shock",
    sku: "BD-TPS-CRB",
    rfid: "RF-1140",
    note: "Hao mòn tự nhiên 3 đoạn, còn chấp nhận theo chính sách.",
    beforeLabel: "Ảnh lúc xuất kho",
    returnLabel: "Ảnh lúc hoàn trả",
    defaultCondition: "minor",
  },
  {
    id: "radio",
    number: "03",
    name: "Bộ đàm chống nước Motorola Talkabout T82 Pro",
    sku: "MOT-T82-PRO",
    rfid: "RF-3312",
    note: "Hoạt động tốt, pin 42%, âm rõ và đầy đủ phụ kiện.",
    beforeLabel: "Ảnh lúc xuất kho",
    returnLabel: "Test khi tiếp nhận",
    defaultCondition: "good",
  },
  {
    id: "sleeping-bag",
    number: "04",
    name: "Túi ngủ dã ngoại lông vũ chịu lạnh CWB200",
    sku: "TN-CWB-200F",
    rfid: "RF-9402",
    note: "Đang kiểm định, yêu cầu chụp thêm ảnh toàn bộ khóa kéo.",
    beforeLabel: "Ảnh lúc xuất kho",
    returnLabel: "Tải ảnh hiện trạng",
    defaultCondition: null,
  },
];

const conditionOptions: {
  value: Exclude<Condition, null>;
  label: string;
}[] = [
  {
    value: "good",
    label: "Tốt / Đạt chuẩn",
  },
  {
    value: "minor",
    label: "Hao mòn nhỏ",
  },
  {
    value: "damaged",
    label: "Hỏng hóc / Đền bù",
  },
  {
    value: "missing",
    label: "Thất lạc / Thiếu món",
  },
];

function conditionClass(condition: Condition) {
  if (condition === "good") {
    return "border-emerald-300 bg-emerald-50";
  }

  if (condition === "minor") {
    return "border-orange-300 bg-orange-50";
  }

  if (
    condition === "damaged" ||
    condition === "missing"
  ) {
    return "border-red-300 bg-red-50";
  }

  return "border-slate-200 bg-white";
}

function conditionBadge(condition: Condition) {
  if (condition === "good") {
    return "TỐT / NGUYÊN VẸN";
  }

  if (condition === "minor") {
    return "HAO MÒN TỰ NHIÊN";
  }

  if (condition === "damaged") {
    return "HỎNG HÓC / DAMAGE";
  }

  if (condition === "missing") {
    return "THẤT LẠC / THIẾU MÓN";
  }

  return "ĐANG KIỂM ĐỊNH";
}

function InspectionCard({
  item,
  condition,
  onChange,
}: {
  item: ReturnItem;
  condition: Condition;
  onChange: (condition: Condition) => void;
}) {
  return (
    <article
      className={`overflow-hidden rounded-xl border shadow-sm ${conditionClass(
        condition,
      )}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#125238] text-[10px] font-black text-white">
            {item.number}
          </div>

          <div>
            <h3 className="text-sm font-black text-slate-950">
              {item.name}
            </h3>

            <div className="mt-2 flex flex-wrap gap-2 text-[9px]">
              <span className="rounded bg-[#e4ebf8] px-2 py-1 font-mono">
                SKU: {item.sku}
              </span>

              <span className="rounded bg-emerald-100 px-2 py-1 font-mono text-emerald-800">
                RFID #{item.rfid}
              </span>
            </div>
          </div>
        </div>

        <span
          className={`rounded-full px-3 py-1.5 text-[9px] font-black ${
            condition === "good"
              ? "bg-emerald-100 text-emerald-800"
              : condition === "minor"
                ? "bg-orange-100 text-orange-800"
                : condition === "damaged" ||
                    condition === "missing"
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-600"
          }`}
        >
          {conditionBadge(condition)}
        </span>
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase text-slate-500">
              {item.beforeLabel}
            </p>

            <div className="flex h-36 items-end rounded-lg bg-gradient-to-br from-emerald-950 via-slate-700 to-orange-500 p-3">
              <span className="rounded bg-black/60 px-2 py-1 text-[9px] font-bold text-white">
                Trước khi xuất kho
              </span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[9px] font-bold uppercase text-slate-500">
              {item.returnLabel}
            </p>

            {item.id === "sleeping-bag" ? (
              <button
                type="button"
                className="flex h-36 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-[#edf3ff] text-[10px] font-bold text-slate-600"
              >
                <span className="text-2xl">▣</span>
                Kéo thả ảnh hoặc quét Zebra TC26
                <span className="mt-2 rounded bg-white px-3 py-1">
                  Chọn tệp từ máy tính
                </span>
              </button>
            ) : (
              <div
                className={`flex h-36 items-end rounded-lg p-3 ${
                  condition === "damaged"
                    ? "bg-gradient-to-br from-slate-800 via-red-900 to-stone-600"
                    : "bg-gradient-to-br from-slate-900 via-emerald-900 to-blue-700"
                }`}
              >
                <span className="rounded bg-black/60 px-2 py-1 text-[9px] font-bold text-white">
                  {condition === "damaged"
                    ? "Phát hiện rách 15 cm"
                    : "Đã kiểm tra thực tế"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-semibold text-slate-600">
            Đánh giá hiện trạng kỹ thuật:
          </p>

          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {conditionOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => onChange(option.value)}
                className={`rounded-lg border px-3 py-3 text-[9px] font-bold transition ${
                  condition === option.value
                    ? option.value === "good"
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : option.value === "minor"
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-red-600 bg-red-600 text-white"
                    : "border-slate-200 bg-[#edf3ff] text-slate-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`mt-4 rounded-lg p-3 text-[10px] leading-5 ${
            condition === "damaged" ||
            condition === "missing"
              ? "bg-red-100 text-red-800"
              : condition === "minor"
                ? "bg-orange-100 text-orange-800"
                : "bg-[#edf3ff] text-slate-700"
          }`}
        >
          <strong>Ghi chú kiểm định:</strong>{" "}
          {item.note}
        </div>

        {condition === "damaged" && (
          <div className="mt-4 rounded-xl border border-red-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase text-red-700">
                  Chi tiết quy chuẩn bồi thường hư hỏng
                </p>

                <p className="mt-2 text-[10px] text-slate-600">
                  Mức tính khấu trừ dự kiến:
                </p>

                <p className="text-xl font-black text-red-700">
                  350.000₫
                </p>
              </div>

              <span className="rounded bg-red-100 px-3 py-2 text-[9px] font-bold text-red-700">
                Chờ Leader/Trekker xác nhận
              </span>
            </div>

            <div className="mt-3 rounded-lg bg-red-50 p-3 text-[9px] leading-5 text-slate-600">
              Rách vải lớp ngoài khoảng 15 cm do vật
              nhọn. Hệ thống đề xuất khấu trừ từ tiền
              cọc theo chính sách thiết bị thuê.
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function StaffReturnsInspection() {
  const [activeOrderId, setActiveOrderId] = useState(
    "RET-2024-8890",
  );

  const [search, setSearch] = useState("");

  const [conditions, setConditions] = useState<
    Record<string, Condition>
  >(
    Object.fromEntries(
      returnItems.map((item) => [
        item.id,
        item.defaultCondition,
      ]),
    ),
  );

  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  const visibleOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return returnOrders;
    }

    return returnOrders.filter((order) =>
      `${order.id} ${order.trip} ${order.leader}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [search]);

  const completedCount = Object.values(
    conditions,
  ).filter(Boolean).length;

  const damagedCount = Object.values(
    conditions,
  ).filter(
    (condition) =>
      condition === "damaged" ||
      condition === "missing",
  ).length;

  const minorCount = Object.values(
    conditions,
  ).filter(
    (condition) => condition === "minor",
  ).length;

  const goodCount = Object.values(
    conditions,
  ).filter(
    (condition) => condition === "good",
  ).length;

  function updateCondition(
    itemId: string,
    condition: Condition,
  ) {
    setConditions((current) => ({
      ...current,
      [itemId]: condition,
    }));

    setSubmitted(false);
    setSaved(false);
  }

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="text-xs text-slate-500">
          Kho & Thiết bị
          <span className="mx-2">›</span>
          Tiếp nhận Hoàn trả
          <span className="mx-2">›</span>
          <strong className="text-slate-900">
            Phiếu kiểm định thu hồi #{activeOrderId}
          </strong>
        </div>

        <div className="mt-3 inline-flex rounded-full bg-orange-100 px-4 py-2 text-[10px] font-bold text-orange-800">
          🚚 Xe trung chuyển #Xe-04 vừa cập bến Cửa
          nhận Inbound 01
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Hôm nay chờ dỡ & kiểm",
              "8",
              "5 hoàn tất · 1 đang kiểm",
              "bg-[#e7eefc]",
            ],
            [
              "Thu hồi ca hiện tại",
              "18",
              "Đã báo đủ vào trạm Inbound 01",
              "bg-emerald-50",
            ],
            [
              "Đạt chuẩn hoàn cọc",
              "16 / 18",
              "Tốt & hao mòn tự nhiên",
              "bg-emerald-50",
            ],
            [
              "Biên bản bồi thường",
              "2 món",
              "Khấu trừ tiền cọc Leader ký nhận",
              "bg-red-50",
            ],
          ].map(([label, value, detail, color]) => (
            <article
              key={label}
              className={`rounded-xl border border-slate-200 p-4 shadow-sm ${color}`}
            >
              <p className="text-[9px] uppercase text-slate-500">
                {label}
              </p>

              <p className="mt-2 text-2xl font-black text-slate-950">
                {value}
              </p>

              <p className="mt-1 text-[9px] text-slate-600">
                {detail}
              </p>
            </article>
          ))}
        </section>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">
                Lô Hàng Hoàn Trả
              </h2>

              <span className="rounded bg-[#edf3ff] px-2 py-1 text-[9px] font-bold">
                8 Lô
              </span>
            </div>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Tìm mã RET, tour, Leader..."
              className="mt-4 h-10 w-full rounded-lg bg-[#edf3ff] px-3 text-[10px] outline-none focus:ring-2 focus:ring-emerald-700"
            />

            <div className="mt-3 flex gap-2 text-[9px]">
              <button
                type="button"
                className="rounded-full bg-[#125238] px-3 py-1.5 font-bold text-white"
              >
                Tất cả (8)
              </button>

              <button
                type="button"
                className="rounded-full bg-[#edf3ff] px-3 py-1.5"
              >
                Đang kiểm (1)
              </button>

              <button
                type="button"
                className="rounded-full bg-[#edf3ff] px-3 py-1.5"
              >
                Chờ dỡ (2)
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {visibleOrders.map((order) => (
                <button
                  type="button"
                  key={order.id}
                  onClick={() => {
                    setActiveOrderId(order.id);
                    setSubmitted(false);
                  }}
                  className={`w-full rounded-lg border-l-4 p-3 text-left transition ${
                    activeOrderId === order.id
                      ? "border-[#125238] bg-[#edf3ff]"
                      : "border-transparent bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] font-black text-emerald-900">
                      #{order.id}
                    </span>

                    <span
                      className={`rounded-full px-2 py-1 text-[8px] font-bold ${
                        order.status === "inspecting"
                          ? "bg-orange-100 text-orange-800"
                          : order.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[#e4ebf8] text-slate-600"
                      }`}
                    >
                      {order.status === "inspecting"
                        ? "Đang kiểm định"
                        : order.status === "completed"
                          ? "Hoàn tất"
                          : "Chờ dỡ hàng"}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] font-black text-slate-900">
                    {order.trip}
                  </p>

                  <p className="mt-2 text-[9px] text-slate-500">
                    Leader: {order.leader}
                  </p>

                  <p className="mt-1 text-[9px] text-slate-500">
                    {order.route}
                  </p>

                  <p className="mt-2 text-[9px] font-semibold text-slate-700">
                    {order.schedule}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <section>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-emerald-100 px-3 py-1 font-mono text-[10px] font-black text-emerald-900">
                      LÔ #{activeOrderId}
                    </span>

                    <span className="rounded bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-800">
                      Đang tiếp nhận đối soát
                    </span>
                  </div>

                  <h1 className="mt-3 text-xl font-black text-slate-950">
                    Tour Tà Xùa Săn Mây 3N2Đ (15 Trekker)
                  </h1>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-[#edf3ff] px-4 py-2 text-[10px] font-bold"
                  >
                    Quét RFID hàng loạt
                  </button>

                  <button
                    type="button"
                    className="rounded-lg bg-[#edf3ff] px-4 py-2 text-[10px] font-bold"
                  >
                    In Biên bản
                  </button>

                  <button
                    type="button"
                    className="rounded-lg bg-red-50 px-4 py-2 text-[10px] font-bold text-red-700"
                  >
                    Báo cáo sự cố
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-xl bg-[#edf3ff] p-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  [
                    "Trưởng đoàn đại diện",
                    "Hoàng Minh Quân",
                  ],
                  [
                    "Tour Leader thu hồi",
                    "Hoàng Thu Trang",
                  ],
                  [
                    "Vị trí dỡ / Cân tổng",
                    "Dock Inbound 01 · 24.8kg",
                  ],
                  [
                    "Thời gian bàn giao",
                    "24/11 · 16:25:40",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[9px] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 text-[11px] font-black">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <span className="font-bold">
                    Tiến độ giám định tình trạng thiết bị:
                    {" "}
                    {completedCount}/{returnItems.length} mục
                  </span>

                  <div className="flex flex-wrap gap-3">
                    <span className="text-emerald-700">
                      ● {goodCount} Tốt
                    </span>
                    <span className="text-orange-700">
                      ● {minorCount} Hao mòn
                    </span>
                    <span className="text-red-700">
                      ● {damagedCount} Hỏng hóc
                    </span>
                    <span className="text-slate-500">
                      ● {returnItems.length - completedCount} Đang chờ
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e4ebf8]">
                  <div
                    className="h-full rounded-full bg-[#125238] transition-all"
                    style={{
                      width: `${
                        (completedCount /
                          returnItems.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {returnItems.map((item) => (
                <InspectionCard
                  key={item.id}
                  item={item}
                  condition={conditions[item.id]}
                  onChange={(condition) =>
                    updateCondition(
                      item.id,
                      condition,
                    )
                  }
                />
              ))}
            </div>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase text-slate-500">
                    Tổng cần trừ tiền cọc
                  </p>

                  <p className="mt-1 text-2xl font-black text-red-700">
                    {damagedCount > 0
                      ? "350.000₫"
                      : "0₫"}
                  </p>

                  <p className="mt-1 text-[9px] text-slate-500">
                    Lập biên bản với chủ thuê / Leader
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSaved(true);
                      setSubmitted(false);
                    }}
                    className="rounded-lg bg-[#edf3ff] px-5 py-3 text-xs font-bold"
                  >
                    ▣ Lưu tạm
                  </button>

                  <button
                    type="button"
                    disabled={
                      completedCount !==
                      returnItems.length
                    }
                    onClick={() => {
                      setSubmitted(true);
                      setSaved(false);
                    }}
                    className="rounded-lg bg-[#125238] px-5 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Hoàn tất kiểm định & Ký biên bản
                  </button>
                </div>
              </div>

              {saved && (
                <div className="mt-4 rounded-lg bg-[#edf3ff] p-3 text-xs font-bold text-slate-700">
                  Đã lưu tạm kết quả kiểm định.
                </div>
              )}

             {submitted && (
  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-100 p-4 text-xs font-bold text-emerald-900">
    <span>
      ✓ Đã hoàn tất kiểm định. Hồ sơ bồi
      thường 350.000₫ đã được chuyển sang
      bước quyết toán tiền cọc.
    </span>

    <Link
      href={`/staff/returns/${activeOrderId}/settlement`}
      className="rounded-lg bg-[#125238] px-4 py-2 text-xs font-black text-white"
    >
      Tiếp tục quyết toán →
    </Link>
  </div>
)}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}