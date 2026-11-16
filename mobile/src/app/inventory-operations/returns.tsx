import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError } from "@/lib/api-client";
import {
  DamageAssessmentRule,
  FinalInspectionInput,
  ReturnQueueStatus,
  ReturnUnitStage,
  StaffReturnDetail,
  StaffReturnSummary,
  StaffReturnUnit,
  staffReturnsApi,
} from "@/features/rentals/staff-returns-api";
import { productLabel, splitGradeName } from "@/features/rentals/display";
import { EvidenceThumbStrip } from "@/features/rentals/EvidenceThumbStrip";
import { ReturnEvidenceGallery } from "@/features/rentals/ReturnEvidenceGallery";
import { useEvidenceUploads } from "@/features/rentals/useEvidenceUploads";

type Condition = FinalInspectionInput["condition"];
type Draft = {
  /** "" = chưa chọn: bắt buộc với món giao hàng báo có vấn đề. */
  condition: Condition | "";
  notes: string;
  ruleId?: string;
};

const STAGE: Record<ReturnUnitStage, { label: string; bg: string; fg: string }> = {
  AWAITING_RECEIPT: { label: "Chờ kho nhận", bg: "#eceff1", fg: "#455a64" },
  AWAITING_FINAL_INSPECTION: { label: "Chờ kiểm định cuối", bg: "#fff1cd", fg: "#875b00" },
  AWAITING_ADMIN: { label: "Chờ Admin xử lý", bg: "#ffe9c7", fg: "#8a4b00" },
  WAITING_CLEANING: { label: "Chờ vệ sinh", bg: "#e0f0ff", fg: "#0b4f8a" },
  READY: { label: "Sẵn sàng cho thuê", bg: "#ddf4d1", fg: "#1f5e2c" },
  CLOSED_DAMAGED: { label: "Đã đóng · hư hỏng", bg: "#ffe8e5", fg: "#a32020" },
  CLOSED_LOST: { label: "Đã đóng · thất lạc", bg: "#ffe8e5", fg: "#a32020" },
  MISSING: { label: "Thiếu / thất lạc", bg: "#ffe8e5", fg: "#a32020" },
};

/** Thứ tự hiển thị: việc kho cần làm trước. */
const STAGE_ORDER: ReturnUnitStage[] = [
  "AWAITING_FINAL_INSPECTION",
  "WAITING_CLEANING",
  "AWAITING_RECEIPT",
  "AWAITING_ADMIN",
  "MISSING",
  "READY",
  "CLOSED_DAMAGED",
  "CLOSED_LOST",
];

const FINAL_OUTCOME_LABEL: Record<string, string> = {
  NORMAL: "Đạt kiểm định",
  ISSUE: "Có vấn đề (chưa định mức)",
  DAMAGE_CONFIRMED: "Hư hỏng (đã định mức)",
  LOST_CONFIRMED: "Xác nhận thất lạc",
};

const CASE_STATUS_LABEL: Record<string, string> = {
  OPEN: "đang mở",
  UNDER_REVIEW: "Admin đang xem xét",
  RESOLVED: "đã xử lý",
  REJECTED: "đã từ chối",
  CLOSED: "đã đóng",
};

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);

const reportedIssue = (unit: StaffReturnUnit) => unit.deliveryObservation?.outcome === "ISSUE";

const emptyDraft = (unit: StaffReturnUnit): Draft => ({
  // Món bị giao hàng báo có vấn đề: không mặc định "Tốt", nhân viên phải tự chọn.
  condition: reportedIssue(unit) ? "" : "GOOD",
  notes: "",
});

type GradeDraft = { decision: "KEEP" | "DOWNGRADE"; reason: string };

function shortAssetCode(value?: string | null) {
  const compact = (value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return compact.slice(-6).padStart(6, "0");
}

const FILTERS: { label: string; value?: ReturnQueueStatus }[] = [
  { label: "Tất cả" },
  { label: "Chờ nhận", value: "TRANSFER_PENDING" },
  { label: "Chờ kiểm định", value: "INVENTORY_RECEIVED" },
  { label: "Chờ vệ sinh", value: "WAITING_CLEANING" },
  { label: "Cần duyệt", value: "REVIEW_REQUIRED" },
  { label: "Hoàn tất", value: "COMPLETED" },
];

const STATUS_LABEL: Record<string, string> = {
  TRANSFER_PENDING: "Chờ kho nhận",
  INVENTORY_RECEIVED: "Chờ kiểm định cuối",
  WAITING_CLEANING: "Chờ vệ sinh",
  REVIEW_REQUIRED: "Chờ Admin xử lý",
  COMPLETED: "Hoàn tất",
  RETURNED: "Đang chuyển về kho",
};

const CONDITION_LABEL: Record<string, string> = {
  NEW: "Như mới",
  GOOD: "Tốt",
  FAIR: "Có hao mòn",
  DAMAGED: "Hư hỏng",
  LOST: "Thất lạc",
};

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    LOW: "nhẹ",
    MINOR: "nhẹ",
    MEDIUM: "trung bình",
    MAJOR: "nghiêm trọng",
    HIGH: "nghiêm trọng",
    CRITICAL: "rất nghiêm trọng",
  };
  return labels[severity] ?? "cần đánh giá";
}

export default function InventoryReturnsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [filter, setFilter] = useState<ReturnQueueStatus>();
  const [items, setItems] = useState<StaffReturnSummary[]>([]);
  const [detail, setDetail] = useState<StaffReturnDetail>();
  const [rules, setRules] = useState<DamageAssessmentRule[]>([]);
  const [scannedIds, setScannedIds] = useState<string[]>([]);
  const [custodyIncidentNote, setCustodyIncidentNote] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const evidence = useEvidenceUploads(accessToken);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  // Thiết bị thuộc sản phẩm có hạng: server trả RENTAL_GRADE_DECISION_REQUIRED, khi đó mở ô phân hạng.
  const [gradeRequiredUnits, setGradeRequiredUnits] = useState<string[]>([]);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, GradeDraft>>({});
  // Sản phẩm đoán là có hạng (theo tên) nhưng server báo không áp dụng phân hạng.
  const [ungradedUnits, setUngradedUnits] = useState<string[]>([]);

  // Thiết bị có hạng: tên sản phẩm mang hạng, hoặc server đã yêu cầu quyết định hạng.
  function gradeOf(unitId: string, productName?: string, expired?: boolean) {
    // Món hết hạn dùng sẽ chuyển Ngừng sử dụng, backend không hỏi hạng.
    if (expired || ungradedUnits.includes(unitId)) return null;
    const grade = productName ? splitGradeName(productName).grade : null;
    if (grade) return grade;
    return gradeRequiredUnits.includes(unitId) ? "Như mới" : null;
  }

  const loadList = useCallback(
    async (silent = false) => {
      if (!accessToken) return;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(undefined);
      try {
        const result = await staffReturnsApi.list(accessToken, filter);
        setItems(result.items);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Không tải được hàng đợi hoàn trả.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, filter],
  );

  const open = useCallback(
    async (returnId: string) => {
      if (!accessToken) return;
      setBusy("load-detail");
      setError(undefined);
      setNotice(undefined);
      try {
        const [next, nextRules] = await Promise.all([
          staffReturnsApi.get(returnId, accessToken),
          staffReturnsApi.rules(accessToken),
        ]);
        setDetail(next);
        setRules(nextRules);
        setScannedIds(next.pendingTransfer?.receivedUnitIds ?? []);
        setCustodyIncidentNote("");
        setDrafts((current) => {
          const updated = { ...current };
          (next.units ?? []).forEach((unit) => {
            if (unit.stage === "AWAITING_FINAL_INSPECTION") updated[unit.unitId] ??= emptyDraft(unit);
          });
          return updated;
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Không tải được chi tiết hoàn trả.");
      } finally {
        setBusy(undefined);
      }
    },
    [accessToken],
  );

  useFocusEffect(
    useCallback(() => {
      void loadList();
    }, [loadList]),
  );

  const units = useMemo(() => {
    const list = [...(detail?.units ?? [])];
    return list.sort((a, b) => {
      const byStage = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
      if (byStage !== 0) return byStage;
      // Trong cùng giai đoạn: món giao hàng báo có vấn đề lên trước.
      return Number(reportedIssue(b)) - Number(reportedIssue(a));
    });
  }, [detail?.units]);
  const pendingInspection = useMemo(
    () => units.filter((unit) => unit.stage === "AWAITING_FINAL_INSPECTION"),
    [units],
  );
  const ruleName = useMemo(() => new Map(rules.map((rule) => [rule.id, rule.name])), [rules]);

  async function refreshDetail(message?: string) {
    if (!detail) return;
    await Promise.all([open(detail.id), loadList(true)]);
    if (message) setNotice(message);
  }

  async function run(action: string, request: () => Promise<unknown>, success: string | (() => string)) {
    if (busy) return;
    setBusy(action);
    setError(undefined);
    setNotice(undefined);
    try {
      await request();
      await refreshDetail(typeof success === "function" ? success() : success);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Thao tác chưa thể hoàn tất.");
    } finally {
      setBusy(undefined);
    }
  }

  async function markReady(
    unitId: string,
    assetCode: string,
    inspectionId: string,
    expectedVersion: number,
    productName?: string,
    expired?: boolean,
  ) {
    if (!accessToken) return;
    const currentGrade = gradeOf(unitId, productName, expired);
    // Hạng "Sử dụng tốt" không hạ được nữa nên mặc định giữ hạng.
    const grade: GradeDraft | undefined =
      gradeDrafts[unitId] ?? (currentGrade === "Sử dụng tốt" ? { decision: "KEEP", reason: "" } : undefined);
    if (currentGrade && !grade) {
      setError("Chọn Giữ hạng hoặc Hạ xuống Sử dụng tốt trước.");
      return;
    }
    if (grade?.decision === "DOWNGRADE" && grade.reason.trim().length < 3) {
      setError("Nhập lý do hạ hạng (tối thiểu 3 ký tự).");
      return;
    }
    let shortageCount = 0;
    let downgraded = false;
    let disposition: "AVAILABLE" | "RETIRED" | "MAINTENANCE" = "AVAILABLE";
    let rentalCount: number | undefined;
    await run(
      `ready-${unitId}`,
      async () => {
        const send = (withGrade: boolean) =>
          staffReturnsApi.markReady(
            {
              unitId,
              inspectionId,
              expectedVersion,
              gradeDecision:
                withGrade && grade
                  ? grade.decision === "DOWNGRADE"
                    ? { decision: "DOWNGRADE", reason: grade.reason.trim() }
                    : { decision: "KEEP" }
                  : undefined,
            },
            accessToken,
          );
        let result;
        try {
          result = await send(Boolean(currentGrade));
        } catch (requestError) {
          if (requestError instanceof ApiError && requestError.code === "RENTAL_GRADE_DECISION_NOT_APPLICABLE") {
            // Tên có hạng nhưng sản phẩm không phân hạng: gửi lại không kèm quyết định hạng.
            setUngradedUnits((current) => (current.includes(unitId) ? current : [...current, unitId]));
            result = await send(false);
          } else if (requestError instanceof ApiError && requestError.code === "RENTAL_GRADE_DECISION_REQUIRED") {
            setGradeRequiredUnits((current) => (current.includes(unitId) ? current : [...current, unitId]));
            throw new Error(`Mã ${shortAssetCode(assetCode)} có phân hạng. Chọn hạng bên dưới rồi bấm lại.`);
          } else {
            throw requestError;
          }
        }
        shortageCount = result?.gradeReview?.shortageOrderIds?.length ?? 0;
        downgraded = result?.gradeReview?.decision === "DOWNGRADE";
        disposition = result?.disposition ?? "AVAILABLE";
        rentalCount = result?.unit?.rentalCount;
      },
      () =>
        (disposition === "RETIRED"
          ? `${shortAssetCode(assetCode)} đã hết hạn dùng nên chuyển Ngừng sử dụng, không đưa về kệ cho thuê`
          : disposition === "MAINTENANCE"
            ? `${shortAssetCode(assetCode)} đạt ngưỡng hao mòn${rentalCount ? ` (${rentalCount} lượt thuê)` : ""} nên chuyển bảo trì; đã mở phiếu bảo trì`
            : `${shortAssetCode(assetCode)} đã sẵn sàng cho thuê`) +
        `${downgraded ? " (đã hạ xuống Sử dụng tốt)" : ""}.` +
        (shortageCount > 0 ? ` Hạ hạng làm thiếu hàng cho ${shortageCount} đơn; các đơn này đã được đánh dấu cần xử lý.` : ""),
    );
  }

  function toggleScan(unitId: string) {
    setScannedIds((current) =>
      current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId],
    );
  }

  async function receive() {
    if (!detail || !accessToken || !detail.pendingTransfer) return;
    const pending = detail.pendingTransfer.unitIds.filter(
      (unitId) => !detail.pendingTransfer?.receivedUnitIds.includes(unitId),
    );
    const selected = scannedIds.filter((unitId) => pending.includes(unitId));
    if (selected.length < pending.length && custodyIncidentNote.trim().length < 3) {
      setError(`Kho nhận thiếu ${pending.length - selected.length} thiết bị. Hãy ghi rõ sai lệch custody.`);
      return;
    }
    await run(
      "receive",
      () => staffReturnsApi.receive(detail, selected, custodyIncidentNote, accessToken),
      selected.length < pending.length
        ? "Đã ghi nhận hàng thực nhận và mở hồ sơ sai lệch custody."
        : "Đã nhận thiết bị vào kho.",
    );
  }

  async function inspect() {
    if (!detail || !accessToken || pendingInspection.length === 0) return;
    if (evidence.uploadingCount > 0) {
      setError(`Còn ${evidence.uploadingCount} ảnh/video đang tải lên, chờ vài giây rồi bấm lại.`);
      return;
    }
    if (evidence.failedCount > 0) {
      setError("Có ảnh tải lỗi: chạm vào ảnh đó để thử lại hoặc bấm ✕ để bỏ.");
      return;
    }
    await run(
      "inspect",
      async () => {
        const payload: FinalInspectionInput[] = pendingInspection.map((unit) => {
          const code = `mã ${shortAssetCode(unit.assetCode)}`;
          const draft = drafts[unit.unitId] ?? emptyDraft(unit);
          const condition = draft.condition;
          if (!condition) {
            throw new Error(`Giao hàng báo ${code} có vấn đề: hãy tự chọn tình trạng sau khi kiểm tra.`);
          }
          const issue = condition === "DAMAGED";
          const media = evidence.idsFor(unit.unitId);
          if ((unit.evidenceRequired || issue) && !media.imageIds.length) {
            throw new Error(`Cần ít nhất 1 ảnh cho ${code}; video không bắt buộc.`);
          }
          const evidenceIds = [...media.imageIds, ...media.videoIds];
          const productRules = rules.filter((rule) => rule.productId === unit.productId);
          if (issue && !draft.ruleId) {
            if (!productRules.length) throw new Error(`${unit.productName ?? code} chưa có quy tắc đánh giá hư hỏng.`);
            throw new Error(`Hãy chọn quy tắc đánh giá hư hỏng cho ${code}.`);
          }
          return {
            unitId: unit.unitId,
            outcome: issue ? "ISSUE" : "PASS",
            condition,
            damage: issue
              ? [{ ruleId: draft.ruleId!, quantity: 1, notes: draft.notes || undefined, evidenceIds }]
              : [],
            evidenceIds,
            notes: draft.notes || undefined,
          };
        });
        const result = await staffReturnsApi.inspect(detail, payload, accessToken);
        const normal = result.assessments
          .filter((item) => item.outcome === "NORMAL")
          .map((item) => ({ unitId: item.unitId, inspectionVersion: item.version }));
        await staffReturnsApi.finalizeNormal(detail, normal, accessToken);
      },
      "Đã ghi nhận kiểm định cuối. Món đạt chuyển sang chờ vệ sinh; món có vấn đề chuyển cho Admin xử lý.",
    );
  }

  if (detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Header title="Kiểm định hoàn trả" onBack={() => setDetail(undefined)} />
          <View style={styles.hero}>
            <Text style={styles.heroCode}>HOÀN TRẢ THIẾT BỊ</Text>
            <Text style={styles.heroTitle}>{detail.tripTitle || "Đơn thuê thiết bị"}</Text>
            <Text style={styles.heroMeta}>
              {[detail.customerName, detail.summary ? STATUS_LABEL[detail.summary.queueStatus] : "Đang cập nhật"]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {detail.summary ? (
              <View style={styles.chipRow}>
                <Text style={styles.chip}>{detail.summary.totalUnits} thiết bị</Text>
                {detail.summary.deliveryReportedIssueCount ? (
                  <Text style={[styles.chip, styles.chipWarn]}>
                    Lúc thu hồi: {detail.summary.deliveryReportedIssueCount} món có vấn đề
                  </Text>
                ) : (
                  <Text style={styles.chip}>Lúc thu hồi: không báo vấn đề</Text>
                )}
                {detail.summary.handoverReportedIssueCount ? (
                  <Text style={[styles.chip, styles.chipWarn]}>
                    Lúc giao cho khách: ghi {detail.summary.handoverReportedIssueCount} lỗi có sẵn
                  </Text>
                ) : null}
                {detail.summary.evidenceRequiredPendingCount ? (
                  <Text style={[styles.chip, styles.chipDanger]}>
                    {detail.summary.evidenceRequiredPendingCount} món bắt buộc ảnh
                  </Text>
                ) : null}
              </View>
            ) : null}
            {detail.summary?.handoverOrderLevelIssues?.length ? (
              <View style={[styles.infoBox, styles.infoWarn]}>
                <Text style={[styles.infoTitle, styles.infoTitleWarn]}>Ghi chú lúc giao cho khách (không gắn món)</Text>
                {detail.summary.handoverOrderLevelIssues.map((issue, index) => (
                  <Text key={`${issue.type}-${index}`} style={styles.infoLine}>• {issue.description}</Text>
                ))}
              </View>
            ) : null}
          </View>
          {!detail.units ? (
            <Text style={styles.warning}>API chưa trả danh sách thiết bị theo giai đoạn. Hãy khởi động lại API bản mới.</Text>
          ) : null}
          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}
          {busy ? (
            <TrekkingLoader
              label={
                busy === "receive"
                    ? "Đang xác nhận thiết bị vào kho..."
                    : busy === "inspect"
                      ? "Đang hoàn tất kiểm định cuối..."
                      : "Đang cập nhật trạng thái thiết bị..."
              }
              compact
            />
          ) : null}

          {detail.pendingTransfer?.status === "PENDING_RECEIPT" ? (
            <>
              <Text style={styles.section}>1. QUÉT/XÁC NHẬN THIẾT BỊ VÀO KHO</Text>
              <View style={styles.card}>
                <Text style={styles.body}>Điểm nhận: {detail.pendingTransfer.inventoryLocationName}</Text>
                {detail.pendingTransfer.unitIds.map((unitId) => {
                  const unit = detail.expectedUnits.find((item) => item.unitId === unitId);
                  const selected = scannedIds.includes(unitId);
                  return (
                    <TouchableOpacity key={unitId} style={styles.unitRow} onPress={() => toggleScan(unitId)}>
                      <Ionicons name={selected ? "checkbox" : "square-outline"} size={25} color={selected ? Colors.primaryDark : Colors.onSurfaceMuted} />
                      <View style={styles.flex}>
                        <Text style={styles.unitTitle}>{unit?.productName ? productLabel(unit.productName) : "Thiết bị"}</Text>
                        <Text style={styles.asset}>{unit?.assetCode ? `Mã ${shortAssetCode(unit.assetCode)}` : "Chưa có mã thiết bị"}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {scannedIds.filter((unitId) => detail.pendingTransfer?.unitIds.includes(unitId)).length <
                detail.pendingTransfer.unitIds.length ? (
                  <View style={styles.incidentBox}>
                    <Text style={styles.incidentTitle}>Có thiết bị không tới kho</Text>
                    <Text style={styles.body}>
                      Hồ sơ này là sai lệch custody nội bộ, không tự quy lỗi cho khách.
                    </Text>
                    <TextInput
                      value={custodyIncidentNote}
                      onChangeText={setCustodyIncidentNote}
                      placeholder="Mô tả niêm phong, kiện hàng và thiết bị thiếu..."
                      placeholderTextColor={Colors.onSurfaceMuted}
                      multiline
                      style={styles.incidentInput}
                    />
                  </View>
                ) : null}
              </View>
              <Action label={busy === "receive" ? "ĐANG NHẬN..." : "XÁC NHẬN NHẬN VÀO KHO"} disabled={Boolean(busy)} onPress={() => void receive()} />
            </>
          ) : null}

          {units.map((unit) => {
            const name = unit.productName ? productLabel(unit.productName) : `Mã ${shortAssetCode(unit.assetCode)}`;
            const draft = drafts[unit.unitId] ?? emptyDraft(unit);
            const productRules = rules.filter((rule) => rule.productId === unit.productId);
            const observation = unit.deliveryObservation;
            const flagged = reportedIssue(unit);
            const final = unit.finalInspection;
            const stage = STAGE[unit.stage];
            return (
              <View key={unit.unitId} style={[styles.card, flagged && unit.stage === "AWAITING_FINAL_INSPECTION" && styles.cardFlagged]}>
                <View style={styles.rowBetween}>
                  <View style={styles.flex}>
                    <Text style={styles.unitTitle}>{name}</Text>
                    <Text style={styles.asset}>
                      Mã {shortAssetCode(unit.assetCode)}
                      {unit.deposit ? ` · Cọc ${money(unit.deposit.depositAmount)}` : ""}
                    </Text>
                  </View>
                  <View style={styles.pillCol}>
                    <Text style={[styles.pill, { backgroundColor: stage.bg, color: stage.fg }]}>{stage.label}</Text>
                    {unit.stage === "AWAITING_FINAL_INSPECTION" && unit.evidenceRequired ? (
                      <Text style={[styles.pill, styles.pillDanger]}>Bắt buộc ảnh</Text>
                    ) : null}
                  </View>
                </View>

                <View style={[styles.infoBox, flagged ? styles.infoWarn : styles.infoOk]}>
                  <Text style={[styles.infoTitle, flagged ? styles.infoTitleWarn : styles.infoTitleOk]}>
                    {observation
                      ? flagged
                        ? "⚠ Lúc thu hồi: nhân viên giao báo có vấn đề"
                        : "✓ Lúc thu hồi: nhân viên giao báo bình thường"
                      : "Lúc thu hồi: chưa ghi nhận"}
                  </Text>
                  {observation?.visibleDamage ? <Text style={styles.infoLine}>• Có hư hỏng nhìn thấy</Text> : null}
                  {observation?.accessoryObservations.map((text, index) => (
                    <Text key={`${text}-${index}`} style={styles.infoLine}>• {text}</Text>
                  ))}
                  {observation?.notes ? <Text style={styles.infoLine}>Ghi chú: {observation.notes}</Text> : null}
                  {observation ? (
                    <ReturnEvidenceGallery
                      ids={observation.evidenceIds}
                      label="Ảnh giao hàng chụp"
                      accessToken={accessToken}
                      autoLoad={flagged && unit.stage === "AWAITING_FINAL_INSPECTION"}
                    />
                  ) : null}
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>Lúc giao cho khách</Text>
                  {unit.handoverBaseline ? (
                    <>
                      <Text style={styles.infoLine}>
                        Tình trạng: {CONDITION_LABEL[unit.handoverBaseline.condition] ?? unit.handoverBaseline.condition}
                      </Text>
                      {unit.handoverBaseline.notes ? <Text style={styles.infoLine}>Ghi chú: {unit.handoverBaseline.notes}</Text> : null}
                      <ReturnEvidenceGallery ids={unit.handoverBaseline.evidenceIds} label="Ảnh lúc giao" accessToken={accessToken} />
                    </>
                  ) : (
                    <Text style={styles.infoLine}>Không có hồ sơ lúc giao.</Text>
                  )}
                  {unit.handoverReportedIssues?.length ? (
                    <View style={[styles.infoBox, styles.infoWarn]}>
                      <Text style={[styles.infoTitle, styles.infoTitleWarn]}>
                        ⚠ Nhân viên giao đã ghi lỗi có sẵn khi giao cho khách
                      </Text>
                      {unit.handoverReportedIssues.map((issue, index) => (
                        <Text key={`${issue.type}-${index}`} style={styles.infoLine}>• {issue.description}</Text>
                      ))}
                      <Text style={styles.infoLine}>Lỗi này có trước kỳ thuê: không trừ cọc cho lỗi này.</Text>
                    </View>
                  ) : null}
                </View>

                {unit.stage === "AWAITING_FINAL_INSPECTION" ? (
                  <>
                    {!draft.condition ? (
                      <Text style={styles.choosePrompt}>Chọn tình trạng sau khi kiểm tra thực tế:</Text>
                    ) : null}
                    <View style={styles.choiceRow}>
                      {(["GOOD", "FAIR", "DAMAGED"] as Condition[]).map((condition) => (
                        <TouchableOpacity
                          key={condition}
                          style={[styles.choice, !draft.condition && styles.choiceUnset, draft.condition === condition && styles.choiceActive]}
                          onPress={() => setDrafts((current) => ({ ...current, [unit.unitId]: { ...draft, condition, ruleId: condition === "DAMAGED" ? draft.ruleId : undefined } }))}
                        >
                          <Text style={[styles.choiceText, draft.condition === condition && styles.choiceTextActive]}>
                            {CONDITION_LABEL[condition]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {draft.condition === "DAMAGED" ? (
                      <View style={styles.ruleList}>
                        {!productRules.length ? (
                          <Text style={styles.warning}>Sản phẩm chưa có mức hư hỏng. Báo Admin bổ sung.</Text>
                        ) : null}
                        {productRules.map((rule) => (
                          <TouchableOpacity key={rule.id} style={[styles.rule, draft.ruleId === rule.id && styles.ruleActive]} onPress={() => setDrafts((current) => ({ ...current, [unit.unitId]: { ...draft, ruleId: rule.id } }))}>
                            <Text style={styles.ruleText}>{rule.name} · Mức độ {severityLabel(rule.severity)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    <TextInput value={draft.notes} onChangeText={(notes) => setDrafts((current) => ({ ...current, [unit.unitId]: { ...draft, notes } }))} placeholder="Ghi chú kiểm định" placeholderTextColor={Colors.onSurfaceMuted} style={styles.input} />
                    <EvidenceThumbStrip
                      busy={evidence.cameraOpen}
                      required={unit.evidenceRequired || draft.condition === "DAMAGED"}
                      items={evidence.previewsFor(unit.unitId)}
                      onAddPhoto={() => void evidence.capture(unit.unitId, "image")}
                      onAddVideo={() => void evidence.capture(unit.unitId, "video")}
                      onRemove={evidence.remove}
                      onRetry={evidence.retry}
                    />
                  </>
                ) : null}

                {final ? (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>Kiểm định cuối: {FINAL_OUTCOME_LABEL[final.outcome] ?? final.outcome}</Text>
                    {final.findings.map((finding) => (
                      <Text key={finding.ruleId} style={styles.infoLine}>
                        • {ruleName.get(finding.ruleId) ?? "Mức hư hỏng"} × {finding.quantity}: {money(finding.amount)}
                      </Text>
                    ))}
                    {final.notes ? <Text style={styles.infoLine}>Ghi chú: {final.notes}</Text> : null}
                    {unit.deposit && (unit.deposit.deductionAmount > 0 || unit.deposit.refundAmount > 0) ? (
                      <Text style={styles.infoLine}>
                        Cọc: trừ {money(unit.deposit.deductionAmount)} · hoàn {money(unit.deposit.refundAmount)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {unit.stage === "WAITING_CLEANING" && unit.unitStatus === "CLEANING" && final && unit.unitVersion !== null ? (
                  (() => {
                    const productName = unit.productName ?? undefined;
                    const currentGrade = gradeOf(unit.unitId, productName, unit.unitExpired);
                    const chosen: GradeDraft | undefined =
                      gradeDrafts[unit.unitId] ??
                      (currentGrade === "Sử dụng tốt" ? { decision: "KEEP", reason: "" } : undefined);
                    const decisions = currentGrade === "Sử dụng tốt" ? (["KEEP"] as const) : (["KEEP", "DOWNGRADE"] as const);
                    const waitingGrade = Boolean(currentGrade) && !chosen;
                    return (
                      <>
                        {unit.unitExpired ? (
                          <Text style={[styles.meta, { color: "#B91C1C", fontWeight: "700" }]}>
                            Thiết bị đã hết hạn dùng
                            {unit.unitExpiresAt ? ` (${unit.unitExpiresAt.split("-").reverse().join("/")})` : ""}: khi xác
                            nhận sẽ chuyển Ngừng sử dụng, không cần phân hạng.
                          </Text>
                        ) : null}
                        {currentGrade ? (
                          <View style={styles.gradeBox}>
                            <Text style={styles.gradeStep}>Bước 1 · Phân hạng sau khi trả</Text>
                            <Text style={styles.meta}>Hạng hiện tại: {currentGrade}</Text>
                            <View style={styles.choiceRow}>
                              {decisions.map((decision) => {
                                const active = chosen?.decision === decision;
                                return (
                                  <TouchableOpacity
                                    key={decision}
                                    style={[styles.choice, active && styles.choiceActive]}
                                    onPress={() =>
                                      setGradeDrafts((current) => ({
                                        ...current,
                                        [unit.unitId]: { decision, reason: current[unit.unitId]?.reason ?? "" },
                                      }))
                                    }
                                  >
                                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                                      {decision === "KEEP" ? `Giữ ${currentGrade}` : "Hạ xuống Sử dụng tốt"}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                            {chosen?.decision === "DOWNGRADE" ? (
                              <TextInput
                                value={chosen.reason}
                                onChangeText={(reason) => setGradeDrafts((current) => ({ ...current, [unit.unitId]: { decision: "DOWNGRADE", reason } }))}
                                placeholder="Lý do hạ hạng (bắt buộc)"
                                placeholderTextColor={Colors.onSurfaceMuted}
                                style={styles.input}
                              />
                            ) : null}
                            <Text style={styles.meta}>Phân hạng không ảnh hưởng tiền cọc của khách vừa trả.</Text>
                            <Text style={[styles.gradeStep, styles.gradeStepNext]}>Bước 2 · Xác nhận vệ sinh</Text>
                          </View>
                        ) : null}
                        <Action
                          label={
                            busy === `ready-${unit.unitId}`
                              ? "ĐANG CẬP NHẬT..."
                              : waitingGrade
                                ? "CHỌN HẠNG Ở BƯỚC 1 TRƯỚC"
                                : "ĐÃ VỆ SINH, ĐỦ PHỤ KIỆN — SẴN SÀNG CHO THUÊ"
                          }
                          disabled={Boolean(busy) || waitingGrade}
                          onPress={() =>
                            void markReady(unit.unitId, unit.assetCode ?? unit.unitId, final.id, unit.unitVersion!, productName, unit.unitExpired)
                          }
                        />
                      </>
                    );
                  })()
                ) : unit.stage === "WAITING_CLEANING" ? (
                  <Text style={styles.warning}>Đạt kiểm định, đang chờ chuyển sang vệ sinh.</Text>
                ) : unit.stage === "AWAITING_ADMIN" ? (
                  <Text style={styles.warning}>
                    Thiết bị có vấn đề, đang chờ Admin xử lý ngoại lệ và quyết toán cọc
                    {unit.exceptionCase ? ` (hồ sơ ${CASE_STATUS_LABEL[unit.exceptionCase.status] ?? unit.exceptionCase.status})` : ""}.
                    Kho không cần thao tác thêm.
                  </Text>
                ) : unit.stage === "READY" ? (
                  <Text style={styles.okNote}>✓ Thiết bị đã vệ sinh và sẵn sàng cho thuê.</Text>
                ) : unit.stage === "CLOSED_DAMAGED" ? (
                  <Text style={styles.dangerNote}>Cọc đã quyết toán; thiết bị đã chuyển sang hư hỏng để sửa chữa.</Text>
                ) : unit.stage === "MISSING" || unit.stage === "CLOSED_LOST" ? (
                  <Text style={styles.dangerNote}>Thiết bị chưa về kho; được xử lý trong hồ sơ thất lạc của Admin.</Text>
                ) : unit.stage === "AWAITING_RECEIPT" ? (
                  <Text style={styles.warning}>Đang chờ kho xác nhận thực nhận ở phía trên.</Text>
                ) : null}
              </View>
            );
          })}

          {pendingInspection.length ? (
            <Action label={busy === "inspect" ? "ĐANG GỬI KIỂM ĐỊNH..." : `HOÀN TẤT KIỂM ĐỊNH CUỐI (${pendingInspection.length})`} disabled={Boolean(busy) || detail.status !== "INVENTORY_RECEIVED"} onPress={() => void inspect()} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadList(true)} />}>
        <Header title="Hoàn trả về kho" onBack={() => router.back()} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => (
            <TouchableOpacity key={item.label} style={[styles.filter, filter === item.value && styles.filterActive]} onPress={() => setFilter(item.value)}>
              <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
        {loading ? (
          <TrekkingLoader
            label="Đang tải danh sách hoàn trả..."
            hint="Đang đối chiếu kiện hàng và trạng thái kiểm định"
          />
        ) : null}
        {!loading && !items.length ? <Text style={styles.empty}>Không có đơn hoàn trả ở trạng thái này.</Text> : null}
        {items.map((item) => (
          <TouchableOpacity key={item.id} style={styles.queueCard} onPress={() => void open(item.id)}>
            <Text style={styles.heroCode}>ĐƠN HOÀN TRẢ</Text>
            <Text style={styles.queueTitle}>{item.tripTitle || "Đơn thuê thiết bị"}</Text>
            {item.customerName ? <Text style={styles.body}>Khách: {item.customerName}</Text> : null}
            <Text style={styles.body}>{STATUS_LABEL[item.status] ?? "Đang cập nhật"}</Text>
            <Text style={styles.meta}>
              {item.pendingInspectionCount ? `${item.pendingInspectionCount} chờ kiểm định · ` : ""}
              {item.deliveryReportedIssueCount
                ? `${item.deliveryReportedIssueCount} giao hàng báo vấn đề`
                : "Giao hàng không báo vấn đề"}
              {item.missingCount ? ` · ${item.missingCount} thiếu` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={styles.header}><TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color={Colors.ink} /></TouchableOpacity><Text style={styles.headerTitle}>{title}</Text><View style={{ width: 24 }} /></View>;
}

function Action({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[styles.primary, disabled && styles.disabled]} disabled={disabled} onPress={onPress}><Text style={styles.primaryText}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: 20, paddingBottom: 50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  headerTitle: { color: Colors.ink, fontSize: 18, fontWeight: "600" },
  hero: { backgroundColor: Colors.inverseSurface, borderRadius: Radius.xl, padding: 18, marginBottom: 16, ...Shadows.tactical },
  heroCode: { color: Colors.primaryDark, fontSize: 13, fontWeight: "600" },
  heroTitle: { color: "#fff", fontSize: 19, fontWeight: "600", marginTop: 8 },
  heroMeta: { color: "#bed0bb", fontSize: 14, marginTop: 7 },
  filters: { gap: 8, paddingBottom: 16 },
  filter: { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  filterActive: { backgroundColor: Colors.primaryDark },
  filterText: { color: Colors.body, fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  section: { color: Colors.onSurfaceMuted, fontSize: 14, fontWeight: "600", marginVertical: 10 },
  card: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 16, marginBottom: 14, ...Shadows.card },
  queueCard: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 16, marginBottom: 12, ...Shadows.card },
  queueTitle: { color: Colors.ink, fontSize: 17, fontWeight: "600", marginTop: 8 },
  body: { color: Colors.body, fontSize: 14, marginTop: 6 },
  meta: { color: Colors.onSurfaceMuted, fontSize: 13, marginTop: 5 },
  flex: { flex: 1 },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer, paddingVertical: 13 },
  incidentBox: { marginTop: 12, borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, backgroundColor: "#fff2f0", padding: 12 },
  incidentTitle: { color: Colors.error, fontSize: 14, fontWeight: "600" },
  incidentInput: { minHeight: 78, marginTop: 10, borderWidth: 1, borderColor: "#efaaa3", borderRadius: Radius.sm, backgroundColor: "#fff", padding: 11, color: Colors.ink, textAlignVertical: "top" },
  unitTitle: { color: Colors.ink, fontSize: 15, fontWeight: "600" },
  asset: { color: Colors.onSurfaceMuted, fontSize: 13, marginTop: 4 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  donePill: { backgroundColor: "#ddf4d1", color: Colors.primaryDark, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: "600" },
  waitPill: { backgroundColor: "#fff1cd", color: "#875b00", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: "600" },
  choiceRow: { flexDirection: "row", gap: 7, marginTop: 14 },
  choice: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 8, paddingVertical: 10 },
  choiceActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  choiceText: { color: Colors.ink, fontSize: 12, fontWeight: "600" },
  choiceTextActive: { color: "#fff" },
  ruleList: { gap: 7, marginTop: 10 },
  rule: { borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 8, padding: 10 },
  ruleActive: { borderColor: Colors.error, backgroundColor: "#ffe8e5" },
  ruleText: { color: Colors.body, fontSize: 13, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 8, padding: 11, color: Colors.ink, marginTop: 10 },
  primary: { backgroundColor: Colors.primaryDark, borderRadius: Radius.xl, padding: 15, alignItems: "center", marginBottom: 14 },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" },
  disabled: { opacity: 0.5 },
  gradeStep: { color: Colors.primaryDark, fontSize: 14, fontWeight: "600", letterSpacing: 0.3 },
  gradeStepNext: { marginTop: 12 },
  gradeBox: { marginTop: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: Radius.md, padding: 12 },
  warning: { color: "#9b6700", backgroundColor: "#fff5d7", borderRadius: 8, padding: 11, fontSize: 13, marginTop: 12 },
  okNote: { color: Colors.primaryDark, backgroundColor: "#eaf5e1", borderRadius: 8, padding: 11, fontSize: 13, marginTop: 12 },
  dangerNote: { color: Colors.error, backgroundColor: "#ffe8e5", borderRadius: 8, padding: 11, fontSize: 13, marginTop: 12 },
  cardFlagged: { borderWidth: 1.5, borderColor: "#f0b46b" },
  pillCol: { alignItems: "flex-end", gap: 6 },
  pill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: "600", overflow: "hidden" },
  pillDanger: { backgroundColor: "#ffe8e5", color: Colors.error },
  infoBox: { marginTop: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, backgroundColor: "#f7f8f6", padding: 11 },
  infoWarn: { borderColor: "#f0c48a", backgroundColor: "#fff6ea" },
  infoOk: { borderColor: "#cfe7c4", backgroundColor: "#f3faef" },
  infoTitle: { color: Colors.ink, fontSize: 13, fontWeight: "700" },
  infoTitleWarn: { color: "#8a4b00" },
  infoTitleOk: { color: Colors.primaryDark },
  infoLine: { color: Colors.body, fontSize: 13, marginTop: 4 },
  choosePrompt: { color: "#8a4b00", fontSize: 13, fontWeight: "600", marginTop: 14 },
  choiceUnset: { borderColor: "#f0b46b", backgroundColor: "#fff6ea" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { color: "#e6efe4", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, overflow: "hidden" },
  chipWarn: { color: "#ffd9a3", backgroundColor: "rgba(255,170,60,0.18)" },
  chipDanger: { color: "#ffc2bb", backgroundColor: "rgba(255,90,70,0.18)" },
  errorBanner: { color: Colors.error, backgroundColor: "#ffe8e5", borderRadius: 9, padding: 12, marginBottom: 12 },
  noticeBanner: { color: Colors.primaryDark, backgroundColor: "#eaf5e1", borderRadius: 9, padding: 12, marginBottom: 12 },
  empty: { color: Colors.onSurfaceMuted, textAlign: "center", backgroundColor: "#fff", borderRadius: Radius.md, padding: 28 },
});
