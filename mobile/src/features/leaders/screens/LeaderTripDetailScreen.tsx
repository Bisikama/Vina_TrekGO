import { Colors, Radius, Shadows } from "@/constants/theme";
import { TripGpsButton } from "@/components/trip/TripGpsButton";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import {
  getDestinations,
  getLeaderPublicTripById,
  getPickupPoints,
  getTripDiscoverySlots,
  updatePublicTrip,
  type LeaderPublicTrip,
  type TripDiscoverySlots,
} from "@/features/leaders/services/leader-public-trips.api";
import {
  fetchTripParticipants,
  performCheckIn,
  type CheckInStatus,
  type LeaderParticipantItem,
  type LeaderRosterResponse,
} from "@/features/check-in/services/leader-checkin.api";
import { getDayOfWeekName } from "@/features/leaders/utils/tripDateUtils";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function formatVnDate(dateStr?: string | null): string {
  if (!dateStr) return "Chưa cập nhật";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Chưa cập nhật";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return "Chưa cập nhật";
  }
}

function formatVnDateTime(dateStr?: string | null): string {
  if (!dateStr) return "Chưa cập nhật";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Chưa cập nhật";
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const dayName = getDayOfWeekName(d);
    return `${hours}:${mins} • ${dd}/${mm}/${yyyy} (${dayName})`;
  } catch {
    return "Chưa cập nhật";
  }
}

/** Format chuẩn đồng bộ với web: HH:mm dd/MM/yyyy */
function formatVnDateTimeShort(dateStr?: string | null): string {
  if (!dateStr) return "Chưa ghi nhận";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Chưa ghi nhận";
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${hours}:${mins} ${dd}/${mm}/${yyyy}`;
  } catch {
    return "Chưa ghi nhận";
  }
}

function getStatusBadge(status: string, registrationOpenAt?: string | null) {
  // OPEN nhưng chưa tới giờ mở nhận đăng ký → hiện cảnh báo thay vì "Đang mở đăng ký"
  if (status === "OPEN" && registrationOpenAt) {
    const openAt = new Date(registrationOpenAt);
    if (!isNaN(openAt.getTime()) && Date.now() < openAt.getTime()) {
      return { label: "Chưa tới hạn đăng ký", bg: "#fef3c7", color: "#92400e" };
    }
  }
  switch (status) {
    case "DRAFT":
      return { label: "Bản nháp", bg: "#f1f5f9", color: "#475569" };
    case "OPEN":
      return { label: "Đang mở đăng ký", bg: "#e2f6d5", color: "#054d28" };
    case "FULL":
      return { label: "Đã đủ chỗ", bg: "#e0f2fe", color: "#0369a1" };
    case "IN_PROGRESS":
      return { label: "Đang diễn ra", bg: "#fef9c3", color: "#854d0e" };
    case "COMPLETED":
      return { label: "Đã hoàn thành", bg: "#f3e8ff", color: "#6b21a8" };
    case "CANCEL_PENDING":
      return { label: "Chờ hủy", bg: "#fee2e2", color: "#991b1b" };
    case "CANCELLED":
      return { label: "Đã hủy", bg: "#fee2e2", color: "#991b1b" };
    default:
      return { label: status, bg: "#f1f5f9", color: "#475569" };
  }
}

function getBookingStatusStyle(status: string) {
  switch (status) {
    case "CONFIRMED":
    case "CHECKED_IN":
    case "COMPLETED":
      return { backgroundColor: "#e2f6d5", borderColor: "#86efac" };
    case "PARTIAL_CHECKIN":
      return { backgroundColor: "#fef9c3", borderColor: "#fde047" };
    case "NO_SHOW":
      return { backgroundColor: "#fee2e2", borderColor: "#fca5a5" };
    default:
      return { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" };
  }
}

function getCheckinStatusStyle(status: CheckInStatus) {
  switch (status) {
    case "CHECKED_IN":
      return { backgroundColor: "#e2f6d5", borderColor: "#86efac" };
    case "NO_SHOW":
      return { backgroundColor: "#fee2e2", borderColor: "#fca5a5" };
    case "NOT_CHECKED_IN":
    default:
      return { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" };
  }
}

function getCheckinStatusTextStyle(status: CheckInStatus) {
  switch (status) {
    case "CHECKED_IN":
      return { color: "#054d28" };
    case "NO_SHOW":
      return { color: "#ba1a1a" };
    case "NOT_CHECKED_IN":
    default:
      return { color: "#64748b" };
  }
}

export function LeaderTripDetailScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ tripId?: string; id?: string }>();
  const tripId = searchParams.tripId || searchParams.id;

  const { accessToken, user: authUser } = useAuth();
  const { user } = useApp();

  const [trip, setTrip] = useState<LeaderPublicTrip | null>(null);
  const [slots, setSlots] = useState<TripDiscoverySlots | null>(null);
  const [roster, setRoster] = useState<LeaderRosterResponse | null>(null);
  const [resolvedDestinationName, setResolvedDestinationName] = useState<string | null>(null);
  const [resolvedPickupName, setResolvedPickupName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab filter cho danh sách quân số
  const [participantFilter, setParticipantFilter] = useState<"ALL" | "NOT_CHECKED_IN" | "CHECKED_IN" | "NO_SHOW">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPerformingCheckin, setIsPerformingCheckin] = useState(false);

  // Modal thông báo quyết toán
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  // Tải dữ liệu chuyến đi
  const loadData = useCallback(async () => {
    if (!tripId || !accessToken) return;
    setError(null);
    try {
      const [tripRes, slotsRes, rosterRes] = await Promise.all([
        getLeaderPublicTripById(tripId, accessToken),
        getTripDiscoverySlots(tripId).catch(() => null),
        fetchTripParticipants(tripId).catch(() => null),
      ]);
      setTrip(tripRes);
      setSlots(slotsRes);
      setRoster(rosterRes);

      // Tra cứu tên Điểm đến và Điểm đón nếu API trả về ID
      if (tripRes.destinationId) {
        try {
          const dests = await getDestinations(accessToken, 1, 50);
          const matchedDest = dests.find((d) => d.id === tripRes.destinationId);
          if (matchedDest) {
            setResolvedDestinationName(matchedDest.name);
          }
          if (tripRes.pickupPointId) {
            const pickups = await getPickupPoints(tripRes.destinationId, accessToken, 1, 50);
            const matchedPickup = pickups.find((p) => p.id === tripRes.pickupPointId);
            if (matchedPickup) {
              setResolvedPickupName(matchedPickup.name);
            }
          }
        } catch {
          // ignore lookup error
        }
      }
    } catch (err: any) {
      setError(err?.message || "Không thể tải thông tin chuyến đi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId, accessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const insets = useSafeAreaInsets();

  // Đóng form đăng ký sớm
  const handleCloseFormEarly = () => {
    if (!trip || !accessToken) return;
    Alert.alert(
      "Đóng form đăng ký sớm",
      "Bạn có chắc chắn muốn đóng form nhận đăng ký sớm cho chuyến đi này không? Hệ thống sẽ ngừng nhận đơn đăng ký mới ngay lập tức.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng ý đóng form",
          style: "destructive",
          onPress: async () => {
            try {
              const nowIso = new Date().toISOString();
              await updatePublicTrip(
                trip.id,
                { expectedVersion: trip.version, registrationDeadlineAt: nowIso },
                accessToken,
              );
              Alert.alert("Thành công", "Đã đóng form nhận đăng ký sớm thành công.");
              await loadData();
            } catch (err: any) {
              Alert.alert("Lỗi", err?.message || "Không thể đóng form đăng ký.");
            }
          },
        },
      ]
    );
  };

  // Điểm danh thủ công thành viên
  const handleCheckInParticipant = async (participantId: string, status: "CHECKED_IN" | "NO_SHOW") => {
    if (!tripId) return;
    setIsPerformingCheckin(true);
    try {
      await performCheckIn(tripId, {
        participantId,
        method: "MANUAL",
        checkinStatus: status,
      });
      const updated = await fetchTripParticipants(tripId).catch(() => null);
      if (updated) setRoster(updated);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể cập nhật trạng thái điểm danh.");
    } finally {
      setIsPerformingCheckin(false);
    }
  };

  // Tính toán số liệu thống kê
  const totalCapacity = trip?.capacity || slots?.capacity || roster?.summary?.capacity || 15;
  const totalParticipants =
    roster?.summary?.totalParticipants ??
    (slots ? Math.max(0, slots.capacity - slots.remainingSlots) : 0);
  const checkedInCount = roster?.summary?.checkedInCount ?? 0;
  const notCheckedInCount =
    roster?.summary?.notCheckedInCount ?? Math.max(0, totalParticipants - checkedInCount);
  const noShowCount = roster?.summary?.noShowCount ?? 0;
  const progressPercent =
    roster?.summary?.progressPercent ??
    (totalParticipants > 0 ? Math.round((checkedInCount / totalParticipants) * 100) : 0);

  // Hạn chót tính toán dự phòng nếu backend trả về null (mặc định 2 ngày trước startAt lúc 07:00)
  const calculatedDeadline = useMemo(() => {
    if (trip?.registrationDeadlineAt) return trip.registrationDeadlineAt;
    if (!trip?.startAt) return null;
    try {
      const d = new Date(trip.startAt);
      d.setDate(d.getDate() - 2);
      d.setHours(7, 0, 0, 0);
      return d.toISOString();
    } catch {
      return null;
    }
  }, [trip?.registrationDeadlineAt, trip?.startAt]);

  // Danh sách thành viên và các tab đếm
  const rawParticipants: LeaderParticipantItem[] = roster?.items || [];
  const allCount = rawParticipants.length;
  const notCheckedCount = rawParticipants.filter((p) => p.checkinStatus === "NOT_CHECKED_IN").length;
  const checkedCount = rawParticipants.filter((p) => p.checkinStatus === "CHECKED_IN").length;
  const noShowFilterCount = rawParticipants.filter((p) => p.checkinStatus === "NO_SHOW").length;

  const filteredParticipants = useMemo(() => {
    let list = rawParticipants;
    if (participantFilter !== "ALL") {
      list = list.filter((p) => p.checkinStatus === participantFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.fullName?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.buyerDisplay?.toLowerCase().includes(q) ||
        p.buyerPhone?.toLowerCase().includes(q) ||
        p.bookingId?.toLowerCase().includes(q)
    );
  }, [rawParticipants, participantFilter, searchQuery]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            paddingLeft: Math.max(0, insets.left),
            paddingRight: Math.max(0, insets.right),
          },
        ]}
        edges={["top", "bottom", "left", "right"]}
      >
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0e0f0c" />
          <Text style={styles.loadingText}>Đang tải chi tiết chuyến đi...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !trip) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            paddingLeft: Math.max(0, insets.left),
            paddingRight: Math.max(0, insets.right),
          },
        ]}
        edges={["top", "bottom", "left", "right"]}
      >
        <View style={styles.centerLoading}>
          <Ionicons name="alert-circle-outline" size={48} color="#ba1a1a" />
          <Text style={styles.errorTitle}>Lỗi tải chuyến đi</Text>
          <Text style={styles.errorText}>{error || "Chuyến đi không tồn tại."}</Text>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={() => router.back()}>
            <Text style={styles.primaryActionBtnText}>Quay lại danh sách</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusBadge = getStatusBadge(trip.status, trip.registrationOpenAt);
  const trailSnapshot = trip.trails?.[0];
  const trailDifficulty = trailSnapshot?.snapshotDifficulty || trailSnapshot?.difficulty || "MEDIUM";
  const trailName = trailSnapshot?.snapshotName || trailSnapshot?.name || "HBS - La Bàn";
  const checkpointsList = (trip.checkpoints || [])
    .slice()
    .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));

  const destinationDisplayName =
    trip.destination?.name || resolvedDestinationName || "Khu vực trekking VFRS";
  const pickupDisplayName =
    trip.pickupPoint?.name || resolvedPickupName || "Điểm tập kết toàn đoàn";

  const coordinatesCount =
    trailSnapshot?.snapshotGeojson?.coordinates?.length ||
    (Array.isArray(trailSnapshot?.snapshotGeojson?.features) &&
      trailSnapshot.snapshotGeojson.features[0]?.geometry?.coordinates?.length) ||
    0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      {/* 1. Header & Actions Bar */}
      <View style={styles.header}>
        {/* Breadcrumb row */}
        <View style={styles.breadcrumbRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.breadcrumbText} numberOfLines={1}>
            Quản lý dẫn đoàn &gt; Chuyến đi của tôi &gt; {trip.title}
          </Text>
        </View>

        {/* Badges + Title + Subtitle */}
        <View style={styles.headerContent}>
          <View style={styles.badgeRow}>
            <View style={[styles.statusPill, { backgroundColor: statusBadge.bg }]}>
              <Text style={[styles.statusPillText, { color: statusBadge.color }]}>
                {statusBadge.label}
              </Text>
            </View>
            <View style={styles.trailPill}>
              <Text style={styles.trailPillText}>
                Cấp {trailDifficulty} · {trailName}
              </Text>
            </View>
          </View>
          <Text style={styles.tripTitle} numberOfLines={2}>
            {trip.title}
          </Text>
          <Text style={styles.tripMeta} numberOfLines={1}>
            {formatVnDate(trip.startAt)} - {formatVnDate(trip.endAt)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="person-outline" size={13} color="#054d28" />
              <Text style={{ fontSize: 12, color: "#4b5563", fontWeight: "600" }}>
                {authUser?.fullName || (authUser as any)?.name || (user as any)?.fullName || (user as any)?.name || (trip as any)?.leader?.fullName || "Leader"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="location-outline" size={13} color="#054d28" />
              <Text style={{ fontSize: 12, color: "#4b5563", fontWeight: "600" }}>
                {pickupDisplayName}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons Bar matching web buttons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsBar}
        >
          {/* Nút 1: Chỉnh sửa & Hạn đóng form */}
          <TouchableOpacity
            style={styles.toolBtnOutline}
            onPress={() =>
              router.push({
                pathname: "/field-operations/leader-trip-edit" as any,
                params: { tripId: trip.id },
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={15} color="#334155" />
            <Text style={styles.toolBtnOutlineText}>Chỉnh sửa & Hạn đóng form</Text>
          </TouchableOpacity>

          {/* Nút 2: Quyết toán */}
          <TouchableOpacity
            style={styles.toolBtnOutline}
            onPress={() => setShowSettlementModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="receipt-outline" size={15} color="#334155" />
            <Text style={styles.toolBtnOutlineText}>Quyết toán</Text>
          </TouchableOpacity>

          {/* Nút 3: Đóng form đăng ký sớm */}
          <TouchableOpacity
            style={styles.toolBtnAmber}
            onPress={handleCloseFormEarly}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed-outline" size={15} color="#b45309" />
            <Text style={styles.toolBtnAmberText}>Đóng form đăng ký sớm</Text>
          </TouchableOpacity>

          {/* Nút 4: Bắt đầu hành trình */}
          <TouchableOpacity
            style={styles.toolBtnStart}
            onPress={() => router.push("/field-operations/leader-pretrip" as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={15} color="#ffffff" />
            <Text style={styles.toolBtnStartText}>Bắt đầu hành trình</Text>
          </TouchableOpacity>

          {/* Nút 5: Điểm danh QR */}
          <TouchableOpacity
            style={styles.toolBtnCheckIn}
            onPress={() =>
              router.push({
                pathname: "/field-operations/leader-checkin" as any,
                params: { tripId: trip.id },
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={15} color="#054d28" />
            <Text style={styles.toolBtnCheckInText}>Điểm danh QR</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(40, insets.bottom + 28) },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0e0f0c"]} />
        }
      >
        {/* MỤC 1 · KẾ HOẠCH & QUY SỐ ĐĂNG KÝ */}
        <View style={styles.webSectionCard}>
          <View style={styles.webSectionCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.webSectionCategoryGreen}>MỤC 1 · KẾ HOẠCH & QUY SỐ ĐĂNG KÝ</Text>
              <Text style={styles.webSectionTitle}>Lịch trình Dự kiến & Hạn Đóng/Mở Form</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/field-operations/leader-trip-edit" as any,
                  params: { tripId: trip.id },
                })
              }
              style={styles.adjustDeadlineBtn}
            >
              <Text style={styles.adjustDeadlineText}>Điều chỉnh hạn đóng form →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid2x2}>
            {/* Box 1: Giờ mở nhận đăng ký */}
            <View style={styles.gridBox}>
              <Text style={styles.gridBoxLabel}>Giờ mở nhận đăng ký (dự kiến)</Text>
              <Text style={styles.gridBoxValue}>
                {formatVnDateTimeShort(trip.registrationOpenAt || trip.publishedAt || trip.startAt)}
              </Text>
            </View>

            {/* Box 2: Hạn chót đóng form (Tô vàng nổi bật giống web) */}
            <View style={[styles.gridBox, styles.gridBoxAmber]}>
              <Text style={styles.gridBoxLabelAmber}>Hạn chót đóng form (Tự động đóng sổ)</Text>
              <Text style={styles.gridBoxValueAmber}>
                {formatVnDateTimeShort(trip.registrationDeadlineAt || calculatedDeadline)}
              </Text>
              <Text style={styles.gridBoxSubAmber}>Mặc định trước 2 ngày, tối thiểu trước 1 ngày</Text>
            </View>

            {/* Box 3: Khởi hành dự kiến */}
            <View style={styles.gridBox}>
              <Text style={styles.gridBoxLabel}>Khởi hành dự kiến</Text>
              <Text style={styles.gridBoxValue}>{formatVnDateTimeShort(trip.startAt)}</Text>
            </View>

            {/* Box 4: Giờ kết thúc dự kiến */}
            <View style={styles.gridBox}>
              <Text style={styles.gridBoxLabel}>Giờ kết thúc dự kiến</Text>
              <Text style={styles.gridBoxValue}>{formatVnDateTimeShort(trip.endAt)}</Text>
            </View>
          </View>
        </View>

        {/* MỤC 2 · DẤU THỜI GIAN LUỒNG THỰC TẾ */}
        <View style={styles.webSectionCard}>
          <View style={styles.webSectionCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.webSectionCategoryAmber}>MỤC 2 · DẤU THỜI GIAN LUỒNG THỰC TẾ</Text>
              <Text style={styles.webSectionTitle}>Timeline Vận hành Thực tế (Actual Lifecycle)</Text>
            </View>
            <View style={styles.autoRecordedBadge}>
              <Text style={styles.autoRecordedBadgeText}>Tự động ghi nhận theo hành động</Text>
            </View>
          </View>

          <View style={styles.grid2x2}>
            {/* 1. Công khai mở bán */}
            <View style={styles.lifecycleBox}>
              <Text style={styles.lifecycleBoxTitle}>1. Công khai mở bán (publishedAt)</Text>
              <Text style={styles.lifecycleBoxValue}>
                {formatVnDateTimeShort(trip.publishedAt || roster?.trip?.publishedAt)}
              </Text>
            </View>

            {/* 2. Đóng sổ đăng ký thực tế */}
            <View style={styles.lifecycleBox}>
              <Text style={styles.lifecycleBoxTitle}>2. Đóng sổ đăng ký thực tế (closedAt)</Text>
              <Text style={styles.lifecycleBoxValue}>
                {formatVnDateTimeShort(roster?.trip?.closedAt)}
              </Text>
            </View>

            {/* 3. Xuất phát thực tế */}
            <View style={styles.lifecycleBox}>
              <Text style={styles.lifecycleBoxTitle}>3. Xuất phát thực tế (startedAt)</Text>
              <Text style={styles.lifecycleBoxValue}>
                {formatVnDateTimeShort(roster?.trip?.startedAt)}
              </Text>
            </View>

            {/* 4. Hoàn thành thực tế */}
            <View style={styles.lifecycleBox}>
              <Text style={styles.lifecycleBoxTitle}>4. Hoàn thành thực tế (completedAt)</Text>
              <Text style={styles.lifecycleBoxValue}>
                {formatVnDateTimeShort(roster?.trip?.completedAt)}
              </Text>
            </View>
          </View>
        </View>

        {/* 4 THẺ THỐNG KÊ QUÂN SỐ VẬN HÀNH (METRIC CARDS) */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            {/* Card 1: QUÂN SỐ ĐÃ ĐĂNG KÝ */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>QUÂN SỐ ĐÃ ĐĂNG KÝ</Text>
              <Text style={styles.metricValue}>
                {totalParticipants} <Text style={styles.metricValueSub}>/ {totalCapacity}</Text>
              </Text>
            </View>

            {/* Card 2: TIẾN ĐỘ TẬP KẾT */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>TIẾN ĐỘ TẬP KẾT</Text>
              <Text style={[styles.metricValue, { color: "#0284c7" }]}>
                {progressPercent}%
              </Text>
              <Text style={styles.metricSub}>
                {checkedInCount}/{totalParticipants} thành viên đã có mặt
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            {/* Card 3: CHECK-IN THỰC ĐỊA */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>CHECK-IN THỰC ĐỊA</Text>
              <Text style={[styles.metricValue, { color: "#054d28" }]}>
                {checkedInCount} <Text style={styles.metricValueSub}>/ {totalParticipants}</Text>
              </Text>
              <Text style={styles.metricSub}>
                Chưa tới: {notCheckedInCount} · Vắng: {noShowCount}
              </Text>
            </View>

            {/* Card 4: VẮNG MẶT (NO-SHOW) */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>VẮNG MẶT (NO-SHOW)</Text>
              <Text style={[styles.metricValue, { color: "#ba1a1a" }]}>
                {noShowCount}
              </Text>
              <Text style={[styles.metricSub, { color: "#ba1a1a" }]}>
                Chốt số khi bấm xuất phát tour
              </Text>
            </View>
          </View>
        </View>

        {/* DANH SÁCH THÀNH VIÊN & QUÂN SỐ */}
        <View style={styles.webSectionCard}>
          <View style={styles.rosterHeader}>
            <Text style={styles.rosterTitle}>Danh sách Thành viên & Quân số</Text>
            <Text style={styles.rosterSubtitle}>
              Thông tin liên lạc, người đi cùng, điểm đón và trạng thái check-in thời gian thực
            </Text>
          </View>

          {/* Filter Tabs matching web */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rosterTabsRow}
          >
            <TouchableOpacity
              style={[styles.rosterTab, participantFilter === "ALL" && styles.rosterTabActive]}
              onPress={() => setParticipantFilter("ALL")}
            >
              <Text
                style={[
                  styles.rosterTabText,
                  participantFilter === "ALL" && styles.rosterTabTextActive,
                ]}
              >
                Tất cả ({allCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.rosterTab,
                participantFilter === "NOT_CHECKED_IN" && styles.rosterTabActive,
              ]}
              onPress={() => setParticipantFilter("NOT_CHECKED_IN")}
            >
              <Text
                style={[
                  styles.rosterTabText,
                  participantFilter === "NOT_CHECKED_IN" && styles.rosterTabTextActive,
                ]}
              >
                Chưa đến ({notCheckedCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.rosterTab,
                participantFilter === "CHECKED_IN" && styles.rosterTabActive,
              ]}
              onPress={() => setParticipantFilter("CHECKED_IN")}
            >
              <Text
                style={[
                  styles.rosterTabText,
                  participantFilter === "CHECKED_IN" && styles.rosterTabTextActive,
                ]}
              >
                Đã đến ({checkedCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rosterTab, participantFilter === "NO_SHOW" && styles.rosterTabActive]}
              onPress={() => setParticipantFilter("NO_SHOW")}
            >
              <Text
                style={[
                  styles.rosterTabText,
                  participantFilter === "NO_SHOW" && styles.rosterTabTextActive,
                ]}
              >
                Vắng mặt ({noShowFilterCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Search Box */}
          <View style={styles.rosterSearchBox}>
            <Ionicons name="search-outline" size={16} color="#64748b" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm tên, SĐT, người đặt..."
              placeholderTextColor="#94a3b8"
              style={styles.rosterSearchInput}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Empty State hoặc danh sách thành viên */}
          {filteredParticipants.length === 0 ? (
            <View style={styles.webEmptyStateCard}>
              <View style={styles.webEmptyIconCircle}>
                <Ionicons name="people-outline" size={32} color="#64748b" />
              </View>
              <Text style={styles.webEmptyStateTitle}>
                Chưa có thành viên nào đặt chỗ cho chuyến đi này
              </Text>
              <Text style={styles.webEmptyStateSub}>
                Khi có khách đăng ký và thanh toán thành công, danh sách sẽ tự động hiển thị tại đây.
              </Text>
            </View>
          ) : (
            <View style={styles.participantList}>
              {filteredParticipants.map((item) => (
                <View key={item.id} style={styles.participantCard}>
                  {/* Top Bar Trekker */}
                  <View style={styles.participantHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <Text style={styles.participantFullName}>{item.fullName}</Text>
                        <View
                          style={[
                            styles.bookingStatusPill,
                            getBookingStatusStyle(item.bookingStatus),
                          ]}
                        >
                          <Text style={styles.bookingStatusText}>{item.bookingStatus}</Text>
                        </View>
                        {item.isLinkedAccount ? (
                          <View style={styles.linkedBadge}>
                            <Text style={styles.linkedBadgeText}>Đã liên kết</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.participantBookingCode}>
                        Mã đơn: #{item.bookingId.slice(0, 8)}
                      </Text>
                    </View>

                    {/* Checkin Status Badge */}
                    <View
                      style={[styles.checkinStatusPill, getCheckinStatusStyle(item.checkinStatus)]}
                    >
                      <Text
                        style={[
                          styles.checkinStatusText,
                          getCheckinStatusTextStyle(item.checkinStatus),
                        ]}
                      >
                        {item.checkinStatus === "CHECKED_IN"
                          ? "ĐÃ ĐẾN"
                          : item.checkinStatus === "NO_SHOW"
                          ? "VẮNG MẶT"
                          : "CHƯA ĐẾN"}
                      </Text>
                    </View>
                  </View>

                  {/* Bảng thông tin chi tiết */}
                  <View style={styles.participantDetailsTable}>
                    <View style={styles.participantDetailRow}>
                      <Text style={styles.participantDetailLabel}>LIÊN LẠC & NGƯỜI MUA</Text>
                      <Text style={styles.participantDetailValue}>
                        {item.phone || "Chưa có SĐT"} · Người mua: {item.buyerDisplay} (
                        {item.buyerPhone || "—"})
                      </Text>
                    </View>

                    <View style={styles.participantDetailRow}>
                      <Text style={styles.participantDetailLabel}>LIÊN HỆ KHẨN CẤP</Text>
                      <Text style={styles.participantDetailValue}>
                        {item.emergencyContactName
                          ? `${item.emergencyContactName} (${item.emergencyContactPhone || "Không có SĐT"})`
                          : "Chưa cập nhật"}
                      </Text>
                    </View>

                    <View style={styles.participantDetailRow}>
                      <Text style={styles.participantDetailLabel}>NGÀY SINH / CCCD</Text>
                      <Text style={styles.participantDetailValue}>
                        {formatVnDate(item.dateOfBirth)} · CCCD:{" "}
                        {item.idDocumentNo || "Chưa khai báo"}
                      </Text>
                    </View>

                    <View style={styles.participantDetailRow}>
                      <Text style={styles.participantDetailLabel}>ĐIỂM ĐÓN TẬP KẾT</Text>
                      <Text style={styles.participantDetailValue}>
                        {item.pickupPoint?.name || item.pickupPoint?.address || pickupDisplayName}
                      </Text>
                    </View>

                    {item.checkedInAt ? (
                      <View style={styles.participantDetailRow}>
                        <Text style={styles.participantDetailLabel}>CHECK-IN THỰC TẾ</Text>
                        <Text style={styles.participantDetailValue}>
                          {formatVnDateTimeShort(item.checkedInAt)} ({item.checkinMethod || "MANUAL"}
                          )
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Thanh nút thao tác nhanh */}
                  <View style={styles.participantActionRow}>
                    {item.checkinStatus !== "CHECKED_IN" ? (
                      <TouchableOpacity
                        style={styles.pActionBtnCheckin}
                        onPress={() => handleCheckInParticipant(item.id, "CHECKED_IN")}
                        disabled={isPerformingCheckin}
                      >
                        <Ionicons name="checkmark-circle-outline" size={15} color="#054d28" />
                        <Text style={styles.pActionBtnCheckinText}>Điểm danh có mặt</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.pActionBtnDone}>
                        <Ionicons name="checkmark-done" size={15} color="#054d28" />
                        <Text style={styles.pActionBtnDoneText}>Đã điểm danh</Text>
                      </View>
                    )}

                    {item.checkinStatus !== "NO_SHOW" ? (
                      <TouchableOpacity
                        style={styles.pActionBtnNoShow}
                        onPress={() => handleCheckInParticipant(item.id, "NO_SHOW")}
                        disabled={isPerformingCheckin}
                      >
                        <Ionicons name="close-circle-outline" size={15} color="#ba1a1a" />
                        <Text style={styles.pActionBtnNoShowText}>Báo vắng mặt</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 5. Cung đường thẩm định (System Trail) */}
        <View style={styles.webSectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="trail-sign-outline" size={18} color="#0e0f0c" />
              <Text style={styles.sectionTitle} numberOfLines={1}>Cung đường thẩm định</Text>
            </View>
            <View style={styles.sectionHeaderBadge}>
              <Text style={styles.sectionHeaderBadgeText}>CHUẨN VFRS</Text>
            </View>
          </View>

          <View style={styles.trailCardDetail}>
            <View style={styles.trailTitleRow}>
              <View style={styles.trailIconCircle}>
                <Ionicons name="trail-sign" size={20} color="#0e0f0c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trailDetailName}>{trailName}</Text>
                <Text style={styles.trailDetailSub}>
                  Hành trình {destinationDisplayName} · Chuẩn an toàn VFRS
                </Text>
              </View>
            </View>

            <View style={styles.trailSpecsGrid}>
              <View style={styles.trailSpecItem}>
                <Text style={styles.specLabel}>CỰ LY</Text>
                <Text style={styles.specValue}>{trailSnapshot?.snapshotDistanceKm || 5} km</Text>
              </View>
              <View style={styles.trailSpecItem}>
                <Text style={styles.specLabel}>ĐỘ DỐC / ĐỈNH</Text>
                <Text style={styles.specValue}>
                  +{trailSnapshot?.snapshotElevationGainM || 500}m
                </Text>
              </View>
              <View style={styles.trailSpecItem}>
                <Text style={styles.specLabel}>ĐỘ KHÓ</Text>
                <Text style={[styles.specValue, { color: "#b45309" }]}>{trailDifficulty}</Text>
              </View>
              <View style={styles.trailSpecItem}>
                <Text style={styles.specLabel}>TỌA ĐỘ GPS</Text>
                <Text style={styles.specValue}>
                  {coordinatesCount > 0 ? `${coordinatesCount} điểm` : "Đã nạp"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 6. Checkpoints an toàn VFRS */}
        <View style={styles.webSectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="flag-outline" size={18} color="#0e0f0c" />
              <Text style={styles.sectionTitle} numberOfLines={1}>Trạm dừng & Checkpoints</Text>
            </View>
            <View style={styles.sectionHeaderBadge}>
              <Text style={styles.sectionHeaderBadgeText}>
                {checkpointsList.length} MỐC BẮT BUỘC
              </Text>
            </View>
          </View>

          {checkpointsList.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có thông tin trạm dừng.</Text>
          ) : (
            <View style={styles.checkpointTimeline}>
              {checkpointsList.map((cp, idx) => (
                <View key={cp.id || cp.sourceCheckpointId || idx} style={styles.cpTimelineItem}>
                  <View style={styles.cpDotCircle}>
                    <Text style={styles.cpDotNum}>{cp.sequence || idx + 1}</Text>
                  </View>
                  <View style={styles.cpInfoBox}>
                    <View style={styles.cpNameHeaderRow}>
                      <Text style={styles.cpNameText}>{cp.name}</Text>
                      <View style={styles.cpPillRow}>
                        {cp.isRequired !== false && (
                          <View style={styles.cpRequiredPill}>
                            <Ionicons name="shield-checkmark" size={10} color="#0e0f0c" />
                            <Text style={styles.cpRequiredPillText}>Bắt buộc</Text>
                          </View>
                        )}
                        {cp.isEnabled !== false && (
                          <View style={styles.cpEnabledPill}>
                            <Text style={styles.cpEnabledPillText}>Hoạt động</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.cpDetailText}>
                      Tọa độ: {Number(cp.latitude).toFixed(4)}, {Number(cp.longitude).toFixed(4)} · Bán
                      kính quét: {cp.radiusMeters || 50}m
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 7. Khối Cơ cấu giá vé (Price Explanation) */}
        <View style={styles.webSectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="receipt-outline" size={18} color="#0e0f0c" />
              <Text style={styles.sectionTitle}>GIẢI THÍCH CƠ CẤU GIÁ VÉ</Text>
            </View>
          </View>

          <View style={styles.pricingCard}>
            <View style={styles.pricingHeader}>
              <Ionicons name="pricetag-outline" size={16} color="#0e0f0c" />
              <Text style={styles.pricingTitle}>
                Giá niêm yết: {Number(trip.price || trip.pricePerPax || 0).toLocaleString("vi-VN")} đ /
                người
              </Text>
            </View>
            <Text style={styles.priceExplLabel}>Cơ sở tính giá & Giải trình cấu trúc chi phí:</Text>
            {(() => {
              const raw = trip.priceExplanation;
              if (!raw) {
                return (
                  <View style={styles.priceExplEmpty}>
                    <Text style={styles.priceExplEmptyText}>Chưa có nội dung giải trình chi tiết.</Text>
                  </View>
                );
              }

              const formatMoney = (valStr: string) => {
                return valStr.replace(/(\d+)\s*VND/gi, (_, num) => {
                  return `${Number(num).toLocaleString("vi-VN")} đ`;
                });
              };

              const rawItems = raw.split("|").map((s) => s.trim()).filter(Boolean);
              if (rawItems.length > 1) {
                const parsed = rawItems.map((item) => {
                  const clean = item.replace(/^\[.*?\]\s*/, "");
                  const colonIdx = clean.indexOf(":");
                  let label = colonIdx > 0 ? clean.slice(0, colonIdx).trim() : "";
                  let value = colonIdx > 0 ? clean.slice(colonIdx + 1).trim() : clean;

                  value = formatMoney(value);

                  let subInfo: string | null = null;
                  if (value.includes(" + ")) {
                    const plusParts = value.split(" + ");
                    value = plusParts[0].trim();
                    subInfo = `+ ${plusParts.slice(1).join(" + ").trim()}`;
                  }

                  const isProfit = /lợi nhuận/i.test(label);
                  return { label, value, subInfo, isProfit };
                });

                return (
                  <View style={styles.breakdownCard}>
                    {parsed.map((item, index) => {
                      if (item.isProfit) {
                        return (
                          <View key={index} style={styles.profitHighlightBox}>
                            <View style={styles.profitHeaderRow}>
                              <Ionicons name="trending-up" size={16} color="#054d28" />
                              <Text style={styles.profitLabel}>{item.label}</Text>
                            </View>
                            <Text style={styles.profitValue}>{item.value}</Text>
                          </View>
                        );
                      }

                      return (
                        <View
                          key={index}
                          style={[
                            styles.breakdownRow,
                            index > 0 && styles.breakdownRowBorder,
                          ]}
                        >
                          <View style={styles.breakdownLeftCol}>
                            <View style={styles.breakdownTitleRow}>
                              <View style={styles.breakdownDot} />
                              <Text style={styles.breakdownLabel}>{item.label}</Text>
                            </View>
                            {item.subInfo ? (
                              <Text style={styles.breakdownSubInfo}>{item.subInfo}</Text>
                            ) : null}
                          </View>
                          <Text style={styles.breakdownValue}>{item.value}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              }

              return (
                <View style={styles.priceExplContentBox}>
                  <Text style={styles.priceExplText}>{raw}</Text>
                </View>
              );
            })()}
          </View>
        </View>

        {/* 8. Đội ngũ dẫn đường & An toàn VFRS */}
        <View style={styles.webSectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#0e0f0c" />
              <Text style={styles.sectionTitle}>ĐỘI NGŨ DẪN ĐƯỜNG & AN TOÀN VFRS</Text>
            </View>
          </View>
          <View style={styles.rescueCard}>
            <Text style={styles.rescueItem}>
              • Phụ trách chính: Mountain Leader {authUser?.name || user?.name || "TrekGo Leader"} (ID:{" "}
              {trip.leaderId?.slice(0, 8) || "LEADER"}).
            </Text>
            <Text style={styles.rescueItem}>
              • Kênh liên lạc vô tuyến: Bộ đàm tần số VHF/UHF Kênh 04 (433.175 MHz).
            </Text>
            <Text style={styles.rescueItem}>
              • Trang bị y tế: Túi sơ cấp cứu cứu thương VFRS Kit Pro + Nẹp định hình chấn thương.
            </Text>
            <Text style={styles.rescueHotline}>
              • Hotline Cứu hộ phản ứng nhanh VFRS: 1800 9988 (Trực 24/7).
            </Text>
          </View>
        </View>

        {/* Nút định vị GPS thực địa */}
        <View style={{ marginVertical: 8 }}>
          <TripGpsButton
            tripId={trip.id}
            tripType="PUBLIC"
            tripTitle={trip.title}
            tripStatus={trip.status}
          />
        </View>
      </ScrollView>

      {/* MODAL: QUYẾT TOÁN CHUYẾN ĐI */}
      <Modal visible={showSettlementModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="receipt" size={24} color="#0e0f0c" />
              <Text style={[styles.modalTitle, { color: "#0e0f0c" }]}>
                Hồ sơ quyết toán chuyến đi
              </Text>
            </View>
            <Text style={styles.settlementText}>
              Doanh thu dự kiến:{" "}
              {(Number(trip.price || 0) * totalCapacity).toLocaleString("vi-VN")} đ.
            </Text>
            <Text style={styles.settlementText}>
              Hệ thống sẽ tự động tính toán đối soát phí dịch vụ VFRS (5%) và giải ngân vào tài khoản
              ngân hàng của Leader sau khi chuyến đi hoàn tất.
            </Text>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { marginTop: 16 }]}
              onPress={() => setShowSettlementModal(false)}
            >
              <Text style={styles.primaryActionBtnText}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#707972",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ba1a1a",
  },
  errorText: {
    fontSize: 13,
    color: "#410002",
    textAlign: "center",
  },
  primaryActionBtn: {
    backgroundColor: "#0e0f0c",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: "center",
  },
  primaryActionBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  scrollContent: {
    padding: 14,
    gap: 14,
  },

  // Header
  header: {
    backgroundColor: "#ffffff",
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  breadcrumbText: {
    flex: 1,
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  headerContent: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  trailPill: {
    backgroundColor: "#fef9c3",
    borderWidth: 1,
    borderColor: "#fef08a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trailPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#854d0e",
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 2,
  },
  tripMeta: {
    fontSize: 12,
    color: "#64748b",
  },

  // Actions Bar
  actionsBar: {
    paddingHorizontal: 14,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  toolBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  toolBtnOutlineText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
  },
  toolBtnAmber: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  toolBtnAmberText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#b45309",
  },
  toolBtnStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0e0f0c",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  toolBtnStartText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#ffffff",
  },
  toolBtnCheckIn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#e2f6d5",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  toolBtnCheckInText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#054d28",
  },

  // Web Section Card Base
  webSectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
    ...Shadows.card,
  },
  webSectionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  webSectionCategoryGreen: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803d",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  webSectionCategoryAmber: {
    fontSize: 11,
    fontWeight: "800",
    color: "#b45309",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  webSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  adjustDeadlineBtn: {
    paddingVertical: 2,
  },
  adjustDeadlineText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284c7",
  },
  autoRecordedBadge: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  autoRecordedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1d4ed8",
  },

  // 2x2 Grid (for Mục 1 & Mục 2)
  grid2x2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridBox: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: Radius.sm,
    padding: 10,
    justifyContent: "center",
  },
  gridBoxLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 4,
    fontWeight: "500",
  },
  gridBoxValue: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0f172a",
  },
  gridBoxAmber: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde047",
  },
  gridBoxLabelAmber: {
    fontSize: 11,
    color: "#b45309",
    marginBottom: 4,
    fontWeight: "700",
  },
  gridBoxValueAmber: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#b45309",
  },
  gridBoxSubAmber: {
    fontSize: 9.5,
    color: "#92400e",
    marginTop: 4,
    fontStyle: "italic",
  },

  // Lifecycle Milestone Boxes
  lifecycleBox: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: Radius.sm,
    padding: 10,
    justifyContent: "center",
  },
  lifecycleBoxTitle: {
    fontSize: 11,
    color: "#475569",
    marginBottom: 4,
    fontWeight: "600",
  },
  lifecycleBoxValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },

  // 4 Metric Cards
  metricsContainer: {
    gap: 10,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: Radius.sm,
    padding: 12,
    justifyContent: "center",
    ...Shadows.card,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  metricValueSub: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
  },
  metricSub: {
    fontSize: 10.5,
    color: "#64748b",
    fontWeight: "500",
  },

  // Roster section
  rosterHeader: {
    gap: 2,
  },
  rosterTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
  },
  rosterSubtitle: {
    fontSize: 11.5,
    color: "#64748b",
  },
  rosterTabsRow: {
    gap: 6,
    paddingVertical: 2,
  },
  rosterTab: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  rosterTabActive: {
    backgroundColor: "#0e0f0c",
  },
  rosterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  rosterTabTextActive: {
    color: "#ffffff",
  },
  rosterSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rosterSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    padding: 0,
  },

  // Empty state
  webEmptyStateCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: Radius.sm,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginVertical: 4,
  },
  webEmptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  webEmptyStateTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  webEmptyStateSub: {
    fontSize: 11.5,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 16,
  },

  // Participant list & card
  participantList: {
    gap: 10,
  },
  participantCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: Radius.sm,
    padding: 12,
    gap: 10,
  },
  participantHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  participantFullName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  bookingStatusPill: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bookingStatusText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#0f172a",
  },
  linkedBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  linkedBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#1e40af",
  },
  participantBookingCode: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  checkinStatusPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  checkinStatusText: {
    fontSize: 10.5,
    fontWeight: "800",
  },

  // Participant Details Table
  participantDetailsTable: {
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 8,
    gap: 6,
  },
  participantDetailRow: {
    gap: 2,
  },
  participantDetailLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.3,
  },
  participantDetailValue: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "500",
  },

  // Participant Action Row
  participantActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  pActionBtnCheckin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e2f6d5",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  pActionBtnCheckinText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#054d28",
  },
  pActionBtnDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pActionBtnDoneText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#054d28",
  },
  pActionBtnNoShow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  pActionBtnNoShowText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#ba1a1a",
  },

  // System Trail
  sectionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800",
    color: "#0e0f0c",
    textTransform: "uppercase",
  },
  sectionHeaderBadge: {
    flexShrink: 0,
    backgroundColor: "#e2f6d5",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sectionHeaderBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#054d28",
  },
  trailCardDetail: {
    gap: 12,
  },
  trailTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trailIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  trailDetailName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0f172a",
  },
  trailDetailSub: {
    fontSize: 11.5,
    color: "#64748b",
  },
  trailSpecsGrid: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    padding: 10,
  },
  trailSpecItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  specLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#64748b",
  },
  specValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },

  // Checkpoints
  emptyText: {
    fontSize: 12.5,
    color: "#64748b",
  },
  checkpointTimeline: {
    gap: 10,
  },
  cpTimelineItem: {
    flexDirection: "row",
    gap: 10,
  },
  cpDotCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0e0f0c",
    alignItems: "center",
    justifyContent: "center",
  },
  cpDotNum: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
  },
  cpInfoBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 8,
    gap: 4,
  },
  cpNameHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cpNameText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  cpPillRow: {
    flexDirection: "row",
    gap: 4,
  },
  cpRequiredPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#e2f6d5",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cpRequiredPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#054d28",
  },
  cpEnabledPill: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cpEnabledPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0369a1",
  },
  cpDetailText: {
    fontSize: 11,
    color: "#64748b",
  },

  // Pricing
  pricingCard: {
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    padding: 12,
    gap: 6,
  },
  pricingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pricingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0e0f0c",
  },
  priceExplLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#475569",
    marginTop: 2,
  },
  breakdownCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 6,
  },
  breakdownRow: {
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  breakdownRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  breakdownLeftCol: {
    flex: 1,
    paddingRight: 6,
  },
  breakdownTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  breakdownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#94a3b8",
  },
  breakdownLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#475569",
    flexShrink: 1,
  },
  breakdownSubInfo: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 3,
    marginLeft: 13,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "right",
    flexShrink: 0,
  },
  profitHighlightBox: {
    backgroundColor: "#e2f6d5",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  profitHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  profitLabel: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#054d28",
  },
  profitValue: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#054d28",
    textAlign: "right",
  },
  priceExplEmpty: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  priceExplEmptyText: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  priceExplContentBox: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
  },
  priceExplText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },

  // Rescue
  rescueCard: {
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    padding: 12,
    gap: 6,
  },
  rescueItem: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  rescueHotline: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ba1a1a",
    lineHeight: 18,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    width: "100%",
    maxWidth: 400,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  settlementText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
  },
});
