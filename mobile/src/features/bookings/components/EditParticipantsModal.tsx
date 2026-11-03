import { Colors, Radius, Shadows } from "@/constants/theme";
import { useBookingMutations } from "@/features/bookings/hooks";
import type { BookingDetail, Participant } from "@/features/bookings/types";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface EditParticipantsModalProps {
  visible: boolean;
  booking: BookingDetail;
  onClose: () => void;
  onSuccess: (updated: BookingDetail) => void;
}

export function EditParticipantsModal({
  visible,
  booking,
  onClose,
  onSuccess,
}: EditParticipantsModalProps) {
  const { updateParticipants, isSubmitting } = useBookingMutations();

  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (visible && booking) {
      setParticipants(
        booking.participants.map((p) => ({
          id: p.id,
          fullName: p.fullName || "",
          phone: p.phone || "",
        })),
      );
    }
  }, [visible, booking]);

  function handleAddField() {
    setParticipants((prev) => [
      ...prev,
      {
        fullName: "",
        phone: "",
      },
    ]);
  }

  function handleRemove(index: number) {
    if (participants.length <= 1) {
      Alert.alert(
        "Không thể xóa",
        "Đơn đặt chỗ phải có ít nhất 1 thành viên tham gia.",
      );
      return;
    }
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFieldChange(
    index: number,
    field: keyof Participant,
    value: string,
  ) {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  async function handleSave() {
    const todayStr = new Date().toISOString().split("T")[0];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.fullName.trim()) {
        Alert.alert(
          "Thiếu họ tên",
          `Vui lòng nhập họ và tên cho thành viên #${i + 1}.`,
        );
        return;
      }
      if (!p.phone || p.phone.trim().length < 8) {
        Alert.alert(
          "SĐT không hợp lệ",
          `Số điện thoại thành viên #${i + 1} phải có ít nhất 8 chữ số.`,
        );
        return;
      }
    }

    try {
      const updated = await updateParticipants(
        booking.id,
        participants,
        booking.version,
      );
      Alert.alert(
        "Cập nhật thành công",
        "Thông tin danh sách người tham gia đã được lưu.",
      );
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      if (err?.code === "BOOKING_VERSION_CONFLICT") {
        Alert.alert(
          "Xung đột phiên bản",
          "Thông tin đặt chỗ vừa được cập nhật từ phiên khác. Vui lòng tải lại trang.",
        );
      } else {
        Alert.alert(
          "Lỗi cập nhật",
          err?.message || "Không thể cập nhật danh sách thành viên lúc này.",
        );
      }
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardContainer}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Sửa danh sách người tham gia</Text>
                <Text style={styles.headerSubtitle}>
                  Phiên bản #{booking.version} • {participants.length} người
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.topActions}>
                <Text style={styles.sectionHeading}>Thành viên đoàn</Text>
                <TouchableOpacity style={styles.addBtn} onPress={handleAddField}>
                  <Ionicons name="add" size={16} color={Colors.primaryDark} />
                  <Text style={styles.addBtnText}>Thêm người</Text>
                </TouchableOpacity>
              </View>

              {participants.map((p, index) => (
                <View key={p.id || index} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardNum}>#{index + 1}</Text>
                    {participants.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemove(index)}
                        style={styles.trashBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Họ và tên *</Text>
                    <TextInput
                      style={styles.input}
                      value={p.fullName}
                      onChangeText={(v) => handleFieldChange(index, "fullName", v)}
                      placeholder="Nguyễn Văn A"
                      placeholderTextColor={Colors.onSurfaceMuted}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Số điện thoại *</Text>
                    <TextInput
                      style={styles.input}
                      value={p.phone || ""}
                      onChangeText={(v) => handleFieldChange(index, "phone", v)}
                      placeholder="0901234567"
                      placeholderTextColor={Colors.onSurfaceMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.saveBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleSave}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "90%",
    minHeight: "60%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  topActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadows.card,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardNum: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  trashBtn: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  flex1: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.onSurface,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  saveBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
