/**
 * Vina TrekGO — Design Tokens (Mobile)
 * Ngôn ngữ thiết kế: "Tactical Topographic Utility"
 * Đồng bộ 100% với `web/DESIGN.md` (Vina TrekGO Web).
 *
 * Quy tắc dùng:
 * - Mọi con số (giá tiền ₫, km, m, 5/15 chỗ, thời gian) PHẢI kèm `Typography.tabularNums`.
 * - Bo góc: input/button `Radius.sm` (8), card `Radius.md` (12), modal/sheet `Radius.lg` (16), badge/chip `Radius.pill`.
 * - Card luôn nền `Colors.surface` + viền 1px `Colors.border` trên nền `Colors.canvas`.
 */
import type { TextStyle } from "react-native";

// ─── Colors ───────────────────────────────────────────────────────────────────
export const Colors = {
  /** Limestone White — nền chính toàn màn hình */
  canvas: "#F7F7F4",
  /** Nền thẻ Card / Modal / Sheet */
  surface: "#FFFFFF",
  /** Nền phụ / chip / vùng recessed */
  surfaceMuted: "#EFEFE9",
  /** Viền mảnh 1px kiểu đường đồng mức */
  border: "#E5E7EB",

  /** Canopy Forest Green — nút chính, trạng thái active */
  primary: "#9fe870",
  /** Deep Forest — tiêu đề nhấn mạnh, giá tiền, số liệu nổi bật */
  primaryDeep: "#125238",
  /** Deep Pine — trạng thái pressed */
  primaryHover: "#1F4A36",
  /** Trailhead Amber — cảnh báo nhẹ / điểm nhấn */
  accent: "#F59E0B",

  /** Deep Charcoal — chữ chính */
  textPrimary: "#1F2937",
  /** Slate Grey — chữ phụ, nhãn metadata */
  textSecondary: "#6B7280",

  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerText: "#991B1B",

  successBg: "#DCFCE7",
  successText: "#166534",

  warningBg: "#FEF3C7",
  warningText: "#92400E",

  infoBg: "#DBEAFE",
  infoText: "#1E40AF",
} as const;

export type DesignColor = keyof typeof Colors;

// ─── Radius ───────────────────────────────────────────────────────────────────
export const Radius = {
  /** 8 — buttons, inputs, chips nhỏ */
  sm: 8,
  /** 12 — cards, modules */
  md: 12,
  /** 16 — modals, sheets */
  lg: 16,
  /** 9999 — pills, badges, chips tròn */
  pill: 9999,
} as const;

// ─── Spacing (thang 4pt) ──────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
/**
 * Bắt buộc cho mọi số liệu: giá tiền (₫), độ dài (km), độ cao (m),
 * số chỗ (5/15), thời gian — chống nhảy chữ khi dữ liệu đổi theo thời gian thực.
 *
 * Ví dụ: `<Text style={[styles.value, Typography.tabularNums]}>18.5 km</Text>`
 */
export const Typography: { tabularNums: TextStyle } = {
  tabularNums: { fontVariant: ["tabular-nums"] },
};

// ─── Formatters ───────────────────────────────────────────────────────────────
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Định dạng số nguyên cách nhau dấu chấm: 1500000 -> "1.500.000" */
export function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${groupThousands(Math.abs(rounded).toString())}`;
}

/** Định dạng giá VND: "1500000" -> "1.500.000 ₫" */
export function formatVnd(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  return `${formatNumber(n)} ₫`;
}
