"use client";

import React, { useState } from "react";
import type {
  CostBasis,
  CostCategory,
  CostItemInput,
  CostKind,
} from "../../types/leader-pricing";

interface CostPlanBuilderProps {
  items: CostItemInput[];
  durationDays: number;
  capacity: number;
  onChange: (items: CostItemInput[]) => void;
  disabled?: boolean;
}

const CATEGORIES: Array<{ key: CostCategory; label: string; icon: string }> = [
  { key: "TRANSPORT", label: "Di chuyển / Xe", icon: "🚌" },
  { key: "STAFF", label: "Nhân sự / Porter", icon: "🧗" },
  { key: "FOOD", label: "Ăn uống dã ngoại", icon: "🍱" },
  { key: "ACCOMMODATION", label: "Lưu trú / Lều trại", icon: "⛺" },
  { key: "ACCESS", label: "Vé rừng / Giấy phép", icon: "🎫" },
  { key: "SAFETY", label: "Bảo hiểm & An toàn", icon: "🛡️" },
  { key: "LOGISTICS", label: "Hậu cần / Thuê đồ", icon: "📦" },
  { key: "OTHER", label: "Khoản chi khác", icon: "💡" },
];

type BasisOption = {
  id: string;
  kind: CostKind;
  basis: CostBasis;
  label: string;
  description: string;
};

const BASIS_OPTIONS: BasisOption[] = [
  {
    id: "FIXED_PER_TRIP",
    kind: "FIXED",
    basis: "PER_TRIP",
    label: "Cố định trọn chuyến",
    description: "Chi phí cố định cho cả đoàn, không đổi theo số lượng khách",
  },
  {
    id: "FIXED_PER_DAY",
    kind: "FIXED",
    basis: "PER_DAY",
    label: "Cố định theo ngày",
    description: "Đơn giá × Số ngày đi của chuyến",
  },
  {
    id: "VARIABLE_PER_PERSON",
    kind: "VARIABLE",
    basis: "PER_PERSON",
    label: "Theo mỗi khách (trọn chuyến)",
    description: "Tính theo số lượng khách trả tiền tham gia đoàn",
  },
  {
    id: "VARIABLE_PER_PERSON_PER_DAY",
    kind: "VARIABLE",
    basis: "PER_PERSON_PER_DAY",
    label: "Theo mỗi khách / mỗi ngày",
    description: "Đơn giá × Số khách × Số ngày đi",
  },
  {
    id: "STEP_PER_CAPACITY_UNIT",
    kind: "STEP",
    basis: "PER_CAPACITY_UNIT",
    label: "Theo sức chứa (Xe / Lều / Porter)",
    description: "Tự động nhảy thêm 1 đơn vị khi vượt sức chứa mỗi xe/lều",
  },
  {
    id: "STEP_PER_GROUP_TIER",
    kind: "STEP",
    basis: "PER_GROUP_TIER",
    label: "Phụ phí nhảy bậc theo số khách",
    description: "Cộng thêm phụ phí khi quy mô đoàn đạt các mốc khách nhất định",
  },
];

export function CostPlanBuilder({
  items,
  durationDays,
  capacity,
  onChange,
  disabled = false,
}: CostPlanBuilderProps) {
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const handleApplyStandardCombo = () => {
    const days = durationDays > 0 ? durationDays : 2;
    const standardCombo: CostItemInput[] = [
      {
        category: "TRANSPORT",
        name: "Thuê xe 16 chỗ khứ hồi",
        kind: "STEP",
        basis: "PER_CAPACITY_UNIT",
        unitPrice: "4500000",
        quantity: 1,
        durationUnits: 1,
        capacityPerUnit: 15,
        extraNonPayingPax: 0,
        includedInPrice: true,
        isEnabled: true,
        sourceNote: "Xe trung chuyển đón trả đoàn tận nơi",
      },
      {
        category: "FOOD",
        name: "Suất ăn dã ngoại & Nước suối",
        kind: "VARIABLE",
        basis: "PER_PERSON_PER_DAY",
        unitPrice: "150000",
        quantity: 1,
        durationUnits: days,
        capacityPerUnit: null,
        extraNonPayingPax: 0,
        includedInPrice: true,
        isEnabled: true,
        sourceNote: "Bao gồm ăn sáng, trưa, tối dã ngoại",
      },
      {
        category: "SAFETY",
        name: "Vé Vườn Quốc Gia & Bảo hiểm du lịch VFRS",
        kind: "VARIABLE",
        basis: "PER_PERSON",
        unitPrice: "180000",
        quantity: 1,
        durationUnits: 1,
        capacityPerUnit: null,
        extraNonPayingPax: 0,
        includedInPrice: true,
        isEnabled: true,
        sourceNote: "Bảo hiểm tai nạn mức 100tr và vé qua trạm kiểm lâm",
      },
      {
        category: "STAFF",
        name: "Phụ cấp Porter & Dẫn đường địa phương",
        kind: "FIXED",
        basis: "PER_DAY",
        unitPrice: "700000",
        quantity: 1,
        durationUnits: days,
        capacityPerUnit: null,
        extraNonPayingPax: 0,
        includedInPrice: true,
        isEnabled: true,
        sourceNote: "Hỗ trợ dẫn đường và mang vác trang bị chung",
      },
    ];

    onChange(standardCombo);
    setShowPresetMenu(false);
  };

  const handleAddItem = (preset?: Partial<CostItemInput>) => {
    const newItem: CostItemInput = {
      category: preset?.category || "OTHER",
      name: preset?.name || "Khoản chi phí mới",
      kind: preset?.kind || "FIXED",
      basis: preset?.basis || "PER_TRIP",
      unitPrice: preset?.unitPrice || "500000",
      quantity: preset?.quantity || 1,
      durationUnits: preset?.durationUnits || (durationDays > 0 ? durationDays : 1),
      capacityPerUnit: preset?.capacityPerUnit || null,
      extraNonPayingPax: 0,
      includedInPrice: preset?.includedInPrice ?? true,
      isEnabled: true,
      sourceNote: preset?.sourceNote || null,
      stepTiers: preset?.stepTiers || [],
    };
    onChange([...items, newItem]);
    setShowPresetMenu(false);
  };

  const handleUpdateItem = (index: number, updates: Partial<CostItemInput>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  };

  // Tính sơ bộ tổng cố định & biến đổi để hiển thị nhanh
  const activeItems = items.filter((i) => i.isEnabled && i.includedInPrice);
  const quickFixedTotal = activeItems
    .filter((i) => i.kind === "FIXED")
    .reduce((sum, item) => {
      const u = Number(item.unitPrice) || 0;
      const q = item.quantity || 1;
      const d = item.basis === "PER_DAY" ? item.durationUnits || 1 : 1;
      return sum + u * q * d;
    }, 0);

  const quickVarPerPax = activeItems
    .filter((i) => i.kind === "VARIABLE")
    .reduce((sum, item) => {
      const u = Number(item.unitPrice) || 0;
      const q = item.quantity || 1;
      const d = item.basis === "PER_PERSON_PER_DAY" ? item.durationUnits || 1 : 1;
      return sum + u * q * d;
    }, 0);

  return (
    <div className="space-y-4">
      {/* Header & Thanh công cụ */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#1B5E41]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Bảng Kê Dự Toán Chi Phí Chuyến Đi
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              {items.length} khoản chi
            </span>
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Các khoản bật <strong>&quot;Gồm trong vé&quot;</strong> sẽ được tự động trích xuất hiển thị cho khách và nạp vào Simulator tính giá.
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          {/* Nút 1-click nạp combo mẫu chuẩn */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleApplyStandardCombo}
            title="Tự động điền 4 khoản chi phí trekking tiêu chuẩn: Xe, Ăn uống, Vé rừng, Porter"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Áp dụng bộ chi phí chuẩn
          </button>

          {/* Menu chọn Preset lẻ từng món */}
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowPresetMenu(!showPresetMenu)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Thêm từng món mẫu
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showPresetMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-72 z-20 rounded-xl border border-gray-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                  Mẫu chi phí trekking lẻ
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleAddItem({
                      category: "TRANSPORT",
                      name: "Thuê xe 16 chỗ khứ hồi",
                      kind: "STEP",
                      basis: "PER_CAPACITY_UNIT",
                      unitPrice: "4500000",
                      capacityPerUnit: 15,
                      includedInPrice: true,
                    })
                  }
                  className="w-full text-left rounded-lg p-2 text-xs hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                >
                  <span className="text-base">🚌</span>
                  <div>
                    <div className="font-semibold text-gray-800">Xe trung chuyển 16 chỗ</div>
                    <div className="text-[10px] text-gray-500">4.500.000đ/xe (nhảy thêm xe khi &gt;15 người)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAddItem({
                      category: "STAFF",
                      name: "Phụ cấp Porter & Dẫn đường địa phương",
                      kind: "FIXED",
                      basis: "PER_DAY",
                      unitPrice: "700000",
                      quantity: 1,
                      durationUnits: durationDays > 0 ? durationDays : 1,
                      includedInPrice: true,
                    })
                  }
                  className="w-full text-left rounded-lg p-2 text-xs hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                >
                  <span className="text-base">🧗</span>
                  <div>
                    <div className="font-semibold text-gray-800">Porter / Dẫn đường theo ngày</div>
                    <div className="text-[10px] text-gray-500">700.000đ/ngày × {durationDays || 1} ngày</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAddItem({
                      category: "SAFETY",
                      name: "Vé Vườn Quốc Gia & Bảo hiểm du lịch",
                      kind: "VARIABLE",
                      basis: "PER_PERSON",
                      unitPrice: "180000",
                      includedInPrice: true,
                    })
                  }
                  className="w-full text-left rounded-lg p-2 text-xs hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                >
                  <span className="text-base">🎫</span>
                  <div>
                    <div className="font-semibold text-gray-800">Vé vào rừng & Bảo hiểm VFRS</div>
                    <div className="text-[10px] text-gray-500">180.000đ/khách tham gia</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAddItem({
                      category: "FOOD",
                      name: "Suất ăn dã ngoại & Nước suối",
                      kind: "VARIABLE",
                      basis: "PER_PERSON_PER_DAY",
                      unitPrice: "150000",
                      durationUnits: durationDays > 0 ? durationDays : 1,
                      includedInPrice: true,
                    })
                  }
                  className="w-full text-left rounded-lg p-2 text-xs hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                >
                  <span className="text-base">🍱</span>
                  <div>
                    <div className="font-semibold text-gray-800">Ăn uống dã ngoại theo ngày</div>
                    <div className="text-[10px] text-gray-500">150.000đ/khách/ngày × {durationDays || 1} ngày</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAddItem({
                      category: "LOGISTICS",
                      name: "Thuê lều trại cá nhân (Tự túc)",
                      kind: "VARIABLE",
                      basis: "PER_PERSON",
                      unitPrice: "120000",
                      includedInPrice: false,
                      sourceNote: "Khách có thể tự chuẩn bị hoặc thuê thêm",
                    })
                  }
                  className="w-full text-left rounded-lg p-2 text-xs hover:bg-amber-50 flex items-center gap-2.5 transition-colors"
                >
                  <span className="text-base">⛺</span>
                  <div>
                    <div className="font-semibold text-amber-900">Chi phí tự túc (Không gồm trong vé)</div>
                    <div className="text-[10px] text-amber-700">120.000đ/người (Tự chọn thuê lều)</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Nút thêm dòng trống */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAddItem()}
            className="inline-flex items-center gap-1 rounded-lg bg-[#1B5E41] px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#154a33] transition-colors disabled:opacity-50"
          >
            <span>+</span> Thêm dòng chi phí
          </button>
        </div>
      </div>

      {/* Tóm tắt nhanh chi phí cơ sở */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs">
          <div className="text-gray-600">
            Tổng cố định cơ bản:{" "}
            <strong className="text-gray-900 font-extrabold">{quickFixedTotal.toLocaleString("vi-VN")}đ</strong>
          </div>
          <div className="h-3 w-px bg-gray-300" />
          <div className="text-gray-600">
            Biến phí theo đầu người:{" "}
            <strong className="text-emerald-700 font-extrabold">{quickVarPerPax.toLocaleString("vi-VN")}đ</strong>
            /khách
          </div>
          <div className="h-3 w-px bg-gray-300" />
          <div className="text-gray-500 text-[11px]">
            * Chi tiết bước nhảy (xe/bậc) sẽ được tính chính xác từng nấc ở Simulator bên dưới.
          </div>
        </div>
      )}

      {/* Danh sách các dòng chi phí */}
      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center bg-gray-50/50">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-[#1B5E41] mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h5 className="text-sm font-bold text-gray-800">Chưa có khoản chi phí nào</h5>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-5">
            Bấm <strong>&quot;Áp dụng bộ chi phí chuẩn&quot;</strong> để nạp sẵn 4 khoản chi phí cơ bản của một tour trekking (xe, ăn uống, vé rừng, porter), hoặc tự thêm từng khoản tùy chỉnh.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={handleApplyStandardCombo}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1B5E41] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#154a33] transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Áp dụng bộ chi phí mẫu chuẩn (Xe + Ăn + Vé rừng + Porter)
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAddItem()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <span>+</span> Thêm dòng chi phí trống
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            return (
              <div
                key={index}
                className={`rounded-xl border p-4 transition-all ${!item.isEnabled
                    ? "bg-gray-100/60 border-gray-200 opacity-60"
                    : item.includedInPrice
                      ? "bg-white border-gray-200 shadow-2xs"
                      : "bg-amber-50/40 border-amber-200/80 shadow-2xs"
                  }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                  {/* Nhóm & Tên khoản chi */}
                  <div className="lg:col-span-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        disabled={disabled}
                        value={item.category}
                        onChange={(e) =>
                          handleUpdateItem(index, { category: e.target.value as CostCategory })
                        }
                        className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.key} value={cat.key}>
                            {cat.icon} {cat.label}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        disabled={disabled}
                        value={item.name}
                        placeholder="Tên khoản chi (VD: Thuê xe 16 chỗ)"
                        onChange={(e) => handleUpdateItem(index, { name: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Cách tính phí */}
                    <div>
                      <select
                        disabled={disabled}
                        value={`${item.kind}_${item.basis}`}
                        onChange={(e) => {
                          const opt = BASIS_OPTIONS.find((b) => `${b.kind}_${b.basis}` === e.target.value);
                          if (opt) {
                            handleUpdateItem(index, {
                              kind: opt.kind,
                              basis: opt.basis,
                              capacityPerUnit:
                                opt.basis === "PER_CAPACITY_UNIT"
                                  ? item.capacityPerUnit || 15
                                  : null,
                            });
                          }
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 focus:border-emerald-500 focus:outline-hidden"
                      >
                        {BASIS_OPTIONS.map((opt) => (
                          <option key={opt.id} value={`${opt.kind}_${opt.basis}`}>
                            {opt.label} — {opt.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Đơn giá & Số lượng / Bậc */}
                  <div className="lg:col-span-4 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Đơn giá (VNĐ)</label>
                      <input
                        type="text"
                        disabled={disabled}
                        value={Number(item.unitPrice || 0).toLocaleString("vi-VN")}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          handleUpdateItem(index, { unitPrice: digits || "0" });
                        }}
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-extrabold text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Trường phụ thuộc vào Cách tính */}
                    {item.basis === "PER_CAPACITY_UNIT" ? (
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Sức chứa/xe</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          disabled={disabled}
                          value={item.capacityPerUnit || 15}
                          onChange={(e) =>
                            handleUpdateItem(index, { capacityPerUnit: Math.max(1, Number(e.target.value)) })
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    ) : item.basis === "PER_DAY" || item.basis === "PER_PERSON_PER_DAY" ? (
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Số ngày đi</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          disabled={disabled}
                          value={item.durationUnits || durationDays || 1}
                          onChange={(e) =>
                            handleUpdateItem(index, { durationUnits: Math.max(1, Number(e.target.value)) })
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Số lượng</label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          disabled={disabled}
                          value={item.quantity || 1}
                          onChange={(e) =>
                            handleUpdateItem(index, { quantity: Math.max(1, Number(e.target.value)) })
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-900 focus:border-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    )}
                  </div>

                  {/* Switch Bao gồm trong giá vé & Nút Xóa */}
                  <div className="lg:col-span-3 flex items-center justify-between lg:justify-end gap-3 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={item.includedInPrice}
                        onChange={(e) =>
                          handleUpdateItem(index, { includedInPrice: e.target.checked })
                        }
                        className="h-4 w-4 rounded-sm border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span
                        className={`text-xs font-bold ${item.includedInPrice ? "text-emerald-800" : "text-amber-800"
                          }`}
                      >
                        {item.includedInPrice ? "Gồm trong vé" : "Khách tự túc"}
                      </span>
                    </label>

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemoveItem(index)}
                      title="Xóa khoản chi này"
                      className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Nếu là chi phí tự túc, hiển thị ô ghi chú nguồn cho khách hiểu */}
                {!item.includedInPrice && (
                  <div className="mt-2 pt-2 border-t border-amber-200/50">
                    <input
                      type="text"
                      disabled={disabled}
                      value={item.sourceNote || ""}
                      placeholder="Ghi chú hướng dẫn cho khách (VD: Khách có thể tự túc hoặc thuê thêm tại trạm)"
                      onChange={(e) => handleUpdateItem(index, { sourceNote: e.target.value })}
                      className="w-full rounded-md border border-amber-200 bg-white/70 px-2 py-0.5 text-[11px] text-gray-700 placeholder:text-gray-400 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
