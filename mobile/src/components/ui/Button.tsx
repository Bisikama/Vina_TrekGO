/**
 * Button — nút bấm chuẩn cảm ứng (Pressable, minHeight 44–52).
 * Variant/size đồng bộ `Button` của web: primary/secondary/outline/ghost/danger.
 */
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Colors, Spacing } from "@/constants/designTokens";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Hiện spinner và tự khóa nút */
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZE_STYLES: Record<ButtonSize, ViewStyle> = {
  sm: { minHeight: 44, paddingHorizontal: 14, gap: 6 },
  md: { minHeight: 48, paddingHorizontal: 18, gap: 8 },
  lg: { minHeight: 52, paddingHorizontal: 22, gap: 8 },
};

const SIZE_FONT: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 16 },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const isBlocked = disabled || loading;
  const spinnerColor =
    variant === "primary" || variant === "danger" ? "#FFFFFF" : Colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      style={({ pressed }) => [
        styles.base,
        SIZE_STYLES[size],
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isBlocked && styles[`${variant}Pressed` as const],
        isBlocked && styles.blocked,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        leftIcon
      )}
      <Text style={[styles.label, SIZE_FONT[size], styles[`${variant}Label` as const]]}>
        {label}
      </Text>
      {!loading && rightIcon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8, // Buttons: 8px theo DESIGN.md
    paddingHorizontal: Spacing.lg,
  },
  fullWidth: { alignSelf: "stretch" },
  blocked: { opacity: 0.55 },

  primary: { backgroundColor: Colors.primary },
  primaryPressed: { backgroundColor: Colors.primaryHover },
  primaryLabel: { color: "#FFFFFF" },

  secondary: { backgroundColor: Colors.surfaceMuted },
  secondaryPressed: { opacity: 0.8 },
  secondaryLabel: { color: Colors.primaryDeep },

  outline: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  outlinePressed: { backgroundColor: Colors.canvas },
  outlineLabel: { color: Colors.primary },

  ghost: { backgroundColor: "transparent" },
  ghostPressed: { backgroundColor: Colors.surfaceMuted },
  ghostLabel: { color: Colors.primary },

  danger: { backgroundColor: Colors.danger },
  dangerPressed: { opacity: 0.85 },
  dangerLabel: { color: "#FFFFFF" },

  label: {
    fontWeight: "600",
  } as TextStyle,
});
