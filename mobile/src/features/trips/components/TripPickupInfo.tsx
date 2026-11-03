import { Colors, Radius, Shadows } from "@/constants/theme";
import type { PublicTripPickup } from "@/features/trips/services/public-trips.api";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

export interface TripPickupInfoProps {
  pickup: PublicTripPickup;
  startAt: string;
}

export const TripPickupInfo = memo(function TripPickupInfo({
  pickup,
  startAt,
}: TripPickupInfoProps) {
  const startDate = new Date(startAt);

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Điểm tập kết</Text>
      <View style={styles.pickupRow}>
        <View style={styles.pickupIconBox}>
          <Ionicons name="bus" size={18} color={Colors.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pickupName}>{pickup.name}</Text>
          {pickup.address ? (
            <Text style={styles.pickupAddress}>{pickup.address}</Text>
          ) : null}
          <Text style={styles.pickupTime}>
            🕐 Khởi hành:{" "}
            {startDate.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            {startDate.toLocaleDateString("vi-VN", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
            })}
          </Text>
        </View>
      </View>
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
  sectionTitle: { fontSize: 13, fontWeight: "900", color: Colors.onSurface, marginBottom: 12 },
  pickupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  pickupIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  pickupName: { fontSize: 14, fontWeight: "800", color: Colors.onSurface },
  pickupAddress: { fontSize: 12, color: Colors.mute, marginTop: 2 },
  pickupTime: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 4 },
});
