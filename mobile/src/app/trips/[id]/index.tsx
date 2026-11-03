import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BookingModal } from "@/components/BookingModal";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { PublicTripDetailScreen } from "@/features/trips/screens/PublicTripDetailScreen";
import type { Trip } from "@/types";

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips } = useApp();

  // If this ID belongs to the legacy mock list (starts with 'trip-'), render legacy screen
  const isMockTrip = id?.startsWith("trip-");
  const mockTrip = useMemo(
    () => (isMockTrip ? trips.find((item) => item.id === id) : null),
    [id, isMockTrip, trips],
  );

  if (!isMockTrip && id) {
    return <PublicTripDetailScreen tripId={id} />;
  }

  return <LegacyMockTripDetail trip={mockTrip} />;
}

function LegacyMockTripDetail({ trip }: { trip?: Trip | null }) {
  const router = useRouter();
  const [bookingVisible, setBookingVisible] = useState(false);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/trips" as Href);
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Ionicons
            name="map-outline"
            size={54}
            color={Colors.onSurfaceMuted}
          />

          <Text style={styles.emptyTitle}>Không tìm thấy chuyến đi</Text>

          <Text style={styles.emptyDescription}>
            Chuyến đi này có thể đã được cập nhật hoặc không còn khả dụng.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={handleBack}>
            <Text style={styles.primaryButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const availableSlots = Math.max(0, trip.capacity - trip.enrolledCount);

  const isAlreadyBooked = Boolean(trip.bookingCode);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Chi tiết chuyến đi</Text>

        <TouchableOpacity style={styles.headerButton}>
          <Ionicons
            name="bookmark-outline"
            size={21}
            color={Colors.onSurface}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroDecorOne} />
          <View style={styles.heroDecorTwo} />

          <View style={styles.heroBadges}>
            <View style={styles.publicBadge}>
              <Ionicons name="earth" size={13} color="#0c2000" />

              <Text style={styles.publicBadgeText}>PUBLIC TOUR</Text>
            </View>

            <View style={styles.slotBadge}>
              <Text style={styles.slotBadgeText}>Còn {availableSlots} chỗ</Text>
            </View>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroEyebrow}>{trip.destination}</Text>

            <Text style={styles.heroTitle}>{trip.name}</Text>

            <View style={styles.heroMetaRow}>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={Colors.onSurfaceVariant}
              />

              <Text style={styles.heroMetaText}>
                {trip.startDate} – {trip.endDate}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons
              name="time-outline"
              size={21}
              color={Colors.primaryDark}
            />

            <Text style={styles.statValue}>{trip.durationDays} ngày</Text>

            <Text style={styles.statLabel}>Thời lượng</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons
              name="people-outline"
              size={21}
              color={Colors.primaryDark}
            />

            <Text style={styles.statValue}>
              {trip.enrolledCount}/{trip.capacity}
            </Text>

            <Text style={styles.statLabel}>Thành viên</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons
              name="wallet-outline"
              size={21}
              color={Colors.primaryDark}
            />

            <Text style={styles.statValue}>
              {((trip.pricePerPerson ?? 2850000) / 1000000).toFixed(2)}tr
            </Text>

            <Text style={styles.statLabel}>Mỗi người</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Trek Leader</Text>

          <View style={styles.leaderRow}>
            <View style={styles.leaderAvatar}>
              <Ionicons name="person" size={26} color={Colors.onPrimary} />
            </View>

            <View style={styles.leaderInfo}>
              <Text style={styles.leaderName}>{trip.leader.name}</Text>

              <View style={styles.leaderRatingRow}>
                <Ionicons name="star" size={14} color="#e5aa00" />

                <Text style={styles.leaderRating}>
                  {trip.leader.rating.toFixed(1)}
                </Text>

                <Text style={styles.leaderBadgeText}>
                  · {trip.leader.badge}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.contactButton}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={19}
                color={Colors.primaryDark}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Thời tiết dự kiến</Text>

            <View style={styles.weatherStatus}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: trip.weather.rainRisk
                      ? "#e5aa00"
                      : Colors.primary,
                  },
                ]}
              />

              <Text style={styles.weatherStatusText}>
                {trip.weather.rainRisk ? "Có khả năng mưa" : "Điều kiện tốt"}
              </Text>
            </View>
          </View>

          <View style={styles.weatherRow}>
            <View style={styles.weatherIconBox}>
              <Ionicons
                name={trip.weather.rainRisk ? "rainy" : "partly-sunny"}
                size={28}
                color="#725c00"
              />
            </View>

            <View style={styles.weatherMain}>
              <Text style={styles.weatherTemp}>{trip.weather.tempC}°C</Text>

              <Text style={styles.weatherCondition}>
                {trip.weather.condition}
              </Text>
            </View>

            <View style={styles.weatherDetails}>
              <Text style={styles.weatherDetailText}>
                Mưa {trip.weather.rainChancePercent}%
              </Text>

              <Text style={styles.weatherDetailText}>
                Gió {trip.weather.windSpeedKmh} km/h
              </Text>
            </View>
          </View>

          {trip.weather.riskNotice ? (
            <View style={styles.noticeBox}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color={Colors.primaryDark}
              />

              <Text style={styles.noticeText}>{trip.weather.riskNotice}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Lịch trình dự kiến</Text>

          <View style={styles.timelineItem}>
            <View style={styles.timelineMarker}>
              <Text style={styles.timelineNumber}>1</Text>
            </View>

            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Tập trung và di chuyển</Text>

              <Text style={styles.timelineText}>
                Kiểm tra hành lý, nhận thiết bị và di chuyển đến điểm trekking.
              </Text>
            </View>
          </View>

          <View style={styles.timelineLine} />

          <View style={styles.timelineItem}>
            <View style={styles.timelineMarker}>
              <Text style={styles.timelineNumber}>2</Text>
            </View>

            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Trekking theo cung đường</Text>

              <Text style={styles.timelineText}>
                Đi qua các checkpoint, nghỉ trưa và dựng trại theo hướng dẫn của
                Leader.
              </Text>
            </View>
          </View>

          <View style={styles.timelineLine} />

          <View style={styles.timelineItem}>
            <View style={styles.timelineMarker}>
              <Text style={styles.timelineNumber}>3</Text>
            </View>

            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Hoàn thành chuyến đi</Text>

              <Text style={styles.timelineText}>
                Thu dọn khu cắm trại, kiểm tra thành viên và trở về điểm đón.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Chi phí bao gồm</Text>

          {[
            "Xe trung chuyển hai chiều",
            "Trek Leader và Porter bản địa",
            "Bảo hiểm trekking cơ bản",
            "Nước uống và bữa ăn theo lịch trình",
          ].map((item) => (
            <View key={item} style={styles.includedRow}>
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark" size={14} color="#0c2000" />
              </View>

              <Text style={styles.includedText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceSummary}>
          <View>
            <Text style={styles.priceCaption}>Giá mỗi người</Text>

            <Text style={styles.priceValue}>
              {(trip.pricePerPerson ?? 2850000).toLocaleString("vi-VN")} đ
            </Text>
          </View>

          <Text style={styles.slotWarning}>Chỉ còn {availableSlots} chỗ</Text>
        </View>

        <TouchableOpacity
          style={styles.bookingButton}
          activeOpacity={0.85}
          onPress={() => {
            if (isAlreadyBooked) {
              router.replace("/(tabs)/trips" as Href);
              return;
            }

            setBookingVisible(true);
          }}
        >
          <Ionicons
            name={isAlreadyBooked ? "checkmark-circle" : "ticket-outline"}
            size={21}
            color={Colors.onPrimary}
          />

          <Text style={styles.bookingButtonText}>
            {isAlreadyBooked
              ? "Đã đặt chỗ · Xem chuyến của tôi"
              : "Đặt tour ngay"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.policyText}>
          Bạn có thể xem lại chính sách hoàn hủy trước khi xác nhận thanh toán.
        </Text>
      </ScrollView>

      <BookingModal
        visible={bookingVisible}
        trip={trip}
        onClose={() => setBookingVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh,
    backgroundColor: Colors.surface,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceContainer,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.onSurface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    minHeight: 230,
    padding: 18,
    borderRadius: Radius.xl,
    overflow: "hidden",
    backgroundColor: Colors.primaryPale,
    justifyContent: "space-between",
    ...Shadows.hover,
  },
  heroDecorOne: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -70,
    backgroundColor: Colors.primary,
    opacity: 0.2,
  },
  heroDecorTwo: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    left: -50,
    bottom: -95,
    backgroundColor: Colors.primaryDark,
    opacity: 0.12,
  },
  heroBadges: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  publicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryContainer,
  },
  publicBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0c2000",
  },
  slotBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  slotBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  heroContent: {
    maxWidth: "90%",
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.primaryDark,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    color: Colors.inkDeep,
  },
  heroMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroMetaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.onSurfaceVariant,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  statValue: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: "900",
    color: Colors.onSurface,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    color: Colors.onSurfaceVariant,
  },
  sectionCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.onSurface,
    marginBottom: 13,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  leaderAvatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryContainer,
  },
  leaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.onSurface,
  },
  leaderRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  leaderRating: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  leaderBadgeText: {
    flex: 1,
    fontSize: 10,
    color: Colors.onSurfaceVariant,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryPale,
  },
  weatherStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },
  weatherStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  weatherIconBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.tertiaryFixed,
  },
  weatherMain: {
    flex: 1,
    marginLeft: 12,
  },
  weatherTemp: {
    fontSize: 21,
    fontWeight: "900",
    color: Colors.onSurface,
  },
  weatherCondition: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  weatherDetails: {
    alignItems: "flex-end",
    gap: 4,
  },
  weatherDetailText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  noticeBox: {
    marginTop: 13,
    flexDirection: "row",
    gap: 8,
    padding: 11,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.onSurfaceVariant,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineMarker: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryContainer,
  },
  timelineNumber: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.onPrimary,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 11,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  timelineText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.onSurfaceVariant,
  },
  timelineLine: {
    width: 2,
    height: 18,
    marginLeft: 13,
    marginVertical: 4,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  includedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.secondaryContainer,
  },
  includedText: {
    flex: 1,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  priceSummary: {
    marginTop: 16,
    paddingHorizontal: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  priceCaption: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  priceValue: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "900",
    color: Colors.primaryDark,
  },
  slotWarning: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8a5a00",
  },
  bookingButton: {
    height: 54,
    marginTop: 14,
    borderRadius: Radius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primaryContainer,
    ...Shadows.hover,
  },
  bookingButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.onPrimary,
  },
  policyText: {
    marginTop: 10,
    paddingHorizontal: 16,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 15,
    color: Colors.onSurfaceMuted,
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "900",
    color: Colors.onSurface,
  },
  emptyDescription: {
    marginTop: 7,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.onSurfaceVariant,
  },
  primaryButton: {
    marginTop: 20,
    minWidth: 160,
    height: 48,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryContainer,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.onPrimary,
  },
});
