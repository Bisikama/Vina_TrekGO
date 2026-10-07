import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../shared/errors'
import { paymentHash } from './payment-utils'

export type DepositRefundCommand = {
  paymentId: string
  purpose: 'DEPOSIT'
  businessActionId: string
  amount: string
  idempotencyKey: string
  source: { depositSettlementId: string; depositSettlementItemId: string }
  allocations: { paymentAllocationId: string; amount: string }[]
}

@Injectable()
export class RentalRefundsService {
  constructor(private readonly db: PrismaService) {}
  async reserve(input: DepositRefundCommand) {
    const action = `deposit-item:${input.source.depositSettlementItemId}:refund:v1`
    if (
      input.businessActionId !== action ||
      input.allocations.length !== 1 ||
      input.allocations[0].amount !== input.amount
    )
      throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
    const requestHash = paymentHash({ ...input, idempotencyKey: undefined })
    const key = paymentHash(['refund', input.paymentId, input.idempotencyKey])
    return this.db.$transaction(async (tx) => {
      const initial = await tx.depositSettlementItem.findUnique({
        where: { id: input.source.depositSettlementItemId },
        include: { settlement: true },
      })
      if (!initial) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${initial.settlement.orderId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlements WHERE id=${initial.settlementId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlement_items WHERE settlement_id=${initial.settlementId}::uuid ORDER BY id FOR UPDATE`
      const item = await tx.depositSettlementItem.findUniqueOrThrow({
        where: { id: initial.id },
        include: {
          settlement: { include: { order: true } },
          assignment: { include: { orderLine: true } },
          inspection: true,
        },
      })
      const p = await tx.payment.findUnique({ where: { id: input.paymentId } })
      if (!p) throw AppError.fromCode(E.PAYMENT_NOT_FOUND)
      await tx.$queryRaw`SELECT id FROM invoices WHERE id=${p.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id=${p.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_allocations WHERE payment_id=${p.id}::uuid ORDER BY id FOR UPDATE`
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: p.id },
        include: { invoice: true, application: true, allocations: true },
      })
      const line = item.assignment.orderLine
      if (
        item.settlementId !== initial.settlementId ||
        item.settlement.orderId !== initial.settlement.orderId ||
        input.source.depositSettlementId !== item.settlementId ||
        line.orderId !== item.settlement.orderId ||
        item.assignment.equipmentUnitId !== item.unitId ||
        payment.invoiceId !== p.invoiceId ||
        payment.invoice.invoiceType !== 'RENTAL' ||
        payment.invoice.rentalOrderId !== line.orderId ||
        payment.invoice.userId !== item.settlement.order.userId ||
        item.settlement.rentalPolicyId !== item.settlement.order.rentalPolicyId
      )
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      const previous = await tx.refund.findFirst({
        where: {
          OR: [
            { idempotencyKey: key },
            { depositSettlementItemId: item.id },
            { paymentId: p.id, businessActionId: action },
          ],
        },
      })
      if (previous) {
        if (previous.requestHash !== requestHash || previous.requestHashVersion !== 1)
          throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return previous
      }
      const allocation = payment.allocations.find((a) => a.id === input.allocations[0].paymentAllocationId)
      if (
        payment.status !== 'SUCCEEDED' ||
        payment.application?.status !== 'APPLIED' ||
        payment.application.invoiceId !== payment.invoiceId ||
        payment.reconcileStatus === 'NEEDS_REVIEW' ||
        !payment.providerEnvironment ||
        !payment.merchantAccountKey ||
        !payment.merchantRequestRef ||
        payment.currency !== 'VND' ||
        item.settlement.order.currency !== 'VND' ||
        !['RETURN_PENDING', 'RETURN_PROCESSING', 'COMPLETED'].includes(item.settlement.order.status) ||
        !item.approvedAt ||
        !item.approvedBy ||
        !item.decisionSnapshot ||
        !['DEDUCTION_APPROVED', 'DEDUCTION_REJECTED', 'REFUND_PENDING'].includes(item.status) ||
        !item.inspection ||
        ['ISSUE', 'MISSING_PENDING_REVIEW'].includes(item.inspection.outcome) ||
        item.inspection.orderId !== line.orderId ||
        item.inspection.assignmentId !== item.assignmentId ||
        item.inspection.unitId !== item.unitId ||
        !item.depositAmount.equals(line.depositPerUnitSnapshot) ||
        !item.deductionAmount.plus(item.refundAmount).equals(item.depositAmount) ||
        !item.refundAmount.equals(input.amount) ||
        !allocation ||
        allocation.rentalOrderLineId !== line.id ||
        allocation.component !== 'RENTAL_DEPOSIT' ||
        !allocation.amount.equals(line.lineDeposit) ||
        !payment.allocations.reduce((n, a) => n.plus(a.amount), new Prisma.Decimal(0)).equals(payment.amount) ||
        (await tx.refund.findFirst({ where: { paymentId: p.id, reconcileStatus: 'NEEDS_REVIEW' } })) ||
        (await tx.rentalExceptionCase.findFirst({
          where: {
            orderId: line.orderId,
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
      // Per-unit approval keeps deductions and every other held/reviewed item's deposit unavailable.
      const siblings = await tx.depositSettlementItem.findMany({ where: { assignment: { orderLineId: line.id } } })
      if (
        siblings.length > line.quantity ||
        siblings.some((s) => !s.depositAmount.equals(line.depositPerUnitSnapshot)) ||
        siblings.reduce((n, s) => n.plus(s.depositAmount), new Prisma.Decimal(0)).gt(allocation.amount)
      )
        throw AppError.fromCode(E.REFUND_AMOUNT_EXCEEDED)
      const reserved = await tx.refund.aggregate({
        where: { paymentId: p.id, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
        _sum: { amount: true },
      })
      const allocated = await tx.refundAllocation.aggregate({
        where: {
          paymentAllocationId: allocation.id,
          refund: { status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
        },
        _sum: { amount: true },
      })
      const deductions = siblings.reduce((n, s) => n.plus(s.deductionAmount), new Prisma.Decimal(0))
      const amount = new Prisma.Decimal(input.amount)
      if (
        amount.gt(payment.amount.minus(reserved._sum.amount ?? 0)) ||
        amount.gt(allocation.amount.minus(allocated._sum.amount ?? 0).minus(deductions))
      )
        throw AppError.fromCode(E.REFUND_AMOUNT_EXCEEDED)
      const id = randomUUID()
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const refund = await tx.refund.create({
        data: {
          id,
          paymentId: p.id,
          purpose: 'DEPOSIT',
          businessActionId: action,
          amount,
          currency: payment.currency,
          depositSettlementId: item.settlementId,
          depositSettlementItemId: item.id,
          idempotencyKey: key,
          requestHash,
          requestHashVersion: 1,
          paymentGateway: payment.paymentGateway,
          providerEnvironment: payment.providerEnvironment,
          merchantAccountKey: payment.merchantAccountKey,
          merchantRefundRef: `refund:${id}`,
          reconcileStatus: 'SCHEDULED',
          nextRetryAt: now,
          allocations: { create: { paymentAllocationId: allocation.id, amount } },
        },
      })
      await tx.depositSettlementItem.update({
        where: { id: item.id },
        data: { status: 'REFUND_PENDING', version: { increment: 1 } },
      })
      await tx.rentalOrder.update({
        where: { id: line.orderId },
        data: { financialStatus: 'REFUND_PENDING', version: { increment: 1 } },
      })
      return refund
    })
  }
}
