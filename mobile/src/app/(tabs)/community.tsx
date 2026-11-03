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

import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { TopHeader } from "@/components/TopHeader";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

type FeedFilter = "FOR_YOU" | "FOLLOWING" | "SAFETY";

const filters: {
  value: FeedFilter;
  label: string;
}[] = [
  { value: "FOR_YOU", label: "Dành cho bạn" },
  { value: "FOLLOWING", label: "Đang theo dõi" },
  { value: "SAFETY", label: "An toàn tuyến" },
];

export default function CommunityFeedScreen() {
  const router = useRouter();
  const {
    user,
    communityPosts,
    communityProfiles,
    communityNotifications,
    toggleCommunityPostLike,
    toggleCommunityPostSaved,
  } = useApp();
  const [filter, setFilter] = useState<FeedFilter>("FOR_YOU");

  const visiblePosts = useMemo(() => {
    if (filter === "FOLLOWING") {
      const followedProfileIds = new Set(
        communityProfiles
          .filter((profile) => profile.isFollowing)
          .map((profile) => profile.id),
      );

      return communityPosts.filter(
        (post) => followedProfileIds.has(post.author.id) || post.author.id === user.id,
      );
    }

    if (filter === "SAFETY") {
      return communityPosts.filter((post) =>
        post.tags.some((tag) =>
          ["Cảnh báo", "Thời tiết", "Kinh nghiệm", "Checklist"].includes(tag),
        ),
      );
    }

    return communityPosts;
  }, [communityPosts, communityProfiles, filter, user.id]);

  const unreadNotificationsCount = communityNotifications.filter(
    (notification) => !notification.isRead,
  ).length;

  function openPost(postId: string) {
    router.push({
      pathname: "/community/posts/[postId]",
      params: { postId },
    } as unknown as Href);
  }

  function reportPost(postId: string) {
    router.push({
      pathname: "/community/posts/[postId]/report",
      params: { postId },
    } as unknown as Href);
  }

  function openProfile(userId: string) {
    router.push({
      pathname: "/community/profiles/[userId]",
      params: { userId },
    } as unknown as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopHeader subtitle="Community" />

      <View style={styles.quickActionRow}>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => router.push("/community/search" as Href)}
          activeOpacity={0.85}
        >
          <Ionicons name="search" size={18} color={Colors.primaryDark} />
          <Text style={styles.searchButtonText}>Tìm người, bài viết, cung đường</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push("/community/notifications" as Href)}
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-outline" size={21} color={Colors.primaryDark} />
          {unreadNotificationsCount > 0 ? (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadNotificationsCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="people" size={26} color={Colors.onPrimary} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.heroEyebrow}>TREKGO COMMUNITY</Text>
            <Text style={styles.heroTitle}>Chia sẻ hành trình, đi rừng an toàn</Text>
            <Text style={styles.heroDescription}>
              Cập nhật tuyến đường, thời tiết và kinh nghiệm thực tế từ cộng
              đồng Trekker và Leader.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.composerCard}
          onPress={() => router.push("/community/create" as Href)}
          activeOpacity={0.88}
        >
          <Image source={{ uri: user.avatar }} style={styles.composerAvatar} />
          <View style={styles.composerInput}>
            <Text style={styles.composerPlaceholder}>
              Chia sẻ hành trình hoặc cảnh báo tuyến...
            </Text>
          </View>
          <View style={styles.composerAction}>
            <Ionicons name="image-outline" size={20} color={Colors.primaryDark} />
          </View>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((item) => {
            const selected = filter === item.value;

            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.filterPill, selected && styles.filterPillSelected]}
                onPress={() => setFilter(item.value)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selected && styles.filterPillTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Bảng tin cộng đồng</Text>
            <Text style={styles.sectionSubtitle}>
              {visiblePosts.length} bài viết trong bản demo
            </Text>
          </View>
          <Ionicons name="newspaper-outline" size={20} color={Colors.primaryDark} />
        </View>

        {visiblePosts.map((post) => (
          <CommunityPostCard
            key={post.id}
            post={post}
            onOpen={() => openPost(post.id)}
            onOpenAuthor={() => openProfile(post.author.id)}
            onLike={() => toggleCommunityPostLike(post.id)}
            onSave={() => toggleCommunityPostSaved(post.id)}
            onReport={() => reportPost(post.id)}
          />
        ))}

        {visiblePosts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="chatbubbles-outline"
              size={38}
              color={Colors.primaryDark}
            />
            <Text style={styles.emptyTitle}>Chưa có bài viết phù hợp</Text>
            <Text style={styles.emptyDescription}>
              Hãy đổi bộ lọc hoặc tạo bài viết đầu tiên trong chủ đề này.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => router.push("/community/create" as Href)}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={26} color={Colors.onPrimary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 96,
  },
  quickActionRow: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: Colors.surface,
  },
  searchButton: {
    flex: 1,
    minHeight: 43,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  searchButtonText: {
    flex: 1,
    color: Colors.onSurfaceMuted,
    fontSize: 10,
  },
  notificationButton: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  notificationBadge: {
    position: "absolute",
    top: -3,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.surface,
    borderRadius: Radius.full,
    backgroundColor: Colors.error,
  },
  notificationBadgeText: {
    color: Colors.onPrimary,
    fontSize: 8,
    fontWeight: "900",
  },
  heroCard: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: Radius.xl,
    backgroundColor: Colors.inkDeep,
    ...Shadows.card,
  },
  heroIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDark,
  },
  heroEyebrow: {
    color: Colors.primary,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  heroTitle: {
    marginTop: 4,
    color: Colors.onPrimaryDark,
    fontSize: 15,
    fontWeight: "900",
  },
  heroDescription: {
    marginTop: 5,
    color: "#D9E8CF",
    fontSize: 9,
    lineHeight: 14,
  },
  composerCard: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  composerAvatar: {
    width: 39,
    height: 39,
    borderRadius: Radius.full,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  composerPlaceholder: {
    color: Colors.onSurfaceMuted,
    fontSize: 10,
  },
  composerAction: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  filterRow: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  filterPill: {
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  filterPillSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryContainer,
  },
  filterPillText: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: "800",
  },
  filterPillTextSelected: {
    color: Colors.ink,
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: 2,
    color: Colors.onSurfaceMuted,
    fontSize: 9,
  },
  floatingButton: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    ...Shadows.hover,
  },
  emptyCard: {
    marginHorizontal: 14,
    padding: 28,
    alignItems: "center",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLow,
  },
  emptyTitle: {
    marginTop: 10,
    color: Colors.onSurface,
    fontSize: 14,
    fontWeight: "900",
  },
  emptyDescription: {
    marginTop: 5,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
});
