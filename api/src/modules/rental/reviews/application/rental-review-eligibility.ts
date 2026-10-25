import {
  RentalFinancialStatus,
  RentalOrderStatus,
  RentalUnitAssignmentStatus,
} from '@prisma/client'

const HANDED_OVER_ASSIGNMENT_STATUSES = new Set<RentalUnitAssignmentStatus>([
  RentalUnitAssignmentStatus.HANDED_OVER,
  RentalUnitAssignmentStatus.RETURNED,
  RentalUnitAssignmentStatus.CLOSED,
])

export function isReviewableOrder(
  status: RentalOrderStatus,
  financialStatus: RentalFinancialStatus,
): boolean {
  return (
    status === RentalOrderStatus.COMPLETED &&
    financialStatus === RentalFinancialStatus.SETTLED
  )
}

export function hasActualProductHandover(
  hasOrderHandover: boolean,
  assignments: Array<{ status: RentalUnitAssignmentStatus; handedOverAt: Date | null }>,
): boolean {
  return (
    hasOrderHandover &&
    assignments.some(
      (assignment) =>
        assignment.handedOverAt !== null && HANDED_OVER_ASSIGNMENT_STATUSES.has(assignment.status),
    )
  )
}
