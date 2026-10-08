"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getRentalCategories } from "@/features/rentals/services/rental.api";
import {
  changeStaffRentalProductStatus,
  createStaffRentalProduct,
  getStaffProductErrorMessage,
  listStaffRentalProducts,
  updateStaffRentalProduct,
} from "@/features/rentals/services/staff-products.api";
import type {
  RentalCategory,
  RentalDepositPolicyType,
  RentalPagination,
  RentalProduct,
  StaffRentalProductStatus,
} from "@/features/rentals/types/rental";

const emptyPagination: RentalPagination = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
};

const statusConfig: Record<
  StaffRentalProductStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Đang bán",
    className: "bg-emerald-100 text-emerald-800",
  },
  INACTIVE: {
    label: "Chưa công khai",
    className: "bg-amber-100 text-amber-800",
  },
  ARCHIVED: {
    label: "Đã lưu trữ",
    className: "bg-slate-200 text-slate-700",
  },
};

type ProductForm = {
  categoryId: string;
  sku: string;
  name: string;
  description: string;
  dailyPrice: string;
  replacementValue: string;
  depositType: RentalDepositPolicyType;
  depositAmount: string;
  depositPercentage: string;
  imageMediaIds: string;
  recommendationTags: string;
  specJson: string;
};

const emptyForm: ProductForm = {
  categoryId: "",
  sku: "",
  name: "",
  description: "",
  dailyPrice: "",
  replacementValue: "",
  depositType: "FIXED",
  depositAmount: "",
  depositPercentage: "50",
  imageMediaIds: "",
  recommendationTags: "",
  specJson: "{}",
};

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function asStatus(value?: string): StaffRentalProductStatus {
  if (value === "ACTIVE" || value === "ARCHIVED") {
    return value;
  }

  return "INACTIVE";
}

function formatMoney(value?: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function splitValues(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifySpec(spec: Record<string, unknown>) {
  try {
    return JSON.stringify(spec, null, 2);
  } catch {
    return "{}";
  }
}

function parseSpec(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {};
  }

  const parsed: unknown = JSON.parse(trimmed);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Thông số kỹ thuật phải là một JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export function StaffRentalProducts() {
  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [categories, setCategories] = useState<RentalCategory[]>([]);
  const [pagination, setPagination] =
    useState<RentalPagination>(emptyPagination);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] =
    useState<StaffRentalProductStatus | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<RentalProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  useEffect(() => {
    const controller = new AbortController();

    getRentalCategories(controller.signal)
      .then((result) => setCategories(result.items))
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(getStaffProductErrorMessage(loadError));
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    listStaffRentalProducts({
      page,
      pageSize: 20,
      status: statusFilter || undefined,
      signal: controller.signal,
    })
      .then((result) => {
        setProducts(result.items);
        setPagination(result.pagination);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(getStaffProductErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, reloadToken, statusFilter]);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("vi");

    if (!normalizedSearch) {
      return products;
    }

    return products.filter((product) =>
      [product.sku, product.name, product.category.name]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("vi").includes(normalizedSearch),
        ),
    );
  }, [products, search]);

  const pageStats = useMemo(() => {
    return {
      active: products.filter((product) => product.status === "ACTIVE").length,
      inactive: products.filter((product) => product.status === "INACTIVE").length,
      archived: products.filter((product) => product.status === "ARCHIVED").length,
    };
  }, [products]);

  function requestReload(message?: string) {
    setLoading(true);
    setNotice(message ?? "");
    setReloadToken((current) => current + 1);
  }

  function openCreateModal() {
    setSelectedProduct(null);
    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id ?? "",
    });
    setError("");
    setModalMode("create");
  }

  function openEditModal(product: RentalProduct) {
    setSelectedProduct(product);
    setForm({
      categoryId: product.category.id,
      sku: product.sku ?? "",
      name: product.name,
      description: product.description,
      dailyPrice: String(product.dailyPrice),
      replacementValue: String(product.replacementValue ?? 0),
      depositType:
        product.depositPolicy.type === "PERCENT_REPLACEMENT_VALUE"
          ? "PERCENT_REPLACEMENT_VALUE"
          : "FIXED",
      depositAmount: String(product.depositPolicy.amount ?? 0),
      depositPercentage: String(product.depositPolicy.percentage ?? 0),
      imageMediaIds: (product.imageMediaIds ?? []).join("\n"),
      recommendationTags: (product.recommendationTags ?? []).join(", "),
      specJson: stringifySpec(product.spec),
    });
    setError("");
    setModalMode("edit");
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setModalMode(null);
    setSelectedProduct(null);
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const dailyPrice = Number(form.dailyPrice);
      const replacementValue = Number(form.replacementValue);
      const depositAmount = Number(form.depositAmount || 0);
      const depositPercentage = Number(form.depositPercentage || 0);
      const spec = parseSpec(form.specJson);

      if (!Number.isFinite(dailyPrice) || dailyPrice < 0) {
        throw new Error("Giá thuê mỗi ngày không hợp lệ.");
      }

      if (!Number.isFinite(replacementValue) || replacementValue < 0) {
        throw new Error("Giá trị thay thế không hợp lệ.");
      }

      const depositPolicy =
        form.depositType === "FIXED"
          ? {
              type: "FIXED" as const,
              amount: depositAmount,
            }
          : {
              type: "PERCENT_REPLACEMENT_VALUE" as const,
              percentage: depositPercentage,
            };

      const sharedInput = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        dailyPrice,
        replacementValue,
        depositPolicy,
        imageMediaIds: splitValues(form.imageMediaIds),
        spec,
        recommendationTags: splitValues(form.recommendationTags),
      };

      if (modalMode === "create") {
        await createStaffRentalProduct({
          categoryId: form.categoryId,
          sku: form.sku.trim(),
          currency: "VND",
          ...sharedInput,
        });
        setModalMode(null);
        setSelectedProduct(null);
        requestReload("Đã tạo sản phẩm ở trạng thái chưa công khai.");
      } else if (selectedProduct?.id && selectedProduct.version) {
        await updateStaffRentalProduct(selectedProduct.id, {
          expectedVersion: selectedProduct.version,
          ...sharedInput,
        });
        setModalMode(null);
        setSelectedProduct(null);
        requestReload("Đã cập nhật thông tin sản phẩm.");
      }
    } catch (submitError: unknown) {
      setError(getStaffProductErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    product: RentalProduct,
    nextStatus: StaffRentalProductStatus,
  ) {
    const currentStatus = asStatus(product.status);

    if (currentStatus === nextStatus) {
      return;
    }

    const action =
      nextStatus === "ACTIVE"
        ? "công khai"
        : nextStatus === "INACTIVE"
          ? "tạm ẩn"
          : "lưu trữ";

    if (!window.confirm(`Xác nhận ${action} “${product.name}”?`)) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await changeStaffRentalProductStatus(product.id, {
        status: nextStatus,
        expectedVersion: product.version ?? 1,
      });
      requestReload(`Đã ${action} sản phẩm.`);
    } catch (statusError: unknown) {
      setError(getStaffProductErrorMessage(statusError));
    } finally {
      setSaving(false);
    }
  }

  function changeFilter(nextStatus: StaffRentalProductStatus | "") {
    setLoading(true);
    setPage(1);
    setStatusFilter(nextStatus);
  }

  return (
    <main className="min-h-[calc(100vh-70px)] p-6">
      <section className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                W02 · Rental Catalog
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">
                API thật · Optimistic locking
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black text-[#123f2d]">
              Quản lý danh mục cho thuê
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Tạo loại thiết bị, cấu hình giá thuê và chỉ công khai khi dữ liệu đã hoàn thiện.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => requestReload("Đã làm mới dữ liệu từ API.")}
              disabled={loading}
              className="h-11 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 disabled:opacity-50"
            >
              ↻ Làm mới
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={categories.length === 0}
              className="h-11 rounded-lg bg-[#125238] px-5 text-xs font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              ＋ Tạo sản phẩm thuê
            </button>
          </div>
        </header>

        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>
              Đóng
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>
              Đóng
            </button>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Tổng theo bộ lọc"
            value={pagination.totalItems}
            detail={`Trang ${pagination.page}/${Math.max(pagination.totalPages, 1)}`}
            color="text-slate-950"
          />
          <StatCard
            label="Đang bán trên trang"
            value={pageStats.active}
            detail="User có thể nhìn thấy"
            color="text-emerald-700"
          />
          <StatCard
            label="Chưa công khai"
            value={pageStats.inactive}
            detail="Cần hoàn thiện dữ liệu"
            color="text-amber-700"
          />
          <StatCard
            label="Đã lưu trữ"
            value={pageStats.archived}
            detail="Không xuất hiện ở catalog"
            color="text-slate-600"
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full max-w-xl">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`${inputClass} pl-9`}
                placeholder="Tìm SKU, tên sản phẩm hoặc danh mục trên trang hiện tại"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                ["", "Tất cả"],
                ["ACTIVE", "Đang bán"],
                ["INACTIVE", "Chưa công khai"],
                ["ARCHIVED", "Đã lưu trữ"],
              ] as const).map(([value, label]) => (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() => changeFilter(value)}
                  className={`rounded-lg px-3 py-2 text-[10px] font-black transition ${
                    statusFilter === value
                      ? "bg-[#125238] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">Danh mục</th>
                  <th className="px-4 py-3">Giá/ngày</th>
                  <th className="px-4 py-3">Chính sách cọc</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-xs font-bold text-slate-500">
                      Đang đồng bộ danh mục từ API...
                    </td>
                  </tr>
                ) : visibleProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <p className="text-sm font-black text-slate-800">
                        Chưa có sản phẩm phù hợp
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Thử đổi bộ lọc hoặc tạo sản phẩm thuê đầu tiên.
                      </p>
                    </td>
                  </tr>
                ) : (
                  visibleProducts.map((product) => {
                    const status = asStatus(product.status);

                    return (
                      <tr key={product.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-4">
                          <div className="flex min-w-64 gap-3">
                            <div
                              className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 bg-cover bg-center"
                              style={{
                                backgroundImage: `url("${product.imageUrls[0]}")`,
                              }}
                            />
                            <div>
                              <p className="text-xs font-black text-slate-950">
                                {product.name}
                              </p>
                              <p className="mt-1 font-mono text-[10px] font-bold text-emerald-800">
                                {product.sku || "NO-SKU"}
                              </p>
                              <p className="mt-1 line-clamp-1 max-w-80 text-[10px] text-slate-500">
                                {product.description || "Chưa có mô tả"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-slate-700">
                          {product.category.name}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs font-black text-slate-950">
                            {formatMoney(product.dailyPrice)}
                          </p>
                          <p className="mt-1 text-[9px] text-slate-500">
                            Thay thế: {formatMoney(product.replacementValue)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-[10px] text-slate-600">
                          {product.depositPolicy.type === "PERCENT_REPLACEMENT_VALUE"
                            ? `${product.depositPolicy.percentage ?? 0}% giá trị thay thế`
                            : formatMoney(product.depositPolicy.amount)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1.5 text-[9px] font-black ${statusConfig[status].className}`}>
                            {statusConfig[status].label}
                          </span>
                          <p className="mt-2 text-[9px] text-slate-400">
                            version {product.version ?? 1}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-44 flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700"
                            >
                              Chỉnh sửa
                            </button>
                            {status !== "ACTIVE" && status !== "ARCHIVED" && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => updateStatus(product, "ACTIVE")}
                                className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"
                              >
                                Công khai
                              </button>
                            )}
                            {status === "ACTIVE" && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => updateStatus(product, "INACTIVE")}
                                className="rounded-lg bg-amber-100 px-3 py-2 text-[10px] font-black text-amber-800 disabled:opacity-50"
                              >
                                Tạm ẩn
                              </button>
                            )}
                            {status !== "ARCHIVED" && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => updateStatus(product, "ARCHIVED")}
                                className="rounded-lg bg-slate-200 px-3 py-2 text-[10px] font-black text-slate-700 disabled:opacity-50"
                              >
                                Lưu trữ
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500">
            <span>
              {pagination.totalItems} sản phẩm · trang {pagination.page} / {Math.max(pagination.totalPages, 1)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.max(1, current - 1));
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 font-black disabled:opacity-40"
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={loading || pagination.totalPages === 0 || page >= pagination.totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => current + 1);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 font-black disabled:opacity-40"
              >
                Trang sau
              </button>
            </div>
          </footer>
        </section>
      </section>

      {modalMode && (
        <Modal
          title={modalMode === "create" ? "Tạo sản phẩm thuê" : "Chỉnh sửa sản phẩm thuê"}
          onClose={closeModal}
        >
          <form onSubmit={submitProduct} className="space-y-4">
            {modalMode === "create" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Danh mục">
                  <select
                    required
                    value={form.categoryId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        categoryId: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="SKU">
                  <input
                    required
                    maxLength={80}
                    value={form.sku}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sku: event.target.value }))
                    }
                    className={inputClass}
                    placeholder="TENT-4P-001"
                  />
                </Field>
              </div>
            ) : (
              <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Danh mục</p>
                  <p className="mt-1 font-bold">{selectedProduct?.category.name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">SKU cố định</p>
                  <p className="mt-1 font-mono font-bold">{selectedProduct?.sku}</p>
                </div>
              </div>
            )}

            <Field label="Tên sản phẩm">
              <input
                required
                maxLength={200}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className={inputClass}
              />
            </Field>

            <Field label="Mô tả">
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className={`${inputClass} min-h-24 py-3`}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Giá thuê/ngày (VND)">
                <input
                  required
                  type="number"
                  min={0}
                  value={form.dailyPrice}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dailyPrice: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Giá trị thay thế (VND)">
                <input
                  required
                  type="number"
                  min={0}
                  value={form.replacementValue}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      replacementValue: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kiểu tiền cọc">
                <select
                  value={form.depositType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      depositType: event.target.value as RentalDepositPolicyType,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="FIXED">Số tiền cố định</option>
                  <option value="PERCENT_REPLACEMENT_VALUE">% giá trị thay thế</option>
                </select>
              </Field>
              {form.depositType === "FIXED" ? (
                <Field label="Tiền cọc cố định (VND)">
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.depositAmount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        depositAmount: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
              ) : (
                <Field label="Tỷ lệ cọc (%)">
                  <input
                    required
                    type="number"
                    min={0}
                    max={100}
                    value={form.depositPercentage}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        depositPercentage: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
              )}
            </div>

            <Field label="Media IDs hoặc URL ảnh — mỗi dòng một giá trị">
              <textarea
                value={form.imageMediaIds}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    imageMediaIds: event.target.value,
                  }))
                }
                className={`${inputClass} min-h-20 py-3 font-mono`}
              />
            </Field>

            <Field label="Recommendation tags — phân cách bằng dấu phẩy">
              <input
                value={form.recommendationTags}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recommendationTags: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="camping, family, rain"
              />
            </Field>

            <Field label="Thông số kỹ thuật — JSON object">
              <textarea
                value={form.specJson}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    specJson: event.target.value,
                  }))
                }
                className={`${inputClass} min-h-32 py-3 font-mono`}
                spellCheck={false}
              />
            </Field>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[10px] leading-5 text-blue-800">
              Sản phẩm mới luôn ở trạng thái <strong>INACTIVE</strong>. Sau khi kiểm tra thông tin, dùng nút “Công khai” ở danh sách để chuyển sang ACTIVE.
            </div>

            <ModalActions
              saving={saving}
              onCancel={closeModal}
              submitLabel={modalMode === "create" ? "Tạo sản phẩm" : "Lưu thay đổi"}
            />
          </form>
        </Modal>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  color: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </article>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-lg font-black text-[#123f2d]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600"
          >
            ×
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModalActions({
  saving,
  onCancel,
  submitLabel,
}: {
  saving: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="h-11 rounded-lg border border-slate-200 px-4 text-xs font-black text-slate-600 disabled:opacity-50"
      >
        Hủy
      </button>
      <button
        type="submit"
        disabled={saving}
        className="h-11 rounded-lg bg-[#125238] px-5 text-xs font-black text-white disabled:opacity-50"
      >
        {saving ? "Đang lưu..." : submitLabel}
      </button>
    </div>
  );
}
