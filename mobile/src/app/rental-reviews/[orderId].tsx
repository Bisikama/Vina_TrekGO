import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { rentalApi } from "@/features/rentals/api";
import {
  rentalReviewApi,
  type CreateRentalProductReviewInput,
} from "@/features/rentals/review-api";
import type { RentalOrderDetail, RentalOrderLine } from "@/features/rentals/types";

type ReviewDraft = { rating: number; comment: string };

function resolvedProductId(item: RentalOrderLine) {
  const directId = typeof item.productId === "string" ? item.productId.trim() : "";
  const nestedId = typeof item.product?.id === "string" ? item.product.id.trim() : "";
  return directId || nestedId;
}

export default function RentalReviewDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { accessToken } = useAuth();
  const [detail, setDetail] = useState<RentalOrderDetail>();
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const loadDetail = useCallback(async () => {
    if (!accessToken || !orderId) {
      setError("Thiếu thông tin đơn thuê hoặc phiên đăng nhập.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const result = await rentalApi.getOrder(orderId, accessToken);
      if (result.order.status !== "COMPLETED" || result.order.financialStatus !== "SETTLED") {
        setError("Đơn chưa hoàn tất trả đồ và đối soát nên chưa thể đánh giá.");
        return;
      }
      setDetail(result);
      setDrafts(Object.fromEntries(
        result.items.flatMap((item) => {
          const productId = resolvedProductId(item);
          return productId ? [[productId, { rating: 5, comment: "" } satisfies ReviewDraft] as const] : [];
        }),
      ));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tải được đơn thuê.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const uniqueItems = useMemo(() => {
    const byProduct = new Map<string, RentalOrderLine>();
    detail?.items.forEach((item) => {
      const productId = resolvedProductId(item);
      if (productId && !byProduct.has(productId)) {
        byProduct.set(productId, { ...item, productId });
      }
    });
    return [...byProduct.values()];
  }, [detail]);

  function updateDraft(productId: string, patch: Partial<ReviewDraft>) {
    setDrafts((current) => ({
      ...current,
      [productId]: { ...(current[productId] ?? { rating: 5, comment: "" }), ...patch },
    }));
  }

  async function submit() {
    if (!accessToken || !orderId || !detail) return;

    const reviews: CreateRentalProductReviewInput[] = uniqueItems.map((item) => ({
      productId: item.productId,
      rating: drafts[item.productId]?.rating ?? 5,
      comment: drafts[item.productId]?.comment.trim() || undefined,
    }));

    setSubmitting(true);
    try {
      await rentalReviewApi.createMany(orderId, reviews, accessToken);
      Alert.alert("Đã gửi đánh giá", "Cảm ơn bạn đã chia sẻ trải nghiệm về thiết bị.", [
        { text: "Xong", onPress: () => router.back() },
      ]);
    } catch (requestError) {
      Alert.alert(
        "Chưa gửi được đánh giá",
        requestError instanceof Error ? requestError.message : "Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
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

      {loading ? (
        <TrekkingLoader
          label="Đang mở hành trình thiết bị"
          hint="TrekGo đang tải các món đồ đã hoàn tất để bạn chia sẻ trải nghiệm."
        />
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="lock-closed-outline" size={36} color={Colors.warningDeep} />
          <Text style={styles.errorTitle}>Chưa thể đánh giá</Text>
          <Text style={styles.stateDescription}>{error}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.summaryCard}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.primaryDark} />
              <View style={styles.flexOne}>
                <Text style={styles.summaryTitle}>Đơn đã hoàn tất đối soát</Text>
                <Text style={styles.summaryText}>{detail?.order.trip?.title || "Chuyến đi của bạn"}</Text>
              </View>
            </View>

            {uniqueItems.map((item) => {
              const draft = drafts[item.productId] ?? { rating: 5, comment: "" };
              return (
                <View key={item.productId} style={styles.reviewCard}>
                  <Text style={styles.productSku}>{item.sku || "THIẾT BỊ THUÊ"}</Text>
                  <Text style={styles.productName}>{item.name || item.product?.name || "Thiết bị trekking"}</Text>
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
                    maxLength={500}
                    style={styles.commentInput}
                  />
                  <Text style={styles.counter}>{draft.comment.length}/500</Text>
                </View>
              );
            })}

            <TouchableOpacity disabled={submitting} style={styles.submitButton} onPress={() => void submit()}>
              {submitting ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={Colors.onPrimary} />
                  <Text style={styles.submitButtonText}>Gửi đánh giá</Text>
                </>
              )}
            </TouchableOpacity>
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
});
