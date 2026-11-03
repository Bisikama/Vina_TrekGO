import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePickupPoints } from "../hooks/usePickupPoints";
import { useUpdatePrivateTrip } from "../hooks/useUpdatePrivateTrip";
import type { PrivateTrip, UpdatePrivateTripPayload } from "../types";

export interface EditPrivateTripModalProps {
  visible: boolean;
  trip: PrivateTrip;
  activeMemberCount?: number;
  onClose: () => void;
  onSuccess: (updatedTrip: PrivateTrip) => void;
}

export function EditPrivateTripModal({
  visible,
  trip,
  activeMemberCount = 1,
  onClose,
  onSuccess,
}: EditPrivateTripModalProps) {
  const [title, setTitle] = useState(trip.title);
  const [description, setDescription] = useState(trip.description || "");
  const [startAt, setStartAt] = useState(trip.startAt);
  const [endAt, setEndAt] = useState(trip.endAt);
  const [capacity, setCapacity] = useState(trip.maxPax || 5);
  const [pickupPointId, setPickupPointId] = useState(trip.pickupPointId || "");

  const { updateTrip, loading: updating } = useUpdatePrivateTrip();
  const { pickupPoints, loading: loadingPickups } = usePickupPoints(
    trip.destinationId,
    visible,
  );

  useEffect(() => {
    if (visible && trip) {
      setTitle(trip.title);
      setDescription(trip.description || "");
      setStartAt(trip.startAt);
      setEndAt(trip.endAt);
      setCapacity(trip.maxPax || 5);
      setPickupPointId(trip.pickupPointId || "");
    }
  }, [visible, trip]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert("Thiếu tên chuyến", "Vui lòng nhập tên chuyến đi.");
      return;
    }

    if (capacity < activeMemberCount) {
      Alert.alert(
        "Sĩ số không hợp lệ",
        `Sĩ số mới không được nhỏ hơn số lượng thành viên hiện tại (${activeMemberCount} người).`,
      );
      return;
    }

    try {
      const payload: UpdatePrivateTripPayload = {
        expectedVersion: trip.version,
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        capacity,
        pickupPointId: pickupPointId || undefined,
      };

      const updated = await updateTrip(trip.id, payload);
      Alert.alert("Thành công", "Thông tin chuyến đi đã được cập nhật.");
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      if (err?.code === "PRIVATE_TRIP_VERSION_CONFLICT") {
        Alert.alert(
          "Xung đột phiên bản",
          "Thông tin chuyến đi vừa thay đổi trên máy chủ. Vui lòng tải lại trang.",
        );
      } else {
        Alert.alert(
          "Lỗi cập nhật",
          err?.message || "Không thể cập nhật chuyến đi lúc này.",
        );
      }
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Chỉnh sửa chuyến đi</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tên chuyến đi *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Nhập tên chuyến đi"
                placeholderTextColor={Colors.mute}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ghi chú / Dặn dò thành viên</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Mang theo áo mưa, thuốc chống côn trùng..."
                placeholderTextColor={Colors.mute}
                multiline
                numberOfLines={3}
                maxLength={5000}
              />
            </View>

            {/* Capacity */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Sĩ số tối đa (bao gồm Host) *</Text>
                <Text style={styles.labelNote}>Tối thiểu {activeMemberCount} người</Text>
              </View>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={[
                    styles.counterBtn,
                    capacity <= activeMemberCount && styles.btnDisabled,
                  ]}
                  onPress={() => setCapacity((c) => Math.max(activeMemberCount, c - 1))}
                  disabled={capacity <= activeMemberCount}
                >
                  <Ionicons name="remove" size={18} color={Colors.onSurface} />
                </TouchableOpacity>

                <Text style={styles.counterValue}>{capacity} người</Text>

                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setCapacity((c) => c + 1)}
                >
                  <Ionicons name="add" size={18} color={Colors.onSurface} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Pickup Point Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Điểm tập kết đón đoàn</Text>
              {loadingPickups ? (
                <ActivityIndicator size="small" color={Colors.primaryDark} />
              ) : pickupPoints.length === 0 ? (
                <Text style={styles.emptyPickupText}>
                  Không có điểm tập kết nào khác cho khu vực này.
                </Text>
              ) : (
                <View style={styles.pickupList}>
                  {pickupPoints.map((p) => {
                    const isSelected = p.id === pickupPointId;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.pickupCard,
                          isSelected && styles.pickupCardSelected,
                        ]}
                        onPress={() => setPickupPointId(p.id)}
                      >
                        <Ionicons
                          name={isSelected ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={isSelected ? Colors.primaryDark : Colors.mute}
                        />
                        <View style={styles.pickupInfo}>
                          <Text
                            style={[
                              styles.pickupName,
                              isSelected && styles.pickupNameSelected,
                            ]}
                          >
                            {p.name}
                          </Text>
                          {p.address ? (
                            <Text style={styles.pickupAddress}>{p.address}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={updating}
            >
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, updating && styles.btnDisabled]}
              onPress={handleSave}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
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
    justifyContent: "flex-end",
  },
  container: {
    maxHeight: "85%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 16,
    ...Shadows.hover,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.onSurface,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelNote: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
  },
  counterBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.4,
  },
  counterValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primaryDark,
  },
  emptyPickupText: {
    fontSize: 12,
    color: Colors.mute,
    fontStyle: "italic",
    paddingVertical: 6,
  },
  pickupList: {
    gap: 8,
  },
  pickupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  pickupCardSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: "#F0FDF4",
  },
  pickupInfo: {
    flex: 1,
  },
  pickupName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  pickupNameSelected: {
    color: Colors.primaryDark,
  },
  pickupAddress: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    backgroundColor: Colors.surface,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceContainerHigh,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.onSurface,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryDark,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
