import { Inject, Injectable, Logger } from '@nestjs/common'
import { RENTAL_RETURN_PORT, type AcceptAssessmentCommand, type RentalReturnPort } from '../ports/rental-return.port'

/**
 * RB-API-617: customer accepts a published deduction, then the deposit is settled right away
 * through RB-API-606 (as the Admin who approved it), instead of waiting for the 48h window.
 * If settlement cannot run yet, RentalApprovedSettlementWorker retries it every minute.
 */
@Injectable()
export class AcceptAssessmentUseCase {
  private readonly logger = new Logger(AcceptAssessmentUseCase.name)

  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}

  async execute(command: AcceptAssessmentCommand) {
    const accepted = await this.port.acceptAssessment(command)
    if (!accepted.settlement) return { ...accepted, settlement: null, settlementStatus: 'DEFERRED' as const }
    const { orderId, assessmentId, approvalRef, approvedBy, depositItemId } = accepted.settlement
    try {
      const settlement = await this.port.createDepositSettlement({
        orderId,
        assessmentId,
        approvalRef,
        actorUserId: approvedBy,
        // Same key as the worker uses, so the two can never settle the item twice.
        idempotencyKey: `auto-settlement:${depositItemId}:${approvalRef}`,
        now: new Date(),
        systemTriggered: true,
      })
      return {
        caseId: accepted.caseId,
        assessmentId,
        acceptedAt: accepted.acceptedAt,
        settlementStatus: 'SETTLED' as const,
        settlement: {
          status: settlement.status,
          deductionAmount: settlement.deductionAmount,
          refundAmount: settlement.refundAmount,
        },
      }
    } catch (error) {
      this.logger.warn(`Settlement after acceptance deferred for item ${depositItemId}: ${(error as Error).message}`)
      return {
        caseId: accepted.caseId,
        assessmentId,
        acceptedAt: accepted.acceptedAt,
        settlementStatus: 'DEFERRED' as const,
        settlement: null,
      }
    }
  }
}
