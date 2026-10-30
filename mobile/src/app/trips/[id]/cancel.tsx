import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type CancellationStep = "FORM" | "REVIEW" | "SUCCESS";

const reasons = [
  "Lịch cá nhân thay đổi",
  "Sức khỏe không đảm bảo",
  "Thời tiết không phù hợp",
  "Không thể sắp xếp phương tiện",
  "Lý do khác",
];

export default function CancelBookingScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    bookingCode?: string;
    amount?: string;
  }>();

  const tripName = params.name || "Tà Năng – Phan Dũng (3N2Đ)";

  const bookingCode = params.bookingCode || "#BK-8842";

  const paidAmount = Number(params.amount) || 2850000;

  const cancellationFee = Math.round(paidAmount * 0.1);

  const refundAmount = paidAmount - cancellationFee;

  const [step, setStep] = useState<CancellationStep>("FORM");

  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  function continueToReview() {
    if (!selectedReason) {
      Alert.alert("Chưa chọn lý do", "Bạn cần chọn lý do hủy booking.");

      return;
    }

    if (!acceptedPolicy) {
      Alert.alert(
        "Chưa xác nhận chính sách",
        "Bạn cần đọc và đồng ý với chính sách hủy chuyến.",
      );

      return;
    }

    setStep("REVIEW");
  }

  function confirmCancellation() {
    Alert.alert(
      "Xác nhận hủy booking",
      "Sau khi xác nhận, booking sẽ không thể khôi phục.",
      [
        {
          text: "Quay lại",
          style: "cancel",
        },
        {
          text: "Hủy booking",
          style: "destructive",
          onPress: () => {
            setSubmitting(true);

            setTimeout(() => {
              setSubmitting(false);
              setStep("SUCCESS");
            }, 1200);
          },
        },
      ],
    );
  }

  function returnToTrips() {
    router.replace({
      pathname: "/(tabs)/trips",
      params: {
        cancelledTripId: params.id,
      },
    } as unknown as Href);
  }

  function renderHeader() {
    return (
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (step === "REVIEW") {
              setStep("FORM");
              return;
            }

            router.back();
          }}
          disabled={submitting}
        >
          <Ionicons name="arrow-back" size={22} color="#17231B" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {step === "SUCCESS" ? "Kết quả hủy booking" : "Hủy booking"}
          </Text>

          <Text style={styles.headerSubtitle}>{bookingCode}</Text>
        </View>

        <View style={styles.headerPlaceholder} />
      </View>
    );
  }

  function renderForm() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.warningCard}>
          <View style={styles.warningIcon}>
            <Ionicons name="warning-outline" size={25} color="#FFFFFF" />
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.warningTitle}>Bạn muốn hủy chuyến?</Text>

            <Text style={styles.warningDescription}>
              Booking sẽ bị hủy và chỗ của bạn được mở lại cho người khác.
            </Text>
          </View>
        </View>

        <View style={styles.tripCard}>
          <Text style={styles.tripLabel}>BOOKING ĐANG XÁC NHẬN</Text>

          <Text style={styles.tripName}>{tripName}</Text>

          <View style={styles.tripMetaRow}>
            <Ionicons name="ticket-outline" size={17} color="#1B4332" />

            <Text style={styles.tripMetaText}>{bookingCode}</Text>
          </View>

          <View style={styles.tripMetaRow}>
            <Ionicons name="calendar-outline" size={17} color="#1B4332" />

            <Text style={styles.tripMetaText}>Khởi hành 12 Tháng 10, 2026</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Lý do hủy chuyến</Text>

          <Text style={styles.sectionDescription}>
            Thông tin này giúp TrekGo cải thiện trải nghiệm.
          </Text>

          <View style={styles.reasonList}>
            {reasons.map((reason) => {
              const selected = selectedReason === reason;

              return (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonRow,
                    selected && styles.reasonRowSelected,
                  ]}
                  onPress={() => setSelectedReason(reason)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={22}
                    color={selected ? "#1B4332" : "#94A3B8"}
                  />

                  <Text
                    style={[
                      styles.reasonText,
                      selected && styles.reasonTextSelected,
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.policyCard}>
          <View style={styles.policyHeader}>
            <Ionicons name="document-text-outline" size={22} color="#1B4332" />

            <Text style={styles.policyTitle}>Chính sách hủy chuyến</Text>
          </View>

          <View style={styles.policyItem}>
            <View style={styles.policyDot} />

            <Text style={styles.policyText}>
              Hủy trước ngày khởi hành: phí xử lý 10% tổng thanh toán.
            </Text>
          </View>

          <View style={styles.policyItem}>
            <View style={styles.policyDot} />

            <Text style={styles.policyText}>
              Tiền hoàn được chuyển về phương thức thanh toán ban đầu.
            </Text>
          </View>

          <View style={styles.policyItem}>
            <View style={styles.policyDot} />

            <Text style={styles.policyText}>
              Thời gian xử lý dự kiến từ 3–5 ngày làm việc.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.acceptRow}
          onPress={() => setAcceptedPolicy((current) => !current)}
          activeOpacity={0.85}
        >
          <View
            style={[styles.checkbox, acceptedPolicy && styles.checkboxChecked]}
          >
            {acceptedPolicy && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>

          <Text style={styles.acceptText}>
            Tôi đã đọc và đồng ý với chính sách hủy chuyến, phí xử lý và thời
            gian hoàn tiền.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={continueToReview}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryButtonText}>Xem số tiền được hoàn</Text>

          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderReview() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.reviewHero}>
          <View style={styles.reviewHeroIcon}>
            <Ionicons name="calculator-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.reviewHeroLabel}>ĐỐI SOÁT HOÀN TIỀN</Text>

            <Text style={styles.reviewHeroTitle}>Kiểm tra trước khi hủy</Text>

            <Text style={styles.reviewHeroDescription}>
              Booking không thể khôi phục sau khi xác nhận.
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Thông tin booking</Text>

          <View style={styles.reviewInfoRow}>
            <Text style={styles.reviewInfoLabel}>Chuyến đi</Text>

            <Text style={styles.reviewInfoValue}>{tripName}</Text>
          </View>

          <View style={styles.reviewInfoRow}>
            <Text style={styles.reviewInfoLabel}>Mã booking</Text>

            <Text style={styles.reviewInfoValue}>{bookingCode}</Text>
          </View>

          <View style={styles.reviewInfoRow}>
            <Text style={styles.reviewInfoLabel}>Lý do</Text>

            <Text style={styles.reviewInfoValue}>{selectedReason}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Chi tiết hoàn tiền</Text>

          <View style={styles.moneyRow}>
            <Text style={styles.moneyLabel}>Tổng đã thanh toán</Text>

            <Text style={styles.moneyValue}>
              {paidAmount.toLocaleString("vi-VN")}đ
            </Text>
          </View>

          <View style={styles.moneyRow}>
            <Text style={styles.feeLabel}>Phí hủy chuyến (10%)</Text>

            <Text style={styles.feeValue}>
              -{cancellationFee.toLocaleString("vi-VN")}đ
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.moneyRow}>
            <Text style={styles.refundLabel}>Số tiền dự kiến hoàn</Text>

            <Text style={styles.refundValue}>
              {refundAmount.toLocaleString("vi-VN")}đ
            </Text>
          </View>

          <View style={styles.paymentMethodCard}>
            <Ionicons name="card-outline" size={22} color="#1B4332" />

            <View style={styles.flexOne}>
              <Text style={styles.paymentMethodTitle}>
                Phương thức nhận tiền
              </Text>

              <Text style={styles.paymentMethodDescription}>
                Tài khoản thanh toán •••• 1234
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.dangerNotice}>
          <Ionicons name="alert-circle-outline" size={23} color="#B91C1C" />

          <Text style={styles.dangerNoticeText}>
            Vé QR, quyền check-in, GPS chuyến đi và các dịch vụ liên quan sẽ bị
            vô hiệu hóa sau khi hủy.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dangerButton}
          onPress={confirmCancellation}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />

              <Text style={styles.dangerButtonText}>
                Đang xử lý hoàn tiền...
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.dangerButtonText}>Xác nhận hủy booking</Text>

              <Ionicons name="close-circle-outline" size={19} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setStep("FORM")}
          disabled={submitting}
        >
          <Text style={styles.secondaryButtonText}>Quay lại chỉnh sửa</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderSuccess() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.successContent}
      >
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={48} color="#FFFFFF" />
        </View>

        <Text style={styles.successTitle}>Đã hủy booking</Text>

        <Text style={styles.successDescription}>
          Yêu cầu hoàn tiền đã được tiếp nhận và đang được xử lý.
        </Text>

        <View style={styles.successCard}>
          <View style={styles.successRow}>
            <Text style={styles.successLabel}>Mã booking</Text>

            <Text style={styles.successValue}>{bookingCode}</Text>
          </View>

          <View style={styles.successRow}>
            <Text style={styles.successLabel}>Trạng thái</Text>

            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledText}>CANCELLED</Text>
            </View>
          </View>

          <View style={styles.successDivider} />

          <View style={styles.successRow}>
            <Text style={styles.successRefundLabel}>Khoản hoàn dự kiến</Text>

            <Text style={styles.successRefundValue}>
              {refundAmount.toLocaleString("vi-VN")}đ
            </Text>
          </View>

          <View style={styles.successRow}>
            <Text style={styles.successLabel}>Thời gian xử lý</Text>

            <Text style={styles.successValue}>3–5 ngày làm việc</Text>
          </View>
        </View>

        <View style={styles.emailNotice}>
          <Ionicons name="mail-outline" size={22} color="#1B4332" />

          <Text style={styles.emailNoticeText}>
            Xác nhận hủy chuyến và thông tin hoàn tiền đã được gửi tới email của
            bạn.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={returnToTrips}>
          <Text style={styles.primaryButtonText}>Về Chuyến của tôi</Text>

          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => router.replace("/(tabs)" as Href)}
        >
          <Text style={styles.exploreButtonText}>Khám phá chuyến khác</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderHeader()}

      {step === "FORM" && renderForm()}

      {step === "REVIEW" && renderReview()}

      {step === "SUCCESS" && renderSuccess()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7F5",
  },
  flexOne: {
    flex: 1,
  },
  header: {
    minHeight: 66,
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
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#EEF2EE",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#17231B",
    fontSize: 17,
    fontWeight: "900",
  },
  headerSubtitle: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 10,
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  warningCard: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#B45309",
  },
  warningIcon: {
    width: 48,
    height: 48,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  warningTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  warningDescription: {
    marginTop: 4,
    color: "#FFF7E6",
    fontSize: 10,
    lineHeight: 15,
  },
  tripCard: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  tripLabel: {
    color: "#2D6A4F",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  tripName: {
    marginTop: 5,
    marginBottom: 8,
    color: "#17231B",
    fontSize: 17,
    fontWeight: "900",
  },
  tripMetaRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tripMetaText: {
    color: "#475569",
    fontSize: 11,
  },
  sectionCard: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8E3",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  sectionTitle: {
    color: "#17231B",
    fontSize: 15,
    fontWeight: "900",
  },
  sectionDescription: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 10,
    lineHeight: 15,
  },
  reasonList: {
    marginTop: 12,
    gap: 8,
  },
  reasonRow: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8E3",
    borderRadius: 14,
    backgroundColor: "#F8FAF8",
  },
  reasonRowSelected: {
    borderColor: "#1B4332",
    backgroundColor: "#EEF7F1",
  },
  reasonText: {
    flex: 1,
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  reasonTextSelected: {
    color: "#1B4332",
    fontWeight: "900",
  },
  policyCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#E7F3EB",
  },
  policyHeader: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  policyTitle: {
    color: "#1B4332",
    fontSize: 14,
    fontWeight: "900",
  },
  policyItem: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  policyDot: {
    width: 6,
    height: 6,
    marginTop: 5,
    borderRadius: 3,
    backgroundColor: "#2D6A4F",
  },
  policyText: {
    flex: 1,
    color: "#315E42",
    fontSize: 10,
    lineHeight: 16,
  },
  acceptRow: {
    marginTop: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#94A3B8",
    borderRadius: 6,
  },
  checkboxChecked: {
    borderColor: "#1B4332",
    backgroundColor: "#1B4332",
  },
  acceptText: {
    flex: 1,
    color: "#334155",
    fontSize: 10,
    lineHeight: 16,
  },
  primaryButton: {
    minHeight: 52,
    marginTop: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 26,
    backgroundColor: "#1B4332",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  reviewHero: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#1B4332",
  },
  reviewHeroIcon: {
    width: 50,
    height: 50,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#2D6A4F",
  },
  reviewHeroLabel: {
    color: "#BCE2CA",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  reviewHeroTitle: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  reviewHeroDescription: {
    marginTop: 3,
    color: "#D4E8DB",
    fontSize: 10,
  },
  reviewInfoRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  reviewInfoLabel: {
    color: "#64748B",
    fontSize: 11,
  },
  reviewInfoValue: {
    flex: 1,
    color: "#17231B",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
  moneyRow: {
    marginTop: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  moneyLabel: {
    color: "#64748B",
    fontSize: 12,
  },
  moneyValue: {
    color: "#17231B",
    fontSize: 12,
    fontWeight: "800",
  },
  feeLabel: {
    color: "#B45309",
    fontSize: 12,
  },
  feeValue: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "900",
  },
  divider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: "#E2E8E3",
  },
  refundLabel: {
    color: "#17231B",
    fontSize: 14,
    fontWeight: "900",
  },
  refundValue: {
    color: "#1B4332",
    fontSize: 19,
    fontWeight: "900",
  },
  paymentMethodCard: {
    marginTop: 15,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    backgroundColor: "#E7F3EB",
  },
  paymentMethodTitle: {
    color: "#1B4332",
    fontSize: 11,
    fontWeight: "900",
  },
  paymentMethodDescription: {
    marginTop: 3,
    color: "#315E42",
    fontSize: 9,
  },
  dangerNotice: {
    marginTop: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 15,
    backgroundColor: "#FEF2F2",
  },
  dangerNoticeText: {
    flex: 1,
    color: "#991B1B",
    fontSize: 10,
    lineHeight: 16,
  },
  dangerButton: {
    minHeight: 52,
    marginTop: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 26,
    backgroundColor: "#B91C1C",
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 48,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  secondaryButtonText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  successContent: {
    flexGrow: 1,
    padding: 22,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
    backgroundColor: "#1B4332",
  },
  successTitle: {
    marginTop: 20,
    color: "#17231B",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  successDescription: {
    maxWidth: 300,
    marginTop: 8,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  successCard: {
    width: "100%",
    marginTop: 22,
    padding: 17,
    borderWidth: 1,
    borderColor: "#E2E8E3",
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
  },
  successRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  successLabel: {
    color: "#64748B",
    fontSize: 11,
  },
  successValue: {
    flex: 1,
    color: "#17231B",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
  cancelledBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
  },
  cancelledText: {
    color: "#B91C1C",
    fontSize: 9,
    fontWeight: "900",
  },
  successDivider: {
    height: 1,
    marginVertical: 12,
    backgroundColor: "#E2E8E3",
  },
  successRefundLabel: {
    color: "#17231B",
    fontSize: 13,
    fontWeight: "900",
  },
  successRefundValue: {
    color: "#1B4332",
    fontSize: 18,
    fontWeight: "900",
  },
  emailNotice: {
    width: "100%",
    marginTop: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderRadius: 15,
    backgroundColor: "#E7F3EB",
  },
  emailNoticeText: {
    flex: 1,
    color: "#315E42",
    fontSize: 10,
    lineHeight: 16,
  },
  exploreButton: {
    minHeight: 48,
    marginTop: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreButtonText: {
    color: "#1B4332",
    fontSize: 12,
    fontWeight: "900",
  },
});
