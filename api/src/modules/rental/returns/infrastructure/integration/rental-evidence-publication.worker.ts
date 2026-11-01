import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { createHmac, randomUUID } from 'node:crypto'
import { PrismaService } from 'src/shared/services/prisma.service'
import envconfig from 'src/shared/config'
import { GetMediaDeliveryUseCase } from '../../../../media/application/use-cases/get-media-delivery.use-case'
import { RentalEvidenceAccessService } from './rental-evidence-access.service'

/** Verify the exact owner-scoped delivery URLs before recording publication. */
@Injectable()
export class RentalEvidencePublicationWorker {
  private readonly logger = new Logger(RentalEvidencePublicationWorker.name)
  private cursor?: string
  private running = false
  constructor(private readonly db: PrismaService, private readonly delivery: GetMediaDeliveryUseCase,
    private readonly access: RentalEvidenceAccessService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async publishPending() {
    if (this.running) return
    this.running = true
    try {
      const cases = await this.db.rentalExceptionCase.findMany({
        where: { status: 'RESOLVED', inspectionId: { not: null },
          rentalAssessmentReviewsViaExceptionCaseId: { none: {} },
          AND: [
            { OR: [{ resolution: { startsWith: 'APPROVE_DEDUCTION:' } }, { resolution: { startsWith: 'CONFIRM_LOST:' } }] },
            { OR: [{ evidenceAccessibleAt: null }, { evidenceAccessBlockedAt: { not: null } }, { dueAt: { gt: new Date() } }] },
          ] },
        include: { order: { include: { user: true } }, inspection: { include: { findingsViaInspectionId: true } } },
        orderBy: { id: 'asc' }, take: 25, ...(this.cursor ? { cursor: { id: this.cursor }, skip: 1 } : {}),
      })
      this.cursor = cases.length === 25 ? cases[cases.length - 1].id : undefined
      for (const c of cases) {
        try {
          if (c.evidenceAccessCustomerConfirmationRequired) continue
          const secret = envconfig.RENTAL_MEDIA_ACCESS_ATTESTATION_SECRET
          if (!secret) throw new Error('ATTESTATION_SECRET_NOT_CONFIGURED')
          const ids = Array.isArray(c.evidenceIds) ? c.evidenceIds.filter((v): v is string => typeof v === 'string') : []
          const allEvidence = [c.inspection?.evidenceIds, ...(c.inspection?.findingsViaInspectionId.map(f => f.evidenceIds) ?? [])]
            .flatMap(v => Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : [])
          if (!ids.length || allEvidence.some(id => !ids.includes(id))) throw new Error('INCOMPLETE_EVIDENCE_SET')
          const owner = c.order.user
          if (owner.status !== 'ACTIVE') throw new Error('ORDER_OWNER_INACTIVE')
          const assets = await this.db.mediaAsset.findMany({ where: { id: { in: ids }, status: 'READY', deletedAt: null } })
          if (assets.length !== ids.length) throw new Error('EVIDENCE_NOT_READY')
          const verificationStartedAt = new Date().toISOString()
          for (const asset of assets) {
            const result = await this.delivery.execute({ mediaId: asset.id,
              variant: asset.resourceType === 'VIDEO' ? 'VIDEO_PREVIEW' : 'EVIDENCE_PREVIEW' },
              { id: owner.id, authUserId: owner.authUserId, email: owner.email, role: owner.role, status: owner.status })
            const response = await fetch(result.url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(10_000) })
            await response.body?.cancel()
            if (!response.ok) throw new Error('EVIDENCE_DELIVERY_UNAVAILABLE')
          }
          const request = { caseId: c.id, userId: owner.id, publishedAt: verificationStartedAt, mediaIds: ids, requestId: randomUUID() }
          const raw = JSON.stringify([request.caseId, request.userId, request.publishedAt, [...ids].sort(), request.requestId])
          await this.access.confirm(request, createHmac('sha256', secret).update(raw).digest('hex'), c.evidenceAccessBlockedAt?.toISOString() ?? null)
        } catch (error) {
          if (c.evidenceAccessibleAt && !c.evidenceAccessBlockedAt) {
            try { await this.access.blockAccess({ orderId: c.orderId, caseId: c.id }) }
            catch (holdError) { this.logger.warn(`Evidence access hold deferred for case ${c.id}: ${(holdError as Error).message}`) }
          }
          this.logger.warn(`Evidence publication deferred for case ${c.id}: ${(error as Error).message}`)
        }
      }
    } finally { this.running = false }
  }
}
