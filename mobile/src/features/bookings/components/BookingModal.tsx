import { Colors, Radius } from "@/constants/theme";
import { useCreateBooking } from "@/features/bookings/hooks";
import type { PublicTrip } from "@/features/trips/services/public-trips.api";
import { ApiError } from "@/lib/api-client";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
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

interface ParticipantFormData {
  fullName: string;
  phone: string;
  dateOfBirth: string;
}

function emptyParticipant(): ParticipantFormData {
  return { fullName: "", phone: "", dateOfBirth: "" };
}

export interface BookingModalProps {
  visible: boolean;
  trip: PublicTrip;
  accessToken: string;
  onClose: () => void;
  onSuccess: (bookingId: string) => void;
}

export function BookingModal({
  visible,
  trip,
  accessToken,
  onClose,
  onSuccess,
}: BookingModalProps) {
  const [participantCount, setParticipantCount] = useState(1);
  const [participants, setParticipants] = useState<ParticipantFormData[]>([
    emptyParticipant(),
  ]);

  const { submitBooking, loading } = useCreateBooking();

  const price = parseFloat(trip.pricePerPax) * participantCount;

  function handleCountChange(delta: number) {
    const next = Math.max(1, Math.min(trip.remainingSlots, participantCount + delta));
    setParticipantCount(next);
    setParticipants((prev) => {
      if (next > prev.length) {
        return [...prev, ...Array(next - prev.length).fill(null).map(emptyParticipant)];
      }
      return prev.slice(0, next);
    });
  }

  function updateParticipant(
    index: number,
    field: keyof ParticipantFormData,
    value: string,
  ) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  }

  async function handleConfirm() {
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.fullName.trim()) {
        Alert.alert("Thiếu thông tin", `Vui lòng nhập họ và tên người ${i + 1}.`);
        return;
      }
      if (!p.phone.trim()) {
        Alert.alert("Thiếu thông tin", `Vui lòng nhập SĐT người ${i + 1}.`);
        return;
      }
      if (!p.dateOfBirth.trim()) {
        Alert.alert(
          "Thiếu thông tin",
          `Vui lòng nhập ngày sinh người ${i + 1} (YYYY-MM-DD).`,
        );
        return;
      }
    }

    try {
      const booking = await submitBooking(
        trip.id,
        {
          participantCount,
          participants,
        },
        accessToken,
      );
      onSuccess(booking.id);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "CAPACITY_CONFLICT") {
          Alert.alert(
            "Hết chỗ",
            "Chuyến đi không còn đủ chỗ cho số lượng người đã chọn. Vui lòng thử lại.",
          );
        } else if (error.code === "ACTIVE_BOOKING_EXISTS") {
          Alert.alert(
            "Đặt chỗ trùng",
            "Bạn đã có một booking đang hoạt động cho chuyến này.",
          );
        } else {
          Alert.alert("Lỗi đặt chỗ", error.message);
        }
      } else if (error instanceof Error) {
        Alert.alert("Lỗi", error.message);
      }
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Đặt chỗ tham gia</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={Colors.onSurface} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Trip Summary */}
            <View style={styles.tripSummary}>
              <Text style={styles.tripTitle} numberOfLines={2}>
                {trip.title}
              </Text>
              <Text style={styles.tripMeta}>
                {trip.destination.name} ·{" "}
                {new Date(trip.startAt).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </Text>
            </View>

            {/* Participant Count */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>SỐ NGƯỜI THAM GIA</Text>
              <View style={styles.countRow}>
                <TouchableOpacity
                  style={[
                    styles.countBtn,
                    participantCount <= 1 && styles.countBtnDisabled,
                  ]}
                  onPress={() => handleCountChange(-1)}
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={participantCount <= 1 ? Colors.mute : Colors.onSurface}
                  />
                </TouchableOpacity>
                <Text style={styles.countValue}>{participantCount}</Text>
                <TouchableOpacity
                  style={[
                    styles.countBtn,
                    participantCount >= trip.remainingSlots &&
                      styles.countBtnDisabled,
                  ]}
                  onPress={() => handleCountChange(1)}
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={
                      participantCount >= trip.remainingSlots
                        ? Colors.mute
                        : Colors.onSurface
                    }
                  />
                </TouchableOpacity>
                <Text style={styles.slotHint}>
                  Còn {trip.remainingSlots} chỗ
                </Text>
              </View>
            </View>

            {/* Participant Forms */}
            {participants.map((p, i) => (
              <View key={i} style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>NGƯỜI {i + 1}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Họ và tên"
                  placeholderTextColor={Colors.mute}
                  value={p.fullName}
                  onChangeText={(v) => updateParticipant(i, "fullName", v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Số điện thoại"
                  placeholderTextColor={Colors.mute}
                  keyboardType="phone-pad"
                  value={p.phone}
                  onChangeText={(v) => updateParticipant(i, "phone", v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Ngày sinh (YYYY-MM-DD)"
                  placeholderTextColor={Colors.mute}
                  value={p.dateOfBirth}
                  onChangeText={(v) => updateParticipant(i, "dateOfBirth", v)}
                />
              </View>
            ))}

            {/* Price Summary */}
            <View style={styles.priceSummary}>
              <Text style={styles.priceLabel}>Tổng tiền</Text>
              <Text style={styles.priceValue}>
                {price.toLocaleString("vi-VN")} {trip.currency}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Confirm CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={Colors.onPrimary}
                />
                <Text style={styles.confirmBtnText}>Xác nhận đặt chỗ</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerLow,
  },
  headerTitle: { fontSize: 16, fontWeight: "900", color: Colors.onSurface },
  scrollContent: { padding: 16, gap: 12 },
  tripSummary: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 14,
    borderRadius: Radius.lg,
    gap: 4,
  },
  tripTitle: { fontSize: 15, fontWeight: "800", color: Colors.onSurface },
  tripMeta: { fontSize: 12, color: Colors.mute },
  sectionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 14,
    borderRadius: Radius.lg,
    gap: 8,
  },
  sectionLabel: { fontSize: 9, fontWeight: "900", color: Colors.mute, letterSpacing: 0.5 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  countBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  countBtnDisabled: { opacity: 0.4 },
  countValue: { fontSize: 16, fontWeight: "900", color: Colors.onSurface, minWidth: 24, textAlign: "center" },
  slotHint: { fontSize: 11, color: Colors.primaryDark, fontWeight: "700", marginLeft: 4 },
  input: {
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.onSurface,
  },
  priceSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  priceLabel: { fontSize: 14, fontWeight: "700", color: Colors.onSurface },
  priceValue: { fontSize: 18, fontWeight: "900", color: Colors.primaryDark },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerLow,
  },
  confirmBtn: {
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 14, fontWeight: "800", color: Colors.onPrimary },
});
