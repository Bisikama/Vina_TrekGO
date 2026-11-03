import { FieldModal } from "@/components/FieldModal";
import { AssetQrScannerModal } from "@/components/common/AssetQrScannerModal";
import { TrekkingLoader } from "@/components/common/TrekkingLoader";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/features/auth/AuthContext";
import { rentalApi } from "@/features/rentals/api";
import { uploadInventoryEvidence } from "@/features/rentals/staff-inventory-api";
import {
  DeliveryTaskDetail,
  DeliveryTaskSummary,
  RentalOrderDetail,
  RentalReturnReceipt,
  RentalReturnScanResult,
} from "@/features/rentals/types";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
type EvidenceKind = "image" | "video";
type EvidenceDraft = { imageIds: string[]; videoIds: string[] };

const labels: Record<ItemStatus, string> = {
  PENDING: "Chưa kiểm",
  OK: "Bình thường",
  MISSING: "Thiếu",
  DAMAGED: "Hư hỏng",
};

function operationKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function recipientName(task?: DeliveryTaskSummary) {
  const recipient = task?.orderSummary.recipient;
  return (
    recipient?.displayName ||
    recipient?.fullName ||
    recipient?.name ||
    "Khách thuê"
  );
}

function shortAssetCode(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-6)
    .toUpperCase();
}

function tripWindow(order?: RentalOrderDetail) {
  const trip = order?.order.trip;
  if (!trip?.startAt || !trip.endAt) return "Khung giờ chuyến đi đang cập nhật";
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const type = trip.type === "PRIVATE" ? "Chuyến riêng tư" : "Chuyến công khai";
  return `${type} · ${formatter.format(new Date(trip.startAt))} – ${formatter.format(new Date(trip.endAt))}`;
}

export default function StaffReturnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    taskId?: string | string[];
    orderId?: string | string[];
  }>();
  const requestedTaskId = Array.isArray(params.taskId)
    ? params.taskId[0]
    : params.taskId;
  const requestedOrderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;
  const { accessToken } = useAuth();
  const mutationKeys = useRef({
    claim: operationKey("claim-return"),
    scan: operationKey("scan-return"),
    operation: operationKey("return-operation"),
    observe: operationKey("observe-return"),
    receipt: operationKey("receipt-return"),
    transfer: operationKey("transfer-return"),
  });

  const [summary, setSummary] = useState<DeliveryTaskSummary>();
  const [task, setTask] = useState<DeliveryTaskDetail>();
  const [order, setOrder] = useState<RentalOrderDetail>();
  const [reviews, setReviews] = useState<Record<string, ItemReview>>({});
  const [evidenceDrafts, setEvidenceDrafts] = useState<
    Record<string, EvidenceDraft>
  >({});
  const [scanResult, setScanResult] = useState<RentalReturnScanResult>();
  const [returnReceipt, setReturnReceipt] = useState<RentalReturnReceipt>();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedAssetCodes, setScannedAssetCodes] = useState<string[]>([]);
  const [custodyPresentIds, setCustodyPresentIds] = useState<string[]>([]);
  const [custodyIncidentNote, setCustodyIncidentNote] = useState("");
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setError(
        "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại bằng tài khoản giao nhận.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const listed = await rentalApi.listDeliveryTasks(accessToken, {
        type: "RETURN",
      });
      const selected =
        listed.items.find((item) => item.id === requestedTaskId) ??
        listed.items.find(
          (item) => item.orderSummary.orderId === requestedOrderId,
        ) ??
        listed.items.find(
          (item) =>
            !["INVENTORY_RECEIVED", "CLOSED", "CANCELLED"].includes(
              item.status,
            ),
        );

      if (!selected) {
        setSummary(undefined);
        setTask(undefined);
        setOrder(undefined);
        setError(
          "Chưa có nhiệm vụ thu hồi. Nhiệm vụ sẽ mở khi chuyến đi đến thời điểm trả thiết bị.",
        );
        return;
      }

      let taskDetail: DeliveryTaskDetail;
      try {
        taskDetail = await rentalApi.getDeliveryTask(selected.id, accessToken);
      } catch (detailError) {
        if (selected.status !== "SCHEDULED") throw detailError;
        await rentalApi.claimDeliveryTask(
          selected.id,
          selected.version,
          mutationKeys.current.claim,
          accessToken,
        );
        taskDetail = await rentalApi.getDeliveryTask(selected.id, accessToken);
      }
      const orderDetail = await rentalApi.getOrder(
        selected.orderSummary.orderId,
        accessToken,
      );
      setSummary({ ...selected, version: taskDetail.task.version });
      setTask(taskDetail);
      setOrder(orderDetail);
      setReviews((current) => {
        const next = { ...current };
        taskDetail.units.forEach((unit) => {
          next[unit.unitId] ??= { status: "PENDING", note: "" };
        });
        return next;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không tải được nhiệm vụ thu hồi.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, requestedOrderId, requestedTaskId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const units = useMemo(() => task?.units ?? [], [task?.units]);
  const allReviewed =
    units.length > 0 &&
    units.every((unit) => {
      const review = reviews[unit.unitId];
      return (
        review &&
        review.status !== "PENDING" &&
        (review.status === "OK" || review.note.trim().length > 0)
      );
    });
  const receivedUnits = useMemo(
    () => units.filter((unit) => reviews[unit.unitId]?.status !== "MISSING"),
    [reviews, units],
  );
  const issueCount = units.filter((unit) =>
    ["MISSING", "DAMAGED"].includes(reviews[unit.unitId]?.status),
  ).length;
  const missingInCustodyUnitIds = useMemo(
    () =>
      scanResult?.receivedUnits
        .map((unit) => unit.unitId)
        .filter((unitId) => !custodyPresentIds.includes(unitId)) ?? [],
    [custodyPresentIds, scanResult?.receivedUnits],
  );
  const requiredScanCodes = useMemo(
    () => receivedUnits.map((unit) => unit.assetCode),
    [receivedUnits],
  );
  const validScannedCodes = useMemo(
    () => scannedAssetCodes.filter((code) => requiredScanCodes.includes(code)),
    [requiredScanCodes, scannedAssetCodes],
  );
  const allReceivedScanned =
    requiredScanCodes.length > 0 &&
    requiredScanCodes.every((code) => validScannedCodes.includes(code));

  const setReview = (unitId: string, update: Partial<ItemReview>) => {
    setReviews((current) => ({
      ...current,
      [unitId]: {
        status: current[unitId]?.status ?? "PENDING",
        note: current[unitId]?.note ?? "",
        ...update,
      },
    }));
  };

  const confirmReceivedForDemo = () => {
    if (requiredScanCodes.length === 0) {
      setFeedback({
        title: "Không có món thực nhận",
        message: "Các món đang được đánh dấu Thiếu nên không thể xác nhận nhận nhanh.",
      });
      return;
    }

    setScannedAssetCodes(requiredScanCodes);
    setFeedback({
      title: "Đã thu hồi thiết bị",
      message: "Đã ghi nhận các thiết bị thực nhận để tiếp tục lập biên nhận trả đồ.",
    });
  };

  const captureEvidence = async (unitId: string, kind: EvidenceKind) => {
    if (!accessToken || busy) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Cần quyền camera",
        "Hãy cấp quyền để ghi lại hiện trạng thiết bị.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: kind === "video" ? ["videos"] : ["images"],
      allowsEditing: false,
      quality: kind === "image" ? 0.8 : 0.7,
      videoMaxDuration: kind === "video" ? 20 : undefined,
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    setError(undefined);
    try {
      const mediaId = await uploadInventoryEvidence(
        result.assets[0],
        accessToken,
        { scope: "RETURN_EVIDENCE" },
      );
      setEvidenceDrafts((current) => {
        const draft = current[unitId] ?? { imageIds: [], videoIds: [] };
        return {
          ...current,
          [unitId]:
            kind === "video"
              ? { ...draft, videoIds: [...draft.videoIds, mediaId] }
              : { ...draft, imageIds: [...draft.imageIds, mediaId] },
        };
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không tải được bằng chứng hiện trạng.",
      );
    } finally {
      setBusy(false);
    }
  };

  const scanReturn = async () => {
    if (!accessToken || !summary || !order || busy) return;
    if (!allReviewed) {
      setFeedback({
        title: "Chưa đủ đối soát",
        message:
          "Đánh dấu từng món; thiết bị thiếu hoặc hư hỏng phải có ghi chú.",
      });
      return;
    }
    if (receivedUnits.length === 0) {
      setFeedback({
        title: "Không có thiết bị để quét",
        message:
          "Cần có ít nhất một thiết bị thực nhận. Trường hợp mất toàn bộ phải chuyển sang quy trình ngoại lệ.",
      });
      return;
    }
    if (!allReceivedScanned) {
      setScannerVisible(true);
      return;
    }
    const missingEvidence = receivedUnits.find((unit) => {
      const draft = evidenceDrafts[unit.unitId];
      return !draft?.imageIds.length || !draft.videoIds.length;
    });
    if (missingEvidence) {
      setFeedback({
        title: "Thiếu ảnh hoặc video",
        message: `Mã ${shortAssetCode(missingEvidence.assetCode)} cần ít nhất 1 ảnh và 1 video kiểm tra sơ bộ.`,
      });
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const result = await rentalApi.scanRentalReturn(
        summary.orderSummary.orderId,
        {
          assetCodes: receivedUnits.map((unit) => unit.assetCode),
          operationId: mutationKeys.current.operation,
          expectedVersion: order.order.version,
        },
        mutationKeys.current.scan,
        accessToken,
      );
      setScanResult(result);
      setCustodyPresentIds(result.receivedUnits.map((unit) => unit.unitId));
      setCustodyIncidentNote("");
      setOrder((current) =>
        current
          ? { ...current, order: { ...current.order, version: result.version } }
          : current,
      );
      setStage(1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Quét nhận thiết bị thất bại.",
      );
    } finally {
      setBusy(false);
    }
  };

  const recordObservations = async () => {
    if (!accessToken || !summary || !scanResult || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const observationResult = await rentalApi.submitRentalReturnObservations(
        summary.orderSummary.orderId,
        {
          items: receivedUnits.map((unit) => {
            const review = reviews[unit.unitId];
            return {
              unitId: unit.unitId,
              visibleDamage: review.status === "DAMAGED",
              accessoryObservations:
                review.status === "DAMAGED" && review.note.trim()
                  ? [review.note.trim()]
                  : [],
              notes: review.note.trim() || undefined,
              evidenceIds: [
                ...(evidenceDrafts[unit.unitId]?.imageIds ?? []),
                ...(evidenceDrafts[unit.unitId]?.videoIds ?? []),
              ],
            };
          }),
          expectedVersion: scanResult.version,
        },
        mutationKeys.current.observe,
        accessToken,
      );
      const refreshedOrder = await rentalApi.getOrder(
        summary.orderSummary.orderId,
        accessToken,
      );
      const evidenceIds = receivedUnits.flatMap((unit) => [
        ...(evidenceDrafts[unit.unitId]?.imageIds ?? []),
        ...(evidenceDrafts[unit.unitId]?.videoIds ?? []),
      ]);
      const receipt = await rentalApi.finalizeRentalReturnReceipt(
        summary.orderSummary.orderId,
        {
          returnSessionId:
            observationResult.returnSessionId ?? scanResult.returnSessionId,
          expectedVersion: refreshedOrder.order.version,
          remarks: `${receivedUnits.length} thiết bị thực nhận; ${scanResult.missingUnits.length} thiết bị chưa thu hồi.`,
          evidenceIds,
        },
        mutationKeys.current.receipt,
        accessToken,
      );
      setReturnReceipt(receipt);
      setOrder(refreshedOrder);
      const refreshed = await rentalApi.getDeliveryTask(
        scanResult.returnId,
        accessToken,
      );
      setTask(refreshed);
      setStage(2);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không ghi nhận hoặc phát hành được biên nhận trả đồ.",
      );
    } finally {
      setBusy(false);
    }
  };

  const transferToInventory = async () => {
    if (!accessToken || !task || !scanResult || busy) return;
    if (
      missingInCustodyUnitIds.length &&
      custodyIncidentNote.trim().length < 3
    ) {
      setFeedback({
        title: "Cần mô tả sự việc",
        message:
          "Thiết bị đã nhận từ khách nhưng không còn trong custody phải có ghi chú.",
      });
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await rentalApi.transferRentalReturnToInventory(
        scanResult.returnId,
        {
          unitIds: custodyPresentIds,
          missingInCustodyUnitIds,
          incidentNote: custodyIncidentNote.trim() || undefined,
          packageId: task.package?.id,
          expectedVersion: task.task.version,
        },
        mutationKeys.current.transfer,
        accessToken,
      );
      setComplete(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không tạo được yêu cầu bàn giao về kho.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <TrekkingLoader
            label="Đang mở tuyến thu hồi..."
            hint="Đang đồng bộ thiết bị, điểm hẹn và trạng thái bàn giao"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!summary || !task || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={23} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thu hồi thiết bị</Text>
          <View style={{ width: 23 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#9b6700" />
          <Text style={styles.emptyTitle}>Nhiệm vụ chưa sẵn sàng</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => void load()}>
            <Text style={styles.primaryText}>TẢI LẠI</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, styles.contentHeader]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={23} color={Colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết thu hồi</Text>
          <View style={{ width: 23 }} />
        </View>
        <View style={styles.taskHeader}>
          <Text style={styles.taskId}>THU HỒI THIẾT BỊ</Text>
          <Text style={styles.title}>
            {order.order.trip?.title || "Chuyến trekking"}
          </Text>
          <Text style={styles.meta}>
            {recipientName(summary)} · {summary.point.name}
          </Text>
          <Text style={styles.tripTime}>{tripWindow(order)}</Text>
        </View>
        <View style={styles.steps}>
          {["Thu hồi", "Ghi nhận", "Về kho"].map((label, index) => (
            <View key={label} style={styles.step}>
              <View
                style={[styles.stepCircle, index < stage && styles.stepDone]}
              >
                {index < stage ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                )}
              </View>
              <Text style={styles.stepLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {stage === 0 && (
          <View style={styles.card}>
            <Text style={styles.section}>THU HỒI & GHI NHẬN SƠ BỘ</Text>
            {units.map((unit) => {
              const review = reviews[unit.unitId] ?? {
                status: "PENDING" as ItemStatus,
                note: "",
              };
              const evidence = evidenceDrafts[unit.unitId] ?? {
                imageIds: [],
                videoIds: [],
              };
              const wasScanned = validScannedCodes.includes(unit.assetCode);
              return (
                <View key={unit.unitId} style={styles.item}>
                  <Text style={styles.checkLabel}>
                    {unit.product?.name || "Thiết bị thuê"}
                  </Text>
                  <Text style={styles.assetCode}>
                    Mã {shortAssetCode(unit.assetCode)} ·{" "}
                    {wasScanned ? "Đã xác nhận nhận" : "Chưa xác nhận nhận"}
                  </Text>
                  <View style={styles.statusRow}>
                    {(["OK", "MISSING", "DAMAGED"] as ItemStatus[]).map(
                      (status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusButton,
                            review.status === status && styles.statusSelected,
                          ]}
                          onPress={() => setReview(unit.unitId, { status })}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              review.status === status &&
                                styles.statusTextSelected,
                            ]}
                          >
                            {labels[status]}
                          </Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                  {(review.status === "MISSING" ||
                    review.status === "DAMAGED") && (
                    <TextInput
                      value={review.note}
                      onChangeText={(note) => setReview(unit.unitId, { note })}
                      placeholder="Ghi chú bắt buộc"
                      placeholderTextColor={Colors.onSurfaceMuted}
                      style={styles.noteInput}
                    />
                  )}
                  {review.status !== "MISSING" && (
                    <>
                      <View style={styles.evidenceSummary}>
                        <Ionicons
                          name="camera-outline"
                          size={16}
                          color={Colors.primaryDark}
                        />
                        <Text style={styles.evidenceText}>
                          {evidence.imageIds.length} ảnh ·{" "}
                          {evidence.videoIds.length} video
                        </Text>
                      </View>
                      <View style={styles.evidenceActions}>
                        <TouchableOpacity
                          disabled={busy}
                          style={styles.evidenceButton}
                          onPress={() =>
                            void captureEvidence(unit.unitId, "image")
                          }
                        >
                          <Ionicons
                            name="camera"
                            size={16}
                            color={Colors.primaryDark}
                          />
                          <Text style={styles.evidenceButtonText}>
                            Chụp ảnh
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={busy}
                          style={styles.evidenceButton}
                          onPress={() =>
                            void captureEvidence(unit.unitId, "video")
                          }
                        >
                          <Ionicons
                            name="videocam"
                            size={16}
                            color={Colors.primaryDark}
                          />
                          <Text style={styles.evidenceButtonText}>
                            Quay video
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              );
            })}
            <View style={styles.summary}>
              <Text style={styles.noticeText}>
                {receivedUnits.length} món thực nhận · {issueCount} món có vấn
                đề · {validScannedCodes.length}/{requiredScanCodes.length} món
                đã xác nhận.
              </Text>
            </View>
            {!allReceivedScanned && requiredScanCodes.length > 0 ? (
              <TouchableOpacity
                disabled={busy}
                style={styles.demoReceiveButton}
                onPress={confirmReceivedForDemo}
              >
                <Ionicons
                  name="flash-outline"
                  size={18}
                  color={Colors.primaryDark}
                />
                <View style={styles.demoReceiveCopy}>
                  <Text style={styles.demoReceiveTitle}>
                    Thu hồi các thiết bị
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {stage === 1 && (
          <View style={styles.card}>
            <Text style={styles.section}>QUAN SÁT SƠ BỘ</Text>
            <Ionicons
              name="clipboard-outline"
              size={44}
              color={Colors.primaryDark}
            />
            <Text style={styles.cardTitle}>
              Đã quét {scanResult?.receivedUnits.length ?? 0} thiết bị
            </Text>
            <Text style={styles.muted}>
              {scanResult?.missingUnits.length ?? 0} thiết bị chưa được thu hồi
              và sẽ chuyển sang bước kiểm tra ngoại lệ.
            </Text>
            <Text style={styles.policy}>
              Nhân viên giao nhận chỉ ghi nhận ngoại quan. Kho sẽ thực hiện kiểm
              định cuối cùng và xử lý hoàn cọc.
            </Text>
          </View>
        )}

        {stage === 2 && (
          <View style={styles.card}>
            <Text style={styles.section}>BÀN GIAO VỀ KHO</Text>
            <Ionicons
              name="business-outline"
              size={44}
              color={Colors.primaryDark}
            />
            <Text style={styles.cardTitle}>
              Xác nhận custody trước khi về kho
            </Text>
            {returnReceipt ? (
              <Text style={styles.receiptText}>
                Biên nhận thu hồi của {recipientName(summary)} đã được phát
                hành.
              </Text>
            ) : null}
            <Text style={styles.muted}>
              Bỏ chọn nếu món đã nhận từ khách nhưng bị thất lạc trong quá trình
              vận chuyển.
            </Text>
            {scanResult?.receivedUnits.map((unit) => {
              const present = custodyPresentIds.includes(unit.unitId);
              const taskUnit = units.find(
                (item) => item.unitId === unit.unitId,
              );
              return (
                <TouchableOpacity
                  key={unit.unitId}
                  style={[styles.custodyRow, !present && styles.custodyMissing]}
                  onPress={() =>
                    setCustodyPresentIds((current) =>
                      current.includes(unit.unitId)
                        ? current.filter((id) => id !== unit.unitId)
                        : [...current, unit.unitId],
                    )
                  }
                >
                  <Ionicons
                    name={present ? "checkbox" : "alert-circle"}
                    size={22}
                    color={present ? Colors.primaryDark : Colors.error}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkLabel}>
                      {taskUnit?.product?.name || "Thiết bị"}
                    </Text>
                    <Text style={styles.assetCode}>
                      {unit.assetCode} ·{" "}
                      {present ? "Còn trong custody" : "Báo thất lạc nội bộ"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {missingInCustodyUnitIds.length > 0 ? (
              <TextInput
                value={custodyIncidentNote}
                onChangeText={setCustodyIncidentNote}
                multiline
                placeholder="Mô tả thời điểm, địa điểm và tình trạng niêm phong..."
                placeholderTextColor={Colors.onSurfaceMuted}
                style={styles.custodyNote}
              />
            ) : null}
            <Text style={styles.policy}>
              Sai lệch này mở hồ sơ nội bộ và giữ cọc món liên quan; không tự
              quy lỗi cho khách.
            </Text>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {busy ? (
          <TrekkingLoader
            label={
              stage === 0
                ? "Đang ghi nhận thiết bị thu hồi..."
                : stage === 1
                  ? "Đang lập biên nhận trả đồ..."
                  : "Đang bàn giao thiết bị về kho..."
            }
            compact
          />
        ) : null}
        <TouchableOpacity
          disabled={
            busy ||
            (stage === 0 && !allReviewed) ||
            (stage === 2 &&
              missingInCustodyUnitIds.length > 0 &&
              custodyIncidentNote.trim().length < 3)
          }
          style={[
            styles.primary,
            (busy ||
              (stage === 0 && !allReviewed) ||
              (stage === 2 &&
                missingInCustodyUnitIds.length > 0 &&
                custodyIncidentNote.trim().length < 3)) &&
              styles.disabled,
          ]}
          onPress={() =>
            void (stage === 0
              ? allReceivedScanned
                ? scanReturn()
                : setScannerVisible(true)
              : stage === 1
                ? recordObservations()
                : transferToInventory())
          }
        >
          <Text style={styles.primaryText}>
            {busy
              ? "ĐANG XỬ LÝ..."
              : stage === 0
                ? allReceivedScanned
                  ? "XÁC NHẬN THU HỒI"
                  : `MỞ MÁY QUÉT QR (${validScannedCodes.length}/${requiredScanCodes.length})`
                : stage === 1
                  ? "GHI NHẬN & LẬP BIÊN NHẬN"
                  : missingInCustodyUnitIds.length
                    ? "BÁO SAI LỆCH & CHUYỂN VỀ KHO"
                    : "CHUYỂN VỀ KHO"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
      <AssetQrScannerModal
        visible={scannerVisible}
        expectedAssets={receivedUnits.map((unit) => ({
          assetCode: unit.assetCode,
          label: unit.product?.name || "Thiết bị thuê",
        }))}
        scannedAssetCodes={validScannedCodes}
        onScanned={(assetCode) =>
          setScannedAssetCodes((current) =>
            current.includes(assetCode) ? current : [...current, assetCode],
          )
        }
        onClose={() => setScannerVisible(false)}
      />
      <FieldModal
        visible={complete}
        title="Đã chuyển về kho"
        message="Kho sẽ xác nhận nhận hàng, kiểm định và xử lý hoàn cọc."
        icon="checkmark-circle"
        actionLabel="Về danh sách"
        onAction={() => {
          setComplete(false);
          router.replace("/field-operations" as never);
        }}
        onClose={() => setComplete(false)}
      />
      <FieldModal
        visible={feedback !== null}
        title={feedback?.title ?? ""}
        message={feedback?.message ?? ""}
        icon="information-circle"
        tone="warning"
        actionLabel="Đã hiểu"
        onAction={() => setFeedback(null)}
        onClose={() => setFeedback(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: 20, paddingBottom: 35 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 28,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  contentHeader: { paddingHorizontal: 0, paddingTop: 0 },
  headerTitle: { color: Colors.ink, fontSize: 17, fontWeight: "600" },
  taskHeader: {
    backgroundColor: Colors.inverseSurface,
    padding: 18,
    borderRadius: Radius.xl,
    marginBottom: 16,
  },
  taskId: { color: Colors.primary, fontSize: 11, fontWeight: "600" },
  title: { color: "#fff", fontSize: 22, fontWeight: "600", marginTop: 7 },
  meta: { color: "#bed0bb", fontSize: 13, marginTop: 8 },
  tripTime: { color: "#dce9d8", fontSize: 11, lineHeight: 16, marginTop: 5 },
  steps: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  step: { alignItems: "center", width: "32%" },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: { backgroundColor: Colors.primaryDark },
  stepNumber: { color: Colors.onSurfaceMuted, fontWeight: "600", fontSize: 12 },
  stepLabel: {
    color: Colors.onSurfaceMuted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 6,
  },
  card: {
    backgroundColor: "#fff",
    padding: 17,
    borderRadius: Radius.xl,
    marginBottom: 18,
    ...Shadows.card,
  },
  section: {
    color: Colors.onSurfaceMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  item: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  custodyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.primaryNeutral,
    borderRadius: Radius.sm,
    padding: 11,
    marginTop: 9,
  },
  custodyMissing: { borderColor: Colors.error, backgroundColor: "#fff1ef" },
  custodyNote: {
    minHeight: 82,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: Radius.sm,
    padding: 11,
    marginTop: 12,
    color: Colors.ink,
    textAlignVertical: "top",
  },
  receiptText: {
    color: Colors.primaryDark,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 6,
  },
  checkLabel: { color: Colors.ink, fontSize: 14, fontWeight: "600" },
  assetCode: { color: Colors.onSurfaceMuted, fontSize: 11, marginTop: 3 },
  statusRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  statusButton: {
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  statusSelected: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  statusText: { color: Colors.ink, fontSize: 10, fontWeight: "600" },
  statusTextSelected: { color: "#fff" },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 7,
    padding: 9,
    color: Colors.ink,
    marginTop: 8,
  },
  evidenceSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  evidenceText: { color: Colors.onSurfaceVariant, fontSize: 11 },
  evidenceActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  evidenceButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: Radius.full,
    paddingVertical: 10,
    backgroundColor: Colors.primaryPale,
  },
  evidenceButtonText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: "600",
  },
  summary: {
    backgroundColor: "#fff5d7",
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  noticeText: { color: Colors.body, fontSize: 12 },
  demoReceiveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.primaryNeutral,
    borderRadius: Radius.sm,
    padding: 12,
    backgroundColor: Colors.primaryPale,
  },
  demoReceiveCopy: { flex: 1 },
  demoReceiveTitle: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    color: Colors.ink,
    fontSize: 17,
    fontWeight: "600",
    marginTop: 10,
  },
  muted: {
    color: Colors.onSurfaceMuted,
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },
  policy: { color: Colors.primaryDark, marginTop: 16, lineHeight: 19 },
  errorBox: {
    backgroundColor: "#ffe8e5",
    borderRadius: Radius.sm,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: Colors.error, fontSize: 12 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primaryDark,
    padding: 15,
    borderRadius: Radius.sm,
  },
  retry: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radius.sm,
  },
  disabled: { opacity: 0.55 },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  emptyTitle: { color: Colors.ink, fontSize: 18, fontWeight: "600" },
});
