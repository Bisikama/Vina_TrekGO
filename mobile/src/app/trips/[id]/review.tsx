import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
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

const reviewHighlights = [
  "Leader nhiệt tình",
  "Lộ trình hấp dẫn",
  "Tổ chức chuyên nghiệp",
  "Đảm bảo an toàn",
  "Cảnh quan đẹp",
  "Đồ ăn ngon",
];

export default function TripReviewScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    leader?: string;
    date?: string;
  }>();

  const [rating, setRating] = useState(0);
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const tripName = params.name ?? "Bidoup – Núi Bà (2N1Đ)";

  const leaderName = params.leader ?? "Leader Hoàng Nam";

  const tripDate = params.date ?? "18 – 19 Tháng 08, 2026";

  function toggleHighlight(highlight: string) {
    setSelectedHighlights((current) => {
      if (current.includes(highlight)) {
        return current.filter((item) => item !== highlight);
      }

      return [...current, highlight];
    });
  }

  function submitReview() {
    if (rating === 0) {
      Alert.alert(
        "Chưa chọn số sao",
        "Bạn hãy chọn mức độ hài lòng trước khi gửi đánh giá.",
      );

      return;
    }

    if (comment.trim().length < 10) {
      Alert.alert(
        "Nhận xét quá ngắn",
        "Hãy chia sẻ ít nhất 10 ký tự về trải nghiệm chuyến đi.",
      );

      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={48} color="#FFFFFF" />
          </View>

          <Text style={styles.successTitle}>Cảm ơn đánh giá của bạn!</Text>

          <Text style={styles.successDescription}>
            Đánh giá đã được ghi nhận và sẽ giúp TrekGo cùng Leader cải thiện
            những chuyến đi tiếp theo.
          </Text>

          <View style={styles.successRating}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Ionicons
                key={index}
                name={index < rating ? "star" : "star-outline"}
                size={24}
                color="#F59E0B"
              />
            ))}
          </View>

          <View style={styles.pointsCard}>
            <Ionicons name="ribbon-outline" size={23} color="#725C00" />

            <View style={styles.flexOne}>
              <Text style={styles.pointsTitle}>+50 TrekGo Points</Text>

              <Text style={styles.pointsDescription}>
                Điểm thưởng đã được cộng vào tài khoản của bạn.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/(tabs)/trips")}
          >
            <Text style={styles.primaryButtonText}>Về lịch sử chuyến đi</Text>
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#17231B" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Đánh giá chuyến đi</Text>

            <Text style={styles.headerSubtitle}>
              Chia sẻ trải nghiệm của bạn
            </Text>
          </View>

          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.tripCard}>
            <View style={styles.completedIcon}>
              <Ionicons name="flag" size={23} color="#FFFFFF" />
            </View>

            <View style={styles.flexOne}>
              <View style={styles.completedRow}>
                <Text style={styles.completedLabel}>CHUYẾN ĐÃ HOÀN THÀNH</Text>

                <Ionicons name="checkmark-circle" size={14} color="#2D6A4F" />
              </View>

              <Text style={styles.tripName}>{tripName}</Text>

              <Text style={styles.tripDate}>{tripDate}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Bạn hài lòng với chuyến đi?</Text>

            <Text style={styles.sectionDescription}>
              Chạm vào số sao tương ứng với trải nghiệm tổng thể.
            </Text>

            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, index) => {
                const starValue = index + 1;
                const selected = starValue <= rating;

                return (
                  <TouchableOpacity
                    key={starValue}
                    style={styles.starButton}
                    onPress={() => setRating(starValue)}
                  >
                    <Ionicons
                      name={selected ? "star" : "star-outline"}
                      size={38}
                      color={selected ? "#F59E0B" : "#CBD5E1"}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.ratingLabel}>
              {rating === 0 && "Chưa chọn đánh giá"}
              {rating === 1 && "Chưa hài lòng"}
              {rating === 2 && "Cần cải thiện"}
              {rating === 3 && "Khá ổn"}
              {rating === 4 && "Rất hài lòng"}
              {rating === 5 && "Tuyệt vời!"}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Điều gì làm bạn ấn tượng?</Text>

            <Text style={styles.sectionDescription}>
              Có thể chọn nhiều nội dung.
            </Text>

            <View style={styles.highlightGrid}>
              {reviewHighlights.map((highlight) => {
                const selected = selectedHighlights.includes(highlight);

                return (
                  <TouchableOpacity
                    key={highlight}
                    style={[
                      styles.highlightChip,
                      selected && styles.highlightChipSelected,
                    ]}
                    onPress={() => toggleHighlight(highlight)}
                  >
                    {selected && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}

                    <Text
                      style={[
                        styles.highlightText,
                        selected && styles.highlightTextSelected,
                      ]}
                    >
                      {highlight}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Đánh giá Leader</Text>

            <View style={styles.leaderCard}>
              <View style={styles.leaderAvatar}>
                <Text style={styles.leaderAvatarText}>HN</Text>
              </View>

              <View style={styles.flexOne}>
                <Text style={styles.leaderName}>{leaderName}</Text>

                <Text style={styles.leaderBadge}>Verified Trek Leader</Text>
              </View>

              <View style={styles.leaderRating}>
                <Ionicons name="star" size={15} color="#F59E0B" />

                <Text style={styles.leaderRatingText}>4.9</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Chia sẻ thêm về trải nghiệm</Text>

            <Text style={styles.sectionDescription}>
              Nhận xét của bạn giúp cộng đồng lựa chọn chuyến đi phù hợp hơn.
            </Text>

            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Ví dụ: Leader hỗ trợ tốt, cung đường đẹp và lịch trình hợp lý..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={500}
              textAlignVertical="top"
            />

            <Text style={styles.characterCount}>{comment.length}/500</Text>
          </View>

          <View style={styles.noticeCard}>
            <Ionicons
              name="information-circle-outline"
              size={19}
              color="#2D6A4F"
            />

            <Text style={styles.noticeText}>
              Đánh giá cần trung thực và tuân thủ tiêu chuẩn cộng đồng TrekGo.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={submitReview}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />

            <Text style={styles.submitButtonText}>Gửi đánh giá</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7F5",
  },
  flexOne: {
    flex: 1,
  },
  header: {
    minHeight: 66,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8E3",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#EEF2EE",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#17231B",
    fontSize: 17,
    fontWeight: "900",
  },
  headerSubtitle: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 10,
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  tripCard: {
    marginBottom: 14,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#1B4332",
  },
  completedIcon: {
    width: 46,
    height: 46,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#2D6A4F",
  },
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  completedLabel: {
    color: "#BCE2CA",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  tripName: {
    marginTop: 5,
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  tripDate: {
    marginTop: 3,
    color: "#D4E8DB",
    fontSize: 11,
  },
  sectionCard: {
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8E3",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  sectionTitle: {
    color: "#17231B",
    fontSize: 15,
    fontWeight: "900",
  },
  sectionDescription: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 11,
    lineHeight: 17,
  },
  starsRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  starButton: {
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  ratingLabel: {
    marginTop: 8,
    color: "#725C00",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  highlightGrid: {
    marginTop: 13,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  highlightChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 18,
    backgroundColor: "#F8FAF9",
  },
  highlightChipSelected: {
    borderColor: "#1B4332",
    backgroundColor: "#1B4332",
  },
  highlightText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  highlightTextSelected: {
    color: "#FFFFFF",
  },
  leaderCard: {
    marginTop: 12,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#F1F5F2",
  },
  leaderAvatar: {
    width: 42,
    height: 42,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "#1B4332",
  },
  leaderAvatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  leaderName: {
    color: "#17231B",
    fontSize: 13,
    fontWeight: "900",
  },
  leaderBadge: {
    marginTop: 2,
    color: "#2D6A4F",
    fontSize: 10,
    fontWeight: "700",
  },
  leaderRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  leaderRatingText: {
    color: "#17231B",
    fontSize: 12,
    fontWeight: "900",
  },
  commentInput: {
    minHeight: 125,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    color: "#17231B",
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: "#F8FAF9",
  },
  characterCount: {
    marginTop: 5,
    color: "#94A3B8",
    fontSize: 10,
    textAlign: "right",
  },
  noticeCard: {
    marginBottom: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#E7F3EB",
  },
  noticeText: {
    flex: 1,
    color: "#315E42",
    fontSize: 11,
    lineHeight: 17,
  },
  submitButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 27,
    backgroundColor: "#1B4332",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
    backgroundColor: "#1B4332",
  },
  successTitle: {
    marginTop: 20,
    color: "#17231B",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  successDescription: {
    marginTop: 9,
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  successRating: {
    marginTop: 18,
    flexDirection: "row",
    gap: 5,
  },
  pointsCard: {
    width: "100%",
    marginTop: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#F3D568",
    borderRadius: 16,
    backgroundColor: "#FFF7D6",
  },
  pointsTitle: {
    color: "#6B5200",
    fontSize: 13,
    fontWeight: "900",
  },
  pointsDescription: {
    marginTop: 2,
    color: "#7A641F",
    fontSize: 10,
    lineHeight: 15,
  },
  primaryButton: {
    width: "100%",
    minHeight: 52,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#1B4332",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
