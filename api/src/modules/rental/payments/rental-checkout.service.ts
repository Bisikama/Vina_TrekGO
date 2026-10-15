import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../../shared/services/prisma.service'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../../shared/errors'
import { PaymentMethod, ProviderScope } from '../../payments/payment-provider.port'
import { paymentHash, paymentRecoveryConfig } from '../../payments/payment-utils'
import { rentalComponents } from './rental-payment.rules'
import { rentalMembershipValid } from './rental-membership.guard'

export type RentalCheckoutCommand = {
  rentalOrderId: string
  actorUserId: string
  idempotencyKey: string
  paymentMethod: PaymentMethod
}
@Injectable()
export class RentalCheckoutService {
  constructor(private readonly db: PrismaService) {}
  async reserve(input: RentalCheckoutCommand, scope: ProviderScope) {
    const key = paymentHash([input.actorUserId, 'rental-checkout', input.idempotencyKey])
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))::text`
      const initial = await tx.rentalOrder.findUnique({ where: { id: input.rentalOrderId } })
      if (!initial || initial.userId !== input.actorUserId) throw AppError.fromCode(E.PAYMENT_NOT_FOUND)
      await tx.$queryRaw`SELECT id FROM trips WHERE id=${initial.tripId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${initial.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT r.id FROM rental_quantity_reservations r JOIN rental_order_lines l ON l.id=r.order_line_id
        WHERE l.order_id=${initial.id}::uuid ORDER BY r.id FOR UPDATE OF r`
      const order = await tx.rentalOrder.findUniqueOrThrow({
        where: { id: initial.id },
        include: {
          trip: true,
          rentalOrderLinesViaOrderId: { include: { rentalQuantityReservationsViaOrderLineId: true } },
        },
      })
      if (
        order.tripId !== initial.tripId ||
        order.bookingId !== initial.bookingId ||
        order.userId !== input.actorUserId
      )
        throw AppError.fromCode(E.PAYMENT_NOT_FOUND)
      const previous = await tx.payment.findUnique({ where: { idempotencyKey: key }, include: { invoice: true } })
      if (previous) {
        const snapshot = previous.gatewayPayload as Prisma.JsonObject | null
        if (
          previous.invoice.rentalOrderId !== order.id ||
          previous.invoice.userId !== input.actorUserId ||
          previous.paymentMethod !== input.paymentMethod ||
          previous.requestHashVersion !== 1 ||
          !snapshot?.requestSnapshot ||
          paymentHash(snapshot.requestSnapshot) !== previous.requestHash
        )
          throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return { payment: previous, created: false }
      }
      if (
        scope.environment === 'MOCK' &&
        process.env.NODE_ENV === 'production' &&
        process.env.PAYMENT_MOCK_ENABLED !== 'true'
      )
        throw AppError.fromCode(E.PAYMENT_PROVIDER_UNAVAILABLE)
      let [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const memberEligible = await rentalMembershipValid(tx, order)
      if (
        order.status !== 'PENDING_PAYMENT' ||
        !['UNPAID', 'PAYMENT_PENDING'].includes(order.financialStatus) ||
        order.paymentExpiresAt <= now ||
        !memberEligible
      ) {
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      }
      const components = rentalComponents(order, order.rentalOrderLinesViaOrderId)
      const invoices = await tx.invoice.findMany({
        where: { rentalOrderId: order.id },
        orderBy: { revisionNo: 'desc' },
      })
      let invoice = invoices[0]
      if (invoice) {
        await tx.$queryRaw`SELECT id FROM invoices WHERE id=${invoice.id}::uuid FOR UPDATE`
        invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } })
        if (
          invoice.invoiceType !== 'RENTAL' ||
          invoice.userId !== order.userId ||
          !invoice.revisionNo ||
          !['DRAFT', 'PENDING_PAYMENT'].includes(invoice.status) ||
          invoice.currency !== order.currency ||
          !invoice.totalAmount.equals(order.totalAmount) ||
          !invoice.subtotalAmount.equals(order.totalAmount) ||
          !invoice.discountAmount.isZero()
        ) {
          throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
        }
        const lines = await tx.invoiceLine.findMany({ where: { invoiceId: invoice.id } })
        if (
          lines.length !== components.length ||
          components.some(
            (c) =>
              !lines.some(
                (l) =>
                  l.lineCode === c.component &&
                  l.referenceId === c.rentalOrderLineId &&
                  l.quantity.equals(1) &&
                  l.unitAmount.equals(c.amount) &&
                  l.lineAmount.equals(c.amount),
              ),
          )
        )
          throw AppError.fromCode(E.PAYMENT_AMOUNT_MISMATCH)
      } else
        invoice = await tx.invoice.create({
          data: {
            invoiceNo: `RENTAL-${randomUUID()}`,
            invoiceType: 'RENTAL',
            rentalOrderId: order.id,
            userId: order.userId,
            revisionNo: 1,
            currency: order.currency,
            subtotalAmount: order.totalAmount,
            totalAmount: order.totalAmount,
            status: 'PENDING_PAYMENT',
            expiresAt: order.paymentExpiresAt,
            invoiceLinesViaInvoiceId: {
              create: components.map((c) => ({
                lineCode: c.component,
                description: c.component,
                quantity: 1,
                unitAmount: c.amount,
                lineAmount: c.amount,
                referenceType: 'RentalOrderLine',
                referenceId: c.rentalOrderLineId,
              })),
            },
          },
        })
      ;[{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      if (
        order.rentalOrderLinesViaOrderId.some((l) => {
          const held = l.rentalQuantityReservationsViaOrderLineId.filter((r) => r.status === 'HELD')
          return (
            held.length !== 1 ||
            held[0].quantity !== l.quantity ||
            held[0].productId !== l.productId ||
            !held[0].holdExpiresAt ||
            held[0].holdExpiresAt <= now ||
            held[0].occupiedFrom > order.occupiedStartAt ||
            held[0].occupiedUntil < order.occupiedEndAt
          )
        })
      ) {
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      }
      if (order.paymentExpiresAt <= now || (invoice.expiresAt && invoice.expiresAt <= now)) {
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      }
      if (await tx.payment.findFirst({ where: { invoiceId: invoice.id, status: { in: ['PENDING', 'PROCESSING'] } } }))
        throw AppError.fromCode(E.PAYMENT_ATTEMPT_IN_PROGRESS)
      if (await tx.payment.findFirst({ where: { invoice: { rentalOrderId: order.id }, status: 'SUCCEEDED' } })) {
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      }
      const requestSnapshot = {
        actor: input.actorUserId,
        operation: 'rental-checkout',
        rentalOrderId: order.id,
        invoiceId: invoice.id,
        revision: invoice.revisionNo,
        amount: order.totalAmount.toFixed(),
        currency: order.currency,
        paymentMethod: input.paymentMethod,
        allocations: components.map((c) => ({ ...c, amount: c.amount.toFixed() })),
      }
      const id = randomUUID()
      const payment = await tx.payment.create({
        data: {
          id,
          invoiceId: invoice.id,
          amount: order.totalAmount,
          currency: order.currency,
          paymentGateway: scope.gateway,
          providerEnvironment: scope.environment,
          merchantAccountKey: scope.merchantAccountKey,
          merchantRequestRef: `payment:${id}`,
          idempotencyKey: key,
          requestHash: paymentHash(requestSnapshot),
          requestHashVersion: 1,
          paymentMethod: input.paymentMethod,
          gatewayPayload: { requestSnapshot },
          expiresAt:
            invoice.expiresAt && invoice.expiresAt < order.paymentExpiresAt
              ? invoice.expiresAt
              : order.paymentExpiresAt,
          reconcileStatus: 'SCHEDULED',
          nextRetryAt: new Date(now.getTime() + paymentRecoveryConfig().retrySeconds * 1000),
          allocations: { create: components },
        },
      })
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PENDING_PAYMENT' } })
      await tx.rentalOrder.update({
        where: { id: order.id },
        data: { financialStatus: 'PAYMENT_PENDING', version: { increment: 1 } },
      })
      return { payment, created: true }
    }, { maxWait: 15000, timeout: 30000 })
  }
  /** Additional rental fee. Uses the SAME scoped payment provider/outbox/webhook
   * as initial Rental checkout; never creates an unverified payment stub.
   */
  async reserveExtension(input: { extensionId: string; actorUserId: string; idempotencyKey: string; paymentMethod: PaymentMethod }, scope: ProviderScope) {
    const key = paymentHash([input.actorUserId, 'rental-extension-checkout', input.idempotencyKey])
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))::text`
      const pointer = await tx.rentalExtensionRequest.findUnique({ where: { id: input.extensionId } })
      if (!pointer || pointer.userId !== input.actorUserId) throw AppError.fromCode(E.PAYMENT_NOT_FOUND)
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${pointer.orderId}::uuid FOR UPDATE`
      const ext = await tx.rentalExtensionRequest.findUniqueOrThrow({ where: { id: input.extensionId }, include: { order: true, lines: true } })
      const previous = await tx.payment.findUnique({ where: { idempotencyKey: key }, include: { invoice: true } })
      if (previous) {
        const snap = previous.gatewayPayload as Prisma.JsonObject | null
        const request = snap?.requestSnapshot as Prisma.JsonObject | undefined
        if (previous.invoiceId !== ext.invoiceId || previous.invoice.rentalOrderId !== ext.orderId ||
          previous.paymentMethod !== input.paymentMethod || previous.requestHashVersion !== 1 ||
          request?.extensionId !== ext.id || !request || paymentHash(request) !== previous.requestHash)
          throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return { payment: previous, created: false }
      }
      if (scope.environment === 'MOCK' && process.env.NODE_ENV === 'production' && process.env.PAYMENT_MOCK_ENABLED !== 'true')
        throw AppError.fromCode(E.PAYMENT_PROVIDER_UNAVAILABLE)
      const [{ now }] = await tx.$queryRaw<{now: Date}[]>`SELECT clock_timestamp() AS now`
      if (ext.status !== 'PENDING_PAYMENT' || !ext.holdExpiresAt || ext.holdExpiresAt <= now ||
        ext.additionalFee.lte(0) || ext.order.userId !== input.actorUserId ||
        !['PAID','PREPARING','READY_FOR_HANDOVER','ACTIVE'].includes(ext.order.status) ||
        ext.order.rentalEndAt <= now ||
        ext.order.returnOptionSnapshot === undefined ||
        !ext.lines.length ||
        ext.lines.reduce((a,l) => a.plus(l.additionalFee), new Prisma.Decimal(0)).comparedTo(ext.additionalFee) !== 0)
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      let invoice = ext.invoiceId ? await tx.invoice.findUnique({ where: { id: ext.invoiceId } }) : null
      if (!invoice) {
        const latest = await tx.invoice.findFirst({ where: { rentalOrderId: ext.orderId }, orderBy: { revisionNo: 'desc' }, select: { revisionNo: true } })
        invoice = await tx.invoice.create({ data: {
          invoiceNo: `RENTAL-EXT-${ext.id}`, invoiceType: 'RENTAL', rentalOrderId: ext.orderId, userId: input.actorUserId,
          revisionNo: (latest?.revisionNo ?? 0) + 1, subtotalAmount: ext.additionalFee, totalAmount: ext.additionalFee,
          currency: ext.currency, status: 'PENDING_PAYMENT', expiresAt: ext.holdExpiresAt,
          invoiceLinesViaInvoiceId: { create: ext.lines.filter(l => l.additionalFee.gt(0)).map(l => ({
            lineCode: 'RENTAL_EXTENSION', description: 'Extension of rental duration',
            quantity: 1, unitAmount: l.additionalFee, lineAmount: l.additionalFee,
            referenceType: 'RentalExtensionLine', referenceId: l.id,
          })) },
        } })
        await tx.rentalExtensionRequest.update({ where: { id: ext.id }, data: { invoiceId: invoice.id } })
      }
      if (invoice.userId !== input.actorUserId || invoice.rentalOrderId !== ext.orderId ||
        invoice.status !== 'PENDING_PAYMENT' || !invoice.totalAmount.equals(ext.additionalFee) ||
        (invoice.expiresAt && invoice.expiresAt <= now)) throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      const running = await tx.payment.findFirst({ where: { invoiceId: invoice.id, status: { in: ['PENDING','PROCESSING','SUCCEEDED'] } } })
      if (running) throw AppError.fromCode(E.PAYMENT_ATTEMPT_IN_PROGRESS)
      const requestSnapshot = { actor: input.actorUserId, operation: 'rental-extension-checkout',
        extensionId: ext.id, orderId: ext.orderId, invoiceId: invoice.id, revision: invoice.revisionNo,
        amount: ext.additionalFee.toFixed(), currency: ext.currency, paymentMethod: input.paymentMethod }
      const id = randomUUID()
      const payment = await tx.payment.create({ data: {
        id, invoiceId: invoice.id, amount: ext.additionalFee, currency: ext.currency,
        paymentGateway: scope.gateway, providerEnvironment: scope.environment, merchantAccountKey: scope.merchantAccountKey,
        merchantRequestRef: `payment:${id}`, idempotencyKey: key,
        requestHash: paymentHash(requestSnapshot), requestHashVersion: 1, paymentMethod: input.paymentMethod,
        gatewayPayload: { requestSnapshot }, expiresAt: ext.holdExpiresAt,
        reconcileStatus: 'SCHEDULED', nextRetryAt: new Date(now.getTime() + paymentRecoveryConfig().retrySeconds * 1000),
        allocations: {
          create: ext.lines.filter(l => l.additionalFee.gt(0)).map(l => ({
            component: 'RENTAL_FEE',
            amount: l.additionalFee,
            rentalOrderLineId: l.orderLineId
          }))
        }
      } })
      await tx.rentalExtensionRequest.update({ where: { id: ext.id }, data: { paymentRef: payment.id } })
      return { payment, created: true }
    }, { maxWait: 15000, timeout: 30000 })
  }

}
