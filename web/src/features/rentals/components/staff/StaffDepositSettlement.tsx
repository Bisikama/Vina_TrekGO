"use client";

import Link from "next/link";
import { useState } from "react";

type EquipmentResult = {
  id: string;
  name: string;
  sku: string;
  rfid: string;
  condition: string;
  conditionTone: "red" | "orange" | "green";
  deduction: number;
  action: string;
  note: string;
  icon: string;
};

const equipmentResults: EquipmentResult[] = [
  {
    id: "tent",
    name: "Lều Naturehike Cloud Up 2 Pro 20D",
    sku: "NH-CLD-02P",
    rfid: "RF-8821",
    condition: "Hư hại · Rách vải 15cm",
    conditionTone: "red",
    deduction: 350000,
    action: "Chuyển buồng bảo dưỡng / Sửa chữa",
    note: "Chuyển xưởng may ép seam Hub Cầu Giấy",
    icon: "⛺",
  },
  {
    id: "pole",
    name: "Gậy leo núi Black Diamond Trail Pro Shock",
    sku: "BD-TPS-CRB",
    rfid: "RF-1140",
    condition: "Hao mòn tự nhiên · Bùn đất",
    conditionTone: "orange",
    deduction: 0,
    action: "Chuyển làm sạch & Khử khuẩn",
    note: "Đưa vào máy rửa bùn áp lực",
    icon: "🥾",
  },
  {
    id: "radio",
    name: "Bộ đàm UHF Motorola Talkabout T82 Pro",
    sku: "MOT-T82-PRO",
    rfid: "RF-3312",
    condition: "Nguyên vẹn · Hoạt động tốt 100%",
    conditionTone: "green",
    deduction: 0,
    action: "Nhập kho sẵn sàng",
    note: "Đã cắm sạc đầy 100% dock Hub 01",
    icon: "📻",
  },
  {
    id: "sleeping-bag",
    name: "Túi ngủ lông vũ chịu lạnh CWB200",
    sku: "TN-CWB-200F",
    rfid: "RF-9402",
    condition: "Nguyên vẹn · Mùi mồ hôi nhẹ",
    conditionTone: "green",
    deduction: 0,
    action: "Chuyển làm sạch & Khử khuẩn",
    note: "Đưa vào buồng sấy ozone & khử khuẩn",
    icon: "🎒",
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function conditionClass(
  tone: EquipmentResult["conditionTone"],
) {
  if (tone === "red") {
    return "bg-red-100 text-red-700";
  }

  if (tone === "orange") {
    return "bg-orange-100 text-orange-800";
  }

  return "bg-emerald-100 text-emerald-800";
}

export function StaffDepositSettlement({
  returnId,
}: {
  returnId: string;
}) {
  const originalDeposit = 3000000;
  const equipmentDeduction = 350000;
  const transportFee = 100000;
  const totalDeduction =
    equipmentDeduction + transportFee;
  const refundAmount =
    originalDeposit - totalDeduction;

  const [actions, setActions] = useState<
    Record<string, string>
  >(
    Object.fromEntries(
      equipmentResults.map((item) => [
        item.id,
        item.action,
      ]),
    ),
  );

  const [note, setNote] = useState(
    "Khấu trừ rách vải lều 350k + phụ phí trễ chuyến xe 100k theo biên bản thỏa thuận hiện trường cùng Mountain Leader Hoàng Thu Trang.",
  );

  const [confirmed, setConfirmed] = useState(false);
  const [showConfirmation, setShowConfirmation] =
    useState(false);

  function confirmSettlement() {
    setConfirmed(true);
    setShowConfirmation(false);
  }

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">
              Kho & Thiết bị
              <span className="mx-2">›</span>
              <Link
                href="/staff/returns"
                className="hover:text-emerald-800"
              >
                Tiếp nhận Hoàn trả
              </Link>
              <span className="mx-2">›</span>
              Hồ sơ #{returnId}
              <span className="mx-2">›</span>
              <strong className="text-slate-900">
                Quyết toán cọc & Điều chuyển kho
              </strong>
            </div>

            <h1 className="mt-3 text-2xl font-black text-slate-950">
              Quyết toán Tiền cọc & Xử lý Sau kiểm định
            </h1>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded bg-[#e4ebf8] px-3 py-1.5 font-mono text-[10px] font-black text-emerald-900">
                #{returnId}
              </span>

              <span
                className={`rounded-full px-3 py-1.5 text-[10px] font-black ${
                  confirmed
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-orange-100 text-orange-800"
                }`}
              >
                {confirmed
                  ? "ĐÃ QUYẾT TOÁN CỌC"
                  : "CHỜ QUYẾT TOÁN CỌC"}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-[#edf3ff] px-4 py-3 text-xs font-bold"
            >
              ◷ Lịch sử biên bản
            </button>

            <button
              type="button"
              className="rounded-lg bg-[#edf3ff] px-4 py-3 text-xs font-bold"
            >
              ▣ In biên bản giám định
            </button>
          </div>
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Khách hàng Trekker",
              "Hoàng Minh Quân",
              "0914 882 xxx · CCCD: 0011******",
            ],
            [
              "Hành trình & Quy mô",
              "Tour Tà Xùa Săn Mây",
              "15 Trekker · 22/11 – 24/11",
            ],
            [
              "Mountain Leader xác nhận",
              "Hoàng Thu Trang",
              "✓ Ký biên bản 16:35",
            ],
            [
              "Trạm nhận & Giám định",
              "Hub North-01 Cầu Giấy",
              "Kiểm định viên: Nguyễn Văn An",
            ],
          ].map(([label, value, detail]) => (
            <article
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[9px] uppercase text-slate-500">
                {label}
              </p>

              <p className="mt-2 text-xs font-black text-slate-950">
                {value}
              </p>

              <p className="mt-1 text-[9px] text-slate-500">
                {detail}
              </p>
            </article>
          ))}
        </section>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Tổng hợp Kết quả Kiểm định & Điều phối
                  Vật tư
                </h2>

                <p className="mt-1 text-[10px] text-slate-500">
                  Lựa chọn khu vực chuyển tiếp cho từng
                  thiết bị theo quy chuẩn kho TrekOps.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[9px] font-bold">
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">
                  6 Món
                </span>

                <span className="rounded-full bg-[#edf3ff] px-3 py-1.5">
                  4 Đạt chuẩn
                </span>

                <span className="rounded-full bg-orange-100 px-3 py-1.5 text-orange-800">
                  1 Hư hại
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1.5">
                  1 Vệ sinh
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {equipmentResults.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl bg-[#edf3ff] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-emerald-700 text-2xl">
                        {item.icon}
                      </div>

                      <div>
                        <h3 className="text-xs font-black text-slate-950">
                          {item.name}
                        </h3>

                        <span
                          className={`mt-2 inline-flex rounded px-2 py-1 text-[9px] font-bold ${conditionClass(
                            item.conditionTone,
                          )}`}
                        >
                          {item.condition}
                        </span>

                        <p className="mt-2 font-mono text-[9px] text-slate-500">
                          SKU: {item.sku} · RFID: #
                          {item.rfid}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[9px] text-slate-500">
                        Phí khấu trừ đề xuất
                      </p>

                      <p
                        className={`mt-1 text-lg font-black ${
                          item.deduction > 0
                            ? "text-red-700"
                            : "text-slate-950"
                        }`}
                      >
                        {formatCurrency(item.deduction)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`action-${item.id}`}
                        className="text-[9px] font-semibold text-slate-600"
                      >
                        Hành động điều phối kho
                      </label>

                      <select
                        id={`action-${item.id}`}
                        value={actions[item.id]}
                        onChange={(event) =>
                          setActions((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        disabled={confirmed}
                        className="mt-1 h-10 w-full rounded-lg bg-white px-3 text-[10px] font-semibold outline-none disabled:opacity-60"
                      >
                        <option>
                          Nhập kho sẵn sàng
                        </option>
                        <option>
                          Chuyển làm sạch & Khử khuẩn
                        </option>
                        <option>
                          Chuyển buồng bảo dưỡng / Sửa chữa
                        </option>
                        <option>
                          Cách ly chờ xử lý
                        </option>
                      </select>
                    </div>

                    <div>
                      <p className="text-[9px] font-semibold text-slate-600">
                        Ghi chú phân luồng vận hành
                      </p>

                      <div className="mt-1 flex h-10 items-center rounded-lg bg-white px-3 text-[10px] text-slate-700">
                        {item.note} →
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-xl bg-[#edf3ff] p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black">
                        Đèn Petzl Actik Core
                      </h3>
                      <p className="mt-2 font-mono text-[9px] text-slate-500">
                        RFID: #RF-9011 · 450 Lumens
                      </p>
                    </div>

                    <span className="rounded bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800">
                      Tốt
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[10px]">
                    <span>Khấu trừ: 0₫</span>
                    <span className="rounded bg-white px-3 py-2 font-bold">
                      Nhập kho sẵn sàng
                    </span>
                  </div>
                </article>

                <article className="rounded-xl bg-[#edf3ff] p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black">
                        Balo Osprey Atmos 65L
                      </h3>
                      <p className="mt-2 font-mono text-[9px] text-slate-500">
                        RFID: #RF-4419 · Trầy nhẹ đáy
                      </p>
                    </div>

                    <span className="rounded bg-[#e4ebf8] px-2 py-1 text-[9px] font-bold">
                      Đạt chuẩn
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[10px]">
                    <span>Khấu trừ: 0₫</span>
                    <span className="rounded bg-white px-3 py-2 font-bold">
                      Nhập kho sẵn sàng
                    </span>
                  </div>
                </article>
              </div>

              <div className="rounded-xl bg-blue-100 p-4 text-[10px] leading-5 text-slate-700">
                ⟳ <strong>Đồng bộ tự động:</strong> Khi
                xác nhận quyết toán cọc, 6 thiết bị sẽ tự
                động cập nhật trạng thái trên hệ thống
                RFID và chuyển đến đúng phân khu Hub
                North-01.
              </div>
            </div>
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-950">
                Bảng Tính Quyết Toán Cọc
              </h2>

              <span className="rounded bg-[#edf3ff] px-2 py-1 text-[9px] font-bold">
                TrekPay Escrow
              </span>
            </div>

            <section className="mt-4 rounded-xl bg-[#edf3ff] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] text-slate-500">
                    Tiền cọc ban đầu giữ:
                  </p>

                  <p className="mt-2 text-xl font-black">
                    {formatCurrency(originalDeposit)}
                  </p>
                </div>

                <p className="text-[9px] text-slate-500">
                  Visa ••••8891
                </p>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-[9px] font-bold uppercase text-slate-500">
                  Danh mục các khoản khấu trừ
                </p>

                <dl className="mt-3 space-y-3 text-[10px]">
                  <div className="flex justify-between gap-3">
                    <dt>
                      Hư hại thiết bị
                      <br />
                      (Lều Cloud Up)
                    </dt>
                    <dd className="font-black text-red-700">
                      -350.000₫
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt>
                      Thất lạc phụ kiện / thiết bị
                    </dt>
                    <dd className="font-black">0₫</dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt>
                      Phụ phí trễ hạn trả đồ
                    </dt>
                    <dd className="font-black text-red-700">
                      -100.000₫
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt>Phí vệ sinh bùn đất đặc biệt</dt>
                    <dd className="font-black text-emerald-700">
                      TrekCare 0₫
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex justify-between border-t border-slate-300 pt-3 text-xs font-black">
                  <span>Tổng tiền khấu trừ:</span>
                  <span className="text-red-700">
                    -{formatCurrency(totalDeduction)}
                  </span>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-xl bg-[#125238] p-5 text-white">
              <p className="text-[9px] font-bold uppercase text-emerald-100">
                Số tiền hoàn trả thực tế
              </p>

              <p className="mt-2 text-4xl font-black">
                {formatCurrency(refundAmount)}
              </p>

              <p className="mt-2 text-[9px] text-emerald-100">
                Giải ngân tự động qua cổng NAPAS 24/7
              </p>
            </section>

            <section className="mt-4 rounded-xl bg-[#edf3ff] p-4">
              <p className="text-[9px] font-bold uppercase text-slate-500">
                Tài khoản nhận hoàn tiền
              </p>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black">
                    MB Bank · 998822456789
                  </p>
                  <p className="mt-1 text-[9px] text-slate-500">
                    HOÀNG MINH QUÂN
                  </p>
                </div>

                <span className="rounded bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800">
                  Đã khớp tên
                </span>
              </div>
            </section>

            <div className="mt-4">
              <label
                htmlFor="settlement-note"
                className="text-[10px] font-black"
              >
                Ghi chú quyết toán nội bộ:
              </label>

              <textarea
                id="settlement-note"
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                disabled={confirmed}
                className="mt-2 min-h-24 w-full resize-none rounded-lg bg-[#edf3ff] p-3 text-[10px] leading-5 outline-none disabled:opacity-60"
              />
            </div>

            <label className="mt-4 flex items-start gap-2 text-[9px] leading-5 text-slate-600">
              <input
                type="checkbox"
                defaultChecked
                disabled={confirmed}
                className="mt-1 accent-[#125238]"
              />

              Gửi thông báo SMS & Email chi tiết biên
              bản giải ngân và hóa đơn khấu trừ cho
              khách hàng.
            </label>

            {!confirmed ? (
              <button
                type="button"
                onClick={() =>
                  setShowConfirmation(true)
                }
                className="mt-4 w-full rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white"
              >
                Khấu trừ & Hoàn trả{" "}
                {formatCurrency(refundAmount)}
              </button>
            ) : (
              <div className="mt-4 rounded-xl bg-emerald-100 p-4 text-emerald-900">
                <p className="text-sm font-black">
                  ✓ ĐÃ QUYẾT TOÁN TIỀN CỌC THÀNH CÔNG
                </p>

                <p className="mt-2 font-mono text-[9px]">
                  #TX-REFUND-2024-9941
                </p>

                <p className="mt-2 text-[10px] leading-5">
                  Đã hoàn {formatCurrency(refundAmount)}{" "}
                  về MB Bank và cập nhật trạng thái 6
                  thiết bị.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded bg-white px-3 py-2 text-[9px] font-bold"
                  >
                    In biên lai PDF
                  </button>

                  <Link
                    href="/staff/work-queue"
                    className="rounded bg-white px-3 py-2 text-center text-[9px] font-bold"
                  >
                    Về hàng đợi
                  </Link>
                </div>
              </div>
            )}
          </aside>
        </div>

        {showConfirmation && !confirmed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase text-emerald-800">
                    Xác nhận Quyết toán Tiền cọc
                  </p>

                  <h2 className="mt-2 text-xl font-black text-slate-950">
                    Hồ sơ #{returnId}
                  </h2>
                </div>

                <span className="rounded-full bg-orange-100 px-3 py-1 text-[9px] font-bold text-orange-800">
                  Chờ lệnh
                </span>
              </div>

              <div className="mt-5 rounded-xl bg-[#edf3ff] p-4">
                <dl className="space-y-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt>Trekker thụ hưởng:</dt>
                    <dd className="font-black">
                      Hoàng Minh Quân
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt>Tổng khấu trừ:</dt>
                    <dd className="font-black text-red-700">
                      -{formatCurrency(totalDeduction)}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt>Thực nhận chuyển khoản:</dt>
                    <dd className="font-black text-emerald-800">
                      {formatCurrency(refundAmount)}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt>Chuyển về tài khoản:</dt>
                    <dd className="font-black">
                      MB Bank ******6789
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 rounded-lg bg-blue-50 p-3 text-[10px] text-slate-600">
                Chữ ký đối soát: Leader Hoàng Thu Trang
                & Thủ kho Nguyễn Văn An.
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmation(false)
                  }
                  className="rounded-lg bg-[#edf3ff] px-4 py-3 text-xs font-bold"
                >
                  Hủy thao tác
                </button>

                <button
                  type="button"
                  onClick={confirmSettlement}
                  className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white"
                >
                  Xác nhận & Giải ngân cọc ngay
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}