import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
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
import { useCancelPrivateTrip } from "../hooks/useCancelPrivateTrip";
import type { PrivateTrip } from "../types";

export interface CancelTripModalProps {
  visible: boolean;
  tripId?: string;
  expectedVersion?: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm?: (reason: string) => void;
  onSuccess?: (cancelledTrip: PrivateTrip) => void;
}

export function CancelTripModal({
  visible,
  tripId,
  expectedVersion,
  loading: propLoading = false,
  onClose,
  onConfirm,
  onSuccess,
}: CancelTripModalProps) {
  const [reason, setReason] = useState("");
  const { cancelTrip, loading: hookLoading } = useCancelPrivateTrip();

  const loading = propLoading || hookLoading;

  async function handleConfirm() {
    const trimmedReason = reason.trim() || undefined;

    if (onConfirm) {
      onConfirm(trimmedReason || "");
      return;
    }

    // Direct hook execution if tripId and expectedVersion provided
    if (tripId && expectedVersion !== undefined) {
      try {
        const cancelled = await cancelTrip(
          tripId,
          expectedVersion,
          trimmedReason || "",
        );
        setReason("");
        onClose();
        onSuccess?.(cancelled);
        Alert.alert("Đã hủy chuyến", "Chuyến đi riêng của bạn đã được hủy thành công.");
      } catch (err: any) {
        if (err?.code === "PRIVATE_TRIP_VERSION_CONFLICT") {
          Alert.alert(
            "Xung đột phiên bản",
            "Chuyến đi đã được cập nhật bởi thao tác khác. Vui lòng tải lại dữ liệu mới nhất.",
          );
        } else {
          Alert.alert("Lỗi hủy chuyến", err?.message || "Không thể hủy chuyến đi.");
        }
      }
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning-outline" size={28} color="#DC2626" />
          </View>

          <Text style={styles.title}>Hủy chuyến đi riêng?</Text>
          <Text style={styles.description}>
            Hành động này sẽ hủy chuyến đi và gửi thông báo tới tất cả các thành
            viên đã tham gia. Không thể khôi phục sau khi hủy.
          </Text>

          <Text style={styles.inputLabel}>Lý do hủy (không bắt buộc):</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ: Thời tiết xấu, kế hoạch cá nhân thay đổi..."
            placeholderTextColor={Colors.mute}
            multiline
            numberOfLines={3}
            maxLength={2000}
            value={reason}
            onChangeText={setReason}
            editable={!loading}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Quay lại</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Xác nhận hủy</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 20,
    alignItems: "center",
    ...Shadows.hover,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#DC2626",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  inputLabel: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    color: Colors.onSurface,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    minHeight: 70,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.md,
    padding: 10,
    fontSize: 13,
    color: Colors.onSurface,
    textAlignVertical: "top",
    backgroundColor: Colors.surfaceContainerLow,
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceContainerHigh,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
  },
  disabledButton: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
