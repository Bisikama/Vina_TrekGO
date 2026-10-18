import { Module } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { TRIP_LIFECYCLE_PORT } from './application/ports/trip-lifecycle.port';
import { PrismaTripLifecycleAdapter } from './infrastructure/adapters/prisma-trip-lifecycle.adapter';
import { HandleTripRescheduledUseCase } from './application/use-cases/handle-trip-rescheduled.use-case';
import { HandleTripCancelledUseCase } from './application/use-cases/handle-trip-cancelled.use-case';
import { HandleBookingCancelledUseCase } from './application/use-cases/handle-booking-cancelled.use-case';
import { TripLifecycleWebhookController } from './presentation/controllers/trip-lifecycle-webhook.controller';
import { RentalOverdueService } from './application/services/rental-overdue.service';

@Module({
  controllers: [TripLifecycleWebhookController],
  providers: [
    PrismaService,
    RentalOverdueService,
    HandleTripRescheduledUseCase,
    HandleTripCancelledUseCase,
    HandleBookingCancelledUseCase,
    {
      provide: TRIP_LIFECYCLE_PORT,
      useClass: PrismaTripLifecycleAdapter,
    },
  ],
  exports: [
    TRIP_LIFECYCLE_PORT,
    RentalOverdueService,
    HandleTripRescheduledUseCase,
    HandleTripCancelledUseCase,
    HandleBookingCancelledUseCase,
  ],
})
export class LifecycleModule {}
