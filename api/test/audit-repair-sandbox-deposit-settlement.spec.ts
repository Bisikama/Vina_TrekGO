import {
  assertApplyEligible,
  candidateSnapshotHash,
  classifyCandidate,
  parseRepairArgs,
  type AuditCandidate,
} from '../scripts/audit-repair-sandbox-deposit-settlement'

const candidate = (overrides: Partial<AuditCandidate> = {}): AuditCandidate => ({
  refundId: 'refund-1',
  refundVersion: 3,
  refundStatus: 'PROCESSING',
  providerEnvironment: 'SANDBOX',
  orderId: 'order-1',
  refundOrderId: 'order-1',
  settlementId: 'settlement-1',
  orderStatus: 'RETURN_PROCESSING',
  orderFinancialStatus: 'SETTLED',
  issuedDocumentCount: 0,
  hasSimulationMarker: true,
  relationConsistent: true,
  allocatedItems: [
    {
      id: 'item-1',
      status: 'SETTLED',
      settledAt: '2026-10-23T12:00:00.000Z',
      hasLegacySimulationMarker: true,
    },
  ],
  ...overrides,
})

describe('sandbox deposit audit/repair classification', () => {
  it('defaults to dry-run with empty allowlists', () => {
    const options = parseRepairArgs([])
    expect(options.apply).toBe(false)
    expect(options.refundIds.size).toBe(0)
    expect(options.orderIds.size).toBe(0)
  })

  it('classifies a proven early projection as narrowly auto-repairable', () => {
    expect(classifyCandidate(candidate()).classification).toBe('EARLY_PROJECTION_AUTO_REPAIR')
  })

  it('never auto-reopens a completed order', () => {
    expect(classifyCandidate(candidate({ orderStatus: 'COMPLETED' })).classification).toBe(
      'MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL',
    )
  })

  it('routes issued immutable documents to manual review', () => {
    expect(classifyCandidate(candidate({ issuedDocumentCount: 1 })).classification).toBe(
      'MANUAL_REVIEW_IMMUTABLE_OR_TERMINAL',
    )
  })

  it('routes a real Shared Payment success with missing projection to event replay', () => {
    const row = candidate({
      refundStatus: 'SUCCEEDED',
      allocatedItems: [
        { id: 'item-1', status: 'REFUND_PENDING', settledAt: null, hasLegacySimulationMarker: false },
      ],
    })
    expect(classifyCandidate(row).classification).toBe('REPLAY_SHARED_SUCCESS_EVENT')
  })

  it('excludes unsafe source or relation mismatches from automatic repair', () => {
    expect(classifyCandidate(candidate({ providerEnvironment: 'PRODUCTION' })).classification).toBe(
      'MANUAL_REVIEW_UNSAFE_SOURCE',
    )
    expect(classifyCandidate(candidate({ relationConsistent: false })).classification).toBe(
      'MANUAL_REVIEW_UNSAFE_SOURCE',
    )
  })

  it('requires apply, both allowlists and the exact dry-run snapshot hash', () => {
    const classified = classifyCandidate(candidate())
    const options = parseRepairArgs([
      '--apply',
      '--refund-id=refund-1',
      '--order-id=order-1',
      '--snapshot-in=audit.json',
    ])
    expect(() =>
      assertApplyEligible(classified, options, new Map([[classified.refundId, classified.snapshotHash]])),
    ).not.toThrow()
    expect(() => assertApplyEligible(classified, options, new Map([[classified.refundId, 'changed']]))).toThrow(
      'Snapshot hash changed or is missing',
    )
  })

  it('detects snapshot changes and makes an already-restored record non-repairable', () => {
    const before = candidate()
    const after = candidate({
      allocatedItems: [
        { id: 'item-1', status: 'REFUND_PENDING', settledAt: null, hasLegacySimulationMarker: true },
      ],
    })
    expect(candidateSnapshotHash(after)).not.toBe(candidateSnapshotHash(before))
    expect(classifyCandidate(after).classification).toBe('NOT_A_CANDIDATE')
  })
})
