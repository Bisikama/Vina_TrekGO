import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { PrismaService } from '../../shared/services/prisma.service'
import { PaymentProvider } from './payment-provider.port'
import { PaymentWebhooksService } from './payment-webhooks.service'

@ApiTags('Payments')
@Auth([AuthType.None])
@Controller('payments/webhooks')
export class VnpayIpnController {
  constructor(
    private readonly provider: PaymentProvider,
    private readonly db: PrismaService,
    private readonly inbox: PaymentWebhooksService,
  ) {}

  // VNPAY's server-to-server acknowledgement protocol. Application APIs continue
  // to use GlobalErrorFilter; this endpoint intentionally speaks the gateway wire contract.
  @Get('vnpay')
  @ApiOperation({ summary: 'VNPAY server-to-server IPN', description: 'VNPAY calls the registered URL with signed vnp_* query parameters. No JWT required. HTTP 200 is a protocol acknowledgement: inspect RspCode. Business updates are asynchronous after durable intake; this is not the browser return URL.' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { RspCode: { type: 'string', enum: ['00', '01', '02', '04', '97', '99'] }, Message: { type: 'string' } } } })
  async receive(@Query() query: Record<string, unknown>) {
    try {
      const raw = Buffer.from(JSON.stringify(query))
      const event = await this.provider.forGateway('vnpay')?.verifyWebhook(raw, {})
      if (!event || event.kind !== 'PAYMENT') return { RspCode: '97', Message: 'Invalid signature or payload' }
      const payment = await this.db.payment.findFirst({
        where: {
          paymentGateway: event.gateway,
          providerEnvironment: event.environment,
          merchantAccountKey: event.merchantAccountKey,
          merchantRequestRef: event.merchantRequestRef,
        },
      })
      if (!payment) return { RspCode: '01', Message: 'Order not found' }
      if (!payment.amount.equals(event.amount) || payment.currency !== event.currency)
        return { RspCode: '04', Message: 'Invalid amount' }
      // Persist even late or conflicting signed results for the shared financial
      // state machine to handle. Never confirm a booking inside this adapter.
      await this.inbox.receive(raw, {}, 'vnpay')
      return payment.status === event.status
        ? { RspCode: '02', Message: 'Order already confirmed' }
        : { RspCode: '00', Message: 'Confirm Success' }
    } catch {
      // Includes storage failures: VNPAY must retry until intake is durable.
      return { RspCode: '99', Message: 'Please retry' }
    }
  }
}
