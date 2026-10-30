import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { useLeaderTrips } from "@/features/leaders/hooks";
import type { LeaderPublicTrip } from "@/features/leaders/services/leader-public-trips.api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type FilterTabKey = "all" | "draft" | "open" | "in_progress" | "completed" | "cancelled";

interface TabItem {
  key: FilterTabKey;
  label: string;
}

const TABS: TabItem[] = [
  { key: "all", label: "Tất cả" },
  { key: "draft", label: "Bản nháp" },
  { key: "open", label: "Đang mở bán" },
  { key: "in_progress", label: "Đang diễn ra" },
  { key: "completed", label: "Đã hoàn thành" },
  { key: "cancelled", label: "Đã hủy" },
];

function formatVnDate(dateStr?: string): string {
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

function formatCurrency(amount: number): string {
  return amount.toLocaleString("vi-VN");
}

function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return {
        label: "Bản nháp",
        bg: "#f1f5f9",
        color: "#475569",
        icon: "create-outline" as const,
      };
    case "OPEN":
      return {
        label: "Đang mở bán",
        bg: "#dcfce7",
        color: "#166534",
        icon: "checkmark-circle" as const,
      };
    case "FULL":
      return {
        label: "Đã đủ chỗ",
        bg: "#e0f2fe",
        color: "#0369a1",
        icon: "people" as const,
      };
    case "IN_PROGRESS":
      return {
        label: "Đang diễn ra",
        bg: "#fef9c3",
        color: "#854d0e",
        icon: "walk" as const,
      };
    case "COMPLETED":
      return {
        label: "Đã hoàn thành",
        bg: "#f3e8ff",
        color: "#6b21a8",
        icon: "flag" as const,
      };
    case "CANCEL_PENDING":
      return {
        label: "Chờ hủy",
        bg: "#fee2e2",
        color: "#991b1b",
        icon: "time" as const,
      };
    case "CANCELLED":
      return {
        label: "Đã hủy",
        bg: "#fee2e2",
        color: "#991b1b",
        icon: "close-circle" as const,
      };
    default:
      return {
        label: status,
        bg: "#f1f5f9",
        color: "#475569",
        icon: "ellipse" as const,
      };
  }
}

interface LeaderTripsScreenProps {
  showBackButton?: boolean;
  onNavigateTab?: (tabKey: "dashboard" | "create" | "profile") => void;
}

export function LeaderTripsScreen({
  showBackButton = true,
  onNavigateTab,
}: LeaderTripsScreenProps = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const {
    trips,
    total,
    page,
    pageSize,
    loading,
    loadingMore,
    error,
    fetchMyTrips,
  } = useLeaderTrips(accessToken);

  const [activeTab, setActiveTab] = useState<FilterTabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (accessToken) {
      void fetchMyTrips(1, 20);
    }
  }, [accessToken, fetchMyTrips]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyTrips(1, 20);
    setRefreshing(false);
  }, [fetchMyTrips]);

  const handleLoadMore = useCallback(async () => {
    if (loading || loadingMore) return;
    if (trips.length < total) {
      const nextPage = page + 1;
      await fetchMyTrips(nextPage, pageSize, true);
    }
  }, [loading, loadingMore, trips.length, total, page, pageSize, fetchMyTrips]);

  const hasMore = trips.length < total;

  // Đếm số lượng chuyến cho từng tab
  const tabCounts = useMemo(() => {
    const counts: Record<FilterTabKey, number> = {
      all: trips.length,
      draft: 0,
      open: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    trips.forEach((t) => {
      if (t.status === "DRAFT") counts.draft++;
      else if (t.status === "OPEN") counts.open++;
      else if (t.status === "FULL" || t.status === "IN_PROGRESS") counts.in_progress++;
      else if (t.status === "COMPLETED") counts.completed++;
      else if (t.status === "CANCELLED" || t.status === "CANCEL_PENDING") counts.cancelled++;
    });

    return counts;
  }, [trips]);

  // Lọc chuyến theo tab và query tìm kiếm
  const filteredTrips = useMemo(() => {
    let list = trips;

    // Lọc theo Tab
    if (activeTab === "draft") {
      list = list.filter((t) => t.status === "DRAFT");
    } else if (activeTab === "open") {
      list = list.filter((t) => t.status === "OPEN");
    } else if (activeTab === "in_progress") {
      list = list.filter((t) => t.status === "FULL" || t.status === "IN_PROGRESS");
    } else if (activeTab === "completed") {
      list = list.filter((t) => t.status === "COMPLETED");
    } else if (activeTab === "cancelled") {
      list = list.filter((t) => t.status === "CANCELLED" || t.status === "CANCEL_PENDING");
    }

    // Lọc theo Tìm kiếm: title, #id, hoặc tên trail
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const titleMatch = t.title?.toLowerCase().includes(q);
        const idMatch = t.id?.toLowerCase().includes(q.replace("#", ""));
        const trailMatch = t.trails?.some(
          (trail) =>
            trail.snapshotName?.toLowerCase().includes(q) ||
            trail.name?.toLowerCase().includes(q),
        );
        return Boolean(titleMatch || idMatch || trailMatch);
      });
    }

    return list;
  }, [trips, activeTab, searchQuery]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          paddingLeft: Math.max(0, insets.left),
          paddingRight: Math.max(0, insets.right),
        },
      ]}
      edges={["top", "left", "right"]}
    >
      {/* 1. Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {showBackButton && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.ink} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Chuyến đi của tôi</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Theo dõi lịch khởi hành, thành viên và doanh thu
            </Text>
          </View>
        </View>

        {/* Nút Tạo chuyến đi mới */}
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => {
            if (onNavigateTab) onNavigateTab("create");
            else router.push("/field-operations/leader-create-trip" as any);
          }}
          activeOpacity={0.88}
        >
          <Ionicons name="add-circle" size={18} color="#ffffff" />
          <Text style={styles.createBtnText}>Tạo chuyến đi mới</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Thanh Tabs lọc theo trạng thái (kèm số lượng đếm trên từng tab) */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Thanh Tìm kiếm */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#707972" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm theo tên chuyến, #mã tour, cung đường..."
            placeholderTextColor="#8a938c"
            style={styles.searchInput}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#8a938c" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 4. Danh sách Thẻ Chuyến đi */}
      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(40, insets.bottom + 28) },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#125238"]} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#125238" />
            <Text style={styles.loadingText}>Đang tải danh sách chuyến đi...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={32} color="#ba1a1a" />
            <Text style={styles.errorTitle}>Lỗi tải dữ liệu</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchMyTrips(1, 20)}>
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : filteredTrips.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="compass-outline" size={48} color="#a2aba3" />
            <Text style={styles.emptyTitle}>Không tìm thấy chuyến đi nào</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "Không có kết quả khớp với từ khóa tìm kiếm của bạn."
                : "Chưa có chuyến đi nào trong danh mục này."}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push("/field-operations/leader-create-trip" as any)}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.emptyActionBtnText}>Tạo chuyến đi đầu tiên</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {filteredTrips.map((trip) => {
              const shortId = trip.id ? trip.id.slice(0, 8).toUpperCase() : "TOUR";
              const badge = getStatusBadge(trip.status);
              const cpCount = trip.checkpoints?.length || 0;
              const trailName = trip.trails?.[0]?.snapshotName || trip.trails?.[0]?.name || trip.title;
              const startDate = formatVnDate(trip.startAt);
              const endDate = formatVnDate(trip.endAt);

              const totalCapacity = trip.capacity || 15;
              const remaining =
                typeof trip.remainingSlots === "number"
                  ? trip.remainingSlots
                  : trip.status === "DRAFT"
                    ? totalCapacity
                    : totalCapacity;
              const registered = Math.max(0, totalCapacity - remaining);
              const fillPercent = Math.min(100, Math.round((registered / totalCapacity) * 100));

              const unitPrice = Number(trip.price || trip.pricePerPax || 0);
              const expectedRevenue = unitPrice * totalCapacity;

              return (
                <TouchableOpacity
                  key={trip.id}
                  style={styles.tripCard}
                  activeOpacity={0.92}
                  onPress={() =>
                    router.push({
                      pathname: "/field-operations/leader-trip-detail" as any,
                      params: { tripId: trip.id },
                    })
                  }
                >
                  {/* Top: Code & Status */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.codeWrap}>
                      <Text style={styles.codeText}>#{shortId}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Ionicons name={badge.icon} size={12} color={badge.color} />
                      <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  {/* Title & Checkpoints subtitle */}
                  <Text style={styles.tripTitle}>{trip.title}</Text>
                  <Text style={styles.tripSubtitle}>
                    Hành trình {cpCount} trạm kiểm soát VFRS
                  </Text>

                  {/* Trail Snapshot Name */}
                  <View style={styles.trailRow}>
                    <Text style={styles.trailIcon}>⌁</Text>
                    <Text style={styles.trailName} numberOfLines={1}>
                      {trailName}
                    </Text>
                  </View>

                  {/* Schedule Dates */}
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={14} color="#707972" />
                    <Text style={styles.infoText}>
                      {startDate} – {endDate}
                    </Text>
                  </View>

                  {/* Members progress bar */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressCountLabel}>
                        Thành viên: <Text style={styles.boldText}>{registered}/{totalCapacity}</Text>
                      </Text>
                      <Text style={styles.remainingSlotsText}>
                        Còn {remaining} slot trống
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${fillPercent}%`,
                            backgroundColor:
                              fillPercent >= 100
                                ? "#0369a1"
                                : fillPercent >= 50
                                  ? "#125238"
                                  : "#ca8a04",
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Footer: Revenue & Xem chi tiết chuyến Button */}
                  <View style={styles.cardFooter}>
                    <View style={styles.revenueWrap}>
                      <Text style={styles.revenueLabel}>Doanh thu dự kiến</Text>
                      <Text style={styles.revenueValue}>
                        {formatCurrency(expectedRevenue)} ₫
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.manageBtn}
                      onPress={() =>
                        router.push({
                          pathname: "/field-operations/leader-trip-detail" as any,
                          params: { tripId: trip.id },
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={styles.manageBtnText}>Chi tiết chuyến</Text>
                      <Ionicons name="arrow-forward" size={14} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Phân trang: Nút Tải thêm chuyến đi nếu còn dữ liệu */}
            {hasMore && (
              <View style={styles.loadMoreContainer}>
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  activeOpacity={0.8}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#125238" />
                  ) : (
                    <>
                      <Ionicons name="reload-outline" size={15} color="#125238" />
                      <Text style={styles.loadMoreBtnText}>
                        Xem thêm chuyến đi ({trips.length}/{total})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8faf7",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e9e2",
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#121c2a",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: "#707972",
    marginTop: 2,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#125238",
    paddingVertical: 10,
    borderRadius: Radius.md,
    ...Shadows.card,
  },
  createBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  tabsWrapper: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e1e9e2",
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  tabItemActive: {
    backgroundColor: "#125238",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  tabLabelActive: {
    color: "#ffffff",
  },
  tabBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: "#0d3b28",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#334155",
  },
  tabBadgeTextActive: {
    color: "#ffffff",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f4f6f4",
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e1e9e2",
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: "#121c2a",
    padding: 0,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#707972",
  },
  errorBox: {
    backgroundColor: "#fff8f7",
    borderWidth: 1,
    borderColor: "#ffdad6",
    borderRadius: Radius.md,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ba1a1a",
  },
  errorText: {
    fontSize: 12,
    color: "#410002",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#125238",
  },
  emptyBox: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "#e1e9e2",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#121c2a",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#707972",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#125238",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    marginTop: 6,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
  tripCard: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e1e9e2",
    ...Shadows.card,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codeWrap: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155",
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  tripTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#121c2a",
    lineHeight: 20,
  },
  tripSubtitle: {
    fontSize: 11.5,
    color: "#707972",
    marginTop: -4,
  },
  trailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f4fbf4",
    borderWidth: 1,
    borderColor: "#d1e8d5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  trailIcon: {
    fontSize: 12,
    color: "#125238",
    fontWeight: "900",
  },
  trailName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#125238",
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: "#414942",
    fontWeight: "600",
  },
  progressSection: {
    gap: 6,
    backgroundColor: "#fafbfa",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eef2ef",
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressCountLabel: {
    fontSize: 11.5,
    color: "#414942",
  },
  boldText: {
    fontWeight: "900",
    color: "#121c2a",
  },
  remainingSlotsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369a1",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  revenueWrap: {
    gap: 2,
  },
  revenueLabel: {
    fontSize: 10,
    color: "#707972",
    textTransform: "uppercase",
  },
  revenueValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#125238",
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#125238",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    ...Shadows.card,
  },
  manageBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  loadMoreContainer: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#125238",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
    ...Shadows.card,
    minWidth: 200,
  },
  loadMoreBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#125238",
  },
});
