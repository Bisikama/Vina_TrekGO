import { TopHeader } from "@/components/TopHeader";
import { TripPrepModal } from "@/components/TripPrepModal";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import { useMyBookings } from "@/features/bookings/hooks/useMyBookings";
import { useLeaderTrips } from "@/features/leaders/hooks";
import {
  getPublicTrips,
  type PublicTrip,
} from "@/features/trips/services/public-trips.api";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const SCENIC_IMAGES = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=600&q=80",
];

function formatTripDates(startAt?: string, endAt?: string) {
  if (!startAt) return "Lịch chưa cập nhật";
  try {
    const s = new Date(startAt);
    const e = endAt ? new Date(endAt) : null;
    const startStr = `${s.getDate().toString().padStart(2, "0")}/${(s.getMonth() + 1).toString().padStart(2, "0")}`;
    if (!e) return startStr;
    const endStr = `${e.getDate().toString().padStart(2, "0")}/${(e.getMonth() + 1).toString().padStart(2, "0")}.${e.getFullYear()}`;
    return `${startStr} - ${endStr}`;
  } catch {
    return "Lịch chưa cập nhật";
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, activeTrip, trails, fieldWorkflow } = useApp();
  const { user: authUser, accessToken } = useAuth();

  const isLeader = authUser?.role === "LEADER" || user.role === "LEADER";

  const [tripPrepVisible, setTripPrepVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Real backend API for leader trips
  const {
    trips: leaderTrips,
    loading: loadingLeaderTrips,
    fetchMyTrips,
  } = useLeaderTrips(accessToken);

  // Real backend API for trekker bookings & public trips
  const { bookings, refetch: fetchBookings } = useMyBookings();
  const [publicTrips, setPublicTrips] = useState<PublicTrip[]>([]);
  const [loadingPublicTrips, setLoadingPublicTrips] = useState(false);

  const fetchFeaturedTrips = useCallback(async () => {
    setLoadingPublicTrips(true);
    try {
      const res = await getPublicTrips({ pageSize: 6 });
      setPublicTrips(res.items || []);
    } catch {
      setPublicTrips([]);
    } finally {
      setLoadingPublicTrips(false);
    }
  }, []);

  useEffect(() => {
    if (isLeader && accessToken) {
      void fetchMyTrips();
    } else if (!isLeader) {
      void fetchFeaturedTrips();
    }
  }, [isLeader, accessToken, fetchMyTrips, fetchFeaturedTrips]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isLeader && accessToken) {
      await fetchMyTrips();
    } else {
      await Promise.allSettled([fetchBookings(), fetchFeaturedTrips()]);
    }
    setRefreshing(false);
  }, [isLeader, accessToken, fetchMyTrips, fetchBookings, fetchFeaturedTrips]);

  const activeLeaderTrip = leaderTrips.length > 0 ? leaderTrips[0] : null;

  const activeBooking =
    bookings.find(
      (b) =>
        b.status === "CONFIRMED" ||
        b.status === "CHECKED_IN" ||
        b.status === "PENDING_PAYMENT",
    ) || (bookings.length > 0 ? bookings[0] : null);

  const daysText = activeBooking?.trip?.startAt
    ? (() => {
        const diff = new Date(activeBooking.trip.startAt).getTime() - Date.now();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (days < 0) return "ĐÃ DIỄN RA";
        if (days === 0) return "HÔM NAY";
        return `BẮT ĐẦU TRONG ${days} NGÀY`;
      })()
    : "SẮP KHỞI HÀNH";

  const checkedInCount = fieldWorkflow.leaderAttendance.filter(
    (member: { memberName: string; status: string }) =>
      member.status === "CHECKED_IN",
  ).length;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. LEADER SCREEN VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (isLeader) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <TopHeader subtitle="Leader Command" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primaryDark}
            />
          }
        >
          {/* GREETING & STATUS BANNER FOR LEADER */}
          <View style={styles.greetingSection}>
            <View style={styles.statusChipsRow}>
              <View style={styles.leaderRoleChip}>
                <Ionicons name="shield-checkmark" size={13} color="#ffffff" />
                <Text style={styles.leaderRoleChipText}>MOUNTAIN LEADER</Text>
              </View>

              <View style={styles.gpsChip}>
                <View style={styles.gpsPulseDot} />
                <Text style={styles.gpsChipText}>GPS READY</Text>
              </View>

              <View style={styles.weatherChip}>
                <Ionicons name="partly-sunny" size={13} color="#725c00" />
                <Text style={styles.weatherChipText}>22°C Nắng nhẹ</Text>
              </View>
            </View>

            <Text style={styles.greetingTitle}>
              Xin chào, Leader {authUser?.name || user.name}!
            </Text>
            <Text style={styles.greetingSubtitle}>
              Trung tâm chỉ huy & tác chiến điều hành tour ngoài thực địa
            </Text>
          </View>

          {/* ACTIVE COMMAND HERO CARD FOR LEADER */}
          <View style={styles.leaderHeroCard}>
            <View style={styles.leaderHeroHeader}>
              <View>
                <View style={styles.liveBadgeRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.leaderHeroSub}>
                    TOUR ĐIỀU HÀNH HIỆN TRƯỜNG
                  </Text>
                </View>
                <Text style={styles.leaderHeroTitle}>
                  {activeLeaderTrip
                    ? activeLeaderTrip.title
                    : activeTrip.name || "Cung đường Tà Năng - Phan Dũng"}
                </Text>
              </View>
              <View style={styles.leaderTripBadge}>
                <Text style={styles.leaderTripBadgeText}>
                  {activeLeaderTrip
                    ? `#TG-${activeLeaderTrip.id.slice(0, 4).toUpperCase()}-VN`
                    : activeTrip.bookingCode || "#TG-OP-01"}
                </Text>
              </View>
            </View>

            <View style={styles.leaderRouteInfo}>
              <Ionicons name="location-outline" size={15} color="#b8cbb2" />
              <Text style={styles.leaderRouteText}>
                {activeLeaderTrip
                  ? `${activeLeaderTrip.destination?.name || "Tuyến Trekking"} · ${formatTripDates(activeLeaderTrip.startAt, activeLeaderTrip.endAt)}`
                  : `${activeTrip.destination || "Lâm Đồng - Bình Thuận"} · Khởi hành tuần này`}
              </Text>
            </View>

            {/* Tactical Telemetry 3-Grid */}
            <View style={styles.leaderTelemetryGrid}>
              <View style={styles.leaderTelemetryTile}>
                <View style={styles.telemetryHeader}>
                  <Ionicons name="git-commit" size={12} color="#8cd867" />
                  <Text style={styles.leaderTelemetryLabel}>Checkpoint</Text>
                </View>
                <Text style={styles.leaderTelemetryValue}>
                  {fieldWorkflow.completedCheckpointIds.length}/
                  {fieldWorkflow.requiredCheckpointIds.length || 6}
                  <Text style={styles.leaderTelemetryUnit}> mốc</Text>
                </Text>
              </View>

              <View style={styles.leaderTelemetryTile}>
                <View style={styles.telemetryHeader}>
                  <Ionicons name="people" size={12} color="#fed018" />
                  <Text style={styles.leaderTelemetryLabel}>Quân số</Text>
                </View>
                <Text style={styles.leaderTelemetryValue}>
                  {checkedInCount}/
                  {fieldWorkflow.leaderAttendance.length}
                  <Text style={styles.leaderTelemetryUnit}> check-in</Text>
                </Text>
              </View>

              <View style={styles.leaderTelemetryTile}>
                <View style={styles.telemetryHeader}>
                  <Ionicons name="shield-checkmark" size={12} color="#8cd867" />
                  <Text style={styles.leaderTelemetryLabel}>Trạng thái</Text>
                </View>
                <Text
                  style={[
                    styles.leaderTelemetryValue,
                    { color: "#8cd867", fontSize: 13 },
                  ]}
                >
                  {fieldWorkflow.leaderTripStatus === "IN_PROGRESS"
                    ? "Đang chạy"
                    : fieldWorkflow.leaderPretripApproved
                      ? "Sẵn sàng"
                      : "Chuẩn bị"}
                </Text>
              </View>
            </View>

            {/* Leader Hero Actions */}
            <View style={styles.leaderHeroActions}>
              <TouchableOpacity
                style={styles.leaderPrimaryBtn}
                onPress={() =>
                  router.push("/field-operations/leader-map" as any)
                }
                activeOpacity={0.85}
              >
                <Ionicons name="navigate" size={18} color="#0c2000" />
                <Text style={styles.leaderPrimaryBtnText}>
                  Vào GPS điều hành
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.leaderSecondaryBtn}
                onPress={() =>
                  router.push("/field-operations/leader-pretrip" as any)
                }
                activeOpacity={0.85}
              >
                <Ionicons
                  name="clipboard-outline"
                  size={17}
                  color="#ffffff"
                />
                <Text style={styles.leaderSecondaryBtnText}>
                  Điểm danh đoàn
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* LEADER QUICK ACTION SHORTCUTS (4 Items) */}
          <View style={styles.shortcutsRow}>
            <TouchableOpacity
              style={styles.shortcutItem}
              onPress={() =>
                router.push("/field-operations/leader-create-trip" as any)
              }
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.shortcutIconBox,
                  { backgroundColor: "#163300" },
                ]}
              >
                <Ionicons name="add-circle" size={24} color="#8cd867" />
              </View>
              <Text style={styles.shortcutLabel}>Tạo Public Trip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutItem}
              onPress={() =>
                router.push("/field-operations/leader-map" as any)
              }
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.shortcutIconBox,
                  { backgroundColor: Colors.primaryContainer },
                ]}
              >
                <Ionicons
                  name="navigate"
                  size={24}
                  color={Colors.onPrimaryContainer}
                />
              </View>
              <Text style={styles.shortcutLabel}>Điều hành GPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutItem}
              onPress={() =>
                router.push("/field-operations/leader-pretrip" as any)
              }
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.shortcutIconBox,
                  { backgroundColor: "#fff4d0" },
                ]}
              >
                <Ionicons name="checkbox" size={24} color="#725c00" />
              </View>
              <Text style={styles.shortcutLabel}>Điểm danh đoàn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutItem}
              onPress={() => router.push("/personal-trails" as any)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.shortcutIconBox,
                  { backgroundColor: Colors.surfaceContainerHighest },
                ]}
              >
                <Ionicons name="map" size={24} color={Colors.onSurface} />
              </View>
              <Text style={styles.shortcutLabel}>My Trails</Text>
            </TouchableOpacity>
          </View>

          {/* FIELD OPERATIONS TOOLSET ROW (2 Big Tactical Cards) */}
          <View style={styles.fieldToolsetSection}>
            <Text style={styles.sectionHeaderTitle}>CÔNG CỤ TÁC CHIẾN</Text>
            <View style={styles.toolsetRow}>
              <TouchableOpacity
                style={styles.toolsetCard}
                onPress={() =>
                  router.push("/field-operations/leader-safety" as any)
                }
                activeOpacity={0.85}
              >
                <View style={styles.toolsetCardHeader}>
                  <View
                    style={[
                      styles.toolsetIconBox,
                      fieldWorkflow.leaderSafetyAlert.status === "ACTIVE"
                        ? { backgroundColor: "#ffdad6" }
                        : { backgroundColor: "#e7f6e3" },
                    ]}
                  >
                    <Ionicons
                      name="radio-outline"
                      size={20}
                      color={
                        fieldWorkflow.leaderSafetyAlert.status === "ACTIVE"
                          ? Colors.error
                          : Colors.primaryDark
                      }
                    />
                  </View>
                  <View
                    style={[
                      styles.toolsetStatusPill,
                      fieldWorkflow.leaderSafetyAlert.status === "ACTIVE" && {
                        backgroundColor: "#ffdad6",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.toolsetStatusPillText,
                        fieldWorkflow.leaderSafetyAlert.status === "ACTIVE" && {
                          color: Colors.error,
                        },
                      ]}
                    >
                      {fieldWorkflow.leaderSafetyAlert.status === "ACTIVE"
                        ? "1 Cảnh báo"
                        : "An toàn"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.toolsetTitle}>Cảnh báo & Bộ đàm</Text>
                <Text style={styles.toolsetSub}>Kênh khẩn cấp VHF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolsetCard}
                onPress={() =>
                  router.push("/field-operations/leader-summary" as any)
                }
                activeOpacity={0.85}
              >
                <View style={styles.toolsetCardHeader}>
                  <View
                    style={[
                      styles.toolsetIconBox,
                      { backgroundColor: "#e7f6e3" },
                    ]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color={Colors.primaryDark}
                    />
                  </View>
                  <View style={styles.toolsetStatusPill}>
                    <Text style={styles.toolsetStatusPillText}>
                      {fieldWorkflow.leaderReportSent ? "Đã gửi" : "Chờ gửi"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.toolsetTitle}>Báo cáo nghiệm thu</Text>
                <Text style={styles.toolsetSub}>Tổng kết & Bàn giao</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* LEADER MANAGED PUBLIC TRIPS SECTION (Using Real Backend API) */}
          <View style={styles.leaderTripsSection}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Chuyến đi của bạn</Text>
                <Text style={styles.sectionSubtitle}>
                  Danh sách Public Trip do bạn quản lý & mở bán
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  router.push("/field-operations/leader-create-trip" as any)
                }
              >
                <Text style={styles.viewAllText}>+ Tạo mới</Text>
              </TouchableOpacity>
            </View>

            {loadingLeaderTrips ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Colors.primaryDark} />
                <Text style={styles.loadingBoxText}>
                  Đang đồng bộ từ máy chủ...
                </Text>
              </View>
            ) : leaderTrips.length === 0 ? (
              <View style={styles.emptyLeaderTripsCard}>
                <Ionicons
                  name="compass-outline"
                  size={32}
                  color={Colors.primaryDark}
                />
                <Text style={styles.emptyLeaderTripsTitle}>
                  Chưa có Public Trip nào
                </Text>
                <Text style={styles.emptyLeaderTripsSub}>
                  Khởi tạo chuyến đi công khai mới để nhận đăng ký từ cộng đồng
                  trekkers.
                </Text>
                <TouchableOpacity
                  style={styles.createFirstTripBtn}
                  onPress={() =>
                    router.push("/field-operations/leader-create-trip" as any)
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#ffffff" />
                  <Text style={styles.createFirstTripBtnText}>
                    Tạo Public Trip đầu tiên
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              leaderTrips.map((trip) => {
                const tripCode = `#TG-${trip.id.slice(0, 4).toUpperCase()}-VN`;
                const isOpen = trip.status === "OPEN";
                return (
                  <TouchableOpacity
                    key={trip.id}
                    style={styles.leaderTripCard}
                    onPress={() =>
                      router.push({
                        pathname: "/trips/[id]",
                        params: { id: trip.id },
                      } as unknown as Href)
                    }
                    activeOpacity={0.88}
                  >
                    <View style={styles.leaderTripCardHeader}>
                      <Text style={styles.leaderTripCode}>{tripCode}</Text>
                      <View
                        style={[
                          styles.leaderStatusPill,
                          isOpen
                            ? { backgroundColor: "#e7f6e3" }
                            : { backgroundColor: "#fff4d0" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.leaderStatusPillText,
                            {
                              color: isOpen ? Colors.primaryDark : "#725c00",
                            },
                          ]}
                        >
                          {trip.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.leaderTripTitle}>{trip.title}</Text>

                    <View style={styles.leaderTripMetaRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color={Colors.onSurfaceVariant}
                      />
                      <Text style={styles.leaderTripMetaText}>
                        {formatTripDates(trip.startAt, trip.endAt)}
                      </Text>
                      {trip.destination?.name && (
                        <>
                          <Text style={styles.leaderTripMetaDot}>•</Text>
                          <Ionicons
                            name="location-outline"
                            size={13}
                            color={Colors.onSurfaceVariant}
                          />
                          <Text style={styles.leaderTripMetaText}>
                            {trip.destination.name}
                          </Text>
                        </>
                      )}
                    </View>

                    <View style={styles.leaderTripFooter}>
                      <Text style={styles.leaderTripCapacity}>
                        Sức chứa: {trip.capacity} chỗ
                      </Text>
                      <Text style={styles.leaderTripPrice}>
                        {Number(trip.pricePerPax).toLocaleString("vi-VN")} đ/suất
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* ROSTER PREVIEW (ĐOÀN HÔM NAY) */}
          <View style={styles.rosterSection}>
            <View style={styles.rosterHeader}>
              <Text style={styles.sectionHeaderTitle}>QUÂN SỐ ĐOÀN HÔM NAY</Text>
              <Text style={styles.rosterCount}>
                {checkedInCount}/{fieldWorkflow.leaderAttendance.length} CHECK-IN
              </Text>
            </View>

            {fieldWorkflow.leaderAttendance.slice(0, 3).map((member) => (
              <View key={member.memberName} style={styles.rosterRow}>
                <View
                  style={[
                    styles.rosterDot,
                    member.status === "PENDING" && styles.rosterDotPending,
                    member.status === "NO_SHOW" && styles.rosterDotNoShow,
                  ]}
                />
                <Text style={styles.rosterName}>{member.memberName}</Text>
                <Text
                  style={[
                    styles.rosterStatusText,
                    member.status === "CHECKED_IN" && {
                      color: Colors.primaryDark,
                    },
                    member.status === "NO_SHOW" && { color: Colors.error },
                  ]}
                >
                  {member.status === "CHECKED_IN"
                    ? "Đã check-in"
                    : member.status === "NO_SHOW"
                      ? "No-show"
                      : "Chờ điểm danh"}
                </Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.openRosterBtn}
              onPress={() =>
                router.push("/field-operations/leader-pretrip" as any)
              }
              activeOpacity={0.85}
            >
              <Text style={styles.openRosterBtnText}>
                Xem toàn bộ danh sách điểm danh đoàn ›
              </Text>
            </TouchableOpacity>
          </View>

          {/* LEADER SAFETY DIRECTIVE ADVISORY */}
          <View style={styles.leaderAdvisoryCard}>
            <View style={styles.advisoryHeader}>
              <Ionicons name="shield-checkmark" size={18} color="#2e6c00" />
              <Text style={styles.leaderAdvisoryTitle}>
                Chỉ thị an toàn Mountain Leader
              </Text>
            </View>
            <Text style={styles.leaderAdvisoryText}>
              Đảm bảo 100% thành viên hoàn tất điểm danh trước khi mở định vị GPS.
              Luôn duy trì chốt chặn (sweeper) cuối đoàn và liên tục cập nhật trạng
              thái các mốc checkpoint ngoài thực địa.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. REGULAR TREKKER / CONSUMER SCREEN VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <TopHeader subtitle="Home" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryDark}
          />
        }
      >
        {/* 1. GREETING & WEATHER STATUS BANNER */}
        <View style={styles.greetingSection}>
          <View style={styles.statusChipsRow}>
            <View style={styles.weatherChip}>
              <Ionicons name="partly-sunny" size={14} color="#725c00" />
              <Text style={styles.weatherChipText}>Thời tiết thuận lợi</Text>
            </View>

            <View style={styles.gpsChip}>
              <View style={styles.gpsPulseDot} />
              <Text style={styles.gpsChipText}>GPS READY</Text>
            </View>
          </View>

          <Text style={styles.greetingTitle}>Xin chào, {authUser?.name || user.name}!</Text>
          <Text style={styles.greetingSubtitle}>
            Sẵn sàng cho hành trình trekking tiếp theo cùng TrekGo?
          </Text>
        </View>

        {/* 2. UPCOMING TRIP HERO CARD */}
        {activeBooking ? (
          <View style={styles.heroCard}>
            <View style={styles.heroImageContainer}>
              <Image
                source={{
                  uri: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
                }}
                style={styles.heroImage}
              />
              <View style={styles.imageOverlay} />

              <View style={styles.countdownBadge}>
                <Ionicons
                  name="time"
                  size={13}
                  color={Colors.onPrimaryContainer}
                />
                <Text style={styles.countdownText}>{daysText}</Text>
              </View>

              <View style={styles.bookingBadge}>
                <Ionicons
                  name="shield-checkmark"
                  size={13}
                  color={Colors.primary}
                />
                <Text style={styles.bookingText}>
                  #BK-{activeBooking.id.slice(0, 6).toUpperCase()}
                </Text>
              </View>

              <View style={styles.heroTitles}>
                <Text style={styles.trailCategory}>
                  {activeBooking.status === "CONFIRMED"
                    ? "Chuyến đi đã xác nhận"
                    : activeBooking.status === "CHECKED_IN"
                      ? "Đang tham gia chuyến đi"
                      : "Chờ xác nhận thanh toán"}
                </Text>
                <Text style={styles.trailName} numberOfLines={2}>
                  {activeBooking.trip?.title}
                </Text>
              </View>
            </View>

            <View style={styles.heroBody}>
              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryTile}>
                  <View style={styles.telemetryHeader}>
                    <Ionicons
                      name="people"
                      size={12}
                      color={Colors.primaryDark}
                    />
                    <Text style={styles.telemetryLabel}>Số lượng</Text>
                  </View>
                  <Text style={styles.telemetryValue}>
                    {activeBooking.participantCount}
                    <Text style={styles.telemetryUnit}> người</Text>
                  </Text>
                </View>

                <View style={styles.telemetryTile}>
                  <View style={styles.telemetryHeader}>
                    <Ionicons name="cash-outline" size={12} color="#725c00" />
                    <Text style={styles.telemetryLabel}>Tổng tiền</Text>
                  </View>
                  <Text style={styles.telemetryValue}>
                    {Number(activeBooking.totalAmount).toLocaleString("vi-VN")}
                    <Text style={styles.telemetryUnit}>đ</Text>
                  </Text>
                </View>

                <View style={styles.telemetryTile}>
                  <View style={styles.telemetryHeader}>
                    <Ionicons name="checkmark-circle" size={12} color={Colors.primaryDark} />
                    <Text style={styles.telemetryLabel}>Trạng thái</Text>
                  </View>
                  <Text
                    style={[
                      styles.telemetryValue,
                      { color: Colors.primaryDark, fontSize: 13 },
                    ]}
                  >
                    {activeBooking.status === "CONFIRMED"
                      ? "Xác nhận"
                      : activeBooking.status === "CHECKED_IN"
                        ? "Check-in"
                        : "Chờ"}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <View style={styles.dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={Colors.secondary}
                    />
                    <Text style={styles.dateText}>
                      {formatTripDates(
                        activeBooking.trip?.startAt,
                        activeBooking.trip?.endAt,
                      )}
                    </Text>
                  </View>
                  <Text style={styles.slotsText}>
                    {activeBooking.participantCount} chỗ đã đặt
                  </Text>
                </View>
              </View>

              <View style={styles.heroActionsRow}>
                <TouchableOpacity
                  style={styles.detailsBtn}
                  onPress={() =>
                    router.push(`/trips/${activeBooking.trip?.id}` as any)
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.detailsBtnText}>Chi tiết chuyến đi</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Colors.onPrimary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navLiveBtn}
                  onPress={() =>
                    router.push({
                      pathname: "/navigation",
                      params: {
                        tripId: activeBooking.trip?.id,
                        tripTitle: activeBooking.trip?.title,
                        tripType: "PUBLIC",
                      },
                    })
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="navigate"
                    size={16}
                    color={Colors.primaryDark}
                  />
                  <Text style={styles.navLiveBtnText}>Vào GPS</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyBookingCard}>
            <View style={styles.emptyBookingIconBox}>
              <Ionicons
                name="trail-sign-outline"
                size={30}
                color={Colors.onPrimaryContainer}
              />
            </View>
            <Text style={styles.emptyBookingTitle}>Chưa có chuyến đi sắp tới</Text>
            <Text style={styles.emptyBookingSub}>
              Bạn chưa đăng ký chuyến đi nào. Hãy khám phá các tour trekking thực tế được dẫn dắt bởi Leader bản địa!
            </Text>
            <TouchableOpacity
              style={styles.exploreTripsBtn}
              onPress={() =>
                router.push("/(tabs)/trips?tab=PUBLIC_TRIPS" as Href)
              }
              activeOpacity={0.85}
            >
              <Ionicons name="compass" size={16} color="#ffffff" />
              <Text style={styles.exploreTripsBtnText}>Khám phá tour trekking</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. QUICK ACTION SHORTCUTS (4 Items in Signature Wise Lime Green) */}
        <View style={styles.shortcutsRow}>
          <TouchableOpacity
            style={styles.shortcutItem}
            onPress={() => router.push("/(tabs)/explore")}
            activeOpacity={0.8}
          >
            <View style={styles.shortcutIconBox}>
              <MaterialCommunityIcons
                name="compass-rose"
                size={27}
                color={Colors.onPrimary}
              />
            </View>
            <Text style={styles.shortcutLabel}>Khám phá Trails</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutItem}
            onPress={() => router.push("/(tabs)/trips?tab=PUBLIC_TRIPS" as Href)}
            activeOpacity={0.8}
          >
            <View style={styles.shortcutIconBox}>
              <Ionicons
                name="flag"
                size={26}
                color={Colors.onPrimary}
              />
            </View>
            <Text style={styles.shortcutLabel}>Public Tours</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutItem}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/trips",
                params: { tab: "MY_TRIPS", filter: "PRIVATE" },
              } as any)
            }
            activeOpacity={0.8}
          >
            <View style={styles.shortcutIconBox}>
              <Ionicons
                name="people"
                size={26}
                color={Colors.onPrimary}
              />
            </View>
            <Text style={styles.shortcutLabel}>Tạo Private Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutItem}
            onPress={() => router.push("/(tabs)/rental")}
            activeOpacity={0.8}
          >
            <View style={styles.shortcutIconBox}>
              <Ionicons
                name="basket"
                size={26}
                color={Colors.onPrimary}
              />
            </View>
            <Text style={styles.shortcutLabel}>Thuê đồ Trek</Text>
          </TouchableOpacity>
        </View>

        {/* 4. FEATURED TRAILS */}
        <View style={styles.featuredSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Cung đường nổi bật</Text>
              <Text style={styles.sectionSubtitle}>
                Dữ liệu định vị GPS offline & cao độ chuẩn xác
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/explore")}>
              <Text style={styles.viewAllText}>Xem tất cả ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trailScroll}
          >
            {loadingPublicTrips ? (
              <View style={styles.feedLoadingBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.feedLoadingText}>Đang tải chuyến đi...</Text>
              </View>
            ) : publicTrips.length === 0 ? (
              <View style={styles.emptyFeedBox}>
                <Text style={styles.emptyFeedText}>Chưa có chuyến đi nào mở đặt chỗ</Text>
              </View>
            ) : (
              publicTrips.map((trip, idx) => {
                const imageUrl = SCENIC_IMAGES[idx % SCENIC_IMAGES.length];
                const route = trip.routes?.[0];
                const priceFormatted = Number(trip.pricePerPax).toLocaleString("vi-VN");
                return (
                  <TouchableOpacity
                    key={trip.id}
                    style={styles.trailCard}
                    onPress={() => router.push(`/trips/${trip.id}` as any)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.trailImageWrapper}>
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.trailCardImage}
                      />
                      <View style={styles.priceTag}>
                        <Ionicons
                          name="pricetag-outline"
                          size={11}
                          color="#fed018"
                        />
                        <Text style={styles.priceTagText}>
                          {priceFormatted}đ
                        </Text>
                      </View>
                    </View>
                    <View style={styles.trailCardBody}>
                      <Text style={styles.trailCardTitle} numberOfLines={1}>
                        {trip.title}
                      </Text>
                      <Text style={styles.trailCardRegion}>
                        {trip.destination?.name || "Việt Nam"}
                      </Text>
                      <View style={styles.trailMetaRow}>
                        {route?.snapshotDistanceKm ? (
                          <>
                            <Text style={styles.trailMetaItem}>
                              {route.snapshotDistanceKm} km
                            </Text>
                            <Text style={styles.trailMetaDivider}>•</Text>
                          </>
                        ) : null}
                        <Text
                          style={[
                            styles.trailMetaItem,
                            { color: Colors.primaryDark, fontWeight: "700" },
                          ]}
                        >
                          {route?.snapshotDifficulty || "Trung bình"}
                        </Text>
                        <Text style={styles.trailMetaDivider}>•</Text>
                        <Text style={styles.trailMetaItem}>
                          Còn {trip.remainingSlots}/{trip.capacity} chỗ
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* 5. WEATHER & SAFETY RISK ADVISORY CARD */}
        <View style={styles.advisoryCard}>
          <View style={styles.advisoryHeader}>
            <Ionicons name="shield-half" size={18} color="#725c00" />
            <Text style={styles.advisoryTitle}>
              Khuyến nghị an toàn ngoài thực địa
            </Text>
          </View>
          <Text style={styles.advisoryText}>
            Luôn kiểm tra dự báo thời tiết trước ngày khởi hành, chuẩn bị đủ nước,
            dụng cụ sơ cứu cơ bản, pin dự phòng và tuân thủ các quy tắc an toàn cùng hướng dẫn viên.
          </Text>
        </View>
      </ScrollView>

      {/* Modals */}
      <TripPrepModal
        visible={tripPrepVisible}
        trip={activeTrip}
        onClose={() => setTripPrepVisible(false)}
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
  scrollContent: {
    paddingBottom: 36,
  },
  greetingSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  statusChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  leaderRoleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#163300",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    ...Shadows.card,
  },
  leaderRoleChipText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#8cd867",
    letterSpacing: 0.6,
  },
  weatherChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    ...Shadows.card,
  },
  weatherChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.onSurface,
  },
  gpsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(159, 232, 112, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  gpsPulseDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  gpsChipText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.onPrimaryContainer,
    letterSpacing: 0.5,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.onSurface,
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },

  // ── Leader Hero Card ────────────────────────────────────────────────────────
  leaderHeroCard: {
    marginHorizontal: 16,
    backgroundColor: "#163300",
    borderRadius: Radius.xl,
    padding: 18,
    marginBottom: 20,
    ...Shadows.hover,
  },
  leaderHeroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  liveBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: "#8cd867",
  },
  leaderHeroSub: {
    fontSize: 10,
    fontWeight: "800",
    color: "#8cd867",
    letterSpacing: 0.8,
  },
  leaderHeroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 2,
  },
  leaderTripBadge: {
    backgroundColor: "rgba(140, 216, 103, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  leaderTripBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#8cd867",
  },
  leaderRouteInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 14,
  },
  leaderRouteText: {
    fontSize: 12,
    color: "#b8cbb2",
    fontWeight: "600",
  },
  leaderTelemetryGrid: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    padding: 10,
    borderRadius: Radius.md,
    marginBottom: 16,
  },
  leaderTelemetryTile: {
    flex: 1,
    alignItems: "center",
  },
  leaderTelemetryLabel: {
    fontSize: 10,
    color: "#b8cbb2",
    fontWeight: "700",
  },
  leaderTelemetryValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 2,
  },
  leaderTelemetryUnit: {
    fontSize: 10,
    color: "#b8cbb2",
    fontWeight: "600",
  },
  leaderHeroActions: {
    flexDirection: "row",
    gap: 10,
  },
  leaderPrimaryBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#9fe870",
    paddingVertical: 12,
    borderRadius: Radius.xl,
  },
  leaderPrimaryBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  leaderSecondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  leaderSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },

  // ── Field Operations Toolset Row ───────────────────────────────────────────
  fieldToolsetSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.onSurfaceMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  toolsetRow: {
    flexDirection: "row",
    gap: 10,
  },
  toolsetCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadows.card,
  },
  toolsetCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  toolsetIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  toolsetStatusPill: {
    backgroundColor: "#e7f6e3",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  toolsetStatusPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  toolsetTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  toolsetSub: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },

  // ── Leader Public Trips Section ───────────────────────────────────────────
  leaderTripsSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  loadingBoxText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  emptyLeaderTripsCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 20,
    alignItems: "center",
    ...Shadows.card,
  },
  emptyLeaderTripsTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.onSurface,
    marginTop: 8,
  },
  emptyLeaderTripsSub: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
  },
  createFirstTripBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  createFirstTripBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
  leaderTripCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 10,
    ...Shadows.card,
  },
  leaderTripCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leaderTripCode: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.onSurfaceMuted,
  },
  leaderStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  leaderStatusPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  leaderTripTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.onSurface,
    marginTop: 6,
    marginBottom: 6,
  },
  leaderTripMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  leaderTripMetaText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  leaderTripMetaDot: {
    fontSize: 10,
    color: Colors.onSurfaceMuted,
    marginHorizontal: 2,
  },
  leaderTripFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerLow,
  },
  leaderTripCapacity: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: "600",
  },
  leaderTripPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primaryDark,
  },

  // ── Roster Section ────────────────────────────────────────────────────────
  rosterSection: {
    marginHorizontal: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 20,
    ...Shadows.card,
  },
  rosterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  rosterCount: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.primaryDark,
  },
  rosterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surfaceContainerLow,
  },
  rosterDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    marginRight: 10,
  },
  rosterDotPending: {
    backgroundColor: "#fed018",
  },
  rosterDotNoShow: {
    backgroundColor: Colors.error,
  },
  rosterName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  rosterStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  openRosterBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 4,
  },
  openRosterBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primaryDark,
  },

  // ── Leader Advisory ───────────────────────────────────────────────────────
  leaderAdvisoryCard: {
    marginHorizontal: 16,
    backgroundColor: "#f2f8ee",
    borderWidth: 1,
    borderColor: "#c4e3b7",
    borderRadius: Radius.lg,
    padding: 14,
    gap: 6,
  },
  leaderAdvisoryTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2e6c00",
  },
  leaderAdvisoryText: {
    fontSize: 11,
    color: "#25461c",
    lineHeight: 16,
  },

  // ── Existing Consumer Styles (Preserved) ──────────────────────────────────
  heroCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    overflow: "hidden",
    ...Shadows.hover,
    marginBottom: 20,
  },
  heroImageContainer: {
    height: 170,
    width: "100%",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(20, 25, 18, 0.45)",
  },
  countdownBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    ...Shadows.card,
  },
  countdownText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.onPrimaryContainer,
    letterSpacing: 0.5,
  },
  bookingBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(251, 249, 243, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  bookingText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  heroTitles: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
  },
  trailCategory: {
    fontSize: 10,
    fontWeight: "800",
    color: "#e2e3de",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  trailName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  heroBody: {
    padding: 16,
  },
  telemetryGrid: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 14,
  },
  telemetryTile: {
    flex: 1,
    alignItems: "center",
  },
  telemetryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  telemetryValue: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.onSurface,
  },
  telemetryUnit: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.onSurfaceVariant,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.onSurfaceVariant,
  },
  slotsText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.full,
  },
  heroActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  detailsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radius.md,
    ...Shadows.card,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.onPrimary,
  },
  navLiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surfaceContainerHighest,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  navLiveBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primaryDark,
  },

  // ── Shortcuts Row (Youthful & Dynamic Gradient Badges) ────────────────────
  shortcutsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 26,
  },
  shortcutItem: {
    alignItems: "center",
    width: (width - 32 - 36) / 4,
  },
  shortcutIconBox: {
    width: 58,
    height: 58,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary, // #9fe870 - Wise signature lime green from Image 2
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    ...Shadows.card,
  },
  shortcutLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0e0f0c", // Wise ink
    textAlign: "center",
    lineHeight: 14,
  },

  // ── Featured Section ───────────────────────────────────────────────────────
  featuredSection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.onSurface,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  trailScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  trailCard: {
    width: 220,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    overflow: "hidden",
    ...Shadows.card,
  },
  trailImageWrapper: {
    height: 120,
    width: "100%",
    position: "relative",
  },
  trailCardImage: {
    width: "100%",
    height: "100%",
  },
  priceTag: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(30, 35, 28, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  priceTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  trailCardBody: {
    padding: 12,
  },
  trailCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  trailCardRegion: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  trailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  trailMetaItem: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  trailMetaDivider: {
    fontSize: 10,
    color: Colors.surfaceContainerHighest,
  },
  advisoryCard: {
    marginHorizontal: 16,
    backgroundColor: "#fff9e6",
    borderWidth: 1,
    borderColor: "#fed018",
    borderRadius: Radius.lg,
    padding: 14,
    gap: 6,
  },
  advisoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  advisoryTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6f5900",
  },
  advisoryText: {
    fontSize: 11,
    color: "#4a3b1c",
    lineHeight: 16,
  },
  // ── New Trekker Empty & Live Feed Styles ────────────────────────────────────
  emptyBookingCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    ...Shadows.card,
  },
  emptyBookingIconBox: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyBookingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
    marginBottom: 6,
  },
  emptyBookingSub: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  exploreTripsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full,
    ...Shadows.card,
  },
  exploreTripsBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  feedLoadingBox: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  feedLoadingText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  emptyFeedBox: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyFeedText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
});