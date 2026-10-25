"use client";

import React, { useState } from "react";
import { TripData, TripCostBreakdownItem } from "../../data/mockTripsData";

const CATEGORY_META: Record<
  string,
  { label: string; icon: string; badgeClass: string; rowBg: string }
> = {
  TRANSPORT: {
    label: "Di chuyển / Xe",
    icon: "🚌",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    rowBg: "hover:bg-blue-50/30",
  },
  FOOD: {
    label: "Ăn uống dã ngoại",
    icon: "🍱",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    rowBg: "hover:bg-amber-50/30",
  },
  SAFETY: {
    label: "Bảo hiểm & An toàn",
    icon: "🛡️",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rowBg: "hover:bg-emerald-50/30",
  },
  STAFF: {
    label: "Nhân sự / Porter",
    icon: "🎒",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    rowBg: "hover:bg-purple-50/30",
  },
  ACCOMMODATION: {
    label: "Lưu trú / Lều trại",
    icon: "⛺",
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    rowBg: "hover:bg-teal-50/30",
  },
  PERMIT: {
    label: "Vé VQG & Giấy phép",
    icon: "🎫",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    rowBg: "hover:bg-indigo-50/30",
  },
  EQUIPMENT: {
    label: "Trang bị đoàn",
    icon: "🧗",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
    rowBg: "hover:bg-orange-50/30",
  },
  OTHER: {
    label: "Khoản chi khác",
    icon: "💡",
    badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
    rowBg: "hover:bg-slate-50/30",
  },
};

function inferCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("xe") || lower.includes("chuyển") || lower.includes("đón")) return "TRANSPORT";
  if (lower.includes("ăn") || lower.includes("nước") || lower.includes("thực phẩm") || lower.includes("cơm")) return "FOOD";
  if (lower.includes("bảo hiểm") || lower.includes("y tế") || lower.includes("cứu hộ") || lower.includes("an toàn") || lower.includes("sơ cứu")) return "SAFETY";
  if (lower.includes("porter") || lower.includes("dẫn đường") || lower.includes("hướng dẫn")) return "STAFF";
  if (lower.includes("lều") || lower.includes("trại") || lower.includes("khách sạn") || lower.includes("homestay")) return "ACCOMMODATION";
  if (lower.includes("vé") || lower.includes("vườn quốc gia") || lower.includes("giấy phép")) return "PERMIT";
  if (lower.includes("thiết bị") || lower.includes("gậy") || lower.includes("bộ đàm") || lower.includes("balo")) return "EQUIPMENT";
  return "OTHER";
}

function formatCostBasis(item: TripCostBreakdownItem): string {
  switch (item.basis) {
    case "PER_CAPACITY_UNIT":
      return item.capacityPerUnit
        ? `Xe / Đơn vị (Sức chứa ${item.capacityPerUnit} người)`
        : "Theo sức chứa";
    case "PER_PERSON_PER_DAY":
      return "Theo mỗi khách / ngày";
    case "PER_PERSON":
      return "Mỗi khách (trọn chuyến)";
    case "PER_DAY":
      return "Cố định theo ngày";
    case "FIXED_PER_TRIP":
      return "Cố định trọn chuyến";
    default:
      return "Khoản chi trọn gói";
  }
}

export const TripCostBreakdown = ({ trip }: { trip: TripData }) => {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  // 1. Nếu chuyến đi có dữ liệu costItems đầy đủ từ cost-plan
  let displayItems: TripCostBreakdownItem[] = [];
  if (trip.costItems && trip.costItems.length > 0) {
    displayItems = trip.costItems;
  } else if (trip.includedServices && trip.includedServices.length > 0) {
    // 2. Tự động chuyển đổi từ includedServices & excludedServices
    displayItems = [
      ...trip.includedServices.map((name) => ({
        category: inferCategory(name),
        name,
        unitPrice: 0,
        includedInPrice: true,
        sourceNote: "Đã bao gồm trong chi phí vé trọn gói",
      })),
      ...(trip.excludedServices || []).map((name) => ({
        category: inferCategory(name),
        name,
        unitPrice: 0,
        includedInPrice: false,
        sourceNote: "Khách tự túc chi trả",
      })),
    ];
  } else {
    // 3. Fallback tiêu chuẩn
    displayItems = [
      {
        category: "TRANSPORT",
        name: "Xe du lịch đưa đón khứ hồi",
        basis: "PER_CAPACITY_UNIT",
        capacityPerUnit: 15,
        unitPrice: 4500000,
        includedInPrice: true,
        sourceNote: "Xe đón trả theo các điểm hẹn cố định của đoàn",
      },
      {
        category: "FOOD",
        name: "Suất ăn dã ngoại & Nước suối bổ sung",
        basis: "PER_PERSON_PER_DAY",
        unitPrice: 150000,
        includedInPrice: true,
        sourceNote: "Tiêu chuẩn đồ ăn dinh dưỡng cao cho trekking",
      },
      {
        category: "SAFETY",
        name: "Vé Vườn Quốc Gia & Bảo hiểm du lịch VFRS",
        basis: "PER_PERSON",
        unitPrice: 180000,
        includedInPrice: true,
        sourceNote: "Mức bồi thường bảo hiểm tối đa 100.000.000đ/vụ",
      },
      {
        category: "STAFF",
        name: "Phụ cấp Porter & Dẫn đường địa phương",
        basis: "PER_DAY",
        unitPrice: 700000,
        includedInPrice: true,
        sourceNote: "Người bản địa thông thuộc địa hình dẫn đường an toàn",
      },
    ];
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition hover:shadow-md sm:p-7">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-lg text-emerald-800 shadow-sm">
              💵
            </span>
            <h2 className="text-xl font-extrabold text-gray-900">
              Chi Tiết Khoản Tiền &amp; Minh Bạch Giá Vé
            </h2>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Cam kết tài chính minh bạch: Mọi khoản chi phí thuê xe, ăn uống, vé rừng, bảo hiểm...
            đều được công khai rõ ràng cho thành viên.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-[#1B5E41]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Minh bạch 100%
          </span>
        </div>
      </div>

      {/* Danh sách các khoản tiền */}
      <div className="mt-5 space-y-3">
        {displayItems.map((item, idx) => {
          const meta = CATEGORY_META[item.category] || CATEGORY_META.OTHER;
          const hasPrice = Number(item.unitPrice) > 0;

          return (
            <div
              key={item.id || idx}
              className={`group flex flex-col justify-between gap-3 rounded-xl border border-gray-100 bg-slate-50/60 p-4 transition sm:flex-row sm:items-center ${meta.rowBg}`}
            >
              {/* Cột trái: Tag & Tên khoản chi & Ghi chú */}
              <div className="space-y-1.5 sm:max-w-[62%]">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </span>
                  {item.basis && (
                    <span className="text-xs font-medium text-slate-400">
                      • {formatCostBasis(item)}
                    </span>
                  )}
                </div>

                <div className="text-sm font-bold text-gray-900">{item.name}</div>

                {item.sourceNote && (
                  <div className="text-xs text-slate-500">{item.sourceNote}</div>
                )}
              </div>

              {/* Cột phải: Đơn giá & Checkbox trạng thái */}
              <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-0 sm:text-right">
                {hasPrice ? (
                  <div>
                    <div className="text-sm font-black text-gray-900">
                      {Number(item.unitPrice).toLocaleString("vi-VN")}đ
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.basis === "PER_CAPACITY_UNIT"
                        ? `giá thuê trọn gói`
                        : item.basis === "PER_PERSON_PER_DAY"
                        ? `/người /ngày`
                        : item.basis === "PER_PERSON"
                        ? `/người`
                        : item.basis === "PER_DAY"
                        ? `/ngày`
                        : `khoản chi đoàn`}
                    </div>
                  </div>
                ) : null}

                {item.includedInPrice ? (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                    ✓ Đã gồm trong vé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    Khách tự túc
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Card tóm tắt cấu thành giá vé trọn gói */}
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-slate-50/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                Giá Trọn Gói Thành Viên
              </span>
              <span className="text-xs font-bold text-emerald-900">
                Không phát sinh phụ phí dọc đường
              </span>
            </div>
            <div className="text-2xl font-black text-[#1B5E41]">
              {trip.price.toLocaleString("vi-VN")}đ
              <span className="ml-1 text-xs font-semibold text-slate-500">/ 1 người</span>
            </div>
            <p className="text-xs text-slate-600">
              Quy mô đoàn tối thiểu khởi hành: <strong>{trip.slots.min || 5} thành viên</strong>{" "}
              (Tối đa: {trip.slots.total} chỗ).
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => setShowFormulaDetails(!showFormulaDetails)}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
            >
              {showFormulaDetails ? "Ẩn công thức định giá ▲" : "Xem cơ chế định giá ▼"}
            </button>
            <div className="text-[11px] text-slate-400">
              Được bảo trợ bởi chính sách VFRS &amp; Vina TrekGO
            </div>
          </div>
        </div>

        {/* Giải trình chi tiết nếu bấm mở */}
        {showFormulaDetails && (
          <div className="mt-4 border-t border-emerald-100 pt-3 text-xs text-slate-700 space-y-2">
            <div className="rounded-xl bg-white p-3.5 border border-emerald-100/80">
              <div className="font-bold text-slate-900 mb-1">
                📌 Cơ chế phân bổ chi phí của Vina TrekGO:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>
                  <strong>Chi phí cố định (Xe 16 chỗ, Porter):</strong> Được chia đều trên lượng khách tối thiểu để đảm bảo dù đoàn ít người nhất chuyến đi vẫn diễn ra an toàn.
                </li>
                <li>
                  <strong>Biến phí (Ăn uống, Vé VQG):</strong> Tính chính xác theo đầu người thực tế tham gia.
                </li>
                <li>
                  <strong>Quỹ rủi ro 5%:</strong> Dự phòng phát sinh y tế, thuốc men, thời tiết dọc đường rừng.
                </li>
              </ul>
              {trip.priceExplanation && (
                <div className="mt-2.5 rounded-lg bg-emerald-50/60 p-2.5 text-[11px] text-emerald-900 font-mono">
                  {trip.priceExplanation}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
