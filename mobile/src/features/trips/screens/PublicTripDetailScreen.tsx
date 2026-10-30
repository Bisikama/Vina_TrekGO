import {
  Button,
  ErrorAlert,
  LoadingState,
  ScreenHeader,
} from "@/components/ui";
import {
  Colors as UiColors,
  Radius as UiRadius,
  Spacing as UiSpacing,
  Typography,
  formatVnd,
} from "@/constants/designTokens";
import { useAuth } from "@/features/auth/AuthContext";
import { BookingParticipantsModal } from "@/features/bookings/components";
import { bookingApiService } from "@/features/bookings/services/booking.api";
import type { BookingDetail, BookingSummary } from "@/features/bookings/types";
import {
  invitationsApiService,
  type PersonalTicket,
} from "@/features/invitations";
import {
  TripConfirmedBookingCard,
  TripCostBreakdown,
  TripDescriptionSection,
  TripHeroSection,
  TripLeaderInfo,
  TripPickupInfo,
  TripRouteTimeline,
} from "@/features/trips/components";
import { usePublicTripDetail } from "@/features/trips/hooks";
import { isRegistrationNotOpenYet } from "@/features/trips/services/public-trips.api";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface PublicTripDetailScreenProps {
  tripId: string;
}

export function PublicTripDetailScreen({
  tripId,
}: PublicTripDetailScreenProps) {
  const router = useRouter();
  const { accessToken } = useAuth();

  const {
    trip,
    loading,
    error,
    refetch,
  } = usePublicTripDetail(tripId, accessToken);

  const [bookingVisible, setBookingVisible] = useState(false);
  const [existingBooking, setExistingBooking] = useState<BookingSummary | BookingDetail | null>(null);
  const [existingTicket, setExistingTicket] = useState<PersonalTicket | null>(null);

  // Khi màn hình được focus, đồng bộ lại đặt chỗ hoặc vé cá nhân của người dùng đối với chuyến này
  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !tripId) return;
      let active = true;

      Promise.all([
        bookingApiService.listMyBookings({ pageSize: 50 }).catch(() => ({ items: [] })),
        invitationsApiService.fetchMyTickets({ pageSize: 50 }).catch(() => ({ items: [] })),
      ]).then(([bookingRes, ticketRes]) => {
        if (!active) return;
        const matchedBooking = bookingRes.items?.find(
          (b) =>
            (b.trip?.id || (b as any).tripId) === tripId &&
            b.status !== "CANCELLED" &&
            b.status !== "EXPIRED",
        );
        setExistingBooking(matchedBooking ?? null);

        const matchedTicket = ticketRes.items?.find(
          (t) => t.trip?.id === tripId && t.bookingStatus !== "CANCELLED",
        );
        setExistingTicket(matchedTicket ?? null);
      });

      return () => {
        active = false;
      };
    }, [accessToken, tripId]),
  );

  const handleBookingSuccess = useCallback(
    (bookingId: string) => {
      setBookingVisible(false);
      refetch();
      router.push({
        pathname: "/bookings/[id]",
        params: { id: bookingId },
      } as any);
    },
    [refetch, router],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState
          label="Đang tải chuyến đi..."
          style={styles.centerBlock}
        />
      </SafeAreaView>
    );
  }

  const handleSafeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/trips" as any);
    }
  };

  if (error || !trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader onBack={handleSafeBack} title="Chi tiết chuyến" />
        <View style={styles.errorWrap}>
          <ErrorAlert
            title="Không tải được chuyến đi"
            message={error || "Không tìm thấy chuyến đi."}
            onRetry={refetch}
          />
          <Button
            label="Quay lại"
            variant="outline"
            onPress={handleSafeBack}
            fullWidth
            style={{ marginTop: UiSpacing.md }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const registrationNotOpen = isRegistrationNotOpenYet(trip);
  const isBookable =
    trip.status === "OPEN" && trip.remainingSlots > 0 && !registrationNotOpen;
  const isConfirmedBooking =
    existingBooking &&
    ["CONFIRMED", "PARTIAL_CHECKIN", "CHECKED_IN", "COMPLETED"].includes(
      existingBooking.status,
    );
  const hasConfirmedAccess = Boolean(isConfirmedBooking || existingTicket);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top Navigation Bar */}
        <ScreenHeader onBack={handleSafeBack} title="Chi tiết chuyến" />

        {/* 1. Hero Section */}
        <TripHeroSection trip={trip} />

        {/* 2. Thẻ Bạn đã tham gia chuyến đi này! (Hiển thị khi đã đặt vé hoặc được mời vé thành công) */}
        {hasConfirmedAccess && (
          <TripConfirmedBookingCard
            booking={
              existingBooking ?? {
                id: existingTicket!.id,
                status: "CONFIRMED",
                participantCount: 1,
                totalAmount: "0",
                currency: "VND",
                expiresAt: trip.endAt || new Date().toISOString(),
                trip: {
                  id: tripId,
                  title: trip.title,
                  startAt: trip.startAt,
                  endAt: trip.endAt,
                  status: trip.status,
                },
              }
            }
            onViewTicket={() => {
              if (existingBooking) {
                router.push({
                  pathname: "/bookings/[id]",
                  params: { id: existingBooking.id },
                } as any);
              } else if (existingTicket) {
                router.push({
                  pathname: "/trips/[id]/ticket",
                  params: { id: existingTicket.id },
                } as any);
              }
            }}
            onViewAllTrips={() => router.push("/(tabs)/trips" as any)}
          />
        )}

        {/* 3. Giới thiệu & Kế hoạch chuyến đi (Matching Web) */}
        <TripDescriptionSection
          description={trip.description}
          tripTitle={trip.title}
          destinationName={trip.destination?.name ?? ""}
        />

        {/* 4. Leader Info */}
        <TripLeaderInfo leader={trip.leader} />

        {/* 5. Pickup Point */}
        <TripPickupInfo pickup={trip.pickup} startAt={trip.startAt} />

        {/* 6. Route Timeline & Checkpoints */}
        <TripRouteTimeline
          routes={trip.routes}
          checkpoints={trip.checkpoints}
        />

        {/* 7. Transparent Cost Breakdown (TG-PTR-PRICING-01) */}
        <TripCostBreakdown currency={trip.currency} />

        {/* Bottom padding for fixed bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarPrice}>
          <Text style={styles.bottomPriceLabel}>Giá vé / người</Text>
          <Text style={[styles.bottomPriceValue, Typography.tabularNums]}>
            {(trip.currency || "VND") === "VND"
              ? formatVnd(trip.pricePerPax)
              : `${parseFloat(trip.pricePerPax) || 0} ${trip.currency}`}
          </Text>
          <Text style={[styles.bottomSlots, Typography.tabularNums]}>
            Còn {trip.remainingSlots} chỗ
          </Text>
        </View>

        {/* Dynamic Booking Button */}
        {isConfirmedBooking ? (
          <TouchableOpacity
            style={[styles.bookingBtn, styles.bookingBtnConfirmed]}
            onPress={() =>
              router.push({
                pathname: "/bookings/[id]",
                params: { id: existingBooking.id },
              } as any)
            }
            activeOpacity={0.85}
          >
            <Ionicons name="ticket-outline" size={18} color="#ffffff" />
            <Text style={styles.bookingBtnText}>Xem chi tiết vé</Text>
          </TouchableOpacity>
        ) : existingTicket ? (
          <TouchableOpacity
            style={[styles.bookingBtn, styles.bookingBtnConfirmed]}
            onPress={() =>
              router.push({
                pathname: "/trips/[id]/ticket",
                params: { id: existingTicket.id },
              } as any)
            }
            activeOpacity={0.85}
          >
            <Ionicons name="ticket-outline" size={18} color="#ffffff" />
            <Text style={styles.bookingBtnText}>Xem vé tham gia & QR</Text>
          </TouchableOpacity>
        ) : existingBooking?.status === "PENDING_PAYMENT" ? (
          <TouchableOpacity
            style={[styles.bookingBtn, styles.bookingBtnPending]}
            onPress={() =>
              router.push({
                pathname: "/bookings/[id]",
                params: { id: existingBooking.id },
              } as any)
            }
            activeOpacity={0.85}
          >
            <Ionicons name="card-outline" size={18} color="#ffffff" />
            <Text style={styles.bookingBtnText}>Tiếp tục thanh toán</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.bookingBtn, !isBookable && styles.bookingBtnDisabled]}
            onPress={() => {
              if (!accessToken) {
                Alert.alert("Chưa đăng nhập", "Vui lòng đăng nhập để đặt chỗ.");
                return;
              }
              setBookingVisible(true);
            }}
            disabled={!isBookable}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
            <Text style={styles.bookingBtnText}>
              {isBookable
                ? "Đặt chỗ ngay"
                : trip.remainingSlots <= 0
                  ? "Hết chỗ"
                  : registrationNotOpen
                    ? "Chưa tới hạn đăng ký"
                    : "Đã đóng đăng ký"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Booking Modal */}
      {accessToken && bookingVisible && (
        <BookingParticipantsModal
          visible={bookingVisible}
          trip={trip as any}
          onClose={() => setBookingVisible(false)}
          onSuccess={handleBookingSuccess}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: UiColors.canvas },
  centerBlock: { flex: 1, justifyContent: "center" },
  errorWrap: { padding: UiSpacing.lg },
  scrollContent: { paddingBottom: UiSpacing.xl },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: UiSpacing.lg,
    paddingVertical: UiSpacing.md,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    backgroundColor: UiColors.surface,
    borderTopWidth: 1,
    borderTopColor: UiColors.border,
  },
  bottomBarPrice: { flex: 1, gap: 1 },
  bottomPriceLabel: {
    fontSize: 10,
    color: UiColors.textSecondary,
    fontWeight: "600",
  },
  bottomPriceValue: {
    fontSize: 19,
    fontWeight: "800",
    color: UiColors.primaryDeep,
  },
  bottomSlots: {
    fontSize: 11,
    color: UiColors.primary,
    fontWeight: "600",
  },
  bookingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: UiRadius.pill,
    backgroundColor: UiColors.primaryDeep,
  },
  bookingBtnDisabled: { opacity: 0.5 },
  bookingBtnConfirmed: {
    backgroundColor: UiColors.successText,
  },
  bookingBtnPending: {
    backgroundColor: UiColors.accent,
  },
  bookingBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});
