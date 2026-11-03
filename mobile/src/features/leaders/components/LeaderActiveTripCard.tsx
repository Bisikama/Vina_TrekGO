import { Colors, Radius } from "@/constants/theme";
import type { LeaderPublicTrip } from "@/features/leaders/hooks";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface LeaderActiveTripCardProps {
  trip?: LeaderPublicTrip | null;
  loading: boolean;
  nextStep: {
    label: string;
    detail: string;
    route: any;
    icon: keyof typeof Ionicons.glyphMap;
  };
  onNavigateNext: (route: any) => void;
  onCreateTrip: () => void;
}

function formatTripDates(startAt?: string, endAt?: string) {
  if (!startAt) return "Lịch chưa cập nhật";
  try {
    const s = new Date(startAt);
    const e = endAt ? new Date(endAt) : null;
    const startStr = `${s.getDate().toString().padStart(2, "0")}/${(s.getMonth() + 1).toString().padStart(2, "0")}`;
    if (!e) return startStr;
    const endStr = `${e.getDate().toString().padStart(2, "0")}/${(e.getMonth() + 1).toString().padStart(2, "0")}.${e.getFullYear()}`;
    return `${startStr} - ${endStr}`;
  } catch {
    return "Lịch chưa cập nhật";
  }
}

export function LeaderActiveTripCard({
  trip,
  loading,
  nextStep,
  onNavigateNext,
  onCreateTrip,
}: LeaderActiveTripCardProps) {
  if (trip) {
    const tripCode = `#TG-${trip.id.slice(0, 4).toUpperCase()}-VN`;
    return (
      <View style={styles.commandCard}>
        <View style={styles.commandHeader}>
          <View>
            <Text style={styles.tripCode}>{tripCode}</Text>
            <Text style={styles.tripName}>{trip.title}</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusPillDot} />
            <Text style={styles.statusPillText}>{trip.status}</Text>
          </View>
        </View>

        <View style={styles.commandRoute}>
          <Ionicons name="calendar-outline" size={15} color="#b8cbb2" />
          <Text style={styles.commandRouteText}>
            {formatTripDates(trip.startAt, trip.endAt)} · {trip.destination?.name || "Tuyến Trekking"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.commandButton}
          onPress={() => onNavigateNext(nextStep.route)}
          activeOpacity={0.86}
        >
          <Ionicons name={nextStep.icon} size={21} color="#0e0f0c" />
          <View style={styles.commandButtonCopy}>
            <Text style={styles.commandButtonLabel}>{nextStep.label}</Text>
            <Text style={styles.commandButtonDetail}>{nextStep.detail}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#0e0f0c" />
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.commandCard, styles.centered]}>
        <ActivityIndicator size="small" color="#0e0f0c" />
        <Text style={styles.loadingText}>Đang tải thông tin chuyến đi từ hệ thống...</Text>
      </View>
    );
  }

  return (
    <View style={styles.commandCard}>
      <View style={styles.commandHeader}>
        <View>
          <Text style={styles.tripCode}>CHƯA CÓ CHUYẾN ĐI</Text>
          <Text style={styles.tripName}>Bạn chưa tạo chuyến đi công khai nào</Text>
        </View>
      </View>
      <Text style={styles.emptyPrompt}>
        Bấm bên dưới để tạo Public Trip mới và mở nhận đăng ký cho thành viên.
      </Text>
      <TouchableOpacity
        style={[styles.commandButton, { marginTop: 14 }]}
        onPress={onCreateTrip}
        activeOpacity={0.86}
      >
        <Ionicons name="add-circle-outline" size={21} color="#0e0f0c" />
        <View style={styles.commandButtonCopy}>
          <Text style={styles.commandButtonLabel}>Tạo Public Trip mới</Text>
          <Text style={styles.commandButtonDetail}>Chọn điểm đến, checkpoint và mở bán</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#0e0f0c" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  commandCard: {
    backgroundColor: "#163300",
    borderRadius: Radius.lg,
    padding: 20,
    marginTop: 18,
  },
  centered: {
    alignItems: "center",
    paddingVertical: 28,
  },
  loadingText: {
    color: "#b8cbb2",
    marginTop: 8,
    fontSize: 13,
  },
  commandHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  tripCode: {
    color: "#9fe870",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  tripName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 3,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7bf1a8",
  },
  statusPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  commandRoute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  commandRouteText: {
    color: "#b8cbb2",
    fontSize: 13,
  },
  commandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#9fe870",
    padding: 14,
    borderRadius: 24,
    marginTop: 18,
  },
  commandButtonCopy: {
    flex: 1,
  },
  commandButtonLabel: {
    color: "#0e0f0c",
    fontSize: 14,
    fontWeight: "700",
  },
  commandButtonDetail: {
    color: "#454745",
    fontSize: 11,
    marginTop: 2,
  },
  emptyPrompt: {
    color: "#b8cbb2",
    marginTop: 8,
    fontSize: 13,
  },
});
