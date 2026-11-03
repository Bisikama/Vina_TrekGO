import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

export default function CommunityPostDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postId = Array.isArray(params.postId)
    ? params.postId[0]
    : params.postId;
  const {
    communityPosts,
    toggleCommunityPostLike,
    toggleCommunityPostSaved,
    addCommunityComment,
  } = useApp();
  const [comment, setComment] = useState("");

  const post = useMemo(
    () => communityPosts.find((current) => current.id === postId),
    [communityPosts, postId],
  );

  function submitComment() {
    if (!post || !comment.trim()) {
      return;
    }

    addCommunityComment(post.id, comment);
    setComment("");
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết bài viết" onBack={router.back} />
        <View style={styles.emptyState}>
          <Ionicons name="newspaper-outline" size={44} color={Colors.primaryDark} />
          <Text style={styles.emptyTitle}>Không tìm thấy bài viết</Text>
          <Text style={styles.emptyDescription}>
            Bài viết có thể đã bị xóa hoặc mock data đã được reset.
          </Text>
          <TouchableOpacity
            style={styles.backToFeedButton}
            onPress={() => router.replace("/(tabs)/community" as Href)}
          >
            <Text style={styles.backToFeedButtonText}>Về Community</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Header title="Chi tiết bài viết" onBack={router.back} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <CommunityPostCard
            post={post}
            onOpen={() => undefined}
            onLike={() => toggleCommunityPostLike(post.id)}
            onSave={() => toggleCommunityPostSaved(post.id)}
            onReport={() =>
              router.push({
                pathname: "/community/posts/[postId]/report",
                params: { postId: post.id },
              } as unknown as Href)
            }
          />

          <View style={styles.commentSection}>
            <View style={styles.commentHeader}>
              <View>
                <Text style={styles.commentTitle}>Bình luận</Text>
                <Text style={styles.commentSubtitle}>
                  {post.comments.length} phản hồi trong bản demo
                </Text>
              </View>
              <Ionicons
                name="chatbubbles-outline"
                size={22}
                color={Colors.primaryDark}
              />
            </View>

            {post.comments.map((item) => (
              <View key={item.id} style={styles.commentRow}>
                <Image source={{ uri: item.author.avatar }} style={styles.commentAvatar} />
                <View style={styles.commentBubble}>
                  <View style={styles.commentAuthorRow}>
                    <Text style={styles.commentAuthor}>{item.author.name}</Text>
                    {item.author.verified ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={Colors.primaryDark}
                      />
                    ) : null}
                    <Text style={styles.commentTime}>{item.createdAt}</Text>
                  </View>
                  <Text style={styles.commentContent}>{item.content}</Text>
                </View>
              </View>
            ))}

            {post.comments.length === 0 ? (
              <View style={styles.noCommentCard}>
                <Text style={styles.noCommentText}>
                  Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.commentComposer}>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Viết bình luận..."
            placeholderTextColor={Colors.onSurfaceMuted}
            returnKeyType="send"
            onSubmitEditing={submitComment}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !comment.trim() && styles.sendButtonDisabled,
            ]}
            onPress={submitComment}
            disabled={!comment.trim()}
          >
            <Ionicons name="send" size={18} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.headerBar}>
      <TouchableOpacity style={styles.headerButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  headerBar: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
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
  headerTitle: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  headerSpacer: { width: 40 },
  scrollContent: { paddingTop: 13, paddingBottom: 24 },
  commentSection: {
    marginHorizontal: 14,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  commentHeader: {
    marginBottom: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentTitle: { color: Colors.onSurface, fontSize: 15, fontWeight: "900" },
  commentSubtitle: { marginTop: 2, color: Colors.onSurfaceMuted, fontSize: 9 },
  commentRow: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  commentAvatar: { width: 34, height: 34, borderRadius: Radius.full },
  commentBubble: {
    flex: 1,
    padding: 10,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
  },
  commentAuthorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  commentAuthor: { color: Colors.onSurface, fontSize: 10, fontWeight: "900" },
  commentTime: { marginLeft: "auto", color: Colors.onSurfaceMuted, fontSize: 8 },
  commentContent: {
    marginTop: 5,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    lineHeight: 15,
  },
  noCommentCard: {
    padding: 18,
    alignItems: "center",
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
  },
  noCommentText: { color: Colors.onSurfaceMuted, fontSize: 10 },
  commentComposer: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    backgroundColor: Colors.surface,
  },
  commentInput: {
    flex: 1,
    minHeight: 45,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    color: Colors.onSurface,
    fontSize: 11,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  sendButtonDisabled: { opacity: 0.4 },
  emptyState: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    color: Colors.onSurface,
    fontSize: 17,
    fontWeight: "900",
  },
  emptyDescription: {
    marginTop: 6,
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
  backToFeedButton: {
    minHeight: 48,
    marginTop: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  backToFeedButtonText: { color: Colors.onPrimary, fontSize: 11, fontWeight: "900" },
});
