import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../shared/services/prisma.service'
import { validateRentalAllocations } from './rental-payment.rules'
import { rentalMembershipValid } from './rental-membership.guard'
import { consumeExtensionPaymentWithTx } from '../ordering/extension/rental-extension.service'

@Injectable()
export class RentalPaymentConsumer {
  constructor(private readonly db: PrismaService) {}
  async consume(eventId: string) {
    await this.db.$transaction(async (tx) => {
      const initialEvent = await tx.paymentOutboxEvent.findUnique({ where: { id: eventId } })
      if (!initialEvent || initialEvent.eventType !== 'PAYMENT_SUCCEEDED' || initialEvent.aggregateType !== 'Payment')
        return
      const initial = await tx.payment.findUnique({
        where: { id: initialEvent.aggregateId },
        include: { invoice: { include: { rentalOrder: true } } },
      })
      if (!initial || initial.invoice.invoiceType !== 'RENTAL' || !initial.invoice.rentalOrder) return
      const source = initial.invoice.rentalOrder
      await tx.$queryRaw`SELECT id FROM trips WHERE id=${source.tripId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${source.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT r.id FROM rental_quantity_reservations r JOIN rental_order_lines l ON l.id=r.order_line_id
        WHERE l.order_id=${source.id}::uuid ORDER BY r.id FOR UPDATE OF r`
      await tx.$queryRaw`SELECT id FROM invoices WHERE id=${initial.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id=${initial.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_allocations WHERE payment_id=${initial.id}::uuid ORDER BY id FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_applications WHERE payment_id=${initial.id}::uuid FOR UPDATE`
      const claimed = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM payment_outbox_events WHERE id=${eventId}::uuid
        AND status='PENDING' AND (next_retry_at IS NULL OR next_retry_at<=clock_timestamp()) FOR UPDATE SKIP LOCKED`
      if (!claimed.length) return
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: initial.id },
        include: { invoice: true, application: true, allocations: true },
      })
      const order = await tx.rentalOrder.findUniqueOrThrow({
        where: { id: source.id },
        include: {
          trip: true,
          rentalOrderLinesViaOrderId: { include: { rentalQuantityReservationsViaOrderLineId: true } },
        },
      })
      const event = await tx.paymentOutboxEvent.findUniqueOrThrow({ where: { id: eventId } })
      const payload = event.payload as Record<string, unknown>
      if (
        payment.invoiceId !== initial.invoiceId ||
        payment.invoice.rentalOrderId !== order.id ||
        order.tripId !== source.tripId ||
        order.bookingId !== source.bookingId ||
        payload.schemaVersion !== 1 ||
        payload.paymentId !== payment.id ||
        payload.invoiceId !== payment.invoiceId ||
        payment.status !== 'SUCCEEDED' ||
        !payment.application ||
        payment.application.invoiceId !== payment.invoiceId ||
        payment.reconcileStatus === 'NEEDS_REVIEW'
      )
        throw new Error('Invalid Rental payment application mapping or review')
      const receipt = await tx.paymentConsumerReceipt.findUnique({
        where: { eventId_consumerName: { eventId, consumerName: 'rental-payment-v1' } },
      })
      let [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      if (!receipt && payment.application.status === 'PENDING') {
        const extension = await tx.rentalExtensionRequest.findFirst({ where: { invoiceId: payment.invoiceId } })
        if (extension) {
          // Provider success is already signature-verified by Shared Payment inbox.
          // Extension has its own amount/expiry guards; never replay base-order PAID.
          // Never apply a payment that arrived after its delta-capacity hold expired.
          // Provider money must be reversed by the SAME verified Shared Payment worker
          // used by initial RENTAL payments, rather than an unscoped Refund insert.
          const paymentLate = extension.status !== 'PENDING_PAYMENT' || !extension.holdExpiresAt || extension.holdExpiresAt <= now
          if (paymentLate) {
            await consumeExtensionPaymentWithTx(tx, extension.id, payment, 'SUCCEEDED', payment.transactionRef, now)
            await tx.paymentApplication.update({ where: { paymentId: payment.id }, data: { status: 'REJECTED', reasonCode: 'LATE_PAYMENT', decidedAt: now } })
            await tx.paymentOutboxEvent.upsert({
              where: { deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1` },
              create: {
                deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1`,
                eventType: 'TECHNICAL_REVERSAL_REQUESTED', aggregateType: 'Payment', aggregateId: payment.id,
                payload: { schemaVersion: 1, paymentId: payment.id, invoiceId: payment.invoiceId, reasonCode: 'LATE_PAYMENT' },
              }, update: {},
            })
          } else {
            await consumeExtensionPaymentWithTx(tx, extension.id, payment, 'SUCCEEDED', payment.transactionRef, now)
            await tx.paymentApplication.update({ where: { paymentId: payment.id }, data: { status: 'APPLIED', appliedAt: now, decidedAt: now } })
          }
          await tx.paymentConsumerReceipt.create({ data: { eventId, consumerName: 'rental-payment-v1' } })
          await tx.paymentOutboxEvent.update({ where: { id: eventId }, data: { status: 'PROCESSED', processedAt: now, nextRetryAt: null, lastError: null } })
          return
        }
        validateRentalAllocations(order, order.rentalOrderLinesViaOrderId, payment.allocations)
        let reason: string | null = null
        const memberEligible = await rentalMembershipValid(tx, order)
        if (
          await tx.paymentApplication.findFirst({
            where: { status: 'APPLIED', paymentId: { not: payment.id }, invoice: { rentalOrderId: order.id } },
          })
        )
          reason = 'DUPLICATE_PAYMENT'
        else if (
          order.status === 'EXPIRED' ||
          (payment.paidAt && order.paymentExpiresAt <= payment.paidAt) ||
          (payment.paidAt && payment.invoice.expiresAt && payment.invoice.expiresAt <= payment.paidAt)
        )
          reason = 'LATE_PAYMENT'
        else if (
          order.status !== 'PENDING_PAYMENT' ||
          !['UNPAID', 'PAYMENT_PENDING'].includes(order.financialStatus) ||
          !memberEligible ||
          payment.invoice.status !== 'PENDING_PAYMENT' ||
          payment.invoice.userId !== order.userId ||
          payment.currency !== order.currency ||
          payment.invoice.currency !== order.currency ||
          !payment.amount.equals(order.totalAmount) ||
          !payment.invoice.totalAmount.equals(order.totalAmount) ||
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
          reason = 'DOMAIN_NOT_ELIGIBLE'
        ;[{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
        if (
          !reason &&
          ((payment.paidAt && order.paymentExpiresAt <= payment.paidAt) || (payment.paidAt && payment.invoice.expiresAt && payment.invoice.expiresAt <= payment.paidAt))
        )
          reason = 'LATE_PAYMENT'
        if (
          !reason &&
          (order.rentalOrderLinesViaOrderId.some((l) =>
              l.rentalQuantityReservationsViaOrderLineId.some(
                (r) => r.status === 'HELD' && (!r.holdExpiresAt || r.holdExpiresAt <= now),
              ),
            ))
        )
          reason = 'DOMAIN_NOT_ELIGIBLE'
        if (reason) {
          await tx.paymentApplication.update({
            where: { paymentId: payment.id },
            data: { status: 'REJECTED', reasonCode: reason, decidedAt: now },
          })
          await tx.paymentOutboxEvent.create({
            data: {
              deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1`,
              eventType: 'TECHNICAL_REVERSAL_REQUESTED',
              aggregateType: 'Payment',
              aggregateId: payment.id,
              payload: { schemaVersion: 1, paymentId: payment.id, invoiceId: payment.invoiceId, reasonCode: reason },
            },
          })
        } else {
          await tx.rentalOrder.update({
            where: { id: order.id },
            data: { status: 'PAID', financialStatus: 'PAID', paidAt: payment.paidAt, version: { increment: 1 } },
          })
          await tx.rentalQuantityReservation.updateMany({
            where: { orderLine: { orderId: order.id }, status: 'HELD' },
            data: { status: 'CONFIRMED', confirmedAt: now, version: { increment: 1 } },
          })
          await tx.invoice.update({
            where: { id: payment.invoiceId },
            data: { status: 'PAID', paidAt: payment.paidAt, version: { increment: 1 } },
          })
          await tx.paymentApplication.update({
            where: { paymentId: payment.id },
            data: { status: 'APPLIED', appliedAt: now, decidedAt: now },
          })
          const existingTask = await tx.inventoryTask.findUnique({ where: { orderId: order.id } })
          if (!existingTask) {
            const configured = process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID
            const locations = await tx.inventoryLocation.findMany({
              where: { status: 'ACTIVE', ...(configured ? { id: configured } : {}) },
              select: { id: true }, orderBy: { createdAt: 'asc' }, take: 2,
            })
            if (locations.length !== 1) throw new Error('RENTAL_DEFAULT_INVENTORY_LOCATION_ID is missing or ambiguous')
            await tx.inventoryTask.create({ data: { orderId: order.id, inventoryLocationId: locations[0].id, status: 'OPEN', deadline: order.plannedHandoverAt } })
          }
          await tx.rentalOutboxEvent.create({
            data: {
              deduplicationKey: `rental:${order.id}:paid:v1`,
              eventType: 'RENTAL_PAID',
              aggregateType: 'RentalOrder',
              aggregateId: order.id,
              payload: { schemaVersion: 1, orderId: order.id, paymentId: payment.id, invoiceId: payment.invoiceId },
            },
          })
        }
      }
      if (!receipt) await tx.paymentConsumerReceipt.create({ data: { eventId, consumerName: 'rental-payment-v1' } })
      await tx.paymentOutboxEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSED', processedAt: now, nextRetryAt: null, lastError: null },
      })
    })
  }
}
