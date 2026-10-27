import { Module } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { TRIP_LIFECYCLE_PORT } from './application/ports/trip-lifecycle.port';
import { PrismaTripLifecycleAdapter } from './infrastructure/adapters/prisma-trip-lifecycle.adapter';
import { HandleTripRescheduledUseCase } from './application/use-cases/handle-trip-rescheduled.use-case';
import { HandleTripCancelledUseCase } from './application/use-cases/handle-trip-cancelled.use-case';
import { HandleBookingCancelledUseCase } from './application/use-cases/handle-booking-cancelled.use-case';
import { HandleMembershipSourceChangedUseCase } from './application/use-cases/handle-membership-source-changed.use-case';
import { BookingMembershipEventConsumer } from './infrastructure/consumers/booking-membership-event.consumer';
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
    HandleMembershipSourceChangedUseCase,
    BookingMembershipEventConsumer,
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
    HandleMembershipSourceChangedUseCase,
    BookingMembershipEventConsumer,
  ],
})
export class LifecycleModule {}
