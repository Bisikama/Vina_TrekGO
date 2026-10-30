import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import { rentalApi } from "@/features/rentals/api";
import { DeliveryTaskSummary } from "@/features/rentals/types";
import { LeaderNavigationShell } from "@/features/leaders/screens";
import { Ionicons } from "@expo/vector-icons";
import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TaskTab = "WAITING" | "IN_PROGRESS" | "COMPLETED";
type TaskKindFilter = "ALL" | "OUTBOUND" | "RETURN";
type EnrichedDeliveryTask = DeliveryTaskSummary & {
  tripTitle?: string;
  tripType?: "PUBLIC" | "PRIVATE";
  tripStartAt?: string;
  tripEndAt?: string;
  itemSummary?: string;
};

const completedStatuses = new Set([
  "HANDED_OVER",
  "INVENTORY_RECEIVED",
  "NO_SHOW",
  "REFUSED",
  "CLOSED",
  "CANCELLED",
]);
const inProgressStatuses = new Set([
  "PACKAGE_RECEIVED",
  "RECIPIENT_VERIFIED",
  "COLLECTING",
  "RETURNED",
]);

function taskTab(task: DeliveryTaskSummary): TaskTab {
  if (completedStatuses.has(task.status)) return "COMPLETED";
  if (inProgressStatuses.has(task.status)) return "IN_PROGRESS";
  return "WAITING";
}

function recipientName(task: DeliveryTaskSummary) {
  const recipient = task.orderSummary.recipient;
  return recipient?.displayName || recipient?.fullName || recipient?.name || "Khách thuê";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    SCHEDULED: "Chờ nhận",
    BLOCKED: "Đang bị chặn",
    PACKAGE_RECEIVED: "Đã nhận gói thiết bị",
    RECIPIENT_VERIFIED: "Đã xác minh khách",
    HANDED_OVER: "Đã bàn giao",
    COLLECTING: "Đang thu hồi",
    RETURNED: "Đang chuyển về kho",
    INVENTORY_RECEIVED: "Kho đã nhận",
    NO_SHOW: "Khách vắng mặt",
    REFUSED: "Khách từ chối",
    CLOSED: "Đã đóng",
    CANCELLED: "Đã hủy",
  };
  return labels[status] || "Đang cập nhật";
}

function formatTripWindow(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return "Khung giờ chuyến đi đang cập nhật";
  const format = (value: string) =>
    new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  return `${format(startAt)} → ${format(endAt)}`;
}

export default function FieldOperationsHome() {
  const router = useRouter();
  const { user, authRole, signOut } = useApp();
  const { user: authUser, accessToken, signOut: authSignOut } = useAuth();
  const [activeTaskTab, setActiveTaskTab] = useState<TaskTab>("WAITING");
  const [taskKind, setTaskKind] = useState<TaskKindFilter>("ALL");
  const [tasks, setTasks] = useState<EnrichedDeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const effectiveRole =
    authRole ||
    (authUser?.role === "STAFF_DELIVERY" || authUser?.role === "LEADER"
      ? authUser.role
      : null) ||
    (user.role === "STAFF_DELIVERY" || user.role === "LEADER" ? user.role : null);

  const loadTasks = useCallback(
    async (refresh = false) => {
      if (!accessToken || effectiveRole !== "STAFF_DELIVERY") {
        setLoading(false);
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(undefined);
      try {
        const result = await rentalApi.listDeliveryTasks(accessToken, {
          page: 1,
          pageSize: 100,
        });
        const enrichedTasks = await Promise.all(
          result.items.map(async (task): Promise<EnrichedDeliveryTask> => {
            try {
              const detail = await rentalApi.getOrder(
                task.orderSummary.orderId,
                accessToken,
              );
              const names = detail.items
                .map((item) => item.product?.name || item.name || item.sku)
                .filter((name): name is string => Boolean(name));
              const uniqueNames = [...new Set(names)];
              const remainingNames = Math.max(uniqueNames.length - 2, 0);
              const visibleNames = uniqueNames.slice(0, 2).join(", ");
              const quantity = detail.items.reduce(
                (total, item) => total + item.quantity,
                0,
              );
              const trip = detail.order.trip;

              return {
                ...task,
                tripTitle: trip?.title,
                tripType: trip?.type,
                tripStartAt: trip?.startAt,
                tripEndAt: trip?.endAt,
                itemSummary: visibleNames
                  ? `${visibleNames}${remainingNames ? ` +${remainingNames} món` : ""} · ${quantity} thiết bị`
                  : undefined,
              };
            } catch {
              return task;
            }
          }),
        );
        setTasks(enrichedTasks);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Không tải được nhiệm vụ giao nhận.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, effectiveRole],
  );

  useEffect(() => {
    if (!effectiveRole) {
      router.replace("/");
      return;
    }
    if (effectiveRole !== "STAFF_DELIVERY") return;
    const timer = setTimeout(() => void loadTasks(), 0);
    return () => clearTimeout(timer);
  }, [effectiveRole, loadTasks, router]);

  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          taskTab(task) === activeTaskTab &&
          (taskKind === "ALL" || task.type === taskKind),
      ),
    [activeTaskTab, taskKind, tasks],
  );
  const waitingCount = tasks.filter((task) => taskTab(task) === "WAITING").length;
  const inProgressCount = tasks.filter((task) => taskTab(task) === "IN_PROGRESS").length;
  const completedCount = tasks.filter((task) => taskTab(task) === "COMPLETED").length;

  const logout = () => {
    signOut();
    void authSignOut();
    router.replace("/");
  };

  if (!effectiveRole) return null;
  if (effectiveRole === "LEADER") {
    return <LeaderNavigationShell onLogout={logout} />;
  }

  const openTask = (task: DeliveryTaskSummary) => {
    router.push({
      pathname:
        task.type === "RETURN"
          ? "/field-operations/staff-return"
          : "/field-operations/staff-task",
      params: { taskId: task.id, orderId: task.orderSummary.orderId },
    } as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadTasks(true)}
            tintColor={Colors.primaryDark}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TREKOPS DELIVERY</Text>
            <Text style={styles.heading}>Xin chào, {authUser?.name || user.name}</Text>
          </View>
          <TouchableOpacity onPress={logout} accessibilityLabel="Đăng xuất">
            <Ionicons name="log-out-outline" size={23} color={Colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusBanner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="navigate" size={21} color={Colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Ca giao nhận hôm nay</Text>
            <Text style={styles.bannerText}>
              {waitingCount} việc chờ nhận · {inProgressCount} việc đang thực hiện
            </Text>
          </View>
          <TouchableOpacity onPress={() => void loadTasks(true)}>
            <Ionicons name="refresh" size={21} color={Colors.primaryDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Stat value={String(waitingCount)} label="Cần nhận" icon="time-outline" />
          <Stat value={String(inProgressCount)} label="Đang đi" icon="navigate-outline" />
          <Stat value={String(completedCount)} label="Hoàn tất" icon="checkmark-circle-outline" />
        </View>

        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionTitle}>LỊCH GIAO NHẬN</Text>
            <Text style={styles.sectionCaption}>Theo loại công việc và tiến độ</Text>
          </View>
          <Text style={styles.resultCount}>{visibleTasks.length} việc</Text>
        </View>

        <View style={styles.kindTabs}>
          {(
            [
              ["ALL", "Tất cả", "apps-outline"],
              ["OUTBOUND", "Giao thiết bị", "arrow-up-circle-outline"],
              ["RETURN", "Thu hồi", "arrow-down-circle-outline"],
            ] as const
          ).map(([value, label, icon]) => (
            <TouchableOpacity
              key={value}
              style={[styles.kindTab, taskKind === value && styles.kindTabActive]}
              onPress={() => setTaskKind(value)}
            >
              <Ionicons
                name={icon}
                size={16}
                color={taskKind === value ? "#fff" : Colors.primaryDark}
              />
              <Text style={[styles.kindTabText, taskKind === value && styles.kindTabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.taskTabs}>
          {(
            [
              ["WAITING", "Chờ nhận"],
              ["IN_PROGRESS", "Đang xử lý"],
              ["COMPLETED", "Hoàn tất"],
            ] as const
          ).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[styles.taskTab, activeTaskTab === value && styles.taskTabActive]}
              onPress={() => setActiveTaskTab(value)}
            >
              <Text style={[styles.taskTabText, activeTaskTab === value && styles.taskTabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <TrekkingLoader
              label="Đang tải lịch giao nhận..."
              hint="Đang sắp xếp các chặng giao và thu hồi gần nhất"
            />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retry} onPress={() => void loadTasks()}>
              <Text style={styles.retryText}>THỬ LẠI</Text>
            </TouchableOpacity>
          </View>
        ) : visibleTasks.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Không có nhiệm vụ trong trạng thái này.</Text>
          </View>
        ) : (
          visibleTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[
                styles.taskCard,
                task.type === "RETURN" ? styles.returnCard : styles.outboundCard,
              ]}
              onPress={() => openTask(task)}
              activeOpacity={0.84}
            >
              <View style={styles.taskTop}>
                <View
                  style={[
                    styles.taskTypeBadge,
                    task.type === "RETURN" ? styles.returnBadge : styles.outboundBadge,
                  ]}
                >
                  <Ionicons
                    name={task.type === "RETURN" ? "arrow-down-circle" : "arrow-up-circle"}
                    size={15}
                    color={task.type === "RETURN" ? "#A15400" : Colors.primaryDark}
                  />
                  <Text
                    style={[
                      styles.taskTypeText,
                      task.type === "RETURN" && styles.returnTypeText,
                    ]}
                  >
                    {task.type === "RETURN" ? "THU HỒI THIẾT BỊ" : "GIAO THIẾT BỊ"}
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.taskStatus}>{statusLabel(task.status)}</Text>
                </View>
              </View>
              <Text style={styles.taskTitle}>{task.tripTitle || "Chuyến trekking"}</Text>
              <View style={styles.tripInfoRow}>
                <View style={styles.tripTypePill}>
                  <Text style={styles.tripTypeText}>
                    {task.tripType === "PRIVATE" ? "Chuyến riêng" : "Chuyến công khai"}
                  </Text>
                </View>
                <Text style={styles.tripTime}>
                  {formatTripWindow(task.tripStartAt, task.tripEndAt)}
                </Text>
              </View>
              <Text style={styles.taskMeta}>
                <Ionicons name="person-outline" size={13} /> {recipientName(task)}
              </Text>
              <Text style={styles.taskMeta}>
                <Ionicons name="location-outline" size={13} /> {task.point.name}
              </Text>
              <View style={styles.taskItems}>
                <Ionicons
                  name={task.type === "RETURN" ? "return-down-back-outline" : "cube-outline"}
                  size={16}
                  color={Colors.primaryDark}
                />
                <Text style={styles.taskItemsText}>
                  {task.itemSummary ||
                    (task.package.status === "HANDED_OVER"
                      ? "Gói thiết bị đã bàn giao"
                      : task.package.status === "READY"
                        ? "Gói thiết bị sẵn sàng"
                        : "Thông tin gói thiết bị")}
                </Text>
                <Text style={styles.openTaskText}>Mở nhiệm vụ</Text>
                <Ionicons name="chevron-forward" size={17} color={Colors.primaryDark} />
              </View>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.refreshAction} onPress={() => void loadTasks(true)}>
          <Ionicons name="refresh-outline" size={19} color={Colors.primaryDark} />
          <Text style={styles.refreshText}>Làm mới nhiệm vụ</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={17} color={Colors.primaryDark} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  eyebrow: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600", letterSpacing: 1.1 },
  heading: { color: Colors.ink, fontSize: 25, fontWeight: "600", marginTop: 5 },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: Radius.md, marginBottom: 16, backgroundColor: "#eaf5e1" },
  bannerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#d6edc8" },
  bannerTitle: { color: Colors.ink, fontSize: 15, fontWeight: "600" },
  bannerText: { color: Colors.body, fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 25 },
  stat: { flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: Radius.sm, ...Shadows.card },
  statValue: { color: Colors.ink, fontSize: 22, fontWeight: "600" },
  statLabel: { color: Colors.onSurfaceMuted, fontSize: 11, marginTop: 5 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 11 },
  sectionTitle: { color: Colors.ink, fontSize: 14, fontWeight: "600", letterSpacing: 0.5 },
  sectionCaption: { color: Colors.onSurfaceMuted, fontSize: 10, marginTop: 3 },
  resultCount: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  kindTabs: { flexDirection: "row", gap: 7, marginBottom: 9 },
  kindTab: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: "#d7e5d0", borderRadius: 12, backgroundColor: "#f8fbf6" },
  kindTabActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  kindTabText: { color: Colors.primaryDark, fontSize: 10, fontWeight: "600" },
  kindTabTextActive: { color: "#fff" },
  taskTabs: { flexDirection: "row", gap: 7, marginBottom: 12 },
  taskTab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.surfaceContainerLow },
  taskTabActive: { backgroundColor: Colors.primaryDark },
  taskTabText: { color: Colors.onSurfaceMuted, fontSize: 11, fontWeight: "600" },
  taskTabTextActive: { color: "#fff" },
  center: { backgroundColor: "#fff", padding: 24, borderRadius: Radius.sm, alignItems: "center", gap: 10 },
  emptyText: { color: Colors.onSurfaceMuted, textAlign: "center" },
  errorBox: { backgroundColor: "#ffe8e5", padding: 16, borderRadius: Radius.sm },
  errorText: { color: Colors.error, fontSize: 13 },
  retry: { alignSelf: "flex-start", backgroundColor: Colors.primaryDark, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, marginTop: 12 },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 11 },
  taskCard: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 16, marginBottom: 12, borderLeftWidth: 4, ...Shadows.card },
  outboundCard: { borderLeftColor: Colors.primaryDark },
  returnCard: { borderLeftColor: "#E49A37" },
  taskTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  taskTypeBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  outboundBadge: { backgroundColor: "#e4f4db" },
  returnBadge: { backgroundColor: "#fff0d9" },
  taskTypeText: { color: Colors.primaryDark, fontSize: 9, fontWeight: "600" },
  returnTypeText: { color: "#A15400" },
  statusPill: { borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#f2efe7" },
  taskStatus: { color: "#76520b", fontSize: 9, fontWeight: "600" },
  taskTitle: { color: Colors.ink, fontSize: 18, fontWeight: "600", marginTop: 12, marginBottom: 7 },
  tripInfoRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 11 },
  tripTypePill: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "#edf3ea" },
  tripTypeText: { color: Colors.primaryDark, fontSize: 9, fontWeight: "600" },
  tripTime: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 10 },
  taskMeta: { color: Colors.body, fontSize: 13, marginBottom: 5 },
  taskItems: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer, paddingTop: 12, marginTop: 7 },
  taskItemsText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 12 },
  openTaskText: { color: Colors.primaryDark, fontSize: 10, fontWeight: "600" },
  refreshAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, marginTop: 8 },
  refreshText: { color: Colors.primaryDark, fontWeight: "600" },
});
