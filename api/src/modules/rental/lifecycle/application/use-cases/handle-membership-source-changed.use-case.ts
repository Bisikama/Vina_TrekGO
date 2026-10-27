import { Inject, Injectable } from '@nestjs/common';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_LIFECYCLE_ERROR_CODES as LC } from 'src/shared/errors/codes/rental-lifecycle.error-codes';
import {
  TRIP_LIFECYCLE_PORT,
  type TripLifecyclePort,
  type MembershipSourceChangedCommand,
  type LifecycleExecutionResult,
} from '../ports/trip-lifecycle.port';

@Injectable()
export class HandleMembershipSourceChangedUseCase {
  constructor(
    @Inject(TRIP_LIFECYCLE_PORT)
    private readonly lifecyclePort: TripLifecyclePort,
  ) {}

  async execute(command: MembershipSourceChangedCommand): Promise<LifecycleExecutionResult> {
    if (!command.eventId?.trim()) {
      throw AppError.fromCode(LC.INVALID_EVENT_PAYLOAD, {
        message: 'Missing eventId in membership source changed event',
      });
    }

    if (!command.payload?.membershipKind || !command.payload?.membershipRef) {
      throw AppError.fromCode(LC.INVALID_EVENT_PAYLOAD, {
        message: 'Missing membershipKind or membershipRef in event payload',
      });
    }

    return this.lifecyclePort.processMembershipSourceChanged(command);
  }
}

