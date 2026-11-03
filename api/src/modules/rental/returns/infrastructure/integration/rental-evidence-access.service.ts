import envconfig from 'src/shared/config'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { MediaStatus, Prisma } from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import { AppError, RENTAL_RETURN_ERROR_CODES as E } from 'src/shared/errors'
import { verifiedEvidenceAccessibleAt } from '../../application/operational-deadlines'

export interface MediaAccessAttestation { caseId: string; userId: string; publishedAt: string; mediaIds: string[]; requestId: string }
const RESTORED_WINDOW_MINUTES = 48 * 60

@Injectable()
export class RentalEvidenceAccessService {
  constructor(private readonly db: PrismaService) {}

  /** Both user reports and monitoring acquire the same order lock used by 609 and settlement. */
  async blockAccess(input: { orderId: string; caseId: string; actorUserId?: string; idempotencyKey?: string }) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${input.orderId}::uuid FOR UPDATE`
      const order = await tx.rentalOrder.findUnique({ where: { id: input.orderId } })
      if (!order) throw AppError.fromCode(E.RENTAL_NOT_FOUND)
      if (input.actorUserId && order.userId !== input.actorUserId) throw AppError.fromCode(E.FORBIDDEN)
      const hash = createHash('sha256').update(JSON.stringify([input.orderId, input.caseId])).digest('hex')
      const scope = 'rental-evidence-access-report'
      if (input.actorUserId && input.idempotencyKey) {
        const existing = await tx.idempotencyRecord.findUnique({ where: { scope_userId_idempotencyKey: {
          scope, userId: input.actorUserId, idempotencyKey: input.idempotencyKey,
        } } })
        if (existing) {
          if (existing.requestHash !== hash) throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED)
          if (existing.responseBody) return existing.responseBody
          throw AppError.fromCode(E.OPERATION_CONFLICT)
        }
        await tx.idempotencyRecord.create({ data: { scope, userId: input.actorUserId, idempotencyKey: input.idempotencyKey, requestHash: hash } })
      }
      await tx.$queryRaw`SELECT id FROM rental_exception_cases WHERE id=${input.caseId}::uuid FOR UPDATE`
      const c = await tx.rentalExceptionCase.findUnique({ where: { id: input.caseId } })
      if (!c || c.orderId !== input.orderId || !c.inspectionId || !c.evidenceAccessibleAt)
        throw AppError.fromCode(E.INVALID_RETURN_STATE, { details: { reason: 'EVIDENCE_NOT_ACCESSIBLE' } })
      const item = await tx.depositSettlementItem.findFirst({ where: { inspectionId: c.inspectionId, settlement: { orderId: order.id } } })
      if (!item || ['REFUND_PENDING', 'REFUND_FAILED', 'SETTLED'].includes(item.status))
        throw AppError.fromCode(E.INVALID_RETURN_STATE, { details: { reason: 'SETTLEMENT_ALREADY_STARTED' } })
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const blockedAt = c.evidenceAccessBlockedAt ?? now
      if (!c.evidenceAccessBlockedAt || (input.actorUserId && !c.evidenceAccessCustomerConfirmationRequired)) {
        await tx.rentalExceptionCase.update({ where: { id: c.id }, data: { evidenceAccessBlockedAt: blockedAt,
          evidenceAccessCustomerConfirmationRequired: Boolean(input.actorUserId) || c.evidenceAccessCustomerConfirmationRequired,
          version: { increment: 1 } } })
        await tx.auditLog.create({ data: { userId: input.actorUserId, action: 'RENTAL_EVIDENCE_ACCESS_INTERRUPTED',
          entityType: 'RentalExceptionCase', entityId: c.id,
          oldValues: { evidenceAccessibleAt: c.evidenceAccessibleAt.toISOString(), dueAt: c.dueAt?.toISOString() ?? null },
          newValues: { blockedAt: blockedAt.toISOString(), source: input.actorUserId ? 'CUSTOMER_REPORT' : 'MONITOR' },
          requestId: input.idempotencyKey } })
      }
      const result = { caseId: c.id, evidenceAccessBlockedAt: blockedAt.toISOString(), status: 'ACCESS_INTERRUPTED' }
      if (input.actorUserId && input.idempotencyKey) await tx.idempotencyRecord.update({ where: { scope_userId_idempotencyKey: {
        scope, userId: input.actorUserId, idempotencyKey: input.idempotencyKey,
      } }, data: { responseStatus: 200, responseBody: result, completedAt: now } })
      return result
    })
  }

  async report(input: { orderId: string; assessmentId: string; actorUserId: string; idempotencyKey: string }) {
    const order = await this.db.rentalOrder.findUnique({ where: { id: input.orderId }, select: { userId: true } })
    if (!order) throw AppError.fromCode(E.RENTAL_NOT_FOUND)
    if (order.userId !== input.actorUserId) throw AppError.fromCode(E.FORBIDDEN)
    const c = await this.db.rentalExceptionCase.findFirst({ where: { orderId: input.orderId,
      inspectionId: input.assessmentId, evidenceAccessibleAt: { not: null } }, orderBy: { evidenceAccessibleAt: 'desc' } })
    if (!c) throw AppError.fromCode(E.INVALID_RETURN_STATE, { details: { reason: 'EVIDENCE_NOT_ACCESSIBLE' } })
    return this.blockAccess({ orderId: input.orderId, caseId: c.id, actorUserId: input.actorUserId, idempotencyKey: input.idempotencyKey })
  }

  /** Customer only confirms their own ability to view; server still verifies before restarting. */
  async acknowledge(input: { orderId: string; assessmentId: string; actorUserId: string; idempotencyKey: string }) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${input.orderId}::uuid FOR UPDATE`
      const order = await tx.rentalOrder.findUnique({ where: { id: input.orderId }, select: { userId: true } })
      if (!order) throw AppError.fromCode(E.RENTAL_NOT_FOUND)
      if (order.userId !== input.actorUserId) throw AppError.fromCode(E.FORBIDDEN)
      const scope = 'rental-evidence-access-confirmation'
      const hash = createHash('sha256').update(JSON.stringify([input.orderId, input.assessmentId])).digest('hex')
      const key = { scope, userId: input.actorUserId, idempotencyKey: input.idempotencyKey }
      const existing = await tx.idempotencyRecord.findUnique({ where: { scope_userId_idempotencyKey: key } })
      if (existing) {
        if (existing.requestHash !== hash) throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED)
        if (existing.responseBody) return existing.responseBody
        throw AppError.fromCode(E.OPERATION_CONFLICT)
      }
      await tx.idempotencyRecord.create({ data: { ...key, requestHash: hash } })
      const c = await tx.rentalExceptionCase.findFirst({ where: { orderId: input.orderId, inspectionId: input.assessmentId,
        evidenceAccessibleAt: { not: null } }, orderBy: { evidenceAccessibleAt: 'desc' } })
      if (!c?.evidenceAccessBlockedAt) throw AppError.fromCode(E.INVALID_RETURN_STATE, { details: { reason: 'EVIDENCE_ACCESS_NOT_INTERRUPTED' } })
      if (c.evidenceAccessCustomerConfirmationRequired) {
        await tx.rentalExceptionCase.update({ where: { id: c.id }, data: { evidenceAccessCustomerConfirmationRequired: false, version: { increment: 1 } } })
        await tx.auditLog.create({ data: { userId: input.actorUserId, action: 'RENTAL_EVIDENCE_CUSTOMER_ACCESS_CONFIRMED',
          entityType: 'RentalExceptionCase', entityId: c.id, requestId: input.idempotencyKey,
          newValues: { blockedAt: c.evidenceAccessBlockedAt.toISOString() } } })
      }
      const result = { caseId: c.id, status: 'AWAITING_VERIFICATION' }
      await tx.idempotencyRecord.update({ where: { scope_userId_idempotencyKey: key }, data: { responseStatus: 200, responseBody: result, completedAt: new Date() } })
      return result
    })
  }

  /** HMAC identifies a trusted verifier; timestamps must be newer than an interruption. */
  async confirm(request: MediaAccessAttestation, signature: string, observedBlockedAt?: string | null) {
    const secret = envconfig.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET ?? process.env.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET
    if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) throw new Error('MEDIA_ACCESS_ATTESTATION_NOT_AUTHENTICATED')
    const raw = JSON.stringify([request.caseId, request.userId, request.publishedAt, [...request.mediaIds].sort(), request.requestId])
    const expected = createHmac('sha256', secret).update(raw).digest()
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error('INVALID_MEDIA_ATTESTATION')
    const publishedAt = new Date(request.publishedAt)
    if (Number.isNaN(publishedAt.getTime()) || Math.abs(Date.now() - publishedAt.getTime()) > 15 * 60_000) throw new Error('EXPIRED_MEDIA_ATTESTATION')
    const initial = await this.db.rentalExceptionCase.findUnique({ where: { id: request.caseId }, select: { orderId: true } })
    if (!initial) throw new Error('CASE_NOT_ACCESSIBLE_TO_OWNER')
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id=${initial.orderId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM rental_exception_cases WHERE id=${request.caseId}::uuid FOR UPDATE`
      const c = await tx.rentalExceptionCase.findUnique({ where: { id: request.caseId }, include: { order: { include: { rentalPolicy: true } } } })
      if (!c || c.order.userId !== request.userId || c.status !== 'RESOLVED') throw new Error('CASE_NOT_ACCESSIBLE_TO_OWNER')
      if (observedBlockedAt !== undefined && (c.evidenceAccessBlockedAt?.toISOString() ?? null) !== observedBlockedAt)
        throw new Error('STALE_MEDIA_ATTESTATION')
      if (c.evidenceAccessibleAt && !c.evidenceAccessBlockedAt) return { evidenceAccessibleAt: c.evidenceAccessibleAt.toISOString(), unchanged: true }
      if (c.evidenceAccessCustomerConfirmationRequired) throw new Error('CUSTOMER_ACCESS_CONFIRMATION_REQUIRED')
      if (c.evidenceAccessBlockedAt && publishedAt.getTime() <= c.evidenceAccessBlockedAt.getTime()) throw new Error('STALE_MEDIA_ATTESTATION')
      const ids = Array.isArray(c.evidenceIds) ? c.evidenceIds.filter((x): x is string => typeof x === 'string') : []
      if (!ids.length || ids.length !== request.mediaIds.length || ids.some(id => !request.mediaIds.includes(id))) throw new Error('ATTESTED_EVIDENCE_SET_MISMATCH')
      const assets = await tx.mediaAsset.findMany({ where: { id: { in: ids }, status: MediaStatus.READY, deletedAt: null }, select: { id: true } })
      if (assets.length !== ids.length) throw new Error('EVIDENCE_FILES_NOT_READY')
      const restoring = Boolean(c.evidenceAccessBlockedAt)
      if (restoring && c.inspectionId) {
        const item = await tx.depositSettlementItem.findFirst({ where: { inspectionId: c.inspectionId, settlement: { orderId: c.orderId } } })
        if (!item || ['REFUND_PENDING', 'REFUND_FAILED', 'SETTLED'].includes(item.status)) throw new Error('SETTLEMENT_ALREADY_STARTED')
      }
      const notice = await tx.notification.create({ data: { userId: request.userId,
        title: restoring ? 'Đã khôi phục hồ sơ kiểm tra thiết bị' : 'Đã công bố hồ sơ kiểm tra thiết bị',
        content: restoring ? 'Chứng cứ đã được khôi phục. Bạn có lại 48 giờ để phản hồi.' : 'Chứng cứ và quyết định được công bố trong tài khoản để phản hồi theo chính sách.',
        notificationType: 'RENTAL_DEDUCTION_EVIDENCE_ACCESSIBLE', referenceType: 'RentalExceptionCase', referenceId: c.id } })
      const accessibleAt = verifiedEvidenceAccessibleAt({ evidencePublishedAt: publishedAt, inAppNoticePublishedAt: notice.createdAt, mediaReadableByOwner: true, noticePersisted: true })
      if (!accessibleAt) throw new Error('EVIDENCE_ACCESS_NOT_VERIFIED')
      const minutes = restoring ? RESTORED_WINDOW_MINUTES : c.order.rentalPolicy.userAssessmentReviewMinutes
      if (!minutes || minutes <= 0) throw new Error('USER_RESPONSE_POLICY_NOT_CONFIGURED')
      const windowEndsAt = new Date(accessibleAt.getTime() + minutes * 60_000)
      await tx.rentalExceptionCase.update({ where: { id: c.id }, data: { evidencePublishedAt: publishedAt,
        inAppNoticePublishedAt: notice.createdAt, evidenceAccessibleAt: accessibleAt, evidenceAccessBlockedAt: null,
        dueAt: windowEndsAt, version: { increment: 1 } } })
      await tx.auditLog.create({ data: { action: restoring ? 'RENTAL_EVIDENCE_ACCESS_RESTORED' : 'RENTAL_EVIDENCE_ACCESSIBLE',
        entityType: 'RentalExceptionCase', entityId: c.id,
        oldValues: restoring ? { evidenceAccessibleAt: c.evidenceAccessibleAt?.toISOString() ?? null, dueAt: c.dueAt?.toISOString() ?? null,
          blockedAt: c.evidenceAccessBlockedAt?.toISOString() ?? null } : Prisma.JsonNull,
        newValues: { evidenceAccessibleAt: accessibleAt.toISOString(), dueAt: windowEndsAt.toISOString(), mediaAttestationId: request.requestId, ownerUserId: request.userId }, requestId: request.requestId } })
      return { evidenceAccessibleAt: accessibleAt.toISOString(), windowEndsAt: windowEndsAt.toISOString(), restored: restoring }
    })
  }
}
