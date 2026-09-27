"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type GearItem = {
  id: string;
  name: string;
  sku: string;
  location: string;
  quantity: number;
  note: string;
  tone: "green" | "blue" | "amber";
};

const gearItems: GearItem[] = [
  {
    id: "tent",
    name: "Lều Naturehike Cloud Up 2 Pro",
    sku: "NH-CLD-02P",
    location: "Kệ A-02-B · Tầng 2 · Lều dã ngoại",
    quantity: 2,
    note: "Khóa kéo trơn tru, đầy đủ 12 cọc nhôm và dây căng.",
    tone: "green",
  },
  {
    id: "sleeping-bag",
    name: "Túi ngủ lông vũ chịu lạnh CWB200",
    sku: "TN-CWB-200F",
    location: "Kệ B-04-A · Tầng 1 · Phòng trữ nhiệt",
    quantity: 2,
    note: "Đã sấy khô 65°C, khóa zip đôi YKK hoạt động tốt.",
    tone: "blue",
  },
  {
    id: "pole",
    name: "Gậy leo núi Black Diamond Trail Pro Shock",
    sku: "BD-TPS-CBR",
    location: "Kệ G-01-C · Khu phụ kiện leo dốc",
    quantity: 2,
    note: "Khóa FlickLock chắc chắn, đệm tay sạch và không bong tróc.",
    tone: "green",
  },
  {
    id: "radio",
    name: "Bộ đàm UHF Motorola Talkabout T82",
    sku: "MOT-T82-PRO",
    location: "Tủ Điện tử E · Khóa an toàn số 03",
    quantity: 6,
    note: "Cần quét serial, kiểm tra pin và chụp đủ hai ảnh ngoại quan.",
    tone: "amber",
  },
];

const toneClass: Record<GearItem["tone"], string> = {
  green: "from-emerald-900 via-emerald-700 to-lime-700",
  blue: "from-slate-900 via-blue-900 to-cyan-700",
  amber: "from-slate-900 via-amber-900 to-orange-600",
};

function EvidenceTile({
  label,
  tone,
}: {
  label: string;
  tone: GearItem["tone"];
}) {
  return (
    <div
      className={`flex h-20 items-end rounded-lg bg-gradient-to-br p-2 ${toneClass[tone]}`}
    >
      <span className="rounded bg-black/45 px-2 py-1 text-[9px] font-semibold text-white">
        {label}
      </span>
    </div>
  );
}

function GearCard({
  item,
  checked,
  onToggle,
}: {
  item: GearItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const [condition, setCondition] = useState("good");

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
        checked ? "border-emerald-200" : "border-amber-200"
      }`}
    >
      <div
        className={`flex flex-wrap items-start justify-between gap-3 p-4 ${
          checked ? "bg-white" : "bg-orange-50"
        }`}
      >
        <div className="flex min-w-0 gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label={
              checked
                ? `Bỏ xác nhận ${item.name}`
                : `Xác nhận ${item.name}`
            }
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-black ${
              checked
                ? "border-[#125238] bg-[#125238] text-white"
                : "border-slate-300 bg-white text-transparent"
            }`}
          >
            ✓
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-slate-950">
                {item.name}
              </h3>

              <span className="rounded bg-emerald-100 px-2 py-1 font-mono text-[9px] font-bold text-emerald-900">
                SKU: {item.sku}
              </span>
            </div>

            <p className="mt-1 text-[11px] text-slate-600">
              Vị trí: <strong>{item.location}</strong> · Số lượng xuất:{" "}
              <strong>{item.quantity}</strong>
            </p>
          </div>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-[10px] font-black ${
            checked
              ? "bg-emerald-100 text-emerald-800"
              : "bg-orange-100 text-orange-800"
          }`}
        >
          {checked
            ? "Đã nhặt & Nghiệm thu"
            : "Đang chờ nhặt & Quét Barcode"}
        </span>
      </div>

      <div className="border-t border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
          <span className="text-slate-500">Tình trạng vật tư:</span>

          {["good", "fair", "reject"].map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setCondition(value)}
              className={`rounded-full px-3 py-1.5 ${
                condition === value
                  ? value === "reject"
                    ? "bg-red-600 text-white"
                    : "bg-[#125238] text-white"
                  : "bg-[#eaf0fc] text-slate-600"
              }`}
            >
              {value === "good" && "Mới 100% / Ngoại quan tốt"}
              {value === "fair" && "Tốt / Đạt chuẩn"}
              {value === "reject" && "Từ chối xuất"}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-[10px] text-slate-500">
          <span>Ảnh chụp hiện trạng lúc xuất kho</span>

          <span className="font-mono font-semibold text-slate-700">
            KHO_VERIFY_{item.sku}_10:14
          </span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          <EvidenceTile
            label="Ngoại quan tổng thể"
            tone={item.tone}
          />

          <EvidenceTile
            label="Tem / khóa / phụ kiện"
            tone={item.tone}
          />

          <button
            type="button"
            className="flex h-20 flex-col items-center justify-center rounded-lg bg-[#eaf0fc] text-[10px] font-bold text-slate-700"
          >
            <span className="text-lg">▣</span>
            + Thêm ảnh
          </button>
        </div>

        <div className="mt-3 rounded-lg bg-[#edf3ff] p-3 text-[10px] leading-5 text-slate-700">
          <strong>Ghi chú kiểm kho:</strong> {item.note}
        </div>
      </div>
    </article>
  );
}

export function StaffOrderPickingDetail({
  orderId,
}: {
  orderId: string;
}) {
  const [checkedIds, setCheckedIds] = useState<string[]>([
    "tent",
    "sleeping-bag",
    "pole",
  ]);

  const [completed, setCompleted] = useState(false);

  const progress = useMemo(
    () =>
      Math.round(
        (checkedIds.length / gearItems.length) * 100,
      ),
    [checkedIds],
  );

  function toggleItem(id: string) {
    setCheckedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

    setCompleted(false);
  }

  function finishPicking() {
    if (checkedIds.length === gearItems.length) {
      setCompleted(true);
    }
  }

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Link
              href="/staff/work-queue"
              className="font-semibold hover:text-emerald-800"
            >
              Hàng Đợi Soạn Đồ
            </Link>

            <span>›</span>

            <span className="rounded bg-[#dce7fa] px-2 py-1 font-mono font-bold text-emerald-900">
              #{orderId}
            </span>

            <span>›</span>

            <strong className="text-slate-900">
              Chi tiết Nhặt hàng & Nghiệm thu hiện trạng
            </strong>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-red-100 px-3 py-2 font-black text-red-700">
              ⏱ XUẤT XE: 13:30 (Còn 22 phút)
            </span>

            <span className="rounded-lg bg-[#dce7fa] px-3 py-2 font-semibold text-slate-700">
              🚚 Cửa xuất:{" "}
              <strong className="text-emerald-800">
                Dock A · Bãi số 2
              </strong>
            </span>
          </div>
        </div>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-5 xl:flex-row">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className="rounded bg-emerald-100 px-3 py-1 font-mono text-[10px] font-black text-emerald-900">
                  #{orderId}
                </span>

                <span className="rounded bg-orange-100 px-3 py-1 text-[10px] font-bold text-orange-900">
                  Đơn Tour Dã Ngoại Trọn Gói
                </span>

                <span className="rounded bg-[#dce7fa] px-3 py-1 text-[10px] text-slate-600">
                  Tạo lúc 08:15 Sáng nay
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-black text-slate-950">
                Tour Tà Xùa Săn Mây 3N2Đ (Đợt 4 Tháng 11)
              </h1>

              <div className="mt-4 grid gap-3 rounded-xl bg-[#edf3ff] p-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  [
                    "Khách hàng đại diện",
                    "Hoàng Minh Quân",
                    "0914 882 xxx · CCCD 00119300****",
                  ],
                  [
                    "Leader phụ trách Tour",
                    "Hoàng Thu Trang",
                    "Đội Hướng dẫn Núi Phía Bắc",
                  ],
                  [
                    "Thời gian thực địa",
                    "25/11 – 27/11/2024",
                    "3 ngày 2 đêm cắm trại đỉnh",
                  ],
                  [
                    "Gói thiết bị kho",
                    "6 thiết bị · 4 danh mục",
                    "Bảo hiểm vật tư: Hạng A",
                  ],
                ].map(([label, value, detail]) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-500">
                      {label}
                    </p>

                    <p className="mt-1 text-xs font-black text-slate-900">
                      {value}
                    </p>

                    <p className="mt-1 text-[9px] text-slate-500">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 flex-row flex-wrap gap-2 xl:w-64 xl:flex-col">
              <button
                type="button"
                className="rounded-lg bg-[#e7eefc] px-4 py-3 text-xs font-bold"
              >
                In phiếu nhặt (PDF)
              </button>

              <button
                type="button"
                className="rounded-lg bg-red-50 px-4 py-3 text-xs font-bold text-red-700"
              >
                Báo thiếu hàng / Đổi món
              </button>

              <button
                type="button"
                className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white"
              >
                Quét Barcode / RFID (TC26)
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black">
                Tiến trình nhặt & Đối soát ngoại quan
              </h2>

              <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-900">
                {checkedIds.length}/{gearItems.length} Món (
                {progress}%)
              </span>
            </div>

            <span className="text-[10px] text-slate-500">
              Quy trình bắt buộc: 100% kèm ảnh hiện trạng
            </span>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#dce7fa]">
            <div
              className="h-full rounded-full bg-[#125238] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-semibold">
            <span className="text-emerald-800">
              ✓ Đã nghiệm thu ảnh: {checkedIds.length} món
            </span>

            <span className="text-orange-700">
              ◷ Đang mở chọn ảnh / Barcode:{" "}
              {gearItems.length - checkedIds.length} món
            </span>

            <span
              className={
                progress === 100
                  ? "text-emerald-800"
                  : "text-red-700"
              }
            >
              {progress === 100
                ? "✓ Đủ điều kiện chuyển đóng gói"
                : "⚠ Chưa đủ điều kiện chuyển đóng gói"}
            </span>
          </div>
        </section>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-sm font-black">
                  Danh sách vật tư xuất kho (Pick List)
                </h2>

                <p className="mt-1 text-[10px] text-slate-500">
                  Kiểm tra từng SKU, serial và ảnh hiện trạng
                  trước khi đóng gói.
                </p>
              </div>

              <span className="rounded bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-800">
                Chế độ kiểm tra nhanh
              </span>
            </div>

            {gearItems.map((item) => (
              <GearCard
                key={item.id}
                item={item}
                checked={checkedIds.includes(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
            ))}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <label
                htmlFor="warehouse-note"
                className="text-xs font-black text-slate-900"
              >
                Ghi chú kiểm kho cuối cùng
              </label>

              <textarea
                id="warehouse-note"
                className="mt-2 min-h-24 w-full resize-none rounded-lg bg-[#edf3ff] p-3 text-xs outline-none focus:ring-2 focus:ring-emerald-700"
                placeholder="Nhập tình trạng kiểm tra tồn, số lượng loa, độ đàn hồi nút PTT..."
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500">
                  Chỉ hoàn tất khi toàn bộ vật tư đã được quét
                  và nghiệm thu.
                </span>

                <button
                  type="button"
                  onClick={finishPicking}
                  disabled={progress !== 100}
                  className="rounded-lg bg-[#125238] px-6 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Hoàn tất nghiệm thu & Chuyển đóng gói
                </button>
              </div>

             {completed && (
  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-100 p-3 text-xs font-bold text-emerald-900">
    <span>
      Đã nghiệm thu đủ thiết bị. Đơn hàng sẵn sàng chuyển
      sang bước Đóng gói & QA.
    </span>

    <Link
      href={`/staff/orders/${orderId}/packing`}
      className="rounded-lg bg-[#125238] px-4 py-2 text-xs font-black text-white"
    >
      Tiếp tục đóng gói →
    </Link>
  </div>
)}
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black">
                    Zebra TC26 Telemetry
                  </h3>

                  <p className="mt-1 text-[10px] text-slate-500">
                    Thiết bị quét đang kết nối trực tiếp.
                  </p>
                </div>

                <span className="rounded bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-800">
                  ĐÃ KẾT NỐI
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <dt>Thiết bị</dt>
                  <dd className="font-mono font-bold">
                    ZEBRA-TC26-04
                  </dd>
                </div>

                <div className="flex justify-between">
                  <dt>Trigger</dt>
                  <dd className="font-bold">Phải / Trái</dd>
                </div>

                <div className="flex justify-between">
                  <dt>Chuyển món kế tiếp</dt>
                  <dd className="font-bold">Tab / F2</dd>
                </div>

                <div className="flex justify-between">
                  <dt>Chụp ảnh nhanh</dt>
                  <dd className="font-bold">Enter</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-black">
                Quy chuẩn nghiệm thu TrekOps
              </h3>

              <ul className="mt-3 space-y-3 text-[10px] leading-5 text-slate-600">
                <li>
                  <strong>Thiết bị điện tử:</strong> test còi
                  báo khẩn, GPS, bộ đàm và sạc dự phòng.
                </li>

                <li>
                  <strong>Túi ngủ & đệm hơi:</strong> kiểm tra
                  vải, khóa zip và độ kín van.
                </li>

                <li>
                  <strong>Lều cắm trại:</strong> kiểm đủ cọc
                  neo, dây chằng và tấm phủ.
                </li>

                <li>
                  <strong>Gậy leo núi:</strong> khóa FlickLock
                  chịu lực tối thiểu 65 kg.
                </li>
              </ul>
            </section>

            <section className="rounded-xl bg-[#dce7fa] p-4">
              <h3 className="text-xs font-black text-emerald-900">
                Thẻ niêm phong Seal đa cấp phát
              </h3>

              <p className="mt-2 text-[10px] leading-5 text-slate-600">
                Mã chỉ seal:{" "}
                <strong>SEAL-TK-8925-A</strong>. Khi hoàn tất
                đóng gói, hệ thống khóa luồng và chuyển đơn
                sang khu vực xuất xe.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}