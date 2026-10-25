import { RentalOrderStatus, RentalUnitAssignmentStatus } from '@prisma/client'

const REVIEWABLE_ORDER_STATUSES = new Set<RentalOrderStatus>([
  RentalOrderStatus.ACTIVE,
  RentalOrderStatus.RETURN_PENDING,
  RentalOrderStatus.RETURN_PROCESSING,
  RentalOrderStatus.COMPLETED,
])

const HANDED_OVER_ASSIGNMENT_STATUSES = new Set<RentalUnitAssignmentStatus>([
  RentalUnitAssignmentStatus.HANDED_OVER,
  RentalUnitAssignmentStatus.RETURNED,
  RentalUnitAssignmentStatus.CLOSED,
])

export function isReviewableOrderStatus(status: RentalOrderStatus): boolean {
  return REVIEWABLE_ORDER_STATUSES.has(status)
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
