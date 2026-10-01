import { Inject, Injectable } from '@nestjs/common';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_ORDERING_ERROR_CODES } from 'src/shared/errors/codes/rental-ordering.error-codes';
import {
  RENTAL_CONTEXT_PORT,
  type RentalContextPort,
} from '../ports/rental-context.port';
import { evaluateRentalEligibility } from '../services/rental-ordering.rules';

export interface GetRentalEligibilityCommand {
  bookingId: string;
  userId: string;
  now?: Date;
}

@Injectable()
export class GetRentalEligibilityUseCase {
  constructor(
    @Inject(RENTAL_CONTEXT_PORT)
    private readonly contextPort: RentalContextPort,
  ) {}

  async execute(command: GetRentalEligibilityCommand) {
    const now = command.now ?? new Date();

    // Bước 1: Lấy toàn bộ Rental Context cần thiết cho Booking.
    // Application chỉ biết Port; việc đọc DB/Area A nằm ở Infrastructure Adapter.
    const context = await this.contextPort.getByBookingId(command.bookingId, now);

    if (!context) {
      throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.BOOKING_NOT_FOUND);
    }

    // Bước 2: Kiểm tra ownership.
    // User A tuyệt đối không được đọc rental context của Booking thuộc User B.
    if (context.booking.ownerUserId !== command.userId) {
      throw AppError.fromCode('FORBIDDEN');
    }

    // Bước 3: Đánh giá business eligibility.
    // Booking tồn tại nhưng chưa đủ điều kiện vẫn trả 200 + eligible=false theo RB-API-101.
    const decision = evaluateRentalEligibility(context, now);

    // Bước 4: Trả đúng contract cho FE.
    // existingOpenOrderId chỉ dùng để hướng UI; B2 vẫn phải chặn OPEN_ORDER_EXISTS trong transaction.
    return {
      bookingId: context.booking.id,
      eligible: decision.eligible,
      reason: decision.reason,
      recipientOptions: decision.eligible
        ? context.recipientOptions.map((item) => ({
            id: item.participantId,
            displayName: item.displayName,
            userId: item.userId,
            status: item.status,
          }))
        : [],
      trip: {
        id: context.trip.id,
        name: context.trip.name,
        status: context.trip.status,
        startAt: context.trip.startAt,
        endAt: context.trip.endAt,
        timezone: context.trip.timezone,
      },
      pickup: decision.eligible
        ? {
            id: context.pickup.id,
            name: context.pickup.name,
            address: context.pickup.address,
            scheduledAt: context.pickup.scheduledAt,
          }
        : null,
      dropoff: decision.eligible
        ? {
            id: context.dropoff.id,
            name: context.dropoff.name,
            address: context.dropoff.address,
            scheduledAt: context.dropoff.scheduledAt,
          }
        : null,
      rentalCutoffAt: context.rentalCutoffAt,
      contextVersion: context.contextVersion,
      existingOpenOrderId: context.existingOpenOrderId,
      allowedActions:
        decision.eligible && !context.existingOpenOrderId
          ? ['CREATE_RENTAL']
          : [],
    };
  }
}