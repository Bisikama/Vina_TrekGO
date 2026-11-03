/**
 * StatusBadge, DifficultyBadge, TelemetryChip — hệ nhãn trạng thái & chỉ số kỹ thuật.
 * Ánh xạ mã trạng thái (Trip/Booking/Payment/Member/Dispute) sang màu + nhãn tiếng Việt,
 * đồng bộ `StatusBadge` của web.
 */
import { type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Colors, Radius, Spacing, Typography } from "@/constants/designTokens";

// ─── StatusBadge ──────────────────────────────────────────────────────────────
export type StatusTone = "neutral" | "success" | "info" | "warning" | "danger";

interface StatusMeta {
  label: string;
  tone: StatusTone;
}

/** Bản đồ mã trạng thái -> { nhãn tiếng Việt, tông màu } */
export const STATUS_META: Record<string, StatusMeta> = {
  // Trip (CF01)
  DRAFT: { label: "Bản nháp", tone: "neutral" },
  OPEN: { label: "Đang mở bán", tone: "success" },
  PUBLISHED: { label: "Đã xuất bản", tone: "success" },
  ACTIVE: { label: "Đang hoạt động", tone: "success" },
  IN_PROGRESS: { label: "Đang diễn ra", tone: "info" },
  FULL: { label: "Hết chỗ", tone: "warning" },
  CLOSED: { label: "Đã đóng", tone: "neutral" },
  COMPLETED: { label: "Hoàn thành", tone: "info" },
  CANCELLED: { label: "Đã hủy", tone: "danger" },

  // Booking (CF02)
  HOLD: { label: "Giữ chỗ", tone: "warning" },
  PENDING_PAYMENT: { label: "Chờ thanh toán", tone: "warning" },
  CONFIRMED: { label: "Đã xác nhận", tone: "success" },
  EXPIRED: { label: "Hết hạn", tone: "neutral" },
  CHECKED_IN: { label: "Đã check-in", tone: "success" },
  PARTIAL_CHECKIN: { label: "Check-in một phần", tone: "info" },
  NO_SHOW: { label: "Vắng mặt", tone: "danger" },

  // Payment
  PENDING: { label: "Đang chờ", tone: "warning" },
  SUCCESS: { label: "Thành công", tone: "success" },
  PAID: { label: "Đã thanh toán", tone: "success" },
  FAILED: { label: "Thất bại", tone: "danger" },
  REFUNDED: { label: "Đã hoàn tiền", tone: "info" },

  // Member / Invitation (CF03/CF04)
  JOINED: { label: "Đã tham gia", tone: "success" },
  ACCEPTED: { label: "Đã chấp nhận", tone: "success" },
  INVITED: { label: "Đã mời", tone: "warning" },
  DECLINED: { label: "Đã từ chối", tone: "danger" },
  LEFT: { label: "Đã rời", tone: "neutral" },
  REVOKED: { label: "Đã thu hồi", tone: "danger" },

  // Dispute (đồng bộ web)
  OPEN_DISPUTE: { label: "Khiếu nại đang mở", tone: "warning" },
  UNDER_REVIEW: { label: "Đang xem xét", tone: "info" },
  RESOLVED_REFUND: { label: "Đã hoàn tiền", tone: "success" },
  RESOLVED_NO_REFUND: { label: "Đã giải quyết", tone: "neutral" },
};

const TONE_STYLES: Record<StatusTone, { bg: string; text: string }> = {
  neutral: { bg: Colors.surfaceMuted, text: Colors.textSecondary },
  success: { bg: Colors.successBg, text: Colors.successText },
  info: { bg: Colors.infoBg, text: Colors.infoText },
  warning: { bg: Colors.warningBg, text: Colors.warningText },
  danger: { bg: Colors.dangerBg, text: Colors.dangerText },
};

export interface StatusBadgeProps {
  /** Mã trạng thái (DRAFT, OPEN, CONFIRMED…) — mã lạ fallback neutral */
  status?: string | null;
  /** Ghi đè nhãn hiển thị */
  label?: string;
  /** Ghi đè tông màu */
  tone?: StatusTone;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

export function StatusBadge({
  status,
  label,
  tone,
  size = "md",
  style,
}: StatusBadgeProps) {
  const meta = status ? STATUS_META[status] : undefined;
  const resolvedTone = tone ?? meta?.tone ?? "neutral";
  const resolvedLabel = label ?? meta?.label ?? (status ?? "—");
  const toneStyle = TONE_STYLES[resolvedTone];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: toneStyle.bg },
        size === "sm" && styles.badgeSm,
        style,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: toneStyle.text },
          size === "sm" && styles.badgeTextSm,
        ]}
        numberOfLines={1}
      >
        {resolvedLabel}
      </Text>
    </View>
  );
}

// ─── DifficultyBadge ──────────────────────────────────────────────────────────
/** Màu difficulty khớp DESIGN.md: Dễ #DCFCE7/#166534, Trung bình #FEF3C7/#92400E, Khó #FEE2E2/#991B1B */
const DIFFICULTY_META: Record<string, { label: string; bg: string; text: string } | null> = {
  EASY: { label: "Dễ", bg: Colors.successBg, text: Colors.successText },
  MEDIUM: { label: "Trung bình", bg: Colors.warningBg, text: Colors.warningText },
  MODERATE: { label: "Trung bình", bg: Colors.warningBg, text: Colors.warningText },
  HARD: { label: "Khó", bg: "#FEE2E2", text: Colors.dangerText },
  EXTREME: { label: "Rất khó", bg: Colors.danger, text: "#FFFFFF" },
};

export interface DifficultyBadgeProps {
  difficulty?: string | null;
  style?: StyleProp<ViewStyle>;
}

export function DifficultyBadge({ difficulty, style }: DifficultyBadgeProps) {
  const meta = difficulty ? DIFFICULTY_META[difficulty] : undefined;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: meta?.bg ?? Colors.surfaceMuted,
        },
        style,
      ]}
    >
      <Text
        style={[styles.badgeText, { color: meta?.text ?? Colors.textSecondary }]}
        numberOfLines={1}
      >
        {meta?.label ?? (difficulty ?? "—")}
      </Text>
    </View>
  );
}

// ─── TelemetryChip ────────────────────────────────────────────────────────────
export interface TelemetryChipProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Chip thông số kỹ thuật (km, m, thời lượng…) — số dùng tabular-nums */
export function TelemetryChip({ label, value, icon, style }: TelemetryChipProps) {
  return (
    <View style={[styles.chip, style]}>
      {icon}
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, Typography.tabularNums]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  } as TextStyle,
  badgeTextSm: {
    fontSize: 11,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
  },
  chipValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  } as TextStyle,
});
