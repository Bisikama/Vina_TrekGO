/**
 * LoadingState, EmptyState, ErrorAlert, InfoBanner — khối trạng thái dữ liệu.
 * ErrorAlert: nền #FEF2F2, viền trái 4px #DC2626 (đồng bộ Incident Response Banner của web).
 */
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Colors, Radius, Spacing } from "@/constants/designTokens";

// ─── LoadingState ─────────────────────────────────────────────────────────────
export interface LoadingStateProps {
  /** Dòng chữ trạng thái (alias của `label`) */
  message?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function LoadingState({ message, label, style }: LoadingStateProps) {
  const text = message ?? label;
  return (
    <View style={[styles.center, styles.loading, style]}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {text ? <Text style={styles.loadingText}>{text}</Text> : null}
    </View>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Nút hành động (thường là `Button`) */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  return (
    <View style={[styles.empty, style]}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

// ─── ErrorAlert ───────────────────────────────────────────────────────────────
export interface ErrorAlertProps {
  title?: string;
  message: ReactNode;
  /** Hiện nút "Thử lại" */
  onRetry?: () => void;
  /** Hiện nút "Đóng" */
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ErrorAlert({ title, message, onRetry, onDismiss, style }: ErrorAlertProps) {
  return (
    <View style={[styles.errorBox, style]}>
      {title ? <Text style={styles.errorTitle}>{title}</Text> : null}
      <Text style={styles.errorMessage}>{message}</Text>
      {(onRetry || onDismiss) && (
        <View style={styles.errorActions}>
          {onRetry ? (
            <Pressable onPress={onRetry} hitSlop={6} style={styles.errorButton}>
              <Text style={styles.errorRetryText}>Thử lại</Text>
            </Pressable>
          ) : null}
          {onDismiss ? (
            <Pressable onPress={onDismiss} hitSlop={6} style={styles.errorButton}>
              <Text style={styles.errorDismissText}>Đóng</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ─── InfoBanner ───────────────────────────────────────────────────────────────
export type InfoBannerTone = "info" | "success" | "warning";

const BANNER_TONES: Record<InfoBannerTone, { bg: string; text: string }> = {
  info: { bg: Colors.infoBg, text: Colors.infoText },
  success: { bg: Colors.successBg, text: Colors.successText },
  warning: { bg: Colors.warningBg, text: Colors.warningText },
};

export interface InfoBannerProps {
  tone?: InfoBannerTone;
  /** Alias của `tone` (đồng bộ web) */
  variant?: InfoBannerTone;
  title?: string;
  message: ReactNode;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function InfoBanner({ tone, variant, title, message, icon, style }: InfoBannerProps) {
  const resolvedTone = tone ?? variant ?? "info";
  const toneStyle = BANNER_TONES[resolvedTone];

  return (
    <View style={[styles.banner, { backgroundColor: toneStyle.bg }, style]}>
      {icon}
      <View style={styles.bannerTextCol}>
        {title ? (
          <Text style={[styles.bannerTitle, { color: toneStyle.text }]}>{title}</Text>
        ) : null}
        <Text style={[styles.bannerMessage, { color: toneStyle.text }]}>{message}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },

  loading: {
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },

  empty: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  } as TextStyle,
  emptyDescription: {
    marginTop: Spacing.xs + 2,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  emptyAction: { marginTop: Spacing.lg },

  errorBox: {
    backgroundColor: Colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
  },
  errorTitle: {
    color: Colors.dangerText,
    fontSize: 14,
    fontWeight: "700",
  } as TextStyle,
  errorMessage: {
    color: Colors.dangerText,
    fontSize: 13,
    lineHeight: 18,
  },
  errorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  errorButton: { paddingVertical: 2 },
  errorRetryText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: "700",
  } as TextStyle,
  errorDismissText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },

  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
  },
  bannerTextCol: { flex: 1 },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  } as TextStyle,
  bannerMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
});
