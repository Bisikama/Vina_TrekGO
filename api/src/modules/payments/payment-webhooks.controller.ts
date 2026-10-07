import { Controller, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common'
import { ApiHeader, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { AppError } from '../../shared/errors'
import { PaymentWebhooksService } from './payment-webhooks.service'
import { PaymentProvider } from './payment-provider.port'

@ApiTags('Payments')
@Auth([AuthType.None])
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(
    private readonly webhooks: PaymentWebhooksService,
    private readonly provider: PaymentProvider,
  ) {}

  @Post('momo')
  @HttpCode(204)
  async receiveMomo(@Req() request: RawBodyRequest<Request>) {
    if (this.provider.scope.gateway !== 'momo') throw AppError.fromCode('PAYMENT_WEBHOOK_INVALID_SIGNATURE')
    if (!request.rawBody || request.rawBody.length > 16384) throw AppError.fromCode('VALIDATION_ERROR')
    await this.webhooks.receive(request.rawBody, {})
  }

  @Post('mock')
  @HttpCode(200)
  @ApiHeader({ name: 'x-mock-timestamp', required: true })
  @ApiHeader({ name: 'x-mock-signature', required: true })
  async receive(@Req() request: RawBodyRequest<Request>) {
    if (this.provider.scope.gateway !== 'mock') throw AppError.fromCode('PAYMENT_WEBHOOK_INVALID_SIGNATURE')
    if (!request.rawBody || request.rawBody.length > 16384) throw AppError.fromCode('VALIDATION_ERROR')
    const headers: Record<string, string> = {}
    for (const name of ['x-mock-timestamp', 'x-mock-signature']) {
      const value = request.headers[name]
      if (typeof value === 'string') headers[name] = value
    }
    await this.webhooks.receive(request.rawBody, headers)
    return { received: true }
  }
}
