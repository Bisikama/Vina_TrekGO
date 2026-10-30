import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

type SearchFilter = "ALL" | "PEOPLE" | "POSTS" | "TRAILS";

const filters: { value: SearchFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "PEOPLE", label: "Mọi người" },
  { value: "POSTS", label: "Bài viết" },
  { value: "TRAILS", label: "Cung đường" },
];

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("vi-VN");
}

export default function CommunitySearchScreen() {
  const router = useRouter();
  const {
    user,
    trails,
    communityPosts,
    communityProfiles,
    toggleCommunityFollow,
  } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("ALL");

  const keyword = normalize(query);

  const profileResults = useMemo(() => {
    const candidates = communityProfiles.filter((profile) => profile.id !== user.id);

    if (!keyword) {
      return candidates;
    }

    return candidates.filter((profile) =>
      normalize(
        `${profile.name} ${profile.bio} ${profile.location} ${profile.badge ?? ""} ${profile.specialties.join(" ")}`,
      ).includes(keyword),
    );
  }, [communityProfiles, keyword, user.id]);

  const postResults = useMemo(() => {
    if (!keyword) {
      return communityPosts.slice(0, 3);
    }

    return communityPosts.filter((post) =>
      normalize(
        `${post.content} ${post.author.name} ${post.location ?? ""} ${post.trailName ?? ""} ${post.tags.join(" ")}`,
      ).includes(keyword),
    );
  }, [communityPosts, keyword]);

  const trailResults = useMemo(() => {
    if (!keyword) {
      return trails.slice(0, 3);
    }

    return trails.filter((trail) =>
      normalize(
        `${trail.name} ${trail.region} ${trail.difficulty} ${trail.terrainType}`,
      ).includes(keyword),
    );
  }, [keyword, trails]);

  const showPeople = filter === "ALL" || filter === "PEOPLE";
  const showPosts = filter === "ALL" || filter === "POSTS";
  const showTrails = filter === "ALL" || filter === "TRAILS";
  const totalResults =
    (showPeople ? profileResults.length : 0) +
    (showPosts ? postResults.length : 0) +
    (showTrails ? trailResults.length : 0);

  function openProfile(userId: string) {
    router.push({
      pathname: "/community/profiles/[userId]",
      params: { userId },
    } as unknown as Href);
  }

  function openPost(postId: string) {
    router.push({
      pathname: "/community/posts/[postId]",
      params: { postId },
    } as unknown as Href);
  }

  function openTrail() {
    router.push("/(tabs)/explore" as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>COMMUNITY</Text>
          <Text style={styles.headerTitle}>Tìm kiếm & Khám phá</Text>
        </View>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={19} color={Colors.primaryDark} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tên người, bài viết hoặc cung đường..."
            placeholderTextColor={Colors.onSurfaceMuted}
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={19} color={Colors.onSurfaceMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((item) => {
            const selected = item.value === filter;
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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.resultSummary}>
          <Text style={styles.resultSummaryTitle}>
            {keyword ? `Kết quả cho “${query.trim()}”` : "Gợi ý nổi bật"}
          </Text>
          <Text style={styles.resultSummaryText}>{totalResults} kết quả</Text>
        </View>

        {showPeople && profileResults.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle icon="people" title="Mọi người" />
            {profileResults.map((profile) => (
              <View key={profile.id} style={styles.personCard}>
                <TouchableOpacity
                  style={styles.personMain}
                  onPress={() => openProfile(profile.id)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: profile.avatar }} style={styles.avatar} />
                  <View style={styles.personInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.personName}>{profile.name}</Text>
                      {profile.verified ? (
                        <Ionicons name="checkmark-circle" size={15} color={Colors.primaryDark} />
                      ) : null}
                    </View>
                    <Text style={styles.personMeta} numberOfLines={1}>
                      {profile.badge} · {profile.location}
                    </Text>
                    <Text style={styles.personBio} numberOfLines={2}>
                      {profile.bio}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    profile.isFollowing && styles.followingButton,
                  ]}
                  onPress={() => toggleCommunityFollow(profile.id)}
                >
                  <Text
                    style={[
                      styles.followButtonText,
                      profile.isFollowing && styles.followingButtonText,
                    ]}
                  >
                    {profile.isFollowing ? "Đang theo dõi" : "Theo dõi"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {showPosts && postResults.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle icon="newspaper" title="Bài viết" />
            {postResults.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.postCard}
                onPress={() => openPost(post.id)}
                activeOpacity={0.86}
              >
                <Image source={{ uri: post.author.avatar }} style={styles.postAvatar} />
                <View style={styles.postInfo}>
                  <Text style={styles.postAuthor}>{post.author.name}</Text>
                  <Text style={styles.postContent} numberOfLines={3}>
                    {post.content}
                  </Text>
                  <Text style={styles.postMeta}>
                    {post.likesCount} lượt thích · {post.commentsCount} bình luận
                  </Text>
                </View>
                {post.imageUrl ? (
                  <Image source={{ uri: post.imageUrl }} style={styles.postThumbnail} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {showTrails && trailResults.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle icon="trail-sign" title="Cung đường" />
            {trailResults.map((trail) => (
              <TouchableOpacity
                key={trail.id}
                style={styles.trailCard}
                onPress={openTrail}
                activeOpacity={0.86}
              >
                <Image source={{ uri: trail.imageUrl }} style={styles.trailImage} />
                <View style={styles.trailInfo}>
                  <Text style={styles.trailName}>{trail.name}</Text>
                  <Text style={styles.trailRegion}>{trail.region}</Text>
                  <View style={styles.trailMetaRow}>
                    <Text style={styles.trailMeta}>{trail.difficulty}</Text>
                    <Text style={styles.trailMeta}>{trail.distanceKm} km</Text>
                    <Text style={styles.trailMeta}>★ {trail.rating}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.onSurfaceMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {totalResults === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={42} color={Colors.primaryDark} />
            <Text style={styles.emptyTitle}>Chưa tìm thấy kết quả</Text>
            <Text style={styles.emptyDescription}>
              Thử tên khác, địa điểm khác hoặc đổi bộ lọc tìm kiếm.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={18} color={Colors.primaryDark} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
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
  searchSection: { paddingHorizontal: 14, paddingTop: 12 },
  searchInputWrap: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  searchInput: { flex: 1, color: Colors.onSurface, fontSize: 12 },
  filterRow: { paddingVertical: 12, gap: 8 },
  filterPill: {
    minHeight: 36,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  filterPillSelected: { backgroundColor: Colors.primaryContainer },
  filterPillText: { color: Colors.onSurfaceVariant, fontSize: 10, fontWeight: "800" },
  filterPillTextSelected: { color: Colors.ink },
  content: { paddingHorizontal: 14, paddingBottom: 40 },
  resultSummary: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultSummaryTitle: { color: Colors.onSurface, fontSize: 14, fontWeight: "900" },
  resultSummaryText: { color: Colors.onSurfaceMuted, fontSize: 9 },
  section: { marginBottom: 20 },
  sectionTitleRow: { marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  sectionTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "900" },
  personCard: {
    marginBottom: 9,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  personMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 50, height: 50, borderRadius: Radius.full },
  personInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  personName: { color: Colors.onSurface, fontSize: 12, fontWeight: "900" },
  personMeta: { marginTop: 2, color: Colors.primaryDark, fontSize: 8, fontWeight: "700" },
  personBio: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 9, lineHeight: 13 },
  followButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  followingButton: { borderWidth: 1, borderColor: Colors.primaryDark, backgroundColor: Colors.surface },
  followButtonText: { color: Colors.onPrimaryDark, fontSize: 8, fontWeight: "900" },
  followingButtonText: { color: Colors.primaryDark },
  postCard: {
    marginBottom: 9,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  postAvatar: { width: 38, height: 38, borderRadius: Radius.full },
  postInfo: { flex: 1 },
  postAuthor: { color: Colors.onSurface, fontSize: 10, fontWeight: "900" },
  postContent: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 15 },
  postMeta: { marginTop: 6, color: Colors.onSurfaceMuted, fontSize: 8 },
  postThumbnail: { width: 68, height: 68, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainer },
  trailCard: {
    marginBottom: 9,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  trailImage: { width: 76, height: 68, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainer },
  trailInfo: { flex: 1 },
  trailName: { color: Colors.onSurface, fontSize: 11, fontWeight: "900" },
  trailRegion: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 8 },
  trailMetaRow: { marginTop: 7, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  trailMeta: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    color: Colors.primaryDark,
    fontSize: 7,
    fontWeight: "800",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  emptyCard: {
    marginTop: 32,
    padding: 30,
    alignItems: "center",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLow,
  },
  emptyTitle: { marginTop: 10, color: Colors.onSurface, fontSize: 14, fontWeight: "900" },
  emptyDescription: { marginTop: 5, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 15, textAlign: "center" },
});
