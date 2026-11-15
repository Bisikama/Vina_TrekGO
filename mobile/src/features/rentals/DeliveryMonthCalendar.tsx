import { Colors, Radius } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";
const WEEKDAYS = ["CN", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7"];
const DONE = new Set(["HANDED_OVER", "INVENTORY_RECEIVED", "NO_SHOW", "REFUSED", "CLOSED", "CANCELLED"]);

export type CalendarTask = {
  id: string;
  type: "OUTBOUND" | "RETURN";
  status: string;
  scheduledAt?: string | null;
  point: { id: string; name: string; address?: string | null };
  orderSummary: { orderId: string; recipient?: { displayName?: string; fullName?: string; name?: string } | null };
  tripTitle?: string;
  itemSummary?: string;
};

/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function vietnamDayKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function vnTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}

function recipientName(task: CalendarTask) {
  const recipient = task.orderSummary.recipient;
  return recipient?.displayName || recipient?.fullName || recipient?.name || "Khách thuê";
}

function orderCode(orderId: string) {
  return `#${orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;
}

function moveMonth(current: { year: number; month: number }, delta: number) {
  const index = current.year * 12 + (current.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Chờ nhận",
  BLOCKED: "Đang bị chặn",
  PACKAGE_RECEIVED: "Đã nhận gói",
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

/**
 * Lịch tháng cho staff giao nhận: chấm màu dưới ngày có nhiệm vụ (xanh = giao, cam = thu hồi, xám = đã xong),
 * vuốt ngang hoặc bấm ‹ › để đổi tháng, chạm một ngày để xem các nhiệm vụ của ngày đó.
 */
export function DeliveryMonthCalendar({
  tasks,
  onOpenTask,
}: {
  tasks: CalendarTask[];
  onOpenTask: (task: CalendarTask) => void;
}) {
  const today = vietnamDayKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return { year, month };
  });
  const [openDay, setOpenDay] = useState<string | null>(null);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    tasks.forEach((task) => {
      if (!task.scheduledAt) return;
      const key = vietnamDayKey(new Date(task.scheduledAt));
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    map.forEach((list) => list.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")));
    return map;
  }, [tasks]);

  const shiftMonth = (delta: number) => setCursor((current) => moveMonth(current, delta));

  // setCursor ổn định nên tạo PanResponder một lần là đủ.
  const [swipe] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -50) setCursor((current) => moveMonth(current, 1));
        else if (gesture.dx > 50) setCursor((current) => moveMonth(current, -1));
      },
    }),
  );

  const cells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(cursor.year, cursor.month - 1, 1, 5)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month, 0, 5)).getUTCDate();
    const list: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      list.push(`${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor]);

  const dayTasks = openDay ? tasksByDay.get(openDay) ?? [] : [];
  const [openYear, openMonth, openDate] = (openDay ?? "").split("-");

  return (
    <View style={styles.card} {...swipe.panHandlers}>
      <View style={styles.monthRow}>
        <TouchableOpacity style={styles.arrow} onPress={() => shiftMonth(-1)} accessibilityLabel="Tháng trước">
          <Ionicons name="chevron-back" size={19} color={Colors.primaryDark} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const [year, month] = today.split("-").map(Number);
            setCursor({ year, month });
          }}
          accessibilityLabel="Về tháng hiện tại"
        >
          <Text style={styles.monthTitle}>
            Tháng {cursor.month} năm {cursor.year}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.arrow} onPress={() => shiftMonth(1)} accessibilityLabel="Tháng sau">
          <Ionicons name="chevron-forward" size={19} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label) => (
          <Text key={label} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((key, index) => {
          if (!key) return <View key={`empty-${index}`} style={styles.cell} />;
          const list = tasksByDay.get(key) ?? [];
          const isToday = key === today;
          const dots = list.slice(0, 3);
          return (
            <TouchableOpacity
              key={key}
              style={styles.cell}
              onPress={() => setOpenDay(key)}
              accessibilityLabel={`Ngày ${Number(key.slice(8))}, ${list.length} nhiệm vụ`}
            >
              <View style={[styles.dayBubble, isToday && styles.todayBubble]}>
                <Text style={[styles.dayText, isToday && styles.todayText]}>{Number(key.slice(8))}</Text>
              </View>
              <View style={styles.dots}>
                {dots.map((task) => (
                  <View
                    key={task.id}
                    style={[
                      styles.dot,
                      DONE.has(task.status) ? styles.dotDone : task.type === "RETURN" ? styles.dotReturn : styles.dotOutbound,
                    ]}
                  />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={[styles.dot, styles.dotOutbound]} />
        <Text style={styles.legendText}>Giao</Text>
        <View style={[styles.dot, styles.dotReturn]} />
        <Text style={styles.legendText}>Thu hồi</Text>
        <View style={[styles.dot, styles.dotDone]} />
        <Text style={styles.legendText}>Đã xong</Text>
      </View>

      <Modal visible={openDay !== null} transparent animationType="slide" onRequestClose={() => setOpenDay(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpenDay(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {openDate}/{openMonth}/{openYear}
            </Text>
            <TouchableOpacity style={styles.close} onPress={() => setOpenDay(null)} accessibilityLabel="Đóng">
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            {dayTasks.length === 0 ? (
              <Text style={styles.emptyText}>Không có nhiệm vụ giao nhận trong ngày này.</Text>
            ) : (
              dayTasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskRow}
                  onPress={() => {
                    setOpenDay(null);
                    onOpenTask(task);
                  }}
                >
                  <View style={styles.timeCol}>
                    <Text style={styles.time}>{task.scheduledAt ? vnTime(task.scheduledAt) : "--:--"}</Text>
                    <View style={[styles.typeTag, task.type === "RETURN" ? styles.typeReturn : styles.typeOutbound]}>
                      <Text style={[styles.typeText, task.type === "RETURN" && styles.typeTextReturn]}>
                        {task.type === "RETURN" ? "Thu hồi" : "Giao"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.point}>{task.point.name}</Text>
                    <Text style={styles.meta}>
                      Đơn {orderCode(task.orderSummary.orderId)} · {recipientName(task)}
                    </Text>
                    {task.itemSummary ? <Text style={styles.meta}>{task.itemSummary}</Text> : null}
                    <Text style={styles.status}>{STATUS_LABEL[task.status] ?? "Đang cập nhật"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primaryDark} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: Radius.md, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#e2eae3" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  arrow: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#f2f7ef" },
  monthTitle: { color: Colors.ink, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekday: { flex: 1, textAlign: "center", color: Colors.onSurfaceMuted, fontSize: 12, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 5, minHeight: 50 },
  dayBubble: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  todayBubble: { backgroundColor: "#f59e0b" },
  dayText: { color: Colors.ink, fontSize: 14, fontVariant: ["tabular-nums"] },
  todayText: { color: "#fff", fontWeight: "700" },
  dots: { flexDirection: "row", gap: 3, height: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOutbound: { backgroundColor: Colors.primaryDark },
  dotReturn: { backgroundColor: "#E49A37" },
  dotDone: { backgroundColor: "#b9c2b4" },
  legend: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 6 },
  legendText: { color: Colors.onSurfaceMuted, fontSize: 12, marginRight: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(14,15,12,.45)" },
  sheet: { maxHeight: "70%", backgroundColor: Colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, backgroundColor: "#173b2f" },
  sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.15)" },
  sheetBody: { padding: 14, gap: 10, paddingBottom: 30 },
  emptyText: { color: Colors.onSurfaceMuted, fontSize: 14, textAlign: "center", paddingVertical: 20 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#e2eae3" },
  timeCol: { alignItems: "center", width: 64, gap: 6 },
  time: { color: Colors.ink, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  typeTag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  typeOutbound: { backgroundColor: "#e4f4db" },
  typeReturn: { backgroundColor: "#fff0d9" },
  typeText: { color: Colors.primaryDark, fontSize: 12, fontWeight: "600" },
  typeTextReturn: { color: "#A15400" },
  point: { color: Colors.ink, fontSize: 15, fontWeight: "600" },
  meta: { color: Colors.body, fontSize: 13, marginTop: 3 },
  status: { color: Colors.primaryDark, fontSize: 12, fontWeight: "600", marginTop: 5 },
});
