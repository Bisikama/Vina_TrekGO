import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../shared/services/prisma.service'
import { PaymentsPort } from '../../payments/payments.port'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../../shared/errors'
import { updateSettlementProgress } from './settlement-progress'

@Injectable()
export class RentalDepositWorker {
  private running = false
  private itemCursor: string | undefined
  private readonly logger = new Logger(RentalDepositWorker.name)
  constructor(
    private readonly db: PrismaService,
    private readonly payments: PaymentsPort,
  ) {}

  async dispatch(itemId: string) {
    const item = await this.db.depositSettlementItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { settlement: true, assignment: true },
    })
    if (item.refundAmount.isZero()) return this.settleRetained(itemId)
    const payment = await this.db.payment.findFirst({
      where: { application: { status: 'APPLIED' }, invoice: { rentalOrderId: item.settlement.orderId },
        allocations: { some: { rentalOrderLineId: item.assignment.orderLineId, component: 'RENTAL_DEPOSIT' } } },
      include: { allocations: true },
    })
    const allocation = payment?.allocations.find(
      (a) => a.rentalOrderLineId === item.assignment.orderLineId && a.component === 'RENTAL_DEPOSIT',
    )
    if (!payment || !allocation || !item.refundAmount.isPositive()) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
    const action = `deposit-item:${item.id}:refund:v1`
    return this.payments.requestRefund({
      paymentId: payment.id,
      purpose: 'DEPOSIT',
      businessActionId: action,
      amount: item.refundAmount.toFixed(),
      idempotencyKey: action,
      source: { depositSettlementId: item.settlementId, depositSettlementItemId: item.id },
      allocations: [{ paymentAllocationId: allocation.id, amount: item.refundAmount.toFixed() }],
    })
  }

  private async settleRetained(itemId: string): Promise<null> {
    return this.db.$transaction(async (tx) => {
      const initial = await tx.depositSettlementItem.findUniqueOrThrow({
        where: { id: itemId },
        include: { settlement: true },
      })
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${initial.settlement.orderId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlements WHERE id=${initial.settlementId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlement_items WHERE settlement_id=${initial.settlementId}::uuid ORDER BY id FOR UPDATE`
      const item = await tx.depositSettlementItem.findUniqueOrThrow({
        where: { id: itemId },
        include: {
          settlement: { include: { order: true } },
          inspection: true,
          assignment: { include: { orderLine: true } },
          refundViaDepositSettlementItemId: true,
        },
      })
      if (
        item.settlementId !== initial.settlementId ||
        item.settlement.orderId !== initial.settlement.orderId ||
        !item.refundAmount.isZero() ||
        !item.depositAmount.gt(0) ||
        !item.deductionAmount.equals(item.depositAmount) ||
        item.assignment.orderLine.orderId !== item.settlement.orderId ||
        item.assignment.equipmentUnitId !== item.unitId ||
        !item.depositAmount.equals(item.assignment.orderLine.depositPerUnitSnapshot) ||
        item.refundViaDepositSettlementItemId ||
        !item.approvedBy ||
        !item.approvedAt ||
        !item.decisionSnapshot ||
        !['DEDUCTION_APPROVED', 'SETTLED'].includes(item.status) ||
        !['RETURN_PENDING', 'RETURN_PROCESSING', 'COMPLETED'].includes(item.settlement.order.status) ||
        !item.inspection ||
        item.inspection.orderId !== item.settlement.orderId ||
        item.inspection.assignmentId !== item.assignmentId ||
        item.inspection.unitId !== item.unitId ||
        !['DAMAGE_CONFIRMED', 'LOST_CONFIRMED'].includes(item.inspection.outcome) ||
        (await tx.rentalExceptionCase.findFirst({
          where: {
            orderId: item.settlement.orderId,
            status: { in: ['OPEN', 'UNDER_REVIEW'] },
            OR: [
              { assignmentId: item.assignmentId },
              { inspectionId: item.inspectionId },
              { assignmentId: null, inspectionId: null },
            ],
          },
        }))
      )
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      if (item.status === 'SETTLED') return null
      const payment = await tx.payment.findFirst({
        where: {
          invoice: { rentalOrderId: item.settlement.orderId },
          application: { status: 'APPLIED' },
          status: 'SUCCEEDED',
        },
        include: { allocations: true },
      })
      if (
        !payment ||
        !payment.allocations.some(
          (a) =>
            a.rentalOrderLineId === item.assignment.orderLineId &&
            a.component === 'RENTAL_DEPOSIT' &&
            a.amount.equals(item.assignment.orderLine.lineDeposit),
        )
      )
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      await tx.depositSettlementItem.update({
        where: { id: item.id },
        data: { status: 'SETTLED', settledAt: now, version: { increment: 1 } },
      })
      await updateSettlementProgress(tx, item.settlementId, now)
      await tx.rentalOutboxEvent.create({
        data: {
          deduplicationKey: `deposit-item:${item.id}:retained:v1`,
          eventType: 'DEPOSIT_RETAINED',
          aggregateType: 'DepositSettlementItem',
          aggregateId: item.id,
          payload: {
            schemaVersion: 1,
            itemId: item.id,
            settlementId: item.settlementId,
            orderId: item.settlement.orderId,
            amount: item.deductionAmount.toFixed(),
          },
        },
      })
      return null
    })
  }

  async consume(eventId: string) {
    await this.db.$transaction(async (tx) => {
      const e = await tx.paymentOutboxEvent.findUnique({ where: { id: eventId } })
      if (!e || !['REFUND_SUCCEEDED', 'REFUND_FAILED'].includes(e.eventType) || e.aggregateType !== 'Refund') return
      const initial = await tx.refund.findUnique({ where: { id: e.aggregateId }, include: { depositSettlement: true } })
      if (!initial || initial.purpose !== 'DEPOSIT' || !initial.depositSettlement || !initial.depositSettlementItemId)
        return
      const orderId = initial.depositSettlement.orderId,
        settlementId = initial.depositSettlement.id
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${orderId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlements WHERE id=${settlementId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlement_items WHERE settlement_id=${settlementId}::uuid ORDER BY id FOR UPDATE`
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: initial.paymentId } })
      await tx.$queryRaw`SELECT id FROM invoices WHERE id=${payment.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id=${payment.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM refunds WHERE id=${initial.id}::uuid FOR UPDATE`
      const claimed = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM payment_outbox_events WHERE id=${eventId}::uuid AND status='PENDING'
        AND (next_retry_at IS NULL OR next_retry_at<=clock_timestamp()) FOR UPDATE SKIP LOCKED`
      if (!claimed.length) return
      const event = await tx.paymentOutboxEvent.findUniqueOrThrow({ where: { id: eventId } })
      const refund = await tx.refund.findUniqueOrThrow({
        where: { id: initial.id },
        include: {
          payment: { include: { invoice: true, application: true } },
          allocations: { include: { paymentAllocation: true } },
        },
      })
      const item = await tx.depositSettlementItem.findUniqueOrThrow({
        where: { id: initial.depositSettlementItemId },
        include: { assignment: true },
      })
      const payload = event.payload as Prisma.JsonObject
      if (
        refund.depositSettlementId !== settlementId ||
        refund.depositSettlementItemId !== item.id ||
        item.settlementId !== settlementId ||
        refund.paymentId !== payment.id ||
        refund.payment.invoiceId !== payment.invoiceId ||
        refund.payment.invoice.rentalOrderId !== orderId ||
        refund.payment.application?.status !== 'APPLIED' ||
        payload.schemaVersion !== 1 ||
        payload.refundId !== refund.id ||
        event.eventType !== `REFUND_${refund.status}` ||
        refund.allocations.length !== 1 ||
        refund.allocations[0].paymentAllocation.component !== 'RENTAL_DEPOSIT' ||
        refund.allocations[0].paymentAllocation.rentalOrderLineId !== item.assignment.orderLineId ||
        refund.allocations[0].paymentAllocation.paymentId !== payment.id ||
        !refund.allocations[0].amount.equals(refund.amount) ||
        !item.refundAmount.equals(refund.amount) ||
        !item.deductionAmount.plus(item.refundAmount).equals(item.depositAmount)
      )
        throw new Error('Rental refund result does not match approved item')
      const receipt = await tx.paymentConsumerReceipt.findUnique({
        where: { eventId_consumerName: { eventId, consumerName: 'rental-deposit-v1' } },
      })
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      if (!receipt) {
        await tx.depositSettlementItem.update({
          where: { id: item.id },
          data: {
            status: refund.status === 'SUCCEEDED' ? 'SETTLED' : 'REFUND_FAILED',
            settledAt: refund.status === 'SUCCEEDED' ? now : null,
            version: { increment: 1 },
          },
        })
        await updateSettlementProgress(tx, settlementId, now)
        const total = await tx.refund.aggregate({
          where: { paymentId: payment.id, status: 'SUCCEEDED' },
          _sum: { amount: true },
        })
        const pending = await tx.refund.count({
          where: { paymentId: payment.id, status: { in: ['PENDING', 'PROCESSING'] } },
        })
        const refunded = total._sum.amount ?? new Prisma.Decimal(0)
        await tx.rentalOrder.update({
          where: { id: orderId },
          data: {
            financialStatus: pending
              ? 'REFUND_PENDING'
              : refunded.equals(payment.amount)
                ? 'REFUNDED'
                : refunded.gt(0)
                  ? 'PARTIALLY_REFUNDED'
                  : 'PAID',
            version: { increment: 1 },
          },
        })
        await tx.rentalOutboxEvent.create({
          data: {
            deduplicationKey: `deposit-item:${item.id}:${refund.status.toLowerCase()}:v1`,
            eventType: refund.status === 'SUCCEEDED' ? 'DEPOSIT_REFUND_SUCCEEDED' : 'DEPOSIT_REFUND_FAILED',
            aggregateType: 'DepositSettlementItem',
            aggregateId: item.id,
            payload: {
              schemaVersion: 1,
              orderId,
              settlementId,
              itemId: item.id,
              refundId: refund.id,
              amount: refund.amount.toFixed(),
            },
          },
        })
        await tx.paymentConsumerReceipt.create({ data: { eventId, consumerName: 'rental-deposit-v1' } })
      }
      await tx.paymentOutboxEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSED', processedAt: now, lastError: null, nextRetryAt: null },
      })
    })
  }

  @Interval(2000)
  async tick() {
    if (this.running || process.env.PAYMENT_EVENTS_WORKER_ENABLED === 'false') return
    this.running = true
    try {
      const items = await this.db.depositSettlementItem.findMany({
        where: {
          ...(this.itemCursor ? { id: { gt: this.itemCursor } } : {}),
          status: { in: ['DEDUCTION_APPROVED', 'DEDUCTION_REJECTED', 'REFUND_PENDING'] },
          approvedAt: { not: null },
          refundAmount: { gte: 0 },
          refundViaDepositSettlementItemId: { is: null },
        },
        orderBy: { id: 'asc' },
        take: 25,
      })
      // Rotate across failed approvals so one invalid batch cannot starve later items.
      this.itemCursor = items.length === 25 ? items[items.length - 1].id : undefined
      for (const item of items)
        try {
          await this.dispatch(item.id)
        } catch {
          this.logger.warn(`Approved deposit refund deferred: ${item.id}`)
        }
      const events = await this.db.$queryRaw<
        { id: string }[]
      >`SELECT e.id FROM payment_outbox_events e JOIN refunds r ON r.id=e.aggregate_id
        WHERE e.aggregate_type='Refund' AND e.event_type IN ('REFUND_SUCCEEDED','REFUND_FAILED') AND e.status='PENDING' AND r.purpose='DEPOSIT'
        AND (e.next_retry_at IS NULL OR e.next_retry_at<=clock_timestamp()) ORDER BY e.created_at,e.id LIMIT 25`
      for (const event of events)
        try {
          await this.consume(event.id)
        } catch {
          await this.db.$executeRaw`UPDATE payment_outbox_events SET retry_count=retry_count+1,
          status=CASE WHEN retry_count>=7 THEN 'FAILED'::event_status ELSE 'PENDING'::event_status END,
          next_retry_at=clock_timestamp()+interval '30 seconds',last_error='RENTAL_REFUND_APPLICATION_DEFERRED'
          WHERE id=${event.id}::uuid AND status='PENDING'`
        }
    } catch {
      this.logger.warn('Rental deposit worker unavailable; decisions retained')
    } finally {
      this.running = false
    }
  }
}
