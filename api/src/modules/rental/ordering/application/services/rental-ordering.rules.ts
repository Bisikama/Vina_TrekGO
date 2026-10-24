import { AppError } from 'src/shared/errors/app-error';
import type {
  RentalEligibilityContext,
  RentalRecipientOption,
} from '../ports/rental-context.port';

export type RentalEligibilityReason = 'TRIP_MEMBERSHIP_NOT_ELIGIBLE' | 'RENTAL_CUTOFF_PASSED' | null;
export interface RentalEligibilityDecision { eligible: boolean; reason: RentalEligibilityReason; }
export interface OccupiedWindow { occupiedFrom: Date; occupiedUntil: Date; }
/** SOT 1.5.2: giữ công suất từ 12 giờ trước rentalStartAt. */
export const RENTAL_PREP_BUFFER_MINUTES = 12 * 60;
export function rentalOccupiedFrom(rentalStartAt: Date): Date {
  return new Date(rentalStartAt.getTime() - RENTAL_PREP_BUFFER_MINUTES * 60_000);
}
export function evaluateRentalEligibility(context: RentalEligibilityContext, now: Date): RentalEligibilityDecision {
  if (!context.rentalEligible || context.membershipStatus !== 'ACTIVE') return { eligible: false, reason: 'TRIP_MEMBERSHIP_NOT_ELIGIBLE' };
  if (now >= context.rentalCutoffAt) return { eligible: false, reason: 'RENTAL_CUTOFF_PASSED' };
  return { eligible: true, reason: null };
}
/** Server validates a longer return against policy AND an actual Area A return option. */
export function resolveRentalReturn(context: RentalEligibilityContext, requestedReturnAt?: Date, returnOptionId?: string) {
  const endAt = requestedReturnAt ?? context.dropoff.scheduledAt;
  if (!Number.isFinite(endAt.getTime()) || endAt <= context.pickup.scheduledAt) throw AppError.fromCode('VALIDATION_ERROR');
  // The v1.2 option changes the default return to a LATER return, not an earlier one.
  if (endAt < context.dropoff.scheduledAt) throw AppError.fromCode('RENTAL_DURATION_NOT_ALLOWED');
  if (endAt.getTime() === context.dropoff.scheduledAt.getTime() && !returnOptionId) {
    return { endAt, pointId: context.dropoff.id, returnOptionSnapshot: null };
  }
  const maxHours = context.activePolicy.maxRentalAfterTripHours;
  if (endAt > context.trip.endAt && (maxHours == null || endAt.getTime() > context.trip.endAt.getTime() + maxHours * 3600000)) {
    throw AppError.fromCode('RENTAL_DURATION_NOT_ALLOWED');
  }
  const option = context.returnOptions.find((o) => o.id === returnOptionId && o.available && endAt >= o.windowStart && endAt <= o.windowEnd);
  if (!option) throw AppError.fromCode('RENTAL_RETURN_OPTION_UNAVAILABLE');
  return { endAt, pointId: option.pointId, returnOptionSnapshot: {
    id: option.id, pointId: option.pointId, pointName: option.pointName, method: option.method,
    windowStart: option.windowStart.toISOString(), windowEnd: option.windowEnd.toISOString(),
  } };
}
export function calculateOccupiedWindow(context: RentalEligibilityContext, returnAt = context.dropoff.scheduledAt, requiresDeepInspection = false): OccupiedWindow {
  const occupiedFrom = rentalOccupiedFrom(context.pickup.scheduledAt);
  // Policy v1.4.2: post-return 24h OR deep-inspection 48h, never 24+48.
  // For older snapshots with missing deep config use the larger existing configured buffer (conservative).
  const normalBuffer = Math.max(context.activePolicy.returnBufferMinutes, context.activePolicy.cleaningBufferMinutes);
  const deepBuffer = context.activePolicy.deepInspectionBufferMinutes;
  // Baseline MVP 1.4.2: 24h normal, 48h deep. Refuse under-configured policy rather than overbook.
  if (!Number.isSafeInteger(normalBuffer) || normalBuffer < 1440)
    throw AppError.fromCode('RENTAL_POLICY_NOT_CONFIGURED');
  if (requiresDeepInspection && (deepBuffer == null || !Number.isSafeInteger(deepBuffer) || deepBuffer < 2880))
    throw AppError.fromCode('RENTAL_POLICY_NOT_CONFIGURED');
  const bufferMinutes = requiresDeepInspection ? Math.max(normalBuffer, deepBuffer!) : normalBuffer;
  const occupiedUntil = new Date(returnAt.getTime() + bufferMinutes * 60000);
  if (occupiedFrom >= occupiedUntil) throw new Error('Invalid occupied window');
  return { occupiedFrom, occupiedUntil };
}
export function calculateChargedDays(startAt: Date, endAt: Date, dayCountMode: 'CEIL_24H' = 'CEIL_24H'): number {
  const durationMs = endAt.getTime() - startAt.getTime();
  if (durationMs <= 0) throw new Error('Rental endAt must be after startAt');
  if (dayCountMode !== 'CEIL_24H') throw new Error(`Unsupported rental dayCountMode: ${String(dayCountMode)}`);
  return Math.max(1, Math.ceil(durationMs / 86400000));
}
export function resolveRecipient(context: RentalEligibilityContext, requestedMemberId?: string): RentalRecipientOption | null {
  // MVP: only the owner/member. Do not grant rental custody to another Trip member implicitly.
  return context.recipientOptions.find((r) => r.userId === context.userId && r.status === 'ACTIVE' && (!requestedMemberId || r.memberId === requestedMemberId)) ?? null;
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
