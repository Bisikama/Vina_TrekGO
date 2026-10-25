import { HttpException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
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
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { SupabaseService } from '../../../../shared/services/supabase.service'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError, ERROR_DEFINITIONS } from '../../../../shared/errors'
import { TripGpsRecordingService } from '../../infrastructure/adapters/trip-gps-recording.service'
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
@WebSocketGateway({ namespace: '/gps', cors: { origin: true, credentials: true } })
export class TripGpsGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server: Namespace
  private readonly logger = new Logger(TripGpsGateway.name)
  private readonly expiry = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly seen = new Map<string, number>()
  private publishing = false
  private checking = false
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
    private readonly recording: TripGpsRecordingService,
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
        void this.expire(socket)
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
        return { ok: true, requestId, data: { tripId } }
      }
      await this.recording.authorize(tripId, socket.data.userId, true)
      await socket.join(`trip-gps:${tripId}`)
      // Recheck after join; every emission also rechecks against the current database roster.
      const data = await this.recording.authorize(tripId, socket.data.userId, true)
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
    for (const room of [...socket.rooms])
      if (room.startsWith('trip-gps:')) await this.revoke(socket, room.slice('trip-gps:'.length), code)
    socket.disconnect(true)
  }

  // Each instance consumes the SAME committed outbox independently and emits only to its
  // own sockets. This supplies cross-instance fanout/revocation without a second broker.
  // The outbox remains the durable cross-instance transport. A short interval
  // avoids imposing the former 0–1 second realtime delay when LISTEN/NOTIFY is
  // not available in the deployment.
  @Interval(100)
  async publishOutbox() {
    if (this.publishing || !this.server) return
    this.publishing = true
    try {
      // A newly subscribed client obtains the durable snapshot via GET /state;
      // replaying five minutes of member updates causes stale marker jumps and a
      // large startup burst. Fifteen seconds is enough for every live instance
      // to observe a published event while keeping the outbox a retry source.
      const since = Date.now() - 15000
      for (const [id, at] of this.seen) if (at < since) this.seen.delete(id)
      const rows = await this.prisma.gpsOutboxEvent.findMany({
        where: {
          aggregateType: 'TripGps',
          OR: [
            { status: 'PENDING' },
            { createdAt: { gte: new Date(since) } },
            { publishedAt: { gte: new Date(since) } },
          ],
          id: { notIn: [...this.seen.keys()] },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 500,
      })
      for (const row of rows) {
        // Track processing is a durable internal job, never a socket event.
        if (row.eventType === 'gps:track.refresh') continue
        const payload = row.payload as unknown as { envelope: EventEnvelope<any>; recipientUserId: string | null }
        if (!payload?.envelope?.tripId) {
          this.seen.set(row.id, row.createdAt.getTime())
          continue
        }
        try {
          // Subscription authorization is enforced at subscribe/revalidation time.
          // Broadcast once to the room; do not open a DB transaction per viewer.
          if (payload.recipientUserId === null && row.eventType !== 'gps:access.revoked') {
            this.server.to(`trip-gps:${payload.envelope.tripId}`).emit(row.eventType, payload.envelope)
          } else for (const socket of this.server.sockets.values()) {
            const { tripId } = payload.envelope
            const personal = payload.recipientUserId !== null
            if (personal ? socket.data.userId !== payload.recipientUserId : !socket.rooms.has(`trip-gps:${tripId}`))
              continue
            if (socket.data.expiresAt <= Date.now()) {
              await this.expire(socket)
              continue
            }
            if (row.eventType === 'gps:access.revoked') {
              try {
                await this.recording.authorize(tripId, socket.data.userId)
              } catch (error) {
                if (error instanceof AppError && ['FORBIDDEN', 'GPS_TRIP_NOT_FOUND'].includes(error.code))
                  await this.revoke(socket, tripId)
                else throw error
              }
              continue
            }
            try {
              await this.recording.authorize(tripId, socket.data.userId)
            } catch (error) {
              if (error instanceof AppError && ['FORBIDDEN', 'GPS_TRIP_NOT_FOUND'].includes(error.code)) {
                await this.revoke(socket, tripId)
                continue
              }
              throw error
            }
            socket.emit(row.eventType, payload.envelope)
          }
          await this.prisma.gpsOutboxEvent.update({
            where: { id: row.id },
            data: { status: 'PUBLISHED', publishedAt: row.publishedAt ?? new Date(), lastError: null },
          })
          this.seen.set(row.id, Date.now())
        } catch (error) {
          await this.prisma.gpsOutboxEvent.update({
            where: { id: row.id },
            data: {
              retryCount: { increment: 1 },
              lastError: 'GPS delivery deferred; authorization or transport unavailable',
            },
          })
        }
      }
    } catch (error) {
      this.logger.error('GPS outbox poll failed', error instanceof Error ? error.stack : undefined)
    } finally {
      this.publishing = false
    }
  }

  @Interval(5000)
  async revalidateSubscriptions() {
    if (this.checking || !this.server) return
    this.checking = true
    try {
      for (const socket of this.server.sockets.values()) {
        if (socket.data.expiresAt <= Date.now()) {
          await this.expire(socket)
          continue
        }
        const user = await this.prisma.user.findUnique({ where: { id: socket.data.userId }, select: { status: true } })
        if (!user || user.status !== 'ACTIVE') {
          await this.expire(socket, 'FORBIDDEN')
          continue
        }
        for (const room of socket.rooms) {
          if (!room.startsWith('trip-gps:')) continue
          const tripId = room.slice('trip-gps:'.length)
          try {
            await this.recording.authorize(tripId, socket.data.userId)
          } catch (error) {
            if (error instanceof AppError && ['FORBIDDEN', 'GPS_TRIP_NOT_FOUND'].includes(error.code))
              await this.revoke(socket, tripId)
          }
        }
      }
    } catch (error) {
      this.logger.error('GPS subscription revalidation failed', error instanceof Error ? error.stack : undefined)
    } finally {
      this.checking = false
    }
  }

  onModuleDestroy() {
    for (const timer of this.expiry.values()) clearTimeout(timer)
    this.expiry.clear()
  }
}
