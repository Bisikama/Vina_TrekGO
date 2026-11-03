import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { usePrivateTripRoom } from "../hooks/usePrivateTripRoom";
import type { TripRoomData } from "../types";
import { PrivateStatusBadge } from "./PrivateStatusBadge";

export interface TripRoomHeaderProps {
  tripId?: string;
  roomData?: TripRoomData;
}

export function TripRoomHeader({
  tripId,
  roomData: propRoomData,
}: TripRoomHeaderProps) {
  // If roomData not provided, fetch via hook
  const shouldFetch = !propRoomData && Boolean(tripId);
  const { roomData: apiRoomData, loading } = usePrivateTripRoom(
    tripId,
    shouldFetch,
  );

  const roomData = propRoomData || apiRoomData;

  if (loading && !roomData) {
    return (
      <View style={[styles.card, styles.centerCard]}>
        <ActivityIndicator size="small" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Đang tải thông tin phòng chờ...</Text>
      </View>
    );
  }

  if (!roomData) {
    return null;
  }

  const { trip, viewer } = roomData;
  const slotPercent =
    trip.capacity > 0 ? (trip.activeMemberCount / trip.capacity) * 100 : 0;
  const isFull = trip.activeMemberCount >= trip.capacity;

  const startDate = new Date(trip.startAt);
  const formattedStart = !isNaN(startDate.getTime())
    ? startDate.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : trip.startAt;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <PrivateStatusBadge status={trip.status} />

        {viewer.isHost ? (
          <View style={styles.hostBadge}>
            <Ionicons name="star" size={12} color="#725C00" />
            <Text style={styles.hostBadgeText}>BẠN LÀ HOST</Text>
          </View>
        ) : (
          <View style={styles.memberBadge}>
            <Ionicons name="person" size={12} color={Colors.primaryDark} />
            <Text style={styles.memberBadgeText}>THÀNH VIÊN</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{trip.title}</Text>

      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={15} color={Colors.onSurfaceVariant} />
        <Text style={styles.timeText}>Khởi hành: {formattedStart}</Text>
      </View>

      {trip.pickupPoint ? (
        <View style={styles.pickupRow}>
          <Ionicons
            name="location-outline"
            size={15}
            color={Colors.primaryDark}
          />
          <Text style={styles.pickupText}>
            Điểm đón: {trip.pickupPoint.name}
          </Text>
        </View>
      ) : null}

      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Quy mô nhóm</Text>
          <Text style={styles.progressCount}>
            {trip.activeMemberCount} / {trip.capacity} người {isFull ? "(Đầy)" : ""}
          </Text>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, slotPercent)}%` },
              isFull && styles.progressBarFull,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.card,
    marginBottom: 16,
  },
  centerCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
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
  hostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: "#FEF3C7",
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#725C00",
    letterSpacing: 0.4,
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  memberBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primaryDark,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.onSurface,
    lineHeight: 24,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    fontWeight: "500",
  },
  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  pickupText: {
    fontSize: 13,
    color: Colors.onSurface,
    fontWeight: "600",
  },
  progressSection: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerLow,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontWeight: "600",
  },
  progressCount: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  progressBarFull: {
    backgroundColor: "#16A34A",
  },
});
