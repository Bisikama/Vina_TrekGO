import { Module } from '@nestjs/common';
import { RentalExtensionService } from './extension/rental-extension.service';
import { RentalExtensionController } from './extension/rental-extension.controller';
import { RentalExtensionScheduler } from './extension/rental-extension.scheduler';
import { SharedModule } from 'src/shared/shared.module';
import { RENTAL_AVAILABILITY_PORT } from './application/ports/rental-availability.port';
import { RENTAL_CATALOG_PORT } from './application/ports/rental-catalog.port';
import { RENTAL_CONTEXT_PORT } from './application/ports/rental-context.port';
import { RENTAL_ORDER_PORT } from './application/ports/rental-order.port';
import { RENTAL_QUOTE_PORT } from './application/ports/rental-quote.port';
import { CancelRentalOrderUseCase } from './application/use-cases/cancel-rental-order.use-case';
import { CreateRentalOrderUseCase } from './application/use-cases/create-rental-order.use-case';
import { CreateRentalQuoteUseCase } from './application/use-cases/create-rental-quote.use-case';
import { ExpirePendingRentalOrdersUseCase } from './application/use-cases/expire-pending-rental-orders.use-case';
import { GetRentalAvailabilityUseCase } from './application/use-cases/get-rental-availability.use-case';
import { GetRentalEligibilityUseCase } from './application/use-cases/get-rental-eligibility.use-case';
import { GetRentalOrderUseCase } from './application/use-cases/get-rental-order.use-case';
import { GetRentalPaymentUseCase } from './application/use-cases/get-rental-payment.use-case';
import { GetRentalRecommendationsUseCase } from './application/use-cases/get-rental-recommendations.use-case';
import { ListRentalOrdersUseCase } from './application/use-cases/list-rental-orders.use-case';
import { PreviewRentalCancellationUseCase } from './application/use-cases/preview-rental-cancellation.use-case';
import { ProcessRentalPaymentEventUseCase } from './application/use-cases/process-rental-payment-event.use-case';
import { PrismaRentalAvailabilityAdapter } from './infrastructure/adapters/prisma-rental-availability.adapter';
import { PrismaRentalCatalogAdapter } from './infrastructure/adapters/prisma-rental-catalog.adapter';
import { PrismaRentalContextAdapter } from './infrastructure/adapters/prisma-rental-context.adapter';
import { PrismaRentalOrderAdapter } from './infrastructure/adapters/prisma-rental-order.adapter';
import { PrismaRentalQuoteAdapter } from './infrastructure/adapters/prisma-rental-quote.adapter';
import { RentalOrderExpiryScheduler } from './infrastructure/jobs/rental-order-expiry.scheduler';
import { RentalTripController } from './presentation/controllers/rental-booking.controller';
import { RentalOperationController } from './presentation/controllers/rental-operation.controller';
import { RentalOrderController } from './presentation/controllers/rental-order.controller';
import { AdminRentalOrderController } from './presentation/controllers/admin-rental-order.controller';
import { LifecycleModule } from '../lifecycle/lifecycle.module';

@Module({
  imports: [SharedModule, LifecycleModule],
  controllers: [
    RentalTripController,
    RentalOperationController,
    RentalOrderController,
    RentalExtensionController,
    AdminRentalOrderController,
  ],
  providers: [
    RentalExtensionService,
    RentalExtensionScheduler,
    GetRentalEligibilityUseCase,
    GetRentalAvailabilityUseCase,
    CreateRentalQuoteUseCase,
    GetRentalRecommendationsUseCase,
    CreateRentalOrderUseCase,
    ListRentalOrdersUseCase,
    GetRentalOrderUseCase,
    GetRentalPaymentUseCase,
    PreviewRentalCancellationUseCase,
    CancelRentalOrderUseCase,
    ProcessRentalPaymentEventUseCase,
    ExpirePendingRentalOrdersUseCase,
    RentalOrderExpiryScheduler,
    { provide: RENTAL_CONTEXT_PORT, useClass: PrismaRentalContextAdapter },
    { provide: RENTAL_CATALOG_PORT, useClass: PrismaRentalCatalogAdapter },
    { provide: RENTAL_AVAILABILITY_PORT, useClass: PrismaRentalAvailabilityAdapter },
    { provide: RENTAL_QUOTE_PORT, useClass: PrismaRentalQuoteAdapter },
    { provide: RENTAL_ORDER_PORT, useClass: PrismaRentalOrderAdapter },
  ],
  exports: [ProcessRentalPaymentEventUseCase],
})
export class OrderingModule {}
