import { Module } from '@nestjs/common'
import { PaymentProvider } from './payment-provider.port'
import { MockPaymentProvider } from './mock-payment.provider'
import { MomoPaymentProvider } from './momo-payment.provider'
import { VnpayPaymentProvider } from './vnpay-payment.provider'
import { PaymentProviderRouter } from './payment-provider.router'
import { VnpayIpnController } from './vnpay-ipn.controller'
import { PrismaService } from '../../shared/services/prisma.service'
import { PaymentsController, PaymentOptionsController } from './payments.controller'
import { MockPaymentCheckoutController } from './mock-payment-checkout.controller'
import { PaymentsService } from './payments.service'
import { BookingsModule } from '../bookings/bookings.module'
import { PaymentWebhooksController } from './payment-webhooks.controller'
import { PaymentWebhooksService } from './payment-webhooks.service'
import { PaymentEventsWorker } from './payment-events.worker'
import { RefundsService } from './refunds.service'
import { PaymentRecoveryService } from './payment-recovery.service'
import { PaymentsPort, SharedPaymentsPort } from './payments.port'
import { PaymentOperationsController, RefundsController } from './payment-operations.controller'
import { BookingCancellationService } from '../bookings/booking-cancellation.service'
import { BookingCancellationsController } from '../bookings/booking-cancellations.controller'
import { TechnicalReversalWorker } from './technical-reversal.worker'
import { PurchaseTrailUseCase } from '../system-trail/application/use-cases/purchase-trail.use-case'
import { ApplyTrailPaymentUseCase } from '../system-trail/application/use-cases/apply-trail-payment.use-case'
import { TrailPurchaseController } from '../system-trail/presentation/controllers/trail-purchase.controller'
import { RentalCheckoutService } from '../rental/payments/rental-checkout.service'
import { RentalPaymentConsumer } from '../rental/payments/rental-payment.consumer'
import { RentalPaymentsController } from '../rental/payments/rental-payments.controller'
import { RentalExtensionPaymentsController } from '../rental/payments/rental-extension-payments.controller'
import { RentalDepositWorker } from '../rental/payments/rental-deposit.worker'
import { RentalRefundsService } from './rental-refunds.service'
import { SandboxRefundSimulationService } from './sandbox-refund-simulation.service'
import { PaymentHistoryService } from './payment-history.service'
import { UserTransactionsController } from './user-transactions.controller'

@Module({
  imports: [BookingsModule],
  controllers: [
    PaymentsController,
    PaymentOptionsController,
    MockPaymentCheckoutController,
    PaymentWebhooksController,
    VnpayIpnController,
    PaymentOperationsController,
    RefundsController,
    BookingCancellationsController,
    TrailPurchaseController,
    RentalPaymentsController,
    RentalExtensionPaymentsController,
    UserTransactionsController,
  ],
  providers: [
    RefundsService,
    SandboxRefundSimulationService,
    RentalRefundsService,
    RentalCheckoutService,
    RentalPaymentConsumer,
    RentalDepositWorker,
    TechnicalReversalWorker,
    PurchaseTrailUseCase,
    ApplyTrailPaymentUseCase,
    PaymentRecoveryService,
    PaymentHistoryService,
    { provide: PaymentsPort, useClass: SharedPaymentsPort },
    BookingCancellationService,
    PaymentsService,
    PaymentWebhooksService,
    PaymentEventsWorker,
    {
      provide: PaymentProvider,
      inject: [PrismaService],
      useFactory: (db: PrismaService) => {
        const gateway = process.env.PAYMENT_PROVIDER ?? 'mock'
        const extra = gateway === 'mock' && process.env.PAYMENT_PROVIDER_ENVIRONMENT === 'MOCK'
          ? '' : process.env.PAYMENT_ENABLED_PROVIDERS ?? ''
        const gateways = [...new Set([gateway, ...extra.split(',').map((v) => v.trim()).filter(Boolean)])]
        const providers = gateways.map((name) => {
          if (name === 'mock') return new MockPaymentProvider(db)
          if (name === 'momo') return new MomoPaymentProvider(db)
          if (name === 'vnpay') return new VnpayPaymentProvider(db)
          throw new Error('Unsupported payment provider')
        })
        return new PaymentProviderRouter(providers, gateway)
      },
    },
  ],
  exports: [PaymentsService, PaymentsPort, PaymentHistoryService],
})
export class PaymentsModule {}
