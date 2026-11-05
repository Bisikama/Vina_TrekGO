import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

// Nhãn hạng sản phẩm thuê (Như mới / Sử dụng tốt) dạng bubble, dùng chung cho các màn thuê.
export type RentalGradeValue = "LIKE_NEW" | "GOOD_USED";

const GRADE_LABELS: Record<RentalGradeValue, string> = { LIKE_NEW: "Như mới", GOOD_USED: "Sử dụng tốt" };
const GRADE_COLORS: Record<RentalGradeValue, { bg: string; border: string; text: string }> = {
  LIKE_NEW: { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  GOOD_USED: { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
};

export function GradeBadge({ grade, style }: { grade: RentalGradeValue; style?: StyleProp<ViewStyle> }) {
  const colors = GRADE_COLORS[grade];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }, style]}>
      <View style={[styles.dot, { backgroundColor: colors.text }]} />
      <Text style={[styles.text, { color: colors.text }]}>{GRADE_LABELS[grade]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: { width: 5, height: 5, borderRadius: 3, opacity: 0.7 },
  text: { fontSize: 11, fontWeight: "500" },
});
