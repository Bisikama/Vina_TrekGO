import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePrivateTripDetail } from "../hooks/usePrivateTripDetail";
import type { PrivateTrip } from "../types";
import { PrivateStatusBadge } from "./PrivateStatusBadge";

export interface PrivateTripCardProps {
  tripId?: string;
  trip?: PrivateTrip;
  currentPax?: number;
  onPress: () => void;
}

export const PrivateTripCard = memo(function PrivateTripCard({
  tripId,
  trip: propTrip,
  currentPax = 1,
  onPress,
}: PrivateTripCardProps) {
  // If trip not provided, fetch via hook
  const shouldFetch = !propTrip && Boolean(tripId);
  const { trip: apiTrip, loading } = usePrivateTripDetail(tripId, shouldFetch);

  const trip = propTrip || apiTrip;

  if (loading && !trip) {
    return (
      <View style={[styles.card, styles.centerCard]}>
        <ActivityIndicator size="small" color={Colors.primaryDark} />
      </View>
    );
  }

  if (!trip) {
    return null;
  }

  const startDate = new Date(trip.startAt);
  const formattedDate = !isNaN(startDate.getTime())
    ? startDate.toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : trip.startAt;

  const maxPax = trip.maxPax || (trip as any).capacity || 0;
  const paxCount = (trip as any).activeMemberCount || currentPax || 1;
  const remainingSlots = maxPax > 0 ? Math.max(0, maxPax - paxCount) : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.headerRow}>
        <PrivateStatusBadge status={trip.status} />

        <View style={styles.paxBadge}>
          <Ionicons name="people" size={13} color={Colors.primaryDark} />
          <Text style={styles.paxText}>
            {maxPax > 0 ? `${paxCount}/${maxPax} người` : `${paxCount} người`}
          </Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {trip.title}
      </Text>

      {trip.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {trip.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color={Colors.onSurfaceVariant}
          />
          <Text style={styles.metaText}>{formattedDate}</Text>
        </View>

        {remainingSlots > 0 && trip.status === "OPEN" ? (
          <View style={styles.slotTag}>
            <Text style={styles.slotTagText}>Còn {remainingSlots} chỗ</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.actionText}>Xem chi tiết chuyến đi</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.card,
  },
  centerCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  paxBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  paxText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
    lineHeight: 22,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerLow,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontWeight: "500",
  },
  slotTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: "#FEF3C7",
  },
  slotTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
});
