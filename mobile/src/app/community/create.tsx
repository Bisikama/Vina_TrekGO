import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
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

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";

const suggestedTags = [
  "Review chuyến đi",
  "Cảnh báo",
  "Kinh nghiệm",
  "Trang bị",
  "Thời tiết",
  "Tân binh",
];

const demoImages = [
  {
    label: "Sống núi",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    label: "Rừng xanh",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function CommunityCreatePostScreen() {
  const router = useRouter();
  const { user, createCommunityPost } = useApp();
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [trailName, setTrailName] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag].slice(0, 3),
    );
  }

  function publishPost() {
    if (content.trim().length < 10) {
      Alert.alert(
        "Nội dung quá ngắn",
        "Hãy nhập ít nhất 10 ký tự trước khi đăng bài.",
      );
      return;
    }

    const post = createCommunityPost({
      content,
      location,
      trailName,
      imageUrl,
      tags: selectedTags,
    });

    Alert.alert(
      "Đăng bài thành công",
      "Bài viết đã xuất hiện trên bảng tin Community mock.",
      [
        {
          text: "Xem bài viết",
          onPress: () =>
            router.replace({
              pathname: "/community/posts/[postId]",
              params: { postId: post.id },
            } as unknown as Href),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="close" size={23} color={Colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Tạo bài viết</Text>
            <Text style={styles.headerSubtitle}>Chia sẻ với TrekGo Community</Text>
          </View>
          <TouchableOpacity style={styles.publishTopButton} onPress={publishPost}>
            <Text style={styles.publishTopButtonText}>Đăng</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.authorRow}>
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
            <View style={styles.flexOne}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>{user.name}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{user.role}</Text>
                </View>
              </View>
              <Text style={styles.visibilityText}>
                <Ionicons name="earth" size={11} /> Công khai trong Community
              </Text>
            </View>
          </View>

          <View style={styles.editorCard}>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              maxLength={1200}
              placeholder="Bạn muốn chia sẻ điều gì về hành trình trekking?"
              placeholderTextColor={Colors.onSurfaceMuted}
            />
            <Text style={styles.characterCount}>{content.length}/1200</Text>

            {imageUrl ? (
              <View style={styles.previewWrapper}>
                <Image source={{ uri: imageUrl }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImageUrl(undefined)}
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="image-outline" size={20} color={Colors.primaryDark} />
              <View style={styles.flexOne}>
                <Text style={styles.sectionTitle}>Ảnh minh họa demo</Text>
                <Text style={styles.sectionSubtitle}>
                  Sau này thay bằng Media API hoặc thư viện ảnh thiết bị
                </Text>
              </View>
            </View>

            <View style={styles.imageOptionRow}>
              {demoImages.map((image) => {
                const selected = imageUrl === image.url;

                return (
                  <TouchableOpacity
                    key={image.url}
                    style={[
                      styles.imageOption,
                      selected && styles.imageOptionSelected,
                    ]}
                    onPress={() => setImageUrl(image.url)}
                  >
                    <Image source={{ uri: image.url }} style={styles.imageOptionPhoto} />
                    <View style={styles.imageOptionFooter}>
                      <Text style={styles.imageOptionText}>{image.label}</Text>
                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={17}
                          color={Colors.primaryDark}
                        />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={20} color={Colors.primaryDark} />
              <Text style={styles.sectionTitle}>Thông tin hành trình</Text>
            </View>

            <Text style={styles.fieldLabel}>Địa điểm</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Ví dụ: Đỉnh Pinhatt, Lâm Đồng"
              placeholderTextColor={Colors.onSurfaceMuted}
            />

            <Text style={styles.fieldLabel}>Trail liên quan</Text>
            <TextInput
              style={styles.input}
              value={trailName}
              onChangeText={setTrailName}
              placeholder="Tên cung đường hoặc chuyến đi"
              placeholderTextColor={Colors.onSurfaceMuted}
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetags-outline" size={20} color={Colors.primaryDark} />
              <View style={styles.flexOne}>
                <Text style={styles.sectionTitle}>Chủ đề bài viết</Text>
                <Text style={styles.sectionSubtitle}>Chọn tối đa 3 chủ đề</Text>
              </View>
            </View>

            <View style={styles.tagWrap}>
              {suggestedTags.map((tag) => {
                const selected = selectedTags.includes(tag);

                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagPill, selected && styles.tagPillSelected]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text
                      style={[
                        styles.tagPillText,
                        selected && styles.tagPillTextSelected,
                      ]}
                    >
                      #{tag.replaceAll(" ", "")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.safetyNotice}>
            <Ionicons name="shield-checkmark-outline" size={21} color="#725C00" />
            <Text style={styles.safetyNoticeText}>
              Không đăng tọa độ nguy hiểm chưa kiểm chứng, thông tin cứu hộ sai
              lệch hoặc nội dung có thể khiến người khác đi lệch tuyến.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.publishButton}
            onPress={publishPost}
            activeOpacity={0.86}
          >
            <Ionicons name="send" size={19} color={Colors.onPrimary} />
            <Text style={styles.publishButtonText}>Đăng lên Community</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  headerTitleBox: { flex: 1, alignItems: "center" },
  headerTitle: { color: Colors.onSurface, fontSize: 15, fontWeight: "900" },
  headerSubtitle: { marginTop: 2, color: Colors.onSurfaceMuted, fontSize: 8 },
  publishTopButton: {
    minWidth: 55,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryContainer,
  },
  publishTopButtonText: { color: Colors.ink, fontSize: 11, fontWeight: "900" },
  scrollContent: { padding: 14, paddingBottom: 42 },
  authorRow: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: Radius.full },
  authorNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorName: { color: Colors.onSurface, fontSize: 13, fontWeight: "900" },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryPale,
  },
  roleBadgeText: { color: Colors.primaryDark, fontSize: 8, fontWeight: "900" },
  visibilityText: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 9 },
  editorCard: {
    marginBottom: 13,
    padding: 13,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  contentInput: {
    minHeight: 150,
    color: Colors.onSurface,
    fontSize: 13,
    lineHeight: 20,
  },
  characterCount: {
    alignSelf: "flex-end",
    color: Colors.onSurfaceMuted,
    fontSize: 9,
  },
  previewWrapper: {
    height: 220,
    marginTop: 12,
    overflow: "hidden",
    borderRadius: Radius.lg,
  },
  previewImage: { width: "100%", height: "100%" },
  removeImageButton: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sectionCard: {
    marginBottom: 13,
    padding: 13,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  sectionHeader: {
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: { color: Colors.onSurface, fontSize: 12, fontWeight: "900" },
  sectionSubtitle: { marginTop: 2, color: Colors.onSurfaceMuted, fontSize: 8 },
  imageOptionRow: { flexDirection: "row", gap: 9 },
  imageOption: {
    flex: 1,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
  },
  imageOptionSelected: { borderColor: Colors.primaryDark },
  imageOptionPhoto: { width: "100%", height: 95 },
  imageOptionFooter: {
    minHeight: 36,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  imageOptionText: { color: Colors.onSurface, fontSize: 9, fontWeight: "800" },
  fieldLabel: {
    marginTop: 8,
    marginBottom: 5,
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: "800",
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    color: Colors.onSurface,
    fontSize: 10,
  },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tagPill: {
    minHeight: 36,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  tagPillSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryPale,
  },
  tagPillText: { color: Colors.onSurfaceVariant, fontSize: 9, fontWeight: "700" },
  tagPillTextSelected: { color: Colors.primaryDark, fontWeight: "900" },
  safetyNotice: {
    marginBottom: 13,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: Radius.lg,
    backgroundColor: "#FFF7D6",
  },
  safetyNoticeText: { flex: 1, color: "#725C00", fontSize: 9, lineHeight: 14 },
  publishButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    ...Shadows.card,
  },
  publishButtonText: { color: Colors.onPrimary, fontSize: 12, fontWeight: "900" },
});
