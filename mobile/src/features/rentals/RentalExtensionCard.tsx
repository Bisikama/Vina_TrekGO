import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  Button,
  Colors,
  ErrorAlert,
  InfoBanner,
  LoadingState,
  Radius,
  Spacing,
  StatusBadge,
  SurfaceCard,
  Typography,
  type StatusTone,
} from "@/components/ui";
import { formatVnd } from "@/constants/designTokens";
import { PaymentWebViewModal } from "@/features/bookings/components/PaymentWebViewModal";
import { WheelDatePickerModal } from "@/features/leaders/components/WheelDatePickerModal";
import { formatVnDate, getDayOfWeekName, parseVnDate } from "@/features/leaders/utils/tripDateUtils";
import { ApiError, apiRequest } from "@/lib/api-client";
import { rentalApi } from "./api";
import type { RentalPaymentGateway } from "./types";

type Envelope<T> = T | { data: T };
type ReturnOption = { id: string; pointName: string; available: boolean; windowStart: string; windowEnd: string };
type Quote = {
  extensionQuoteId: string;
  currentDueAt: string;
  requestedReturnAt: string;
  additionalFee: number;
  currency: string;
  chargedDays: number;
  expiresAt: string;
  expectedVersion: number;
  termsVersion: string;
  termsHash: string;
};
type ExtensionStatus = "QUOTED" | "PENDING_PAYMENT" | "APPLIED" | "REJECTED_CAPACITY" | "EXPIRED" | "PAYMENT_FAILED" | "CANCELLED";
type Extension = {
  id: string;
  status: ExtensionStatus;
  previousRentalEndAt: string;
  requestedRentalEndAt: string;
  additionalFee: number;
  currency: string;
  holdExpiresAt: string | null;
};

const STATUS_META: Record<ExtensionStatus, { label: string; tone: StatusTone }> = {
  QUOTED: { label: "Đã báo giá", tone: "neutral" },
  PENDING_PAYMENT: { label: "Chờ thanh toán", tone: "warning" },
  APPLIED: { label: "Đã gia hạn", tone: "success" },
  REJECTED_CAPACITY: { label: "Hết thiết bị", tone: "danger" },
  EXPIRED: { label: "Đã hết hạn", tone: "neutral" },
  PAYMENT_FAILED: { label: "Thanh toán lỗi", tone: "danger" },
  CANCELLED: { label: "Đã huỷ", tone: "neutral" },
};

/** Mã lỗi gia hạn → câu tiếng Việt (backend trả message tiếng Anh cho các mã này). */
const ERRORS: Record<string, string> = {
  EXTENSION_LIMIT_EXCEEDED: "Đơn đã gia hạn đủ số lần cho phép.",
  EXTENSION_TOO_LATE: "Đã quá thời điểm cho phép gia hạn (quá gần hoặc đã qua hạn trả).",
  EXTENSION_RETURN_STARTED: "Kho đã bắt đầu kiểm tra đồ trả nên không gia hạn được nữa.",
  EXTENSION_RETURN_TASK_STARTED: "Nhân viên đã bắt đầu thu hồi đồ nên không gia hạn được nữa.",
  EXTENSION_INVALID_ORDER_STATE: "Đơn hiện không ở trạng thái cho phép gia hạn.",
  EXTENSION_ALREADY_PENDING: "Đơn đang có một yêu cầu gia hạn chờ thanh toán.",
  EXTENSION_END_NOT_LATER: "Giờ trả mới phải sau hạn trả hiện tại.",
  EXTENSION_QUOTE_EXPIRED: "Báo giá đã hết hạn, vui lòng xem lại phí gia hạn.",
  EXTENSION_QUOTE_NOT_FOUND: "Báo giá không còn hiệu lực, vui lòng xem lại phí gia hạn.",
  EXTENSION_HOLD_EXPIRED: "Thời gian giữ thiết bị cho lần gia hạn này đã hết.",
  EXTENSION_POLICY_NOT_CONFIGURED: "Chính sách gia hạn chưa được cấu hình cho đơn này.",
  EXTENSION_NOT_CONFIGURED: "Chính sách gia hạn chưa được cấu hình cho đơn này.",
  RENTAL_DURATION_NOT_ALLOWED: "Thời gian thuê mới vượt quá giới hạn cho phép.",
  RENTAL_RETURN_OPTION_UNAVAILABLE: "Giờ trả này nằm ngoài khung được phép trả muộn.",
  INSUFFICIENT_AVAILABLE_QUANTITY: "Không đủ thiết bị cho thời gian gia hạn này.",
  VERSION_CONFLICT: "Đơn vừa được cập nhật. Vui lòng xem lại phí gia hạn.",
};
const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiError && e.code && ERRORS[e.code] ? ERRORS[e.code] : e instanceof Error && e.message ? e.message : fallback;

const TIME_PRESETS = ["07:00", "09:00", "11:00", "13:30", "15:00", "17:00", "19:00"];
const unwrap = <T,>(x: Envelope<T>): T => (x && typeof x === "object" && "data" in x ? (x as { data: T }).data : (x as T));
const newKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateTime = (value: string | Date) => new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
// Tiền luôn là VND trong hệ thống; giữ tham số để đọc rõ nơi gọi.
const money = (value: number, _currency?: string) => formatVnd(value);

function combine(dateStr: string, time: string): Date | null {
  const day = parseVnDate(dateStr);
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!day || !m) return null;
  const [hour, minute] = [Number(m[1]), Number(m[2])];
  if (hour > 23 || minute > 59) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

/**
 * Gia hạn thuê: khách đang giữ đồ chọn giờ trả mới → xem phí → xác nhận → thanh toán nếu có phí.
 * Khung giờ được phép (returnOptions) và phí do server quyết định.
 */
export function RentalExtensionCard({
  orderId,
  tripId,
  accessToken,
  orderStatus,
  dueAt,
  currency,
  onExtended,
}: {
  orderId: string;
  tripId?: string | null;
  accessToken?: string | null;
  orderStatus: string;
  dueAt?: string | null;
  currency: string;
  onExtended: () => void;
}) {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [option, setOption] = useState<ReturnOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dateStr, setDateStr] = useState("");
  const [time, setTime] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [gateway, setGateway] = useState<RentalPaymentGateway | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const confirmKey = useRef<string | null>(null);
  const payKeys = useRef<Record<string, string>>({});
  const due = useMemo(() => (dueAt ? new Date(dueAt) : null), [dueAt]);

  const fetchState = useCallback(async () => {
    if (!accessToken) return { items: [] as Extension[], option: null as ReturnOption | null };
    const [list, eligibility] = await Promise.all([
      apiRequest<Envelope<{ items: Extension[] }>>(`/api/v1/rental-orders/${orderId}/extensions`, { accessToken }).catch(() => null),
      orderStatus === "ACTIVE" && tripId
        ? apiRequest<Envelope<{ returnOptions?: ReturnOption[] }>>(`/api/v1/trips/${tripId}/rental-eligibility`, { accessToken }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const options = (eligibility ? unwrap(eligibility).returnOptions ?? [] : []).filter((item) => item.available);
    return { items: list ? unwrap(list).items ?? [] : [], option: options[0] ?? null };
  }, [accessToken, orderId, orderStatus, tripId]);

  const reload = useCallback(async () => {
    const next = await fetchState();
    setExtensions(next.items);
    setOption(next.option);
    return next.items;
  }, [fetchState]);

  useEffect(() => {
    let active = true;
    fetchState()
      .then((next) => {
        if (!active) return;
        setExtensions(next.items);
        setOption(next.option);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    if (accessToken) {
      rentalApi
        .listPaymentOptions(accessToken)
        .then((result) => {
          if (!active) return;
          const available = (result.gateways ?? []).map((item) => item.gateway as RentalPaymentGateway);
          setGateway(available.includes("vnpay") ? "vnpay" : (available[0] ?? null));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [accessToken, fetchState]);

  const history = extensions.filter((item) => item.status !== "QUOTED");
  if (orderStatus !== "ACTIVE" && history.length === 0) return null;

  const now = new Date();
  const pending = extensions.find(
    (item) => item.status === "PENDING_PAYMENT" && (!item.holdExpiresAt || new Date(item.holdExpiresAt) > now),
  );
  const windowEnd = option ? new Date(option.windowEnd) : null;
  const picked = combine(dateStr, time);
  const pickedError = !picked
    ? null
    : due && picked <= due
      ? `Giờ trả mới phải sau hạn hiện tại (${dateTime(due)}).`
      : windowEnd && picked > windowEnd
        ? `Chỉ gia hạn được tới ${dateTime(windowEnd)}.`
        : null;
  const canExtend = orderStatus === "ACTIVE" && !!option && !pending;
  const presetDisabled = (preset: string) => {
    const at = combine(dateStr, preset);
    return !!at && ((!!due && at <= due) || (!!windowEnd && at > windowEnd));
  };

  const changeSlot = (nextDate: string, nextTime: string) => {
    setQuote(null);
    setAgreed(false);
    setError("");
    setDateStr(nextDate);
    setTime(nextTime);
  };

  async function getQuote() {
    if (!accessToken || !option || !picked || pickedError) {
      setError(pickedError ?? "Vui lòng chọn ngày và giờ trả mới.");
      return;
    }
    setBusy("quote");
    setError("");
    try {
      const result = await apiRequest<Envelope<Quote>>(`/api/v1/rental-orders/${orderId}/extension-quotes`, {
        method: "POST",
        accessToken,
        body: JSON.stringify({ requestedReturnAt: picked.toISOString(), returnOptionId: option.id }),
      });
      setQuote(unwrap(result));
      setAgreed(false);
      confirmKey.current = null;
    } catch (e) {
      setError(errorText(e, "Không tính được phí gia hạn."));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!accessToken || !quote || !agreed) return;
    if (new Date(quote.expiresAt) <= new Date()) {
      setQuote(null);
      setError("Báo giá đã hết hạn, vui lòng xem phí lại.");
      return;
    }
    setBusy("confirm");
    setError("");
    confirmKey.current ??= newKey("rental-extension");
    try {
      const result = unwrap(
        await apiRequest<Envelope<{ extensionId: string; status: string; additionalFee: number }>>(
          `/api/v1/rental-orders/${orderId}/extensions`,
          {
            method: "POST",
            accessToken,
            headers: { "Idempotency-Key": confirmKey.current },
            body: JSON.stringify({
              extensionQuoteId: quote.extensionQuoteId,
              expectedVersion: quote.expectedVersion,
              acceptedTermsVersion: quote.termsVersion,
              termsHash: quote.termsHash,
            }),
          },
        ),
      );
      confirmKey.current = null;
      setQuote(null);
      setOpen(false);
      setDateStr("");
      setTime("");
      if (result.status === "APPLIED") {
        setNotice("Đã gia hạn. Hạn trả mới đã được cập nhật.");
        onExtended();
      } else {
        setNotice(`Đã giữ thiết bị cho lần gia hạn. Thanh toán ${money(result.additionalFee, currency)} để hoàn tất.`);
      }
      await reload();
    } catch (e) {
      confirmKey.current = null;
      setError(errorText(e, "Không xác nhận được gia hạn."));
    } finally {
      setBusy(null);
    }
  }

  async function pay(extension: Extension) {
    if (!accessToken || !gateway) return;
    setBusy("pay");
    setError("");
    const keyName = `${extension.id}:${gateway}`;
    payKeys.current[keyName] ??= newKey("rental-extension-pay");
    try {
      const payment = unwrap(
        await apiRequest<Envelope<{ status: string; checkout?: { url?: string } | null; reconciliationRequired?: boolean }>>(
          `/api/v1/rental-extensions/${extension.id}/payments`,
          {
            method: "POST",
            accessToken,
            headers: { "Idempotency-Key": payKeys.current[keyName] },
            body: JSON.stringify({ paymentMethod: "REDIRECT", gateway }),
          },
        ),
      );
      if (payment.checkout?.url) setCheckoutUrl(payment.checkout.url);
      else
        setError(
          payment.reconciliationRequired
            ? "Cổng thanh toán đang xác minh giao dịch trước đó. Chờ ít phút rồi bấm Kiểm tra lại."
            : "Cổng thanh toán chưa trả về đường dẫn. Vui lòng thử lại sau ít phút.",
        );
    } catch (e) {
      setError(errorText(e, "Chưa mở được cổng thanh toán."));
    } finally {
      setBusy(null);
    }
  }

  /** Sau khi thanh toán: hỏi lại vài lần tới khi gia hạn được áp dụng. */
  async function waitForApplied(extensionId: string) {
    setBusy("refresh");
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const items = await reload();
      const target = items.find((item) => item.id === extensionId);
      if (target && target.status !== "PENDING_PAYMENT") {
        if (target.status === "APPLIED") {
          setNotice("Thanh toán thành công. Hạn trả mới đã được cập nhật.");
          onExtended();
        }
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    setBusy(null);
  }

  const pickedDay = parseVnDate(dateStr);

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Ionicons name="time-outline" size={20} color={Colors.primaryDeep} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Gia hạn thuê</Text>
          <Text style={styles.subtitle}>
            Cần giữ đồ lâu hơn? Chọn giờ trả mới, xem phí thêm rồi xác nhận.
            {due ? ` Hạn trả hiện tại: ${dateTime(due)}.` : ""}
          </Text>
        </View>
      </View>

      {loading ? <LoadingState message="Đang tải thông tin gia hạn..." /> : null}
      {notice ? <InfoBanner tone="success" message={notice} /> : null}
      {error ? <ErrorAlert message={error} onDismiss={() => setError("")} /> : null}

      {!loading && orderStatus === "ACTIVE" && !option && !pending ? (
        <InfoBanner tone="info" message="Chuyến đi này hiện không có khung giờ trả muộn hơn nên chưa gia hạn được." />
      ) : null}

      {pending ? (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>
            Chờ thanh toán {money(pending.additionalFee, currency)} để gia hạn tới {dateTime(pending.requestedRentalEndAt)}
          </Text>
          {pending.holdExpiresAt ? (
            <Text style={styles.pendingHint}>Thiết bị được giữ tới {dateTime(pending.holdExpiresAt)}. Quá giờ này yêu cầu tự huỷ.</Text>
          ) : null}
          <View style={styles.actionsRow}>
            <View style={styles.flex}>
              <Button
                label={gateway ? `Thanh toán qua ${gateway === "momo" ? "MoMo" : "VNPAY"}` : "Chưa có cổng thanh toán"}
                loading={busy === "pay"}
                disabled={!gateway || Boolean(busy)}
                fullWidth
                onPress={() => void pay(pending)}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label="Kiểm tra lại"
                variant="secondary"
                loading={busy === "refresh"}
                disabled={Boolean(busy)}
                fullWidth
                onPress={() => void waitForApplied(pending.id)}
              />
            </View>
          </View>
        </View>
      ) : null}

      {canExtend && !open ? <Button label="Gia hạn thuê" variant="outline" fullWidth onPress={() => setOpen(true)} /> : null}

      {open && canExtend && option ? (
        <View style={styles.block}>
          <Text style={styles.windowHint}>
            Trả tại {option.pointName} · được gia hạn tới {dateTime(option.windowEnd)}
          </Text>
          <Text style={styles.fieldLabel}>Ngày trả mới *</Text>
          <TouchableOpacity style={styles.dateCard} onPress={() => setPickerOpen(true)} activeOpacity={0.75}>
            <View style={styles.inputRow}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textPrimary} />
              <Text style={[styles.dateValue, !dateStr && styles.placeholder]}>{dateStr || "DD/MM/YYYY"}</Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} style={styles.chevron} />
            </View>
            <Text style={styles.dateHint}>{pickedDay ? getDayOfWeekName(pickedDay) : "Chạm để cuộn chọn ngày"}</Text>
          </TouchableOpacity>
          <Text style={styles.fieldLabel}>Giờ trả mới *</Text>
          <View style={styles.timeInputBox}>
            <Ionicons name="time-outline" size={17} color={Colors.textPrimary} />
            <TextInput
              value={time}
              onChangeText={(value) => changeSlot(dateStr, value)}
              placeholder="HH:mm"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              style={styles.timeInput}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {TIME_PRESETS.map((preset) => {
              const disabled = presetDisabled(preset);
              return (
                <TouchableOpacity
                  key={preset}
                  style={[styles.timeChip, time === preset && styles.timeChipActive, disabled && styles.timeChipDisabled]}
                  disabled={disabled}
                  onPress={() => changeSlot(dateStr, preset)}
                >
                  <Text style={styles.timeChipText}>{preset}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {pickedError ? <Text style={styles.errorText}>{pickedError}</Text> : null}
          {picked && !pickedError && !quote ? (
            <Text style={styles.windowHint}>
              Giờ trả mới: {getDayOfWeekName(picked)}, {formatVnDate(picked)} lúc {hhmm(picked)}
            </Text>
          ) : null}

          {quote ? (
            <View style={styles.quoteBox}>
              <Row label="Hạn trả hiện tại" value={dateTime(quote.currentDueAt)} />
              <Row label="Hạn trả mới" value={dateTime(quote.requestedReturnAt)} strong />
              <Row label="Tổng số ngày tính phí" value={`${quote.chargedDays} ngày`} />
              <View style={styles.divider} />
              <Row label="Phí gia hạn" value={quote.additionalFee > 0 ? money(quote.additionalFee, quote.currency) : "Miễn phí"} strong />
              <Text style={styles.quoteHint}>Báo giá giữ tới {dateTime(quote.expiresAt)}. Tiền cọc không đổi.</Text>
              <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreed((value) => !value)} activeOpacity={0.8}>
                <Ionicons name={agreed ? "checkbox" : "square-outline"} size={20} color={Colors.primaryDeep} />
                <Text style={styles.agreeText}>
                  Tôi đồng ý gia hạn theo điều khoản thuê (phiên bản {quote.termsVersion}) và trả đồ đúng giờ mới.
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <View style={styles.flex}>
              {quote ? (
                <Button
                  label={quote.additionalFee > 0 ? "Xác nhận & giữ thiết bị" : "Xác nhận gia hạn"}
                  loading={busy === "confirm"}
                  disabled={!agreed || Boolean(busy)}
                  fullWidth
                  onPress={() => void confirm()}
                />
              ) : (
                <Button
                  label="Xem phí gia hạn"
                  loading={busy === "quote"}
                  disabled={!picked || Boolean(pickedError) || Boolean(busy)}
                  fullWidth
                  onPress={() => void getQuote()}
                />
              )}
            </View>
            <View style={styles.flex}>
              <Button
                label="Huỷ"
                variant="outline"
                disabled={Boolean(busy)}
                fullWidth
                onPress={() => {
                  setOpen(false);
                  changeSlot("", "");
                }}
              />
            </View>
          </View>
        </View>
      ) : null}

      {history.length ? (
        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Lịch sử gia hạn</Text>
          {history.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <View style={styles.flex}>
                <Text style={styles.historyText}>
                  {dateTime(item.previousRentalEndAt)} → {dateTime(item.requestedRentalEndAt)}
                </Text>
                <Text style={styles.historyFee}>{item.additionalFee > 0 ? money(item.additionalFee, item.currency) : "Miễn phí"}</Text>
              </View>
              <StatusBadge label={STATUS_META[item.status]?.label ?? item.status} tone={STATUS_META[item.status]?.tone ?? "neutral"} size="sm" />
            </View>
          ))}
        </View>
      ) : null}

      <WheelDatePickerModal
        visible={pickerOpen}
        title="Chọn ngày trả mới"
        initialDate={dateStr || formatVnDate(due ?? new Date())}
        minDate={due ?? new Date()}
        maxDate={windowEnd ?? undefined}
        onClose={() => setPickerOpen(false)}
        onConfirm={(value) => changeSlot(value, time)}
      />
      {checkoutUrl ? (
        <PaymentWebViewModal
          visible
          url={checkoutUrl}
          title="Thanh toán phí gia hạn"
          onClose={() => {
            setCheckoutUrl(undefined);
            if (pending) void waitForApplied(pending.id);
          }}
          onPaymentComplete={() => {
            setCheckoutUrl(undefined);
            if (pending) void waitForApplied(pending.id);
          }}
        />
      ) : null}
    </SurfaceCard>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.quoteRow}>
      <Text style={styles.quoteLabel}>{label}</Text>
      <Text style={[styles.quoteValue, strong && styles.quoteValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: Spacing.sm, gap: Spacing.md },
  flex: { flex: 1 },
  block: { gap: Spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  headerIcon: { width: 40, height: 40, borderRadius: Radius.pill, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary },
  subtitle: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  sectionLabel: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  fieldLabel: { fontSize: 14, fontWeight: "700", color: Colors.textSecondary },
  windowHint: { fontSize: 13, color: Colors.textSecondary },
  actionsRow: { flexDirection: "row", gap: Spacing.sm },
  pendingBox: { gap: Spacing.sm, backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: Spacing.md },
  pendingTitle: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary, ...Typography.tabularNums },
  pendingHint: { fontSize: 13, color: Colors.textSecondary },
  dateCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, gap: 2 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  dateValue: { fontSize: 17, fontWeight: "700", color: Colors.textPrimary, ...Typography.tabularNums },
  placeholder: { color: Colors.textSecondary, fontWeight: "500" },
  chevron: { marginLeft: "auto" },
  dateHint: { fontSize: 14, color: Colors.textSecondary, marginLeft: 26 },
  timeInputBox: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  timeInput: { flex: 1, fontSize: 17, fontWeight: "700", color: Colors.textPrimary, paddingVertical: 2, ...Typography.tabularNums },
  chipsRow: { gap: Spacing.sm, paddingVertical: 2 },
  timeChip: { backgroundColor: Colors.surfaceMuted, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  timeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryDeep },
  timeChipDisabled: { opacity: 0.35 },
  timeChipText: { fontSize: 14, fontWeight: "600", color: Colors.textPrimary, ...Typography.tabularNums },
  errorText: { fontSize: 14, fontWeight: "600", color: Colors.dangerText },
  quoteBox: { gap: 6, backgroundColor: Colors.successBg, borderRadius: Radius.md, padding: Spacing.md },
  quoteRow: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.sm },
  quoteLabel: { fontSize: 14, color: Colors.textSecondary },
  quoteValue: { fontSize: 14, color: Colors.textPrimary, ...Typography.tabularNums },
  quoteValueStrong: { fontWeight: "800", color: Colors.primaryDeep },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  quoteHint: { fontSize: 12, color: Colors.textSecondary },
  agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginTop: 4 },
  agreeText: { flex: 1, fontSize: 13, lineHeight: 18, color: Colors.textPrimary },
  historyRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, backgroundColor: Colors.canvas, borderRadius: Radius.md, padding: Spacing.sm },
  historyText: { fontSize: 14, color: Colors.textPrimary, ...Typography.tabularNums },
  historyFee: { fontSize: 12, color: Colors.textSecondary },
});
