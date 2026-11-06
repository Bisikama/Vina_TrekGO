"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Button,
  EmptyState,
  ErrorAlert,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  PageShell,
  Select,
  SurfaceCard,
  SurfaceSectionHeader,
} from "@/components/ui";
import type { GearCategory } from "@/features/rentals/services/gear.api";
import {
  getGearAttributeSchema,
  getProductProfile,
  saveProductProfile,
  type GearAttributeDefinition,
  type ProductTechnicalProfile,
} from "@/features/rentals/services/product-profile.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { getStaffRentalProducts } from "@/features/rentals/services/staff-inventory.api";
import type { RentalProduct } from "@/features/rentals/types/rental";

// Thông số kỹ thuật sản phẩm thuê: kế hoạch đồ và gợi ý thuê dùng hồ sơ này để so khớp nhu cầu chuyến.
// Danh sách sản phẩm: GET /staff/rental-products; hồ sơ: GET/PUT /staff/gear/product-profiles/:productId.

type FieldKind = "int" | "number" | "bool" | "enum";
type FieldDef = {
  key: string;
  label: string;
  unit: string;
  kind: FieldKind;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
};
type FieldMap = Record<GearCategory, FieldDef[]>;

const CATEGORIES: Array<[GearCategory, string]> = [
  ["JACKET", "Áo khoác"],
  ["FOOTWEAR", "Giày"],
  ["PANTS", "Quần"],
  ["BACKPACK", "Balo"],
  ["SLEEPING_BAG", "Túi ngủ"],
  ["TENT", "Lều"],
  ["TREKKING_POLE", "Gậy trekking"],
  ["RAIN_GEAR", "Đồ đi mưa"],
];

// Dự phòng khi chưa tải được GET /gear/attribute-schema; khớp schema backend (user-gear.dto.ts).
const FALLBACK_FIELDS: FieldMap = {
  JACKET: [
    { key: "waterproof_mm", label: "Chống nước", unit: "mm", kind: "int" },
    { key: "temp_rating_c", label: "Chịu lạnh", unit: "°C", kind: "int" },
    { key: "weight_g", label: "Trọng lượng", unit: "g", kind: "int" },
    { key: "windproof", label: "Cản gió", unit: "", kind: "bool" },
  ],
  FOOTWEAR: [
    { key: "waterproof", label: "Chống nước", unit: "", kind: "bool" },
    { key: "ankle_support", label: "Hỗ trợ cổ chân", unit: "", kind: "bool" },
    { key: "grip_level", label: "Độ bám", unit: "", kind: "int", min: 1, max: 5 },
    { key: "weight_g", label: "Trọng lượng", unit: "g", kind: "int" },
  ],
  PANTS: [
    { key: "waterproof_mm", label: "Chống nước", unit: "mm", kind: "int" },
    { key: "temp_rating_c", label: "Chịu lạnh", unit: "°C", kind: "int" },
    { key: "insulated", label: "Giữ nhiệt", unit: "", kind: "bool" },
  ],
  BACKPACK: [
    { key: "capacity_l", label: "Dung tích", unit: "L", kind: "int" },
    { key: "rain_cover", label: "Áo trùm mưa", unit: "", kind: "bool" },
    { key: "waterproof", label: "Chống nước", unit: "", kind: "bool" },
    { key: "weight_g", label: "Trọng lượng", unit: "g", kind: "int" },
  ],
  SLEEPING_BAG: [
    { key: "temp_rating_c", label: "Nhiệt độ chịu được", unit: "°C", kind: "int" },
    { key: "weight_g", label: "Trọng lượng", unit: "g", kind: "int" },
  ],
  TENT: [
    { key: "sleeping_places", label: "Sức chứa", unit: "người", kind: "int" },
    { key: "flysheet_waterproof_mm", label: "Chống nước mái", unit: "mm", kind: "int" },
    { key: "floor_waterproof_mm", label: "Chống nước đáy", unit: "mm", kind: "int" },
    { key: "weight_g", label: "Trọng lượng", unit: "g", kind: "int" },
  ],
  TREKKING_POLE: [
    { key: "adjustable", label: "Điều chỉnh độ dài", unit: "", kind: "bool" },
    { key: "length_min_cm", label: "Dài tối thiểu", unit: "cm", kind: "number" },
    { key: "length_max_cm", label: "Dài tối đa", unit: "cm", kind: "number" },
    { key: "weight_g", label: "Trọng lượng", unit: "g", kind: "int" },
  ],
  RAIN_GEAR: [
    { key: "waterproof_mm", label: "Chống nước", unit: "mm", kind: "int" },
    { key: "coverage", label: "Phạm vi che", unit: "", kind: "enum", options: [{ value: "UPPER_BODY", label: "Thân trên" }, { value: "FULL_BODY", label: "Toàn thân" }] },
    { key: "weight_g", label: "Trọng lượng", unit: "g", kind: "int" },
  ],
};

const GRADE_LABELS: Record<string, string> = { LIKE_NEW: "Như mới", GOOD_USED: "Sử dụng tốt" };

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES) as Record<GearCategory, string>;

const SAFE_LIMIT = 1e9;

// Chuyển một thuộc tính của GET /gear/attribute-schema thành định nghĩa ô nhập.
function fieldFromSchema(attribute: GearAttributeDefinition): FieldDef {
  const variants = attribute.schema?.anyOf ?? [attribute.schema ?? {}];
  const types = variants.flatMap((node) => (Array.isArray(node.type) ? node.type : node.type ? [node.type] : []));
  const enumNode = variants.find((node) => Array.isArray(node.enum));
  const numeric = variants.find((node) => node.type === "integer" || node.type === "number");
  const unit = attribute.unit && !attribute.unit.startsWith("/") ? attribute.unit : "";
  const base = { key: attribute.key, label: attribute.label ?? attribute.key, unit };
  if (types.includes("boolean")) return { ...base, kind: "bool" };
  if (enumNode || attribute.options?.length) {
    const options = attribute.options ?? (enumNode?.enum ?? []).map((value) => ({ value, label: value }));
    return { ...base, kind: "enum", options };
  }
  const bound = (value?: number) => (typeof value === "number" && Math.abs(value) < SAFE_LIMIT ? value : undefined);
  return {
    ...base,
    kind: numeric?.type === "integer" ? "int" : "number",
    min: bound(numeric?.minimum),
    max: bound(numeric?.maximum),
  };
}

// Gợi ý loại đồ từ tên sản phẩm, rồi tới tên danh mục thuê. Không khớp → sản phẩm không thuộc 8 loại có hồ sơ kỹ thuật.
const NAME_RULES: Array<[RegExp, GearCategory]> = [
  [/^túi ngủ/i, "SLEEPING_BAG"],
  [/^lều/i, "TENT"],
  [/^(balo|ba lô)/i, "BACKPACK"],
  [/^gậy/i, "TREKKING_POLE"],
  [/^(giày|giầy)/i, "FOOTWEAR"],
  [/^(áo mưa|bộ mưa|bộ quần áo mưa|poncho|quần mưa)/i, "RAIN_GEAR"],
  [/^(áo khoác|áo gió|áo lông|áo giữ nhiệt)/i, "JACKET"],
  [/^quần/i, "PANTS"],
];
const CATEGORY_RULES: Array<[RegExp, GearCategory]> = [
  [/giày/i, "FOOTWEAR"],
  [/balo/i, "BACKPACK"],
  [/gậy/i, "TREKKING_POLE"],
  [/lều/i, "TENT"],
  [/áo mưa|chống thời tiết/i, "RAIN_GEAR"],
];

function suggestCategory(product: RentalProduct): GearCategory | null {
  for (const [pattern, category] of NAME_RULES) if (pattern.test(product.name)) return category;
  const categoryName = product.category?.name ?? "";
  for (const [pattern, category] of CATEGORY_RULES) if (pattern.test(categoryName)) return category;
  return null;
}

function stripGradeSuffix(name: string) {
  return name
    .replace(/\s*[-–—:]\s*(rất mới|như mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i, "")
    .trim();
}

function toFormValues(attributes: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, typeof value === "boolean" ? (value ? "true" : "false") : String(value)]),
  ) as Record<string, string>;
}

function buildAttributes(fields: FieldDef[], values: Record<string, string>) {
  const attributes: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = (values[field.key] ?? "").trim();
    if (!raw) {
      attributes[field.key] = null;
      continue;
    }
    if (field.kind === "bool") attributes[field.key] = raw === "true";
    else if (field.kind === "enum") attributes[field.key] = raw;
    else {
      const parsed = Number(raw.replace(",", "."));
      if (!Number.isFinite(parsed)) throw new Error(`${field.label}: cần nhập số.`);
      if (field.kind === "int" && !Number.isInteger(parsed)) throw new Error(`${field.label}: cần số nguyên.`);
      if (field.min !== undefined && parsed < field.min) throw new Error(`${field.label}: tối thiểu ${field.min}.`);
      if (field.max !== undefined && parsed > field.max) throw new Error(`${field.label}: tối đa ${field.max}.`);
      attributes[field.key] = parsed;
    }
  }
  return attributes;
}

export function ProductProfileManager() {
  const [products, setProducts] = useState<RentalProduct[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldMap>(FALLBACK_FIELDS);

  // Bộ thông số lấy từ backend (GET /gear/attribute-schema); lỗi thì giữ bộ dự phòng.
  useEffect(() => {
    const controller = new AbortController();
    getGearAttributeSchema(controller.signal)
      .then((categories) => {
        if (controller.signal.aborted || categories.length === 0) return;
        const next = { ...FALLBACK_FIELDS };
        for (const entry of categories) {
          if (entry.category in next && entry.attributes?.length) next[entry.category] = entry.attributes.map(fieldFromSchema);
        }
        setFields(next);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getStaffRentalProducts({ pageSize: 100, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setProducts(result.items);
        const firstRelevant = result.items.find((item) => suggestCategory(item)) ?? result.items[0];
        setSelectedId((current) => current ?? firstRelevant?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setListError(getRentalApiErrorMessage(reason, "Không tải được danh sách sản phẩm thuê."));
        setProducts([]);
      });
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (products ?? [])
      .filter((product) => showAll || suggestCategory(product) !== null)
      .filter(
        (product) =>
          !keyword || product.name.toLowerCase().includes(keyword) || (product.sku ?? "").toLowerCase().includes(keyword),
      );
  }, [products, search, showAll]);

  const relevantCount = useMemo(() => (products ?? []).filter((product) => suggestCategory(product)).length, [products]);

  const selected = products?.find((product) => product.id === selectedId) ?? null;

  return (
    <PageShell maxWidth="full" withTopOffset={false}>
      <PageHeader
        eyebrow="Kho · Thuê thiết bị"
        title="Thông số kỹ thuật sản phẩm"
        description="Gán loại đồ và thông số cho từng sản phẩm thuê để kế hoạch đồ và gợi ý thuê so khớp đúng nhu cầu chuyến đi."
      />
      {listError ? <ErrorAlert message={listError} /> : null}

      {products === null ? (
        <LoadingState message="Đang tải sản phẩm thuê..." />
      ) : products.length === 0 ? (
        <EmptyState title="Chưa có sản phẩm thuê" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <SurfaceCard padding="sm">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên hoặc SKU..." />
            <div className="mt-2 flex rounded-lg border border-[#E5E7EB] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className={`flex-1 rounded-md px-2 py-1.5 ${!showAll ? "bg-[#F7F7F4] font-medium text-[#1F2937]" : "text-[#6B7280]"}`}
              >
                Cần hồ sơ ({relevantCount})
              </button>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={`flex-1 rounded-md px-2 py-1.5 ${showAll ? "bg-[#F7F7F4] font-medium text-[#1F2937]" : "text-[#6B7280]"}`}
              >
                Tất cả ({products.length})
              </button>
            </div>
            <ul className="mt-3 max-h-[640px] space-y-1 overflow-y-auto">
              {visible.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(product.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      product.id === selectedId ? "bg-[#2F6B4F] text-white" : "text-[#1F2937] hover:bg-[#F7F7F4]"
                    }`}
                  >
                    <span className="block font-medium">{product.grade ? stripGradeSuffix(product.name) : product.name}</span>
                    <span className={`block text-xs ${product.id === selectedId ? "text-white/80" : "text-[#6B7280]"}`}>
                      {product.sku ?? "—"}
                      {product.grade ? ` · ${GRADE_LABELS[product.grade] ?? product.grade}` : ""}
                      {suggestCategory(product) ? ` · ${CATEGORY_LABEL[suggestCategory(product) as GearCategory]}` : ""}
                    </span>
                  </button>
                </li>
              ))}
              {visible.length === 0 ? <li className="px-3 py-4 text-sm text-[#6B7280]">Không có sản phẩm phù hợp.</li> : null}
            </ul>
          </SurfaceCard>

          {selected ? <ProfileEditor key={selected.id} product={selected} fields={fields} /> : null}
        </div>
      )}
    </PageShell>
  );
}

function ProfileEditor({ product, fields }: { product: RentalProduct; fields: FieldMap }) {
  const suggested = suggestCategory(product);
  const [profile, setProfile] = useState<ProductTechnicalProfile | null | undefined>(undefined);
  const [category, setCategory] = useState<GearCategory>(suggested ?? "JACKET");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getProductProfile(product.id, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setProfile(value);
        if (value) {
          setCategory(value.category);
          setValues(toFormValues(value.attributes ?? {}));
        }
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(getRentalApiErrorMessage(reason, "Không tải được hồ sơ kỹ thuật."));
        setProfile(null);
      });
    return () => controller.abort();
  }, [product.id]);

  async function save() {
    setError(null);
    setNotice(null);
    let attributes: Record<string, unknown>;
    try {
      attributes = buildAttributes(fields[category], values);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Thông số chưa hợp lệ.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveProductProfile(product.id, {
        category,
        attributes,
        expectedVersion: profile?.version ?? 0,
      });
      setProfile(saved);
      setValues(toFormValues(saved.attributes ?? {}));
      setNotice("Đã lưu thông số kỹ thuật.");
    } catch (reason: unknown) {
      setError(getRentalApiErrorMessage(reason, "Chưa lưu được thông số. Tải lại trang nếu người khác vừa sửa."));
    } finally {
      setSaving(false);
    }
  }

  const name = product.grade ? stripGradeSuffix(product.name) : product.name;

  return (
    <SurfaceCard>
      <SurfaceSectionHeader
        title={name}
        subtitle={
          profile === undefined
            ? "Đang tải hồ sơ..."
            : profile
              ? `Đã có hồ sơ · cập nhật ${new Date(profile.updatedAt).toLocaleString("vi-VN")}`
              : "Chưa có hồ sơ kỹ thuật"
        }
      />
      {profile === undefined ? (
        <LoadingState message="Đang tải hồ sơ kỹ thuật..." />
      ) : (
        <div className="space-y-5">
          {error ? <ErrorAlert message={error} onDismiss={() => setError(null)} /> : null}
          {notice ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
          ) : null}

          {!profile && !suggested ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Sản phẩm này không thuộc 8 loại đồ có thông số kỹ thuật (áo khoác, giày, quần, balo, túi ngủ, lều, gậy, đồ đi mưa),
              thường không cần hồ sơ. Chỉ tạo nếu chắc chắn sản phẩm thuộc một trong các loại trên.
            </div>
          ) : null}
          <FormField
            label="Loại đồ"
            required
            hint={!profile && suggested ? `Gợi ý theo tên và danh mục: ${CATEGORY_LABEL[suggested]}. Đổi loại đồ sẽ dùng bộ thông số của loại mới.` : "Đổi loại đồ sẽ dùng bộ thông số của loại mới."}
          >
            <Select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as GearCategory);
                setValues({});
              }}
            >
              {CATEGORIES.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields[category].map((field) => {
              const update = (value: string) => setValues((current) => ({ ...current, [field.key]: value }));
              const label = field.unit ? `${field.label} (${field.unit})` : field.label;
              const smallRange =
                field.kind === "int" && field.min !== undefined && field.max !== undefined && field.max - field.min <= 10;
              return (
                <FormField key={field.key} label={label}>
                  {field.kind === "bool" ? (
                    <Select value={values[field.key] ?? ""} onChange={(event) => update(event.target.value)}>
                      <option value="">Chưa rõ</option>
                      <option value="true">Có</option>
                      <option value="false">Không</option>
                    </Select>
                  ) : field.kind === "enum" ? (
                    <Select value={values[field.key] ?? ""} onChange={(event) => update(event.target.value)}>
                      <option value="">Chưa rõ</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : smallRange ? (
                    <Select value={values[field.key] ?? ""} onChange={(event) => update(event.target.value)}>
                      <option value="">Chưa rõ</option>
                      {Array.from({ length: (field.max as number) - (field.min as number) + 1 }, (_, index) => String((field.min as number) + index)).map(
                        (level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ),
                      )}
                    </Select>
                  ) : (
                    <Input
                      inputMode={field.kind === "number" ? "decimal" : "numeric"}
                      value={values[field.key] ?? ""}
                      onChange={(event) => update(event.target.value)}
                      placeholder="Để trống nếu chưa rõ"
                    />
                  )}
                </FormField>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void save()} loading={saving}>
              {profile ? "Lưu thay đổi" : "Tạo hồ sơ"}
            </Button>
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
