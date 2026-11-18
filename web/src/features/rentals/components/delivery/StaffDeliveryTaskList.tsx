"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Button,
  ConfirmModal,
  EmptyState,
  ErrorAlert,
  FormField,
  InfoBanner,
  Input,
  LoadingState,
  Select,
  StatusBadge,
  SurfaceCard,
  Textarea,
} from "@/components/ui";
import { formatMoney } from "@/features/rentals/components/admin/admin-rental-labels";
import { orderShortCode, productLabel, shortId } from "@/features/rentals/services/rental-display";
import {
  claimDeliveryTask,
  commitRentalHandover,
  finalizeReturnReceipt,
  getDeliveryErrorMessage,
  getDeliveryTask,
  getRentalOrderForDelivery,
  listDeliveryTasks,
  markRentalNoShow,
  receiveDeliveryPackage,
  scanRentalReturn,
  submitReturnObservations,
  transferReturnToInventory,
  uploadReturnEvidence,
  verifyDeliveryRecipient,
  type DeliveryTaskDetail,
  type DeliveryTaskStatus,
  type DeliveryTaskSummary,
  type DeliveryTaskType,
  type NoShowReason,
  type RentalOrderForDelivery,
} from "@/features/rentals/services/staff-delivery.api";

type TypeFilter = "ALL" | DeliveryTaskType;
type UnitCheck = "PENDING" | "OK" | "MISSING" | "DAMAGED";
type UnitReview = { status: UnitCheck; note: string; photoIds: string[] };

const DONE_STATUSES: DeliveryTaskStatus[] = ["HANDED_OVER", "INVENTORY_RECEIVED", "NO_SHOW", "REFUSED", "CLOSED", "CANCELLED"];

/** Nhãn + tông màu (dùng khóa có sẵn của StatusBadge để lấy màu). */
const STATUS_VIEW: Record<DeliveryTaskStatus, { label: string; tone: string }> = {
  SCHEDULED: { label: "Chờ thực hiện", tone: "PENDING" },
  PACKAGE_RECEIVED: { label: "Đã nhận kiện từ kho", tone: "active" },
  RECIPIENT_VERIFIED: { label: "Đã xác minh khách", tone: "active" },
  HANDED_OVER: { label: "Đã giao cho khách", tone: "CONFIRMED" },
  COLLECTING: { label: "Đang thu hồi", tone: "active" },
  RETURNED: { label: "Đã thu hồi, chờ về kho", tone: "active" },
  INVENTORY_RECEIVED: { label: "Kho đã nhận lại", tone: "CONFIRMED" },
  NO_SHOW: { label: "Khách không đến", tone: "CANCELLED" },
  REFUSED: { label: "Khách từ chối nhận", tone: "CANCELLED" },
  CLOSED: { label: "Đã đóng", tone: "COMPLETED" },
  BLOCKED: { label: "Đang bị chặn", tone: "CANCELLED" },
  CANCELLED: { label: "Đã hủy", tone: "CANCELLED" },
};

const TYPE_LABEL: Record<DeliveryTaskType, string> = { OUTBOUND: "Giao thiết bị", RETURN: "Thu hồi thiết bị" };

const NO_SHOW_REASONS: { value: NoShowReason; label: string }[] = [
  { value: "USER_NO_SHOW", label: "Khách không đến" },
  { value: "USER_CHANGED_MIND", label: "Khách đổi ý" },
  { value: "USER_REFUSED_DISCLOSED_CONDITION", label: "Khách từ chối tình trạng đã công bố" },
  { value: "SYSTEM_WRONG_EQUIPMENT", label: "TrekGo giao sai thiết bị" },
  { value: "SYSTEM_DAMAGED_EQUIPMENT", label: "Thiết bị hỏng tại điểm giao" },
  { value: "SYSTEM_MISSING_EQUIPMENT", label: "Kiện bàn giao thiếu thiết bị" },
];

const TIMELINE_LABEL: Record<string, string> = {
  ORDER_CREATED: "Khách đặt đơn",
  PAID: "Khách thanh toán",
  PACKED: "Kho đóng gói xong",
  HANDED_OVER: "Đã giao cho khách",
  RETURNED: "Bắt đầu thu hồi",
  CLOSED: "Kết thúc thuê",
  CANCELLED: "Đơn bị hủy",
  COMPLETED: "Hoàn tất đơn",
};

const CHECK_LABEL: Record<Exclude<UnitCheck, "PENDING">, string> = { OK: "Đủ / tốt", MISSING: "Thiếu", DAMAGED: "Hư hỏng" };

/** Lúc giao: "Thiếu" là cả món không có trong kiện (rút khỏi đơn); thiếu phụ kiện ghi ở "Hư hỏng". */
const HANDOVER_CHECK_LABEL: Record<Exclude<UnitCheck, "PENDING">, string> = {
  OK: "Đủ / tốt",
  MISSING: "Thiếu cả món",
  DAMAGED: "Hư hỏng / thiếu phụ kiện",
};

/** Loại lỗi backend dùng để rút cả món khỏi đơn (RB-API-404). */
const HANDOVER_ISSUE_TYPE: Record<Exclude<UnitCheck, "PENDING" | "OK">, string> = {
  MISSING: "UNIT_MISSING",
  DAMAGED: "DAMAGED",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

/** Nhãn cho task thu hồi theo lịch trả sớm; lịch chờ xác nhận lại thì nhắc shipper đừng đi theo giờ cũ. */
function earlyReturnLabel(earlyReturn: { status: string; slotAt: string }) {
  return earlyReturn.status === "CONFIRMED"
    ? `Khách trả sớm · hẹn ${formatDateTime(earlyReturn.slotAt)}`
    : "Lịch trả sớm chờ xác nhận lại";
}

function recipientName(task?: DeliveryTaskSummary, detail?: DeliveryTaskDetail | null) {
  const recipient = detail?.recipient || task?.orderSummary.recipient;
  return recipient?.displayName || recipient?.fullName || recipient?.name || "Khách thuê";
}

function isDone(status: DeliveryTaskStatus) {
  return DONE_STATUSES.includes(status);
}

function isLate(task: DeliveryTaskSummary, now: number) {
  return !isDone(task.status) && Boolean(task.scheduledAt) && new Date(task.scheduledAt as string).getTime() < now;
}

function unitName(unit: { product?: { name?: string } | null; assetCode: string }) {
  return unit.product?.name ? productLabel(unit.product.name) : "Thiết bị";
}

function verificationRefOf(detail?: DeliveryTaskDetail | null) {
  const value = detail?.verificationStatus?.verificationRef;
  return typeof value === "string" ? value : undefined;
}

export function StaffDeliveryTaskList() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [showDone, setShowDone] = useState(false);
  const [tasks, setTasks] = useState<DeliveryTaskSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<DeliveryTaskDetail | null>(null);
  const [order, setOrder] = useState<RentalOrderForDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [now, setNow] = useState(() => Date.now());

  const [packageCode, setPackageCode] = useState("");
  const [pickupCode, setPickupCode] = useState("");
  const [verificationRef, setVerificationRef] = useState<string>();
  const [recipientNotes, setRecipientNotes] = useState("");
  const [reviews, setReviews] = useState<Record<string, UnitReview>>({});
  const [uploadingUnit, setUploadingUnit] = useState<string>();
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [shortageConfirmOpen, setShortageConfirmOpen] = useState(false);
  const [noShowReason, setNoShowReason] = useState<NoShowReason>("USER_NO_SHOW");
  const [noShowNotes, setNoShowNotes] = useState("");
  const [incidentNote, setIncidentNote] = useState("");

  const selected = tasks.find((task) => task.id === selectedId);

  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await listDeliveryTasks({ signal });
      setTasks(result.items);
      setNow(Date.now());
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(getDeliveryErrorMessage(loadError, "Không tải được danh sách nhiệm vụ giao nhận."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (task: DeliveryTaskSummary) => {
    setDetailLoading(true);
    setError(undefined);
    try {
      const [taskDetail, orderDetail] = await Promise.all([
        getDeliveryTask(task.id).catch(() => null),
        getRentalOrderForDelivery(task.orderSummary.orderId).catch(() => null),
      ]);
      setDetail(taskDetail);
      setOrder(orderDetail);
      setVerificationRef(verificationRefOf(taskDetail));
      setPackageCode((current) => current || task.package?.code || "");
      setReviews((current) => {
        const next = { ...current };
        taskDetail?.units.forEach((unit) => {
          next[unit.unitId] ??= { status: "PENDING", note: "", photoIds: [] };
        });
        return next;
      });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadTasks(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadTasks]);

  const selectTask = (task: DeliveryTaskSummary) => {
    setSelectedId(task.id);
    setDetail(null);
    setOrder(null);
    setPackageCode(task.package?.code ?? "");
    setPickupCode("");
    setVerificationRef(undefined);
    setRecipientNotes("");
    setReviews({});
    setNoShowOpen(false);
    setIncidentNote("");
    setNotice(undefined);
    void loadDetail(task);
  };

  /** Chạy một thao tác rồi tải lại danh sách + chi tiết với dữ liệu mới nhất từ API. */
  async function run(action: () => Promise<string | void>, success: string, fallback: string) {
    if (!selected) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const message = await action();
      setNotice(message || success);
      const refreshed = await listDeliveryTasks();
      setTasks(refreshed.items);
      setNow(Date.now());
      const current = refreshed.items.find((task) => task.id === selected.id) ?? selected;
      await loadDetail(current);
    } catch (actionError) {
      setError(getDeliveryErrorMessage(actionError, fallback));
    } finally {
      setBusy(false);
    }
  }

  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (task) => (typeFilter === "ALL" || task.type === typeFilter) && (showDone ? isDone(task.status) : !isDone(task.status)),
      ),
    [showDone, tasks, typeFilter],
  );
  const counts = useMemo(
    () => ({
      ALL: tasks.filter((task) => !isDone(task.status)).length,
      OUTBOUND: tasks.filter((task) => task.type === "OUTBOUND" && !isDone(task.status)).length,
      RETURN: tasks.filter((task) => task.type === "RETURN" && !isDone(task.status)).length,
      late: tasks.filter((task) => isLate(task, now)).length,
    }),
    [now, tasks],
  );

  const status = detail?.task.status ?? selected?.status;
  const claimed = Boolean(detail?.task.assignee);
  const units = detail?.units ?? [];
  const setReview = (unitId: string, patch: Partial<UnitReview>) =>
    setReviews((current) => ({
      ...current,
      [unitId]: { ...(current[unitId] ?? { status: "PENDING", note: "", photoIds: [] }), ...patch },
    }));
  const reviewsComplete =
    units.length > 0 &&
    units.every((unit) => {
      const review = reviews[unit.unitId];
      return review && review.status !== "PENDING" && (review.status === "OK" || review.note.trim().length > 0);
    });

  async function addPhotos(unitId: string, files: FileList | null) {
    if (!files?.length) return;
    setUploadingUnit(unitId);
    setError(undefined);
    try {
      const ids: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) throw new Error("Chỉ nhận file ảnh.");
        ids.push(await uploadReturnEvidence(file));
      }
      setReviews((current) => {
        const review = current[unitId] ?? { status: "PENDING" as UnitCheck, note: "", photoIds: [] };
        return { ...current, [unitId]: { ...review, photoIds: [...review.photoIds, ...ids] } };
      });
    } catch (uploadError) {
      setError(getDeliveryErrorMessage(uploadError, "Không tải được ảnh hiện trạng."));
    } finally {
      setUploadingUnit(undefined);
    }
  }

  // ---- Thao tác giao đi --------------------------------------------------
  const claim = () =>
    run(() => claimDeliveryTask(selected!.id, detail?.task.version ?? selected!.version), "Đã nhận nhiệm vụ.", "Không nhận được nhiệm vụ.");

  const receivePackage = () =>
    run(
      async () => {
        if (!detail?.custodyTransfer) throw new Error("Kho chưa bàn giao kiện cho nhiệm vụ này.");
        if (!packageCode.trim()) throw new Error("Nhập hoặc quét mã kiện trên nhãn.");
        await receiveDeliveryPackage(selected!.id, {
          custodyTransferId: detail.custodyTransfer.id,
          packageCode: packageCode.trim(),
          expectedVersion: detail.task.version,
        });
      },
      "Đã nhận kiện từ kho.",
      "Không nhận được kiện từ kho.",
    );

  const verifyRecipient = () =>
    run(
      async () => {
        if (!detail) return;
        if (!pickupCode.trim()) throw new Error("Nhập mã nhận hàng khách đưa.");
        const result = await verifyDeliveryRecipient(selected!.id, { pickupCode: pickupCode.trim(), expectedVersion: detail.task.version });
        setVerificationRef(result.verificationRef);
      },
      "Đã xác minh người nhận.",
      "Không xác minh được người nhận.",
    );

  // Món "Thiếu" lúc giao không được giao cho khách: backend hoàn phí thuê + cọc của món đó.
  const missingAtHandover = units.filter((unit) => reviews[unit.unitId]?.status === "MISSING");
  const allMissingAtHandover = units.length > 0 && missingAtHandover.length === units.length;

  const requestHandover = () => {
    if (missingAtHandover.length) setShortageConfirmOpen(true);
    else void handover();
  };

  const handover = () =>
    run(
      async () => {
        setShortageConfirmOpen(false);
        if (!detail?.package || !order) throw new Error("Thiếu thông tin kiện hoặc đơn thuê. Hãy tải lại.");
        const ref = verificationRef ?? verificationRefOf(detail);
        if (!ref) throw new Error("Cần xác minh mã nhận hàng trước khi bàn giao.");
        if (!reviewsComplete) throw new Error("Kiểm từng thiết bị; món thiếu hoặc hư hỏng phải có ghi chú.");
        if (allMissingAtHandover)
          throw new Error("Kiện thiếu toàn bộ thiết bị: dùng “Khách không đến / từ chối nhận” với lý do “Kiện bàn giao thiếu thiết bị”.");
        const result = await commitRentalHandover(selected!.orderSummary.orderId, {
          packageId: detail.package.id,
          verificationRef: ref,
          recipientNotes: recipientNotes.trim() || undefined,
          reportedIssues: units.flatMap((unit) => {
            const review = reviews[unit.unitId];
            return review && review.status !== "OK" && review.status !== "PENDING"
              ? [{ unitId: unit.unitId, type: HANDOVER_ISSUE_TYPE[review.status], description: review.note.trim() }]
              : [];
          }),
          expectedVersion: order.order.version,
        });
        const shortage = result.shortage;
        if (!shortage) return;
        const money = formatMoney(shortage.refund.amount);
        return shortage.refund.refundRef
          ? `Đã bàn giao, thiếu ${shortage.units.length} thiết bị. Khách được hoàn ${money}; kho sẽ tìm lại thiết bị thiếu.`
          : `Đã bàn giao, thiếu ${shortage.units.length} thiết bị. Chưa tạo được khoản hoàn ${money} tự động — Admin sẽ hoàn tay.`;
      },
      "Đã bàn giao thiết bị cho khách.",
      "Bàn giao thiết bị thất bại.",
    );

  const noShow = () =>
    run(
      async () => {
        if (!order) throw new Error("Chưa tải được đơn thuê. Hãy tải lại.");
        await markRentalNoShow(selected!.orderSummary.orderId, {
          reason: noShowReason,
          notes: noShowNotes.trim() || undefined,
          evidenceIds: [],
          expectedVersion: order.order.version,
        });
        setNoShowOpen(false);
      },
      "Đã ghi nhận khách không nhận hàng.",
      "Không ghi nhận được.",
    );

  // ---- Thao tác thu hồi --------------------------------------------------
  const receivedUnits = units.filter((unit) => reviews[unit.unitId]?.status !== "MISSING");

  const collectReturn = () =>
    run(
      async () => {
        if (!order) throw new Error("Chưa tải được đơn thuê. Hãy tải lại.");
        if (!reviewsComplete) throw new Error("Đánh dấu từng món; món thiếu hoặc hư hỏng phải có ghi chú.");
        if (receivedUnits.length === 0) throw new Error("Cần ít nhất một thiết bị thực nhận. Mất toàn bộ phải báo admin xử lý ngoại lệ.");
        const noPhoto = receivedUnits.find((unit) => !reviews[unit.unitId]?.photoIds.length);
        if (noPhoto) throw new Error(`${unitName(noPhoto)} (mã ${shortId(noPhoto.assetCode)}) cần ít nhất 1 ảnh hiện trạng.`);

        const scan = await scanRentalReturn(selected!.orderSummary.orderId, {
          assetCodes: receivedUnits.map((unit) => unit.assetCode),
          expectedVersion: order.order.version,
        });
        const observation = await submitReturnObservations(selected!.orderSummary.orderId, {
          items: receivedUnits.map((unit) => {
            const review = reviews[unit.unitId];
            return {
              unitId: unit.unitId,
              visibleDamage: review.status === "DAMAGED",
              accessoryObservations: review.status === "DAMAGED" && review.note.trim() ? [review.note.trim()] : [],
              notes: review.note.trim() || undefined,
              evidenceIds: review.photoIds,
            };
          }),
          expectedVersion: scan.version,
        });
        const refreshedOrder = await getRentalOrderForDelivery(selected!.orderSummary.orderId);
        await finalizeReturnReceipt(selected!.orderSummary.orderId, {
          returnSessionId: observation.returnSessionId ?? scan.returnSessionId,
          expectedVersion: refreshedOrder.order.version,
          remarks: `${receivedUnits.length} thiết bị thực nhận; ${scan.missingUnits.length} thiết bị chưa thu hồi.`,
          evidenceIds: receivedUnits.flatMap((unit) => reviews[unit.unitId]?.photoIds ?? []),
        });
      },
      "Đã thu hồi thiết bị và lập biên nhận trả đồ.",
      "Không thu hồi được thiết bị.",
    );

  const returnedUnitIds = units.filter((unit) => unit.assignmentStatus === "RETURNED").map((unit) => unit.unitId);

  const sendToInventory = () =>
    run(
      async () => {
        if (!detail) return;
        await transferReturnToInventory(selected!.id, {
          unitIds: returnedUnitIds.length ? returnedUnitIds : units.map((unit) => unit.unitId),
          missingInCustodyUnitIds: [],
          incidentNote: incidentNote.trim() || undefined,
          packageId: detail.package?.id,
          expectedVersion: detail.task.version,
        });
      },
      "Đã tạo yêu cầu bàn giao về kho. Chờ kho xác nhận nhận hàng.",
      "Không tạo được yêu cầu bàn giao về kho.",
    );

  // ---- Giao diện ---------------------------------------------------------
  const reviewList = (withPhotos: boolean) => (
    <div className="space-y-3">
      {units.map((unit) => {
        const review = reviews[unit.unitId] ?? { status: "PENDING", note: "", photoIds: [] };
        return (
          <div key={unit.unitId} className="rounded-xl border border-[#E5E7EB] p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-[#1F2937]">{unitName(unit)}</p>
              <p className="text-xs text-[#6B7280]">Mã {shortId(unit.assetCode)}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(CHECK_LABEL) as Array<keyof typeof CHECK_LABEL>).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setReview(unit.unitId, { status: option })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    review.status === option
                      ? option === "OK"
                        ? "border-[#2F6B4F] bg-[#2F6B4F] text-white"
                        : "border-red-600 bg-red-600 text-white"
                      : "border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#2F6B4F]"
                  }`}
                >
                  {withPhotos ? CHECK_LABEL[option] : HANDOVER_CHECK_LABEL[option]}
                </button>
              ))}
            </div>
            {(review.status === "MISSING" || review.status === "DAMAGED") && (
              <Input
                className="mt-2"
                value={review.note}
                onChange={(event) => setReview(unit.unitId, { note: event.target.value })}
                placeholder="Ghi chú tình trạng (bắt buộc)"
              />
            )}
            {withPhotos && review.status !== "MISSING" && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#F7F7F4] px-3 py-2 text-xs">
                <span className="text-[#6B7280]">
                  {uploadingUnit === unit.unitId
                    ? "Đang tải ảnh..."
                    : review.photoIds.length
                      ? `Đã có ${review.photoIds.length} ảnh hiện trạng`
                      : "Cần ít nhất 1 ảnh hiện trạng"}
                </span>
                <label className={`cursor-pointer rounded-md bg-white px-3 py-1.5 font-semibold text-[#2F6B4F] shadow-sm ${uploadingUnit ? "pointer-events-none opacity-50" : ""}`}>
                  Chụp / tải ảnh
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      void addPhotos(unit.unitId, event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const actionPanel = () => {
    if (!selected || !status) return null;
    if (isDone(status)) {
      return (
        <InfoBanner tone={status === "HANDED_OVER" || status === "INVENTORY_RECEIVED" || status === "CLOSED" ? "success" : "warning"} title={STATUS_VIEW[status].label}>
          Nhiệm vụ đã kết thúc, không còn thao tác cần làm.
        </InfoBanner>
      );
    }
    if (status === "BLOCKED") {
      return <InfoBanner tone="warning" title="Nhiệm vụ đang bị chặn">Kho chưa soạn xong hoặc đơn đang có vấn đề. Liên hệ kho hoặc admin.</InfoBanner>;
    }
    if (!claimed) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-[#6B7280]">Nhiệm vụ chưa có người phụ trách. Nhận việc để bắt đầu.</p>
          <Button onClick={() => void claim()} loading={busy} fullWidth>Nhận nhiệm vụ</Button>
        </div>
      );
    }

    if (selected.type === "OUTBOUND") {
      if (status === "SCHEDULED") {
        return detail?.custodyTransfer ? (
          <div className="space-y-3">
            <FormField label="Mã kiện" hint="Quét hoặc nhập mã trên nhãn kiện kho đưa cho bạn.">
              <Input value={packageCode} onChange={(event) => setPackageCode(event.target.value)} placeholder="VD: PKG-..." />
            </FormField>
            <Button onClick={() => void receivePackage()} loading={busy} fullWidth>Xác nhận đã nhận kiện từ kho</Button>
          </div>
        ) : (
          <InfoBanner tone="info" title="Chờ kho bàn giao">Kho chưa chuyển kiện cho nhiệm vụ này. Khi kho bàn giao, bấm Làm mới để tiếp tục.</InfoBanner>
        );
      }
      if (status === "PACKAGE_RECEIVED") {
        return (
          <div className="space-y-3">
            <FormField label="Mã nhận hàng của khách" hint="Khách mở mã trong app (đơn thuê → Mã nhận hàng).">
              <Input value={pickupCode} onChange={(event) => setPickupCode(event.target.value)} placeholder="Nhập mã khách đưa" />
            </FormField>
            <Button onClick={() => void verifyRecipient()} loading={busy} fullWidth>Xác minh người nhận</Button>
            {noShowBlock}
          </div>
        );
      }
      if (status === "RECIPIENT_VERIFIED") {
        return (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#1F2937]">Kiểm từng thiết bị cùng khách</p>
            {reviewList(false)}
            <FormField label="Ghi chú bàn giao (không bắt buộc)">
              <Textarea value={recipientNotes} onChange={(event) => setRecipientNotes(event.target.value)} rows={2} />
            </FormField>
            {allMissingAtHandover ? (
              <InfoBanner tone="warning" title="Kiện thiếu toàn bộ thiết bị">
                Không bàn giao được. Dùng “Khách không đến / từ chối nhận” với lý do “Kiện bàn giao thiếu thiết bị” để huỷ đơn và hoàn tiền cho khách.
              </InfoBanner>
            ) : missingAtHandover.length > 0 ? (
              <InfoBanner tone="warning" title={`Bàn giao thiếu ${missingAtHandover.length} thiết bị`}>
                Món thiếu không giao cho khách; khách được hoàn phí thuê và tiền cọc của món đó, kho nhận việc tìm lại.
              </InfoBanner>
            ) : null}
            <Button onClick={requestHandover} loading={busy} disabled={!reviewsComplete || allMissingAtHandover} fullWidth>
              {missingAtHandover.length && !allMissingAtHandover
                ? `Bàn giao ${units.length - missingAtHandover.length}/${units.length} thiết bị`
                : "Bàn giao cho khách"}
            </Button>
            {noShowBlock}
          </div>
        );
      }
    }

    if (selected.type === "RETURN") {
      if (status === "SCHEDULED" || status === "COLLECTING") {
        return (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#1F2937]">Đối chiếu và chụp hiện trạng từng thiết bị</p>
            {reviewList(true)}
            <Button onClick={() => void collectReturn()} loading={busy} disabled={!reviewsComplete || Boolean(uploadingUnit)} fullWidth>
              Xác nhận thu hồi ({receivedUnits.length} thiết bị)
            </Button>
          </div>
        );
      }
      if (status === "RETURNED") {
        return (
          <div className="space-y-3">
            <InfoBanner tone="success" title="Đã thu hồi từ khách">Mang thiết bị về kho rồi tạo yêu cầu bàn giao để kho xác nhận nhận hàng.</InfoBanner>
            <FormField label="Ghi chú sự việc (nếu có)">
              <Textarea value={incidentNote} onChange={(event) => setIncidentNote(event.target.value)} rows={2} />
            </FormField>
            <Button onClick={() => void sendToInventory()} loading={busy} fullWidth>Bàn giao về kho</Button>
          </div>
        );
      }
    }

    return <p className="text-sm text-[#6B7280]">Nhiệm vụ đang ở bước {STATUS_VIEW[status]?.label ?? status}. Bấm Làm mới để cập nhật.</p>;
  };

  const noShowBlock = noShowOpen ? (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-3">
      <FormField label="Lý do">
        <Select value={noShowReason} onChange={(event) => setNoShowReason(event.target.value as NoShowReason)}>
          {NO_SHOW_REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>{reason.label}</option>
          ))}
        </Select>
      </FormField>
      <FormField label="Ghi chú">
        <Textarea value={noShowNotes} onChange={(event) => setNoShowNotes(event.target.value)} rows={2} />
      </FormField>
      <div className="flex gap-2">
        <Button variant="danger" onClick={() => void noShow()} loading={busy}>Xác nhận</Button>
        <Button variant="ghost" onClick={() => setNoShowOpen(false)}>Hủy</Button>
      </div>
    </div>
  ) : (
    <button type="button" onClick={() => setNoShowOpen(true)} className="w-full py-1 text-center text-xs font-semibold text-red-700 hover:underline">
      Khách không đến / từ chối nhận
    </button>
  );

  return (
    <main className="px-6 py-5">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2F6B4F]">Giao nhận thiết bị</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#1F2937]">Nhiệm vụ giao và thu hồi</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              {counts.ALL} nhiệm vụ đang mở{counts.late ? ` · ${counts.late} nhiệm vụ trễ giờ hẹn` : ""}
            </p>
          </div>
          <Button onClick={() => void loadTasks()} loading={loading} size="sm">Làm mới</Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["ALL", "OUTBOUND", "RETURN"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${typeFilter === type ? "bg-[#1F4A36] text-white" : "bg-white text-[#1F2937] ring-1 ring-[#E5E7EB]"}`}
            >
              {type === "ALL" ? "Tất cả" : TYPE_LABEL[type]} ({counts[type]})
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-[#6B7280]">
            <input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} className="accent-[#2F6B4F]" />
            Xem nhiệm vụ đã xong
          </label>
        </div>

        {error && <ErrorAlert className="mt-4" message={error} onDismiss={() => setError(undefined)} />}
        {notice && <InfoBanner className="mt-4" tone="success" onDismiss={() => setNotice(undefined)}>{notice}</InfoBanner>}

        <section className="mt-5 grid items-start gap-5 lg:grid-cols-[380px_1fr]">
          <SurfaceCard padding="sm" className="space-y-2">
            {loading ? (
              <LoadingState message="Đang tải nhiệm vụ..." />
            ) : visibleTasks.length === 0 ? (
              <EmptyState title={showDone ? "Chưa có nhiệm vụ đã xong" : "Không có nhiệm vụ đang mở"} description="Nhiệm vụ giao xuất hiện khi kho soạn xong đơn; nhiệm vụ thu hồi mở khi tới giờ trả đồ." />
            ) : (
              visibleTasks.map((task) => {
                const late = isLate(task, now);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => selectTask(task)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      task.id === selectedId ? "border-[#2F6B4F] bg-[#EEF5F0]" : late ? "border-red-200 bg-white hover:border-red-300" : "border-[#E5E7EB] bg-white hover:border-[#2F6B4F]/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-[#2F6B4F]">{TYPE_LABEL[task.type]} · Đơn {orderShortCode(task.orderSummary.orderId)}</p>
                      <StatusBadge status={STATUS_VIEW[task.status]?.tone ?? "neutral"} customLabel={STATUS_VIEW[task.status]?.label ?? task.status} />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#1F2937]">{task.point.name}</p>
                    <p className="mt-1 text-xs text-[#6B7280]">Khách: {recipientName(task)}</p>
                    <p className={`mt-1 text-xs ${late ? "font-semibold text-red-700" : "text-[#6B7280]"}`}>
                      Hẹn: <span className="tabular-nums">{formatDateTime(task.scheduledAt)}</span>{late ? " · Trễ hẹn" : ""}
                    </p>
                    {task.earlyReturn ? (
                      <StatusBadge className="mt-2" status="PENDING" customLabel={earlyReturnLabel(task.earlyReturn)} />
                    ) : null}
                  </button>
                );
              })
            )}
          </SurfaceCard>

          <SurfaceCard padding="md">
            {!selected ? (
              <EmptyState title="Chọn một nhiệm vụ" description="Chọn nhiệm vụ bên trái để xem chi tiết và thao tác." />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2F6B4F]">{TYPE_LABEL[selected.type]}</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[#1F2937]">Đơn {orderShortCode(selected.orderSummary.orderId)}</h2>
                    {order?.order.trip?.title && <p className="mt-1 text-sm text-[#6B7280]">{order.order.trip.title}</p>}
                  </div>
                  {status && <StatusBadge status={STATUS_VIEW[status]?.tone ?? "neutral"} customLabel={STATUS_VIEW[status]?.label ?? status} />}
                </div>

                <dl className="grid gap-3 rounded-xl bg-[#F7F7F4] p-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-[#6B7280]">Điểm hẹn</dt><dd className="font-semibold text-[#1F2937]">{selected.point.name}</dd>{selected.point.address && <dd className="text-xs text-[#6B7280]">{selected.point.address}</dd>}</div>
                  <div><dt className="text-xs text-[#6B7280]">Khách thuê</dt><dd className="font-semibold text-[#1F2937]">{recipientName(selected, detail)}</dd></div>
                  <div><dt className="text-xs text-[#6B7280]">Giờ hẹn</dt><dd className={`font-semibold tabular-nums ${isLate(selected, now) ? "text-red-700" : "text-[#1F2937]"}`}>{formatDateTime(selected.scheduledAt)}</dd>{selected.earlyReturn && <dd className="mt-1"><StatusBadge status="PENDING" customLabel={earlyReturnLabel(selected.earlyReturn)} /></dd>}</div>
                  {detail?.custodyTransfer && (
                    <div><dt className="text-xs text-[#6B7280]">Kho bàn giao lúc</dt><dd className="font-semibold text-[#1F2937]">{formatDateTime(detail.custodyTransfer.requestedAt)}</dd></div>
                  )}
                  {selected.package && (
                    <div><dt className="text-xs text-[#6B7280]">Kiện hàng</dt><dd className="break-all font-semibold text-[#1F2937]">{selected.package.code}</dd></div>
                  )}
                </dl>

                {order?.timeline && order.timeline.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[#1F2937]">Tiến trình đơn</p>
                    <ol className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                      {order.timeline.map((step) => (
                        <li key={`${step.type}-${step.at}`} className="text-xs">
                          <span className="block font-semibold text-[#1F2937]">{TIMELINE_LABEL[step.type] ?? step.type}</span>
                          <span className="text-[#6B7280] tabular-nums">{formatDateTime(step.at)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {detailLoading ? (
                  <LoadingState message="Đang tải chi tiết..." />
                ) : (
                  <>
                    {units.length > 0 && selected.type === "OUTBOUND" && status !== "RECIPIENT_VERIFIED" && (
                      <div>
                        <p className="text-sm font-semibold text-[#1F2937]">Thiết bị trong kiện ({units.length})</p>
                        <ul className="mt-2 divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
                          {units.map((unit) => (
                            <li key={unit.unitId} className="flex justify-between gap-2 px-3 py-2 text-sm">
                              <span className="text-[#1F2937]">{unitName(unit)}</span>
                              <span className="text-xs text-[#6B7280]">Mã {shortId(unit.assetCode)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {actionPanel()}
                  </>
                )}
              </div>
            )}
          </SurfaceCard>
        </section>
      </div>
      <ConfirmModal
        isOpen={shortageConfirmOpen}
        onClose={() => setShortageConfirmOpen(false)}
        onConfirm={() => void handover()}
        loading={busy}
        title={`Bàn giao thiếu ${missingAtHandover.length} thiết bị?`}
        confirmLabel={`Bàn giao ${units.length - missingAtHandover.length} thiết bị`}
        confirmVariant="danger"
        description={
          <div className="space-y-2 text-sm text-[#1F2937]">
            <p>Các thiết bị sau không có trong kiện và sẽ không giao cho khách:</p>
            <ul className="list-disc pl-5">
              {missingAtHandover.map((unit) => (
                <li key={unit.unitId}>
                  {unitName(unit)} · mã {shortId(unit.assetCode)}
                </li>
              ))}
            </ul>
            <p>
              Khách được hoàn phí thuê và tiền cọc của các thiết bị này; thiết bị chuyển sang bảo trì để kho tìm lại. Không thể hoàn tác sau
              khi bàn giao.
            </p>
          </div>
        }
      />
    </main>
  );
}
