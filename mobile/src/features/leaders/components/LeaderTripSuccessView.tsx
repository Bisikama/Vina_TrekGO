import { Colors, Radius, Shadows } from "@/constants/theme";
import type { TripOptionDestination } from "@/features/leaders/hooks";
import type { LeaderTripFormData } from "./LeaderTripFormStep";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface LeaderTripSuccessViewProps {
  publishedTrip: { id: string; title: string; code: string };
  form: LeaderTripFormData;
  selectedDestination?: TripOptionDestination;
  onProceedPretrip?: () => void;
  onViewTripDetail?: () => void;
  onGoToDashboard?: () => void;
}

export function LeaderTripSuccessView({
  publishedTrip,
  form,
  selectedDestination,
  onProceedPretrip,
  onViewTripDetail,
  onGoToDashboard,
}: LeaderTripSuccessViewProps) {
  const handleProceed = onViewTripDetail || onProceedPretrip;

  return (
    <View style={styles.container}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={34} color="#fff" />
      </View>
      <Text style={styles.successTitle}>Trip đã được Publish!</Text>
      <Text style={styles.successText}>
        Chuyến đi công khai đã được lưu thành công trên máy chủ và mở đặt chỗ cho người dùng.
      </Text>

      <View style={styles.successCard}>
        <Text style={styles.label}>MÃ CHUYẾN ĐI (HỆ THỐNG)</Text>
        <Text style={styles.successCode}>#TG-{publishedTrip.code}-VN</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Tên chuyến</Text>
          <Text style={styles.rowValue}>{publishedTrip.title}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Ngày đi</Text>
          <Text style={styles.rowValue}>{`${form.startDate} – ${form.endDate}`}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Điểm đến</Text>
          <Text style={styles.rowValue}>{selectedDestination?.name ?? form.destinationId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Slot mở bán</Text>
          <Text style={styles.rowValue}>{`${form.slots} chỗ`}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Trạng thái</Text>
          <Text style={styles.rowValue}>OPEN (Đang mở nhận khách)</Text>
        </View>
      </View>

      {/* Lựa chọn điều hướng: Xem chi tiết hoặc Về Dashboard */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.primary} onPress={handleProceed} activeOpacity={0.85}>
          <Ionicons name="eye-outline" size={17} color="#fff" />
          <Text style={styles.primaryText}>XEM CHI TIẾT CHUYẾN ĐI</Text>
        </TouchableOpacity>

        {Boolean(onGoToDashboard) && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={onGoToDashboard} activeOpacity={0.85}>
            <Ionicons name="grid-outline" size={17} color="#125238" />
            <Text style={styles.secondaryBtnText}>VỀ DASHBOARD CHỈ HUY</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    color: Colors.ink,
    fontSize: 25,
    fontWeight: "800",
    marginTop: 18,
    textAlign: "center",
  },
  successText: {
    color: Colors.body,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    fontSize: 13,
  },
  successCard: {
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderRadius: Radius.md,
    padding: 17,
    marginTop: 24,
    ...Shadows.card,
  },
  label: {
    color: Colors.onSurfaceMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  successCode: {
    color: Colors.primaryDark,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 12,
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    paddingVertical: 10,
  },
  rowLabel: {
    color: Colors.onSurfaceMuted,
    fontSize: 11,
  },
  rowValue: {
    color: Colors.ink,
    fontWeight: "700",
    fontSize: 13,
    marginTop: 2,
  },
  actionsContainer: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 20,
  },
  primary: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primaryDark,
    padding: 14,
    borderRadius: Radius.md,
    ...Shadows.card,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  secondaryBtn: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    padding: 13,
    borderRadius: Radius.md,
  },
  secondaryBtnText: {
    color: Colors.primaryDark,
    fontWeight: "800",
    fontSize: 13,
  },
});
