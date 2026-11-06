import { apiClient } from "@/lib/axios";
import type { GearCategory } from "@/features/rentals/services/gear.api";

// Bộ thông số theo loại đồ: lấy từ GET /api/v1/gear/attribute-schema, dự phòng bằng bảng dưới khi API lỗi.

export type AttributeTuple = [key: string, label: string, unit: string];

type SchemaNode = { type?: string | string[]; enum?: string[]; anyOf?: SchemaNode[] };
type SchemaAttribute = {
  key: string;
  label?: string;
  unit?: string | null;
  schema?: SchemaNode;
  options?: Array<{ value: string; label: string }>;
};

export const FALLBACK_GEAR_ATTRIBUTES: Record<GearCategory, AttributeTuple[]> = {
  JACKET: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["weight_g", "Trọng lượng", "g"], ["windproof", "Cản gió", "bool"]],
  FOOTWEAR: [["waterproof", "Chống nước", "bool"], ["ankle_support", "Hỗ trợ cổ chân", "bool"], ["grip_level", "Độ bám", "/5"], ["weight_g", "Trọng lượng", "g"]],
  PANTS: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["insulated", "Giữ nhiệt", "bool"]],
  BACKPACK: [["capacity_l", "Dung tích", "L"], ["rain_cover", "Áo trùm mưa", "bool"], ["waterproof", "Chống nước", "bool"], ["weight_g", "Trọng lượng", "g"]],
  SLEEPING_BAG: [["temp_rating_c", "Nhiệt độ", "°C"], ["weight_g", "Trọng lượng", "g"]],
  TENT: [["sleeping_places", "Sức chứa", "người"], ["flysheet_waterproof_mm", "Chống nước mái", "mm"], ["floor_waterproof_mm", "Chống nước đáy", "mm"], ["weight_g", "Trọng lượng", "g"]],
  TREKKING_POLE: [["adjustable", "Điều chỉnh", "bool"], ["length_min_cm", "Dài tối thiểu", "cm"], ["length_max_cm", "Dài tối đa", "cm"], ["weight_g", "Trọng lượng", "g"]],
  RAIN_GEAR: [["waterproof_mm", "Chống nước", "mm"], ["coverage", "Phạm vi che", "coverage"], ["weight_g", "Trọng lượng", "g"]],
};

let table: Record<GearCategory, AttributeTuple[]> = FALLBACK_GEAR_ATTRIBUTES;

export const gearAttributes = (category: GearCategory): AttributeTuple[] => table[category] ?? [];

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

/** Tải bộ thông số từ backend một lần; trả true khi đã cập nhật để component vẽ lại. */
export async function loadGearAttributeSchema(signal?: AbortSignal): Promise<boolean> {
  const response = await apiClient.get<unknown>("/api/v1/gear/attribute-schema", { signal });
  const payload = response.data as { data?: { categories?: unknown }; categories?: unknown };
  const categories = (payload?.data?.categories ?? payload?.categories ?? []) as Array<{
    category: GearCategory;
    attributes?: SchemaAttribute[];
  }>;
  if (!Array.isArray(categories) || categories.length === 0) return false;
  const next = { ...FALLBACK_GEAR_ATTRIBUTES };
  for (const entry of categories) {
    if (!(entry.category in next) || !entry.attributes?.length) continue;
    const tuples = entry.attributes.map(toAttributeTuple).filter((tuple): tuple is AttributeTuple => tuple !== null);
    if (tuples.length) next[entry.category] = tuples;
  }
  table = next;
  return true;
}
