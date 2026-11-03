import { Colors, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TripStatus } from "../types";

export interface PrivateStatusBadgeProps {
  status: TripStatus;
  showPrivatePill?: boolean;
}

export function PrivateStatusBadge({
  status,
  showPrivatePill = true,
}: PrivateStatusBadgeProps) {
  function getStatusLabel() {
    switch (status as string) {
      case "OPEN":
      case "UPCOMING":
      case "FULL":
      case "CLOSED":
      case "DRAFT":
        return "SẮP DIỄN RA";
      case "IN_PROGRESS":
        return "ĐANG DIỄN RA";
      case "COMPLETED":
        return "ĐÃ HOÀN THÀNH";
      case "CANCELLED":
      case "CANCEL_PENDING":
        return "ĐÃ HỦY";
      default:
        return status;
    }
  }

  const isCancelled = status === "CANCELLED";
  const isInProgress = status === "IN_PROGRESS";
  const isCompleted = status === "COMPLETED";

  return (
    <View style={styles.container}>
      {showPrivatePill && (
        <View style={styles.privatePill}>
          <Ionicons name="lock-closed" size={11} color="#564500" />
          <Text style={styles.privatePillText}>PRIVATE TRIP</Text>
        </View>
      )}

      <View
        style={[
          styles.statusPill,
          isCancelled && styles.statusCancelled,
          isInProgress && styles.statusInProgress,
          isCompleted && styles.statusCompleted,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            isCancelled && styles.statusCancelledText,
            isInProgress && styles.statusInProgressText,
            isCompleted && styles.statusCompletedText,
          ]}
        >
          {getStatusLabel()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  privatePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.tertiaryFixed,
  },
  privatePillText: {
    color: "#564500",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  statusInProgress: {
    backgroundColor: "#DCFCE7",
  },
  statusCompleted: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  statusCancelled: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  statusInProgressText: {
    color: "#166534",
  },
  statusCompletedText: {
    color: Colors.mute,
  },
  statusCancelledText: {
    color: "#991B1B",
  },
});
