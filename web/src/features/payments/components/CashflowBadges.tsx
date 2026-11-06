'use client';

import { StatusBadge } from '@/components/ui';
import { transactionStatusLabel } from '../cashflow.utils';
import type { TransactionKind } from '../types/admin-cashflow.types';

export function PaymentStatusBadge({ status, kind }: { status: string; kind: TransactionKind }) {
  const toneStatus = status === 'SUCCEEDED' ? 'ACTIVE' : status === 'FAILED' ? 'CANCELLED' : status === 'PROCESSING' ? 'PENDING' : status;
  return <StatusBadge status={toneStatus} customLabel={transactionStatusLabel(status, kind)} />;
}
