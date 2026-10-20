import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { UserRole } from 'src/shared/constants'
import { AuthType } from 'src/shared/constants/auth.constant'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_ORDERING_ERROR_CODES as RT } from 'src/shared/errors/codes/rental-ordering.error-codes'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper'
import { RENTAL_PAYMENT_STATUS_RESPONSE_SCHEMA } from '../../../../payments/payment-swagger.schemas'
import { CancelRentalOrderUseCase } from '../../application/use-cases/cancel-rental-order.use-case'
import { CreateRentalOrderUseCase } from '../../application/use-cases/create-rental-order.use-case'
import { GetRentalOrderUseCase } from '../../application/use-cases/get-rental-order.use-case'
import { GetRentalPaymentUseCase } from '../../application/use-cases/get-rental-payment.use-case'
import { ListRentalOrdersUseCase } from '../../application/use-cases/list-rental-orders.use-case'
import { PreviewRentalCancellationUseCase } from '../../application/use-cases/preview-rental-cancellation.use-case'
import {
  CancelRentalOrderBodySchema,
  CreateRentalOrderBodySchema,
  ListRentalOrdersQuerySchema,
  RentalIdempotencyKeySchema,
  RentalOrderIdParamSchema,
  type CancelRentalOrderBodyDto,
  type CreateRentalOrderBodyDto,
  type ListRentalOrdersQueryDto,
  type RentalOrderIdParamDto,
} from '../dtos/rental-order.dto'

@ApiTags('Rental Orders - Đơn thuê thiết bị')
@ApiBearerAuth('bearer')
@Controller('rental-orders')
export class RentalOrderController {
  constructor(
    private readonly createOrderUseCase: CreateRentalOrderUseCase,
    private readonly listOrdersUseCase: ListRentalOrdersUseCase,
    private readonly getOrderUseCase: GetRentalOrderUseCase,
    private readonly cancelOrderUseCase: CancelRentalOrderUseCase,
    private readonly getPaymentUseCase: GetRentalPaymentUseCase,
    private readonly previewCancellationUseCase: PreviewRentalCancellationUseCase,
  ) {}

  @Post()
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    operationId: 'createRentalOrder',
    summary: 'Tạo đơn thuê thiết bị',
    description: `
**RB-API-201** — Tạo RentalOrder từ báo giá (Quote) đã có.

- Giữ số lượng (quantity reservation) trong cùng một transaction.
- Yêu cầu header \`Idempotency-Key\` để tránh tạo đơn trùng lặp.
- Quote phải chưa hết hạn và thuộc về user hiện tại.
- Sau khi tạo thành công, đơn ở trạng thái **PENDING_PAYMENT**.
`,
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khoá duy nhất để đảm bảo không tạo đơn trùng (1–200 ký tự)',
    example: 'order-abc123-xyz',
  })
  @ApiBody({
    description: 'Trước tiên gọi POST /api/v1/rentals/quote, sau đó sao chép quoteId từ phản hồi còn hiệu lực vào đây. Thay UUID minh họa bằng ID thật.',
    schema: {
      type: 'object',
      required: ['quoteId'],
      properties: {
        quoteId: {
          type: 'string',
          format: 'uuid',
          description: 'ID của báo giá (Quote) đã tạo trước đó',
          example: '550e8400-e29b-41d4-a716-446655440101',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo đơn thành công — trả về đơn thuê kèm danh sách quantity reservation',
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'quoteId không đúng định dạng UUID')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(404, 'Không tìm thấy', 'QUOTE_NOT_FOUND', 'Báo giá không tồn tại hoặc đã hết hạn')
  @ApiErrorResponse(409, 'Trùng lặp', 'ORDER_ALREADY_EXISTS', 'Đơn thuê đã được tạo với Idempotency-Key này')
  @ApiErrorResponse(422, 'Không thể xử lý', 'INSUFFICIENT_AVAILABLE_QUANTITY', 'Số lượng thiết bị không đủ để đặt')
  async createOrder(
    @Body(new ZodValidationPipe(CreateRentalOrderBodySchema)) body: CreateRentalOrderBodyDto,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.createOrderUseCase.execute({
      userId,
      quoteId: body.quoteId,
      idempotencyKey: requireIdempotencyKey(rawKey),
    })
  }

  @Get()
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    operationId: 'listRentalOrders',
    summary: 'Danh sách đơn thuê của người dùng',
    description: `
**RB-API-202 / RB-API-501** — Lấy danh sách RentalOrder của user hiện tại.

- Hỗ trợ lọc theo \`tripId\`, \`bookingId\`, \`status\`.
- Phân trang qua \`page\` và \`pageSize\` (mặc định page=1, pageSize=20).
- Dùng chung cho cả luồng B2 (đặt đơn) và B5 (theo dõi đơn đang thuê).
`,
  })
  @ApiQuery({
    name: 'tripId',
    required: false,
    type: String,
    description: 'Lọc theo ID chuyến đi',
    example: '550e8400-e29b-41d4-a716-446655440101',
  })
  @ApiQuery({
    name: 'bookingId',
    required: false,
    type: String,
    description: 'Lọc theo ID booking',
    example: '550e8400-e29b-41d4-a716-446655440102',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Lọc theo trạng thái đơn (PENDING_PAYMENT, PAID, PREPARING, RENTING, RETURNED, CANCELLED)',
    example: 'PAID',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (mặc định: 1)', example: 1 })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Số đơn trên mỗi trang (tối đa 100, mặc định: 20)',
    example: 20,
  })
  @ApiResponse({ status: 200, description: 'Trả về danh sách đơn thuê kèm thông tin phân trang' })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  async listOrders(
    @Query(new ZodValidationPipe(ListRentalOrdersQuerySchema)) query: ListRentalOrdersQueryDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.listOrdersUseCase.execute({ userId, ...query })
  }

  @Get(':id')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER, UserRole.STAFF_INVENTORY, UserRole.STAFF_DELIVERY, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Chi tiết đơn thuê',
    description: `
**RB-API-203 / RB-API-502** — Xem chi tiết vòng đời của một RentalOrder.

- User chỉ xem được đơn của mình.
- Staff Inventory, Staff Delivery và Admin có thể xem mọi đơn.
- Trả về đầy đủ: thông tin đơn, danh sách sản phẩm, reservation, payment, invoice.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'ID đơn thuê',
    example: '550e8400-e29b-41d4-a716-446655440103',
  })
  @ApiResponse({ status: 200, description: 'Trả về chi tiết đầy đủ của đơn thuê' })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(403, 'Không có quyền', 'FORBIDDEN', 'Bạn không có quyền xem đơn thuê này')
  @ApiErrorResponse(404, 'Không tìm thấy', 'ORDER_NOT_FOUND', 'Đơn thuê không tồn tại')
  async getOrder(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') actorUserId: string,
    @ActiveUser('role') actorRole: string,
  ) {
    return this.getOrderUseCase.execute({ actorUserId, actorRole, orderId: params.id })
  }

  @Post(':id/cancel')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'Huỷ đơn thuê',
    description: `
**RB-API-205** — Huỷ RentalOrder trước khi bàn giao thiết bị (handover).

- Chỉ huỷ được đơn ở trạng thái cho phép (trước handover).
- Cần cung cấp lý do huỷ, phiên bản preview và expected version để tránh race condition.
- Sau khi huỷ, quantity reservation sẽ được giải phóng và tiền hoàn (nếu đã thanh toán) theo chính sách.
`,
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'ID đơn thuê cần huỷ' })
  @ApiBody({
    description: 'Gọi GET /api/v1/rental-orders/{id}/cancellation-preview ngay trước bước này, sao chép previewVersion từ phản hồi và expectedVersion từ chi tiết đơn. Giá trị minh họa không dùng được với đơn thật.',
    schema: {
      type: 'object',
      required: ['reason', 'previewVersion', 'expectedVersion'],
      properties: {
        reason: { type: 'string', description: 'Lý do huỷ đơn (1–500 ký tự)', example: 'Thay đổi kế hoạch chuyến đi' },
        previewVersion: { type: 'string', description: 'Sao chép nguyên giá trị previewVersion từ API xem trước hủy', example: 'v1-abc123' },
        expectedVersion: { type: 'integer', minimum: 1, description: 'Phiên bản đơn hiện tại (optimistic lock)', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Huỷ đơn thành công — trả về đơn đã cập nhật trạng thái CANCELLED' })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'reason không được để trống')
  @ApiErrorResponse(404, 'Không tìm thấy', 'ORDER_NOT_FOUND', 'Đơn thuê không tồn tại')
  @ApiErrorResponse(409, 'Xung đột phiên bản', 'VERSION_CONFLICT', 'Đơn đã bị thay đổi bởi thao tác khác')
  @ApiErrorResponse(422, 'Không thể huỷ', 'ORDER_NOT_CANCELLABLE', 'Đơn đã qua giai đoạn cho phép huỷ')
  async cancelOrder(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @Body(new ZodValidationPipe(CancelRentalOrderBodySchema)) body: CancelRentalOrderBodyDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.cancelOrderUseCase.execute({ userId, orderId: params.id, ...body })
  }

  @Get(':id/payment')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    operationId: 'getRentalOrderPaymentStatus',
    summary: 'Trạng thái thanh toán của đơn thuê',
    description: `
**RB-API-206** — Kiểm tra trạng thái thanh toán hiện tại của RentalOrder.

- Trả về trạng thái payment (PENDING, PROCESSING, SUCCEEDED, FAILED, CANCELLED, EXPIRED), invoice, application và reconciliation.
- Dùng để FE hiển thị trạng thái thanh toán và quyết định hiện nút "Thanh toán lại" hay không.
- Payment SUCCEEDED chỉ hoàn tất nghiệp vụ khi application APPLIED và RentalOrder đã PAID.
- Khi chưa tạo payment, API vẫn trả HTTP 200 với status = NOT_STARTED và nextAction.type = CREATE_PAYMENT.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'ID đơn thuê',
    example: '550e8400-e29b-41d4-a716-446655440021',
  })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái payment, invoice, application, reconciliation và RentalOrder',
    schema: RENTAL_PAYMENT_STATUS_RESPONSE_SCHEMA,
  })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(403, 'Không có quyền', 'FORBIDDEN', 'Đơn thuê không thuộc user hiện tại')
  @ApiErrorResponse(404, 'Không tìm thấy', 'RENTAL_ORDER_NOT_FOUND', 'Đơn thuê không tồn tại')
  async getPayment(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.getPaymentUseCase.execute({ userId, orderId: params.id })
  }

  @Get(':id/cancellation-preview')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'Xem trước chi phí hoàn tiền khi huỷ đơn',
    description: `
**RB-API-207** — Xem trước số tiền hoàn lại nếu huỷ đơn thuê.

- Hiển thị chi tiết: phí thuê, tiền cọc, phí huỷ, số tiền được hoàn.
- Kết quả có kèm \`previewVersion\` để dùng khi gọi API huỷ đơn thực tế.
- Chỉ dùng được cho đơn ở trạng thái cho phép huỷ.
`,
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'ID đơn thuê cần xem trước' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin chi tiết hoàn tiền dự kiến' })
  @ApiErrorResponse(404, 'Không tìm thấy', 'ORDER_NOT_FOUND', 'Đơn thuê không tồn tại')
  @ApiErrorResponse(422, 'Không thể xem trước', 'ORDER_NOT_CANCELLABLE', 'Đơn không ở trạng thái cho phép huỷ')
  async previewCancellation(
    @Param(new ZodValidationPipe(RentalOrderIdParamSchema)) params: RentalOrderIdParamDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.previewCancellationUseCase.execute({ userId, orderId: params.id })
  }
}

function requireIdempotencyKey(raw: string | undefined): string {
  const parsed = RentalIdempotencyKeySchema.safeParse(raw)
  if (!parsed.success) throw AppError.fromCode(RT.IDEMPOTENCY_KEY_REQUIRED)
  return parsed.data
}
