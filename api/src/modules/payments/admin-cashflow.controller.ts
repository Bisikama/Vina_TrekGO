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
    description: `
- Tổng hợp dòng tiền vào (Inflow: \`PAYMENT SUCCEEDED\`), dòng tiền ra (Outflow: \`REFUND SUCCEEDED\`), và dòng tiền ròng (\`netCashflowAmount = totalInflowAmount - totalOutflowAmount\`).
- Phân tách chi tiết doanh thu dịch vụ (\`serviceRevenueAmount\`), tiền thuê đồ (\`rentalFeeInflowAmount\`, \`rentalExtensionInflowAmount\`), tiền đặt cọc thuê đồ (\`rentalDepositInflowAmount\`), hoàn cọc (\`depositOutflowAmount\`), tiền khấu trừ cọc giữ lại (\`retainedDepositDeductionAmount\`), và tiền cọc đang tạm giữ (\`activeDepositHeldAmount\`).
- Thống kê các khoản đang chờ xử lý (\`PENDING\` / \`PROCESSING\`), số lượng giao dịch cần đối soát (\`reconciliationRequiredCount\`), hàng đợi hoàn tiền thủ công PayOS (\`payosManualRefundPendingCount\`), và hàng đợi giả lập hoàn tiền VNPay Sandbox (\`vnpaySandboxPendingRefundCount\`).
- Bộ lọc cổng thanh toán (\`gateway\`):
  - \`BOTH\` hoặc \`ALL\` (mặc định): Lấy tổng hợp của **cả 2 cổng \`vnpay\` và \`payos\`** (loại bỏ hoàn toàn cổng giả lập \`mock\` và \`momo\`).
  - \`vnpay\`: Chỉ thống kê riêng cổng **VNPay**.
  - \`payos\`: Chỉ thống kê riêng cổng **PayOS**.
- Hỗ trợ lọc theo khoảng thời gian (\`from\`, \`to\`) và nguồn nghiệp vụ (\`source\`: \`BOOKING\`, \`RENTAL\`, \`TRAIL_ACCESS\`).
`,
  })
  @ApiQuery({
    name: 'gateway',
    required: false,
    enum: ['BOTH', 'ALL', 'vnpay', 'payos'],
    example: 'BOTH',
    description:
      'Lọc theo cổng thanh toán: BOTH/ALL (cả VNPay + PayOS, mặc định), vnpay (chỉ VNPay), hoặc payos (chỉ PayOS)',
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
    description: `
- Hiển thị lịch sử \`PAYMENT\` (Tiền thu vào - \`CASH_IN\`) và \`REFUND\` (Tiền hoàn ra - \`CASH_OUT\`) trên toàn hệ thống (\`BOOKING\`, \`RENTAL\`, \`TRAIL_ACCESS\`).
- Bộ lọc cổng thanh toán (\`gateway\`):
  - \`BOTH\` hoặc \`ALL\` (mặc định): Hiển thị **cả 2 cổng \`vnpay\` và \`payos\`** (loại bỏ hoàn toàn dữ liệu cổng \`mock\` và \`momo\`).
  - \`vnpay\`: Chỉ hiển thị giao dịch của cổng **VNPay**.
  - \`payos\`: Chỉ hiển thị giao dịch của cổng **PayOS**.
- Kèm theo bóc tách tài chính (\`breakdown\`): \`serviceFeeAmount\`, \`rentalFeeAmount\`, \`depositAmount\`, \`deductionAmount\`, \`isExtension\`, danh mục nghiệp vụ (\`category\`), mã đơn PayOS (\`payosOrderCode\`), trạng thái hoàn tiền thủ công (\`manualRefundStatus\`), và cờ cho phép giả lập hoàn tiền VNPay Sandbox (\`canSimulateSandbox\`).
- Sắp xếp theo \`createdAt DESC\`, tie-break bằng \`id DESC\`.
- Hỗ trợ tìm kiếm nhanh (\`search\`) theo mã hóa đơn (\`invoiceNo\`), mã giao dịch cổng (\`transactionRef\`), mã đơn PayOS (\`orderCode\`), tên hoặc email khách hàng.
`,
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
    enum: ['BOTH', 'ALL', 'vnpay', 'payos'],
    example: 'BOTH',
    description:
      'Lọc theo cổng thanh toán: BOTH/ALL (cả VNPay + PayOS, mặc định), vnpay (chỉ VNPay), hoặc payos (chỉ PayOS)',
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
    enum: ['PROVIDER_API', 'MANUAL_BANK_TRANSFER'],
    description: 'Lọc theo phương thức thực thi hoàn tiền (PROVIDER_API cho VNPay, MANUAL_BANK_TRANSFER cho PayOS)',
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
    description: `
- Trả về thông tin chi tiết của một \`Payment\` thuộc cổng \`vnpay\` hoặc \`payos\` kèm hóa đơn (\`invoiceNo\`, \`invoiceStatus\`), chủ hóa đơn (\`owner\`), bóc tách tiền dịch vụ / tiền thuê / tiền cọc (\`breakdown\`), phân bổ theo dòng đơn thuê (\`allocations\`), mã đơn PayOS (\`payosOrderCode\`), và danh sách các lệnh hoàn tiền (\`refunds\`) gắn với giao dịch đó.
- Dùng cho Drawer/Modal chi tiết giao dịch trên trang Quản trị dòng tiền trước khi Admin thực hiện đối soát (\`POST /api/v1/admin/payments/:id/reconcile\`).
`,
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
    description: `
- Trả về thông tin chi tiết của một lệnh hoàn tiền (\`Refund\`) thuộc cổng \`vnpay\` hoặc \`payos\`.
- Bao gồm bóc tách tài chính (\`breakdown\`: số tiền hoàn thực tế, tiền khấu trừ cọc giữ lại \`deductionAmount\` khi đồ thuê hư hỏng/trễ hạn), giao dịch gốc (\`sourcePayment\`), phân bổ hoàn tiền theo từng món đồ thuê (\`allocations\`).
- Đối với hoàn tiền **PayOS** (\`executionMode = MANUAL_BANK_TRANSFER\`): trả về đầy đủ thông tin tài khoản ngân hàng nhận tiền hoàn của khách, ảnh mã **VietQR tự động** (\`vietQrImageUrl\`) để Admin quét chuyển khoản, và ảnh biên lai chuyển khoản (\`evidenceMediaUrl\`).
- Đối với hoàn tiền **VNPay Sandbox** (\`executionMode = PROVIDER_API\`): trả về cờ \`canSimulateSandbox\` để UI hiển thị nút giả lập kết quả hoàn tiền (\`POST /api/v1/admin/refunds/:id/simulate-sandbox\`).
`,
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
