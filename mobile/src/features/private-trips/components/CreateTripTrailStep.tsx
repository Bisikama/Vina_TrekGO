import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePersonalTrails } from "../hooks/usePersonalTrails";
import { useSystemTrailAccesses } from "../hooks/useSystemTrailAccesses";
import { getSystemTrails } from "../services/private-trips.api";
import type { CheckpointItem, PrivateTrailSource } from "../types";
import { PurchaseTrailModal } from "./PurchaseTrailModal";

export interface CreateTripTrailStepProps {
  trails?: PrivateTrailSource[];
  selectedTrailId?: string;
  loading?: boolean;
  onSelectTrail: (trail: PrivateTrailSource) => void;
}

export function CreateTripTrailStep({
  trails: propTrails,
  selectedTrailId,
  loading: propLoading,
  onSelectTrail,
}: CreateTripTrailStepProps) {
  // If trails are not passed from parent, use real API hooks
  const shouldFetch = !propTrails;
  const { personalTrails, loading: loadingPersonal } = usePersonalTrails(shouldFetch);
  const {
    trailAccesses,
    loading: loadingSystem,
    refetch: refetchSystem,
  } = useSystemTrailAccesses(shouldFetch);

  const [buyingTrail, setBuyingTrail] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogTrails, setCatalogTrails] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  async function handleOpenCatalog() {
    setShowCatalogModal(true);
    setLoadingCatalog(true);
    try {
      const res = await getSystemTrails();
      setCatalogTrails(res?.items || []);
    } catch {
      setCatalogTrails([]);
    } finally {
      setLoadingCatalog(false);
    }
  }

  const trails = useMemo(() => {
    if (propTrails) return propTrails;

    const combined: PrivateTrailSource[] = [];

    // Map personal trails from API GET /me/personal-trails
    if (Array.isArray(personalTrails)) {
      personalTrails.forEach((item: any) => {
        const rawPoints = (
          item.personalCheckpointsViaPersonalTrailId || []
        ).slice();
        rawPoints.sort(
          (a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0),
        );
        const points: CheckpointItem[] = rawPoints.map(
          (cp: any, idx: number) => ({
            id: cp.id,
            name: cp.name || `Trạm ${idx + 1}`,
            sequence: cp.sequence ?? idx + 1,
            latitude: cp.latitude,
            longitude: cp.longitude,
          }),
        );

        combined.push({
          id: item.id,
          type: "PERSONAL",
          name: item.title || item.name || "Cung đường cá nhân",
          destinationId: item.destinationId,
          points,
        });
      });
    }

    // Map system trail accesses from API GET /me/trail-accesses
    if (Array.isArray(trailAccesses)) {
      trailAccesses.forEach((item: any) => {
        const st = item.systemTrail;
        if (!st) return;

        const rawPoints = (
          st.trailCheckpointsViaSystemTrailId || []
        ).slice();
        rawPoints.sort(
          (a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0),
        );

        const activePoints: CheckpointItem[] = rawPoints
          .filter(
            (tcp: any) => !tcp.checkpoint || tcp.checkpoint.status === "ACTIVE",
          )
          .map((tcp: any, idx: number) => ({
            id: tcp.checkpointId || tcp.checkpoint?.id || tcp.id,
            name: tcp.checkpoint?.name || tcp.name || `Trạm ${idx + 1}`,
            sequence: tcp.sequence ?? idx + 1,
            latitude: tcp.checkpoint?.latitude ?? tcp.latitude,
            longitude: tcp.checkpoint?.longitude ?? tcp.longitude,
          }));

        combined.push({
          id: item.systemTrailId || st.id,
          type: "SYSTEM",
          name: st.name || "Cung đường hệ thống",
          destinationId: st.destinationId,
          points: activePoints,
        });
      });
    }

    return combined;
  }, [propTrails, personalTrails, trailAccesses]);

  const isLoading = propLoading ?? (loadingPersonal || loadingSystem);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Đang tải danh sách tuyến đường...</Text>
      </View>
    );
  }

  if (trails.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trail-sign-outline" size={40} color={Colors.mute} />
        <Text style={styles.emptyTitle}>Chưa có tuyến đường khả dụng</Text>
        <Text style={styles.emptySubtitle}>
          Bạn cần tạo Cung đường cá nhân hoặc mua quyền truy cập Cung đường hệ
          thống trước khi tạo Private Trip.
        </Text>

        <TouchableOpacity
          style={styles.browseSystemBtn}
          onPress={handleOpenCatalog}
          activeOpacity={0.85}
        >
          <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
          <Text style={styles.browseSystemBtnText}>
            Mua quyền Cung đường hệ thống
          </Text>
        </TouchableOpacity>

        {/* Catalog Modal */}
        {renderCatalogModal()}

        {/* Purchase Modal */}
        {buyingTrail ? (
          <PurchaseTrailModal
            visible={Boolean(buyingTrail)}
            trailId={buyingTrail.id}
            trailName={buyingTrail.name}
            onClose={() => setBuyingTrail(null)}
            onAccessGranted={() => {
              void refetchSystem();
              setShowCatalogModal(false);
            }}
          />
        ) : null}
      </View>
    );
  }

  const selectedTrail = trails.find((t) => t.id === selectedTrailId);

  function renderCatalogModal() {
    return (
      <Modal
        visible={showCatalogModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCatalogModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.catalogContainer}>
            <View style={styles.catalogHeader}>
              <Text style={styles.catalogTitle}>Cung đường hệ thống TrekGo</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowCatalogModal(false)}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={Colors.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>

            {loadingCatalog ? (
              <View style={styles.catalogLoading}>
                <ActivityIndicator size="small" color={Colors.primaryDark} />
                <Text style={styles.catalogLoadingText}>
                  Đang tải danh sách cung đường...
                </Text>
              </View>
            ) : catalogTrails.length === 0 ? (
              <View style={styles.catalogLoading}>
                <Text style={styles.catalogLoadingText}>
                  Chưa có cung đường hệ thống nào.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.catalogList}
                showsVerticalScrollIndicator={false}
              >
                {catalogTrails.map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={styles.catalogCard}
                    onPress={() =>
                      setBuyingTrail({
                        id: st.id,
                        name: st.name || "Cung đường hệ thống",
                      })
                    }
                  >
                    <View style={styles.catalogInfo}>
                      <Text style={styles.catalogTrailName}>{st.name}</Text>
                      <Text style={styles.catalogTrailSub}>
                        {st.destination?.name || "Địa điểm"} · {st.distanceKm || "8"} km
                      </Text>
                    </View>
                    <View style={styles.unlockBtn}>
                      <Ionicons name="key-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.unlockBtnText}>Mở khóa</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Bước 1: Chọn tuyến đường</Text>
      <Text style={styles.stepDescription}>
        Chọn cung đường cá nhân tự vẽ hoặc cung đường hệ thống đã mua quyền để làm
        lộ trình cho chuyến đi.
      </Text>

      <View style={styles.trailList}>
        {trails.map((trail) => {
          const isSelected = trail.id === selectedTrailId;
          const isPersonal = trail.type === "PERSONAL";

          return (
            <TouchableOpacity
              key={trail.id}
              style={[styles.trailCard, isSelected && styles.trailCardSelected]}
              onPress={() => onSelectTrail(trail)}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.typeBadge,
                    isPersonal ? styles.personalBadge : styles.systemBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBadgeText,
                      isPersonal
                        ? styles.personalBadgeText
                        : styles.systemBadgeText,
                    ]}
                  >
                    {isPersonal ? "CUNG ĐƯỜNG CÁ NHÂN" : "HỆ THỐNG"}
                  </Text>
                </View>

                {isSelected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={Colors.primaryDark}
                  />
                ) : (
                  <Ionicons
                    name="ellipse-outline"
                    size={20}
                    color={Colors.mute}
                  />
                )}
              </View>

              <Text style={styles.trailName}>{trail.name}</Text>

              <View style={styles.checkpointsSummary}>
                <Ionicons
                  name="flag-outline"
                  size={14}
                  color={Colors.onSurfaceVariant}
                />
                <Text style={styles.checkpointsText}>
                  {trail.points.length} trạm dừng (checkpoints)
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Button to unlock more system trails */}
        <TouchableOpacity
          style={styles.moreTrailsBtn}
          onPress={handleOpenCatalog}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={Colors.primaryDark}
          />
          <Text style={styles.moreTrailsBtnText}>
            Mua thêm quyền Cung đường hệ thống khác
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preview selected trail checkpoints */}
      {selectedTrail && selectedTrail.points.length > 0 ? (
        <View style={styles.checkpointsPreview}>
          <Text style={styles.previewTitle}>
            Các trạm dừng trên tuyến ({selectedTrail.points.length} trạm):
          </Text>
          <View style={styles.chipsRow}>
            {selectedTrail.points.map((cp) => (
              <View key={cp.id} style={styles.checkpointChip}>
                <Text style={styles.checkpointChipSequence}>#{cp.sequence}</Text>
                <Text style={styles.checkpointChipName}>{cp.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Catalog Modal */}
      {renderCatalogModal()}

      {/* Purchase Modal */}
      {buyingTrail ? (
        <PurchaseTrailModal
          visible={Boolean(buyingTrail)}
          trailId={buyingTrail.id}
          trailName={buyingTrail.name}
          onClose={() => setBuyingTrail(null)}
          onAccessGranted={() => {
            void refetchSystem();
            setShowCatalogModal(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  emptyContainer: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.onSurface,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
  },
  trailList: {
    marginBottom: 12,
  },
  trailCard: {
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainer,
    marginBottom: 10,
    ...Shadows.card,
  },
  trailCardSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: "#F0FDF4",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  personalBadge: {
    backgroundColor: "#E0E7FF",
  },
  systemBadge: {
    backgroundColor: "#FEF3C7",
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  personalBadgeText: {
    color: "#3730A3",
  },
  systemBadgeText: {
    color: "#B45309",
  },
  trailName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.onSurface,
    marginBottom: 6,
  },
  checkpointsSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  checkpointsText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  checkpointsPreview: {
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    marginTop: 4,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurface,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  checkpointChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
  },
  checkpointChipSequence: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  checkpointChipName: {
    fontSize: 11,
    color: Colors.onSurface,
  },
  browseSystemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    marginTop: 8,
  },
  browseSystemBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  moreTrailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.surfaceContainerLowest,
    marginTop: 4,
    marginBottom: 8,
  },
  moreTrailsBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  catalogContainer: {
    maxHeight: "75%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 16,
    paddingBottom: 24,
    ...Shadows.hover,
  },
  catalogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  catalogTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  catalogLoading: {
    paddingVertical: 30,
    alignItems: "center",
    gap: 8,
  },
  catalogLoadingText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  catalogList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  catalogCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    marginBottom: 10,
  },
  catalogInfo: {
    flex: 1,
  },
  catalogTrailName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  catalogTrailSub: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  unlockBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
