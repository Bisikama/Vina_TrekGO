import { Body, Controller, Headers, Param, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { Auth } from '../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe'
import { ApiErrorResponse } from '../../../shared/swagger/api-error-response.helper'
import { PaymentsPort } from '../../payments/payments.port'
import { PaymentMethod } from '../../payments/payment-provider.port'

@ApiTags('Rental payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('rental-orders')
export class RentalPaymentsController {
  constructor(private readonly payments: PaymentsPort) {}

  @Post(':id/payments')
  @ApiOperation({
    summary: 'Tạo thanh toán cho đơn thuê',
    description: `
**RB-API-204** — Khởi tạo luồng thanh toán cho RentalOrder.

- Tạo phiên thanh toán mới hoặc tái sử dụng phiên chưa hết hạn (idempotent theo \`Idempotency-Key\`).
- Hỗ trợ 2 phương thức: **QR** (quét mã QR) hoặc **REDIRECT** (chuyển hướng trang thanh toán).
- Sau khi tạo thành công, trả về URL/mã QR để user hoàn tất thanh toán.
- Webhook sẽ tự động cập nhật trạng thái đơn khi thanh toán thành công.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID đơn thuê cần thanh toán',
    example: 'c3d4e5f6-7890-12cd-ef01-345678901bcd',
  })
  @ApiHeader({
    name: 'idempotency-key',
    required: true,
    description: 'Khoá duy nhất để tránh tạo payment trùng (1–200 ký tự ASCII)',
    example: 'pay-order-abc123',
  })
  @ApiBody({
    description: 'Phương thức thanh toán',
    schema: {
      type: 'object',
      required: ['paymentMethod'],
      properties: {
        gateway: { type: 'string', enum: ['momo', 'vnpay'], description: 'Bỏ trống để dùng cổng mặc định' },
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
    description: 'Tạo phiên thanh toán mới thành công — trả về checkoutUrl/qrCode',
  })
  @ApiResponse({
    status: 200,
    description: 'Phiên thanh toán đã tồn tại (idempotent) — trả về thông tin phiên hiện tại',
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'paymentMethod phải là QR hoặc REDIRECT')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(403, 'Không có quyền', 'FORBIDDEN', 'Đơn thuê không thuộc về user hiện tại')
  @ApiErrorResponse(404, 'Không tìm thấy', 'ORDER_NOT_FOUND', 'Đơn thuê không tồn tại')
  @ApiErrorResponse(409, 'Xung đột', 'PAYMENT_ALREADY_COMPLETED', 'Đơn thuê đã được thanh toán')
  @ApiErrorResponse(422, 'Không thể thanh toán', 'ORDER_NOT_PAYABLE', 'Đơn không ở trạng thái cho phép thanh toán')
  async create(
    @Param('id', new ZodValidationPipe(z.string().uuid())) rentalOrderId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(new ZodValidationPipe(z.object({ paymentMethod: z.enum(['QR', 'REDIRECT']), gateway: z.enum(['momo', 'vnpay']).optional() }).strict()))
    body: { paymentMethod: PaymentMethod; gateway?: 'momo' | 'vnpay' },
    @ActiveUser('id') actorUserId: string,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    new ZodValidationPipe(
      z
        .string()
        .min(1)
        .max(200)
        .regex(/^[\x21-\x7e]+$/),
    ).transform(idempotencyKey, { type: 'custom' })
    const result = await this.payments.createRentalCheckout({ rentalOrderId, actorUserId, idempotencyKey, ...body,
      clientIp: request.ip ?? request.socket.remoteAddress })
    response.status(result.httpStatus)
    return result.body
  }
}
