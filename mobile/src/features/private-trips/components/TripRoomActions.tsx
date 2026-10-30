import { Colors, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { TripRoomPermissions } from "../types";

export interface TripRoomActionsProps {
  tripId?: string;
  expectedMemberVersion?: number;
  isHost: boolean;
  permissions?: TripRoomPermissions;
  leaving?: boolean;
  onInvite: () => void;
  onDirectInvite?: () => void;
  onLeave?: () => void;
  onLeaveSuccess?: () => void;
}

export function TripRoomActions({
  isHost,
  permissions,
  leaving = false,
  onInvite,
  onDirectInvite,
  onLeave,
}: TripRoomActionsProps) {
  const canInvite = Boolean(isHost && permissions?.canInvite);
  const canLeave = Boolean(!isHost && permissions?.canLeave);

  return (
    <View style={styles.container}>
      {/* Host actions */}
      {canInvite ? (
        <View style={styles.hostActionRow}>
          <TouchableOpacity
            style={styles.directInviteButton}
            onPress={() => onDirectInvite?.()}
            activeOpacity={0.85}
          >
            <Ionicons name="mail" size={17} color="#FFFFFF" />
            <Text style={styles.directInviteButtonText}>
              ✉️ Mời qua Email
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.codeInviteButton}
            onPress={() => onInvite?.()}
            activeOpacity={0.85}
          >
            <Ionicons name="link-outline" size={17} color="#054D28" />
            <Text style={styles.codeInviteButtonText}>Link / Mã Code</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Member actions */}
      {canLeave ? (
        <TouchableOpacity
          style={[styles.dangerButton, leaving && styles.disabledButton]}
          onPress={() => onLeave?.()}
          disabled={leaving}
          activeOpacity={0.8}
        >
          {leaving ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <View style={styles.buttonInner}>
              <Ionicons name="exit-outline" size={18} color="#DC2626" />
              <Text style={styles.dangerButtonText}>Rời khỏi chuyến đi</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
  },
  hostActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  directInviteButton: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: "#054D28",
  },
  directInviteButtonText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  codeInviteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: "#E2F6D5",
    borderWidth: 1,
    borderColor: "#A3E635",
  },
  codeInviteButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#054D28",
  },
});
