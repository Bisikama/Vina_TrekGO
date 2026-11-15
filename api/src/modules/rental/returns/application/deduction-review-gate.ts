import { Prisma } from '@prisma/client'

/** Call while holding the rental order lock, so reviews and settlement serialize. */
export async function deductionReviewGate(
  tx: Prisma.TransactionClient,
  input: { orderId: string; inspectionId: string; assignmentId: string; reviewMinutes: number | null; now: Date },
): Promise<'USER_48H_REVIEW_WINDOW_NOT_CLOSED' | 'USER_DISPUTE_MUST_BE_RESOLVED' | 'EVIDENCE_ACCESS_INTERRUPTED' | null> {
  const openCase = await tx.rentalExceptionCase.findFirst({
    where: {
      orderId: input.orderId,
      status: { in: ['OPEN', 'UNDER_REVIEW'] },
      OR: [
        { assignmentId: input.assignmentId },
        { inspectionId: input.inspectionId },
        { assignmentId: null, inspectionId: null },
      ],
    },
    select: { id: true },
  })
  if (openCase) return 'USER_DISPUTE_MUST_BE_RESOLVED'

  // A dispute creates a new case; publication belongs to the original decision case.
  const published = await tx.rentalExceptionCase.findFirst({
    where: { orderId: input.orderId, inspectionId: input.inspectionId, evidenceAccessibleAt: { not: null } },
    orderBy: { evidenceAccessibleAt: 'desc' },
    select: { evidenceAccessibleAt: true, evidenceAccessBlockedAt: true, dueAt: true, customerAcceptedAt: true },
  })
  // RB-API-617: the customer saw the evidence and accepted the deduction, so nothing is left to wait for.
  if (published?.evidenceAccessibleAt && published.customerAcceptedAt) return null
  // A unit the customer never returned has no photos to publish. CONFIRM_LOST is only allowed
  // once the lost-confirmation window (>= 48h after the return deadline) has elapsed, which
  // already was the customer's chance to respond.
  if (!published) {
    const missingUnitLoss = await tx.rentalExceptionCase.findFirst({
      where: {
        orderId: input.orderId,
        inspectionId: input.inspectionId,
        caseType: 'RETURN_INCOMPLETE',
        status: 'RESOLVED',
        resolution: { startsWith: 'CONFIRM_LOST:' },
      },
      select: { id: true },
    })
    if (missingUnitLoss) return null
  }
  if (published?.evidenceAccessBlockedAt) return 'EVIDENCE_ACCESS_INTERRUPTED'
  if (!published?.evidenceAccessibleAt || !input.reviewMinutes || input.reviewMinutes <= 0 ||
      input.now.getTime() < (published.dueAt?.getTime() ?? published.evidenceAccessibleAt.getTime() + input.reviewMinutes * 60_000))
    return 'USER_48H_REVIEW_WINDOW_NOT_CLOSED'
  return null
}
