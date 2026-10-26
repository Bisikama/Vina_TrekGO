import { HttpException, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Namespace, Socket } from 'socket.io'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { SupabaseService } from '../../../../shared/services/supabase.service'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError, ERROR_DEFINITIONS } from '../../../../shared/errors'
import { TripGpsRecordingService } from '../../infrastructure/adapters/trip-gps-recording.service'
import { GpsSyncService } from '../../application/gps-sync.service'
import { locationPublishSchema } from '../dtos/trip-gps-sync.dto'
import { enqueueGps } from '../../application/gps-projection.service'
import { gpsSocketSchema } from '../dtos/trip-gps.dto'
import type { ErrorBody, EventEnvelope } from '../../application/trip-gps.contract'

export function gpsSocketError(error: unknown, requestId?: string): ErrorBody {
  const code =
    error instanceof AppError
      ? error.code
      : error instanceof HttpException
        ? error.getStatus() === 401
          ? 'UNAUTHENTICATED'
          : error.getStatus() === 403
            ? 'FORBIDDEN'
            : error.getStatus() === 400
              ? 'VALIDATION_ERROR'
              : 'GPS_TEMPORARILY_UNAVAILABLE'
        : 'GPS_TEMPORARILY_UNAVAILABLE'
  const definition = ERROR_DEFINITIONS[code]
  return {
    error: {
      code,
      message:
        error instanceof AppError && error.message !== error.code
          ? error.message
          : (definition?.message ?? 'GPS temporarily unavailable'),
      details: error instanceof AppError ? error.details : undefined,
      retryable:
        error instanceof AppError
          ? (error.retryable ?? definition?.retryable ?? false)
          : (definition?.retryable ?? false),
    },
    meta: {
      requestId: requestId ?? randomUUID(),
      serverTime: new Date().toISOString(),
      contractVersion: '0.2.0-final-flow',
    },
  }
}

@Injectable()
@WebSocketGateway({
  namespace: '/gps',
  cors: { origin: true, credentials: true },
  pingInterval: 10000,
  pingTimeout: 10000,
})
export class TripGpsGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server: Namespace
  private readonly logger = new Logger(TripGpsGateway.name)
  private readonly expiry = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly instanceId = randomUUID()
  private nextPollAt = 0
  private pollDelay = 500
  private presenceRunning = false
  private cleaning = false
  private publishing = false
  private checking = false
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
    private readonly recording: TripGpsRecordingService,
    @Optional() private readonly sync?: GpsSyncService,
  ) {}

  afterInit(server: Namespace) {
    server.use((socket, next) => {
      void (async () => {
        try {
          const token = socket.handshake.auth?.token
          if (typeof token !== 'string' || !token) throw new AppError({ code: 'UNAUTHENTICATED' })
          const identity = await this.supabase.verifyToken(token)
          const user = await this.prisma.user.findUnique({ where: { authUserId: identity.id } })
          if (!user || user.status !== 'ACTIVE') throw new AppError({ code: 'FORBIDDEN' })
          // Decode expiry only AFTER Supabase has cryptographically verified the token.
          const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
          if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now())
            throw new AppError({ code: 'UNAUTHENTICATED' })
          socket.data.userId = user.id
          socket.data.expiresAt = claims.exp * 1000
          next()
        } catch (error) {
          const denied = new Error('GPS authentication failed') as Error & { data: ErrorBody }
          denied.data = gpsSocketError(error)
          next(denied)
        }
      })()
    })
  }

  handleConnection(socket: Socket) {
    if (!socket.data.userId || socket.data.expiresAt <= Date.now()) {
      socket.disconnect(true)
      return
    }
    void socket.join(`trip-gps-user:${socket.data.userId}`)
    const timer = setTimeout(
      () => {
        void this.expire(socket).catch(() => this.logger.warn('GPS token expiry deferred'))
      },
      Math.min(socket.data.expiresAt - Date.now(), 2147483647),
    )
    timer.unref?.()
    this.expiry.set(socket.id, timer)
  }

  handleDisconnect(socket: Socket) {
    const timer = this.expiry.get(socket.id)
    if (timer) clearTimeout(timer)
    this.expiry.delete(socket.id)
    if (socket.data.gpsProtocol === 2)
      void this.removePresence(socket.id).catch(() => this.logger.warn('GPS disconnect deferred'))
  }

  private async subscription(socket: Socket, body: unknown, subscribe: boolean) {
    const parsed = gpsSocketSchema.safeParse(body)
    const suppliedId = z.uuid().safeParse((body && typeof body === 'object' ? (body as any) : {})?.requestId)
    const requestId = parsed.success
      ? parsed.data.requestId
      : suppliedId.success
        ? suppliedId.data.toLowerCase()
        : randomUUID()
    try {
      if (!parsed.success) throw new AppError({ code: 'VALIDATION_ERROR', details: { issues: parsed.error.issues } })
      if (!socket.data.userId || socket.data.expiresAt <= Date.now()) throw new AppError({ code: 'UNAUTHENTICATED' })
      const { tripId } = parsed.data
      if (!subscribe) {
        await socket.leave(`trip-gps:${tripId}`)
        if (socket.data.gpsProtocol === 2 && !socket.data.gpsPublishedTrips?.has(tripId))
          await this.removePresence(socket.id, tripId)
        return { ok: true, requestId, data: { tripId } }
      }
      const data = await this.recording.authorize(tripId, socket.data.userId, true)
      socket.data.gpsProtocol = parsed.data.protocolVersion ?? 1
      await socket.join(`trip-gps:${tripId}`)
      // Recheck after join; every emission also rechecks against the current database roster.
      const confirmed = await this.recording.authorizeRoster(tripId)
      if (!confirmed.some((m) => m.userId === socket.data.userId)) throw new AppError({ code: 'FORBIDDEN' })
      if (socket.data.gpsProtocol === 2) await this.addPresence(socket, tripId)
      return { ok: true, requestId, data }
    } catch (error) {
      if (parsed.success && subscribe) await socket.leave(`trip-gps:${parsed.data.tripId}`)
      return { ok: false, requestId, ...gpsSocketError(error, requestId) }
    }
  }

  @SubscribeMessage('gps:subscribe')
  subscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    return this.subscription(socket, body, true)
  }

  @SubscribeMessage('gps:unsubscribe')
  unsubscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    return this.subscription(socket, body, false)
  }

  private async revoke(socket: Socket, tripId: string, code = 'FORBIDDEN') {
    await socket.leave(`trip-gps:${tripId}`)
    socket.data.gpsPublishedTrips?.delete(tripId)
    if (socket.data.gpsProtocol === 2) await this.removePresence(socket.id, tripId)
    const envelope: EventEnvelope<{ code: string }> = {
      eventId: randomUUID(),
      contractVersion: 'trip-gps/1.0.0',
      tripId,
      occurredAt: new Date().toISOString(),
      data: { code },
    }
    socket.emit('gps:access.revoked', envelope)
  }

  private async expire(socket: Socket, code = 'UNAUTHENTICATED') {
    try {
      for (const room of [...socket.rooms])
        if (room.startsWith('trip-gps:')) await this.revoke(socket, room.slice('trip-gps:'.length), code)
    } finally {
      socket.disconnect(true)
    }
  }

  @SubscribeMessage('gps:location.publish')
  async publishLocation(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const parsed = locationPublishSchema.safeParse(body)
    try {
      if (Buffer.byteLength(JSON.stringify(body) ?? '') > 16384) throw new AppError({ code: 'VALIDATION_ERROR' })
      if (!parsed.success) throw new AppError({ code: 'VALIDATION_ERROR' })
      if (!socket.data.userId || socket.data.expiresAt <= Date.now()) throw new AppError({ code: 'UNAUTHENTICATED' })
      if (!this.sync) throw new AppError({ code: 'GPS_SYNC_UNAVAILABLE' })
      const data = await this.sync.publish(socket.data.userId, parsed.data)
      socket.data.gpsProtocol = 2
      socket.data.gpsPublishedTrips ??= new Set<string>()
      if (!socket.data.gpsPublishedTrips.has(parsed.data.tripId)) {
        await this.addPresence(socket, parsed.data.tripId)
        socket.data.gpsPublishedTrips.add(parsed.data.tripId)
      }
      return { ok: true, data }
    } catch (error) {
      return { ok: false, ...gpsSocketError(error, parsed.success ? parsed.data.requestId : undefined) }
    }
  }

  private async addPresence(socket: Socket, tripId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tripId + ':' + socket.data.userId}))::text`
        await tx.gpsSocketPresence.upsert({
          where: { socketId: socket.id + ':' + tripId },
          create: {
            socketId: socket.id + ':' + tripId,
            instanceId: this.instanceId,
            tripId,
            userId: socket.data.userId,
            expiresAt: new Date(Math.min(Date.now() + 20000, socket.data.expiresAt)),
          },
          update: { expiresAt: new Date(Math.min(Date.now() + 20000, socket.data.expiresAt)) },
        })
        await this.presenceEvent(tx, tripId, socket.data.userId, 'ONLINE')
      },
      { timeout: 5000, maxWait: 1000 },
    )
  }

  private async removePresence(socketId: string, tripId?: string) {
    const rows = await this.prisma.gpsSocketPresence.findMany({
      where: { socketId: { startsWith: socketId + ':' }, ...(tripId ? { tripId } : {}) },
      take: 100,
    })
    for (const row of rows)
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${row.tripId + ':' + row.userId}))::text`
          await tx.gpsSocketPresence.deleteMany({ where: { socketId: row.socketId } })
          const count = await tx.gpsSocketPresence.count({
            where: { tripId: row.tripId, userId: row.userId, expiresAt: { gt: new Date() } },
          })
          if (!count) await this.presenceEvent(tx, row.tripId, row.userId, 'OFFLINE')
        },
        { timeout: 5000, maxWait: 1000 },
      )
  }

  private async presenceEvent(tx: Prisma.TransactionClient, tripId: string, userId: string, status: string) {
    const old = await tx.gpsPresenceState.findUnique({ where: { tripId_userId: { tripId, userId } } })
    if (old?.status === status) return
    const row = await tx.gpsPresenceState.upsert({
      where: { tripId_userId: { tripId, userId } },
      create: { tripId, userId, status },
      update: { status, version: { increment: 1 } },
    })
    await enqueueGps(tx, tripId, 'gps:presence.updated', {
      userId,
      connectionStatus: status,
      presenceVersion: row.version,
    })
  }

  // Fanout receipts are PER INSTANCE. They never claim an event away from another API.
  @Interval(500)
  async publishOutbox() {
    if (this.publishing || !this.server || Date.now() < this.nextPollAt) return
    const sockets = [...this.server.sockets.values()]
    const tripIds = [
      ...new Set(sockets.flatMap((s) => [...s.rooms].filter((r) => r.startsWith('trip-gps:')).map((r) => r.slice(9)))),
    ]
    if (!tripIds.length) return
    this.publishing = true
    try {
      const since = Date.now() - 300000
      const rows = await this.prisma.gpsOutboxEvent.findMany({
        where: {
          aggregateType: 'TripGps',
          aggregateId: { in: tripIds },
          eventType: { not: 'gps:track.refresh' },
          createdAt: { gte: new Date(since) },
          deliveries: { none: { instanceId: this.instanceId } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 100,
      })
      this.pollDelay = rows.length ? 500 : Math.min(5000, this.pollDelay * 2)
      if (!rows.length) return
      const rosters = new Map<string, Set<string>>()
      for (const tripId of tripIds) {
        const members = await this.recording.authorizeRoster(tripId)
        rosters.set(tripId, new Set(members.map((m) => m.userId)))
      }
      // Revoke before delivering any location in this batch, with one roster read per trip.
      for (const socket of sockets)
        for (const tripId of tripIds) {
          if (!socket.rooms.has('trip-gps:' + tripId)) continue
          if (socket.data.expiresAt <= Date.now()) await this.expire(socket)
          else if (!rosters.get(tripId)?.has(socket.data.userId)) await this.revoke(socket, tripId)
        }
      const latest = new Map<string, string>()
      for (const row of rows)
        if (row.eventType === 'gps:location.updated') {
          const e = (row.payload as any)?.envelope
          const key = row.aggregateId + ':' + e?.data?.userId
          const oldId = latest.get(key),
            old = oldId ? rows.find((r) => r.id === oldId) : null
          if (!old || ((old.payload as any)?.envelope?.data?.locationVersion ?? 0) < (e?.data?.locationVersion ?? 0))
            latest.set(key, row.id)
        }
      for (const row of rows) {
        if (row.eventType === 'gps:track.refresh') continue
        const payload = row.payload as any,
          envelope = payload?.envelope
        if (
          envelope?.tripId &&
          (row.eventType !== 'gps:location.updated' ||
            latest.get(row.aggregateId + ':' + envelope.data?.userId) === row.id)
        ) {
          for (const socket of sockets) {
            const tripId = envelope.tripId
            if (
              !socket.rooms.has('trip-gps:' + tripId) ||
              !rosters.get(tripId)?.has(socket.data.userId) ||
              socket.data.expiresAt <= Date.now()
            )
              continue
            if (payload.recipientUserId && socket.data.userId !== payload.recipientUserId) continue
            if (
              ['gps:location.updated', 'gps:presence.updated'].includes(row.eventType) &&
              socket.data.gpsProtocol !== 2
            )
              continue
            socket.emit(row.eventType, envelope)
          }
        }
      }
      await this.prisma.gpsEventDelivery.createMany({
        data: rows.map((r) => ({ eventId: r.id, instanceId: this.instanceId })),
        skipDuplicates: true,
      })
      await this.prisma.gpsOutboxEvent.updateMany({
        where: { id: { in: rows.map((r) => r.id) }, status: 'PENDING', eventType: { not: 'gps:track.refresh' } },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      })
    } catch (error) {
      this.pollDelay = Math.min(5000, this.pollDelay * 2)
      this.logger.warn('GPS fanout deferred; database or authorization unavailable')
    } finally {
      this.nextPollAt = Date.now() + this.pollDelay
      this.publishing = false
    }
  }

  @Interval(3600000)
  async cleanupFanout() {
    if (this.cleaning) return
    this.cleaning = true
    try {
      const before = new Date(Date.now() - 86400000)
      // Only transient v2 fanout events; never delete historical jobs or business notifications.
      const expired = await this.prisma.gpsOutboxEvent.findMany({
        where: {
          eventType: { in: ['gps:location.updated', 'gps:presence.updated'] },
          createdAt: { lt: before },
        },
        select: { id: true },
        take: 1000,
      })
      if (expired.length)
        await this.prisma.gpsOutboxEvent.deleteMany({ where: { id: { in: expired.map((e) => e.id) } } })
      await this.prisma.gpsEventDelivery.deleteMany({ where: { processedAt: { lt: before } } })
      await this.prisma.gpsEventConsumer.deleteMany({ where: { lastSeenAt: { lt: before } } })
    } catch {
      this.logger.warn('GPS fanout cleanup deferred')
    } finally {
      this.cleaning = false
    }
  }

  @Interval(5000)
  async revalidateSubscriptions() {
    if (this.checking || !this.server) return
    this.checking = true
    try {
      const rosters = new Map<string, Set<string>>()
      for (const socket of this.server.sockets.values()) {
        if (socket.data.expiresAt <= Date.now()) {
          await this.expire(socket)
          continue
        }
        const tripIds = new Set<string>([
          ...[...socket.rooms].filter((r) => r.startsWith('trip-gps:')).map((r) => r.slice(9)),
          ...(socket.data.gpsPublishedTrips ?? []),
        ])
        for (const tripId of tripIds) {
          if (!rosters.has(tripId))
            rosters.set(tripId, new Set((await this.recording.authorizeRoster(tripId)).map((m) => m.userId)))
          if (!rosters.get(tripId)!.has(socket.data.userId)) await this.revoke(socket, tripId)
        }
      }
    } catch {
      this.logger.warn('GPS subscription check deferred')
    } finally {
      this.checking = false
    }
  }

  @Interval(5000)
  async refreshPresence() {
    if (this.presenceRunning || !this.server || !this.server.sockets.size) return
    this.presenceRunning = true
    try {
      const active: string[] = []
      for (const socket of this.server.sockets.values())
        if (socket.data.gpsProtocol === 2 && socket.data.expiresAt > Date.now()) {
          const tripIds = new Set<string>([
            ...[...socket.rooms].filter((r) => r.startsWith('trip-gps:')).map((r) => r.slice(9)),
            ...(socket.data.gpsPublishedTrips ?? []),
          ])
          for (const tripId of tripIds) active.push(socket.id + ':' + tripId)
        }
      if (active.length)
        await this.prisma.gpsSocketPresence.updateMany({
          where: { instanceId: this.instanceId, socketId: { in: active } },
          data: { expiresAt: new Date(Date.now() + 20000) },
        })
      const expired = await this.prisma.gpsSocketPresence.findMany({
        where: { expiresAt: { lt: new Date() } },
        take: 100,
      })
      for (const row of expired) {
        await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${row.tripId + ':' + row.userId}))::text`
            const removed = await tx.gpsSocketPresence.deleteMany({
              where: { socketId: row.socketId, expiresAt: { lt: new Date() } },
            })
            if (
              removed.count &&
              !(await tx.gpsSocketPresence.count({
                where: { tripId: row.tripId, userId: row.userId, expiresAt: { gt: new Date() } },
              }))
            )
              await this.presenceEvent(tx, row.tripId, row.userId, 'OFFLINE')
          },
          { timeout: 5000, maxWait: 1000 },
        )
      }
      await this.prisma.gpsEventConsumer.upsert({
        where: { instanceId: this.instanceId },
        create: { instanceId: this.instanceId },
        update: { lastSeenAt: new Date() },
      })
    } catch {
      this.logger.warn('GPS presence refresh deferred')
    } finally {
      this.presenceRunning = false
    }
  }

  onModuleDestroy() {
    for (const timer of this.expiry.values()) clearTimeout(timer)
    this.expiry.clear()
  }
}
