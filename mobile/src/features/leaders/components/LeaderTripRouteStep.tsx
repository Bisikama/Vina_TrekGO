import { Colors, Radius, Shadows } from "@/constants/theme";
import type { TripOptionCheckpoint } from "@/features/leaders/hooks";
import type {
  LeaderTrailSuggestion,
} from "@/features/leaders/services/leader-public-trips.api";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface LeaderTripRouteStepProps {
  tripTitle?: string;
  destinationName?: string;
  trailSuggestions: LeaderTrailSuggestion[];
  destinationCheckpoints: TripOptionCheckpoint[];
  selectedTrail: LeaderTrailSuggestion | null;
  onSelectTrail: (trail: LeaderTrailSuggestion) => void;
  isLoading: boolean;
  submitError?: string | null;
  onProceed: () => void;
  onBack: () => void;
  onRetry?: () => void;
  onSaveDraft?: () => void;
}

export function LeaderTripRouteStep({
  tripTitle,
  destinationName,
  trailSuggestions,
  destinationCheckpoints,
  selectedTrail,
  onSelectTrail,
  isLoading,
  submitError,
  onProceed,
  onBack,
  onRetry,
  onSaveDraft,
}: LeaderTripRouteStepProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Search filter
  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return trailSuggestions;
    const q = searchQuery.toLowerCase().trim();
    return trailSuggestions.filter((t) => {
      const matchName = t.name.toLowerCase().includes(q);
      const matchDiff = (t.difficulty || "").toLowerCase().includes(q);
      return matchName || matchDiff;
    });
  }, [trailSuggestions, searchQuery]);

  // Map checkpointIds của trail đã chọn sang danh sách checkpoint chi tiết (tên, tọa độ)
  const currentCheckpoints = useMemo(() => {
    if (!selectedTrail?.checkpointIds || selectedTrail.checkpointIds.length === 0) {
      return [];
    }
    return selectedTrail.checkpointIds
      .map((id) => destinationCheckpoints.find((cp) => cp.id === id))
      .filter((cp): cp is TripOptionCheckpoint => Boolean(cp));
  }, [selectedTrail, destinationCheckpoints]);

  const canProceed = Boolean(
    selectedTrail &&
      Array.isArray(selectedTrail.checkpointIds) &&
      selectedTrail.checkpointIds.length > 0 &&
      !isLoading,
  );

  return (
    <View style={styles.container}>
      {/* ─── Header & Stepper ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#121c2a" />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              Thiết lập Cung đường & Trạm dừng
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
              Chọn cung đường đã xác minh và thiết lập checkpoint • {destinationName || "VFRS"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.draftTopBtn}
          onPress={onSaveDraft || (() => Alert.alert("Đã lưu nháp", "Lộ trình đã được lưu vào bản nháp."))}
          activeOpacity={0.8}
        >
          <Ionicons name="bookmark-outline" size={14} color="#125238" />
          <Text style={styles.draftTopBtnText}>Lưu nháp</Text>
        </TouchableOpacity>
      </View>

      {/* 3-Step Stepper Header */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepperItemDone}>
          <Ionicons name="checkmark-circle" size={16} color="#125238" />
          <Text style={styles.stepperItemTextDone} numberOfLines={1}>
            1. Thông tin cơ bản
          </Text>
        </View>
        <View style={styles.stepperItemActive}>
          <View style={styles.activeStepBadge}>
            <Text style={styles.activeStepBadgeText}>2</Text>
          </View>
          <Text style={styles.stepperItemTextActive} numberOfLines={1}>
            2. Cung đường & Trạm dừng
          </Text>
        </View>
        <View style={styles.stepperItemInactive}>
          <Text style={styles.inactiveStepNum}>3</Text>
          <Text style={styles.stepperItemTextInactive} numberOfLines={1}>
            3. Xem lại & Công khai
          </Text>
        </View>
      </View>

      {/* Error Banner */}
      {Boolean(submitError) && (
        <View style={styles.errorBox}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle" size={20} color="#ba1a1a" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Lưu ý từ hệ thống</Text>
            <Text style={styles.errorText}>{submitError}</Text>
            {onRetry && (
              <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                <Ionicons name="reload" size={13} color="#125238" />
                <Text style={styles.retryBtnText}>Thử lại</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ─── 1. CARD: LỰA CHỌN CUNG ĐƯỜNG (SYSTEM TRAILS) ─── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Ionicons name="map" size={18} color="#125238" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              1. Lựa chọn Cung đường cho Chuyến đi (System Trails)
            </Text>
            <Text style={styles.cardSubtitle}>
              Sử dụng kho dữ liệu GPS đã thẩm định và xác minh theo chuẩn VFRS.
            </Text>
          </View>
        </View>

        {/* Cung đường đã thẩm định Box */}
        <View style={styles.verifiedBadgeBox}>
          <View style={styles.verifiedPill}>
            <Ionicons name="shield-checkmark" size={14} color="#125238" />
            <Text style={styles.verifiedPillText}>Cung đường đã thẩm định</Text>
            <View style={styles.verifiedTag}>
              <Text style={styles.verifiedTagText}>VFRS Verified</Text>
            </View>
          </View>
          <Text style={styles.verifiedSubText}>
            Dữ liệu trắc diện, nguồn nước và tọa độ cứu hộ đã được chuẩn hóa.
          </Text>
        </View>

        {/* Search Bar matching Web */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#707972" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm cung đường, cấp độ khó..."
            placeholderTextColor="#707972"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#707972" />
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#125238" />
            <Text style={styles.loadingText}>Đang tải danh sách cung đường chuẩn từ hệ thống...</Text>
          </View>
        ) : filteredSuggestions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="trail-sign-outline" size={32} color="#707972" />
            <Text style={styles.emptyTitle}>Chưa có cung đường phù hợp</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `Không tìm thấy cung đường phù hợp với từ khóa "${searchQuery}".`
                : `Khu vực ${destinationName || "này"} chưa có System Trail hợp lệ.`}
            </Text>
          </View>
        ) : (
          <View style={styles.trailsList}>
            {filteredSuggestions.map((trail) => {
              const isSelected = selectedTrail?.id === trail.id;
              const cpCount = trail.checkpointIds?.length || 0;
              const hasNoCp = cpCount === 0;
              const dist = trail.distanceKm || trail.lengthKm || "5.0";
              const elevation = trail.elevationGainM ? `+${trail.elevationGainM}m` : "+500m";
              const difficulty = trail.difficulty || "MEDIUM";
              const hashId = trail.id ? `#${trail.id.slice(0, 8)}` : "#2a48e61f";

              return (
                <TouchableOpacity
                  key={trail.id}
                  style={[
                    styles.trailItem,
                    isSelected && styles.trailItemSelected,
                    hasNoCp && styles.trailItemDisabled,
                  ]}
                  onPress={() => onSelectTrail(trail)}
                  activeOpacity={0.8}
                >
                  <View style={styles.trailItemContent}>
                    {/* Thumbnail Image matching Web */}
                    <View style={styles.thumbWrap}>
                      <Image
                        source={{
                          uri: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=300&q=80",
                        }}
                        style={styles.trailThumbImg}
                      />
                      <View style={styles.thumbHashBadge}>
                        <Text style={styles.thumbHashText}>{hashId}</Text>
                      </View>
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      {/* Title + CP badge */}
                      <View style={styles.trailNameRow}>
                        <Text
                          style={[
                            styles.trailName,
                            isSelected && styles.trailNameSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {trail.name}
                        </Text>
                        {hasNoCp ? (
                          <View style={styles.noCpBadge}>
                            <Text style={styles.noCpBadgeText}>Không có checkpoint</Text>
                          </View>
                        ) : (
                          <View style={styles.cpBadge}>
                            <Text style={styles.cpBadgeText}>{cpCount} Checkpoints</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.trailSubText}>
                        {hasNoCp
                          ? "+ Cung đường không có checkpoint"
                          : `+ Đi qua ${cpCount} checkpoint`}
                      </Text>

                      {/* 3 Metrics Columns */}
                      <View style={styles.trailMetricsRow}>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricLabel}>Cự ly</Text>
                          <Text style={styles.metricVal}>{dist} km</Text>
                        </View>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricLabel}>Độ dốc/Cao độ</Text>
                          <Text style={styles.metricVal}>{elevation}</Text>
                        </View>
                        <View style={[styles.metricChip, styles.diffChip]}>
                          <Text style={styles.metricLabel}>Độ khó</Text>
                          <Text style={styles.diffVal}>{difficulty}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Radio Checkmark on right */}
                    <View style={styles.radioWrap}>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={isSelected ? "#125238" : "#cbd5e1"}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── Selected Trail Overview & 3D Map Preview ─── */}
        {selectedTrail && (
          <View style={styles.trailOverviewBox}>
            <View style={styles.overviewHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.overviewTitle} numberOfLines={1}>
                  Tổng quan {selectedTrail.name}
                </Text>
                <Text style={styles.overviewSubTitle}>
                  Lộ trình chuẩn hóa theo tiêu chuẩn an toàn VFRS
                </Text>
              </View>
              <View style={styles.peakBadge}>
                <Text style={styles.peakBadgeText}>
                  {selectedTrail.elevationGainM ? `${selectedTrail.elevationGainM}m Peak` : "500m Peak"}
                </Text>
              </View>
            </View>

            {/* 5 Stats Strip matching Web */}
            <View style={styles.statsStripGrid}>
              <View style={styles.statStripCell}>
                <Text style={styles.statStripLabel}>Tổng cự ly</Text>
                <Text style={styles.statStripVal}>
                  {selectedTrail.distanceKm || selectedTrail.lengthKm || "5"} km
                </Text>
              </View>
              <View style={styles.statStripCell}>
                <Text style={styles.statStripLabel}>Độ cao đỉnh</Text>
                <Text style={styles.statStripVal}>
                  {selectedTrail.elevationGainM ? `${selectedTrail.elevationGainM}m` : "500m"}
                </Text>
              </View>
              <View style={styles.statStripCell}>
                <Text style={styles.statStripLabel}>Độ khó</Text>
                <Text style={[styles.statStripVal, { color: "#b45309" }]}>
                  {selectedTrail.difficulty || "MEDIUM"}
                </Text>
              </View>
              <View style={styles.statStripCell}>
                <Text style={styles.statStripLabel}>Trạm bắt buộc</Text>
                <Text style={styles.statStripVal}>{currentCheckpoints.length} mốc</Text>
              </View>
              <View style={styles.statStripCell}>
                <Text style={styles.statStripLabel}>Thời gian</Text>
                <Text style={styles.statStripVal}>
                  ~{Math.round(Number(selectedTrail.distanceKm || 5) * 0.8) || 4} giờ
                </Text>
              </View>
            </View>

            {/* Safety Rules Box */}
            <View style={styles.safetyBox}>
              <View style={styles.safetyHeader}>
                <Ionicons name="shield-outline" size={14} color="#125238" />
                <Text style={styles.safetyTitle}>Quy chuẩn An toàn Trạm dừng VFRS</Text>
              </View>
              <Text style={styles.safetyText}>
                • Mốc kiểm soát bắt buộc: Toàn đoàn phải quét GPS và đồng bộ trạng thái tại mỗi checkpoint đã định.
              </Text>
              <Text style={styles.safetyText}>
                • Giám sát hành trình: Hệ thống kích hoạt giám sát an toàn thời gian thực khi bắt đầu chuyến đi.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ─── 2. CARD: TRẠM DỪNG & CHECKPOINTS AN TOÀN ─── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Ionicons name="flag" size={18} color="#125238" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.checkpointHeaderTitleRow}>
              <Text style={[styles.cardTitle, { flexShrink: 1 }]} numberOfLines={1}>
                2. Trạm dừng & Checkpoints
              </Text>
              {currentCheckpoints.length > 0 && (
                <View style={styles.reqCpBadgeDark}>
                  <Text style={styles.reqCpBadgeDarkText} numberOfLines={1}>
                    {currentCheckpoints.length} MỐC BẮT BUỘC
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.cardSubtitle}>
              Danh sách các mốc kiểm soát đoàn bắt buộc theo thứ tự hành trình của cung đường.
            </Text>
          </View>
        </View>

        {!selectedTrail ? (
          <View style={styles.disabledPromptBox}>
            <Ionicons name="information-circle-outline" size={18} color="#707972" />
            <Text style={styles.disabledPromptText}>
              Vui lòng chọn 1 Cung đường ở trên để hiển thị danh sách trạm kiểm soát tương ứng.
            </Text>
          </View>
        ) : currentCheckpoints.length === 0 ? (
          <View style={styles.disabledPromptBox}>
            <ActivityIndicator size="small" color="#125238" />
            <Text style={styles.disabledPromptText}>
              Đang đồng bộ tọa độ các trạm kiểm soát của cung đường này...
            </Text>
          </View>
        ) : (
          <View style={styles.checkpointList}>
            {currentCheckpoints.map((cp, idx) => {
              const latStr = Number(cp.latitude).toFixed(4);
              const lngStr = Number(cp.longitude).toFixed(4);

              return (
                <View key={cp.id || idx} style={styles.checkpointCard}>
                  {/* Square sequence badge matching Web */}
                  <View style={styles.cpSeqSquare}>
                    <Text style={styles.cpSeqNum}>{idx + 1}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.cpTitleRow}>
                      <Text style={styles.cpName}>{cp.name}</Text>
                      <View style={styles.cpBadgeRequired}>
                        <Text style={styles.cpBadgeRequiredText}>• Bắt buộc</Text>
                      </View>
                    </View>
                    <Text style={styles.cpSub}>Mốc kiểm soát vệ tinh an toàn</Text>
                    <Text style={styles.cpCoords}>
                      Tọa độ: {latStr}, {lngStr}   Bán kính quét: 50m
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ─── Bottom Actions matching Web ─── */}
      <View style={styles.bottomActionsRow}>
        <TouchableOpacity style={styles.backStep1Btn} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backStep1BtnText} numberOfLines={1}>← Quay lại</Text>
        </TouchableOpacity>

        <View style={styles.rightActionsGroup}>
          <TouchableOpacity
            style={styles.saveDraftBtn}
            onPress={onSaveDraft || (() => Alert.alert("Đã lưu nháp", "Lộ trình đã được lưu vào bản nháp."))}
            activeOpacity={0.8}
          >
            <Text style={styles.saveDraftBtnText} numberOfLines={1}>Lưu nháp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryProceedBtn, !canProceed && styles.primaryProceedBtnDisabled]}
            onPress={onProceed}
            disabled={!canProceed}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryProceedBtnText} numberOfLines={1}>Tiếp tục →</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eff4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#121c2a",
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#707972",
    marginTop: 1,
  },
  draftTopBtn: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff4ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  draftTopBtnText: {
    color: "#125238",
    fontSize: 11,
    fontWeight: "700",
  },
  stepperContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  stepperItemDone: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf4",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  stepperItemTextDone: {
    color: "#125238",
    fontSize: 10,
    fontWeight: "700",
    flex: 1,
  },
  stepperItemActive: {
    flex: 1.1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff4ff",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: "#125238",
  },
  activeStepBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#125238",
    alignItems: "center",
    justifyContent: "center",
  },
  activeStepBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  stepperItemTextActive: {
    color: "#125238",
    fontSize: 10,
    fontWeight: "800",
    flex: 1,
  },
  stepperItemInactive: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f8fafc",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inactiveStepNum: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
  },
  stepperItemTextInactive: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    flex: 1,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e7f1",
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#eff4ff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#121c2a",
  },
  cardSubtitle: {
    fontSize: 10,
    color: "#707972",
    marginTop: 2,
    lineHeight: 14,
  },
  verifiedBadgeBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: 12,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#125238",
  },
  verifiedTag: {
    backgroundColor: "#125238",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: "auto",
  },
  verifiedTagText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  verifiedSubText: {
    fontSize: 10,
    color: "#374151",
    marginTop: 3,
    lineHeight: 14,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: "#121c2a",
    padding: 0,
  },
  loadingBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 11,
    color: "#707972",
    marginTop: 8,
  },
  emptyCard: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#121c2a",
    marginTop: 6,
  },
  emptySub: {
    fontSize: 10,
    color: "#707972",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 14,
  },
  trailsList: {
    gap: 10,
  },
  trailItem: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 10,
  },
  trailItemSelected: {
    borderColor: "#125238",
    borderWidth: 1.5,
    backgroundColor: "#f0fdf4",
  },
  trailItemDisabled: {
    opacity: 0.7,
  },
  trailItemContent: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  thumbWrap: {
    position: "relative",
  },
  trailThumbImg: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
  },
  thumbHashBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  thumbHashText: {
    color: "#ffffff",
    fontSize: 7,
    fontWeight: "700",
  },
  trailNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trailName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#121c2a",
    flex: 1,
  },
  trailNameSelected: {
    color: "#125238",
  },
  cpBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cpBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#15803d",
  },
  noCpBadge: {
    backgroundColor: "#ffedd5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  noCpBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#c2410c",
  },
  trailSubText: {
    fontSize: 10,
    color: "#707972",
    marginTop: 2,
  },
  trailMetricsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  metricChip: {
    flexDirection: "row",
    gap: 3,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 9,
    color: "#707972",
  },
  metricVal: {
    fontSize: 9,
    fontWeight: "700",
    color: "#121c2a",
  },
  diffChip: {},
  diffVal: {
    fontSize: 9,
    fontWeight: "800",
    color: "#b45309",
  },
  radioWrap: {
    paddingLeft: 4,
  },
  trailOverviewBox: {
    marginTop: 14,
    backgroundColor: "#f8fafc",
    borderRadius: Radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  overviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  overviewTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#121c2a",
  },
  overviewSubTitle: {
    fontSize: 10,
    color: "#707972",
    marginTop: 1,
  },
  peakBadge: {
    backgroundColor: "#125238",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  peakBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  statsStripGrid: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: Radius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  statStripCell: {
    flex: 1,
    alignItems: "center",
  },
  statStripLabel: {
    fontSize: 8,
    color: "#707972",
    fontWeight: "600",
  },
  statStripVal: {
    fontSize: 10,
    fontWeight: "800",
    color: "#121c2a",
    marginTop: 2,
  },
  safetyBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: Radius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  safetyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  safetyTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#125238",
  },
  safetyText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 13,
    marginBottom: 2,
  },
  checkpointHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  reqCpBadgeDark: {
    backgroundColor: "#125238",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: Radius.pill,
    flexShrink: 0,
  },
  reqCpBadgeDarkText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  disabledPromptBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: Radius.sm,
  },
  disabledPromptText: {
    fontSize: 11,
    color: "#707972",
    flex: 1,
  },
  checkpointList: {
    gap: 8,
  },
  checkpointCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: Radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cpSeqSquare: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#125238",
    alignItems: "center",
    justifyContent: "center",
  },
  cpSeqNum: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  cpTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cpName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#121c2a",
  },
  cpBadgeRequired: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cpBadgeRequiredText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#15803d",
  },
  cpSub: {
    fontSize: 10,
    color: "#707972",
    marginTop: 1,
  },
  cpCoords: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  bottomActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  backStep1Btn: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  backStep1BtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#125238",
  },
  rightActionsGroup: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  saveDraftBtn: {
    backgroundColor: "#eff4ff",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#ccd9ea",
  },
  saveDraftBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#121c2a",
  },
  primaryProceedBtn: {
    backgroundColor: "#125238",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryProceedBtnDisabled: {
    backgroundColor: "#94a3b8",
  },
  primaryProceedBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fff1f2",
    borderRadius: Radius.sm,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorIconWrap: {
    marginTop: 2,
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ba1a1a",
  },
  errorText: {
    fontSize: 10,
    color: "#9f1239",
    marginTop: 2,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 10,
    color: "#125238",
    fontWeight: "700",
  },
});
