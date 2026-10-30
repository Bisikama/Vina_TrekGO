import { Ionicons } from "@expo/vector-icons";
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TopHeader } from "@/components/TopHeader";
import { TripPrepModal } from "@/components/TripPrepModal";
import { EmptyState, LoadingState } from "@/components/ui";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import { BookingCard } from "@/features/bookings/components";
import { useMyBookings } from "@/features/bookings/hooks";
import { DirectInviteCard } from "@/features/private-trips/components/DirectInviteCard";
import { PrivateTripCard } from "@/features/private-trips/components/PrivateTripCard";
import { useMyPrivateTrips } from "@/features/private-trips/hooks/useMyPrivateTrips";
import { useMyReceivedInvitations } from "@/features/private-trips/hooks/useMyReceivedInvitations";
import { TripCard } from "@/features/trips/components";
import { usePublicTrips } from "@/features/trips/hooks";
import { useMyTickets } from "@/features/invitations";

type MainTab = "MY_TRIPS" | "PUBLIC_TRIPS";
type TripFilter = "UPCOMING" | "PENDING" | "HISTORY" | "PRIVATE" | "INVITATIONS";

const DIFFICULTY_OPTIONS = ["Tất cả", "EASY", "MEDIUM", "HARD", "EXTREME"];
const DIFFICULTY_LABELS: Record<string, string> = {
  "Tất cả": "Tất cả",
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
  EXTREME: "Thách thức",
};

const completedTrip = {
  id: "trip-bidoup-completed",
  name: "Bidoup – Núi Bà (2N1Đ)",
  destination: "Lạc Dương, Lâm Đồng",
  date: "18 – 19 Tháng 08, 2026",
  duration: "2 ngày 1 đêm",
  leader: "Leader Hoàng Nam",
  distance: "27 km",
  elevation: "2.287 m",
  members: 11,
  reviewed: false,
};

export default function TripsScreen() {
  const router = useRouter();
  const { activeTrip, user } = useApp();
  const { user: authUser, accessToken } = useAuth();
  const isLeader = authUser?.role === "LEADER" || user?.role === "LEADER";

  const [mainTab, setMainTab] = useState<MainTab>("MY_TRIPS");
  const [publicSearch, setPublicSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("Tất cả");

  // Real backend bookings & public trips & private trips
  const {
    bookings,
    isLoading: loadingBookings,
    refetch: refetchBookings,
  } = useMyBookings();

  const {
    trips: backendPrivateTrips,
    loading: loadingPrivateTrips,
    refetch: refetchPrivateTrips,
  } = useMyPrivateTrips(true);

  const {
    invitations: receivedInvitations,
    loading: loadingInvitations,
    acceptingId,
    decliningId,
    refetch: refetchInvitations,
    accept: acceptInvitation,
    decline: declineInvitation,
  } = useMyReceivedInvitations();

  const {
    trips: publicTripsList,
    loading: loadingPublicTrips,
    loadingMore: loadingMorePublicTrips,
    refresh: refreshPublicTrips,
    loadMore: loadMorePublicTrips,
  } = usePublicTrips({ pageSize: 50 });

  const {
    tickets: myTickets,
    loading: loadingTickets,
    refetch: refetchTickets,
  } = useMyTickets();

  // Tải thêm trang kế tiếp khi cuộn gần đáy (chỉ áp dụng cho tab PUBLIC_TRIPS)
  const loadMoreLockRef = useRef(false);
  const handlePublicTripsScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (mainTab !== "PUBLIC_TRIPS") return;
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromEnd =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceFromEnd > 600 || loadMoreLockRef.current) return;
      loadMoreLockRef.current = true;
      void loadMorePublicTrips().finally(() => {
        loadMoreLockRef.current = false;
      });
    },
    [mainTab, loadMorePublicTrips],
  );

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchBookings(),
      refreshPublicTrips(),
      refetchPrivateTrips(),
      refetchInvitations(),
      refetchTickets(),
    ]);
    setRefreshing(false);
  }, [refetchBookings, refreshPublicTrips, refetchPrivateTrips, refetchInvitations, refetchTickets]);

  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();

  // Synchronize URL search params if navigated from Home shortcuts
  useEffect(() => {
    if (params.tab === "PUBLIC_TRIPS") {
      setMainTab("PUBLIC_TRIPS");
    } else if (params.tab === "MY_TRIPS") {
      setMainTab("MY_TRIPS");
    }

    if (params.filter === "PRIVATE") {
      setActiveFilter("PRIVATE");
    } else if (params.filter === "INVITATIONS") {
      setActiveFilter("INVITATIONS");
    } else if (params.filter === "UPCOMING") {
      setActiveFilter("UPCOMING");
    } else if (params.filter === "PENDING") {
      setActiveFilter("PENDING");
    } else if (params.filter === "HISTORY") {
      setActiveFilter("HISTORY");
    }
  }, [params.tab, params.filter]);

  // Refetch private trips, bookings, invitations & tickets automatically on focus
  useFocusEffect(
    useCallback(() => {
      void refetchBookings();
      void refetchPrivateTrips();
      void refetchInvitations();
      void refetchTickets();
      if (params.tab === "PUBLIC_TRIPS") {
        setMainTab("PUBLIC_TRIPS");
      } else if (params.tab === "MY_TRIPS") {
        setMainTab("MY_TRIPS");
      }
      if (params.filter === "PRIVATE") {
        setActiveFilter("PRIVATE");
      } else if (params.filter === "INVITATIONS") {
        setActiveFilter("INVITATIONS");
      }
    }, [refetchBookings, refetchPrivateTrips, refetchInvitations, refetchTickets, params.tab, params.filter]),
  );

  const displayedPublicTrips = useMemo(() => {
    return publicTripsList.filter((t) => {
      const matchesSearch =
        !publicSearch.trim() ||
        t.title.toLowerCase().includes(publicSearch.toLowerCase()) ||
        (t.destination?.name || "").toLowerCase().includes(publicSearch.toLowerCase());

      const tripDiff = t.routes?.[0]?.snapshotDifficulty;
      const matchesDifficulty =
        selectedDifficulty === "Tất cả" || tripDiff === selectedDifficulty;

      return matchesSearch && matchesDifficulty;
    });
  }, [publicTripsList, publicSearch, selectedDifficulty]);

  // Split bookings by status
  const pendingBookings = useMemo(
    () => bookings.filter((b) => b.status === "PENDING_PAYMENT"),
    [bookings],
  );

  const confirmedBookings = useMemo(
    () =>
      bookings.filter((b) =>
        ["CONFIRMED", "CHECKED_IN", "PARTIAL_CHECKIN"].includes(b.status),
      ),
    [bookings],
  );

  const historyBookings = useMemo(
    () =>
      bookings.filter((b) =>
        ["COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW"].includes(b.status),
      ),
    [bookings],
  );

  // Vé cá nhân nhận từ người khác hoặc tự claim (loại trừ nếu chính user là buyer của booking đó để tránh trùng lặp)
  const companionTickets = useMemo(() => {
    return myTickets.filter((ticket) => {
      const tripId = ticket.trip?.id;
      const alreadyInBookings = bookings.some(
        (b) => (b.trip?.id || (b as any).tripId) === tripId,
      );
      const isCancelled = ticket.bookingStatus === "CANCELLED";
      return !alreadyInBookings && !isCancelled;
    });
  }, [myTickets, bookings]);

  const upcomingTickets = useMemo(() => {
    const now = new Date();
    return companionTickets.filter((t) => {
      const endAt = t.trip?.endAt ? new Date(t.trip.endAt) : null;
      const isPast = endAt && !isNaN(endAt.getTime()) && endAt < now;
      return !isPast && t.bookingStatus !== "COMPLETED";
    });
  }, [companionTickets]);

  const historyTickets = useMemo(() => {
    return companionTickets.filter((t) => !upcomingTickets.includes(t));
  }, [companionTickets, upcomingTickets]);

  // Private trips lấy trực tiếp từ backend API (bỏ merge mock từ AppContext)
  const privateTrips = backendPrivateTrips;

  // Split private trips by status (Tất cả chuyến riêng chưa hoàn thành/chưa hủy đều thuộc chuyến sắp tới)
  const upcomingPrivateTrips = useMemo(
    () =>
      privateTrips.filter((t) => {
        const s = (t.status || "").toUpperCase();
        return s !== "COMPLETED" && s !== "CANCELLED";
      }),
    [privateTrips],
  );

  const historyPrivateTrips = useMemo(
    () =>
      privateTrips.filter((t) => {
        const s = (t.status || "").toUpperCase();
        return s === "COMPLETED" || s === "CANCELLED";
      }),
    [privateTrips],
  );

  const pendingInvitations = useMemo(
    () => receivedInvitations.filter((inv) => inv.status === "PENDING"),
    [receivedInvitations],
  );

  const [activeFilter, setActiveFilter] = useState<TripFilter>(
    pendingBookings.length > 0 ? "PENDING" : "UPCOMING",
  );

  const [prepModalVisible, setPrepModalVisible] = useState(false);

  function openTripDetail(tripId: string) {
    router.push({
      pathname: "/trips/[id]",
      params: {
        id: tripId,
      },
    } as unknown as Href);
  }

  function openTicket() {
    router.push({
      pathname: "/trips/[id]/ticket",
      params: {
        id: activeTrip.id,
      },
    } as unknown as Href);
  }

  function openReview() {
    router.push({
      pathname: "/trips/[id]/review",
      params: {
        id: completedTrip.id,
        name: completedTrip.name,
        leader: completedTrip.leader,
        date: completedTrip.date,
      },
    } as unknown as Href);
  }

  function renderFilters() {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.subFilterRow}
      >
        <TouchableOpacity
          style={[
            styles.subFilterChip,
            activeFilter === "UPCOMING" && styles.subFilterChipActive,
          ]}
          onPress={() => setActiveFilter("UPCOMING")}
        >
          <Text
            style={[
              styles.subFilterText,
              activeFilter === "UPCOMING" && styles.subFilterTextActive,
            ]}
          >
            Sắp tới
          </Text>

          {confirmedBookings.length + upcomingTickets.length + upcomingPrivateTrips.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {confirmedBookings.length + upcomingTickets.length + upcomingPrivateTrips.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subFilterChip,
            activeFilter === "PENDING" && styles.subFilterChipActive,
            pendingBookings.length > 0 && { borderColor: "#D97706", borderWidth: 1 },
          ]}
          onPress={() => setActiveFilter("PENDING")}
        >
          <Text
            style={[
              styles.subFilterText,
              activeFilter === "PENDING" && styles.subFilterTextActive,
            ]}
          >
            Chờ thanh toán
          </Text>

          {pendingBookings.length > 0 && (
            <View style={styles.pendingCountBadge}>
              <Text style={styles.pendingCountBadgeText}>
                {pendingBookings.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subFilterChip,
            { backgroundColor: "#E0F2F1", borderColor: "#80CBC4", borderWidth: 1, gap: 5 },
          ]}
          onPress={() => router.push("/invitations" as any)}
        >
          <Ionicons name="mail-unread-outline" size={14} color={Colors.primary} />
          <Text style={[styles.subFilterText, { color: Colors.primary, fontWeight: "800" }]}>
            Lời mời vé
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subFilterChip,
            { backgroundColor: Colors.primaryPale, gap: 5 },
          ]}
          onPress={() => setMainTab("PUBLIC_TRIPS")}
        >
          <Ionicons
            name="compass"
            size={14}
            color={Colors.primaryDark}
          />
          <Text
            style={[
              styles.subFilterText,
              { color: Colors.primaryDark, fontWeight: "700" },
            ]}
          >
            Khám phá Public Trip
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subFilterChip,
            activeFilter === "HISTORY" && styles.subFilterChipActive,
          ]}
          onPress={() => setActiveFilter("HISTORY")}
        >
          <Text
            style={[
              styles.subFilterText,
              activeFilter === "HISTORY" && styles.subFilterTextActive,
            ]}
          >
            Lịch sử đã đi
          </Text>

          {historyBookings.length + historyTickets.length + historyPrivateTrips.length > 0 && (
            <View style={styles.historyCountBadge}>
              <Text style={styles.historyCountBadgeText}>
                {historyBookings.length + historyTickets.length + historyPrivateTrips.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subFilterChip,
            activeFilter === "PRIVATE" && styles.subFilterChipActive,
            activeFilter !== "PRIVATE" && { backgroundColor: Colors.tertiaryFixed },
            { gap: 5 },
          ]}
          onPress={() => setActiveFilter("PRIVATE")}
        >
          <Ionicons
            name="lock-closed"
            size={13}
            color={activeFilter === "PRIVATE" ? Colors.onPrimary : "#564500"}
          />
          <Text
            style={[
              styles.subFilterText,
              activeFilter === "PRIVATE" && styles.subFilterTextActive,
              activeFilter !== "PRIVATE" && { color: "#564500", fontWeight: "700" },
            ]}
          >
            Chuyến riêng
          </Text>
          {privateTrips.length > 0 && (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor:
                    activeFilter === "PRIVATE"
                      ? "rgba(255,255,255,0.3)"
                      : "#564500",
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                },
              ]}
            >
              <Text style={[styles.countBadgeText, { fontSize: 10 }]}>
                {privateTrips.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subFilterChip,
            activeFilter === "INVITATIONS" && styles.subFilterChipActive,
            activeFilter !== "INVITATIONS" && { backgroundColor: Colors.secondaryContainer },
            pendingInvitations.length > 0 && { borderColor: Colors.secondary, borderWidth: 1 },
            { gap: 5 },
          ]}
          onPress={() => setActiveFilter("INVITATIONS")}
        >
          <Ionicons
            name="mail"
            size={13}
            color={activeFilter === "INVITATIONS" ? Colors.onPrimary : Colors.secondary}
          />
          <Text
            style={[
              styles.subFilterText,
              activeFilter === "INVITATIONS" && styles.subFilterTextActive,
              activeFilter !== "INVITATIONS" && { color: Colors.secondary, fontWeight: "700" },
            ]}
          >
            Hộp thư mời
          </Text>
          {pendingInvitations.length > 0 && (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor:
                    activeFilter === "INVITATIONS"
                      ? "rgba(255,255,255,0.3)"
                      : Colors.secondary,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                },
              ]}
            >
              <Text style={[styles.countBadgeText, { fontSize: 10 }]}>
                {pendingInvitations.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subFilterChip,
            { backgroundColor: Colors.surfaceContainer, gap: 5 },
          ]}
          onPress={() => router.push("/bookings" as any)}
        >
          <Ionicons name="ticket" size={13} color={Colors.primaryDark} />
          <Text style={[styles.subFilterText, { color: Colors.primaryDark, fontWeight: "700" }]}>
            Tất cả vé
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderUpcomingTrips() {
    const hasUpcoming =
      confirmedBookings.length > 0 ||
      upcomingTickets.length > 0 ||
      upcomingPrivateTrips.length > 0;

    if (!hasUpcoming) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="calendar-outline"
              size={34}
              color={Colors.primaryDark}
            />
          </View>

          <Text style={styles.emptyTitle}>Chưa có chuyến đi sắp tới</Text>

          <Text style={styles.emptyDescription}>
            Hãy khám phá các chuyến đi công khai đang mở bán hoặc tổ chức chuyến đi riêng cùng bạn bè!
          </Text>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setMainTab("PUBLIC_TRIPS")}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>Khám phá chuyến mở bán</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createTripBanner, { marginTop: 24 }]}
            onPress={() => router.push("/private-trips/create" as any)}
            activeOpacity={0.85}
          >
            <View style={styles.createTripIcon}>
              <Ionicons name="add" size={24} color={Colors.onPrimary} />
            </View>

            <View style={styles.flexOne}>
              <Text style={styles.createTripTitle}>Tổ chức chuyến đi riêng</Text>

              <Text style={styles.createTripSub}>
                Chọn cung đường và tạo mã mời riêng tư cho nhóm bạn
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.primaryDark}
            />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 16 }}>
        {/* Nhóm Chuyến đi công khai (Public Trips & Vé tham gia) */}
        {(confirmedBookings.length > 0 || upcomingTickets.length > 0) && (
          <View style={{ marginBottom: 16 }}>
            {upcomingPrivateTrips.length > 0 && (
              <View style={styles.upcomingSectionHeader}>
                <Ionicons name="compass-outline" size={16} color={Colors.primaryDark} />
                <Text style={styles.upcomingSectionTitle}>Chuyến đi công khai</Text>
                <View style={styles.upcomingSectionBadge}>
                  <Text style={styles.upcomingSectionBadgeText}>
                    {confirmedBookings.length + upcomingTickets.length}
                  </Text>
                </View>
              </View>
            )}

            {/* 1. Các đơn đặt chỗ chính chủ (Buyer) */}
            {confirmedBookings.map((b) => {
              const tripId = b.trip?.id || (b as any).tripId;
              return (
                <View key={b.id} style={{ marginBottom: 14 }}>
                  <BookingCard
                    booking={b}
                    onPress={() => {
                      if (tripId) {
                        router.push({
                          pathname: "/trips/[id]",
                          params: { id: tripId },
                        } as any);
                      } else {
                        router.push({
                          pathname: "/bookings/[id]",
                          params: { id: b.id },
                        } as any);
                      }
                    }}
                  />
                </View>
              );
            })}

            {/* 2. Các vé tham gia được bạn bè mời & đã chấp nhận (Companion) */}
            {upcomingTickets.map((ticket) => {
              const trip = ticket.trip;
              const tripId = trip?.id;
              const startDate = trip?.startAt ? new Date(trip.startAt) : null;
              const formattedDate =
                startDate && !isNaN(startDate.getTime())
                  ? startDate.toLocaleDateString("vi-VN", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "Chưa xác định";

              return (
                <TouchableOpacity
                  key={`ticket-${ticket.id}`}
                  style={[styles.companionTicketCard, Shadows.card]}
                  activeOpacity={0.88}
                  onPress={() => {
                    router.push({
                      pathname: "/trips/[id]/ticket",
                      params: { id: ticket.id },
                    } as any);
                  }}
                >
                  <View style={styles.ticketCardHeader}>
                    <View style={styles.ticketBadge}>
                      <Ionicons name="ticket" size={13} color="#00796B" />
                      <Text style={styles.ticketBadgeText}>VÉ THAM GIA · ĐƯỢC MỜI</Text>
                    </View>
                    <View style={styles.ticketStatusBadge}>
                      <Ionicons
                        name={ticket.checkinStatus === "CHECKED_IN" ? "checkmark-circle" : "qr-code"}
                        size={12}
                        color={ticket.checkinStatus === "CHECKED_IN" ? "#16A34A" : Colors.primaryDark}
                      />
                      <Text
                        style={[
                          styles.ticketStatusText,
                          ticket.checkinStatus === "CHECKED_IN" && { color: "#16A34A" },
                        ]}
                      >
                        {ticket.checkinStatus === "CHECKED_IN" ? "Đã điểm danh" : "Sẵn sàng QR"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.ticketTripTitle} numberOfLines={2}>
                    {trip?.title || "Chuyến đi công khai"}
                  </Text>

                  <View style={styles.ticketMetaRow}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.primaryDark} />
                    <Text style={styles.ticketMetaText}>{formattedDate}</Text>
                  </View>

                  {trip?.destination?.name ? (
                    <View style={styles.ticketMetaRow}>
                      <Ionicons name="location-outline" size={14} color={Colors.primaryDark} />
                      <Text style={styles.ticketMetaText} numberOfLines={1}>
                        {trip.destination.name}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.ticketCardFooter}>
                    <Text style={styles.ticketMemberLabel}>
                      Thành viên: <Text style={styles.ticketMemberName}>{ticket.participantName || "Bạn"}</Text>
                    </Text>
                    <View style={styles.ticketViewAction}>
                      <Text style={styles.ticketViewActionText}>Mở vé & QR điểm danh</Text>
                      <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Nhóm Chuyến đi riêng tư (Private Trips) */}
        {upcomingPrivateTrips.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            {confirmedBookings.length > 0 && (
              <View style={styles.upcomingSectionHeader}>
                <Ionicons name="lock-closed" size={15} color="#854d0e" />
                <Text style={[styles.upcomingSectionTitle, { color: "#854d0e" }]}>
                  Chuyến đi riêng tư
                </Text>
                <View style={[styles.upcomingSectionBadge, { backgroundColor: "#fef9c3" }]}>
                  <Text style={[styles.upcomingSectionBadgeText, { color: "#854d0e" }]}>
                    {upcomingPrivateTrips.length}
                  </Text>
                </View>
              </View>
            )}
            {upcomingPrivateTrips.map((pt) => (
              <View key={pt.id} style={{ marginBottom: 14 }}>
                <PrivateTripCard
                  trip={pt}
                  onPress={() => {
                    if (pt.id.startsWith("trip-")) {
                      openTripDetail(pt.id);
                    } else {
                      router.push({
                        pathname: "/private-trips/[id]",
                        params: { id: pt.id },
                      } as any);
                    }
                  }}
                />
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.createTripBanner}
          onPress={() => router.push("/private-trips/create" as any)}
          activeOpacity={0.85}
        >
          <View style={styles.createTripIcon}>
            <Ionicons name="add" size={24} color={Colors.onPrimary} />
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.createTripTitle}>Tổ chức chuyến đi riêng</Text>

            <Text style={styles.createTripSub}>
              Chọn cung đường và tạo mã mời riêng tư cho nhóm bạn
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors.primaryDark}
          />
        </TouchableOpacity>
      </View>
    );
  }

  function renderPendingTrips() {
    if (pendingBookings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="time-outline"
              size={34}
              color={Colors.primaryDark}
            />
          </View>

          <Text style={styles.emptyTitle}>Không có đơn chờ thanh toán</Text>

          <Text style={styles.emptyDescription}>
            Tất cả các đơn đặt chỗ của bạn đã được thanh toán hoặc chưa có đơn giữ chỗ nào.
          </Text>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setMainTab("PUBLIC_TRIPS")}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>Khám phá chuyến mở bán</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 16 }}>
        <View style={styles.pendingHeaderNotice}>
          <Ionicons name="alert-circle" size={18} color="#D97706" />
          <Text style={styles.pendingHeaderNoticeText}>
            Bạn có {pendingBookings.length} đơn giữ chỗ đang chờ thanh toán. Vui lòng hoàn tất thanh toán trước khi hết hạn!
          </Text>
        </View>

        {pendingBookings.map((b) => (
          <View key={b.id} style={{ marginBottom: 14 }}>
            <BookingCard
              booking={b}
              onPress={() =>
                router.push({
                  pathname: "/bookings/[id]",
                  params: { id: b.id },
                } as any)
              }
            />
          </View>
        ))}
      </View>
    );
  }

  function renderPublicTripsTab() {
    return (
      <View style={{ flex: 1 }}>
        {/* Leader Create Public Trip Banner (If Leader) */}
        {isLeader && (
          <TouchableOpacity
            style={styles.leaderCreateBanner}
            onPress={() =>
              router.push("/field-operations/leader-create-trip" as any)
            }
            activeOpacity={0.88}
          >
            <View style={styles.leaderCreateIconBox}>
              <Ionicons name="add" size={22} color={Colors.onPrimary} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.leaderCreateTitle}>Tạo Public Trip mới</Text>
              <Text style={styles.leaderCreateSub}>
                Khảo sát cung đường, thiết lập mốc GPS và mở bán vé cho cộng đồng
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.primaryDark}
            />
          </TouchableOpacity>
        )}

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={18}
              color={Colors.onSurfaceVariant}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm chuyến, địa danh..."
              placeholderTextColor={Colors.mute}
              value={publicSearch}
              onChangeText={setPublicSearch}
            />
            {publicSearch.length > 0 && (
              <TouchableOpacity onPress={() => setPublicSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={Colors.mute} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Difficulty Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.difficultyRow}
        >
          {DIFFICULTY_OPTIONS.map((d) => {
            const active = selectedDifficulty === d;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.diffChip, active && styles.diffChipActive]}
                onPress={() => setSelectedDifficulty(d)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.diffChipText,
                    active && styles.diffChipTextActive,
                  ]}
                >
                  {DIFFICULTY_LABELS[d] || d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Results Counter & Reset Filter */}
        <View style={styles.resultCountRow}>
          <Text style={styles.resultCountText}>
            {loadingPublicTrips
              ? "Đang tải chuyến công khai..."
              : `Có ${displayedPublicTrips.length} chuyến mở bán`}
          </Text>
          {(selectedDifficulty !== "Tất cả" || publicSearch.trim().length > 0) && (
            <TouchableOpacity
              onPress={() => {
                setSelectedDifficulty("Tất cả");
                setPublicSearch("");
              }}
            >
              <Text style={styles.resetFilterText}>Xóa bộ lọc</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Trips List / Empty / Loading */}
        {loadingPublicTrips && publicTripsList.length === 0 ? (
          <LoadingState
            label="Đang tải danh sách chuyến đi mở bán..."
            style={{ paddingVertical: 40 }}
          />
        ) : displayedPublicTrips.length === 0 ? (
          <EmptyState
            icon={
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="compass-outline"
                  size={34}
                  color={Colors.primaryDark}
                />
              </View>
            }
            title="Không tìm thấy chuyến đi phù hợp"
            description={
              publicSearch.trim() || selectedDifficulty !== "Tất cả"
                ? "Thử thay đổi từ khóa tìm kiếm hoặc chọn mức độ khó khác."
                : "Hiện tại chưa có chuyến đi công khai nào đang mở bán."
            }
          />
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {displayedPublicTrips.map((pt) => (
              <TripCard
                key={pt.id}
                trip={pt}
                onPress={() => openTripDetail(pt.id)}
              />
            ))}
            {loadingMorePublicTrips && (
              <ActivityIndicator
                style={{ marginVertical: 16 }}
                color={Colors.primaryDark}
              />
            )}
          </View>
        )}
      </View>
    );
  }

  function renderHistory() {
    const hasHistory =
      historyBookings.length > 0 ||
      historyTickets.length > 0 ||
      historyPrivateTrips.length > 0;

    if (!hasHistory) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="file-tray-outline"
              size={34}
              color={Colors.primaryDark}
            />
          </View>

          <Text style={styles.emptyTitle}>Chưa có lịch sử chuyến đi</Text>

          <Text style={styles.emptyDescription}>
            Các chuyến đi đã hoàn thành hoặc đã hủy sẽ được lưu trữ tại đây.
          </Text>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setMainTab("PUBLIC_TRIPS")}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>Khám phá chuyến mở bán</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 16 }}>
        {historyBookings.map((b) => {
          const tripId = b.trip?.id || (b as any).tripId;
          return (
            <View key={b.id} style={{ marginBottom: 14 }}>
              <BookingCard
                booking={b}
                onPress={() => {
                  if (tripId) {
                    router.push({
                      pathname: "/trips/[id]",
                      params: { id: tripId },
                    } as any);
                  } else {
                    router.push({
                      pathname: "/bookings/[id]",
                      params: { id: b.id },
                    } as any);
                  }
                }}
              />
            </View>
          );
        })}

        {historyTickets.map((ticket) => (
          <TouchableOpacity
            key={`ticket-hist-${ticket.id}`}
            style={[styles.companionTicketCard, { borderColor: Colors.surfaceContainerHigh }]}
            activeOpacity={0.88}
            onPress={() => {
              router.push({
                pathname: "/trips/[id]/ticket",
                params: { id: ticket.id },
              } as any);
            }}
          >
            <View style={styles.ticketCardHeader}>
              <View style={[styles.ticketBadge, { backgroundColor: Colors.surfaceContainerLow }]}>
                <Ionicons name="ticket" size={13} color={Colors.onSurfaceVariant} />
                <Text style={[styles.ticketBadgeText, { color: Colors.onSurfaceVariant }]}>
                  VÉ THAM GIA
                </Text>
              </View>
              <Text style={[styles.ticketStatusText, { color: Colors.mute }]}>
                {ticket.checkinStatus === "CHECKED_IN" ? "Đã đi" : "Đã kết thúc"}
              </Text>
            </View>
            <Text style={styles.ticketTripTitle} numberOfLines={2}>
              {ticket.trip?.title || "Chuyến đi công khai"}
            </Text>
          </TouchableOpacity>
        ))}

        {historyPrivateTrips.map((pt) => (
          <View key={pt.id} style={{ marginBottom: 14 }}>
            <PrivateTripCard
              trip={pt}
              onPress={() => {
                if (pt.id.startsWith("trip-")) {
                  openTripDetail(pt.id);
                } else {
                  router.push({
                    pathname: "/private-trips/[id]",
                    params: { id: pt.id },
                  } as any);
                }
              }}
            />
          </View>
        ))}
      </View>
    );
  }

  function renderPrivateTrips() {
    if (privateTrips.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="lock-closed-outline"
              size={34}
              color={Colors.primaryDark}
            />
          </View>

          <Text style={styles.emptyTitle}>Chưa có chuyến đi riêng</Text>

          <Text style={styles.emptyDescription}>
            Tổ chức chuyến đi riêng cùng bạn bè hoặc quét mã QR/nhập mã mời để tham gia nhóm!
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push("/private-trips/create" as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyButtonText}>Tạo chuyến đi riêng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.emptyButton,
                { backgroundColor: Colors.surfaceContainerHigh },
              ]}
              onPress={() => router.push("/private-trips" as any)}
              activeOpacity={0.8}
            >
              <Text style={[styles.emptyButtonText, { color: Colors.onSurface }]}>
                Quét QR / Nhập mã
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 16 }}>
        {/* Pending Invitations Banner shortcut */}
        {pendingInvitations.length > 0 && (
          <TouchableOpacity
            style={styles.invitationBanner}
            onPress={() => setActiveFilter("INVITATIONS")}
            activeOpacity={0.88}
          >
            <View style={styles.invitationBannerIcon}>
              <Ionicons name="mail-unread" size={18} color={Colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.invitationBannerTitle}>
                Bạn có {pendingInvitations.length} lời mời tham gia chuyến riêng
              </Text>
              <Text style={styles.invitationBannerSub}>
                Bấm vào để xem và phản hồi tham gia ngay
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.primaryDark} />
          </TouchableOpacity>
        )}

        {/* Quick Action Bar for Private Trips */}
        <View style={styles.privateActionBar}>
          <TouchableOpacity
            style={styles.privateActionBtn}
            onPress={() => router.push("/private-trips/create" as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={18} color={Colors.onPrimary} />
            <Text style={styles.privateActionBtnText}>Tạo chuyến mới</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.privateSecondaryBtn}
            onPress={() => router.push("/private-trips" as any)}
            activeOpacity={0.85}
          >
            <Ionicons
              name="qr-code-outline"
              size={16}
              color={Colors.primaryDark}
            />
            <Text style={styles.privateSecondaryBtnText}>
              Quét QR / Nhập mã
            </Text>
          </TouchableOpacity>
        </View>

        {privateTrips.map((pt) => (
          <View key={pt.id} style={{ marginBottom: 14 }}>
            <PrivateTripCard
              trip={pt}
              onPress={() => {
                if (pt.id.startsWith("trip-")) {
                  openTripDetail(pt.id);
                } else {
                  router.push({
                    pathname: "/private-trips/[id]",
                    params: { id: pt.id },
                  } as any);
                }
              }}
            />
          </View>
        ))}
      </View>
    );
  }

  function renderInvitationsInbox() {
    if (loadingInvitations && receivedInvitations.length === 0) {
      return (
        <View style={[styles.emptyState, { paddingVertical: 40 }]}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={[styles.emptyDescription, { marginTop: 12 }]}>
            Đang tải hộp thư lời mời...
          </Text>
        </View>
      );
    }

    if (receivedInvitations.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="mail-unread-outline"
              size={34}
              color={Colors.primaryDark}
            />
          </View>
          <Text style={styles.emptyTitle}>Hộp thư lời mời trống</Text>
          <Text style={styles.emptyDescription}>
            Khi bạn bè hoặc Host gửi lời mời tham gia chuyến đi riêng tư đến email của bạn, lời mời sẽ hiển thị tại đây.
          </Text>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 16 }}>
        {pendingInvitations.length > 0 && (
          <View style={styles.invitationInboxNotice}>
            <Ionicons name="mail-unread-outline" size={16} color={Colors.primaryDark} />
            <Text style={styles.invitationInboxNoticeText}>
              Bạn có <Text style={{ fontWeight: "800" }}>{pendingInvitations.length}</Text> lời mời đang chờ bạn phản hồi.
            </Text>
          </View>
        )}

        {receivedInvitations.map((inv) => (
          <DirectInviteCard
            key={inv.id}
            invitation={inv}
            isAccepting={acceptingId === inv.id}
            isDeclining={decliningId === inv.id}
            onAccept={async () => {
              const res = await acceptInvitation(inv.id);
              if (res?.canEnterRoom && res.tripId) {
                router.push({
                  pathname: "/private-trips/[id]/room",
                  params: { id: res.tripId },
                } as any);
              }
            }}
            onDecline={async (_id, reason) => {
              await declineInvitation(inv.id, reason);
            }}
            onEnterRoom={(targetTripId) => {
              router.push({
                pathname: "/private-trips/[id]/room",
                params: { id: targetTripId },
              } as any);
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopHeader subtitle="Trips" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handlePublicTripsScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryDark}
            colors={[Colors.primaryDark]}
          />
        }
      >
        <View style={styles.segmentContainer}>
          <View style={styles.segmentBox}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                mainTab === "MY_TRIPS" && styles.segmentBtnActive,
              ]}
              onPress={() => setMainTab("MY_TRIPS")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="briefcase"
                size={16}
                color={
                  mainTab === "MY_TRIPS"
                    ? Colors.onPrimary
                    : Colors.onSurfaceVariant
                }
              />
              <Text
                style={
                  mainTab === "MY_TRIPS"
                    ? styles.segmentBtnTextActive
                    : styles.segmentBtnText
                }
              >
                Chuyến của tôi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                mainTab === "PUBLIC_TRIPS" && styles.segmentBtnActive,
              ]}
              onPress={() => setMainTab("PUBLIC_TRIPS")}
              activeOpacity={0.8}
            >
              <Ionicons
                name="compass"
                size={16}
                color={
                  mainTab === "PUBLIC_TRIPS"
                    ? Colors.onPrimary
                    : Colors.onSurfaceVariant
                }
              />
              <Text
                style={
                  mainTab === "PUBLIC_TRIPS"
                    ? styles.segmentBtnTextActive
                    : styles.segmentBtnText
                }
              >
                Public Trips
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {mainTab === "MY_TRIPS" ? (
          <>
            {renderFilters()}
            {activeFilter === "UPCOMING" && renderUpcomingTrips()}
            {activeFilter === "PRIVATE" && renderPrivateTrips()}
            {activeFilter === "INVITATIONS" && renderInvitationsInbox()}
            {activeFilter === "PENDING" && renderPendingTrips()}
            {activeFilter === "HISTORY" && renderHistory()}
          </>
        ) : (
          renderPublicTripsTab()
        )}
      </ScrollView>

      <TripPrepModal
        visible={prepModalVisible}
        trip={activeTrip}
        onClose={() => setPrepModalVisible(false)}
        onStartNavigation={() =>
          router.push({
            pathname: "/navigation",
            params: {
              tripId: activeTrip?.id,
              tripTitle: activeTrip?.name,
              tripType: "PUBLIC",
            },
          })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  segmentBox: {
    padding: 3,
    flexDirection: "row",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: Radius.full,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primaryContainer,
    ...Shadows.card,
  },
  segmentBtnText: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentBtnTextActive: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  subFilterRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  subFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  subFilterChipActive: {
    backgroundColor: Colors.ink,
  },
  subFilterText: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: "600",
  },
  subFilterTextActive: {
    color: Colors.inverseOnSurface,
    fontWeight: "700",
  },
  countBadge: {
    width: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  countBadgeText: {
    color: Colors.onPrimary,
    fontSize: 10,
    fontWeight: "800",
  },
  privateActionBar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  privateActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primaryContainer,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  privateActionBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.onPrimary,
  },
  privateSecondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
  },
  privateSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  pendingCountBadge: {
    width: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: "#F59E0B",
  },
  pendingCountBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  historyCountBadge: {
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  historyCountBadgeText: {
    color: Colors.onSurface,
    fontSize: 9,
    fontWeight: "800",
  },
  pendingHeaderNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingHeaderNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
    lineHeight: 17,
  },
  tripCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.hover,
  },
  tripCardTop: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leaderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryContainer,
  },
  leaderBadgeText: {
    color: "#0C2000",
    fontSize: 10,
    fontWeight: "800",
  },
  confirmedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
  },
  confirmedText: {
    color: Colors.onPrimaryContainer,
    fontSize: 9,
    fontWeight: "800",
  },
  tripDetails: {
    marginBottom: 12,
  },
  tripTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tripTitle: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: "900",
  },
  tripTimeRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tripTimeText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 17,
  },
  logisticsBox: {
    marginBottom: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  busIconBox: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryContainer,
  },
  logisticsTitle: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "700",
  },
  logisticsSub: {
    marginTop: 1,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  quickGrid: {
    marginBottom: 14,
    flexDirection: "row",
    gap: 8,
  },
  quickTile: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  quickTileLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  quickTileVal: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "700",
  },
  quickRentalValue: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  ticketBtn: {
    minHeight: 58,
    marginBottom: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  ticketIconBox: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
  },
  ticketBtnText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  ticketBtnSubtext: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  prepBtn: {
    flex: 3,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.inverseSurface,
  },
  prepBtnText: {
    color: Colors.inverseOnSurface,
    fontSize: 13,
    fontWeight: "700",
  },
  gpsLiveBtn: {
    flex: 2,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
  },
  gpsLiveBtnText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  privateTripCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  privateTop: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  privatePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  },
  hostText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: "700",
  },
  privateTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: "800",
  },
  privateSub: {
    marginTop: 2,
    marginBottom: 12,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  participantsBox: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  avatarStack: {
    flexDirection: "row",
  },
  avatarCircle: {
    width: 28,
    height: 28,
    marginRight: -8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
  },
  avatarGreen: {
    backgroundColor: "#47672D",
  },
  avatarDarkGreen: {
    backgroundColor: "#2F6C00",
  },
  avatarGold: {
    backgroundColor: "#725C00",
  },
  avatarMore: {
    backgroundColor: Colors.surfaceContainerHighest,
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  avatarMoreText: {
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: "800",
  },
  inviteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  inviteBtnText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: "700",
  },
  createTripBanner: {
    marginHorizontal: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryPale,
    ...Shadows.card,
  },
  createTripIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
  },
  createTripTitle: {
    color: Colors.inkDeep,
    fontSize: 14,
    fontWeight: "800",
  },
  createTripSub: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 15,
  },
  pendingCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  pendingCardTop: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pendingStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: Radius.full,
    backgroundColor: "#FFF1BF",
  },
  pendingStatusText: {
    color: "#7A5700",
    fontSize: 9,
    fontWeight: "900",
  },
  pendingPrice: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
  },
  pendingTripName: {
    marginBottom: 10,
    color: Colors.onSurface,
    fontSize: 19,
    fontWeight: "900",
  },
  infoRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  pendingNotice: {
    marginTop: 14,
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: Radius.md,
    backgroundColor: "#FFF7D6",
  },
  pendingNoticeText: {
    flex: 1,
    color: "#6B5200",
    fontSize: 11,
    lineHeight: 16,
  },
  outlineButton: {
    minHeight: 46,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
    borderRadius: Radius.full,
  },
  outlineButtonText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyState: {
    marginHorizontal: 16,
    paddingHorizontal: 24,
    paddingVertical: 42,
    alignItems: "center",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 34,
    backgroundColor: Colors.primaryPale,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyDescription: {
    marginTop: 7,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  emptyButton: {
    minHeight: 44,
    marginTop: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  historyCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.hover,
  },
  historyTop: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  completedPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: Radius.full,
    backgroundColor: "#DFF4E7",
  },
  completedText: {
    color: "#1B4332",
    fontSize: 9,
    fontWeight: "900",
  },
  historyDate: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  historyTripName: {
    color: Colors.onSurface,
    fontSize: 20,
    fontWeight: "900",
  },
  historyDestination: {
    marginTop: 4,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  historyStats: {
    marginTop: 16,
    paddingVertical: 12,
    flexDirection: "row",
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  historyStat: {
    flex: 1,
    alignItems: "center",
  },
  historyStatValue: {
    marginTop: 4,
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "900",
  },
  historyStatLabel: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 9,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  leaderSummary: {
    marginTop: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  leaderAvatar: {
    width: 38,
    height: 38,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: Colors.primaryDark,
  },
  leaderAvatarText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  leaderLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 9,
  },
  leaderName: {
    marginTop: 2,
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "800",
  },
  ratingSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingSummaryText: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "800",
  },
  reviewButton: {
    minHeight: 50,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  reviewButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  cancelBookingButton: {
    minHeight: 44,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: Radius.full,
    backgroundColor: "#FEF2F2",
  },
  cancelBookingButtonText: {
    color: "#B91C1C",
    fontSize: 11,
    fontWeight: "900",
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    ...Shadows.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.onSurface,
    padding: 0,
  },
  difficultyRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    gap: 8,
  },
  diffChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  diffChipActive: {
    backgroundColor: Colors.primaryDark,
  },
  diffChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.onSurfaceVariant,
  },
  diffChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  resultCountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.secondary,
  },
  leaderCreateBanner: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.secondaryContainer,
  },
  leaderCreateIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  leaderCreateTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  leaderCreateSub: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 15,
  },
  invitationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.secondaryContainer,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.secondaryFixed,
  },
  invitationBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  invitationBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.secondary,
  },
  invitationBannerSub: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  invitationInboxNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },
  invitationInboxNoticeText: {
    fontSize: 12,
    color: Colors.primaryDark,
    fontWeight: "500",
    flex: 1,
  },
  upcomingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  upcomingSectionTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  upcomingSectionBadge: {
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  upcomingSectionBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  companionTicketCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: "#B2DFDB",
    marginBottom: 14,
  },
  ticketCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  ticketBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E0F2F1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  ticketBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#00796B",
    letterSpacing: 0.5,
  },
  ticketStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ticketStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  ticketTripTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.onSurface,
    lineHeight: 20,
    marginBottom: 8,
  },
  ticketMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  ticketMetaText: {
    fontSize: 12.5,
    color: Colors.onSurfaceVariant,
    fontWeight: "500",
  },
  ticketCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerLow,
  },
  ticketMemberLabel: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  ticketMemberName: {
    fontWeight: "700",
    color: Colors.onSurface,
  },
  ticketViewAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ticketViewActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
});
