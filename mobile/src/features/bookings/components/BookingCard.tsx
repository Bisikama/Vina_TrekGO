import { Colors, Radius, Shadows } from "@/constants/theme";
import { BOOKING_STATUS_LABELS } from "@/features/bookings/services/booking.api";
import type { BookingStatus, BookingSummary } from "@/features/bookings/types";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface BookingCardProps {
  booking: BookingSummary;
  onPress: () => void;
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  const { status, totalAmount, participantCount, trip, expiresAt } = booking;

  // Countdown for PENDING_PAYMENT
  const [remainingSec, setRemainingSec] = useState<number>(0);

  useEffect(() => {
    if (status !== "PENDING_PAYMENT" || !expiresAt) return;

    const calc = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      setRemainingSec(diff);
      return diff;
    };

    calc();
    const t = setInterval(() => {
      if (calc() <= 0) clearInterval(t);
    }, 1000);

    return () => clearInterval(t);
  }, [status, expiresAt]);

  const rawStartAt = trip?.startAt || (booking as any)?.startAt || (booking as any)?.startDate;
  const startDate = rawStartAt ? new Date(rawStartAt) : null;
  const formattedDate = startDate && !isNaN(startDate.getTime())
    ? startDate.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Chưa xác định";

  const statusLabel = BOOKING_STATUS_LABELS[status] || status;

  function renderStatusBadge() {
    const endAt = trip?.endAt ? new Date(trip.endAt) : null;
    const isPast = endAt && !isNaN(endAt.getTime()) && endAt < new Date();
    const isTripCompleted = (trip?.status || "").toUpperCase() === "COMPLETED" || Boolean(isPast);
    if (isTripCompleted && (status === "CONFIRMED" || status === "CHECKED_IN" || status === "COMPLETED")) {
      return (
        <View style={[styles.badge, { backgroundColor: "#DCFCE7" }]}>
          <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
          <Text style={[styles.badgeText, { color: "#16A34A" }]}>Đã hoàn thành</Text>
        </View>
      );
    }

    let bg = Colors.surfaceContainerLow;
    let fg = Colors.onSurfaceVariant;
    let icon: keyof typeof Ionicons.glyphMap = "time-outline";

    switch (status as BookingStatus) {
      case "CONFIRMED":
      case "COMPLETED":
        bg = "#DCFCE7";
        fg = "#16A34A";
        icon = "checkmark-circle";
        break;
      case "PENDING_PAYMENT":
        bg = "#FEF3C7";
        fg = "#D97706";
        icon = "hourglass-outline";
        break;
      case "CANCELLED":
      case "EXPIRED":
      case "NO_SHOW":
        bg = "#FEE2E2";
        fg = "#DC2626";
        icon = "close-circle";
        break;
      case "CHECKED_IN":
      case "PARTIAL_CHECKIN":
        bg = Colors.primaryPale;
        fg = Colors.primaryDark;
        icon = "flag";
        break;
    }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={12} color={fg} />
        <Text style={[styles.badgeText, { color: fg }]}>{statusLabel}</Text>
      </View>
    );
  }

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const timerStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={2}>
            {trip?.title || (booking as any)?.tripTitle || (booking as any)?.name || "Chuyến đi TrekGo"}
          </Text>
        </View>
        {renderStatusBadge()}
      </View>

      {/* Countdown warning for pending payment */}
      {status === "PENDING_PAYMENT" && remainingSec > 0 ? (
        <View style={styles.holdBanner}>
          <Ionicons name="timer-outline" size={14} color="#D97706" />
          <Text style={styles.holdText}>
            Thời gian giữ chỗ còn lại:{" "}
            <Text style={styles.holdBold}>{timerStr}</Text>
          </Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.metaCol}>
          <Ionicons name="calendar-outline" size={14} color={Colors.onSurfaceMuted} />
          <Text style={styles.metaVal}>{formattedDate}</Text>
        </View>
        <View style={styles.metaCol}>
          <Ionicons name="people-outline" size={14} color={Colors.onSurfaceMuted} />
          <Text style={styles.metaVal}>{participantCount} vé</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.priceLabel}>Tổng tiền</Text>
          <Text style={styles.priceVal}>
            {Number(totalAmount || 0).toLocaleString("vi-VN")} đ
          </Text>
        </View>
        <View style={styles.actionPill}>
          <Text style={styles.actionText}>
            {status === "PENDING_PAYMENT" ? "Thanh toán ngay" : "Xem chi tiết chuyến đi"}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={status === "PENDING_PAYMENT" ? "#FFFFFF" : Colors.primaryDark}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.card,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.onSurface,
    lineHeight: 20,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  holdBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    marginBottom: 10,
  },
  holdText: {
    fontSize: 11,
    color: "#92400E",
  },
  holdBold: {
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  metaCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaVal: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceContainer,
    marginBottom: 12,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 10,
    color: Colors.onSurfaceMuted,
  },
  priceVal: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.primaryDark,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
});
