import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";

import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import {
  invitationsApiService,
  PersonalTicket,
} from "@/features/invitations/services/invitations.api";
import { Colors, Shadows } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function TripTicketScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips } = useApp();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<PersonalTicket | null>(null);
  const [fullscreenQr, setFullscreenQr] = useState(false);

  // Fallback trip từ context nếu API vé cá nhân chưa có hoặc đang test
  const fallbackTrip = useMemo(() => {
    return trips.find((item) => item.id === id);
  }, [trips, id]);

  const loadTicket = async () => {
    if (!id) return;
    try {
      setLoading(true);
      // 1. Thử lấy chi tiết vé trực tiếp bằng ID
      try {
        const directTicket = await invitationsApiService.fetchTicketDetail(id);
        if (directTicket && directTicket.id) {
          setTicket(directTicket);
          return;
        }
      } catch {
        // ID có thể là tripId chứ không phải ticketId, tiếp tục tìm trong danh sách vé
      }

      // 2. Tìm trong danh sách vé của tôi
      const myTicketsRes = await invitationsApiService.fetchMyTickets({ pageSize: 50 });
      const found = myTicketsRes.items?.find(
        (t) => t.id === id || t.trip?.id === id,
      );

      if (found) {
        setTicket(found);
      } else {
        setTicket(null);
      }
    } catch (err) {
      console.warn("Failed to fetch personal ticket detail:", err);
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#004D40" />
          <Text style={styles.loadingText}>Đang tải vé cá nhân...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Nếu không tìm thấy cả vé API lẫn chuyến trong context
  if (!ticket && !fallbackTrip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Vé tham gia chuyến</Text>
          </View>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.emptyContainer}>
          <Ionicons name="ticket-outline" size={60} color={Colors.onSurfaceMuted} />
          <Text style={styles.emptyTitle}>Không tìm thấy vé</Text>
          <Text style={styles.emptyDescription}>
            Vé cá nhân hoặc chuyến đi này không tồn tại hoặc đã bị thu hồi.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/(tabs)/trips")}
          >
            <Text style={styles.primaryButtonText}>Về chuyến của tôi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Dữ liệu hợp nhất (Ưu tiên API Ticket -> fallback Context Trip)
  const tripTitle = ticket?.trip?.title || fallbackTrip?.name || "Chuyến Trekking TrekGo";
  const destination = ticket?.trip?.destination?.name || fallbackTrip?.destination || "Điểm đến";
  const startAt = ticket?.trip?.startAt || fallbackTrip?.startDate || "Sắp diễn ra";
  const endAt = ticket?.trip?.endAt || fallbackTrip?.endDate || "";
  const participantName =
    ticket?.participantName || user?.fullName || fallbackTrip?.leader?.name || "Thành viên Trekker";
  const checkinStatus = ticket?.checkinStatus || "NOT_CHECKED_IN";
  const checkinCode =
    ticket?.checkinCode || fallbackTrip?.bookingCode || `TG-CHK-${id?.slice(0, 8).toUpperCase()}`;
  const pickupPoint = ticket?.pickupPoint?.name || "Điểm tập kết của đoàn";
  const pickupAddress = ticket?.pickupPoint?.address || "Liên hệ Trưởng đoàn để cập nhật chi tiết";

  const isCheckedIn = checkinStatus === "CHECKED_IN";
  const isNoShow = checkinStatus === "NO_SHOW";

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Vé cá nhân Trekker</Text>
          <Text style={styles.headerSubtitle}>Xuất trình mã QR khi đến điểm tập kết</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setFullscreenQr(true)}
          accessibilityLabel="Phóng to mã QR"
        >
          <Ionicons name="expand-outline" size={22} color="#004D40" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Status Alert Banner */}
        <View
          style={[
            styles.statusBanner,
            isCheckedIn && styles.statusBannerSuccess,
            isNoShow && styles.statusBannerDanger,
          ]}
        >
          <View
            style={[
              styles.statusIcon,
              isCheckedIn && styles.statusIconSuccess,
              isNoShow && styles.statusIconDanger,
            ]}
          >
            <Ionicons
              name={
                isCheckedIn
                  ? "checkmark-circle"
                  : isNoShow
                  ? "close-circle"
                  : "hourglass-outline"
              }
              size={22}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.statusContent}>
            <Text
              style={[
                styles.statusTitle,
                isCheckedIn && styles.statusTitleSuccess,
                isNoShow && styles.statusTitleDanger,
              ]}
            >
              {isCheckedIn
                ? "Đã điểm danh thành công"
                : isNoShow
                ? "Vắng mặt tại điểm tập kết"
                : "Chưa điểm danh (Sẵn sàng quét)"}
            </Text>
            <Text style={styles.statusDescription}>
              {isCheckedIn
                ? "Bạn đã có mặt trên chuyến xe của đoàn"
                : isNoShow
                ? "Vui lòng liên hệ Leader nếu bạn đến muộn"
                : "Vui lòng giữ mã QR sáng rõ để Trưởng đoàn quét"}
            </Text>
          </View>
        </View>

        {/* E-Ticket Card */}
        <View style={styles.ticketCard}>
          {/* Header Card */}
          <View style={styles.ticketTop}>
            <View style={styles.brandIcon}>
              <Ionicons name="compass" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.brandContent}>
              <Text style={styles.brandName}>TrekGo Mobile</Text>
              <Text style={styles.brandCaption}>OFFICIAL E-TICKET · MILESTONE 6</Text>
            </View>
            <View
              style={[
                styles.badge,
                isCheckedIn
                  ? styles.badgeCheckedIn
                  : isNoShow
                  ? styles.badgeNoShow
                  : styles.badgePending,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isCheckedIn
                    ? styles.badgeTextCheckedIn
                    : isNoShow
                    ? styles.badgeTextNoShow
                    : styles.badgeTextPending,
                ]}
              >
                {isCheckedIn ? "CHECKED-IN" : isNoShow ? "NO-SHOW" : "VALID TICKET"}
              </Text>
            </View>
          </View>

          {/* Trip Info Section */}
          <View style={styles.tripSection}>
            <Text style={styles.label}>CHUYẾN ĐI CỦA BẠN</Text>
            <Text style={styles.tripName}>{tripTitle}</Text>

            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={17} color="#004D40" />
              <Text style={styles.metaText}>{destination}</Text>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={17} color="#004D40" />
              <Text style={styles.metaText}>
                {startAt} {endAt ? `– ${endAt}` : ""}
              </Text>
            </View>
          </View>

          {/* Ticket Perforated Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.ticketCutLeft} />
            <View style={styles.dashedLine} />
            <View style={styles.ticketCutRight} />
          </View>

          {/* QR Code Section */}
          <View style={styles.qrSection}>
            <Text style={styles.scanTitle}>MÃ ĐIỂM DANH CHECK-IN</Text>
            <Text style={styles.scanDescription}>
              Trưởng đoàn sẽ dùng camera quét mã QR này tại điểm hẹn xuất phát.
            </Text>

            {/* Render mã QR chuẩn với react-native-qrcode-svg */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setFullscreenQr(true)}
              style={styles.qrFrame}
            >
              <QRCode
                value={checkinCode}
                size={SCREEN_WIDTH > 360 ? 220 : 190}
                color="#004D40"
                backgroundColor="#FFFFFF"
              />
              <View style={styles.qrTapHint}>
                <Ionicons name="expand" size={12} color="#004D40" />
                <Text style={styles.qrTapHintText}>Nhấn để phóng to</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.codeContainer}>
              <Text style={styles.bookingCodeLabel}>MÃ VÉ (UUID)</Text>
              <Text style={styles.bookingCodeText} numberOfLines={1} ellipsizeMode="middle">
                {checkinCode}
              </Text>
            </View>

            {/* Participant Details */}
            <View style={styles.participantBox}>
              <View style={styles.participantRow}>
                <Ionicons name="person-circle-outline" size={20} color="#004D40" />
                <View style={styles.participantInfo}>
                  <Text style={styles.participantLabel}>Thành viên sở hữu vé</Text>
                  <Text style={styles.participantName}>{participantName}</Text>
                </View>
              </View>

              <View style={styles.pickupDivider} />

              <View style={styles.participantRow}>
                <Ionicons name="bus-outline" size={20} color="#D97706" />
                <View style={styles.participantInfo}>
                  <Text style={styles.participantLabel}>Điểm đón tập kết</Text>
                  <Text style={styles.pickupName}>{pickupPoint}</Text>
                  {pickupAddress ? (
                    <Text style={styles.pickupAddress}>{pickupAddress}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {/* Reminder Notice */}
          <View style={styles.reminderBox}>
            <Ionicons name="information-circle-outline" size={20} color="#9A6700" />
            <Text style={styles.reminderText}>
              Vui lòng có mặt tại điểm đón trước giờ khởi hành ít nhất 30 phút. Chuẩn bị sẵn màn hình vé hoặc chụp lại ảnh màn hình mã QR đề phòng khu vực mất sóng.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.fullscreenButton}
            onPress={() => setFullscreenQr(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="sunny-outline" size={18} color="#004D40" />
            <Text style={styles.fullscreenButtonText}>Phóng to mã QR sáng nét</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/(tabs)/trips")}
            activeOpacity={0.85}
          >
            <Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Về Chuyến đi của tôi</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Zoom QR Fullscreen cực sáng cho môi trường ngoài trời */}
      <Modal
        visible={fullscreenQr}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenQr(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Mã Check-in Đoàn</Text>
                <Text style={styles.modalSubtitle}>{participantName}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFullscreenQr(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalQrWrapper}>
              <QRCode
                value={checkinCode}
                size={260}
                color="#000000"
                backgroundColor="#FFFFFF"
              />
            </View>

            <Text style={styles.modalCodeText} numberOfLines={1} ellipsizeMode="middle">
              {checkinCode}
            </Text>

            <View style={styles.modalHintBox}>
              <Ionicons name="bulb-outline" size={16} color="#004D40" />
              <Text style={styles.modalHintText}>
                Mẹo: Tăng độ sáng màn hình điện thoại tối đa để máy quét của Trưởng đoàn dễ dàng nhận diện ngoài trời.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalDoneButton}
              onPress={() => setFullscreenQr(false)}
            >
              <Text style={styles.modalDoneText}>Đóng</Text>
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
    backgroundColor: "#F5F7F5",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    fontWeight: "500",
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8E3",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2EE",
  },
  headerText: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: Colors.onSurface,
    fontSize: 17,
    fontWeight: "800",
  },
  headerSubtitle: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2EE",
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  statusBannerSuccess: {
    backgroundColor: "#DFF4E7",
    borderColor: "#A7F3D0",
  },
  statusBannerDanger: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  statusIcon: {
    width: 38,
    height: 38,
    marginRight: 12,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D97706",
  },
  statusIconSuccess: {
    backgroundColor: "#004D40",
  },
  statusIconDanger: {
    backgroundColor: "#DC2626",
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    color: "#92400E",
    fontSize: 15,
    fontWeight: "800",
  },
  statusTitleSuccess: {
    color: "#065F46",
  },
  statusTitleDanger: {
    color: "#991B1B",
  },
  statusDescription: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  ticketCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DDE5DF",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    ...Shadows.card,
  },
  ticketTop: {
    minHeight: 80,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#004D40",
  },
  brandIcon: {
    width: 42,
    height: 42,
    marginRight: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00695C",
  },
  brandContent: {
    flex: 1,
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  brandCaption: {
    marginTop: 2,
    color: "#B2DFDB",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgePending: {
    backgroundColor: "#FEF3C7",
  },
  badgeCheckedIn: {
    backgroundColor: "#C8F169",
  },
  badgeNoShow: {
    backgroundColor: "#FEE2E2",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  badgeTextPending: {
    color: "#92400E",
  },
  badgeTextCheckedIn: {
    color: "#183100",
  },
  badgeTextNoShow: {
    color: "#991B1B",
  },
  tripSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  label: {
    marginBottom: 6,
    color: Colors.onSurfaceMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  tripName: {
    marginBottom: 12,
    color: Colors.onSurface,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    flex: 1,
    marginLeft: 8,
    color: Colors.onSurfaceVariant,
    fontSize: 13,
  },
  dividerRow: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  ticketCutLeft: {
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
    backgroundColor: "#F5F7F5",
  },
  dashedLine: {
    flex: 1,
    marginHorizontal: 8,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
  },
  ticketCutRight: {
    width: 24,
    height: 24,
    marginRight: -12,
    borderRadius: 12,
    backgroundColor: "#F5F7F5",
  },
  qrSection: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  scanTitle: {
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  scanDescription: {
    maxWidth: 290,
    marginTop: 4,
    marginBottom: 16,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  qrFrame: {
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#B2DFDB",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    ...Shadows.card,
  },
  qrTapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  qrTapHintText: {
    fontSize: 11,
    color: "#004D40",
    fontWeight: "600",
  },
  codeContainer: {
    marginTop: 14,
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 12,
  },
  bookingCodeLabel: {
    fontSize: 10,
    color: Colors.onSurfaceMuted,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  bookingCodeText: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: "monospace",
    color: "#004D40",
    fontWeight: "800",
    letterSpacing: 1,
  },
  participantBox: {
    width: "100%",
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E2E8E3",
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  participantInfo: {
    flex: 1,
    marginLeft: 10,
  },
  participantLabel: {
    fontSize: 11,
    color: Colors.onSurfaceMuted,
    fontWeight: "600",
  },
  participantName: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  pickupDivider: {
    height: 1,
    backgroundColor: "#E2E8E3",
    marginVertical: 10,
  },
  pickupName: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  pickupAddress: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 16,
  },
  reminderBox: {
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  reminderText: {
    flex: 1,
    marginLeft: 8,
    color: "#78350F",
    fontSize: 12,
    lineHeight: 18,
  },
  buttonGroup: {
    marginTop: 18,
    gap: 10,
  },
  fullscreenButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#004D40",
  },
  fullscreenButtonText: {
    color: "#004D40",
    fontSize: 14,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 50,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#004D40",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 14,
    color: Colors.onSurface,
    fontSize: 20,
    fontWeight: "900",
  },
  emptyDescription: {
    marginTop: 8,
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  // Modal Fullscreen QR Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    ...Shadows.modal,
  },
  modalHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalQrWrapper: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    marginVertical: 8,
  },
  modalCodeText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: "monospace",
    color: Colors.onSurfaceVariant,
    fontWeight: "700",
  },
  modalHintBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    padding: 10,
    backgroundColor: "#E0F2F1",
    borderRadius: 12,
  },
  modalHintText: {
    flex: 1,
    fontSize: 11,
    color: "#004D40",
    lineHeight: 16,
  },
  modalDoneButton: {
    marginTop: 18,
    width: "100%",
    height: 46,
    backgroundColor: "#004D40",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDoneText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
