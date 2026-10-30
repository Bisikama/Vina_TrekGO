import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { useBookingMutations } from "@/features/bookings/hooks";
import type { Participant, PublicBookingTrip } from "@/features/bookings/types";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface BookingParticipantsModalProps {
  visible: boolean;
  trip: PublicBookingTrip;
  onClose: () => void;
  onSuccess?: (bookingId: string) => void;
}

interface ParticipantFormState {
  fullName: string;
  phone: string;
}

function createEmptyParticipant(): ParticipantFormState {
  return {
    fullName: "",
    phone: "",
  };
}

export function BookingParticipantsModal({
  visible,
  trip,
  onClose,
  onSuccess,
}: BookingParticipantsModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { createBooking, isSubmitting } = useBookingMutations();

  const [participants, setParticipants] = useState<ParticipantFormState[]>([
    createEmptyParticipant(),
  ]);

  // Tự động điền thông tin người đại diện (thành viên #1) từ tài khoản đang đăng nhập
  useEffect(() => {
    if (visible && user) {
      setParticipants([
        {
          fullName: user.fullName || user.name || "",
          phone: user.phone || "",
        },
      ]);
    } else if (visible) {
      setParticipants([createEmptyParticipant()]);
    }
  }, [visible, user]);

  const maxSlots = Math.max(1, trip.remainingSlots || trip.capacity || 1);
  const currentCount = participants.length;

  function handleAddParticipant() {
    if (currentCount >= maxSlots) {
      Alert.alert(
        "Giới hạn số chỗ",
        `Chuyến đi hiện chỉ còn ${maxSlots} chỗ trống.`,
      );
      return;
    }
    setParticipants((prev) => [...prev, createEmptyParticipant()]);
  }

  function handleRemoveParticipant(index: number) {
    if (participants.length <= 1) return;
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFieldChange(
    index: number,
    field: keyof ParticipantFormState,
    value: string,
  ) {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  // Tính toán tổng tiền
  const unitPrice = parseFloat(trip.pricePerPax || "0");
  const totalAmount = unitPrice * currentCount;

  async function handleSubmit() {
    // 1. Kiểm tra tính hợp lệ của từng thành viên
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const memberLabel = i === 0 ? "Người đại diện" : `Thành viên #${i + 1}`;

      if (!p.fullName.trim()) {
        Alert.alert(
          "Thiếu thông tin",
          `Vui lòng nhập họ và tên cho ${memberLabel}.`,
        );
        return;
      }

      if (!p.phone.trim()) {
        Alert.alert(
          "Thiếu thông tin",
          `Vui lòng nhập số điện thoại cho ${memberLabel}.`,
        );
        return;
      }

      const cleanPhone = p.phone.trim().replace(/\D/g, "");
      if (cleanPhone.length < 9) {
        Alert.alert(
          "Số điện thoại không hợp lệ",
          `Số điện thoại ${memberLabel} phải có ít nhất 9 chữ số.`,
        );
        return;
      }
    }

    // 2. Chuẩn hóa payload theo đúng schema API:
    // { "participantCount": N, "participants": [{ "fullName": "...", "phone": "..." }] }
    const formatted: Participant[] = participants.map((p) => ({
      fullName: p.fullName.trim(),
      phone: p.phone.trim(),
    }));

    // 3. Gửi yêu cầu đặt chỗ
    try {
      const booking = await createBooking(trip.id, formatted);
      onClose();
      if (onSuccess) {
        onSuccess(booking.id);
      } else {
        router.push({
          pathname: "/bookings/[id]",
          params: { id: booking.id },
        } as any);
      }
    } catch (err: any) {
      const errDetails = err?.details as any;
      const existingBookingId = errDetails?.bookingId || err?.bookingId;

      if (err?.code === "ACTIVE_BOOKING_EXISTS" && existingBookingId) {
        Alert.alert(
          "Đã có đặt chỗ",
          "Bạn đã có một đơn đặt chỗ cho chuyến đi này đang chờ xử lý.",
          [
            { text: "Ở lại", style: "cancel" },
            {
              text: "Xem đặt chỗ",
              onPress: () => {
                onClose();
                router.push({
                  pathname: "/bookings/[id]",
                  params: { id: existingBookingId },
                } as any);
              },
            },
          ],
        );
        return;
      }

      Alert.alert(
        "Lỗi đặt chỗ",
        err?.message || "Không thể khởi tạo đặt chỗ lúc này. Vui lòng thử lại.",
      );
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
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.tagWrap}>
                  <Text style={styles.headerEyebrow}>PUBLIC TRIP BOOKING</Text>
                </View>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  Đặt chỗ: {trip.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                accessibilityLabel="Đóng modal"
              >
                <Ionicons name="close" size={20} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>

            {/* Trip Info Quick Bar */}
            <View style={styles.tripMetaBar}>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.metaText}>
                  Còn trống:{" "}
                  <Text style={styles.metaBold}>{trip.remainingSlots}</Text>/
                  {trip.capacity} chỗ
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="pricetag-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.metaText}>
                  {unitPrice.toLocaleString("vi-VN")} đ / người
                </Text>
              </View>
            </View>

            {/* Scrollable Form */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>
                  DANH SÁCH THÀNH VIÊN ({currentCount})
                </Text>
                {currentCount < maxSlots && (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={handleAddParticipant}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={15} color={Colors.primaryDark} />
                    <Text style={styles.addBtnText}>Thêm người</Text>
                  </TouchableOpacity>
                )}
              </View>

              {participants.map((p, index) => (
                <View key={index} style={styles.participantCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.badgeIndex}>
                        <Text style={styles.badgeIndexText}>#{index + 1}</Text>
                      </View>
                      <Text style={styles.cardTitle}>
                        {index === 0
                          ? "Người đại diện đặt chỗ"
                          : `Thành viên #${index + 1}`}
                      </Text>
                    </View>
                    {index > 0 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveParticipant(index)}
                        style={styles.removeBtn}
                        accessibilityLabel="Xóa thành viên"
                      >
                        <Ionicons name="trash-outline" size={17} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Họ và tên */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Họ và tên <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <View style={styles.inputWithIcon}>
                      <Ionicons
                        name="person-outline"
                        size={17}
                        color={Colors.onSurfaceMuted}
                        style={styles.fieldIcon}
                      />
                      <TextInput
                        style={styles.textInputWithIcon}
                        placeholder="Ví dụ: Nguyễn Văn A"
                        placeholderTextColor={Colors.onSurfaceMuted}
                        value={p.fullName}
                        onChangeText={(val) =>
                          handleFieldChange(index, "fullName", val)
                        }
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  {/* Số điện thoại */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Số điện thoại <Text style={styles.requiredMark}>*</Text>
                    </Text>
                    <View style={styles.inputWithIcon}>
                      <Ionicons
                        name="call-outline"
                        size={17}
                        color={Colors.onSurfaceMuted}
                        style={styles.fieldIcon}
                      />
                      <TextInput
                        style={styles.textInputWithIcon}
                        placeholder="Ví dụ: 0900000001"
                        placeholderTextColor={Colors.onSurfaceMuted}
                        keyboardType="phone-pad"
                        value={p.phone}
                        onChangeText={(val) =>
                          handleFieldChange(index, "phone", val)
                        }
                      />
                    </View>
                  </View>
                </View>
              ))}

              {/* Quick Add Button if more slots available */}
              {currentCount < maxSlots && (
                <TouchableOpacity
                  style={styles.addMoreCardBtn}
                  onPress={handleAddParticipant}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add-outline" size={18} color={Colors.primaryDark} />
                  <Text style={styles.addMoreCardText}>
                    + Thêm người đi cùng ({currentCount}/{maxSlots})
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Bottom Sticky Action Bar */}
            <View style={styles.footer}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>
                    Tổng cộng ({currentCount} người):
                  </Text>
                  <Text style={styles.priceValue}>
                    {totalAmount.toLocaleString("vi-VN")} đ
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    isSubmitting && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.88}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.submitButtonText}>Giữ chỗ & Tiếp tục</Text>
                      <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
    maxHeight: "92%",
    minHeight: "55%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  tagWrap: {
    alignSelf: "flex-start",
    backgroundColor: "#eaf5e1",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginBottom: 4,
  },
  headerEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.primaryDark,
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: Colors.onSurface,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  tripMetaBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#f4f8f2",
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.body,
    fontWeight: "600",
  },
  metaBold: {
    fontWeight: "900",
    color: Colors.primaryDark,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.onSurfaceMuted,
    letterSpacing: 0.8,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: "#eaf5e1",
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  participantCard: {
    backgroundColor: "#ffffff",
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e6ede2",
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5ee",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgeIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeIndexText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.ink,
  },
  removeBtn: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.onSurfaceVariant,
    marginBottom: 5,
  },
  requiredMark: {
    color: "#DC2626",
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fbf8",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#d9e4d4",
    paddingHorizontal: 12,
  },
  fieldIcon: {
    marginRight: 8,
  },
  textInputWithIcon: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.onSurface,
  },
  addMoreCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.primaryDark,
    backgroundColor: "#f4f9ef",
    marginTop: 4,
    marginBottom: 10,
  },
  addMoreCardText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    backgroundColor: "#ffffff",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  priceLabel: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.primaryDark,
    marginTop: 2,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
