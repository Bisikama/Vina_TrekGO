import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { rentalApi } from "@/features/rentals/api";
import type { RentalOrderSummary } from "@/features/rentals/types";

export default function RentalReviewsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [orders, setOrders] = useState<RentalOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!accessToken) {
      setError("Phiên đăng nhập không hợp lệ.");
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(undefined);

    try {
      const result = await rentalApi.listOrders(accessToken, { page: 1, pageSize: 100 });
      setOrders(result.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không tải được danh sách đánh giá.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const reviewOrders = useMemo(
    () => orders.filter((order) => !["PENDING_PAYMENT", "CANCELLED", "EXPIRED"].includes(order.status)),
    [orders],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.eyebrow}>THIẾT BỊ ĐÃ THUÊ</Text>
          <Text style={styles.title}>Đánh giá</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadOrders(true)}
            tintColor={Colors.primaryDark}
          />
        }
      >
        <View style={styles.policyCard}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.primaryDark} />
          <Text style={styles.policyText}>
            Bạn chỉ có thể đánh giá sau khi đơn đã hoàn tất trả đồ và đối soát tiền cọc.
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={Colors.primaryDark} />
            <Text style={styles.stateDescription}>Đang kiểm tra đơn đủ điều kiện...</Text>
          </View>
        ) : error ? (
          <StateCard
            icon="cloud-offline-outline"
            title="Chưa tải được đánh giá"
            description={error}
            actionLabel="Thử lại"
            onAction={() => void loadOrders()}
          />
        ) : reviewOrders.length === 0 ? (
          <StateCard
            icon="star-outline"
            title="Chưa có thiết bị để đánh giá"
            description="Sau khi nhận, sử dụng và hoàn tất trả đồ, đơn thuê sẽ xuất hiện tại đây."
          />
        ) : (
          <View style={styles.list}>
            {reviewOrders.map((order) => {
              const eligibility = getReviewEligibility(order);
              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderTopRow}>
                    <View style={styles.orderIcon}>
                      <Ionicons name="cube-outline" size={23} color={Colors.primaryDark} />
                    </View>
                    <View style={styles.flexOne}>
                      <Text style={styles.orderCode}>ĐƠN THUÊ · {shortId(order.id)}</Text>
                      <Text style={styles.orderTitle} numberOfLines={1}>
                        {order.trip?.title || "Chuyến đi của bạn"}
                      </Text>
                      <Text style={styles.orderMeta}>{eligibility.description}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <TouchableOpacity
                    disabled={!eligibility.allowed}
                    style={[styles.reviewButton, !eligibility.allowed && styles.reviewButtonDisabled]}
                    onPress={() =>
                      router.push(`/rental-reviews/${encodeURIComponent(order.id)}` as Href)
                    }
                  >
                    <Ionicons
                      name={eligibility.allowed ? "star" : "lock-closed-outline"}
                      size={17}
                      color={eligibility.allowed ? Colors.onPrimary : Colors.onSurfaceMuted}
                    />
                    <Text style={[styles.reviewButtonText, !eligibility.allowed && styles.reviewButtonTextDisabled]}>
                      {eligibility.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getReviewEligibility(order: RentalOrderSummary) {
  if (order.status !== "COMPLETED") {
    return {
      allowed: false,
      label: "Chờ hoàn tất trả đồ",
      description: "Đơn vẫn đang trong quy trình sử dụng hoặc hoàn trả.",
    };
  }

  if (order.financialStatus !== "SETTLED") {
    return {
      allowed: false,
      label: "Đang đối soát",
      description: "Đơn đã trả nhưng tiền cọc chưa đối soát xong.",
    };
  }

  return {
    allowed: true,
    label: "Đánh giá thiết bị",
    description: "Đơn đã hoàn tất và sẵn sàng nhận đánh giá.",
  };
}

function shortId(value: string) {
  return value.replace(/-/g, "").slice(-6).toUpperCase();
}

function StateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={34} color={Colors.primaryDark} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.stateButton} onPress={onAction}>
          <Text style={styles.stateButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  headerButton: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  title: { marginTop: 2, color: Colors.onSurface, fontSize: 22, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 48 },
  policyCard: { padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: Radius.lg, backgroundColor: Colors.primaryPale, borderWidth: 1, borderColor: Colors.primaryNeutral },
  policyText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18 },
  centerState: { paddingVertical: 70, alignItems: "center", gap: 12 },
  list: { marginTop: 16, gap: 12 },
  orderCard: { padding: 15, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  orderTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  orderIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  orderCode: { color: Colors.primaryDark, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  orderTitle: { marginTop: 3, color: Colors.onSurface, fontSize: 14, fontWeight: "700" },
  orderMeta: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 11, lineHeight: 16 },
  divider: { height: 1, marginVertical: 13, backgroundColor: Colors.surfaceContainer },
  reviewButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  reviewButtonDisabled: { backgroundColor: Colors.surfaceContainer },
  reviewButtonText: { color: Colors.onPrimary, fontSize: 12, fontWeight: "700" },
  reviewButtonTextDisabled: { color: Colors.onSurfaceMuted },
  stateCard: { marginTop: 24, padding: 24, alignItems: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  stateIcon: { width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  stateTitle: { marginTop: 15, color: Colors.onSurface, fontSize: 17, fontWeight: "800" },
  stateDescription: { marginTop: 7, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, textAlign: "center" },
  stateButton: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  stateButtonText: { color: Colors.onPrimary, fontSize: 12, fontWeight: "700" },
});
