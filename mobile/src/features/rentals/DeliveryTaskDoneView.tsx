import { FadeInUp, MountainHero, PopIn, SummitProgress, Trek, TrailStepper } from "@/features/gear/TrekKit";
import { productLabel } from "@/features/rentals/display";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type DoneUnit = { unitId: string; assetCode: string; product?: { name?: string } | null };

/** Mốc thuộc về từng loại nhiệm vụ: giao chỉ tới lúc khách nhận, thu hồi tính từ lúc khách đang giữ đồ. */
const MILESTONES_BY_TYPE: Record<"OUTBOUND" | "RETURN", string[]> = {
  OUTBOUND: ["PAID", "PACKED", "HANDED_OVER"],
  RETURN: ["HANDED_OVER", "RETURNED", "CLOSED", "COMPLETED"],
};

const SUCCESS = new Set(["HANDED_OVER", "INVENTORY_RECEIVED", "CLOSED"]);

const MILESTONES: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ORDER_CREATED: { label: "Khách đặt đơn", icon: "create-outline" },
  PAID: { label: "Khách thanh toán", icon: "card-outline" },
  PACKED: { label: "Kho đóng gói xong", icon: "cube-outline" },
  HANDED_OVER: { label: "Giao tới tay khách", icon: "hand-left-outline" },
  RETURNED: { label: "Bắt đầu thu hồi", icon: "return-down-back-outline" },
  CLOSED: { label: "Kết thúc thuê", icon: "flag-outline" },
  COMPLETED: { label: "Hoàn tất đơn", icon: "trophy-outline" },
  CANCELLED: { label: "Đơn bị hủy", icon: "close-circle-outline" },
};

function headline(type: "OUTBOUND" | "RETURN", status: string) {
  if (status === "NO_SHOW") return { title: "Chặng dừng giữa đường", highlight: "Khách không đến nhận", description: "Ngoại lệ đã được ghi lại để bộ phận liên quan xử lý." };
  if (status === "REFUSED") return { title: "Chặng dừng giữa đường", highlight: "Khách từ chối nhận", description: "Lý do đã được lưu. Bảo quản kiện để bàn giao lại." };
  if (status === "CANCELLED") return { title: "Chặng đã hủy", highlight: "Không cần thực hiện", description: "Nhiệm vụ này không còn hiệu lực." };
  if (type === "OUTBOUND") return { title: "Đã về đích", highlight: "Thiết bị đã tới tay khách", description: "Khách đã nhận đủ thiết bị. Chúc đoàn một chuyến đi an toàn." };
  return { title: "Đã về đích", highlight: "Thiết bị đã về kho", description: "Đồ đã thu hồi và bàn giao cho kho kiểm định." };
}

function formatTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} · ${get("day")}/${get("month")}/${get("year")}`;
}

/** Màn kết thúc nhiệm vụ giao/thu hồi theo phong cách trekking: chỉ xem lại, không còn thao tác. */
export function DeliveryTaskDoneView({
  type,
  status,
  orderCode,
  recipient,
  pointName,
  units,
  timeline,
  onBack,
}: {
  type: "OUTBOUND" | "RETURN";
  status: string;
  orderCode: string;
  recipient: string;
  pointName: string;
  units: DoneUnit[];
  timeline: { type?: string; at?: string }[];
  onBack: () => void;
}) {
  const success = SUCCESS.has(status);
  const head = headline(type, status);
  const steps = (type === "OUTBOUND" ? ["Nhận kiện", "Xác minh khách", "Bàn giao"] : ["Thu hồi", "Ghi nhận", "Về kho"]).map(
    (label) => ({ label, state: success ? ("done" as const) : ("todo" as const) }),
  );
  const milestones = timeline.filter((step): step is { type: string; at: string } =>
    Boolean(step.type && step.at && MILESTONES[step.type] && MILESTONES_BY_TYPE[type].includes(step.type)),
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityLabel="Quay lại">
          <Ionicons name="arrow-back" size={23} color={Trek.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{type === "OUTBOUND" ? "Giao thiết bị" : "Thu hồi thiết bị"}</Text>
        <View style={{ width: 23 }} />
      </View>

      <MountainHero
        eyebrow={`Đơn ${orderCode} · ${success ? "Hoàn tất" : "Kết thúc"}`}
        title={head.title}
        highlight={head.highlight}
        description={head.description}
        icon={success ? "flag" : "alert-circle-outline"}
      >
        {success ? <SummitProgress value={1} total={1} dark height={84} /> : null}
      </MountainHero>

      {success ? (
        <FadeInUp delay={120} style={styles.card}>
          <TrailStepper steps={steps} />
        </FadeInUp>
      ) : null}

      <FadeInUp delay={200} style={styles.card}>
        <Text style={styles.section}>ĐIỂM HẸN</Text>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color={Trek.trail} />
          <Text style={styles.infoText}>{pointName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={18} color={Trek.trail} />
          <Text style={styles.infoText}>{recipient}</Text>
        </View>
      </FadeInUp>

      {milestones.length > 0 ? (
        <FadeInUp delay={280} style={styles.card}>
          <Text style={styles.section}>{type === "OUTBOUND" ? "NHẬT KÝ GIAO HÀNG" : "NHẬT KÝ THU HỒI"}</Text>
          {milestones.map((step, index) => (
            <View key={`${step.type}-${step.at}`} style={styles.milestone}>
              <View style={styles.rail}>
                <View style={[styles.marker, index === milestones.length - 1 && styles.markerLast]}>
                  <Ionicons name={MILESTONES[step.type].icon} size={14} color="#fff" />
                </View>
                {index < milestones.length - 1 ? <View style={styles.railLine} /> : null}
              </View>
              <View style={styles.milestoneBody}>
                <Text style={styles.milestoneLabel}>{MILESTONES[step.type].label}</Text>
                <Text style={styles.milestoneTime}>{formatTime(step.at)}</Text>
              </View>
            </View>
          ))}
        </FadeInUp>
      ) : null}

      {units.length > 0 ? (
        <FadeInUp delay={360} style={styles.card}>
          <Text style={styles.section}>THIẾT BỊ ({units.length})</Text>
          {units.map((unit) => (
            <View key={unit.unitId} style={styles.unitRow}>
              <PopIn>
                <View style={[styles.check, !success && styles.checkMuted]}>
                  <Ionicons name={success ? "checkmark" : "remove"} size={14} color="#fff" />
                </View>
              </PopIn>
              <View style={{ flex: 1 }}>
                <Text style={styles.unitName}>{unit.product?.name ? productLabel(unit.product.name) : "Thiết bị thuê"}</Text>
                <Text style={styles.unitCode}>Mã {unit.assetCode.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}</Text>
              </View>
            </View>
          ))}
        </FadeInUp>
      ) : null}

      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="trail-sign-outline" size={18} color="#fff" />
        <Text style={styles.backText}>Về danh sách nhiệm vụ</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  headerTitle: { color: Trek.ink, fontSize: 17, fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Trek.line },
  section: { color: Trek.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  infoText: { color: Trek.ink, fontSize: 15, flex: 1 },
  milestone: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 28 },
  marker: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Trek.trail },
  markerLast: { backgroundColor: Trek.sun },
  railLine: { flex: 1, width: 2, minHeight: 18, marginVertical: 2, borderStyle: "dashed", borderLeftWidth: 2, borderColor: "#b9d4c2" },
  milestoneBody: { flex: 1, paddingBottom: 14 },
  milestoneLabel: { color: Trek.ink, fontSize: 15, fontWeight: "600" },
  milestoneTime: { color: Trek.muted, fontSize: 13, marginTop: 2, fontVariant: ["tabular-nums"] },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Trek.line },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: Trek.trail },
  checkMuted: { backgroundColor: "#b9c2b4" },
  unitName: { color: Trek.ink, fontSize: 15, fontWeight: "600" },
  unitCode: { color: Trek.muted, fontSize: 13, marginTop: 2, fontVariant: ["tabular-nums"] },
  backButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Trek.forestLight, borderRadius: 14, paddingVertical: 15, marginTop: 4 },
  backText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
