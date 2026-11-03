import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { Trip } from "@/types";

interface TripPrepModalProps {
  visible: boolean;
  trip: Trip;
  onClose: () => void;
  onStartNavigation: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
}

const checklistItems: ChecklistItem[] = [
  {
    id: "backpack",
    label: "Balo trekking 45L - 65L có đệm trợ lực lưng",
  },
  {
    id: "shoes",
    label: "Giày leo núi đế gai chuyên dụng",
  },
  {
    id: "clothes",
    label: "Tất dày và quần áo mau khô",
  },
  {
    id: "water",
    label: "Bình nước cá nhân tối thiểu 1.5 lít",
  },
  {
    id: "medicine",
    label: "Thuốc chống muỗi, vắt và điện giải",
  },
  {
    id: "documents",
    label: "Giấy tờ tùy thân và vé QR chuyến đi",
  },
];

export const TripPrepModal: React.FC<TripPrepModalProps> = ({
  visible,
  trip,
  onClose,
  onStartNavigation,
}) => {
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const [checkInRequested, setCheckInRequested] = useState(false);

  const [checkInConfirmed, setCheckInConfirmed] = useState(false);

  const completedCount = checkedItems.length;

  const checklistCompleted = completedCount === checklistItems.length;

  const checklistProgress = useMemo(() => {
    return Math.round((completedCount / checklistItems.length) * 100);
  }, [completedCount]);

  function toggleChecklistItem(itemId: string) {
    if (checkInConfirmed) {
      return;
    }

    setCheckedItems((currentItems) => {
      if (currentItems.includes(itemId)) {
        return currentItems.filter((id) => id !== itemId);
      }

      return [...currentItems, itemId];
    });
  }

  function requestCheckIn() {
    if (!checklistCompleted) {
      Alert.alert(
        "Checklist chưa hoàn tất",
        "Bạn cần xác nhận đầy đủ hành lý và giấy tờ trước khi gửi yêu cầu check-in.",
      );

      return;
    }

    if (checkInRequested || checkInConfirmed) {
      return;
    }

    setCheckInRequested(true);

    /*
     * Demo mock:
     * Sau này thay phần setTimeout này bằng API kiểm tra
     * trạng thái check-in do Staff Delivery xác nhận.
     */
    setTimeout(() => {
      setCheckInConfirmed(true);

      Alert.alert(
        "Check-in thành công",
        "Đã cập nhật trạng thái có mặt tại điểm tập trung.",
      );
    }, 1200);
  }

  function startNavigation() {
    onClose();
    onStartNavigation();
  }

  function renderCheckInStatus() {
    if (checkInConfirmed) {
      return (
        <View style={styles.confirmedStatus}>
          <View style={styles.statusIconConfirmed}>
            <Ionicons name="checkmark" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.confirmedStatusTitle}>
              Staff đã xác nhận check-in
            </Text>

            <Text style={styles.confirmedStatusDescription}>
              Bạn đã có mặt tại điểm tập trung. GPS trekking đã được mở.
            </Text>
          </View>
        </View>
      );
    }

    if (checkInRequested) {
      return (
        <View style={styles.pendingStatus}>
          <View style={styles.statusIconPending}>
            <Ionicons name="time-outline" size={22} color="#7A5700" />
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.pendingStatusTitle}>
              Đang chờ Staff xác nhận
            </Text>

            <Text style={styles.pendingStatusDescription}>
              Vui lòng đứng tại điểm tập trung và chuẩn bị vé QR.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.lockedStatus}>
        <View style={styles.statusIconLocked}>
          <Ionicons
            name="lock-closed"
            size={20}
            color={Colors.onSurfaceVariant}
          />
        </View>

        <View style={styles.statusContent}>
          <Text style={styles.lockedStatusTitle}>Chưa check-in</Text>

          <Text style={styles.lockedStatusDescription}>
            Hoàn tất checklist để gửi yêu cầu check-in tại điểm tập trung.
          </Text>
        </View>
      </View>
    );
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
          <View style={styles.dragHandle} />

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.confirmedPill}>
                <Ionicons name="shield-checkmark" size={14} color="#0C2000" />

                <Text style={styles.confirmedText}>CHUYẾN ĐÃ XÁC NHẬN</Text>
              </View>

              <Text style={styles.title}>{trip.name}</Text>

              <Text style={styles.bookingCode}>
                Mã đặt chỗ: {trip.bookingCode ?? "#BK-8842"}
              </Text>
            </View>

            {/* Check-in status */}
            {renderCheckInStatus()}

            {/* Logistics */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderIcon}>
                  <Ionicons name="bus" size={18} color={Colors.primaryDark} />
                </View>

                <Text style={styles.sectionTitle}>
                  Phương tiện & điểm tập kết
                </Text>
              </View>

              <View style={styles.logisticsDetail}>
                <View style={styles.logRow}>
                  <Text style={styles.logLabel}>Điểm đón</Text>

                  <Text style={styles.logValue}>
                    {trip.logistics?.pickupLocation ?? "Điểm tập trung TrekGo"}
                  </Text>
                </View>

                <View style={styles.logRow}>
                  <Text style={styles.logLabel}>Thời gian</Text>

                  <Text style={styles.logValue}>
                    {trip.logistics?.pickupTime ?? "21:00 Thứ Sáu"}
                  </Text>
                </View>

                <View style={styles.logRow}>
                  <Text style={styles.logLabel}>Loại xe</Text>

                  <Text style={styles.logValue}>
                    {trip.logistics?.vehicleModel ?? "TrekGo Express 16 chỗ"}
                  </Text>
                </View>

                <View style={styles.logRow}>
                  <Text style={styles.logLabel}>Biển số xe</Text>

                  <View style={styles.licensePlateBadge}>
                    <Text style={styles.licensePlateText}>
                      {trip.logistics?.vehiclePlate ?? "51B-123.45"}
                    </Text>
                  </View>
                </View>

                <View style={styles.logRow}>
                  <Text style={styles.logLabel}>Tài xế</Text>

                  <Text style={styles.logValue}>
                    {trip.logistics?.driverName ?? "Anh Minh"}
                    {trip.logistics?.driverPhone
                      ? ` · ${trip.logistics.driverPhone}`
                      : ""}
                  </Text>
                </View>
              </View>
            </View>

            {/* Weather */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.weatherHeaderIcon}>
                  <Ionicons name="partly-sunny" size={18} color="#725C00" />
                </View>

                <Text style={styles.sectionTitle}>Thời tiết & khí hậu</Text>
              </View>

              <View style={styles.weatherBox}>
                <View style={styles.weatherTop}>
                  <Text style={styles.temp}>{trip.weather.tempC}°C</Text>

                  <Text style={styles.condition}>{trip.weather.condition}</Text>
                </View>

                <View style={styles.weatherMetaRow}>
                  <View style={styles.weatherMeta}>
                    <Ionicons name="water-outline" size={15} color="#2563EB" />

                    <Text style={styles.weatherMetaText}>
                      Độ ẩm {trip.weather.humidityPercent}%
                    </Text>
                  </View>

                  <View style={styles.weatherMeta}>
                    <Ionicons name="rainy-outline" size={15} color="#2563EB" />

                    <Text style={styles.weatherMetaText}>
                      Mưa {trip.weather.rainChancePercent}%
                    </Text>
                  </View>
                </View>

                <Text style={styles.weatherNotice}>
                  💡{" "}
                  {trip.weather.riskNotice ??
                    "Mang áo khoác mỏng và áo mưa dự phòng."}
                </Text>
              </View>
            </View>

            {/* Interactive checklist */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderIcon}>
                  <Ionicons
                    name="checkbox"
                    size={18}
                    color={Colors.primaryDark}
                  />
                </View>

                <View style={styles.checklistHeaderContent}>
                  <Text style={styles.sectionTitle}>Checklist chuẩn bị</Text>

                  <Text style={styles.checklistProgressText}>
                    {completedCount}/{checklistItems.length} mục
                  </Text>
                </View>

                <Text style={styles.progressPercentage}>
                  {checklistProgress}%
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${checklistProgress}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.checklist}>
                {checklistItems.map((item) => {
                  const checked = checkedItems.includes(item.id);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.checkItem,
                        checked && styles.checkItemSelected,
                      ]}
                      onPress={() => toggleChecklistItem(item.id)}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checked && styles.checkboxSelected,
                        ]}
                      >
                        {checked && (
                          <Ionicons
                            name="checkmark"
                            size={15}
                            color="#FFFFFF"
                          />
                        )}
                      </View>

                      <Text
                        style={[
                          styles.checkItemText,
                          checked && styles.checkItemTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Check-in request */}
            {!checkInConfirmed && (
              <TouchableOpacity
                style={[
                  styles.checkInButton,
                  (!checklistCompleted || checkInRequested) &&
                    styles.disabledButton,
                ]}
                onPress={requestCheckIn}
                disabled={checkInRequested}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={checkInRequested ? "time-outline" : "scan-outline"}
                  size={21}
                  color={
                    !checklistCompleted
                      ? Colors.onSurfaceVariant
                      : Colors.onPrimary
                  }
                />

                <Text
                  style={[
                    styles.checkInButtonText,
                    !checklistCompleted && styles.disabledButtonText,
                  ]}
                >
                  {checkInRequested
                    ? "Đang chờ Staff xác nhận"
                    : "Gửi yêu cầu check-in"}
                </Text>
              </TouchableOpacity>
            )}

            {/* GPS */}
            <TouchableOpacity
              style={[
                styles.navButton,
              ]}
              onPress={startNavigation}
              activeOpacity={0.85}
            >
              <Ionicons
                name="navigate-circle"
                size={24}
                color={
                  Colors.onPrimary
                }
              />

              <Text
                style={[
                  styles.navButtonText,
                ]}
              >
                Vào chế độ GPS trekking
              </Text>
            </TouchableOpacity>

            <Text style={styles.gpsNotice}>
              Bạn có thể ghi GPS trước khi chuyến bắt đầu nếu có quyền tham gia.
              Chuyến đã kết thúc chỉ cho phép xem hành trình.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  container: {
    maxHeight: "92%",
    padding: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.surface,
    ...Shadows.hover,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    marginBottom: 12,
    alignSelf: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  header: {
    paddingRight: 42,
    marginBottom: 16,
  },
  confirmedPill: {
    alignSelf: "flex-start",
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryContainer,
  },
  confirmedText: {
    color: "#0C2000",
    fontSize: 9,
    fontWeight: "800",
  },
  title: {
    color: Colors.onSurface,
    fontSize: 20,
    fontWeight: "900",
  },
  bookingCode: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  lockedStatus: {
    marginBottom: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
  },
  pendingStatus: {
    marginBottom: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F4C95D",
    borderRadius: Radius.lg,
    backgroundColor: "#FFF7D6",
  },
  confirmedStatus: {
    marginBottom: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#8BC7A2",
    borderRadius: Radius.lg,
    backgroundColor: "#E4F6EA",
  },
  statusIconLocked: {
    width: 40,
    height: 40,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  statusIconPending: {
    width: 40,
    height: 40,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: "#FFE49A",
  },
  statusIconConfirmed: {
    width: 40,
    height: 40,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: "#1B4332",
  },
  statusContent: {
    flex: 1,
  },
  lockedStatusTitle: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "800",
  },
  lockedStatusDescription: {
    marginTop: 2,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 16,
  },
  pendingStatusTitle: {
    color: "#6B4B00",
    fontSize: 13,
    fontWeight: "800",
  },
  pendingStatusDescription: {
    marginTop: 2,
    color: "#7A5E1A",
    fontSize: 11,
    lineHeight: 16,
  },
  confirmedStatusTitle: {
    color: "#123524",
    fontSize: 13,
    fontWeight: "800",
  },
  confirmedStatusDescription: {
    marginTop: 2,
    color: "#3E6651",
    fontSize: 11,
    lineHeight: 16,
  },
  sectionCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  sectionHeader: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
  },
  weatherHeaderIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: "#FFF4C4",
  },
  sectionTitle: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "800",
  },
  logisticsDetail: {
    gap: 8,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  logLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  logValue: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  licensePlateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#FED018",
    borderRadius: Radius.sm,
    backgroundColor: "#FFF9E6",
  },
  licensePlateText: {
    color: "#6F5900",
    fontSize: 11,
    fontWeight: "800",
  },
  weatherBox: {
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  weatherTop: {
    marginBottom: 7,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  temp: {
    color: Colors.onSurface,
    fontSize: 22,
    fontWeight: "900",
  },
  condition: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
  },
  weatherMetaRow: {
    marginBottom: 8,
    flexDirection: "row",
    gap: 14,
  },
  weatherMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  weatherMetaText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
  },
  weatherNotice: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 16,
  },
  checklistHeaderContent: {
    flex: 1,
  },
  checklistProgressText: {
    marginTop: 1,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  progressPercentage: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  progressTrack: {
    height: 6,
    marginBottom: 12,
    overflow: "hidden",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  progressFill: {
    height: "100%",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
  },
  checklist: {
    gap: 8,
  },
  checkItem: {
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  checkItemSelected: {
    borderColor: "#8BC7A2",
    backgroundColor: "#E4F6EA",
  },
  checkbox: {
    width: 24,
    height: 24,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.onSurfaceVariant,
    borderRadius: 7,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  checkboxSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  checkItemText: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 12,
    lineHeight: 17,
  },
  checkItemTextSelected: {
    color: "#234D34",
    fontWeight: "600",
  },
  checkInButton: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  checkInButtonText: {
    color: Colors.onPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    backgroundColor: Colors.surfaceContainerHighest,
  },
  disabledButtonText: {
    color: Colors.onSurfaceVariant,
  },
  navButton: {
    minHeight: 52,
    marginTop: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
    ...Shadows.hover,
  },
  navButtonLocked: {
    backgroundColor: Colors.surfaceContainerHighest,
    shadowOpacity: 0,
    elevation: 0,
  },
  navButtonText: {
    color: Colors.onPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  navButtonTextLocked: {
    color: Colors.onSurfaceVariant,
  },
  gpsNotice: {
    marginTop: 8,
    paddingHorizontal: 14,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
});
