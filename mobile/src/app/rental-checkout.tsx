import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import { rentalApi } from "@/features/rentals/api";
import { useRentalSelection } from "@/features/rentals/RentalSelectionContext";
import {
  RentalAvailability,
  RentalOrderCreated,
  RentalQuote,
} from "@/features/rentals/types";
import { ApiError } from "@/lib/api-client";

const money = (value: number, currency = "VND") =>
  `${value.toLocaleString("vi-VN")} ${currency === "VND" ? "đ" : currency}`;

const shortCode = (value: string) =>
  value.replaceAll("-", "").slice(0, 6).toUpperCase();

type Grade = "LIKE_NEW" | "GOOD_USED";

const GRADE_LABELS: Record<Grade, string> = { LIKE_NEW: "Như mới", GOOD_USED: "Sử dụng tốt" };
const GRADE_COLORS: Record<Grade, { bg: string; border: string; text: string }> = {
  LIKE_NEW: { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  GOOD_USED: { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
};

// Tên sản phẩm có hạng thường kèm đuôi "– Rất mới" / "– Đã sử dụng tốt"; hạng hiện bằng nhãn riêng.
function stripGradeSuffix(name: string) {
  return name
    .replace(/\s*[-–—:]\s*(rất mới|như mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i, "")
    .trim();
}

function formatClock(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

function createIdempotencyKey() {
  return `mobile-rental-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function RentalCheckoutScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { cart, setCartQuantity } = useApp();
  const { selectedTrip } = useRentalSelection();
  const [availability, setAvailability] = useState<
    Record<string, RentalAvailability>
  >({});
  const [quote, setQuote] = useState<RentalQuote>();
  const [createdOrder, setCreatedOrder] = useState<RentalOrderCreated>();
  const [checking, setChecking] = useState(true);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState<string>();
  const [grades, setGrades] = useState<Record<string, Grade | null>>({});
  const [quoteExpired, setQuoteExpired] = useState(false);
  const idempotencyKey = useRef(createIdempotencyKey());

  const shortages = useMemo(
    () =>
      cart.filter(({ item, quantity }) => {
        const result = availability[item.id];
        return result && quantity > result.availableCount;
      }),
    [availability, cart],
  );

  // Cọc dự kiến lấy từ dữ liệu sản phẩm trong giỏ (ưu tiên depositPerUnit của API); số chính xác chốt khi tạo báo giá.
  const estimatedDeposit = useMemo(
    () => cart.reduce((sum, { item, quantity }) => sum + item.deposit * quantity, 0),
    [cart],
  );

  const checkAvailability = useCallback(async () => {
    if (!accessToken || !selectedTrip || cart.length === 0) {
      setChecking(false);
      return;
    }

    setChecking(true);
    setError(undefined);
    setQuote(undefined);

    try {
      const eligibility = await rentalApi.getEligibility(
        selectedTrip.id,
        accessToken,
      );

      if (!eligibility.eligible) {
        throw new Error(
          eligibility.reason ||
            "Chuyến đi không còn đủ điều kiện thuê thiết bị.",
        );
      }

      const [results, products] = await Promise.all([
        Promise.all(
          cart.map(({ item }) =>
            rentalApi.getAvailability(
              { tripId: selectedTrip.id, productId: item.id },
              accessToken,
            ),
          ),
        ),
        Promise.allSettled(cart.map(({ item }) => rentalApi.getProduct(item.id))),
      ]);

      setAvailability(
        Object.fromEntries(results.map((result) => [result.productId, result])),
      );
      setGrades(
        Object.fromEntries(
          products.flatMap((result) =>
            result.status === "fulfilled"
              ? [[result.value.id, result.value.grade ?? null]]
              : [],
          ),
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không kiểm tra được tồn kho cho chuyến đi.",
      );
    } finally {
      setChecking(false);
    }
  }, [accessToken, cart, selectedTrip]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void checkAvailability();
    }, 0);

    return () => clearTimeout(timer);
  }, [checkAvailability]);

  async function createQuote() {
    if (!accessToken || !selectedTrip || shortages.length > 0) return;

    setCreatingQuote(true);
    setError(undefined);

    try {
      const result = await rentalApi.createQuote(
        {
          tripId: selectedTrip.id,
          items: cart.map(({ item, quantity }) => ({
            productId: item.id,
            quantity,
          })),
        },
        accessToken,
      );
      idempotencyKey.current = createIdempotencyKey();
      setQuote(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không tạo được báo giá thuê.",
      );
    } finally {
      setCreatingQuote(false);
    }
  }

  async function refreshQuoteAfterStaleContext() {
    if (!accessToken || !selectedTrip || cart.length === 0) return;

    const eligibility = await rentalApi.getEligibility(
      selectedTrip.id,
      accessToken,
    );

    if (!eligibility.eligible) {
      setQuote(undefined);
      setError(
        eligibility.reason ||
          "Thông tin chuyến đi đã thay đổi và hiện chưa đủ điều kiện thuê thiết bị.",
      );
      return;
    }

    const results = await Promise.all(
      cart.map(({ item }) =>
        rentalApi.getAvailability(
          { tripId: selectedTrip.id, productId: item.id },
          accessToken,
        ),
      ),
    );
    const nextAvailability = Object.fromEntries(
      results.map((result) => [result.productId, result]),
    );
    setAvailability(nextAvailability);

    const unavailableItem = cart.find(({ item, quantity }) => {
      const result = nextAvailability[item.id];
      return !result || quantity > result.availableCount;
    });

    if (unavailableItem) {
      setQuote(undefined);
      idempotencyKey.current = createIdempotencyKey();
      setError(
        `${unavailableItem.item.name} không còn đủ số lượng. Vui lòng cập nhật giỏ thuê.`,
      );
      return;
    }

    const refreshedQuote = await rentalApi.createQuote(
      {
        tripId: selectedTrip.id,
        items: cart.map(({ item, quantity }) => ({
          productId: item.id,
          quantity,
        })),
      },
      accessToken,
    );

    idempotencyKey.current = createIdempotencyKey();
    setQuote(refreshedQuote);
    setError(
      "Thông tin chuyến đi hoặc đặt chỗ vừa được cập nhật. Báo giá mới đã được tạo; vui lòng kiểm tra và xác nhận thuê lại.",
    );
  }

  async function createOrder() {
    if (!accessToken || !quote) return;

    setCreatingOrder(true);
    setError(undefined);

    try {
      const result = await rentalApi.createOrder(
        quote.id,
        idempotencyKey.current,
        accessToken,
      );
      setCreatedOrder(result);
      cart.forEach(({ item }) => setCartQuantity(item, 0));
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        requestError.code === "STALE_CONTEXT"
      ) {
        try {
          await refreshQuoteAfterStaleContext();
        } catch (refreshError) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "Thông tin chuyến đi đã thay đổi nhưng chưa thể tạo lại báo giá.",
          );
        }
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Không tạo được đơn thuê.",
        );
      }
    } finally {
      setCreatingOrder(false);
    }
  }

  if (createdOrder) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={42} color={Colors.primaryDark} />
          </View>
          <Text style={styles.successTitle}>Đã giữ thiết bị</Text>
          <Text style={styles.successDescription}>
            Đơn {shortCode(createdOrder.order.id)} đã được tạo. Thiết bị được
            tạm giữ đến hạn thanh toán hiển thị trong chi tiết đơn.
          </Text>
          <View style={styles.successAmount}>
            <Text style={styles.summaryLabel}>Tổng cần thanh toán</Text>
            <Text style={styles.totalValue}>
              {money(
                createdOrder.order.totalAmount,
                createdOrder.order.currency,
              )}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              router.replace(
                `/rental-orders/${createdOrder.order.id}` as Href,
              )
            }
          >
            <Text style={styles.primaryButtonText}>Theo dõi đơn thuê</Text>
            <Ionicons name="arrow-forward" size={19} color={Colors.onPrimary} />
          </TouchableOpacity>
          <Text style={styles.serverNote}>
            Bạn có thể theo dõi quá trình chuẩn bị, bàn giao và hoàn trả ngay trong đơn thuê.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={21} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.eyebrow}>THUÊ THIẾT BỊ</Text>
          <Text style={styles.headerTitle}>Xác nhận thuê thiết bị</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons
            name="receipt-outline"
            size={21}
            color={Colors.primaryDark}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {!accessToken ? (
          <StateCard
            icon="log-in-outline"
            title="Bạn cần đăng nhập"
            description="Đăng nhập lại để kiểm tra điều kiện thuê và tạo đơn."
          />
        ) : !selectedTrip ? (
          <StateCard
            icon="trail-sign-outline"
            title="Chưa chọn chuyến đi"
            description="Hãy chọn chuyến đi để hệ thống xác định thời gian thuê và tồn kho phù hợp."
            action="Chọn chuyến đi"
            onAction={() => router.replace("/rental-trip-select" as Href)}
          />
        ) : cart.length === 0 ? (
          <StateCard
            icon="bag-outline"
            title="Giỏ thuê đang trống"
            description="Quay lại danh mục và chọn ít nhất một thiết bị."
            action="Về danh mục"
            onAction={() => router.replace("/(tabs)/rental" as Href)}
          />
        ) : (
          <>
            <View style={styles.tripCard}>
              <Ionicons
                name="trail-sign"
                size={22}
                color={Colors.primaryDark}
              />
              <View style={styles.flexOne}>
                <Text style={styles.cardLabel}>CHUYẾN DÙNG ĐỂ THUÊ</Text>
                <Text style={styles.tripTitle}>{selectedTrip.title}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Thiết bị</Text>
              {cart.map(({ item, quantity }) => {
                const result = availability[item.id];
                const insufficient = result && quantity > result.availableCount;

                return (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemIcon}>
                      <Ionicons
                        name="cube-outline"
                        size={19}
                        color={Colors.primaryDark}
                      />
                    </View>
                    <View style={styles.flexOne}>
                      <ProductName name={item.name} grade={grades[item.id]} />
                      <Text style={styles.itemMeta}>Yêu cầu: {quantity}</Text>
                    </View>
                    {checking ? (
                      <ActivityIndicator
                        size="small"
                        color={Colors.primaryDark}
                      />
                    ) : result ? (
                      <Text
                        style={[
                          styles.stockText,
                          insufficient && styles.errorText,
                        ]}
                      >
                        Còn {result.availableCount}
                      </Text>
                    ) : (
                      <Text style={styles.errorText}>Chưa rõ</Text>
                    )}
                  </View>
                );
              })}
            </View>

            {error && (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle" size={20} color={Colors.error} />
                <Text style={styles.errorMessage}>{error}</Text>
              </View>
            )}

            {shortages.length > 0 && (
              <View style={styles.errorCard}>
                <Ionicons name="cube-outline" size={20} color={Colors.error} />
                <Text style={styles.errorMessage}>
                  Số lượng yêu cầu vượt tồn kho. Quay lại giỏ để giảm số lượng
                  rồi kiểm tra lại.
                </Text>
              </View>
            )}

            {!quote && creatingQuote ? (
              <ProgressCard
                title="Đang tạo báo giá"
                description="Hệ thống đang kiểm tra giá thuê, tiền cọc và số lượng thiết bị."
              />
            ) : !quote ? (
              <>
              <View style={styles.estimateCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tiền cọc dự kiến</Text>
                  <Text style={styles.summaryValue}>{money(estimatedDeposit)}</Text>
                </View>
                <Text style={styles.estimateNote}>
                  Hoàn lại sau khi trả đồ đạt chuẩn. Số chính xác được chốt ở bước báo giá.
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (checking || shortages.length > 0 || creatingQuote) &&
                    styles.disabledButton,
                ]}
                disabled={checking || shortages.length > 0 || creatingQuote}
                onPress={() => void createQuote()}
              >
                <Text style={styles.primaryButtonText}>Xem báo giá</Text>
                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color={Colors.onPrimary}
                />
              </TouchableOpacity>
              </>
            ) : (
              <View style={styles.quoteCard}>
                <Text style={styles.cardLabel}>CHI TIẾT BÁO GIÁ</Text>
                <Text style={styles.quoteTitle}>
                  {quote.chargedDays} ngày thuê
                </Text>
                {quote.items.map((item) => (
                  <View key={item.productId}>
                    <View style={styles.summaryRow}>
                      <View style={styles.flexOne}>
                        <ProductName name={item.name} grade={grades[item.productId]} />
                        <Text style={styles.itemMeta}>Số lượng {item.quantity}</Text>
                      </View>
                      <Text style={styles.summaryValue}>{money(item.feeAmount, quote.amounts.currency)}</Text>
                    </View>
                    <Text style={styles.depositLine}>
                      Cọc {money(item.depositPerUnit, quote.amounts.currency)}/món × {item.quantity} ={" "}
                      {money(item.depositAmount, quote.amounts.currency)}
                      {typeof item.depositExplanation?.percentageOfReplacementValue === "number"
                        ? ` · ≈ ${item.depositExplanation.percentageOfReplacementValue.toLocaleString("vi-VN")}% giá trị thay thế`
                        : ""}
                    </Text>
                  </View>
                ))}
                <View style={styles.divider} />
                <SummaryRow
                  label="Phí thuê"
                  value={money(quote.amounts.feeAmount, quote.amounts.currency)}
                />
                <SummaryRow
                  label="Tiền cọc"
                  value={money(
                    quote.amounts.depositAmount,
                    quote.amounts.currency,
                  )}
                />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tổng thanh toán</Text>
                  <Text style={styles.totalValue}>
                    {money(quote.amounts.totalAmount, quote.amounts.currency)}
                  </Text>
                </View>
                <QuoteCountdown
                  key={quote.id}
                  expiresAt={quote.expiresAt}
                  renewing={creatingQuote}
                  onRenew={() => void createQuote()}
                  onExpiredChange={setQuoteExpired}
                />

                {creatingOrder ? (
                  <ProgressCard
                    title="Đang tạo đơn thuê"
                    description="Vui lòng giữ ứng dụng mở trong giây lát."
                  />
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryButton, quoteExpired && styles.disabledButton]}
                    disabled={quoteExpired}
                    onPress={() => void createOrder()}
                  >
                    <Ionicons
                      name="lock-closed"
                      size={18}
                      color={Colors.onPrimary}
                    />
                    <Text style={styles.primaryButtonText}>Xác nhận thuê</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.retryButton}
              disabled={checking}
              onPress={() => void checkAvailability()}
            >
              <Ionicons name="refresh" size={17} color={Colors.primaryDark} />
              <Text style={styles.retryText}>Kiểm tra tồn kho lại</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <TrekkingLoader label={title} hint={description} />
  );
}

function ProductName({ name, grade }: { name: string; grade?: Grade | null }) {
  const colors = grade ? GRADE_COLORS[grade] : null;
  return (
    <View style={styles.nameRow}>
      <Text style={styles.itemName}>{grade ? stripGradeSuffix(name) : name}</Text>
      {grade && colors ? (
        <View style={[styles.gradeBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <View style={[styles.gradeDot, { backgroundColor: colors.text }]} />
          <Text style={[styles.gradeText, { color: colors.text }]}>{GRADE_LABELS[grade]}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Đếm ngược hiệu lực báo giá theo expiresAt do API trả về.
function QuoteCountdown({
  expiresAt,
  renewing,
  onRenew,
  onExpiredChange,
}: {
  expiresAt: string;
  renewing: boolean;
  onRenew: () => void;
  onExpiredChange: (expired: boolean) => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const expired = remaining <= 0;
  useEffect(() => {
    onExpiredChange(expired);
  }, [expired, onExpiredChange]);

  const total = Math.max(1, new Date(expiresAt).getTime() - startedAt);
  const ratio = Math.min(1, remaining / total);
  const tone =
    expired || remaining <= 60_000
      ? { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c", bar: "#ef4444" }
      : remaining <= 5 * 60_000
        ? { bg: "#fffbeb", border: "#fde68a", text: "#92400e", bar: "#f59e0b" }
        : { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857", bar: "#10b981" };
  const until = new Date(expiresAt).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

  if (expired) {
    return (
      <View style={[styles.countdownCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
        <Text style={[styles.countdownTitle, { color: tone.text }]}>Báo giá đã hết hạn</Text>
        <Text style={styles.countdownNote}>Tạo lại báo giá để cập nhật tồn kho và giá mới nhất.</Text>
        <TouchableOpacity
          style={[styles.renewButton, renewing && styles.disabledButton]}
          disabled={renewing}
          onPress={onRenew}
        >
          <Text style={styles.renewButtonText}>{renewing ? "Đang tạo lại..." : "Tạo lại báo giá"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.countdownCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={styles.countdownRow}>
        <View style={styles.flexOne}>
          <Text style={[styles.countdownTitle, { color: tone.text }]}>Báo giá còn hiệu lực</Text>
          <Text style={styles.countdownNote}>Đến {until} · thiết bị chỉ được giữ sau khi xác nhận thuê</Text>
        </View>
        <Text style={[styles.countdownClock, { color: tone.text }]}>{formatClock(remaining)}</Text>
      </View>
      <View style={styles.countdownTrack}>
        <View style={[styles.countdownBar, { width: `${ratio * 100}%`, backgroundColor: tone.bar }]} />
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function StateCard({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <Ionicons name={icon} size={44} color={Colors.primaryDark} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {action && onAction && (
        <TouchableOpacity style={styles.primaryButton} onPress={onAction}>
          <Text style={styles.primaryButtonText}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHighest,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: "#E4F7D8",
  },
  eyebrow: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
  },
  headerTitle: { color: Colors.onSurface, fontSize: 25, fontWeight: "600" },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  tripCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BCE9A5",
    borderRadius: Radius.xl,
    backgroundColor: "#EAF9E1",
  },
  cardLabel: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  tripTitle: {
    marginTop: 3,
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: "600",
  },
  sectionCard: {
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: "#FFFFFF",
    ...Shadows.card,
  },
  sectionTitle: {
    marginBottom: 8,
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: "600",
  },
  itemRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHighest,
  },
  itemIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: "#EAF9E1",
  },
  itemName: { color: Colors.onSurface, fontSize: 14, fontWeight: "600" },
  itemMeta: { color: Colors.onSurfaceVariant, fontSize: 12 },
  stockText: { color: Colors.primaryDark, fontSize: 13, fontWeight: "600" },
  errorText: { color: Colors.error, fontSize: 13, fontWeight: "600" },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3AAA7",
    borderRadius: Radius.lg,
    backgroundColor: "#FFE6E4",
  },
  errorMessage: {
    flex: 1,
    color: Colors.error,
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
  },
  primaryButtonText: {
    color: Colors.onPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  disabledButton: { opacity: 0.45 },
  quoteCard: {
    gap: 10,
    padding: 18,
    borderRadius: Radius.xl,
    backgroundColor: "#FFFFFF",
    ...Shadows.card,
  },
  quoteTitle: { color: Colors.onSurface, fontSize: 22, fontWeight: "600" },
  progressCard: {
    minHeight: 76,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 24,
    backgroundColor: "#E8EBE6",
  },
  progressIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
  },
  progressTitle: { color: Colors.onSurface, fontSize: 15, fontWeight: "600" },
  progressDescription: {
    marginTop: 3,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 13 },
  depositLine: { marginTop: 2, color: Colors.onSurfaceVariant, fontSize: 11 },
  summaryValue: { color: Colors.onSurface, fontSize: 13, fontWeight: "600" },
  divider: { height: 1, backgroundColor: Colors.surfaceContainerHighest },
  totalRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  totalLabel: { color: Colors.onSurface, fontSize: 15, fontWeight: "600" },
  totalValue: { color: Colors.primaryDark, fontSize: 22, fontWeight: "600" },
  expiryText: { color: Colors.onSurfaceVariant, fontSize: 11 },
  nameRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  gradeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gradeDot: { width: 5, height: 5, borderRadius: 3, opacity: 0.7 },
  gradeText: { fontSize: 11, fontWeight: "500" },
  estimateCard: {
    gap: 6,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
  },
  estimateNote: { color: Colors.onSurfaceMuted, fontSize: 11, lineHeight: 16 },
  countdownCard: { gap: 8, padding: 14, borderRadius: Radius.lg, borderWidth: 1 },
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  countdownTitle: { fontSize: 14, fontWeight: "600" },
  countdownNote: { marginTop: 2, color: Colors.onSurfaceVariant, fontSize: 11, lineHeight: 16 },
  countdownClock: { fontSize: 26, fontWeight: "600", fontVariant: ["tabular-nums"] },
  countdownTrack: { height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.8)" },
  countdownBar: { height: 5, borderRadius: 999 },
  renewButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.md,
    backgroundColor: "#dc2626",
  },
  renewButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  retryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  retryText: { color: Colors.primaryDark, fontSize: 13, fontWeight: "600" },
  stateCard: {
    alignItems: "center",
    gap: 12,
    padding: 28,
    borderRadius: Radius.xl,
    backgroundColor: "#FFFFFF",
    ...Shadows.card,
  },
  stateTitle: { color: Colors.onSurface, fontSize: 22, fontWeight: "600" },
  stateDescription: {
    color: Colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  successIcon: {
    width: 86,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 43,
    backgroundColor: "#DDF7CD",
  },
  successTitle: { color: Colors.onSurface, fontSize: 28, fontWeight: "600" },
  successDescription: {
    color: Colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  successAmount: {
    width: "100%",
    alignItems: "center",
    gap: 5,
    padding: 18,
    borderRadius: Radius.xl,
    backgroundColor: "#FFFFFF",
    ...Shadows.card,
  },
  serverNote: {
    color: Colors.onSurfaceMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
});
