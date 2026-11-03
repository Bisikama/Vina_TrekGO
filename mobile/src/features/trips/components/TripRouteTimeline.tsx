import { Colors, Radius, Shadows } from "@/constants/theme";
import type {
  PublicTripCheckpoint,
  PublicTripRoute,
} from "@/features/trips/services/public-trips.api";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

export interface TripRouteTimelineProps {
  routes: PublicTripRoute[];
  checkpoints: PublicTripCheckpoint[];
}

export const TripRouteTimeline = memo(function TripRouteTimeline({
  routes,
  checkpoints,
}: TripRouteTimelineProps) {
  return (
    <>
      {/* Route Info */}
      {routes.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Lộ trình hành quân</Text>
          {routes.map((route, i) => (
            <View key={i} style={styles.routeItem}>
              <View style={styles.routeIndex}>
                <Text style={styles.routeIndexText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeName}>{route.snapshotName}</Text>
                <Text style={styles.routeMeta}>
                  {route.snapshotDifficulty} · {route.snapshotDistanceKm} km
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Checkpoints */}
      {checkpoints.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Trạm Checkpoint</Text>
          {checkpoints.map((cp, i) => (
            <View key={i} style={styles.checkpointItem}>
              <View style={styles.cpNumberBadge}>
                <Text style={styles.cpNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.cpName}>{cp.name}</Text>
              {cp.isRequired && (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredText}>BẮT BUỘC</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </>
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
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerLow,
  },
  routeIndex: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  routeIndexText: { fontSize: 11, fontWeight: "900", color: Colors.inverseOnSurface },
  routeName: { fontSize: 13, fontWeight: "800", color: Colors.onSurface },
  routeMeta: { fontSize: 11, color: Colors.mute, marginTop: 1 },
  checkpointItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  cpNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: "#FF3D00",
    alignItems: "center",
    justifyContent: "center",
  },
  cpNumberText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  cpName: { flex: 1, fontSize: 13, fontWeight: "700", color: Colors.onSurface },
  requiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.errorContainer,
  },
  requiredText: { fontSize: 8, fontWeight: "900", color: Colors.onErrorContainer },
});
