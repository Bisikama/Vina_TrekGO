import { Trip3DMapView } from "@/components/Trip3DMapView";
import { Colors, Radius, Shadows } from "@/constants/theme";
import type { SystemTrailDetail } from "@/features/leaders/services/leader-public-trips.api";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface TripMapSectionProps {
  trailData?: SystemTrailDetail | null;
}

export const TripMapSection = memo(function TripMapSection({
  trailData,
}: TripMapSectionProps) {
  const [showMap, setShowMap] = useState(false);

  return (
    <View style={styles.sectionCard}>
      <View style={styles.mapSectionHeader}>
        <Text style={styles.sectionTitle}>Bản đồ địa hình 3D</Text>
        <TouchableOpacity
          style={styles.mapToggleBtn}
          onPress={() => setShowMap((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={showMap ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.primaryDark}
          />
          <Text style={styles.mapToggleText}>
            {showMap ? "Thu lại" : "Xem bản đồ"}
          </Text>
        </TouchableOpacity>
      </View>
      {showMap ? (
        <View style={styles.mapWrapper}>
          <Trip3DMapView trailData={trailData} height={300} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadows.card,
  },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: Colors.onSurface },
  mapSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  mapToggleText: { fontSize: 11, fontWeight: "700", color: Colors.primaryDark },
  mapWrapper: { marginTop: 12, borderRadius: Radius.lg, overflow: "hidden" },
});
