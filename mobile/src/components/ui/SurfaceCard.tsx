/**
 * SurfaceCard & SurfaceSectionHeader — khối thẻ nội dung chuẩn.
 * Nền `#FFFFFF`, viền 1px `#E5E7EB`, bo góc 12 — đồng bộ `SurfaceCard` của web.
 */
import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Colors, Radius, Spacing } from "@/constants/designTokens";

const PADDING_MAP: Record<NonNullable<SurfaceCardProps["padding"]>, number> = {
  none: 0,
  sm: Spacing.md,
  md: Spacing.lg,
  lg: Spacing.xl,
};

export interface SurfaceCardProps {
  children: ReactNode;
  /** Khoảng đệm trong thẻ (mặc định "md") */
  padding?: "none" | "sm" | "md" | "lg";
  /** Nếu truyền, thẻ thành Pressable — nhấn đổi viền xanh + opacity */
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SurfaceCard({
  children,
  padding = "md",
  onPress,
  disabled,
  style,
}: SurfaceCardProps) {
  const padded: ViewStyle = { padding: PADDING_MAP[padding] };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.card,
          padded,
          style,
          pressed && !disabled && styles.cardPressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, padded, style]}>{children}</View>
  );
}

export interface SurfaceSectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Element bên phải tiêu đề (thường là Button size="sm") */
  action?: ReactNode;
}

export function SurfaceSectionHeader({
  title,
  subtitle,
  action,
}: SurfaceSectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTextCol}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  cardPressed: {
    borderColor: Colors.primary,
    opacity: 0.97,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTextCol: {
    flex: 1,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  } as TextStyle,
  sectionSubtitle: {
    marginTop: 2,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
