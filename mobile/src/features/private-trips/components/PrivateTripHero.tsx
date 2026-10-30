import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { usePrivateTripDetail } from "../hooks/usePrivateTripDetail";
import type { PrivateTrip } from "../types";
import { PrivateStatusBadge } from "./PrivateStatusBadge";

export interface PrivateTripHeroProps {
  tripId?: string;
  trip?: PrivateTrip;
  activeMemberCount?: number;
}

export function PrivateTripHero({
  tripId,
  trip: propTrip,
  activeMemberCount: propActiveCount = 1,
}: PrivateTripHeroProps) {
  // If trip not provided, fetch via hook
  const shouldFetch = !propTrip && Boolean(tripId);
  const { trip: apiTrip, loading } = usePrivateTripDetail(tripId, shouldFetch);

  const trip = propTrip || apiTrip;
  const activeMemberCount = propActiveCount;

  if (loading && !trip) {
    return (
      <View style={[styles.heroCard, styles.centerCard]}>
        <ActivityIndicator size="small" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Đang tải thông tin chuyến đi...</Text>
      </View>
    );
  }

  if (!trip) {
    return null;
  }

  const startDate = new Date(trip.startAt);
  const endDate = new Date(trip.endAt);

  const formattedStart = !isNaN(startDate.getTime())
    ? startDate.toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : trip.startAt;

  const formattedEnd = !isNaN(endDate.getTime())
    ? endDate.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : trip.endAt;

  const remainingSlots = Math.max(0, trip.maxPax - activeMemberCount);

  return (
    <View style={styles.heroCard}>
      <View style={styles.topRow}>
        <PrivateStatusBadge status={trip.status} />

        <View style={styles.versionTag}>
          <Text style={styles.versionText}>v{trip.version}</Text>
        </View>
      </View>

      <Text style={styles.title}>{trip.title}</Text>

      {trip.description ? (
        <Text style={styles.description}>{trip.description}</Text>
      ) : null}

      <View style={styles.metaSection}>
        <View style={styles.metaRow}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={Colors.primaryDark}
          />
          <Text style={styles.metaText}>
            {formattedStart} — {formattedEnd}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Ionicons name="people-outline" size={18} color={Colors.primaryDark} />
          <Text style={styles.gridValue}>
            {activeMemberCount} / {trip.maxPax} người
          </Text>
          <Text style={styles.gridLabel}>Quy mô nhóm</Text>
        </View>

        <View style={styles.gridDivider} />

        <View style={styles.gridItem}>
          <Ionicons
            name="person-add-outline"
            size={18}
            color={remainingSlots > 0 ? "#16A34A" : Colors.mute}
          />
          <Text
            style={[
              styles.gridValue,
              remainingSlots > 0 ? styles.slotsActive : styles.slotsFull,
            ]}
          >
            {remainingSlots}
          </Text>
          <Text style={styles.gridLabel}>Chỗ trống</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 18,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.hover,
    marginBottom: 16,
  },
  centerCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  versionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  versionText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.onSurface,
    lineHeight: 26,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 14,
  },
  metaSection: {
    marginBottom: 14,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerLow,
  },
  gridItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  gridDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.surfaceContainer,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  slotsActive: {
    color: "#16A34A",
  },
  slotsFull: {
    color: Colors.mute,
  },
  gridLabel: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: "500",
  },
});
