import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { CommunityNotification, CommunityNotificationType } from "@/types";

type NotificationFilter = "ALL" | "UNREAD";

const notificationVisual: Record<
  CommunityNotificationType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; background: string }
> = {
  LIKE: { icon: "heart", color: Colors.error, background: Colors.errorContainer },
  COMMENT: { icon: "chatbubble", color: Colors.primaryDark, background: Colors.primaryPale },
  FOLLOW: { icon: "person-add", color: Colors.secondary, background: Colors.secondaryContainer },
  SAFETY: { icon: "warning", color: Colors.warningDeep, background: Colors.tertiaryFixed },
  SYSTEM: { icon: "notifications", color: Colors.onSurfaceVariant, background: Colors.surfaceContainer },
};

export default function CommunityNotificationsScreen() {
  const router = useRouter();
  const {
    communityNotifications,
    markCommunityNotificationRead,
    markAllCommunityNotificationsRead,
  } = useApp();
  const [filter, setFilter] = useState<NotificationFilter>("ALL");

  const unreadCount = communityNotifications.filter(
    (notification) => !notification.isRead,
  ).length;
  const visibleNotifications = useMemo(
    () =>
      filter === "UNREAD"
        ? communityNotifications.filter((notification) => !notification.isRead)
        : communityNotifications,
    [communityNotifications, filter],
  );

  function openNotification(notification: CommunityNotification) {
    markCommunityNotificationRead(notification.id);

    if (notification.postId) {
      router.push({
        pathname: "/community/posts/[postId]",
        params: { postId: notification.postId },
      } as unknown as Href);
      return;
    }

    if (notification.profileId) {
      router.push({
        pathname: "/community/profiles/[userId]",
        params: { userId: notification.profileId },
      } as unknown as Href);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>COMMUNITY</Text>
          <Text style={styles.headerTitle}>Thông báo</Text>
        </View>
        <TouchableOpacity
          style={[styles.readAllButton, unreadCount === 0 && styles.readAllButtonDisabled]}
          onPress={markAllCommunityNotificationsRead}
          disabled={unreadCount === 0}
        >
          <Text
            style={[
              styles.readAllButtonText,
              unreadCount === 0 && styles.readAllButtonTextDisabled,
            ]}
          >
            Đọc tất cả
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Ionicons name="notifications" size={23} color={Colors.onPrimaryDark} />
        </View>
        <View style={styles.summaryInfo}>
          <Text style={styles.summaryTitle}>
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Bạn đã xem hết thông báo"}
          </Text>
          <Text style={styles.summaryText}>
            Theo dõi tương tác, cảnh báo tuyến và cập nhật Community.
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, filter === "ALL" && styles.filterButtonSelected]}
          onPress={() => setFilter("ALL")}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === "ALL" && styles.filterButtonTextSelected,
            ]}
          >
            Tất cả ({communityNotifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "UNREAD" && styles.filterButtonSelected]}
          onPress={() => setFilter("UNREAD")}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === "UNREAD" && styles.filterButtonTextSelected,
            ]}
          >
            Chưa đọc ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {visibleNotifications.map((notification) => {
          const visual = notificationVisual[notification.type];

          return (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.isRead && styles.notificationCardUnread,
              ]}
              onPress={() => openNotification(notification)}
              activeOpacity={0.85}
            >
              {notification.actor ? (
                <Image source={{ uri: notification.actor.avatar }} style={styles.actorAvatar} />
              ) : (
                <View style={[styles.typeIcon, { backgroundColor: visual.background }]}>
                  <Ionicons name={visual.icon} size={20} color={visual.color} />
                </View>
              )}

              <View style={styles.notificationInfo}>
                <View style={styles.notificationTitleRow}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  {!notification.isRead ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>{notification.createdAt}</Text>
              </View>

              {notification.postId || notification.profileId ? (
                <Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceMuted} />
              ) : null}
            </TouchableOpacity>
          );
        })}

        {visibleNotifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle" size={46} color={Colors.primaryDark} />
            <Text style={styles.emptyTitle}>Không còn thông báo chưa đọc</Text>
            <Text style={styles.emptyDescription}>
              Các lượt thích, bình luận và cảnh báo mới sẽ xuất hiện tại đây.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setFilter("ALL")}>
              <Text style={styles.primaryButtonText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  headerTextBlock: { flex: 1 },
  headerEyebrow: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 17, fontWeight: "900" },
  readAllButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  readAllButtonDisabled: { backgroundColor: Colors.surfaceContainerLow },
  readAllButtonText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" },
  readAllButtonTextDisabled: { color: Colors.onSurfaceMuted },
  summaryCard: {
    margin: 14,
    marginBottom: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: Radius.xl,
    backgroundColor: Colors.inkDeep,
    ...Shadows.card,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDark,
  },
  summaryInfo: { flex: 1 },
  summaryTitle: { color: Colors.onPrimaryDark, fontSize: 12, fontWeight: "900" },
  summaryText: { marginTop: 4, color: "#D9E8CF", fontSize: 8, lineHeight: 12 },
  filterRow: { paddingHorizontal: 14, paddingBottom: 10, flexDirection: "row", gap: 8 },
  filterButton: {
    minHeight: 36,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  filterButtonSelected: { backgroundColor: Colors.primaryContainer },
  filterButtonText: { color: Colors.onSurfaceVariant, fontSize: 9, fontWeight: "800" },
  filterButtonTextSelected: { color: Colors.ink },
  content: { paddingHorizontal: 14, paddingBottom: 36 },
  notificationCard: {
    marginBottom: 9,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  notificationCardUnread: {
    borderColor: Colors.primaryNeutral,
    backgroundColor: Colors.primaryPale,
    ...Shadows.card,
  },
  actorAvatar: { width: 46, height: 46, borderRadius: Radius.full },
  typeIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: Radius.full },
  notificationInfo: { flex: 1 },
  notificationTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  notificationTitle: { flex: 1, color: Colors.onSurface, fontSize: 11, fontWeight: "900" },
  unreadDot: { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  notificationMessage: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 9, lineHeight: 14 },
  notificationTime: { marginTop: 6, color: Colors.onSurfaceMuted, fontSize: 8, fontWeight: "700" },
  emptyCard: { marginTop: 30, padding: 30, alignItems: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLow },
  emptyTitle: { marginTop: 10, color: Colors.onSurface, fontSize: 14, fontWeight: "900" },
  emptyDescription: { marginTop: 6, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 15, textAlign: "center" },
  primaryButton: { minHeight: 40, marginTop: 15, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 9, fontWeight: "900" },
});
