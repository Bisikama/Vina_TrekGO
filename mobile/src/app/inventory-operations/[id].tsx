import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { ApiError } from "@/lib/api-client";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import {
  PreparationCandidate,
  PreparationTaskDetail,
  RentalDeliveryAssignee,
  staffInventoryApi,
  PreparationOrderBrief,
} from "@/features/rentals/staff-inventory-api";
import { orderShortCode, productLabel } from "@/features/rentals/display";
import { EvidenceThumbStrip } from "@/features/rentals/EvidenceThumbStrip";
import { useEvidenceUploads } from "@/features/rentals/useEvidenceUploads";
import { formatVnd, Typography } from "@/constants/designTokens";

const briefTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

type BusyAction = "claim" | "pick" | "evidence" | "pack" | "ready" | "transfer";

function shortAssetCode(value?: string | null) {
  const compact = (value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return compact.slice(-6).padStart(6, "0");
}

const CONDITION_LABEL: Record<string, string> = {
  NEW: "Mới",
  GOOD: "Tốt",
  FAIR: "Có hao mòn",
  DAMAGED: "Hư hỏng",
  LOST: "Thất lạc",
};

const TRANSFER_STATUS_LABEL: Record<string, string> = {
  PENDING_RECEIPT: "Chờ nhân viên giao hàng quét nhận",
  RECEIVED: "Nhân viên giao hàng đã nhận",
  CANCELLED: "Đã hủy bàn giao",
  EXPIRED: "Yêu cầu bàn giao đã hết hạn",
};

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
  const [brief, setBrief] = useState<PreparationOrderBrief | null>(null);
  const evidence = useEvidenceUploads(accessToken);

  const isCancelled = detail?.task.status === "CANCELLED";

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
      staffInventoryApi
        .getOrderBrief(nextDetail.task.orderId, accessToken)
        .then(setBrief)
        .catch(() => undefined);
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
        pickReasonMessage(requestError) ??
          (requestError instanceof Error
            ? requestError.message
            : "Thao tác chưa thể hoàn tất."),
      );
    } finally {
      setBusy(null);
    }
  };

  async function saveEvidence(unitId: string) {
    if (!detail || !accessToken) return;
    if (evidence.previewsFor(unitId).some((item) => item.status === "uploading")) {
      setError("Ảnh của thiết bị này đang tải lên, chờ vài giây rồi bấm Lưu.");
      return;
    }
    const draft = evidence.idsFor(unitId);
    if (!draft.imageIds.length) {
      setError("Mỗi thiết bị cần ít nhất 1 ảnh tình trạng; video không bắt buộc.");
      return;
    }
    await run("evidence", async () => {
      await staffInventoryApi.saveCondition(
        detail.task.id,
        {
          unitId,
          condition: "GOOD",
          notes: "Bằng chứng tình trạng trước bàn giao",
          evidenceIds: [...draft.imageIds, ...draft.videoIds],
          expectedVersion: detail.version,
        },
        accessToken,
      );
      evidence.clearUnit(unitId);
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
          <Text style={styles.heroCode}>ĐƠN {orderShortCode(detail.task.orderId)} · CHUẨN BỊ THIẾT BỊ</Text>
          <Text style={styles.heroTitle}>{detail.pickupContext.name}</Text>
          <Text style={styles.heroMeta}>
            {new Date(detail.pickupContext.scheduledAt).toLocaleString("vi-VN")}
          </Text>
          <Text style={styles.heroStatus}>
            {TASK_STATUS_LABEL[detail.task.status] ?? "Đang cập nhật"}
          </Text>
        </View>

        {brief ? (
          <View style={[styles.card, styles.briefCard]}>
            <Text style={styles.briefTitle}>Thông tin đơn</Text>
            <BriefRow label="Giao cho khách" value={briefTime(brief.handoverAt)} strong />
            <BriefRow label="Khách trả đồ" value={briefTime(brief.dueAt)} />
            <BriefRow label="Đặt đơn lúc" value={briefTime(brief.createdAt)} />
            <BriefRow label="Thanh toán lúc" value={briefTime(brief.paidAt)} />
            <BriefRow label="Điểm nhận" value={[brief.pickupName, brief.pickupAddress].filter(Boolean).join(" · ") || "—"} />
            {brief.returnName ? <BriefRow label="Điểm trả" value={brief.returnName} /> : null}
            <BriefRow label="Phí thuê" value={brief.rentalFee != null ? formatVnd(brief.rentalFee) : "—"} />
            <BriefRow label="Tiền cọc" value={brief.totalDeposit != null ? formatVnd(brief.totalDeposit) : "—"} />
          </View>
        ) : null}

        {error && <Text style={styles.errorBanner}>{error}</Text>}

        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.cancelledBannerText}>
              Đơn thuê này đã bị hủy. Nhiệm vụ kho đã đóng và không thể thao tác.
            </Text>
          </View>
        )}

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

        {!isCancelled && !detail.task.assignee && detail.task.status === "OPEN" && (
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
                <Text style={styles.rowTitle}>{productLabel(line.productName)}</Text>
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

        {!isCancelled && remainingLine && (
          <>
            <SectionTitle title={`2. Chọn thiết bị cho ${productLabel(remainingLine.productName)}`} />
            <View style={styles.card}>
              {candidates.length === 0 ? (
                <Text style={styles.muted}>Không có thiết bị khả dụng tại kho.</Text>
              ) : (
                candidates.map((candidate) => (
                  <View key={candidate.id} style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>Mã {shortAssetCode(candidate.assetCode)}</Text>
                      <Text style={styles.rowMeta}>
                        {CONDITION_LABEL[candidate.condition] ?? candidate.condition} · {candidate.location || "Chưa có vị trí"}
                        {candidate.expiresAt ? ` · HSD ${candidate.expiresAt.split("-").reverse().join("/")}` : ""}
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
                const previews = evidence.previewsFor(unit.unitId);
                const draft = evidence.idsFor(unit.unitId);
                const uploadingHere = previews.some((item) => item.status === "uploading");
                const readyToSave = draft.imageIds.length > 0 && !uploadingHere;
                return (
                <View key={unit.unitId} style={styles.evidenceBlock}>
                  <View style={styles.evidenceRow}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>
                        Mã {shortAssetCode(unit.assetCode)}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {unit.evidenceCaptured
                          ? "Đã lưu bằng chứng tình trạng"
                          : uploadingHere
                            ? "Đang tải ảnh lên…"
                            : `Ảnh ${draft.imageIds.length}/1 · Video ${draft.videoIds.length} (tùy chọn)`}
                      </Text>
                    </View>
                    {unit.evidenceCaptured ? (
                      <Ionicons name="checkmark-circle" size={25} color={Colors.primaryDark} />
                    ) : (
                      <TouchableOpacity style={[styles.saveEvidenceButton, !readyToSave && styles.disabled]} disabled={Boolean(busy) || !readyToSave} onPress={() => void saveEvidence(unit.unitId)}>
                        <Text style={styles.saveEvidenceText}>Lưu</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {!unit.evidenceCaptured ? (
                    <EvidenceThumbStrip
                      busy={evidence.cameraOpen}
                      required
                      items={previews}
                      onAddPhoto={() => void evidence.capture(unit.unitId, "image")}
                      onAddVideo={() => void evidence.capture(unit.unitId, "video")}
                      onRemove={evidence.remove}
                      onRetry={evidence.retry}
                    />
                  ) : null}
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

        {!isCancelled && detail.package?.status === "READY" && !detail.pendingTransfer && (
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
              <Text style={styles.successTitle}>Đã giao cho {detail.pendingTransfer.toStaff.displayName}</Text>
              <Text style={styles.rowMeta}>
                {TRANSFER_STATUS_LABEL[detail.pendingTransfer.status] ?? "Đang chờ xác nhận"}
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

function BriefRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.briefRow}>
      <Text style={styles.briefLabel}>{label}</Text>
      <Text style={[styles.briefValue, strong && styles.briefValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  briefCard: { marginTop: 14, gap: 6 },
  briefTitle: { color: Colors.ink, fontSize: 15, fontWeight: "700", marginBottom: 2 },
  briefRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  briefLabel: { color: Colors.onSurfaceMuted, fontSize: 13 },
  briefValue: { flexShrink: 1, textAlign: "right", color: Colors.ink, fontSize: 13, fontWeight: "500", ...Typography.tabularNums },
  briefValueStrong: { color: Colors.primaryDark, fontWeight: "700" },
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
  heroCode: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "600", marginTop: 8 },
  heroMeta: { color: "#bed0bb", fontSize: 14, marginTop: 7 },
  heroStatus: { color: Colors.primary, fontSize: 14, fontWeight: "600", marginTop: 12 },
  error: { color: Colors.error, textAlign: "center" },
  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 12,
    borderRadius: Radius.md,
    marginTop: 12,
  },
  cancelledBannerText: {
    flex: 1,
    fontSize: 14,
    color: "#991B1B",
    fontWeight: "600",
  },
  errorBanner: {
    color: Colors.error,
    backgroundColor: "#ffe8e5",
    borderRadius: Radius.sm,
    padding: 12,
    marginBottom: 14,
  },
  section: {
    color: Colors.onSurfaceMuted,
    fontSize: 13,
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
  rowTitle: { color: Colors.ink, fontSize: 15, fontWeight: "600" },
  rowMeta: { color: Colors.onSurfaceMuted, fontSize: 13, marginTop: 4 },
  quantity: { color: Colors.primaryDark, fontSize: 17, fontWeight: "600" },
  muted: { color: Colors.onSurfaceMuted, fontSize: 14, textAlign: "center" },
  smallButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  smallButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  evidenceBlock: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  evidenceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  saveEvidenceButton: { minWidth: 58, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.primaryDark },
  saveEvidenceText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.xl,
    padding: 15,
    marginTop: 16,
  },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
  successTitle: { color: Colors.primaryDark, fontSize: 15, fontWeight: "600" },
});

/** Lý do chi tiết backend gửi khi pick / đổi thiết bị bị từ chối. */
function pickReasonMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== "object") return null;
  const details = error.details as { reason?: unknown; expiresAt?: unknown; assetCode?: unknown };
  if (details.reason !== "EXPIRES_BEFORE_RETURN") return null;
  const day =
    typeof details.expiresAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(details.expiresAt)
      ? details.expiresAt.slice(0, 10).split("-").reverse().join("/")
      : null;
  const code = typeof details.assetCode === "string" ? `${details.assetCode} ` : "";
  return `Thiết bị ${code}hết hạn dùng${day ? ` ngày ${day}` : ""}, trước hạn khách trả đồ. Hãy chọn thiết bị khác.`;
}
