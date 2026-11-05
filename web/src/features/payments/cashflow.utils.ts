import type { AdminTransaction, CashflowFilters, CashflowQuery, TransactionKind, TransactionsQuery } from './types/admin-cashflow.types';

export const DEFAULT_CASHFLOW_FILTERS: CashflowFilters = {
  source: 'BOOKING', gateway: 'BOTH', fromDate: '', toDate: '', kind: '', status: '', reconcileStatus: '', search: '',
};

export const sourceLabels: Record<string, string> = { BOOKING: 'Đặt chỗ chuyến đi', TRAIL_ACCESS: 'Mua quyền cung đường', RENTAL: 'Thuê thiết bị' };
export const gatewayLabels: Record<string, string> = { vnpay: 'VNPay', payos: 'PayOS', BOTH: 'VNPay & PayOS' };
export const reconcileLabels: Record<string, string> = { IDLE: 'Chưa cần đối soát', SCHEDULED: 'Đã lên lịch', RUNNING: 'Đang đối soát', NEEDS_REVIEW: 'Cần kiểm tra', RESOLVED: 'Đã đối soát' };
export const manualRefundLabels: Record<string, string> = { AWAITING_RECIPIENT: 'Chờ tài khoản nhận', READY: 'Chờ admin xử lý', PROCESSING: 'Đang chuyển khoản', NEEDS_REVIEW: 'Cần kiểm tra', COMPLETED: 'Admin đã xác nhận chuyển' };
export const confirmationLabels: Record<string, string> = { PROVIDER: 'Cổng thanh toán xác nhận', ADMIN_MANUAL: 'Admin xác nhận chuyển khoản', SANDBOX_SIMULATION: 'Mô phỏng Sandbox' };
export const purposeLabels: Record<string, string> = { BOOKING_CANCELLATION: 'Hoàn do hủy đặt chỗ', TRAIL_ACCESS: 'Hoàn quyền cung đường', TECHNICAL_REVERSAL: 'Hoàn giao dịch kỹ thuật', DEPOSIT: 'Hoàn cọc', RENTAL_CANCELLATION: 'Hoàn do hủy thuê' };

export function paymentMethodLabel(item: Pick<AdminTransaction, 'kind' | 'paymentGateway' | 'paymentMethod' | 'executionMode'>): string {
  if (item.kind === 'REFUND' && item.executionMode === 'MANUAL_BANK_TRANSFER') return 'Chuyển khoản thủ công';
  if (item.kind === 'REFUND' && item.executionMode === 'PROVIDER_API') return 'Hoàn qua cổng thanh toán';
  if (item.paymentGateway?.toLowerCase() === 'payos') return 'Chuyển khoản VietQR';
  if (item.paymentMethod === 'QR') return 'Quét mã QR';
  if (item.paymentMethod === 'REDIRECT') return 'Thanh toán trực tuyến';
  return item.paymentMethod || 'Chưa có thông tin phương thức';
}

function dateBoundary(value: string, end: boolean): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Ngày lọc không hợp lệ.');
  const [year, month, day] = value.split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new Error('Ngày lọc không hợp lệ.');
  return new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}+07:00`).toISOString();
}

export function buildCashflowQueries(filters: CashflowFilters, page = 1, pageSize = 20): { summary: CashflowQuery; transactions: TransactionsQuery } {
  const from = dateBoundary(filters.fromDate, false);
  const to = dateBoundary(filters.toDate, true);
  if (from && to && from > to) throw new Error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  if (filters.kind === 'REFUND' && filters.status === 'EXPIRED') throw new Error('Giao dịch hoàn tiền không có trạng thái hết hạn.');
  const search = filters.search.trim();
  if (search.length > 120) throw new Error('Từ khóa tìm kiếm tối đa 120 ký tự.');
  const summary: CashflowQuery = { source: filters.source, gateway: filters.gateway, ...(from ? { from } : {}), ...(to ? { to } : {}) };
  return {
    summary,
    transactions: { ...summary, page, pageSize, ...(filters.kind ? { kind: filters.kind } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.reconcileStatus ? { reconcileStatus: filters.reconcileStatus } : {}), ...(search ? { search } : {}) },
  };
}

export function transactionMoneyEffect(item: Pick<AdminTransaction, 'status' | 'financialEffect'>): 'inflow' | 'outflow' | 'none' {
  if (item.status !== 'SUCCEEDED') return 'none';
  return item.financialEffect === 'DEBIT' ? 'inflow' : item.financialEffect === 'CREDIT' ? 'outflow' : 'none';
}

export function transactionStatusLabel(status: string, kind: TransactionKind): string {
  if (status === 'SUCCEEDED') return kind === 'PAYMENT' ? 'Đã thu' : 'Đã hoàn';
  return ({ PENDING: 'Đang chờ', PROCESSING: 'Đang xử lý', FAILED: 'Thất bại', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn' } as Record<string, string>)[status] ?? status;
}

export function formatCashflowMoney(value: string | number, currency = 'VND'): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(Number(value));
}

export function formatCashflowDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}
