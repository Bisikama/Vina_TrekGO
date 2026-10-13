import { Injectable } from '@nestjs/common'
import { Prisma, LeaderCertificate } from '@prisma/client'
import { PrismaService } from '../../../shared/services/prisma.service'
import { AppError, LEADER_ERROR_CODES as E } from '../../../shared/errors'
import type { ActiveUserData } from '../../../shared/types/user.type'
import { GetMediaDeliveryUseCase } from '../../media/application/use-cases/get-media-delivery.use-case'
import { CERTIFICATE_TYPES, encodeCertificateType, decodeCertificateType } from '../domain/certificate-types'
import type { SubmitInput, ListInput, ReviewInput } from '../presentation/leader.schemas'

const fail = (code: string): never => {
  throw new AppError({ code })
}
const applicantSelect = { id: true, fullName: true, email: true } as const
const include = {
  user: { select: applicantSelect },
  leaderCertificatesViaApplicationId: { orderBy: { id: 'asc' as const } },
}
type DB = Prisma.TransactionClient

@Injectable()
export class LeaderApplicationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly delivery: GetMediaDeliveryUseCase,
  ) {}

  private async actor(db: DB, actor: ActiveUserData, roles: string[], lock = false) {
    if (!actor?.id) fail('UNAUTHENTICATED')
    if (lock) await db.$queryRaw`SELECT id FROM users WHERE id = ${actor.id}::uuid FOR UPDATE`
    const user = await db.user.findUnique({ where: { id: actor.id } })
    if (!user || user.status !== 'ACTIVE' || !roles.includes(user.role)) fail('FORBIDDEN')
    return user!
  }

  async types(actor: ActiveUserData) {
    await this.actor(this.db, actor, ['USER', 'LEADER', 'ADMIN'])
    return { items: CERTIFICATE_TYPES }
  }

  async submit(actor: ActiveUserData, input: SubmitInput) {
    if (actor?.role === 'LEADER') fail(E.LEADER_CANNOT_APPLY)
    if (!input.certificates.length) fail(E.CERTIFICATE_REQUIRED)
    const keys = input.certificates.map((c) => c.fileKey)
    if (new Set(keys).size !== keys.length) fail(E.INVALID_CERTIFICATE_FILE)
    for (const c of input.certificates) {
      if (
        !CERTIFICATE_TYPES.some((t) => t.code === c.typeCode) ||
        (c.typeCode === 'OTHER' ? !c.otherTypeName?.trim() : !!c.otherTypeName)
      )
        fail(E.INVALID_CERTIFICATE_TYPE)
    }
    try {
      return await this.db.$transaction(async (tx) => {
        const user = await this.actor(tx, actor, ['USER', 'LEADER'], true)
        if (user.role === 'LEADER') fail(E.LEADER_CANNOT_APPLY)
        if (
          await tx.leaderApplication.findFirst({
            where: { userId: user.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
          })
        )
          fail(E.APPLICATION_ALREADY_PENDING)
        // Order locks consistently for multiple document submissions.
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM media_assets WHERE id IN (${Prisma.join([...keys].sort().map((k) => Prisma.sql`${k}::uuid`))}) ORDER BY id FOR UPDATE`,
        )
        const assets = await tx.mediaAsset.findMany({
          where: { id: { in: keys } },
          include: { leaderCertificate: true },
        })
        if (
          assets.length !== keys.length ||
          assets.some(
            (a) =>
              a.ownerUserId !== user.id ||
              a.scope !== 'LEADER_CERTIFICATE' ||
              a.status !== 'READY' ||
              a.deliveryType !== 'authenticated' ||
              !a.providerAssetId ||
              !a.providerPublicId ||
              !['jpg', 'jpeg', 'png', 'pdf'].includes(a.format || '') ||
              a.leaderCertificate,
          )
        )
          fail(E.INVALID_CERTIFICATE_FILE)
        const now = new Date()
        const app = await tx.leaderApplication.create({
          data: {
            userId: user.id,
            status: 'SUBMITTED',
            motivation: input.motivation,
            experienceSummary: input.experienceSummary,
            submittedAt: now,
            leaderCertificatesViaApplicationId: {
              create: input.certificates.map((c) => ({
                userId: user.id,
                certificateType: encodeCertificateType(c.typeCode, c.otherTypeName),
                certificateNumber: c.certificateNumber,
                issuer: c.issuer,
                issuedAt: c.issuedAt ? new Date(c.issuedAt) : null,
                expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
                fileUrl: `media:${c.fileKey}`,
                mediaAssetId: c.fileKey,
                status: 'PENDING',
              })),
            },
          },
        })
        await tx.mediaAsset.updateMany({ where: { id: { in: keys } }, data: { retentionUntil: null } })
        return { id: app.id, status: app.status, submittedAt: app.submittedAt, certificateCount: keys.length }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = JSON.stringify(error.meta?.target || '')
        fail(target.includes('media_asset') ? E.INVALID_CERTIFICATE_FILE : E.APPLICATION_ALREADY_PENDING)
      }
      throw error
    }
  }

  private certificate(c: LeaderCertificate) {
    return {
      id: c.id,
      ...decodeCertificateType(c.certificateType),
      certificateNumber: c.certificateNumber,
      issuer: c.issuer,
      issuedAt: c.issuedAt?.toISOString().slice(0, 10) ?? null,
      expiresAt: c.expiresAt?.toISOString().slice(0, 10) ?? null,
      status: c.status,
      rejectionReason: c.rejectionReason,
      verifiedAt: c.verifiedAt,
      mediaId: c.mediaAssetId,
    }
  }

  async mine(actor: ActiveUserData, query: ListInput) {
    await this.actor(this.db, actor, ['USER', 'LEADER'])
    const where = { userId: actor.id }
    const [rows, total] = await this.db.$transaction(
      [
        this.db.leaderApplication.findMany({
          where,
          include,
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.db.leaderApplication.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    )
    return {
      items: rows.map((a) => ({
        id: a.id,
        status: a.status,
        motivation: a.motivation,
        experienceSummary: a.experienceSummary,
        submittedAt: a.submittedAt,
        reviewedAt: a.reviewedAt,
        rejectionReason: a.rejectionReason,
        certificates: a.leaderCertificatesViaApplicationId.map((c) => this.certificate(c)),
      })),
      ...query,
      total,
    }
  }

  async list(actor: ActiveUserData, query: ListInput) {
    await this.actor(this.db, actor, ['ADMIN'])
    const where: Prisma.LeaderApplicationWhereInput = {
      status: query.status,
      ...(query.search
        ? {
            user: {
              OR: [
                { fullName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    }
    const [rows, total] = await this.db.$transaction(
      [
        this.db.leaderApplication.findMany({
          where,
          include: {
            user: { select: applicantSelect },
            _count: { select: { leaderCertificatesViaApplicationId: true } },
          },
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.db.leaderApplication.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    )
    return {
      items: rows.map((a) => ({
        id: a.id,
        status: a.status,
        applicant: a.user,
        submittedAt: a.submittedAt,
        reviewedAt: a.reviewedAt,
        certificateCount: a._count.leaderCertificatesViaApplicationId,
      })),
      page: query.page,
      limit: query.limit,
      total,
    }
  }

  async detail(actor: ActiveUserData, id: string) {
    await this.actor(this.db, actor, ['ADMIN'])
    const a = await this.db.leaderApplication.findUnique({ where: { id }, include })
    if (!a) fail(E.APPLICATION_NOT_FOUND)
    const certs = a!.leaderCertificatesViaApplicationId
    if (certs.some((c) => !c.mediaAssetId)) fail(E.DOCUMENT_NOT_FOUND)
    const files = await this.delivery.executeMany(
      certs.map((c) => ({ mediaId: c.mediaAssetId!, variant: 'DOCUMENT_ORIGINAL' })),
      actor,
    )
    const certificates = certs.map((c, i) => ({
      ...this.certificate(c),
      downloadUrl: files[i].url,
      downloadExpiresAt: files[i].expiresAt,
    }))
    return {
      id: a!.id,
      status: a!.status,
      applicant: a!.user,
      motivation: a!.motivation,
      experienceSummary: a!.experienceSummary,
      submittedAt: a!.submittedAt,
      reviewedAt: a!.reviewedAt,
      rejectionReason: a!.rejectionReason,
      certificates,
    }
  }

  async review(actor: ActiveUserData, id: string, input: ReviewInput, requestId?: string) {
    return this.db.$transaction(async (tx) => {
      await this.actor(tx, actor, ['ADMIN'], true)
      await tx.$queryRaw`SELECT id FROM leader_applications WHERE id = ${id}::uuid FOR UPDATE`
      const app = await tx.leaderApplication.findUnique({
        where: { id },
        include: { leaderCertificatesViaApplicationId: true },
      })
      if (!app) fail(E.APPLICATION_NOT_FOUND)
      if (app!.status !== 'SUBMITTED') fail(E.APPLICATION_NOT_REVIEWABLE)
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${app!.userId}::uuid FOR UPDATE`
      const user = await tx.user.findUniqueOrThrow({ where: { id: app!.userId } })
      if (user.role !== 'USER' || user.status !== 'ACTIVE') fail('FORBIDDEN')
      if (input.decision === 'REJECTED' && !input.rejectionReason?.trim()) fail(E.REJECTION_REASON_REQUIRED)
      const certs = app!.leaderCertificatesViaApplicationId
      if (certs.some((c) => c.userId !== user.id)) fail(E.INVALID_CERTIFICATE_REVIEW)
      const reviews = new Map(input.certificateReviews.map((r) => [r.certificateId, r]))
      if (
        reviews.size !== input.certificateReviews.length ||
        input.certificateReviews.some((r) => !certs.some((c) => c.id === r.certificateId && c.userId === user.id))
      )
        fail(E.INVALID_CERTIFICATE_REVIEW)
      for (const r of reviews.values())
        if (r.status === 'REJECTED' && !r.rejectionReason?.trim()) fail(E.REJECTION_REASON_REQUIRED)
      const now = new Date()
      // Date-only expiry is inclusive, evaluated using the project's Asia/Saigon business day.
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now)
      if (input.decision === 'APPROVED') {
        if (!certs.length || certs.some((c) => (reviews.get(c.id)?.status ?? c.status) === 'PENDING'))
          fail(E.NO_VALID_CERTIFICATE)
        const verified = certs.filter((c) => (reviews.get(c.id)?.status ?? c.status) === 'VERIFIED')
        if (!verified.length) fail(E.NO_VALID_CERTIFICATE)
        if (
          !verified.some(
            (c) =>
              (!c.expiresAt || c.expiresAt.toISOString().slice(0, 10) >= today) &&
              (!c.issuedAt || c.issuedAt.toISOString().slice(0, 10) <= today),
          )
        )
          fail(E.CERTIFICATE_EXPIRED)
      }
      for (const [certificateId, r] of reviews)
        await tx.leaderCertificate.update({
          where: { id: certificateId },
          data: {
            status: r.status,
            rejectionReason: r.status === 'REJECTED' ? r.rejectionReason : null,
            verifiedBy: actor.id,
            verifiedAt: now,
          },
        })
      await tx.leaderApplication.update({
        where: { id },
        data: {
          status: input.decision,
          reviewedBy: actor.id,
          reviewedAt: now,
          version: { increment: 1 },
          rejectionReason: input.decision === 'REJECTED' ? input.rejectionReason : null,
        },
      })
      if (input.decision === 'APPROVED') {
        await tx.leaderProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, verifyStatus: 'APPROVED', verifiedBy: actor.id, verifiedAt: now },
          update: { verifyStatus: 'APPROVED', verifiedBy: actor.id, verifiedAt: now },
        })
        await tx.user.update({ where: { id: user.id }, data: { role: 'LEADER' } })
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'USER_ROLE_CHANGED',
            entityType: 'USER',
            entityId: user.id,
            oldValues: { role: 'USER' },
            newValues: { role: 'LEADER', applicationId: id },
            requestId,
          },
        })
      }
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: `LEADER_APPLICATION_${input.decision}`,
          entityType: 'LEADER_APPLICATION',
          entityId: id,
          oldValues: { status: 'SUBMITTED' },
          newValues: {
            status: input.decision,
            rejectionReason: input.rejectionReason ?? null,
            certificateReviews: input.certificateReviews,
          },
          requestId,
        },
      })
      return {
        applicationId: id,
        status: input.decision,
        userRole: input.decision === 'APPROVED' ? 'LEADER' : user.role,
        reviewedAt: now,
      }
    })
  }
}
