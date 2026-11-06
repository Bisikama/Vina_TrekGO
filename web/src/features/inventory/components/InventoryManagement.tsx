"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getAllEquipmentUnits,
  listAdminRentalOrders,
  type AdminRentalOrderStatus,
  type AdminRentalOrderSummary,
} from "@/features/inventory/services/admin-inventory.api";
import { getRentalAssignees, initialsOf } from "@/features/rentals/services/staff-overview.api";
import type { RentalAssignee } from "@/features/rentals/services/staff-preparation.api";
import { listRentalExceptions, type RentalExceptionSummary } from "@/features/rentals/services/staff-returns.api";
import {
  getInventoryLocations,
  getStaffInventoryErrorMessage,
  getStaffRentalProducts,
} from "@/features/rentals/services/staff-inventory.api";
import type { EquipmentUnit, EquipmentUnitStatus, InventoryLocation, RentalProduct } from "@/features/rentals/types/rental";

// Kho vật tư (Admin) — toàn bộ số liệu lấy từ api thật:
// sản phẩm /staff/rental-products, thiết bị /staff/equipment-units, kho /staff/inventory-locations,
// đơn thuê /admin/rental-orders, ngoại lệ /staff/rental-exceptions, nhân sự /staff/rental-assignees.

const LOW_STOCK_RATIO = 0.2;

const OUT_STATUSES: EquipmentUnitStatus[] = ["PICKED", "PACKED", "RENTED", "RETURN_PENDING"];
const SERVICE_STATUSES: EquipmentUnitStatus[] = ["CLEANING", "MAINTENANCE", "DAMAGED"];

const UNIT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Sẵn sàng",
  PICKED: "Đã lấy",
  PACKED: "Đã đóng gói",
  RENTED: "Đang cho thuê",
  RETURN_PENDING: "Chờ trả",
  CLEANING: "Đang vệ sinh",
  MAINTENANCE: "Đang bảo trì",
  DAMAGED: "Hư hỏng",
  LOST: "Thất lạc",
  RETIRED: "Đã thanh lý",
};

const CONDITION_LABELS: Record<string, string> = {
  NEW: "Mới",
  GOOD: "Tốt",
  FAIR: "Khá",
  DAMAGED: "Hư hỏng",
  LOST: "Thất lạc",
};

const GRADE_LABELS: Record<string, string> = { LIKE_NEW: "Như mới", GOOD_USED: "Sử dụng tốt" };

const ORDER_STATUS_LABELS: Record<string, string> = {
  PAID: "Đã thanh toán",
  PREPARING: "Đang soạn đồ",
  READY_FOR_HANDOVER: "Chờ bàn giao",
  RETURN_PENDING: "Chờ nhận trả",
  RETURN_PROCESSING: "Đang kiểm tra trả",
};

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  DAMAGE_DISPUTE: "Hư hại / khoản trừ cọc",
  OVERDUE: "Trả thiết bị quá hạn",
  RETURN_INCOMPLETE: "Trả thiếu thiết bị",
  PAYMENT_MISMATCH: "Sai lệch thanh toán",
  REFUND_FAILURE: "Hoàn cọc cần đối soát",
  OTHER: "Ngoại lệ khác",
};

const EXCEPTION_STATUS_LABELS: Record<string, string> = { OPEN: "Cần xử lý", UNDER_REVIEW: "Đang xem xét" };

const OUTBOUND_STATUSES: AdminRentalOrderStatus[] = ["PAID", "PREPARING", "READY_FOR_HANDOVER"];
const INBOUND_STATUSES: AdminRentalOrderStatus[] = ["RETURN_PENDING", "RETURN_PROCESSING"];

type ProductStock = {
  product: RentalProduct;
  total: number;
  available: number;
  out: number;
  service: number;
};

type InventoryData = {
  products: RentalProduct[];
  units: EquipmentUnit[];
  unitTotal: number;
  locations: InventoryLocation[];
  outbound: AdminRentalOrderSummary[];
  inbound: AdminRentalOrderSummary[];
  exceptions: RentalExceptionSummary[];
  staff: RentalAssignee[];
  partialErrors: string[];
};

function stripGradeSuffix(name: string) {
  return name
    .replace(/\s*[-–—:]\s*(rất mới|như mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i, "")
    .trim();
}

function orderCode(id: string) {
  return `#${id.replace(/-/g, "").slice(-6).toUpperCase()}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoney(value: number, currency = "VND") {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} ${currency === "VND" ? "₫" : currency}`;
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

async function settle<T>(label: string, task: Promise<T>, fallback: T, errors: string[]) {
  try {
    return await task;
  } catch (error) {
    errors.push(`${label}: ${getStaffInventoryErrorMessage(error)}`);
    return fallback;
  }
}

async function loadInventory(signal: AbortSignal): Promise<InventoryData> {
  const errors: string[] = [];
  const [products, unitResult, locations, exceptions, staff, ...orderLists] = await Promise.all([
    settle("Sản phẩm", getStaffRentalProducts({ pageSize: 100, signal }).then((r) => r.items), [] as RentalProduct[], errors),
    settle("Thiết bị", getAllEquipmentUnits(signal), null, errors),
    settle("Kho", getInventoryLocations({ pageSize: 100, signal }).then((r) => r.items), [] as InventoryLocation[], errors),
    settle("Ngoại lệ", listRentalExceptions().then((r) => r.items ?? []), [] as RentalExceptionSummary[], errors),
    settle("Nhân sự kho", getRentalAssignees("STAFF_INVENTORY", signal), [] as RentalAssignee[], errors),
    ...[...OUTBOUND_STATUSES, ...INBOUND_STATUSES].map((status) =>
      settle(
        `Đơn ${ORDER_STATUS_LABELS[status] ?? status}`,
        listAdminRentalOrders(status, signal).then((r) => r.items),
        [] as AdminRentalOrderSummary[],
        errors,
      ),
    ),
  ]);

  const outbound = orderLists.slice(0, OUTBOUND_STATUSES.length).flat();
  const inbound = orderLists.slice(OUTBOUND_STATUSES.length).flat();
  const byStart = (a: AdminRentalOrderSummary, b: AdminRentalOrderSummary) => a.rentalStartAt.localeCompare(b.rentalStartAt);
  const byEnd = (a: AdminRentalOrderSummary, b: AdminRentalOrderSummary) => a.rentalEndAt.localeCompare(b.rentalEndAt);

  return {
    products,
    units: unitResult?.items ?? [],
    unitTotal: unitResult?.totalItems ?? 0,
    locations,
    outbound: outbound.sort(byStart),
    inbound: inbound.sort(byEnd),
    exceptions: exceptions.filter((item) => item.status === "OPEN" || item.status === "UNDER_REVIEW"),
    staff,
    partialErrors: errors,
  };
}

function StatCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone: "slate" | "emerald" | "sky" | "amber" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 text-slate-900",
    emerald: "border-emerald-200 text-emerald-700",
    sky: "border-sky-200 text-sky-700",
    amber: "border-amber-200 text-amber-700",
    rose: "border-rose-200 text-rose-700",
  } as const;
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value.toLocaleString("vi-VN")}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{text}</p>;
}

export const InventoryManagement = () => {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [locationId, setLocationId] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [orderTab, setOrderTab] = useState<"outbound" | "inbound">("outbound");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    loadInventory(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(getStaffInventoryErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const units = useMemo(() => {
    const all = data?.units ?? [];
    return locationId ? all.filter((unit) => unit.currentInventoryLocation?.id === locationId) : all;
  }, [data, locationId]);

  const summary = useMemo(() => {
    const active = units.filter((unit) => unit.status !== "RETIRED" && unit.status !== "LOST");
    return {
      total: active.length,
      available: active.filter((unit) => unit.status === "AVAILABLE").length,
      out: active.filter((unit) => OUT_STATUSES.includes(unit.status)).length,
      service: active.filter((unit) => SERVICE_STATUSES.includes(unit.status)).length,
      lost: units.filter((unit) => unit.status === "LOST").length,
    };
  }, [units]);

  const stocks = useMemo<ProductStock[]>(() => {
    const map = new Map<string, ProductStock>();
    for (const product of data?.products ?? []) {
      map.set(product.id, { product, total: 0, available: 0, out: 0, service: 0 });
    }
    for (const unit of units) {
      const row = map.get(unit.product.id);
      if (!row || unit.status === "RETIRED" || unit.status === "LOST") continue;
      row.total += 1;
      if (unit.status === "AVAILABLE") row.available += 1;
      else if (OUT_STATUSES.includes(unit.status)) row.out += 1;
      else if (SERVICE_STATUSES.includes(unit.status)) row.service += 1;
    }
    return [...map.values()];
  }, [data, units]);

  const isLow = (row: ProductStock) => row.total > 0 && row.available / row.total < LOW_STOCK_RATIO;
  const lowStock = useMemo(() => stocks.filter(isLow), [stocks]);

  const categories = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const row of stocks) {
      const key = row.product.category?.id ?? "";
      if (!key) continue;
      const current = counts.get(key) ?? { name: row.product.category.name, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
    return [...counts.entries()];
  }, [stocks]);

  const visibleStocks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return stocks
      .filter((row) => !category || row.product.category?.id === category)
      .filter(
        (row) =>
          !keyword ||
          row.product.name.toLowerCase().includes(keyword) ||
          (row.product.sku ?? "").toLowerCase().includes(keyword),
      )
      .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || b.total - a.total);
  }, [stocks, category, search]);

  const serviceUnits = useMemo(
    () => units.filter((unit) => SERVICE_STATUSES.includes(unit.status)).slice(0, 8),
    [units],
  );

  const orders = orderTab === "outbound" ? data?.outbound ?? [] : data?.inbound ?? [];
  const tableRows = showAll ? visibleStocks : visibleStocks.slice(0, 8);
  const truncated = data ? data.units.length < data.unitTotal : false;

  if (loading && !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#1B5E41]" />
          Đang tải dữ liệu kho...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          <p className="font-medium">Không tải được dữ liệu kho</p>
          <p className="mt-1">{error}</p>
          <button type="button" onClick={reload} className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {lowStock.length > 0 ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-rose-800">
              {lowStock.length} sản phẩm còn dưới {Math.round(LOW_STOCK_RATIO * 100)}% thiết bị sẵn sàng
            </p>
            <p className="mt-1 text-xs text-rose-700">
              {lowStock
                .slice(0, 4)
                .map((row) => `${stripGradeSuffix(row.product.name)} (${row.available}/${row.total})`)
                .join(" · ")}
              {lowStock.length > 4 ? ` · và ${lowStock.length - 4} sản phẩm khác` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCategory("");
              setSearch("");
              setShowAll(true);
            }}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
          >
            Xem danh sách
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">Quản trị · Hậu cần</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Kho vật tư & thiết bị</h1>
          <p className="mt-1 text-sm text-slate-500">Tồn kho theo sản phẩm, đơn đang soạn và chờ trả, thiết bị đang bảo trì.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1B5E41]"
          >
            <option value="">Tất cả kho</option>
            {(data?.locations ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
          <Link href="/admin/rentals" className="rounded-xl bg-[#1B5E41] px-4 py-2 text-sm font-medium text-white hover:bg-[#144a33]">
            Thiết bị cho thuê
          </Link>
        </div>
      </div>

      {data && data.partialErrors.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Một số mục chưa tải được: {data.partialErrors.join(" · ")}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Tổng thiết bị"
          value={summary.total}
          tone="slate"
          note={summary.lost > 0 ? `Không tính ${summary.lost} thất lạc, đã thanh lý` : "Không tính thiết bị đã thanh lý"}
        />
        <StatCard label="Sẵn sàng cho thuê" value={summary.available} tone="emerald" note={`${percent(summary.available, summary.total)}% tổng thiết bị`} />
        <StatCard label="Đang xuất / đi tour" value={summary.out} tone="sky" note={`${percent(summary.out, summary.total)}% · đã lấy, đóng gói, đang thuê, chờ trả`} />
        <StatCard label="Vệ sinh / bảo trì" value={summary.service} tone="amber" note={`${percent(summary.service, summary.total)}% · gồm thiết bị hư hỏng`} />
        <StatCard label="Sản phẩm sắp hết" value={lowStock.length} tone="rose" note={`Sẵn sàng dưới ${Math.round(LOW_STOCK_RATIO * 100)}%`} />
      </div>

      {truncated ? (
        <p className="text-xs text-slate-500">
          Đang tính trên {data?.units.length.toLocaleString("vi-VN")}/{data?.unitTotal.toLocaleString("vi-VN")} thiết bị đầu tiên.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Tồn kho theo sản phẩm</h2>
                <p className="text-xs text-slate-500">{stocks.length} sản phẩm · đếm theo từng thiết bị vật lý</p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên hoặc SKU..."
                className="w-64 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#1B5E41] focus:bg-white"
              />
            </div>

            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setCategory("")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${!category ? "bg-[#1B5E41] text-white" : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  Tất cả ({stocks.length})
                </button>
                {categories.map(([id, item]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${category === id ? "bg-[#1B5E41] text-white" : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                  >
                    {item.name} ({item.count})
                  </button>
                ))}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-medium text-slate-500">
                    <th className="p-4">Sản phẩm</th>
                    <th className="p-4 text-center">Tổng</th>
                    <th className="p-4 text-center text-emerald-700">Sẵn sàng</th>
                    <th className="p-4 text-center text-sky-700">Đang xuất</th>
                    <th className="p-4 text-center text-amber-700">Bảo trì</th>
                    <th className="p-4">Tỷ lệ sẵn sàng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableRows.map((row) => {
                    const low = isLow(row);
                    const ratio = percent(row.available, row.total);
                    const image = row.product.imageUrls?.[0];
                    return (
                      <tr key={row.product.id} className="hover:bg-slate-50/60">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                              {image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={image} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                                {stripGradeSuffix(row.product.name)}
                                {row.product.grade ? (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                    {GRADE_LABELS[row.product.grade] ?? row.product.grade}
                                  </span>
                                ) : null}
                                {low ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">Sắp hết</span> : null}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {row.product.sku ? <span className="font-mono">{row.product.sku}</span> : null}
                                {row.product.sku && row.product.category?.name ? " · " : ""}
                                {row.product.category?.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center text-sm font-medium text-slate-900">{row.total}</td>
                        <td className={`p-4 text-center text-sm font-medium ${low ? "text-rose-600" : "text-emerald-700"}`}>{row.available}</td>
                        <td className="p-4 text-center text-sm text-slate-600">{row.out}</td>
                        <td className="p-4 text-center text-sm text-slate-600">{row.service}</td>
                        <td className="p-4">
                          {row.total === 0 ? (
                            <span className="text-xs text-slate-400">Chưa có thiết bị</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`w-9 text-xs font-medium ${low ? "text-rose-600" : "text-emerald-700"}`}>{ratio}%</span>
                              <div className="h-1.5 w-16 rounded-full bg-slate-200">
                                <div className={`h-1.5 rounded-full ${low ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${ratio}%` }} />
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {tableRows.length === 0 ? (
                <div className="p-5">
                  <EmptyRow text="Không có sản phẩm phù hợp." />
                </div>
              ) : null}
            </div>

            {visibleStocks.length > 8 ? (
              <div className="border-t border-slate-100 p-4 text-center">
                <button type="button" onClick={() => setShowAll((value) => !value)} className="text-sm font-medium text-[#1B5E41] hover:underline">
                  {showAll ? "Thu gọn" : `Xem tất cả ${visibleStocks.length} sản phẩm`}
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Ngoại lệ hoàn trả cần xử lý</h2>
                <p className="text-xs text-slate-500">Hư hại, trả thiếu, quá hạn và đối soát hoàn cọc đang mở</p>
              </div>
              <Link href="/admin/rental-returns" className="text-sm font-medium text-[#1B5E41] hover:underline">
                Mở Hoàn trả & quyết toán
              </Link>
            </div>
            <div className="space-y-3 p-5">
              {(data?.exceptions ?? []).length === 0 ? (
                <EmptyRow text="Không có ngoại lệ đang mở." />
              ) : (
                (data?.exceptions ?? []).slice(0, 6).map((item) => (
                  <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        Đơn {orderCode(item.orderId)}
                        {item.unit ? ` · ${item.unit.assetCode}` : ""}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">{EXCEPTION_TYPE_LABELS[item.type] ?? item.type}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {item.order.tripTitle} · {item.order.customerName}
                      </p>
                      {item.reason ? <p className="mt-1 text-xs text-slate-500">{item.reason}</p> : null}
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.status === "OPEN" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {EXCEPTION_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                      {item.dueAt ? <p className="mt-2 text-xs text-slate-500">Hạn {formatDate(item.dueAt)}</p> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-base font-semibold text-slate-900">Đơn đang xử lý</h2>
            </div>
            <div className="flex gap-1 border-b border-slate-100 p-2">
              <button
                type="button"
                onClick={() => setOrderTab("outbound")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${orderTab === "outbound" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
              >
                Chờ xuất ({data?.outbound.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setOrderTab("inbound")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${orderTab === "inbound" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
              >
                Chờ nhận trả ({data?.inbound.length ?? 0})
              </button>
            </div>
            <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
              {orders.length === 0 ? (
                <EmptyRow text={orderTab === "outbound" ? "Không có đơn chờ xuất." : "Không có đơn chờ nhận trả."} />
              ) : (
                orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/rental-orders/${order.id}`}
                    className="block rounded-xl border border-slate-200 p-3 transition hover:border-[#1B5E41]/40 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-medium text-slate-900">{orderCode(order.id)}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                    {order.tripTitle || order.customerName ? (
                      <p className="mt-2 truncate text-sm text-slate-900">
                        {order.tripTitle ?? "Chuyến đi"}
                        {order.customerName ? <span className="text-slate-500"> · {order.customerName}</span> : null}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-600">
                      {orderTab === "outbound" ? "Bắt đầu thuê" : "Hạn trả"}:{" "}
                      <span className="font-medium text-slate-800">{formatDate(orderTab === "outbound" ? order.rentalStartAt : order.rentalEndAt)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {order.linesCount} dòng thiết bị · {formatMoney(order.totalAmount, order.currency)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-base font-semibold text-slate-900">Thiết bị đang vệ sinh / bảo trì</h2>
            </div>
            <div className="space-y-2 p-4">
              {serviceUnits.length === 0 ? (
                <EmptyRow text="Không có thiết bị đang bảo trì." />
              ) : (
                serviceUnits.map((unit) => (
                  <div key={unit.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-900">{stripGradeSuffix(unit.product.name)}</p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono">{unit.assetCode}</span> · {CONDITION_LABELS[unit.condition] ?? unit.condition}
                        {unit.currentInventoryLocation ? ` · ${unit.currentInventoryLocation.name}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${unit.status === "DAMAGED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {UNIT_STATUS_LABELS[unit.status] ?? unit.status}
                      </span>
                      {unit.expectedReadyAt ? <p className="mt-1 text-[11px] text-slate-500">Dự kiến {formatDate(unit.expectedReadyAt)}</p> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-base font-semibold text-slate-900">Nhân sự kho</h2>
            </div>
            <div className="space-y-3 p-4">
              {(data?.staff ?? []).length === 0 ? (
                <EmptyRow text="Chưa có nhân viên kho." />
              ) : (
                (data?.staff ?? []).map((person) => (
                  <div key={person.id} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-800">
                      {initialsOf(person.displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-900">{person.displayName}</p>
                      <p className="truncate text-xs text-slate-500">{person.email ?? person.phone ?? "Nhân viên kho vận"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${person.activeTaskCount > 0 ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"}`}>
                      {person.activeTaskCount > 0 ? `${person.activeTaskCount} việc` : "Rảnh"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
