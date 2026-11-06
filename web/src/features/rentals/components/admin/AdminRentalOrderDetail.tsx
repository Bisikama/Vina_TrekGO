"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Button,
  ErrorAlert,
  FormField,
  LoadingState,
  Modal,
  PageHeader,
  PageShell,
  Select,
  StatusBadge,
  SurfaceCard,
  SurfaceSectionHeader,
  Textarea,
} from "@/components/ui";
import {
  cancelRentalOrderSystemFault,
  getAdminRentalOrder,
  type AdminRentalOrderDetail as OrderDetail,
  type SystemFaultReasonCode,
} from "@/features/rentals/services/admin-rental.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import {
  ASSIGNMENT_STATUS_LABELS,
  EXCEPTION_STATUS_LABELS,
  FINANCIAL_STATUS_LABELS,
  INSPECTION_OUTCOME_LABELS,
  PACKAGE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SETTLEMENT_STATUS_LABELS,
  TASK_TYPE_LABELS,
  UNIT_STATUS_LABELS,
  formatDateTime,
  formatMoney,
  label,
  orderCode,
  orderStatusBadge,
  taskStatusBadge,
} from "@/features/rentals/components/admin/admin-rental-labels";

// Chi tiết đơn thuê cho Admin (GET /admin/rental-orders/:orderId)
// và huỷ do lỗi TrekGo trước bàn giao (POST /admin/rental-orders/:orderId/system-fault-cancellation).

const DELIVERY_TYPE_TO_PUBLIC: Record<string, string> = { HANDOVER: "OUTBOUND", RETURN: "RETURN" };

const REASON_OPTIONS: Array<[SystemFaultReasonCode, string]> = [
  ["GRADE_DOWNGRADE_CAPACITY_SHORTAGE", "Hạ hạng thiết bị làm thiếu hàng đúng hạng"],
  ["SYSTEM_MISSING_EQUIPMENT", "Kho thiếu thiết bị"],
  ["SYSTEM_DAMAGED_EQUIPMENT", "Thiết bị của kho bị hư"],
  ["OTHER_SYSTEM_FAULT", "Lỗi khác từ phía TrekGo"],
];

const CANCELLABLE_STATUSES = new Set(["PAID", "PREPARING", "READY_FOR_HANDOVER"]);

function Row({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-[#6B7280]">{name}</dt>
      <dd className="text-right font-medium tabular-nums text-[#1F2937]">{value}</dd>
    </div>
  );
}

export function AdminRentalOrderDetail({ orderId }: { orderId: string }) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    getAdminRentalOrder(orderId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setDetail(value);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(getRentalApiErrorMessage(reason, "Không tải được chi tiết đơn thuê."));
      });
    return () => controller.abort();
  }, [orderId, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  if (!detail) {
    return (
      <PageShell maxWidth="xl" withTopOffset={false}>
        <PageHeader eyebrow="Quản trị · Đơn thuê" title={`Đơn ${orderCode(orderId)}`} backHref="/admin/rental-tasks" backLabel="Phân công việc" />
        {error ? <ErrorAlert message={error} onRetry={reload} /> : <LoadingState message="Đang tải chi tiết đơn..." />}
      </PageShell>
    );
  }

  const { order, packages, tasks, financialSummary: money } = detail;
  const status = orderStatusBadge(order.status);
  const canCancel = CANCELLABLE_STATUSES.has(order.status) && order.financialStatus === "PAID";

  return (
    <PageShell maxWidth="xl" withTopOffset={false}>
      <PageHeader
        eyebrow="Quản trị · Đơn thuê"
        title={`Đơn ${orderCode(order.id)}`}
        description={`Tạo lúc ${formatDateTime(order.createdAt)}`}
        badge={<StatusBadge status={status.status} customLabel={status.label} />}
        backHref="/admin/rental-tasks"
        backLabel="Phân công việc"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={reload}>
              Làm mới
            </Button>
            {canCancel ? (
              <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
                Huỷ do lỗi hệ thống
              </Button>
            ) : null}
          </div>
        }
      />

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      ) : null}
      {error ? <ErrorAlert message={error} onDismiss={() => setError(null)} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <SurfaceCard>
          <SurfaceSectionHeader title="Khách thuê" />
          <dl>
            <Row name="Họ tên" value={order.customer?.fullName || "—"} />
            <Row name="Email" value={order.customer?.email || "—"} />
            <Row name="Điện thoại" value={order.customer?.phone || "—"} />
          </dl>
        </SurfaceCard>
        <SurfaceCard>
          <SurfaceSectionHeader title="Thời gian" />
          <dl>
            <Row name="Bắt đầu thuê" value={formatDateTime(order.rentalStartAt)} />
            <Row name="Hạn trả" value={formatDateTime(order.rentalEndAt)} />
            <Row name="Thanh toán lúc" value={formatDateTime(order.paidAt)} />
            {order.cancelledAt ? <Row name="Huỷ lúc" value={formatDateTime(order.cancelledAt)} /> : null}
            {order.completedAt ? <Row name="Hoàn tất lúc" value={formatDateTime(order.completedAt)} /> : null}
          </dl>
        </SurfaceCard>
        <SurfaceCard>
          <SurfaceSectionHeader title="Tình trạng" />
          <dl>
            <Row name="Tài chính" value={label(FINANCIAL_STATUS_LABELS, order.financialStatus)} />
            <Row name="Ngoại lệ" value={label(EXCEPTION_STATUS_LABELS, order.exceptionStatus)} />
            <Row name="Điểm nhận" value={order.pickupPoint?.name || "—"} />
            <Row name="Điểm trả" value={order.returnPoint?.name || "—"} />
          </dl>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <SurfaceSectionHeader title="Thiết bị trong đơn" subtitle={`${order.lines.length} dòng`} />
        <div className="divide-y divide-[#E5E7EB]">
          {order.lines.map((line) => (
            <div key={line.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[#1F2937]">{line.product?.name ?? "Thiết bị"}</p>
                  <p className="text-xs text-[#6B7280]">
                    {line.product?.sku ? <span className="font-mono">{line.product.sku}</span> : null}
                    {line.product?.sku ? " · " : ""}Số lượng {line.quantity} · {formatMoney(line.dailyPriceSnapshot, order.currency)}/ngày
                  </p>
                </div>
                <div className="text-right text-xs text-[#6B7280] tabular-nums">
                  <p>
                    Phí thuê <span className="font-medium text-[#1F2937]">{formatMoney(line.lineRentalFee, order.currency)}</span>
                  </p>
                  <p>
                    Cọc <span className="font-medium text-[#1F2937]">{formatMoney(line.lineDeposit, order.currency)}</span>
                  </p>
                </div>
              </div>
              {line.assignedUnits.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {line.assignedUnits.map((unit) => (
                    <span
                      key={unit.assignmentId}
                      className="rounded-lg border border-[#E5E7EB] bg-[#F7F7F4] px-2 py-1 text-xs text-[#1F2937]"
                    >
                      <span className="font-mono">{unit.equipmentUnit?.assetCode ?? "—"}</span>
                      {" · "}
                      {label(ASSIGNMENT_STATUS_LABELS, unit.status)}
                      {unit.equipmentUnit ? ` · ${label(UNIT_STATUS_LABELS, unit.equipmentUnit.status)}` : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#6B7280]">Chưa gán thiết bị cụ thể.</p>
              )}
            </div>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard>
          <SurfaceSectionHeader title="Việc vận hành" />
          <div className="space-y-3 text-sm">
            {tasks.inventoryTask ? (
              <TaskRow
                name={TASK_TYPE_LABELS.WAREHOUSE}
                status={tasks.inventoryTask.status}
                time={`Hạn ${formatDateTime(tasks.inventoryTask.deadline)}`}
              />
            ) : null}
            {tasks.deliveryTasks.map((task) => (
              <TaskRow
                key={task.id}
                name={TASK_TYPE_LABELS[DELIVERY_TYPE_TO_PUBLIC[task.taskType] ?? task.taskType] ?? task.taskType}
                status={task.status}
                time={`Lịch ${formatDateTime(task.scheduledAt)}`}
              />
            ))}
            {tasks.handover ? (
              <p className="text-[#6B7280]">
                Bàn giao cho khách lúc <span className="font-medium text-[#1F2937]">{formatDateTime(tasks.handover.handedOverAt)}</span>
                {tasks.handover.recipientNotes ? ` · ${tasks.handover.recipientNotes}` : ""}
              </p>
            ) : null}
            {tasks.returnInspections.map((inspection) => (
              <p key={inspection.id} className="text-[#6B7280]">
                Kiểm tra {inspection.stage === "FINAL" ? "sau trả" : "sơ bộ"}:{" "}
                <span className="font-medium text-[#1F2937]">{label(INSPECTION_OUTCOME_LABELS, inspection.outcome)}</span> ·{" "}
                {formatDateTime(inspection.createdAt)}
              </p>
            ))}
            {!tasks.inventoryTask && tasks.deliveryTasks.length === 0 ? (
              <p className="text-[#6B7280]">Chưa có việc vận hành nào.</p>
            ) : null}
            {packages ? (
              <p className="border-t border-[#E5E7EB] pt-3 text-[#6B7280]">
                Kiện <span className="font-mono text-[#1F2937]">{packages.packageCode}</span> ·{" "}
                {label(PACKAGE_STATUS_LABELS, packages.status)} · {packages.items.length} thiết bị
              </p>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SurfaceSectionHeader title="Tài chính" />
          <dl>
            <Row name="Phí thuê" value={formatMoney(money.rentalFee, money.currency)} />
            <Row name="Tiền cọc" value={formatMoney(money.totalDeposit, money.currency)} />
            <Row name="Tổng thanh toán" value={formatMoney(money.totalAmount, money.currency)} />
          </dl>
          {money.invoices.length > 0 ? (
            <div className="mt-3 space-y-2 border-t border-[#E5E7EB] pt-3 text-sm">
              {money.invoices.map((invoice) => (
                <div key={invoice.id}>
                  <p className="text-[#1F2937]">
                    Hoá đơn <span className="font-mono">{invoice.invoiceNo}</span> · {label(PAYMENT_STATUS_LABELS, invoice.status)} ·{" "}
                    <span className="tabular-nums">{formatMoney(invoice.totalAmount, money.currency)}</span>
                  </p>
                  {invoice.payments.map((payment) => (
                    <p key={payment.id} className="text-xs text-[#6B7280]">
                      {payment.paymentGateway ?? "Cổng thanh toán"} · {label(PAYMENT_STATUS_LABELS, payment.status)} ·{" "}
                      {formatMoney(payment.amount, payment.currency)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
          {money.depositSettlement ? (
            <div className="mt-3 border-t border-[#E5E7EB] pt-3">
              <p className="mb-1 text-sm font-medium text-[#1F2937]">
                Quyết toán cọc · {label(SETTLEMENT_STATUS_LABELS, money.depositSettlement.status)}
              </p>
              <dl>
                <Row name="Khấu trừ" value={formatMoney(money.depositSettlement.totalDeduction, money.currency)} />
                <Row name="Hoàn lại" value={formatMoney(money.depositSettlement.refundAmount, money.currency)} />
              </dl>
            </div>
          ) : null}
          {money.refunds.length > 0 ? (
            <div className="mt-3 space-y-1 border-t border-[#E5E7EB] pt-3 text-sm text-[#6B7280]">
              {money.refunds.map((refund) => (
                <p key={refund.id}>
                  Hoàn tiền {formatMoney(refund.amount, refund.currency)} · {label(PAYMENT_STATUS_LABELS, refund.status)}
                </p>
              ))}
            </div>
          ) : null}
        </SurfaceCard>
      </div>

      {cancelOpen ? (
        <CancelDialog
          orderId={order.id}
          version={order.version}
          totalAmount={formatMoney(order.totalAmount, order.currency)}
          onClose={() => setCancelOpen(false)}
          onCancelled={() => {
            setCancelOpen(false);
            setNotice("Đã huỷ đơn do lỗi hệ thống. Khách được hoàn 100% và nhận thông báo huỷ.");
            reload();
          }}
        />
      ) : null}
    </PageShell>
  );
}

function TaskRow({ name, status, time }: { name: string; status: string; time: string }) {
  const badge = taskStatusBadge(status);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="font-medium text-[#1F2937]">{name}</p>
        <p className="text-xs text-[#6B7280] tabular-nums">{time}</p>
      </div>
      <StatusBadge status={badge.status} customLabel={badge.label} />
    </div>
  );
}

function CancelDialog({
  orderId,
  version,
  totalAmount,
  onClose,
  onCancelled,
}: {
  orderId: string;
  version: number;
  totalAmount: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reasonCode, setReasonCode] = useState<SystemFaultReasonCode>("SYSTEM_MISSING_EQUIPMENT");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteValid = note.trim().length >= 3;

  async function submit() {
    if (!noteValid) return;
    setSaving(true);
    setError(null);
    try {
      await cancelRentalOrderSystemFault({ orderId, reasonCode, note: note.trim(), expectedVersion: version });
      onCancelled();
    } catch (reason: unknown) {
      setError(getRentalApiErrorMessage(reason, "Chưa huỷ được đơn."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Huỷ đơn do lỗi hệ thống"
      subtitle={`Đơn ${orderCode(orderId)} · hoàn 100% (${totalAmount})`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Quay lại
          </Button>
          <Button variant="danger" onClick={() => void submit()} loading={saving} disabled={!noteValid}>
            Huỷ đơn và hoàn tiền
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[#6B7280]">
          Chỉ dùng khi TrekGo không giao được đơn đã thanh toán. Khách được hoàn toàn bộ phí thuê và tiền cọc về nguồn thanh toán gốc,
          thiết bị đang giữ được nhả lại. Nếu kiện đã giao cho nhân viên giao nhận, cần đưa về kho trước.
        </p>
        {error ? <ErrorAlert message={error} /> : null}
        <FormField label="Lý do" required>
          <Select value={reasonCode} onChange={(event) => setReasonCode(event.target.value as SystemFaultReasonCode)}>
            {REASON_OPTIONS.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Ghi chú" required hint="Ít nhất 3 ký tự, gửi kèm hồ sơ huỷ đơn." error={note.length > 0 && !noteValid ? "Ghi chú quá ngắn." : null}>
          <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Mô tả ngắn sự cố" />
        </FormField>
      </div>
    </Modal>
  );
}
