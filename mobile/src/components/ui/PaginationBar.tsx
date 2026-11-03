/**
 * PaginationBar — thanh chuyển trang cho danh sách phân trang.
 * "← Trước | Trang X / Y · Tổng Z {itemLabel} | Sau →", số liệu tabular-nums.
 */
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Colors, Radius, Spacing, Typography } from "@/constants/designTokens";

export interface PaginationBarProps {
  /** Trang hiện tại (bắt đầu từ 1) */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  /** Danh từ chỉ đơn vị, VD: "chuyến", "đơn" (mặc định "kết quả") */
  itemLabel?: string;
  disabled?: boolean;
  /** Ghi đè tổng số trang (mặc định tính từ total/pageSize) */
  totalPages?: number;
  style?: StyleProp<ViewStyle>;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel = "kết quả",
  disabled = false,
  totalPages,
  style,
}: PaginationBarProps) {
  const resolvedTotalPages = totalPages ?? Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1 && !disabled;
  const canNext = page < resolvedTotalPages && !disabled;

  return (
    <View style={[styles.container, style]}>
      <Pressable
        onPress={() => canPrev && onPageChange(page - 1)}
        disabled={!canPrev}
        hitSlop={6}
        style={({ pressed }) => [
          styles.navButton,
          !canPrev && styles.navDisabled,
          pressed && canPrev && styles.navPressed,
        ]}
      >
        <Text style={[styles.navText, !canPrev && styles.navTextDisabled]}>
          ← Trước
        </Text>
      </Pressable>

      <View style={styles.centerCol}>
        <Text style={[styles.pageText, Typography.tabularNums]}>
          Trang {page} / {resolvedTotalPages}
        </Text>
        {total > 0 ? (
          <Text style={[styles.totalText, Typography.tabularNums]}>
            Tổng {total} {itemLabel}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => canNext && onPageChange(page + 1)}
        disabled={!canNext}
        hitSlop={6}
        style={({ pressed }) => [
          styles.navButton,
          !canNext && styles.navDisabled,
          pressed && canNext && styles.navPressed,
        ]}
      >
        <Text style={[styles.navText, !canNext && styles.navTextDisabled]}>
          Sau →
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },

  navButton: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  navPressed: { backgroundColor: Colors.canvas },
  navDisabled: { opacity: 0.4 },
  navText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  navTextDisabled: { color: Colors.textSecondary },

  centerCol: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  pageText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  totalText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
});
