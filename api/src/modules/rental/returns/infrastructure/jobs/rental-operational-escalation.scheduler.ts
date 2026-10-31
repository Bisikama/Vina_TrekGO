import { Cron, CronExpression } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { CustodyTransferStatus, EventStatus, RentalExceptionCaseStatus, RentalOrderExceptionStatus, RentalOrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import { tryCompleteOrder } from '../adapters/prisma-rental-return.adapter';
import envConfig from 'src/shared/config';
import { emitGradeShortageDeadlineAlerts } from '../../../inventory/infrastructure/grade-shortage-deadline';

/** Periodic monitoring only. NEVER mutates custody/inspection/approval/refund outcomes. */
@Injectable()
export class RentalOperationalEscalationScheduler {
 private readonly log = new Logger(RentalOperationalEscalationScheduler.name);
 private closureCursor?: string;
 constructor(private readonly db: PrismaService) {}
 @Cron(CronExpression.EVERY_MINUTE)
 async check() {
  const now=new Date();
  const transfers=await this.db.returnCustodyTransfer.findMany({where:{status:CustodyTransferStatus.PENDING_RECEIPT,transferWatchAt:{lte:now},delayedAt:null},take:100});
  for(const t of transfers) {
   await this.db.$transaction(async tx=>{
    const changed=await tx.returnCustodyTransfer.updateMany({where:{id:t.id,status:CustodyTransferStatus.PENDING_RECEIPT,delayedAt:null,transferWatchAt:{lte:now}},data:{delayedAt:now,monitoringStatus:'TRANSFER_DELAYED'}});
    if (!changed.count) return;
    await tx.rentalOrder.update({where:{id:t.orderId},data:{exceptionStatus:RentalOrderExceptionStatus.ACTION_REQUIRED}});
    await this.emit(tx,`transfer-delay:${t.id}`,t.orderId,{kind:'TRANSFER_DELAYED',transferId:t.id,inventoryLocationId:t.inventoryLocationId,unreceivedUnitIds:(t.unitIds as string[]).filter(x=>!(t.receivedUnitIds as string[]||[]).includes(x)),watchAt:t.transferWatchAt?.toISOString()});
    this.log.warn(`Return transfer delayed: ${t.id}`);
   });
  }
  const cases=await this.db.rentalExceptionCase.findMany({where:{status:{in:[RentalExceptionCaseStatus.OPEN,RentalExceptionCaseStatus.UNDER_REVIEW]},evidenceCompleteAt:{not:null},adminApprovalDueAt:{lte:now},adminSlaBreachedAt:null},take:100});
  for(const c of cases) {
   await this.db.$transaction(async tx=>{
    const changed=await tx.rentalExceptionCase.updateMany({where:{id:c.id,status:{in:[RentalExceptionCaseStatus.OPEN,RentalExceptionCaseStatus.UNDER_REVIEW]},adminApprovalDueAt:{lte:now},adminSlaBreachedAt:null},data:{adminSlaBreachedAt:now,adminReviewStatus:'SLA_BREACHED'}});
    if (!changed.count) return;
    await tx.rentalOrder.update({where:{id:c.orderId},data:{exceptionStatus:RentalOrderExceptionStatus.ACTION_REQUIRED}});
    await this.emit(tx,`admin-sla:${c.id}`,c.orderId,{kind:'ADMIN_DEDUCTION_SLA_BREACHED',caseId:c.id,approvalDueAt:c.adminApprovalDueAt?.toISOString()});
    this.log.warn(`Admin deduction review SLA breached: ${c.id}`);
   });
  }

  // Đơn vẫn thiếu hàng do hạ hạng và sắp tới giờ nhận đồ: nhắc ADMIN/STAFF_INVENTORY qua outbox (khách chưa được báo).
  try {
    const alerted = await emitGradeShortageDeadlineAlerts(this.db, { now, alertHours: envConfig.GRADE_SHORTAGE_ALERT_HOURS });
    if (alerted.length) this.log.warn(`Grade shortage near handover: ${alerted.length} order(s)`);
  } catch (err) {
    this.log.warn(`Grade shortage deadline sweep deferred: ${(err as Error).message}`);
  }

  // Phase 09 Order Closure Sweep: Reconciles candidate orders stuck in RETURN_PROCESSING / RETURN_PENDING
  const candidateOrders = await this.db.rentalOrder.findMany({
    where: { status: { in: [RentalOrderStatus.RETURN_PROCESSING, RentalOrderStatus.RETURN_PENDING] } },
    select: { id: true },
    take: 50,
    skip: this.closureCursor ? 1 : 0,
    cursor: this.closureCursor ? { id: this.closureCursor } : undefined,
    orderBy: { id: 'asc' },
  });
  if (candidateOrders.length > 0) {
    this.closureCursor = candidateOrders[candidateOrders.length - 1].id;
  } else {
    this.closureCursor = undefined;
  }
  for (const cand of candidateOrders) {
    await this.db.$transaction(async (tx) => {
      await tryCompleteOrder(tx, cand.id, now);
    }).catch((err) => {
      this.log.warn(`Order closure sweep deferred for order ${cand.id}: ${err.message}`);
    });
  }
 }
 private async emit(tx:Prisma.TransactionClient,key:string,orderId:string,payload:Record<string,unknown>) {
  await tx.rentalOutboxEvent.upsert({where:{deduplicationKey:key},update:{},create:{deduplicationKey:key,eventType:'RENTAL_ACTION_REQUIRED',aggregateType:'RentalOrder',aggregateId:orderId,payload:payload as Prisma.InputJsonValue,status:EventStatus.PENDING}});
 }
}
