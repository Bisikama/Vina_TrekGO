/**
 * TripSummaryBanner & TripMetaGrid — thẻ tóm tắt chuyến đi đầu trang.
 * Dùng cho Chi tiết chuyến công khai, Phòng chờ private trip, Booking Checkout.
 * Mọi số liệu (giá ₫, chỗ 5/15, thời gian) đều tabular-nums.
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

import { StatusBadge } from "./StatusBadge";
import { Colors, Radius, Spacing, Typography, formatVnd } from "@/constants/designTokens";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO -> "HH:mm dd/MM/yyyy"; trả null nếu không parse được */
function formatDateTimeIso(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())} ${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatRange(startAt?: string | null, endAt?: string | null): string | null {
  const start = startAt ? formatDateTimeIso(startAt) : null;
  const end = endAt ? formatDateTimeIso(endAt) : null;
  if (start && end) return `${start} → ${end}`;
  return start ?? end;
}

// ─── TripMetaGrid ─────────────────────────────────────────────────────────────
export interface TripMetaItem {
  label: string;
  value: ReactNode;
}

export interface TripMetaGridProps {
  items: TripMetaItem[];
  columns?: 2 | 3;
  style?: StyleProp<ViewStyle>;
}

export function TripMetaGrid({ items, columns = 2, style }: TripMetaGridProps) {
  return (
    <View style={[styles.grid, style]}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[styles.gridCell, columns === 2 ? styles.cellHalf : styles.cellThird]}
        >
          <Text style={styles.gridLabel}>{item.label}</Text>
          <Text style={[styles.gridValue, Typography.tabularNums]} numberOfLines={1}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── TripSummaryBanner ────────────────────────────────────────────────────────
export interface TripSummaryBannerProps {
  title: string;
  /** Mã trạng thái -> tự render StatusBadge (DRAFT/OPEN/CONFIRMED…) */
  status?: string | null;
  destinationName?: string | null;
  subtitle?: ReactNode;
  /** ISO datetime; hiển thị "HH:mm dd/MM/yyyy → HH:mm dd/MM/yyyy" */
  startAt?: string | null;
  endAt?: string | null;
  pickupName?: string | null;
  remainingSlots?: number | null;
  capacity?: number | null;
  /** Ghi đè dòng sức chứa, VD: "Còn 8/15 chỗ" */
  capacityLabel?: string;
  /** Số tiền mỗi người (số hoặc chuỗi "1500000.00"); format "1.500.000 ₫" */
  pricePerPax?: string | number | null;
  /** Ghi đè dòng giá vé, VD: "2.500.000 ₫ / người" */
  priceLabel?: string;
  /** Mặc định "VND" — hiển thị ký hiệu ₫; tiền tệ khác hiển thị raw + mã */
  currency?: string;
  leaderName?: string | null;
  /** Các dòng thông tin bổ sung */
  metaItems?: TripMetaItem[];
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function TripSummaryBanner({
  title,
  status,
  destinationName,
  subtitle,
  startAt,
  endAt,
  pickupName,
  remainingSlots,
  capacity,
  capacityLabel,
  pricePerPax,
  priceLabel,
  currency = "VND",
  leaderName,
  metaItems,
  actions,
  style,
}: TripSummaryBannerProps) {
  const timeRange = formatRange(startAt, endAt);
  const capacityValue =
    capacityLabel ??
    (remainingSlots !== null && remainingSlots !== undefined && capacity
      ? `${remainingSlots}/${capacity} chỗ`
      : capacity
        ? `${capacity} chỗ`
        : null);
  const priceValue =
    priceLabel ??
    (pricePerPax !== null && pricePerPax !== undefined && pricePerPax !== ""
      ? currency === "VND"
        ? `${formatVnd(pricePerPax)} / người`
        : `${pricePerPax} ${currency} / người`
      : null);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {status ? <StatusBadge status={status} /> : null}
        {actions}
      </View>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.metaCol}>
        {destinationName ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📍</Text>
            <Text style={styles.metaText}>{destinationName}</Text>
          </View>
        ) : null}
        {timeRange ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>🕒</Text>
            <Text style={[styles.metaText, Typography.tabularNums]}>{timeRange}</Text>
          </View>
        ) : null}
        {pickupName ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>🚌</Text>
            <Text style={styles.metaText}>{pickupName}</Text>
          </View>
        ) : null}
        {capacityValue ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>👥</Text>
            <Text style={[styles.metaText, Typography.tabularNums]}>{capacityValue}</Text>
          </View>
        ) : null}
        {leaderName ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>🧭</Text>
            <Text style={styles.metaText}>{leaderName}</Text>
          </View>
        ) : null}
        {metaItems?.map((item) => (
          <View key={item.label} style={styles.metaRow}>
            <Text style={styles.metaLabel}>{item.label}</Text>
            <Text style={[styles.metaText, styles.metaItemValue]}>{item.value}</Text>
          </View>
        ))}
      </View>

      {priceValue ? (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Giá vé</Text>
          <Text style={[styles.priceValue, Typography.tabularNums]}>{priceValue}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    flexShrink: 1,
    color: Colors.primaryDeep,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
  },
  subtitle: {
    marginTop: Spacing.xs,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  metaCol: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  metaIcon: { fontSize: 13 },
  metaLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  metaItemValue: { flex: 1 },
  metaText: {
    flexShrink: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
  },
  priceLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  priceValue: {
    color: Colors.primaryDeep,
    fontSize: 16,
    fontWeight: "700",
  } as TextStyle,

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridCell: { marginBottom: Spacing.md },
  cellHalf: { width: "48.5%" },
  cellThird: { width: "31.5%" },
  gridLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gridValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  } as TextStyle,
});
