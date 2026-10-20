import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../shared/errors'
import { PaymentProvider, VerifiedProviderEvent } from './payment-provider.port'
import { RefundsService } from './refunds.service'
import { paymentHash, paymentRecoveryConfig } from './payment-utils'
import { paymentTransaction } from './payment-transaction'

@Injectable()
export class PaymentWebhooksService {
  private readonly logger = new Logger(PaymentWebhooksService.name)
  constructor(
    private readonly db: PrismaService,
    private readonly provider: PaymentProvider,
    private readonly refunds: RefundsService,
  ) {}

  async receive(rawBody: Buffer, headers: Record<string, string>, gateway = this.provider.scope.gateway) {
    const event = await this.provider.forGateway(gateway)?.verifyWebhook(rawBody, headers)
    if (!event) throw AppError.fromCode(E.PAYMENT_WEBHOOK_INVALID_SIGNATURE)
    const payloadHash =
      event.gateway === 'vnpay' ? paymentHash(JSON.parse(rawBody.toString('utf8')).vnp_SecureHash.toLowerCase()) :
      event.gateway === 'momo' ? paymentHash(event) : createHash('sha256').update(rawBody).digest('hex')
    try {
      await this.provider.observeVerifiedEvent(event)
      await this.db.$transaction(async (tx) => {
        const identity = JSON.stringify([
          event.gateway,
          event.environment,
          event.merchantAccountKey,
          event.providerEventId,
        ])
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 0))::text`
        const existing = await tx.paymentWebhookEvent.findFirst({
          where: {
            paymentGateway: event.gateway,
            providerEnvironment: event.environment,
            merchantAccountKey: event.merchantAccountKey,
            providerEventId: event.providerEventId,
          },
        })
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            const original = existing.payload as unknown as VerifiedProviderEvent
            const affectedPayment = await tx.payment.findFirst({
              where: {
                paymentGateway: existing.paymentGateway,
                providerEnvironment: existing.providerEnvironment,
                merchantAccountKey: existing.merchantAccountKey,
                merchantRequestRef: original.merchantRequestRef,
              },
            })
            if (affectedPayment) {
              await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${affectedPayment.invoiceId}::uuid FOR UPDATE`
              await tx.$queryRaw`SELECT id FROM payments WHERE id = ${affectedPayment.id}::uuid FOR UPDATE`
              await tx.payment.update({
                where: { id: affectedPayment.id },
                data: {
                  reconcileStatus: 'NEEDS_REVIEW',
                  lastErrorCode: 'PROVIDER_EVENT_PAYLOAD_CONFLICT',
                  nextRetryAt: new Date(Date.now() + paymentRecoveryConfig().retrySeconds * 1000),
                  leaseToken: null,
                  leaseUntil: null,
                  version: { increment: 1 },
                },
              })
              if (original.kind === 'REFUND') {
                const refund = await tx.refund.findFirst({
                  where: {
                    paymentId: affectedPayment.id,
                    merchantRefundRef: original.merchantRefundRef,
                  },
                })
                if (refund) {
                  await tx.$queryRaw`SELECT id FROM refunds WHERE id = ${refund.id}::uuid FOR UPDATE`
                  await tx.refund.update({
                    where: { id: refund.id },
                    data: {
                      reconcileStatus: 'NEEDS_REVIEW',
                      lastErrorCode: 'PROVIDER_EVENT_PAYLOAD_CONFLICT',
                      nextRetryAt: new Date(Date.now() + paymentRecoveryConfig().retrySeconds * 1000),
                      leaseToken: null,
                      leaseUntil: null,
                      version: { increment: 1 },
                    },
                  })
                }
              }
            }
            // Lock and reread: a worker may have completed this event after the initial read.
            await tx.$queryRaw`SELECT id FROM payment_webhook_events WHERE id = ${existing.id}::uuid FOR UPDATE`
            const current = await tx.paymentWebhookEvent.findUniqueOrThrow({ where: { id: existing.id } })
            await tx.auditLog.create({
              data: {
                action: 'PAYMENT_WEBHOOK_ID_COLLISION',
                entityType: 'PaymentWebhookEvent',
                entityId: current.id,
                oldValues: { payloadHash: current.payloadHash },
                newValues: { payloadHash, event: { ...event } },
              },
            })
            await tx.paymentWebhookEvent.update({
              where: { id: current.id },
              data: {
                errorMessage: 'PROVIDER_EVENT_PAYLOAD_CONFLICT',
                ...(!current.processed ? { processingStatus: 'NEEDS_REVIEW', nextRetryAt: null } : {}),
              },
            })
          }
          return
        }
        await tx.paymentWebhookEvent.create({
          data: {
            paymentGateway: event.gateway,
            providerEnvironment: event.environment,
            merchantAccountKey: event.merchantAccountKey,
            providerEventId: event.providerEventId,
            eventKind: event.kind,
            payload: { ...event },
            payloadHash,
            verifiedAt: new Date(),
            processingStatus: 'RECEIVED',
          },
        })
      })
    } catch {
      // ACK must never precede durable intake, including a duplicate/conflict audit.
      throw AppError.fromCode(E.PAYMENT_WEBHOOK_STORAGE_UNAVAILABLE)
    }
  }

  async process(eventId: string) {
    const resource = await this.db.paymentWebhookEvent.findUnique({ where: { id: eventId } })
    if (
      resource?.eventKind === 'REFUND' &&
      resource.verifiedAt &&
      ['RECEIVED', 'RETRY'].includes(resource.processingStatus ?? '')
    ) {
      const event = resource.payload as unknown as VerifiedProviderEvent
      if (
        event.kind !== 'REFUND' ||
        event.gateway !== resource.paymentGateway ||
        event.environment !== resource.providerEnvironment ||
        event.merchantAccountKey !== resource.merchantAccountKey
      )
        throw new Error('Invalid refund inbox metadata')
      return this.refunds.applyEvent(event, { inboxId: eventId })
    }
    return paymentTransaction(this.db, this.logger, 'inbox.process', { eventId }, async (tx, stage) => {
      const initial = await tx.paymentWebhookEvent.findUnique({ where: { id: eventId } })
      if (!initial || !['RECEIVED', 'RETRY'].includes(initial.processingStatus ?? '')) return
      const event = initial.payload as unknown as VerifiedProviderEvent
      if (
        event.kind !== 'PAYMENT' ||
        initial.paymentGateway !== event.gateway ||
        initial.providerEnvironment !== event.environment ||
        initial.merchantAccountKey !== event.merchantAccountKey ||
        !initial.verifiedAt
      )
        throw new Error('Invalid verified inbox metadata')
      // Serialize competing references across invoices before taking financial row locks.
      if (event.transactionRef) {
        const identity = JSON.stringify([
          event.gateway,
          event.environment,
          event.merchantAccountKey,
          event.transactionRef,
        ])
        stage('lock.transactionRef')
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 0))::text`
      }
      stage('read.payment')
      const initialPayment = await tx.payment.findFirst({
        where: {
          paymentGateway: event.gateway,
          providerEnvironment: event.environment,
          merchantAccountKey: event.merchantAccountKey,
          merchantRequestRef: event.merchantRequestRef,
        },
      })
      if (initialPayment) {
        stage('lock.invoice')
        await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${initialPayment.invoiceId}::uuid FOR UPDATE`
        stage('lock.payment')
        await tx.$queryRaw`SELECT id FROM payments WHERE id = ${initialPayment.id}::uuid FOR UPDATE`
      }
      stage('lock.inbox')
      const claimed = await tx.$queryRaw<{ id: string; attemptCount: number; now: Date }[]>`
        SELECT id, attempt_count AS "attemptCount", clock_timestamp() AS now FROM payment_webhook_events WHERE id = ${eventId}::uuid
        AND processing_status IN ('RECEIVED', 'RETRY')
        AND (next_retry_at IS NULL OR next_retry_at <= clock_timestamp()) FOR UPDATE SKIP LOCKED`
      if (!claimed.length) return
      const [inbox] = claimed
      const { now } = inbox
      stage('apply')
      if (!initialPayment) {
        await tx.paymentWebhookEvent.update({
          where: { id: eventId },
          data: {
            attemptCount: { increment: 1 },
            processingStatus: inbox.attemptCount >= 7 ? 'NEEDS_REVIEW' : 'RETRY',
            nextRetryAt: inbox.attemptCount >= 7 ? null : new Date(now.getTime() + 30000),
            errorMessage: 'PAYMENT_NOT_FOUND',
          },
        })
        return
      }
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: initialPayment.id },
        include: { invoice: true },
      })
      const review = async (reason: string) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            reconcileStatus: 'NEEDS_REVIEW',
            lastErrorCode: reason,
            nextRetryAt: new Date(now.getTime() + paymentRecoveryConfig().retrySeconds * 1000),
            leaseToken: null,
            leaseUntil: null,
            version: { increment: 1 },
          },
        })
        await tx.paymentWebhookEvent.update({
          where: { id: eventId },
          data: {
            paymentId: payment.id,
            processingStatus: 'NEEDS_REVIEW',
            attemptCount: { increment: 1 },
            nextRetryAt: null,
            errorMessage: reason,
          },
        })
        await tx.auditLog.create({
          data: {
            action: 'PAYMENT_RESULT_NEEDS_REVIEW',
            entityType: 'Payment',
            entityId: payment.id,
            newValues: { eventId, reason, providerStatus: event.status, transactionRef: event.transactionRef },
          },
        })
      }
      if (!payment.amount.equals(event.amount) || payment.currency !== event.currency) {
        await review(E.PAYMENT_AMOUNT_MISMATCH)
        return
      }
      if (payment.transactionRef && event.transactionRef && event.transactionRef !== payment.transactionRef) {
        await review('PAYMENT_TRANSACTION_MISMATCH')
        return
      }
      if (
        event.transactionRef &&
        (await tx.payment.findFirst({
          where: {
            id: { not: payment.id },
            paymentGateway: event.gateway,
            providerEnvironment: event.environment,
            merchantAccountKey: event.merchantAccountKey,
            transactionRef: event.transactionRef,
          },
        }))
      ) {
        await review('PAYMENT_TRANSACTION_ALREADY_RECORDED')
        return
      }
      if (payment.reconcileStatus === 'NEEDS_REVIEW') {
        await review('PAYMENT_REVIEW_REQUIRED')
        return
      }
      let ignoredReason: string | null = null
      // Rental có thể bị hủy sau khi mở phiên cổng. Nếu cổng vẫn xác nhận thu tiền,
      // ghi nhận SUCCEEDED để consumer từ chối áp dụng đơn và phát hoàn kỹ thuật.
      const rentalLateSuccess = payment.invoice.invoiceType === 'RENTAL' &&
        payment.status === 'CANCELLED' && event.status === 'SUCCEEDED'
      if (!['PENDING', 'PROCESSING'].includes(payment.status) && !rentalLateSuccess) {
        if (payment.status !== event.status && event.status === 'SUCCEEDED') {
          await review('PAYMENT_TERMINAL_CORRECTION')
          return
        }
        ignoredReason = payment.status === event.status ? 'DUPLICATE_RESULT' : 'OUT_OF_ORDER_RESULT'
        await tx.auditLog.create({
          data: {
            action: 'PAYMENT_RESULT_IGNORED',
            entityType: 'Payment',
            entityId: payment.id,
            newValues: { eventId, reason: ignoredReason, status: event.status },
          },
        })
      } else {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: event.status,
            transactionRef: event.transactionRef,
            paidAt: event.status === 'SUCCEEDED' ? new Date(event.occurredAt) : null,
            reconcileStatus: event.status === 'PROCESSING' ? 'SCHEDULED' : 'RESOLVED',
            nextRetryAt: event.status === 'PROCESSING' ? new Date(now.getTime() + 30000) : null,
            lastErrorCode: null,
            leaseToken: null,
            leaseUntil: null,
            version: { increment: 1 },
          },
        })
        if (event.status === 'SUCCEEDED') {
          await tx.paymentApplication.create({ data: { paymentId: payment.id, invoiceId: payment.invoiceId } })
        }
        if (event.status === 'SUCCEEDED' || event.status === 'FAILED') {
          await tx.paymentOutboxEvent.create({
            data: {
              deduplicationKey: `payment:${payment.id}:${event.status.toLowerCase()}:v1`,
              eventType: `PAYMENT_${event.status}`,
              aggregateType: 'Payment',
              aggregateId: payment.id,
              payload: {
                schemaVersion: 1,
                paymentId: payment.id,
                invoiceId: payment.invoiceId,
                invoiceType: payment.invoice.invoiceType,
                amount: payment.amount.toFixed(),
                currency: payment.currency,
                providerRef: event.transactionRef,
                occurredAt: event.occurredAt,
              },
            },
          })
        }
      }
      await tx.paymentWebhookEvent.update({
        where: { id: eventId },
        data: {
          paymentId: payment.id,
          processingStatus: 'PROCESSED',
          processed: true,
          processedAt: now,
          nextRetryAt: null,
          attemptCount: { increment: 1 },
          errorMessage: ignoredReason,
        },
      })
    })
  }
}
