'use client';

import { EmptyState, SurfaceCard, SurfaceSectionHeader } from '@/components/ui';
import { formatCashflowMoney, gatewayLabels } from '../cashflow.utils';
import type { CashflowSummary } from '../types/admin-cashflow.types';

export function CashflowSummaryCards({ summary }: { summary: CashflowSummary }) {
  const { totals, currency } = summary;
  const cards = [
    { label: 'Tiền đã thu', value: formatCashflowMoney(totals.totalInflowAmount, currency), hint: `${totals.totalInflowCount} khoản thu`, color: 'text-[#166534]' },
    { label: 'Tiền đã hoàn', value: formatCashflowMoney(totals.totalOutflowAmount, currency), hint: `${totals.totalOutflowCount} khoản hoàn`, color: 'text-amber-800' },
    { label: 'Thu − hoàn', value: formatCashflowMoney(totals.netCashflowAmount, currency), hint: 'Tiền đã thu trừ tiền đã hoàn', color: Number(totals.netCashflowAmount) < 0 ? 'text-amber-800' : 'text-[#125238]' },
    { label: 'Tiền chờ thu', value: formatCashflowMoney(totals.pendingInflowAmount, currency), hint: `${totals.pendingInflowCount} giao dịch chưa hoàn tất`, color: 'text-[#1F2937]' },
    { label: 'Tiền chờ hoàn', value: formatCashflowMoney(totals.pendingOutflowAmount, currency), hint: `${totals.pendingOutflowCount} giao dịch chưa hoàn tất`, color: 'text-[#1F2937]' },
    { label: 'Cần kiểm tra', value: totals.reconciliationRequiredCount.toLocaleString('vi-VN'), hint: 'Giao dịch cần kiểm tra kết quả thanh toán', color: 'text-amber-800' },
  ];
  const max = Math.max(1, ...summary.byGateway.flatMap((bucket) => [Number(bucket.inflowAmount), Number(bucket.outflowAmount)]));
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => <SurfaceCard key={card.label} padding="sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{card.label}</p>
        <p className={`mt-3 break-words text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
        <p className="mt-2 text-xs text-[#6B7280]">{card.hint}</p>
      </SurfaceCard>)}
    </div>
    <SurfaceCard>
      <SurfaceSectionHeader title="Thu, hoàn tiền theo phương thức thanh toán" subtitle="Chỉ tính các khoản đã thu hoặc đã hoàn tiền thành công." />
      {summary.byGateway.length ? <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {summary.byGateway.map((bucket) => <div key={bucket.gateway} className="space-y-3 rounded-xl border border-[#E5E7EB] p-4">
          <h3 className="font-bold">{gatewayLabels[bucket.gateway] ?? bucket.gateway}</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Đã thu · {bucket.inflowCount} giao dịch</span><span className="font-semibold tabular-nums text-[#166534]">{formatCashflowMoney(bucket.inflowAmount, currency)}</span></div>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-emerald-50"><div className="h-full rounded-full bg-[#2F6B4F]" style={{ width: `${Math.max(0, Math.min(100, Number(bucket.inflowAmount) / max * 100))}%` }} /></div>
            <div className="flex justify-between gap-3"><span className="text-[#6B7280]">Đã hoàn · {bucket.outflowCount} giao dịch</span><span className="font-semibold tabular-nums text-amber-800">{formatCashflowMoney(bucket.outflowAmount, currency)}</span></div>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-amber-50"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(100, Number(bucket.outflowAmount) / max * 100))}%` }} /></div>
          </div>
          <div className="flex justify-between gap-3 border-t border-[#E5E7EB] pt-3 text-sm"><span className="text-[#6B7280]">Thu − hoàn</span><span className="font-bold tabular-nums">{formatCashflowMoney(bucket.netAmount, currency)}</span></div>
        </div>)}
      </div> : <EmptyState title="Chưa có khoản thu hoặc hoàn tiền thành công" description="Các khoản đang chờ thu hoặc chờ hoàn chưa được tính vào đây." className="mt-4" />}
    </SurfaceCard>
  </>;
}
