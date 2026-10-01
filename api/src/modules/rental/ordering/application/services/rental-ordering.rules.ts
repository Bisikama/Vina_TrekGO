import type {
  RentalEligibilityContext,
  RentalRecipientOption,
} from '../ports/rental-context.port';

export type RentalEligibilityReason =
  | 'BOOKING_NOT_RENTAL_ELIGIBLE'
  | 'RENTAL_CUTOFF_PASSED'
  | null;

export interface RentalEligibilityDecision {
  eligible: boolean;
  reason: RentalEligibilityReason;
}

export interface OccupiedWindow {
  occupiedFrom: Date;
  occupiedUntil: Date;
}

/**
 * Bước nghiệp vụ: đánh giá Booking/Trip có được phép đi tiếp vào flow thuê hay không.
 * Lưu ý: đây là business eligibility; lỗi ownership vẫn phải xử lý riêng bằng 403.
 */
export function evaluateRentalEligibility(
  context: RentalEligibilityContext,
  now: Date,
): RentalEligibilityDecision {
  const invalidTripStatuses = new Set([
    'DRAFT',
    'CANCEL_PENDING',
    'CANCELLED',
    'INTERRUPTED',
    'COMPLETED',
  ]);

  if (
    context.booking.status !== 'CONFIRMED' ||
    context.trip.tripType !== 'PUBLIC' ||
    invalidTripStatuses.has(context.trip.status)
  ) {
    return {
      eligible: false,
      reason: 'BOOKING_NOT_RENTAL_ELIGIBLE',
    };
  }

  if (now.getTime() >= context.rentalCutoffAt.getTime()) {
    return {
      eligible: false,
      reason: 'RENTAL_CUTOFF_PASSED',
    };
  }

  return {
    eligible: true,
    reason: null,
  };
}

/**
 * Bước nghiệp vụ: tính cửa sổ chiếm dụng capacity.
 * Khoảng này KHÔNG phải khoảng tính tiền; nó cộng thêm thời gian chuẩn bị/trả/vệ sinh.
 */
export function calculateOccupiedWindow(
  context: RentalEligibilityContext,
): OccupiedWindow {
  const occupiedFrom = new Date(
    context.pickup.scheduledAt.getTime() -
      context.activePolicy.prepBufferMinutes * 60_000,
  );

  const occupiedUntil = new Date(
    context.dropoff.scheduledAt.getTime() +
      (context.activePolicy.returnBufferMinutes +
        context.activePolicy.cleaningBufferMinutes) *
        60_000,
  );

  if (occupiedFrom.getTime() >= occupiedUntil.getTime()) {
    throw new Error('Invalid occupied window calculated from rental context');
  }

  return { occupiedFrom, occupiedUntil };
}

/**
 * Bước nghiệp vụ: tính số ngày thu phí theo baseline hiện tại.
 * Giá trị dayCountMode chưa có field riêng trong schema hiện tại, vì vậy B1 dùng ceil theo 24h.
 */
export function calculateChargedDays(startAt: Date, endAt: Date): number {
  const durationMs = endAt.getTime() - startAt.getTime();
  if (durationMs <= 0) {
    throw new Error('Trip endAt must be after startAt');
  }

  return Math.max(1, Math.ceil(durationMs / 86_400_000));
}

/**
 * Bước nghiệp vụ: chọn người nhận thiết bị.
 * Nếu FE không chỉ định, ưu tiên participant gắn với chủ Booking; sau đó mới lấy participant ACTIVE đầu tiên.
 */
export function resolveRecipient(
  context: RentalEligibilityContext,
  requestedParticipantId?: string,
): RentalRecipientOption | null {
  if (requestedParticipantId) {
    return (
      context.recipientOptions.find(
        (item) => item.participantId === requestedParticipantId,
      ) ?? null
    );
  }

  return (
    context.recipientOptions.find(
      (item) => item.userId === context.booking.ownerUserId,
    ) ??
    context.recipientOptions[0] ??
    null
  );
}

/**
 * B1 contract 0.2.0 dùng VND integer ở response.
 * Hàm này đọc Decimal string nhưng không dùng floating point cho tiền.
 */
export function parseWholeVnd(value: string): bigint {
  const normalized = value.trim();
  const match = /^(-?\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid VND decimal: ${value}`);
  }

  const integerPart = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');

  // B1 mock/OpenAPI định nghĩa amount là integer VND.
  // Không âm thầm làm tròn dữ liệu catalog có phần lẻ vì sẽ làm sai snapshot tài chính.
  if (fraction !== '00') {
    throw new Error(`VND amount must be a whole integer: ${value}`);
  }

  return integerPart;
}

/**
 * Deposit % được lưu dạng Decimal, ví dụ 20.00 = 20%.
 * Chuyển sang basis points để tính hoàn toàn bằng BigInt.
 */
export function parsePercentToBasisPoints(value: string): bigint {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid percentage decimal: ${value}`);
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0'));
  return whole * 100n + fraction;
}

export function roundDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error('Denominator must be positive');
  }

  return (numerator + denominator / 2n) / denominator;
}

/**
 * Bước nghiệp vụ: tính cọc trên từng unit từ snapshot product hiện tại.
 */
export function calculateDepositPerUnit(params: {
  depositPolicyType: string;
  depositValue: string;
  replacementValue: string;
}): bigint {
  if (params.depositPolicyType === 'FIXED') {
    return parseWholeVnd(params.depositValue);
  }

  if (params.depositPolicyType === 'PERCENT_REPLACEMENT_VALUE') {
    const replacementValue = parseWholeVnd(params.replacementValue);
    const basisPoints = parsePercentToBasisPoints(params.depositValue);

    // 100% = 10_000 basis points.
    return roundDivide(replacementValue * basisPoints, 10_000n);
  }

  throw new Error(`Unsupported deposit policy: ${params.depositPolicyType}`);
}

export function toPrismaDecimalVnd(value: bigint): string {
  return `${value.toString()}.00`;
}

export function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < 0n) {
    throw new Error('Money value is outside safe API integer range');
  }
  return Number(value);
}

export function formatPolicyVersion(context: RentalEligibilityContext): string {
  return `${context.activePolicy.policyCode}-v${context.activePolicy.versionNo}`;
}

export function normalizeQuoteItems(
  items: Array<{ productId: string; quantity: number }>,
): Array<{ productId: string; quantity: number }> {
  const merged = new Map<string, number>();

  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }

  return [...merged.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}