import { Body, Controller, Get, Headers, Param, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import type { Request, Response } from 'express'
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
  RENTAL_EXTENSION_PAYMENT_STATUS_RESPONSE_SCHEMA,
} from '../../payments/payment-swagger.schemas'

@ApiTags('Rental Extension Payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('rental-extensions')
export class RentalExtensionPaymentsController {
  constructor(private readonly payments: PaymentsPort) {}

  @Post(':id/payments')
  @ApiOperation({
    operationId: 'createRentalExtensionPayment',
    summary: 'Tạo thanh toán cho yêu cầu gia hạn',
    description: `
Khởi tạo luồng thanh toán phí gia hạn cho extension request đã xác nhận.

- Tạo phiên thanh toán mới hoặc tái sử dụng phiên chưa hết hạn (idempotent theo \`Idempotency-Key\`).
- Hỗ trợ 2 phương thức: **QR** (quét mã QR) hoặc **REDIRECT** (chuyển hướng trang thanh toán).
- Sau khi thanh toán thành công, gia hạn sẽ tự động được áp dụng vào đơn thuê.

**Cách test trên Swagger:** tạo extension request trước → copy extensionId → nhập một Idempotency-Key mới → Execute. Sau thanh toán, poll GET /api/v1/rental-extensions/{id}/payment đến khi payment, application, invoice và extension đều hoàn tất.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
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
    description: 'Tạo phiên thanh toán gia hạn — mở checkout.url hoặc hiển thị checkout.qrData',
    schema: PAYMENT_CHECKOUT_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 200,
    description: 'Phiên thanh toán đã tồn tại (idempotent) — trả về thông tin phiên hiện tại',
    schema: PAYMENT_CHECKOUT_RESPONSE_SCHEMA,
  })
  @ApiResponse({
    status: 202,
    description: 'Đã ghi nhận payment nhưng checkout chưa chắc chắn; giữ nguyên Idempotency-Key và poll trạng thái',
    schema: PAYMENT_PENDING_RESPONSE_SCHEMA,
  })
  @ApiErrorResponse(400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', 'paymentMethod phải là QR hoặc REDIRECT')
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHENTICATED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(404, 'Không tìm thấy', 'PAYMENT_NOT_FOUND', 'Yêu cầu gia hạn không tồn tại hoặc không thuộc user')
  @ApiErrorResponses(
    409,
    'Không thể tạo payment extension ở trạng thái hiện tại',
    [
      {
        name: 'invalidState',
        summary: 'Extension hoặc invoice không còn hợp lệ',
        code: 'PAYMENT_INVALID_STATE',
        message: 'Yêu cầu gia hạn, invoice hoặc thời hạn giữ chỗ không còn hợp lệ',
      },
      {
        name: 'attemptInProgress',
        summary: 'Đã có payment cho invoice',
        code: 'PAYMENT_ATTEMPT_IN_PROGRESS',
        message: 'Đang có một payment PENDING, PROCESSING hoặc SUCCEEDED cho invoice này',
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
  async checkout(
    @Param('id', new ZodValidationPipe(z.string().uuid())) extensionId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(
      new ZodValidationPipe(
        z.object({ paymentMethod: z.enum(['QR', 'REDIRECT']), gateway: z.enum(['momo', 'vnpay']).optional() }).strict(),
      ),
    )
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
    const result = await this.payments.createRentalExtensionCheckout({
      extensionId,
      actorUserId,
      idempotencyKey,
      ...body,
      clientIp: request.ip ?? request.socket.remoteAddress,
    })
    response.status(result.httpStatus)
    return result.body
  }

  @Get(':id/payment')
  @ApiOperation({
    operationId: 'getRentalExtensionPaymentStatus',
    summary: 'Lấy trạng thái thanh toán của yêu cầu gia hạn rental',
    description: `
Trả về trạng thái authoritative của extension, invoice, payment, application và reconciliation.

- Chưa tạo payment: paymentStatus = NOT_STARTED.
- Không coi redirect từ gateway là kết quả cuối cùng.
- Chỉ báo gia hạn hoàn tất khi paymentStatus = SUCCEEDED, applicationStatus = APPLIED, invoiceStatus = PAID và extensionStatus = APPLIED.
`,
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'ID yêu cầu gia hạn rental',
    example: '550e8400-e29b-41d4-a716-446655440020',
  })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái thanh toán và áp dụng gia hạn',
    schema: RENTAL_EXTENSION_PAYMENT_STATUS_RESPONSE_SCHEMA,
  })
  @ApiErrorResponse(401, 'Chưa đăng nhập', 'UNAUTHENTICATED', 'Token không hợp lệ hoặc đã hết hạn')
  @ApiErrorResponse(404, 'Không tìm thấy', 'PAYMENT_NOT_FOUND', 'Yêu cầu gia hạn không tồn tại hoặc không thuộc user')
  @ApiErrorResponse(409, 'Dữ liệu không nhất quán', 'PAYMENT_INVALID_STATE', 'Invoice hoặc payment không thuộc extension này')
  status(
    @Param('id', new ZodValidationPipe(z.string().uuid())) extensionId: string,
    @ActiveUser('id') actorUserId: string,
  ) {
    return this.payments.getRentalExtensionPayment({ extensionId, actorUserId })
  }
}
