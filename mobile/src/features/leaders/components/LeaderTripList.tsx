import { Colors, Radius, Shadows } from "@/constants/theme";
import type { LeaderPublicTrip } from "@/features/leaders/services/leader-public-trips.api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface LeaderTripListProps {
  trips: LeaderPublicTrip[];
  onCancelTrip?: (tripId: string, version: number, reason: string) => Promise<void>;
  showViewAll?: boolean;
  onViewAll?: () => void;
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

function formatCurrency(amount: number): string {
  return amount.toLocaleString("vi-VN");
}

function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return { label: "Bản nháp", bg: "#f1f5f9", color: "#475569" };
    case "OPEN":
      return { label: "Đang mở bán", bg: "#dcfce7", color: "#166534" };
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

export function LeaderTripList({
  trips,
  onCancelTrip,
  showViewAll = true,
  onViewAll,
}: LeaderTripListProps) {
  const router = useRouter();

  const [selectedTripForCancel, setSelectedTripForCancel] = useState<LeaderPublicTrip | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  if (trips.length === 0) return null;

  const handleOpenCancelModal = (trip: LeaderPublicTrip) => {
    setSelectedTripForCancel(trip);
    setCancelReason("");
  };

  const handleConfirmCancel = async () => {
    if (!selectedTripForCancel || !onCancelTrip) return;
    if (!cancelReason.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập lý do hủy chuyến.");
      return;
    }
    setIsCancelling(true);
    try {
      await onCancelTrip(
        selectedTripForCancel.id,
        selectedTripForCancel.version,
        cancelReason.trim(),
      );
      setSelectedTripForCancel(null);
      setCancelReason("");
      Alert.alert(
        "Thành công",
        "Yêu cầu hủy chuyến đã được gửi lên hệ thống (CANCEL_PENDING).",
      );
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể gửi yêu cầu hủy chuyến.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.sectionTitle}>CHUYẾN ĐI CỦA BẠN</Text>
          <Text style={styles.memberCount}>{trips.length} CHUYẾN</Text>
        </View>
        {showViewAll && (
          <TouchableOpacity
            onPress={() => {
              if (onViewAll) onViewAll();
              else router.push("/field-operations/leader-trips" as any);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>Xem tất cả →</Text>
          </TouchableOpacity>
        )}
      </View>

      {trips.map((trip) => {
        const shortId = trip.id ? trip.id.slice(0, 8).toUpperCase() : "TOUR";
        const badge = getStatusBadge(trip.status);
        const cpCount = trip.checkpoints?.length || 0;
        const trailName =
          trip.trails?.[0]?.snapshotName || trip.trails?.[0]?.name || trip.title;
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
        const canCancel =
          Boolean(onCancelTrip) &&
          (trip.status === "DRAFT" || trip.status === "OPEN" || trip.status === "FULL");

        return (
          <View key={trip.id} style={styles.card}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                router.push({
                  pathname: "/field-operations/leader-trip-detail" as any,
                  params: { tripId: trip.id },
                });
              }}
            >
              {/* Top row: Mã tour rút gọn & Badge trạng thái */}
              <View style={styles.cardTop}>
                <View style={styles.codeWrap}>
                  <Text style={styles.codeText}>#{shortId}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusText, { color: badge.color }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>

              {/* Tên chuyến đi & phụ đề */}
              <Text style={styles.tripTitle}>{trip.title}</Text>
              <Text style={styles.tripSubtitle}>
                Hành trình {cpCount} trạm kiểm soát VFRS
              </Text>

              {/* Tên cung đường */}
              <View style={styles.trailRow}>
                <Text style={styles.trailIcon}>⌁</Text>
                <Text style={styles.trailName} numberOfLines={1}>
                  {trailName}
                </Text>
              </View>

              {/* Lịch khởi hành */}
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={13} color="#707972" />
                <Text style={styles.infoText}>
                  {formatTripDates(trip.startAt, trip.endAt)}
                </Text>
              </View>

              {/* Tiến độ thành viên */}
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
            </TouchableOpacity>

            {/* Footer: Doanh thu dự kiến & Nút Quản lý đoàn */}
            <View style={styles.cardFooter}>
              <View style={styles.revenueWrap}>
                <Text style={styles.revenueLabel}>Doanh thu dự kiến</Text>
                <Text style={styles.revenueValue}>
                  {formatCurrency(expectedRevenue)} ₫
                </Text>
              </View>

              <View style={styles.footerActions}>
                {canCancel && (
                  <TouchableOpacity
                    style={styles.cancelActionBtn}
                    onPress={() => handleOpenCancelModal(trip)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle-outline" size={14} color="#ba1a1a" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.manageBtn}
                  onPress={() => {
                    router.push({
                      pathname: "/field-operations/leader-trip-detail" as any,
                      params: { tripId: trip.id },
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manageBtnText}>Chi tiết chuyến</Text>
                  <Ionicons name="arrow-forward" size={14} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}

      {/* Cancellation Request Modal */}
      <Modal
        visible={Boolean(selectedTripForCancel)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isCancelling) setSelectedTripForCancel(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="alert-circle" size={20} color="#ba1a1a" />
                <Text style={styles.modalTitle}>Yêu cầu hủy chuyến đi</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTripForCancel(null)}
                disabled={isCancelling}
              >
                <Ionicons name="close" size={20} color="#707972" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Chuyến: {selectedTripForCancel?.title} (Phiên bản v{selectedTripForCancel?.version})
            </Text>

            <Text style={styles.inputLabel}>Lý do hủy chuyến (bắt buộc) *</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Nhập lý do chi tiết (thời tiết nguy hiểm, sạt lở tuyến, sự cố cá nhân...)"
              placeholderTextColor="#707972"
              multiline
              numberOfLines={4}
              style={styles.reasonInput}
              editable={!isCancelling}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSelectedTripForCancel(null)}
                disabled={isCancelling}
              >
                <Text style={styles.modalCancelBtnText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  (!cancelReason.trim() || isCancelling) && styles.disabledBtn,
                ]}
                onPress={handleConfirmCancel}
                disabled={!cancelReason.trim() || isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={14} color="#fff" />
                    <Text style={styles.modalSubmitBtnText}>Gửi yêu cầu</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  memberCount: {
    color: Colors.onSurfaceMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#125238",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e1e9e2",
    ...Shadows.card,
    gap: 8,
  },
  cardTop: {
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  tripTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#121c2a",
    lineHeight: 20,
    marginTop: 2,
  },
  tripSubtitle: {
    fontSize: 11.5,
    color: "#707972",
    marginTop: -2,
  },
  trailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f4fbf4",
    borderWidth: 1,
    borderColor: "#d1e8d5",
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    gap: 5,
    backgroundColor: "#fafbfa",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eef2ef",
    marginTop: 2,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressCountLabel: {
    fontSize: 11,
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
    height: 5,
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
    marginTop: 2,
  },
  revenueWrap: {
    gap: 2,
  },
  revenueLabel: {
    fontSize: 9.5,
    color: "#707972",
    textTransform: "uppercase",
  },
  revenueValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#125238",
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancelActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#fff8f7",
    borderWidth: 1,
    borderColor: "#ffdad6",
    alignItems: "center",
    justifyContent: "center",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: Radius.lg,
    padding: 20,
    gap: 12,
    ...Shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ba1a1a",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#414942",
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#121c2a",
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#e1e9e2",
    borderRadius: Radius.md,
    padding: 10,
    fontSize: 12,
    color: "#121c2a",
    textAlignVertical: "top",
    backgroundColor: "#fbfcfb",
    minHeight: 80,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#e1e9e2",
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#707972",
  },
  modalSubmitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ba1a1a",
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  modalSubmitBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
  disabledBtn: {
    backgroundColor: "#a2aba3",
  },
});
