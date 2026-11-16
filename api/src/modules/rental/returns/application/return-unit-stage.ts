/**
 * Where one returned unit stands from the warehouse's point of view, derived from data that
 * already exists (inspections, inventory receipt, assignment, physical unit). Shared by the
 * staff return queue (RB-API-613) and the return detail (RB-API-614) so both always agree.
 */
export type ReturnUnitStage =
  | 'MISSING' // not handed back by the customer, or reported missing by Delivery
  | 'AWAITING_RECEIPT' // with Delivery, not yet received by Inventory
  | 'AWAITING_FINAL_INSPECTION' // received by Inventory, FINAL inspection still to do
  | 'AWAITING_ADMIN' // FINAL found an issue; exception/settlement is in Admin's hands
  | 'WAITING_CLEANING' // FINAL passed, waiting for cleaning + "ready" (RB-API-611)
  | 'READY' // back to AVAILABLE
  | 'CLOSED_DAMAGED' // damaged unit closed after settlement
  | 'CLOSED_LOST' // lost unit closed after Admin confirmation

export type ReturnQueueStatus =
  'TRANSFER_PENDING' | 'INVENTORY_RECEIVED' | 'WAITING_CLEANING' | 'REVIEW_REQUIRED' | 'COMPLETED'

export interface ReturnUnitStageInput {
  /** Customer handed the unit back (assignment.returnedAt). */
  returnedFromCustomer: boolean
  /** Inventory confirmed physical receipt (a return inspection task exists). */
  receivedByInventory: boolean
  assignmentStatus: string
  unitStatus: string
  preliminaryOutcome: string | null
  finalOutcome: string | null
}

const DAMAGED_FINAL = ['ISSUE', 'DAMAGE_CONFIRMED']

export function deriveReturnUnitStage(input: ReturnUnitStageInput): ReturnUnitStage {
  const closed = input.assignmentStatus === 'CLOSED'
  if (input.finalOutcome === 'LOST_CONFIRMED') return closed ? 'CLOSED_LOST' : 'MISSING'
  if (input.finalOutcome === 'NORMAL') return input.unitStatus === 'AVAILABLE' || closed ? 'READY' : 'WAITING_CLEANING'
  if (input.finalOutcome && DAMAGED_FINAL.includes(input.finalOutcome))
    return closed ? 'CLOSED_DAMAGED' : 'AWAITING_ADMIN'
  if (!input.returnedFromCustomer || input.preliminaryOutcome === 'MISSING_PENDING_REVIEW') return 'MISSING'
  if (!input.receivedByInventory) return 'AWAITING_RECEIPT'
  return 'AWAITING_FINAL_INSPECTION'
}

/**
 * Same rule RB-API-605 enforces: deep-inspection products, and units Delivery did not
 * report as normal, need at least one evidence photo at FINAL.
 */
export function isFinalEvidenceRequired(input: {
  requiresDeepReturnInspection: boolean
  preliminaryOutcome: string | null
}): boolean {
  return (
    input.requiresDeepReturnInspection || (input.preliminaryOutcome !== null && input.preliminaryOutcome !== 'NORMAL')
  )
}

/**
 * Queue status = the most urgent thing Inventory itself still has to do, then what it waits on.
 */
export function deriveReturnQueueStatus(stages: ReturnUnitStage[]): ReturnQueueStatus {
  if (stages.includes('AWAITING_RECEIPT')) return 'TRANSFER_PENDING'
  if (stages.includes('AWAITING_FINAL_INSPECTION')) return 'INVENTORY_RECEIVED'
  if (stages.includes('WAITING_CLEANING')) return 'WAITING_CLEANING'
  // Missing units never block the steps above, but they keep the case open until Admin decides.
  if (stages.includes('AWAITING_ADMIN') || stages.includes('MISSING')) return 'REVIEW_REQUIRED'
  return 'COMPLETED'
}

export function countReturnUnitStages(stages: ReturnUnitStage[]): Record<ReturnUnitStage, number> {
  const counts: Record<ReturnUnitStage, number> = {
    MISSING: 0,
    AWAITING_RECEIPT: 0,
    AWAITING_FINAL_INSPECTION: 0,
    AWAITING_ADMIN: 0,
    WAITING_CLEANING: 0,
    READY: 0,
    CLOSED_DAMAGED: 0,
    CLOSED_LOST: 0,
  }
  for (const stage of stages) counts[stage] += 1
  return counts
}
