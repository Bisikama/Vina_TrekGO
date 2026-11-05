import { Controller, Get, Param, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { z } from 'zod'
import { UserRole } from '../../shared/constants'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { Roles } from '../../shared/decorators/roles.decorator'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { ApiErrorResponse } from '../../shared/swagger/api-error-response.helper'
import { PaymentsPort } from './payments.port'
import {
  ADMIN_CASHFLOW_SUMMARY_RESPONSE_SCHEMA,
  ADMIN_PAYMENT_DETAIL_RESPONSE_SCHEMA,
  ADMIN_REFUND_DETAIL_RESPONSE_SCHEMA,
  ADMIN_TRANSACTIONS_RESPONSE_SCHEMA,
} from './payment-swagger.schemas'
import {
  AdminCashflowSummaryQuerySchema,
  AdminTransactionsQuerySchema,
  type AdminCashflowSummaryQueryDto,
  type AdminTransactionsQueryDto,
} from './dtos/admin-cashflow.dto'

@ApiTags('Quản trị dòng tiền & giao dịch (Admin Cashflow & Transactions)')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminCashflowController {
  constructor(private readonly payments: PaymentsPort) {}

  @Get(['cashflow/summary', 'transactions/summary'])
  @ApiOperation({
    operationId: 'getAdminCashflowSummary',
    summary: 'Tổng quan dòng tiền & đối soát toàn hệ thống theo cổng VNPay / PayOS (Admin Cashflow Summary)',
    description: `Báo cáo demo: thu từ payment VNPay SANDBOX thành công; chi từ refund mô phỏng thành công. Khoản chờ không tính vào tổng đã hoàn tất. ALL/BOTH là alias của VNPay sandbox. Không phải số dư ngân hàng; không gồm PayOS, MoMo, production.`,
  })
  @ApiQuery({
    name: 'gateway',
    required: false,
    enum: ['BOTH', 'ALL', 'vnpay'],
    example: 'vnpay',
    description:
      'VNPay SANDBOX (mặc định); BOTH/ALL là alias. PayOS/MoMo không thuộc báo cáo.',
  })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['RENTAL', 'BOOKING', 'TRAIL_ACCESS'],
    description: 'Lọc theo nguồn nghiệp vụ (BOOKING, RENTAL, TRAIL_ACCESS)',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2026-10-01T00:00:00.000Z',
    description: 'Từ thời điểm (ISO-8601)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2026-10-31T23:59:59.999Z',
    description: 'Đến thời điểm (ISO-8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Số liệu tổng hợp dòng tiền hệ thống (VNPay / PayOS)',
    schema: ADMIN_CASHFLOW_SUMMARY_RESPONSE_SCHEMA,
  })
  @ApiErrorResponse(400, 'Dữ liệu lọc không hợp lệ', 'VALIDATION_ERROR')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHENTICATED')
  @ApiErrorResponse(403, 'Chỉ Admin mới có quyền truy cập', 'FORBIDDEN')
  async getCashflowSummary(
    @Query(new ZodValidationPipe(AdminCashflowSummaryQuerySchema)) query: AdminCashflowSummaryQueryDto,
  ) {
    return this.payments.getAdminCashflowSummary({ query })
  }

  @Get('transactions')
  @ApiOperation({
    operationId: 'getAdminTransactions',
    summary: 'Sổ cái giao dịch thanh toán & hoàn tiền toàn hệ thống (Admin Transaction Ledger)',
    description: `Danh sách dòng tiền VNPay SANDBOX và refund mô phỏng, cùng phạm vi với summary và phân trang. CASH_IN là payment, CASH_OUT là refund. Có chủ giao dịch, executionMode, confirmationSource, settlementMode và cảnh báo TEST_ONLY.`,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Số trang (mặc định 1)' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    example: 20,
    description: 'Số bản ghi mỗi trang (mặc định 20, tối đa 100)',
  })
  @ApiQuery({
    name: 'gateway',
    required: false,
    enum: ['BOTH', 'ALL', 'vnpay'],
    example: 'vnpay',
    description:
      'VNPay SANDBOX (mặc định); BOTH/ALL là alias. PayOS/MoMo không thuộc báo cáo.',
  })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['RENTAL', 'BOOKING', 'TRAIL_ACCESS'],
    description: 'Lọc theo mảng nghiệp vụ (RENTAL, BOOKING, TRAIL_ACCESS)',
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['PAYMENT', 'REFUND'],
    description: 'Lọc theo loại giao dịch (PAYMENT hoặc REFUND)',
  })
  @ApiQuery({
    name: 'direction',
    required: false,
    enum: ['CASH_IN', 'CASH_OUT'],
    description: 'Lọc theo chiều dòng tiền: CASH_IN (Tiền thu vào / PAYMENT) hoặc CASH_OUT (Tiền đi ra / REFUND)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: [
      'BOOKING_PAYMENT',
      'RENTAL_INITIAL',
      'RENTAL_EXTENSION',
      'TRAIL_PURCHASE',
      'DEPOSIT_REFUND',
      'BOOKING_CANCEL_REFUND',
      'RENTAL_CANCEL_REFUND',
      'TRAIL_REFUND',
      'TECHNICAL_REVERSAL',
    ],
    description: 'Lọc theo phân loại nghiệp vụ chi tiết (thuê mới, gia hạn, hoàn cọc, hoàn hủy tour...)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'],
    description: 'Lọc theo trạng thái giao dịch',
  })
  @ApiQuery({
    name: 'reconcileStatus',
    required: false,
    enum: ['IDLE', 'SCHEDULED', 'RUNNING', 'NEEDS_REVIEW', 'RESOLVED'],
    description: 'Lọc theo trạng thái đối soát',
  })
  @ApiQuery({
    name: 'executionMode',
    required: false,
    enum: ['SANDBOX_SIMULATED', 'PROVIDER_API', 'MANUAL_BANK_TRANSFER'],
    description: 'SANDBOX_SIMULATED cho booking mới; PROVIDER_API chỉ gồm dữ liệu cũ có dấu vết giả lập; MANUAL_BANK_TRANSFER trả rỗng.',
  })
  @ApiQuery({
    name: 'manualStatus',
    required: false,
    enum: ['PENDING_PROOF', 'CONFIRMED', 'FAILED', 'CANCELLED'],
    description: 'Lọc theo trạng thái giải ngân thủ công (dành cho hoàn tiền PayOS)',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Lọc theo UUID của khách hàng',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Tìm kiếm theo mã hóa đơn (invoiceNo), mã giao dịch (transactionRef), mã đơn PayOS (orderCode), tên hoặc email khách hàng',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2026-10-01T00:00:00.000Z',
    description: 'Từ thời điểm (ISO-8601)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2026-10-31T23:59:59.999Z',
    description: 'Đến thời điểm (ISO-8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách giao dịch thanh toán và hoàn tiền toàn hệ thống (VNPay / PayOS)',
    schema: ADMIN_TRANSACTIONS_RESPONSE_SCHEMA,
  })
  @ApiErrorResponse(400, 'Dữ liệu lọc không hợp lệ', 'VALIDATION_ERROR')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHENTICATED')
  @ApiErrorResponse(403, 'Chỉ Admin mới có quyền truy cập', 'FORBIDDEN')
  async getTransactions(
    @Query(new ZodValidationPipe(AdminTransactionsQuerySchema)) query: AdminTransactionsQueryDto,
  ) {
    return this.payments.getAdminTransactions({ query })
  }

  @Get(['payments/:id', 'transactions/payments/:id'])
  @ApiOperation({
    operationId: 'getAdminPaymentDetail',
    summary: 'Xem chi tiết giao dịch thanh toán & bóc tách phí/cọc (Admin Payment Detail)',
    description: `Chi tiết payment VNPay SANDBOX và refund mô phỏng liên quan. PayOS và payment production không thuộc báo cáo. Các trường payosOrderCode/payosPaymentLinkId là deprecated và trả null.`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID của giao dịch thanh toán (Payment ID)',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết giao dịch thanh toán dành cho Admin',
    schema: ADMIN_PAYMENT_DETAIL_RESPONSE_SCHEMA,
  })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHENTICATED')
  @ApiErrorResponse(403, 'Chỉ Admin mới có quyền truy cập', 'FORBIDDEN')
  @ApiErrorResponse(404, 'Không tìm thấy giao dịch thanh toán', 'PAYMENT_NOT_FOUND')
  async getPaymentDetail(@Param('id', new ZodValidationPipe(z.string().uuid())) paymentId: string) {
    return this.payments.getAdminPaymentDetail({ paymentId })
  }

  @Get(['refunds/:id', 'transactions/refunds/:id'])
  @ApiOperation({
    operationId: 'getAdminRefundDetail',
    summary: 'Xem chi tiết giao dịch hoàn tiền, khấu trừ cọc & VietQR PayOS (Admin Refund Detail)',
    description: `Chi tiết refund mô phỏng của payment VNPay SANDBOX. Booking tự hoàn khi hủy; API admin dùng kiểm thử/phục hồi: POST /api/v1/admin/payment-refunds/:refundId/sandbox-simulate-settlement. Không chứng minh tiền thật đã về tài khoản.`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID của giao dịch hoàn tiền (Refund ID)',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết giao dịch hoàn tiền dành cho Admin',
    schema: ADMIN_REFUND_DETAIL_RESPONSE_SCHEMA,
  })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHENTICATED')
  @ApiErrorResponse(403, 'Chỉ Admin mới có quyền truy cập', 'FORBIDDEN')
  @ApiErrorResponse(404, 'Không tìm thấy giao dịch hoàn tiền', 'PAYMENT_NOT_FOUND')
  async getRefundDetail(@Param('id', new ZodValidationPipe(z.string().uuid())) refundId: string) {
    return this.payments.getAdminRefundDetail({ refundId })
  }
}
