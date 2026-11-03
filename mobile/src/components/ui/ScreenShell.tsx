/**
 * ScreenShell & ScreenHeader — khung màn hình chuẩn "Tactical Topographic Utility".
 * Đồng bộ với `PageShell`/`PageHeader` của web (web/src/components/ui/PageShell.tsx).
 */
import { useCallback, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { Href, useRouter } from "expo-router";

import { Colors, Spacing } from "@/constants/designTokens";

// ─── ScreenShell ──────────────────────────────────────────────────────────────
export interface ScreenShellProps {
  children: ReactNode;
  /** true -> bọc ScrollView (cuộn dọc), false -> View tĩnh */
  scrollable?: boolean;
  /** true -> bọc KeyboardAvoidingView (dành cho màn hình có form) */
  keyboardAvoiding?: boolean;
  /** Kết hợp `onRefresh` để bật pull-to-refresh */
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Cạnh cần chừa safe area (mặc định: top) */
  edges?: Edge[];
}

export function ScreenShell({
  children,
  scrollable = false,
  keyboardAvoiding = false,
  refreshing = false,
  onRefresh,
  contentContainerStyle,
  style,
  edges,
}: ScreenShellProps) {
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Colors.primary}
      colors={[Colors.primary]}
    />
  ) : undefined;

  const content = scrollable ? (
    <ScrollView
      style={styles.flexOne}
      contentContainerStyle={contentContainerStyle}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flexOne, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.shell, style]} edges={edges}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flexOne}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

// ─── ScreenHeader ─────────────────────────────────────────────────────────────
export interface ScreenHeaderProps {
  /** Callback quay lại (ưu tiên hơn `backHref`) */
  onBack?: () => void;
  /** Route đích khi bấm quay lại (dùng expo-router) */
  backHref?: string;
  backLabel?: string;
  /** Nhãn in hoa phía trên tiêu đề, VD: "Vina TrekGO · Khám Phá Chuyến Đi" */
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  /** Huy hiệu đặt cạnh tiêu đề (thường là `StatusBadge`) */
  badge?: ReactNode;
  /** Cụm nút hành động bên phải header */
  rightActions?: ReactNode;
}

export function ScreenHeader({
  onBack,
  backHref,
  backLabel = "Quay lại",
  eyebrow,
  title,
  subtitle,
  description,
  badge,
  rightActions,
}: ScreenHeaderProps) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref as Href);
    }
  }, [onBack, backHref, router]);

  const showBack = Boolean(onBack || backHref);
  const subline = subtitle ?? description;

  return (
    <View style={styles.header}>
      {showBack && (
        <Pressable
          onPress={handleBack}
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressedOpacity]}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>{backLabel}</Text>
        </Pressable>
      )}

      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}

      {(title || badge || rightActions) && (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge}
          <View style={styles.actionsSpacer} />
          {rightActions}
        </View>
      )}

      {subline ? <Text style={styles.subtitle}>{subline}</Text> : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  shell: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },

  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,
  },
  backArrow: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  backLabel: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  eyebrow: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  } as TextStyle,
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    flexShrink: 1,
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  actionsSpacer: { flexGrow: 1 },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  pressedOpacity: { opacity: 0.6 },
});
