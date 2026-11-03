import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AppError, GlobalErrorFilter, TRIP_GPS_ERROR_CODES as E } from '../../shared/errors'
import { PrismaService } from '../../shared/services/prisma.service'
import { REQUEST_USER_KEY } from '../../shared/constants/auth.constant'
import { TripGpsRecordingService } from './infrastructure/adapters/trip-gps-recording.service'
import { TripGpsController } from './presentation/controllers/trip-gps.controller'
import { gpsSampleSchema, gpsSamplesSchema } from './presentation/dtos/trip-gps.dto'
import * as response from './presentation/dtos/trip-gps-response.schemas'
import { assembleRoute, distanceToRoute, movingDurationSeconds, simplifyLiveRoute, TrackPoint } from './application/gps-geometry'
import { GpsAccessService } from './application/gps-access.service'
import { GpsProjectionService } from './application/gps-projection.service'
import { GpsTrackService } from './application/gps-track.service'
import { PrismaCheckpointGpsArrivalAdapter } from '../checkpoint/infrastructure/adapters/prisma-checkpoint-gps-arrival.adapter'

jest.mock('@nestjs/schedule', () => ({ Interval: () => () => undefined }))
const wire = (value: unknown) => JSON.parse(JSON.stringify(value))
const point = (longitude: number, recordedAt: string, sessionId = 's'): TrackPoint => ({
  clientSampleId: randomUUID(),
  sessionId,
  longitude,
  latitude: 10,
  accuracyM: 5,
  recordedAt,
  receivedAt: recordedAt,
  altitudeM: null,
  speedMps: null,
  headingDeg: null,
})

describe('GPS geometry and strict request contract', () => {
  it('keeps source, standalone mobile contract and embedded documentation identical', () => {
    const source = readFileSync(join(__dirname, 'application/trip-gps.contract.ts'), 'utf8').trimEnd()
    const standalone = readFileSync(join(__dirname, '../../../docs/trip-gps.contract.ts'), 'utf8').trimEnd()
    const doc = readFileSync(join(__dirname, '../../../docs/GPS_IN_TRIP.md'), 'utf8').split('## 19.')[1]
    const embedded = /```ts\r?\n([\s\S]*?)```/.exec(doc)![1].trimEnd()
    expect(standalone).toBe(source)
    expect(embedded).toBe(source)
  })
  it('does not fabricate a line or distance for 0–1 accepted points', () => {
    expect(assembleRoute([], new Map(), 120)).toMatchObject({ routeGeojson: null, totalDistanceMeters: null })
    expect(assembleRoute([point(106, '2026-10-23T01:00:00.000Z')], new Map(), 120)).toMatchObject({
      routeGeojson: null,
      totalDistanceMeters: null,
      pointCount: 1,
    })
  })
  it('keeps one line and explains pause, signal and between-session connectors', () => {
    const points = [
      point(106, '2026-10-23T01:00:00.000Z'),
      point(106.001, '2026-10-23T01:01:00.000Z'),
      point(106.002, '2026-10-23T01:10:00.000Z'),
      point(106.003, '2026-10-23T01:15:00.000Z'),
      point(106.004, '2026-10-23T01:16:00.000Z', 'other'),
    ]
    const intervals = new Map([
      [
        's',
        [
          { start: '2026-10-23T01:00:00.000Z', end: '2026-10-23T01:02:00.000Z' },
          { start: '2026-10-23T01:10:00.000Z', end: null },
        ],
      ],
      ['other', [{ start: '2026-10-23T01:16:00.000Z', end: null }]],
    ])
    const route = assembleRoute(points, intervals, 120)
    expect(route.routeGeojson?.type).toBe('LineString')
    expect(route.gapConnections.map((g) => g.reason)).toEqual(['PAUSE', 'SIGNAL_GAP', 'BETWEEN_SESSIONS'])
    expect(route.totalDistanceMeters).toBeGreaterThan(100)
    expect(route.totalDistanceMeters).toBeLessThan(120)
    const simplified = simplifyLiveRoute(route)!
    for (const index of [0, 1, 2, 3, 4])
      expect(simplified.coordinates).toContainEqual(route.routeGeojson!.coordinates[index])
  })
  it('sums moving time across sessions, excluding pauses and unfinished recordings', () => {
    const stopped = {
      startedAt: new Date('2026-10-23T01:00:00.000Z'),
      endedAt: new Date('2026-10-23T01:30:00.000Z'),
      intervals: [
        { start: '2026-10-23T01:00:00.000Z', end: '2026-10-23T01:10:00.000Z' },
        { start: '2026-10-23T01:20:00.000Z', end: null },
      ],
    }
    const legacy = {
      startedAt: new Date('2026-10-23T02:00:00.000Z'),
      endedAt: new Date('2026-10-23T02:05:00.000Z'),
      intervals: undefined,
    }
    expect(movingDurationSeconds([stopped, legacy])).toBe(1500)
    expect(movingDurationSeconds([])).toBeNull()
    expect(movingDurationSeconds([{ ...stopped, endedAt: null }])).toBeNull()
  })
  it('measures distance to segments and handles unusable geometry', () => {
    expect(
      distanceToRoute(
        { latitude: 10, longitude: 106.5 },
        {
          type: 'LineString',
          coordinates: [
            [106, 10],
            [107, 10],
          ],
        },
      ),
    ).toBe(0)
    expect(
      distanceToRoute(
        { latitude: 10.001, longitude: 106.5 },
        {
          type: 'LineString',
          coordinates: [
            [106, 10],
            [107, 10],
          ],
        },
      ),
    ).toBeCloseTo(111.19, 1)
    expect(distanceToRoute({ latitude: 10, longitude: 106 }, null)).toBeNull()
  })
  it('rejects duplicate IDs, ownership/accepted injection and heading=360 before writes', () => {
    const sample = {
      clientSampleId: randomUUID(),
      recordedAt: new Date().toISOString(),
      latitude: 10,
      longitude: 106,
      accuracyM: 5,
    }
    expect(gpsSamplesSchema.safeParse({ samples: [sample, sample] }).success).toBe(false)
    expect(gpsSamplesSchema.safeParse({ samples: [sample], userId: randomUUID() }).success).toBe(false)
    expect(gpsSampleSchema.safeParse({ ...sample, accepted: true }).success).toBe(false)
    expect(gpsSampleSchema.safeParse({ ...sample, headingDeg: 360 }).success).toBe(false)
  })
})

describe('Trip GPS HTTP routes and shared errors', () => {
  let app: INestApplication
  const userId = randomUUID(),
    tripId = randomUUID(),
    sessionId = randomUUID()
  const recording = Object.fromEntries(
    ['context', 'stateSnapshot', 'liveRoute', 'start', 'getSession', 'upload', 'control', 'result'].map((name) => [
      name,
      jest.fn().mockResolvedValue({ marker: name }),
    ]),
  )
  const base = `/geo/trips/${tripId}/gps`
  const sample = {
    clientSampleId: randomUUID(),
    recordedAt: new Date().toISOString(),
    latitude: 10,
    longitude: 106,
    accuracyM: 5,
  }
  const command = { commandId: randomUUID(), expectedVersion: 1, occurredAt: new Date().toISOString() }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TripGpsController],
      providers: [{ provide: TripGpsRecordingService, useValue: recording }],
    }).compile()
    app = module.createNestApplication()
    app.use((req: any, _res: any, next: () => void) => {
      req[REQUEST_USER_KEY] = { id: userId }
      next()
    })
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })
  afterAll(async () => {
    await app.close()
  })
  it.each([
    ['context', 'context'],
    ['state', 'stateSnapshot'],
    ['my-route', 'liveRoute'],
    [`sessions/${sessionId}`, 'getSession'],
    ['actual-routes/me', 'result'],
  ])('routes GET %s to the authorized user service', async (path, method) => {
    const res = await request(app.getHttpServer()).get(`${base}/${path}`).expect(200)
    expect(res.body).toEqual({ marker: method })
    expect(recording[method]).toHaveBeenCalledWith(tripId, userId, ...(method === 'getSession' ? [sessionId] : []))
  })
  it('returns 200 on start, validates mutations and passes the bound device', async () => {
    await request(app.getHttpServer())
      .post(`${base}/sessions`)
      .send({ clientSessionId: randomUUID(), deviceId: 'phone' })
      .expect(200)
    await request(app.getHttpServer())
      .post(`${base}/sessions/${sessionId}/samples`)
      .set('X-GPS-Device-Id', 'phone')
      .send({ samples: [sample] })
      .expect(200)
    expect(recording.upload).toHaveBeenCalledWith(tripId, userId, sessionId, 'phone', { samples: [sample] })
    for (const action of ['pause', 'resume', 'finish'])
      await request(app.getHttpServer())
        .post(`${base}/sessions/${sessionId}/${action}`)
        .set('X-GPS-Device-Id', 'phone')
        .send({ ...command, ...(action === 'finish' ? { reason: 'USER_FINISHED' } : {}) })
        .expect(200)
    const invalid = await request(app.getHttpServer())
      .post(`${base}/sessions/${sessionId}/samples`)
      .send({ samples: [sample] })
      .expect(400)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')
  })
  it('formats business failures with the global envelope', async () => {
    recording.upload.mockRejectedValueOnce(new AppError({ code: E.DEVICE_CONFLICT }))
    const res = await request(app.getHttpServer())
      .post(`${base}/sessions/${sessionId}/samples`)
      .set('X-GPS-Device-Id', 'other-phone')
      .send({ samples: [sample] })
      .expect(409)
    expect(res.body.error).toMatchObject({ code: 'GPS_DEVICE_CONFLICT', retryable: false })
    expect(res.body.meta).toMatchObject({
      requestId: expect.any(String),
      serverTime: expect.any(String),
      contractVersion: '0.2.0-final-flow',
    })
    expect(res.body.code).toBeUndefined()
    recording.upload.mockRejectedValueOnce(new AppError({ code: E.RATE_LIMITED, details: { retryAfterSeconds: 15 } }))
    const limited = await request(app.getHttpServer())
      .post(`${base}/sessions/${sessionId}/samples`)
      .set('X-GPS-Device-Id', 'phone')
      .send({ samples: [sample] })
      .expect(429)
    expect(limited.headers['retry-after']).toBe('15')
  })
})

const databaseSuite = process.env.RUN_TRIP_GPS_DB_TEST === '1' ? describe : describe.skip
databaseSuite('Trip GPS PostgreSQL contract (all fixtures ALWAYS rolled back)', () => {
  const db = new PrismaClient()
  afterAll(async () => {
    await db.$disconnect()
  })
  async function fixture(tx: Prisma.TransactionClient) {
    const user = await tx.user.create({
      data: { authUserId: randomUUID(), email: `gps-${randomUUID()}@example.invalid`, fullName: 'GPS rollback host' },
    })
    const member = await tx.user.create({
      data: { authUserId: randomUUID(), email: `gps-${randomUUID()}@example.invalid`, fullName: 'GPS rollback member' },
    })
    const destination = await tx.destination.create({ data: { name: `GPS rollback ${randomUUID()}` } })
    const policy = await tx.gpsPolicy.create({
      data: {
        policyCode: `gps-test-${randomUUID()}`,
        versionNo: 1,
        syncIntervalSeconds: 10,
        deviationThresholdM: 50,
        deviationConsecutiveSamples: 3,
        defaultCheckpointRadiusM: 30,
        rawLocationRetentionDays: 30,
        maxAcceptedAccuracyM: 50,
        effectiveFrom: new Date(Date.now() - 1),
      },
    })
    const trip = await tx.trip.create({
      data: {
        tripType: 'PRIVATE',
        creatorId: user.id,
        destinationId: destination.id,
        title: 'GPS rollback',
        startAt: new Date(),
        endAt: new Date(Date.now() + 86400000),
        maxPax: 5,
        status: 'IN_PROGRESS',
      },
    })
    await tx.tripMember.createMany({
      data: [
        { tripId: trip.id, userId: user.id, role: 'HOST' },
        { tripId: trip.id, userId: member.id },
      ],
    })
    const checkpoint = await tx.tripCheckpoint.create({
      data: { tripId: trip.id, name: 'GPS checkpoint', latitude: 10, longitude: 106, sequence: 1, radiusMeters: 30 },
    })
    const access = new GpsAccessService(),
      projection = new GpsProjectionService(access)
    const tracks = new GpsTrackService(new PrismaCheckpointGpsArrivalAdapter(), projection)
    const prisma = {
      $transaction: async (run: any) => run(tx),
      tripGpsProjection: {
        findMany: (query: any) =>
          tx.tripGpsProjection.findMany({ ...query, where: { ...query.where, tripId: trip.id } }),
      },
    } as unknown as PrismaService
    const service = new TripGpsRecordingService(prisma, access, projection, tracks)
    // This rollback suite has no scheduler: explicitly drain the existing post-commit
    // route processor after each upload before checking checkpoint/history results.
    const upload = service.upload.bind(service)
    service.upload = async (...args: Parameters<TripGpsRecordingService['upload']>) => {
      const ack = await upload(...args)
      if (ack.routeRebuildPending) await service.rebuildTrack(args[0], args[1], args[2])
      return ack
    }
    return { user, member, trip, policy, destination, checkpoint, service, access, projection, tracks }
  }
  async function rollback(run: (tx: Prisma.TransactionClient) => Promise<void>) {
    const sentinel = new Error('GPS_TEST_ROLLBACK')
    let completed = false
    try {
      await db.$transaction(
        async (tx) => {
          await run(tx)
          completed = true
          throw sentinel
        },
        { timeout: 180000 },
      )
    } catch (error) {
      if (error !== sentinel) throw error
    }
    expect(completed).toBe(true)
  }
  async function openInPast(
    tx: Prisma.TransactionClient,
    service: TripGpsRecordingService,
    tripId: string,
    userId: string,
  ) {
    const input = { clientSessionId: randomUUID(), deviceId: 'phone' }
    const opened = response.gpsSessionResponseSchema.parse(wire(await service.start(tripId, userId, input)))
    const startedAt = new Date(Date.now() - 60000)
    const row = await tx.gpsSession.findUniqueOrThrow({ where: { id: opened.session.id } })
    await tx.gpsSession.update({
      where: { id: row.id },
      data: {
        startedAt,
        recordingState: {
          ...(row.recordingState as any),
          intervals: [{ start: startedAt.toISOString(), end: null }],
          lastControlAt: startedAt.toISOString(),
        },
      },
    })
    return { sessionId: row.id, input, startedAt }
  }
  const sampleAt = (startedAt: Date, seconds: number, longitude = 106) => ({
    clientSampleId: randomUUID(),
    latitude: 10,
    longitude,
    accuracyM: 5,
    recordedAt: new Date(startedAt.getTime() + seconds * 1000).toISOString(),
  })

  it('records before start, records again after finish, and closes the whole trip through geo', async () =>
    rollback(async tx => {
      const { service, trip, user, member } = await fixture(tx)
      await tx.trip.update({ where: { id: trip.id }, data: { status: 'OPEN' } })
      const first = await service.start(trip.id, member.id, { clientSessionId: randomUUID(), deviceId: 'phone' })
      expect((await tx.trip.findUniqueOrThrow({ where: { id: trip.id } })).status).toBe('OPEN')
      await service.control(trip.id, member.id, first.session.id, 'phone', 'finish', {
        commandId: randomUUID(), expectedVersion: first.session.version, occurredAt: new Date().toISOString(),
      })
      const second = await service.start(trip.id, member.id, { clientSessionId: randomUUID(), deviceId: 'phone' })
      expect(second.session.id).not.toBe(first.session.id)
      await service.start(trip.id, user.id, { clientSessionId: randomUUID(), deviceId: 'host-phone' })
      expect((await tx.trip.findUniqueOrThrow({ where: { id: trip.id } })).status).toBe('IN_PROGRESS')
      await expect(service.endTrip(trip.id, member.id)).rejects.toMatchObject({ code: E.ACCESS_DENIED })
      const ended = await service.endTrip(trip.id, user.id)
      expect(ended.tripStatus).toBe('COMPLETED')
      expect(await tx.gpsSession.count({ where: { tripId: trip.id, status: { in: ['ACTIVE', 'PAUSED'] } } })).toBe(0)
      expect((await service.endTrip(trip.id, user.id)).completedAt).toBe(ended.completedAt)
      expect((await service.context(trip.id, member.id)).permissions.canRecord).toBe(false)
      await expect(service.start(trip.id, member.id, { clientSessionId: randomUUID(), deviceId: 'phone' }))
        .rejects.toMatchObject({ code: E.TRIP_NOT_RECORDABLE })
      const late = await service.upload(trip.id, member.id, second.session.id, 'phone', { samples: [{
        clientSampleId: randomUUID(), latitude: 10, longitude: 106, accuracyM: 5,
        recordedAt: new Date(Date.parse(ended.completedAt!) + 1000).toISOString(),
      }] })
      expect(late.rejectedSamples[0].code).toBe('AFTER_SESSION_END')
    }), 180000)

  it(
    'serves all REST contracts, preserves NO_DATA members, deduplicates/reorders points and finishes once per user',
    async () =>
      rollback(async (tx) => {
        const f = await fixture(tx),
          { service, trip, user, member } = f
        const context = response.gpsContextResponseSchema.parse(wire(await service.context(trip.id, user.id)))
        expect(context.checkpointMode).toBe('GEOFENCE_ONCE')
        const initialState = response.gpsStateResponseSchema.parse(wire(await service.stateSnapshot(trip.id, user.id)))
        expect(initialState.members).toHaveLength(2)
        expect(initialState.members.every((m) => m.locationStatus === 'NO_DATA')).toBe(true)
        response.gpsActualResponseSchema.parse(wire(await service.result(trip.id, user.id)))
        const opened = await openInPast(tx, service, trip.id, user.id)
        expect((await service.start(trip.id, user.id, opened.input)).session.id).toBe(opened.sessionId)
        await expect(service.start(trip.id, user.id, { ...opened.input, deviceId: 'other' })).rejects.toMatchObject({
          code: E.IDEMPOTENCY_CONFLICT,
        })
        const alias = { ...opened.input, clientSessionId: randomUUID() }
        expect((await service.start(trip.id, user.id, alias)).session.id).toBe(opened.sessionId)
        const a = sampleAt(opened.startedAt, 1),
          b = sampleAt(opened.startedAt, 20, 106.001)
        const accepted = response.gpsSamplesResponseSchema.parse(
          wire(await service.upload(trip.id, user.id, opened.sessionId, 'phone', { samples: [b, a] })),
        )
        expect(accepted.acceptedSampleIds).toHaveLength(2)
        expect(accepted.routeRebuildPending).toBe(true)
        expect(accepted.lastLocation?.recordedAt).toBe(b.recordedAt)
        expect(
          (await service.upload(trip.id, user.id, opened.sessionId, 'phone', { samples: [a] })).duplicateSampleIds,
        ).toEqual([a.clientSampleId])
        const conflict = await service.upload(trip.id, user.id, opened.sessionId, 'phone', {
          samples: [{ ...a, longitude: 107 }],
        })
        expect(conflict.rejectedSamples[0].code).toBe('SAMPLE_ID_CONFLICT')
        const one = response.gpsStateResponseSchema.parse(wire(await service.stateSnapshot(trip.id, member.id)))
        expect(one.members.find((m) => m.userId === user.id)!.checkpointProgress.passed).toBe(1)
        const event = await tx.checkpointEvent.findFirstOrThrow({ where: { tripId: trip.id, userId: user.id } })
        expect(event.missionStatus).toBe('COMPLETED')
        expect(await tx.checkpointEvent.count({ where: { tripId: trip.id, userId: member.id } })).toBe(0)
        response.gpsLiveResponseSchema.parse(wire(await service.liveRoute(trip.id, user.id)))
        response.gpsSessionResponseSchema.parse(wire(await service.getSession(trip.id, user.id, opened.sessionId)))
        await expect(service.getSession(trip.id, member.id, opened.sessionId)).rejects.toMatchObject({
          code: E.SESSION_NOT_FOUND,
        })
        const command = { commandId: randomUUID(), expectedVersion: 1, occurredAt: new Date().toISOString() }
        const finished = response.gpsFinishResponseSchema.parse(
          wire(await service.control(trip.id, user.id, opened.sessionId, 'phone', 'finish', command)),
        )
        expect(finished.resultStatus).toBe('READY')
        expect(wire(await service.control(trip.id, user.id, opened.sessionId, 'phone', 'finish', command))).toEqual(
          finished,
        )
        expect((await service.start(trip.id, user.id, alias)).session.id).toBe(opened.sessionId)
        const firstResult = response.gpsActualResponseSchema.parse(wire(await service.result(trip.id, user.id)))
        const older = sampleAt(opened.startedAt, 10, 106.0005)
        await service.upload(trip.id, user.id, opened.sessionId, 'phone', { samples: [older] })
        const rebuilt = response.gpsActualResponseSchema.parse(wire(await service.result(trip.id, user.id)))
        expect(rebuilt.actualRouteId).toBe(firstResult.actualRouteId)
        expect(rebuilt.version).toBeGreaterThan(firstResult.version)
        expect(rebuilt.routeGeojson?.coordinates).toEqual([
          [106, 10],
          [106.0005, 10],
          [106.001, 10],
        ])
        const after = await service.stateSnapshot(trip.id, member.id)
        expect(after.members.find((m) => m.userId === user.id)!.lastLocation?.recordedAt).toBe(b.recordedAt)
        const stable = await service.result(trip.id, user.id)
        expect(stable.version).toBe(rebuilt.version)
        expect(
          await tx.gpsOutboxEvent.count({ where: { aggregateId: trip.id, eventType: 'gps:route.ready' } }),
        ).toBeGreaterThan(0)
      }),
    190000,
  )

  it(
    'reconciles actual trip end, allows offline historical pause/resume and closes revoked members',
    async () =>
      rollback(async (tx) => {
        const { service, trip, user, member } = await fixture(tx)
        const opened = await openInPast(tx, service, trip.id, user.id)
        const t = opened.startedAt
        await service.upload(trip.id, user.id, opened.sessionId, 'phone', { samples: [sampleAt(t, 1)] })
        await tx.trip.update({
          where: { id: trip.id },
          data: { status: 'COMPLETED', completedAt: new Date(t.getTime() + 50000) },
        })
        await service.finalizeEndedTrips()
        let session = await service.getSession(trip.id, user.id, opened.sessionId)
        expect(session.session.status).toBe('STOPPED')
        await expect(
          service.control(trip.id, user.id, opened.sessionId, 'phone', 'pause', {
            commandId: randomUUID(),
            expectedVersion: 1,
            occurredAt: new Date(t.getTime() + 10000).toISOString(),
          }),
        ).rejects.toMatchObject({ code: E.VERSION_CONFLICT })
        await service.control(trip.id, user.id, opened.sessionId, 'phone', 'pause', {
          commandId: randomUUID(),
          expectedVersion: session.session.version,
          occurredAt: new Date(t.getTime() + 10000).toISOString(),
        })
        session = await service.getSession(trip.id, user.id, opened.sessionId)
        await service.control(trip.id, user.id, opened.sessionId, 'phone', 'resume', {
          commandId: randomUUID(),
          expectedVersion: session.session.version,
          occurredAt: new Date(t.getTime() + 20000).toISOString(),
        })
        const upload = await service.upload(trip.id, user.id, opened.sessionId, 'phone', {
          samples: [sampleAt(t, 15), sampleAt(t, 25, 106.002), sampleAt(t, 55)],
        })
        expect(upload.acceptedSampleIds).toHaveLength(1)
        expect(upload.rejectedSamples.map((s) => s.code)).toEqual(['OUTSIDE_ACTIVE_INTERVAL', 'AFTER_SESSION_END'])
        const route = await service.result(trip.id, user.id)
        expect(route.gapConnections[0].reason).toBe('PAUSE')
        expect((await service.getSession(trip.id, user.id, opened.sessionId)).session.status).toBe('STOPPED')
        await tx.gpsSession.update({
          where: { id: opened.sessionId },
          data: { uploadDeadline: new Date(Date.now() - 1) },
        })
        await expect(
          service.upload(trip.id, user.id, opened.sessionId, 'phone', { samples: [sampleAt(t, 30)] }),
        ).rejects.toMatchObject({ code: E.UPLOAD_CLOSED })
        // Restore only fixture state to test a separate active member's revocation.
        await tx.trip.update({ where: { id: trip.id }, data: { status: 'IN_PROGRESS', completedAt: null } })
        const other = await openInPast(tx, service, trip.id, member.id)
        await tx.tripMember.update({
          where: { tripId_userId: { tripId: trip.id, userId: member.id } },
          data: { status: 'REMOVED' },
        })
        await service.finalizeEndedTrips()
        const revoked = await tx.gpsSession.findUniqueOrThrow({ where: { id: other.sessionId } })
        expect(revoked.status).toBe('STOPPED')
        expect(revoked.uploadDeadline).toBeNull()
        await expect(service.stateSnapshot(trip.id, member.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
        expect(
          await tx.gpsOutboxEvent.count({ where: { aggregateId: trip.id, eventType: 'gps:access.revoked' } }),
        ).toBeGreaterThan(0)
      }),
    190000,
  )

  it(
    'restricts public GPS to assigned leaders/participants and preserves mission requirements',
    async () =>
      rollback(async (tx) => {
        const { service, trip, user, member, checkpoint, destination } = await fixture(tx)
        await tx.trip.update({
          where: { id: trip.id },
          data: { tripType: 'PUBLIC', leaderId: member.id, pricePerPax: 100000 },
        })
        await expect(service.context(trip.id, user.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
        expect((await service.context(trip.id, member.id)).permissions.canManageTrip).toBe(true)
        const opened = await openInPast(tx, service, trip.id, member.id)
        await service.upload(trip.id, member.id, opened.sessionId, 'phone', {
          samples: [sampleAt(opened.startedAt, 1)],
        })
        const event = await tx.checkpointEvent.findFirstOrThrow({
          where: { tripId: trip.id, userId: member.id, tripCheckpointId: checkpoint.id },
        })
        expect(event.missionStatus).toBe('UNLOCKED')
        expect(event.completedAt).toBeNull()
        const participant = await tx.user.create({
          data: {
            authUserId: randomUUID(),
            email: `gps-${randomUUID()}@example.invalid`,
            fullName: 'Public participant',
          },
        })
        const pickup = await tx.pickupPoint.create({
          data: {
            destinationId: destination.id,
            code: `gps-${randomUUID()}`,
            name: 'GPS pickup',
            address: 'GPS rollback test',
            latitude: 10,
            longitude: 106,
            createdBy: user.id,
          },
        })
        const policy = await tx.bookingPolicy.create({
          data: {
            policyCode: `gps-${randomUUID()}`,
            versionNo: 1,
            holdTtlMinutes: 10,
            cancellationRules: {},
            effectiveFrom: new Date(),
          },
        })
        const booking = await tx.booking.create({
          data: {
            tripId: trip.id,
            userId: user.id,
            pickupPointId: pickup.id,
            returnPointId: pickup.id,
            bookingPolicyId: policy.id,
            status: 'CONFIRMED',
            participantCount: 2,
            pricePerPaxSnapshot: 100000,
            subtotalAmount: 200000,
            totalAmount: 200000,
            policySnapshot: {},
            expiresAt: new Date(Date.now() + 600000),
            confirmedAt: new Date(),
          },
        })
        await tx.bookingParticipant.createMany({
          data: [
            {
              bookingId: booking.id,
              userId: participant.id,
              fullName: participant.fullName,
              checkinCode: randomUUID(),
            },
            { bookingId: booking.id, userId: null, fullName: 'Guest without account', checkinCode: randomUUID() },
          ],
        })
        await expect(service.context(trip.id, user.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
        const snapshot = response.gpsStateResponseSchema.parse(
          wire(await service.stateSnapshot(trip.id, participant.id)),
        )
        expect(snapshot.members.map((m) => m.userId).sort()).toEqual([participant.id, member.id].sort())
      }),
    190000,
  )

  it(
    'uses personal trail snapshots, rebuilds deviation/recovery without duplicates and never infers checkpoint arrival from connectors',
    async () =>
      rollback(async (tx) => {
        const { service, trip, user, member, policy, destination, checkpoint } = await fixture(tx)
        await tx.gpsPolicy.update({
          where: { id: policy.id },
          data: { liveLocationMaxAgeSeconds: 600, maxPlausibleSpeedMps: 20 },
        })
        const geometry = {
          type: 'LineString',
          coordinates: [
            [106, 10],
            [106.01, 10],
          ],
        }
        const trail = await tx.personalTrail.create({
          data: { userId: user.id, destinationId: destination.id, title: 'GPS source', routeGeojson: geometry },
        })
        await tx.tripTrailPlan.create({
          data: {
            tripId: trip.id,
            personalTrailId: trail.id,
            sequence: 1,
            snapshotName: 'GPS snapshot',
            snapshotGeojson: geometry,
          },
        })
        const context = response.gpsContextResponseSchema.parse(wire(await service.context(trip.id, user.id)))
        expect(context.routeSource).toBe('PERSONAL')
        await tx.personalTrail.update({
          where: { id: trail.id },
          data: {
            routeGeojson: {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
          },
        })
        expect((await service.context(trip.id, user.id)).routePlans[0].geometry).toEqual(geometry)
        const opened = await openInPast(tx, service, trip.id, user.id),
          t = opened.startedAt
        const away = [1, 2, 3].map((second) => ({ ...sampleAt(t, second), latitude: 10.001 }))
        await service.upload(trip.id, user.id, opened.sessionId, 'phone', { samples: away })
        expect(
          (await service.stateSnapshot(trip.id, user.id)).members.find((m) => m.userId === user.id)!.deviation.status,
        ).toBe('DEVIATED')
        const jump = await service.upload(trip.id, user.id, opened.sessionId, 'phone', {
          samples: [sampleAt(t, 4, 107)],
        })
        expect(jump.rejectedSamples[0].code).toBe('IMPLAUSIBLE_JUMP')
        await service.upload(trip.id, user.id, opened.sessionId, 'phone', {
          samples: [20, 21, 22].map((s) => sampleAt(t, s)),
        })
        expect(
          (await service.stateSnapshot(trip.id, user.id)).members.find((m) => m.userId === user.id)!.deviation.status,
        ).toBe('NORMAL')
        expect(
          await tx.routeDeviationEvent.count({
            where: { tripId: trip.id, userId: user.id, gpsManaged: true, status: 'RECOVERED' },
          }),
        ).toBe(1)
        const earlier = sampleAt(t, 11)
        await service.upload(trip.id, user.id, opened.sessionId, 'phone', { samples: [earlier] })
        expect(
          (
            await tx.checkpointEvent.findFirstOrThrow({
              where: { tripId: trip.id, userId: user.id, tripCheckpointId: checkpoint.id },
            })
          ).arrivalAt.toISOString(),
        ).toBe(earlier.recordedAt)
        expect(
          await tx.routeDeviationEvent.count({ where: { tripId: trip.id, userId: user.id, gpsManaged: true } }),
        ).toBe(1)
        const other = await openInPast(tx, service, trip.id, member.id)
        await service.upload(trip.id, member.id, other.sessionId, 'phone', {
          samples: [sampleAt(other.startedAt, 1, 105.999), sampleAt(other.startedAt, 20, 106.001)],
        })
        expect(await tx.checkpointEvent.count({ where: { tripId: trip.id, userId: member.id } })).toBe(0)
        await tx.gpsPolicy.update({ where: { id: policy.id }, data: { maxAcceptedAccuracyM: 1 } })
        expect((await service.getSession(trip.id, user.id, opened.sessionId)).policy.maxAcceptedAccuracyM).toBe(50)
      }),
    190000,
  )
})
