import { Controller, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common'
import { ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { AppError } from '../../shared/errors'
import { PaymentWebhooksService } from './payment-webhooks.service'
import { PaymentProvider } from './payment-provider.port'

@ApiTags('Webhook thanh toán (Payment Webhooks)')
@Auth([AuthType.None])
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(
    private readonly webhooks: PaymentWebhooksService,
    private readonly provider: PaymentProvider,
  ) {}

  @Post('momo')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Webhook nhận thông báo thanh toán từ MoMo',
    description: 'Endpoint nhận IPN (Instant Payment Notification) từ cổng thanh toán MoMo để cập nhật trạng thái đơn hàng.',
  })
  @ApiResponse({ status: 204, description: 'Đã xử lý thông báo thành công' })
  @ApiResponse({ status: 400, description: 'Chữ ký không hợp lệ hoặc dữ liệu không đúng định dạng' })
  async receiveMomo(@Req() request: RawBodyRequest<Request>) {
    if (!this.provider.forGateway('momo')) throw AppError.fromCode('PAYMENT_WEBHOOK_INVALID_SIGNATURE')
    if (!request.rawBody || request.rawBody.length > 16384) throw AppError.fromCode('VALIDATION_ERROR')
    await this.webhooks.receive(request.rawBody, {}, 'momo')
  }

  @Post('mock')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook giả lập thanh toán (Mock Webhook - Môi trường Dev/Test)',
    description: 'Endpoint dùng trong môi trường phát triển và kiểm thử tự động để kích hoạt thanh toán thành công/thất bại.',
  })
  @ApiHeader({ name: 'x-mock-timestamp', required: true, description: 'Timestamp tạo chữ ký mock', example: '1728900000000' })
  @ApiHeader({ name: 'x-mock-signature', required: true, description: 'Chữ ký bảo mật mock', example: 'mock-sig-abc123xyz' })
  @ApiBody({
    description: 'Signed mock event. HMAC must match the exact raw JSON body; sample signatures do not work. For a successful event, transactionRef (PAYMENT) or refundTransactionRef (REFUND) must not be null.',
    schema: {
      type: 'object',
      oneOf: ['PAYMENT', 'REFUND'].map((kind) => ({
        type: 'object' as const,
        additionalProperties: false,
        required: ['kind', 'providerEventId', 'merchantRequestRef', 'transactionRef', 'status', 'amount', 'currency', 'occurredAt', ...(kind === 'REFUND' ? ['merchantRefundRef', 'refundTransactionRef'] : [])],
        properties: {
          kind: { type: 'string' as const, enum: [kind] },
          providerEventId: { type: 'string' as const, minLength: 1, maxLength: 220 },
          merchantRequestRef: { type: 'string' as const, minLength: 1, maxLength: 180 },
          transactionRef: { type: 'string' as const, nullable: true, minLength: 1, maxLength: 180 },
          status: { type: 'string' as const, enum: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', ...(kind === 'PAYMENT' ? ['EXPIRED'] : [])] },
          amount: { type: 'string' as const, pattern: '^(0|[1-9][0-9]{0,9})$', example: '10000' },
          currency: { type: 'string' as const, pattern: '^[A-Z]{3}$', example: 'VND' },
          occurredAt: { type: 'string' as const, format: 'date-time' },
          ...(kind === 'REFUND' ? {
            merchantRefundRef: { type: 'string' as const, minLength: 1, maxLength: 180 },
            refundTransactionRef: { type: 'string' as const, nullable: true, minLength: 1, maxLength: 180 },
          } : {}),
        },
      })),
    },
  })
  @ApiResponse({ status: 200, description: 'Nhận webhook mock thành công' })
  async receive(@Req() request: RawBodyRequest<Request>) {
    if (!this.provider.forGateway('mock')) throw AppError.fromCode('PAYMENT_WEBHOOK_INVALID_SIGNATURE')
    if (!request.rawBody || request.rawBody.length > 16384) throw AppError.fromCode('VALIDATION_ERROR')
    const headers: Record<string, string> = {}
    for (const name of ['x-mock-timestamp', 'x-mock-signature']) {
      const value = request.headers[name]
      if (typeof value === 'string') headers[name] = value
    }
    await this.webhooks.receive(request.rawBody, headers, 'mock')
    return { received: true }
  }
}
