import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../../shared/services/prisma.service'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../../shared/errors'
import { PaymentMethod, ProviderScope } from '../../payments/payment-provider.port'
import { paymentHash, paymentRecoveryConfig } from '../../payments/payment-utils'
import { rentalComponents } from './rental-payment.rules'

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
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))::text`
      const initial = await tx.rentalOrder.findUnique({ where: { id: input.rentalOrderId } })
      if (!initial || initial.userId !== input.actorUserId) throw AppError.fromCode(E.PAYMENT_NOT_FOUND)
      await tx.$queryRaw`SELECT id FROM trips WHERE id=${initial.tripId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM bookings WHERE id=${initial.bookingId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${initial.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT r.id FROM rental_quantity_reservations r JOIN rental_order_lines l ON l.id=r.order_line_id
        WHERE l.order_id=${initial.id}::uuid ORDER BY r.id FOR UPDATE OF r`
      const order = await tx.rentalOrder.findUniqueOrThrow({
        where: { id: initial.id },
        include: {
          booking: true,
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
      if (
        order.status !== 'PENDING_PAYMENT' ||
        !['UNPAID', 'PAYMENT_PENDING'].includes(order.financialStatus) ||
        order.paymentExpiresAt <= now ||
        order.booking.status !== 'CONFIRMED' ||
        order.booking.userId !== order.userId ||
        order.booking.tripId !== order.tripId ||
        order.trip.tripType !== 'PUBLIC' ||
        !['OPEN', 'FULL'].includes(order.trip.status) ||
        order.trip.startAt <= now
      )
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
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
        )
          throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
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
      )
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      if (order.paymentExpiresAt <= now || (invoice.expiresAt && invoice.expiresAt <= now))
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      if (await tx.payment.findFirst({ where: { invoiceId: invoice.id, status: { in: ['PENDING', 'PROCESSING'] } } }))
        throw AppError.fromCode(E.PAYMENT_ATTEMPT_IN_PROGRESS)
      if (await tx.payment.findFirst({ where: { invoice: { rentalOrderId: order.id }, status: 'SUCCEEDED' } }))
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
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
    })
  }
}
