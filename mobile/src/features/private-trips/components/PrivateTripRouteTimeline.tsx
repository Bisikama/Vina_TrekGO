import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CheckpointItem } from "../types";

export interface PrivateTripRouteTimelineProps {
  checkpoints: CheckpointItem[];
  trailName?: string;
}

export function PrivateTripRouteTimeline({
  checkpoints,
  trailName,
}: PrivateTripRouteTimelineProps) {
  if (!checkpoints || checkpoints.length === 0) {
    return null;
  }

  const sorted = [...checkpoints].sort((a, b) => a.sequence - b.sequence);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <Ionicons name="map-outline" size={18} color={Colors.primaryDark} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Lộ trình & Trạm dừng</Text>
          {trailName ? <Text style={styles.subtitle}>{trailName}</Text> : null}
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{sorted.length} trạm</Text>
        </View>
      </View>

      <View style={styles.timelineList}>
        {sorted.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === sorted.length - 1;

          return (
            <View key={item.id} style={styles.timelineItem}>
              <View style={styles.nodeColumn}>
                <View
                  style={[
                    styles.nodeDot,
                    isFirst && styles.firstDot,
                    isLast && styles.lastDot,
                  ]}
                >
                  <Text
                    style={[
                      styles.nodeNumber,
                      (isFirst || isLast) && styles.nodeNumberActive,
                    ]}
                  >
                    {item.sequence}
                  </Text>
                </View>
                {!isLast && <View style={styles.line} />}
              </View>

              <View style={styles.nodeContent}>
                <Text style={styles.checkpointName}>{item.name}</Text>
                {item.latitude != null && item.longitude != null && !isNaN(Number(item.latitude)) && !isNaN(Number(item.longitude)) ? (
                  <Text style={styles.checkpointCoords}>
                    {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.card,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: "row",
    minHeight: 46,
  },
  nodeColumn: {
    alignItems: "center",
    width: 28,
  },
  nodeDot: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.surfaceContainerLowest,
    zIndex: 2,
  },
  firstDot: {
    backgroundColor: Colors.primaryDark,
  },
  lastDot: {
    backgroundColor: "#16A34A",
  },
  nodeNumber: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.onSurfaceVariant,
  },
  nodeNumberActive: {
    color: Colors.onPrimary,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.surfaceContainerHigh,
    marginVertical: -2,
  },
  nodeContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 16,
    justifyContent: "center",
  },
  checkpointName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.onSurface,
  },
  checkpointCoords: {
    fontSize: 11,
    color: Colors.mute,
    marginTop: 2,
  },
});
