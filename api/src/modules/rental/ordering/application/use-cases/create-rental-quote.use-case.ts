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
  RENTAL_QUOTE_PORT,
  type RentalQuotePort,
} from '../ports/rental-quote.port';
import {
  calculateChargedDays,
  calculateDepositPerUnit,
  calculateOccupiedWindow,
  evaluateRentalEligibility,
  formatPolicyVersion,
  normalizeQuoteItems,
  parseWholeVnd,
  resolveRecipient,
  resolveRentalReturn,
  toPrismaDecimalVnd,
  toSafeNumber,
} from '../services/rental-ordering.rules';

export interface CreateRentalQuoteCommand {
  userId: string;
  tripId: string;
  recipientTripMemberId?: string;
  requestedReturnAt?: Date;
  returnOptionId?: string;
  items: Array<{ productId: string; quantity: number }>;
  now?: Date;
}

@Injectable()
export class CreateRentalQuoteUseCase {
  constructor(
    @Inject(RENTAL_CONTEXT_PORT)
    private readonly contextPort: RentalContextPort,
    @Inject(RENTAL_CATALOG_PORT)
    private readonly catalogPort: RentalCatalogPort,
    @Inject(RENTAL_AVAILABILITY_PORT)
    private readonly availabilityPort: RentalAvailabilityPort,
    @Inject(RENTAL_QUOTE_PORT)
    private readonly quotePort: RentalQuotePort,
  ) {}

  async execute(command: CreateRentalQuoteCommand) {
    const now = command.now ?? new Date();

    // Bước 1: Lấy Rental Context và kiểm ownership.
    const context = await this.contextPort.getByTripId(command.tripId, command.userId, now);
    if (!context) {
      throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.TRIP_MEMBERSHIP_NOT_FOUND);
    }
    if (context.userId !== command.userId) {
      throw AppError.fromCode('FORBIDDEN');
    }

    // Bước 2: Public và Private Trip cùng dựa trên membership đã xác thực.
    const decision = evaluateRentalEligibility(context, now);
    if (!decision.eligible) {
      throw AppError.fromCode(
        decision.reason === 'RENTAL_CUTOFF_PASSED'
          ? RENTAL_ORDERING_ERROR_CODES.RENTAL_CUTOFF_PASSED
          : RENTAL_ORDERING_ERROR_CODES.TRIP_MEMBERSHIP_NOT_ELIGIBLE,
      );
    }

    // Bước 3: Gộp các product bị lặp trong request.
    // Quantity vẫn không phụ thuộc participant; giới hạn thực tế là availableCount.
    const normalizedItems = normalizeQuoteItems(command.items);
    const productIds = normalizedItems.map((item) => item.productId);
    const products = await this.catalogPort.getProductsByIds(productIds);
    const productMap = new Map(products.map((product) => [product.id, product]));

    if (products.length !== productIds.length) {
      throw AppError.fromCode('RENTAL_PRODUCT_NOT_FOUND');
    }

    // Bước 4: Resolve recipient từ context đã được Area A/adapter xác minh.
    const recipient = resolveRecipient(context, command.recipientTripMemberId);
    if (!recipient) {
      throw AppError.fromCode(RENTAL_ORDERING_ERROR_CODES.RENTAL_RECIPIENT_INVALID);
    }

    // Bước 5: Tính hai loại thời gian riêng biệt.
    // chargedDays dùng cho tính phí; occupiedWindow chỉ dùng cho capacity.
    const chosenReturn = resolveRentalReturn(context, command.requestedReturnAt, command.returnOptionId);
    const chargedDays = calculateChargedDays(
      context.pickup.scheduledAt,
      chosenReturn.endAt,
      context.activePolicy.dayCountMode,
    );
    const requiresDeep = products.some(p => p.requiresDeepInspectionAfterReturn === true);
    const occupiedWindow = calculateOccupiedWindow(context, chosenReturn.endAt, requiresDeep);

    // Bước 6: Recheck availability tại thời điểm tạo quote.
    // Quote KHÔNG reserve capacity; kết quả này vẫn chỉ là snapshot.
    const availabilityPairs = await Promise.all(
      normalizedItems.map(async (item) => ({
        item,
        availableCount: await this.availabilityPort.getAvailableCount({
          productId: item.productId,
          occupiedFrom: occupiedWindow.occupiedFrom,
          occupiedUntil: occupiedWindow.occupiedUntil,
          now,
        }),
      })),
    );

    const quoteLines: Array<{
      productId: string;
      name: string;
      quantity: number;
      availableCount: number;
      dailyPrice: bigint;
      depositPerUnit: bigint;
      replacementValue: bigint;
      feeAmount: bigint;
      depositAmount: bigint;
      currency: string;
    }> = [];

    let totalRentalFee = 0n;
    let totalDeposit = 0n;
    let quoteCurrency: string | null = null;

    // Bước 7: Tính tiền hoàn toàn phía server bằng BigInt VND.
    // Không chuyển Prisma Decimal sang JS floating-point để tính toán tài chính.
    for (const { item, availableCount } of availabilityPairs) {
      const product = productMap.get(item.productId);
      if (!product || product.status !== 'ACTIVE') {
        throw AppError.fromCode('RENTAL_PRODUCT_NOT_FOUND');
      }

      if (item.quantity > availableCount) {
        throw AppError.fromCode(
          RENTAL_ORDERING_ERROR_CODES.INSUFFICIENT_AVAILABLE_QUANTITY,
          {
            details: {
              productId: item.productId,
              requestedQuantity: item.quantity,
              availableCount,
            },
          },
        );
      }

      if (quoteCurrency && quoteCurrency !== product.currency) {
        throw AppError.fromCode('INTERNAL_ERROR', {
          message: 'Rental products in one quote must use the same currency',
        });
      }
      quoteCurrency = product.currency;

      const dailyPrice = parseWholeVnd(product.dailyPrice);
      const depositPerUnit = calculateDepositPerUnit(product);
      const replacementValue = parseWholeVnd(product.replacementValue);
      const feeAmount = dailyPrice * BigInt(chargedDays) * BigInt(item.quantity);
      const depositAmount = depositPerUnit * BigInt(item.quantity);

      totalRentalFee += feeAmount;
      totalDeposit += depositAmount;

      quoteLines.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        availableCount,
        dailyPrice,
        depositPerUnit,
        replacementValue,
        feeAmount,
        depositAmount,
        currency: product.currency,
      });
    }

    if (!quoteCurrency) {
      throw AppError.fromCode('VALIDATION_ERROR', {
        message: 'Quote must contain at least one rental product',
      });
    }

    const totalAmount = totalRentalFee + totalDeposit;
    const expiresAt = new Date(
      now.getTime() + context.activePolicy.quoteTtlMinutes * 60_000,
    );

    // Bước 8: Persist Quote + QuoteLines atomically ở Infrastructure Adapter.
    // Tuyệt đối KHÔNG tạo RentalQuantityReservation hoặc đổi EquipmentUnit state trong B1.
    const persisted = await this.quotePort.createQuote({
      userId: command.userId,
      tripId: context.trip.id,
      bookingId: context.bookingId,
      membershipRef: context.membershipRef,
      membershipSnapshot: { userId: context.userId, memberId: context.membershipRef, status: context.membershipStatus, role: context.membershipRole },
      pickupPointId: context.pickup.id,
      returnPointId: chosenReturn.pointId,
      returnOptionSnapshot: chosenReturn.returnOptionSnapshot,
      recipientParticipantId: null,
      recipientUserId: recipient.userId,
      recipientSnapshot: {
        memberId: recipient.memberId,
        userId: recipient.userId,
        displayName: recipient.displayName,
        phone: recipient.phone,
        status: recipient.status,
      },
      contextVersion: context.contextVersion,
      rentalPolicyId: context.activePolicy.id,
      rentalStartAt: context.pickup.scheduledAt,
      rentalEndAt: chosenReturn.endAt,
      plannedHandoverAt: context.pickup.scheduledAt,
      plannedReturnAt: chosenReturn.endAt,
      occupiedStartAt: occupiedWindow.occupiedFrom,
      occupiedEndAt: occupiedWindow.occupiedUntil,
      rentalFee: toPrismaDecimalVnd(totalRentalFee),
      totalDeposit: toPrismaDecimalVnd(totalDeposit),
      totalAmount: toPrismaDecimalVnd(totalAmount),
      currency: quoteCurrency,
      policySnapshot: {
        ...context.activePolicy.snapshot,
        // Frozen at order creation, including product-dependent deep-inspection buffer.
        occupiedPostReturnBufferMinutes: (occupiedWindow.occupiedUntil.getTime() - chosenReturn.endAt.getTime()) / 60000,
        policyVersion: formatPolicyVersion(context),
      },
      expiresAt,
      lines: quoteLines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        dailyPriceSnapshot: toPrismaDecimalVnd(line.dailyPrice),
        depositPerUnitSnapshot: toPrismaDecimalVnd(line.depositPerUnit),
        replacementValueSnapshot: toPrismaDecimalVnd(line.replacementValue),
        chargedDays,
        lineRentalFee: toPrismaDecimalVnd(line.feeAmount),
        lineDeposit: toPrismaDecimalVnd(line.depositAmount),
      })),
    });

    // Bước 9: Map sang đúng FE contract; không expose Prisma entity thô.
    return {
      id: persisted.id,
      bookingId: context.bookingId,
      membershipRef: context.membershipRef,
      membershipSnapshot: { userId: context.userId, memberId: context.membershipRef, status: context.membershipStatus, role: context.membershipRole },
      pickupPointId: context.pickup.id,
      returnPointId: chosenReturn.pointId,
      returnOptionSnapshot: chosenReturn.returnOptionSnapshot,
      recipient: {
        memberId: recipient.memberId,
        displayName: recipient.displayName,
      },
      chargedDays,
      items: quoteLines.map((line) => ({
        productId: line.productId,
        name: line.name,
        quantity: line.quantity,
        availableCount: line.availableCount,
        dailyPrice: toSafeNumber(line.dailyPrice),
        feeAmount: toSafeNumber(line.feeAmount),
        depositPerUnit: toSafeNumber(line.depositPerUnit),
        depositAmount: toSafeNumber(line.depositAmount),
      })),
      amounts: {
        feeAmount: toSafeNumber(totalRentalFee),
        depositAmount: toSafeNumber(totalDeposit),
        totalAmount: toSafeNumber(totalAmount),
        currency: quoteCurrency,
      },
      pickup: {
        id: context.pickup.id,
        name: context.pickup.name,
        scheduledAt: context.pickup.scheduledAt,
      },
      dropoff: {
        id: context.dropoff.id,
        name: context.dropoff.name,
        scheduledAt: chosenReturn.endAt,
      },
      expiresAt: persisted.expiresAt,
      contextVersion: context.contextVersion,
      policyVersion: formatPolicyVersion(context),
    };
  }
}