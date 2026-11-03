import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LiveTrailRecorderModal } from "@/components/trail/LiveTrailRecorderModal";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { PersonalTrailVerificationStatus } from "@/types";
import { isUUID } from "@/services/api/personalTrailApi";
import { syncService } from "@/services/storage";

type TrailFilter = "ALL" | PersonalTrailVerificationStatus;

const statusConfig: Record<
  PersonalTrailVerificationStatus,
  {
    label: string;
    background: string;
    color: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  DRAFT: {
    label: "BẢN NHÁP",
    background: Colors.surfaceContainerHigh,
    color: Colors.onSurfaceVariant,
    icon: "document-text-outline",
  },
  PENDING: {
    label: "CHỜ XÁC MINH",
    background: "#FEF3C7",
    color: "#B45309",
    icon: "time-outline",
  },
  VERIFIED: {
    label: "ĐÃ XÁC MINH",
    background: Colors.primaryPale,
    color: Colors.primaryDark,
    icon: "shield-checkmark-outline",
  },
  REJECTED: {
    label: "CẦN CHỈNH SỬA",
    background: "#FEE2E2",
    color: "#B91C1C",
    icon: "alert-circle-outline",
  },
};

export default function PersonalTrailsScreen() {
  const router = useRouter();
  const { personalTrails, refreshPersonalTrails } = useApp();

  const [filter, setFilter] = useState<TrailFilter>("ALL");
  const [isRecordingModalVisible, setIsRecordingModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    refreshPersonalTrails().catch(console.warn);
  }, [refreshPersonalTrails]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPersonalTrails().catch(console.warn);
    setIsRefreshing(false);
  };

  const handleManualSync = async () => {
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      const result = await syncService.forceRetryAll();
      await refreshPersonalTrails();
      if (result.remaining === 0) {
        Alert.alert(
          "Đồng bộ hoàn tất",
          result.attempted > 0
            ? `Đã xử lý ${result.attempted} tác vụ đang chờ.`
            : "Không còn dữ liệu nào cần đồng bộ.",
        );
      } else {
        Alert.alert(
          "Chưa thể đồng bộ hết",
          `Còn ${result.remaining} tác vụ đang chờ. Vui lòng kiểm tra kết nối mạng rồi thử lại.`,
        );
      }
    } catch (error) {
      console.warn("[PersonalTrails] Manual sync failed:", error);
      Alert.alert(
        "Đồng bộ thất bại",
        "Không thể kết nối máy chủ. Dữ liệu vẫn được giữ an toàn trên thiết bị.",
      );
    } finally {
      setIsManualSyncing(false);
    }
  };

  const filteredTrails = useMemo(() => {
    if (filter === "ALL") {
      return personalTrails;
    }
    return personalTrails.filter(
      (trail) => trail.verificationStatus === filter,
    );
  }, [filter, personalTrails]);

  function openDetail(trailId: string) {
    router.push({
      pathname: "/personal-trails/[id]",
      params: {
        id: trailId,
      },
    } as unknown as Href);
  }

  function renderStatusPill(
    status: PersonalTrailVerificationStatus,
    isUnsynced?: boolean,
  ) {
    if (isUnsynced) {
      return (
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: "#EFF6FF",
            },
          ]}
        >
          <Ionicons name="cloud-upload-outline" size={12} color="#2563EB" />
          <Text style={[styles.statusPillText, { color: "#2563EB" }]}>
            CHƯA ĐỒNG BỘ
          </Text>
        </View>
      );
    }

    const config = statusConfig[status];

    return (
      <View
        style={[
          styles.statusPill,
          {
            backgroundColor: config.background,
          },
        ]}
      >
        <Ionicons name={config.icon} size={12} color={config.color} />
        <Text style={[styles.statusPillText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  }

  const unsyncedCount = personalTrails.filter((t) => !isUUID(t.id)).length;
  const draftCount = personalTrails.filter(
    (trail) => isUUID(trail.id) && trail.verificationStatus === "DRAFT",
  ).length;
  const pendingCount = personalTrails.filter(
    (trail) => isUUID(trail.id) && trail.verificationStatus === "PENDING",
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Trail cá nhân</Text>
          <Text style={styles.headerSubtitle}>
            Vệt GPS thực địa & kiểm duyệt
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primaryDark]}
            tintColor={Colors.primaryDark}
          />
        }
      >
        {/* Overview Banner */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewIcon}>
            <Ionicons
              name="navigate"
              size={26}
              color={Colors.primaryDark}
            />
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.overviewTitle}>Cung đường thực địa của bạn</Text>
            <Text style={styles.overviewDescription}>
              Ghi lại vệt di chuyển ngoài tự nhiên bằng GPS vệ tinh độ chính xác cao và gửi Ban quản trị xác minh.
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{personalTrails.length}</Text>
            <Text style={styles.statLabel}>Tổng Trail</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{draftCount}</Text>
            <Text style={styles.statLabel}>Bản nháp</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Chờ duyệt</Text>
          </View>
        </View>

        {/* Offline / Unsynced notice banner */}
        {unsyncedCount > 0 && (
          <View style={styles.unsyncedBanner}>
            <Ionicons name="cloud-offline-outline" size={17} color="#2563EB" />
            <Text style={styles.unsyncedBannerText}>
              Có {unsyncedCount} cung đường đang lưu trên thiết bị (chờ mạng để đồng bộ lên máy chủ).
            </Text>
            <TouchableOpacity
              style={styles.syncNowButton}
              onPress={handleManualSync}
              disabled={isManualSyncing}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isManualSyncing ? "sync" : "cloud-upload-outline"}
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.syncNowButtonText}>
                {isManualSyncing ? "Đang đồng bộ…" : "Đồng bộ ngay"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Button: Bắt đầu ghi GPS thực tế */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setIsRecordingModalVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.recordDot} />
          <Ionicons name="radio-outline" size={20} color={Colors.onPrimary} />
          <Text style={styles.createButtonText}>Ghi Trail mới bằng GPS thực tế</Text>
        </TouchableOpacity>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(
            [
              ["ALL", "Tất cả"],
              ["DRAFT", "Bản nháp"],
              ["PENDING", "Chờ xác minh"],
              ["VERIFIED", "Đã xác minh"],
              ["REJECTED", "Cần sửa"],
            ] as [TrailFilter, string][]
          ).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.filterChip,
                filter === value && styles.filterChipActive,
              ]}
              onPress={() => setFilter(value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === value && styles.filterChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Trail List or Empty State */}
        {filteredTrails.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="map-outline" size={36} color={Colors.primaryDark} />
            </View>
            <Text style={styles.emptyTitle}>
              Chưa có Trail ở trạng thái này
            </Text>
            <Text style={styles.emptyDescription}>
              Bật định vị GPS và bắt đầu phiên ghi thực địa để tạo cung đường đầu tiên của bạn.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => setIsRecordingModalVisible(true)}
            >
              <Ionicons name="play" size={16} color={Colors.onPrimary} />
              <Text style={styles.emptyActionText}>Bắt đầu ghi GPS ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.trailList}>
            {filteredTrails.map((trail) => {
              const pointCount =
                trail.gpsSegments && trail.gpsSegments.length > 0
                  ? trail.gpsSegments.reduce((sum, seg) => sum + seg.length, 0)
                  : (trail.gpsRoute?.length || 0);

              return (
                <TouchableOpacity
                  key={trail.id}
                  style={styles.trailCard}
                  onPress={() => openDetail(trail.id)}
                  activeOpacity={0.82}
                >
                  <View style={styles.trailCardTop}>
                    {renderStatusPill(trail.verificationStatus, !isUUID(trail.id))}
                    <Ionicons
                      name="chevron-forward"
                      size={19}
                      color={Colors.primaryDark}
                    />
                  </View>

                  <Text style={styles.trailName}>{trail.name}</Text>
                  <Text style={styles.trailRegion}>{trail.region}</Text>

                  <View style={styles.trailStats}>
                    <View style={styles.trailStatItem}>
                      <Ionicons
                        name="walk-outline"
                        size={16}
                        color={Colors.primaryDark}
                      />
                      <Text style={styles.trailStatText}>
                        {trail.distanceKm} km
                      </Text>
                    </View>

                    <View style={styles.trailStatItem}>
                      <Ionicons
                        name="trending-up-outline"
                        size={16}
                        color="#725C00"
                      />
                      <Text style={styles.trailStatText}>
                        +{trail.elevationGainM} m
                      </Text>
                    </View>

                    <View style={styles.trailStatItem}>
                      <Ionicons
                        name="locate-outline"
                        size={16}
                        color={Colors.primaryDark}
                      />
                      <Text style={styles.trailStatText}>
                        {pointCount} điểm GPS
                      </Text>
                    </View>
                  </View>

                  {trail.verificationStatus === "REJECTED" &&
                  trail.rejectionReason ? (
                    <View style={styles.rejectionNotice}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={17}
                        color="#B91C1C"
                      />
                      <Text style={styles.rejectionText} numberOfLines={2}>
                        {trail.rejectionReason}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.updatedRow}>
                    <Text style={styles.updatedText}>
                      Cập nhật: {trail.updatedAt}
                    </Text>
                    <Text style={styles.visibilityText}>
                      {trail.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Live Trail Recorder phục vụ ghi GPS thực tế */}
      <LiveTrailRecorderModal
        visible={isRecordingModalVisible}
        onClose={() => setIsRecordingModalVisible(false)}
        onSaved={(newId) => {
          setIsRecordingModalVisible(false);
          openDetail(newId);
        }}
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
  headerBar: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh,
    backgroundColor: Colors.surface,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },
  headerTitleBox: {
    alignItems: "center",
  },
  headerTitle: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  overviewCard: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  overviewIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryPale,
  },
  overviewTitle: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: "900",
  },
  overviewDescription: {
    marginTop: 3,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 16,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  statValue: {
    color: Colors.primaryDark,
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: "600",
  },
  createButton: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    ...Shadows.card,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  createButtonText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  filterChipActive: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  filterChipText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: Colors.onPrimary,
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryPale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyDescription: {
    marginTop: 6,
    textAlign: "center",
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 17,
    maxWidth: 260,
  },
  emptyActionButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  emptyActionText: {
    color: Colors.onPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  trailList: {
    gap: 12,
  },
  trailCard: {
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  trailCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: Radius.full,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "800",
  },
  trailName: {
    marginTop: 10,
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: "900",
  },
  trailRegion: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  trailStats: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trailStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trailStatText: {
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: "700",
  },
  rejectionNotice: {
    marginTop: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.md,
    backgroundColor: "#FEE2E2",
  },
  rejectionText: {
    flex: 1,
    color: "#B91C1C",
    fontSize: 11,
    lineHeight: 15,
  },
  updatedRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  updatedText: {
    color: Colors.onSurfaceVariant,
    fontSize: 9,
  },
  visibilityText: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: "700",
  },
  unsyncedBanner: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  unsyncedBannerText: {
    flex: 1,
    color: "#1E40AF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  syncNowButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  syncNowButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
});
