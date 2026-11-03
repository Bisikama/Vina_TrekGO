import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from 'src/shared/services/prisma.service'
import { CreateDepositSettlementUseCase } from '../../application/use-cases/create-deposit-settlement.use-case'

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
            approvalRef, actorUserId: item.approvedBy, idempotencyKey: `auto-settlement:${item.id}:${approvalRef}`, now: new Date() })
        } catch (error) {
          this.logger.debug(`Settlement deferred for item ${item.id}: ${(error as Error).message}`)
        }
      }
    } finally { this.running = false }
  }
}
