import { FieldModal } from "@/components/FieldModal";
import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { rentalApi } from "@/features/rentals/api";
import {
  DeliveryTaskDetail,
  DeliveryTaskSummary,
  RentalOrderDetail,
} from "@/features/rentals/types";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ItemStatus = "PENDING" | "OK" | "MISSING" | "DAMAGED";
type ItemReview = { status: ItemStatus; note: string };
type NoShowReason =
  | "USER_NO_SHOW"
  | "USER_CHANGED_MIND"
  | "USER_REFUSED_DISCLOSED_CONDITION"
  | "SYSTEM_WRONG_EQUIPMENT"
  | "SYSTEM_DAMAGED_EQUIPMENT"
  | "SYSTEM_MISSING_EQUIPMENT";

const noShowReasons: { value: NoShowReason; label: string }[] = [
  { value: "USER_NO_SHOW", label: "Khách không đến" },
  { value: "USER_CHANGED_MIND", label: "Khách đổi ý" },
  { value: "USER_REFUSED_DISCLOSED_CONDITION", label: "Khách từ chối tình trạng đã công bố" },
  { value: "SYSTEM_WRONG_EQUIPMENT", label: "TrekGo giao sai thiết bị" },
  { value: "SYSTEM_DAMAGED_EQUIPMENT", label: "Thiết bị hỏng tại điểm giao" },
  { value: "SYSTEM_MISSING_EQUIPMENT", label: "Gói bàn giao thiếu thiết bị" },
];

function shortAssetCode(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
}

function tripWindow(order?: RentalOrderDetail) {
  const trip = order?.order.trip;
  if (!trip?.startAt || !trip.endAt) return "Khung giờ chuyến đi đang cập nhật";
  const formatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const type = trip.type === "PRIVATE" ? "Chuyến riêng tư" : "Chuyến công khai";
  return `${type} · ${formatter.format(new Date(trip.startAt))} – ${formatter.format(new Date(trip.endAt))}`;
}

function operationKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function recipientName(summary?: DeliveryTaskSummary, task?: DeliveryTaskDetail) {
  const recipient = task?.recipient || summary?.orderSummary.recipient;
  return recipient?.displayName || recipient?.fullName || recipient?.name || "Khách thuê";
}

function verificationRef(task?: DeliveryTaskDetail) {
  const value = task?.verificationStatus?.verificationRef;
  return typeof value === "string" ? value : undefined;
}

function deliveryStatus(status?: string) {
  const labels: Record<string, { title: string; message: string; warning?: boolean }> = {
    HANDED_OVER: {
      title: "Đã giao thiết bị thành công",
      message: "Khách đã nhận đủ thiết bị. Nhiệm vụ giao đã hoàn tất.",
    },
    NO_SHOW: {
      title: "Khách không đến nhận",
      message: "Nhiệm vụ đã được ghi nhận ngoại lệ và đang chờ bộ phận liên quan xử lý.",
      warning: true,
    },
    REFUSED: {
      title: "Khách từ chối nhận thiết bị",
      message: "Lý do từ chối đã được lưu. Vui lòng bảo quản gói thiết bị để bàn giao lại.",
      warning: true,
    },
    CLOSED: {
      title: "Nhiệm vụ đã đóng",
      message: "Không còn thao tác giao nhận nào cần thực hiện.",
    },
    CANCELLED: {
      title: "Nhiệm vụ đã hủy",
      message: "Không tiếp tục giao thiết bị cho nhiệm vụ này.",
      warning: true,
    },
  };
  return labels[status ?? ""] ?? {
    title: "Nhiệm vụ đã được cập nhật",
    message: "Tiến độ mới nhất đã được hệ thống ghi nhận.",
  };
}

export default function StaffTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ taskId?: string | string[]; orderId?: string | string[] }>();
  const requestedTaskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
  const requestedOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { accessToken } = useAuth();
  const keys = useRef({
    claim: operationKey("claim-outbound"),
    receive: operationKey("receive-package"),
    verify: operationKey("verify-recipient"),
    handover: operationKey("commit-handover"),
    noShow: operationKey("mark-no-show"),
  });

  const [summary, setSummary] = useState<DeliveryTaskSummary>();
  const [task, setTask] = useState<DeliveryTaskDetail>();
  const [order, setOrder] = useState<RentalOrderDetail>();
  const [reviews, setReviews] = useState<Record<string, ItemReview>>({});
  const [custodyTransferId, setCustodyTransferId] = useState("");
  const [packageCode, setPackageCode] = useState("");
  const [pickupCode, setPickupCode] = useState("");
  const [verifiedRef, setVerifiedRef] = useState<string>();
  const [recipientNotes, setRecipientNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);
  const [noShowVisible, setNoShowVisible] = useState(false);
  const [noShowReason, setNoShowReason] = useState<NoShowReason>("USER_NO_SHOW");
  const [noShowNotes, setNoShowNotes] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) {
      setError("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại bằng tài khoản giao nhận.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const listed = await rentalApi.listDeliveryTasks(accessToken, {
        type: "OUTBOUND",
        page: 1,
        pageSize: 100,
      });
      const selected =
        listed.items.find((item) => item.id === requestedTaskId) ||
        listed.items.find((item) => item.orderSummary.orderId === requestedOrderId) ||
        listed.items.find((item) => !["HANDED_OVER", "NO_SHOW", "REFUSED", "CLOSED", "CANCELLED"].includes(item.status));

      if (!selected) {
        setSummary(undefined);
        setTask(undefined);
        setOrder(undefined);
        setError("Không có nhiệm vụ giao thiết bị đang hoạt động.");
        return;
      }

      setSummary(selected);
      setPackageCode((current) => current || selected.package.code);
      const orderDetail = await rentalApi.getOrder(selected.orderSummary.orderId, accessToken);
      setOrder(orderDetail);

      try {
        const taskDetail = await rentalApi.getDeliveryTask(selected.id, accessToken);
        setTask(taskDetail);
        setCustodyTransferId((current) => current || taskDetail.custodyTransfer?.id || "");
        setVerifiedRef(verificationRef(taskDetail));
        setReviews((current) => {
          const next = { ...current };
          taskDetail.units.forEach((unit) => {
            next[unit.unitId] ||= { status: "PENDING", note: "" };
          });
          return next;
        });
      } catch {
        if (selected.status !== "SCHEDULED" && selected.status !== "BLOCKED") {
          throw new Error("Nhiệm vụ đã có người nhận hoặc tài khoản này không có quyền truy cập.");
        }
        setTask(undefined);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không tải được nhiệm vụ giao thiết bị.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, requestedOrderId, requestedTaskId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const units = useMemo(() => task?.units || [], [task?.units]);
  const allReviewed =
    units.length > 0 &&
    units.every((unit) => {
      const review = reviews[unit.unitId];
      return review && review.status !== "PENDING" && (review.status === "OK" || review.note.trim().length > 0);
    });
  const currentVerificationRef = verifiedRef || verificationRef(task);
  const serverStatus = task?.task.status || summary?.status;
  const statusPresentation = deliveryStatus(serverStatus);

  const setReview = (unitId: string, update: Partial<ItemReview>) => {
    setReviews((current) => ({
      ...current,
      [unitId]: {
        status: current[unitId]?.status || "PENDING",
        note: current[unitId]?.note || "",
        ...update,
      },
    }));
  };

  const claimTask = async () => {
    if (!accessToken || !summary || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await rentalApi.claimDeliveryTask(summary.id, summary.version, keys.current.claim, accessToken);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không nhận được nhiệm vụ.");
    } finally {
      setBusy(false);
    }
  };

  const receivePackage = async () => {
    if (!accessToken || !summary || !task || busy) return;
    if (!custodyTransferId.trim() || !packageCode.trim()) {
      setFeedback({
        title: "Thiếu dữ liệu từ kho",
        message: "Thông tin bàn giao chưa sẵn sàng. Hãy tải lại nhiệm vụ hoặc liên hệ nhân viên kho.",
      });
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await rentalApi.receiveDeliveryPackage(
        summary.id,
        {
          custodyTransferId: custodyTransferId.trim(),
          packageCode: packageCode.trim(),
          expectedVersion: task.task.version,
        },
        keys.current.receive,
        accessToken,
      );
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không nhận được gói thiết bị từ kho.");
    } finally {
      setBusy(false);
    }
  };

  const verifyRecipient = async () => {
    if (!accessToken || !summary || !task || busy) return;
    if (!pickupCode.trim()) {
      setFeedback({ title: "Thiếu mã pickup", message: "Nhập mã pickup một lần do khách hàng cung cấp." });
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const result = await rentalApi.verifyDeliveryRecipient(
        summary.id,
        { pickupCode: pickupCode.trim(), expectedVersion: task.task.version },
        keys.current.verify,
        accessToken,
      );
      setVerifiedRef(result.verificationRef);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không xác minh được người nhận.");
    } finally {
      setBusy(false);
    }
  };

  const handover = async () => {
    if (!accessToken || !summary || !task || !order || busy) return;
    if (!currentVerificationRef) {
      setFeedback({ title: "Chưa xác minh", message: "Phải xác minh pickup code trước khi bàn giao." });
      return;
    }
    if (!task.package) {
      setFeedback({ title: "Thiếu gói thiết bị", message: "Thông tin gói bàn giao chưa sẵn sàng. Hãy tải lại nhiệm vụ." });
      return;
    }
    if (!allReviewed) {
      setFeedback({ title: "Chưa kiểm đủ", message: "Kiểm tra từng thiết bị; món thiếu hoặc hỏng phải có ghi chú." });
      return;
    }

    const reportedIssues = units.flatMap((unit) => {
      const review = reviews[unit.unitId];
      if (!review || review.status === "OK") return [];
      return [{ unitId: unit.unitId, type: review.status, description: review.note.trim() }];
    });

    setBusy(true);
    setError(undefined);
    try {
      await rentalApi.commitRentalHandover(
        summary.orderSummary.orderId,
        {
          packageId: task.package.id,
          verificationRef: currentVerificationRef,
          recipientNotes: recipientNotes.trim() || undefined,
          reportedIssues,
          expectedVersion: order.order.version,
        },
        keys.current.handover,
        accessToken,
      );
      setComplete(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Bàn giao thiết bị thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const markNoShow = async () => {
    if (!accessToken || !summary || !order || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await rentalApi.markRentalNoShow(
        summary.orderSummary.orderId,
        {
          reason: noShowReason,
          notes: noShowNotes.trim() || undefined,
          evidenceIds: [],
          expectedVersion: order.order.version,
        },
        keys.current.noShow,
        accessToken,
      );
      setNoShowVisible(false);
      setComplete(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không ghi nhận được no-show/từ chối.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <TrekkingLoader
            label="Đang mở tuyến giao thiết bị..."
            hint="Đang đồng bộ gói thiết bị, người nhận và điểm bàn giao"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!summary || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={23} color={Colors.ink} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Giao thiết bị</Text><View style={{ width: 23 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#9b6700" />
          <Text style={styles.cardTitle}>Không tải được nhiệm vụ</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => void load()}><Text style={styles.primaryText}>TẢI LẠI</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={23} color={Colors.ink} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết giao thiết bị</Text><View style={{ width: 23 }} />
        </View>
        <View style={styles.taskHeader}>
          <Text style={styles.taskId}>GIAO THIẾT BỊ</Text>
          <Text style={styles.title}>{order.order.trip?.title || "Chuyến trekking"}</Text>
          <Text style={styles.meta}>{recipientName(summary, task)} · {summary.point.name}</Text>
          <Text style={styles.tripTime}>{tripWindow(order)}</Text>
        </View>

        {!task ? (
          <View style={styles.card}>
            <Text style={styles.section}>BƯỚC 1 · NHẬN NHIỆM VỤ</Text>
            <Text style={styles.cardTitle}>Nhiệm vụ đang chờ nhận</Text>
            <Text style={styles.muted}>Nhận nhiệm vụ trước khi lấy gói thiết bị từ kho.</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={() => void claimTask()}>
              <Text style={styles.primaryText}>{busy ? "ĐANG NHẬN..." : "NHẬN NHIỆM VỤ"}</Text>
            </TouchableOpacity>
          </View>
        ) : serverStatus === "SCHEDULED" || serverStatus === "BLOCKED" ? (
          <View style={styles.card}>
            <Text style={styles.section}>BƯỚC 1 · NHẬN GÓI TỪ KHO</Text>
            <Text style={styles.cardTitle}>Thiết bị trong gói</Text>
            {units.map((unit) => (
              <View key={unit.unitId} style={styles.item}>
                <Text style={styles.itemName}>{unit.product?.name || "Thiết bị thuê"}</Text>
                <Text style={styles.assetCode}>Mã thiết bị {shortAssetCode(unit.assetCode)}</Text>
              </View>
            ))}
            <Text style={styles.notice}>Đối chiếu đúng tên và mã thiết bị trước khi xác nhận nhận gói từ kho.</Text>
            <TouchableOpacity disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={() => void receivePackage()}>
              <Text style={styles.primaryText}>{busy ? "ĐANG XỬ LÝ..." : "XÁC NHẬN NHẬN GÓI"}</Text>
            </TouchableOpacity>
          </View>
        ) : serverStatus === "PACKAGE_RECEIVED" ? (
          <View style={styles.card}>
            <Text style={styles.section}>BƯỚC 2 · XÁC MINH NGƯỜI NHẬN</Text>
            <InfoRow icon="person-outline" label="Người nhận" value={recipientName(summary, task)} />
            <InfoRow icon="location-outline" label="Điểm tập trung" value={summary.point.name} />
            <TextInput value={pickupCode} onChangeText={setPickupCode} autoCapitalize="characters" placeholder="Mã pickup từ khách" placeholderTextColor={Colors.onSurfaceMuted} style={styles.input} />
            <Text style={styles.notice}>Chỉ xác minh khi đã đến đúng điểm tập trung và gặp người nhận.</Text>
            <TouchableOpacity disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={() => void verifyRecipient()}>
              <Text style={styles.primaryText}>{busy ? "ĐANG XÁC MINH..." : "XÁC MINH MÃ PICKUP"}</Text>
            </TouchableOpacity>
          </View>
        ) : serverStatus === "RECIPIENT_VERIFIED" ? (
          <View style={styles.card}>
            <Text style={styles.section}>BƯỚC 3 · KIỂM TRA VÀ BÀN GIAO</Text>
            {units.map((unit) => {
              const review = reviews[unit.unitId] || { status: "PENDING" as ItemStatus, note: "" };
              return (
                <View key={unit.unitId} style={styles.item}>
                  <Text style={styles.itemName}>{unit.product?.name || unit.assetCode}</Text>
                  <Text style={styles.assetCode}>Mã {shortAssetCode(unit.assetCode)}</Text>
                  <View style={styles.statusRow}>
                    {(["OK", "MISSING", "DAMAGED"] as ItemStatus[]).map((status) => (
                      <TouchableOpacity key={status} style={[styles.statusButton, review.status === status && styles.statusSelected]} onPress={() => setReview(unit.unitId, { status })}>
                        <Text style={[styles.statusText, review.status === status && styles.statusTextSelected]}>{status === "OK" ? "Đủ / tốt" : status === "MISSING" ? "Thiếu" : "Hư hỏng"}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {(review.status === "MISSING" || review.status === "DAMAGED") && (
                    <TextInput value={review.note} onChangeText={(note) => setReview(unit.unitId, { note })} placeholder="Mô tả bắt buộc" placeholderTextColor={Colors.onSurfaceMuted} style={styles.issueInput} />
                  )}
                </View>
              );
            })}
            <TextInput value={recipientNotes} onChangeText={setRecipientNotes} placeholder="Ghi chú của người nhận (không bắt buộc)" placeholderTextColor={Colors.onSurfaceMuted} multiline style={[styles.input, styles.notes]} />
            <TouchableOpacity disabled={busy || !allReviewed} style={[styles.primary, (busy || !allReviewed) && styles.disabled]} onPress={() => void handover()}>
              <Text style={styles.primaryText}>{busy ? "ĐANG BÀN GIAO..." : "XÁC NHẬN BÀN GIAO"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, statusPresentation.warning && styles.warningCard]}>
            <View style={[styles.resultIcon, statusPresentation.warning && styles.resultIconWarning]}>
              <Ionicons
                name={statusPresentation.warning ? "alert-circle" : "checkmark-circle"}
                size={31}
                color={statusPresentation.warning ? "#A15400" : Colors.primaryDark}
              />
            </View>
            <Text style={styles.cardTitle}>{statusPresentation.title}</Text>
            <Text style={styles.muted}>{statusPresentation.message}</Text>
            <View style={styles.friendlyStatus}>
              <Ionicons name="sparkles-outline" size={15} color={Colors.primaryDark} />
              <Text style={styles.friendlyStatusText}>Thông tin đã đồng bộ với TrekOps</Text>
            </View>
          </View>
        )}

        {error && task ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {busy ? (
          <TrekkingLoader
            label={
              serverStatus === "PACKAGE_RECEIVED"
                ? "Đang xác minh người nhận..."
                : serverStatus === "RECIPIENT_VERIFIED"
                  ? "Đang hoàn tất bàn giao..."
                  : "Đang cập nhật nhiệm vụ giao thiết bị..."
            }
            compact
          />
        ) : null}
        {task && !completedStatus(serverStatus) ? (
          <TouchableOpacity style={styles.noShowButton} onPress={() => setNoShowVisible(true)}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.noShowText}>KHÁCH KHÔNG ĐẾN / TỪ CHỐI NHẬN</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={noShowVisible} transparent animationType="slide" onRequestClose={() => setNoShowVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setNoShowVisible(false)}>
          <Pressable style={styles.menu} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.menuTitle}>Ghi nhận ngoại lệ giao hàng</Text>
            {noShowReasons.map((reason) => (
              <TouchableOpacity key={reason.value} style={[styles.reasonButton, noShowReason === reason.value && styles.reasonSelected]} onPress={() => setNoShowReason(reason.value)}>
                <Text style={styles.reasonText}>{reason.label}</Text>
              </TouchableOpacity>
            ))}
            <TextInput value={noShowNotes} onChangeText={setNoShowNotes} placeholder="Ghi chú bổ sung" placeholderTextColor={Colors.onSurfaceMuted} multiline style={[styles.input, styles.notes]} />
            <TouchableOpacity disabled={busy} style={[styles.dangerButton, busy && styles.disabled]} onPress={() => void markNoShow()}>
              <Text style={styles.primaryText}>{busy ? "ĐANG GHI NHẬN..." : "XÁC NHẬN NGOẠI LỆ"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <FieldModal
        visible={complete}
        title="Đã cập nhật nhiệm vụ"
        message="Thông tin giao nhận đã được lưu thành công."
        icon="checkmark-circle"
        actionLabel="Về dashboard"
        onAction={() => { setComplete(false); router.replace("/field-operations" as never); }}
        onClose={() => setComplete(false)}
      />
      <FieldModal
        visible={feedback !== null}
        title={feedback?.title || ""}
        message={feedback?.message || ""}
        icon="information-circle"
        tone="warning"
        actionLabel="Đã hiểu"
        onAction={() => setFeedback(null)}
        onClose={() => setFeedback(null)}
      />
    </SafeAreaView>
  );
}

function completedStatus(status?: string) {
  return Boolean(status && ["HANDED_OVER", "NO_SHOW", "REFUSED", "CLOSED", "CANCELLED"].includes(status));
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={Colors.primaryDark} />
      <View><Text style={styles.muted}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: 20, paddingBottom: 35 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  headerTitle: { color: Colors.ink, fontSize: 17, fontWeight: "600" },
  taskHeader: { backgroundColor: Colors.inverseSurface, padding: 18, borderRadius: Radius.xl, marginBottom: 18, ...Shadows.tactical },
  taskId: { color: Colors.primary, fontSize: 11, fontWeight: "600" },
  title: { color: "#fff", fontSize: 22, fontWeight: "600", marginTop: 7 },
  meta: { color: "#bed0bb", fontSize: 13, marginTop: 8 },
  tripTime: { color: "#dce9d8", fontSize: 11, lineHeight: 16, marginTop: 5 },
  card: { backgroundColor: "#fff", padding: 17, borderRadius: Radius.xl, marginBottom: 16, ...Shadows.card },
  section: { color: Colors.onSurfaceMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 12 },
  cardTitle: { color: Colors.ink, fontSize: 18, fontWeight: "600", marginTop: 8 },
  muted: { color: Colors.onSurfaceMuted, fontSize: 12, marginTop: 6 },
  input: { borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: Radius.sm, padding: 13, color: Colors.ink, marginTop: 10 },
  notes: { minHeight: 76, textAlignVertical: "top" },
  notice: { color: Colors.body, backgroundColor: "#fff5d7", padding: 12, borderRadius: 8, marginTop: 12, fontSize: 12 },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: Colors.primaryDark, padding: 15, borderRadius: Radius.sm, marginTop: 15 },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  disabled: { opacity: 0.55 },
  info: { flexDirection: "row", gap: 12, alignItems: "center", paddingBottom: 12, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  infoValue: { color: Colors.ink, fontSize: 14, fontWeight: "600", marginTop: 3 },
  item: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  itemName: { color: Colors.ink, fontSize: 14, fontWeight: "600" },
  assetCode: { color: Colors.onSurfaceMuted, fontSize: 11, marginTop: 3 },
  statusRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  statusButton: { borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 7, paddingVertical: 8, paddingHorizontal: 9 },
  statusSelected: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  statusText: { color: Colors.ink, fontSize: 10, fontWeight: "600" },
  statusTextSelected: { color: "#fff" },
  issueInput: { borderWidth: 1, borderColor: Colors.error, borderRadius: 7, padding: 9, color: Colors.ink, marginTop: 8 },
  errorBox: { backgroundColor: "#ffe8e5", borderRadius: Radius.sm, padding: 12, marginBottom: 12 },
  errorText: { color: Colors.error, fontSize: 12, marginTop: 8 },
  noShowButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14 },
  noShowText: { color: Colors.error, fontWeight: "600", fontSize: 11 },
  warningCard: { borderWidth: 1, borderColor: "#f1c978", backgroundColor: "#fffaf0" },
  resultIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "#e4f4db" },
  resultIconWarning: { backgroundColor: "#ffedc7" },
  friendlyStatus: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, borderRadius: 14, backgroundColor: "#edf5e8", paddingHorizontal: 10, paddingVertical: 7, marginTop: 14 },
  friendlyStatusText: { color: Colors.primaryDark, fontSize: 10, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(14,15,12,.45)", justifyContent: "flex-end" },
  menu: { backgroundColor: Colors.surface, padding: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  menuTitle: { color: Colors.ink, fontSize: 19, fontWeight: "600", marginBottom: 12 },
  reasonButton: { padding: 11, borderRadius: 8, marginBottom: 6, backgroundColor: Colors.surfaceContainerLow },
  reasonSelected: { backgroundColor: "#dcefd2", borderWidth: 1, borderColor: Colors.primaryDark },
  reasonText: { color: Colors.ink, fontSize: 12, fontWeight: "600" },
  dangerButton: { alignItems: "center", backgroundColor: Colors.error, padding: 14, borderRadius: Radius.sm, marginTop: 12 },
});
