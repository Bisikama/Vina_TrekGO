import { Colors, Radius, Shadows } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface LeaderTripPermissionStepProps {
  accessToken?: string | null;
  onProceed: () => void;
  onBack: () => void;
}

export function LeaderTripPermissionStep({
  accessToken,
  onProceed,
  onBack,
}: LeaderTripPermissionStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={23} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo Public Trip</Text>
        <View style={{ width: 23 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={34} color={Colors.primaryDark} />
        </View>
        <Text style={styles.title}>Kiểm tra quyền tạo chuyến</Text>
        <Text style={styles.desc}>
          Tài khoản Mountain Leader của bạn đã được xác thực thẩm quyền tạo Public Trip trên hệ thống TrekGo.
        </Text>

        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={19} color={Colors.primaryDark} />
          <Text style={styles.rowText}>Quyền tạo Public Trip: HỢP LỆ</Text>
        </View>

        {!accessToken && (
          <View style={styles.tokenNotice}>
            <Ionicons name="alert-circle-outline" size={18} color="#9a3412" />
            <Text style={styles.tokenNoticeText}>
              Chưa tìm thấy access token đăng nhập. Vui lòng đăng nhập tài khoản Leader để ghi nhận lên máy chủ.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.primary} onPress={onProceed} activeOpacity={0.85}>
          <Text style={styles.primaryText}>TIẾP TỤC TẠO TRIP</Text>
          <Ionicons name="arrow-forward" size={17} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  headerTitle: {
    color: Colors.ink,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: Radius.md,
    padding: 22,
    marginTop: 20,
    ...Shadows.card,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#eaf5e1",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: {
    color: Colors.ink,
    fontSize: 23,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 18,
  },
  desc: {
    color: Colors.body,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 9,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f2f8ee",
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  rowText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
  tokenNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff7ed",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  tokenNoticeText: {
    color: "#9a3412",
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primaryDark,
    padding: 15,
    borderRadius: Radius.sm,
    marginTop: 22,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
});
