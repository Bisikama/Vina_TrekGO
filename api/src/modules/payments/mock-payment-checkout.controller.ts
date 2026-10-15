import { Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiAcceptedResponse, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { createHmac, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { AppError } from '../../shared/errors'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { PrismaService } from '../../shared/services/prisma.service'
import { PaymentProvider } from './payment-provider.port'
import { PaymentWebhooksService } from './payment-webhooks.service'

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('payments')
export class MockPaymentCheckoutController {
  constructor(
    private readonly db: PrismaService,
    private readonly provider: PaymentProvider,
    private readonly webhooks: PaymentWebhooksService,
  ) {}

  @Post(':paymentId/mock-confirm')
  @HttpCode(202)
  @ApiOperation({ summary: 'Simulate successful payment (non-production MOCK only; booking or rental)',
    description: 'No body or webhook signature required. Only the invoice owner may confirm. Poll the booking/rental detail until domain processing completes; accepted does not mean confirmed.' })
  @ApiAcceptedResponse({ description: 'Simulation accepted; payment/domain workers process asynchronously.' })
  async confirm(
    @Param('paymentId', new ZodValidationPipe(z.string().uuid())) paymentId: string,
    @ActiveUser('id') actorUserId: string,
  ) {
    if (!actorUserId) throw AppError.fromCode('UNAUTHENTICATED')
    if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_MOCK_ENABLED !== 'true' ||
      this.provider.scope.gateway !== 'mock' || this.provider.scope.environment !== 'MOCK')
      throw AppError.fromCode('PAYMENT_PROVIDER_UNAVAILABLE')
    const payment = await this.db.payment.findFirst({
      where: { id: paymentId, invoice: { userId: actorUserId, invoiceType: { in: ['BOOKING', 'RENTAL'] } } },
      include: { application: true },
    })
    if (!payment) throw AppError.fromCode('PAYMENT_NOT_FOUND')
    if (payment.paymentGateway !== this.provider.scope.gateway ||
      payment.providerEnvironment !== this.provider.scope.environment ||
      payment.merchantAccountKey !== this.provider.scope.merchantAccountKey || !payment.merchantRequestRef)
      throw AppError.fromCode('PAYMENT_INVALID_STATE')
    const response = () => ({ accepted: true, paymentId, paymentStatus: payment.status,
      applicationStatus: payment.application?.status ?? null })
    // A replay must not collect again, including when domain application was rejected.
    if (payment.status === 'SUCCEEDED') return response()
    if (!['PENDING', 'PROCESSING'].includes(payment.status) || !payment.expiresAt || payment.expiresAt <= new Date())
      throw AppError.fromCode('PAYMENT_INVALID_STATE')
    const secret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET
    if (!secret || Buffer.byteLength(secret) < 32) throw AppError.fromCode('PAYMENT_PROVIDER_UNAVAILABLE')
    const body = Buffer.from(JSON.stringify({
      providerEventId: `mock-ui:${randomUUID()}`,
      kind: 'PAYMENT', merchantRequestRef: payment.merchantRequestRef,
      transactionRef: `mock:${payment.merchantRequestRef}`, status: 'SUCCEEDED',
      amount: payment.amount.toFixed(0), currency: payment.currency, occurredAt: new Date().toISOString(),
    }))
    const timestamp = Math.floor(Date.now() / 1000).toString()
    await this.webhooks.receive(body, {
      'x-mock-timestamp': timestamp,
      'x-mock-signature': createHmac('sha256', secret).update(timestamp).update('.').update(body).digest('hex'),
    })
    return response()
  }
}
