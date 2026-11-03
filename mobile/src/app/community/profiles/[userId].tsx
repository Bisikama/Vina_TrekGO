import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
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
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

function compactNumber(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  }

  return String(value);
}

export default function CommunityProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const {
    user,
    communityPosts,
    communityProfiles,
    toggleCommunityFollow,
    toggleCommunityPostLike,
    toggleCommunityPostSaved,
  } = useApp();

  const profile = useMemo(
    () => communityProfiles.find((current) => current.id === userId),
    [communityProfiles, userId],
  );
  const profilePosts = useMemo(
    () => communityPosts.filter((post) => post.author.id === userId),
    [communityPosts, userId],
  );

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

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.simpleHeader}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.simpleHeaderTitle}>Hồ sơ Community</Text>
        </View>
        <View style={styles.notFoundCard}>
          <Ionicons name="person-circle-outline" size={54} color={Colors.primaryDark} />
          <Text style={styles.notFoundTitle}>Không tìm thấy hồ sơ</Text>
          <Text style={styles.notFoundText}>Tài khoản này có thể đã được ẩn khỏi Community.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = profile.id === user.id;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.coverWrap}>
          <Image source={{ uri: profile.coverImage }} style={styles.coverImage} />
          <View style={styles.coverOverlay} />
          <View style={styles.coverHeader}>
            <TouchableOpacity style={styles.coverHeaderButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.coverHeaderTitle}>
              {profile.role === "LEADER" ? "Hồ sơ Leader" : "Hồ sơ Trekker"}
            </Text>
            <TouchableOpacity style={styles.coverHeaderButton}>
              <Ionicons name="ellipsis-horizontal" size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileCard}>
          <Image source={{ uri: profile.avatar }} style={styles.profileAvatar} />
          <View style={styles.profileNameRow}>
            <Text style={styles.profileName}>{profile.name}</Text>
            {profile.verified ? (
              <Ionicons name="checkmark-circle" size={19} color={Colors.primaryDark} />
            ) : null}
          </View>
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, profile.role === "LEADER" && styles.leaderBadge]}>
              <Ionicons
                name={profile.role === "LEADER" ? "shield-checkmark" : "footsteps"}
                size={12}
                color={Colors.primaryDark}
              />
              <Text style={styles.roleBadgeText}>{profile.badge}</Text>
            </View>
          </View>
          <Text style={styles.profileBio}>{profile.bio}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={Colors.onSurfaceMuted} />
            <Text style={styles.locationText}>{profile.location}</Text>
            <Text style={styles.locationDot}>•</Text>
            <Text style={styles.locationText}>{profile.joinedAt}</Text>
          </View>

          {isOwnProfile ? (
            <TouchableOpacity style={styles.outlineButton} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={16} color={Colors.primaryDark} />
              <Text style={styles.outlineButtonText}>Chỉnh sửa hồ sơ</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.followButton, profile.isFollowing && styles.followingButton]}
              onPress={() => toggleCommunityFollow(profile.id)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={profile.isFollowing ? "checkmark" : "person-add-outline"}
                size={16}
                color={profile.isFollowing ? Colors.primaryDark : Colors.onPrimaryDark}
              />
              <Text
                style={[
                  styles.followButtonText,
                  profile.isFollowing && styles.followingButtonText,
                ]}
              >
                {profile.isFollowing ? "Đang theo dõi" : "Theo dõi"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statGrid}>
          <StatItem value={compactNumber(profile.followersCount)} label="Người theo dõi" />
          <StatItem value={compactNumber(profile.followingCount)} label="Đang theo dõi" />
          <StatItem value={String(profile.completedTripsCount)} label="Chuyến hoàn thành" />
          <StatItem value={`${compactNumber(profile.totalDistanceKm)} km`} label="Quãng đường" />
        </View>

        <View style={styles.specialtyCard}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="ribbon-outline" size={18} color={Colors.primaryDark} />
            <Text style={styles.sectionTitle}>
              {profile.role === "LEADER" ? "Chuyên môn Leader" : "Sở thích trekking"}
            </Text>
          </View>
          <View style={styles.specialtyRow}>
            {profile.specialties.map((specialty) => (
              <View key={specialty} style={styles.specialtyChip}>
                <Text style={styles.specialtyText}>{specialty}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.postsHeader}>
          <View>
            <Text style={styles.postsTitle}>Bài viết Community</Text>
            <Text style={styles.postsSubtitle}>{profilePosts.length} bài viết đang hiển thị</Text>
          </View>
          <Ionicons name="grid-outline" size={19} color={Colors.primaryDark} />
        </View>

        {profilePosts.map((post) => (
          <CommunityPostCard
            key={post.id}
            post={post}
            onOpen={() => openPost(post.id)}
            onLike={() => toggleCommunityPostLike(post.id)}
            onSave={() => toggleCommunityPostSaved(post.id)}
            onReport={() => reportPost(post.id)}
          />
        ))}

        {profilePosts.length === 0 ? (
          <View style={styles.emptyPostsCard}>
            <Ionicons name="images-outline" size={38} color={Colors.primaryDark} />
            <Text style={styles.emptyPostsTitle}>Chưa có bài viết</Text>
            <Text style={styles.emptyPostsText}>Các chia sẻ công khai sẽ xuất hiện tại đây.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  scrollContent: { paddingBottom: 40 },
  simpleHeader: {
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
  simpleHeaderTitle: { color: Colors.onSurface, fontSize: 17, fontWeight: "900" },
  coverWrap: { height: 190, overflow: "hidden", backgroundColor: Colors.inkDeep },
  coverImage: { width: "100%", height: "100%" },
  coverOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(14, 31, 10, 0.35)" },
  coverHeader: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverHeaderButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: "rgba(14, 15, 12, 0.45)",
  },
  coverHeaderTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  profileCard: {
    marginTop: -42,
    marginHorizontal: 14,
    padding: 16,
    paddingTop: 48,
    alignItems: "center",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  profileAvatar: {
    position: "absolute",
    top: -42,
    width: 84,
    height: 84,
    borderWidth: 4,
    borderColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  profileNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  profileName: { color: Colors.onSurface, fontSize: 20, fontWeight: "900" },
  badgeRow: { marginTop: 7, flexDirection: "row", justifyContent: "center" },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  leaderBadge: { backgroundColor: Colors.primaryPale },
  roleBadgeText: { color: Colors.primaryDark, fontSize: 9, fontWeight: "900" },
  profileBio: { marginTop: 12, color: Colors.onSurfaceVariant, fontSize: 11, lineHeight: 17, textAlign: "center" },
  locationRow: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  locationText: { color: Colors.onSurfaceMuted, fontSize: 8 },
  locationDot: { color: Colors.onSurfaceMuted, fontSize: 8 },
  outlineButton: {
    width: "100%",
    minHeight: 42,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  outlineButtonText: { color: Colors.primaryDark, fontSize: 10, fontWeight: "900" },
  followButton: {
    width: "100%",
    minHeight: 42,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  followingButton: { borderWidth: 1, borderColor: Colors.primaryDark, backgroundColor: Colors.surface },
  followButtonText: { color: Colors.onPrimaryDark, fontSize: 10, fontWeight: "900" },
  followingButtonText: { color: Colors.primaryDark },
  statGrid: {
    marginHorizontal: 14,
    marginTop: 12,
    paddingVertical: 14,
    flexDirection: "row",
    borderRadius: Radius.xl,
    backgroundColor: Colors.inkDeep,
    ...Shadows.card,
  },
  statItem: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  statValue: { color: Colors.primary, fontSize: 14, fontWeight: "900" },
  statLabel: { marginTop: 4, color: "#D9E8CF", fontSize: 7, textAlign: "center" },
  specialtyCard: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionTitle: { color: Colors.onSurface, fontSize: 12, fontWeight: "900" },
  specialtyRow: { marginTop: 11, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  specialtyChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  specialtyText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "800" },
  postsHeader: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  postsTitle: { color: Colors.onSurface, fontSize: 15, fontWeight: "900" },
  postsSubtitle: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8 },
  emptyPostsCard: { marginHorizontal: 14, padding: 28, alignItems: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLow },
  emptyPostsTitle: { marginTop: 9, color: Colors.onSurface, fontSize: 13, fontWeight: "900" },
  emptyPostsText: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 9 },
  notFoundCard: { margin: 16, marginTop: 40, padding: 30, alignItems: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  notFoundTitle: { marginTop: 10, color: Colors.onSurface, fontSize: 15, fontWeight: "900" },
  notFoundText: { marginTop: 6, color: Colors.onSurfaceVariant, fontSize: 10, textAlign: "center" },
  primaryButton: { minHeight: 42, marginTop: 16, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  primaryButtonText: { color: Colors.onPrimaryDark, fontSize: 10, fontWeight: "900" },
});
