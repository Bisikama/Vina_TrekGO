import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Linking,
  RefreshControl,
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
import { orderShortCode } from "@/features/rentals/display";
import {
  staffEarlyReturnsApi,
  type StaffEarlyReturn,
  type StaffEarlyReturnFilter,
} from "@/features/rentals/staff-early-returns-api";
import { staffInventoryApi, type RentalDeliveryAssignee } from "@/features/rentals/staff-inventory-api";

const TABS: { value: StaffEarlyReturnFilter; label: string }[] = [
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
];

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

const TASK_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "đã lên lịch",
  COLLECTING: "đang thu hồi",
  RETURNED: "đã nhận từ khách",
  INVENTORY_RECEIVED: "đã về kho",
};

/** Nhân viên kho xếp lịch trả đồ sớm: chỉ dời lịch thu hồi, không động tới phí thuê hay tiền cọc. */
export default function StaffEarlyReturnsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [filter, setFilter] = useState<StaffEarlyReturnFilter>("PENDING");
  const [items, setItems] = useState<StaffEarlyReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [rejectingId, setRejectingId] = useState<string>();
  const [reason, setReason] = useState("");
  const [confirmingId, setConfirmingId] = useState<string>();
  const [deliveryStaff, setDeliveryStaff] = useState<RentalDeliveryAssignee[]>();
  const [staffLoadError, setStaffLoadError] = useState<string>();
  const [assigneeId, setAssigneeId] = useState<string>();
  // "confirm": xác nhận lịch đang chờ + chọn người; "assign": giao / đổi người cho lịch đã xác nhận.
  const [mode, setMode] = useState<"confirm" | "assign">("confirm");

  const load = useCallback(
    async (silent = false) => {
      if (!accessToken) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(undefined);
      try {
        setItems(await staffEarlyReturnsApi.list(accessToken, filter));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Không tải được yêu cầu trả đồ sớm.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, filter],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(id);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
      setNotice(success);
      setRejectingId(undefined);
      setConfirmingId(undefined);
      setReason("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Thao tác chưa thể hoàn tất.");
    } finally {
      setBusy(undefined);
      await load(true);
    }
  }

  function openConfirm(item: StaffEarlyReturn, nextMode: "confirm" | "assign" = "confirm") {
    if (!accessToken) return;
    setMode(nextMode);
    setError(undefined);
    setRejectingId(undefined);
    setAssigneeId(item.task?.staff?.id);
    setConfirmingId(item.id);
    loadDeliveryStaff();
  }

  /** Tải lại mỗi lần mở khung chọn để số việc đang giữ của từng người là số mới. */
  function loadDeliveryStaff() {
    if (!accessToken) return;
    setDeliveryStaff(undefined);
    setStaffLoadError(undefined);
    staffInventoryApi
      .listDeliveryStaff(accessToken)
      .then((page) => setDeliveryStaff(page.items))
      .catch((loadError) =>
        setStaffLoadError(
          loadError instanceof Error ? loadError.message : "Không tải được danh sách nhân viên giao nhận.",
        ),
      );
  }

  /** Chế độ đổi người mà vẫn chọn người đang nhận task: không có gì để đổi. */
  function sameAssignee(item: StaffEarlyReturn) {
    return mode === "assign" && !!assigneeId && assigneeId === item.task?.staff?.id;
  }

  function submitConfirm(item: StaffEarlyReturn) {
    if (!accessToken) return;
    // Không ai nhận task thì khách được hứa nhưng không ai đến: bắt buộc chọn người.
    if (!assigneeId) {
      setError("Chọn nhân viên giao nhận sẽ đến lấy đồ.");
      return;
    }
    const keepCurrent = assigneeId === item.task?.staff?.id;
    const name = deliveryStaff?.find((s) => s.id === assigneeId)?.displayName ?? "nhân viên đã chọn";
    if (mode === "assign") {
      if (keepCurrent) {
        setError("Task đang giao cho nhân viên này; chọn người khác để đổi.");
        return;
      }
      const target = assigneeId;
      void run(
        item.id,
        () => staffEarlyReturnsApi.assign(item, target, accessToken),
        `Đã giao thu hồi đơn ${orderShortCode(item.orderId)} cho ${name}.`,
      );
      return;
    }
    void run(
      item.id,
      () => staffEarlyReturnsApi.confirm(item, accessToken, keepCurrent ? undefined : assigneeId),
      `Đã xác nhận lịch trả sớm đơn ${orderShortCode(item.orderId)} và giao cho ${name}.`,
    );
  }

  function submitReject(item: StaffEarlyReturn) {
    if (!accessToken) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Nhập lý do ít nhất 3 ký tự để khách biết vì sao.");
      return;
    }
    void run(
      item.id,
      () => staffEarlyReturnsApi.reject(item, trimmed, accessToken),
      `Đã từ chối yêu cầu trả sớm đơn ${orderShortCode(item.orderId)}.`,
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lịch trả đồ sớm</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={styles.intro}>
          Xác nhận hoặc từ chối giờ khách muốn trả đồ sớm. Việc này chỉ dời lịch thu hồi, không thay đổi phí thuê hay tiền cọc.
        </Text>

        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={[styles.tab, filter === tab.value && styles.tabActive]}
              onPress={() => {
                setItems([]);
                setRejectingId(undefined);
                setConfirmingId(undefined);
                setFilter(tab.value);
              }}
            >
              <Text style={[styles.tabText, filter === tab.value && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
        {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}
        {loading ? <TrekkingLoader label="Đang tải yêu cầu trả đồ sớm..." compact /> : null}
        {!loading && !items.length ? (
          <Text style={styles.empty}>
            {filter === "PENDING" ? "Chưa có yêu cầu chờ xác nhận." : "Chưa có lịch trả đồ sớm đã xác nhận."}
          </Text>
        ) : null}

        {items.map((item) => {
          const slotAt = item.confirmedSlotAt ?? item.requestedSlotAt;
          const rejecting = rejectingId === item.id;
          const confirming = confirmingId === item.id;
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>Đơn {orderShortCode(item.orderId)}</Text>
                <Text style={styles.slot}>Hẹn {dateTime(slotAt)}</Text>
              </View>
              <Text style={styles.body}>
                {item.requester.fullName} · còn {item.order.outstandingUnits} thiết bị
              </Text>
              {item.requester.phone ? (
                <TouchableOpacity onPress={() => void Linking.openURL(`tel:${item.requester.phone}`)}>
                  <Text style={styles.link}>Gọi {item.requester.phone}</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.meta}>Hạn trả gốc: {dateTime(item.order.effectiveDueAt)}</Text>
              {item.order.returnPoint ? (
                <Text style={styles.meta}>
                  Điểm trả: {item.order.returnPoint.name} — {item.order.returnPoint.address}
                </Text>
              ) : null}
              {item.status === "PENDING" && item.supersededAt ? (
                <Text style={styles.warn}>Chuyến đi đổi lịch, cần xác nhận lại.</Text>
              ) : null}
              {item.task ? (
                <Text style={item.task.staff ? styles.meta : styles.warnText}>
                  Nhân viên giao nhận: {item.task.staff?.fullName ?? "chưa phân công"}
                  {item.status === "CONFIRMED"
                    ? ` · task ${TASK_STATUS_LABEL[item.task.status] ?? item.task.status}`
                    : ""}
                </Text>
              ) : null}

              {item.status === "PENDING" && !rejecting && !confirming ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.primary, busy && styles.disabled]}
                    disabled={Boolean(busy)}
                    onPress={() => openConfirm(item)}
                  >
                    <Text style={styles.primaryText}>Xác nhận lịch</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondary, busy && styles.disabled]}
                    disabled={Boolean(busy)}
                    onPress={() => {
                      setReason("");
                      setError(undefined);
                      setRejectingId(item.id);
                    }}
                  >
                    <Text style={styles.secondaryText}>Từ chối</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {item.status === "CONFIRMED" && item.task?.status === "SCHEDULED" && !confirming ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[item.task.staff ? styles.secondary : styles.primary, busy && styles.disabled]}
                    disabled={Boolean(busy)}
                    onPress={() => openConfirm(item, "assign")}
                  >
                    <Text style={item.task.staff ? styles.secondaryText : styles.primaryText}>
                      {item.task.staff ? "Đổi nhân viên" : "Giao nhân viên"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {confirming ? (
                <View style={styles.rejectBox}>
                  <Text style={styles.rejectLabel}>Nhân viên giao nhận đến lấy đồ</Text>
                  <Text style={styles.meta}>
                    {mode === "assign"
                      ? `Giờ hẹn giữ nguyên (${dateTime(slotAt)}). Người mới nhận thông báo ngay, người cũ (nếu có) được báo không cần đi.`
                      : `Task thu hồi dời tới ${dateTime(item.requestedSlotAt)} và giao cho người được chọn; họ nhận thông báo ngay. Phí thuê và tiền cọc không đổi.`}
                  </Text>
                  {staffLoadError ? (
                    <View>
                      <Text style={styles.warnText}>{staffLoadError}</Text>
                      <TouchableOpacity onPress={loadDeliveryStaff}>
                        <Text style={styles.link}>Thử lại</Text>
                      </TouchableOpacity>
                    </View>
                  ) : !deliveryStaff ? (
                    <TrekkingLoader label="Đang tải nhân viên giao nhận..." compact />
                  ) : !deliveryStaff.length ? (
                    <Text style={styles.warnText}>Chưa có nhân viên giao nhận đang hoạt động.</Text>
                  ) : (
                    <View style={styles.staffList}>
                      {deliveryStaff.map((staff) => {
                        const selected = assigneeId === staff.id;
                        return (
                          <TouchableOpacity
                            key={staff.id}
                            style={[styles.staffOption, selected && styles.staffOptionActive]}
                            onPress={() => {
                              setError(undefined);
                              setAssigneeId(staff.id);
                            }}
                          >
                            <Ionicons
                              name={selected ? "radio-button-on" : "radio-button-off"}
                              size={18}
                              color={selected ? Colors.primaryDark : Colors.onSurfaceMuted}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.staffName}>
                                {staff.displayName}
                                {staff.id === item.task?.staff?.id ? " (đang nhận task này)" : ""}
                              </Text>
                              <Text style={styles.staffMeta}>Đang giữ {staff.activeTaskCount} việc</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  {mode === "assign" && assigneeId && assigneeId === item.task?.staff?.id ? (
                    <Text style={styles.warnText}>Task đang giao cho người này; chọn nhân viên khác để đổi.</Text>
                  ) : null}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.primary, (busy || !assigneeId || sameAssignee(item)) && styles.disabled]}
                      disabled={Boolean(busy) || !assigneeId || sameAssignee(item)}
                      onPress={() => submitConfirm(item)}
                    >
                      <Text style={styles.primaryText}>{busy === item.id ? "Đang xử lý..." : mode === "assign" ? "Giao việc" : "Xác nhận và giao việc"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondary}
                      disabled={Boolean(busy)}
                      onPress={() => setConfirmingId(undefined)}
                    >
                      <Text style={styles.secondaryText}>Đóng</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {rejecting ? (
                <View style={styles.rejectBox}>
                  <Text style={styles.rejectLabel}>Lý do (khách sẽ thấy)</Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    maxLength={500}
                    multiline
                    placeholder="Ví dụ: Không có nhân viên vào khung giờ này, vui lòng chọn sau 14:00."
                    placeholderTextColor={Colors.onSurfaceMuted}
                    style={styles.input}
                  />
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.danger, busy && styles.disabled]}
                      disabled={Boolean(busy)}
                      onPress={() => submitReject(item)}
                    >
                      <Text style={styles.primaryText}>{busy === item.id ? "Đang gửi..." : "Từ chối"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondary}
                      disabled={Boolean(busy)}
                      onPress={() => setRejectingId(undefined)}
                    >
                      <Text style={styles.secondaryText}>Đóng</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: 20, paddingBottom: 50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerTitle: { color: Colors.ink, fontSize: 18, fontWeight: "600" },
  intro: { color: Colors.onSurfaceVariant, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tab: { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  tabActive: { backgroundColor: Colors.primaryDark },
  tabText: { color: Colors.body, fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 16, marginBottom: 12, ...Shadows.card },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: Colors.ink, fontSize: 16, fontWeight: "600" },
  slot: { color: "#0B4F8A", backgroundColor: "#e0f0ff", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, fontWeight: "600", overflow: "hidden" },
  body: { color: Colors.body, fontSize: 14, marginTop: 8 },
  meta: { color: Colors.onSurfaceMuted, fontSize: 13, marginTop: 5 },
  link: { color: Colors.primaryDark, fontSize: 13, fontWeight: "600", textDecorationLine: "underline", marginTop: 5 },
  warn: { color: "#9b6700", backgroundColor: "#fff5d7", borderRadius: 8, padding: 9, fontSize: 13, marginTop: 8 },
  warnText: { color: "#9b6700", fontSize: 13, marginTop: 5 },
  staffList: { gap: 8, marginTop: 10 },
  staffOption: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 8, padding: 11 },
  staffOptionActive: { borderColor: Colors.primaryDark, backgroundColor: "#eaf5e1" },
  staffName: { color: Colors.ink, fontSize: 14, fontWeight: "600" },
  staffMeta: { color: Colors.onSurfaceMuted, fontSize: 12, marginTop: 2, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  primary: { flex: 1, backgroundColor: Colors.primaryDark, borderRadius: Radius.md, paddingVertical: 11, alignItems: "center" },
  danger: { flex: 1, backgroundColor: Colors.error, borderRadius: Radius.md, paddingVertical: 11, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  secondary: { flex: 1, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: Radius.md, paddingVertical: 11, alignItems: "center" },
  secondaryText: { color: Colors.ink, fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  rejectBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer, paddingTop: 10 },
  rejectLabel: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  input: { minHeight: 72, marginTop: 8, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 8, padding: 11, color: Colors.ink, textAlignVertical: "top" },
  errorBanner: { color: Colors.error, backgroundColor: "#ffe8e5", borderRadius: 9, padding: 12, marginBottom: 12 },
  noticeBanner: { color: Colors.primaryDark, backgroundColor: "#eaf5e1", borderRadius: 9, padding: 12, marginBottom: 12 },
  empty: { color: Colors.onSurfaceMuted, textAlign: "center", backgroundColor: "#fff", borderRadius: Radius.md, padding: 28 },
});
