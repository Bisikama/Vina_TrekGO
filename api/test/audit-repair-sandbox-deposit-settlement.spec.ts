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
  refundReconcileStatus: 'SCHEDULED',
  refundAmount: '400000',
  refundCurrency: 'VND',
  refundPaymentId: 'payment-1',
  refundedAt: null,
  refundTransactionRef: null,
  providerEnvironment: 'SANDBOX',
  paymentGateway: 'vnpay',
  simulationProvenanceHash: 'simulation-hash',
  orderId: 'order-1',
  refundOrderId: 'order-1',
  settlementId: 'settlement-1',
  orderStatus: 'RETURN_PROCESSING',
  orderFinancialStatus: 'SETTLED',
  orderExceptionStatus: 'NONE',
  orderVersion: 7,
  orderCompletedAt: null,
  settlementStatus: 'SETTLED',
  settlementOutcome: 'REFUNDED',
  settlementVersion: 4,
  settlementSettledAt: '2026-10-23T12:00:00.000Z',
  issuedDocumentCount: 0,
  hasSimulationMarker: true,
  relationConsistent: true,
  sourcePayment: {
    id: 'payment-1',
    status: 'SUCCEEDED',
    amount: '1000000',
    currency: 'VND',
    version: 2,
    depositAllocations: [{ id: 'allocation-1', orderLineId: 'line-1', amount: '1000000' }],
  },
  refundAllocations: [{ paymentAllocationId: 'allocation-1', amount: '400000' }],
  sourceRefundReservations: [
    {
      refundId: 'refund-1',
      status: 'PROCESSING',
      purpose: 'DEPOSIT',
      amount: '400000',
      version: 3,
      reconcileStatus: 'SCHEDULED',
      refundedAt: null,
      allocations: [{ paymentAllocationId: 'allocation-1', amount: '400000' }],
    },
  ],
  cases: [],
  documents: [],
  durableEvents: [],
  allocatedItems: [
    {
      id: 'item-1',
      status: 'SETTLED',
      settledAt: '2026-10-23T12:00:00.000Z',
      version: 4,
      depositAmount: '1000000',
      deductionAmount: '600000',
      refundAmount: '400000',
      approvedAt: '2026-10-23T11:00:00.000Z',
      decisionSnapshotHash: 'decision-hash',
      inspection: {
        id: 'inspection-1',
        stage: 'FINAL',
        outcome: 'DAMAGE_CONFIRMED',
        version: 2,
        evidenceHash: 'evidence-hash',
      },
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

  it('routes case activity and durable success evidence to manual review', () => {
    expect(
      classifyCandidate(
        candidate({
          cases: [
            {
              id: 'case-1',
              status: 'OPEN',
              version: 1,
              updatedAt: '2026-10-23T12:00:00.000Z',
              resolvedAt: null,
              evidenceHash: 'case-evidence-hash',
            },
          ],
        }),
      ).classification,
    ).toBe('MANUAL_REVIEW_UNSAFE_SOURCE')
    expect(
      classifyCandidate(
        candidate({
          durableEvents: [
            {
              id: 'event-1',
              eventType: 'REFUND_SUCCEEDED',
              status: 'PENDING',
              processedAt: null,
              payloadHash: 'event-payload-hash',
              receipts: [],
            },
          ],
        }),
      ).classification,
    ).toBe('MANUAL_REVIEW_UNSAFE_SOURCE')
  })

  it('routes a real Shared Payment success with missing projection to event replay', () => {
    const row = candidate({
      refundStatus: 'SUCCEEDED',
      durableEvents: [
        {
          id: 'event-success-1',
          eventType: 'REFUND_SUCCEEDED',
          status: 'PENDING',
          processedAt: null,
          payloadHash: 'success-payload-hash',
          receipts: [],
        },
      ],
      allocatedItems: [
        {
          ...candidate().allocatedItems[0],
          id: 'item-1',
          status: 'REFUND_PENDING',
          settledAt: null,
          hasLegacySimulationMarker: false,
        },
      ],
    })
    expect(classifyCandidate(row).classification).toBe('REPLAY_SHARED_SUCCESS_EVENT')
  })

  it('requires manual correction when a receipt exists but the Rental projection is incomplete', () => {
    const row = candidate({
      refundStatus: 'SUCCEEDED',
      durableEvents: [
        {
          id: 'event-success-1',
          eventType: 'REFUND_SUCCEEDED',
          status: 'PROCESSED',
          processedAt: '2026-10-23T12:00:00.000Z',
          payloadHash: 'success-payload-hash',
          receipts: [
            { consumerName: 'rental-deposit-v1', processedAt: '2026-10-23T12:00:00.000Z' },
          ],
        },
      ],
      allocatedItems: [
        {
          ...candidate().allocatedItems[0],
          status: 'REFUND_PENDING',
          settledAt: null,
        },
      ],
    })
    const classified = classifyCandidate(row)
    expect(classified.classification).toBe('MANUAL_REVIEW_UNSAFE_SOURCE')
    expect(classified.reasons).toContain('RECEIPT_EXISTS_BUT_PROJECTION_INCOMPLETE')
  })

  it('does not invent a replay when the durable Shared Payment success event is missing', () => {
    const row = candidate({
      refundStatus: 'SUCCEEDED',
      allocatedItems: [
        {
          ...candidate().allocatedItems[0],
          status: 'REFUND_PENDING',
          settledAt: null,
        },
      ],
    })
    const classified = classifyCandidate(row)
    expect(classified.classification).toBe('MANUAL_REVIEW_UNSAFE_SOURCE')
    expect(classified.reasons).toContain('DURABLE_SUCCESS_EVENT_MISSING')
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
        {
          ...candidate().allocatedItems[0],
          id: 'item-1',
          status: 'REFUND_PENDING',
          settledAt: null,
          hasLegacySimulationMarker: true,
        },
      ],
    })
    expect(candidateSnapshotHash(after)).not.toBe(candidateSnapshotHash(before))
    expect(classifyCandidate(after).classification).toBe('NOT_A_CANDIDATE')
  })

  it.each([
    ['refund reconciliation', { refundReconcileStatus: 'NEEDS_REVIEW' }],
    ['order version', { orderVersion: 8 }],
    ['settlement status', { settlementStatus: 'OPEN' }],
    ['source allocation budget', { sourcePayment: { ...candidate().sourcePayment, version: 3 } }],
    ['inspection evidence', {
      allocatedItems: [
        {
          ...candidate().allocatedItems[0],
          inspection: { ...candidate().allocatedItems[0].inspection!, evidenceHash: 'changed-evidence' },
        },
      ],
    }],
    ['document ledger', {
      documents: [
        {
          id: 'document-1',
          documentType: 'RETURN_RECEIPT',
          snapshotHash: 'document-hash',
          issuedAt: '2026-10-23T12:05:00.000Z',
          version: 1,
        },
      ],
    }],
  ])('changes the canonical snapshot hash when %s changes', (_label, override) => {
    expect(candidateSnapshotHash(candidate(override as Partial<AuditCandidate>))).not.toBe(
      candidateSnapshotHash(candidate()),
    )
  })
})
