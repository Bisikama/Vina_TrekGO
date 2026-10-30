import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PickupPointOption } from "../types";

export interface PrivateTripPickupCardProps {
  pickupPoint?: PickupPointOption | null;
}

export function PrivateTripPickupCard({
  pickupPoint,
}: PrivateTripPickupCardProps) {
  if (!pickupPoint) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Ionicons name="bus-outline" size={20} color={Colors.primaryDark} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Điểm tập kết</Text>
        <Text style={styles.name}>{pickupPoint.name}</Text>
        {pickupPoint.address ? (
          <Text style={styles.address}>{pickupPoint.address}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.card,
    marginBottom: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  address: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
});
