import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import {
  PreparationCandidate,
  PreparationTaskDetail,
  RentalDeliveryAssignee,
  staffInventoryApi,
  uploadInventoryEvidence,
} from "@/features/rentals/staff-inventory-api";

type BusyAction = "claim" | "pick" | "evidence" | "pack" | "ready" | "transfer";
type EvidenceKind = "image" | "video";
type EvidenceDraft = { imageIds: string[]; videoIds: string[] };

function shortAssetCode(value?: string | null) {
  const compact = (value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return compact.slice(-6).padStart(6, "0");
}

const TASK_STATUS_LABEL: Record<string, string> = {
  OPEN: "Chờ nhận việc",
  PICKING: "Đang chọn thiết bị",
  CONDITION_CAPTURED: "Đã ghi nhận tình trạng",
  PACKED: "Đã đóng gói",
  READY: "Sẵn sàng bàn giao",
  TRANSFERRED: "Đã chuyển cho giao nhận",
  BLOCKED: "Cần xử lý",
  CANCELLED: "Đã hủy",
};

export default function InventoryTaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [detail, setDetail] = useState<PreparationTaskDetail | null>(null);
  const [candidates, setCandidates] = useState<PreparationCandidate[]>([]);
  const [deliveryStaff, setDeliveryStaff] = useState<RentalDeliveryAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, EvidenceDraft>>({});

  const remainingLine = useMemo(
    () => detail?.requiredLines.find((line) => line.remainingQty > 0),
    [detail],
  );

  const load = useCallback(async () => {
    if (!id || !accessToken) return;
    setError(null);
    try {
      const nextDetail = await staffInventoryApi.getTask(id, accessToken);
      setDetail(nextDetail);
      const nextRemaining = nextDetail.requiredLines.find(
        (line) => line.remainingQty > 0,
      );
      const [candidateResult, staffResult] = await Promise.all([
        nextRemaining
          ? staffInventoryApi.listCandidates(
              id,
              nextRemaining.productId,
              accessToken,
            )
          : Promise.resolve({ items: [] }),
        nextDetail.package?.status === "READY"
          ? staffInventoryApi.listDeliveryStaff(accessToken)
          : Promise.resolve({ items: [] }),
      ]);
      setCandidates(candidateResult.items);
      setDeliveryStaff(staffResult.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải chi tiết nhiệm vụ kho.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = async (action: BusyAction, request: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      await request();
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Thao tác chưa thể hoàn tất.",
      );
    } finally {
      setBusy(null);
    }
  };

  async function captureEvidence(unitId: string, kind: EvidenceKind) {
    if (!detail || !accessToken || busy) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần quyền camera", "Hãy cấp quyền để ghi lại tình trạng thiết bị.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: kind === "video" ? ["videos"] : ["images"],
      allowsEditing: false,
      quality: kind === "image" ? 0.8 : 0.7,
      videoMaxDuration: kind === "video" ? 20 : undefined,
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy("evidence");
    setError(null);
    try {
      const mediaId = await uploadInventoryEvidence(result.assets[0], accessToken);
      setEvidenceDrafts((current) => {
        const draft = current[unitId] ?? { imageIds: [], videoIds: [] };
        return {
          ...current,
          [unitId]: kind === "video"
            ? { ...draft, videoIds: [...draft.videoIds, mediaId] }
            : { ...draft, imageIds: [...draft.imageIds, mediaId] },
        };
      });
    } catch (uploadError) {
      const uploadMessage =
        uploadError instanceof Error
          ? uploadError.message
          : "";

      setError(
        uploadMessage.includes("Video metadata missing duration")
          ? "Không đọc được thông tin video. Hãy quay lại video rồi thử tải lên lần nữa."
          : uploadMessage || "Không tải được ảnh hoặc video tình trạng thiết bị.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveEvidence(unitId: string) {
    if (!detail || !accessToken) return;
    const draft = evidenceDrafts[unitId] ?? { imageIds: [], videoIds: [] };
    if (!draft.imageIds.length || !draft.videoIds.length) {
      setError("Mỗi thiết bị cần ít nhất 1 ảnh và 1 video tình trạng.");
      return;
    }
    await run("evidence", async () => {
      await staffInventoryApi.saveCondition(
        detail.task.id,
        {
          unitId,
          condition: "GOOD",
          notes: "Ảnh và video tình trạng trước bàn giao",
          evidenceIds: [...draft.imageIds, ...draft.videoIds],
          expectedVersion: detail.version,
        },
        accessToken,
      );
      setEvidenceDrafts((current) => {
        const next = { ...current };
        delete next[unitId];
        return next;
      });
    });
  }

  if (loading && !detail) {
    return (
      <SafeAreaView style={styles.center}>
        <TrekkingLoader
          label="Đang mở nhiệm vụ kho..."
          hint="Đang đối chiếu thiết bị, bằng chứng và kiện bàn giao"
        />
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{error || "Không tìm thấy nhiệm vụ kho."}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void load()}>
          <Text style={styles.primaryText}>Thử lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const evidenceComplete = detail.progress.evidenceComplete ?? 0;
  const canPack =
    detail.progress.required > 0 &&
    detail.progress.picked === detail.progress.required &&
    evidenceComplete === detail.progress.picked &&
    !detail.package;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chuẩn bị đơn thuê</Text>
          <TouchableOpacity onPress={() => void load()}>
            <Ionicons name="refresh" size={22} color={Colors.primaryDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroCode}>ĐƠN THUÊ · CHUẨN BỊ THIẾT BỊ</Text>
          <Text style={styles.heroTitle}>{detail.pickupContext.name}</Text>
          <Text style={styles.heroMeta}>
            {new Date(detail.pickupContext.scheduledAt).toLocaleString("vi-VN")}
          </Text>
          <Text style={styles.heroStatus}>
            {TASK_STATUS_LABEL[detail.task.status] ?? "Đang cập nhật"}
          </Text>
        </View>

        {error && <Text style={styles.errorBanner}>{error}</Text>}

        {busy ? (
          <TrekkingLoader
            label={
              busy === "evidence"
                ? "Đang đưa ảnh, video về trạm kiểm định..."
                : busy === "pack"
                  ? "Đang đóng gói thiết bị..."
                  : busy === "ready"
                    ? "Đang mở tuyến giao thiết bị..."
                    : "Đang cập nhật nhiệm vụ kho..."
            }
            compact
          />
        ) : null}

        {!detail.task.assignee && detail.task.status === "OPEN" && (
          <ActionButton
            label={busy === "claim" ? "Đang nhận việc..." : "Nhận nhiệm vụ kho"}
            disabled={Boolean(busy)}
            onPress={() =>
              void run("claim", () =>
                staffInventoryApi.claim(
                  detail.task.id,
                  detail.version,
                  accessToken!,
                ),
              )
            }
          />
        )}

        <SectionTitle title="1. Danh sách cần chuẩn bị" />
        <View style={styles.card}>
          {detail.requiredLines.map((line) => (
            <View key={line.orderLineId} style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{line.productName}</Text>
                <Text style={styles.rowMeta}>
                  Đã chọn {line.pickedQty} / {line.requiredQty} thiết bị
                </Text>
              </View>
              <Text style={styles.quantity}>
                {line.pickedQty}/{line.requiredQty}
              </Text>
            </View>
          ))}
        </View>

        {remainingLine && (
          <>
            <SectionTitle title={`2. Chọn thiết bị cho ${remainingLine.productName}`} />
            <View style={styles.card}>
              {candidates.length === 0 ? (
                <Text style={styles.muted}>Không có thiết bị khả dụng tại kho.</Text>
              ) : (
                candidates.map((candidate) => (
                  <View key={candidate.id} style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>Mã {shortAssetCode(candidate.assetCode)}</Text>
                      <Text style={styles.rowMeta}>
                        {candidate.condition} · {candidate.location || "Chưa có vị trí"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.smallButton}
                      disabled={Boolean(busy)}
                      onPress={() =>
                        void run("pick", () =>
                          staffInventoryApi.pick(
                            detail.task.id,
                            [candidate.assetCode],
                            detail.version,
                            accessToken!,
                          ),
                        )
                      }
                    >
                      <Text style={styles.smallButtonText}>CHỌN</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {detail.pickedUnits.length > 0 && (
          <>
            <SectionTitle title="3. Ảnh và video tình trạng trước giao" />
            <View style={styles.card}>
              {detail.pickedUnits.map((unit) => {
                const draft = evidenceDrafts[unit.unitId] ?? { imageIds: [], videoIds: [] };
                const readyToSave = draft.imageIds.length > 0 && draft.videoIds.length > 0;
                return (
                <View key={unit.unitId} style={styles.evidenceRow}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>Mã {shortAssetCode(unit.assetCode)}</Text>
                    <Text style={styles.rowMeta}>
                      {unit.evidenceCaptured
                        ? "Đã lưu bằng chứng tình trạng"
                        : `Ảnh ${draft.imageIds.length}/1 · Video ${draft.videoIds.length}/1`}
                    </Text>
                  </View>
                  {unit.evidenceCaptured ? (
                    <Ionicons name="checkmark-circle" size={25} color={Colors.primaryDark} />
                  ) : (
                    <View style={styles.evidenceActions}>
                      <TouchableOpacity style={styles.mediaButton} disabled={Boolean(busy)} onPress={() => void captureEvidence(unit.unitId, "image")}>
                        <Ionicons name="camera-outline" size={18} color={Colors.primaryDark} />
                        <Text style={styles.mediaButtonText}>Ảnh</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.mediaButton} disabled={Boolean(busy)} onPress={() => void captureEvidence(unit.unitId, "video")}>
                        <Ionicons name="videocam-outline" size={18} color={Colors.primaryDark} />
                        <Text style={styles.mediaButtonText}>Video</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveEvidenceButton, !readyToSave && styles.disabled]} disabled={Boolean(busy) || !readyToSave} onPress={() => void saveEvidence(unit.unitId)}>
                        <Text style={styles.saveEvidenceText}>Lưu</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );})}
            </View>
          </>
        )}

        {!detail.package && (
          <ActionButton
            label={busy === "pack" ? "Đang đóng gói..." : "Đóng gói thiết bị"}
            disabled={!canPack || Boolean(busy)}
            onPress={() =>
              void run("pack", () =>
                staffInventoryApi.pack(
                  detail.task.id,
                  detail.pickedUnits.map((unit) => unit.unitId),
                  detail.version,
                  accessToken!,
                ),
              )
            }
          />
        )}

        {detail.package?.status === "PACKED" && (
          <ActionButton
            label={busy === "ready" ? "Đang tạo nhiệm vụ giao..." : "Sẵn sàng giao thiết bị"}
            disabled={Boolean(busy)}
            onPress={() =>
              void run("ready", () =>
                staffInventoryApi.markReady(
                  detail.task.id,
                  detail.package!.id,
                  detail.version,
                  accessToken!,
                ),
              )
            }
          />
        )}

        {detail.package?.status === "READY" && !detail.pendingTransfer && (
          <>
            <SectionTitle title="5. Bàn giao gói cho nhân viên giao nhận" />
            <View style={styles.card}>
              {deliveryStaff.length === 0 ? (
                <Text style={styles.muted}>Hiện chưa có nhân viên giao nhận khả dụng.</Text>
              ) : (
                deliveryStaff.map((staff) => (
                  <View key={staff.id} style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>{staff.displayName}</Text>
                      <Text style={styles.rowMeta}>
                        {staff.activeTaskCount} nhiệm vụ đang hoạt động
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.smallButton}
                      disabled={Boolean(busy)}
                      onPress={() =>
                        void run("transfer", () =>
                          staffInventoryApi.requestTransfer(
                            detail.task.id,
                            detail.package!.id,
                            staff.id,
                            detail.version,
                            accessToken!,
                          ),
                        )
                      }
                    >
                      <Text style={styles.smallButtonText}>CHUYỂN</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {detail.pendingTransfer && (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.primaryDark} />
            <View style={styles.flex}>
              <Text style={styles.successTitle}>Đã tạo yêu cầu bàn giao</Text>
              <Text style={styles.rowMeta}>
                {detail.pendingTransfer.toStaff.displayName} · {detail.pendingTransfer.status}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

function ActionButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: Colors.surface,
  },
  content: { padding: 20, paddingBottom: 50 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerTitle: { color: Colors.ink, fontSize: 17, fontWeight: "600" },
  hero: {
    backgroundColor: Colors.inverseSurface,
    borderRadius: Radius.xl,
    padding: 18,
    marginBottom: 18,
    ...Shadows.tactical,
  },
  heroCode: { color: Colors.primary, fontSize: 10, fontWeight: "600" },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "600", marginTop: 8 },
  heroMeta: { color: "#bed0bb", fontSize: 12, marginTop: 7 },
  heroStatus: { color: Colors.primary, fontSize: 12, fontWeight: "600", marginTop: 12 },
  error: { color: Colors.error, textAlign: "center" },
  errorBanner: {
    color: Colors.error,
    backgroundColor: "#ffe8e5",
    borderRadius: Radius.sm,
    padding: 12,
    marginBottom: 14,
  },
  section: {
    color: Colors.onSurfaceMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.7,
    marginTop: 18,
    marginBottom: 9,
  },
  card: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 15, ...Shadows.card },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  flex: { flex: 1 },
  rowTitle: { color: Colors.ink, fontSize: 14, fontWeight: "600" },
  rowMeta: { color: Colors.onSurfaceMuted, fontSize: 11, marginTop: 4 },
  quantity: { color: Colors.primaryDark, fontSize: 17, fontWeight: "600" },
  muted: { color: Colors.onSurfaceMuted, fontSize: 12, textAlign: "center" },
  smallButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  smallButtonText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  evidenceRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  evidenceActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  mediaButton: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: Colors.primaryNeutral, borderRadius: Radius.md, backgroundColor: Colors.primaryPale },
  mediaButtonText: { color: Colors.primaryDark, fontSize: 11, fontWeight: "600" },
  saveEvidenceButton: { minWidth: 58, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryDark },
  saveEvidenceText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.xl,
    padding: 15,
    marginTop: 16,
  },
  primaryText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  disabled: { opacity: 0.45 },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#eaf5e1",
    borderRadius: Radius.md,
    padding: 16,
    marginTop: 18,
  },
  successTitle: { color: Colors.primaryDark, fontSize: 14, fontWeight: "600" },
});
