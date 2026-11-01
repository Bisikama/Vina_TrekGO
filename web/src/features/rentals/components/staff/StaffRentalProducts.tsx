"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuthStore } from "@/features/auth/store/authStore";
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
  RentalGrade,
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
    label: "Đang cho thuê",
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
  grade: RentalGrade | "";
  gradeGroupId: string;
};

const GRADE_LABELS: Record<RentalGrade, string> = {
  LIKE_NEW: "Mới",
  GOOD_USED: "Sử dụng tốt",
};

// Chỉ là gợi ý, lấy từ cặp mẫu trong seed backend (rental-product.seed.ts):
// "cọc ~30% / ~20% giá trị thay thế". ADMIN vẫn tự nhập số tiền cọc.
const GRADE_DEPOSIT_HINT_PERCENT: Record<RentalGrade, number> = {
  LIKE_NEW: 30,
  GOOD_USED: 20,
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
  grade: "",
  gradeGroupId: "",
};

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

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

type StaffRentalProductsProps = {
  /** "admin": hiển thị trong khung Admin (chữ lớn hơn, nét đậm vừa, tiêu đề theo cổng admin). */
  variant?: "staff" | "admin";
};

export function StaffRentalProducts({ variant = "staff" }: StaffRentalProductsProps = {}) {
  const isAdminLayout = variant === "admin";
  // Policy RB-POL-03: chỉ ADMIN đặt tiền cọc và giá trị thay thế. STAFF_INVENTORY không gửi hai field này.
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
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

  // Nhóm hạng đang có trên trang hiện tại (để thêm hạng còn thiếu vào nhóm sẵn có).
  const gradeGroups = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; label: string; grades: RentalGrade[]; members: RentalProduct[] }
    >();
    products.forEach((product) => {
      if (!product.gradeGroupId || !product.grade) return;
      const current = groups.get(product.gradeGroupId);
      if (current) {
        current.grades.push(product.grade);
        current.members.push(product);
      } else
        groups.set(product.gradeGroupId, {
          id: product.gradeGroupId,
          label: product.name.replace(/\s*[-–—:]\s*(rất mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i, "").trim(),
          grades: [product.grade],
          members: [product],
        });
    });
    return [...groups.values()];
  }, [products]);

  const selectedGradeGroup = gradeGroups.find(
    (group) => group.id === form.gradeGroupId,
  );
  const gradeDepositHint =
    form.grade && Number(form.replacementValue) > 0
      ? Math.round(
          (Number(form.replacementValue) * GRADE_DEPOSIT_HINT_PERCENT[form.grade]) / 100,
        )
      : null;

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
      grade: product.grade ?? "",
      gradeGroupId: product.gradeGroupId ?? "",
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

      if (isAdmin && (!Number.isFinite(replacementValue) || replacementValue < 0)) {
        throw new Error("Giá trị thay thế không hợp lệ.");
      }

      if (form.grade && form.depositType !== "FIXED") {
        throw new Error("Sản phẩm có hạng phải dùng tiền cọc cố định.");
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
        ...(isAdmin ? { replacementValue, depositPolicy } : {}),
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
          ...(isAdmin && form.grade
            ? {
                grade: form.grade,
                ...(form.gradeGroupId ? { gradeGroupId: form.gradeGroupId } : {}),
              }
            : {}),
        });
        setModalMode(null);
        setSelectedProduct(null);
        requestReload(
          isAdmin
            ? "Đã tạo sản phẩm."
            : "Đã tạo sản phẩm ở trạng thái chưa công khai. ADMIN cần đặt tiền cọc và giá trị thay thế trước khi mở cho thuê.",
        );
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
    <main
      className={
        isAdminLayout
          ? "p-6 text-[15px] [&_.font-black]:font-bold [&_.text-xs]:text-[13px]"
          : "min-h-[calc(100vh-70px)] p-6"
      }
    >
      <section className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            {isAdminLayout ? (
              <p className="text-sm text-gray-500">
                Hậu cần &amp; Vật tư <span className="mx-1.5">›</span>
                <span className="font-medium text-gray-900">Thiết bị cho thuê</span>
              </p>
            ) : null}
            <h1
              className={
                isAdminLayout
                  ? "mt-1 text-2xl font-bold text-gray-900"
                  : "text-2xl font-black text-[#123f2d]"
              }
            >
              {isAdminLayout ? "Thiết bị cho thuê" : "Quản lý danh mục cho thuê"}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {isAdminLayout
                ? "Đặt giá thuê, giá trị thay thế, tiền cọc và tình trạng sản phẩm. Chỉ công khai khi dữ liệu đã hoàn thiện."
                : "Tạo loại thiết bị, cấu hình giá thuê và chỉ công khai khi dữ liệu đã hoàn thiện."}
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
            label="Đang cho thuê trên trang"
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
                ["ACTIVE", "Đang cho thuê"],
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
                                {product.grade ? (
                                  <span
                                    className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${product.grade === "LIKE_NEW" ? "bg-[#E4F6D8] text-[#17603F]" : "bg-[#FFF2D1] text-[#8A5A00]"}`}
                                  >
                                    {GRADE_LABELS[product.grade]}
                                  </span>
                                ) : null}
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
                    disabled={Boolean(form.gradeGroupId)}
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
                  required={isAdmin}
                  disabled={!isAdmin || Boolean(form.gradeGroupId)}
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
                  disabled={!isAdmin || Boolean(form.grade)}
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
                    required={isAdmin}
                    disabled={!isAdmin}
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
                    required={isAdmin}
                    disabled={!isAdmin}
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

            {isAdmin && modalMode === "create" ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-800">Tình trạng (tuỳ chọn)</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  Dùng khi cùng một món có cả bản Mới và bản Sử dụng tốt. Hai bản là hai sản phẩm riêng,
                  được ghép thành một thẻ có nút chọn ở trang thuê. Bản Mới phải có giá thuê và tiền cọc cao
                  hơn; tiền cọc là số tiền cố định.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Tình trạng">
                    <select
                      value={form.grade}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          grade: event.target.value as RentalGrade | "",
                          gradeGroupId: event.target.value ? current.gradeGroupId : "",
                          depositType: event.target.value ? "FIXED" : current.depositType,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="">Không phân loại</option>
                      <option value="LIKE_NEW">{GRADE_LABELS.LIKE_NEW}</option>
                      <option value="GOOD_USED">{GRADE_LABELS.GOOD_USED}</option>
                    </select>
                  </Field>
                  <Field label="Ghép với sản phẩm">
                    <select
                      disabled={!form.grade}
                      value={form.gradeGroupId}
                      onChange={(event) => {
                        const sibling = gradeGroups.find(
                          (group) => group.id === event.target.value,
                        )?.members[0];
                        // Hai hạng cùng nhóm dùng chung danh mục và giá trị thay thế.
                        setForm((current) => ({
                          ...current,
                          gradeGroupId: event.target.value,
                          ...(sibling
                            ? {
                                categoryId: sibling.category.id,
                                replacementValue: String(sibling.replacementValue ?? 0),
                              }
                            : {}),
                        }));
                      }}
                      className={inputClass}
                    >
                      <option value="">Chưa có bản còn lại (tạo mới)</option>
                      {gradeGroups.map((group) => (
                        <option
                          key={group.id}
                          value={group.id}
                          disabled={Boolean(form.grade) && group.grades.includes(form.grade as RentalGrade)}
                        >
                          {group.label} (đã có: {group.grades.map((grade) => GRADE_LABELS[grade]).join(", ")})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {selectedGradeGroup ? (
                  <ul className="mt-3 space-y-1 text-[11px] leading-5 text-slate-600">
                    {selectedGradeGroup.members.map((member) => (
                      <li key={member.id}>
                        Bản {member.grade ? GRADE_LABELS[member.grade] : ""}:{" "}
                        {formatMoney(member.dailyPrice)}/ngày · cọc{" "}
                        {formatMoney(member.depositPolicy.amount ?? 0)}.{" "}
                        {form.grade === "GOOD_USED"
                          ? "Bản này phải thấp hơn cả hai số."
                          : "Bản này phải cao hơn cả hai số."}
                      </li>
                    ))}
                    <li>Danh mục và giá trị thay thế lấy theo bản còn lại.</li>
                  </ul>
                ) : null}
                {form.grade && gradeDepositHint !== null ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <span>
                      Gợi ý cọc ~{GRADE_DEPOSIT_HINT_PERCENT[form.grade]}% giá trị thay thế:{" "}
                      <strong>{formatMoney(gradeDepositHint)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          depositType: "FIXED",
                          depositAmount: String(gradeDepositHint),
                        }))
                      }
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 font-bold text-slate-700 hover:bg-slate-100"
                    >
                      Dùng gợi ý
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {modalMode === "edit" && form.grade ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                Tình trạng: <strong>{GRADE_LABELS[form.grade]}</strong> · không đổi được sau khi tạo.
              </p>
            ) : null}

            {!isAdmin ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                Tiền cọc và giá trị thay thế do ADMIN đặt. Nhân viên kho chỉ sửa giá thuê, mô tả và thông số; sản phẩm mới
                ở trạng thái chưa công khai cho tới khi ADMIN duyệt giá.
              </p>
            ) : null}

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
