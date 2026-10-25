import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from 'src/shared/constants';
import { AuthType } from 'src/shared/constants/auth.constant';
import { ActiveUser } from 'src/shared/decorators/active-user.decorator';
import { Auth } from 'src/shared/decorators/auth.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { ApiErrorResponse, ApiErrorResponses } from 'src/shared/swagger/api-error-response.helper';
import { CreateRentalQuoteUseCase } from '../../application/use-cases/create-rental-quote.use-case';
import { GetRentalAvailabilityUseCase } from '../../application/use-cases/get-rental-availability.use-case';
import {
  RentalAvailabilityQuerySchema,
  RentalQuoteBodySchema,
  type RentalAvailabilityQueryDto,
  type RentalQuoteBodyDto,
} from '../dtos/ordering.dto';

@ApiTags('Rental Ordering')
@ApiBearerAuth('bearer')
@Controller('rentals')
export class RentalOperationController {
  constructor(
    private readonly getRentalAvailabilityUseCase: GetRentalAvailabilityUseCase,
    private readonly createRentalQuoteUseCase: CreateRentalQuoteUseCase,
  ) {}

  @Get('availability')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'Kiểm tra tồn kho thiết bị theo chuyến đi',
    description: `
**RB-API-102** — Kiểm tra số lượng thiết bị còn khả dụng theo Trip và khoảng thời gian thuê.

- Server tự tính \`occupiedWindow\` dựa trên thông tin chuyến đi, delivery (phương thức giao nhận) và RentalPolicy.
- \`availableCount\` là snapshot tham khảo tại thời điểm truy vấn; số lượng thực tế sẽ được recheck trong transaction khi tạo đơn.
- Không giới hạn số lượng theo participant hay nhóm.
`,
  })
  @ApiQuery({
    name: 'tripId',
    required: true,
    type: String,
    description: 'ID chuyến đi cần kiểm tra tồn kho',
    example: '550e8400-e29b-41d4-a716-446655440101',
  })
  @ApiQuery({
    name: 'productId',
    required: true,
    type: String,
    description: 'ID sản phẩm thiết bị cần kiểm tra',
    example: '550e8400-e29b-41d4-a716-446655440102',
  })
  @ApiQuery({
    name: 'requestedReturnAt',
    required: false,
    type: String,
    description: 'Thời gian yêu cầu trả thiết bị (ISO 8601 có timezone)',
    example: '2026-12-01T10:00:00+07:00',
  })
  @ApiQuery({
    name: 'returnOptionId',
    required: false,
    type: String,
    description: 'Mã tuỳ chọn trả hàng (nếu có nhiều phương thức trả)',
    example: 'RETURN_AT_BASE',
  })
  @ApiResponse({ status: 200, description: 'Trả về thông tin tồn kho: số lượng khả dụng, khoảng thời gian thuê, giá tham khảo' })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(404, 'Không tìm thấy', 'RENTAL_PRODUCT_NOT_FOUND', 'Sản phẩm thiết bị không tồn tại hoặc không ở trạng thái ACTIVE')
  @ApiErrorResponse(422, 'Không đủ điều kiện', 'TRIP_MEMBERSHIP_NOT_ELIGIBLE', 'Chuyến đi không đủ điều kiện thuê thiết bị')
  async getAvailability(
    @Query(new ZodValidationPipe(RentalAvailabilityQuerySchema))
    query: RentalAvailabilityQueryDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.getRentalAvailabilityUseCase.execute({
      tripId: query.tripId,
      productId: query.productId,
      requestedReturnAt: query.requestedReturnAt ? new Date(query.requestedReturnAt) : undefined,
      returnOptionId: query.returnOptionId,
      userId,
    });
  }

  @Post('quote')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'Tạo báo giá thuê thiết bị (Quote) — Nhận payload từ Gear Advisor quote-intents',
    description: `
**RB-API-103** — Tạo báo giá (Quote) cho việc thuê thiết bị.

- Giá thuê, tiền cọc, số ngày tính phí (\`chargedDays\`) và đơn vị tiền tệ do server tính toán.
- Quote chỉ lưu snapshot giá/policy/context tại thời điểm tạo, **KHÔNG giữ số lượng** và **KHÔNG gán EquipmentUnit** cụ thể.
- Nếu request có sản phẩm trùng, server sẽ tự gộp số lượng.
- Quote có thời hạn hiệu lực (thường 15 phút); hết hạn thì không thể dùng để tạo đơn.

**KẾT NỐI VỚI GEAR ADVISOR & QUY TRÌNH TEST:**
- Payload của endpoint này (tripId và mảng items) có thể được lấy tự động từ Kế hoạch trang bị: Sau khi tạo phương án ở POST /api/v1/gear/plans/{id}/options, gọi POST /api/v1/gear/plans/{id}/quote-intents để nhận trường prefillRentalQuote và dán trực tiếp vào body endpoint này.
- Sau khi nhận kết quả chứa id của báo giá (quoteId), tiếp tục:
  1. Liên kết báo giá vào Kế hoạch trang bị: POST /api/v1/gear/plans/{id}/quote-links.
  2. Tạo đơn thuê chính thức: POST /api/v1/rental-orders với quoteId này và header Idempotency-Key.
`,
  })
  @ApiBody({
    description: 'Authorize bằng Bearer token. Lấy tripId từ chuyến đi đủ điều kiện và productId từ GET /api/v1/rental-products; chỉ gửi requestedReturnAt/returnOptionId khi đã chọn phương án trả hợp lệ.',
    schema: {
      type: 'object',
      required: ['tripId', 'items'],
      properties: {
        tripId: {
          type: 'string',
          format: 'uuid',
          description: 'ID chuyến đi',
          example: '550e8400-e29b-41d4-a716-446655440101',
        },
        recipientTripMemberId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          description: 'ID thành viên nhận thiết bị (mặc định là chính user)',
          example: '550e8400-e29b-41d4-a716-446655440103',
        },
        requestedReturnAt: {
          type: 'string',
          format: 'date-time',
          description: 'Thời gian yêu cầu trả thiết bị (ISO 8601)',
          example: '2026-12-01T10:00:00+07:00',
        },
        returnOptionId: {
          type: 'string',
          description: 'Mã tuỳ chọn trả hàng',
          example: 'RETURN_AT_BASE',
        },
        items: {
          type: 'array',
          minItems: 1,
          description: 'Danh sách thiết bị cần thuê (tối thiểu 1)',
          items: {
            type: 'object',
            required: ['productId', 'quantity'],
            properties: {
              productId: {
                type: 'string',
                format: 'uuid',
                description: 'ID sản phẩm thiết bị',
                example: '550e8400-e29b-41d4-a716-446655440102',
              },
              quantity: {
                type: 'integer',
                minimum: 1,
                description: 'Số lượng cần thuê',
                example: 2,
              },
            },
          },
        },
      },
      example: {
        tripId: '550e8400-e29b-41d4-a716-446655440101',
        items: [{ productId: '550e8400-e29b-41d4-a716-446655440102', quantity: 1 }],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Trả về báo giá chi tiết: tổng phí thuê, tiền cọc, số ngày, thời hạn hiệu lực' })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'items phải có ít nhất 1 sản phẩm')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponses(422, 'Không thể tạo báo giá', [
    { name: 'insufficientQuantity', summary: 'Không đủ tồn kho', code: 'INSUFFICIENT_AVAILABLE_QUANTITY', message: 'Số lượng yêu cầu vượt quá tồn kho khả dụng' },
    { name: 'cutoffPassed', summary: 'Quá hạn đặt thuê', code: 'RENTAL_CUTOFF_PASSED', message: 'Đã qua thời hạn cho phép đặt thuê thiết bị của chuyến đi' },
  ])
  async createQuote(
    @Body(new ZodValidationPipe(RentalQuoteBodySchema)) body: RentalQuoteBodyDto,
    @ActiveUser('id') userId: string,
  ) {
    return this.createRentalQuoteUseCase.execute({
      userId,
      tripId: body.tripId,
      recipientTripMemberId: body.recipientTripMemberId,
      items: body.items,
      requestedReturnAt: body.requestedReturnAt ? new Date(body.requestedReturnAt) : undefined,
      returnOptionId: body.returnOptionId,
    });
  }
}
