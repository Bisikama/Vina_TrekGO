import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { QRScannerModal } from "@/components/common/QRScannerModal";
import { PrivateTripCard } from "../components/PrivateTripCard";
import { useMyPrivateTrips } from "../hooks/useMyPrivateTrips";
import type { PrivateTrip } from "../types";

type TabKey = "UPCOMING" | "COMPLETED" | "CANCELLED";

export function MyPrivateTripsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("UPCOMING");

  const { trips, loading, error, refetch } = useMyPrivateTrips(false);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const [refreshing, setRefreshing] = useState(false);

  // Invite code input modal
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  // Filter trips by active tab
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (activeTab === "UPCOMING") {
        return ["OPEN", "FULL", "CLOSED", "CANCEL_PENDING", "IN_PROGRESS"].includes(trip.status);
      }
      if (activeTab === "COMPLETED") {
        return trip.status === "COMPLETED";
      }
      if (activeTab === "CANCELLED") {
        return trip.status === "CANCELLED" || trip.status === "INTERRUPTED";
      }
      return false;
    });
  }, [trips, activeTab]);

  function handleCreateTrip() {
    router.push("/private-trips/create" as any);
  }

  function handleTripPress(trip: PrivateTrip) {
    router.push({
      pathname: "/private-trips/[id]/room",
      params: { id: trip.id },
    } as any);
  }

  const handleCodeChange = (text: string) => {
    const normalized = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setInviteCodeInput(normalized);
  };

  function handleOpenInvitePreview() {
    const code = inviteCodeInput.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert(
        "Mã mời không hợp lệ",
        "Mã mời phải gồm đúng 6 ký tự chữ in hoa và số.",
      );
      return;
    }
    setShowCodeModal(false);
    setInviteCodeInput("");
    router.push({
      pathname: "/invite/[code]",
      params: { code },
    } as any);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Chuyến đi riêng của tôi</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => setShowQRScanner(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code-outline" size={15} color={Colors.primaryDark} />
            <Text style={styles.qrButtonText}>Quét QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.codeButton}
            onPress={() => setShowCodeModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="key-outline" size={15} color={Colors.primaryDark} />
            <Text style={styles.codeButtonText}>Nhập mã</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateTrip}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Tạo chuyến</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "UPCOMING" && styles.tabItemActive]}
          onPress={() => setActiveTab("UPCOMING")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "UPCOMING" && styles.tabTextActive,
            ]}
          >
            Sắp tới
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === "COMPLETED" && styles.tabItemActive,
          ]}
          onPress={() => setActiveTab("COMPLETED")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "COMPLETED" && styles.tabTextActive,
            ]}
          >
            Đã hoàn thành
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === "CANCELLED" && styles.tabItemActive,
          ]}
          onPress={() => setActiveTab("CANCELLED")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "CANCELLED" && styles.tabTextActive,
            ]}
          >
            Đã hủy
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={styles.loadingText}>Đang tải danh sách chuyến đi...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PrivateTripCard
              trip={item}
              currentPax={item.activeMemberCount ?? 1}
              onPress={() => handleTripPress(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primaryDark]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="trail-sign-outline"
                size={44}
                color={Colors.mute}
              />
              <Text style={styles.emptyTitle}>Chưa có chuyến đi nào</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === "UPCOMING"
                  ? "Bạn chưa có chuyến đi riêng nào sắp tới. Hãy bấm tạo chuyến để lên kế hoạch cùng bạn bè!"
                  : activeTab === "COMPLETED"
                  ? "Bạn chưa có chuyến đi riêng nào hoàn thành."
                  : "Không có chuyến đi riêng nào bị hủy."}
              </Text>
              {activeTab === "UPCOMING" && (
                <TouchableOpacity
                  style={styles.primaryCta}
                  onPress={handleCreateTrip}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryCtaText}>Tạo chuyến đi mới</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Invite Code Input Modal */}
      <Modal
        visible={showCodeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalIconBox}>
              <Ionicons name="mail-unread-outline" size={28} color={Colors.primaryDark} />
            </View>
            <Text style={styles.modalTitle}>Nhập mã mời Private Trip</Text>
            <Text style={styles.modalSubtitle}>
              Nhập mã mời 6 ký tự (chữ in hoa và số) do Trưởng đoàn chia sẻ để xem và tham gia chuyến đi.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="K7X9P2"
              placeholderTextColor={Colors.onSurfaceVariant}
              value={inviteCodeInput}
              onChangeText={handleCodeChange}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.modalQRScannerBtn}
              onPress={() => {
                setShowCodeModal(false);
                setShowQRScanner(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={18} color={Colors.primaryDark} />
              <Text style={styles.modalQRScannerBtnText}>
                Hoặc quét mã QR từ thiết bị khác
              </Text>
            </TouchableOpacity>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowCodeModal(false);
                  setInviteCodeInput("");
                }}
              >
                <Text style={styles.modalCancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  inviteCodeInput.length !== 6 && styles.modalConfirmBtnDisabled,
                ]}
                disabled={inviteCodeInput.length !== 6}
                onPress={handleOpenInvitePreview}
              >
                <Text style={styles.modalConfirmBtnText}>Tham gia / Tìm phòng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onManualInputPress={() => setShowCodeModal(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: "#e7f6e3",
    borderWidth: 1,
    borderColor: "#c4e3b7",
  },
  qrButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  codeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  codeButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  createButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalDialog: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 20,
    alignItems: "center",
    ...Shadows.hover,
  },
  modalIconBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
    marginBottom: 6,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 16,
  },
  modalInput: {
    width: "100%",
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primaryDark,
    backgroundColor: Colors.surfaceContainerLowest,
    textAlign: "center",
    letterSpacing: 4,
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 16,
  },
  modalQRScannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 10,
    backgroundColor: "#e7f6e3",
    borderRadius: Radius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#c4e3b7",
  },
  modalQRScannerBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  modalBtnRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.full,
    alignItems: "center",
    backgroundColor: Colors.surfaceContainerLow,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.full,
    alignItems: "center",
    backgroundColor: Colors.primaryDark,
  },
  modalConfirmBtnDisabled: {
    opacity: 0.45,
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerLow,
    backgroundColor: Colors.surface,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceContainerLow,
  },
  tabItemActive: {
    backgroundColor: Colors.primaryDark,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
  errorText: {
    fontSize: 14,
    color: "#DC2626",
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    marginTop: 8,
  },
  primaryCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
