"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  ConfirmModal,
  ErrorAlert,
  LoadingState,
  EmptyState,
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

type ExceptionDecision =
  | "APPROVE_DEDUCTION"
  | "REJECT_DEDUCTION"
  | "CONFIRM_LOST"
  | "CLOSE_NO_ACTION";

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
  MISSING_PENDING_REVIEW: "Thiếu thiết bị · chờ xác minh",
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
  DEDUCTION_APPROVAL_REQUIRED:
    "Kiểm định ghi nhận hư hại · cần duyệt khoản trừ",
  DAMAGE_EXCEEDS_DEPOSIT_MANUAL_CASE: "Hư hại vượt mức cọc · cần xử lý riêng",
  ASSESSMENT_REQUIRED_FOR_FINAL_ISSUE: "Kiểm định cuối có lỗi · cần đánh giá",
};

function shortCode(value: string) {
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
  const value = reason.replace(/^\[refund:[0-9a-f-]{36}\]\s*/i, "");
  if (value.startsWith("DELIVERY_CUSTODY_DISCREPANCY")) {
    return value
      .replace(
        /^DELIVERY_CUSTODY_DISCREPANCY:(TRANSFER_OMISSION|WAREHOUSE_RECEIPT_SHORTAGE):?\s*/i,
        "",
      )
      .trim();
  }
  return errorLabels[value] ?? value.replace(/_/g, " ");
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

export function AdminRentalReturnExceptions() {
  const [items, setItems] = useState<RentalExceptionSummary[]>([]);
  const [detail, setDetail] = useState<RentalExceptionDetail>();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refundInfo, setRefundInfo] = useState<AdminRentalRefundInfo>();
  const [refundInfoError, setRefundInfoError] = useState(false);
  const [refundInfoRevision, setRefundInfoRevision] = useState(0);
  const [showSimulationConfirm, setShowSimulationConfirm] = useState(false);

  const load = useCallback(async () => {
    setError(undefined);
    setListLoading(true);
    try {
      const result = await listRentalExceptions();
      setItems(result.items);
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
  }, [detail]);

  useEffect(() => {
    let active = true;
    void listRentalExceptions()
      .then((result) => {
        if (active) setItems(result.items);
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
  }, []);

  const refundId =
    detail?.case.type === "REFUND_FAILURE" ? detail.refund?.id : undefined;
  useEffect(() => {
    if (!refundId) return;
    let active = true;
    void getAdminRentalRefundInfo(refundId)
      .then((result) => {
        if (active) {
          setRefundInfo(result);
          setRefundInfoError(false);
        }
      })
      .catch(() => {
        if (active) {
          setRefundInfo(undefined);
          setRefundInfoError(true);
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
    setRefundInfoError(false);
    setReason("");
    setDetailLoading(true);
    try {
      setDetail(await getRentalException(exceptionId));
    } catch (requestError) {
      setError(getStaffReturnErrorMessage(requestError));
    } finally {
      setDetailLoading(false);
    }
  }

  async function decide(decision: ExceptionDecision) {
    if (!detail || reason.trim().length < 3 || busy) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await resolveRentalException({
        exceptionId: detail.case.id,
        decision,
        reason: reason.trim(),
        assessmentVersion: detail.assessment?.version,
        expectedVersion: detail.case.version,
      });
      let settlementResult:
        | Awaited<ReturnType<typeof approveDepositSettlement>>
        | undefined;
      let settlementError: string | undefined;
      let settlementAssessment = detail.assessment;
      if (
        result.nextAction === "CREATE_DEPOSIT_SETTLEMENT" &&
        !settlementAssessment
      ) {
        settlementAssessment = (await getRentalException(detail.case.id))
          .assessment;
      }
      if (
        result.nextAction === "CREATE_DEPOSIT_SETTLEMENT" &&
        settlementAssessment &&
        decision !== "APPROVE_DEDUCTION" &&
        decision !== "CONFIRM_LOST"
      ) {
        try {
          settlementResult = await approveDepositSettlement({
            orderId: detail.case.orderId,
            assessmentId: settlementAssessment.id,
            approvalRef: result.approvalRef,
            version: settlementAssessment.version,
          });
        } catch (error) {
          settlementError = getStaffReturnErrorMessage(error);
        }
      }
      if (settlementResult?.refundRef) {
        setNotice(
          `Đã chốt quyết toán cọc. Khoản ${formatMoney(settlementResult.refundAmount, "VND")} đang được gửi sang cổng thanh toán; đây chưa phải trạng thái đã hoàn tiền.`,
        );
      } else if (settlementResult) {
        setNotice(
          "Đã chốt quyết toán cọc. Không phát sinh khoản phải hoàn qua cổng thanh toán.",
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
          "Đã lưu quyết định. Cần công bố chứng cứ và chờ thời hạn phản hồi trước khi quyết toán.",
        );
      } else if (result.nextAction === "CREATE_DEPOSIT_SETTLEMENT") {
        setNotice(
          "Đã lưu quyết định; chưa lấy được kết quả kiểm định để quyết toán. Hãy tải lại hồ sơ.",
        );
      } else {
        setNotice(
          "Đã lưu quyết định ngoại lệ. Không phát sinh bước quyết toán mới.",
        );
      }
      setReason("");
      setDetail(await getRentalException(detail.case.id));
      setRefundInfo(undefined);
      setRefundInfoRevision((current) => current + 1);
      setItems((await listRentalExceptions()).items);
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
      setNotice(
        result.refundAmount > 0
          ? "Đã yêu cầu quyết toán; theo dõi trạng thái hoàn tiền."
          : "Đã quyết toán khoản cọc.",
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
      !refundInfo.canSimulateSandbox ||
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
      setItems((await listRentalExceptions()).items);
    } catch (requestError) {
      setError(getStaffReturnErrorMessage(requestError));
    } finally {
      setShowSimulationConfirm(false);
      setBusy(false);
    }
  }

  const isRefundFailure = detail?.case.type === "REFUND_FAILURE";
  const currentRefundInfo =
    refundInfo?.refundId === detail?.refund?.id ? refundInfo : undefined;
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
    currentRefundInfo.paymentGateway !== "payos" &&
    ["PENDING", "PROCESSING"].includes(detail?.refund?.status ?? "");
  const canSimulate =
    process.env.NODE_ENV !== "production" &&
    !!currentRefundInfo &&
    ["DEPOSIT", "RENTAL_CANCELLATION"].includes(currentRefundInfo.purpose) &&
    currentRefundInfo.canSimulateSandbox &&
    ["PENDING", "PROCESSING"].includes(detail?.refund?.status ?? "");
  const isCustodyIncident =
    detail?.case.reason.startsWith("DELIVERY_CUSTODY_DISCREPANCY") ?? false;
  const caseOpen = detail
    ? ["OPEN", "UNDER_REVIEW"].includes(detail.case.status)
    : false;

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">
              Quản trị thuê thiết bị
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Ngoại lệ hoàn trả và quyết toán cọc
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Theo dõi kiểm định, khấu trừ và các giao dịch hoàn tiền cần xử lý.
            </p>
          </div>
          <Button
            type="button"
            disabled={listLoading || detailLoading || busy}
            onClick={() => void load()}
          >
            Làm mới dữ liệu
          </Button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Hồ sơ cần theo dõi</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {items.length}
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {listLoading && <LoadingState message="Đang tải hồ sơ..." />}
              {!listLoading && !items.length && !error && (
                <EmptyState
                  title="Không có hồ sơ"
                  description="Hiện không có hồ sơ để hiển thị."
                />
              )}
              {items.map((item) => {
                const selected = detail?.case.id === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    disabled={detailLoading || busy}
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
                      <span className="shrink-0 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-medium text-orange-700">
                        {labelFor(caseStatusLabels, item.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.order.customerName}
                    </p>
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      {item.unit?.assetCode ??
                        labelFor(exceptionLabels, item.type)}
                    </p>
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
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-800">
                    {labelFor(caseStatusLabels, detail.case.status)}
                  </span>
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
                        Cổng: {currentRefundInfo.paymentGateway.toUpperCase()} ·
                        Môi trường:{" "}
                        {currentRefundInfo.providerEnvironment ??
                          "Chưa xác định"}{" "}
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
                        Kết quả Hoàn Tiền.
                      </p>
                    )}
                    {!currentRefundInfo && !refundInfoError && (
                      <p className="mt-3 text-xs text-slate-500">
                        Đang tải thông tin giao dịch...
                      </p>
                    )}
                    {refundInfoError && (
                      <ErrorAlert
                        className="mt-3"
                        message="Không tải được loại giao dịch; các thao tác hoàn tiền tạm ẩn."
                        onRetry={() => {
                          setRefundInfoError(false);
                          setRefundInfoRevision((current) => current + 1);
                        }}
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
                            : labelFor(
                                refundStatusLabels,
                                detail.refund.status,
                              )}
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

                {detail.assessment ? (
                  <div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm">
                    <p className="font-medium text-slate-800">
                      Kết quả kiểm định
                    </p>
                    <p className="mt-2 text-slate-600">
                      {labelFor(outcomeLabels, detail.assessment.outcome)} · Mức
                      đề xuất{" "}
                      {detail.assessment.findings
                        .map((finding) => formatMoney(finding.amount, "VND"))
                        .join(" · ") || "0 ₫"}
                    </p>
                  </div>
                ) : null}

                {detail.case.status === "RESOLVED" &&
                detail.case.approvalRef &&
                detail.assessment ? (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void retrySettlement()}
                  >
                    Thử quyết toán cọc
                  </Button>
                ) : null}

                {((isRefundFailure && (canReconcile || canSimulate)) ||
                  (!isRefundFailure && caseOpen)) && (
                  <label className="mt-5 block text-sm font-medium text-slate-700">
                    Ghi chú xử lý
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={
                        isRefundFailure
                          ? "Nhập ghi chú xử lý hoặc lý do hoàn tiền..."
                          : "Nhập lý do cho quyết định"
                      }
                      className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white"
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
                ) : !caseOpen ? null : isCustodyIncident ? (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-950">
                      Sai lệch xảy ra sau khi Delivery đã nhận đồ từ khách.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-900">
                      Không được khấu trừ cọc của khách. Xác nhận sự việc sẽ
                      chuyển toàn bộ cọc của món này sang chờ hoàn qua cổng
                      thanh toán.
                    </p>
                    <button
                      disabled={busy || reason.trim().length < 3}
                      onClick={() => void decide("CLOSE_NO_ACTION")}
                      className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Xác nhận lỗi custody — hoàn đủ cọc cho khách
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      disabled={busy || reason.trim().length < 3}
                      onClick={() => void decide("APPROVE_DEDUCTION")}
                      className="rounded-xl bg-red-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Duyệt đề xuất khấu trừ
                    </button>
                    <button
                      disabled={busy || reason.trim().length < 3}
                      onClick={() => void decide("REJECT_DEDUCTION")}
                      className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Không khấu trừ và quyết toán
                    </button>
                    <button
                      disabled={busy || reason.trim().length < 3}
                      onClick={() => void decide("CONFIRM_LOST")}
                      className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Xác nhận thất lạc
                    </button>
                    <button
                      disabled={busy || reason.trim().length < 3}
                      onClick={() => void decide("CLOSE_NO_ACTION")}
                      className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-50"
                    >
                      Đóng không xử lý
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
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
    </main>
  );
}
