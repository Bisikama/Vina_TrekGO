import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { AuthType } from 'src/shared/constants/auth.constant'
import { UserRole } from 'src/shared/constants'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { AppError } from 'src/shared/errors/app-error'
import { ApiErrorResponse } from 'src/shared/swagger/api-error-response.helper'
import { RentalExtensionService } from './rental-extension.service'

const Params = z.object({ id: z.string().uuid() })
const Quote = z
  .object({ requestedReturnAt: z.string().datetime({ offset: true }), returnOptionId: z.string().min(1) })
  .strict()
const Confirm = z
  .object({
    extensionQuoteId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    acceptedTermsVersion: z.string().min(1).max(40),
    termsHash: z.string().length(64).optional(),
  })
  .strict()
function key(value?: string) {
  if (!value?.trim()) throw AppError.fromCode('IDEMPOTENCY_KEY_REQUIRED')
  return value
}

@ApiTags('Rental Extensions - Gia hạn đơn thuê')
@ApiBearerAuth('bearer')
@Controller('rental-orders')
export class RentalExtensionController {
  constructor(private readonly service: RentalExtensionService) {}

  @Post(':id/extension-quotes')
  @HttpCode(HttpStatus.OK)
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'Tạo báo giá gia hạn thuê',
    description: `
Tạo báo giá cho việc gia hạn thời gian thuê thiết bị.

- Kiểm tra chính sách gia hạn (policy) và delivery (phương thức giao nhận).
- **Không giữ tồn kho** (capacity hold) tại bước này.
- Quote gia hạn có thời hạn hiệu lực; hết hạn cần tạo lại.
- Trả về phí gia hạn bổ sung, ngày trả mới và điều khoản áp dụng.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID đơn thuê cần gia hạn',
    example: 'c3d4e5f6-7890-12cd-ef01-345678901bcd',
  })
  @ApiBody({
    description: 'Thông tin yêu cầu gia hạn',
    schema: {
      type: 'object',
      required: ['requestedReturnAt', 'returnOptionId'],
      properties: {
        requestedReturnAt: {
          type: 'string',
          format: 'date-time',
          description: 'Thời gian trả thiết bị mới mong muốn (ISO 8601)',
          example: '2026-12-15T10:00:00+07:00',
        },
        returnOptionId: {
          type: 'string',
          description: 'Mã phương thức trả hàng',
          example: 'RETURN_AT_BASE',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Trả về báo giá gia hạn: phí bổ sung, ngày trả mới, thời hạn hiệu lực' })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'requestedReturnAt phải là datetime hợp lệ')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(403, 'Không có quyền', 'FORBIDDEN', 'Đơn thuê không thuộc về user hiện tại')
  @ApiErrorResponse(404, 'Không tìm thấy', 'ORDER_NOT_FOUND', 'Đơn thuê không tồn tại')
  @ApiErrorResponse(
    422,
    'Không thể gia hạn',
    'EXTENSION_NOT_ALLOWED',
    'Đơn không ở trạng thái cho phép gia hạn hoặc vi phạm chính sách',
  )
  quote(
    @Param(new ZodValidationPipe(Params)) params: z.infer<typeof Params>,
    @Body(new ZodValidationPipe(Quote)) body: z.infer<typeof Quote>,
    @ActiveUser('id') userId: string,
  ) {
    return this.service.quote(userId, params.id, new Date(body.requestedReturnAt), body.returnOptionId)
  }

  @Post(':id/extensions')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'Xác nhận gia hạn đơn thuê',
    description: `
Xác nhận gia hạn dựa trên báo giá đã tạo.

- Giữ tồn kho bổ sung (delta capacity) trong transaction.
- Nếu phí gia hạn = 0, gia hạn được áp dụng ngay lập tức.
- Nếu phí gia hạn > 0, cần thanh toán bổ sung qua API Extension Payments.
- Yêu cầu \`Idempotency-Key\` để tránh xác nhận trùng.
- \`expectedVersion\` dùng cho optimistic locking, tránh race condition.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID đơn thuê cần gia hạn',
    example: 'c3d4e5f6-7890-12cd-ef01-345678901bcd',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khoá duy nhất để tránh xác nhận gia hạn trùng (1–200 ký tự)',
    example: 'ext-confirm-abc123',
  })
  @ApiBody({
    description: 'Thông tin xác nhận gia hạn',
    schema: {
      type: 'object',
      required: ['extensionQuoteId', 'expectedVersion', 'acceptedTermsVersion'],
      properties: {
        extensionQuoteId: {
          type: 'string',
          format: 'uuid',
          description: 'ID báo giá gia hạn đã tạo ở bước trước',
          example: 'e5f6a7b8-9012-34ef-0123-567890123def',
        },
        expectedVersion: {
          type: 'integer',
          minimum: 1,
          description: 'Phiên bản đơn thuê mong đợi (optimistic lock)',
          example: 2,
        },
        acceptedTermsVersion: {
          type: 'string',
          description: 'Phiên bản điều khoản gia hạn mà user đã chấp nhận',
          example: 'v1.2',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Gia hạn miễn phí — áp dụng ngay, trả về đơn đã cập nhật' })
  @ApiResponse({ status: 201, description: 'Gia hạn có phí — tạo extension request, cần thanh toán bổ sung' })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'extensionQuoteId không đúng định dạng UUID')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(404, 'Không tìm thấy', 'EXTENSION_QUOTE_NOT_FOUND', 'Báo giá gia hạn không tồn tại hoặc đã hết hạn')
  @ApiErrorResponse(409, 'Xung đột phiên bản', 'VERSION_CONFLICT', 'Đơn đã bị thay đổi bởi thao tác khác')
  @ApiErrorResponse(
    422,
    'Không đủ tồn kho',
    'INSUFFICIENT_AVAILABLE_QUANTITY',
    'Không đủ thiết bị cho khoảng thời gian gia hạn',
  )
  confirm(
    @Param(new ZodValidationPipe(Params)) params: z.infer<typeof Params>,
    @Body(new ZodValidationPipe(Confirm)) body: z.infer<typeof Confirm>,
    @Headers('idempotency-key') rawKey: string | undefined,
    @ActiveUser('id') userId: string,
  ) {
    return this.service.confirm(
      userId,
      params.id,
      body.extensionQuoteId,
      body.expectedVersion,
      key(rawKey),
      body.acceptedTermsVersion,
      body.termsHash,
    )
  }

  @Get(':id/extensions')
  @Auth([AuthType.Bearer])
  @Roles(UserRole.USER, UserRole.LEADER)
  @ApiOperation({
    summary: 'Lịch sử gia hạn của đơn thuê',
    description: `
Lấy danh sách tất cả yêu cầu gia hạn (hiện tại và quá khứ) của một đơn thuê.

- Bao gồm các gia hạn đang chờ thanh toán, đã áp dụng và đã hết hạn.
- Mỗi bản ghi chứa: phí gia hạn, ngày trả cũ/mới, trạng thái, thời gian tạo.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID đơn thuê',
    example: 'c3d4e5f6-7890-12cd-ef01-345678901bcd',
  })
  @ApiResponse({ status: 200, description: 'Trả về danh sách lịch sử gia hạn của đơn thuê' })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(403, 'Không có quyền', 'FORBIDDEN', 'Đơn thuê không thuộc về user hiện tại')
  @ApiErrorResponse(404, 'Không tìm thấy', 'ORDER_NOT_FOUND', 'Đơn thuê không tồn tại')
  list(@Param(new ZodValidationPipe(Params)) params: z.infer<typeof Params>, @ActiveUser('id') userId: string) {
    return this.service.list(userId, params.id)
  }
}
