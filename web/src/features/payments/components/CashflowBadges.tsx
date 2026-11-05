'use client';

import { StatusBadge } from '@/components/ui';
import { transactionStatusLabel } from '../cashflow.utils';
import type { TransactionKind } from '../types/admin-cashflow.types';

export function PaymentStatusBadge({ status, kind }: { status: string; kind: TransactionKind }) {
  const toneStatus = status === 'SUCCEEDED' ? 'ACTIVE' : status === 'FAILED' ? 'CANCELLED' : status === 'PROCESSING' ? 'PENDING' : status;
  return <StatusBadge status={toneStatus} customLabel={transactionStatusLabel(status, kind)} />;
}

export function PaymentEnvironmentBadge({ environment, confirmationSource }: { environment: string | null; confirmationSource?: string | null }) {
  if (confirmationSource === 'SANDBOX_SIMULATION') return <StatusBadge status="PENDING" customLabel="Mô phỏng Sandbox" />;
  if (environment === 'SANDBOX' || environment === 'MOCK') return <StatusBadge status="PENDING" customLabel="Sandbox · Thử nghiệm" />;
  if (environment === 'PRODUCTION') return <StatusBadge status="ACTIVE" customLabel="Production · Tiền thật" />;
  return <StatusBadge status="EXPIRED" customLabel="Chưa rõ môi trường" />;
}
