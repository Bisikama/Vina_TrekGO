import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
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
import { uploadInventoryEvidence } from "@/features/rentals/staff-inventory-api";
import {
  DamageAssessmentRule,
  FinalInspectionInput,
  ReturnQueueStatus,
  StaffReturnDetail,
  StaffReturnSummary,
  staffReturnsApi,
} from "@/features/rentals/staff-returns-api";

type Condition = FinalInspectionInput["condition"];
type Draft = {
  condition: Condition;
  notes: string;
  ruleId?: string;
  imageIds: string[];
  videoIds: string[];
};

type EvidenceKind = "image" | "video";
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
  REVIEW_REQUIRED: "Cần Admin duyệt",
  COMPLETED: "Hoàn tất",
  RETURNED: "Đang chuyển về kho",
};

const CONDITION_LABEL: Record<Condition, string> = {
  NEW: "Như mới",
  GOOD: "Tốt",
  FAIR: "Có hao mòn",
  DAMAGED: "Hư hỏng",
};

function inspectionLabel(outcome: string) {
  const labels: Record<string, string> = {
    NORMAL: "Đạt kiểm định",
    PASS: "Đạt kiểm định",
    ISSUE: "Có vấn đề",
    DAMAGED: "Hư hỏng",
    MISSING: "Thiếu thiết bị",
  };
  return labels[outcome] ?? "Đã kiểm định";
}

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  // Thiết bị thuộc sản phẩm có hạng: server trả RENTAL_GRADE_DECISION_REQUIRED, khi đó mở ô phân hạng.
  const [gradeRequiredUnits, setGradeRequiredUnits] = useState<string[]>([]);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, GradeDraft>>({});

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
          next.receivedUnits.forEach((unit) => {
            const expected = next.expectedUnits.find((item) => item.unitId === unit.unitId);
            updated[unit.unitId] ??= {
              condition:
                expected?.unitCondition === "NEW" ? "NEW" :
                expected?.unitCondition === "FAIR" ? "FAIR" : "GOOD",
              notes: "",
              imageIds: [],
              videoIds: [],
            };
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

  const finalByUnit = useMemo(
    () => new Map(detail?.inspection.map((item) => [item.unitId, item.final]) ?? []),
    [detail?.inspection],
  );
  const pendingInspection = useMemo(
    () => detail?.receivedUnits.filter((unit) => !finalByUnit.get(unit.unitId)) ?? [],
    [detail?.receivedUnits, finalByUnit],
  );

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

  async function capture(unitId: string, kind: EvidenceKind) {
    if (!accessToken || busy) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần quyền camera", "Hãy cấp quyền camera để ghi lại bằng chứng kiểm định.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: kind === "video" ? ["videos"] : ["images"],
      quality: kind === "image" ? 0.8 : 0.7,
      videoMaxDuration: kind === "video" ? 20 : undefined,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy(`evidence-${unitId}`);
    setError(undefined);
    try {
      const mediaId = await uploadInventoryEvidence(result.assets[0], accessToken);
      setDrafts((current) => ({
        ...current,
        [unitId]: {
          ...(current[unitId] ?? { condition: "GOOD", notes: "", imageIds: [], videoIds: [] }),
          ...(kind === "video"
            ? { videoIds: [...(current[unitId]?.videoIds ?? []), mediaId] }
            : { imageIds: [...(current[unitId]?.imageIds ?? []), mediaId] }),
        },
      }));
      setNotice(kind === "video" ? "Đã lưu video kiểm định." : "Đã lưu ảnh kiểm định.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Không tải được bằng chứng kiểm định.");
    } finally {
      setBusy(undefined);
    }
  }

  async function markReady(unitId: string, assetCode: string, inspectionId: string, expectedVersion: number) {
    if (!accessToken) return;
    const needsGrade = gradeRequiredUnits.includes(unitId);
    const grade: GradeDraft = gradeDrafts[unitId] ?? { decision: "KEEP", reason: "" };
    if (needsGrade && grade.decision === "DOWNGRADE" && grade.reason.trim().length < 3) {
      setError("Nhập lý do hạ hạng (tối thiểu 3 ký tự).");
      return;
    }
    let shortageCount = 0;
    let downgraded = false;
    await run(
      `ready-${unitId}`,
      async () => {
        try {
          const result = await staffReturnsApi.markReady(
            {
              unitId,
              inspectionId,
              expectedVersion,
              gradeDecision: needsGrade
                ? grade.decision === "DOWNGRADE"
                  ? { decision: "DOWNGRADE", reason: grade.reason.trim() }
                  : { decision: "KEEP" }
                : undefined,
            },
            accessToken,
          );
          shortageCount = result?.gradeReview?.shortageOrderIds?.length ?? 0;
          downgraded = result?.gradeReview?.decision === "DOWNGRADE";
        } catch (requestError) {
          if (requestError instanceof ApiError && requestError.code === "RENTAL_GRADE_DECISION_REQUIRED") {
            setGradeRequiredUnits((current) => (current.includes(unitId) ? current : [...current, unitId]));
            throw new Error(`Mã ${shortAssetCode(assetCode)} thuộc sản phẩm có hạng. Chọn Giữ hạng hoặc Hạ hạng rồi bấm lại.`);
          }
          throw requestError;
        }
      },
      () =>
        `${assetCode} đã sẵn sàng cho thuê${downgraded ? " (đã hạ xuống Sử dụng tốt)" : ""}.` +
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
    await run(
      "inspect",
      async () => {
        const payload: FinalInspectionInput[] = pendingInspection.map((received) => {
          const expected = detail.expectedUnits.find((unit) => unit.unitId === received.unitId);
          const draft = drafts[received.unitId];
          if (!draft) throw new Error(`Thiếu kết quả cho ${received.assetCode}.`);
          if (!draft.imageIds.length || !draft.videoIds.length) {
            throw new Error(`Cần đủ 1 ảnh và 1 video cho mã ${shortAssetCode(received.assetCode)}.`);
          }
          const evidenceIds = [...draft.imageIds, ...draft.videoIds];
          const issue = draft.condition === "DAMAGED";
          const productRules = rules.filter((rule) => rule.productId === expected?.productId);
          if (issue && !draft.ruleId) {
            if (!productRules.length) throw new Error(`${expected?.productName ?? received.assetCode} chưa có quy tắc đánh giá hư hỏng.`);
            throw new Error(`Hãy chọn quy tắc đánh giá hư hỏng cho mã ${shortAssetCode(received.assetCode)}.`);
          }
          return {
            unitId: received.unitId,
            outcome: issue ? "ISSUE" : "PASS",
            condition: draft.condition,
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
      "Đã ghi nhận kiểm định cuối. Món đạt chuyển sang chờ vệ sinh; món lỗi chờ Admin duyệt.",
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
              {[detail.customerName, STATUS_LABEL[detail.status] ?? "Đang cập nhật"]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
          {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}
          {busy ? (
            <TrekkingLoader
              label={
                busy.startsWith("evidence-")
                  ? "Đang tải bằng chứng kiểm định lên trạm..."
                  : busy === "receive"
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
                        <Text style={styles.unitTitle}>{unit?.productName ?? "Thiết bị"}</Text>
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

          {detail.receivedUnits.map((received) => {
            const expected = detail.expectedUnits.find((unit) => unit.unitId === received.unitId);
            const final = finalByUnit.get(received.unitId);
            const draft = drafts[received.unitId] ?? { condition: "GOOD" as Condition, notes: "", imageIds: [], videoIds: [] };
            const productRules = rules.filter((rule) => rule.productId === expected?.productId);
            return (
              <View key={received.unitId} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.flex}>
                    <Text style={styles.unitTitle}>{expected?.productName ?? received.assetCode}</Text>
                    <Text style={styles.asset}>Mã {shortAssetCode(received.assetCode)}</Text>
                  </View>
                  <Text style={final ? styles.donePill : styles.waitPill}>
                    {final ? inspectionLabel(final.outcome) : "Chờ kiểm định cuối"}
                  </Text>
                </View>
                {!final ? (
                  <>
                    <View style={styles.choiceRow}>
                      {(["GOOD", "FAIR", "DAMAGED"] as Condition[]).map((condition) => (
                        <TouchableOpacity
                          key={condition}
                          style={[styles.choice, draft.condition === condition && styles.choiceActive]}
                          onPress={() => setDrafts((current) => ({ ...current, [received.unitId]: { ...draft, condition, ruleId: condition === "DAMAGED" ? draft.ruleId : undefined } }))}
                        >
                          <Text style={[styles.choiceText, draft.condition === condition && styles.choiceTextActive]}>
                            {CONDITION_LABEL[condition]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {draft.condition === "DAMAGED" ? (
                      <View style={styles.ruleList}>
                        {productRules.map((rule) => (
                          <TouchableOpacity key={rule.id} style={[styles.rule, draft.ruleId === rule.id && styles.ruleActive]} onPress={() => setDrafts((current) => ({ ...current, [received.unitId]: { ...draft, ruleId: rule.id } }))}>
                            <Text style={styles.ruleText}>{rule.name} · Mức độ {severityLabel(rule.severity)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    <TextInput value={draft.notes} onChangeText={(notes) => setDrafts((current) => ({ ...current, [received.unitId]: { ...draft, notes } }))} placeholder="Ghi chú kiểm định" placeholderTextColor={Colors.onSurfaceMuted} style={styles.input} />
                    <View style={styles.evidenceCountRow}>
                      <View style={styles.evidenceCount}><Ionicons name="images-outline" size={17} color={Colors.primaryDark} /><Text style={styles.evidenceCountText}>Ảnh {draft.imageIds.length}/1</Text></View>
                      <View style={styles.evidenceCount}><Ionicons name="videocam-outline" size={17} color={Colors.primaryDark} /><Text style={styles.evidenceCountText}>Video {draft.videoIds.length}/1</Text></View>
                    </View>
                    <View style={styles.captureRow}>
                      <TouchableOpacity style={styles.camera} disabled={Boolean(busy)} onPress={() => void capture(received.unitId, "image")}>
                        <Ionicons name="camera-outline" size={19} color={Colors.primaryDark} />
                        <Text style={styles.cameraText}>Chụp ảnh</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.camera} disabled={Boolean(busy)} onPress={() => void capture(received.unitId, "video")}>
                        <Ionicons name="videocam-outline" size={19} color={Colors.primaryDark} />
                        <Text style={styles.cameraText}>Quay video</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : final.outcome === "NORMAL" && expected?.unitStatus === "CLEANING" ? (
                  <>
                    {gradeRequiredUnits.includes(received.unitId) ? (
                      <View style={styles.gradeBox}>
                        <Text style={styles.unitTitle}>Phân hạng sau khi trả</Text>
                        <View style={styles.choiceRow}>
                          {(["KEEP", "DOWNGRADE"] as const).map((decision) => {
                            const grade: GradeDraft = gradeDrafts[received.unitId] ?? { decision: "KEEP", reason: "" };
                            const active = grade.decision === decision;
                            return (
                              <TouchableOpacity
                                key={decision}
                                style={[styles.choice, active && styles.choiceActive]}
                                onPress={() => setGradeDrafts((current) => ({ ...current, [received.unitId]: { ...grade, decision } }))}
                              >
                                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                                  {decision === "KEEP" ? "Giữ hạng" : "Hạ xuống Sử dụng tốt"}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {gradeDrafts[received.unitId]?.decision === "DOWNGRADE" ? (
                          <TextInput
                            value={gradeDrafts[received.unitId]?.reason ?? ""}
                            onChangeText={(reason) => setGradeDrafts((current) => ({ ...current, [received.unitId]: { decision: "DOWNGRADE", reason } }))}
                            placeholder="Lý do hạ hạng (bắt buộc)"
                            placeholderTextColor={Colors.onSurfaceMuted}
                            style={styles.input}
                          />
                        ) : null}
                        <Text style={styles.meta}>Phân hạng không ảnh hưởng tiền cọc của khách vừa trả.</Text>
                      </View>
                    ) : null}
                    <Action
                      label="ĐÃ VỆ SINH, ĐỦ PHỤ KIỆN — SẴN SÀNG CHO THUÊ"
                      disabled={Boolean(busy)}
                      onPress={() => void markReady(received.unitId, received.assetCode, final.id, expected.unitVersion)}
                    />
                  </>
                ) : final.outcome !== "NORMAL" ? (
                  <Text style={styles.warning}>Thiết bị có vấn đề đang chờ Admin xử lý ngoại lệ.</Text>
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
            <Text style={styles.meta}>{item.issueCount} vấn đề · {item.missingCount} thiếu</Text>
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
  heroCode: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  heroTitle: { color: "#fff", fontSize: 19, fontWeight: "600", marginTop: 8 },
  heroMeta: { color: "#bed0bb", fontSize: 12, marginTop: 7 },
  filters: { gap: 8, paddingBottom: 16 },
  filter: { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  filterActive: { backgroundColor: Colors.primaryDark },
  filterText: { color: Colors.body, fontSize: 11, fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  section: { color: Colors.onSurfaceMuted, fontSize: 12, fontWeight: "600", marginVertical: 10 },
  card: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 16, marginBottom: 14, ...Shadows.card },
  queueCard: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 16, marginBottom: 12, ...Shadows.card },
  queueTitle: { color: Colors.ink, fontSize: 16, fontWeight: "600", marginTop: 8 },
  body: { color: Colors.body, fontSize: 12, marginTop: 6 },
  meta: { color: Colors.onSurfaceMuted, fontSize: 11, marginTop: 5 },
  flex: { flex: 1 },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: Colors.surfaceContainer, paddingVertical: 13 },
  incidentBox: { marginTop: 12, borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, backgroundColor: "#fff2f0", padding: 12 },
  incidentTitle: { color: Colors.error, fontSize: 13, fontWeight: "600" },
  incidentInput: { minHeight: 78, marginTop: 10, borderWidth: 1, borderColor: "#efaaa3", borderRadius: Radius.sm, backgroundColor: "#fff", padding: 11, color: Colors.ink, textAlignVertical: "top" },
  unitTitle: { color: Colors.ink, fontSize: 14, fontWeight: "600" },
  asset: { color: Colors.onSurfaceMuted, fontSize: 11, marginTop: 4 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  donePill: { backgroundColor: "#ddf4d1", color: Colors.primaryDark, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: "600" },
  waitPill: { backgroundColor: "#fff1cd", color: "#875b00", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: "600" },
  choiceRow: { flexDirection: "row", gap: 7, marginTop: 14 },
  choice: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 8, paddingVertical: 10 },
  choiceActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  choiceText: { color: Colors.ink, fontSize: 10, fontWeight: "600" },
  choiceTextActive: { color: "#fff" },
  ruleList: { gap: 7, marginTop: 10 },
  rule: { borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 8, padding: 10 },
  ruleActive: { borderColor: Colors.error, backgroundColor: "#ffe8e5" },
  ruleText: { color: Colors.body, fontSize: 11, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: 8, padding: 11, color: Colors.ink, marginTop: 10 },
  evidenceCountRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  evidenceCount: { flex: 1, minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  evidenceCountText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  captureRow: { flexDirection: "row", gap: 8 },
  camera: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: Colors.primaryNeutral, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, padding: 12, marginTop: 10 },
  cameraText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  primary: { backgroundColor: Colors.primaryDark, borderRadius: Radius.xl, padding: 15, alignItems: "center", marginBottom: 14 },
  primaryText: { color: "#fff", fontSize: 12, fontWeight: "600", textAlign: "center" },
  disabled: { opacity: 0.5 },
  gradeBox: { marginTop: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.surfaceContainerHighest, borderRadius: Radius.md, padding: 12 },
  warning: { color: "#9b6700", backgroundColor: "#fff5d7", borderRadius: 8, padding: 11, fontSize: 11, marginTop: 12 },
  errorBanner: { color: Colors.error, backgroundColor: "#ffe8e5", borderRadius: 9, padding: 12, marginBottom: 12 },
  noticeBanner: { color: Colors.primaryDark, backgroundColor: "#eaf5e1", borderRadius: 9, padding: 12, marginBottom: 12 },
  empty: { color: Colors.onSurfaceMuted, textAlign: "center", backgroundColor: "#fff", borderRadius: Radius.md, padding: 28 },
});
