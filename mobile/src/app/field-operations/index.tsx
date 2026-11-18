import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import { rentalApi } from "@/features/rentals/api";
import { productLabel, splitGradeName } from "@/features/rentals/display";
import { DeliveryTaskSummary } from "@/features/rentals/types";
import {
  DeliveryMonthCalendar,
  vietnamDayKey,
} from "@/features/rentals/DeliveryMonthCalendar";
import { LeaderNavigationShell } from "@/features/leaders/screens";
import { Ionicons } from "@expo/vector-icons";
import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { TrekGoLogo } from "@/components/TrekGoLogo";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TaskTab = "WAITING" | "IN_PROGRESS" | "COMPLETED";
type TaskKindFilter = "ALL" | "OUTBOUND" | "RETURN";
type TimeFilter = "ALL" | "TODAY" | "TOMORROW" | "WEEK";

const TIME_FILTERS: [TimeFilter, string][] = [
  ["ALL", "Mọi ngày"],
  ["TODAY", "Hôm nay"],
  ["TOMORROW", "Ngày mai"],
  ["WEEK", "7 ngày tới"],
];

/** Bỏ dấu tiếng Việt để gõ "da lat" vẫn tìm ra "Đà Lạt". */
function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function addDaysKey(days: number) {
  return vietnamDayKey(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}
type EnrichedDeliveryTask = DeliveryTaskSummary & {
  tripTitle?: string;
  tripType?: "PUBLIC" | "PRIVATE";
  tripStartAt?: string;
  tripEndAt?: string;
  itemSummary?: string;
  /** Món trong đơn đã gộp theo tên + hạng, để hiện danh sách gọn trên thẻ. */
  itemLines?: { name: string; grade: string | null; quantity: number }[];
  itemCount?: number;
  /** Mốc thời gian của đơn từ GET /rental-orders/:id (PACKED, HANDED_OVER, RETURNED, CLOSED…). */
  timeline?: { type: string; at: string }[];
};

const TIMELINE_STEPS: Record<string, string> = {
  PACKED: "Kho đóng gói",
  HANDED_OVER: "Giao khách",
  RETURNED: "Thu hồi",
  CLOSED: "Kết thúc",
};

/** "13:06 · 09/11" theo giờ Việt Nam. */
function formatShortDateTime(value?: string | null) {
  if (!value) return "Chưa có";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} · ${get("day")}/${get("month")}`;
}

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

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
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
  const [searchText, setSearchText] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);
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
                .map((item) => { const name = item.product?.name || item.name || item.sku; return name ? productLabel(name) : name; })
                .filter((name): name is string => Boolean(name));
              const uniqueNames = [...new Set(names)];
              const remainingNames = Math.max(uniqueNames.length - 2, 0);
              const visibleNames = uniqueNames.slice(0, 2).join(", ");
              const quantity = detail.items.reduce(
                (total, item) => total + item.quantity,
                0,
              );
              const lineMap = new Map<string, { name: string; grade: string | null; quantity: number }>();
              detail.items.forEach((item) => {
                const raw = item.product?.name || item.name || item.sku;
                if (!raw) return;
                const { base, grade } = splitGradeName(raw);
                const key = `${base}|${grade ?? ""}`;
                const existing = lineMap.get(key);
                if (existing) existing.quantity += item.quantity;
                else lineMap.set(key, { name: base, grade, quantity: item.quantity });
              });
              const trip = detail.order.trip;

              return {
                ...task,
                tripTitle: trip?.title,
                tripType: trip?.type,
                tripStartAt: trip?.startAt,
                tripEndAt: trip?.endAt,
                // Giao chỉ hiện mốc tới lúc khách nhận; thu hồi hiện mốc từ lúc khách nhận trở đi.
                timeline: (detail.timeline ?? []).flatMap((step) =>
                  step.type &&
                  step.at &&
                  TIMELINE_STEPS[step.type] &&
                  (task.type === "RETURN" ? step.type !== "PACKED" : step.type === "PACKED" || step.type === "HANDED_OVER")
                    ? [{ type: step.type, at: step.at }]
                    : [],
                ),
                itemLines: [...lineMap.values()],
                itemCount: quantity,
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

  const isOverdue = useCallback(
    (task: EnrichedDeliveryTask) =>
      taskTab(task) !== "COMPLETED" &&
      Boolean(task.scheduledAt) &&
      new Date(task.scheduledAt as string).getTime() < Date.now(),
    [],
  );
  const overdueCount = tasks.filter(isOverdue).length;
  // Lọc theo loại, thời gian, trễ hẹn và từ khoá (chưa xét tab trạng thái).
  const filteredTasks = useMemo(() => {
    const keyword = normalizeSearch(searchText);
    const today = addDaysKey(0);
    const tomorrow = addDaysKey(1);
    const weekEnd = addDaysKey(6);
    return tasks.filter((task) => {
      if (taskKind !== "ALL" && task.type !== taskKind) return false;
      if (overdueOnly && !isOverdue(task)) return false;
      if (timeFilter !== "ALL") {
        if (!task.scheduledAt) return false;
        const key = vietnamDayKey(new Date(task.scheduledAt));
        if (timeFilter === "TODAY" && key !== today) return false;
        if (timeFilter === "TOMORROW" && key !== tomorrow) return false;
        if (timeFilter === "WEEK" && (key < today || key > weekEnd)) return false;
      }
      if (!keyword) return true;
      const recipient = task.orderSummary.recipient;
      const haystack = normalizeSearch(
        [
          task.package.code,
          task.orderSummary.orderId,
          recipient?.fullName,
          recipient?.displayName,
          recipient?.name,
          task.point.name,
          task.point.address,
          task.itemSummary,
          task.tripTitle,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return keyword.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [isOverdue, overdueOnly, searchText, taskKind, tasks, timeFilter]);
  const visibleTasks = useMemo(
    () => filteredTasks.filter((task) => taskTab(task) === activeTaskTab),
    [activeTaskTab, filteredTasks],
  );
  const tabCount = (tab: TaskTab) =>
    filteredTasks.filter((task) => taskTab(task) === tab).length;
  const hasExtraFilter = Boolean(searchText.trim()) || timeFilter !== "ALL" || overdueOnly;
  // Gom theo điểm hẹn để biết trong ngày phải giao/thu hồi những đơn nào ở từng địa điểm.
  const pointGroups = useMemo(() => {
    const groups = new Map<string, { point: DeliveryTaskSummary["point"]; tasks: EnrichedDeliveryTask[] }>();
    visibleTasks.forEach((task) => {
      const group = groups.get(task.point.id) ?? { point: task.point, tasks: [] };
      group.tasks.push(task);
      groups.set(task.point.id, group);
    });
    return [...groups.values()];
  }, [visibleTasks]);
  const waitingCount = tasks.filter((task) => taskTab(task) === "WAITING").length;
  const inProgressCount = tasks.filter((task) => taskTab(task) === "IN_PROGRESS").length;
  const completedCount = tasks.filter((task) => taskTab(task) === "COMPLETED").length;

  const displayName =
    authUser?.fullName?.trim() || authUser?.name?.trim() || authUser?.email?.split("@")[0] || user.name || "Nhân viên giao nhận";

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
          <View style={styles.brandRow}>
            <TrekGoLogo size={28} />
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Staff Delivery</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout} accessibilityLabel="Đăng xuất">
            <Ionicons name="log-out-outline" size={21} color={Colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.identity}>
          {authUser?.avatarUrl || authUser?.avatar ? (
            <Image source={{ uri: (authUser.avatarUrl || authUser.avatar) as string }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials(displayName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.heading} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.identityMeta} numberOfLines={1}>
              Nhân viên giao nhận{authUser?.email ? ` · ${authUser.email}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.statusBanner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="navigate" size={21} color={Colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              Ca giao nhận của bạn
            </Text>
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
            <Text style={styles.sectionCaption}>Theo ngày, điểm hẹn và tiến độ</Text>
          </View>
          <Text style={styles.resultCount}>{visibleTasks.length} việc</Text>
        </View>

        <DeliveryMonthCalendar tasks={tasks} onOpenTask={(task) => openTask(task as EnrichedDeliveryTask)} />

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.onSurfaceMuted} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm mã đơn, khách, điểm hẹn, món đồ…"
            placeholderTextColor={Colors.onSurfaceMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText ? (
            <TouchableOpacity hitSlop={8} onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color={Colors.onSurfaceMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {TIME_FILTERS.map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, timeFilter === value && styles.chipActive]}
              onPress={() => setTimeFilter(value)}
            >
              <Text style={[styles.chipText, timeFilter === value && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.chip, styles.chipWarn, overdueOnly && styles.chipWarnActive]}
            onPress={() => setOverdueOnly((value) => !value)}
          >
            <Ionicons
              name="alarm-outline"
              size={13}
              color={overdueOnly ? "#fff" : "#b45309"}
            />
            <Text style={[styles.chipWarnText, overdueOnly && styles.chipTextActive]}>
              Trễ hẹn{overdueCount ? ` (${overdueCount})` : ""}
            </Text>
          </TouchableOpacity>
        </ScrollView>

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
                {label} ({tabCount(value)})
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
            <Text style={styles.emptyText}>
              {hasExtraFilter
                ? "Không có nhiệm vụ khớp bộ lọc."
                : "Không có nhiệm vụ trong trạng thái này."}
            </Text>
            {hasExtraFilter ? (
              <TouchableOpacity
                style={styles.clearFilter}
                onPress={() => {
                  setSearchText("");
                  setTimeFilter("ALL");
                  setOverdueOnly(false);
                }}
              >
                <Text style={styles.clearFilterText}>Xoá bộ lọc</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          pointGroups.map((group) => (
            <View key={group.point.id} style={styles.pointGroup}>
              <View style={styles.pointHeader}>
                <Ionicons name="location" size={18} color={Colors.primaryDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pointName}>{group.point.name}</Text>
                  {group.point.address ? <Text style={styles.pointAddress}>{group.point.address}</Text> : null}
                </View>
                <Text style={styles.pointCount}>
                  {[
                    group.tasks.filter((task) => task.type === "OUTBOUND").length
                      ? `${group.tasks.filter((task) => task.type === "OUTBOUND").length} giao`
                      : null,
                    group.tasks.filter((task) => task.type === "RETURN").length
                      ? `${group.tasks.filter((task) => task.type === "RETURN").length} thu hồi`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              {group.tasks.map((task) => (
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
              <Text style={styles.taskMeta}>
                <Ionicons name="time-outline" size={13} /> Hẹn{" "}
                <Text style={styles.tabular}>{formatShortDateTime(task.scheduledAt)}</Text>
              </Text>
              {task.earlyReturn ? (
                <View style={styles.earlyReturnPill}>
                  <Text style={styles.earlyReturnText}>
                    {task.earlyReturn.status === "CONFIRMED"
                      ? `Khách trả sớm · hẹn ${formatShortDateTime(task.earlyReturn.slotAt)}`
                      : "Lịch trả sớm chờ xác nhận lại"}
                  </Text>
                </View>
              ) : null}
              {task.timeline && task.timeline.length > 0 ? (
                <View style={styles.timelineRow}>
                  {task.timeline.map((step) => (
                    <View key={`${step.type}-${step.at}`} style={styles.timelineStep}>
                      <Text style={styles.timelineLabel}>{TIMELINE_STEPS[step.type]}</Text>
                      <Text style={styles.timelineTime}>{formatShortDateTime(step.at)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {task.itemLines?.length ? (
                <View style={styles.itemList}>
                  {task.itemLines.slice(0, 3).map((line) => (
                    <View key={`${line.name}-${line.grade}`} style={styles.itemLine}>
                      <View style={styles.itemDot} />
                      <Text style={styles.itemName} numberOfLines={1}>
                        {line.name}
                      </Text>
                      {line.grade ? <Text style={styles.itemGrade}>{line.grade}</Text> : null}
                      <Text style={styles.itemQty}>×{line.quantity}</Text>
                    </View>
                  ))}
                  {task.itemLines.length > 3 ? (
                    <Text style={styles.itemMore}>+{task.itemLines.length - 3} món khác</Text>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.taskItems}>
                <Ionicons
                  name={task.type === "RETURN" ? "return-down-back-outline" : "cube-outline"}
                  size={16}
                  color={Colors.primaryDark}
                />
                <Text style={styles.taskItemsText}>
                  {task.itemLines?.length
                    ? `${task.itemLines.length} món · ${task.itemCount ?? 0} thiết bị`
                    : task.package.status === "HANDED_OVER"
                      ? "Gói thiết bị đã bàn giao"
                      : task.package.status === "READY"
                        ? "Gói thiết bị sẵn sàng"
                        : "Thông tin gói thiết bị"}
                </Text>
                <Text style={styles.openTaskText}>Mở nhiệm vụ</Text>
                <Ionicons name="chevron-forward" size={17} color={Colors.primaryDark} />
              </View>
            </TouchableOpacity>
              ))}
            </View>
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
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  roleBadge: { backgroundColor: "#173b2f", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  roleBadgeText: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  logoutButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#eef3ea" },
  identity: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", borderRadius: Radius.md, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#e2eae3" },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#dcece2" },
  avatarText: { color: Colors.primaryDark, fontSize: 18, fontWeight: "700" },
  greeting: { color: Colors.onSurfaceMuted, fontSize: 14 },
  heading: { color: Colors.ink, fontSize: 20, fontWeight: "600", marginTop: 2 },
  identityMeta: { color: Colors.onSurfaceMuted, fontSize: 14, marginTop: 3 },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: Radius.md, marginBottom: 16, backgroundColor: "#eaf5e1" },
  bannerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#d6edc8" },
  bannerTitle: { color: Colors.ink, fontSize: 16, fontWeight: "600" },
  bannerText: { color: Colors.body, fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 25 },
  stat: { flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: Radius.sm, ...Shadows.card },
  statValue: { color: Colors.ink, fontSize: 22, fontWeight: "600" },
  statLabel: { color: Colors.onSurfaceMuted, fontSize: 13, marginTop: 5 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 11 },
  sectionTitle: { color: Colors.ink, fontSize: 15, fontWeight: "600", letterSpacing: 0.5 },
  sectionCaption: { color: Colors.onSurfaceMuted, fontSize: 12, marginTop: 3 },
  resultCount: { color: Colors.primaryDark, fontSize: 13, fontWeight: "600" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#d7e5d0", backgroundColor: "#fff", marginBottom: 9 },
  searchInput: { flex: 1, color: Colors.ink, fontSize: 14, paddingVertical: 8 },
  chipRow: { gap: 7, paddingBottom: 9 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#d7e5d0", backgroundColor: "#f8fbf6" },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.primaryDark, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  chipWarn: { borderColor: "#f5d0a9", backgroundColor: "#fff7ed" },
  chipWarnActive: { backgroundColor: "#d97706", borderColor: "#d97706" },
  chipWarnText: { color: "#b45309", fontSize: 13, fontWeight: "500" },
  clearFilter: { backgroundColor: Colors.primaryPale, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  clearFilterText: { color: Colors.primaryDark, fontSize: 14, fontWeight: "600" },
  kindTabs: { flexDirection: "row", gap: 7, marginBottom: 9 },
  kindTab: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: "#d7e5d0", borderRadius: 12, backgroundColor: "#f8fbf6" },
  kindTabActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  kindTabText: { color: Colors.primaryDark, fontSize: 12, fontWeight: "600" },
  kindTabTextActive: { color: "#fff" },
  taskTabs: { flexDirection: "row", gap: 7, marginBottom: 12 },
  taskTab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.surfaceContainerLow },
  taskTabActive: { backgroundColor: Colors.primaryDark },
  taskTabText: { color: Colors.onSurfaceMuted, fontSize: 13, fontWeight: "600" },
  taskTabTextActive: { color: "#fff" },
  center: { backgroundColor: "#fff", padding: 24, borderRadius: Radius.sm, alignItems: "center", gap: 10 },
  emptyText: { color: Colors.onSurfaceMuted, textAlign: "center" },
  errorBox: { backgroundColor: "#ffe8e5", padding: 16, borderRadius: Radius.sm },
  errorText: { color: Colors.error, fontSize: 14 },
  retry: { alignSelf: "flex-start", backgroundColor: Colors.primaryDark, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, marginTop: 12 },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  taskCard: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 16, marginBottom: 12, borderLeftWidth: 4, ...Shadows.card },
  outboundCard: { borderLeftColor: Colors.primaryDark },
  returnCard: { borderLeftColor: "#E49A37" },
  taskTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  taskTypeBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  outboundBadge: { backgroundColor: "#e4f4db" },
  returnBadge: { backgroundColor: "#fff0d9" },
  taskTypeText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  returnTypeText: { color: "#A15400" },
  statusPill: { borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#f2efe7" },
  taskStatus: { color: "#76520b", fontSize: 11, fontWeight: "600" },
  taskTitle: { color: Colors.ink, fontSize: 18, fontWeight: "600", marginTop: 12, marginBottom: 7 },
  tripInfoRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 11 },
  tripTypePill: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "#edf3ea" },
  tripTypeText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  tripTime: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 12 },
  taskMeta: { color: Colors.body, fontSize: 14, marginBottom: 5 },
  tabular: { fontVariant: ["tabular-nums"] },
  earlyReturnPill: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    backgroundColor: "#FEF3C7",
  },
  earlyReturnText: { color: "#92400E", fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  taskItems: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer, paddingTop: 12, marginTop: 7 },
  itemList: { marginTop: 10, gap: 6, padding: 10, borderRadius: 12, backgroundColor: "#f6f9f3" },
  itemLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  itemDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  itemName: { flexShrink: 1, color: Colors.ink, fontSize: 14, fontWeight: "500" },
  itemGrade: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600", backgroundColor: "#fff", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  itemQty: { marginLeft: "auto", color: Colors.onSurfaceVariant, fontSize: 13 },
  itemMore: { color: Colors.onSurfaceVariant, fontSize: 12, marginLeft: 12 },
  taskItemsText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 14 },
  openTaskText: { color: Colors.primaryDark, fontSize: 12, fontWeight: "600" },
  pointGroup: { marginBottom: 8 },
  timelineRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 2 },
  timelineStep: { backgroundColor: "#f2f7ef", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  timelineLabel: { color: Colors.onSurfaceMuted, fontSize: 14 },
  timelineTime: { color: Colors.ink, fontSize: 14, fontWeight: "600", marginTop: 2, fontVariant: ["tabular-nums"] },
  pointHeader: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 8, marginBottom: 6 },
  pointName: { color: Colors.ink, fontSize: 17, fontWeight: "600" },
  pointAddress: { color: Colors.onSurfaceMuted, fontSize: 14, marginTop: 2 },
  pointCount: { color: Colors.primaryDark, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  refreshAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, marginTop: 8 },
  refreshText: { color: Colors.primaryDark, fontWeight: "600" },
});
