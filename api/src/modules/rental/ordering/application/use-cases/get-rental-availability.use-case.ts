import { Inject, Injectable } from '@nestjs/common';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_ORDERING_ERROR_CODES } from 'src/shared/errors/codes/rental-ordering.error-codes';
import {
  RENTAL_AVAILABILITY_PORT,
  type RentalAvailabilityPort,
} from '../ports/rental-availability.port';
import {
  RENTAL_CATALOG_PORT,
  type RentalCatalogPort,
} from '../ports/rental-catalog.port';
import {
  RENTAL_CONTEXT_PORT,
  type RentalContextPort,
} from '../ports/rental-context.port';
import {
  calculateOccupiedWindow,
  evaluateRentalEligibility,
} from '../services/rental-ordering.rules';

export interface GetRentalAvailabilityCommand {
  bookingId: string;
  productId: string;
  userId: string;
  now?: Date;
}

@Injectable()
export class GetRentalAvailabilityUseCase {
  constructor(
    @Inject(RENTAL_CONTEXT_PORT)
    private readonly contextPort: RentalContextPort,
    @Inject(RENTAL_CATALOG_PORT)
    private readonly catalogPort: RentalCatalogPort,
    @Inject(RENTAL_AVAILABILITY_PORT)
    private readonly availabilityPort: RentalAvailabilityPort,
  ) {}

  async execute(command: GetRentalAvailabilityCommand) {
    const now = command.now ?? new Date();

    // Bước 1: Đọc context và kiểm ownership trước khi lộ thông tin tồn kho theo Booking.
    const context = await this.contextPort.getByBookingId(command.bookingId, now);
    if (!context) {
      throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.BOOKING_NOT_FOUND);
    }
    if (context.booking.ownerUserId !== command.userId) {
      throw AppError.fromCode('FORBIDDEN');
    }

    // Bước 2: Availability chỉ hợp lệ khi Booking/Trip còn đủ điều kiện thuê.
    const decision = evaluateRentalEligibility(context, now);
    if (!decision.eligible) {
      throw AppError.fromCode(
        decision.reason === 'RENTAL_CUTOFF_PASSED'
          ? RENTAL_ORDERING_ERROR_CODES.RENTAL_CUTOFF_PASSED
          : RENTAL_ORDERING_ERROR_CODES.BOOKING_NOT_RENTAL_ELIGIBLE,
      );
    }

    // Bước 3: Chỉ product ACTIVE mới được dùng để tính availability cho USER.
    const [product] = await this.catalogPort.getProductsByIds([command.productId]);
    if (!product || product.status !== 'ACTIVE') {
      throw AppError.fromCode('RENTAL_PRODUCT_NOT_FOUND');
    }

    // Bước 4: Tính occupied window từ thời điểm giao/trả + buffer của policy.
    // FE không được tự truyền ngày thuê hoặc buffer.
    const rentalWindow = calculateOccupiedWindow(context);

    // Bước 5: Tính availableCount tại thời điểm đọc.
    // Đây chỉ là snapshot; B2 bắt buộc recheck lại trong transaction khi giữ quantity.
    const availableCount = await this.availabilityPort.getAvailableCount({
      productId: command.productId,
      occupiedFrom: rentalWindow.occupiedFrom,
      occupiedUntil: rentalWindow.occupiedUntil,
      now,
    });

    return {
      bookingId: command.bookingId,
      productId: command.productId,
      availableCount,
      rentalWindow,
      checkedAt: now,
    };
  }
}