import { Ionicons } from "@expo/vector-icons";
import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
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
import {
  PreparationTaskStatus,
  PreparationTaskSummary,
  staffInventoryApi,
} from "@/features/rentals/staff-inventory-api";
import { orderShortCode, productLabel } from "@/features/rentals/display";

const TASK_STATUS_LABEL: Record<string, string> = {
  OPEN: "Mới",
  PICKING: "Đang soạn",
  CONDITION_CAPTURED: "Đã chụp tình trạng",
  PACKED: "Đã đóng gói",
  READY: "Sẵn sàng bàn giao",
  TRANSFERRED: "Đã giao cho giao hàng",
  BLOCKED: "Cần xử lý",
  CANCELLED: "Đã hủy",
};

const STATUS_TONE: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: "#e8f1ff", text: "#1d4ed8" },
  PICKING: { bg: "#fff4dc", text: "#9b6700" },
  CONDITION_CAPTURED: { bg: "#fff4dc", text: "#9b6700" },
  PACKED: { bg: "#efe9ff", text: "#6d28d9" },
  READY: { bg: "#e4f4db", text: "#2f6b1a" },
  TRANSFERRED: { bg: "#eef0ee", text: "#4b5563" },
  BLOCKED: { bg: "#fde8e8", text: "#b42318" },
  CANCELLED: { bg: "#eef0ee", text: "#6b7280" },
};

// Đơn đã chuyển cho nhân viên giao hàng (hoặc đã hủy) không còn là việc kho cần chuẩn bị.
const isFinished = (status: string) => status === "TRANSFERRED" || status === "CANCELLED";

const FILTERS: {
  label: string;
  value?: PreparationTaskStatus;
}[] = [
  { label: "Tất cả" },
  { label: "Mới", value: "OPEN" },
  { label: "Đang soạn", value: "PICKING" },
  { label: "Đã đóng", value: "PACKED" },
  { label: "Sẵn sàng", value: "READY" },
  { label: "Đã giao", value: "TRANSFERRED" },
];

export default function InventoryQueueScreen() {
  const router = useRouter();
  const { accessToken, user, signOut } = useAuth();
  const [filter, setFilter] = useState<PreparationTaskStatus | undefined>();
  const [tasks, setTasks] = useState<PreparationTaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!accessToken) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await staffInventoryApi.listTasks(accessToken, filter);
        // Việc còn phải làm lên trước, đơn đã giao xuống cuối.
        setTasks(
          [...result.items].sort(
            (a, b) => Number(isFinished(a.status)) - Number(isFinished(b.status)),
          ),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải hàng đợi kho.",
        );
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

  const activeCount = tasks.filter((task) => !isFinished(task.status)).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TREKOPS INVENTORY</Text>
            <Text style={styles.title}>
              Xin chào, {user?.fullName || user?.name || "Nhân viên kho"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              void signOut();
              router.replace("/auth/login");
            }}
          >
            <Ionicons name="log-out-outline" size={24} color={Colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.banner}>
          <Ionicons name="file-tray-stacked" size={24} color={Colors.primaryDark} />
          <View style={styles.flex}>
            <Text style={styles.bannerTitle}>Hàng đợi chuẩn bị đơn thuê</Text>
            <Text style={styles.bannerCopy}>
              {activeCount} đơn đang cần kho chuẩn bị
            </Text>
          </View>
          <TouchableOpacity onPress={() => void load(true)}>
            <Ionicons name="refresh" size={22} color={Colors.primaryDark} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>CÔNG VIỆC KHO</Text>
        <View style={styles.operationGrid}>
          <View style={[styles.operationCard, styles.operationCardActive]}>
            <View style={styles.operationIcon}>
              <Ionicons name="cube-outline" size={21} color={Colors.primaryDark} />
            </View>
            <Text style={styles.operationTitle}>Chuẩn bị giao</Text>
            <Text style={styles.operationCopy}>Soạn, chụp tình trạng và đóng gói</Text>
            <Text style={styles.operationCount}>{activeCount} đơn</Text>
          </View>
          <TouchableOpacity
            style={styles.operationCard}
            onPress={() => router.push("/inventory-operations/returns" as never)}
          >
            <View style={[styles.operationIcon, styles.returnIcon]}>
              <Ionicons name="return-down-back-outline" size={21} color="#A15400" />
            </View>
            <Text style={styles.operationTitle}>Nhận hàng trả</Text>
            <Text style={styles.operationCopy}>Tiếp nhận, kiểm định và vệ sinh</Text>
            <View style={styles.operationLink}>
              <Text style={styles.operationLinkText}>Mở hàng đợi</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.primaryDark} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.queueHeading}>
          <View>
            <Text style={styles.sectionTitle}>ĐƠN CẦN CHUẨN BỊ</Text>
            <Text style={styles.sectionCaption}>Lọc theo tiến độ xử lý</Text>
          </View>
          <View style={styles.queueCountPill}>
            <Text style={styles.queueCountText}>{filter ? tasks.length : activeCount} đơn</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((item) => {
            const selected = filter === item.value;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.filter, selected && styles.filterActive]}
                onPress={() => setFilter(item.value)}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <TrekkingLoader
            label="Đang tải hàng đợi kho..."
            hint="Đang đồng bộ thiết bị cần chuẩn bị và kiểm định"
          />
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity style={styles.retry} onPress={() => void load()}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.messageCard}>
            <Ionicons name="cube-outline" size={38} color={Colors.onSurfaceMuted} />
            <Text style={styles.empty}>Không có nhiệm vụ kho ở trạng thái này.</Text>
          </View>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() =>
                router.push({
                  pathname: "/inventory-operations/[id]",
                  params: { id: task.id },
                })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TaskCard({
  task,
  onPress,
}: {
  task: PreparationTaskSummary;
  onPress: () => void;
}) {
  const percent = task.progress.required
    ? Math.round((task.progress.picked / task.progress.required) * 100)
    : 0;
  const productSummary = task.requiredLineSummary
    .map((line) => `${productLabel(line.productName)} ×${line.quantity}`)
    .join("\n");
  const tone = STATUS_TONE[task.status] ?? STATUS_TONE.OPEN;
  const finished = isFinished(task.status);
  return (
    <TouchableOpacity
      style={[styles.card, finished && styles.cardFinished]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={styles.cardTop}>
        <Text style={styles.orderCode}>
          ĐƠN {orderShortCode(task.orderId)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.status, { color: tone.text }]}>
            {TASK_STATUS_LABEL[task.status] ?? "Đang cập nhật"}
          </Text>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={3}>{productSummary || "Thiết bị thuê"}</Text>
      <View style={styles.tripRow}>
        <Ionicons name="trail-sign-outline" size={14} color={Colors.primaryDark} />
        <Text style={styles.tripName} numberOfLines={1}>
          {task.tripTitle || task.pickup.name}
        </Text>
      </View>
      <Text style={styles.meta}>{task.inventoryLocation.name}</Text>
      {task.status === "TRANSFERRED" ? (
        <View style={styles.doneRow}>
          <Ionicons name="checkmark-circle" size={16} color="#2f6b1a" />
          <Text style={styles.doneText}>
            Đã soạn đủ {task.progress.required} thiết bị và giao cho nhân viên giao hàng
          </Text>
        </View>
      ) : task.status === "CANCELLED" ? (
        <View style={styles.doneRow}>
          <Ionicons name="close-circle-outline" size={16} color="#6b7280" />
          <Text style={[styles.doneText, styles.mutedText]}>Đơn đã hủy, không cần chuẩn bị</Text>
        </View>
      ) : (
        <>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Đã soạn</Text>
            <Text style={styles.progressText}>
              {task.progress.picked}/{task.progress.required}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
        </>
      )}
      <View style={styles.openRow}>
        <Text style={styles.openText}>{finished ? "Xem lại" : "Mở quy trình chuẩn bị"}</Text>
        <Ionicons name="arrow-forward" size={18} color={Colors.primaryDark} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: 20, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  eyebrow: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },
  title: { color: Colors.ink, fontSize: 23, fontWeight: "600", marginTop: 5 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#eaf5e1",
    borderRadius: Radius.md,
    padding: 16,
  },
  flex: { flex: 1 },
  bannerTitle: { color: Colors.ink, fontSize: 15, fontWeight: "600" },
  bannerCopy: { color: Colors.body, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: Colors.ink, fontSize: 12, fontWeight: "600", letterSpacing: 0.6, marginTop: 20 },
  sectionCaption: { color: Colors.onSurfaceMuted, fontSize: 10, marginTop: 3 },
  operationGrid: { flexDirection: "row", gap: 10, marginTop: 10 },
  operationCard: { flex: 1, minHeight: 156, borderWidth: 1, borderColor: Colors.surfaceContainer, borderRadius: Radius.md, backgroundColor: "#fff", padding: 13, ...Shadows.card },
  operationCardActive: { borderColor: "#cfe5c5", backgroundColor: "#fbfef9" },
  operationIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#e4f4db" },
  returnIcon: { backgroundColor: "#fff0d9" },
  operationTitle: { color: Colors.ink, fontSize: 14, fontWeight: "600", marginTop: 10 },
  operationCopy: { color: Colors.onSurfaceVariant, fontSize: 10, lineHeight: 14, marginTop: 4 },
  operationCount: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600", marginTop: 9 },
  operationLink: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 9 },
  operationLinkText: { color: Colors.primaryDark, fontSize: 10, fontWeight: "600" },
  queueHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 },
  queueCountPill: { borderRadius: 12, backgroundColor: Colors.primaryPale, paddingHorizontal: 9, paddingVertical: 6 },
  queueCountText: { color: Colors.primaryDark, fontSize: 10, fontWeight: "600" },
  filters: { gap: 8, paddingVertical: 16 },
  filter: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  filterActive: { backgroundColor: Colors.primaryDark },
  filterText: { color: Colors.body, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  loader: { marginTop: 50 },
  messageCard: {
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: Radius.md,
    padding: 28,
  },
  error: { color: Colors.error, textAlign: "center" },
  empty: { color: Colors.onSurfaceMuted, textAlign: "center" },
  retry: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.sm,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: Radius.md,
    padding: 16,
    marginBottom: 12,
    ...Shadows.card,
  },
  cardFinished: { opacity: 0.78 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  orderCode: { flex: 1, color: Colors.primaryDark, fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  status: { fontSize: 10, fontWeight: "600" },
  cardTitle: { color: Colors.ink, fontSize: 15, lineHeight: 21, fontWeight: "600", marginTop: 10 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, borderRadius: Radius.sm, backgroundColor: "#f1f7ec", paddingHorizontal: 10, paddingVertical: 8 },
  doneText: { flex: 1, color: "#2f6b1a", fontSize: 12, lineHeight: 17, fontWeight: "500" },
  mutedText: { color: "#6b7280" },
  tripRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  tripName: { flex: 1, color: Colors.primaryDark, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  meta: { color: Colors.body, fontSize: 12, lineHeight: 17, marginTop: 5 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  progressText: { color: Colors.onSurfaceMuted, fontSize: 11, fontWeight: "500" },
  progressTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: Colors.surfaceContainer,
    marginTop: 7,
  },
  progressFill: { height: "100%", backgroundColor: Colors.primaryDark },
  openRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    marginTop: 14,
    paddingTop: 12,
  },
  openText: { color: Colors.primaryDark, fontSize: 12, fontWeight: "600" },
});
