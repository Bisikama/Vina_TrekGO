import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from 'src/shared/services/prisma.service'
import { CreateDepositSettlementUseCase } from '../../application/use-cases/create-deposit-settlement.use-case'

const EXPECTED_DEFERRAL_REASONS = new Set([
  'USER_48H_REVIEW_WINDOW_NOT_CLOSED',
  'USER_DISPUTE_MUST_BE_RESOLVED',
  'EVIDENCE_ACCESS_INTERRUPTED',
])

/** Retry approved decisions through the same locked and audited 606 path. */
@Injectable()
export class RentalApprovedSettlementWorker {
  private readonly logger = new Logger(RentalApprovedSettlementWorker.name)
  private running = false
  private cursor?: string
  constructor(private readonly db: PrismaService, private readonly settlement: CreateDepositSettlementUseCase) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return
    this.running = true
    try {
      const items = await this.db.depositSettlementItem.findMany({
        where: { status: { in: ['DEDUCTION_APPROVED', 'DEDUCTION_REJECTED'] }, inspectionId: { not: null }, approvedBy: { not: null } },
        include: { settlement: true }, orderBy: { id: 'asc' }, take: 25,
        ...(this.cursor ? { cursor: { id: this.cursor }, skip: 1 } : {}),
      })
      this.cursor = items.length === 25 ? items[items.length - 1].id : undefined
      for (const item of items) {
        const snapshot = item.decisionSnapshot
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) continue
        const approvalRef = snapshot.approvalRef
        if (typeof approvalRef !== 'string' || !item.inspectionId || !item.approvedBy) continue
        try {
          await this.settlement.execute({ orderId: item.settlement.orderId, assessmentId: item.inspectionId,
            approvalRef, actorUserId: item.approvedBy, idempotencyKey: `auto-settlement:${item.id}:${approvalRef}`, now: new Date(),
            systemTriggered: true })
        } catch (error) {
          // Waiting for the customer window or a dispute is normal; anything else needs attention.
          const reason = (error as { details?: { reason?: string } }).details?.reason
          if (reason && EXPECTED_DEFERRAL_REASONS.has(reason))
            this.logger.debug(`Settlement deferred for item ${item.id}: ${reason}`)
          else this.logger.warn(`Settlement failed for item ${item.id}: ${(error as Error).message}${reason ? ` (${reason})` : ''}`)
        }
      }
    } finally { this.running = false }
  }
}
