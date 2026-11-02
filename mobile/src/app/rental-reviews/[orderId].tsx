import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import {
  REVIEW_INELIGIBLE_LABELS,
  rentalReviewApi,
  type ReviewableItem,
} from "@/features/rentals/review-api";

type ReviewDraft = { rating: number; comment: string };

function newKey(orderId: string, productId: string) {
  return `rental-review:${orderId}:${productId}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Đánh giá theo GET /rental-orders/:id/reviewable-items: backend quyết định món nào được đánh giá
 * (đơn hoàn tất + đã quyết toán cọc + món đã bàn giao + chưa đánh giá). Không tự suy từ chi tiết đơn.
 */
export default function RentalReviewDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { accessToken } = useAuth();
  const [items, setItems] = useState<ReviewableItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  // Mỗi món giữ một Idempotency-Key cho tới khi nội dung đổi → retry do mất mạng không tạo đánh giá trùng.
  const keys = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!accessToken || !orderId) {
      setError("Thiếu thông tin đơn thuê hoặc phiên đăng nhập.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await rentalReviewApi.getReviewableItems(orderId, accessToken);
      const list = result.items ?? [];
      setItems(list);
      setDrafts((current) =>
        Object.fromEntries(list.filter((item) => item.canReview).map((item) => [item.productId, current[item.productId] ?? { rating: 5, comment: "" }])),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tải được sản phẩm cần đánh giá.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(productId: string, patch: Partial<ReviewDraft>) {
    delete keys.current[productId];
    setDrafts((current) => ({
      ...current,
      [productId]: { ...(current[productId] ?? { rating: 5, comment: "" }), ...patch },
    }));
  }

  const pending = items.filter((item) => item.canReview);

  async function submit() {
    if (!accessToken || !orderId || pending.length === 0) return;
    setSubmitting(true);
    const results = await Promise.allSettled(
      pending.map((item) => {
        const draft = drafts[item.productId] ?? { rating: 5, comment: "" };
        keys.current[item.productId] ??= newKey(orderId, item.productId);
        return rentalReviewApi.createOne(
          orderId,
          { productId: item.productId, rating: draft.rating, comment: draft.comment.trim() || undefined },
          keys.current[item.productId],
          accessToken,
        );
      }),
    );
    setSubmitting(false);
    const failed = results
      .map((result, index) => ({ result, item: pending[index] }))
      .filter((entry) => entry.result.status === "rejected");
    if (failed.length === 0) keys.current = {};
    await load();
    if (failed.length === 0) {
      Alert.alert("Đã gửi đánh giá", "Cảm ơn bạn đã chia sẻ trải nghiệm về thiết bị.", [{ text: "Xong", onPress: () => router.back() }]);
    } else {
      const reason = failed[0].result as PromiseRejectedResult;
      Alert.alert(
        "Chưa gửi được hết",
        `${failed.length}/${pending.length} sản phẩm chưa gửi được: ${failed.map((entry) => entry.item.product.name).join(", ")}. ${
          reason.reason instanceof Error ? reason.reason.message : ""
        } Bấm gửi lại để thử tiếp.`,
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.eyebrow}>TRẢI NGHIỆM THIẾT BỊ</Text>
          <Text style={styles.title}>Viết đánh giá</Text>
        </View>
      </View>

      {loading && items.length === 0 ? (
        <TrekkingLoader label="Đang mở hành trình thiết bị" hint="TrekGo đang tải các món đồ bạn có thể đánh giá." />
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="lock-closed-outline" size={36} color={Colors.warningDeep} />
          <Text style={styles.errorTitle}>Chưa tải được</Text>
          <Text style={styles.stateDescription}>{error}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void load()}>
            <Text style={styles.secondaryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.summaryCard}>
              <Ionicons name={pending.length ? "create-outline" : "checkmark-circle"} size={24} color={Colors.primaryDark} />
              <View style={styles.flexOne}>
                <Text style={styles.summaryTitle}>
                  {pending.length ? `${pending.length} sản phẩm chờ bạn đánh giá` : "Không còn sản phẩm cần đánh giá"}
                </Text>
                <Text style={styles.summaryText}>Đánh giá chỉ dành cho món bạn đã thực nhận, sau khi đơn hoàn tất và quyết toán cọc.</Text>
              </View>
            </View>

            {items.map((item) => {
              const draft = drafts[item.productId] ?? { rating: 5, comment: "" };
              return (
                <View key={item.productId} style={styles.reviewCard}>
                  <Text style={styles.productSku}>{item.product.sku || "THIẾT BỊ THUÊ"}</Text>
                  <Text style={styles.productName}>{item.product.name || "Thiết bị trekking"}</Text>
                  {item.canReview ? (
                    <>
                      <Text style={styles.ratingLabel}>Mức độ hài lòng</Text>
                      <View style={styles.starRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity key={star} onPress={() => updateDraft(item.productId, { rating: star })}>
                            <Ionicons
                              name={star <= draft.rating ? "star" : "star-outline"}
                              size={31}
                              color={star <= draft.rating ? "#F4A261" : Colors.surfaceContainerHighest}
                            />
                          </TouchableOpacity>
                        ))}
                        <Text style={styles.ratingValue}>{draft.rating}/5</Text>
                      </View>
                      <TextInput
                        value={draft.comment}
                        onChangeText={(comment) => updateDraft(item.productId, { comment })}
                        placeholder="Thiết bị sạch không, sử dụng có ổn định không?..."
                        placeholderTextColor={Colors.onSurfaceMuted}
                        multiline
                        maxLength={2000}
                        style={styles.commentInput}
                      />
                      <Text style={styles.counter}>{draft.comment.length}/2000</Text>
                    </>
                  ) : item.isReviewed ? (
                    <View style={styles.doneRow}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primaryDark} />
                      <Text style={styles.doneText}>Đã đánh giá {item.rating ?? ""}/5 sao</Text>
                    </View>
                  ) : (
                    <Text style={styles.ineligibleText}>
                      {REVIEW_INELIGIBLE_LABELS[item.ineligibleReason ?? ""] ?? "Sản phẩm chưa đủ điều kiện đánh giá."}
                    </Text>
                  )}
                </View>
              );
            })}

            {pending.length ? (
              <TouchableOpacity disabled={submitting} style={[styles.submitButton, submitting && styles.disabled]} onPress={() => void submit()}>
                {submitting ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color={Colors.onPrimary} />
                    <Text style={styles.submitButtonText}>Gửi {pending.length} đánh giá</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.noteText}>Cảm ơn bạn! Đánh giá giúp các trekker khác chọn thiết bị phù hợp.</Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  headerButton: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  title: { marginTop: 2, color: Colors.onSurface, fontSize: 22, fontWeight: "800" },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  errorTitle: { marginTop: 14, color: Colors.onSurface, fontSize: 18, fontWeight: "800" },
  stateDescription: { marginTop: 7, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, textAlign: "center" },
  secondaryButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 11, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer },
  secondaryButtonText: { color: Colors.onSurface, fontSize: 12, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 46, gap: 13 },
  summaryCard: { padding: 14, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primaryNeutral, backgroundColor: Colors.primaryPale },
  summaryTitle: { color: Colors.onSurface, fontSize: 13, fontWeight: "700" },
  summaryText: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 11 },
  reviewCard: { padding: 16, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  productSku: { color: Colors.primaryDark, fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  productName: { marginTop: 4, color: Colors.onSurface, fontSize: 15, fontWeight: "800" },
  ratingLabel: { marginTop: 15, color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: "600" },
  starRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  ratingValue: { marginLeft: 8, color: Colors.onSurface, fontSize: 12, fontWeight: "700" },
  commentInput: { minHeight: 98, marginTop: 15, padding: 13, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: Radius.md, color: Colors.onSurface, backgroundColor: Colors.surfaceContainerLow, textAlignVertical: "top" },
  counter: { marginTop: 5, alignSelf: "flex-end", color: Colors.onSurfaceMuted, fontSize: 9 },
  submitButton: { minHeight: 50, marginTop: 5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  submitButtonText: { color: Colors.onPrimary, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  doneRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  doneText: { color: Colors.primaryDark, fontSize: 12, fontWeight: "700" },
  ineligibleText: { marginTop: 10, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 17 },
  noteText: { color: Colors.onSurfaceVariant, fontSize: 11, lineHeight: 16, textAlign: "center" },
});
