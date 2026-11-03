import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AppError } from '../../shared/errors'
import { PrismaService } from '../../shared/services/prisma.service'
import { ActiveUserData } from '../../shared/types/user.type'
import { paymentHash } from './payment-utils'
import { refundSummary } from './refunds.service'
import { publishRefundSettlement } from './refund-settlement'
import { ManualAction, ManualActionBody, RefundQuery } from './dtos/manual-refund.dto'

const include = {
  manualRefund: true,
  payment: { include: { invoice: true, application: true } },
} satisfies Prisma.RefundInclude
type Detail = Prisma.RefundGetPayload<{ include: typeof include }>
function conflict(code = 'MANUAL_REFUND_INVALID_STATE'): never {
  throw AppError.fromCode(code)
}
const mask = (account: string | null) =>
  account ? '*'.repeat(Math.max(account.length - 4, 0)) + account.slice(-4) : null

@Injectable()
export class ManualRefundsService {
  constructor(private readonly db: PrismaService) {}

  private view(row: Detail, actor: ActiveUserData, detail: boolean) {
    const m = row.manualRefund
    const simulated = Boolean((row.providerPayload as Prisma.JsonObject | null)?.sandboxSimulation)
    const assigned = actor.role === 'ADMIN' && m?.assignedAdminId === actor.id
    return {
      ...refundSummary(row),
      source: row.payment.invoice.invoiceType,
      sourceId: row.payment.invoice.bookingId ?? row.payment.invoice.rentalOrderId ?? row.payment.invoice.trailAccessId,
      executionMode: row.executionMode,
      confirmationSource: simulated
        ? 'SANDBOX_SIMULATION'
        : m?.status === 'COMPLETED'
          ? 'ADMIN_MANUAL'
          : row.executionMode === 'PROVIDER_API' && row.status === 'SUCCEEDED'
            ? 'PROVIDER'
            : null,
      reconciliationRequired:
        row.reconcileStatus === 'NEEDS_REVIEW' ||
        m?.status === 'NEEDS_REVIEW' ||
        (!m && ['SCHEDULED', 'RUNNING'].includes(row.reconcileStatus)),
      manualRefund: m
        ? {
            manualStatus: m.status,
            version: m.version,
            assignedAdminId: m.assignedAdminId,
            claimedAt: m.claimedAt?.toISOString() ?? null,
            recipient: m.accountNumber
              ? {
                  bankBin: m.bankBin,
                  accountNumber: detail ? m.accountNumber : mask(m.accountNumber),
                  accountHolderName: m.accountHolderName,
                  ownershipConfirmedAt: m.ownershipConfirmedAt?.toISOString(),
                }
              : null,
            ...(detail
              ? {
                  bankTransactionRef: m.bankTransactionRef,
                  transferredAt: m.transferredAt?.toISOString() ?? null,
                  confirmedBy: m.confirmedBy,
                  evidenceMediaId: m.evidenceMediaId,
                  note: m.note,
                  sourceBankBin: m.sourceBankBin,
                  sourceAccountNumber: m.sourceAccountNumber,
                }
              : {}),
          }
        : null,
      availableActions:
        !m || m.status === 'COMPLETED'
          ? []
          : actor.role === 'ADMIN'
            ? m.status === 'READY'
              ? ['claim']
              : assigned
                ? ['review', 'complete', ...(m.status === 'PROCESSING' ? ['release'] : []), 'reassign']
                : m.assignedAdminId
                  ? ['reassign']
                  : []
            : row.payment.invoice.userId === actor.id && ['AWAITING_RECIPIENT', 'READY'].includes(m.status)
              ? ['recipient']
              : [],
    }
  }

  async list(actor: ActiveUserData, query: RefundQuery, admin = false) {
    if (admin && actor.role !== 'ADMIN') throw AppError.fromCode('FORBIDDEN')
    const where: Prisma.RefundWhereInput = {
      ...(admin ? { executionMode: 'MANUAL_BANK_TRANSFER' } : {}),
      payment: {
        invoice: { ...(!admin ? { userId: actor.id } : {}), ...(query.source ? { invoiceType: query.source } : {}) },
      },
      ...(query.purpose ? { purpose: query.purpose } : {}),
      ...(query.manualStatus || query.assignedAdminId
        ? {
            manualRefund: {
              ...(query.manualStatus ? { status: query.manualStatus } : {}),
              ...(query.assignedAdminId ? { assignedAdminId: query.assignedAdminId } : {}),
            },
          }
        : {}),
    }
    const [total, rows] = await this.db.$transaction([
      this.db.refund.count({ where }),
      this.db.refund.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])
    return {
      items: rows.map((row) => this.view(row, actor, false)),
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    }
  }

  async detail(id: string, actor: ActiveUserData, admin = false) {
    if (admin && actor.role !== 'ADMIN') throw AppError.fromCode('FORBIDDEN')
    const row = await this.db.refund.findFirst({
      where: {
        id,
        ...(admin ? { executionMode: 'MANUAL_BANK_TRANSFER' } : {}),
        ...(actor.role !== 'ADMIN' ? { payment: { invoice: { userId: actor.id } } } : {}),
      },
      include,
    })
    if (!row) throw AppError.fromCode('PAYMENT_NOT_FOUND')
    const application =
      row.purpose === 'DEPOSIT'
        ? await this.db.paymentOutboxEvent.findUnique({ where: { deduplicationKey: `refund:${id}:succeeded:v1` } })
        : null
    const result = {
      ...this.view(row, actor, true),
      settlementProcessingStatus: row.purpose === 'DEPOSIT' ? (application?.status ?? 'PENDING') : null,
    }
    if (!admin) return result
    const [actions, allocations, owner] = await Promise.all([
      this.db.manualRefundAction.findMany({
        where: { refundId: id },
        select: { id: true, action: true, actorId: true, createdAt: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.db.refundAllocation.findMany({
        where: { refundId: id },
        select: { paymentAllocationId: true, amount: true },
      }),
      this.db.user.findUnique({ where: { id: row.payment.invoice.userId }, select: { id: true, fullName: true } }),
    ])
    return {
      ...result,
      invoiceOwner: owner,
      actions,
      allocations: allocations.map((a) => ({ ...a, amount: a.amount.toFixed(0) })),
      sourcePayment: {
        paymentId: row.paymentId,
        gateway: row.payment.paymentGateway,
        amount: row.payment.amount.toFixed(0),
        status: row.payment.status,
      },
    }
  }

  async mutate(id: string, actor: ActiveUserData, key: string, action: ManualAction, body: ManualActionBody) {
    if (action !== 'recipient' && actor.role !== 'ADMIN') throw AppError.fromCode('FORBIDDEN')
    const idem = paymentHash(['manual-refund', actor.id, key])
    const requestHash = paymentHash({ id, action, body })
    try {
      return await this.db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idem}, 0))::text`
          const initial = await tx.refund.findUnique({ where: { id }, include })
          if (!initial || (action === 'recipient' && initial.payment.invoice.userId !== actor.id))
            throw AppError.fromCode('PAYMENT_NOT_FOUND')
          // Match financial writers' lock order, then take the manual work-item lock.
          if (initial.purpose === 'RENTAL_CANCELLATION' && initial.rentalOrderId)
            await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${initial.rentalOrderId}::uuid FOR UPDATE`
          await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${initial.payment.invoiceId}::uuid FOR UPDATE`
          await tx.$queryRaw`SELECT id FROM payments WHERE id = ${initial.paymentId}::uuid FOR UPDATE`
          await tx.$queryRaw`SELECT id FROM payment_allocations WHERE payment_id = ${initial.paymentId}::uuid ORDER BY id FOR UPDATE`
          await tx.$queryRaw`SELECT id FROM refunds WHERE id = ${id}::uuid FOR UPDATE`
          await tx.$queryRaw`SELECT refund_id FROM manual_refunds WHERE refund_id = ${id}::uuid FOR UPDATE`
          const previous = await tx.manualRefundAction.findUnique({ where: { idempotencyKey: idem } })
          if (previous) {
            if (previous.requestHash !== requestHash) conflict('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD')
            return previous.result
          }
          const row = await tx.refund.findUniqueOrThrow({ where: { id }, include })
          const m = row.manualRefund
          if (
            !m ||
            row.executionMode !== 'MANUAL_BANK_TRANSFER' ||
            row.paymentGateway !== 'payos' ||
            row.providerEnvironment !== 'PRODUCTION' ||
            row.payment.paymentGateway !== 'payos' ||
            row.payment.providerEnvironment !== 'PRODUCTION' ||
            row.payment.status !== 'SUCCEEDED' ||
            row.merchantAccountKey !== row.payment.merchantAccountKey ||
            row.payment.reconcileStatus === 'NEEDS_REVIEW' ||
            row.reconcileStatus === 'NEEDS_REVIEW' ||
            !['PENDING', 'PROCESSING'].includes(row.status) ||
            m.status === 'COMPLETED'
          )
            conflict()
          if (m.version !== body.expectedVersion) conflict('MANUAL_REFUND_VERSION_CONFLICT')
          const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
          let data: Prisma.ManualRefundUpdateInput = { version: { increment: 1 } }
          if (action === 'recipient' && 'bankBin' in body) {
            if (!['AWAITING_RECIPIENT', 'READY'].includes(m.status) || m.assignedAdminId)
              conflict('MANUAL_REFUND_RECIPIENT_LOCKED')
            data = {
              ...data,
              status: 'READY',
              bankBin: body.bankBin,
              accountNumber: body.accountNumber,
              accountHolderName: body.accountHolderName,
              ownershipConfirmedAt: now,
            }
          } else if (action === 'claim' && 'accountNameChecked' in body) {
            if (m.status !== 'READY' || m.assignedAdminId || !m.accountNumber || !m.accountHolderName || !m.bankBin)
              conflict('MANUAL_REFUND_ALREADY_CLAIMED')
            data = { ...data, status: 'PROCESSING', assignedAdminId: actor.id, claimedAt: now }
            await tx.refund.update({ where: { id }, data: { status: 'PROCESSING', version: { increment: 1 } } })
          } else if (action === 'reassign' && 'assignedAdminId' in body) {
            if (!['PROCESSING', 'NEEDS_REVIEW'].includes(m.status) || !m.assignedAdminId) conflict()
            const target = await tx.user.findFirst({
              where: { id: body.assignedAdminId, role: 'ADMIN', status: 'ACTIVE' },
              select: { id: true },
            })
            if (!target || target.id === m.assignedAdminId) conflict()
            // Keep the original claim time: a transfer may predate reassignment.
            data = { ...data, assignedAdminId: target.id, status: 'NEEDS_REVIEW', note: body.reason }
          } else {
            if (m.assignedAdminId !== actor.id) conflict('MANUAL_REFUND_NOT_ASSIGNED')
            if (action === 'release' && 'noTransferConfirmed' in body) {
              if (m.status !== 'PROCESSING') conflict()
              data = { ...data, status: 'READY', assignedAdminId: null, claimedAt: null, note: body.reason }
              await tx.refund.update({ where: { id }, data: { status: 'PENDING', version: { increment: 1 } } })
            } else if (action === 'review' && 'reason' in body) {
              if (!['PROCESSING', 'NEEDS_REVIEW'].includes(m.status)) conflict()
              data = { ...data, status: 'NEEDS_REVIEW', note: body.reason }
            } else if (action === 'complete' && 'transferredAmount' in body) {
              if (!['PROCESSING', 'NEEDS_REVIEW'].includes(m.status)) conflict()
              if (!row.amount.equals(body.transferredAmount)) conflict('MANUAL_REFUND_AMOUNT_MISMATCH')
              const date = new Date(body.transferredAt)
              if (!m.claimedAt || date > now || date < m.claimedAt) throw AppError.fromCode('VALIDATION_ERROR')
              const reserved = await tx.refund.aggregate({
                where: { paymentId: row.paymentId, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
                _sum: { amount: true },
              })
              if (reserved._sum.amount?.gt(row.payment.amount)) conflict('REFUND_AMOUNT_EXCEEDED')
              if (body.evidenceMediaId) {
                const media = await tx.mediaAsset.findFirst({
                  where: { id: body.evidenceMediaId, ownerUserId: actor.id, status: 'READY', resourceType: 'IMAGE' },
                  select: { id: true },
                })
                if (!media) throw AppError.fromCode('VALIDATION_ERROR')
              }
              data = {
                ...data,
                status: 'COMPLETED',
                sourceBankBin: body.sourceBankBin,
                sourceAccountNumber: body.sourceAccountNumber,
                bankTransactionRef: body.bankTransactionRef,
                transferredAt: date,
                confirmedBy: actor.id,
                evidenceMediaId: body.evidenceMediaId,
                note: body.note ?? null,
              }
              const ref = `manual:${id}`
              await tx.refund.update({
                where: { id },
                data: {
                  status: 'SUCCEEDED',
                  refundedAt: date,
                  refundTransactionRef: ref,
                  reconcileStatus: 'RESOLVED',
                  nextRetryAt: null,
                  lastErrorCode: null,
                  version: { increment: 1 },
                },
              })
              await publishRefundSettlement(tx, row, { status: 'SUCCEEDED', refundTransactionRef: ref }, 'ADMIN_MANUAL')
            } else conflict()
          }
          await tx.manualRefund.update({ where: { refundId: id }, data })
          const updated = await tx.refund.findUniqueOrThrow({ where: { id }, include })
          const result = this.view(updated, actor, true)
          await tx.manualRefundAction.create({
            data: {
              refundId: id,
              actorId: actor.id,
              action,
              idempotencyKey: idem,
              requestHash,
              result: result as unknown as Prisma.InputJsonObject,
            },
          })
          await tx.auditLog.create({
            data: {
              userId: actor.id,
              action: `MANUAL_REFUND_${action.toUpperCase()}`,
              entityType: 'Refund',
              entityId: id,
              newValues: {
                manualStatus: updated.manualRefund!.status,
                version: updated.manualRefund!.version,
                confirmationSource: action === 'complete' ? 'ADMIN_MANUAL' : null,
                requestHash,
                ...('reason' in body ? { reason: body.reason } : {}),
              },
            },
          })
          return result
        },
        { timeout: 15000, maxWait: 10000 },
      )
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        conflict('MANUAL_REFUND_TRANSFER_REUSED')
      throw error
    }
  }
}
