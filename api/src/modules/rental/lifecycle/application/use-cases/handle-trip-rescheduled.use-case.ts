import { Inject, Injectable } from '@nestjs/common';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_LIFECYCLE_ERROR_CODES as LC } from 'src/shared/errors/codes/rental-lifecycle.error-codes';
import {
  TRIP_LIFECYCLE_PORT,
  type TripLifecyclePort,
  type TripRescheduledCommand,
  type LifecycleExecutionResult,
} from '../ports/trip-lifecycle.port';

@Injectable()
export class HandleTripRescheduledUseCase {
  constructor(
    @Inject(TRIP_LIFECYCLE_PORT)
    private readonly lifecyclePort: TripLifecyclePort,
  ) {}

  async execute(command: TripRescheduledCommand): Promise<LifecycleExecutionResult> {
    if (!command.eventId?.trim() || !command.payload?.tripId) {
      throw AppError.fromCode(LC.INVALID_EVENT_PAYLOAD, {
        message: 'Missing eventId or tripId in TRIP_RESCHEDULED event',
      });
    }

    if (!(command.payload.newStartAt < command.payload.newEndAt)) {
      throw AppError.fromCode(LC.INVALID_EVENT_PAYLOAD, {
        message: 'newStartAt must be strictly before newEndAt',
      });
    }

    if (command.entityId !== command.payload.tripId) {
      throw AppError.fromCode(LC.INVALID_EVENT_PAYLOAD, {
        message: 'entityId must match payload.tripId',
      });
    }

    return this.lifecyclePort.processTripRescheduled(command);
  }
}
