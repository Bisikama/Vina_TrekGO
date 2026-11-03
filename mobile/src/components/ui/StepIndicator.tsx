/**
 * StepIndicator — thanh tiến trình ngang đa bước.
 * Dùng cho luồng Leader tạo chuyến đi và Booking Checkout (đồng bộ web).
 * Bước đã qua: dấu ✓ nền xanh; bước hiện tại: viền Deep Forest; bước chưa tới: nền xám nhạt.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Pressable } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/designTokens";

export interface StepIndicatorStep {
  key: string | number;
  label: string;
}

export interface StepIndicatorProps {
  steps: StepIndicatorStep[];
  /** Bước hiện tại (bắt đầu từ 0) */
  currentStepIndex: number;
  /** Cho phép bấm nhảy tới bước (tùy chọn) */
  onStepPress?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

export function StepIndicator({
  steps,
  currentStepIndex,
  onStepPress,
  style,
}: StepIndicatorProps) {
  return (
    <View style={[styles.container, style]}>
      {steps.map((step, index) => {
        const isDone = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const isLast = index === steps.length - 1;

        const circleStyle = isDone
          ? styles.circleDone
          : isCurrent
            ? styles.circleCurrent
            : styles.circleUpcoming;
        const labelStyle = isDone
          ? styles.labelDone
          : isCurrent
            ? styles.labelCurrent
            : styles.labelUpcoming;

        const circle = (
          <View style={[styles.circle, circleStyle]}>
            <Text style={isDone ? styles.checkMark : styles.circleText}>
              {isDone ? "✓" : index + 1}
            </Text>
          </View>
        );

        return (
          <View key={step.key} style={styles.stepCol}>
            <View style={styles.trackRow}>
              {onStepPress && !isLast ? (
                <Pressable onPress={() => onStepPress(index)} hitSlop={6}>
                  {circle}
                </Pressable>
              ) : (
                circle
              )}
              {!isLast && (
                <View
                  style={[styles.connector, isDone && styles.connectorDone]}
                />
              )}
            </View>
            {onStepPress ? (
              <Pressable onPress={() => onStepPress(index)} hitSlop={6}>
                <Text style={[styles.label, labelStyle]} numberOfLines={2}>
                  {step.label}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.label, labelStyle]} numberOfLines={2}>
                {step.label}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepCol: {
    flex: 1,
    alignItems: "flex-start",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
  },

  circle: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  circleDone: {
    backgroundColor: Colors.primary,
  },
  circleCurrent: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primaryDeep,
  },
  circleUpcoming: {
    backgroundColor: Colors.surfaceMuted,
  },
  checkMark: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  circleText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  connector: {
    flexGrow: 1,
    flexShrink: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  connectorDone: {
    backgroundColor: Colors.primary,
  },

  label: {
    marginTop: Spacing.xs + 2,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "left",
  },
  labelDone: {
    color: Colors.textPrimary,
    fontWeight: "600",
  },
  labelCurrent: {
    color: Colors.primaryDeep,
    fontWeight: "700",
  },
  labelUpcoming: {
    color: Colors.textSecondary,
    fontWeight: "500",
  },
});
