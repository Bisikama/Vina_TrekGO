import { Colors, Radius, Shadows } from "@/constants/theme";
import type { PublicTripLeader } from "@/features/trips/services/public-trips.api";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

export interface TripLeaderInfoProps {
  leader: PublicTripLeader;
}

export const TripLeaderInfo = memo(function TripLeaderInfo({
  leader,
}: TripLeaderInfoProps) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Người dẫn đoàn</Text>
      <View style={styles.leaderRow}>
        <View style={styles.leaderAvatar}>
          <Text style={styles.leaderAvatarText}>
            {leader.fullName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.leaderInfo}>
          <Text style={styles.leaderName}>{leader.fullName}</Text>
          <View style={styles.leaderBadgeRow}>
            <Ionicons name="shield-checkmark" size={12} color={Colors.primaryDark} />
            <Text style={styles.leaderBadgeText}>Verified Leader</Text>
          </View>
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
  leaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  leaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  leaderAvatarText: { fontSize: 18, fontWeight: "900", color: Colors.primaryDark },
  leaderInfo: { flex: 1, gap: 2 },
  leaderName: { fontSize: 14, fontWeight: "800", color: Colors.onSurface },
  leaderBadgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  leaderBadgeText: { fontSize: 11, color: Colors.primaryDark, fontWeight: "700" },
});
