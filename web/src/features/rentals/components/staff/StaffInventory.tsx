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

/** Hôm nay theo giờ VN, dạng YYYY-MM-DD (cùng lịch với backend khi so hạn dùng). */
/**
 * Cảnh báo hao mòn theo đúng backend (RB-API-611): lượt thuê được cộng khi kho nhận về,
 * lượt làm số lượt chạm ngưỡng sẽ đưa món sang bảo trì.
 */
function wearNotice(unit: Pick<EquipmentUnit, "rentalCount" | "product" | "status">): string | null {
  const max = unit.product.maxRentalCycles;
  if (!max || max <= 0) return null;
  const count = unit.rentalCount ?? 0;
  if (count >= max) {
    return unit.status === "MAINTENANCE"
      ? `Đang bảo trì vì đạt ngưỡng hao mòn (${count}/${max} lượt). Khi hoàn tất: "Dùng tiếp" đếm lại từ 0, hoặc chọn Ngừng sử dụng.`
      : `Đã vượt ngưỡng hao mòn (${count}/${max} lượt, do ngưỡng vừa bị hạ). Lần kho nhận về tới sẽ tự chuyển bảo trì.`;
  }
  if (count + 1 >= max) {
    return `Lượt thuê tới là lượt cuối (${count}/${max}): khi kho nhận về, thiết bị sẽ tự chuyển bảo trì thay vì về kệ.`;
  }
  return null;
}

/** Đã đạt ngưỡng hao mòn của sản phẩm (cùng quy tắc backend `isWearLimitReached`). */
function unitWornOut(unit: Pick<EquipmentUnit, "rentalCount" | "product">) {
  const max = unit.product.maxRentalCycles;
  return Boolean(max && max > 0 && (unit.rentalCount ?? 0) >= max);
}

function vnToday(offsetDays = 0) {
  const shifted = new Date(Date.now() + 7 * 3600_000 + offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

const EXPIRY_SOON_DAYS = 30;

/** Hạn dùng của unit: hết hạn (backend đã/ sẽ rút khỏi cho thuê), sắp hết hạn, hoặc còn hạn. */
function expiryState(unit: Pick<EquipmentUnit, "expiresAt" | "isExpired">): "NONE" | "EXPIRED" | "SOON" | "OK" {
  if (!unit.expiresAt) return "NONE";
  if (unit.isExpired || unit.expiresAt.slice(0, 10) <= vnToday()) return "EXPIRED";
  if (unit.expiresAt.slice(0, 10) <= vnToday(EXPIRY_SOON_DAYS)) return "SOON";
  return "OK";
}

function ExpiryBadge({ unit }: { unit: EquipmentUnit }) {
  const state = expiryState(unit);
  if (state === "NONE") return <span className="text-[9px] text-slate-400">Không có hạn dùng</span>;
  const style =
    state === "EXPIRED"
      ? "bg-red-100 text-red-700"
      : state === "SOON"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";
  const label = state === "EXPIRED" ? "Hết hạn" : state === "SOON" ? "Sắp hết hạn" : "Hạn dùng";
  return (
    <span className={`inline-flex rounded px-2 py-1 text-[9px] font-semibold ${style}`}>
      {label} · {formatDay(unit.expiresAt)}
    </span>
  );
}

/** Lượt thuê so với ngưỡng hao mòn của sản phẩm; không có ngưỡng thì chỉ hiện số lượt. */
function WearMeter({ unit }: { unit: EquipmentUnit }) {
  const count = unit.rentalCount ?? 0;
  const limit = unit.product.maxRentalCycles ?? null;
  if (!limit || unit.wearPercent == null) {
    return <span className="text-[9px] text-slate-500">{count} lượt thuê</span>;
  }
  const percent = unit.wearPercent;
  const bar = percent >= 100 ? "bg-red-600" : percent >= 80 ? "bg-amber-500" : "bg-emerald-600";
  return (
    <span className="block w-28">
      <span className="flex justify-between text-[9px] text-slate-600">
        <span>Hao mòn {percent}%</span>
        <span>{count}/{limit}</span>
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.max(4, percent)}%` }} />
      </span>
    </span>
  );
}

const maintenanceReasonLabel: Record<string, string> = {
  WEAR_LIMIT_REACHED: "Đạt ngưỡng hao mòn (tự động)",
  HANDOVER_SHORTAGE: "Thiếu trong kiện lúc giao — cần tìm lại",
};

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
  batchCode: string;
  expiresAt: string;
  conditionNotes: string;
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
  batchCode: "",
  expiresAt: "",
  conditionNotes: "",
};

// Tên sản phẩm có hạng kèm hậu tố ("– Rất mới" / "– Đã sử dụng tốt"): tách thành tên + nhãn hạng.
function splitGradeName(name: string): { base: string; grade: "Như mới" | "Sử dụng tốt" | null } {
  const match = name.match(/\s*[-–—:]\s*(rất mới|như mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i);
  if (!match) return { base: name, grade: null };
  const suffix = match[1].toLocaleLowerCase("vi");
  return {
    base: name.slice(0, match.index).trim(),
    grade: suffix.includes("sử dụng") ? "Sử dụng tốt" : "Như mới",
  };
}

function GradeName({ name, className }: { name: string; className: string }) {
  const { base, grade } = splitGradeName(name);
  return (
    <span className={className}>
      {base}
      {grade && (
        <span
          className={`ml-1.5 inline-block rounded-full px-2 py-0.5 align-middle text-[10px] font-semibold ${grade === "Như mới" ? "bg-[#E4F6D8] text-[#17603F]" : "bg-[#FFF2D1] text-[#8A5A00]"}`}
        >
          {grade}
        </span>
      )}
    </span>
  );
}

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
  const [batchFilter, setBatchFilter] = useState("");
  const [debouncedBatch, setDebouncedBatch] = useState("");
  const [expiringBeforeFilter, setExpiringBeforeFilter] = useState("");
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
  const [editBatchCode, setEditBatchCode] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editConditionNotes, setEditConditionNotes] = useState("");
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const [resultingCondition, setResultingCondition] =
    useState<EquipmentCondition>("GOOD");
  const [retireAfterMaintenance, setRetireAfterMaintenance] = useState(false);
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
    const timer = window.setTimeout(() => {
      setDebouncedBatch(batchFilter.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [batchFilter]);

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
          batchCode: debouncedBatch || undefined,
          expiringBefore: expiringBeforeFilter || undefined,
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
    debouncedBatch,
    debouncedSearch,
    expiringBeforeFilter,
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
    // Backend từ chối hạn dùng ≤ hôm nay (unit sẽ bị rút ngay); báo trước cho nhân viên.
    if (createForm.expiresAt && createForm.expiresAt <= vnToday()) {
      setError("Hạn dùng phải sau hôm nay.");
      return;
    }
    const intakeFields = {
      batchCode: createForm.batchCode.trim() || undefined,
      expiresAt: createForm.expiresAt || undefined,
      conditionNotes: createForm.conditionNotes.trim() || undefined,
    };
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
          ...intakeFields,
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
          ...intakeFields,
        });
        showSuccess(
          `Đã nhập ${quantity} thiết bị mới vào kho${intakeFields.batchCode ? ` (lô ${intakeFields.batchCode})` : ""}.`,
        );
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
    setEditBatchCode(activeUnit.intakeBatchCode ?? "");
    setEditExpiresAt(activeUnit.expiresAt?.slice(0, 10) ?? "");
    setEditConditionNotes(activeUnit.conditionNotes ?? "");
    setShowEdit(true);
  }

  // Nhân viên kho chỉ được rút ngắn hạn dùng; kéo dài hoặc xoá hạn là việc của Admin (/admin/inventory).
  const currentExpiry = activeUnit?.expiresAt?.slice(0, 10) ?? "";
  const editExtendsExpiry = Boolean(currentExpiry) && (!editExpiresAt || editExpiresAt > currentExpiry);

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUnit) return;
    if (editExtendsExpiry) {
      setError("Chỉ Admin được kéo dài hoặc xoá hạn dùng. Nhân viên kho chỉ được rút ngắn.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      await updateEquipmentUnit(activeUnit.id, {
        expectedVersion: activeUnit.version,
        homeInventoryLocationId: editLocationId,
        serialNumber: editSerialNumber.trim() || null,
        acquiredAt: editAcquiredAt || null,
        batchCode: editBatchCode.trim() || null,
        expiresAt: editExpiresAt || null,
        conditionNotes: editConditionNotes.trim() || null,
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
        const usable = resultingCondition !== "DAMAGED" && resultingCondition !== "LOST";
        const retire = usable && retireAfterMaintenance;
        await changeEquipmentMaintenance(activeUnit.id, {
          action: "COMPLETE",
          resultingCondition,
          ...(retire ? { retire: true } : {}),
          expectedVersion: activeUnit.version,
        });
        showSuccess(
          retire
            ? `Đã hoàn tất bảo trì và chuyển ${activeUnit.assetCode} sang Ngừng sử dụng.`
            : usable && unitWornOut(activeUnit)
              ? `Đã hoàn tất bảo trì ${activeUnit.assetCode}: dùng tiếp, đếm lượt thuê lại từ 0.`
              : `Đã hoàn tất bảo trì ${activeUnit.assetCode}.`,
        );
        setRetireAfterMaintenance(false);
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
      "Batch",
      "Expires at",
      "Rental count",
      "Wear %",
    ];
    const rows = units.map((unit) => [
      unit.assetCode,
      unit.qrCode ?? "",
      unit.serialNumber ?? "",
      unit.product.name,
      unit.status,
      unit.condition,
      unit.currentInventoryLocation?.name ?? "",
      unit.intakeBatchCode ?? "",
      unit.expiresAt ?? "",
      unit.rentalCount ?? 0,
      unit.wearPercent ?? "",
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
              <h1 className="text-2xl font-bold text-slate-950">
                Quản lý Kho thiết bị & Vật tư
              </h1>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold text-emerald-800">
                API thật · {locations.length} kho hoạt động
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={units.length === 0}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              ⇩ Xuất CSV trang hiện tại
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={products.length === 0 || locations.length === 0}
              className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              ⊕ Nhập thiết bị mới
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
            <span>⚠ {error}</span>
            <button type="button" onClick={() => setError("")}>×</button>
          </div>
        )}
        {notice && (
          <div className="mt-4 rounded-lg bg-emerald-100 px-4 py-3 text-xs font-semibold text-emerald-900">
            ✓ {notice}
          </div>
        )}

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] text-slate-600">{stat.label}</p>
              <div className="mt-3 flex items-end gap-1">
                <strong className={`text-2xl font-bold ${stat.color}`}>{stat.value}</strong>
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

              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <input
                  value={batchFilter}
                  onChange={(event) => setBatchFilter(event.target.value)}
                  placeholder="Lọc theo mã lô nhập..."
                  className="h-10 rounded-lg bg-[#edf3ff] px-4 text-xs outline-none focus:ring-2 focus:ring-emerald-700"
                />
                <label className="flex h-10 items-center gap-2 rounded-lg bg-[#edf3ff] px-3 text-[10px] font-semibold text-slate-600">
                  Hết hạn trước
                  <input
                    type="date"
                    value={expiringBeforeFilter}
                    onChange={(event) => { setExpiringBeforeFilter(event.target.value); setPage(1); }}
                    className="flex-1 bg-transparent text-xs outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => { setExpiringBeforeFilter(vnToday(EXPIRY_SOON_DAYS)); setPage(1); }}
                  className={`h-10 rounded-lg px-3 text-[10px] font-semibold ${counts.expiringSoon ? "bg-amber-200 text-amber-950 ring-1 ring-amber-400" : "bg-amber-50 text-amber-900"}`}
                  title="Món còn trong vòng cho thuê đã hoặc sẽ hết hạn dùng trong 30 ngày (toàn kho)"
                >
                  Sắp hết hạn trong {EXPIRY_SOON_DAYS} ngày{counts.expiringSoon ? ` · ${counts.expiringSoon} món` : ""}
                </button>
                {(batchFilter || expiringBeforeFilter) && (
                  <button
                    type="button"
                    onClick={() => { setBatchFilter(""); setExpiringBeforeFilter(""); setPage(1); }}
                    className="h-10 rounded-lg bg-slate-100 px-3 text-[10px] font-semibold text-slate-700"
                  >
                    Bỏ lọc lô / hạn dùng
                  </button>
                )}
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[#edf3ff] p-3">
                <p className="text-xs font-semibold text-slate-700">☑ Đã chọn {selectedIds.length} thiết bị</p>
                <button type="button" disabled={saving} onClick={() => void requestLabels(selectedIds)} className="rounded-lg bg-[#125238] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50">
                  ▦ Lấy dữ liệu in QR
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="bg-[#e7eefc] text-[10px] uppercase text-slate-600">
                  <tr>
                    <th className="w-12 px-4 py-4"><input type="checkbox" checked={units.length > 0 && units.every((unit) => selectedIds.includes(unit.id))} onChange={toggleAllVisible} className="h-4 w-4 accent-[#125238]" /></th>
                    <th className="px-3 py-4">Mã thiết bị / QR</th>
                    <th className="px-3 py-4">Sản phẩm</th>
                    <th className="px-3 py-4">Kho hiện tại</th>
                    <th className="px-3 py-4">Tình trạng</th>
                    <th className="px-3 py-4">Lô · Hạn dùng · Hao mòn</th>
                    <th className="px-3 py-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit) => (
                    <tr key={unit.id} onClick={() => setActiveId(unit.id)} className={`cursor-pointer border-b border-slate-100 transition ${activeId === unit.id ? "bg-[#edf3ff]" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(unit.id)} onChange={() => toggleSelected(unit.id)} className="h-4 w-4 accent-[#125238]" /></td>
                      <td className="px-3 py-4"><p className="font-mono text-[11px] font-bold text-emerald-900">{unit.assetCode}</p><p className="mt-1 max-w-40 truncate font-mono text-[9px] text-slate-500">{unit.qrCode ?? "Chưa có QR"}</p></td>
                      <td className="px-3 py-4"><p className="text-xs font-bold text-slate-950"><GradeName name={unit.product.name} className="" /></p><p className="mt-1 text-[9px] text-slate-500">{unit.product.sku}</p></td>
                      <td className="px-3 py-4"><p className="text-xs font-semibold">{unit.currentInventoryLocation?.name ?? "Ngoài kho"}</p><p className="mt-1 text-[9px] text-slate-500">{unit.currentInventoryLocation?.code ?? "—"}</p></td>
                      <td className="px-3 py-4"><span className="rounded bg-[#e4ebf8] px-3 py-1.5 text-[9px] font-semibold text-slate-700">{conditionLabel[unit.condition]}</span></td>
                      <td className="px-3 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <p className="font-mono text-[9px] text-slate-500">{unit.intakeBatchCode ? `Lô ${unit.intakeBatchCode}` : "Chưa ghi lô"}</p>
                          <ExpiryBadge unit={unit} />
                          <WearMeter unit={unit} />
                        </div>
                      </td>
                      <td className="px-3 py-4"><span className={`inline-flex rounded-full px-3 py-2 text-[9px] font-bold ${statusConfig[unit.status].className}`}>{statusConfig[unit.status].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && units.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-4xl">📦</div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">Chưa có thiết bị phù hợp</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
                    API hiện trả về 0 thiết bị. Hãy bỏ bộ lọc hoặc nhập thiết bị đầu tiên từ sản phẩm và kho đang hoạt động.
                  </p>
                  <button type="button" onClick={openCreateModal} className="mt-4 rounded-lg bg-[#125238] px-4 py-3 text-xs font-bold text-white">⊕ Nhập thiết bị đầu tiên</button>
                </div>
              )}
              {loading && <div className="p-12 text-center text-xs font-semibold text-slate-500">Đang tải dữ liệu kho thật...</div>}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 bg-[#edf3ff] px-4 py-3 text-[10px] text-slate-600">
              <span>Trang {pagination.page} · {pagination.totalItems} thiết bị</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded bg-white px-3 py-2 font-semibold disabled:opacity-40">‹ Trước</button>
                <button type="button" disabled={pagination.totalPages === 0 || page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded bg-white px-3 py-2 font-semibold disabled:opacity-40">Sau ›</button>
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
                    <div><p className="font-mono text-[11px] font-bold text-emerald-900">#{activeUnit.assetCode}</p><h2 className="mt-2 text-xl font-bold text-slate-950"><GradeName name={activeUnit.product.name} className="" /></h2><p className="mt-1 text-[10px] text-slate-500">{activeUnit.product.sku} · v{activeUnit.version}</p></div>
                    <span className={`rounded-full px-3 py-2 text-[9px] font-bold ${statusConfig[activeUnit.status].className}`}>{statusConfig[activeUnit.status].label}</span>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  {detailLoading && <p className="text-[10px] font-semibold text-slate-500">Đang tải lịch sử...</p>}
                  <section className="rounded-xl bg-[#edf3ff] p-4">
                    <h3 className="text-[10px] font-bold uppercase text-slate-700">Nhận diện & vị trí</h3>
                    <dl className="mt-3 space-y-3 text-[10px]">
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">QR payload</dt><dd className="max-w-48 truncate font-mono font-bold">{activeUnit.qrCode ?? "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Serial</dt><dd className="font-bold">{activeUnit.serialNumber ?? "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Kho gốc</dt><dd className="text-right font-bold">{activeUnit.homeInventoryLocation.name}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Kho hiện tại</dt><dd className="text-right font-bold">{activeUnit.currentInventoryLocation?.name ?? "Ngoài kho"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Ngày nhập</dt><dd className="font-bold">{formatDate(activeUnit.acquiredAt)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Tình trạng</dt><dd className="font-bold">{conditionLabel[activeUnit.condition]}</dd></div>
                    </dl>
                  </section>

                  <section className="rounded-xl bg-[#edf3ff] p-4">
                    <h3 className="text-[10px] font-bold uppercase text-slate-700">Lô nhập · Hạn dùng · Hao mòn</h3>
                    <dl className="mt-3 space-y-3 text-[10px]">
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Mã lô</dt><dd className="font-mono font-bold">{activeUnit.intakeBatchCode ?? "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Hạn dùng</dt><dd><ExpiryBadge unit={activeUnit} /></dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Lượt thuê / ngưỡng</dt><dd className="font-bold">{activeUnit.rentalCount ?? 0} / {activeUnit.product.maxRentalCycles ?? "không giới hạn"}</dd></div>
                      {activeUnit.wearPercent != null && <div className="flex justify-between gap-3"><dt className="text-slate-500">Hao mòn</dt><dd><WearMeter unit={activeUnit} /></dd></div>}
                    </dl>
                    {activeUnit.conditionNotes && (
                      <p className="mt-3 rounded-lg bg-white p-3 text-[10px] leading-5 text-slate-700"><span className="font-semibold">Thực trạng lúc nhập:</span> {activeUnit.conditionNotes}</p>
                    )}
                    {expiryState(activeUnit) === "EXPIRED" && activeUnit.status !== "RETIRED" && (
                      <p className="mt-3 rounded-lg bg-red-50 p-3 text-[10px] leading-5 text-red-800">
                        Đã hết hạn dùng: không được cho thuê. {activeUnit.status === "AVAILABLE" ? "Hệ thống sẽ tự chuyển sang Ngừng sử dụng trong vòng 1 giờ." : "Thiết bị sẽ chuyển Ngừng sử dụng khi kho đưa về sau lượt thuê hiện tại."}
                      </p>
                    )}
                    {expiryState(activeUnit) === "SOON" && (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
                        Sắp hết hạn: thiết bị không được chọn cho đơn có hạn trả từ ngày {formatDay(activeUnit.expiresAt)} trở đi.
                      </p>
                    )}
                    {wearNotice(activeUnit) && (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
                        {wearNotice(activeUnit)}
                      </p>
                    )}
                  </section>

                  <section>
                    <div className="flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase">Nhật ký vận hành</h3><span className="text-[9px] text-slate-500">{activeDetail?.history.length ?? 0} sự kiện</span></div>
                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                      {(activeDetail?.history ?? []).map((event, index) => (
                        <div key={`${event.type}-${event.occurredAt}-${index}`} className="rounded-lg bg-[#edf3ff] p-3"><p className="text-[10px] font-bold">● {event.type}{typeof event.details?.reason === "string" ? ` · ${maintenanceReasonLabel[event.details.reason] ?? event.details.reason}` : ""}</p><p className="mt-1 text-[9px] text-slate-500">{formatDate(event.occurredAt)}{event.actor ? ` · ${event.actor}` : ""}</p></div>
                      ))}
                      {!detailLoading && (activeDetail?.history.length ?? 0) === 0 && <p className="rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500">Chưa có sự kiện lịch sử.</p>}
                    </div>
                  </section>

                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={saving} onClick={() => void requestLabels([activeUnit.id])} className="rounded-lg bg-[#edf3ff] px-3 py-3 text-[10px] font-semibold disabled:opacity-50">▦ In tem QR</button>
                    <button type="button" onClick={openEditModal} className="rounded-lg bg-[#edf3ff] px-3 py-3 text-[10px] font-semibold">✎ Sửa metadata</button>
                  </div>
                  <button type="button" onClick={() => { setRetireAfterMaintenance(false); setShowMaintenance(true); }} disabled={!(["AVAILABLE", "CLEANING", "DAMAGED", "MAINTENANCE"] as EquipmentUnitStatus[]).includes(activeUnit.status)} className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-40">
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
              {(["single", "batch"] as const).map((mode) => <button key={mode} type="button" onClick={() => setCreateForm((current) => ({ ...current, mode }))} className={`rounded-lg px-3 py-2 text-xs font-bold ${createForm.mode === mode ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500"}`}>{mode === "single" ? "Một thiết bị" : "Nhập hàng loạt"}</button>)}
            </div>
            <Field label="Sản phẩm"><select required value={createForm.productId} onChange={(event) => setCreateForm((current) => ({ ...current, productId: event.target.value }))} className={inputClass}><option value="">Chọn sản phẩm</option>{products.filter((product) => product.status === "ACTIVE").map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select>
              {createForm.productId ? (
                <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                  Ngưỡng hao mòn của sản phẩm: {products.find((product) => product.id === createForm.productId)?.maxRentalCycles ? `${products.find((product) => product.id === createForm.productId)?.maxRentalCycles} lượt thuê (đạt ngưỡng thì tự chuyển bảo trì)` : "không giới hạn"}. Đổi ngưỡng ở Danh mục cho thuê.
                </span>
              ) : null}</Field>
            <Field label="Kho gốc"><select required value={createForm.homeInventoryLocationId} onChange={(event) => setCreateForm((current) => ({ ...current, homeInventoryLocationId: event.target.value }))} className={inputClass}><option value="">Chọn kho</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}</select></Field>
            {createForm.mode === "single" ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Asset code (để trống = tự sinh)"><input value={createForm.assetCode} onChange={(event) => setCreateForm((current) => ({ ...current, assetCode: event.target.value }))} className={inputClass} /></Field><Field label="Serial nhà sản xuất"><input value={createForm.serialNumber} onChange={(event) => setCreateForm((current) => ({ ...current, serialNumber: event.target.value }))} className={inputClass} /></Field></div> : <Field label="Số lượng (1–100)"><input required type="number" min={1} max={100} value={createForm.quantity} onChange={(event) => setCreateForm((current) => ({ ...current, quantity: event.target.value }))} className={inputClass} /></Field>}
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Tình trạng ban đầu"><select value={createForm.condition} onChange={(event) => setCreateForm((current) => ({ ...current, condition: event.target.value as CreateForm["condition"] }))} className={inputClass}>{(["NEW", "GOOD", "FAIR"] as const).map((condition) => <option key={condition} value={condition}>{conditionLabel[condition]}</option>)}</select></Field><Field label="Ngày nhập kho"><input type="date" value={createForm.acquiredAt} onChange={(event) => setCreateForm((current) => ({ ...current, acquiredAt: event.target.value }))} className={inputClass} /></Field></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={createForm.mode === "batch" ? "Mã lô nhập (cả lô dùng chung)" : "Mã lô nhập"}><input value={createForm.batchCode} maxLength={60} onChange={(event) => setCreateForm((current) => ({ ...current, batchCode: event.target.value }))} className={inputClass} placeholder="Ví dụ: LO-2026-11-A" /></Field>
              <Field label="Hạn dùng (để trống = không có hạn)"><input type="date" min={vnToday(1)} value={createForm.expiresAt} onChange={(event) => setCreateForm((current) => ({ ...current, expiresAt: event.target.value }))} className={inputClass} /></Field>
            </div>
            <Field label={createForm.mode === "batch" ? "Ghi chú thực trạng lúc nhập (áp cho cả lô)" : "Ghi chú thực trạng lúc nhập"}><textarea value={createForm.conditionNotes} maxLength={2000} onChange={(event) => setCreateForm((current) => ({ ...current, conditionNotes: event.target.value }))} className={`${inputClass} min-h-20 py-3`} placeholder="Ví dụ: vỏ xước nhẹ ở góc, đủ phụ kiện" /></Field>
            <p className="text-[10px] leading-5 text-slate-500">Thiết bị chỉ phục vụ đơn kết thúc trước ngày hết hạn (tính cả thời gian kho kiểm đồ sau khi trả), nên số lượng cho thuê giảm dần khi gần hết hạn. Từ ngày hết hạn, nếu đang ở kho thì tự chuyển Ngừng sử dụng; nếu đang cho thuê thì chuyển khi kho nhận về. Nhân viên kho chỉ được rút ngắn hạn dùng, kéo dài phải nhờ Admin.</p>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mã lô nhập"><input value={editBatchCode} maxLength={60} onChange={(event) => setEditBatchCode(event.target.value)} className={inputClass} /></Field>
              <Field label={currentExpiry ? "Hạn dùng (chỉ được rút ngắn)" : "Hạn dùng (để trống = không có hạn)"}><input type="date" max={currentExpiry || undefined} value={editExpiresAt} onChange={(event) => setEditExpiresAt(event.target.value)} className={inputClass} /></Field>
            </div>
            <Field label="Ghi chú thực trạng lúc nhập"><textarea value={editConditionNotes} maxLength={2000} onChange={(event) => setEditConditionNotes(event.target.value)} className={`${inputClass} min-h-20 py-3`} /></Field>
            {editExtendsExpiry && (
              <p className="rounded-lg bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">Kéo dài hoặc xoá hạn dùng cần Admin kiểm tra và đổi ở trang Kho vật tư của Admin. Bạn chỉ được giữ nguyên hoặc rút ngắn ({formatDay(currentExpiry)}).</p>
            )}
            {editExpiresAt && editExpiresAt <= vnToday() && (
              <p className="rounded-lg bg-red-50 p-3 text-[10px] leading-5 text-red-800">Hạn dùng đã qua: nếu thiết bị đang ở kho, hệ thống sẽ tự chuyển sang Ngừng sử dụng trong vòng 1 giờ.</p>
            )}
            <p className="text-[10px] leading-5 text-slate-500">API chỉ cho sửa metadata. Trạng thái, condition, QR và kho hiện tại thuộc lifecycle riêng.</p>
            <ModalActions saving={saving} onCancel={() => setShowEdit(false)} submitLabel="Lưu cập nhật" />
          </form>
        </Modal>
      )}

      {showMaintenance && activeUnit && (
        <Modal title={activeUnit.status === "MAINTENANCE" ? "Hoàn tất bảo trì" : "Bắt đầu bảo trì"} onClose={() => setShowMaintenance(false)}>
          <form onSubmit={submitMaintenance} className="space-y-4">
            {activeUnit.status === "MAINTENANCE" ? <><Field label="Tình trạng sau bảo trì"><select value={resultingCondition} onChange={(event) => setResultingCondition(event.target.value as EquipmentCondition)} className={inputClass}>{allConditions.map((condition) => <option key={condition} value={condition}>{conditionLabel[condition]}</option>)}</select></Field>
              {resultingCondition !== "DAMAGED" && resultingCondition !== "LOST" ? (
                <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
                  <legend className="px-1 font-bold text-slate-700">Sau bảo trì</legend>
                  {unitWornOut(activeUnit) ? (
                    <p className="text-[10px] leading-4 text-amber-800">Thiết bị đã đạt ngưỡng hao mòn ({activeUnit.rentalCount}/{activeUnit.product.maxRentalCycles} lượt thuê).</p>
                  ) : null}
                  <label className="flex items-center gap-2"><input type="radio" name="after-maintenance" checked={!retireAfterMaintenance} onChange={() => setRetireAfterMaintenance(false)} />Dùng tiếp — về kệ cho thuê{unitWornOut(activeUnit) ? ", đếm lượt thuê lại từ 0" : ""}</label>
                  <label className="flex items-center gap-2"><input type="radio" name="after-maintenance" checked={retireAfterMaintenance} onChange={() => setRetireAfterMaintenance(true)} />Ngừng sử dụng — không cho thuê nữa</label>
                  {activeUnit.isExpired ? <p className="text-[10px] leading-4 text-red-700">Thiết bị đã hết hạn dùng nên sẽ chuyển Ngừng sử dụng dù chọn dùng tiếp.</p> : null}
                </fieldset>
              ) : null}</> : <><Field label="Lý do"><input required value={maintenanceReason} onChange={(event) => setMaintenanceReason(event.target.value)} className={inputClass} placeholder="Ví dụ: khóa kéo bị hỏng" /></Field><Field label="Ghi chú"><textarea value={maintenanceNotes} onChange={(event) => setMaintenanceNotes(event.target.value)} className={`${inputClass} min-h-24 py-3`} /></Field></>}
            <ModalActions saving={saving} onCancel={() => setShowMaintenance(false)} submitLabel={activeUnit.status === "MAINTENANCE" ? "Hoàn tất" : "Bắt đầu"} />
          </form>
        </Modal>
      )}

      {labels.length > 0 && (
        <Modal title={`Dữ liệu tem QR (${labels.length})`} onClose={() => setLabels([])}>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto">
            {labels.map((label) => <article key={label.unitId} className="rounded-xl border border-dashed border-slate-300 p-4"><p className="font-mono text-sm font-bold text-emerald-900">{label.assetCode}</p><p className="mt-2 break-all font-mono text-[10px] text-slate-500">{label.qrPayload}</p><p className="mt-2 text-xs font-semibold">{label.printText}</p></article>)}
          </div>
          <div className="mt-5 flex justify-end"><button type="button" onClick={() => window.print()} className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-bold text-white">In bằng trình duyệt</button></div>
        </Modal>
      )}
    </main>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={onClose}><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><h2 className="text-lg font-bold text-slate-950">{title}</h2><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg">×</button></header><div className="p-6">{children}</div></section></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-600">{label}</span>{children}</label>;
}

function ModalActions({ saving, onCancel, submitLabel }: { saving: boolean; onCancel: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onCancel} className="rounded-lg bg-slate-100 px-4 py-3 text-xs font-semibold">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-[#125238] px-4 py-3 text-xs font-bold text-white disabled:opacity-50">{saving ? "Đang xử lý..." : submitLabel}</button></div>;
}


