import { Ionicons } from "@expo/vector-icons";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { rentalApi } from "@/features/rentals/api";
import {
  RentalCancellationPreview,
  RentalOrderDetail,
} from "@/features/rentals/types";
import { ApiError } from "@/lib/api-client";

const REASONS = [
  "Thay đổi kế hoạch chuyến đi",
  "Không còn nhu cầu thuê thiết bị",
  "Muốn chọn thiết bị khác",
] as const;

const money = (value = 0, currency = "VND") =>
  `${value.toLocaleString("vi-VN")} ${currency === "VND" ? "đ" : currency}`;

const cancellationError = (error: unknown) => {
  if (!(error instanceof Error)) return "Không thể hủy đơn thuê.";
  if (!(error instanceof ApiError)) return error.message;

  if (error.code === "VERSION_CONFLICT") {
    return "Đơn vừa được cập nhật. Hãy tải lại thông tin rồi xác nhận lần nữa.";
  }
  if (["ORDER_NOT_CANCELLABLE", "INVALID_RENTAL_STATE"].includes(error.code ?? "")) {
    return "Đơn đã qua giai đoạn cho phép hủy.";
  }
  return error.message;
};

export default function RentalCancellationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { accessToken } = useAuth();
  const [order, setOrder] = useState<RentalOrderDetail>();
  const [preview, setPreview] = useState<RentalCancellationPreview>();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const loadPreview = useCallback(async () => {
    if (!accessToken || !orderId) {
      setError("Thiếu phiên đăng nhập hoặc mã đơn thuê.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const [orderDetail, cancellationPreview] = await Promise.all([
        rentalApi.getOrder(orderId, accessToken),
        rentalApi.previewCancellation(orderId, accessToken),
      ]);
      setOrder(orderDetail);
      setPreview(cancellationPreview);
    } catch (requestError) {
      setError(cancellationError(requestError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const refundTotal = useMemo(
    () => (preview?.feeRefund ?? 0) + (preview?.depositRefund ?? 0),
    [preview],
  );
  const normalizedReason = reason.trim();
  const canSubmit =
    Boolean(preview?.canCancel && order) && normalizedReason.length >= 3 && !submitting;

  const submitCancellation = async () => {
    if (!canSubmit || !accessToken || !orderId || !order || !preview) return;

    setSubmitting(true);
    setError(undefined);
    try {
      const result = await rentalApi.cancelOrder(
        orderId,
        {
          reason: normalizedReason,
          previewVersion: preview.previewVersion,
          expectedVersion: order.order.version,
        },
        `mobile-rental-cancel-${orderId}-${Date.now()}`,
        accessToken,
      );

      Alert.alert(
        "Đã hủy đơn thuê",
        result.refund
          ? `Yêu cầu hoàn ${money(result.refund.amount, order.order.currency)} đã được ghi nhận.`
          : "Đơn chưa thanh toán nên không phát sinh tiền hoàn.",
        [
          {
            text: "Xem đơn",
            onPress: () =>
              router.replace(`/rental-orders/${orderId}` as Href),
          },
        ],
        { cancelable: false },
      );
    } catch (requestError) {
      const message = cancellationError(requestError);
      setError(message);
      if (
        requestError instanceof ApiError &&
        ["VERSION_CONFLICT", "ORDER_NOT_CANCELLABLE", "INVALID_RENTAL_STATE"].includes(
          requestError.code ?? "",
        )
      ) {
        await loadPreview();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancellation = () => {
    if (!canSubmit) return;
    Alert.alert(
      "Xác nhận hủy đơn?",
      `Sau khi hủy, hệ thống dự kiến hoàn ${money(
        refundTotal,
        order?.order.currency,
      )}. Thao tác này không thể hoàn tác.`,
      [
        { text: "Quay lại", style: "cancel" },
        {
          text: "Hủy đơn",
          style: "destructive",
          onPress: () => void submitCancellation(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={23} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>TREKGO GEAR</Text>
          <Text style={styles.headerTitle}>Hủy đơn thuê</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
          <Text style={styles.muted}>Đang kiểm tra chính sách hủy...</Text>
        </View>
      ) : !order || !preview ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={50} color={Colors.error} />
          <Text style={styles.stateTitle}>Không thể mở màn hình hủy</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadPreview()}>
            <Text style={styles.retryText}>Kiểm tra lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>ĐƠN THUÊ THIẾT BỊ</Text>
              <Text style={styles.tripTitle}>
                {order.order.trip?.title || "Chuyến đi của bạn"}
              </Text>
              <Text style={styles.orderCode}>
                {order.order.orderCode ? `Mã đơn ${order.order.orderCode}` : `Mã ${(orderId ?? "").slice(-8).toUpperCase()}`}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Khoản tiền dự kiến</Text>
              <MoneyRow label="Hoàn phí thuê" value={preview.feeRefund} currency={order.order.currency} />
              <MoneyRow label="Hoàn tiền cọc" value={preview.depositRefund} currency={order.order.currency} />
              <View style={styles.divider} />
              <MoneyRow label="Tổng tiền hoàn" value={refundTotal} currency={order.order.currency} strong />
              <View style={styles.policyBox}>
                <Ionicons name="information-circle-outline" size={21} color={Colors.primaryDark} />
                <Text style={styles.policyText}>{preview.reason}</Text>
              </View>
              <Text style={styles.pendingNote}>
                Tiền hoàn có thể cần thêm thời gian xử lý sau khi đơn được hủy.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Lý do hủy đơn</Text>
              <View style={styles.reasonList}>
                {REASONS.map((item) => {
                  const selected = reason === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.reasonChip, selected && styles.reasonChipSelected]}
                      onPress={() => setReason(item)}
                    >
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={19}
                        color={selected ? Colors.primaryDark : Colors.onSurfaceMuted}
                      />
                      <Text style={[styles.reasonChipText, selected && styles.reasonChipTextSelected]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={styles.input}
                value={reason}
                onChangeText={setReason}
                placeholder="Nhập lý do khác..."
                placeholderTextColor={Colors.onSurfaceMuted}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>{reason.length}/500</Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.cancelButton, !canSubmit && styles.buttonDisabled]}
              disabled={!canSubmit}
              onPress={confirmCancellation}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={21} color="#FFFFFF" />
                  <Text style={styles.cancelButtonText}>Xác nhận hủy đơn</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.keepButton} onPress={() => router.back()}>
              <Text style={styles.keepButtonText}>Tiếp tục giữ đơn</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function MoneyRow({
  label,
  value,
  currency,
  strong = false,
}: {
  label: string;
  value: number;
  currency: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.moneyRow}>
      <Text style={[styles.moneyLabel, strong && styles.moneyStrong]}>{label}</Text>
      <Text style={[styles.moneyValue, strong && styles.moneyStrong]}>
        {money(value, currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surfaceContainerHigh,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceContainer,
  },
  headerText: { flex: 1, marginLeft: 13 },
  eyebrow: { color: Colors.primaryDark, fontSize: 11, fontWeight: "800", letterSpacing: 1.7 },
  headerTitle: { marginTop: 2, color: Colors.ink, fontSize: 23, fontWeight: "900" },
  content: { padding: 16, paddingBottom: 40 },
  summaryCard: {
    padding: 20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.inverseSurface,
    ...Shadows.card,
  },
  summaryLabel: { color: Colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  tripTitle: { marginTop: 8, color: Colors.inverseOnSurface, fontSize: 23, fontWeight: "900" },
  orderCode: { marginTop: 7, color: Colors.surfaceDim, fontSize: 13 },
  card: {
    marginTop: 16,
    padding: 18,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  cardTitle: { color: Colors.ink, fontSize: 18, fontWeight: "900", marginBottom: 14 },
  moneyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  moneyLabel: { color: Colors.onSurfaceVariant, fontSize: 14 },
  moneyValue: { color: Colors.ink, fontSize: 15, fontWeight: "700" },
  moneyStrong: { color: Colors.inkDeep, fontSize: 17, fontWeight: "900" },
  divider: { height: 1, backgroundColor: Colors.surfaceContainerHigh, marginVertical: 8 },
  policyBox: {
    marginTop: 15,
    padding: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
    flexDirection: "row",
    gap: 9,
  },
  policyText: { flex: 1, color: Colors.inkDeep, fontSize: 13, lineHeight: 19 },
  pendingNote: { marginTop: 11, color: Colors.onSurfaceMuted, fontSize: 12, lineHeight: 18 },
  reasonList: { gap: 8 },
  reasonChip: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  reasonChipSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  reasonChipText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 14 },
  reasonChipTextSelected: { color: Colors.inkDeep, fontWeight: "700" },
  input: {
    marginTop: 12,
    minHeight: 92,
    padding: 13,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    color: Colors.ink,
    fontSize: 14,
  },
  counter: { marginTop: 5, color: Colors.onSurfaceMuted, fontSize: 11, textAlign: "right" },
  errorText: {
    marginTop: 14,
    padding: 13,
    borderRadius: Radius.md,
    color: Colors.onErrorContainer,
    backgroundColor: Colors.errorContainer,
    fontSize: 13,
    lineHeight: 19,
  },
  cancelButton: {
    marginTop: 20,
    minHeight: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.error,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  buttonDisabled: { opacity: 0.45 },
  cancelButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  keepButton: { minHeight: 50, alignItems: "center", justifyContent: "center" },
  keepButtonText: { color: Colors.primaryDark, fontSize: 15, fontWeight: "800" },
  centerState: { flex: 1, padding: 30, alignItems: "center", justifyContent: "center" },
  stateTitle: { marginTop: 12, color: Colors.ink, fontSize: 19, fontWeight: "900", textAlign: "center" },
  muted: { marginTop: 9, color: Colors.onSurfaceMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  retryButton: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  retryText: { color: "#FFFFFF", fontWeight: "800" },
});
