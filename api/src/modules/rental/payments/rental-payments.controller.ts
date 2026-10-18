import { Body, Controller, Headers, Param, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { Auth } from '../../../shared/decorators/auth.decorator'
import { AuthType } from '../../../shared/constants/auth.constant'
import { ActiveUser } from '../../../shared/decorators/active-user.decorator'
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe'
import { ApiErrorResponse, ApiErrorResponses } from '../../../shared/swagger/api-error-response.helper'
import { PaymentsPort } from '../../payments/payments.port'
import { PaymentMethod } from '../../payments/payment-provider.port'
import {
  PAYMENT_CHECKOUT_RESPONSE_SCHEMA,
  PAYMENT_PENDING_RESPONSE_SCHEMA,
} from '../../payments/payment-swagger.schemas'

@ApiTags('Rental payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('rental-orders')
export class RentalPaymentsController {
  constructor(private readonly payments: PaymentsPort) {}

  @Post(':id/payments')
  @ApiOperation({
    operationId: 'createRentalOrderPayment',
    summary: 'Tạo thanh toán cho đơn thuê',
    description: `
**RB-API-204** — Khởi tạo luồng thanh toán cho RentalOrder.

- Tạo phiên thanh toán mới hoặc tái sử dụng phiên chưa hết hạn (idempotent theo \`Idempotency-Key\`).
- Hỗ trợ 2 phương thức: **QR** (quét mã QR) hoặc **REDIRECT** (chuyển hướng trang thanh toán).
- Sau khi tạo thành công, trả về URL/mã QR để user hoàn tất thanh toán.
- Webhook sẽ tự động cập nhật trạng thái đơn khi thanh toán thành công.

**Cách test trên Swagger:** Authorize bằng Bearer token → lấy gateway từ GET /api/v1/payments/options → nhập RentalOrder UUID → nhập một Idempotency-Key mới → Execute. Nếu request timeout, retry đúng cùng key và body. Sau thanh toán, kiểm tra GET /api/v1/rental-orders/{id}/payment.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'ID đơn thuê cần thanh toán',
    example: 'c3d4e5f6-7890-12cd-ef01-345678901bcd',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khoá duy nhất để tránh tạo payment trùng (1–200 ký tự ASCII)',
    example: 'pay-order-abc123',
  })
  @ApiBody({
    description: 'Phương thức thanh toán',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['paymentMethod'],
      properties: {
        gateway: {
          type: 'string',
          enum: ['momo', 'vnpay'],
          description: 'Bỏ trống để dùng cổng mặc định từ GET /api/v1/payments/options',
          example: 'vnpay',
        },
        paymentMethod: {
          type: 'string',
          enum: ['QR', 'REDIRECT'],
          description: 'Phương thức thanh toán: QR (quét mã) hoặc REDIRECT (chuyển hướng)',
          example: 'REDIRECT',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo phiên thanh toán mới — mở checkout.url hoặc hiển thị checkout.qrData',
    schema: PAYMENT_CHECKOUT_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 200,
    description: 'Phiên thanh toán đã tồn tại (idempotent) — trả về thông tin phiên hiện tại',
    schema: PAYMENT_CHECKOUT_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 202,
    description: 'Đã ghi nhận payment nhưng chưa lấy được checkout chắc chắn; giữ nguyên Idempotency-Key và poll trạng thái',
    schema: PAYMENT_PENDING_RESPONSE_SCHEMA,
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'paymentMethod phải là QR hoặc REDIRECT')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHENTICATED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(404, 'Không tìm thấy', 'PAYMENT_NOT_FOUND', 'Đơn thuê không tồn tại hoặc không thuộc user hiện tại')
  @ApiErrorResponses(
    409,
    'Không thể tạo payment ở trạng thái hiện tại',
    [
      {
        name: 'invalidState',
        summary: 'Đơn hoặc invoice không còn hợp lệ',
        code: 'PAYMENT_INVALID_STATE',
        message: 'Đơn, invoice, reservation hoặc thời hạn thanh toán không còn hợp lệ',
      },
      {
        name: 'attemptInProgress',
        summary: 'Đang có payment chưa kết thúc',
        code: 'PAYMENT_ATTEMPT_IN_PROGRESS',
        message: 'Đang có một payment PENDING hoặc PROCESSING cho invoice này',
      },
      {
        name: 'idempotencyConflict',
        summary: 'Idempotency-Key đã được dùng với payload khác',
        code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
        message: 'Hãy dùng lại đúng body cũ hoặc tạo key mới cho thao tác mới',
      },
    ],
  )
  @ApiErrorResponse(
    503,
    'Cổng thanh toán không khả dụng',
    'PAYMENT_PROVIDER_UNAVAILABLE',
    'Không tìm thấy hoặc không thể kết nối cổng thanh toán đã chọn',
  )
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
