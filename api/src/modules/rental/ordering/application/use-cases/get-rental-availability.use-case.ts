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
  resolveRentalReturn,
  evaluateRentalEligibility,
} from '../services/rental-ordering.rules';

export interface GetRentalAvailabilityCommand {
  tripId: string;
  productId: string;
  userId: string;
  requestedReturnAt?: Date;
  returnOptionId?: string;
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

    // Bước 1: Đọc context và kiểm ownership trước khi lộ thông tin tồn kho theo Trip.
    const context = await this.contextPort.getByTripId(command.tripId, command.userId, now);
    if (!context) {
      throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.TRIP_MEMBERSHIP_NOT_FOUND);
    }
    if (context.userId !== command.userId) {
      throw AppError.fromCode('FORBIDDEN');
    }

    // Bước 2: Availability chỉ hợp lệ khi Trip Membership / Trip còn đủ điều kiện thuê.
    const decision = evaluateRentalEligibility(context, now);
    if (!decision.eligible) {
      throw AppError.fromCode(
        decision.reason === 'RENTAL_CUTOFF_PASSED'
          ? RENTAL_ORDERING_ERROR_CODES.RENTAL_CUTOFF_PASSED
          : RENTAL_ORDERING_ERROR_CODES.TRIP_MEMBERSHIP_NOT_ELIGIBLE,
      );
    }

    // Bước 3: Chỉ product ACTIVE mới được dùng để tính availability cho USER.
    const [product] = await this.catalogPort.getProductsByIds([command.productId]);
    if (!product || product.status !== 'ACTIVE') {
      throw AppError.fromCode('RENTAL_PRODUCT_NOT_FOUND');
    }

    // Bước 4: Tính occupied window từ thời điểm giao/trả + buffer của policy.
    // FE không được tự truyền ngày thuê hoặc buffer.
    const chosenReturn = resolveRentalReturn(context, command.requestedReturnAt, command.returnOptionId);
    const rentalWindow = calculateOccupiedWindow(context, chosenReturn.endAt, product.requiresDeepInspectionAfterReturn === true);

    // Bước 5: Tính availableCount tại thời điểm đọc.
    // Đây chỉ là snapshot; B2 bắt buộc recheck lại trong transaction khi giữ quantity.
    const availableCount = await this.availabilityPort.getAvailableCount({
      productId: command.productId,
      occupiedFrom: rentalWindow.occupiedFrom,
      occupiedUntil: rentalWindow.occupiedUntil,
      now,
    });

    return {
      tripId: command.tripId,
      productId: command.productId,
      availableCount,
      rentalWindow,
      checkedAt: now,
    };
  }
}