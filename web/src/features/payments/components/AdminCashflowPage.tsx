'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/features/auth';
import { Button, EmptyState, ErrorAlert, FormField, InfoBanner, Input, LoadingState, PageHeader, PageShell, PaginationBar, Select, StatusBadge, SurfaceCard, SurfaceSectionHeader } from '@/components/ui';
import { buildCashflowQueries, confirmationLabels, DEFAULT_CASHFLOW_FILTERS, formatCashflowDate, formatCashflowMoney, gatewayLabels, paymentMethodLabel, reconcileLabels, sourceLabels, transactionMoneyEffect, transactionStatusLabel } from '../cashflow.utils';
import { cashflowErrorMessage, getAdminCashflowSummary, getAdminTransactions } from '../services/admin-cashflow.api';
import type { AdminTransaction, CashflowFilters, TransactionStatus } from '../types/admin-cashflow.types';
import { AdminTransactionModal } from './AdminTransactionModal';
import { CashflowSummaryCards } from './CashflowSummaryCards';
import { PaymentStatusBadge } from './CashflowBadges';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const statuses: TransactionStatus[] = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'];
const swrOptions = { revalidateOnFocus: false, keepPreviousData: false };

function TransactionAmount({ item }: { item: AdminTransaction }) {
  const effect = transactionMoneyEffect(item);
  return <div className="text-right">
    <p className={`whitespace-nowrap font-bold tabular-nums ${effect === 'inflow' ? 'text-[#166534]' : effect === 'outflow' ? 'text-amber-800' : 'text-[#6B7280]'}`}>
      {effect === 'inflow' ? '+' : effect === 'outflow' ? '−' : ''}{formatCashflowMoney(item.amount, item.currency)}
    </p>
    {effect === 'none' && <p className="mt-1 whitespace-nowrap text-[11px] text-[#6B7280]">Chưa phát sinh dòng tiền</p>}
  </div>;
}

function AdminCashflowView({ userId }: { userId: string }) {
  const [draft, setDraft] = useState<CashflowFilters>({ ...DEFAULT_CASHFLOW_FILTERS });
  const [filters, setFilters] = useState<CashflowFilters>({ ...DEFAULT_CASHFLOW_FILTERS });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterError, setFilterError] = useState('');
  const [selected, setSelected] = useState<AdminTransaction | null>(null);
  const queries = buildCashflowQueries(filters, page, pageSize);
  const summary = useSWR(['admin-cashflow-summary', userId, queries.summary], () => getAdminCashflowSummary(queries.summary), swrOptions);
  const ledger = useSWR(['admin-cashflow-transactions', userId, queries.transactions], () => getAdminTransactions(queries.transactions), swrOptions);
  const refreshing = summary.isValidating || ledger.isValidating;

  function updateDraft<Key extends keyof CashflowFilters>(key: Key, value: CashflowFilters[Key]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setFilterError('');
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      buildCashflowQueries(draft);
      setFilters({ ...draft, search: draft.search.trim() });
      setPage(1);
      setFilterError('');
    } catch (error) {
      setFilterError(cashflowErrorMessage(error));
    }
  }

  function resetFilters() {
    setDraft({ ...DEFAULT_CASHFLOW_FILTERS });
    setFilters({ ...DEFAULT_CASHFLOW_FILTERS });
    setPage(1);
    setFilterError('');
  }

  return <PageShell maxWidth="full" withTopOffset={false}>
    <PageHeader eyebrow="Quản trị · Booking & chuyến đi" title="Dòng tiền & giao dịch"
      description="Theo dõi khoản thu, khoản hoàn và trạng thái xử lý theo nguồn giao dịch."
      actions={<Button variant="outline" loading={refreshing} onClick={() => void Promise.allSettled([summary.mutate(), ledger.mutate()])}>Làm mới dữ liệu</Button>} />

    <SurfaceCard>
      <SurfaceSectionHeader title="Bộ lọc" subtitle="Tổng quan theo nguồn, cổng và ngày. Từ khóa, loại, trạng thái và đối soát chỉ lọc bảng giao dịch." />
      <form onSubmit={applyFilters} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="Nguồn giao dịch"><Select aria-label="Nguồn giao dịch" value={draft.source} onChange={(event) => updateDraft('source', event.target.value as CashflowFilters['source'])}>
            <option value="BOOKING">Đặt chỗ chuyến đi</option><option value="TRAIL_ACCESS">Mua quyền cung đường</option>
          </Select></FormField>
          <FormField label="Cổng thanh toán"><Select aria-label="Cổng thanh toán" value={draft.gateway} onChange={(event) => updateDraft('gateway', event.target.value as CashflowFilters['gateway'])}>
            <option value="vnpay">VNPay</option>
          </Select></FormField>
          <FormField label="Từ ngày tạo"><Input aria-label="Từ ngày tạo" type="date" value={draft.fromDate} max={draft.toDate || undefined} onChange={(event) => updateDraft('fromDate', event.target.value)} /></FormField>
          <FormField label="Đến ngày tạo"><Input aria-label="Đến ngày tạo" type="date" value={draft.toDate} min={draft.fromDate || undefined} onChange={(event) => updateDraft('toDate', event.target.value)} /></FormField>
          <FormField label="Tìm giao dịch"><Input aria-label="Tìm giao dịch" value={draft.search} maxLength={120} placeholder="Hóa đơn, mã giao dịch, tên, email..." onChange={(event) => updateDraft('search', event.target.value)} /></FormField>
          <FormField label="Loại giao dịch"><Select aria-label="Loại giao dịch" value={draft.kind} onChange={(event) => {
            const kind = event.target.value as CashflowFilters['kind'];
            setDraft((previous) => ({ ...previous, kind, status: kind === 'REFUND' && previous.status === 'EXPIRED' ? '' : previous.status }));
            setFilterError('');
          }}><option value="">Thu & hoàn tiền</option><option value="PAYMENT">Thu tiền</option><option value="REFUND">Hoàn tiền</option></Select></FormField>
          <FormField label="Trạng thái"><Select aria-label="Trạng thái giao dịch" value={draft.status} onChange={(event) => updateDraft('status', event.target.value as CashflowFilters['status'])}>
            <option value="">Tất cả trạng thái</option>{statuses.map((status) => <option key={status} value={status} disabled={draft.kind === 'REFUND' && status === 'EXPIRED'}>{status === 'SUCCEEDED' ? 'Thành công' : transactionStatusLabel(status, draft.kind || 'PAYMENT')}</option>)}
          </Select></FormField>
          <FormField label="Đối soát"><Select aria-label="Trạng thái đối soát" value={draft.reconcileStatus} onChange={(event) => updateDraft('reconcileStatus', event.target.value as CashflowFilters['reconcileStatus'])}>
            <option value="">Tất cả đối soát</option>{Object.entries(reconcileLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select></FormField>
        </div>
        {filterError && <ErrorAlert message={filterError} />}
        <div className="flex flex-wrap items-center gap-3"><Button type="submit">Áp dụng bộ lọc</Button><Button variant="ghost" onClick={resetFilters}>Đặt lại</Button><p className="text-xs text-[#6B7280]">Lọc theo ngày tạo giao dịch, giờ Việt Nam.</p></div>
      </form>
    </SurfaceCard>

    <InfoBanner title="Cách tính số liệu">
      Tổng thu và tổng hoàn chỉ tính các giao dịch thành công. Các khoản đang chờ được thống kê riêng.
    </InfoBanner>

    <section aria-label="Tổng quan dòng tiền" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{sourceLabels[filters.source]} · {gatewayLabels[filters.gateway]}</h2><p className="text-xs text-[#6B7280]">{filters.fromDate || 'Từ trước đến nay'} → {filters.toDate || 'Hiện tại'}</p></div>
      {summary.isLoading && <LoadingState message="Đang tải tổng quan dòng tiền..." />}
      {summary.error && <ErrorAlert message={cashflowErrorMessage(summary.error)} onRetry={() => void summary.mutate()} />}
      {summary.data && !summary.error && <CashflowSummaryCards summary={summary.data} />}
    </section>

    <SurfaceCard padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] p-5 sm:p-6">
        <div><h2 className="text-lg font-bold">Sổ giao dịch</h2><p className="mt-1 text-xs text-[#6B7280]">{ledger.data && !ledger.error ? `${ledger.data.pagination.total.toLocaleString('vi-VN')} giao dịch · ` : ''}Mới nhất trước</p></div>
        <div className="flex items-center gap-2 text-xs text-[#6B7280]"><span>Số dòng</span><Select aria-label="Số dòng mỗi trang" className="h-9 w-20" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</Select></div>
      </div>
      {ledger.isLoading && <LoadingState message="Đang tải giao dịch..." />}
      {ledger.error && <div className="p-5"><ErrorAlert message={cashflowErrorMessage(ledger.error)} onRetry={() => void ledger.mutate()} /></div>}
      {ledger.data && !ledger.error && !ledger.data.items.length && <EmptyState title="Không có giao dịch phù hợp" description="Thử thay đổi nguồn, khoảng ngày hoặc từ khóa tìm kiếm." className="m-5" />}
      {ledger.data && !ledger.error && ledger.data.items.length > 0 && <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <caption className="sr-only">Giao dịch thu và hoàn tiền theo bộ lọc đã áp dụng</caption>
          <thead className="bg-[#F7F7F4] text-[11px] uppercase tracking-wide text-[#6B7280]"><tr>{['Thời điểm tạo', 'Khách hàng', 'Giao dịch', 'Phương thức thanh toán', 'Số tiền', 'Trạng thái · Đối soát', 'Chi tiết'].map((label) => <th key={label} scope="col" className={`px-5 py-3 font-semibold ${label === 'Số tiền' ? 'text-right' : ''}`}>{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#E5E7EB]">{ledger.data.items.map((item) => <tr key={`${item.kind}:${item.id}`} className="align-top hover:bg-[#F7F7F4]/60">
            <td className="whitespace-nowrap px-5 py-4 text-xs text-[#6B7280]">{formatCashflowDate(item.createdAt)}</td>
            <td className="max-w-64 px-5 py-4"><p className="break-words font-semibold">{item.user.fullName?.trim() || 'Chưa có tên khách hàng'}</p><p className="mt-1 truncate text-xs text-[#6B7280]" title={item.user.email}>{item.user.email}</p></td>
            <td className="max-w-56 px-5 py-4"><StatusBadge status={item.kind === 'PAYMENT' ? 'OPEN' : 'PENDING'} customLabel={item.kind === 'PAYMENT' ? 'Thu tiền' : 'Khoản hoàn'} /><p className="mt-2 text-xs text-[#6B7280]">{item.description}</p>{item.confirmationSource && <p className="mt-1 text-[11px] text-[#6B7280]">{confirmationLabels[item.confirmationSource] ?? item.confirmationSource}</p>}</td>
            <td className="space-y-2 px-5 py-4"><p className="font-semibold">{gatewayLabels[item.paymentGateway ?? ''] ?? item.paymentGateway ?? '—'}</p><StatusBadge status="EXPIRED" customLabel={paymentMethodLabel(item)} showDot={false} /></td>
            <td className="px-5 py-4"><TransactionAmount item={item} /></td>
            <td className="space-y-2 px-5 py-4"><PaymentStatusBadge status={item.status} kind={item.kind} /><p className={`text-xs ${item.reconciliationRequired ? 'font-semibold text-amber-800' : 'text-[#6B7280]'}`}>{reconcileLabels[item.reconcileStatus] ?? item.reconcileStatus}</p></td>
            <td className="px-5 py-4"><Button size="sm" variant="outline" onClick={() => setSelected(item)} aria-label={`Xem chi tiết ${item.kind === 'PAYMENT' ? 'thu' : 'hoàn'} của ${item.user.fullName?.trim() || item.user.email}`}>Xem</Button></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {ledger.data && !ledger.error && <div className="px-5 pb-5"><PaginationBar page={ledger.data.pagination.page} pageSize={ledger.data.pagination.pageSize} total={ledger.data.pagination.total} onPageChange={setPage} itemLabel="giao dịch" disabled={ledger.isValidating} /></div>}
    </SurfaceCard>
    {selected && <AdminTransactionModal key={`${selected.kind}:${selected.id}`} transaction={selected} userId={userId} onClose={() => setSelected(null)} />}
  </PageShell>;
}

export function AdminCashflowPage() {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const { user, accessToken } = useAuth();
  if (!ready) return <PageShell withTopOffset={false}><LoadingState message="Đang kiểm tra phiên quản trị..." /></PageShell>;
  if (!accessToken || !user) return <PageShell withTopOffset={false}><ErrorAlert message="Vui lòng đăng nhập bằng tài khoản admin để xem dòng tiền." /><Link href="/public/login" className="mt-4 inline-block font-semibold text-[#2F6B4F]">Đăng nhập</Link></PageShell>;
  if (user.role !== 'ADMIN' || (user.status && user.status !== 'ACTIVE')) return <PageShell withTopOffset={false}><ErrorAlert message="Trang này dành cho tài khoản admin đang hoạt động." /></PageShell>;
  return <AdminCashflowView userId={user.id} />;
}
