import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import { LeaderTripList } from "@/features/leaders/components";
import { useLeaderTrips } from "@/features/leaders/hooks";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface LeaderDashboardScreenProps {
  onNavigateTab?: (tabKey: "trips" | "create" | "profile") => void;
}

function formatTripDates(startAt?: string, endAt?: string) {
  if (!startAt) return "Chưa cập nhật";
  try {
    const s = new Date(startAt);
    const e = endAt ? new Date(endAt) : null;
    const startStr = `${s.getDate().toString().padStart(2, "0")}/${(s.getMonth() + 1).toString().padStart(2, "0")}`;
    if (!e) return startStr;
    const endStr = `${e.getDate().toString().padStart(2, "0")}/${(e.getMonth() + 1).toString().padStart(2, "0")}.${e.getFullYear()}`;
    return `${startStr} – ${endStr}`;
  } catch {
    return "Chưa cập nhật";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return { label: "Bản nháp", bg: "#f1f5f9", color: "#475569" };
    case "OPEN":
      return { label: "Đang mở nhận khách", bg: "#dcfce7", color: "#166534" };
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

export function LeaderDashboardScreen({ onNavigateTab }: LeaderDashboardScreenProps = {}) {
  const router = useRouter();
  const { user } = useApp();
  const { user: authUser, accessToken } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const {
    trips: leaderTrips,
    loading: loadingTrips,
    fetchMyTrips,
    cancelTrip,
  } = useLeaderTrips(accessToken);

  const handleCancelTrip = async (
    tripId: string,
    version: number,
    reason: string,
  ) => {
    await cancelTrip(tripId, { expectedVersion: version, reason });
  };

  useEffect(() => {
    if (accessToken) {
      void fetchMyTrips();
    }
  }, [accessToken, fetchMyTrips]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyTrips();
    setRefreshing(false);
  }, [fetchMyTrips]);

  // Thống kê dựa trên dữ liệu thật từ API
  const totalTrips = leaderTrips.length;
  const openTrips = leaderTrips.filter((t) => t.status === "OPEN").length;
  const totalCapacity = leaderTrips.reduce((acc, t) => acc + (t.capacity || 0), 0);
  const totalRevenue = leaderTrips.reduce(
    (acc, t) => acc + Number(t.price || 0) * (t.capacity || 0),
    0
  );

  // Chuyến đi tiêu biểu ghim đầu: ưu tiên IN_PROGRESS, sau đó OPEN, hoặc chuyến mới nhất
  const highlightTrip = useMemo(() => {
    if (leaderTrips.length === 0) return null;
    return (
      leaderTrips.find((t) => t.status === "IN_PROGRESS") ||
      leaderTrips.find((t) => t.status === "OPEN") ||
      leaderTrips[0]
    );
  }, [leaderTrips]);

  const displayName = authUser?.fullName || authUser?.name || user?.name || "Mountain Leader";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryDark}
            colors={[Colors.primaryDark]}
          />
        }
      >
        {/* Header hiện đại */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <View style={styles.roleTag}>
              <View style={styles.roleDot} />
              <Text style={styles.roleTagText}>MOUNTAIN LEADER VFRS</Text>
            </View>
            <Text style={styles.heading}>Xin chào, {displayName}</Text>
            <Text style={styles.subheading}>Trạm điều hành & giám sát chuyến đi</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            activeOpacity={0.7}
            accessibilityLabel="Làm mới dữ liệu"
          >
            {loadingTrips && !refreshing ? (
              <ActivityIndicator size="small" color={Colors.primaryDark} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color={Colors.primaryDark} />
            )}
          </TouchableOpacity>
        </View>

        {/* Lưới thống kê thực tế từ API */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: "#eaf5e1" }]}>
              <Ionicons name="trail-sign-outline" size={17} color={Colors.primaryDark} />
            </View>
            <Text style={styles.statNumber}>{totalTrips}</Text>
            <Text style={styles.statLabel}>Tổng chuyến</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: "#dcfce7" }]}>
              <Ionicons name="pricetag-outline" size={17} color="#166534" />
            </View>
            <Text style={styles.statNumber}>{openTrips}</Text>
            <Text style={styles.statLabel}>Đang mở bán</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: "#e0f2fe" }]}>
              <Ionicons name="people-outline" size={17} color="#0369a1" />
            </View>
            <Text style={styles.statNumber}>{totalCapacity}</Text>
            <Text style={styles.statLabel}>Tổng slot khách</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="cash-outline" size={17} color="#92400e" />
            </View>
            <Text style={styles.statNumber} numberOfLines={1}>
              {totalRevenue >= 1_000_000
                ? `${(totalRevenue / 1_000_000).toFixed(1)} tr`
                : `${totalRevenue.toLocaleString("vi-VN")} đ`}
            </Text>
            <Text style={styles.statLabel}>Doanh thu DK</Text>
          </View>
        </View>

        {/* Chuyến đi tiêu biểu / Đang chạy */}
        {highlightTrip && (
          <View style={styles.heroSection}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>CHUYẾN ĐI TIÊU BIỂU</Text>
            </View>
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroIdTag}>
                    <Text style={styles.heroIdText}>
                      #{highlightTrip.id.slice(0, 8).toUpperCase()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.heroStatusPill,
                      { backgroundColor: getStatusBadge(highlightTrip.status).bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroStatusText,
                        { color: getStatusBadge(highlightTrip.status).color },
                      ]}
                    >
                      {getStatusBadge(highlightTrip.status).label}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.heroTitle} numberOfLines={2}>
                {highlightTrip.title}
              </Text>

              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaItem}>
                  <Ionicons name="calendar-outline" size={13} color="#166534" />
                  <Text style={styles.heroMetaText}>
                    {formatTripDates(highlightTrip.startAt, highlightTrip.endAt)}
                  </Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <Ionicons name="location-outline" size={13} color="#166534" />
                  <Text style={styles.heroMetaText}>
                    {highlightTrip.checkpoints?.length || 0} trạm kiểm soát
                  </Text>
                </View>
              </View>

              {highlightTrip.trails?.[0]?.snapshotName && (
                <View style={styles.heroTrailBox}>
                  <Ionicons name="trail-sign-outline" size={13} color="#166534" />
                  <Text style={styles.heroTrailText} numberOfLines={1}>
                    {highlightTrip.trails[0].snapshotName}
                  </Text>
                </View>
              )}

              <View style={styles.heroMetricsRow}>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricLabel}>Sức chứa đoàn</Text>
                  <Text style={styles.heroMetricVal}>{highlightTrip.capacity} thành viên</Text>
                </View>
                <View style={styles.heroMetricDivider} />
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricLabel}>Giá tour / người</Text>
                  <Text style={styles.heroMetricVal}>
                    {Number(highlightTrip.price || 0).toLocaleString("vi-VN")} ₫
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.heroActionBtn}
                onPress={() => {
                  router.push({
                    pathname: "/field-operations/leader-trip-detail" as any,
                    params: { tripId: highlightTrip.id },
                  });
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.heroActionBtnText}>Xem chi tiết chuyến đi</Text>
                <Ionicons name="arrow-forward" size={15} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Lối tắt thao tác nhanh */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>THAO TÁC NHANH</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                if (onNavigateTab) onNavigateTab("create");
                else router.push("/field-operations/leader-create-trip" as any);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: "#eaf5e1" }]}>
                <Ionicons name="add-circle-outline" size={22} color={Colors.primaryDark} />
              </View>
              <Text style={styles.quickActionTitle}>Tạo chuyến mới</Text>
              <Text style={styles.quickActionSub}>Mở Public Trip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                if (onNavigateTab) onNavigateTab("trips");
                else router.push("/field-operations/leader-trips" as any);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: "#e0f2fe" }]}>
                <Ionicons name="list-outline" size={22} color="#0369a1" />
              </View>
              <Text style={styles.quickActionTitle}>Tất cả chuyến</Text>
              <Text style={styles.quickActionSub}>{totalTrips} chuyến</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                if (onNavigateTab) onNavigateTab("profile");
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: "#fef3c7" }]}>
                <Ionicons name="person-outline" size={22} color="#92400e" />
              </View>
              <Text style={styles.quickActionTitle}>Hồ sơ cá nhân</Text>
              <Text style={styles.quickActionSub}>VFRS Level 2</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danh sách chuyến đi thực tế */}
        {leaderTrips.length > 0 ? (
          <View style={styles.tripsSection}>
            <LeaderTripList
              trips={leaderTrips}
              onCancelTrip={handleCancelTrip}
              onViewAll={() => {
                if (onNavigateTab) onNavigateTab("trips");
                else router.push("/field-operations/leader-trips" as any);
              }}
            />
          </View>
        ) : !loadingTrips ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="compass-outline" size={38} color={Colors.primaryDark} />
            </View>
            <Text style={styles.emptyTitle}>Chưa có chuyến đi công khai nào</Text>
            <Text style={styles.emptySub}>
              Khởi tạo Public Trip đầu tiên để bắt đầu mở nhận đăng ký và điều hành theo chuẩn VFRS.
            </Text>
            <TouchableOpacity
              style={styles.emptyCreateBtn}
              onPress={() => {
                if (onNavigateTab) onNavigateTab("create");
                else router.push("/field-operations/leader-create-trip" as any);
              }}
              activeOpacity={0.86}
            >
              <Ionicons name="add-circle-outline" size={17} color="#ffffff" />
              <Text style={styles.emptyCreateBtnText}>Tạo Public Trip ngay</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8faf7" },
  content: { padding: 18, paddingBottom: 36 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingTop: 4,
  },
  headerInfo: { flex: 1 },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#eaf5e1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 6,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primaryDark },
  roleTagText: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  heading: { color: Colors.ink, fontSize: 24, fontWeight: "900", letterSpacing: -0.3 },
  subheading: { color: Colors.body, fontSize: 12, marginTop: 2 },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: Radius.md,
    padding: 11,
    alignItems: "flex-start",
    ...Shadows.card,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNumber: { color: Colors.ink, fontSize: 16, fontWeight: "900" },
  statLabel: { color: Colors.onSurfaceMuted, fontSize: 10, fontWeight: "600", marginTop: 2 },

  // Hero Card
  heroSection: { marginBottom: 20 },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },
  sectionTitle: {
    color: Colors.onSurfaceMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    borderRadius: Radius.lg,
    padding: 18,
    ...Shadows.card,
  },
  heroHeader: { marginBottom: 8 },
  heroBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroIdTag: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroIdText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heroStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  heroStatusText: { fontSize: 10, fontWeight: "800" },
  heroTitle: {
    color: "#125238",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
    marginBottom: 10,
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroMetaText: { color: "#4b5563", fontSize: 12, fontWeight: "600" },
  heroTrailBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    marginBottom: 14,
  },
  heroTrailText: { color: "#166534", fontSize: 12, fontWeight: "700", flex: 1 },
  heroMetricsRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: Radius.sm,
    padding: 10,
    marginBottom: 14,
  },
  heroMetric: { flex: 1, alignItems: "center" },
  heroMetricDivider: { width: 1, backgroundColor: "#e5e7eb" },
  heroMetricLabel: { color: "#6b7280", fontSize: 10, fontWeight: "600" },
  heroMetricVal: { color: "#125238", fontSize: 13, fontWeight: "800", marginTop: 2 },
  heroActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#166534",
    paddingVertical: 12,
    borderRadius: Radius.sm,
  },
  heroActionBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },

  // Quick Actions Section
  quickActionsSection: { marginBottom: 20 },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 9,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: Radius.md,
    padding: 12,
    alignItems: "center",
    ...Shadows.card,
  },
  quickActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionTitle: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  quickActionSub: {
    color: Colors.onSurfaceMuted,
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },

  // Trips Section
  tripsSection: { marginBottom: 12 },

  // Empty Card
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.md,
    padding: 24,
    alignItems: "center",
    ...Shadows.card,
    marginTop: 6,
  },
  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#eaf5e1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySub: {
    color: Colors.body,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  emptyCreateBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
});
