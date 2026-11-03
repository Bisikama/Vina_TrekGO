import { Colors, Radius, Shadows } from "@/constants/theme";
import { useBookingMutations } from "@/features/bookings/hooks";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface CancelBookingModalProps {
  visible: boolean;
  bookingId: string;
  totalAmount?: string;
  onClose: () => void;
  onSuccess: (refundableAmount: string) => void;
}

const COMMON_REASONS = [
  "Bận việc đột xuất không thể sắp xếp",
  "Lý do sức khỏe cá nhân",
  "Thời tiết không phù hợp",
  "Thay đổi kế hoạch du lịch cùng gia đình",
];

export function CancelBookingModal({
  visible,
  bookingId,
  totalAmount,
  onClose,
  onSuccess,
}: CancelBookingModalProps) {
  const { cancelBooking, isSubmitting } = useBookingMutations();
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      Alert.alert("Chưa nhập lý do", "Vui lòng nhập lý do hủy đặt chỗ.");
      return;
    }
    if (trimmed.length > 500) {
      Alert.alert(
        "Lý do quá dài",
        "Lý do hủy đặt chỗ không được vượt quá 500 ký tự.",
      );
      return;
    }

    try {
      const res = await cancelBooking(bookingId, trimmed);
      Alert.alert(
        "Hủy đặt chỗ thành công",
        `Đơn đặt chỗ đã được hủy.\nSố tiền dự kiến hoàn: ${Number(res.refundableAmount || 0).toLocaleString("vi-VN")} đ.`,
      );
      onSuccess(res.refundableAmount || "0");
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Lỗi hủy đặt chỗ",
        err?.message || "Không thể hủy đặt chỗ lúc này. Vui lòng thử lại sau.",
      );
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dangerIconBox}>
              <Ionicons name="warning-outline" size={24} color="#DC2626" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Xác nhận hủy đặt chỗ</Text>
              <Text style={styles.subtitle}>
                Hành động này sẽ hủy vé tham gia chuyến đi của bạn.
              </Text>
            </View>
          </View>

          {/* Refund policy highlight */}
          {totalAmount ? (
            <View style={styles.policyBox}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={Colors.primaryDark}
              />
              <Text style={styles.policyText}>
                Tổng giá trị đơn:{" "}
                <Text style={styles.boldText}>
                  {Number(totalAmount).toLocaleString("vi-VN")} đ
                </Text>
                . Mức hoàn tiền sẽ được tính tự động theo chính sách hoàn hủy.
              </Text>
            </View>
          ) : null}

          {/* Preset quick reasons */}
          <Text style={styles.sectionLabel}>Chọn lý do nhanh:</Text>
          <View style={styles.presetTags}>
            {COMMON_REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.tag,
                  reason === r && styles.tagSelected,
                ]}
                onPress={() => setReason(r)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tagText,
                    reason === r && styles.tagTextSelected,
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Reason Input */}
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>
              Lý do chi tiết <Text style={styles.required}>* (1–500 ký tự)</Text>
            </Text>
            <TextInput
              style={styles.textArea}
              value={reason}
              onChangeText={setReason}
              placeholder="Nhập lý do bạn muốn hủy đơn đặt chỗ này..."
              placeholderTextColor={Colors.onSurfaceMuted}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
            <Text style={styles.counter}>{reason.length}/500</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Quay lại</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!reason.trim() || isSubmitting) && styles.btnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!reason.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Xác nhận hủy</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    ...Shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  dangerIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  policyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radius.md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  policyText: {
    flex: 1,
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: "700",
    color: Colors.onSurface,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
    marginBottom: 8,
  },
  presetTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  tag: {
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
  },
  tagSelected: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  tagText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  tagTextSelected: {
    color: "#DC2626",
    fontWeight: "700",
  },
  inputBox: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurface,
    marginBottom: 6,
  },
  required: {
    fontSize: 11,
    color: Colors.onSurfaceMuted,
    fontWeight: "normal",
  },
  textArea: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    padding: 10,
    fontSize: 13,
    color: Colors.onSurface,
    minHeight: 70,
    textAlignVertical: "top",
  },
  counter: {
    fontSize: 10,
    color: Colors.onSurfaceMuted,
    textAlign: "right",
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceContainerLow,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
