import { Inject, Injectable } from '@nestjs/common';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_LIFECYCLE_ERROR_CODES as LC } from 'src/shared/errors/codes/rental-lifecycle.error-codes';
import {
  TRIP_LIFECYCLE_PORT,
  type TripLifecyclePort,
  type BookingCancelledCommand,
  type LifecycleExecutionResult,
} from '../ports/trip-lifecycle.port';

@Injectable()
export class HandleBookingCancelledUseCase {
  constructor(
    @Inject(TRIP_LIFECYCLE_PORT)
    private readonly lifecyclePort: TripLifecyclePort,
  ) {}

  async execute(command: BookingCancelledCommand): Promise<LifecycleExecutionResult> {
    if (!command.eventId?.trim() || !command.payload?.bookingId) {
      throw AppError.fromCode(LC.INVALID_EVENT_PAYLOAD, {
        message: 'Missing eventId or bookingId in BOOKING_CANCELLED event',
      });
    }

    if (command.entityId !== command.payload.bookingId) {
      throw AppError.fromCode(LC.INVALID_EVENT_PAYLOAD, {
        message: 'entityId must match payload.bookingId',
      });
    }

    if (
      command.entityVersion !== undefined &&
      command.payload?.version !== undefined &&
      command.entityVersion !== command.payload.version
    ) {
      throw AppError.fromCode(LC.INVALID_EVENT_PAYLOAD, {
        message: 'entityVersion must match payload.version for BOOKING_CANCELLED',
      });
    }

    return this.lifecyclePort.processBookingCancelled(command);
  }
}
