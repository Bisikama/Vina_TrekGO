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
      return { label: "Bản nháp", bg: "#e8ebe6", color: "#454745" };
    case "OPEN":
      return { label: "Đang mở nhận khách", bg: "#e2f6d5", color: "#054d28" };
    case "FULL":
      return { label: "Đã đủ chỗ", bg: "#fff9db", color: "#b86700" };
    case "IN_PROGRESS":
      return { label: "Đang diễn ra", bg: "#e0f2fe", color: "#0369a1" };
    case "COMPLETED":
      return { label: "Đã hoàn thành", bg: "#e2f6d5", color: "#054d28" };
    case "CANCEL_PENDING":
      return { label: "Chờ hủy", bg: "#fee2e2", color: "#a7000d" };
    case "CANCELLED":
      return { label: "Đã hủy", bg: "#fee2e2", color: "#a7000d" };
    default:
      return { label: status, bg: "#e8ebe6", color: "#454745" };
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
            tintColor="#0e0f0c"
            colors={["#0e0f0c", "#9fe870"]}
          />
        }
      >
        {/* Header hiện đại theo phong cách Wise */}
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
              <ActivityIndicator size="small" color="#0e0f0c" />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#0e0f0c" />
            )}
          </TouchableOpacity>
        </View>

        {/* Lưới thống kê thực tế từ API */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: "#e2f6d5" }]}>
              <Ionicons name="trail-sign-outline" size={17} color="#0e0f0c" />
            </View>
            <Text style={styles.statNumber}>{totalTrips}</Text>
            <Text style={styles.statLabel}>Tổng chuyến</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: "#cdffad" }]}>
              <Ionicons name="pricetag-outline" size={17} color="#0e0f0c" />
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
            <View style={[styles.statIconWrap, { backgroundColor: "#fff9db" }]}>
              <Ionicons name="cash-outline" size={17} color="#b86700" />
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
                  <Ionicons name="calendar-outline" size={14} color="#0e0f0c" />
                  <Text style={styles.heroMetaText}>
                    {formatTripDates(highlightTrip.startAt, highlightTrip.endAt)}
                  </Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <Ionicons name="location-outline" size={14} color="#0e0f0c" />
                  <Text style={styles.heroMetaText}>
                    {highlightTrip.checkpoints?.length || 0} trạm kiểm soát
                  </Text>
                </View>
              </View>

              {highlightTrip.trails?.[0]?.snapshotName && (
                <View style={styles.heroTrailBox}>
                  <Ionicons name="trail-sign-outline" size={14} color="#0e0f0c" />
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
                <Ionicons name="arrow-forward" size={16} color="#0e0f0c" />
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
              <View style={[styles.quickActionIconWrap, { backgroundColor: "#e2f6d5" }]}>
                <Ionicons name="add-circle-outline" size={22} color="#0e0f0c" />
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
              <View style={[styles.quickActionIconWrap, { backgroundColor: "#fff9db" }]}>
                <Ionicons name="person-outline" size={22} color="#b86700" />
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
              <Ionicons name="compass-outline" size={38} color="#0e0f0c" />
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
              activeOpacity={0.88}
            >
              <Ionicons name="add" size={18} color="#0e0f0c" />
              <Text style={styles.emptyCreateBtnText}>Tạo chuyến đi đầu tiên</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e8ebe6", // Sage canvas soft per DESIGN-wise.md
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 24, // Radius.xl
    borderWidth: 1,
    borderColor: "#d6dbd2",
    padding: 18,
    marginBottom: 16,
    ...Shadows.card,
  },
  headerInfo: { flex: 1, paddingRight: 10 },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0e0f0c",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginBottom: 6,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#9fe870", // Wise lime accent
  },
  roleTagText: {
    color: "#9fe870",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heading: {
    color: "#0e0f0c",
    fontSize: 22,
    fontWeight: "900", // Wise display heavy 900
    letterSpacing: -0.3,
  },
  subheading: { color: "#454745", fontSize: 13, marginTop: 2 },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    backgroundColor: "#e8ebe6",
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d6dbd2",
    padding: 12,
    alignItems: "flex-start",
    ...Shadows.card,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNumber: { color: "#0e0f0c", fontSize: 16, fontWeight: "900" },
  statLabel: { color: "#454745", fontSize: 10, fontWeight: "600", marginTop: 2 },

  // Hero Card
  heroSection: { marginBottom: 20 },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#0e0f0c",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d6dbd2",
    borderRadius: 24, // Radius.xl
    padding: 20,
    ...Shadows.card,
  },
  heroHeader: { marginBottom: 10 },
  heroBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroIdTag: {
    backgroundColor: "#e8ebe6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  heroIdText: {
    color: "#0e0f0c",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heroStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  heroStatusText: { fontSize: 10.5, fontWeight: "700" },
  heroTitle: {
    color: "#0e0f0c",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
    marginBottom: 12,
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroMetaText: { color: "#454745", fontSize: 13, fontWeight: "600" },
  heroTrailBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e8ebe6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginBottom: 14,
  },
  heroTrailText: { color: "#0e0f0c", fontSize: 12, fontWeight: "600", flex: 1 },
  heroMetricsRow: {
    flexDirection: "row",
    backgroundColor: "#e8ebe6",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  heroMetric: { flex: 1, alignItems: "center" },
  heroMetricDivider: { width: 1, backgroundColor: "#d6dbd2" },
  heroMetricLabel: { color: "#868685", fontSize: 11, fontWeight: "600" },
  heroMetricVal: { color: "#0e0f0c", fontSize: 14, fontWeight: "800", marginTop: 2 },
  heroActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#9fe870", // Wise lime CTA
    paddingVertical: 14,
    borderRadius: 24, // Radius.xl
  },
  heroActionBtnText: { color: "#0e0f0c", fontSize: 14, fontWeight: "700" },

  // Quick Actions Section
  quickActionsSection: { marginBottom: 20 },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d6dbd2",
    padding: 14,
    alignItems: "center",
    ...Shadows.card,
  },
  quickActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionTitle: {
    color: "#0e0f0c",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  quickActionSub: {
    color: "#868685",
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },

  // Trips Section
  tripsSection: { marginBottom: 12 },

  // Empty Card
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#d6dbd2",
    padding: 24,
    alignItems: "center",
    ...Shadows.card,
    marginTop: 6,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e2f6d5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#0e0f0c",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySub: {
    color: "#454745",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#9fe870",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyCreateBtnText: { color: "#0e0f0c", fontSize: 13, fontWeight: "700" },
});
