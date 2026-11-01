import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { useAuth } from "@/features/auth/AuthContext";
import { PaymentWebViewModal } from "@/features/bookings/components/PaymentWebViewModal";
import { rentalApi } from "@/features/rentals/api";
import { ApiError } from "@/lib/api-client";
import {
  RentalDepositStatus,
  RentalHandoverPreview,
  RentalOrderDetail,
  RentalPaymentGateway,
  RentalPaymentStatus,
  RentalPickupCode,
} from "@/features/rentals/types";

const ORDER_STEPS = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "READY_FOR_HANDOVER",
  "ACTIVE",
  "RETURN_PENDING",
  "RETURN_PROCESSING",
  "COMPLETED",
];

const STEP_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PREPARING: "Kho đang chuẩn bị",
  READY_FOR_HANDOVER: "Sẵn sàng bàn giao",
  ACTIVE: "Đang sử dụng",
  RETURN_PENDING: "Chờ thu hồi",
  RETURN_PROCESSING: "Đang xử lý trả",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
};

const EXCEPTION_LABELS: Record<string, string> = {
  ACTION_REQUIRED: "TrekGo đang kiểm tra đơn của bạn",
  OVERDUE: "Đơn đã quá hạn trả thiết bị",
  PAYMENT_REVIEW: "Thanh toán đang chờ đối soát",
  REFUND_REVIEW: "Hoàn cọc đang chờ đối soát",
};

const money = (value = 0, currency = "VND") =>
  `${value.toLocaleString("vi-VN")} ${currency === "VND" ? "đ" : currency}`;

const dateTime = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const shortAssetCode = (value?: string) => {
  if (!value) return "Đang cập nhật";
  return value.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
};

const shortOrderId = (value: string) =>
  value.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();

const PAYMENT_LABELS: Record<string, string> = {
  NOT_STARTED: "Chưa thanh toán",
  PENDING: "Đang chờ thanh toán",
  PROCESSING: "Đang xác nhận thanh toán",
  SUCCEEDED: "Thanh toán thành công",
  FAILED: "Thanh toán chưa thành công",
  CANCELLED: "Đã hủy thanh toán",
  EXPIRED: "Thanh toán đã hết hạn",
  PAID: "Đã thanh toán",
  REFUND_PENDING: "Đang hoàn cọc",
  SETTLED: "Đã quyết toán",
};

const paymentLabel = (status?: string | null) =>
  status ? PAYMENT_LABELS[status] || "Đang cập nhật" : "Chưa cập nhật";

const conditionLabel = (condition: string) => {
  const labels: Record<string, string> = {
    NEW: "Mới",
    GOOD: "Tốt",
    FAIR: "Đã qua sử dụng",
    DAMAGED: "Cần sửa chữa",
    LOST: "Thất lạc",
  };
  return labels[condition] || "Đã ghi nhận";
};

const depositItemLabel = (status: string) => {
  const labels: Record<string, string> = {
    HELD: "Đang giữ cọc",
    REFUND_PENDING: "Đang chờ hoàn cọc",
    REFUNDED: "Đã hoàn cọc",
    SETTLED: "Đã quyết toán",
    REVIEW_REQUIRED: "Cần kiểm tra",
    DEDUCTED: "Đã khấu trừ",
  };
  return labels[status] || "Đang xử lý";
};

const gatewayLabel = (gateway: RentalPaymentGateway) =>
  gateway === "vnpay" ? "VNPay" : "MoMo";

const TERMINAL_PAYMENT_STATUSES = new Set([
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);
const PAYMENT_POLL_INTERVAL_MS = 1_500;
const PAYMENT_POLL_TIMEOUT_MS = 60_000;

const paymentStorageKey = (
  orderId: string,
  gateway: RentalPaymentGateway,
) => `rental-payment:${orderId}:${gateway}`;

async function getOrCreatePaymentKey(
  orderId: string,
  gateway: RentalPaymentGateway,
) {
  const storageKey = paymentStorageKey(orderId, gateway);
  const stored = await AsyncStorage.getItem(storageKey);
  if (stored) return stored;

  const key = `mobile-rental-${orderId}-${gateway}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  await AsyncStorage.setItem(storageKey, key);
  return key;
}

async function clearPaymentKeys(orderId: string) {
  await AsyncStorage.multiRemove([
    paymentStorageKey(orderId, "momo"),
    paymentStorageKey(orderId, "vnpay"),
  ]);
}

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

function remainingPaymentTime(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    expired: remaining <= 0,
    label: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}

export default function RentalOrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { accessToken } = useAuth();
  const [detail, setDetail] = useState<RentalOrderDetail>();
  const [payment, setPayment] = useState<RentalPaymentStatus>();
  const [deposit, setDeposit] = useState<RentalDepositStatus>();
  const [handover, setHandover] = useState<RentalHandoverPreview>();
  const [pickupCode, setPickupCode] = useState<RentalPickupCode>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [pollingPayment, setPollingPayment] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState<
    RentalPaymentGateway[]
  >([]);
  const [selectedGateway, setSelectedGateway] =
    useState<RentalPaymentGateway>();
  const [error, setError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [paymentError, setPaymentError] = useState<string>();
  const [paymentNotice, setPaymentNotice] = useState<string>();
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState<string>();
  const [clockTick, setClockTick] = useState(0);
  const awaitingPaymentReturn = useRef(false);
  const paymentPollRunning = useRef(false);
  const paymentPollGeneration = useRef(0);

  const loadOrder = useCallback(
    async (isRefresh = false) => {
      if (!accessToken || !orderId) {
        setError("Thiếu phiên đăng nhập hoặc mã đơn thuê.");
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(undefined);

      try {
        const orderDetail = await rentalApi.getOrder(orderId, accessToken);
        setDetail(orderDetail);

        const [paymentResult, depositResult, handoverResult] =
          await Promise.allSettled([
            rentalApi.getPaymentStatus(orderId, accessToken),
            rentalApi.getDepositStatus(orderId, accessToken),
            rentalApi.getHandoverPreview(orderId, accessToken),
          ]);

        setPayment(
          paymentResult.status === "fulfilled"
            ? paymentResult.value
            : orderDetail.payment ?? undefined,
        );
        setDeposit(
          depositResult.status === "fulfilled"
            ? depositResult.value
            : orderDetail.deposit ?? undefined,
        );
        setHandover(
          handoverResult.status === "fulfilled"
            ? handoverResult.value
            : undefined,
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Không tải được chi tiết đơn thuê.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, orderId],
  );

  const pollPaymentUntilApplied = useCallback(async () => {
    if (!accessToken || !orderId || paymentPollRunning.current) return;

    const generation = ++paymentPollGeneration.current;
    const deadline = Date.now() + PAYMENT_POLL_TIMEOUT_MS;
    paymentPollRunning.current = true;
    setPollingPayment(true);
    setPaymentError(undefined);
    setPaymentNotice("Giao dịch đang được xác nhận. Vui lòng giữ ứng dụng mở.");

    try {
      while (
        Date.now() < deadline &&
        generation === paymentPollGeneration.current
      ) {
        const [orderDetail, paymentStatus] = await Promise.all([
          rentalApi.getOrder(orderId, accessToken),
          rentalApi.getPaymentStatus(orderId, accessToken),
        ]);
        setDetail(orderDetail);
        setPayment(paymentStatus);

        const reservationsConfirmed =
          orderDetail.quantityReservations.length > 0 &&
          orderDetail.quantityReservations.every(
            (reservation) => reservation.status === "CONFIRMED",
          );
        const paymentApplied =
          paymentStatus.status === "SUCCEEDED" &&
          paymentStatus.applicationStatus === "APPLIED" &&
          paymentStatus.invoiceStatus === "PAID" &&
          paymentStatus.orderStatus === "PAID" &&
          paymentStatus.financialStatus === "PAID" &&
          orderDetail.order.status === "PAID" &&
          orderDetail.order.financialStatus === "PAID" &&
          reservationsConfirmed;

        if (paymentApplied) {
          await clearPaymentKeys(orderId);
          setPaymentNotice(
            "Thanh toán thành công. Kho đang nhận nhiệm vụ chuẩn bị thiết bị.",
          );
          return;
        }

        const needsManualReconciliation =
          paymentStatus.applicationStatus === "REJECTED" ||
          paymentStatus.reconciliationStatus === "NEEDS_REVIEW" ||
          paymentStatus.reconciliationRequired;

        if (needsManualReconciliation) {
          setPaymentNotice(undefined);
          setPaymentError(
            `Giao dịch cần hỗ trợ đối soát${
              paymentStatus.applicationReasonCode
                ? ` (${paymentStatus.applicationReasonCode})`
                : ""
            }. Không tạo thêm giao dịch mới.`,
          );
          return;
        }

        if (
          TERMINAL_PAYMENT_STATUSES.has(paymentStatus.status) ||
          ["CANCELLED", "EXPIRED"].includes(orderDetail.order.status)
        ) {
          await clearPaymentKeys(orderId);
          setPaymentNotice(undefined);
          setPaymentError(
            orderDetail.order.status === "EXPIRED"
              ? "Đơn đã hết hạn giữ thiết bị. Hãy tạo báo giá và đơn mới."
              : paymentLabel(paymentStatus.status),
          );
          return;
        }

        await wait(PAYMENT_POLL_INTERVAL_MS);
      }

      if (generation === paymentPollGeneration.current) {
        setPaymentNotice(
          "Giao dịch vẫn đang được xử lý. Hệ thống sẽ tiếp tục tự động cập nhật trạng thái.",
        );
      }
    } catch (requestError) {
      setPaymentError(
        requestError instanceof Error
          ? requestError.message
          : "Không kiểm tra được trạng thái thanh toán.",
      );
    } finally {
      if (generation === paymentPollGeneration.current) {
        paymentPollRunning.current = false;
        setPollingPayment(false);
      }
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOrder();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOrder]);

  useEffect(
    () => () => {
      paymentPollGeneration.current += 1;
      paymentPollRunning.current = false;
    },
    [],
  );

  useEffect(() => {
    if (!detail?.order.paymentExpiresAt || detail.order.status !== "PENDING_PAYMENT") return;
    const interval = setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [detail?.order.paymentExpiresAt, detail?.order.status]);

  useEffect(() => {
    if (!accessToken || detail?.order.status !== "PENDING_PAYMENT") return;

    const timer = setTimeout(() => {
      void rentalApi
        .listPaymentOptions(accessToken)
        .then((options) => {
          const gateways = options.gateways.map((option) => option.gateway);
          setPaymentGateways(gateways);
          setSelectedGateway((current) =>
            current && gateways.includes(current)
              ? current
              : options.defaultGateway &&
                  gateways.includes(options.defaultGateway)
                ? options.defaultGateway
                : gateways[0],
          );
        })
        .catch((requestError) => {
          setPaymentError(
            requestError instanceof Error
              ? requestError.message
              : "Không tải được cổng thanh toán.",
          );
        });
    }, 0);

    return () => clearTimeout(timer);
  }, [accessToken, detail?.order.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && awaitingPaymentReturn.current) {
        awaitingPaymentReturn.current = false;
        void pollPaymentUntilApplied();
      }
    });

    return () => subscription.remove();
  }, [pollPaymentUntilApplied]);

  useEffect(() => {
    const needsAuthoritativeConfirmation =
      detail?.order.status === "PENDING_PAYMENT" &&
      ["PENDING", "PROCESSING", "SUCCEEDED"].includes(payment?.status || "");
    if (!needsAuthoritativeConfirmation) return;

    const timer = setTimeout(() => {
      void pollPaymentUntilApplied();
    }, 0);
    return () => clearTimeout(timer);
  }, [detail?.order.status, payment?.status, pollPaymentUntilApplied]);

  const currentStep = useMemo(() => {
    if (!detail) return -1;
    return ORDER_STEPS.indexOf(detail.order.status);
  }, [detail]);

  async function revealPickupCode() {
    if (!accessToken || !orderId) return;
    setCodeLoading(true);
    setCodeError(undefined);
    try {
      setPickupCode(await rentalApi.getPickupCode(orderId, accessToken));
    } catch (requestError) {
      setCodeError(
        requestError instanceof Error
          ? requestError.message
          : "Không lấy được mã nhận thiết bị.",
      );
    } finally {
      setCodeLoading(false);
    }
  }

  async function startPayment() {
    if (!accessToken || !orderId || !selectedGateway) return;

    setPaying(true);
    setPaymentError(undefined);
    setPaymentNotice(undefined);
    if (["FAILED", "CANCELLED", "EXPIRED"].includes(payment?.status || "")) {
      await AsyncStorage.removeItem(paymentStorageKey(orderId, selectedGateway));
    }

    try {
      const idempotencyKey = await getOrCreatePaymentKey(
        orderId,
        selectedGateway,
      );
      const checkout = await rentalApi.createPayment(
        orderId,
        { gateway: selectedGateway, paymentMethod: "REDIRECT" },
        idempotencyKey,
        accessToken,
      );

      const checkoutUrl = checkout.checkout?.url;
      if (
        checkoutUrl &&
        ["PENDING", "PROCESSING"].includes(checkout.status)
      ) {
        awaitingPaymentReturn.current = true;
        setPaymentCheckoutUrl(checkoutUrl);
      } else {
        setPaymentNotice(
          "Giao dịch đã được ghi nhận và đang được kiểm tra. Không cần thanh toán lại.",
        );
        void pollPaymentUntilApplied();
      }
    } catch (requestError) {
      awaitingPaymentReturn.current = false;
      if (
        requestError instanceof ApiError &&
        requestError.code === "PAYMENT_ATTEMPT_IN_PROGRESS"
      ) {
        setPaymentNotice(
          "Đã có giao dịch đang xử lý. Ứng dụng sẽ tiếp tục theo dõi giao dịch hiện tại.",
        );
        void pollPaymentUntilApplied();
      } else {
        if (
          requestError instanceof ApiError &&
          requestError.code === "PAYMENT_WINDOW_EXPIRED"
        ) {
          await AsyncStorage.removeItem(
            paymentStorageKey(orderId, selectedGateway),
          );
          setPaymentError(
            "Thời gian giữ thiết bị đã hết. Vui lòng tạo đơn thuê mới thay vì thanh toán lại đơn cũ.",
          );
          void loadOrder(true);
          return;
        }
        if (
          requestError instanceof ApiError &&
          [
            "PAYMENT_INVALID_STATE",
            "RENTAL_CUTOFF_PASSED",
            "TRIP_MEMBERSHIP_NOT_ELIGIBLE",
          ].includes(requestError.code ?? "")
        ) {
          void loadOrder(true);
        }
        setPaymentError(
          requestError instanceof Error
            ? `${requestError.message}${
                requestError instanceof ApiError && requestError.retryable
                  ? " Bạn có thể thử lại với cùng giao dịch."
                  : ""
              }`
            : "Không khởi tạo được thanh toán Rental.",
        );
      }
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <TrekkingLoader
            label="Đang mở hành trình đơn thuê..."
            hint="Đang đồng bộ thanh toán, thiết bị và tiến trình bàn giao"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail || error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header onBack={() => router.back()} />
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={52} color={Colors.primaryDark} />
          <Text style={styles.emptyTitle}>Chưa tải được đơn thuê</Text>
          <Text style={styles.mutedText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadOrder()}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { order, items, assignedUnits = [], timeline = [] } = detail;
  const tripTitle = order.trip?.title?.trim();
  const canShowPickupCode = order.status === "READY_FOR_HANDOVER";
  const canCancelOrder = [
    "PENDING_PAYMENT",
    "PAID",
    "PREPARING",
    "READY_FOR_HANDOVER",
  ].includes(order.status);
  const paymentCountdown = remainingPaymentTime(order.paymentExpiresAt);
  const canStartPayment =
    order.status === "PENDING_PAYMENT" &&
    !paymentCountdown?.expired &&
    !payment?.reconciliationRequired &&
    payment?.applicationStatus !== "REJECTED" &&
    payment?.reconciliationStatus !== "NEEDS_REVIEW" &&
    (payment?.nextAction?.type === "CREATE_PAYMENT" ||
      payment?.nextAction?.type === "RETRY_PAYMENT" ||
      (!payment?.nextAction &&
        ["NOT_STARTED", "FAILED", "CANCELLED", "EXPIRED"].includes(
          payment?.status || "NOT_STARTED",
        )));
  const paymentNeedsConfirmation =
    order.status === "PENDING_PAYMENT" &&
    ["PENDING", "PROCESSING", "SUCCEEDED"].includes(payment?.status || "");
  const paymentBusy =
    paying || pollingPayment || paymentNeedsConfirmation || Boolean(paymentCheckoutUrl);
  void clockTick;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadOrder(true)}
            tintColor={Colors.primaryDark}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="bag-check-outline" size={24} color={Colors.primaryDark} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.eyebrow}>ĐƠN THUÊ THIẾT BỊ</Text>
            <Text style={styles.orderId}>{tripTitle || "Chuyến đi của bạn"}</Text>
            {order.orderCode ? <Text style={styles.tripName}>Mã đơn {order.orderCode}</Text> : null}
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {STEP_LABELS[order.status] || order.status.replaceAll("_", " ")}
            </Text>
          </View>
        </View>

        {order.exceptionStatus && order.exceptionStatus !== "NONE" && (
          <InfoBanner
            tone="warning"
            icon="warning-outline"
            title={EXCEPTION_LABELS[order.exceptionStatus] || "Đơn cần được kiểm tra"}
            description="Hệ thống hoặc nhân viên đang tiếp tục xử lý trạng thái này."
          />
        )}

        <Section
          title="Tiến trình đơn thuê"
          subtitle={`Mã tra cứu ${shortOrderId(order.id)} · Trạng thái do hệ thống và nhân viên cập nhật`}
        >
          {ORDER_STEPS.map((step, index) => {
            const complete = currentStep >= index;
            const active = currentStep === index;
            return (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  <View
                    style={[
                      styles.stepDot,
                      complete && styles.stepDotComplete,
                      active && styles.stepDotActive,
                    ]}
                  >
                    {complete && (
                      <Ionicons name="checkmark" size={12} color={Colors.onPrimary} />
                    )}
                  </View>
                  {index < ORDER_STEPS.length - 1 && (
                    <View style={[styles.stepLine, complete && styles.stepLineComplete]} />
                  )}
                </View>
                <View style={styles.stepTextWrap}>
                  <Text style={[styles.stepTitle, complete && styles.stepTitleComplete]}>
                    {STEP_LABELS[step]}
                  </Text>
                  {active && <Text style={styles.stepCurrent}>Trạng thái hiện tại</Text>}
                </View>
              </View>
            );
          })}
        </Section>

        <Section
          title="Thiết bị đã đặt"
          subtitle="Thiết bị cụ thể sẽ được cập nhật sau khi Kho chuẩn bị"
        >
          {items.map((item) => (
            <View key={item.id} style={styles.lineItem}>
              {item.imageUrl || item.product?.imageUrl ? (
                <Image source={{ uri: item.imageUrl || item.product?.imageUrl }} style={styles.lineImage} />
              ) : (
                <View style={styles.lineIcon}>
                  <Ionicons name="cube-outline" size={18} color={Colors.primaryDark} />
                </View>
              )}
              <View style={styles.flexOne}>
                <Text style={styles.lineName}>
                  {item.name || item.product?.name || "Thiết bị thuê"}
                </Text>
                <Text style={styles.lineMeta}>
                  Số lượng: {item.quantity}
                  {(item.sku || item.product?.sku) ? ` · SKU ${item.sku || item.product?.sku}` : ""}
                  {item.product?.grade ? ` · ${item.product.grade === "LIKE_NEW" ? "Mới" : "Sử dụng tốt"}` : ""}
                </Text>
                {typeof item.depositPerUnit === "number" && typeof item.depositAmount === "number" ? (
                  <Text style={styles.lineMeta}>
                    Cọc {money(item.depositPerUnit, order.currency)}/món × {item.quantity} ={" "}
                    {money(item.depositAmount, order.currency)}
                    {typeof item.depositExplanation?.percentageOfReplacementValue === "number"
                      ? ` · ≈ ${item.depositExplanation.percentageOfReplacementValue.toLocaleString("vi-VN")}% giá trị thay thế`
                      : ""}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.lineAmount}>
                {money(item.feeAmount, order.currency)}
              </Text>
            </View>
          ))}
          {assignedUnits.length > 0 && (
            <View style={styles.unitWrap}>
              <Text style={styles.subheading}>Thiết bị vật lý đã gán</Text>
              {assignedUnits.map((unit, index) => (
                <Text key={`${unit.id ?? unit.unitId ?? unit.assetCode ?? "unit"}-${index}`} style={styles.unitText}>
                  • {unit.productName ? `${unit.productName} · ` : ""}
                  Mã {shortAssetCode(unit.assetCode)}
                  {unit.condition ? ` · ${conditionLabel(unit.condition)}` : ""}
                </Text>
              ))}
            </View>
          )}
        </Section>

        <Section title="Thanh toán" subtitle="Theo dõi giao dịch an toàn, không thanh toán lặp lại">
          <MoneyRow label="Phí thuê" value={order.rentalFee} currency={order.currency} />
          <MoneyRow label="Tiền cọc" value={order.totalDeposit} currency={order.currency} />
          <View style={styles.totalDivider} />
          <MoneyRow label="Tổng cộng" value={order.totalAmount} currency={order.currency} strong />
          <Text style={styles.paymentStatus}>
            {paymentLabel(payment?.status || order.financialStatus)}
          </Text>
          {payment?.status === "SUCCEEDED" &&
            payment.applicationStatus !== "APPLIED" && (
              <Text style={styles.readOnlyNote}>
                Cổng thanh toán đã ghi nhận tiền. Hệ thống vẫn đang xác nhận đơn thuê;
                chưa chuyển sang bước chuẩn bị thiết bị.
              </Text>
            )}
          {(payment?.applicationStatus === "REJECTED" ||
            payment?.reconciliationStatus === "NEEDS_REVIEW" ||
            payment?.reconciliationRequired) && (
              <Text style={styles.inlineError}>
                Giao dịch cần hỗ trợ đối soát. Không thanh toán lại để tránh trùng giao dịch.
              </Text>
            )}
          {order.paymentExpiresAt && (
            <Text style={styles.deadline}>Hạn thanh toán: {dateTime(order.paymentExpiresAt)}</Text>
          )}
          {order.status === "PENDING_PAYMENT" && paymentCountdown && (
            <View style={[styles.countdownCard, paymentCountdown.expired && styles.countdownExpired]}>
              <View style={styles.countdownIcon}>
                <Ionicons name="time-outline" size={21} color={paymentCountdown.expired ? Colors.error : Colors.inkDeep} />
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.countdownLabel}>
                  {paymentCountdown.expired ? "Phiên thanh toán đã hết hạn" : "Thời gian còn lại để chuyển khoản"}
                </Text>
                {!paymentCountdown.expired && <Text style={styles.countdownValue}>{paymentCountdown.label}</Text>}
              </View>
            </View>
          )}
          {order.status === "PENDING_PAYMENT" && paymentCountdown?.expired && (
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => router.replace("/(tabs)/rental")}
            >
              <Ionicons name="refresh-outline" size={18} color={Colors.onPrimary} />
              <Text style={styles.payButtonText}>Chọn lại thiết bị và tạo đơn mới</Text>
            </TouchableOpacity>
          )}
          {paymentBusy ? (
            <TrekkingLoader
              label={payment?.status === "SUCCEEDED" ? "Đang đưa thanh toán về đích..." : "Đang dò tín hiệu thanh toán..."}
              compact
            />
          ) : canStartPayment ? (
            <>
              <View style={styles.gatewayRow}>
                {paymentGateways.map((gateway) => {
                  const selected = selectedGateway === gateway;
                  return (
                    <TouchableOpacity
                      key={gateway}
                      style={[
                        styles.gatewayButton,
                        selected && styles.gatewayButtonSelected,
                      ]}
                      onPress={() => {
                        setSelectedGateway(gateway);
                      }}
                    >
                      <Text
                        style={[
                          styles.gatewayText,
                          selected && styles.gatewayTextSelected,
                        ]}
                      >
                        {gatewayLabel(gateway)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[
                  styles.payButton,
                  !selectedGateway && styles.buttonDisabled,
                ]}
                disabled={!selectedGateway}
                onPress={() => void startPayment()}
              >
                <Ionicons name="card-outline" size={18} color={Colors.onPrimary} />
                <Text style={styles.payButtonText}>Thanh toán ngay</Text>
              </TouchableOpacity>
              {paymentGateways.length === 0 && !paymentError && (
                <Text style={styles.readOnlyNote}>Đang chuẩn bị phương thức thanh toán...</Text>
              )}
            </>
          ) : null}
          {paymentNotice && (
            <Text style={styles.paymentNotice}>{paymentNotice}</Text>
          )}
          {paymentError && <Text style={styles.inlineError}>{paymentError}</Text>}
        </Section>

        {canShowPickupCode && (
          <Section title="Mã nhận thiết bị" subtitle="Chỉ đưa mã này cho nhân viên giao nhận tại điểm nhận">
            {pickupCode ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeValue}>{pickupCode.pickupCode}</Text>
                <Text style={styles.codeExpiry}>Hết hạn: {dateTime(pickupCode.expiresAt)}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.revealButton}
                disabled={codeLoading}
                onPress={() => void revealPickupCode()}
              >
                {codeLoading ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="eye-outline" size={18} color={Colors.onPrimary} />
                    <Text style={styles.revealText}>Hiển thị mã nhận</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {codeError && <Text style={styles.inlineError}>{codeError}</Text>}
            {handover?.conditionSnapshots?.length ? (
              <Text style={styles.readOnlyNote}>
                Có {handover.conditionSnapshots.length} bản ghi tình trạng trước giao. Bạn kiểm tra trực tiếp và báo Staff nếu có sai lệch.
              </Text>
            ) : null}
          </Section>
        )}

        {deposit && (
          <Section title="Theo dõi tiền cọc" subtitle="Cọc được xử lý riêng theo từng thiết bị">
            <MoneyRow label="Đã thu" value={deposit.collectedAmount} currency={order.currency} />
            <MoneyRow label="Đang giữ" value={deposit.heldAmount} currency={order.currency} />
            <MoneyRow
              label="Đang chờ hoàn"
              value={deposit.refundPendingAmount}
              currency={order.currency}
            />
            <MoneyRow label="Đã hoàn" value={deposit.refundedAmount} currency={order.currency} />
            <MoneyRow label="Khấu trừ" value={deposit.deductionAmount} currency={order.currency} />
            {deposit.items.map((item) => (
              <View key={item.unitId} style={styles.depositItem}>
                <View style={styles.flexOne}>
                  <Text style={styles.lineName}>Mã thiết bị {shortAssetCode(item.assetCode)}</Text>
                  <Text style={styles.lineMeta}>{depositItemLabel(item.status)}</Text>
                  {item.reason ? <Text style={styles.reasonText}>{item.reason}</Text> : null}
                </View>
                <Text style={styles.lineAmount}>
                  {money(item.depositAmount ?? item.amount, order.currency)}
                </Text>
              </View>
            ))}
            {deposit.items.some(
              (item) =>
                item.status === "REVIEW_REQUIRED" ||
                item.heldReason === "FINAL_PASS_AWAIT_GROUPED_REFUND",
            ) && (
              <Text style={styles.readOnlyNote}>
                Đang chờ xử lý hoàn cọc. Đây chưa phải trạng thái đã hoàn tiền; nếu kéo
                dài, vui lòng liên hệ hỗ trợ.
              </Text>
            )}
          </Section>
        )}

        {timeline.length > 0 && (
          <Section title="Lịch sử cập nhật">
            {timeline.map((event, index) => (
              <View key={event.id || `${event.status}-${index}`} style={styles.historyRow}>
                <Ionicons name="time-outline" size={17} color={Colors.primaryDark} />
                <View style={styles.flexOne}>
                  <Text style={styles.historyTitle}>{event.title || event.status || "Cập nhật đơn"}</Text>
                  {event.description ? <Text style={styles.lineMeta}>{event.description}</Text> : null}
                  <Text style={styles.historyTime}>{dateTime(event.occurredAt || event.createdAt)}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        {canCancelOrder && (
          <TouchableOpacity
            style={styles.cancelOrderButton}
            activeOpacity={0.82}
            onPress={() =>
              router.push(`/rental-orders/${orderId}/cancel` as Href)
            }
          >
            <Ionicons name="close-circle-outline" size={21} color={Colors.error} />
            <View style={styles.flexOne}>
              <Text style={styles.cancelOrderTitle}>Hủy đơn thuê</Text>
              <Text style={styles.cancelOrderDescription}>
                Xem chính sách và số tiền được hoàn trước khi xác nhận.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.error} />
          </TouchableOpacity>
        )}

        <InfoBanner
          icon="shield-checkmark-outline"
          title="Đúng quyền Trekker"
          description="Bạn chỉ theo dõi và xuất trình mã nhận. Staff chịu trách nhiệm bàn giao, thu hồi, kiểm định; Admin xử lý khấu trừ và hệ thống thực hiện hoàn cọc."
        />
      </ScrollView>
      {paymentCheckoutUrl ? (
        <PaymentWebViewModal
          visible
          url={paymentCheckoutUrl}
          title="Thanh toán đơn thuê"
          onClose={() => {
            setPaymentCheckoutUrl(undefined);
            awaitingPaymentReturn.current = false;
            setPaymentNotice(
              "Đã đóng cổng thanh toán. Hệ thống sẽ kiểm tra giao dịch hiện tại.",
            );
            void pollPaymentUntilApplied();
          }}
          onPaymentComplete={(result) => {
            setPaymentCheckoutUrl(undefined);
            awaitingPaymentReturn.current = false;
            setPaymentNotice(
              result.message ??
              "Đã nhận kết quả từ cổng thanh toán. Giao dịch đang được xác nhận.",
            );
            void pollPaymentUntilApplied();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
      </TouchableOpacity>
      <View style={styles.flexOne}>
        <Text style={styles.eyebrow}>TREKGO GEAR</Text>
        <Text style={styles.headerTitle}>Chi tiết đơn thuê</Text>
      </View>
      <View style={styles.headerButton}>
        <Ionicons name="receipt-outline" size={21} color={Colors.primaryDark} />
      </View>
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function MoneyRow({
  label,
  value,
  currency,
  strong = false,
}: {
  label: string;
  value?: number;
  currency?: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.moneyRow}>
      <Text style={[styles.moneyLabel, strong && styles.moneyStrong]}>{label}</Text>
      <Text style={[styles.moneyValue, strong && styles.moneyStrong]}>
        {money(value, currency)}
      </Text>
    </View>
  );
}

function InfoBanner({
  icon,
  title,
  description,
  tone = "normal",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  tone?: "normal" | "warning";
}) {
  return (
    <View style={[styles.infoBanner, tone === "warning" && styles.warningBanner]}>
      <Ionicons
        name={icon}
        size={22}
        color={tone === "warning" ? "#A32020" : Colors.primaryDark}
      />
      <View style={styles.flexOne}>
        <Text style={[styles.infoTitle, tone === "warning" && styles.warningText]}>{title}</Text>
        <Text style={styles.infoDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  flexOne: { flex: 1 },
  cancelOrderButton: {
    marginBottom: 16,
    padding: 16,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "#F2B8B5",
    backgroundColor: "#FFF8F7",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cancelOrderTitle: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: "800",
  },
  cancelOrderDescription: {
    marginTop: 3,
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 18,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: "600", letterSpacing: 1 },
  headerTitle: { marginTop: 2, color: Colors.onSurface, fontSize: 20, fontWeight: "600" },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  emptyTitle: { color: Colors.onSurface, fontSize: 20, fontWeight: "600", textAlign: "center" },
  mutedText: { color: Colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, textAlign: "center" },
  retryButton: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  retryText: { color: Colors.onPrimaryDark, fontWeight: "600" },
  heroCard: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.xl, backgroundColor: Colors.inkDeep, ...Shadows.tactical },
  heroIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.primary },
  orderId: { marginTop: 3, color: Colors.onPrimaryDark, fontSize: 17, lineHeight: 22, fontWeight: "600" },
  tripName: { marginTop: 4, color: Colors.primaryNeutral, fontSize: 11 },
  statusBadge: { maxWidth: 112, paddingHorizontal: 9, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.primary },
  statusBadgeText: { color: Colors.onPrimary, fontSize: 9, fontWeight: "600", textAlign: "center" },
  section: { padding: 16, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, ...Shadows.card },
  sectionTitle: { color: Colors.onSurface, fontSize: 17, fontWeight: "600" },
  sectionSubtitle: { marginTop: 4, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 15 },
  sectionBody: { marginTop: 14 },
  stepRow: { minHeight: 48, flexDirection: "row", gap: 10 },
  stepRail: { width: 22, alignItems: "center" },
  stepDot: { width: 18, height: 18, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, borderWidth: 2, borderColor: Colors.surfaceContainerHighest, backgroundColor: Colors.surfaceContainerLowest },
  stepDotComplete: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryDark },
  stepDotActive: { borderWidth: 4, borderColor: Colors.primary, backgroundColor: Colors.primaryDark },
  stepLine: { flex: 1, width: 2, backgroundColor: Colors.surfaceContainerHighest },
  stepLineComplete: { backgroundColor: Colors.primaryDark },
  stepTextWrap: { flex: 1, paddingBottom: 12 },
  stepTitle: { color: Colors.onSurfaceMuted, fontSize: 12, fontWeight: "500" },
  stepTitleComplete: { color: Colors.onSurface, fontWeight: "600" },
  stepCurrent: { marginTop: 3, color: Colors.primaryDark, fontSize: 9, fontWeight: "600" },
  lineItem: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  lineIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  lineImage: { width: 52, height: 52, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainer },
  lineName: { color: Colors.onSurface, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  lineMeta: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 10 },
  lineAmount: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  unitWrap: { marginTop: 12, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  subheading: { marginBottom: 6, color: Colors.primaryDark, fontSize: 10, fontWeight: "600" },
  unitText: { color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 17 },
  moneyRow: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  moneyLabel: { color: Colors.onSurfaceVariant, fontSize: 11 },
  moneyValue: { color: Colors.onSurface, fontSize: 11, fontWeight: "600" },
  moneyStrong: { color: Colors.primaryDark, fontSize: 14, fontWeight: "600" },
  totalDivider: { height: 1, marginVertical: 8, backgroundColor: Colors.surfaceContainer },
  paymentStatus: { marginTop: 12, color: Colors.onSurface, fontSize: 10, fontWeight: "600" },
  deadline: { marginTop: 4, color: "#A32020", fontSize: 10 },
  countdownCard: { marginTop: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: Colors.primaryNeutral, borderRadius: Radius.lg, backgroundColor: Colors.primaryPale },
  countdownExpired: { borderColor: "#F3AAA7", backgroundColor: "#FFE5E2" },
  countdownIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: "#fff" },
  countdownLabel: { color: Colors.onSurfaceVariant, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  countdownValue: { marginTop: 2, color: Colors.inkDeep, fontSize: 25, lineHeight: 30, fontWeight: "700", letterSpacing: 1.5 },
  gatewayRow: { marginTop: 14, flexDirection: "row", gap: 8 },
  gatewayButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, backgroundColor: Colors.surfaceContainerLowest },
  gatewayButtonSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryPale },
  gatewayText: { color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: "600" },
  gatewayTextSelected: { color: Colors.primaryDark },
  payButton: { marginTop: 10, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  payButtonText: { color: Colors.onPrimary, fontWeight: "600" },
  buttonDisabled: { opacity: 0.55 },
  checkPaymentButton: { marginTop: 12, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primaryDark },
  checkPaymentText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  paymentNotice: { marginTop: 9, color: Colors.primaryDark, fontSize: 10, lineHeight: 16, textAlign: "center" },
  paymentProgress: { marginTop: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primaryNeutral, backgroundColor: Colors.primaryPale },
  paymentProgressIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLowest },
  paymentProgressTitle: { color: Colors.primaryDark, fontSize: 12, fontWeight: "600" },
  paymentProgressDescription: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 15 },
  codeBox: { padding: 18, alignItems: "center", borderRadius: Radius.lg, backgroundColor: Colors.inkDeep },
  codeValue: { color: Colors.primary, fontSize: 30, fontWeight: "600", letterSpacing: 5 },
  codeExpiry: { marginTop: 6, color: Colors.primaryNeutral, fontSize: 10 },
  revealButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: Radius.full, backgroundColor: Colors.primaryDark },
  revealText: { color: Colors.onPrimaryDark, fontWeight: "600" },
  inlineError: { marginTop: 8, color: "#A32020", fontSize: 10, textAlign: "center" },
  readOnlyNote: { marginTop: 10, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 16 },
  depositItem: { marginTop: 10, paddingTop: 10, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.surfaceContainer },
  reasonText: { marginTop: 3, color: "#A32020", fontSize: 9 },
  historyRow: { paddingVertical: 9, flexDirection: "row", gap: 9, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  historyTitle: { color: Colors.onSurface, fontSize: 11, fontWeight: "600" },
  historyTime: { marginTop: 3, color: Colors.onSurfaceMuted, fontSize: 9 },
  infoBanner: { padding: 14, flexDirection: "row", gap: 10, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primaryNeutral, backgroundColor: Colors.primaryPale },
  warningBanner: { borderColor: "#F3AAA7", backgroundColor: "#FFE5E2" },
  infoTitle: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  warningText: { color: "#A32020" },
  infoDescription: { marginTop: 3, color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 16 },
});
