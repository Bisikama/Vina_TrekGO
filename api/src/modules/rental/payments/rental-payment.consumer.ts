import { Injectable } from '@nestjs/common'
import { resolveActivePrimaryRentalLocation } from '../shared/primary-inventory-location'
import { PrismaService } from '../../../shared/services/prisma.service'
import { validateRentalAllocations } from './rental-payment.rules'
import { rentalMembershipValid } from './rental-membership.guard'
import { consumeExtensionPaymentWithTx } from '../ordering/extension/rental-extension.service'
import { rentalOccupiedFrom } from '../ordering/application/services/rental-ordering.rules'

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
      // Avoid contending with Booking GET expiry on trips; lock Rental and payment rows instead.
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
          quote: { include: { rentalQuoteLinesViaQuoteId: true } },
          rentalOrderLinesViaOrderId: {
            include: {
              product: true,
              rentalQuantityReservationsViaOrderLineId: true,
            },
          },
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
          // Lock extension and order rows to serialize against background expiry scheduler
          await tx.$queryRaw`SELECT id FROM rental_extension_requests WHERE id = ${extension.id}::uuid FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${extension.orderId}::uuid FOR UPDATE`;
          const lockedExt = await tx.rentalExtensionRequest.findUnique({ where: { id: extension.id } });
          if (!lockedExt) throw new Error('Rental extension request not found');

          const effectivePaidAt = payment.paidAt;
          if (!effectivePaidAt) {
            await consumeExtensionPaymentWithTx(tx, lockedExt.id, payment, 'SUCCEEDED', payment.transactionRef, now);
            await tx.paymentApplication.update({
              where: { paymentId: payment.id },
              data: { status: 'REJECTED', reasonCode: 'PAYMENT_TIMESTAMP_UNTRUSTED', decidedAt: now },
            });
            await tx.paymentConsumerReceipt.create({ data: { eventId, consumerName: 'rental-payment-v1' } });
            await tx.paymentOutboxEvent.update({ where: { id: eventId }, data: { status: 'PROCESSED', processedAt: now, nextRetryAt: null, lastError: null } });
            return;
          }

          const isTimely = lockedExt.status === 'PENDING_PAYMENT' && !!lockedExt.holdExpiresAt && effectivePaidAt <= lockedExt.holdExpiresAt;
          if (!isTimely) {
            let rejectionReason = 'LATE_PAYMENT';
            if (lockedExt.status === 'EXPIRED' && lockedExt.holdExpiresAt && effectivePaidAt <= lockedExt.holdExpiresAt) {
              rejectionReason = 'HOLD_EXPIRED_BEFORE_PROCESSING';
            } else if (lockedExt.status !== 'PENDING_PAYMENT') {
              rejectionReason = 'EXTENSION_NOT_APPLICABLE';
            }
            const result = await consumeExtensionPaymentWithTx(tx, lockedExt.id, payment, 'SUCCEEDED', payment.transactionRef, now);
            await tx.paymentApplication.update({
              where: { paymentId: payment.id },
              data: { status: 'REJECTED', reasonCode: result?.reasonCode ?? rejectionReason, decidedAt: now },
            });
          } else {
            const result = await consumeExtensionPaymentWithTx(tx, lockedExt.id, payment, 'SUCCEEDED', payment.transactionRef, now);
            if (result && !result.applied) {
              await tx.paymentApplication.update({
                where: { paymentId: payment.id },
                data: { status: 'REJECTED', reasonCode: result.reasonCode ?? 'EXTENSION_NOT_APPLICABLE', decidedAt: now },
              });
            } else {
              await tx.paymentApplication.update({
                where: { paymentId: payment.id },
                data: { status: 'APPLIED', appliedAt: now, decidedAt: now },
              });
            }
          }
          await tx.paymentConsumerReceipt.create({ data: { eventId, consumerName: 'rental-payment-v1' } });
          await tx.paymentOutboxEvent.update({ where: { id: eventId }, data: { status: 'PROCESSED', processedAt: now, nextRetryAt: null, lastError: null } });
          return;
        }
        const effectivePaidAt = payment.paidAt
        validateRentalAllocations(order, order.rentalOrderLinesViaOrderId, payment.allocations)
        let reason: string | null = null
        const memberEligible = await rentalMembershipValid(tx, order)
        if (
          await tx.paymentApplication.findFirst({
            where: { status: 'APPLIED', paymentId: { not: payment.id }, invoice: { rentalOrderId: order.id } },
          })
        )
          reason = 'DUPLICATE_PAYMENT'
        else if (!effectivePaidAt)
          reason = 'PAYMENT_TIMESTAMP_UNTRUSTED'
        else if (
          order.status === 'EXPIRED' ||
          effectivePaidAt > order.paymentExpiresAt ||
          (payment.invoice.expiresAt && effectivePaidAt > payment.invoice.expiresAt)
        )
          reason = 'LATE_PAYMENT'
        else if (
          order.status !== 'PENDING_PAYMENT' ||
          !['UNPAID', 'PAYMENT_PENDING'].includes(order.financialStatus) ||
          !memberEligible ||
          order.occupiedStartAt > rentalOccupiedFrom(order.rentalStartAt) ||
          payment.invoice.status !== 'PENDING_PAYMENT' ||
          payment.invoice.userId !== order.userId ||
          payment.currency !== order.currency ||
          payment.invoice.currency !== order.currency ||
          !payment.amount.equals(order.totalAmount) ||
          !payment.invoice.totalAmount.equals(order.totalAmount) ||
          order.rentalOrderLinesViaOrderId.some((l) => {
            const held = l.rentalQuantityReservationsViaOrderLineId.filter((r) => r.status === 'HELD')
            if (
              held.length !== 1 ||
              held[0].quantity !== l.quantity ||
              held[0].productId !== l.productId ||
              !held[0].holdExpiresAt ||
              held[0].holdExpiresAt < effectivePaidAt
            ) {
              return true
            }

            const quoteLine = order.quote?.rentalQuoteLinesViaQuoteId?.find((ql) => ql.productId === l.productId)
            let expectedOccupiedFrom: Date | null = quoteLine?.occupiedFrom ?? null
            let expectedOccupiedUntil: Date | null = quoteLine?.occupiedUntil ?? null
            const baselineOccupiedFrom = rentalOccupiedFrom(order.rentalStartAt)
            if (expectedOccupiedFrom && expectedOccupiedFrom > baselineOccupiedFrom) return true

            if (!expectedOccupiedFrom || !expectedOccupiedUntil) {
              const rawPolicy = order.policySnapshot
              if (!rawPolicy || typeof rawPolicy !== 'object' || Array.isArray(rawPolicy)) {
                return true // Fail closed: policy snapshot missing or invalid
              }
              const policy = rawPolicy as Record<string, unknown>
              const prepMinutes = typeof policy.prepBufferMinutes === 'number' ? policy.prepBufferMinutes : null
              const returnBufferMinutes = typeof policy.returnBufferMinutes === 'number' ? policy.returnBufferMinutes : null
              const cleaningBufferMinutes = typeof policy.cleaningBufferMinutes === 'number' ? policy.cleaningBufferMinutes : null
              const deepInspectionMinutes = typeof policy.deepInspectionBufferMinutes === 'number' ? policy.deepInspectionBufferMinutes : null

              if (prepMinutes === null || returnBufferMinutes === null) {
                return true // Fail closed: missing mandatory buffers, NO magic defaults
              }

              const normalBufferHours = Math.max(returnBufferMinutes, cleaningBufferMinutes ?? returnBufferMinutes) / 60
              const requiresDeep = l.product?.requiresDeepReturnInspection === true
              if (requiresDeep && deepInspectionMinutes === null) {
                return true // Fail closed: deep inspection required but missing deep buffer in policy
              }
              const deepBufferHours = (deepInspectionMinutes ?? 0) / 60
              const returnBufferHours = requiresDeep ? Math.max(normalBufferHours, deepBufferHours) : normalBufferHours

              // Snapshot cũ có thể ghi prep 0/360; công suất thực tế vẫn phải giữ đủ 12 giờ.
              if (
                !Number.isSafeInteger(prepMinutes) || prepMinutes < 0 ||
                !Number.isSafeInteger(returnBufferMinutes) ||
                (cleaningBufferMinutes !== null && !Number.isSafeInteger(cleaningBufferMinutes)) ||
                (requiresDeep && !Number.isSafeInteger(deepInspectionMinutes)) ||
                returnBufferHours < (requiresDeep ? 48 : 24)
              ) {
                return true // Fail closed khi snapshot sai hoặc thiếu mức đệm tối thiểu.
              }

              const baseStart = order.plannedHandoverAt ?? order.rentalStartAt
              const baseReturn = order.plannedReturnAt ?? order.rentalEndAt
              if (!baseStart || !baseReturn) return true

              expectedOccupiedFrom = rentalOccupiedFrom(baseStart)
              expectedOccupiedUntil = new Date(baseReturn.getTime() + returnBufferHours * 3600_000)
            }

            return held[0].occupiedFrom > expectedOccupiedFrom || held[0].occupiedUntil < expectedOccupiedUntil
          })
        )
          reason = 'DOMAIN_NOT_ELIGIBLE'
        ;[{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
        if (
          !reason && effectivePaidAt &&
          (effectivePaidAt > order.paymentExpiresAt || (payment.invoice.expiresAt && effectivePaidAt > payment.invoice.expiresAt))
        )
          reason = 'LATE_PAYMENT'
        if (
          !reason && effectivePaidAt &&
          (order.rentalOrderLinesViaOrderId.some((l) =>
              l.rentalQuantityReservationsViaOrderLineId.some(
                (r) => r.status === 'HELD' && (!r.holdExpiresAt || r.holdExpiresAt < effectivePaidAt),
              ),
            ))
        )
          reason = 'DOMAIN_NOT_ELIGIBLE'

        if (!reason) {
          const primary = await resolveActivePrimaryRentalLocation(tx);
          const quote = await tx.rentalQuote.findUnique({ where: { id: order.quoteId }, select: { policySnapshot: true } });
          const snapshot = quote?.policySnapshot;
          const snapId = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
            ? (snapshot as Record<string, unknown>).primaryRentalInventoryLocationId : null;
          if (snapId && snapId !== primary) reason = 'PRIMARY_RENTAL_LOCATION_NOT_VERIFIED';
        }

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
            const locationId = await resolveActivePrimaryRentalLocation(tx);
            await tx.inventoryTask.create({ data: { orderId: order.id, inventoryLocationId: locationId, status: 'OPEN', deadline: order.plannedHandoverAt } })
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
    }, { timeout: 20000, maxWait: 10000 })
  }
}
