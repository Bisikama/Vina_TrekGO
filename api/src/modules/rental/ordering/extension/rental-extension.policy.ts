/** Pure, versioned business-rule guard for Policy 1.4.2. No DB and no HTTP imports. */
export const EXTENSION_TERMS_VERSION = 'RENTAL_EXTENSION_TERMS_1.4.2';
export type ExtensionPolicySnapshot = Record<string, unknown>;
export interface ExtensionGuardInput {
  status: string; rentalStartAt: Date; rentalEndAt: Date; operationalReturnDueAt?: Date | null;
  requestedReturnAt?: Date; tripPlannedReturnAt?: Date; appliedCount: number;
  returnStarted: boolean; returnTaskStarted: boolean; exceptionStatus?: string | null;
  snapshot: ExtensionPolicySnapshot; now: Date; applyingAlreadyHeldRequest?: boolean;
}
export function policyInteger(snapshot: ExtensionPolicySnapshot, key: string): number {
  const value = snapshot[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`EXTENSION_POLICY_NOT_CONFIGURED:${key}`);
  return value;
}
export function effectiveDueAt(rentalEndAt: Date, operationalReturnDueAt?: Date | null): Date {
  return operationalReturnDueAt && operationalReturnDueAt > rentalEndAt ? operationalReturnDueAt : rentalEndAt;
}
export function extensionViolation(input: ExtensionGuardInput): string | null {
  if (input.status !== 'ACTIVE') return 'EXTENSION_INVALID_ORDER_STATE';
  if (input.returnStarted) return 'EXTENSION_RETURN_STARTED';
  if (input.returnTaskStarted) return 'EXTENSION_RETURN_TASK_STARTED';
  if (input.exceptionStatus === 'OVERDUE') return 'EXTENSION_TOO_LATE';
  const cutoffMinutes = policyInteger(input.snapshot, 'extensionRequestCutoffMinutes');
  const maxExtensionCount = policyInteger(input.snapshot, 'maxExtensionCount');
  const maxTotalRentalDays = policyInteger(input.snapshot, 'maxTotalRentalDays');
  const maxAfterTripHours = policyInteger(input.snapshot, 'maxRentalAfterTripHours');
  const due = effectiveDueAt(input.rentalEndAt, input.operationalReturnDueAt);
  // Exactly cutoff minutes before due is allowed; afterwards is not.
  if (input.applyingAlreadyHeldRequest) {
    if (input.now >= due) return 'EXTENSION_TOO_LATE';
  } else if (input.now.getTime() + cutoffMinutes * 60000 > due.getTime()) return 'EXTENSION_TOO_LATE';
  if (input.appliedCount >= maxExtensionCount) return 'EXTENSION_LIMIT_REACHED';
  if (input.requestedReturnAt) {
    if (input.requestedReturnAt <= input.rentalEndAt) return 'EXTENSION_END_NOT_LATER';
    if (input.requestedReturnAt.getTime() - input.rentalStartAt.getTime() > maxTotalRentalDays * 86400000)
      return 'RENTAL_DURATION_NOT_ALLOWED';
    if (!input.tripPlannedReturnAt || !Number.isFinite(input.tripPlannedReturnAt.getTime()))
      return 'EXTENSION_TRIP_CONTEXT_REQUIRED';
    if (input.requestedReturnAt.getTime() > input.tripPlannedReturnAt.getTime() + maxAfterTripHours * 3600000)
      return 'RENTAL_DURATION_NOT_ALLOWED';
  }
  return null;
}
