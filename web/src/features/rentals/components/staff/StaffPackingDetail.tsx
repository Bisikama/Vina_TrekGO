"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PackageId = "package-1" | "package-2";

type PackageItem = {
  name: string;
  sku: string;
  quantity: string;
  status: string;
};

type RentalPackage = {
  id: PackageId;
  number: number;
  title: string;
  packageType: string;
  weight: string;
  dimensions: string;
  seal: string;
  items: PackageItem[];
  requirements: string[];
};

const packages: RentalPackage[] = [
  {
    id: "package-1",
    number: 1,
    title: "Lều trại & Vật tư cắm trại",
    packageType: "Thùng carton chống ẩm 5 lớp",
    weight: "8.5 kg",
    dimensions: "60 × 40 × 35 cm",
    seal: "SEAL-TK-8925-01",
    items: [
      {
        name: "Lều Naturehike Cloud Up 2 Pro",
        sku: "NH-CLD-02P",
        quantity: "02 bộ",
        status: "Đã xếp dây thừng, lót xốp khí",
      },
      {
        name: "Túi ngủ lông vũ chịu lạnh CWB200",
        sku: "TN-CWB-200F",
        quantity: "02 chiếc",
        status: "Đã hút chân không & nén gọn",
      },
    ],
    requirements: [
      "Đã bỏ túi chống ẩm Silicagel 50g",
      "Đã chèn xốp giảm chấn xung quanh",
      "Băng keo niêm phong TrekOps mép thùng",
      "Đã dập mã seal an toàn SEAL-TK-8925-01",
    ],
  },
  {
    id: "package-2",
    number: 2,
    title: "Phụ kiện leo dốc & Thiết bị điện tử",
    packageType: "Thùng nhựa cứng chuyên dụng chống sốc",
    weight: "3.2 kg",
    dimensions: "45 × 30 × 25 cm",
    seal: "SEAL-TK-8925-02",
    items: [
      {
        name: "Gậy leo núi Carbon Trail Pro Shock",
        sku: "BD-TPS-CRB",
        quantity: "02 chiếc (1 cặp)",
        status: "Đã bọc đệm đầu carbide",
      },
      {
        name: "Bộ đàm UHF Motorola Talkabout T82 Pro",
        sku: "MOT-T82-PRO",
        quantity: "01 máy",
        status: "Pin 100%, hộp Pelican",
      },
    ],
    requirements: [
      "Tắt nguồn & tháo pin dự phòng",
      "Khóa nẹp gậy trek chắc chắn",
      "Đã khóa chốt seal SEAL-TK-8925-02",
    ],
  },
];

const qrPattern = [
  1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1,
  1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1,
  1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1,
  1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0,
  0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0,
  1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1,
  0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1,
  1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0,
  1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1,
  1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1,
  1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1,
  1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1,
];

function PackageCard({
  data,
  checked,
  onToggle,
  onPreview,
}: {
  data: RentalPackage;
  checked: boolean[];
  onToggle: (index: number) => void;
  onPreview: () => void;
}) {
  const complete = checked.every(Boolean);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm font-black text-emerald-900">
            #{String(data.number).padStart(2, "0")}
          </div>

          <div>
            <h2 className="text-base font-black text-slate-950">
              Kiện {data.number}/2: {data.title}
            </h2>

            <p className="mt-1 text-[11px] text-slate-600">
              ⚖ Trọng lượng: <strong>{data.weight}</strong>
              <span className="mx-2">•</span>
              ◿ Kích thước: <strong>{data.dimensions}</strong>
            </p>
          </div>
        </div>

        <span className="max-w-52 rounded-md bg-orange-100 px-3 py-2 text-[10px] font-bold text-orange-900">
          {data.packageType}
        </span>
      </div>

      <button
        type="button"
        onClick={onPreview}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-1.5 text-[11px] font-black text-red-800"
      >
        🔒 {data.seal}
        <span className="h-2 w-2 rounded-full bg-red-500" />
      </button>

      <div className="mt-5 rounded-xl bg-[#f0f4fc] p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_150px] px-2 pb-2 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-600">
          <span>
            Danh mục thiết bị bên trong kiện ({data.items.length} sản phẩm)
          </span>
          <span>Trạng thái bao gói</span>
        </div>

        <div className="space-y-2">
          {data.items.map((item, index) => (
            <div
              key={item.sku}
              className="grid items-center gap-3 rounded-lg bg-white p-3 sm:grid-cols-[44px_minmax(0,1fr)_150px]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-slate-800 to-emerald-700 text-lg text-white">
                {index === 0 ? "⛺" : "🎒"}
              </div>

              <div>
                <p className="text-xs font-black text-slate-900">
                  {item.name}
                </p>

                <p className="mt-1 text-[10px] text-slate-600">
                  Số lượng: <strong>{item.quantity}</strong>

                  <span className="ml-2 rounded bg-[#e4ebf8] px-2 py-1 font-mono text-[9px]">
                    {item.sku}
                  </span>
                </p>
              </div>

              <span className="rounded-md bg-emerald-100 px-3 py-2 text-[10px] font-semibold text-emerald-800">
                ✓ {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-black uppercase text-slate-800">
          Quy chuẩn đóng gói TrekSafe kiện {data.number} (
          {checked.filter(Boolean).length}/{checked.length} yêu cầu)
        </h3>

        <span
          className={`text-[10px] font-bold ${
            complete ? "text-emerald-800" : "text-orange-700"
          }`}
        >
          {complete ? "Hoàn tất kiểm tra" : "Chưa hoàn tất"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.requirements.map((requirement, index) => (
          <label
            key={requirement}
            className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#edf3ff] p-3 text-[10px] font-medium text-slate-700"
          >
            <input
              type="checkbox"
              checked={checked[index]}
              onChange={() => onToggle(index)}
              className="h-4 w-4 accent-[#125238]"
            />

            {requirement}
          </label>
        ))}
      </div>
    </article>
  );
}

function QrLabel({
  orderId,
  data,
}: {
  orderId: string;
  data: RentalPackage;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
        <div>
          <p className="text-xs font-black">TREKOPS LOGISTICS</p>
          <p className="text-[8px] uppercase text-slate-500">
            Phiếu giao vận dã ngoại
          </p>
        </div>

        <span className="rounded bg-slate-950 px-2 py-1 text-[8px] font-bold text-white">
          KIỆN {data.number}/02
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between rounded bg-[#e7eefc] px-3 py-2 text-[9px] font-black">
        <span>HN ➜ TÀ XÙA (SƠN LA)</span>
        <span>DOCK A · XE-04</span>
      </div>

      <div className="mt-4 grid grid-cols-[96px_1fr] gap-4">
        <div>
          <div className="grid aspect-square grid-cols-12 bg-white p-1">
            {qrPattern.map((cell, index) => (
              <span
                key={index}
                className={cell ? "bg-slate-950" : "bg-white"}
              />
            ))}
          </div>

          <p className="mt-1 text-center font-mono text-[7px]">
            QR-MANIFEST-8925-P{data.number}
          </p>
        </div>

        <div className="space-y-2 text-[9px]">
          <div>
            <p className="text-[7px] uppercase text-slate-500">
              Mã đơn hàng
            </p>
            <p className="text-sm font-black">#{orderId}</p>
          </div>

          <div>
            <p className="text-[7px] uppercase text-slate-500">
              Người nhận / Khách hàng
            </p>
            <p className="font-bold">Hoàng Minh Quân</p>
            <p>SĐT: 0914 882 xxx</p>
          </div>

          <div>
            <p className="text-[7px] uppercase text-slate-500">
              Mountain Leader đi tour
            </p>
            <p className="font-bold">
              Hoàng Thu Trang (VFRS-L2)
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-2 border-y border-slate-200 py-3 text-[9px]">
        <div className="flex justify-between gap-3">
          <dt>Tập kết:</dt>
          <dd className="text-right font-bold">
            Nhà Hát Lớn HN ➜ Tà Xùa
          </dd>
        </div>

        <div className="flex justify-between gap-3">
          <dt>Khởi hành:</dt>
          <dd className="text-right font-bold">
            25/11/2024 · 05:00 Sáng
          </dd>
        </div>

        <div className="flex justify-between gap-3">
          <dt>Mã Seal:</dt>
          <dd className="rounded bg-red-100 px-2 font-bold text-red-700">
            {data.seal}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex h-8 items-end justify-center gap-[2px]">
        {Array.from({ length: 42 }).map((_, index) => (
          <span
            key={index}
            className="bg-slate-950"
            style={{
              width: index % 4 === 0 ? 3 : 1,
              height: index % 3 === 0 ? 28 : 23,
            }}
          />
        ))}
      </div>

      <p className="mt-1 text-center font-mono text-[8px] font-bold">
        *ORD-8925-P{data.number}*
      </p>
    </div>
  );
}

export function StaffPackingDetail({
  orderId,
}: {
  orderId: string;
}) {
  const [selectedPackageId, setSelectedPackageId] =
    useState<PackageId>("package-1");

  const [checks, setChecks] = useState<
    Record<PackageId, boolean[]>
  >({
    "package-1": packages[0].requirements.map(() => true),
    "package-2": packages[1].requirements.map(() => true),
  });

  const [printedCount, setPrintedCount] = useState(0);
  const [dispatchCreated, setDispatchCreated] =
    useState(false);

  const selectedPackage =
    packages.find(
      (item) => item.id === selectedPackageId,
    ) ?? packages[0];

  const allComplete = useMemo(
    () =>
      Object.values(checks).every((packageChecks) =>
        packageChecks.every(Boolean),
      ),
    [checks],
  );

  function toggleRequirement(
    packageId: PackageId,
    index: number,
  ) {
    setChecks((current) => ({
      ...current,
      [packageId]: current[packageId].map(
        (value, itemIndex) =>
          itemIndex === index ? !value : value,
      ),
    }));

    setDispatchCreated(false);
  }

  function createDispatch() {
    if (allComplete) {
      setDispatchCreated(true);
    }
  }

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Link
              href="/staff/work-queue"
              className="font-semibold hover:text-emerald-800"
            >
              Hàng Đợi Soạn Đồ
            </Link>

            <span>›</span>

            <Link
              href={`/staff/orders/${orderId}`}
              className="rounded bg-[#dce7fa] px-2 py-1 font-mono font-bold text-emerald-900"
            >
              #{orderId}
            </Link>

            <span>›</span>

            <strong className="text-slate-900">
              Quy trình Đóng gói Kiện & In Tem QR Seal
            </strong>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/staff/orders/${orderId}`}
              className="rounded-lg bg-[#edf3ff] px-4 py-2 text-[11px] font-bold text-slate-700"
            >
              ← Quay lại soạn hàng
            </Link>

            <button
              type="button"
              className="rounded-lg bg-emerald-100 px-4 py-2 text-[11px] font-bold text-emerald-900"
            >
              ☑ Xem ảnh nghiệm thu (6/6)
            </button>

            <button
              type="button"
              className="rounded-lg bg-[#edf3ff] px-4 py-2 text-[11px] font-bold text-slate-700"
            >
              ◷ Lịch sử đóng gói
            </button>
          </div>
        </div>

        <section className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-red-100 p-4 text-red-800">
          <div>
            <p className="text-sm font-black">
              🚛 XUẤT XE KHẨN CẤP | XUẤT XE TRUNG CHUYỂN:
              13:30 (Còn 18 phút)
            </p>

            <p className="mt-1 text-[10px]">
              Xe 16 chỗ #Xe-04 đang chờ nạp kiện tại{" "}
              <strong>Cửa xuất Dock A - Bãi 2</strong>. Hoàn
              tất seal và dán nhãn trước 13:20.
            </p>
          </div>

          <div className="rounded-lg bg-white/80 px-5 py-2 text-center">
            <p className="text-[9px] font-bold">
              THỜI GIAN CÒN LẠI
            </p>
            <p className="font-mono text-sm font-black">
              00:17:44
            </p>
          </div>
        </section>

        <section className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Tour & Lịch trình",
              "Tà Xùa Săn Mây 3N2Đ",
            ],
            [
              "Khách hàng thuê đồ",
              "Hoàng Minh Quân (0914 882 xxx)",
            ],
            [
              "Mountain Leader đón nhận",
              "Hoàng Thu Trang (Đội Phía Bắc)",
            ],
            [
              "Tiến độ nhặt hàng",
              "● 6 / 6 Thiết bị (100%)",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[9px] text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-xs font-black text-slate-900">
                {value}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-slate-950">
                  Phân bổ Kiện hàng & Thiết bị
                </h1>

                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">
                  2 Kiện đã chia
                </span>
              </div>

              <span className="rounded-full bg-[#e8eefb] px-3 py-2 text-[10px] font-semibold">
                🛡 Chuẩn TrekSafe 3 lớp chống thấm
              </span>
            </div>

            <div className="space-y-4">
              {packages.map((data) => (
                <PackageCard
                  key={data.id}
                  data={data}
                  checked={checks[data.id]}
                  onToggle={(index) =>
                    toggleRequirement(data.id, index)
                  }
                  onPreview={() =>
                    setSelectedPackageId(data.id)
                  }
                />
              ))}
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black">
                    Bản xem trước Tem Nhãn QR
                  </h2>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Chuẩn bưu kiện nhiệt 100 × 150 mm
                  </p>
                </div>

                <div className="flex rounded-lg bg-[#edf3ff] p-1 text-[9px] font-bold">
                  {packages.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() =>
                        setSelectedPackageId(item.id)
                      }
                      className={`rounded-md px-3 py-2 ${
                        selectedPackageId === item.id
                          ? "bg-[#125238] text-white"
                          : "text-slate-700"
                      }`}
                    >
                      Kiện {item.number}
                      <br />
                      ({item.weight})
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <QrLabel
                  orderId={orderId}
                  data={selectedPackage}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPrintedCount(
                      (current) => current + 1,
                    )
                  }
                  className="rounded-lg bg-[#125238] px-3 py-3 text-[11px] font-black text-white"
                >
                  🖨 In tem nhãn{" "}
                  {printedCount > 0
                    ? `(${printedCount})`
                    : ""}
                </button>

                <button
                  type="button"
                  className="rounded-lg bg-[#e7eefc] px-3 py-3 text-[11px] font-bold text-slate-800"
                >
                  ▣ Tải PDF (2 trang)
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black">
                    Lệnh Bàn Giao Xe Trung Chuyển
                  </h2>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Điều phối xuất kho chuyên lên tuyến đi
                  </p>
                </div>

                <span className="rounded bg-orange-100 px-2 py-1 text-[9px] font-bold text-orange-900">
                  Dock A - Sẵn sàng
                </span>
              </div>

              <div className="mt-4 rounded-xl bg-[#edf3ff] p-4 text-[10px] text-slate-700">
                <p className="text-xs font-black text-slate-900">
                  Xe 16 chỗ #Xe-04 · Biển số: 29B-618.92
                </p>

                <p className="mt-1">
                  Tuyến: Hà Nội → Mộc Châu → Tà Xùa
                </p>

                <div className="mt-3 border-t border-slate-200 pt-3">
                  Tài xế nhận kiện:{" "}
                  <strong>
                    Bác Hùng (0988 231 xxx)
                  </strong>
                </div>
              </div>

              <button
                type="button"
                disabled={!allComplete || dispatchCreated}
                onClick={createDispatch}
                className="mt-4 w-full rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {dispatchCreated
                  ? "✓ ĐÃ TẠO LỆNH GIAO HÀNG"
                  : "ĐÁNH DẤU SẴN SÀNG & TẠO LỆNH GIAO HÀNG"}
              </button>

              {dispatchCreated && (
                <div className="mt-3 rounded-xl bg-emerald-100 p-4 text-emerald-900">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black">
                      ĐÃ TẠO LỆNH GIAO HÀNG THÀNH CÔNG
                    </p>

                    <span className="rounded bg-white px-2 py-1 font-mono text-[9px] font-black">
                      #TASK-DELIV-2024-9042
                    </span>
                  </div>

                  <p className="mt-2 text-[10px] leading-5">
                    Hệ thống đã kết nối dữ liệu quét RFID/QR
                    của 2 kiện hàng. Chờ tài xế quét mã QR
                    nghiệm thu bàn giao tại Cửa xuất Dock A.
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      className="rounded bg-white p-2 text-[9px] font-bold"
                    >
                      Hàng đợi Dock A
                    </button>

                    <button
                      type="button"
                      className="rounded bg-white p-2 text-[9px] font-bold"
                    >
                      In phiếu xuất 3 liên
                    </button>

                    <Link
                      href="/staff/work-queue"
                      className="rounded bg-white p-2 text-center text-[9px] font-bold"
                    >
                      Đơn kế tiếp →
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}