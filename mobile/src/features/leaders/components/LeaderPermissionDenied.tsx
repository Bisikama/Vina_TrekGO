import { Colors, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface LeaderPermissionDeniedProps {
  onBack: () => void;
}

export function LeaderPermissionDenied({ onBack }: LeaderPermissionDeniedProps) {
  return (
    <View style={styles.blocked}>
      <Ionicons name="lock-closed" size={44} color={Colors.error} />
      <Text style={styles.blockedTitle}>Không đủ quyền</Text>
      <Text style={styles.blockedText}>
        Tài khoản của bạn chưa được cấp quyền tạo Public Trip trên hệ thống TrekGo.
      </Text>
      <TouchableOpacity style={styles.secondary} onPress={onBack}>
        <Text style={styles.secondaryText}>QUAY LẠI</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  blockedTitle: {
    color: Colors.ink,
    fontWeight: "800",
    fontSize: 24,
    marginTop: 16,
  },
  blockedText: {
    color: Colors.body,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  secondary: {
    borderWidth: 1,
    borderColor: Colors.primaryDark,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: Radius.sm,
    marginTop: 20,
    alignItems: "center",
  },
  secondaryText: {
    color: Colors.primaryDark,
    fontWeight: "800",
  },
});
