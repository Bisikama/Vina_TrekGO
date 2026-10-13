import { Body, Controller, Headers, Param, Post, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import type { Response } from 'express'
import { Auth } from '../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe'
import { ApiErrorResponse } from '../../../shared/swagger/api-error-response.helper'
import { PaymentsPort } from '../../payments/payments.port'
import { PaymentMethod } from '../../payments/payment-provider.port'

@ApiTags('Rental Extension Payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('rental-extensions')
export class RentalExtensionPaymentsController {
  constructor(private readonly payments: PaymentsPort) {}

  @Post(':id/payments')
  @ApiOperation({
    summary: 'Tạo thanh toán cho yêu cầu gia hạn',
    description: `
Khởi tạo luồng thanh toán phí gia hạn cho extension request đã xác nhận.

- Tạo phiên thanh toán mới hoặc tái sử dụng phiên chưa hết hạn (idempotent theo \`Idempotency-Key\`).
- Hỗ trợ 2 phương thức: **QR** (quét mã QR) hoặc **REDIRECT** (chuyển hướng trang thanh toán).
- Sau khi thanh toán thành công, gia hạn sẽ tự động được áp dụng vào đơn thuê.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID yêu cầu gia hạn (extension request) cần thanh toán',
    example: 'e5f6a7b8-9012-34ef-0123-567890123def',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khoá duy nhất để tránh tạo payment trùng (1–200 ký tự ASCII)',
    example: 'ext-pay-abc123',
  })
  @ApiBody({
    description: 'Phương thức thanh toán',
    schema: {
      type: 'object',
      required: ['paymentMethod'],
      properties: {
        paymentMethod: {
          type: 'string',
          enum: ['QR', 'REDIRECT'],
          description: 'Phương thức thanh toán: QR (quét mã) hoặc REDIRECT (chuyển hướng)',
          example: 'QR',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo phiên thanh toán gia hạn thành công — trả về checkoutUrl/qrCode',
  })
  @ApiResponse({
    status: 200,
    description: 'Phiên thanh toán đã tồn tại (idempotent) — trả về thông tin phiên hiện tại',
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'paymentMethod phải là QR hoặc REDIRECT')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(403, 'Không có quyền', 'FORBIDDEN', 'Yêu cầu gia hạn không thuộc về user hiện tại')
  @ApiErrorResponse(404, 'Không tìm thấy', 'EXTENSION_NOT_FOUND', 'Yêu cầu gia hạn không tồn tại')
  @ApiErrorResponse(409, 'Đã thanh toán', 'PAYMENT_ALREADY_COMPLETED', 'Gia hạn đã được thanh toán')
  @ApiErrorResponse(422, 'Không thể thanh toán', 'EXTENSION_NOT_PAYABLE', 'Yêu cầu gia hạn không ở trạng thái cho phép thanh toán')
  async checkout(
    @Param('id', new ZodValidationPipe(z.string().uuid())) extensionId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(new ZodValidationPipe(z.object({ paymentMethod: z.enum(['QR','REDIRECT']) }).strict())) body: { paymentMethod: PaymentMethod },
    @ActiveUser('id') actorUserId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    new ZodValidationPipe(z.string().min(1).max(200)).transform(idempotencyKey, { type: 'custom' })
    const result = await this.payments.createRentalExtensionCheckout({ extensionId, actorUserId, idempotencyKey, paymentMethod: body.paymentMethod })
    response.status(result.httpStatus)
    return result.body
  }
}
