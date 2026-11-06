import axios from 'axios';
import { apiClient } from '@/lib/axios';
import type { AdminPaymentDetail, AdminRefundDetail, AdminTransaction, AdminTransactionDetail, CashflowQuery, CashflowSummary, TransactionsQuery, TransactionsResponse } from '../types/admin-cashflow.types';

const config = { baseURL: '' };

export async function getAdminCashflowSummary(params: CashflowQuery): Promise<CashflowSummary> {
  const { data } = await apiClient.get<CashflowSummary>('/api/v1/admin/cashflow/summary', { ...config, params });
  return data;
}

export async function getAdminTransactions(params: TransactionsQuery): Promise<TransactionsResponse> {
  const { data } = await apiClient.get<TransactionsResponse>('/api/v1/admin/transactions', { ...config, params });
  return data;
}

export async function getAdminTransactionDetail(item: AdminTransaction): Promise<AdminTransactionDetail> {
  if (item.kind === 'REFUND') {
    if (!item.refundId) throw new Error('Giao dịch thiếu mã hoàn tiền. Hãy tải lại danh sách.');
    const { data } = await apiClient.get<AdminRefundDetail>(`/api/v1/admin/refunds/${encodeURIComponent(item.refundId)}`, config);
    return { kind: 'REFUND', data };
  }
  const { data } = await apiClient.get<AdminPaymentDetail>(`/api/v1/admin/payments/${encodeURIComponent(item.paymentId)}`, config);
  return { kind: 'PAYMENT', data };
}

export function cashflowErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data?.error;
    if (body?.code === 'FORBIDDEN') return 'Tài khoản không có quyền xem dòng tiền. Vui lòng dùng tài khoản admin đang hoạt động.';
    if (body?.code === 'UNAUTHENTICATED') return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (typeof body?.message === 'string') return body.message;
    return 'Không tải được dữ liệu dòng tiền. Kiểm tra kết nối và thử lại.';
  }
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu. Vui lòng thử lại.';
}
