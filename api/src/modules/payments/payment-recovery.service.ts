import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { Payment, Prisma, Refund } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../shared/errors'
import { PaymentProvider, ProviderFinancialResult, ProviderScope } from './payment-provider.port'
import { paymentHash, paymentRecoveryConfig, providerCall } from './payment-utils'
import { PaymentWebhooksService } from './payment-webhooks.service'
import { RefundsService } from './refunds.service'
import { paymentFailure, paymentTransaction } from './payment-transaction'

type Kind = 'payment' | 'refund'
type Claim<T> = { row: T; review: boolean; now: Date }
const needsReview = (code: string | null) =>
  !!code && !['PAYMENT_PROVIDER_UNAVAILABLE', 'RECOVERY_UNKNOWN'].includes(code)

@Injectable()
export class PaymentRecoveryService {
  private running = false
  private readonly logger = new Logger(PaymentRecoveryService.name)
  constructor(
    private readonly db: PrismaService,
    private readonly provider: PaymentProvider,
    private readonly inbox: PaymentWebhooksService,
    private readonly refunds: RefundsService,
  ) {}

  private scope(row: Payment | Refund): ProviderScope {
    return {
      gateway: row.paymentGateway!,
      environment: row.providerEnvironment!,
      merchantAccountKey: row.merchantAccountKey!,
    }
  }

  private async claim(kind: Kind, id?: string): Promise<Claim<Payment | Refund> | null> {
    const config = paymentRecoveryConfig()
    const table = Prisma.raw(kind === 'payment' ? 'payments' : 'refunds')
    const scopes = Prisma.join(this.provider.scopes.map((scope) => Prisma.sql`(payment_gateway = ${scope.gateway}
      AND provider_environment = ${scope.environment}::payment_environment
      AND merchant_account_key = ${scope.merchantAccountKey})`), ' OR ')
    return paymentTransaction(this.db, this.logger, 'recovery.claim', { kind, resourceId: id }, async (tx, stage) => {
      stage('lock.claim')
      const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM ${table} WHERE (${scopes})
        ${id ? Prisma.sql`AND id = ${id}::uuid` : Prisma.empty}
        AND (lease_until IS NULL OR lease_until <= clock_timestamp())
        AND ((reconcile_status IN ('SCHEDULED', 'RUNNING'))
          OR (status IN ('PENDING','PROCESSING') AND reconcile_status = 'IDLE')
          OR (reconcile_status = 'NEEDS_REVIEW' AND next_retry_at IS NOT NULL))
        AND (next_retry_at IS NULL OR next_retry_at <= clock_timestamp())
        ORDER BY next_retry_at NULLS FIRST, created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`)
      if (!ids.length) return null
      stage('claim.lease')
      const before =
        kind === 'payment'
          ? await tx.payment.findUniqueOrThrow({ where: { id: ids[0].id } })
          : await tx.refund.findUniqueOrThrow({ where: { id: ids[0].id } })
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const data = {
        reconcileStatus: 'RUNNING' as const,
        leaseToken: randomUUID(),
        leaseUntil: new Date(now.getTime() + config.leaseSeconds * 1000),
        retryCount: { increment: 1 },
        version: { increment: 1 },
      }
      const row =
        kind === 'payment'
          ? await tx.payment.update({ where: { id: before.id }, data })
          : await tx.refund.update({ where: { id: before.id }, data })
      return { row, review: before.reconcileStatus === 'NEEDS_REVIEW' || needsReview(before.lastErrorCode), now }
    })
  }

  private async defer(kind: Kind, claim: Claim<Payment | Refund>, reason = 'RECOVERY_UNKNOWN') {
    const config = paymentRecoveryConfig()
    const table = Prisma.raw(kind === 'payment' ? 'payments' : 'refunds')
    const awaitingIpn = kind === 'payment' &&
      this.provider.forGateway(claim.row.paymentGateway!)?.paymentResultsViaIpnOnly &&
      (claim.row as Payment).expiresAt && (claim.row as Payment).expiresAt! > claim.now
    const review = claim.review || (!awaitingIpn && claim.row.retryCount >= config.maxAttempts)
    // Only the current unexpired owner can persist. A stale owner never clears a newer lease.
    await this.db.$executeRaw(Prisma.sql`UPDATE ${table} SET
      status = CASE WHEN status = 'PENDING' THEN 'PROCESSING'::${Prisma.raw(kind === 'payment' ? 'payment_status' : 'refund_status')} ELSE status END,
      reconcile_status = ${review ? 'NEEDS_REVIEW' : 'SCHEDULED'}::payment_reconcile_status,
      last_checked_at = clock_timestamp(), next_retry_at = ${review ? Prisma.sql`NULL` : Prisma.sql`clock_timestamp() + ${config.retrySeconds} * interval '1 second'`},
      last_error_code = ${claim.review ? (claim.row.lastErrorCode ?? reason) : reason}, lease_token = NULL, lease_until = NULL,
      version = version + 1, updated_at = clock_timestamp()
      WHERE id = ${claim.row.id}::uuid AND lease_token = ${claim.row.leaseToken}::uuid
      AND version = ${claim.row.version} AND lease_until > clock_timestamp()`)
  }

  async reconcilePayment(id?: string, deferInbox = false): Promise<boolean> {
    const value = await this.claim('payment', id)
    if (!value) return false
    const claim = value as Claim<Payment>
    const row = claim.row
    if (!row.merchantRequestRef || !row.paymentMethod || !row.expiresAt) {
      await this.defer('payment', { ...claim, review: true }, 'PAYMENT_LEGACY_METADATA')
      return true
    }
    let result = await providerCall(() =>
      this.provider.queryPayment({ ...this.scope(row), merchantRequestRef: row.merchantRequestRef! }),
    )
    if (
      result.kind === 'NOT_FOUND' &&
      this.provider.forGateway(row.paymentGateway!)?.supportsIdempotentCreate &&
      !claim.review &&
      ['PENDING', 'PROCESSING'].includes(row.status) &&
      row.expiresAt > claim.now
    ) {
      await providerCall(() =>
        this.provider.createPayment({
          ...this.scope(row),
          merchantRequestRef: row.merchantRequestRef!,
          amount: row.amount.toFixed(),
          currency: row.currency,
          paymentMethod: row.paymentMethod as 'QR' | 'REDIRECT',
          expiresAt: row.expiresAt!,
        }),
      )
      result = await providerCall(() =>
        this.provider.queryPayment({ ...this.scope(row), merchantRequestRef: row.merchantRequestRef! }),
      )
    }
    if (result.kind !== 'CONFIRMED_RESULT') {
      await this.defer('payment', claim)
      return true
    }
    await this.persistPayment(claim, result, deferInbox)
    return true
  }

  private async persistPayment(
    claim: Claim<Payment>,
    result: Extract<ProviderFinancialResult, { kind: 'CONFIRMED_RESULT' }>,
    deferInbox: boolean,
  ) {
    const queuedId = await paymentTransaction(
      this.db,
      this.logger,
      'recovery.persist',
      { paymentId: claim.row.id },
      async (tx, stage) => {
        stage('lock.invoice')
        await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${claim.row.invoiceId}::uuid FOR UPDATE`
        stage('lock.payment')
        await tx.$queryRaw`SELECT id FROM payments WHERE id = ${claim.row.id}::uuid FOR UPDATE`
        stage('persist')
        const row = await tx.payment.findUniqueOrThrow({ where: { id: claim.row.id } })
        const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
        if (
          row.leaseToken !== claim.row.leaseToken ||
          row.version !== claim.row.version ||
          !row.leaseUntil ||
          row.leaseUntil <= now
        )
          return null
        const event = result.event
        const mismatch =
          event.kind !== 'PAYMENT' ||
          event.gateway !== row.paymentGateway ||
          event.environment !== row.providerEnvironment ||
          event.merchantAccountKey !== row.merchantAccountKey ||
          event.merchantRequestRef !== row.merchantRequestRef ||
          event.currency !== row.currency ||
          !row.amount.equals(event.amount)
        if (claim.review || mismatch) {
          await tx.auditLog.create({
            data: {
              action: 'PAYMENT_AUTHORITATIVE_QUERY_REVIEW',
              entityType: 'Payment',
              entityId: row.id,
              newValues: { event: { ...event }, mismatch },
            },
          })
          await tx.payment.update({
            where: { id: row.id },
            data: {
              reconcileStatus: 'NEEDS_REVIEW',
              lastCheckedAt: now,
              nextRetryAt: null,
              lastErrorCode: mismatch ? 'PAYMENT_QUERY_MISMATCH' : row.lastErrorCode,
              leaseToken: null,
              leaseUntil: null,
              version: { increment: 1 },
            },
          })
          return null
        }
        const providerEventId = `query:${row.id}:${paymentHash(event)}`
        const payload = { ...event, providerEventId }
        const existing = await tx.paymentWebhookEvent.findFirst({
          where: {
            paymentGateway: event.gateway,
            providerEnvironment: event.environment,
            merchantAccountKey: event.merchantAccountKey,
            providerEventId,
          },
        })
        const inbox =
          existing ??
          (await tx.paymentWebhookEvent.create({
            data: {
              paymentGateway: event.gateway,
              providerEnvironment: event.environment,
              merchantAccountKey: event.merchantAccountKey,
              providerEventId,
              eventKind: 'PAYMENT',
              payload,
              payloadHash: paymentHash(payload),
              verifiedAt: now,
              processingStatus: 'RECEIVED',
              paymentId: row.id,
            },
          }))
        await tx.payment.update({
          where: { id: row.id },
          data: {
            ...(result.checkout && ['PENDING', 'PROCESSING'].includes(row.status)
              ? { checkoutData: result.checkout }
              : {}),
            reconcileStatus:
              existing?.processed && !['PENDING', 'PROCESSING'].includes(row.status) ? 'RESOLVED' : 'SCHEDULED',
            lastCheckedAt: now,
            nextRetryAt:
              existing?.processed && !['PENDING', 'PROCESSING'].includes(row.status)
                ? null
                : new Date(now.getTime() + paymentRecoveryConfig().retrySeconds * 1000),
            lastErrorCode: null,
            leaseToken: null,
            leaseUntil: null,
            version: { increment: 1 },
          },
        })
        return inbox.id
      },
    )
    // Background recovery leaves durable inbox work to the event worker. Explicit
    // reconciliation and deployments without that worker retain inline processing.
    if (queuedId && (!deferInbox || process.env.PAYMENT_EVENTS_WORKER_ENABLED === 'false'))
      await this.inbox.process(queuedId)
  }

  async reconcileRefund(id?: string): Promise<boolean> {
    const value = await this.claim('refund', id)
    if (!value) return false
    const claim = value as Claim<Refund>
    const row = claim.row
    const payment = await this.db.payment.findUniqueOrThrow({ where: { id: row.paymentId } })
    if (!row.merchantRefundRef || !payment.merchantRequestRef) {
      await this.defer('refund', { ...claim, review: true }, 'REFUND_LEGACY_METADATA')
      return true
    }
    let result = await providerCall(() =>
      this.provider.queryRefund({ ...this.scope(row), merchantRefundRef: row.merchantRefundRef! }),
    )
    if (
      result.kind === 'NOT_FOUND' &&
      this.provider.forGateway(row.paymentGateway!)?.supportsIdempotentCreate &&
      !claim.review &&
      ['PENDING', 'PROCESSING'].includes(row.status)
    ) {
      result = await providerCall(() =>
        this.provider.refund({
          ...this.scope(row),
          merchantRequestRef: payment.merchantRequestRef!,
          merchantRefundRef: row.merchantRefundRef!,
          amount: row.amount.toFixed(),
          currency: row.currency,
        }),
      )
    }
    if (result.kind !== 'CONFIRMED_RESULT') {
      await this.defer('refund', claim)
      return true
    }
    if (
      result.event.kind !== 'REFUND' ||
      result.event.merchantRefundRef !== row.merchantRefundRef ||
      result.event.gateway !== row.paymentGateway ||
      result.event.environment !== row.providerEnvironment ||
      result.event.merchantAccountKey !== row.merchantAccountKey
    ) {
      await this.defer('refund', { ...claim, review: true }, 'REFUND_QUERY_MISMATCH')
      return true
    }
    await this.refunds.applyEvent(result.event, {
      refundId: row.id,
      lease: { token: row.leaseToken!, version: row.version },
    })
    return true
  }

  async schedule(kind: Kind, id: string, actorId: string, reason: string) {
    const table = Prisma.raw(kind === 'payment' ? 'payments' : 'refunds')
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM ${table} WHERE id = ${id}::uuid FOR UPDATE`,
      )
      if (!rows.length) throw AppError.fromCode(E.PAYMENT_NOT_FOUND)
      await tx.$executeRaw(Prisma.sql`UPDATE ${table} SET reconcile_status = 'SCHEDULED', next_retry_at = clock_timestamp(),
        version = version + 1, updated_at = clock_timestamp()
        WHERE id = ${id}::uuid AND (lease_until IS NULL OR lease_until <= clock_timestamp())`)
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: `${kind.toUpperCase()}_RECONCILE_REQUESTED`,
          entityType: kind === 'payment' ? 'Payment' : 'Refund',
          entityId: id,
          newValues: { reason },
        },
      })
      const resource =
        kind === 'payment'
          ? await tx.payment.findUniqueOrThrow({ where: { id } })
          : await tx.refund.findUniqueOrThrow({ where: { id } })
      return { [kind === 'payment' ? 'paymentId' : 'refundId']: id, reconcileStatus: resource.reconcileStatus }
    })
  }

  @Interval(2000)
  async tick() {
    if (this.running || process.env.PAYMENT_RECOVERY_WORKER_ENABLED === 'false') return
    this.running = true
    try {
      for (let i = 0; i < 10; i++) if (!(await this.reconcilePayment(undefined, true))) break
      for (let i = 0; i < 10; i++) if (!(await this.reconcileRefund())) break
    } catch (error) {
      this.logger.warn({
        message: 'Payment recovery deferred; persisted leases remain reclaimable',
        ...paymentFailure(error),
      })
    } finally {
      this.running = false
    }
  }
}
