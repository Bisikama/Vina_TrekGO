import { Controller, Get, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { UserRole } from '../../shared/constants'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { Roles } from '../../shared/decorators/roles.decorator'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { ApiErrorResponse } from '../../shared/swagger/api-error-response.helper'
import { PaymentsPort } from './payments.port'
import { USER_TRANSACTIONS_RESPONSE_SCHEMA } from './payment-swagger.schemas'
import {
  UserTransactionsQuerySchema,
  type UserTransactionsQueryDto,
} from './dtos/user-transactions.dto'

@ApiTags('User transactions')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('user')
export class UserTransactionsController {
  constructor(private readonly payments: PaymentsPort) {}

  @Get('transactions')
  @Roles(UserRole.USER, UserRole.LEADER, UserRole.STAFF_INVENTORY, UserRole.STAFF_DELIVERY, UserRole.ADMIN)
  @ApiOperation({
    operationId: 'getUserTransactions',
    summary: 'Lịch sử giao dịch thanh toán & hoàn tiền của tài khoản',
    description: `
**Proposed Non-Breaking API Extension — Pending BA Contract Adoption**

- Cho phép USER xem toàn bộ lịch sử thanh toán (PAYMENT) và hoàn tiền (REFUND) trên toàn bộ hệ thống (Rental, Booking, Trail Access).
- Dữ liệu thuộc Shared Payment read model, đảm bảo chỉ hiển thị các giao dịch liên quan đến Invoice thuộc sở hữu của người dùng hiện tại (dựa vào JWT authenticated principal).
- Sắp xếp toàn bộ timeline theo createdAt DESC, tie-break bằng id DESC.
- Phân trang áp dụng trực tiếp trên tập dữ liệu tổng hợp.
- Phân loại rõ hiệu ứng tài chính: PAYMENT SUCCEEDED -> DEBIT, REFUND SUCCEEDED -> CREDIT, các trạng thái khác -> NONE.
- Hỗ trợ lọc theo:
  + source: RENTAL | BOOKING | TRAIL_ACCESS
  + kind: PAYMENT | REFUND
  + status: trạng thái giao dịch
  + from, to: khoảng thời gian ISO-8601
- Bảo mật: Tuyệt đối không để lộ dữ liệu cổng thanh toán nhạy cảm, provider secrets, idempotencyKey hay raw gatewayPayload.
`,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Số trang (mặc định 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20, description: 'Số bản ghi mỗi trang (mặc định 20, tối đa 100)' })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['RENTAL', 'BOOKING', 'TRAIL_ACCESS'],
    description: 'Lọc theo nguồn nghiệp vụ',
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['PAYMENT', 'REFUND'],
    description: 'Lọc theo loại giao dịch (PAYMENT hoặc REFUND)',
  })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Lọc theo trạng thái thanh toán hoặc hoàn tiền' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2026-10-01T00:00:00.000Z', description: 'Từ thời điểm (ISO-8601)' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2026-10-31T23:59:59.999Z', description: 'Đến thời điểm (ISO-8601)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách giao dịch thanh toán và hoàn tiền của tài khoản',
    schema: USER_TRANSACTIONS_RESPONSE_SCHEMA,
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHENTICATED', 'Token không hợp lệ hoặc đã hết hạn')
  async getTransactions(
    @Query(new ZodValidationPipe(UserTransactionsQuerySchema)) query: UserTransactionsQueryDto,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.payments.getUserTransactions({
      actorUserId,
      query,
    })
  }
}
