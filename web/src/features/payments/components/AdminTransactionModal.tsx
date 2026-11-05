'use client';

import useSWR from 'swr';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button, EmptyState, ErrorAlert, InfoBanner, LoadingState, Modal, StatusBadge } from '@/components/ui';
import { cashflowErrorMessage, getAdminTransactionDetail } from '../services/admin-cashflow.api';
import { confirmationLabels, formatCashflowDate, formatCashflowMoney, gatewayLabels, manualRefundLabels, purposeLabels, reconcileLabels, sourceLabels } from '../cashflow.utils';
import type { AdminPaymentDetail, AdminRefundDetail, AdminTransaction } from '../types/admin-cashflow.types';
import { PaymentStatusBadge } from './CashflowBadges';
import { isSimulatedRefund } from '@/features/bookings/refund.utils';

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-[#6B7280]">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{children ?? '—'}</dd></div>;
}

function PaymentFields({ detail }: { detail: AdminPaymentDetail }) {
  const applicationLabels: Record<string, string> = { APPLIED: 'Đã áp dụng vào đơn', PENDING: 'Đang áp dụng', REJECTED: 'Không áp dụng được vào đơn' };
  return <>
    {detail.status === 'SUCCEEDED' && detail.applicationStatus === 'REJECTED' && <InfoBanner tone="warning" title="Đã nhận tiền, đơn chưa được xác nhận">Giao dịch thu thành công nhưng chưa áp dụng được vào đơn. Cần kiểm tra trạng thái xử lý riêng.</InfoBanner>}
    <dl className="grid gap-4 sm:grid-cols-2">
      <DetailField label="Mã giao dịch cổng">{detail.transactionRef}</DetailField>
      <DetailField label="Thời điểm thu thành công">{formatCashflowDate(detail.paidAt)}</DetailField>
      <DetailField label="Áp dụng vào đơn">{detail.applicationStatus ? applicationLabels[detail.applicationStatus] ?? detail.applicationStatus : '—'}</DetailField>
      <DetailField label="Lần kiểm tra gần nhất">{formatCashflowDate(detail.lastCheckedAt)}</DetailField>
      <DetailField label="Số lần thử đối soát">{detail.retryCount}</DetailField>
      {detail.lastErrorCode && <DetailField label="Mã lỗi gần nhất">{detail.lastErrorCode}</DetailField>}
      {detail.applicationReasonCode && <DetailField label="Lý do chưa áp dụng">{detail.applicationReasonCode}</DetailField>}
    </dl>
    <section className="space-y-3 border-t border-[#E5E7EB] pt-4">
      <h3 className="font-bold">Các khoản hoàn từ giao dịch này ({detail.refunds.length})</h3>
      {detail.refunds.length ? detail.refunds.map((refund) => <div key={refund.refundId} className="space-y-2 rounded-xl border border-[#E5E7EB] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold tabular-nums">{formatCashflowMoney(refund.amount, refund.currency)}</span><PaymentStatusBadge status={refund.status} kind="REFUND" /></div>
        <p className="text-xs text-[#6B7280]">{purposeLabels[refund.purpose] ?? refund.purpose} · {formatCashflowDate(refund.createdAt)}</p>
        {refund.confirmationSource && <p className="text-xs">{confirmationLabels[refund.confirmationSource] ?? refund.confirmationSource}</p>}
        <p className="break-all font-mono text-[11px] text-[#6B7280]">{refund.refundId}</p>
      </div>) : <EmptyState title="Chưa có khoản hoàn" className="p-4" />}
    </section>
  </>;
}

function RefundFields({ detail }: { detail: AdminRefundDetail }) {
  const evidenceUrl = detail.manualRefund?.evidenceMediaUrl;
  const simulated = isSimulatedRefund(detail);
  return <>
    {detail.status !== 'SUCCEEDED' && <InfoBanner title="Khoản hoàn chưa hoàn tất">Lệnh hoàn đang chờ hoặc chưa thành công. Số tiền này chưa được tính là đã hoàn.</InfoBanner>}
    <dl className="grid gap-4 sm:grid-cols-2">
      <DetailField label="Mục đích hoàn">{purposeLabels[detail.purpose] ?? detail.purpose}</DetailField>
      <DetailField label="Hình thức hoàn">{simulated ? 'Hệ thống xử lý' : detail.executionMode === 'MANUAL_BANK_TRANSFER' ? 'Chuyển khoản thủ công' : 'Qua cổng thanh toán'}</DetailField>
      <DetailField label="Nguồn xác nhận">{detail.confirmationSource ? confirmationLabels[detail.confirmationSource] ?? detail.confirmationSource : 'Chưa có xác nhận'}</DetailField>
      <DetailField label="Thời điểm hoàn thành">{formatCashflowDate(detail.refundedAt)}</DetailField>
      <DetailField label="Mã giao dịch hoàn">{detail.refundTransactionRef}</DetailField>
      <DetailField label="Lý do">{detail.reason ?? detail.reasonCode}</DetailField>
      <DetailField label="Khoản thu gốc">{formatCashflowMoney(detail.sourcePayment.amount, detail.currency)}</DetailField>
      <DetailField label="Mã thu gốc">{detail.sourcePayment.transactionRef ?? detail.sourcePayment.paymentId}</DetailField>
    </dl>
    {detail.manualRefund && <section className="space-y-3 border-t border-[#E5E7EB] pt-4">
      <h3 className="font-bold">Thông tin hoàn thủ công</h3>
      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailField label="Tiến độ xử lý">{manualRefundLabels[detail.manualRefund.manualStatus] ?? detail.manualRefund.manualStatus}</DetailField>
        <DetailField label="Chủ tài khoản nhận">{detail.manualRefund.recipient?.accountHolderName}</DetailField>
        <DetailField label="Tài khoản nhận">{detail.manualRefund.recipient?.accountNumber ? `•••• ${detail.manualRefund.recipient.accountNumber.slice(-4)}` : 'Chưa khai báo'}</DetailField>
        <DetailField label="Mã chuyển khoản">{detail.manualRefund.bankTransactionRef}</DetailField>
        <DetailField label="Thời điểm chuyển">{formatCashflowDate(detail.manualRefund.transferredAt)}</DetailField>
        <DetailField label="Ghi chú">{detail.manualRefund.note}</DetailField>
      </dl>
      {evidenceUrl?.startsWith('https://') && <a href={evidenceUrl} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-[#2F6B4F] underline">Xem biên lai chuyển khoản ↗</a>}
    </section>}
  </>;
}

export function AdminTransactionModal({ transaction, userId, onClose }: { transaction: AdminTransaction; userId: string; onClose: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { data: result, error, isLoading, mutate } = useSWR(['admin-transaction-detail', userId, transaction.kind, transaction.id], () => getAdminTransactionDetail(transaction), { revalidateOnFocus: false, keepPreviousData: false });
  const detail = result?.data;

  useEffect(() => {
    const dialog = contentRef.current?.closest('[role="dialog"]');
    const previousFocus = document.activeElement;
    const getControls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])') ?? []);
    getControls()[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = getControls();
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return <Modal isOpen onClose={onClose} title={transaction.kind === 'PAYMENT' ? 'Chi tiết thu tiền' : 'Chi tiết hoàn tiền'} subtitle={transaction.invoiceNo ?? transaction.id} maxWidth="lg" footer={<Button variant="secondary" onClick={onClose}>Đóng chi tiết</Button>}>
    <div ref={contentRef} className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
      {isLoading && <LoadingState message="Đang tải chi tiết giao dịch..." />}
      {error && <ErrorAlert message={cashflowErrorMessage(error)} onRetry={() => void mutate()} />}
      {detail && !error && <>
        <div className="flex flex-wrap items-center gap-2"><PaymentStatusBadge status={detail.status} kind={transaction.kind} />{detail.reconciliationRequired && <StatusBadge status="PENDING" customLabel="Cần theo dõi đối soát" />}</div>
        <div className="rounded-xl bg-[#F7F7F4] p-4"><p className="text-xs text-[#6B7280]">Số tiền giao dịch</p><p className="mt-1 text-3xl font-bold tabular-nums text-[#125238]">{formatCashflowMoney(detail.amount, detail.currency)}</p></div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Khách hàng">{detail.owner.fullName ?? 'Chưa có tên'}</DetailField>
          <DetailField label="Email">{detail.owner.email}</DetailField>
          <DetailField label="Hóa đơn">{detail.invoiceNo ?? detail.invoiceId}</DetailField>
          <DetailField label="Nguồn">{sourceLabels[detail.source] ?? detail.source}</DetailField>
          <DetailField label="Cổng thanh toán">{gatewayLabels[detail.paymentGateway] ?? detail.paymentGateway}</DetailField>
          <DetailField label="Ngày tạo">{formatCashflowDate(detail.createdAt)}</DetailField>
          <DetailField label="Đối soát">{reconcileLabels[detail.reconcileStatus] ?? detail.reconcileStatus}</DetailField>
          <DetailField label="Mã giao dịch">{result.kind === 'PAYMENT' ? detail.paymentId : result.data.refundId}</DetailField>
          {Number(detail.breakdown.deductionAmount) > 0 && <DetailField label="Khoản khấu trừ / giữ lại">{formatCashflowMoney(detail.breakdown.deductionAmount, detail.currency)}</DetailField>}
        </dl>
        {result.kind === 'PAYMENT' ? <PaymentFields detail={result.data} /> : <RefundFields detail={result.data} />}
      </>}
    </div>
  </Modal>;
}
