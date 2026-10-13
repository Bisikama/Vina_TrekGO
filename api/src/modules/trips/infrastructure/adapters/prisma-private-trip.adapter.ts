import { Injectable } from '@nestjs/common'
import { Prisma, Trip } from '@prisma/client'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B, COMMON_ERROR_CODES as C } from '../../../../shared/errors'
import { PrivateTripPort, PrivateTripInput, PrivateTripUpdate } from '../../application/private-trip.port'
import { assertPrivateActor, assertPrivateWindow } from '../../application/use-cases/private-trip.use-case'

const include = {
  tripTrailPlansViaTripId: { orderBy: { sequence: 'asc' as const } },
  tripCheckpointsViaTripId: { orderBy: { sequence: 'asc' as const } },
}
const fail = (code: string, message?: string): never => {
  throw AppError.fromCode(code, { message })
}
@Injectable()
export class PrismaPrivateTripAdapter extends PrivateTripPort {
  constructor(private readonly db: PrismaService) {
    super()
  }
  private async transaction<T>(
    userId: string,
    id: string | undefined,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`
            assertPrivateActor(await tx.user.findUnique({ where: { id: userId } }), true)
            if (id) await tx.$queryRaw`SELECT id FROM trips WHERE id = ${id}::uuid FOR UPDATE`
            return work(tx)
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
        )
      } catch (e) {
        const retry =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2034' || (e.code === 'P2010' && ['40001', '40P01'].includes(String(e.meta?.code))))
        if (!retry) throw e
        if (attempt >= 2) fail(B.PRIVATE_TRIP_VERSION_CONFLICT)
      }
    }
  }
  private async owned(tx: Prisma.TransactionClient, userId: string, id: string, version?: number) {
    const trip = await tx.trip.findFirst({ where: { id, creatorId: userId, tripType: 'PRIVATE' } })
    if (!trip) return fail(B.NOT_FOUND)
    if (version !== undefined) {
      if (trip.version !== version) fail(B.PRIVATE_TRIP_VERSION_CONFLICT)
      if (trip.status !== 'OPEN' || trip.startAt <= new Date()) fail(B.INVALID_STATE_TRANSITION)
    }
    return trip
  }
  private async context(tx: Prisma.TransactionClient, destinationId: string, pickupPointId: string) {
    const destination = await tx.destination.findFirst({ where: { id: destinationId, status: 'ACTIVE' } })
    const pickup = await tx.pickupPoint.findFirst({ where: { id: pickupPointId, status: 'ACTIVE', destinationId } })
    if (!destination || !pickup)
      fail(C.VALIDATION_ERROR, 'Pickup must be active and belong to the selected destination')
  }
  create(userId: string, input: PrivateTripInput) {
    return this.transaction(userId, undefined, async (tx) => {
      assertPrivateActor(await tx.user.findUnique({ where: { id: userId } }))
      const startAt = new Date(input.startAt),
        endAt = new Date(input.endAt)
      assertPrivateWindow(startAt, endAt, input.capacity)
      await this.context(tx, input.destinationId, input.pickupPointId)
      const personal = input.type === 'PERSONAL'
      const trail = personal
        ? await tx.personalTrail.findFirst({
            where: { id: input.trailRef, userId, status: 'ACTIVE', archivedAt: null },
          })
        : await tx.systemTrail.findFirst({ where: { id: input.trailRef, status: 'ACTIVE', archivedAt: null } })
      if (!trail) return fail(B.NOT_FOUND)
      if (trail.destinationId && trail.destinationId !== input.destinationId) fail(B.INVALID_TRAIL_FOR_TRIP_TYPE)
      if (
        !personal &&
        !(await tx.trailAccess.findFirst({
          where: { userId, systemTrailId: input.trailRef, status: 'ACTIVE', revokedAt: null },
        }))
      )
        fail(B.TRAIL_ACCESS_REQUIRED)
      const points = personal
        ? (
            await tx.personalCheckpoint.findMany({ where: { personalTrailId: trail.id }, orderBy: { sequence: 'asc' } })
          ).map((p) => ({
            id: p.id,
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude,
            radius: p.radiusMeters,
            description: p.info,
          }))
        : (
            await tx.trailCheckpoint.findMany({
              where: { systemTrailId: trail.id },
              include: { checkpoint: true },
              orderBy: { sequence: 'asc' },
            })
          )
            .filter((p) => p.checkpoint.status === 'ACTIVE' && p.checkpoint.destinationId === input.destinationId)
            .map(({ checkpoint: p }) => ({
              id: p.id,
              name: p.name,
              latitude: p.latitude,
              longitude: p.longitude,
              radius: p.defaultRadiusMeters,
              description: p.description,
            }))
      const selected = input.checkpointIds.map((id) => points.findIndex((p) => p.id === id))
      if (!selected.length || selected.some((n, i) => n < 0 || (i > 0 && n <= selected[i - 1])))
        fail(B.INVALID_TRAIL_FOR_TRIP_TYPE, 'Select at least one checkpoint in trail order without duplicates')
      const trip = await tx.trip.create({
        data: {
          tripType: 'PRIVATE',
          creatorId: userId,
          leaderId: null,
          title: input.title,
          description: input.description,
          destinationId: input.destinationId,
          startAt,
          endAt,
          pickupPointId: input.pickupPointId,
          maxPax: input.capacity,
          pricePerPax: null,
          status: 'OPEN',
        },
      })
      await tx.tripMember.create({
        data: { tripId: trip.id, userId, role: 'HOST', status: 'ACTIVE', pickupPointId: trip.pickupPointId },
      })
      await tx.tripTrailPlan.create({
        data: {
          tripId: trip.id,
          systemTrailId: personal ? null : trail.id,
          personalTrailId: personal ? trail.id : null,
          sequence: 1,
          snapshotName: 'title' in trail ? trail.title : trail.name,
          snapshotDifficulty: trail.difficulty,
          snapshotDistanceKm: trail.distanceKm,
          snapshotElevationGainM: trail.elevationGainM,
          snapshotGeojson: trail.routeGeojson as Prisma.InputJsonValue,
          sourceTrailVersion: trail.version,
          snapshotCheckpointIds: points.map((p) => p.id),
        },
      })
      await tx.tripCheckpoint.createMany({
        data: selected.map((n, i) => ({
          tripId: trip.id,
          sourceCheckpointId: personal ? null : points[n].id,
          sourcePersonalCheckpointId: personal ? points[n].id : null,
          name: points[n].name,
          description: points[n].description,
          latitude: points[n].latitude,
          longitude: points[n].longitude,
          radiusMeters: points[n].radius,
          sequence: i + 1,
          isRequired: true,
        })),
      })
      return tx.trip.findUniqueOrThrow({ where: { id: trip.id }, include })
    })
  }
  private async event(tx: Prisma.TransactionClient, old: Trip, next: Trip, eventType: string, reason?: string) {
    await tx.bookingOutboxEvent.create({
      data: {
        deduplicationKey: `${eventType}:${next.id}:${next.version}`,
        eventType,
        aggregateType: 'PRIVATE_TRIP',
        aggregateId: next.id,
        payload: {
          tripId: next.id,
          creatorId: next.creatorId,
          oldWindow: { startAt: old.startAt.toISOString(), endAt: old.endAt.toISOString() },
          newWindow: { startAt: next.startAt.toISOString(), endAt: next.endAt.toISOString() },
          status: next.status,
          version: next.version,
          reason: reason ?? null,
        },
      },
    })
  }
  update(userId: string, id: string, input: PrivateTripUpdate) {
    return this.transaction(userId, id, async (tx) => {
      const old = await this.owned(tx, userId, id, input.expectedVersion)
      const startAt = input.startAt ? new Date(input.startAt) : old.startAt,
        endAt = input.endAt ? new Date(input.endAt) : old.endAt
      const maxPax = input.capacity ?? old.maxPax
      assertPrivateWindow(startAt, endAt, maxPax)
      await this.context(tx, old.destinationId, input.pickupPointId ?? old.pickupPointId ?? '')
      const memberCount = await tx.tripMember.count({ where: { tripId: id, status: 'ACTIVE' } })
      if (maxPax < memberCount) fail(C.VALIDATION_ERROR, 'Capacity cannot be below active membership')
      const next = await tx.trip.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          startAt,
          endAt,
          maxPax,
          pickupPointId: input.pickupPointId,
          version: { increment: 1 },
        },
        include,
      })
      await tx.privateTripInvite.updateMany({
        where: { tripId: id, status: 'ACTIVE', expiresAt: { gte: startAt } },
        data: { status: 'REVOKED', revokedAt: new Date() },
      })
      await this.event(tx, old, next, 'PRIVATE_TRIP_UPDATED')
      return next
    })
  }
  cancel(userId: string, id: string, version: number, reason?: string) {
    return this.transaction(userId, id, async (tx) => {
      const old = await this.owned(tx, userId, id, version)
      const next = await tx.trip.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), version: { increment: 1 } },
      })
      await tx.privateTripInvite.updateMany({
        where: { tripId: id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      })
      await this.event(tx, old, next, 'PRIVATE_TRIP_CANCELLED', reason)
      return next
    })
  }
  invite(userId: string, id: string, version: number, expiresAt?: string) {
    return this.transaction(userId, id, async (tx) => {
      const configuredOrigin = process.env.WEB_APP_ORIGIN
      if (!configuredOrigin && process.env.NODE_ENV === 'production')
        fail(C.INTERNAL_ERROR, 'Invite link origin is not configured')
      const origin = new URL(configuredOrigin || 'http://localhost:3001')
      if (
        !['http:', 'https:'].includes(origin.protocol) ||
        origin.username ||
        origin.password ||
        origin.pathname !== '/' ||
        origin.search ||
        origin.hash
      )
        fail(C.INTERNAL_ERROR, 'Invalid invite link origin configuration')
      const trip = await this.owned(tx, userId, id, version)
      const expiry = expiresAt
        ? new Date(expiresAt)
        : new Date(Math.min(Date.now() + 7 * 86400000, +trip.startAt - 1000))
      if (!Number.isFinite(+expiry) || expiry <= new Date() || expiry >= trip.startAt)
        fail(C.VALIDATION_ERROR, 'Invite expiry must be in the future and strictly before trip start')
      await tx.privateTripInvite.updateMany({
        where: { tripId: id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      })
      const invite = await tx.privateTripInvite.create({
        data: {
          tripId: id,
          createdBy: userId,
          code: randomBytes(32).toString('base64url'),
          expiresAt: expiry,
          maxUses: null,
        },
      })
      const next = await tx.trip.update({ where: { id }, data: { version: { increment: 1 } } })
      return {
        inviteId: invite.id,
        inviteCode: invite.code,
        inviteUrl: `${origin.origin}/invite/${invite.code}`,
        expiresAt: invite.expiresAt,
        status: invite.status,
        tripVersion: next.version,
      }
    })
  }
  revoke(userId: string, id: string, version: number) {
    return this.transaction(userId, id, async (tx) => {
      const trip = await this.owned(tx, userId, id, version)
      const revoked = await tx.privateTripInvite.updateMany({
        where: { tripId: id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      })
      const next = revoked.count ? await tx.trip.update({ where: { id }, data: { version: { increment: 1 } } }) : trip
      return { tripId: id, revokedCount: revoked.count, tripVersion: next.version }
    })
  }
  read(userId: string, id?: string, page = 1) {
    return this.transaction(userId, id, async (tx) => {
      if (id) {
        await this.owned(tx, userId, id)
        return tx.trip.findUniqueOrThrow({ where: { id }, include })
      }
      return tx.trip.findMany({
        where: { creatorId: userId, tripType: 'PRIVATE' },
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 20,
        skip: (page - 1) * 20,
      })
    })
  }
  options(userId: string, kind: 'PERSONAL' | 'SYSTEM' | 'PICKUP', page: number, destinationId?: string) {
    return this.transaction(userId, undefined, async (tx) => {
      const paging = { take: 20, skip: (page - 1) * 20, orderBy: { id: 'asc' as const } }
      if (kind === 'PICKUP')
        return tx.pickupPoint.findMany({
          where: { status: 'ACTIVE', destinationId },
          select: { id: true, name: true, destinationId: true },
          ...paging,
        })
      if (kind === 'PERSONAL')
        return tx.personalTrail.findMany({
          where: { userId, status: 'ACTIVE', archivedAt: null },
          include: { personalCheckpointsViaPersonalTrailId: { orderBy: { sequence: 'asc' } } },
          ...paging,
        })
      return tx.trailAccess.findMany({
        where: { userId, status: 'ACTIVE', revokedAt: null, systemTrail: { status: 'ACTIVE', archivedAt: null } },
        include: {
          systemTrail: {
            include: {
              trailCheckpointsViaSystemTrailId: { include: { checkpoint: true }, orderBy: { sequence: 'asc' } },
            },
          },
        },
        ...paging,
      })
    })
  }
  access(userId: string, trailId: string) {
    return this.transaction(userId, undefined, async (tx) => {
      const row = await tx.trailAccess.findFirst({
        where: {
          userId,
          systemTrailId: trailId,
          status: 'ACTIVE',
          revokedAt: null,
          systemTrail: { status: 'ACTIVE', archivedAt: null },
        },
      })
      return { hasAccess: !!row, accessId: row?.id ?? null, purchasedAt: row?.purchasedAt ?? null }
    })
  }
}
