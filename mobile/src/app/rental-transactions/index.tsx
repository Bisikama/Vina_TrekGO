import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import {
  rentalTransactionsApi,
  type RentalTransaction,
} from "@/features/rentals/transactions-api";
import type { RentalOrderSummary } from "@/features/rentals/types";

type KindFilter = "ALL" | "PAYMENT" | "REFUND";

export default function RentalTransactionsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [transactions, setTransactions] = useState<RentalTransaction[]>([]);
  const [ordersById, setOrdersById] = useState<Record<string, RentalOrderSummary>>({});
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const loadTransactions = useCallback(async (isRefresh = false) => {
    if (!accessToken) {
      setError("Phiên đăng nhập không hợp lệ.");
      setLoading(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(undefined);

    try {
      const [transactionResult, orderResult] = await Promise.allSettled([
        rentalTransactionsApi.list(accessToken, { page: 1, pageSize: 100 }),
        rentalApi.listOrders(accessToken, { page: 1, pageSize: 100 }),
      ]);

      if (transactionResult.status === "rejected") throw transactionResult.reason;
      setTransactions(transactionResult.value.items);

      if (orderResult.status === "fulfilled") {
        setOrdersById(
          Object.fromEntries(orderResult.value.items.map((order) => [order.id, order])),
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không tải được lịch sử giao dịch.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const visibleTransactions = useMemo(
    () => transactions.filter((transaction) => kind === "ALL" || transaction.kind === kind),
    [kind, transactions],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.eyebrow}>THUÊ THIẾT BỊ</Text>
          <Text style={styles.title}>Lịch sử giao dịch</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadTransactions(true)}
            tintColor={Colors.primaryDark}
          />
        }
      >
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primaryDark} />
          <Text style={styles.infoText}>
            Chỉ hiển thị thanh toán và hoàn tiền thuộc dịch vụ thuê thiết bị.
          </Text>
        </View>

        <View style={styles.filters}>
          <FilterButton label="Tất cả" active={kind === "ALL"} onPress={() => setKind("ALL")} />
          <FilterButton label="Thanh toán" active={kind === "PAYMENT"} onPress={() => setKind("PAYMENT")} />
          <FilterButton label="Hoàn tiền" active={kind === "REFUND"} onPress={() => setKind("REFUND")} />
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={Colors.primaryDark} />
            <Text style={styles.stateDescription}>Đang tải giao dịch...</Text>
          </View>
        ) : error ? (
          <StateCard
            icon="cloud-offline-outline"
            title="Chưa tải được giao dịch"
            description={error}
            actionLabel="Thử lại"
            onAction={() => void loadTransactions()}
          />
        ) : visibleTransactions.length === 0 ? (
          <StateCard
            icon="receipt-outline"
            title="Chưa có giao dịch"
            description={kind === "ALL" ? "Các khoản thanh toán và hoàn tiền thuê thiết bị sẽ xuất hiện tại đây." : "Không có giao dịch phù hợp với bộ lọc này."}
          />
        ) : (
          <View style={styles.list}>
            {visibleTransactions.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                order={transaction.orderId ? ordersById[transaction.orderId] : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TransactionCard({
  transaction,
  order,
}: {
  transaction: RentalTransaction;
  order?: RentalOrderSummary;
}) {
  const isRefund = transaction.kind === "REFUND";
  const status = transactionStatus(transaction.status);
  const effective = transaction.status === "SUCCEEDED";

  return (
    <View style={styles.transactionCard}>
      <View style={[styles.transactionIcon, isRefund && styles.refundIcon]}>
        <Ionicons
          name={isRefund ? "arrow-undo-outline" : "card-outline"}
          size={23}
          color={isRefund ? Colors.primaryDark : Colors.tertiary}
        />
      </View>
      <View style={styles.flexOne}>
        <View style={styles.transactionTopRow}>
          <Text style={styles.transactionTitle}>{isRefund ? "Hoàn tiền cọc" : "Thanh toán đơn thuê"}</Text>
          <Text style={[styles.amount, isRefund && effective && styles.refundAmount]}>
            {isRefund && effective ? "+" : isRefund ? "" : "−"}{formatCurrency(transaction.amount, transaction.currency)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <View style={[styles.statusBadge, { backgroundColor: status.backgroundColor }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(transaction.createdAt)}</Text>
        </View>
        {order ? (
          <View style={styles.tripInfo}>
            <View style={styles.tripTitleRow}>
              <Ionicons name="map-outline" size={14} color={Colors.primaryDark} />
              <Text style={styles.tripTitle} numberOfLines={1}>
                {order.trip?.title || "Chuyến đi của bạn"}
              </Text>
            </View>
            <Text style={styles.tripMeta}>
              Đơn thuê #{shortOrderId(order.id)}
              {order.trip?.startAt && order.trip?.endAt
                ? ` · ${formatTripWindow(order.trip.startAt, order.trip.endAt)}`
                : ""}
            </Text>
          </View>
        ) : transaction.purpose ? (
          <Text style={styles.detailText}>{purposeLabel(transaction.purpose)}</Text>
        ) : null}
        {transaction.reference ? <Text style={styles.referenceText}>Mã GD: {shortReference(transaction.reference)}</Text> : null}
      </View>
    </View>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.filterButton, active && styles.filterButtonActive]} onPress={onPress}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StateCard({ icon, title, description, actionLabel, onAction }: {
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
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.stateButton} onPress={onAction}>
          <Text style={styles.stateButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function transactionStatus(status: string) {
  const statuses: Record<string, { label: string; color: string; backgroundColor: string }> = {
    SUCCEEDED: { label: "Thành công", color: "#226600", backgroundColor: "#E0F5D3" },
    PENDING: { label: "Đang chờ", color: "#8A5A00", backgroundColor: "#FFF1C2" },
    PROCESSING: { label: "Đang xử lý", color: "#245F73", backgroundColor: "#DDF3F8" },
    FAILED: { label: "Thất bại", color: Colors.onErrorContainer, backgroundColor: Colors.errorContainer },
    CANCELLED: { label: "Đã hủy", color: Colors.onErrorContainer, backgroundColor: Colors.errorContainer },
    EXPIRED: { label: "Hết hạn", color: Colors.onSurfaceVariant, backgroundColor: Colors.surfaceContainer },
  };
  return statuses[status] || { label: status.replaceAll("_", " "), color: Colors.onSurfaceVariant, backgroundColor: Colors.surfaceContainer };
}

function purposeLabel(value: string) {
  const labels: Record<string, string> = {
    RENTAL_PAYMENT: "Phí thuê và tiền cọc",
    RENTAL_EXTENSION: "Phí gia hạn đơn thuê",
    RENTAL_DEPOSIT_REFUND: "Hoàn tiền cọc",
  };
  return labels[value] || value.replaceAll("_", " ");
}

function shortReference(value: string) {
  return value.length > 18 ? `...${value.slice(-15)}` : value;
}

function shortOrderId(value: string) {
  return value.replace(/-/g, "").slice(-6).toUpperCase();
}

function formatTripWindow(startAt: string, endAt: string) {
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${formatter.format(new Date(startAt))} – ${formatter.format(new Date(endAt))}`;
}

function formatCurrency(value: number, currency: string) {
  const formatted = Math.round(value).toLocaleString("vi-VN");
  return `${formatted}${currency === "VND" ? "đ" : ` ${currency}`}`;
}

function formatDate(value: string) {
  if (!value) return "Chưa có thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  headerButton: { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  title: { marginTop: 2, color: Colors.onSurface, fontSize: 22, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 48 },
  infoCard: { padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: Radius.lg, backgroundColor: Colors.primaryPale, borderWidth: 1, borderColor: Colors.primaryNeutral },
  infoText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18 },
  filters: { marginTop: 14, flexDirection: "row", gap: 8 },
  filterButton: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer },
  filterButtonActive: { backgroundColor: Colors.primaryContainer },
  filterText: { color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: "600" },
  filterTextActive: { color: Colors.onPrimary, fontWeight: "700" },
  centerState: { paddingVertical: 70, alignItems: "center", gap: 12 },
  list: { marginTop: 16, gap: 10 },
  transactionCard: { padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  transactionIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: "#FFF1C2" },
  refundIcon: { backgroundColor: Colors.primaryPale },
  transactionTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  transactionTitle: { flex: 1, color: Colors.onSurface, fontSize: 13, fontWeight: "700" },
  amount: { color: Colors.onSurface, fontSize: 14, fontWeight: "800" },
  refundAmount: { color: Colors.primaryDark },
  metaRow: { marginTop: 7, flexDirection: "row", alignItems: "center", gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: 9, fontWeight: "700" },
  dateText: { flex: 1, color: Colors.onSurfaceMuted, fontSize: 10 },
  detailText: { marginTop: 7, color: Colors.onSurfaceVariant, fontSize: 11 },
  tripInfo: { marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer },
  tripTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tripTitle: { flex: 1, color: Colors.onSurface, fontSize: 11, fontWeight: "700" },
  tripMeta: { marginTop: 4, color: Colors.onSurfaceMuted, fontSize: 9 },
  referenceText: { marginTop: 4, color: Colors.onSurfaceMuted, fontSize: 9 },
  stateCard: { marginTop: 24, padding: 24, alignItems: "center", borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  stateIcon: { width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryPale },
  stateTitle: { marginTop: 15, color: Colors.onSurface, fontSize: 17, fontWeight: "800" },
  stateDescription: { marginTop: 7, color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, textAlign: "center" },
  stateButton: { marginTop: 16, minHeight: 42, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  stateButtonText: { color: Colors.onPrimaryDark, fontSize: 12, fontWeight: "700" },
});
