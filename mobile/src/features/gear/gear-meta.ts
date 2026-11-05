import type { Ionicons } from "@expo/vector-icons";

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

/** [key, nhãn, đơn vị]; đơn vị "bool" = có/không, "coverage" = phạm vi che, còn lại là số. */
export const GEAR_ATTRIBUTES: Record<GearCategory, [string, string, string][]> = {
  JACKET: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["weight_g", "Trọng lượng", "g"], ["windproof", "Cản gió", "bool"]],
  FOOTWEAR: [["waterproof", "Chống nước", "bool"], ["ankle_support", "Hỗ trợ cổ chân", "bool"], ["grip_level", "Độ bám", "/5"], ["weight_g", "Trọng lượng", "g"]],
  PANTS: [["waterproof_mm", "Chống nước", "mm"], ["temp_rating_c", "Chịu lạnh", "°C"], ["insulated", "Giữ nhiệt", "bool"]],
  BACKPACK: [["capacity_l", "Dung tích", "L"], ["rain_cover", "Áo trùm mưa", "bool"], ["waterproof", "Chống nước", "bool"], ["weight_g", "Trọng lượng", "g"]],
  SLEEPING_BAG: [["temp_rating_c", "Nhiệt độ", "°C"], ["weight_g", "Trọng lượng", "g"]],
  TENT: [["sleeping_places", "Sức chứa", "người"], ["flysheet_waterproof_mm", "Chống nước mái", "mm"], ["floor_waterproof_mm", "Chống nước đáy", "mm"], ["weight_g", "Trọng lượng", "g"]],
  TREKKING_POLE: [["adjustable", "Điều chỉnh", "bool"], ["length_min_cm", "Dài tối thiểu", "cm"], ["length_max_cm", "Dài tối đa", "cm"], ["weight_g", "Trọng lượng", "g"]],
  RAIN_GEAR: [["waterproof_mm", "Chống nước", "mm"], ["coverage", "Phạm vi che", "coverage"], ["weight_g", "Trọng lượng", "g"]],
};

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
};
