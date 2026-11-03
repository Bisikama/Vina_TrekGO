import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import type { UserNotification, UserNotificationCategory } from "@/types";

type Filter = "ALL" | UserNotificationCategory;

const filters: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "BOOKING", label: "Booking" },
  { value: "RENTAL", label: "Thuê đồ" },
  { value: "GROUP_TRIP", label: "Ghép đoàn" },
  { value: "PERSONAL_TRAIL", label: "Cung cá nhân" },
];

const categoryMeta: Record<UserNotificationCategory, { label: string; icon: keyof typeof Ionicons.glyphMap; background: string }> = {
  BOOKING: { label: "Booking", icon: "ticket-outline", background: Colors.primaryPale },
  RENTAL: { label: "Rental", icon: "cube-outline", background: Colors.tertiaryFixed },
  GROUP_TRIP: { label: "Ghép đoàn", icon: "people-outline", background: Colors.primaryPale },
  PERSONAL_TRAIL: { label: "Cung cá nhân", icon: "trail-sign-outline", background: Colors.surfaceContainerLow },
  SYSTEM: { label: "Hệ thống", icon: "information-circle-outline", background: Colors.surfaceContainerLow },
};

export default function UserNotificationsScreen() {
  const router = useRouter();
  const {
    userNotifications,
    markUserNotificationRead,
    markAllUserNotificationsRead,
    deleteUserNotification,
  } = useApp();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const unreadCount = userNotifications.filter((item) => !item.isRead).length;
  const visibleNotifications = useMemo(
    () =>
      userNotifications.filter(
        (item) =>
          (filter === "ALL" || item.category === filter) &&
          (!onlyUnread || !item.isRead),
      ),
    [filter, onlyUnread, userNotifications],
  );

  function openNotification(notification: UserNotification) {
    markUserNotificationRead(notification.id);
    router.push(notification.route as Href);
  }

  function confirmDelete(notification: UserNotification) {
    Alert.alert("Xóa thông báo?", notification.title, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => deleteUserNotification(notification.id),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.headerEyebrow}>ACTIVITY CENTER</Text>
          <Text style={styles.headerTitle}>Thông báo của bạn</Text>
        </View>
        <TouchableOpacity
          style={styles.readAllButton}
          onPress={markAllUserNotificationsRead}
          disabled={unreadCount === 0}
        >
          <Text style={[styles.readAllText, unreadCount === 0 && styles.disabledText]}>
            Đọc tất cả
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="notifications" size={27} color={Colors.primary} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.heroTitle}>{unreadCount} thông báo chưa đọc</Text>
            <Text style={styles.heroText}>
              Booking, thuê đồ, ghép đoàn và xác minh cung đường được gom tại đây.
            </Text>
          </View>
        </View>

        {/* Banner Lời mời vé bạn bè gửi tặng (Milestone 6 Companion Flow) */}
        <TouchableOpacity
          style={styles.invitationBanner}
          onPress={() => router.push("/invitations" as any)}
          activeOpacity={0.88}
        >
          <View style={styles.invitationIconBox}>
            <Ionicons name="mail-unread" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.invitationBannerTitle}>Hộp thư Lời mời Vé Trekking</Text>
            <Text style={styles.invitationBannerText}>
              Xem và chấp nhận các vé trekking được bạn bè gửi tặng
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((item) => {
            const selected = filter === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
                onPress={() => setFilter(item.value)}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.unreadToggle} onPress={() => setOnlyUnread((current) => !current)}>
          <Ionicons name={onlyUnread ? "checkbox" : "square-outline"} size={18} color={onlyUnread ? Colors.primaryDark : Colors.onSurfaceMuted} />
          <Text style={styles.unreadToggleText}>Chỉ hiện thông báo chưa đọc</Text>
          <Text style={styles.resultText}>{visibleNotifications.length} mục</Text>
        </TouchableOpacity>

        {visibleNotifications.length ? (
          visibleNotifications.map((notification) => {
            const meta = categoryMeta[notification.category];
            return (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationCard, !notification.isRead && styles.notificationUnread]}
                onPress={() => openNotification(notification)}
                onLongPress={() => confirmDelete(notification)}
                activeOpacity={0.84}
              >
                <View style={[styles.notificationIcon, { backgroundColor: meta.background }]}>
                  <Ionicons name={meta.icon} size={21} color={Colors.primaryDark} />
                </View>
                <View style={styles.flexOne}>
                  <View style={styles.notificationTopRow}>
                    <Text style={styles.categoryLabel}>{meta.label}</Text>
                    <Text style={styles.createdAt}>{notification.createdAt}</Text>
                  </View>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                </View>
                {!notification.isRead ? <View style={styles.unreadDot} /> : null}
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="notifications-off-outline" size={32} color={Colors.onSurfaceMuted} />
            <Text style={styles.emptyTitle}>Không có thông báo phù hợp</Text>
            <Text style={styles.emptyText}>Thử đổi bộ lọc hoặc tắt chế độ chưa đọc.</Text>
          </View>
        )}

        <Text style={styles.hintText}>Giữ lâu một thông báo để xóa khỏi danh sách mock.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  headerEyebrow: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" },
  readAllButton: { minHeight: 36, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  readAllText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" },
  disabledText: { color: Colors.onSurfaceMuted },
  content: { padding: 14, paddingBottom: 42 },
  heroCard: { padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.card },
  heroIcon: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg, backgroundColor: "rgba(159,232,112,0.12)" },
  heroTitle: { color: Colors.onPrimaryDark, fontSize: 13, fontWeight: "900" },
  heroText: { marginTop: 4, color: "#D9E8CF", fontSize: 8, lineHeight: 13 },
  filterRow: { paddingTop: 12, gap: 7 },
  filterChip: { minHeight: 36, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow },
  filterChipSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  filterText: { color: Colors.onSurfaceVariant, fontSize: 8, fontWeight: "800" },
  filterTextSelected: { color: Colors.primaryDark },
  unreadToggle: { marginTop: 12, marginBottom: 9, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 7 },
  unreadToggleText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 9, fontWeight: "800" },
  resultText: { color: Colors.onSurfaceMuted, fontSize: 8 },
  notificationCard: { marginBottom: 9, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: "transparent", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  notificationUnread: { borderColor: Colors.primaryNeutral, backgroundColor: Colors.primaryPale },
  notificationIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.lg },
  notificationTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  categoryLabel: { color: Colors.primaryDark, fontSize: 7, fontWeight: "900", letterSpacing: 0.4 },
  createdAt: { color: Colors.onSurfaceMuted, fontSize: 7 },
  notificationTitle: { marginTop: 5, color: Colors.onSurface, fontSize: 11, fontWeight: "900" },
  notificationMessage: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 8, lineHeight: 13 },
  unreadDot: { width: 8, height: 8, marginTop: 4, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  emptyCard: { minHeight: 210, alignItems: "center", justifyContent: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  emptyTitle: { marginTop: 10, color: Colors.onSurface, fontSize: 12, fontWeight: "900" },
  emptyText: { marginTop: 4, color: Colors.onSurfaceMuted, fontSize: 8 },
  hintText: { marginTop: 10, color: Colors.onSurfaceMuted, fontSize: 7, textAlign: "center" },
  invitationBanner: {
    marginTop: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: Radius.xl,
    backgroundColor: "#E0F2F1",
    borderWidth: 1.5,
    borderColor: "#80CBC4",
    ...Shadows.card,
  },
  invitationIconBox: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  invitationBannerTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.primary,
  },
  invitationBannerText: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 14,
  },
});
