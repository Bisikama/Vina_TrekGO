export const RENTAL_SYSTEM_FAULT_CANCELLATION_PORT = Symbol('RENTAL_SYSTEM_FAULT_CANCELLATION_PORT')

export const SYSTEM_FAULT_REASON_CODES = [
  'GRADE_DOWNGRADE_CAPACITY_SHORTAGE',
  'SYSTEM_MISSING_EQUIPMENT',
  'SYSTEM_DAMAGED_EQUIPMENT',
  'OTHER_SYSTEM_FAULT',
] as const
export type SystemFaultReasonCode = (typeof SYSTEM_FAULT_REASON_CODES)[number]

/** Giá trị `reason` của event RENTAL_ORDER_CANCELLED; notification consumer dựa vào đây để báo khách. */
export { SYSTEM_FAULT_CANCELLATION_REASON } from '../../../../../shared/constants/rental-event-reasons.constant'

export interface CancelRentalOrderSystemFaultCommand {
  orderId: string
  actorUserId: string
  idempotencyKey: string
  reasonCode: SystemFaultReasonCode
  note: string
  expectedVersion: number
}

export interface CancelRentalOrderSystemFaultResult {
  order: {
    id: string
    status: string
    financialStatus: string
    exceptionStatus: string
    cancelledAt: string
    version: number
  }
  refund: { refundRef: string; amount: number; feeRefund: number; depositRefund: number; status: string }
  releasedUnitIds: string[]
  unsafeUnits: Array<{ unitId: string; reason: string }>
}

export interface RentalSystemFaultCancellationPort {
  cancel(command: CancelRentalOrderSystemFaultCommand): Promise<CancelRentalOrderSystemFaultResult>
}
