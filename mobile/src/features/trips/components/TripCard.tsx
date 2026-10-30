/**
 * TripCard — thẻ chuyến đi công khai (Explore feed + tab Trips).
 * Thiết kế "Tactical Topographic Utility": card trắng, viền 1px #E5E7EB, bo 12,
 * metadata phân tách bằng đường kẻ mảnh, số liệu tabular-nums (đồng bộ web DESIGN.md).
 */
import { DifficultyBadge, SurfaceCard, Typography, formatVnd } from "@/components/ui";
import { Colors, Radius, Spacing } from "@/constants/designTokens";
import {
  isRegistrationNotOpenYet,
  type PublicTrip,
} from "@/features/trips/services/public-trips.api";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

export interface TripCardProps {
  trip: PublicTrip;
  onPress: () => void;
}

export const TripCard = memo(function TripCard({ trip, onPress }: TripCardProps) {
  const startDate = new Date(trip.startAt);
  const endDate = new Date(trip.endAt);
  const diffDays = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const slotPercent = trip.capacity > 0 ? trip.remainingSlots / trip.capacity : 0;
  const isAlmostFull = slotPercent < 0.3;
  const isVnd = (trip.currency || "VND") === "VND";
  const registrationNotOpen = isRegistrationNotOpenYet(trip);

  return (
    <SurfaceCard padding="md" onPress={onPress} style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.destinationPill}>
          <Ionicons name="location" size={11} color={Colors.primaryDeep} />
          <Text style={styles.destinationText} numberOfLines={1}>
            {trip.destination?.name || "Điểm đến"}
          </Text>
        </View>

        {registrationNotOpen ? (
          <View style={styles.notOpenBadge}>
            <Text style={styles.notOpenText} numberOfLines={1}>
              CHƯA TỚI HẠN ĐĂNG KÝ
            </Text>
          </View>
        ) : isAlmostFull ? (
          <View style={styles.almostFullBadge}>
            <Text style={styles.almostFullText}>GẦN ĐẦY</Text>
          </View>
        ) : null}
      </View>

      {/* Trip Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {trip.title}
      </Text>

      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
          <Text style={[styles.metaText, Typography.tabularNums]}>
            {startDate.toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
            })}{" "}
            · {diffDays}N{Math.max(0, diffDays - 1)}Đ
          </Text>
        </View>
        {trip.routes?.[0] && (
          <DifficultyBadge difficulty={trip.routes[0].snapshotDifficulty} />
        )}
      </View>

      {/* Leader row */}
      <View style={styles.leaderRow}>
        <View style={styles.leaderAvatarSmall}>
          <Text style={styles.leaderAvatarLetter}>
            {(trip.leader?.fullName || "L").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.leaderName} numberOfLines={1}>
          {trip.leader?.fullName || "TrekGo Leader"}
        </Text>
        <Ionicons name="shield-checkmark" size={12} color={Colors.primary} />
      </View>

      {/* Pickup */}
      {trip.pickup?.name ? (
        <View style={styles.pickupBanner}>
          <Ionicons name="bus-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.pickupText} numberOfLines={1}>
            {trip.pickup.name}
            {trip.pickup.address ? ` · ${trip.pickup.address}` : ""}
          </Text>
        </View>
      ) : null}

      {/* Footer: price + slots (phân tách bằng đường kẻ mảnh theo DESIGN.md) */}
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.priceLabel}>Giá vé / người</Text>
          <Text style={[styles.priceValue, Typography.tabularNums]}>
            {isVnd
              ? formatVnd(trip.pricePerPax)
              : `${parseFloat(trip.pricePerPax || "0").toLocaleString("vi-VN")} ${trip.currency}`}
          </Text>
        </View>

        <View style={styles.slotsInfo}>
          <View style={styles.slotBarOuter}>
            <View
              style={[
                styles.slotBarInner,
                {
                  width: `${Math.round(slotPercent * 100)}%`,
                  backgroundColor: isAlmostFull ? Colors.accent : Colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.slotText, Typography.tabularNums]}>
            {trip.remainingSlots}/{trip.capacity} chỗ còn
          </Text>
        </View>
      </View>
    </SurfaceCard>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    marginBottom: Spacing.md + 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  destinationPill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  destinationText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primaryDeep,
  },
  almostFullBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dangerBg,
  },
  almostFullText: { fontSize: 9, fontWeight: "800", color: Colors.dangerText },
  notOpenBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.warningBg,
  },
  notOpenText: { fontSize: 9, fontWeight: "800", color: Colors.warningText },

  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
    lineHeight: 22,
  },

  metaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },

  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
  },
  leaderAvatarSmall: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  leaderAvatarLetter: { fontSize: 9, fontWeight: "800", color: Colors.primaryDeep },
  leaderName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },

  pickupBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  pickupText: { flex: 1, fontSize: 10, color: Colors.textSecondary },

  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm + 2,
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "600",
    marginBottom: 1,
  },
  priceValue: { fontSize: 17, fontWeight: "800", color: Colors.primaryDeep },
  slotsInfo: { alignItems: "flex-end", gap: Spacing.xs },
  slotBarOuter: {
    width: 72,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceMuted,
    overflow: "hidden",
  },
  slotBarInner: { height: "100%", borderRadius: 2 },
  slotText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
});
