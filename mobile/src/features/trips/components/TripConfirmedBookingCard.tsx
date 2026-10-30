import { Colors, Radius, Shadows } from "@/constants/theme";
import type { BookingDetail, BookingSummary } from "@/features/bookings/types";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface TripConfirmedBookingCardProps {
  booking: BookingSummary | BookingDetail;
  onViewTicket: () => void;
  onViewAllTrips: () => void;
}

export const TripConfirmedBookingCard = memo(function TripConfirmedBookingCard({
  booking,
  onViewTicket,
  onViewAllTrips,
}: TripConfirmedBookingCardProps) {
  const participantCount = booking.participantCount || 1;
  const totalAmountNum = Number(booking.totalAmount || 0);

  return (
    <View style={styles.card}>
      {/* Top Checkmark Circle */}
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark" size={26} color="#16a34a" />
      </View>

      {/* Badge: ĐÃ ĐẶT & XÁC NHẬN VÉ */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>ĐÃ ĐẶT & XÁC NHẬN VÉ</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>Bạn đã tham gia chuyến đi này!</Text>

      {/* Details: Số lượng & Tổng tiền */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Số lượng: <Text style={styles.infoHighlight}>{participantCount} thành viên</Text>
        </Text>
        <Text style={styles.infoText}>
          Tổng đã thanh toán:{" "}
          <Text style={styles.infoHighlight}>
            {totalAmountNum.toLocaleString("vi-VN")}đ
          </Text>
        </Text>
      </View>

      {/* Button: Xem Chi Tiết Vé Đặt Chỗ → */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onViewTicket}
        activeOpacity={0.85}
      >
        <Ionicons name="ticket-outline" size={17} color="#ffffff" />
        <Text style={styles.actionBtnText}>Xem Chi Tiết Vé Đặt Chỗ →</Text>
      </TouchableOpacity>

      {/* Link: ← Xem tất cả chuyến đi của tôi */}
      <TouchableOpacity
        style={styles.linkBtn}
        onPress={onViewAllTrips}
        activeOpacity={0.7}
      >
        <Text style={styles.linkText}>← Xem tất cả chuyến đi của tôi</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    borderRadius: Radius.xl,
    padding: 18,
    alignItems: "center",
    ...Shadows.hover,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  badge: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#166534",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 6,
  },
  infoContainer: {
    gap: 3,
    alignItems: "center",
    marginBottom: 14,
  },
  infoText: {
    fontSize: 13,
    color: "#475569",
  },
  infoHighlight: {
    fontWeight: "800",
    color: "#0f172a",
  },
  actionBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#166534",
    paddingVertical: 12,
    borderRadius: Radius.sm,
    marginBottom: 10,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  linkBtn: {
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#166534",
  },
});
