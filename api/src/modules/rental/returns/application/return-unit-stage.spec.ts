import {
  countReturnUnitStages,
  deriveReturnQueueStatus,
  deriveReturnUnitStage,
  isFinalEvidenceRequired,
  type ReturnUnitStageInput,
} from './return-unit-stage'

const base: ReturnUnitStageInput = {
  returnedFromCustomer: true,
  receivedByInventory: true,
  assignmentStatus: 'RETURNED',
  unitStatus: 'MAINTENANCE',
  preliminaryOutcome: 'NORMAL',
  finalOutcome: null,
}

describe('deriveReturnUnitStage', () => {
  it.each<[string, Partial<ReturnUnitStageInput>, string]>([
    ['not handed back by the customer', { returnedFromCustomer: false, preliminaryOutcome: null }, 'MISSING'],
    ['reported missing by Delivery', { preliminaryOutcome: 'MISSING_PENDING_REVIEW' }, 'MISSING'],
    ['still with Delivery', { receivedByInventory: false }, 'AWAITING_RECEIPT'],
    ['received, FINAL not done (unit parked in MAINTENANCE)', {}, 'AWAITING_FINAL_INSPECTION'],
    ['received after Delivery reported an issue', { preliminaryOutcome: 'ISSUE' }, 'AWAITING_FINAL_INSPECTION'],
    ['FINAL passed, cleaning', { finalOutcome: 'NORMAL', unitStatus: 'CLEANING' }, 'WAITING_CLEANING'],
    ['FINAL passed, back to AVAILABLE', { finalOutcome: 'NORMAL', unitStatus: 'AVAILABLE' }, 'READY'],
    ['FINAL damage, waiting on Admin', { finalOutcome: 'DAMAGE_CONFIRMED' }, 'AWAITING_ADMIN'],
    ['FINAL issue without priced rule, waiting on Admin', { finalOutcome: 'ISSUE' }, 'AWAITING_ADMIN'],
    [
      'damage settled and closed',
      { finalOutcome: 'DAMAGE_CONFIRMED', assignmentStatus: 'CLOSED', unitStatus: 'DAMAGED' },
      'CLOSED_DAMAGED',
    ],
    ['lost confirmed, not closed yet', { finalOutcome: 'LOST_CONFIRMED', returnedFromCustomer: false }, 'MISSING'],
    ['lost confirmed and closed', { finalOutcome: 'LOST_CONFIRMED', assignmentStatus: 'CLOSED' }, 'CLOSED_LOST'],
  ])('%s', (_label, patch, expected) => {
    expect(deriveReturnUnitStage({ ...base, ...patch })).toBe(expected)
  })
})

describe('isFinalEvidenceRequired (mirrors RB-API-605)', () => {
  it('requires evidence for deep-inspection products and units Delivery did not report as normal', () => {
    expect(isFinalEvidenceRequired({ requiresDeepReturnInspection: true, preliminaryOutcome: 'NORMAL' })).toBe(true)
    expect(isFinalEvidenceRequired({ requiresDeepReturnInspection: false, preliminaryOutcome: 'ISSUE' })).toBe(true)
    expect(isFinalEvidenceRequired({ requiresDeepReturnInspection: false, preliminaryOutcome: 'NORMAL' })).toBe(false)
    expect(isFinalEvidenceRequired({ requiresDeepReturnInspection: false, preliminaryOutcome: null })).toBe(false)
  })
})

describe('deriveReturnQueueStatus', () => {
  it('2 damaged + 2 normal units, all received, nothing inspected yet → waiting for FINAL, not Admin', () => {
    expect(deriveReturnQueueStatus(Array(4).fill('AWAITING_FINAL_INSPECTION'))).toBe('INVENTORY_RECEIVED')
  })

  it('after FINAL: cleaning work for Inventory comes before waiting on Admin', () => {
    const stages = ['WAITING_CLEANING', 'WAITING_CLEANING', 'AWAITING_ADMIN', 'AWAITING_ADMIN'] as const
    expect(deriveReturnQueueStatus([...stages])).toBe('WAITING_CLEANING')
    expect(deriveReturnQueueStatus(['READY', 'READY', 'AWAITING_ADMIN', 'AWAITING_ADMIN'])).toBe('REVIEW_REQUIRED')
  })

  it('anything still with Delivery comes first', () => {
    expect(deriveReturnQueueStatus(['AWAITING_RECEIPT', 'AWAITING_FINAL_INSPECTION'])).toBe('TRANSFER_PENDING')
  })

  it('missing units keep the case under review, closed units complete it', () => {
    expect(deriveReturnQueueStatus(['READY', 'MISSING'])).toBe('REVIEW_REQUIRED')
    expect(deriveReturnQueueStatus(['READY', 'CLOSED_DAMAGED', 'CLOSED_LOST'])).toBe('COMPLETED')
  })

  it('counts every stage', () => {
    expect(countReturnUnitStages(['READY', 'READY', 'MISSING'])).toMatchObject({
      READY: 2,
      MISSING: 1,
      AWAITING_ADMIN: 0,
    })
  })
})
