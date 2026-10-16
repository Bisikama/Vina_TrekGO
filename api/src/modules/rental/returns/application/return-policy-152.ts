/** SOT 1.5.2 – Return safety invariants. No timers auto-approve or auto-AVAILABLE. */
export const RETURN_POLICY_152 = Object.freeze({
  returnInspectionSlaHours: 72,
  deepInspectionSlaHours: 24,
  returnToInventoryAllowanceHours: 8,
  postInspectionCleaningAllowanceHours: 8,
  postReturnBufferHours: 24,
  deepInspectionBufferHours: 48,
});
export function inspectionDeadlines(receivedAt: Date, deepRequired: boolean, finalHours: number, deepHours: number) {
  if (!(receivedAt instanceof Date) || Number.isNaN(receivedAt.getTime())) throw new Error('INVALID_CUSTODY_RECEIVED_AT');
  if (!Number.isInteger(finalHours) || finalHours <= 0 || !Number.isInteger(deepHours) || deepHours <= 0) throw new Error('INVALID_INSPECTION_SLA');
  return { inspectionDueAt: new Date(receivedAt.getTime() + finalHours * 3600000),
    deepInspectionDueAt: deepRequired ? new Date(receivedAt.getTime() + deepHours * 3600000) : null };
}
export function occupiedUntil(returnDue: Date, deep: boolean, nominalHours: number, deepHours: number) {
  const hours = deep ? deepHours : nominalHours;
  if (!Number.isInteger(hours) || hours <= 0) throw new Error('INVALID_BUFFER');
  // Transfer and cleaning allowances are *within* this window, never added.
  return new Date(returnDue.getTime() + hours * 3600000);
}
