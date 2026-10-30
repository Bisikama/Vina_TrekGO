import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
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
import { CommunityReportReason } from "@/types";

const reasons: {
  value: CommunityReportReason;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: "DANGEROUS_INFORMATION",
    label: "Thông tin nguy hiểm",
    description: "Tọa độ, chỉ dẫn hoặc khuyến nghị có thể gây mất an toàn.",
    icon: "warning-outline",
  },
  {
    value: "MISINFORMATION",
    label: "Thông tin sai lệch",
    description: "Thông tin tuyến đường, thời tiết hoặc cứu hộ chưa chính xác.",
    icon: "help-circle-outline",
  },
  {
    value: "HARASSMENT",
    label: "Quấy rối hoặc xúc phạm",
    description: "Nội dung công kích, đe dọa hoặc gây tổn thương người khác.",
    icon: "person-remove-outline",
  },
  {
    value: "SPAM",
    label: "Spam hoặc quảng cáo",
    description: "Nội dung lặp lại, quảng cáo không liên quan Community.",
    icon: "megaphone-outline",
  },
  {
    value: "OTHER",
    label: "Lý do khác",
    description: "Vấn đề khác chưa có trong danh sách trên.",
    icon: "ellipsis-horizontal-circle-outline",
  },
];

export default function CommunityReportPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postId = Array.isArray(params.postId)
    ? params.postId[0]
    : params.postId;
  const { communityPosts, communityReports, reportCommunityPost } = useApp();
  const [reason, setReason] = useState<CommunityReportReason | undefined>();
  const [detail, setDetail] = useState("");

  const post = useMemo(
    () => communityPosts.find((current) => current.id === postId),
    [communityPosts, postId],
  );
  const alreadyReported = communityReports.some(
    (report) => report.postId === postId,
  );

  function submitReport() {
    if (!post || !reason) {
      Alert.alert("Chưa chọn lý do", "Hãy chọn một lý do trước khi gửi báo cáo.");
      return;
    }

    reportCommunityPost(post.id, reason, detail);
    Alert.alert(
      "Đã gửi báo cáo",
      "Báo cáo đã được ghi nhận. Việc duyệt và xử lý thuộc Admin Web; User Mobile không có moderation queue.",
      [
        {
          text: "Về Community",
          onPress: () => router.replace("/(tabs)/community" as Href),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Báo cáo nội dung</Text>
          <Text style={styles.headerSubtitle}>Giúp Community an toàn hơn</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {!post ? (
          <View style={styles.messageCard}>
            <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
            <Text style={styles.messageTitle}>Không tìm thấy bài viết</Text>
            <Text style={styles.messageDescription}>
              Bài viết có thể đã bị xóa hoặc mock state đã reset.
            </Text>
          </View>
        ) : alreadyReported ? (
          <View style={styles.messageCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={42}
              color={Colors.primaryDark}
            />
            <Text style={styles.messageTitle}>Bạn đã báo cáo bài viết này</Text>
            <Text style={styles.messageDescription}>
              Báo cáo đã được lưu trong phiên hiện tại. Không cần gửi lại nhiều lần.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace("/(tabs)/community" as Href)}
            >
              <Text style={styles.primaryButtonText}>Về Community</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.postPreview}>
              <Text style={styles.previewLabel}>BÀI VIẾT ĐƯỢC BÁO CÁO</Text>
              <Text style={styles.previewAuthor}>{post.author.name}</Text>
              <Text style={styles.previewContent} numberOfLines={4}>
                {post.content}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Vấn đề của bài viết là gì?</Text>
              <Text style={styles.sectionDescription}>
                Chọn lý do phù hợp nhất. Người đăng sẽ không biết ai đã báo cáo.
              </Text>

              <View style={styles.reasonList}>
                {reasons.map((item) => {
                  const selected = reason === item.value;

                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.reasonCard,
                        selected && styles.reasonCardSelected,
                      ]}
                      onPress={() => setReason(item.value)}
                    >
                      <View
                        style={[
                          styles.reasonIcon,
                          selected && styles.reasonIconSelected,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={20}
                          color={selected ? Colors.onPrimary : Colors.primaryDark}
                        />
                      </View>
                      <View style={styles.flexOne}>
                        <Text style={styles.reasonLabel}>{item.label}</Text>
                        <Text style={styles.reasonDescription}>
                          {item.description}
                        </Text>
                      </View>
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={21}
                        color={
                          selected ? Colors.primaryDark : Colors.onSurfaceMuted
                        }
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Mô tả thêm</Text>
              <Text style={styles.sectionDescription}>
                Không bắt buộc, nhưng sẽ giúp Admin hiểu vấn đề nhanh hơn.
              </Text>
              <TextInput
                style={styles.detailInput}
                value={detail}
                onChangeText={setDetail}
                multiline
                maxLength={500}
                textAlignVertical="top"
                placeholder="Nhập chi tiết bạn quan sát được..."
                placeholderTextColor={Colors.onSurfaceMuted}
              />
              <Text style={styles.characterCount}>{detail.length}/500</Text>
            </View>

            <View style={styles.adminNotice}>
              <Ionicons name="shield-outline" size={22} color="#725C00" />
              <Text style={styles.adminNoticeText}>
                User Mobile chỉ gửi báo cáo. Hàng đợi kiểm duyệt và quyết định xử
                lý nằm hoàn toàn ở Admin Web.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, !reason && styles.submitButtonDisabled]}
              onPress={submitReport}
              disabled={!reason}
              activeOpacity={0.86}
            >
              <Ionicons name="flag" size={19} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Gửi báo cáo</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
  headerSpacer: { width: 40 },
  scrollContent: { padding: 14, paddingBottom: 42 },
  postPreview: {
    marginBottom: 13,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryDark,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
  },
  previewLabel: {
    color: Colors.primaryDark,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  previewAuthor: { marginTop: 6, color: Colors.onSurface, fontSize: 11, fontWeight: "900" },
  previewContent: { marginTop: 5, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 15 },
  sectionCard: {
    marginBottom: 13,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  sectionTitle: { color: Colors.onSurface, fontSize: 14, fontWeight: "900" },
  sectionDescription: { marginTop: 4, color: Colors.onSurfaceMuted, fontSize: 9, lineHeight: 14 },
  reasonList: { marginTop: 12, gap: 8 },
  reasonCard: {
    minHeight: 70,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
  },
  reasonCardSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  reasonIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  reasonIconSelected: { backgroundColor: Colors.primaryDark },
  reasonLabel: { color: Colors.onSurface, fontSize: 11, fontWeight: "900" },
  reasonDescription: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 8, lineHeight: 12 },
  detailInput: {
    minHeight: 110,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    color: Colors.onSurface,
    fontSize: 10,
  },
  characterCount: { marginTop: 5, color: Colors.onSurfaceMuted, fontSize: 8, textAlign: "right" },
  adminNotice: {
    marginBottom: 13,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: Radius.lg,
    backgroundColor: "#FFF7D6",
  },
  adminNoticeText: { flex: 1, color: "#725C00", fontSize: 9, lineHeight: 14 },
  submitButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.error,
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  messageCard: {
    padding: 30,
    alignItems: "center",
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  messageTitle: { marginTop: 12, color: Colors.onSurface, fontSize: 16, fontWeight: "900", textAlign: "center" },
  messageDescription: { marginTop: 6, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 15, textAlign: "center" },
  primaryButton: {
    minHeight: 48,
    marginTop: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  primaryButtonText: { color: Colors.onPrimary, fontSize: 11, fontWeight: "900" },
});
