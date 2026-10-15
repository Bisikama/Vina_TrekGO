import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B } from '../../shared/errors'
import {
  canonicalPolicy,
  PolicyContent,
  policyContentSchema,
  PUBLIC_BOOKING_POLICY_CODE as CODE,
} from './booking-policy'

const LOCK = 'booking-policy:PUBLIC_BOOKING_DEFAULT'
const fail = (code: string): never => {
  throw AppError.fromCode(code)
}

// Shared lock also coordinates creation of bookings with policy publication.
export async function lockBookingPolicy(tx: Prisma.TransactionClient, exclusive = false) {
  if (exclusive) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${LOCK}, 0))::text`
  else await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${LOCK}, 0))::text`
}

@Injectable()
export class BookingPolicyService {
  constructor(private readonly db: PrismaService) {}

  async resolve(tx: Prisma.TransactionClient, now: Date) {
    const rows = await tx.bookingPolicy.findMany({
      where: {
        policyCode: CODE,
        isActive: true,
        publishedAt: { not: null },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      take: 2,
    })
    if (!rows.length) fail(B.BOOKING_POLICY_UNAVAILABLE)
    if (rows.length !== 1) fail(B.BOOKING_POLICY_INVALID)
    const policy = rows[0]
    if (
      !policyContentSchema.safeParse({
        holdTtlMinutes: policy.holdTtlMinutes,
        cancellationRules: policy.cancellationRules,
      }).success
    )
      fail(B.BOOKING_POLICY_INVALID)
    return policy
  }

  private async admin(tx: Prisma.TransactionClient, actorId: string) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actorId}::uuid FOR SHARE`
    const actor = await tx.user.findUnique({ where: { id: actorId } })
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') fail('FORBIDDEN')
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    id: string,
    details: Prisma.InputJsonObject,
  ) {
    await tx.auditLog.create({
      data: { userId: actorId, action, entityType: 'BookingPolicy', entityId: id, newValues: details },
    })
  }

  async list(actorId: string, query: { page: number; pageSize: number; state: string }) {
    return this.db.$transaction(
      async (tx) => {
        await this.admin(tx, actorId)
        const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
        const where: Prisma.BookingPolicyWhereInput = { policyCode: CODE }
        if (query.state === 'DRAFT') where.publishedAt = null
        if (query.state === 'CURRENT')
          Object.assign(where, {
            publishedAt: { not: null },
            isActive: true,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          })
        if (query.state === 'RETIRED')
          Object.assign(where, { publishedAt: { not: null }, OR: [{ isActive: false }, { effectiveTo: { lte: now } }] })
        const [total, items] = await Promise.all([
          tx.bookingPolicy.count({ where }),
          tx.bookingPolicy.findMany({
            where,
            orderBy: { versionNo: 'desc' },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
        ])
        return { items, total, page: query.page, pageSize: query.pageSize }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }

  async detail(actorId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.admin(tx, actorId)
      return this.row(tx, id)
    })
  }

  private async row(tx: Prisma.TransactionClient, id: string) {
    const row = await tx.bookingPolicy.findFirst({ where: { id, policyCode: CODE } })
    return row ?? fail(B.BOOKING_POLICY_NOT_FOUND)
  }

  private async draft(tx: Prisma.TransactionClient, id: string, revision: number) {
    await tx.$queryRaw`SELECT id FROM booking_policies WHERE id = ${id}::uuid FOR UPDATE`
    const row = await this.row(tx, id)
    if (row.publishedAt) fail(B.BOOKING_POLICY_IMMUTABLE)
    if (row.revision !== revision) fail(B.BOOKING_POLICY_VERSION_CONFLICT)
    return row
  }

  async create(actorId: string, content: PolicyContent) {
    const data = canonicalPolicy(content)
    return this.db.$transaction(async (tx) => {
      await this.admin(tx, actorId)
      await lockBookingPolicy(tx, true)
      const last = await tx.bookingPolicy.aggregate({ where: { policyCode: CODE }, _max: { versionNo: true } })
      const row = await tx.bookingPolicy.create({
        data: {
          ...data,
          policyCode: CODE,
          versionNo: (last._max.versionNo ?? 0) + 1,
          isActive: false,
          effectiveFrom: new Date(),
          createdBy: actorId,
        },
      })
      await this.audit(tx, actorId, 'BOOKING_POLICY_DRAFT_CREATED', row.id, { versionNo: row.versionNo, ...data })
      return row
    })
  }

  async update(actorId: string, id: string, revision: number, content: PolicyContent) {
    const data = canonicalPolicy(content)
    return this.db.$transaction(async (tx) => {
      await this.admin(tx, actorId)
      await lockBookingPolicy(tx, true)
      await this.draft(tx, id, revision)
      const row = await tx.bookingPolicy.update({ where: { id }, data: { ...data, revision: { increment: 1 } } })
      await this.audit(tx, actorId, 'BOOKING_POLICY_DRAFT_UPDATED', id, { revision: row.revision, ...data })
      return row
    })
  }

  async remove(actorId: string, id: string, revision: number) {
    return this.db.$transaction(async (tx) => {
      await this.admin(tx, actorId)
      await lockBookingPolicy(tx, true)
      const row = await this.draft(tx, id, revision)
      await this.audit(tx, actorId, 'BOOKING_POLICY_DRAFT_DELETED', id, { versionNo: row.versionNo })
      await tx.bookingPolicy.delete({ where: { id } })
      return { id, deleted: true }
    })
  }

  async publish(actorId: string, id: string, revision: number) {
    return this.db.$transaction(async (tx) => {
      await this.admin(tx, actorId)
      await lockBookingPolicy(tx, true)
      await tx.$queryRaw`SELECT id FROM booking_policies WHERE id = ${id}::uuid FOR UPDATE`
      const row = await this.row(tx, id)
      // Safe replay of the same publish request; it never reactivates a retired version.
      if (row.publishedAt && row.revision === revision + 1) return row
      if (row.publishedAt) fail(B.BOOKING_POLICY_IMMUTABLE)
      if (row.revision !== revision) fail(B.BOOKING_POLICY_VERSION_CONFLICT)
      if (
        !policyContentSchema.safeParse({ holdTtlMinutes: row.holdTtlMinutes, cancellationRules: row.cancellationRules })
          .success
      )
        fail(B.BOOKING_POLICY_INVALID)
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`
      const published = await tx.bookingPolicy.findMany({ where: { policyCode: CODE, publishedAt: { not: null } } })
      if (
        published.some(
          (p) => p.versionNo >= row.versionNo || p.effectiveFrom >= now || (p.effectiveTo && p.effectiveTo > now),
        )
      )
        fail(B.BOOKING_POLICY_VERSION_CONFLICT)
      await tx.bookingPolicy.updateMany({
        where: { policyCode: CODE, publishedAt: { not: null }, effectiveTo: null, isActive: true },
        data: { effectiveTo: now },
      })
      const next = await tx.bookingPolicy.update({
        where: { id },
        data: { isActive: true, publishedAt: now, effectiveFrom: now, revision: { increment: 1 } },
      })
      await this.audit(tx, actorId, 'BOOKING_POLICY_PUBLISHED', id, {
        versionNo: next.versionNo,
        effectiveFrom: now.toISOString(),
        holdTtlMinutes: next.holdTtlMinutes,
        cancellationRules: next.cancellationRules,
      })
      return next
    })
  }
}
