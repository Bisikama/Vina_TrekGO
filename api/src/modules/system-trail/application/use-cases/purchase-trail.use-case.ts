import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../../../shared/errors'
import { PaymentsPort } from '../../../payments/payments.port'
import { PaymentMethod } from '../../../payments/payment-provider.port'
import { paymentHash } from '../../../payments/payment-utils'

@Injectable()
export class PurchaseTrailUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly payments: PaymentsPort,
  ) {}

  async execute(input: { trailId: string; actorUserId: string; idempotencyKey: string; paymentMethod: PaymentMethod; clientIp?: string; gateway?: 'momo' | 'vnpay' }) {
    const key = paymentHash([input.actorUserId, input.trailId, 'trail-purchase', input.idempotencyKey])
    const reserved = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`
      await tx.$queryRaw`SELECT id FROM system_trails WHERE id = ${input.trailId}::uuid FOR UPDATE`
      const trail = await tx.systemTrail.findUnique({ where: { id: input.trailId } })
      if (!trail) throw AppError.fromCode('NOT_FOUND')
      const existing = await tx.trailPurchaseRequest.findUnique({ where: { id: key } })
      if (existing) {
        if (
          existing.userId !== input.actorUserId ||
          existing.systemTrailId !== input.trailId ||
          existing.paymentMethod !== input.paymentMethod
        )
          throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return { request: existing, created: false }
      }
      if (trail.status !== 'ACTIVE' || trail.archivedAt) throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      const initial = await tx.trailAccess.findUnique({
        where: {
          userId_systemTrailId: {
            userId: input.actorUserId,
            systemTrailId: trail.id,
          },
        },
      })
      if (initial) await tx.$queryRaw`SELECT id FROM trail_accesses WHERE id = ${initial.id}::uuid FOR UPDATE`
      const access = initial ? await tx.trailAccess.findUniqueOrThrow({ where: { id: initial.id } }) : null
      if (access && (access.status !== 'PENDING_PAYMENT' || access.sourceType !== 'PURCHASE'))
        throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
      const price = access?.priceSnapshot ?? trail.price
      if (price.isNegative() || !price.isInteger()) throw AppError.fromCode(E.PAYMENT_AMOUNT_MISMATCH)
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const source =
        access ??
        (await tx.trailAccess.create({
          data: {
            userId: input.actorUserId,
            systemTrailId: trail.id,
            priceSnapshot: price,
            sourceType: 'PURCHASE',
            status: 'PENDING_PAYMENT',
          },
        }))
      const invoices = await tx.invoice.findMany({
        where: { trailAccessId: source.id },
        orderBy: { revisionNo: 'desc' },
      })
      let invoiceId: string | null = null
      if (price.isZero()) {
        // Existing paid history must never turn into a free grant after a catalog price change.
        if (invoices.length) throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
        await tx.trailAccess.update({ where: { id: source.id }, data: { status: 'ACTIVE', activatedAt: now } })
        await tx.auditLog.create({
          data: {
            userId: input.actorUserId,
            action: 'TRAIL_ACCESS_FREE_GRANTED',
            entityType: 'TrailAccess',
            entityId: source.id,
            newValues: { systemTrailId: trail.id, priceSnapshot: '0' },
          },
        })
      } else {
        if (invoices.length) {
          const candidate = invoices[0]
          await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${candidate.id}::uuid FOR UPDATE`
          const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: candidate.id } })
          if (
            invoice.invoiceType !== 'TRAIL_ACCESS' ||
            invoice.userId !== input.actorUserId ||
            !invoice.revisionNo ||
            !['DRAFT', 'PENDING_PAYMENT'].includes(invoice.status) ||
            !invoice.totalAmount.equals(price)
          )
            throw AppError.fromCode(E.PAYMENT_INVALID_STATE)
          invoiceId = invoice.id
        } else {
          const invoice = await tx.invoice.create({
            data: {
              invoiceNo: `TRAIL-${randomUUID()}`,
              invoiceType: 'TRAIL_ACCESS',
              userId: input.actorUserId,
              trailAccessId: source.id,
              revisionNo: 1,
              subtotalAmount: price,
              totalAmount: price,
              discountAmount: 0,
              currency: 'VND',
              status: 'PENDING_PAYMENT',
              invoiceLinesViaInvoiceId: {
                create: {
                  lineCode: 'TRAIL_ACCESS',
                  description: 'Trail access',
                  quantity: 1,
                  unitAmount: price,
                  lineAmount: price,
                  referenceType: 'SystemTrail',
                  referenceId: trail.id,
                },
              },
            },
          })
          invoiceId = invoice.id
        }
      }
      const request = await tx.trailPurchaseRequest.create({
        data: {
          id: key,
          userId: input.actorUserId,
          systemTrailId: trail.id,
          trailAccessId: source.id,
          invoiceId,
          paymentMethod: input.paymentMethod,
        },
      })
      return { request, created: true }
    })
    const purchase = reserved.request
    if (!purchase.invoiceId) {
      const access = await this.db.trailAccess.findUniqueOrThrow({ where: { id: purchase.trailAccessId } })
      return {
        httpStatus: reserved.created ? 201 : 200,
        body: {
          trailAccessId: access.id,
          accessStatus: access.status,
          paymentId: null,
          invoiceId: null,
          amount: '0',
          currency: 'VND',
          checkout: null,
        },
      }
    }
    const checkout = await this.payments.createCheckout({
      invoiceId: purchase.invoiceId,
      actorUserId: input.actorUserId,
      idempotencyKey: purchase.id,
      paymentMethod: input.paymentMethod,
      clientIp: input.clientIp,
      gateway: input.gateway,
    })
    const access = await this.db.trailAccess.findUniqueOrThrow({ where: { id: purchase.trailAccessId } })
    return {
      httpStatus: checkout.httpStatus,
      body: { ...checkout.body, trailAccessId: access.id, accessStatus: access.status },
    }
  }
}
