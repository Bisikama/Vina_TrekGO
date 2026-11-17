"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  ConfirmModal,
  ErrorAlert,
  LoadingState,
  EmptyState,
  PageShell,
  PageHeader,
  SurfaceCard,
  SurfaceSectionHeader,
  FormField,
  Input,
  Select,
  Textarea,
  PaginationBar,
  StatusBadge,
  InfoBanner,
} from "@/components/ui";

import {
  approveDepositSettlement,
  confirmRentalRefundSettlement,
  getRentalException,
  getAdminRentalRefundInfo,
  getStaffReturnErrorMessage,
  listRentalExceptions,
  reconcileRentalRefund,
  resolveRentalException,
  type RentalExceptionDetail,
  type RentalExceptionSummary,
  type AdminRentalRefundInfo,
} from "@/features/rentals/services/staff-returns.api";
import { getEvidenceMedia } from "@/features/rentals/services/deduction-review.api";

type ExceptionDecision =
  | "APPROVE_DEDUCTION"
  | "REJECT_DEDUCTION"
  | "CONFIRM_LOST"
  | "CLOSE_NO_ACTION"
  | "RETRY_REFUND";

const exceptionLabels: Record<string, string> = {
  REFUND_FAILURE: "Ngoại lệ hoàn tiền",
  DAMAGE: "Thiết bị hư hỏng",
  MISSING: "Thiết bị thiếu hoặc thất lạc",
  RETURN_EXCEPTION: "Ngoại lệ hoàn trả",
  OTHER: "Sai lệch custody nội bộ",
  DAMAGE_DISPUTE: "Hư hại / khoản trừ cọc",
  OVERDUE: "Trả thiết bị quá hạn",
  RETURN_INCOMPLETE: "Trả thiếu thiết bị",
  PAYMENT_MISMATCH: "Sai lệch thanh toán",
};

const outcomeLabels: Record<string, string> = {
  NORMAL: "Đạt",
  ISSUE: "Có hư hại",
  MISSING_PENDING_REVIEW: "Chưa nhận lại thiết bị · chờ xác minh",
  DAMAGE_CONFIRMED: "Đã xác nhận hư hại",
  LOST_CONFIRMED: "Đã xác nhận thất lạc",
};

const caseStatusLabels: Record<string, string> = {
  OPEN: "Cần xử lý",
  UNDER_REVIEW: "Đang xem xét",
  RESOLVED: "Đã xử lý",
  REJECTED: "Đã từ chối",
  CLOSED: "Đã đóng",
};

const refundStatusLabels: Record<string, string> = {
  PENDING: "Chờ hoàn tiền",
  PROCESSING: "Đang hoàn tiền",
  SUCCEEDED: "Hoàn tiền thành công",
  FAILED: "Hoàn tiền thất bại",
};

const reconcileStatusLabels: Record<string, string> = {
  SCHEDULED: "\u0110ang ch\u1edd \u0111\u1ed1i so\u00e1t",
  QUEUED: "\u0110ang ch\u1edd \u0111\u1ed1i so\u00e1t",
  PENDING: "\u0110ang ch\u1edd \u0111\u1ed1i so\u00e1t",
  RUNNING: "\u0110ang \u0111\u1ed1i so\u00e1t",
  PROCESSING: "\u0110ang \u0111\u1ed1i so\u00e1t",
  RECONCILING: "\u0110ang \u0111\u1ed1i so\u00e1t",
  NEEDS_REVIEW: "C\u1ea7n Admin ki\u1ec3m tra",
  REVIEW_REQUIRED: "C\u1ea7n Admin ki\u1ec3m tra",
  CONFIRMED: "\u0110\u00e3 x\u00e1c nh\u1eadn",
  SUCCEEDED: "\u0110\u00e3 x\u00e1c nh\u1eadn ho\u00e0n ti\u1ec1n",
  FAILED: "\u0110\u1ed1i so\u00e1t th\u1ea5t b\u1ea1i",
  RESOLVED: "Đã xử lý đối soát",
  IDLE: "Chưa có yêu cầu đối soát",
};

const errorLabels: Record<string, string> = {
  RECOVERY_UNKNOWN: "Chưa xác định được trạng thái từ cổng thanh toán",
  REFUND_QUERY_MISMATCH: "Kết quả đối soát không khớp lệnh hoàn tiền",
  REFUND_LEGACY_METADATA: "Lệnh hoàn tiền thiếu dữ liệu đối soát",
  REFUND_RECONCILIATION_REQUIRED: "Cần đối soát trạng thái hoàn tiền",
  DEPOSIT_REFUND_FAILED: "Cổng thanh toán báo hoàn tiền cọc thất bại",
  PROVIDER_REJECTED: "Cổng thanh toán từ chối lệnh hoàn tiền",
  MISSING_PENDING_REVIEW:
    "Khách chưa bàn giao lại thiết bị khi thu hồi · đang chờ xác minh thất lạc",
  DEDUCTION_APPROVAL_REQUIRED:
    "Kiểm định kho ghi nhận hư hại · cần Admin duyệt mức khấu trừ cọc",
  DAMAGE_EXCEEDS_DEPOSIT_MANUAL_CASE:
    "Thiệt hại vượt mức tiền cọc của thiết bị · cần Admin duyệt khấu trừ tối đa theo cọc",
  ASSESSMENT_REQUIRED_FOR_FINAL_ISSUE:
    "Kiểm định cuối tại kho phát hiện vấn đề · cần Admin đánh giá",
};

const decisionLabels: Record<string, string> = {
  APPROVE_DEDUCTION: "Duyệt khấu trừ cọc",
  REJECT_DEDUCTION: "Không khấu trừ (hoàn đủ cọc)",
  CONFIRM_LOST: "Xác nhận thất lạc (khấu trừ 100% cọc)",
  CLOSE_NO_ACTION: "Miễn trừ / Đóng không khấu trừ (hoàn đủ cọc)",
  RETRY_REFUND: "Gửi lại lệnh hoàn cọc",
  REFUND_SUCCEEDED: "Hoàn tiền thành công",
};

const auditActionLabels: Record<string, string> = {
  RENTAL_EXCEPTION_RESOLVED: "Admin đã ra quyết định xử lý ngoại lệ",
  RENTAL_DEPOSIT_REFUND_RETRY_QUEUED: "Admin yêu cầu gửi lại lệnh hoàn cọc",
};

function shortCode(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/-/g, "").slice(-8).toUpperCase();
}

function labelFor(labels: Record<string, string>, value: string) {
  const normalized = value.trim().toUpperCase();
  return (
    labels[normalized] ??
    normalized.replace(/_/g, " ").toLocaleLowerCase("vi-VN")
  );
}

function visibleReason(reason: string) {
  const value = reason.replace(/^\[refund:[0-9a-f-]{36}\]\s*/i, "").trim();
  if (value.startsWith("DELIVERY_CUSTODY_DISCREPANCY")) {
    const rest = value
      .replace(
        /^DELIVERY_CUSTODY_DISCREPANCY:(TRANSFER_OMISSION|WAREHOUSE_RECEIPT_SHORTAGE):?\s*/i,
        "",
      )
      .trim();
    return rest || "Sai lệch bàn giao nội bộ giữa nhân viên giao hàng và kho";
  }
  if (value.startsWith("HANDOVER_SHORTAGE_REFUND_REQUIRED:")) {
    return `Giao thiếu thiết bị nhưng chưa tạo được khoản hoàn tự động — cần hoàn tay (${value.slice("HANDOVER_SHORTAGE_REFUND_REQUIRED:".length).trim()})`;
  }
  if (value.startsWith("HANDOVER_SHORTAGE:")) {
    const note = value.slice("HANDOVER_SHORTAGE:".length).trim();
    return `Thiếu trong kiện lúc giao cho khách${note ? ` — ${note}` : ""}`;
  }
  if (value === "SYSTEM: unit not handed back in the collection round") {
    return "Thiết bị không được bàn giao lại trong đợt thu hồi";
  }
  if (value === "SYSTEM: unit not returned after the return deadline") {
    return "Thiết bị chưa được hoàn trả sau khi quá hạn trả hợp đồng";
  }
  return errorLabels[value] ?? value.replace(/_/g, " ");
}

function formatResolution(resolution: string) {
  const separatorIndex = resolution.indexOf(":");
  if (separatorIndex === -1) {
    return decisionLabels[resolution.trim().toUpperCase()] ?? resolution;
  }
  const code = resolution.slice(0, separatorIndex).trim().toUpperCase();
  const note = resolution.slice(separatorIndex + 1).trim();
  const label = decisionLabels[code] ?? code;
  return note ? `${label} — ${note}` : label;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function EvidenceList({ ids }: { ids: string[] }) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string[]>([]);
  async function loadEvidence(id: string) {
    try {
      const media = await getEvidenceMedia(id);
      setLinks((current) => ({ ...current, [id]: media.url }));
      setFailed((current) => current.filter((value) => value !== id));
    } catch {
      setFailed((current) => [...current, id]);
    }
  }
  if (!ids.length)
    return (
      <p className="text-xs text-slate-500">Không có chứng cứ đính kèm.</p>
    );
  return (
    <ul className="space-y-2">
      {ids.map((id) => (
        <li key={id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="break-all font-mono text-slate-500">{id}</span>
          {links[id] ? (
            <a
              href={links[id]}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-emerald-700 underline"
            >
              Mở chứng cứ
            </a>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadEvidence(id)}
            >
              Tải chứng cứ
            </Button>
          )}
          {failed.includes(id) && (
            <span className="text-red-700">
              Không tải được chứng cứ; hãy thử lại.
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AdminRentalReturnExceptions() {
  const [items, setItems] = useState<RentalExceptionSummary[]>([]);
  const [detail, setDetail] = useState<RentalExceptionDetail>();
  const [reason, setReason] = useState("");
  // Rỗng = duyệt đúng mức đề xuất.
  const [deductionInput, setDeductionInput] = useState("");
  const [settledCaseIds, setSettledCaseIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refundInfo, setRefundInfo] = useState<AdminRentalRefundInfo>();
  const [refundInfoError, setRefundInfoError] = useState<string>();
  const [refundInfoRevision, setRefundInfoRevision] = useState(0);
  const [showSimulationConfirm, setShowSimulationConfirm] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    type: "",
    status: "",
    assignee: "",
  });
  const [filters, setFilters] = useState({
    type: "",
    status: "",
    assignee: "",
  });
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const refreshList = useCallback(async () => {
    const result = await listRentalExceptions({
      page,
      pageSize,
      type: filters.type || undefined,
      status: filters.status || undefined,
      assignee: filters.assignee || undefined,
    });
    setItems(result.items);
    setTotal(result.pagination.totalItems);
    if (page > 1 && page > Math.max(1, result.pagination.totalPages))
      setPage(Math.max(1, result.pagination.totalPages));
  }, [page, filters]);

  const load = useCallback(async () => {
    setError(undefined);
    setListLoading(true);
    try {
      await refreshList();
      if (detail) {
        setDetail(await getRentalException(detail.case.id));
        setRefundInfo(undefined);
        setRefundInfoRevision((current) => current + 1);
      }
    } catch (loadError) {
      setError(getStaffReturnErrorMessage(loadError));
    } finally {
      setListLoading(false);
    }
  }, [detail, refreshList]);

  useEffect(() => {
    let active = true;
    void listRentalExceptions({
      page,
      pageSize,
      type: filters.type || undefined,
      status: filters.status || undefined,
      assignee: filters.assignee || undefined,
    })
      .then((result) => {
        if (active) {
          setItems(result.items);
          setTotal(result.pagination.totalItems);
        }
      })
      .catch((loadError) => {
        if (active) setError(getStaffReturnErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, filters]); // Filters are applied together by the form.

  const refundId =
    detail?.case.type === "REFUND_FAILURE" ? detail.refund?.id : undefined;
  useEffect(() => {
    if (!refundId) return;
    let active = true;
    void getAdminRentalRefundInfo(refundId)
      .then((result) => {
        if (active) {
          setRefundInfo(result);
          setRefundInfoError(undefined);
        }
      })
      .catch((requestError) => {
        if (active) {
          setRefundInfo(undefined);
          setRefundInfoError(getStaffReturnErrorMessage(requestError));
        }
      });
    return () => {
      active = false;
    };
  }, [refundId, refundInfoRevision]);

  async function selectException(exceptionId: string) {
    setError(undefined);
    setNotice(undefined);
    setDetail(undefined);
    setRefundInfo(undefined);
    setRefundInfoError(undefined);
    setReason("");
    setDeductionInput("");
    setDetailLoading(true);
    try {
      setDetail(await getRentalException(exceptionId));
    } catch (requestError) {
      setError(getStaffReturnErrorMessage(requestError));
    } finally {
      setDetailLoading(false);
    }
  }

  const depositAmount = detail?.deduction?.depositAmount ?? 0;
  const proposedDeduction = detail?.deduction?.proposed ?? 0;
  const approvedDeduction = detail?.deduction?.approved ?? null;
  const deductionAmount =
    deductionInput.trim() === "" ? proposedDeduction : Number(deductionInput);
  const deductionInvalid =
    deductionInput.trim() !== "" &&
    (!Number.isInteger(deductionAmount) ||
      deductionAmount < 1 ||
      deductionAmount > proposedDeduction);

  async function decide(decision: ExceptionDecision) {
    if (!detail || reason.trim().length < 3 || busy) return;
    if (decision === "APPROVE_DEDUCTION" && deductionInvalid) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const isMissingCase =
        detail.case.type === "RETURN_INCOMPLETE" ||
        detail.assessment?.outcome === "MISSING_PENDING_REVIEW";
      const result = await resolveRentalException({
        exceptionId: detail.case.id,
        decision,
        reason: reason.trim(),
        assessmentVersion: detail.assessment?.version,
        expectedVersion: detail.case.version,
        ...(decision === "APPROVE_DEDUCTION" &&
        proposedDeduction > 0 &&
        deductionAmount !== proposedDeduction
          ? { approvedDeductionAmount: deductionAmount }
          : {}),
      });
      // Luôn tải lại hồ sơ sau 610: với CONFIRM_LOST / CLOSE_NO_ACTION trên món thiếu hoặc custody,
      // backend vừa tạo mới bản ghi kiểm định FINAL (thay cho PRELIMINARY cũ) nên cần ID FINAL mới để gọi 606.
      const refreshedDetail = await getRentalException(detail.case.id);
      let settlementResult:
        | Awaited<ReturnType<typeof approveDepositSettlement>>
        | undefined;
      let settlementError: string | undefined;
      const settlementAssessment = refreshedDetail.assessment;
      // Món trả thiếu (RETURN_INCOMPLETE) khi CONFIRM_LOST đã trải qua 48h chờ trước đó và không có ảnh
      // chứng cứ cần công bố, nên gọi thẳng 606 quyết toán ngay (giống REJECT_DEDUCTION / CLOSE_NO_ACTION).
      const shouldSettleImmediately =
        result.nextAction === "CREATE_DEPOSIT_SETTLEMENT" &&
        !!settlementAssessment &&
        settlementAssessment.stage === "FINAL" &&
        (decision === "REJECT_DEDUCTION" ||
          decision === "CLOSE_NO_ACTION" ||
          (decision === "CONFIRM_LOST" && isMissingCase));
      if (shouldSettleImmediately && settlementAssessment) {
        try {
          settlementResult = await approveDepositSettlement({
            orderId: detail.case.orderId,
            assessmentId: settlementAssessment.id,
            approvalRef: result.approvalRef,
            version: settlementAssessment.version,
          });
          setSettledCaseIds((current) =>
            current.includes(detail.case.id) ? current : [...current, detail.case.id],
          );
        } catch (error) {
          settlementError = getStaffReturnErrorMessage(error);
        }
      }
      if (decision === "RETRY_REFUND") {
        setNotice(
          "Đã xếp hàng gửi lại lệnh hoàn cọc. Hệ thống sẽ tự động chuyển yêu cầu sang cổng thanh toán.",
        );
      } else if (settlementResult?.refundRef) {
        setNotice(
          `Đã chốt quyết toán cọc. Khoản ${formatMoney(settlementResult.refundAmount, "VND")} đang chờ xử lý hoàn tiền; đây chưa phải trạng thái đã hoàn tiền.`,
        );
      } else if (settlementResult) {
        setNotice(
          settlementResult.deductionAmount > 0
            ? `Đã chốt quyết toán cọc: khấu trừ ${formatMoney(settlementResult.deductionAmount, "VND")}, không còn khoản phải hoàn thêm.`
            : "Đã chốt quyết toán cọc. Không phát sinh khoản phải hoàn qua cổng thanh toán.",
        );
      } else if (settlementError) {
        setNotice(
          `Đã lưu quyết định. Quyết toán chưa hoàn tất: ${settlementError}`,
        );
      } else if (
        result.nextAction === "CREATE_DEPOSIT_SETTLEMENT" &&
        (decision === "APPROVE_DEDUCTION" || decision === "CONFIRM_LOST")
      ) {
        setNotice(
          "Đã lưu quyết định khấu trừ. Hệ thống sẽ công bố chứng cứ cho khách; cọc sẽ tự động quyết toán khi khách bấm 'Đồng ý khoản trừ' hoặc sau khi hết thời hạn 48 giờ phản hồi.",
        );
      } else if (result.nextAction === "CREATE_DEPOSIT_SETTLEMENT") {
        setNotice(
          "Đã lưu quyết định; chưa lấy được kết quả kiểm định cuối để quyết toán. Hãy tải lại hồ sơ.",
        );
      } else {
        setNotice(
          "Đã lưu quyết định ngoại lệ. Không phát sinh bước quyết toán mới.",
        );
      }
      setReason("");
      setDeductionInput("");
      setDetail(await getRentalException(detail.case.id));
      setRefundInfo(undefined);
      setRefundInfoRevision((current) => current + 1);
      await refreshList();
    } catch (requestError) {
      setError(getStaffReturnErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function retrySettlement() {
    if (!detail?.assessment || !detail.case.approvalRef || busy) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await approveDepositSettlement({
        orderId: detail.case.orderId,
        assessmentId: detail.assessment.id,
        approvalRef: detail.case.approvalRef,
        version: detail.assessment.version,
      });
      setSettledCaseIds((current) =>
        current.includes(detail.case.id) ? current : [...current, detail.case.id],
      );
      setNotice(
        result.refundAmount > 0
          ? `Đã chốt quyết toán cọc; khoản ${formatMoney(result.refundAmount, "VND")} đang chờ hoàn tiền.`
          : `Đã hoàn tất quyết toán khoản cọc${result.deductionAmount > 0 ? ` (khấu trừ ${formatMoney(result.deductionAmount, "VND")})` : ""}.`,
      );
      setDetail(await getRentalException(detail.case.id));
    } catch (error) {
      setError(getStaffReturnErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function reconcileRefund() {
    if (!detail?.refund || !reason.trim() || busy) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await reconcileRentalRefund({
        refundId: detail.refund.id,
        reason: reason.trim(),
      });
      setReason("");
      setNotice(
        "Đã xếp lịch đối soát. Hồ sơ chỉ tự đóng khi cổng thanh toán xác nhận hoàn tiền thành công.",
      );
      setDetail(await getRentalException(detail.case.id));
      setRefundInfo(undefined);
      setRefundInfoRevision((current) => current + 1);
    } catch (requestError) {
      setError(getStaffReturnErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRefundSettlement() {
    if (
      !detail?.refund ||
      refundInfo?.refundId !== detail.refund.id ||
      !["DEPOSIT", "RENTAL_CANCELLATION"].includes(refundInfo.purpose) ||
      refundInfo.source !== "RENTAL" ||
      refundInfo.sourceId !== detail.case.orderId ||
      !refundInfo.canAttemptSandboxSimulation ||
      reason.trim().length < 5 ||
      busy
    )
      return;

    const status = detail.refund.status.trim().toUpperCase();
    if (status !== "PROCESSING" && status !== "PENDING") {
      setError("Khoản hoàn cọc không còn ở trạng thái có thể xác nhận.");
      return;
    }

    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await confirmRentalRefundSettlement({
        refundId: detail.refund.id,
        reason: reason.trim(),
        expectedProviderStatus: status,
      });
      setReason("");
      setNotice(
        result.settlementProcessingStatus === "APPLIED"
          ? "Đã ghi nhận hoàn tiền"
          : "Đã ghi nhận hoàn tiền; hệ thống đang đồng bộ quyết toán.",
      );
      setDetail(await getRentalException(detail.case.id));
      setRefundInfo(undefined);
      setRefundInfoRevision((current) => current + 1);
      await refreshList();
    } catch (requestError) {
      setError(getStaffReturnErrorMessage(requestError));
    } finally {
      setShowSimulationConfirm(false);
      setBusy(false);
    }
  }

  const isRefundFailure = detail?.case.type === "REFUND_FAILURE";
  const currentRefundInfo =
    refundInfo &&
    detail?.refund &&
    refundInfo.refundId === detail.refund.id &&
    refundInfo.source === "RENTAL" &&
    refundInfo.sourceId === detail.case.orderId
      ? refundInfo
      : undefined;
  const refundPurposeLabels: Record<string, string> = {
    RENTAL_CANCELLATION: "Hoàn tiền do hủy đơn thuê",
    DEPOSIT: "Hoàn cọc sau trả thiết bị",
    TECHNICAL_REVERSAL: "Hoàn tiền do lỗi thanh toán",
    BOOKING_CANCELLATION: "Hoàn tiền do hủy đặt chỗ",
  };
  const refundPurposeLabel = currentRefundInfo
    ? (refundPurposeLabels[currentRefundInfo.purpose] ?? "Giao dịch hoàn tiền")
    : "Giao dịch hoàn tiền";
  const canReconcile =
    currentRefundInfo?.executionMode === "PROVIDER_API" &&
    !!currentRefundInfo.paymentGateway &&
    currentRefundInfo.paymentGateway.toLowerCase() !== "payos" &&
    currentRefundInfo.status === detail?.refund?.status &&
    ["PENDING", "PROCESSING"].includes(currentRefundInfo.status);
  const canSimulate =
    process.env.NODE_ENV !== "production" &&
    !!currentRefundInfo &&
    ["DEPOSIT", "RENTAL_CANCELLATION"].includes(currentRefundInfo.purpose) &&
    currentRefundInfo.canAttemptSandboxSimulation &&
    currentRefundInfo.status === detail?.refund?.status &&
    ["PENDING", "PROCESSING"].includes(currentRefundInfo.status);
  const isCustodyIncident =
    detail?.case.reason.startsWith("DELIVERY_CUSTODY_DISCREPANCY") ?? false;
  // Case mở lúc bàn giao cho món thiếu trong kiện; chỉ CLOSE_NO_ACTION (khách đã được hoàn).
  const isHandoverShortage = detail?.case.reason.startsWith("HANDOVER_SHORTAGE:") ?? false;
  const isMissingUnitCase =
    detail?.case.type === "RETURN_INCOMPLETE" ||
    detail?.assessment?.outcome === "MISSING_PENDING_REVIEW";
  // [DEMO] Tạm comment điều kiện chặn 48h trước khi bấm "Xác nhận thất lạc" để chạy demo ngay:
  // const lostWindowEndsAt =
  //   isMissingUnitCase && detail?.case.dueAt ? new Date(detail.case.dueAt) : null;
  // const isBeforeLostWindow =
  //   !!lostWindowEndsAt &&
  //   Number.isFinite(lostWindowEndsAt.getTime()) &&
  //   nowMs < lostWindowEndsAt.getTime();
  const isBeforeLostWindow = false;
  const caseOpen = detail
    ? ["OPEN", "UNDER_REVIEW"].includes(detail.case.status)
    : false;
  const canRetryRefund =
    isRefundFailure &&
    caseOpen &&
    (detail?.allowedActions.includes("RETRY_REFUND") ?? false);
  const rawFindingsTotal =
    detail?.assessment?.findings.reduce(
      (sum, finding) => sum + finding.amount * (finding.quantity || 1),
      0,
    ) ?? 0;

  return (
    <PageShell maxWidth="full" withTopOffset={false}>
      <PageHeader
        eyebrow="Quản trị thuê thiết bị"
        title="Ngoại lệ hoàn trả và quyết toán cọc"
        description="Theo dõi kiểm định, phản hồi của khách, khấu trừ và các giao dịch hoàn tiền."
        actions={
          <Button
            type="button"
            disabled={listLoading || detailLoading || busy}
            onClick={() => void load()}
          >
            Làm mới dữ liệu
          </Button>
        }
      />

      {error ? <ErrorAlert message={error} /> : null}
      {notice ? <InfoBanner title="Kết quả xử lý">{notice}</InfoBanner> : null}

      <SurfaceCard>
        <SurfaceSectionHeader
          title="Bộ lọc hồ sơ"
          subtitle="Lọc toàn bộ hồ sơ theo loại, trạng thái hoặc mã nhân viên được giao."
        />
        <form
          className="mt-4 grid gap-4 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const assignee = draftFilters.assignee.trim();
            if (
              assignee &&
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                assignee,
              )
            ) {
              setFilterError("Mã nhân viên phải là UUID hợp lệ.");
              return;
            }
            setFilterError("");
            setError(undefined);
            setListLoading(true);
            setPage(1);
            setFilters({ ...draftFilters, assignee });
          }}
        >
          <FormField label="Loại ngoại lệ">
            <Select
              aria-label="Loại ngoại lệ"
              value={draftFilters.type}
              onChange={(event) =>
                setDraftFilters({ ...draftFilters, type: event.target.value })
              }
            >
              <option value="">Tất cả loại</option>
              {[
                "DAMAGE_DISPUTE",
                "OVERDUE",
                "RETURN_INCOMPLETE",
                "PAYMENT_MISMATCH",
                "REFUND_FAILURE",
                "OTHER",
              ].map((type) => (
                <option key={type} value={type}>
                  {exceptionLabels[type]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Trạng thái">
            <Select
              aria-label="Trạng thái"
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters({ ...draftFilters, status: event.target.value })
              }
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(caseStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Mã nhân viên được giao">
            <Input
              aria-label="Mã nhân viên được giao"
              value={draftFilters.assignee}
              onChange={(event) =>
                setDraftFilters({
                  ...draftFilters,
                  assignee: event.target.value,
                })
              }
              placeholder="UUID nhân viên"
            />
          </FormField>
          {filterError && (
            <div className="md:col-span-3">
              <ErrorAlert message={filterError} />
            </div>
          )}
          <div className="flex gap-3 md:col-span-3">
            <Button type="submit">Áp dụng bộ lọc</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const empty = { type: "", status: "", assignee: "" };
                setDraftFilters(empty);
                setFilters(empty);
                setFilterError("");
                setError(undefined);
                setListLoading(true);
                setPage(1);
              }}
            >
              Đặt lại
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <SurfaceCard padding="sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Danh sách hồ sơ</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {total}
            </span>
          </div>
          <div className="mt-4 space-y-2.5">
            {listLoading && <LoadingState message="Đang tải hồ sơ..." />}
            {!listLoading && !items.length && !error && (
              <EmptyState
                title="Không có hồ sơ"
                description="Không có hồ sơ phù hợp với bộ lọc."
              />
            )}
            {!listLoading &&
              items.map((item) => {
                const selected = detail?.case.id === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    disabled={detailLoading || busy}
                    aria-pressed={selected}
                    onClick={() => void selectException(item.id)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-emerald-600 bg-emerald-50/70 shadow-sm"
                        : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold leading-5 text-slate-900">
                        {item.order.tripTitle}
                      </p>
                      <StatusBadge
                        status={
                          item.status === "OPEN" ||
                          item.status === "UNDER_REVIEW"
                            ? "PENDING"
                            : "COMPLETED"
                        }
                        customLabel={labelFor(caseStatusLabels, item.status)}
                      />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.order.customerName}
                    </p>
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      {item.unit?.assetCode ??
                        labelFor(exceptionLabels, item.type)}
                    </p>
                    {item.role ? (
                      <p
                        className={`mt-1 text-[11px] font-semibold ${item.role === "CUSTOMER_DISPUTE" ? "text-amber-700" : "text-slate-500"}`}
                      >
                        {item.role === "CUSTOMER_DISPUTE"
                          ? `Khách phản đối${item.relatedCaseId ? ` · quyết định ở hồ sơ ${shortCode(item.relatedCaseId)}` : ""}`
                          : `Quyết định ban đầu${item.relatedCaseId ? ` · khách phản đối ở hồ sơ ${shortCode(item.relatedCaseId)}` : ""}`}
                      </p>
                    ) : null}
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {!["OPEN", "UNDER_REVIEW"].includes(item.status)
                        ? "Lý do ban đầu: "
                        : ""}
                      {visibleReason(item.reason)}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Mã hồ sơ {shortCode(item.id)}
                    </p>
                  </button>
                );
              })}
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => {
              setListLoading(true);
              setError(undefined);
              setPage(nextPage);
            }}
            itemLabel="hồ sơ"
            disabled={listLoading || busy}
          />
        </SurfaceCard>

        <SurfaceCard>
          {detailLoading ? (
            <LoadingState message="Đang tải chi tiết hồ sơ..." />
          ) : !detail ? (
            <div className="py-16 text-center">
              <p className="text-base font-medium text-slate-700">
                Chọn một hồ sơ để xem chi tiết
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Thông tin chuyến đi và người thuê sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    {labelFor(exceptionLabels, detail.case.type)}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                    {detail.case.order.tripTitle}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Người thuê: {detail.case.order.customerName}
                    <span className="mx-2 text-slate-300">•</span>
                    Hồ sơ {shortCode(detail.case.id)}
                    {detail.case.unit?.assetCode ? (
                      <>
                        <span className="mx-2 text-slate-300">•</span>
                        <span className="font-medium text-slate-700">
                          Thiết bị: {detail.case.unit.assetCode}
                        </span>
                      </>
                    ) : null}
                    {depositAmount > 0 ? (
                      <>
                        <span className="mx-2 text-slate-300">•</span>
                        <span className="font-medium text-emerald-700">
                          Cọc của món: {formatMoney(depositAmount, "VND")}
                        </span>
                      </>
                    ) : null}
                  </p>
                  {detail.case.role ? (
                    <p className="mt-2 text-sm text-amber-800">
                      {detail.case.role === "CUSTOMER_DISPUTE"
                        ? "Hồ sơ này mở khi khách phản đối khoản trừ"
                        : "Khách đã phản đối quyết định này"}
                      {detail.case.relatedCaseId ? (
                        <>
                          {detail.case.role === "CUSTOMER_DISPUTE" ? " ở hồ sơ " : "; xem hồ sơ phản đối "}
                          <button
                            type="button"
                            className="font-semibold underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
                            disabled={detailLoading || busy}
                            onClick={() => void selectException(detail.case.relatedCaseId as string)}
                          >
                            {shortCode(detail.case.relatedCaseId)}
                          </button>
                        </>
                      ) : null}
                      .
                    </p>
                  ) : null}
                </div>
                <StatusBadge
                  status={caseOpen ? "PENDING" : "COMPLETED"}
                  customLabel={labelFor(caseStatusLabels, detail.case.status)}
                />
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {caseOpen ? "Nội dung cần xử lý" : "Lý do ghi nhận ban đầu"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {visibleReason(detail.case.reason)}
                </p>
              </div>

              {isRefundFailure && detail.refund ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-amber-950">
                        {refundPurposeLabel}
                      </p>
                      <p className="mt-1 text-xs text-amber-800/70">
                        Mã giao dịch {shortCode(detail.refund.id)}
                      </p>
                    </div>
                    <p className="text-xl font-semibold text-amber-950">
                      {formatMoney(
                        detail.refund.amount,
                        detail.refund.currency,
                      )}
                    </p>
                  </div>
                  {currentRefundInfo && (
                    <p className="mt-3 text-xs text-amber-900">
                      Cổng:{" "}
                      {currentRefundInfo.paymentGateway?.toUpperCase() ??
                        "Chưa xác định"}{" "}
                      · Môi trường:{" "}
                      {currentRefundInfo.providerEnvironment ?? "Chưa xác định"}{" "}
                      · Hình thức:{" "}
                      {currentRefundInfo.executionMode ===
                      "MANUAL_BANK_TRANSFER"
                        ? "Chuyển khoản thủ công"
                        : "Qua cổng thanh toán"}
                    </p>
                  )}
                  {currentRefundInfo?.confirmationSource ===
                    "SANDBOX_SIMULATION" && (
                    <p className="mt-2 rounded-lg bg-amber-100 p-3 text-xs font-semibold text-amber-900">
                      Kết quả hoàn tiền được mô phỏng trên sandbox, không xác
                      nhận tiền đã được chuyển.
                    </p>
                  )}
                  {!refundInfo && !refundInfoError && (
                    <p className="mt-3 text-xs text-slate-500">
                      Đang tải thông tin giao dịch...
                    </p>
                  )}
                  {refundInfoError && (
                    <ErrorAlert
                      className="mt-3"
                      message={`Không tải được thông tin khoản hoàn: ${refundInfoError}. Các thao tác tạm ẩn.`}
                      onRetry={() => {
                        setRefundInfoError(undefined);
                        setRefundInfoRevision((current) => current + 1);
                      }}
                    />
                  )}
                  {refundInfo && !currentRefundInfo && (
                    <ErrorAlert
                      className="mt-3"
                      message="Khoản hoàn không thuộc đơn thuê này; các thao tác tạm ẩn. Vui lòng kiểm tra dữ liệu."
                    />
                  )}
                  {currentRefundInfo &&
                    currentRefundInfo.status !== detail.refund.status && (
                      <ErrorAlert
                        className="mt-3"
                        message="Trạng thái khoản hoàn vừa thay đổi. Hãy làm mới dữ liệu trước khi xử lý."
                      />
                    )}
                  <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500">
                        Trạng thái hoàn tiền
                      </dt>
                      <dd className="mt-1 font-medium text-slate-800">
                        {detail.refund.status === "SUCCEEDED" &&
                        currentRefundInfo?.confirmationSource ===
                          "SANDBOX_SIMULATION"
                          ? "Đã mô phỏng hoàn tiền"
                          : labelFor(refundStatusLabels, detail.refund.status)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">
                        Trạng thái đối soát
                      </dt>
                      <dd className="mt-1 font-medium text-slate-800">
                        {labelFor(
                          reconcileStatusLabels,
                          detail.refund.reconcileStatus,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">
                        Lần kiểm tra gần nhất
                      </dt>
                      <dd className="mt-1 text-slate-700">
                        {formatDateTime(detail.refund.lastCheckedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">
                        Kết quả gần nhất
                      </dt>
                      <dd className="mt-1 text-slate-700">
                        {detail.refund.lastErrorCode
                          ? labelFor(errorLabels, detail.refund.lastErrorCode)
                          : "Chưa ghi nhận lỗi"}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 rounded-lg bg-white/70 p-3 text-xs leading-5 text-amber-900">
                    Đã thử đối soát {detail.refund.retryCount} lần.
                    {canReconcile
                      ? " Chỉ yêu cầu lại khi đã kiểm tra trạng thái trên cổng thanh toán; thao tác này không tự đánh dấu hoàn tiền thành công."
                      : ""}
                  </p>
                </div>
              ) : null}
              {isRefundFailure && !detail.refund && (
                <ErrorAlert
                  className="mt-5"
                  message="Không tìm thấy giao dịch hoàn tiền liên quan đến hồ sơ này. Vui lòng kiểm tra dữ liệu trước khi xử lý."
                />
              )}

              {detail.handoverReportedIssues &&
              (detail.handoverReportedIssues.unit.length ||
                detail.handoverReportedIssues.orderLevel.length) ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">
                    ⚠ Nhân viên giao đã ghi lỗi có sẵn khi giao đồ cho khách
                  </p>
                  {detail.handoverReportedIssues.unit.map((issue, index) => (
                    <p key={`unit-${index}`} className="mt-1">
                      • {issue.description}
                    </p>
                  ))}
                  {detail.handoverReportedIssues.orderLevel.map(
                    (issue, index) => (
                      <p key={`order-${index}`} className="mt-1">
                        • (Cả đơn) {issue.description}
                      </p>
                    ),
                  )}
                  <p className="mt-2 text-xs text-amber-800">
                    Lỗi có trước kỳ thuê: đối chiếu với kết quả kiểm định, không
                    trừ cọc cho lỗi này.
                    {detail.handoverReportedIssues.handedOverAt
                      ? ` Giao lúc ${formatDateTime(detail.handoverReportedIssues.handedOverAt)}.`
                      : ""}
                  </p>
                </div>
              ) : null}

              {isMissingUnitCase ||
              detail.assessment?.outcome === "LOST_CONFIRMED" ? (
                <div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold text-slate-800">
                    Thông tin thiết bị thiếu / thất lạc &amp; Tiền đặt cọc
                  </p>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">
                        Trạng thái thiết bị
                      </dt>
                      <dd className="mt-1 font-medium text-slate-800">
                        {detail.assessment
                          ? labelFor(outcomeLabels, detail.assessment.outcome)
                          : "Chưa nhận lại thiết bị"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">
                        Tiền cọc đang giữ của món
                      </dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {depositAmount > 0
                          ? formatMoney(depositAmount, "VND")
                          : "Chưa tải được mức cọc"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-red-50/70 p-3">
                      <dt className="text-xs text-red-700">
                        Mức trừ nếu Xác nhận thất lạc
                      </dt>
                      <dd className="mt-1 font-semibold text-red-700">
                        {approvedDeduction !== null
                          ? formatMoney(approvedDeduction, "VND")
                          : depositAmount > 0
                            ? `${formatMoney(depositAmount, "VND")} (100% cọc)`
                            : "100% tiền cọc của món"}
                      </dd>
                    </div>
                  </dl>
                  {caseOpen ? (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                      <p className="font-semibold">
                        Hướng dẫn xử lý thiết bị chưa hoàn trả
                      </p>
                      <p className="mt-1">
                        Bạn có thể bấm <strong>Xác nhận thất lạc</strong> để
                        khấu trừ 100% tiền cọc của thiết bị này và quyết toán
                        đơn ngay, hoặc chọn <strong>Miễn trừ cọc</strong> để ghi
                        nhận mất thiết bị nhưng hoàn lại toàn bộ cọc cho khách.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : detail.assessment ? (
                <div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold text-slate-800">
                    Kết quả kiểm định kho &amp; Đề xuất khấu trừ
                  </p>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">
                        Kết quả kiểm định
                      </dt>
                      <dd className="mt-1 font-medium text-slate-800">
                        {labelFor(outcomeLabels, detail.assessment.outcome)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">
                        Tiền cọc của món
                      </dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {depositAmount > 0
                          ? formatMoney(depositAmount, "VND")
                          : "—"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-amber-50/70 p-3">
                      <dt className="text-xs text-amber-800">
                        {approvedDeduction !== null
                          ? "Mức khấu trừ đã duyệt"
                          : "Mức đề xuất khấu trừ (tối đa)"}
                      </dt>
                      <dd className="mt-1 font-semibold text-amber-950">
                        {formatMoney(
                          approvedDeduction !== null
                            ? approvedDeduction
                            : proposedDeduction > 0
                              ? proposedDeduction
                              : rawFindingsTotal,
                          "VND",
                        )}
                      </dd>
                    </div>
                  </dl>
                  {detail.assessment.findings.length > 0 ? (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                      <p className="font-medium text-slate-800">
                        Chi tiết hạng mục hư hỏng từ kho:
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {detail.assessment.findings.map((finding, idx) => (
                          <li key={`${finding.ruleId}-${idx}`}>
                            • Mức tính theo biểu phí:{" "}
                            {formatMoney(finding.amount, "VND")}
                            {finding.quantity > 1
                              ? ` × ${finding.quantity}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {detail.assessment.notes ? (
                    <p className="mt-2 text-xs text-slate-600">
                      Ghi chú kiểm định:{" "}
                      <span className="font-medium">
                        {detail.assessment.notes}
                      </span>
                    </p>
                  ) : null}
                  {caseOpen ? (
                    <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                      <strong>Cột mốc 48 giờ phản hồi:</strong> Sau khi Admin
                      bấm <em>Duyệt khấu trừ</em>, hệ thống sẽ công bố chứng cứ
                      cho khách. Đơn sẽ quyết toán ngay khi khách bấm{" "}
                      <em>Đồng ý khoản trừ</em> hoặc tự động quyết toán sau 48
                      giờ nếu khách không khiếu nại.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5 space-y-4 rounded-xl border border-slate-200 p-4">
                <div>
                  <h3 className="font-semibold">Chứng cứ hồ sơ</h3>
                  <div className="mt-2">
                    <EvidenceList key={detail.case.id} ids={detail.evidence} />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">
                    Phản hồi của khách ({detail.reviews.length})
                  </h3>
                  {detail.reviews.length ? (
                    detail.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"
                      >
                        <p>{review.reason}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(review.createdAt)}
                        </p>
                        <div className="mt-2">
                          <EvidenceList ids={review.evidenceIds} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      {detail.case.role === "ORIGINAL_DECISION"
                        ? "Phản đối của khách nằm ở hồ sơ phản đối (liên kết phía trên)."
                        : "Chưa có phản hồi."}
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">Lịch sử xử lý</h3>
                  {detail.case.resolution && (
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      Quyết định: {formatResolution(detail.case.resolution)}
                    </p>
                  )}
                  {detail.history.length ? (
                    <ul className="mt-2 space-y-2">
                      {detail.history.map((entry, index) => (
                        <li
                          key={`${entry.createdAt}-${index}`}
                          className="text-xs text-slate-600"
                        >
                          {formatDateTime(entry.createdAt)} ·{" "}
                          {auditActionLabels[entry.action] ?? entry.action} ·
                          {entry.userId
                            ? `Người thực hiện ${shortCode(entry.userId)}`
                            : "Hệ thống"}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      Chưa có lịch sử.
                    </p>
                  )}
                </div>
              </div>

              {detail.case.status === "RESOLVED" &&
              detail.case.approvalRef &&
              detail.assessment ? (
                ["SETTLED", "REFUND_PENDING"].includes(
                  detail.deduction?.status ?? "",
                ) || settledCaseIds.includes(detail.case.id) ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
                    {detail.deduction?.status === "REFUND_PENDING"
                      ? `✓ Đã chốt quyết toán cọc · Đang chờ hoàn trả ${formatMoney(detail.deduction.refundAmount ?? 0, "VND")} cho khách.`
                      : `✓ Đã hoàn tất quyết toán cọc${
                          approvedDeduction !== null && approvedDeduction > 0
                            ? ` · Đã khấu trừ ${formatMoney(approvedDeduction, "VND")}`
                            : ""
                        }.`}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <span>
                      Quyết định đã lưu nhưng khoản cọc đang chờ quyết toán (chờ
                      hết thời hạn phản hồi hoặc khách đồng ý khoản trừ).
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void retrySettlement()}
                    >
                      Thử quyết toán cọc
                    </Button>
                  </div>
                )
              ) : null}

              {((isRefundFailure &&
                (canReconcile || canSimulate || canRetryRefund)) ||
                (!isRefundFailure && caseOpen)) && (
                <label className="mt-5 block text-sm font-medium text-slate-700">
                  Ghi chú xử lý
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={
                      isRefundFailure
                        ? "Nhập ghi chú xử lý hoặc lý do hoàn tiền (tối thiểu 3 ký tự)..."
                        : "Nhập lý do cho quyết định (tối thiểu 3 ký tự)..."
                    }
                    className="mt-2 min-h-24 font-normal"
                  />
                </label>
              )}

              {isRefundFailure ? (
                <div className="mt-3 space-y-2">
                  {currentRefundInfo?.purpose === "RENTAL_CANCELLATION" && (
                    <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">
                      Khoản hoàn tiền do hủy đơn thuê thiết bị.
                    </p>
                  )}
                  {currentRefundInfo?.executionMode ===
                    "MANUAL_BANK_TRANSFER" && (
                    <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">
                      {currentRefundInfo.status === "SUCCEEDED"
                        ? "Đã ghi nhận xác nhận chuyển khoản thủ công."
                        : "Khoản tiền này áp dụng chuyển khoản ngân hàng trực tiếp. Vui lòng chuyển khoản cho khách và xác nhận tại quy trình hoàn tiền thủ công."}
                    </p>
                  )}
                  {canRetryRefund && (
                    <Button
                      variant="danger"
                      fullWidth
                      disabled={busy || reason.trim().length < 3}
                      onClick={() => void decide("RETRY_REFUND")}
                    >
                      {busy
                        ? "Đang gửi yêu cầu..."
                        : "Thực hiện hoàn tiền lại (gửi lệnh hoàn cọc mới)"}
                    </Button>
                  )}
                  {canReconcile && (
                    <Button
                      variant="outline"
                      fullWidth
                      disabled={busy || reason.trim().length < 1}
                      onClick={() => void reconcileRefund()}
                    >
                      {busy
                        ? "Đang gửi yêu cầu..."
                        : "Kiểm tra lại trạng thái giao dịch"}
                    </Button>
                  )}
                  {canSimulate && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                      <p>
                        Chỉ dành cho kiểm thử VNPay Sandbox. Mô phỏng không
                        chuyển tiền và không xác nhận tiền đã về tài khoản.
                        Backend sẽ kiểm tra điều kiện áp dụng.
                      </p>
                      <Button
                        className="mt-3"
                        variant="secondary"
                        fullWidth
                        disabled={busy || reason.trim().length < 5}
                        onClick={() => setShowSimulationConfirm(true)}
                      >
                        Mô phỏng hoàn tiền Sandbox
                      </Button>
                      <p className="mt-2">
                        Nhập lý do ít nhất 5 ký tự để mô phỏng.
                      </p>
                    </div>
                  )}
                </div>
              ) : !caseOpen ? null : isHandoverShortage ? (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-950">
                    Thiết bị thiếu trong kiện lúc giao, khách chưa từng nhận.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">
                    Khách đã được hoàn phí thuê và tiền cọc của món này ngay khi bàn giao. Hồ sơ chỉ để kho tìm lại thiết bị
                    (đang ở trạng thái bảo trì): tìm thấy thì hoàn tất bảo trì để đưa về kệ, không thấy thì ghi mất ở màn kho.
                    Đóng hồ sơ không ảnh hưởng tiền của khách.
                  </p>
                  <Button
                    disabled={
                      busy ||
                      reason.trim().length < 3 ||
                      !detail.allowedActions.includes("CLOSE_NO_ACTION")
                    }
                    onClick={() => void decide("CLOSE_NO_ACTION")}
                    className="mt-3"
                    fullWidth
                  >
                    Đóng hồ sơ thiếu khi giao
                  </Button>
                </div>
              ) : isCustodyIncident ? (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-950">
                    Sai lệch xảy ra sau khi Delivery đã nhận đồ từ khách.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">
                    Không được khấu trừ cọc của khách. Xác nhận sự việc sẽ
                    chuyển toàn bộ cọc của món này{" "}
                    {depositAmount > 0
                      ? `(${formatMoney(depositAmount, "VND")}) `
                      : ""}
                    sang chờ hoàn qua cổng thanh toán.
                  </p>
                  <Button
                    disabled={
                      busy ||
                      reason.trim().length < 3 ||
                      !detail.allowedActions.includes("CLOSE_NO_ACTION")
                    }
                    onClick={() => void decide("CLOSE_NO_ACTION")}
                    className="mt-3"
                    fullWidth
                  >
                    Xác nhận lỗi custody — hoàn đủ cọc cho khách
                  </Button>
                </div>
              ) : isMissingUnitCase ? (
                <div className="mt-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="danger"
                      disabled={
                        busy ||
                        reason.trim().length < 3 ||
                        isBeforeLostWindow ||
                        !detail.allowedActions.includes("CONFIRM_LOST")
                      }
                      onClick={() => void decide("CONFIRM_LOST")}
                    >
                      {depositAmount > 0
                        ? `Xác nhận thất lạc · Trừ 100% cọc (${formatMoney(depositAmount, "VND")})`
                        : "Xác nhận thất lạc · Trừ 100% cọc"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        busy ||
                        reason.trim().length < 3 ||
                        !detail.allowedActions.includes("CLOSE_NO_ACTION")
                      }
                      onClick={() => void decide("CLOSE_NO_ACTION")}
                    >
                      {depositAmount > 0
                        ? `Miễn trừ cọc · Hoàn đủ ${formatMoney(depositAmount, "VND")}`
                        : "Miễn trừ cọc · Hoàn đủ cọc cho khách"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {proposedDeduction > 0 &&
                  detail.allowedActions.includes("APPROVE_DEDUCTION") ? (
                    <div className="mt-3 rounded-xl border border-slate-200 p-4 text-sm">
                      <label className="block font-medium text-slate-700">
                        Mức khấu trừ duyệt (₫)
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={proposedDeduction}
                          step={1000}
                          value={deductionInput}
                          onChange={(event) =>
                            setDeductionInput(event.target.value)
                          }
                          placeholder={String(proposedDeduction)}
                          className="mt-2 font-normal"
                        />
                      </label>
                      <p
                        className={`mt-2 text-xs ${deductionInvalid ? "text-red-600" : "text-slate-500"}`}
                      >
                        {deductionInvalid
                          ? `Nhập số nguyên từ 1 đến ${formatMoney(proposedDeduction, "VND")}.`
                          : `Mức đề xuất từ kiểm định: ${formatMoney(proposedDeduction, "VND")} · Cọc của món: ${formatMoney(depositAmount, "VND")}. Chỉ được giảm, không được tăng; để trống là duyệt đúng mức đề xuất. Ghi rõ lý do giảm ở ô ghi chú.`}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Button
                      variant="danger"
                      disabled={
                        busy ||
                        reason.trim().length < 3 ||
                        deductionInvalid ||
                        !detail.allowedActions.includes("APPROVE_DEDUCTION")
                      }
                      onClick={() => void decide("APPROVE_DEDUCTION")}
                    >
                      {proposedDeduction > 0
                        ? `Duyệt khấu trừ ${formatMoney(deductionInvalid ? proposedDeduction : deductionAmount, "VND")}`
                        : "Duyệt đề xuất khấu trừ"}
                    </Button>
                    <Button
                      disabled={
                        busy ||
                        reason.trim().length < 3 ||
                        !detail.allowedActions.includes("REJECT_DEDUCTION")
                      }
                      onClick={() => void decide("REJECT_DEDUCTION")}
                    >
                      {depositAmount > 0
                        ? `Không khấu trừ · Hoàn đủ ${formatMoney(depositAmount, "VND")}`
                        : "Không khấu trừ và quyết toán"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        busy ||
                        reason.trim().length < 3 ||
                        !detail.allowedActions.includes("CLOSE_NO_ACTION")
                      }
                      onClick={() => void decide("CLOSE_NO_ACTION")}
                    >
                      Đóng không xử lý
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </SurfaceCard>
      </div>
      <ConfirmModal
        isOpen={showSimulationConfirm}
        onClose={() => setShowSimulationConfirm(false)}
        onConfirm={() => void confirmRefundSettlement()}
        title="Mô phỏng hoàn tiền Sandbox"
        description="Thao tác ghi kết quả giả lập cho dữ liệu kiểm thử. Không có tiền thật được chuyển và kết quả không chứng minh khách đã nhận tiền. Bạn có muốn tiếp tục?"
        confirmLabel="Xác nhận mô phỏng"
        loading={busy}
      />
    </PageShell>
  );
}
