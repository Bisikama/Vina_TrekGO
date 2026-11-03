import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../shared/errors'
import { paymentHash } from './payment-utils'
import { deductionReviewGate } from '../rental/returns/application/deduction-review-gate'

export type DepositRefundCommand = {
  paymentId: string
  purpose: 'DEPOSIT'
  businessActionId: string
  amount: string
  idempotencyKey: string
  source: {
    depositSettlementId: string
    depositSettlementItemId?: string
    depositSettlementItemIds?: string[]
  }
  allocations: { paymentAllocationId: string; amount: string }[]
  itemAllocations?: { depositSettlementItemId: string; amount: string }[]
}

@Injectable()
export class RentalRefundsService {
  constructor(private readonly db: PrismaService) {}

  async reserve(input: DepositRefundCommand) {
    const itemAllocations =
      input.itemAllocations && input.itemAllocations.length > 0
        ? input.itemAllocations
        : input.source.depositSettlementItemId
          ? [{ depositSettlementItemId: input.source.depositSettlementItemId, amount: input.amount }]
          : []
    if (itemAllocations.length === 0) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)

    const amountDecimal = new Prisma.Decimal(input.amount)
    if (!amountDecimal.isPositive()) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)

    const sumAllocations = input.allocations.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0))
    if (!sumAllocations.equals(amountDecimal)) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)

    const sumItemAllocations = itemAllocations.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0))
    if (!sumItemAllocations.equals(amountDecimal)) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)

    const requestHash = paymentHash({ ...input, idempotencyKey: undefined })
    const key = paymentHash(['refund', input.paymentId, input.idempotencyKey])

    return this.db.$transaction(
      async (tx) => {
      const itemIds = itemAllocations.map((a) => a.depositSettlementItemId)
      const initialItems = await tx.depositSettlementItem.findMany({
        where: { id: { in: itemIds } },
        include: { settlement: true },
      })
      if (initialItems.length !== itemIds.length) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)

      const settlementId = initialItems[0].settlementId
      const orderId = initialItems[0].settlement.orderId
      if (initialItems.some((i) => i.settlementId !== settlementId || i.settlement.orderId !== orderId))
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      if (input.source.depositSettlementId !== settlementId)
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)

      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${orderId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlements WHERE id=${settlementId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlement_items WHERE settlement_id=${settlementId}::uuid ORDER BY id FOR UPDATE`

      const items = await tx.depositSettlementItem.findMany({
        where: { id: { in: itemIds } },
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

      const previous = await tx.refund.findFirst({
        where: {
          OR: [
            { idempotencyKey: key },
            { paymentId: p.id, businessActionId: input.businessActionId },
            ...(itemAllocations.length === 1
              ? [{ depositSettlementItemId: itemAllocations[0].depositSettlementItemId }]
              : []),
          ],
        },
      })
      if (previous) {
        if (previous.requestHash !== requestHash || previous.requestHashVersion !== 1)
          throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return previous
      }

      if (
        payment.status !== 'SUCCEEDED' ||
        payment.application?.status !== 'APPLIED' ||
        payment.application.invoiceId !== payment.invoiceId ||
        payment.reconcileStatus === 'NEEDS_REVIEW' ||
        !payment.providerEnvironment ||
        !payment.merchantAccountKey ||
        !payment.merchantRequestRef ||
        payment.currency !== 'VND' ||
        payment.invoice.invoiceType !== 'RENTAL' ||
        payment.invoice.rentalOrderId !== orderId ||
        payment.invoice.userId !== items[0].settlement.order.userId
      )
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)

      for (const item of items) {
        const line = item.assignment.orderLine
        const itemAlloc = itemAllocations.find((a) => a.depositSettlementItemId === item.id)!
        if (
          line.orderId !== orderId ||
          item.assignment.equipmentUnitId !== item.unitId ||
          !['RETURN_PENDING', 'RETURN_PROCESSING', 'COMPLETED'].includes(item.settlement.order.status) ||
          !item.approvedAt ||
          !item.approvedBy ||
          !item.decisionSnapshot ||
          !['DEDUCTION_APPROVED', 'DEDUCTION_REJECTED', 'REFUND_PENDING'].includes(item.status) ||
          !item.inspection ||
          ['ISSUE', 'MISSING_PENDING_REVIEW'].includes(item.inspection.outcome) ||
          item.inspection.orderId !== orderId ||
          item.inspection.assignmentId !== item.assignmentId ||
          item.inspection.unitId !== item.unitId ||
          !item.depositAmount.equals(line.depositPerUnitSnapshot) ||
          !item.deductionAmount.plus(item.refundAmount).equals(item.depositAmount) ||
          !item.refundAmount.equals(itemAlloc.amount)
        )
          throw AppError.fromCode(E.REFUND_SOURCE_INVALID)

        const openCase = await tx.rentalExceptionCase.findFirst({
          where: {
            orderId,
            status: { in: ['OPEN', 'UNDER_REVIEW'] },
            OR: [
              { assignmentId: item.assignmentId },
              { inspectionId: item.inspectionId },
              { assignmentId: null, inspectionId: null },
            ],
          },
        })
        if (openCase) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)

        if (item.deductionAmount.gt(0) || item.status === 'DEDUCTION_APPROVED') {
          const order = await tx.rentalOrder.findUniqueOrThrow({
            where: { id: orderId }, include: { rentalPolicy: true },
          })
          const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
          const reason = await deductionReviewGate(tx, {
            orderId, inspectionId: item.inspection.id, assignmentId: item.assignmentId,
            reviewMinutes: order.rentalPolicy.userAssessmentReviewMinutes, now,
          })
          if (reason) throw AppError.fromCode(E.REFUND_SOURCE_INVALID, { details: { reason } })
        }

        const existingAlloc = await tx.depositRefundItemAllocation.findFirst({
          where: {
            depositSettlementItemId: item.id,
            refund: { status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
          },
        })
        if (existingAlloc) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      }

      for (const allocInput of input.allocations) {
        const alloc = payment.allocations.find((a) => a.id === allocInput.paymentAllocationId)
        if (!alloc || alloc.component !== 'RENTAL_DEPOSIT') throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
        const existingRefundAllocations = await tx.refundAllocation.aggregate({
          where: {
            paymentAllocationId: alloc.id,
            refund: { status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
          },
          _sum: { amount: true },
        })
        const alreadyAllocated = existingRefundAllocations._sum.amount ?? new Prisma.Decimal(0)
        if (alreadyAllocated.plus(allocInput.amount).gt(alloc.amount)) {
          throw AppError.fromCode(E.REFUND_AMOUNT_EXCEEDED)
        }
      }

      const reserved = await tx.refund.aggregate({
        where: { paymentId: p.id, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
        _sum: { amount: true },
      })
      if (amountDecimal.gt(payment.amount.minus(reserved._sum.amount ?? 0))) {
        throw AppError.fromCode(E.REFUND_AMOUNT_EXCEEDED)
      }

      const id = randomUUID()
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const refund = await tx.refund.create({
        data: {
          id,
          paymentId: p.id,
          purpose: 'DEPOSIT',
          businessActionId: input.businessActionId,
          amount: amountDecimal,
          currency: payment.currency,
          depositSettlementId: settlementId,
          depositSettlementItemId:
            itemAllocations.length === 1 ? itemAllocations[0].depositSettlementItemId : null,
          idempotencyKey: key,
          requestHash,
          requestHashVersion: 1,
          paymentGateway: payment.paymentGateway,
          providerEnvironment: payment.providerEnvironment,
          merchantAccountKey: payment.merchantAccountKey,
          merchantRefundRef: `refund:${id}`,
          reconcileStatus: 'SCHEDULED',
          nextRetryAt: now,
          allocations: {
            create: input.allocations.map((a) => ({
              paymentAllocationId: a.paymentAllocationId,
              amount: new Prisma.Decimal(a.amount),
            })),
          },
          depositRefundItems: {
            create: itemAllocations.map((a) => ({
              depositSettlementItemId: a.depositSettlementItemId,
              amount: new Prisma.Decimal(a.amount),
            })),
          },
        },
      })

      await tx.depositSettlementItem.updateMany({
        where: { id: { in: itemIds } },
        data: { status: 'REFUND_PENDING', version: { increment: 1 } },
      })

      await tx.rentalOrder.update({
        where: { id: orderId },
        data: { financialStatus: 'REFUND_PENDING', version: { increment: 1 } },
      })

      return refund
    },
    { timeout: 15000, maxWait: 10000 },
  )
  }
}
