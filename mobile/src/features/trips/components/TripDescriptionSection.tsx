import { Colors, Radius, Shadows } from "@/constants/theme";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

export interface TripDescriptionSectionProps {
  description?: string | null;
  tripTitle?: string;
  destinationName?: string;
}

export const TripDescriptionSection = memo(function TripDescriptionSection({
  description,
  tripTitle,
  destinationName,
}: TripDescriptionSectionProps) {
  const content = (description || "").trim();

  return (
    <View style={styles.card}>
      {/* Header matching web: 📝 Giới thiệu & Kế hoạch chuyến đi */}
      <View style={styles.headerRow}>
        <Text style={styles.headerIcon}>📝</Text>
        <Text style={styles.headerTitle}>Giới thiệu & Kế hoạch chuyến đi</Text>
      </View>

      {/* Content Body */}
      {content ? (
        <View style={styles.bodyBox}>
          <Text style={styles.descriptionText} selectable>
            {content}
          </Text>
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Hành trình khám phá {tripTitle || "chuyến đi"} tại {destinationName || "thiên nhiên"}.
            Leader sẽ cập nhật chi tiết kế hoạch và các lưu ý an toàn cho đoàn trước giờ khởi hành.
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadows.hover,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  bodyBox: {
    gap: 10,
  },
  descriptionText: {
    fontSize: 13.5,
    lineHeight: 22,
    color: "#334155",
  },
  emptyBox: {
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748b",
    fontStyle: "italic",
  },
});
