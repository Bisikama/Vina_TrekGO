export type TransactionSource = 'BOOKING' | 'TRAIL_ACCESS' | 'RENTAL';
export type CashflowSource = Exclude<TransactionSource, 'RENTAL'>;
export type AdminGateway = 'BOTH' | 'vnpay';
export type TransactionKind = 'PAYMENT' | 'REFUND';
export type TransactionStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type ReconcileStatus = 'IDLE' | 'SCHEDULED' | 'RUNNING' | 'NEEDS_REVIEW' | 'RESOLVED';

export interface CashflowQuery {
  source: CashflowSource;
  gateway: AdminGateway;
  from?: string;
  to?: string;
}

export interface TransactionsQuery extends CashflowQuery {
  page: number;
  pageSize: number;
  kind?: TransactionKind;
  status?: TransactionStatus;
  reconcileStatus?: ReconcileStatus;
  search?: string;
}

export interface CashflowFilters {
  source: CashflowSource;
  gateway: AdminGateway;
  fromDate: string;
  toDate: string;
  kind: TransactionKind | '';
  status: TransactionStatus | '';
  reconcileStatus: ReconcileStatus | '';
  search: string;
}

export interface CashflowSummary {
  currency: string;
  period: { from: string | null; to: string | null };
  totals: {
    totalInflowAmount: string;
    totalInflowCount: number;
    totalOutflowAmount: string;
    totalOutflowCount: number;
    netCashflowAmount: string;
    pendingInflowAmount: string;
    pendingInflowCount: number;
    pendingOutflowAmount: string;
    pendingOutflowCount: number;
    reconciliationRequiredCount: number;
  };
  bySource: Array<{ source: TransactionSource; inflowAmount: string; inflowCount: number; outflowAmount: string; outflowCount: number; netAmount: string }>;
  byGateway: Array<{ gateway: string; environment?: string; inflowAmount: string; inflowCount: number; outflowAmount: string; outflowCount: number; netAmount: string }>;
}

interface Owner { id: string; fullName: string | null; email: string }
interface Breakdown { serviceFeeAmount: string; rentalFeeAmount: string; depositAmount: string; deductionAmount: string; isExtension: boolean }

export interface AdminTransaction {
  settlementMode?: string | null;
  warnings?: string[];
  id: string;
  kind: TransactionKind;
  direction: 'CASH_IN' | 'CASH_OUT';
  category: string;
  source: TransactionSource;
  sourceId: string | null;
  paymentId: string;
  refundId: string | null;
  invoiceId: string;
  invoiceNo: string | null;
  user: Owner;
  amount: string;
  currency: string;
  breakdown: Breakdown;
  status: TransactionStatus;
  financialEffect: 'DEBIT' | 'CREDIT' | 'NONE';
  paymentGateway: string | null;
  providerEnvironment: string | null;
  paymentMethod: string | null;
  transactionRef: string | null;
  payosOrderCode: string | null;
  reconcileStatus: ReconcileStatus;
  reconciliationRequired: boolean;
  executionMode: string | null;
  confirmationSource: string | null;
  refundPurpose: string | null;
  manualRefundStatus: string | null;
  canSimulateSandbox: boolean;
  description: string;
  createdAt: string;
  completedAt: string | null;
}

export interface TransactionsResponse {
  items: AdminTransaction[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

interface TransactionDetail {
  paymentId: string;
  invoiceId: string;
  invoiceNo: string | null;
  source: TransactionSource;
  sourceId: string | null;
  owner: Owner;
  amount: string;
  currency: string;
  breakdown: Breakdown;
  status: TransactionStatus;
  paymentGateway: string;
  providerEnvironment: string | null;
  reconcileStatus: ReconcileStatus;
  reconciliationRequired: boolean;
  createdAt: string;
}

export interface AdminPaymentDetail extends TransactionDetail {
  invoiceStatus: string;
  paymentMethod: string | null;
  transactionRef: string | null;
  merchantRequestRef: string | null;
  payosOrderCode: string | null;
  payosPaymentLinkId: string | null;
  applicationStatus: string | null;
  applicationReasonCode: string | null;
  retryCount: number;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  paidAt: string | null;
  refunds: Array<{
    refundId: string;
    amount: string;
    currency: string;
    status: TransactionStatus;
    purpose: string;
    executionMode: string;
    settlementMode?: string | null;
    warnings?: string[];
    confirmationSource: string | null;
    refundTransactionRef: string | null;
    createdAt: string;
    refundedAt: string | null;
  }>;
}

export interface AdminRefundDetail extends TransactionDetail {
  settlementMode?: string | null;
  warnings?: string[];
  refundId: string;
  purpose: string;
  reason: string | null;
  reasonCode: string | null;
  executionMode: string;
  confirmationSource: string | null;
  refundTransactionRef: string | null;
  merchantRefundRef: string | null;
  refundedAt: string | null;
  sourcePayment: { paymentId: string; amount: string; status: string; paymentGateway: string; transactionRef: string | null; payosOrderCode: string | null; paidAt: string | null };
  manualRefund: {
    manualStatus: string;
    assignedAdminId: string | null;
    recipient: { bankBin: string | null; accountNumber: string | null; accountHolderName: string | null } | null;
    bankTransactionRef: string | null;
    transferredAt: string | null;
    evidenceMediaUrl: string | null;
    note: string | null;
  } | null;
}

export type AdminTransactionDetail = { kind: 'PAYMENT'; data: AdminPaymentDetail } | { kind: 'REFUND'; data: AdminRefundDetail };
