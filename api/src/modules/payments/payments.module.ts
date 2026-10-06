import { Module } from '@nestjs/common'
import { PaymentProvider } from './payment-provider.port'
import { MockPaymentProvider } from './mock-payment.provider'
import { MomoPaymentProvider } from './momo-payment.provider'
import { PrismaService } from '../../shared/services/prisma.service'
import { PaymentsController } from './payments.controller'
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
import { RentalDepositWorker } from '../rental/payments/rental-deposit.worker'
import { RentalRefundsService } from './rental-refunds.service'

@Module({
  imports: [BookingsModule],
  controllers: [
    PaymentsController,
    PaymentWebhooksController,
    PaymentOperationsController,
    RefundsController,
    BookingCancellationsController,
    TrailPurchaseController,
    RentalPaymentsController,
  ],
  providers: [
    RefundsService,
    RentalRefundsService,
    RentalCheckoutService,
    RentalPaymentConsumer,
    RentalDepositWorker,
    TechnicalReversalWorker,
    PurchaseTrailUseCase,
    ApplyTrailPaymentUseCase,
    PaymentRecoveryService,
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
        if (gateway === 'mock') return new MockPaymentProvider(db)
        if (gateway === 'momo') return new MomoPaymentProvider(db)
        throw new Error('Unsupported PAYMENT_PROVIDER')
      },
    },
  ],
  exports: [PaymentsService, PaymentsPort],
})
export class PaymentsModule {}
