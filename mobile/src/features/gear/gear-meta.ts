import type { Ionicons } from "@expo/vector-icons";

import { apiRequest } from "@/lib/api-client";

import type { GearCategory, GearCondition, GearSource } from "@/features/gear/types";

// Cùng bảng thông số với web (RentalWardrobePage) để hai nền tảng hiển thị giống nhau.

export const GEAR_CATEGORIES: { value: GearCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "JACKET", label: "Áo khoác", icon: "shirt-outline" },
  { value: "FOOTWEAR", label: "Giày", icon: "footsteps-outline" },
  { value: "PANTS", label: "Quần", icon: "body-outline" },
  { value: "BACKPACK", label: "Balo", icon: "bag-outline" },
  { value: "SLEEPING_BAG", label: "Túi ngủ", icon: "bed-outline" },
  { value: "TENT", label: "Lều", icon: "triangle-outline" },
  { value: "TREKKING_POLE", label: "Gậy trekking", icon: "git-branch-outline" },
  { value: "RAIN_GEAR", label: "Đồ đi mưa", icon: "rainy-outline" },
];

export const GEAR_CONDITIONS: { value: GearCondition; label: string }[] = [
  { value: "new", label: "Mới" },
  { value: "good", label: "Tốt" },
  { value: "worn", label: "Đã dùng" },
  { value: "poor", label: "Cũ/kém" },
];

export type AttributeTuple = [key: string, label: string, unit: string];

/** Dự phòng khi chưa tải được GET /gear/attribute-schema. [key, nhãn, đơn vị]; "bool" = có/không, "coverage" = phạm vi che. */
export const GEAR_ATTRIBUTES: Record<GearCategory, AttributeTuple[]> = {
  JACKET: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["weight_g", "Trọng lượng", "g"], ["windproof", "Cản gió", "bool"]],
  FOOTWEAR: [["waterproof", "Chống nước", "bool"], ["ankle_support", "Hỗ trợ cổ chân", "bool"], ["grip_level", "Độ bám", "/5"], ["weight_g", "Trọng lượng", "g"]],
  PANTS: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["insulated", "Giữ nhiệt", "bool"]],
  BACKPACK: [["capacity_l", "Dung tích", "L"], ["rain_cover", "Áo trùm mưa", "bool"], ["waterproof", "Chống nước", "bool"], ["weight_g", "Trọng lượng", "g"]],
  SLEEPING_BAG: [["temp_rating_c", "Nhiệt độ", "°C"], ["weight_g", "Trọng lượng", "g"]],
  TENT: [["sleeping_places", "Sức chứa", "người"], ["flysheet_waterproof_mm", "Chống nước mái", "mm"], ["floor_waterproof_mm", "Chống nước đáy", "mm"], ["weight_g", "Trọng lượng", "g"]],
  TREKKING_POLE: [["adjustable", "Điều chỉnh", "bool"], ["length_min_cm", "Dài tối thiểu", "cm"], ["length_max_cm", "Dài tối đa", "cm"], ["weight_g", "Trọng lượng", "g"]],
  RAIN_GEAR: [["waterproof_mm", "Chống nước", "mm"], ["coverage", "Phạm vi che", "coverage"], ["weight_g", "Trọng lượng", "g"]],
};

type SchemaNode = { type?: string | string[]; enum?: string[]; anyOf?: SchemaNode[] };
type SchemaAttribute = {
  key: string;
  label?: string;
  unit?: string | null;
  schema?: SchemaNode;
  options?: { value: string; label: string }[];
};

let attributeTable: Record<GearCategory, AttributeTuple[]> = GEAR_ATTRIBUTES;

/** Bộ thông số hiện dùng cho loại đồ (từ backend nếu đã tải, nếu không là bảng dự phòng). */
export const gearAttributes = (category: GearCategory): AttributeTuple[] => attributeTable[category] ?? [];

// Chuyển một thuộc tính của GET /gear/attribute-schema thành bộ [key, nhãn, đơn vị] dùng chung trong giao diện.
// Đơn vị đặc biệt: "bool" (có/không) và "coverage" (lựa chọn phạm vi che).
function toAttributeTuple(attribute: SchemaAttribute): AttributeTuple | null {
  const schema = attribute.schema ?? {};
  const variants = schema.anyOf ?? [schema];
  const types = variants.flatMap((node) => (Array.isArray(node.type) ? node.type : node.type ? [node.type] : []));
  const label = attribute.label ?? attribute.key;
  if (types.includes("boolean")) return [attribute.key, label, "bool"];
  if (attribute.options?.length || variants.some((node) => Array.isArray(node.enum))) {
    return attribute.key === "coverage" ? [attribute.key, label, "coverage"] : null;
  }
  return [attribute.key, label, attribute.unit ?? ""];
}

/** Tải bộ thông số từ backend; trả true khi đã cập nhật để màn hình vẽ lại. */
export async function loadGearAttributeSchema(): Promise<boolean> {
  const payload = await apiRequest<{ data?: { categories?: unknown }; categories?: unknown }>("/api/v1/gear/attribute-schema", {
    method: "GET",
  });
  const categories = (payload?.data?.categories ?? payload?.categories ?? []) as {
    category: GearCategory;
    attributes?: SchemaAttribute[];
  }[];
  if (!Array.isArray(categories) || categories.length === 0) return false;
  const next = { ...GEAR_ATTRIBUTES };
  for (const entry of categories) {
    if (!(entry.category in next) || !entry.attributes?.length) continue;
    const tuples = entry.attributes.map(toAttributeTuple).filter((tuple): tuple is AttributeTuple => tuple !== null);
    if (tuples.length) next[entry.category] = tuples;
  }
  attributeTable = next;
  return true;
}

export const ATTRIBUTE_SOURCE_LABELS: Record<string, string> = {
  USER: "Bạn nhập",
  AI_IMAGE: "Đọc từ ảnh",
  AI_LINK: "Đọc từ đường dẫn",
  VERIFIED_CATALOG: "Từ danh mục",
};

export const categoryInfo = (category: GearCategory) =>
  GEAR_CATEGORIES.find((entry) => entry.value === category) ?? GEAR_CATEGORIES[0];

export const conditionLabel = (condition: string) =>
  GEAR_CONDITIONS.find((entry) => entry.value === String(condition).toLowerCase())?.label ?? condition;

export const sourceLabel = (source: GearSource | string) =>
  source === "ai_image" ? "Từ ảnh" : source === "ai_link" ? "Từ đường dẫn" : "Tự nhập";

export function formatGearAttribute(value: unknown, unit: string) {
  if (value === true) return "Có";
  if (value === false) return "Không";
  if (value === null || value === undefined || value === "") return "Chưa biết";
  if (unit === "coverage") return value === "FULL_BODY" ? "Toàn thân" : "Thân trên";
  return `${String(value)}${unit === "/5" ? "/5" : ` ${unit}`}`;
}

/** Nhãn cho displayStatus trong guidance (xem lại theo chuyến). */
export const DISPLAY_STATUS_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "info" }> = {
  SUITABLE: { label: "Phù hợp", tone: "ok" },
  READY: { label: "Phù hợp", tone: "ok" },
  NEEDS_INFORMATION: { label: "Thiếu thông tin", tone: "info" },
  NEEDS_INFO: { label: "Thiếu thông tin", tone: "info" },
  NEEDS_ATTENTION: { label: "Cần chú ý", tone: "warn" },
  NEEDS_PREPARATION: { label: "Cần chuẩn bị", tone: "warn" },
  NOT_ASSESSED: { label: "Chuyến không yêu cầu", tone: "info" },
};
