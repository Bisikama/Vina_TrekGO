import { TripGpsButton } from "@/components/trip/TripGpsButton";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import {
  CancelBookingModal,
  EditParticipantsModal,
  PaymentCompleteResult,
  PaymentWebViewModal,
} from "@/features/bookings/components";
import {
  useBookingDetail,
  useBookingMutations,
  usePaymentOptions,
} from "@/features/bookings/hooks";
import {
  BOOKING_STATUS_LABELS,
  bookingApiService,
} from "@/features/bookings/services/booking.api";
import type {
  CheckInStatus,
  LinkageStatus,
  Participant,
  PaymentGateway,
} from "@/features/bookings/types";
import { buildShortCode } from "@/features/check-in/utils/checkInQr";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

function getCheckinBadge(status?: CheckInStatus, method?: string | null) {
  if (status === "CHECKED_IN") {
    const methodStr = method === "QR" ? "QR" : method === "MANUAL" ? "Thủ công" : "";
    return {
      label: methodStr ? `${methodStr} · Đã điểm danh` : "Đã điểm danh",
      color: "#166534",
      bg: { backgroundColor: "#dcfce7" },
      icon: "checkmark-circle" as const,
    };
  }
  if (status === "NO_SHOW") {
    return {
      label: "Vắng mặt",
      color: "#991b1b",
      bg: { backgroundColor: "#fee2e2" },
      icon: "close-circle" as const,
    };
  }
  return {
    label: "Chưa điểm danh",
    color: "#854d0e",
    bg: { backgroundColor: "#fef3c7" },
    icon: "time-outline" as const,
  };
}

function getLinkageBadge(status?: LinkageStatus, recipientDisplay?: string | null) {
  if (status === "CLAIMED") {
    return {
      label: "Tài khoản cá nhân",
      color: "#0369a1",
      bg: { backgroundColor: "#e0f2fe" },
      icon: "person-circle" as const,
    };
  }
  if (status === "INVITATION_PENDING") {
    return {
      label: `Đang mời: ${recipientDisplay || "..."}`,
      color: "#6b21a8",
      bg: { backgroundColor: "#f3e8ff" },
      icon: "mail-outline" as const,
    };
  }
  return {
    label: "Chưa liên kết",
    color: "#475569",
    bg: { backgroundColor: "#f1f5f9" },
    icon: "link-outline" as const,
  };
}

export interface BookingCheckoutScreenProps {
  bookingId?: string;
}

export function BookingCheckoutScreen({
  bookingId: propId,
}: BookingCheckoutScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const bookingId =
    propId || (Array.isArray(params.id) ? params.id[0] : params.id) || "";

  const [isWaitingPaymentConfirmation, setIsWaitingPaymentConfirmation] = useState<boolean>(false);

  const {
    booking,
    setBooking,
    isLoading,
    error,
    remainingSeconds,
    isHoldExpired,
    refetch,
  } = useBookingDetail(bookingId, true, isWaitingPaymentConfirmation);

  const { createPayment, isSubmitting } = useBookingMutations();
  const { gateways } = usePaymentOptions();

  const { user } = useAuth();
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>("vnpay");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [qrModalData, setQrModalData] = useState<string | null>(null);
  const [paymentWebViewUrl, setPaymentWebViewUrl] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  // M6 Ticket Management State
  const [selectedParticipantForQr, setSelectedParticipantForQr] = useState<Participant | null>(null);
  const [inviteModalParticipant, setInviteModalParticipant] = useState<Participant | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleSelfClaim = useCallback(
    async (p: Participant) => {
      if (!p.id) return;
      Alert.alert(
        "Tự nhận vé này",
        `Xác nhận nhận vé của "${p.fullName}" gắn với tài khoản ${user?.email || "của bạn"}?\nSau khi nhận, vé sẽ hiển thị trong mục Vé của tôi.`,
        [
          { text: "Để sau", style: "cancel" },
          {
            text: "Xác nhận nhận",
            onPress: async () => {
              setIsActionLoading(true);
              try {
                await bookingApiService.selfClaimParticipant(bookingId, p.id!);
                Alert.alert("Thành công", "Bạn đã tự nhận vé thành công!");
                void refetch();
              } catch (err: any) {
                Alert.alert("Lỗi nhận vé", err?.message || "Không thể tự nhận vé.");
              } finally {
                setIsActionLoading(false);
              }
            },
          },
        ],
      );
    },
    [bookingId, user?.email, refetch],
  );

  const handleOpenInvite = useCallback((p: Participant) => {
    setInviteModalParticipant(p);
    setInviteEmail("");
  }, []);

  const handleSubmitInvite = useCallback(async () => {
    if (!inviteModalParticipant?.id) return;
    const email = inviteEmail.trim();
    if (!email) {
      Alert.alert("Lỗi", "Vui lòng nhập email người nhận vé.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Lỗi", "Email không đúng định dạng.");
      return;
    }
    if (user?.email && email.toLowerCase() === user.email.toLowerCase()) {
      Alert.alert(
        "Email không hợp lệ",
        "Đây là email tài khoản của bạn. Vui lòng bấm 'Tự nhận vé' thay vì gửi lời mời cho chính mình.",
      );
      return;
    }

    setIsActionLoading(true);
    try {
      await bookingApiService.inviteParticipant(
        bookingId,
        inviteModalParticipant.id,
        email,
        user?.email,
      );
      Alert.alert(
        "Đã gửi vé thành công! 🎉",
        `Lời mời đã được gửi tới ${email}. Bạn của bạn có thể đăng nhập hoặc tạo tài khoản với email này để nhận vé.`,
      );
      setInviteModalParticipant(null);
      setInviteEmail("");
      void refetch();
    } catch (err: any) {
      Alert.alert("Lỗi gửi vé", err?.message || "Không thể gửi lời mời vé.");
    } finally {
      setIsActionLoading(false);
    }
  }, [bookingId, inviteModalParticipant, inviteEmail, user?.email, refetch]);

  const handleRevoke = useCallback(
    async (p: Participant) => {
      const invitationId = p.pendingInvitationId;
      if (!invitationId) return;
      Alert.alert(
        "Thu hồi lời mời",
        `Bạn có chắc chắn muốn thu hồi lời mời gửi tới "${p.recipientDisplay || "người nhận"}"?`,
        [
          { text: "Không", style: "cancel" },
          {
            text: "Thu hồi",
            style: "destructive",
            onPress: async () => {
              setIsActionLoading(true);
              try {
                await bookingApiService.revokeInvitation(invitationId);
                Alert.alert("Thành công", "Đã thu hồi lời mời vé thành công.");
                void refetch();
              } catch (err: any) {
                Alert.alert("Lỗi thu hồi", err?.message || "Không thể thu hồi vé.");
              } finally {
                setIsActionLoading(false);
              }
            },
          },
        ],
      );
    },
    [refetch],
  );

  const handlePaymentWebViewComplete = useCallback(
    async (result: PaymentCompleteResult) => {
      setPaymentWebViewUrl(null);

      if (result.success) {
        // Chỉ xóa session key khi thanh toán đã thành công để các đơn sau tạo mới bình thường
        bookingApiService.clearBookingPaymentSession(bookingId);
        setIsWaitingPaymentConfirmation(true);

        const isSuccessStatus = (s?: string) =>
          ["CONFIRMED", "PARTIAL_CHECKIN", "CHECKED_IN", "COMPLETED"].includes(s || "");

        // Retry refetch (mỗi 1s) để đảm bảo backend đã kịp ghi nhận webhook / return và đổi trạng thái sang CONFIRMED
        let updated = await refetch();
        if (!isSuccessStatus(updated?.status)) {
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise((r) => setTimeout(r, 1000));
            updated = await refetch();
            if (isSuccessStatus(updated?.status)) break;
          }
        }
        setIsWaitingPaymentConfirmation(false);
        if (isSuccessStatus(updated?.status)) {
          setShowSuccessModal(true);
        } else {
          Alert.alert(
            "Đang xử lý đối soát",
            "Giao dịch của bạn đã được tiếp nhận và đang chờ máy chủ cập nhật trạng thái.",
          );
        }
      } else {
        setIsWaitingPaymentConfirmation(false);
        // KHÔNG xóa session key ở đây để nếu user bấm "Thanh toán ngay" lại, app tái sử dụng cùng key/phiên thanh toán
        Alert.alert(
          "Chưa hoàn tất thanh toán",
          result.message || "Giao dịch chưa hoàn tất. Bạn có thể nhấn 'Thanh toán ngay' để tiếp tục.",
        );
      }
    },
    [bookingId, refetch],
  );

  if (isLoading && !booking) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={styles.loadingText}>Đang tải thông tin đặt chỗ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết đặt chỗ</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
          <Text style={styles.errorTitle}>Không tìm thấy đơn đặt chỗ</Text>
          <Text style={styles.errorSub}>{error || "Đơn đặt chỗ không tồn tại hoặc bạn không có quyền truy cập."}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => router.replace("/bookings" as any)}
          >
            <Text style={styles.retryBtnText}>Về Đặt chỗ của tôi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isPending = booking.status === "PENDING_PAYMENT";
  const isConfirmed =
    booking.status === "CONFIRMED" ||
    booking.status === "PARTIAL_CHECKIN" ||
    booking.status === "CHECKED_IN" ||
    booking.status === "COMPLETED";
  const isCancelled = booking.status === "CANCELLED";
  const isExpired = booking.status === "EXPIRED" || (isPending && isHoldExpired);

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timerStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const startDate = booking.trip?.startAt ? new Date(booking.trip.startAt) : null;
  const endDate = booking.trip?.endAt ? new Date(booking.trip.endAt) : null;

  async function handlePay() {
    if (!booking) return;

    if (isHoldExpired) {
      Alert.alert(
        "Hết hạn giữ chỗ",
        "Thời gian giữ vé đã kết thúc. Vui lòng tạo đặt chỗ mới để tham gia chuyến đi.",
        [
          {
            text: "Tìm chuyến khác",
            onPress: () => router.push("/(tabs)/explore" as any),
          },
        ],
      );
      return;
    }

    // 1. Kiểm tra xem booking hiện tại đã có checkout URL của phiên đang mở hay chưa
    const existingCheckout = booking.paymentSummary?.checkout;
    const isSameGateway =
      !booking.paymentSummary?.gateway ||
      booking.paymentSummary?.gateway?.toLowerCase() === selectedGateway.toLowerCase();
    const isCheckoutNotExpired =
      !existingCheckout?.expiresAt ||
      new Date(existingCheckout.expiresAt).getTime() > Date.now();

    if (existingCheckout?.url && isSameGateway && isCheckoutNotExpired) {
      setPaymentWebViewUrl(existingCheckout.url);
      return;
    }

    try {
      const res = await createPayment(
        booking.id,
        "REDIRECT",
        selectedGateway,
        booking.paymentSummary?.paymentId,
      );

      if (res.checkout?.url) {
        setPaymentWebViewUrl(res.checkout.url);
      } else if (res.checkout?.qrData) {
        setQrModalData(res.checkout.qrData);
      }

      void refetch();
    } catch (err: any) {
      const errMsg = err?.message || "";
      const isUnresolved =
        err?.code === "PAYMENT_ATTEMPT_IN_PROGRESS" ||
        errMsg.toLowerCase().includes("unresolved") ||
        err?.status === 409;

      if (isUnresolved) {
        // Tự động refetch lại chi tiết đơn đặt chỗ từ server
        const fresh = await refetch();

        // Nếu trạng thái đơn thực ra đã là CONFIRMED
        if (fresh?.status === "CONFIRMED") {
          setShowSuccessModal(true);
          return;
        }

        // Nếu phiên thanh toán cũ vẫn có checkout URL khả dụng, mở lại ngay cho user
        if (fresh?.paymentSummary?.checkout?.url) {
          setPaymentWebViewUrl(fresh.paymentSummary.checkout.url);
          return;
        }

        Alert.alert(
          "Giao dịch đang được xử lý",
          "Cổng thanh toán đang có một phiên giao dịch chưa kết thúc. Vui lòng chờ 30 giây để hệ thống tự động hoàn tất hoặc hủy phiên cũ.",
          [
            {
              text: "Kiểm tra lại",
              onPress: () => void refetch(),
            },
            { text: "Đóng", style: "cancel" },
          ],
        );
        return;
      }

      Alert.alert(
        "Lỗi thanh toán",
        errMsg || "Không thể khởi tạo cổng thanh toán lúc này.",
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isConfirmed ? "Vé điện tử & Đặt chỗ" : "Thanh toán đặt chỗ"}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => void refetch()}>
          <Ionicons name="refresh" size={18} color={Colors.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status / Countdown Banner */}
        {isPending && !isHoldExpired ? (
          <View style={styles.countdownBanner}>
            <View style={styles.countdownIcon}>
              <Ionicons name="hourglass" size={20} color="#D97706" />
            </View>
            <View style={styles.countdownTextCol}>
              <Text style={styles.countdownTitle}>Thời gian giữ chỗ của bạn</Text>
              <Text style={styles.countdownTimer}>{timerStr}</Text>
              <Text style={styles.countdownSub}>
                Vui lòng hoàn tất thanh toán trước khi hết thời gian để bảo đảm suất đi.
              </Text>
            </View>
          </View>
        ) : null}

        {isHoldExpired ? (
          <View style={styles.expiredBanner}>
            <Ionicons name="alert-circle" size={22} color="#DC2626" />
            <View style={styles.flex1}>
              <Text style={styles.expiredTitle}>Đặt chỗ đã hết hạn</Text>
              <Text style={styles.expiredSub}>
                Thời gian giữ chỗ tạm thời đã kết thúc. Vui lòng tạo đặt chỗ mới.
              </Text>
            </View>
          </View>
        ) : null}

        {isConfirmed ? (
          <View style={styles.confirmedBanner}>
            <Ionicons name="checkmark-circle" size={26} color="#16A34A" />
            <View style={styles.flex1}>
              <Text style={styles.confirmedTitle}>Vé đã được xác nhận! 🎉</Text>
              <Text style={styles.confirmedSub}>
                Bạn đã hoàn tất thanh toán và có tên chính thức trong danh sách đoàn.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Trip Overview Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.tripEyebrow}>CHUYẾN ĐI CÔNG KHAI</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {BOOKING_STATUS_LABELS[booking.status] || booking.status}
              </Text>
            </View>
          </View>

          <Text style={styles.tripTitle}>{booking.trip?.title}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.primaryDark} />
            <Text style={styles.metaText}>
              {startDate?.toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              -{" "}
              {endDate?.toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          {(booking.trip as any)?.leader?.fullName ? (
            <View style={styles.metaRow}>
              <Ionicons name="person-outline" size={16} color={Colors.primaryDark} />
              <View style={styles.flex1}>
                <Text style={styles.metaBoldText}>Người dẫn đoàn:</Text>
                <Text style={styles.metaText}>
                  {(booking.trip as any).leader.fullName}
                </Text>
              </View>
            </View>
          ) : null}

          {booking.pickup ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={16} color={Colors.primaryDark} />
              <View style={styles.flex1}>
                <Text style={styles.metaBoldText}>Điểm tập kết:</Text>
                <Text style={styles.metaText}>
                  {booking.pickup.name} ({booking.pickup.address})
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {isConfirmed && booking.trip?.id && (
          <View style={{ marginBottom: 16 }}>
            <TripGpsButton
              tripStatus={booking.trip.status}
              tripId={booking.trip.id}
              tripType="PUBLIC"
              tripTitle={booking.trip.title}
            />
          </View>
        )}

        {/* Transport Section (Only visible when CONFIRMED) */}
        {isConfirmed && booking.transport && booking.transport.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="bus-outline" size={18} color={Colors.primaryDark} />
              </View>
              <Text style={styles.sectionTitle}>Thông tin phương tiện di chuyển</Text>
            </View>

            {booking.transport.map((t, idx) => (
              <View key={idx} style={styles.transportBox}>
                <View style={styles.transportRow}>
                  <Text style={styles.transportLabel}>Loại xe:</Text>
                  <Text style={styles.transportVal}>{t.vehicleType}</Text>
                </View>
                {t.plateNumber ? (
                  <View style={styles.transportRow}>
                    <Text style={styles.transportLabel}>Biển số xe:</Text>
                    <Text style={styles.transportValBold}>{t.plateNumber}</Text>
                  </View>
                ) : null}
                {t.driverName ? (
                  <View style={styles.transportRow}>
                    <Text style={styles.transportLabel}>Tài xế:</Text>
                    <Text style={styles.transportVal}>{t.driverName}</Text>
                  </View>
                ) : null}
                {t.driverPhone ? (
                  <View style={styles.transportRow}>
                    <Text style={styles.transportLabel}>SĐT tài xế:</Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${t.driverPhone}`)}
                    >
                      <Text style={styles.phoneLink}>{t.driverPhone}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {t.meetingAt ? (
                  <View style={styles.transportRow}>
                    <Text style={styles.transportLabel}>Giờ tập trung:</Text>
                    <Text style={styles.transportVal}>
                      {new Date(t.meetingAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Participants / Tickets Section */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={isConfirmed ? "ticket-outline" : "people-outline"}
                size={18}
                color={Colors.primaryDark}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.sectionTitle}>
                {isConfirmed
                  ? `Vé tham gia & Thành viên (${booking.participants?.length || 0})`
                  : `Danh sách thành viên (${booking.participants?.length || 0})`}
              </Text>
            </View>
            {booking.canEditParticipants && !isConfirmed ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setShowEditModal(true)}
              >
                <Ionicons name="create-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.editBtnText}>Chỉnh sửa</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isConfirmed ? (
            <View style={styles.ticketList}>
              {booking.participants?.map((p, idx) => {
                const shortCode = buildShortCode(booking.id, p.id || String(idx + 1));
                const checkinBadge = getCheckinBadge(p.checkinStatus, p.checkinMethod);
                const linkageBadge = getLinkageBadge(p.linkageStatus, p.recipientDisplay);

                const canSelfClaim =
                  p.actions?.canSelfClaim ?? (p.linkageStatus === "UNLINKED" || !p.linkageStatus);
                const canInvite =
                  p.actions?.canInvite ?? (p.linkageStatus === "UNLINKED" || !p.linkageStatus);
                const canRevoke =
                  p.actions?.canRevoke ??
                  (p.linkageStatus === "INVITATION_PENDING" && Boolean(p.pendingInvitationId));

                return (
                  <View key={p.id || idx} style={styles.ticketCard}>
                    {/* Ticket Header */}
                    <View style={styles.ticketCardHeader}>
                      <View style={styles.ticketAvatar}>
                        <Text style={styles.ticketAvatarText}>
                          {(p.fullName || "T")[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.flex1}>
                        <View style={styles.ticketNameRow}>
                          <Text style={styles.ticketFullName} numberOfLines={1}>
                            {p.fullName}
                          </Text>
                          <Text style={styles.ticketShortCode}>{shortCode}</Text>
                        </View>
                        <Text style={styles.ticketPhone}>
                          {p.phone ? `SĐT: ${p.phone}` : "Chưa cập nhật SĐT"}
                        </Text>
                        {p.emergencyContactName ? (
                          <Text style={styles.ticketEmergencyText}>
                            Khẩn cấp: {p.emergencyContactName}{" "}
                            {p.emergencyContactPhone ? `(${p.emergencyContactPhone})` : ""}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Badges Row */}
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, checkinBadge.bg]}>
                        <Ionicons
                          name={checkinBadge.icon}
                          size={11}
                          color={checkinBadge.color}
                        />
                        <Text style={[styles.badgeText, { color: checkinBadge.color }]}>
                          {checkinBadge.label}
                        </Text>
                      </View>

                      <View style={[styles.badge, linkageBadge.bg]}>
                        <Ionicons
                          name={linkageBadge.icon}
                          size={11}
                          color={linkageBadge.color}
                        />
                        <Text style={[styles.badgeText, { color: linkageBadge.color }]}>
                          {linkageBadge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Actions Row */}
                    <View style={styles.ticketActionsRow}>
                      {p.checkinCode ? (
                        <TouchableOpacity
                          style={[styles.ticketActionBtn, styles.ticketActionBtnPrimary]}
                          onPress={() => setSelectedParticipantForQr(p)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="qr-code-outline" size={15} color={Colors.inkDeep} />
                          <Text style={styles.ticketActionBtnPrimaryText}>Mã QR Check-in</Text>
                        </TouchableOpacity>
                      ) : null}

                      {canSelfClaim ? (
                        <TouchableOpacity
                          style={[styles.ticketActionBtn, styles.ticketActionBtnOutline]}
                          onPress={() => handleSelfClaim(p)}
                          disabled={isActionLoading}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="person-add-outline" size={15} color={Colors.ink} />
                          <Text style={styles.ticketActionBtnOutlineText}>Tự nhận vé</Text>
                        </TouchableOpacity>
                      ) : null}

                      {canInvite ? (
                        <TouchableOpacity
                          style={[styles.ticketActionBtn, styles.ticketActionBtnOutline]}
                          onPress={() => handleOpenInvite(p)}
                          disabled={isActionLoading}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="paper-plane-outline" size={15} color={Colors.ink} />
                          <Text style={styles.ticketActionBtnOutlineText}>Gửi vé cho bạn</Text>
                        </TouchableOpacity>
                      ) : null}

                      {canRevoke ? (
                        <TouchableOpacity
                          style={[styles.ticketActionBtn, styles.ticketActionBtnDanger]}
                          onPress={() => handleRevoke(p)}
                          disabled={isActionLoading}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="arrow-undo-outline" size={15} color={Colors.error} />
                          <Text style={styles.ticketActionBtnDangerText}>Thu hồi mời</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            booking.participants?.map((p, idx) => (
              <View key={p.id || idx} style={styles.participantItem}>
                <View style={styles.pIndex}>
                  <Text style={styles.pIndexText}>#{idx + 1}</Text>
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.pName}>{p.fullName}</Text>
                  <View style={styles.pMetaRow}>
                    {p.phone ? (
                      <Text style={styles.pMetaText}>SĐT: {p.phone}</Text>
                    ) : null}
                    {p.dateOfBirth ? (
                      <Text style={styles.pMetaText}>Sinh: {p.dateOfBirth}</Text>
                    ) : null}
                  </View>
                  {p.emergencyContactName ? (
                    <Text style={styles.pEmergencyText}>
                      Khẩn cấp: {p.emergencyContactName}{" "}
                      {p.emergencyContactPhone ? `(${p.emergencyContactPhone})` : ""}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Payment Gateways Selection (When PENDING_PAYMENT) */}
        {isPending && !isHoldExpired ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Chọn phương thức thanh toán</Text>
            <Text style={styles.sectionSub}>
              Cổng thanh toán bảo mật liên kết trực tiếp
            </Text>

            <View style={styles.gatewayList}>
              {gateways.map((g) => {
                const isSelected = selectedGateway === g.gateway;
                const isVnPay = g.gateway === "vnpay";

                return (
                  <TouchableOpacity
                    key={g.gateway}
                    style={[
                      styles.gatewayOption,
                      isSelected && styles.gatewayOptionSelected,
                    ]}
                    onPress={() => setSelectedGateway(g.gateway)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.radioCircle}>
                      {isSelected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <View style={styles.gatewayInfo}>
                      <Text style={styles.gatewayName}>
                        {isVnPay
                          ? "Cổng VNPAY (ATM / Visa / QR)"
                          : "Ví điện tử MoMo"}
                      </Text>
                      <Text style={styles.gatewayDesc}>
                        {isVnPay
                          ? "Thanh toán qua thẻ nội địa, quốc tế hoặc quét mã VNPAY-QR"
                          : "Xác thực nhanh qua ứng dụng MoMo trên điện thoại"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Pricing Summary Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Chi tiết chi phí</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceItemLabel}>
              Đơn giá vé ({booking.participantCount} người)
            </Text>
            <Text style={styles.priceItemVal}>
              {Number(booking.pricePerPax || 0).toLocaleString("vi-VN")} đ / người
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceTotalRow}>
            <Text style={styles.priceTotalLabel}>Tổng số tiền cần trả:</Text>
            <Text style={styles.priceTotalVal}>
              {Number(booking.totalAmount || 0).toLocaleString("vi-VN")} đ
            </Text>
          </View>
        </View>

        {/* Refund Details (if any) */}
        {booking.refunds && booking.refunds.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thông tin hoàn tiền</Text>
            {booking.refunds.map((ref, idx) => (
              <View key={ref.refundId || idx} style={styles.refundBox}>
                <View style={styles.refundRow}>
                  <Text style={styles.refundLabel}>Số tiền hoàn:</Text>
                  <Text style={styles.refundVal}>
                    {Number(ref.amount || 0).toLocaleString("vi-VN")} đ
                  </Text>
                </View>
                <View style={styles.refundRow}>
                  <Text style={styles.refundLabel}>Trạng thái:</Text>
                  <Text style={styles.refundStatus}>{ref.status}</Text>
                </View>
                {ref.refundedAt ? (
                  <View style={styles.refundRow}>
                    <Text style={styles.refundLabel}>Thời gian hoàn:</Text>
                    <Text style={styles.refundTime}>
                      {new Date(ref.refundedAt).toLocaleString("vi-VN")}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Cancellation Option */}
        {booking.canCancel ? (
          <TouchableOpacity
            style={styles.cancelBookingBtn}
            onPress={() => setShowCancelModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={styles.cancelBookingText}>Hủy đặt chỗ này</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Sticky Bottom Action (when PENDING_PAYMENT and not expired) */}
      {isPending && !isHoldExpired ? (
        <View style={styles.stickyFooter}>
          <View style={styles.stickyPriceCol}>
            <Text style={styles.stickyLabel}>Số tiền thanh toán:</Text>
            <Text style={styles.stickyAmount}>
              {Number(booking.totalAmount || 0).toLocaleString("vi-VN")} đ
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.payNowBtn,
              (isSubmitting || isWaitingPaymentConfirmation) && styles.btnDisabled,
            ]}
            onPress={handlePay}
            disabled={isSubmitting || isWaitingPaymentConfirmation}
            activeOpacity={0.88}
          >
            {isSubmitting || isWaitingPaymentConfirmation ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.payNowText}>
                  {isWaitingPaymentConfirmation
                    ? "Đang chờ xác nhận..."
                    : "Đang xử lý..."}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.payNowText}>Thanh toán ngay</Text>
                <Ionicons name="card-outline" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Edit Participants Modal */}
      {showEditModal && booking ? (
        <EditParticipantsModal
          visible={showEditModal}
          booking={booking}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updated) => {
            setBooking(updated);
            void refetch();
          }}
        />
      ) : null}

      {/* Cancel Booking Modal */}
      {showCancelModal && booking ? (
        <CancelBookingModal
          visible={showCancelModal}
          bookingId={booking.id}
          totalAmount={booking.totalAmount}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            void refetch();
          }}
        />
      ) : null}

      {/* In-App Payment WebView Modal (VNPAY / MoMo) */}
      {paymentWebViewUrl ? (
        <PaymentWebViewModal
          visible={Boolean(paymentWebViewUrl)}
          url={paymentWebViewUrl}
          title={selectedGateway === "vnpay" ? "Cổng thanh toán VNPAY" : "Cổng thanh toán MoMo"}
          onClose={() => setPaymentWebViewUrl(null)}
          onPaymentComplete={handlePaymentWebViewComplete}
        />
      ) : null}

      {/* Payment Success Celebration Modal */}
      {showSuccessModal && booking ? (
        <Modal
          visible={showSuccessModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={styles.successModalOverlay}>
            <View style={styles.successModalCard}>
              <View style={styles.successModalIcon}>
                <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
              </View>

              <Text style={styles.successModalTitle}>Thanh toán thành công! 🎉</Text>
              <Text style={styles.successModalSubtitle}>
                Đơn đặt chỗ đã được xác nhận chính thức. Chúc bạn có một hành trình an toàn và trọn vẹn!
              </Text>

              <View style={styles.successModalDetailsBox}>
                <View style={styles.successModalRow}>
                  <Text style={styles.successModalLabel}>Mã đặt chỗ</Text>
                  <Text style={styles.successModalVal}>
                    {booking.bookingCode ||
                      `#BK-${booking.id.slice(0, 8).toUpperCase()}`}
                  </Text>
                </View>

                <View style={styles.successModalRow}>
                  <Text style={styles.successModalLabel}>Chuyến đi</Text>
                  <Text
                    style={[styles.successModalVal, { flex: 1, textAlign: "right" }]}
                    numberOfLines={1}
                  >
                    {booking.trip?.title}
                  </Text>
                </View>

                <View style={styles.successModalRow}>
                  <Text style={styles.successModalLabel}>Số lượng vé</Text>
                  <Text style={styles.successModalVal}>
                    {booking.participantCount} vé
                  </Text>
                </View>

                <View style={styles.successModalRow}>
                  <Text style={styles.successModalLabel}>Tổng thanh toán</Text>
                  <Text
                    style={[
                      styles.successModalVal,
                      { color: Colors.primaryDark, fontWeight: "900" },
                    ]}
                  >
                    {parseFloat(booking.totalAmount).toLocaleString("vi-VN")} VND
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.successModalPrimaryBtn}
                onPress={() => setShowSuccessModal(false)}
                activeOpacity={0.85}
              >
                <Ionicons name="ticket-outline" size={18} color="#FFFFFF" />
                <Text style={styles.successModalPrimaryText}>
                  Xem Vé & Thông tin đưa đón
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.successModalSecondaryBtn}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.push("/(tabs)/trips");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.successModalSecondaryText}>
                  Về mục Chuyến của tôi
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Modal QR Code phóng to */}
      <Modal
        visible={Boolean(selectedParticipantForQr)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedParticipantForQr(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.qrModalCard}>
            <View style={styles.qrModalHeader}>
              <View style={styles.flex1}>
                <Text style={styles.qrModalTitle}>Mã QR Check-in điểm danh</Text>
                <Text style={styles.qrModalSub} numberOfLines={1}>
                  {booking.trip?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.qrModalCloseBtn}
                onPress={() => setSelectedParticipantForQr(null)}
              >
                <Ionicons name="close" size={20} color={Colors.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalBody}>
              <Text style={styles.qrParticipantName}>
                {selectedParticipantForQr?.fullName}
              </Text>
              <Text style={styles.qrParticipantCode}>
                {selectedParticipantForQr
                  ? buildShortCode(booking.id, selectedParticipantForQr.id || "p")
                  : ""}
              </Text>

              <View style={styles.qrFrame}>
                {selectedParticipantForQr?.checkinCode ? (
                  <QRCode
                    value={selectedParticipantForQr.checkinCode}
                    size={200}
                    color={Colors.ink}
                    backgroundColor="#FFFFFF"
                  />
                ) : null}
              </View>

              <View style={styles.qrTipBox}>
                <Ionicons name="sunny-outline" size={16} color="#7a5b00" />
                <Text style={styles.qrTipText}>
                  Xuất trình mã này cho Trưởng đoàn khi tập trung. Vui lòng tăng độ sáng màn hình khi quét.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Gửi vé cho bạn bè */}
      <Modal
        visible={Boolean(inviteModalParticipant)}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalParticipant(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={styles.inviteModalCard}>
            <View style={styles.inviteModalHeader}>
              <View style={styles.iconCirclePrimary}>
                <Ionicons name="mail" size={20} color={Colors.inkDeep} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.inviteModalTitle}>Gửi vé cho bạn bè</Text>
                <Text style={styles.inviteModalSub} numberOfLines={1}>
                  Vé: {inviteModalParticipant?.fullName}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.qrModalCloseBtn}
                onPress={() => setInviteModalParticipant(null)}
                disabled={isActionLoading}
              >
                <Ionicons name="close" size={20} color={Colors.ink} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inviteFormHelp}>
              Nhập email người nhận. Bạn của bạn sẽ nhận được thông báo trong ứng dụng TrekGo để tự liên kết vé vào tài khoản của họ.
            </Text>

            <TextInput
              style={styles.inviteEmailInput}
              placeholder="nhap.email.ban.be@example.com"
              placeholderTextColor={Colors.mute}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isActionLoading}
            />

            <View style={styles.inviteModalActions}>
              <TouchableOpacity
                style={styles.inviteCancelBtn}
                onPress={() => setInviteModalParticipant(null)}
                disabled={isActionLoading}
              >
                <Text style={styles.inviteCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteSubmitBtn, isActionLoading && { opacity: 0.7 }]}
                onPress={handleSubmitInvite}
                disabled={isActionLoading}
              >
                {isActionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                    <Text style={styles.inviteSubmitText}>Gửi vé ngay</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 38,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.onSurface,
    marginTop: 12,
  },
  errorSub: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 18,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  countdownBanner: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    padding: 16,
    borderRadius: Radius.xl,
    marginBottom: 14,
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  countdownIcon: {
    marginTop: 2,
  },
  countdownTextCol: {
    flex: 1,
  },
  countdownTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  countdownTimer: {
    fontSize: 28,
    fontWeight: "900",
    color: "#B45309",
    marginVertical: 4,
    letterSpacing: 1,
  },
  countdownSub: {
    fontSize: 11,
    color: "#92400E",
    lineHeight: 15,
  },
  expiredBanner: {
    flexDirection: "row",
    backgroundColor: "#FEE2E2",
    padding: 14,
    borderRadius: Radius.xl,
    marginBottom: 14,
    alignItems: "center",
    gap: 10,
  },
  expiredTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#DC2626",
  },
  expiredSub: {
    fontSize: 12,
    color: "#991B1B",
    marginTop: 2,
  },
  confirmedBanner: {
    flexDirection: "row",
    backgroundColor: "#DCFCE7",
    padding: 16,
    borderRadius: Radius.xl,
    marginBottom: 14,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  confirmedTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#16A34A",
  },
  confirmedSub: {
    fontSize: 12,
    color: "#15803D",
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  tripEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.primaryDark,
    letterSpacing: 0.8,
  },
  statusPill: {
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  tripTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.onSurface,
    lineHeight: 22,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  metaBoldText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  sectionSub: {
    fontSize: 11,
    color: Colors.onSurfaceMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  transportBox: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
    gap: 8,
  },
  transportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  transportLabel: {
    fontSize: 12,
    color: Colors.onSurfaceMuted,
  },
  transportVal: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.onSurface,
  },
  transportValBold: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  phoneLink: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
    textDecorationLine: "underline",
  },
  participantItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerLow,
  },
  pIndex: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  pIndexText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.onSurfaceVariant,
  },
  pName: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  pMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  pMetaText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  pEmergencyText: {
    fontSize: 10,
    color: Colors.onSurfaceMuted,
    marginTop: 2,
  },
  gatewayList: {
    gap: 10,
    marginTop: 8,
  },
  gatewayOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainer,
  },
  gatewayOptionSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryPale,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.onSurfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  gatewayInfo: {
    flex: 1,
  },
  gatewayName: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  gatewayDesc: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 15,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  priceItemLabel: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  priceItemVal: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.onSurface,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceContainer,
    marginVertical: 10,
  },
  priceTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceTotalLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  priceTotalVal: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.primaryDark,
  },
  refundBox: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    padding: 10,
    gap: 6,
    marginTop: 8,
  },
  refundRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  refundLabel: {
    fontSize: 11,
    color: Colors.onSurfaceMuted,
  },
  refundVal: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  refundStatus: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  refundTime: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  cancelBookingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEE2E2",
    marginTop: 6,
  },
  cancelBookingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  stickyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    ...Shadows.card,
  },
  stickyPriceCol: {
    flex: 1,
  },
  stickyLabel: {
    fontSize: 10,
    color: Colors.onSurfaceMuted,
  },
  stickyAmount: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.primaryDark,
  },
  payNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full,
  },
  payNowText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  flex1: {
    flex: 1,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: "center",
    ...Shadows.hover,
  },
  successModalIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.onSurface,
    textAlign: "center",
    marginBottom: 8,
  },
  successModalSubtitle: {
    fontSize: 13,
    color: Colors.mute,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  successModalDetailsBox: {
    width: "100%",
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  successModalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  successModalLabel: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  successModalVal: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  successModalPrimaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primaryDark,
    paddingVertical: 14,
    borderRadius: Radius.full,
    marginBottom: 10,
  },
  successModalPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  successModalSecondaryBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  successModalSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },

  // M6 Ticket styles
  ticketList: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    gap: 10,
  },
  ticketCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ticketAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryPale,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketAvatarText: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.inkDeep,
  },
  ticketNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ticketFullName: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.onSurface,
    flex: 1,
  },
  ticketShortCode: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.onSurfaceMuted,
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ticketPhone: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  ticketEmergencyText: {
    fontSize: 11,
    color: "#b45309",
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  ticketActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
  },
  ticketActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  ticketActionBtnPrimary: {
    backgroundColor: "#eefbe4",
    borderWidth: 1,
    borderColor: "#c5edab",
  },
  ticketActionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.inkDeep,
  },
  ticketActionBtnOutline: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
  },
  ticketActionBtnOutlineText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.ink,
  },
  ticketActionBtnDanger: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  ticketActionBtnDangerText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.error,
  },

  // Modal QR & Invite styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  qrModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.xl,
    padding: 20,
    alignItems: "center",
    ...Shadows.modal,
  },
  qrModalHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  qrModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.ink,
  },
  qrModalSub: {
    fontSize: 12,
    color: Colors.onSurfaceMuted,
    marginTop: 2,
  },
  qrModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  qrModalBody: {
    width: "100%",
    alignItems: "center",
  },
  qrParticipantName: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.ink,
    textAlign: "center",
  },
  qrParticipantCode: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primaryDark,
    marginTop: 2,
    marginBottom: 16,
  },
  qrFrame: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },
  qrTipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef9c3",
    padding: 12,
    borderRadius: Radius.md,
    marginTop: 18,
  },
  qrTipText: {
    flex: 1,
    fontSize: 11,
    color: "#854d0e",
    lineHeight: 16,
  },

  // Invite Modal
  inviteModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.xl,
    padding: 20,
    ...Shadows.modal,
  },
  inviteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconCirclePrimary: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryPale,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteModalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.ink,
  },
  inviteModalSub: {
    fontSize: 12,
    color: Colors.onSurfaceMuted,
    marginTop: 2,
  },
  inviteFormHelp: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 14,
  },
  inviteEmailInput: {
    width: "100%",
    height: 48,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.ink,
    marginBottom: 18,
  },
  inviteModalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  inviteCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
  },
  inviteSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.inkDeep,
    justifyContent: "center",
  },
  inviteSubmitText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
