import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { CommunityPost } from "@/types";

export function CommunityPostCard({
  post,
  onOpen,
  onOpenAuthor,
  onLike,
  onSave,
  onReport,
}: {
  post: CommunityPost;
  onOpen: () => void;
  onOpenAuthor?: () => void;
  onLike: () => void;
  onSave: () => void;
  onReport: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.authorRow}>
        <TouchableOpacity onPress={onOpenAuthor ?? onOpen} activeOpacity={0.85}>
          <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.authorInfo}
          onPress={onOpenAuthor ?? onOpen}
        >
          <View style={styles.authorNameRow}>
            <Text style={styles.authorName}>{post.author.name}</Text>
            {post.author.verified ? (
              <Ionicons
                name="checkmark-circle"
                size={15}
                color={Colors.primaryDark}
              />
            ) : null}
            <View
              style={[
                styles.roleBadge,
                post.author.role === "LEADER" && styles.leaderRoleBadge,
              ]}
            >
              <Text style={styles.roleBadgeText}>{post.author.role}</Text>
            </View>
          </View>

          <Text style={styles.authorMeta}>
            {post.createdAt}
            {post.location ? ` · ${post.location}` : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreButton} onPress={onReport}>
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={Colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onOpen} activeOpacity={0.9}>
        <Text style={styles.content}>{post.content}</Text>

        {post.trailName ? (
          <View style={styles.trailChip}>
            <Ionicons name="trail-sign" size={14} color={Colors.primaryDark} />
            <Text style={styles.trailChipText}>{post.trailName}</Text>
          </View>
        ) : null}

        {post.imageUrl ? (
          <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
        ) : null}

        {post.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {post.tags.map((tag) => (
              <Text key={tag} style={styles.tagText}>
                #{tag.replaceAll(" ", "")}
              </Text>
            ))}
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.statRow}>
        <Text style={styles.statText}>{post.likesCount} lượt thích</Text>
        <Text style={styles.statText}>{post.commentsCount} bình luận</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={onLike}>
          <Ionicons
            name={post.isLiked ? "heart" : "heart-outline"}
            size={20}
            color={post.isLiked ? Colors.error : Colors.onSurfaceVariant}
          />
          <Text
            style={[
              styles.actionText,
              post.isLiked && styles.likedActionText,
            ]}
          >
            Thích
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onOpen}>
          <Ionicons
            name="chatbubble-outline"
            size={19}
            color={Colors.onSurfaceVariant}
          />
          <Text style={styles.actionText}>Bình luận</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onSave}>
          <Ionicons
            name={post.isSaved ? "bookmark" : "bookmark-outline"}
            size={19}
            color={post.isSaved ? Colors.primaryDark : Colors.onSurfaceVariant}
          />
          <Text style={styles.actionText}>Lưu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginBottom: 13,
    overflow: "hidden",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  authorRow: {
    padding: 13,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  avatar: {
    width: 42,
    height: 42,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.full,
  },
  authorInfo: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  authorName: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: "900",
  },
  authorMeta: {
    marginTop: 3,
    color: Colors.onSurfaceMuted,
    fontSize: 9,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  leaderRoleBadge: {
    backgroundColor: Colors.primaryPale,
  },
  roleBadgeText: {
    color: Colors.onSurfaceVariant,
    fontSize: 7,
    fontWeight: "900",
  },
  moreButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },
  content: {
    paddingHorizontal: 13,
    color: Colors.onSurface,
    fontSize: 12,
    lineHeight: 18,
  },
  trailChip: {
    alignSelf: "flex-start",
    marginHorizontal: 13,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  trailChipText: {
    color: Colors.primaryDark,
    fontSize: 9,
    fontWeight: "800",
  },
  postImage: {
    width: "100%",
    height: 230,
    marginTop: 12,
    backgroundColor: Colors.surfaceContainer,
  },
  tagRow: {
    paddingHorizontal: 13,
    paddingTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  tagText: {
    color: Colors.primaryDark,
    fontSize: 9,
    fontWeight: "800",
  },
  statRow: {
    marginHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  statText: {
    color: Colors.onSurfaceMuted,
    fontSize: 9,
  },
  actionRow: {
    minHeight: 47,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionText: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: "800",
  },
  likedActionText: {
    color: Colors.error,
  },
});
