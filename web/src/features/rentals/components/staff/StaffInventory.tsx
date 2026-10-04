"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  batchCreateEquipmentUnits,
  changeEquipmentMaintenance,
  createEquipmentUnit,
  generateEquipmentLabels,
  getEquipmentUnit,
  getEquipmentUnits,
  getInventoryLocations,
  getStaffInventoryErrorMessage,
  getStaffRentalProducts,
  updateEquipmentUnit,
} from "@/features/rentals/services/staff-inventory.api";
import type {
  EquipmentCondition,
  EquipmentLabel,
  EquipmentUnit,
  EquipmentUnitCounts,
  EquipmentUnitDetail,
  EquipmentUnitStatus,
  InventoryLocation,
  RentalPagination,
  RentalProduct,
} from "@/features/rentals/types/rental";

const EMPTY_COUNTS: EquipmentUnitCounts = {
  total: 0,
  available: 0,
  picked: 0,
  packed: 0,
  rented: 0,
  returnPending: 0,
  cleaning: 0,
  maintenance: 0,
  damaged: 0,
  lost: 0,
  retired: 0,
};

const EMPTY_PAGINATION: RentalPagination = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
};

const statusConfig: Record<
  EquipmentUnitStatus,
  { label: string; className: string }
> = {
  AVAILABLE: {
    label: "Sẵn sàng xuất",
    className: "bg-green-100 text-green-800",
  },
  PICKED: {
    label: "Đã nhặt",
    className: "bg-emerald-100 text-emerald-800",
  },
  PACKED: {
    label: "Đã đóng gói",
    className: "bg-teal-100 text-teal-800",
  },
  RENTED: {
    label: "Đang cho thuê",
    className: "bg-blue-100 text-blue-800",
  },
  RETURN_PENDING: {
    label: "Chờ hoàn trả",
    className: "bg-orange-100 text-orange-800",
  },
  CLEANING: {
    label: "Đang vệ sinh",
    className: "bg-cyan-100 text-cyan-800",
  },
  MAINTENANCE: {
    label: "Bảo dưỡng",
    className: "bg-amber-100 text-amber-800",
  },
  DAMAGED: {
    label: "Hỏng hóc",
    className: "bg-red-100 text-red-700",
  },
  LOST: {
    label: "Thất lạc",
    className: "bg-rose-100 text-rose-800",
  },
  RETIRED: {
    label: "Ngừng sử dụng",
    className: "bg-slate-200 text-slate-700",
  },
};

const conditionLabel: Record<EquipmentCondition, string> = {
  NEW: "Mới",
  GOOD: "Tốt",
  FAIR: "Trung bình",
  DAMAGED: "Hỏng",
  LOST: "Thất lạc",
};

const allStatuses = Object.keys(statusConfig) as EquipmentUnitStatus[];
const allConditions = Object.keys(conditionLabel) as EquipmentCondition[];

function formatDate(value: string | null) {
  if (!value) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  }).format(new Date(value));
}

function percentage(value: number, total: number) {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

type CreateForm = {
  mode: "single" | "batch";
  productId: string;
  homeInventoryLocationId: string;
  assetCode: string;
  serialNumber: string;
  quantity: string;
  condition: "NEW" | "GOOD" | "FAIR";
  acquiredAt: string;
};

const initialCreateForm: CreateForm = {
  mode: "single",
  productId: "",
  homeInventoryLocationId: "",
  assetCode: "",
  serialNumber: "",
  quantity: "5",
  condition: "GOOD",
  acquiredAt: "",
};

export function StaffInventory() {
  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [units, setUnits] = useState<EquipmentUnit[]>([]);
  const [counts, setCounts] = useState<EquipmentUnitCounts>(EMPTY_COUNTS);
  const [pagination, setPagination] =
    useState<RentalPagination>(EMPTY_PAGINATION);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EquipmentUnitStatus | "">(
    "",
  );
  const [conditionFilter, setConditionFilter] =
    useState<EquipmentCondition | "">("");
  const [productFilter, setProductFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EquipmentUnitDetail | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(initialCreateForm);
  const [showEdit, setShowEdit] = useState(false);
  const [editLocationId, setEditLocationId] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editAcquiredAt, setEditAcquiredAt] = useState("");
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const [resultingCondition, setResultingCondition] =
    useState<EquipmentCondition>("GOOD");
  const [labels, setLabels] = useState<EquipmentLabel[]>([]);

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLookups() {
      try {
        const [productResult, locationResult] = await Promise.all([
          getStaffRentalProducts({
            page: 1,
            pageSize: 100,
            signal: controller.signal,
          }),
          getInventoryLocations({
            page: 1,
            pageSize: 100,
            status: "ACTIVE",
            signal: controller.signal,
          }),
        ]);

        setProducts(productResult.items);
        setLocations(locationResult.items);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(getStaffInventoryErrorMessage(requestError));
        }
      }
    }

    void loadLookups();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUnits() {
      setLoading(true);
      setError("");

      try {
        const result = await getEquipmentUnits({
          page,
          pageSize: 20,
          q: debouncedSearch || undefined,
          status: statusFilter || undefined,
          condition: conditionFilter || undefined,
          productId: productFilter || undefined,
          inventoryLocationId: locationFilter || undefined,
          signal: controller.signal,
        });

        setUnits(result.items);
        setCounts(result.counts);
        setPagination(result.pagination);
        setSelectedIds((current) =>
          current.filter((id) => result.items.some((item) => item.id === id)),
        );

        setActiveId((current) => {
          if (current && result.items.some((item) => item.id === current)) {
            return current;
          }
          return result.items[0]?.id ?? null;
        });
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(getStaffInventoryErrorMessage(requestError));
          setUnits([]);
          setCounts(EMPTY_COUNTS);
          setPagination(EMPTY_PAGINATION);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadUnits();
    return () => controller.abort();
  }, [
    conditionFilter,
    debouncedSearch,
    locationFilter,
    page,
    productFilter,
    reloadKey,
    statusFilter,
  ]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    const controller = new AbortController();

    getEquipmentUnit(activeId, controller.signal)
      .then(setDetail)
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(getStaffInventoryErrorMessage(requestError));
        }
      });

    return () => controller.abort();
  }, [activeId, reloadKey]);

  const activeDetail =
    detail?.unit.id === activeId ? detail : null;

  const detailLoading = Boolean(
    activeId && !activeDetail,
  );

  const activeUnit = activeDetail
    ? activeDetail.unit
    : units.find((unit) => unit.id === activeId);

  const stats = useMemo(
    () => [
      {
        label: "Tổng thiết bị",
        value: counts.total,
        detail: `${locations.length} kho hoạt động`,
        color: "text-slate-950",
        bar: "bg-[#125238]",
      },
      {
        label: "Sẵn sàng xuất",
        value: counts.available,
        detail: percentage(counts.available, counts.total),
        color: "text-emerald-800",
        bar: "bg-emerald-600",
      },
      {
        label: "Giữ chỗ / Soạn",
        value: counts.picked + counts.packed,
        detail: `${counts.picked} nhặt · ${counts.packed} đóng`,
        color: "text-slate-950",
        bar: "bg-teal-600",
      },
      {
        label: "Đang cho thuê",
        value: counts.rented,
        detail: percentage(counts.rented, counts.total),
        color: "text-blue-700",
        bar: "bg-blue-500",
      },
      {
        label: "Chờ trả / Vệ sinh",
        value: counts.returnPending + counts.cleaning,
        detail: `${counts.returnPending} trả · ${counts.cleaning} vệ sinh`,
        color: "text-orange-700",
        bar: "bg-orange-500",
      },
      {
        label: "Bảo dưỡng",
        value: counts.maintenance,
        detail: "Đang xử lý",
        color: "text-amber-700",
        bar: "bg-amber-500",
      },
      {
        label: "Hỏng / Thất lạc",
        value: counts.damaged + counts.lost,
        detail: `${counts.damaged} hỏng · ${counts.lost} mất`,
        color: "text-red-700",
        bar: "bg-red-600",
      },
    ],
    [counts, locations.length],
  );

  function showSuccess(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  function toggleAllVisible() {
    const ids = units.map((unit) => unit.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));

    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current, ...ids])),
    );
  }

  function openCreateModal() {
    setCreateForm({
      ...initialCreateForm,
      productId: products.find((product) => product.status === "ACTIVE")?.id ?? "",
      homeInventoryLocationId: locations[0]?.id ?? "",
    });
    setShowCreate(true);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (createForm.mode === "single") {
        await createEquipmentUnit({
          productId: createForm.productId,
          homeInventoryLocationId: createForm.homeInventoryLocationId,
          assetCode: createForm.assetCode.trim() || undefined,
          serialNumber: createForm.serialNumber.trim() || undefined,
          condition: createForm.condition,
          acquiredAt: createForm.acquiredAt || undefined,
        });
        showSuccess("Đã nhập một thiết bị mới vào kho.");
      } else {
        const quantity = Number(createForm.quantity);
        await batchCreateEquipmentUnits({
          productId: createForm.productId,
          homeInventoryLocationId: createForm.homeInventoryLocationId,
          quantity,
          assetCodeMode: "AUTO",
          condition: createForm.condition,
          acquiredAt: createForm.acquiredAt || undefined,
        });
        showSuccess(`Đã nhập ${quantity} thiết bị mới vào kho.`);
      }

      setShowCreate(false);
      setPage(1);
      refresh();
    } catch (requestError) {
      setError(getStaffInventoryErrorMessage(requestError, "Không thể tạo thiết bị."));
    } finally {
      setSaving(false);
    }
  }

  function openEditModal() {
    if (!activeUnit) return;
    setEditLocationId(activeUnit.homeInventoryLocation.id);
    setEditSerialNumber(activeUnit.serialNumber ?? "");
    setEditAcquiredAt(activeUnit.acquiredAt?.slice(0, 10) ?? "");
    setShowEdit(true);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUnit) return;
    setSaving(true);
    setError("");

    try {
      await updateEquipmentUnit(activeUnit.id, {
        expectedVersion: activeUnit.version,
        homeInventoryLocationId: editLocationId,
        serialNumber: editSerialNumber.trim() || null,
        acquiredAt: editAcquiredAt || null,
      });
      setShowEdit(false);
      showSuccess(`Đã cập nhật ${activeUnit.assetCode}.`);
      refresh();
    } catch (requestError) {
      setError(getStaffInventoryErrorMessage(requestError, "Không thể cập nhật thiết bị."));
    } finally {
      setSaving(false);
    }
  }

  async function requestLabels(ids: string[]) {
    if (ids.length === 0) return;
    setSaving(true);
    setError("");

    try {
      const result = await generateEquipmentLabels(ids);
      setLabels(result.labels);
    } catch (requestError) {
      setError(getStaffInventoryErrorMessage(requestError, "Không thể tạo dữ liệu tem QR."));
    } finally {
      setSaving(false);
    }
  }

  async function submitMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUnit) return;
    setSaving(true);
    setError("");

    try {
      if (activeUnit.status === "MAINTENANCE") {
        await changeEquipmentMaintenance(activeUnit.id, {
          action: "COMPLETE",
          resultingCondition,
          expectedVersion: activeUnit.version,
        });
        showSuccess(`Đã hoàn tất bảo trì ${activeUnit.assetCode}.`);
      } else {
        await changeEquipmentMaintenance(activeUnit.id, {
          action: "START",
          reason: maintenanceReason.trim(),
          notes: maintenanceNotes.trim() || undefined,
          expectedVersion: activeUnit.version,
        });
        showSuccess(`Đã chuyển ${activeUnit.assetCode} sang bảo trì.`);
      }

      setShowMaintenance(false);
      setMaintenanceReason("");
      setMaintenanceNotes("");
      refresh();
    } catch (requestError) {
      setError(getStaffInventoryErrorMessage(requestError, "Không thể đổi trạng thái bảo trì."));
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const header = [
      "Asset code",
      "QR code",
      "Serial",
      "Product",
      "Status",
      "Condition",
      "Current location",
    ];
    const rows = units.map((unit) => [
      unit.assetCode,
      unit.qrCode ?? "",
      unit.serialNumber ?? "",
      unit.product.name,
      unit.status,
      unit.condition,
      unit.currentInventoryLocation?.name ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `equipment-inventory-page-${pagination.page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1540px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">
              Kho & Thiết bị <span className="mx-2">›</span> Quản lý hiện vật
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-slate-950">
                Quản lý Kho thiết bị & Vật tư
              </h1>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-800">
                API thật · {locations.length} kho hoạt động
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={units.length === 0}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              ⇩ Xuất CSV trang hiện tại
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={products.length === 0 || locations.length === 0}
              className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              ⊕ Nhập thiết bị mới
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800">
            <span>⚠ {error}</span>
            <button type="button" onClick={() => setError("")}>×</button>
          </div>
        )}
        {notice && (
          <div className="mt-4 rounded-lg bg-emerald-100 px-4 py-3 text-xs font-bold text-emerald-900">
            ✓ {notice}
          </div>
        )}

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] text-slate-600">{stat.label}</p>
              <div className="mt-3 flex items-end gap-1">
                <strong className={`text-2xl font-black ${stat.color}`}>{stat.value}</strong>
                <span className="pb-1 text-[9px] text-slate-600">{stat.detail}</span>
              </div>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#e4ebf8]">
                <div
                  className={`h-full rounded-full ${stat.bar}`}
                  style={{ width: `${counts.total === 0 ? 0 : Math.max(8, (stat.value / counts.total) * 100)}%` }}
                />
              </div>
            </article>
          ))}
        </section>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm asset code, QR, serial..."
                  className="h-11 rounded-lg bg-[#edf3ff] px-4 text-xs outline-none focus:ring-2 focus:ring-emerald-700 xl:col-span-2"
                />
                <select value={productFilter} onChange={(event) => { setProductFilter(event.target.value); setPage(1); }} className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs font-semibold outline-none">
                  <option value="">Tất cả sản phẩm</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
                </select>
                <select value={locationFilter} onChange={(event) => { setLocationFilter(event.target.value); setPage(1); }} className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs font-semibold outline-none">
                  <option value="">Tất cả kho</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}
                </select>
                <select value={conditionFilter} onChange={(event) => { setConditionFilter(event.target.value as EquipmentCondition | ""); setPage(1); }} className="h-11 rounded-lg bg-[#edf3ff] px-3 text-xs font-semibold outline-none">
                  <option value="">Mọi tình trạng</option>
                  {allConditions.map((condition) => <option key={condition} value={condition}>{conditionLabel[condition]}</option>)}
                </select>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
                <button type="button" onClick={() => { setStatusFilter(""); setPage(1); }} className={`rounded-full px-4 py-2 ${statusFilter === "" ? "bg-[#125238] text-white" : "bg-[#edf3ff] text-slate-700"}`}>
                  Tất cả {counts.total}
                </button>
                {([
                  ["AVAILABLE", "Khả dụng", counts.available],
                  ["PICKED", "Đã nhặt", counts.picked],
                  ["PACKED", "Đã đóng", counts.packed],
                  ["RENTED", "Đang thuê", counts.rented],
                  ["MAINTENANCE", "Bảo trì", counts.maintenance],
                ] as const).map(([status, label, value]) => (
                  <button key={status} type="button" onClick={() => { setStatusFilter(status); setPage(1); }} className={`rounded-full px-4 py-2 ${statusFilter === status ? "bg-[#125238] text-white" : "bg-[#edf3ff] text-slate-700"}`}>
                    {label} {value}
                  </button>
                ))}
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as EquipmentUnitStatus | ""); setPage(1); }} className="rounded-full bg-[#edf3ff] px-4 py-2 outline-none">
                  <option value="">Trạng thái khác</option>
                  {allStatuses.map((status) => <option key={status} value={status}>{statusConfig[status].label}</option>)}
                </select>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[#edf3ff] p-3">
                <p className="text-xs font-bold text-slate-700">☑ Đã chọn {selectedIds.length} thiết bị</p>
                <button type="button" disabled={saving} onClick={() => void requestLabels(selectedIds)} className="rounded-lg bg-[#125238] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">
                  ▦ Lấy dữ liệu in QR
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead className="bg-[#e7eefc] text-[10px] uppercase text-slate-600">
                  <tr>
                    <th className="w-12 px-4 py-4"><input type="checkbox" checked={units.length > 0 && units.every((unit) => selectedIds.includes(unit.id))} onChange={toggleAllVisible} className="h-4 w-4 accent-[#125238]" /></th>
                    <th className="px-3 py-4">Mã thiết bị / QR</th>
                    <th className="px-3 py-4">Sản phẩm</th>
                    <th className="px-3 py-4">Kho hiện tại</th>
                    <th className="px-3 py-4">Tình trạng</th>
                    <th className="px-3 py-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit) => (
                    <tr key={unit.id} onClick={() => setActiveId(unit.id)} className={`cursor-pointer border-b border-slate-100 transition ${activeId === unit.id ? "bg-[#edf3ff]" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(unit.id)} onChange={() => toggleSelected(unit.id)} className="h-4 w-4 accent-[#125238]" /></td>
                      <td className="px-3 py-4"><p className="font-mono text-[11px] font-black text-emerald-900">{unit.assetCode}</p><p className="mt-1 max-w-40 truncate font-mono text-[9px] text-slate-500">{unit.qrCode ?? "Chưa có QR"}</p></td>
                      <td className="px-3 py-4"><p className="text-xs font-black text-slate-950">{unit.product.name}</p><p className="mt-1 text-[9px] text-slate-500">{unit.product.sku}</p></td>
                      <td className="px-3 py-4"><p className="text-xs font-bold">{unit.currentInventoryLocation?.name ?? "Ngoài kho"}</p><p className="mt-1 text-[9px] text-slate-500">{unit.currentInventoryLocation?.code ?? "—"}</p></td>
                      <td className="px-3 py-4"><span className="rounded bg-[#e4ebf8] px-3 py-1.5 text-[9px] font-semibold text-slate-700">{conditionLabel[unit.condition]}</span></td>
                      <td className="px-3 py-4"><span className={`inline-flex rounded-full px-3 py-2 text-[9px] font-black ${statusConfig[unit.status].className}`}>{statusConfig[unit.status].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && units.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-4xl">📦</div>
                  <h3 className="mt-3 text-sm font-black text-slate-900">Chưa có thiết bị phù hợp</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
                    API hiện trả về 0 thiết bị. Hãy bỏ bộ lọc hoặc nhập thiết bị đầu tiên từ sản phẩm và kho đang hoạt động.
                  </p>
                  <button type="button" onClick={openCreateModal} className="mt-4 rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white">⊕ Nhập thiết bị đầu tiên</button>
                </div>
              )}
              {loading && <div className="p-12 text-center text-xs font-bold text-slate-500">Đang tải dữ liệu kho thật...</div>}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 bg-[#edf3ff] px-4 py-3 text-[10px] text-slate-600">
              <span>Trang {pagination.page} · {pagination.totalItems} thiết bị</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded bg-white px-3 py-2 font-bold disabled:opacity-40">‹ Trước</button>
                <button type="button" disabled={pagination.totalPages === 0 || page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded bg-white px-3 py-2 font-bold disabled:opacity-40">Sau ›</button>
              </div>
            </footer>
          </section>

          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-24">
            {!activeUnit ? (
              <div className="p-10 text-center text-xs text-slate-500">Chọn một thiết bị để xem chi tiết.</div>
            ) : (
              <>
                <div className="bg-[#e7eefc] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-mono text-[11px] font-black text-emerald-900">#{activeUnit.assetCode}</p><h2 className="mt-2 text-xl font-black text-slate-950">{activeUnit.product.name}</h2><p className="mt-1 text-[10px] text-slate-500">{activeUnit.product.sku} · v{activeUnit.version}</p></div>
                    <span className={`rounded-full px-3 py-2 text-[9px] font-black ${statusConfig[activeUnit.status].className}`}>{statusConfig[activeUnit.status].label}</span>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  {detailLoading && <p className="text-[10px] font-bold text-slate-500">Đang tải lịch sử...</p>}
                  <section className="rounded-xl bg-[#edf3ff] p-4">
                    <h3 className="text-[10px] font-black uppercase text-slate-700">Nhận diện & vị trí</h3>
                    <dl className="mt-3 space-y-3 text-[10px]">
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">QR payload</dt><dd className="max-w-48 truncate font-mono font-black">{activeUnit.qrCode ?? "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Serial</dt><dd className="font-black">{activeUnit.serialNumber ?? "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Kho gốc</dt><dd className="text-right font-black">{activeUnit.homeInventoryLocation.name}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Kho hiện tại</dt><dd className="text-right font-black">{activeUnit.currentInventoryLocation?.name ?? "Ngoài kho"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Ngày nhập</dt><dd className="font-black">{formatDate(activeUnit.acquiredAt)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Tình trạng</dt><dd className="font-black">{conditionLabel[activeUnit.condition]}</dd></div>
                    </dl>
                  </section>

                  <section>
                    <div className="flex items-center justify-between"><h3 className="text-[10px] font-black uppercase">Nhật ký vận hành</h3><span className="text-[9px] text-slate-500">{activeDetail?.history.length ?? 0} sự kiện</span></div>
                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                      {(activeDetail?.history ?? []).map((event, index) => (
                        <div key={`${event.type}-${event.occurredAt}-${index}`} className="rounded-lg bg-[#edf3ff] p-3"><p className="text-[10px] font-black">● {event.type}</p><p className="mt-1 text-[9px] text-slate-500">{formatDate(event.occurredAt)}{event.actor ? ` · ${event.actor}` : ""}</p></div>
                      ))}
                      {!detailLoading && (activeDetail?.history.length ?? 0) === 0 && <p className="rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500">Chưa có sự kiện lịch sử.</p>}
                    </div>
                  </section>

                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={saving} onClick={() => void requestLabels([activeUnit.id])} className="rounded-lg bg-[#edf3ff] px-3 py-3 text-[10px] font-bold disabled:opacity-50">▦ In tem QR</button>
                    <button type="button" onClick={openEditModal} className="rounded-lg bg-[#edf3ff] px-3 py-3 text-[10px] font-bold">✎ Sửa metadata</button>
                  </div>
                  <button type="button" onClick={() => setShowMaintenance(true)} disabled={!(["AVAILABLE", "CLEANING", "DAMAGED", "MAINTENANCE"] as EquipmentUnitStatus[]).includes(activeUnit.status)} className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-black text-amber-900 disabled:cursor-not-allowed disabled:opacity-40">
                    {activeUnit.status === "MAINTENANCE" ? "✓ Hoàn tất bảo trì" : "⚒ Bắt đầu bảo trì"}
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      {showCreate && (
        <Modal title="Nhập thiết bị vào kho" onClose={() => setShowCreate(false)}>
          <form onSubmit={submitCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#edf3ff] p-1">
              {(["single", "batch"] as const).map((mode) => <button key={mode} type="button" onClick={() => setCreateForm((current) => ({ ...current, mode }))} className={`rounded-lg px-3 py-2 text-xs font-black ${createForm.mode === mode ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500"}`}>{mode === "single" ? "Một thiết bị" : "Nhập hàng loạt"}</button>)}
            </div>
            <Field label="Sản phẩm"><select required value={createForm.productId} onChange={(event) => setCreateForm((current) => ({ ...current, productId: event.target.value }))} className={inputClass}><option value="">Chọn sản phẩm</option>{products.filter((product) => product.status === "ACTIVE").map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select></Field>
            <Field label="Kho gốc"><select required value={createForm.homeInventoryLocationId} onChange={(event) => setCreateForm((current) => ({ ...current, homeInventoryLocationId: event.target.value }))} className={inputClass}><option value="">Chọn kho</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}</select></Field>
            {createForm.mode === "single" ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Asset code (để trống = tự sinh)"><input value={createForm.assetCode} onChange={(event) => setCreateForm((current) => ({ ...current, assetCode: event.target.value }))} className={inputClass} /></Field><Field label="Serial nhà sản xuất"><input value={createForm.serialNumber} onChange={(event) => setCreateForm((current) => ({ ...current, serialNumber: event.target.value }))} className={inputClass} /></Field></div> : <Field label="Số lượng (1–100)"><input required type="number" min={1} max={100} value={createForm.quantity} onChange={(event) => setCreateForm((current) => ({ ...current, quantity: event.target.value }))} className={inputClass} /></Field>}
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Tình trạng ban đầu"><select value={createForm.condition} onChange={(event) => setCreateForm((current) => ({ ...current, condition: event.target.value as CreateForm["condition"] }))} className={inputClass}>{(["NEW", "GOOD", "FAIR"] as const).map((condition) => <option key={condition} value={condition}>{conditionLabel[condition]}</option>)}</select></Field><Field label="Ngày nhập kho"><input type="date" value={createForm.acquiredAt} onChange={(event) => setCreateForm((current) => ({ ...current, acquiredAt: event.target.value }))} className={inputClass} /></Field></div>
            <ModalActions saving={saving} onCancel={() => setShowCreate(false)} submitLabel={createForm.mode === "single" ? "Tạo thiết bị" : "Tạo hàng loạt"} />
          </form>
        </Modal>
      )}

      {showEdit && activeUnit && (
        <Modal title={`Sửa ${activeUnit.assetCode}`} onClose={() => setShowEdit(false)}>
          <form onSubmit={submitEdit} className="space-y-4">
            <Field label="Kho gốc"><select required value={editLocationId} onChange={(event) => setEditLocationId(event.target.value)} className={inputClass}>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}</select></Field>
            <Field label="Serial nhà sản xuất"><input value={editSerialNumber} onChange={(event) => setEditSerialNumber(event.target.value)} className={inputClass} /></Field>
            <Field label="Ngày nhập kho"><input type="date" value={editAcquiredAt} onChange={(event) => setEditAcquiredAt(event.target.value)} className={inputClass} /></Field>
            <p className="text-[10px] leading-5 text-slate-500">API chỉ cho sửa metadata. Trạng thái, condition, QR và kho hiện tại thuộc lifecycle riêng.</p>
            <ModalActions saving={saving} onCancel={() => setShowEdit(false)} submitLabel="Lưu cập nhật" />
          </form>
        </Modal>
      )}

      {showMaintenance && activeUnit && (
        <Modal title={activeUnit.status === "MAINTENANCE" ? "Hoàn tất bảo trì" : "Bắt đầu bảo trì"} onClose={() => setShowMaintenance(false)}>
          <form onSubmit={submitMaintenance} className="space-y-4">
            {activeUnit.status === "MAINTENANCE" ? <Field label="Tình trạng sau bảo trì"><select value={resultingCondition} onChange={(event) => setResultingCondition(event.target.value as EquipmentCondition)} className={inputClass}>{allConditions.map((condition) => <option key={condition} value={condition}>{conditionLabel[condition]}</option>)}</select></Field> : <><Field label="Lý do"><input required value={maintenanceReason} onChange={(event) => setMaintenanceReason(event.target.value)} className={inputClass} placeholder="Ví dụ: khóa kéo bị hỏng" /></Field><Field label="Ghi chú"><textarea value={maintenanceNotes} onChange={(event) => setMaintenanceNotes(event.target.value)} className={`${inputClass} min-h-24 py-3`} /></Field></>}
            <ModalActions saving={saving} onCancel={() => setShowMaintenance(false)} submitLabel={activeUnit.status === "MAINTENANCE" ? "Hoàn tất" : "Bắt đầu"} />
          </form>
        </Modal>
      )}

      {labels.length > 0 && (
        <Modal title={`Dữ liệu tem QR (${labels.length})`} onClose={() => setLabels([])}>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto">
            {labels.map((label) => <article key={label.unitId} className="rounded-xl border border-dashed border-slate-300 p-4"><p className="font-mono text-sm font-black text-emerald-900">{label.assetCode}</p><p className="mt-2 break-all font-mono text-[10px] text-slate-500">{label.qrPayload}</p><p className="mt-2 text-xs font-bold">{label.printText}</p></article>)}
          </div>
          <div className="mt-5 flex justify-end"><button type="button" onClick={() => window.print()} className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white">In bằng trình duyệt</button></div>
        </Modal>
      )}
    </main>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={onClose}><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><h2 className="text-lg font-black text-slate-950">{title}</h2><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg">×</button></header><div className="p-6">{children}</div></section></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-600">{label}</span>{children}</label>;
}

function ModalActions({ saving, onCancel, submitLabel }: { saving: boolean; onCancel: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onCancel} className="rounded-lg bg-slate-100 px-4 py-3 text-xs font-bold">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-black text-white disabled:opacity-50">{saving ? "Đang xử lý..." : submitLabel}</button></div>;
}


