import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  Button,
  Colors,
  ConfirmModal,
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
import { WheelDatePickerModal } from "@/features/leaders/components/WheelDatePickerModal";
import { formatVnDate, getDayOfWeekName, parseVnDate } from "@/features/leaders/utils/tripDateUtils";
import { apiRequest } from "@/lib/api-client";

type EarlyReturnStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "SUPERSEDED" | "REJECTED" | "EXPIRED";
type EarlyReturn = {
  id: string;
  status: EarlyReturnStatus;
  version: number;
  requestedSlotAt: string;
  confirmedSlotAt: string | null;
  supersededAt: string | null;
  rejectionReason: string | null;
};
type Envelope<T> = T | { data: T };

const STATUS_META: Record<EarlyReturnStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Chờ xác nhận", tone: "warning" },
  CONFIRMED: { label: "Đã xác nhận lịch", tone: "success" },
  CANCELLED: { label: "Đã huỷ", tone: "neutral" },
  COMPLETED: { label: "Đã thu hồi sớm", tone: "info" },
  SUPERSEDED: { label: "Thu hồi theo lịch khác", tone: "neutral" },
  REJECTED: { label: "Bị từ chối", tone: "danger" },
  EXPIRED: { label: "Đã hết hạn", tone: "neutral" },
};
const OPEN: EarlyReturnStatus[] = ["PENDING", "CONFIRMED"];
const TIME_PRESETS = ["07:00", "09:00", "11:00", "13:30", "15:00", "17:00", "19:00"];

const unwrap = <T,>(x: Envelope<T>): T => (x && typeof x === "object" && "data" in x ? (x as { data: T }).data : (x as T));
const newKey = () => `early-return-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateTime = (value: string | Date) =>
  new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

function periodLabel(time: string) {
  const hour = Number(time.split(":")[0]);
  if (!Number.isFinite(hour)) return "";
  return hour < 11 ? "Sáng" : hour < 14 ? "Trưa" : hour < 18 ? "Chiều" : "Tối";
}

/** Ghép ngày DD/MM/YYYY và giờ HH:mm thành Date theo giờ máy; null nếu chưa đủ hoặc sai. */
function combine(dateStr: string, time: string): Date | null {
  const day = parseVnDate(dateStr);
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!day || !m) return null;
  const [hour, minute] = [Number(m[1]), Number(m[2])];
  if (hour > 23 || minute > 59) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

export function EarlyReturnCard({
  orderId,
  accessToken,
  orderStatus,
  dueAt,
}: {
  orderId: string;
  accessToken?: string | null;
  orderStatus: string;
  dueAt?: string | null;
}) {
  const [request, setRequest] = useState<EarlyReturn | null>(null);
  const [dateStr, setDateStr] = useState("");
  const [time, setTime] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useRef<string | null>(null);
  const cancelKey = useRef<string | null>(null);
  const due = useMemo(() => (dueAt ? new Date(dueAt) : null), [dueAt]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setRequest(unwrap(await apiRequest<Envelope<EarlyReturn | null>>(`/api/v1/rental-orders/${orderId}/early-return`, { accessToken })));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được yêu cầu trả đồ sớm.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    apiRequest<Envelope<EarlyReturn | null>>(`/api/v1/rental-orders/${orderId}/early-return`, { accessToken })
      .then((value) => {
        if (active) {
          setRequest(unwrap(value));
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Không tải được yêu cầu trả đồ sớm.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, orderId]);

  const picked = combine(dateStr, time);
  const pickedError = !picked
    ? null
    : picked <= new Date()
      ? "Giờ trả phải ở tương lai."
      : due && picked >= due
        ? `Giờ trả phải trước hạn trả ${dateTime(due)}.`
        : null;

  if (orderStatus !== "ACTIVE" && !request) return null;

  const open = !!request && OPEN.includes(request.status);
  const closedForGood = request?.status === "COMPLETED" || request?.status === "SUPERSEDED";
  const canRequest = orderStatus === "ACTIVE" && !open && !closedForGood && !loading;
  const slotAt = request ? (request.confirmedSlotAt ?? request.requestedSlotAt) : null;
  const pickedDay = parseVnDate(dateStr);

  const presetDisabled = (preset: string) => {
    const at = combine(dateStr, preset);
    return !!at && (at <= new Date() || (!!due && at >= due));
  };

  async function submit() {
    if (!accessToken) return;
    if (!dateStr || !time) {
      setError("Vui lòng chọn ngày và giờ muốn trả đồ.");
      return;
    }
    if (!picked) {
      setError("Giờ trả chưa đúng định dạng HH:mm.");
      return;
    }
    if (pickedError) {
      setError(pickedError);
      return;
    }
    setBusy(true);
    setError("");
    requestKey.current ??= newKey();
    try {
      const created = await apiRequest<Envelope<EarlyReturn>>(`/api/v1/rental-orders/${orderId}/early-return`, {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": requestKey.current },
        body: JSON.stringify({ requestedSlotAt: picked.toISOString() }),
      });
      setRequest(unwrap(created));
      requestKey.current = null;
      setDateStr("");
      setTime("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được yêu cầu.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!request || !accessToken) return;
    setBusy(true);
    setError("");
    cancelKey.current ??= newKey();
    try {
      const cancelled = await apiRequest<Envelope<EarlyReturn>>(`/api/v1/rental-early-returns/${request.id}/cancel`, {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": cancelKey.current },
        body: JSON.stringify({ expectedVersion: request.version }),
      });
      setRequest(unwrap(cancelled));
      cancelKey.current = null;
    } catch (e) {
      cancelKey.current = null;
      setError(e instanceof Error ? e.message : "Không huỷ được yêu cầu.");
      await load();
    } finally {
      setConfirmCancel(false);
      setBusy(false);
    }
  }

  const changeSlot = (nextDate: string, nextTime: string) => {
    requestKey.current = null;
    setError("");
    setDateStr(nextDate);
    setTime(nextTime);
  };

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Ionicons name="return-down-back-outline" size={20} color={Colors.primaryDeep} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Trả đồ sớm</Text>
          <Text style={styles.subtitle}>Hẹn giờ để TrekGo đến nhận lại đồ trước hạn. Phí thuê không đổi, tiền cọc xử lý như khi trả đúng hạn.</Text>
        </View>
      </View>

      {loading ? <LoadingState message="Đang tải yêu cầu trả đồ sớm..." /> : null}
      {error ? <ErrorAlert message={error} onDismiss={() => setError("")} /> : null}

      {request && slotAt ? (
        <View style={styles.block}>
          <View style={styles.slotCard}>
            <Ionicons name="calendar" size={18} color={Colors.primaryDeep} />
            <View style={styles.flex}>
              <Text style={styles.slotLabel}>Giờ hẹn trả đồ</Text>
              <Text style={styles.slotValue}>
                {getDayOfWeekName(new Date(slotAt))}, {dateTime(slotAt)}
              </Text>
            </View>
            <StatusBadge label={STATUS_META[request.status].label} tone={STATUS_META[request.status].tone} size="sm" />
          </View>
          {request.status === "PENDING" ? (
            <InfoBanner
              tone="info"
              message={
                request.supersededAt
                  ? "Lịch chuyến đi vừa thay đổi nên lịch trả đồ sớm cần TrekGo xác nhận lại."
                  : "TrekGo đã nhận yêu cầu và sẽ xác nhận lịch. Nếu quá giờ hẹn mà chưa được xác nhận, yêu cầu tự hết hạn."
              }
            />
          ) : null}
          {request.status === "CONFIRMED" ? (
            <InfoBanner tone="success" message="Lịch đã được xác nhận. Nhân viên có thể đến sớm tối đa 30 phút; hãy chuẩn bị đủ đồ và phụ kiện." />
          ) : null}
          {request.status === "REJECTED" ? (
            <InfoBanner tone="warning" title="TrekGo chưa thể nhận đồ vào giờ này" message={request.rejectionReason ?? "Vui lòng chọn giờ khác."} />
          ) : null}
          {request.status === "EXPIRED" ? (
            <InfoBanner tone="warning" message="Yêu cầu chưa kịp được xác nhận trước giờ hẹn nên đã hết hạn. Bạn có thể chọn giờ mới." />
          ) : null}
          {request.status === "SUPERSEDED" ? (
            <InfoBanner tone="info" message="Đồ được thu hồi theo lịch khác của đơn (đến hạn trả hoặc do chuyến đi thay đổi), không theo yêu cầu trả sớm này." />
          ) : null}
          {request.status === "COMPLETED" ? (
            <InfoBanner tone="success" message="Nhân viên đã nhận đồ theo lịch trả sớm." />
          ) : null}
          {open ? (
            <View style={styles.actionsRow}>
              <View style={styles.flex}>
                <Button label="Huỷ yêu cầu" variant="outline" loading={busy} fullWidth onPress={() => setConfirmCancel(true)} />
              </View>
              <View style={styles.flex}>
                <Button label="Làm mới" variant="secondary" disabled={busy} fullWidth onPress={() => void load()} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {canRequest ? (
        <View style={styles.block}>
          {request ? <Text style={styles.sectionLabel}>Chọn lịch mới</Text> : null}

          <Text style={styles.fieldLabel}>Ngày trả đồ *</Text>
          <TouchableOpacity
            style={[styles.dateCard, pickerOpen && styles.dateCardActive]}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Chọn ngày trả đồ"
          >
            <View style={styles.inputRow}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textPrimary} />
              <Text style={[styles.dateValue, !dateStr && styles.placeholder]} numberOfLines={1}>
                {dateStr || "DD/MM/YYYY"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} style={styles.chevron} />
            </View>
            <Text style={styles.dateHint}>{pickedDay ? getDayOfWeekName(pickedDay) : "Chạm để cuộn chọn ngày"}</Text>
          </TouchableOpacity>

          <View style={styles.timeHeader}>
            <Text style={styles.fieldLabel}>Giờ trả đồ *</Text>
            <Text style={styles.timeHint}>Gợi ý khung giờ</Text>
          </View>
          <View style={styles.timeRow}>
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
                accessibilityLabel="Giờ trả đồ"
              />
              {periodLabel(time) && /^\d{1,2}:\d{2}$/.test(time) ? (
                <View style={styles.periodBadge}>
                  <Text style={styles.periodBadgeText}>{periodLabel(time)}</Text>
                </View>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {TIME_PRESETS.map((preset) => {
                const selected = time === preset;
                const disabled = presetDisabled(preset);
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.timeChip, selected && styles.timeChipActive, disabled && styles.timeChipDisabled]}
                    disabled={disabled}
                    onPress={() => changeSlot(dateStr, preset)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.timeChipText, selected && styles.timeChipTextActive]}>
                      {preset} {periodLabel(preset)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={[styles.summary, pickedError && styles.summaryError]}>
            <Ionicons
              name={pickedError ? "alert-circle-outline" : "checkmark-circle-outline"}
              size={18}
              color={pickedError ? Colors.danger : Colors.primaryDeep}
            />
            <Text style={[styles.summaryText, pickedError && styles.summaryTextError]}>
              {pickedError
                ? pickedError
                : picked
                  ? `${getDayOfWeekName(picked)}, ${formatVnDate(picked)} lúc ${hhmm(picked)}`
                  : due
                    ? `Chọn giờ trước hạn trả ${dateTime(due)}.`
                    : "Chọn ngày và giờ muốn trả đồ."}
            </Text>
          </View>

          <Button
            label="Gửi yêu cầu trả đồ sớm"
            loading={busy}
            disabled={!picked || !!pickedError}
            fullWidth
            onPress={() => void submit()}
          />
        </View>
      ) : null}

      <WheelDatePickerModal
        visible={pickerOpen}
        title="Chọn ngày trả đồ"
        initialDate={dateStr || formatVnDate(new Date())}
        minDate={new Date()}
        maxDate={due ?? undefined}
        onClose={() => setPickerOpen(false)}
        onConfirm={(value) => changeSlot(value, time)}
      />

      <ConfirmModal
        visible={confirmCancel}
        title="Huỷ yêu cầu trả đồ sớm?"
        description="Đồ sẽ được thu hồi theo hạn trả thường của đơn."
        confirmLabel="Huỷ yêu cầu"
        cancelLabel="Giữ yêu cầu"
        variant="danger"
        loading={busy}
        onConfirm={() => void cancel()}
        onClose={() => setConfirmCancel(false)}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: Spacing.sm, gap: Spacing.md },
  flex: { flex: 1 },
  block: { gap: Spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary },
  subtitle: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  slotCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.canvas,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  slotLabel: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  slotValue: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary, ...Typography.tabularNums },
  actionsRow: { flexDirection: "row", gap: Spacing.sm },
  dateCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 2,
  },
  dateCardActive: { borderColor: Colors.primaryDeep, borderWidth: 1.5 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  dateValue: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary, ...Typography.tabularNums },
  placeholder: { color: Colors.textSecondary, fontWeight: "500" },
  chevron: { marginLeft: "auto" },
  dateHint: { fontSize: 12, color: Colors.textSecondary, marginLeft: 26 },
  timeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.xs },
  timeHint: { fontSize: 11, color: Colors.textSecondary },
  timeRow: { gap: Spacing.sm },
  timeInputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  timeInput: { flex: 1, fontSize: 16, fontWeight: "700", color: Colors.textPrimary, paddingVertical: 2, ...Typography.tabularNums },
  periodBadge: { backgroundColor: Colors.surfaceMuted, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  periodBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.primaryDeep },
  chipsRow: { gap: Spacing.sm, paddingVertical: 2 },
  timeChip: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryDeep },
  timeChipDisabled: { opacity: 0.35 },
  timeChipText: { fontSize: 12, fontWeight: "600", color: Colors.textPrimary, ...Typography.tabularNums },
  timeChipTextActive: { fontWeight: "700" },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  summaryError: { backgroundColor: Colors.dangerBg },
  summaryText: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.primaryDeep },
  summaryTextError: { color: Colors.dangerText },
});
