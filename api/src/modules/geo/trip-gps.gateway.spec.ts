import { INestApplication, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { io, Socket } from 'socket.io-client'
import { randomUUID } from 'node:crypto'
import { TripGpsGateway } from './presentation/gateways/trip-gps.gateway'
import { TripGpsRecordingService } from './infrastructure/adapters/trip-gps-recording.service'
import { SupabaseService } from '../../shared/services/supabase.service'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError } from '../../shared/errors'

jest.mock('@nestjs/schedule', () => ({ Interval: () => () => undefined }))
jest.mock('../../shared/services/supabase.service', () => ({ SupabaseService: class SupabaseService {} }))

describe('Trip GPS Socket.IO transport across two API instances', () => {
  const tripId = randomUUID(),
    userA = randomUUID(),
    userB = randomUUID()
  const allowed = new Set<string>([userA, userB])
  const profiles = new Map<string, { id: string; status: string }>([
    [userA, { id: userA, status: 'ACTIVE' }],
    [userB, { id: userB, status: 'ACTIVE' }],
  ])
  const outbox: any[] = []
  const apps: INestApplication[] = [],
    clients: Socket[] = []
  const gateways: TripGpsGateway[] = [],
    urls: string[] = []
  const token = (userId: string, exp = Math.floor(Date.now() / 1000) + 300) =>
    `verified.${Buffer.from(JSON.stringify({ sub: userId, exp })).toString('base64url')}.signature`
  const delivered = new Set<string>()
  const prisma = {
    user: { findUnique: jest.fn(async ({ where }: any) => profiles.get(where.authUserId ?? where.id) ?? null) },
    gpsEventDelivery: {
      createMany: jest.fn(async ({ data }: any) => {
        for (const row of data) delivered.add(row.eventId + ':' + row.instanceId)
        return { count: data.length }
      }),
    },
    gpsOutboxEvent: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn(async (query: any) =>
        outbox.filter((r) => !delivered.has(r.id + ':' + query.where.deliveries.none.instanceId)),
      ),
      update: jest.fn(async ({ where, data }: any) =>
        Object.assign(
          outbox.find((r) => r.id === where.id),
          data,
        ),
      ),
    },
  }
  const recording = {
    authorizeRoster: jest.fn(async (id: string) => (id === tripId ? [...allowed].map((userId) => ({ userId })) : [])),
    authorize: jest.fn(async (id: string, userId: string) => {
      if (id !== tripId || !allowed.has(userId)) throw new AppError({ code: 'FORBIDDEN' })
      return { tripId, rosterVersion: 1, serverTime: new Date().toISOString() }
    }),
  }
  const supabase = {
    verifyToken: jest.fn(async (value: string) => {
      if (!value.startsWith('verified.')) throw new UnauthorizedException()
      return { id: JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).sub }
    }),
  }
  async function connect(instance: number, value: string, expectError = false) {
    const socket = io(`${urls[instance]}/gps`, {
      auth: { token: value },
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
    })
    clients.push(socket)
    const result = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('GPS test connection timed out')), 3000)
      socket.once(expectError ? 'connect_error' : 'connect', (error: any) => {
        clearTimeout(timer)
        resolve(expectError ? error : socket)
      })
      if (!expectError)
        socket.once('connect_error', (error) => {
          clearTimeout(timer)
          reject(error instanceof Error ? error : new Error(String(error)))
        })
    })
    socket.connect()
    return result
  }
  const event = (socket: Socket, name: string) =>
    new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Missing ${name}`)), 3000)
      socket.once(name, (value) => {
        clearTimeout(timer)
        resolve(value)
      })
    })
  const addEvent = (eventType: string, data: unknown, recipientUserId: string | null = null) => {
    const id = randomUUID()
    outbox.push({
      id,
      eventType,
      aggregateType: 'TripGps',
      aggregateId: tripId,
      status: 'PENDING',
      createdAt: new Date(),
      publishedAt: null,
      payload: {
        recipientUserId,
        envelope: {
          eventId: id,
          tripId,
          contractVersion: 'trip-gps/1.0.0',
          occurredAt: new Date().toISOString(),
          data,
        },
      },
    })
  }
  beforeAll(async () => {
    for (let i = 0; i < 2; i++) {
      const module = await Test.createTestingModule({
        providers: [
          TripGpsGateway,
          { provide: PrismaService, useValue: prisma },
          { provide: SupabaseService, useValue: supabase },
          { provide: TripGpsRecordingService, useValue: recording },
        ],
      }).compile()
      const app = module.createNestApplication()
      app.useWebSocketAdapter(new IoAdapter(app))
      await app.listen(0, '127.0.0.1')
      apps.push(app)
      gateways.push(app.get(TripGpsGateway))
      urls.push(await app.getUrl())
    }
  })
  afterAll(async () => {
    clients.forEach((c) => c.disconnect())
    for (const app of apps) await app.close()
  })

  it('verifies tokens, maps internal users, validates subscribe and fans committed events out to both instances', async () => {
    const denied = await connect(0, 'unverified-token', true)
    expect(denied.data.error.code).toBe('UNAUTHENTICATED')
    const expired = await connect(0, token(userA, Math.floor(Date.now() / 1000) - 1), true)
    expect(expired.data.error.code).toBe('UNAUTHENTICATED')
    const a: Socket = await connect(0, token(userA)),
      b: Socket = await connect(1, token(userB))
    const bad = await a.timeout(2000).emitWithAck('gps:subscribe', { requestId: randomUUID(), tripId, userId: userB })
    expect(bad.ok).toBe(false)
    expect(bad.error.code).toBe('VALIDATION_ERROR')
    for (const socket of [a, b]) {
      const requestId = randomUUID()
      const ack = await socket.timeout(2000).emitWithAck('gps:subscribe', { requestId, tripId })
      expect(ack).toMatchObject({ ok: true, requestId, data: { tripId, rosterVersion: 1 } })
    }
    addEvent('gps:member.updated', { member: { userId: userA, memberVersion: 2 } })
    recording.authorizeRoster.mockClear()
    const receivedA = event(a, 'gps:member.updated'),
      receivedB = event(b, 'gps:member.updated')
    ;(gateways[0] as any).nextPollAt = 0
    await gateways[0].publishOutbox()
    ;(gateways[1] as any).nextPollAt = 0
    await gateways[1].publishOutbox()
    expect((await receivedA).eventId).toBe((await receivedB).eventId)
    expect(recording.authorizeRoster).toHaveBeenCalledTimes(2)
    let otherReceivedPrivate = false
    b.once('gps:route.ready', () => {
      otherReceivedPrivate = true
    })
    addEvent(
      'gps:route.ready',
      { userId: userA, actualRouteId: randomUUID(), version: 1, resultStatus: 'READY' },
      userA,
    )
    const ready = event(a, 'gps:route.ready')
    ;(gateways[0] as any).nextPollAt = 0
    await gateways[0].publishOutbox()
    ;(gateways[1] as any).nextPollAt = 0
    await gateways[1].publishOutbox()
    expect((await ready).data.userId).toBe(userA)
    expect(otherReceivedPrivate).toBe(false)
    allowed.delete(userB)
    const revoked = event(b, 'gps:access.revoked')
    addEvent('gps:member.updated', { member: { userId: userA, memberVersion: 3 } })
    ;(gateways[1] as any).nextPollAt = 0
    await gateways[1].publishOutbox()
    expect((await revoked).data.code).toBe('FORBIDDEN')
    const localB = [...gateways[1].server.sockets.values()].find((s) => s.data.userId === userB)!
    expect(localB.rooms.has(`trip-gps:${tripId}`)).toBe(false)
    const disconnected = event(a, 'disconnect')
    const localA = [...gateways[0].server.sockets.values()].find((s) => s.data.userId === userA)!
    localA.data.expiresAt = Date.now() - 1
    await gateways[0].revalidateSubscriptions()
    await disconnected
    expect(a.connected).toBe(false)
  }, 15000)
})
