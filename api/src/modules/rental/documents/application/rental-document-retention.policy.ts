/** Safe eligibility decision only. No deletion job is wired until legal holds are persisted. */
export function evaluateDocumentRetention(input: {
  settlementAt: Date | null;
  relatedCases: Array<{ closedAt: Date | null }>;
  relatedDocumentsReady: boolean;
  legalHoldUntil: Date | null;
  now: Date;
}): { eligible: boolean; eligibleAt: Date | null; reason: string } {
  if (!input.settlementAt || input.relatedCases.some(c => !c.closedAt))
    return { eligible: false, eligibleAt: null, reason: 'SETTLEMENT_OR_CASE_OPEN' };
  if (!input.relatedDocumentsReady)
    return { eligible: false, eligibleAt: null, reason: 'DOCUMENT_CHAIN_INCOMPLETE' };
  const closed = Math.max(input.settlementAt.getTime(), ...input.relatedCases.map(c => c.closedAt!.getTime()));
  const eligibleAt = new Date(closed + 180 * 24 * 60 * 60 * 1000);
  if (input.legalHoldUntil && input.legalHoldUntil > input.now)
    return { eligible: false, eligibleAt, reason: 'LEGAL_HOLD' };
  return { eligible: input.now >= eligibleAt, eligibleAt,
    reason: input.now >= eligibleAt ? 'ELIGIBLE_FOR_OWNER_APPROVED_PURGE' : 'RETENTION_PERIOD' };
}
