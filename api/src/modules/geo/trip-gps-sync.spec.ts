import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { AppError, GlobalErrorFilter } from '../../shared/errors'
import { REQUEST_USER_KEY } from '../../shared/constants/auth.constant'
import { PrismaService } from '../../shared/services/prisma.service'
import { GpsSyncService, gpsHash } from './application/gps-sync.service'
import { GpsAccessService } from './application/gps-access.service'
import { GpsProjectionService } from './application/gps-projection.service'
import { GpsTrackService } from './application/gps-track.service'
import { TripGpsRecordingService } from './infrastructure/adapters/trip-gps-recording.service'
import { PrismaCheckpointGpsArrivalAdapter } from '../checkpoint/infrastructure/adapters/prisma-checkpoint-gps-arrival.adapter'
import { TripGpsSyncController } from './presentation/controllers/trip-gps-sync.controller'
import {
  syncBatchSchema,
  syncCompleteSchema,
  syncBatchResponseSchema,
  syncMetadataResponseSchema,
  syncStatusResponseSchema,
  syncCompleteResponseSchema,
  gpsContextV2ResponseSchema,
  gpsStateV2ResponseSchema,
  gpsSessionV2ResponseSchema,
} from './presentation/dtos/trip-gps-sync.dto'
import { GpsSyncWorker } from './infrastructure/workers/gps-sync.worker'
jest.mock('@nestjs/schedule', () => ({ Interval: () => () => undefined }))

describe('GPS sync v2 HTTP and failure isolation', () => {
  let app: INestApplication
  const userId = randomUUID(),
    tripId = randomUUID(),
    sessionId = randomUUID()
  const sync = { metadata: jest.fn(), batches: jest.fn(), status: jest.fn(), manifest: jest.fn(), complete: jest.fn() }
  const base = `/geo/trips/${tripId}/gps/sessions/${sessionId}/sync`
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TripGpsSyncController],
      providers: [{ provide: GpsSyncService, useValue: sync }],
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
  it('validates device and batches through shared filter', async () => {
    const res = await request(app.getHttpServer())
      .post(base + '/batches')
      .send({ samples: [] })
      .expect(400)
    expect(res.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', retryable: false },
      meta: { requestId: expect.any(String) },
    })
    expect(sync.batches).not.toHaveBeenCalled()
  })
  it('returns registered temporary error and still serves the next request', async () => {
    sync.status.mockRejectedValueOnce(new AppError({ code: 'GPS_SYNC_UNAVAILABLE', details: { retryAfterSeconds: 5 } }))
    const res = await request(app.getHttpServer())
      .get(base + '/status')
      .set('X-GPS-Device-Id', 'phone')
      .expect(503)
    expect(res.body).toMatchObject({
      error: { code: 'GPS_SYNC_UNAVAILABLE', retryable: true },
      meta: { contractVersion: expect.any(String) },
    })
    sync.status.mockResolvedValueOnce({ syncStatus: 'RECEIVING' })
    await request(app.getHttpServer())
      .get(base + '/status')
      .set('X-GPS-Device-Id', 'phone')
      .expect(200)
  })
  it('maps P2028 to 503 without retrying a closed transaction', async () => {
    const db = {
      $transaction: jest
        .fn()
        .mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('closed', { code: 'P2028', clientVersion: '6.3.1' }),
        ),
    }
    const service = new GpsSyncService(db as any, new GpsAccessService())
    await expect(service.status(tripId, userId, sessionId, 'phone')).rejects.toMatchObject({
      code: 'GPS_SYNC_UNAVAILABLE',
      retryable: undefined,
    })
    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })
  it('canonical hashes ignore object key order and batch rejects duplicate IDs', () => {
    expect(gpsHash({ b: 2, a: [1] })).toBe(gpsHash({ a: [1], b: 2 }))
    const sample = {
      clientSampleId: randomUUID(),
      recordedAt: new Date().toISOString(),
      latitude: 10,
      longitude: 106,
      accuracyM: 5,
    }
    expect(
      syncBatchSchema.safeParse({
        batchId: randomUUID(),
        payloadHash: gpsHash([sample, sample]),
        metadataRevision: 1,
        snapshotRevision: 1,
        samples: [sample, sample],
      }).success,
    ).toBe(false)
  })
  it('caps a failed finalization job at four attempts and releases its lease', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 })
    const db = {
      gpsSyncState: {
        updateMany,
        findMany: jest
          .fn()
          .mockResolvedValue([{ sessionId, snapshotRevision: 1, attempts: 3, status: 'FINALIZE_PENDING' }]),
      },
      $transaction: jest.fn().mockRejectedValue(new Error('database disconnected')),
    }
    await new GpsSyncWorker(db as any, {} as any, {} as any).process()
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'NEEDS_ATTENTION',
          leaseToken: null,
          leaseUntil: null,
        }),
      }),
    )
  })
  it.each(['ACTIVE', 'PAUSED'] as const)('blocks all history endpoints while session is %s', async (status) => {
    const service = new GpsSyncService({} as any, {} as any)
    const tx = {} as Prisma.TransactionClient
    jest.spyOn(service, 'transaction').mockImplementation(async (_t, _u, _s, _d, run) => run(tx, { status } as any))
    const sample = {
      clientSampleId: randomUUID(),
      recordedAt: new Date().toISOString(),
      latitude: 10,
      longitude: 106,
      accuracyM: 5,
    }
    const args = [tripId, userId, sessionId, 'phone'] as const
    const batch = {
      batchId: randomUUID(),
      payloadHash: gpsHash([sample]),
      metadataRevision: 1,
      snapshotRevision: 1,
      samples: [sample],
    }
    const entries = [{ batchId: batch.batchId, payloadHash: batch.payloadHash, sampleCount: 1 }]
    const manifest = {
      manifestId: randomUUID(),
      snapshotRevision: 1,
      pageIndex: 0,
      pageCount: 1,
      entries,
      pageHash: gpsHash(entries),
    }
    const error = {
      code: 'GPS_INVALID_SESSION_STATE',
      details: { reason: 'FINISH_REQUIRED_BEFORE_HISTORY_SYNC', recordingStatus: status },
    }
    await expect(service.batches(...args, batch)).rejects.toMatchObject(error)
    await expect(service.manifest(...args, manifest)).rejects.toMatchObject(error)
    await expect(
      service.complete(...args, {
        completionId: randomUUID(),
        snapshotRevision: 1,
        metadataRevision: 1,
        snapshotMaxSequence: 1,
        final: true,
        expectedSampleCount: 1,
        manifestId: manifest.manifestId,
        manifestHash: gpsHash(entries),
        endedAt: sample.recordedAt,
      }),
    ).rejects.toMatchObject(error)
  })
  it('rejects non-final completion through the HTTP validation contract', async () => {
    const body = {
      completionId: randomUUID(),
      snapshotRevision: 1,
      metadataRevision: 1,
      snapshotMaxSequence: 0,
      final: false,
      expectedSampleCount: 0,
      manifestId: randomUUID(),
      manifestHash: gpsHash([]),
      endedAt: new Date().toISOString(),
    }
    expect(syncCompleteSchema.safeParse(body).success).toBe(false)
    const res = await request(app.getHttpServer())
      .post(base + '/complete')
      .set('X-GPS-Device-Id', 'phone')
      .send(body)
      .expect(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(sync.complete).not.toHaveBeenCalled()
  })
})

const dbSuite = process.env.RUN_TRIP_GPS_DB_TEST === '1' ? describe : describe.skip
dbSuite('GPS sync v2 PostgreSQL (all fixture writes rolled back)', () => {
  const db = new PrismaClient()
  afterAll(async () => {
    await db.$disconnect()
  })
  async function rollback(run: (tx: Prisma.TransactionClient) => Promise<void>) {
    const sentinel = new Error('ROLLBACK_GPS_V2')
    try {
      await db.$transaction(
        async (tx) => {
          await run(tx)
          throw sentinel
        },
        { timeout: 60000 },
      )
    } catch (e) {
      if (e !== sentinel) throw e
    }
  }
  async function fixture(tx: Prisma.TransactionClient) {
    const user = await tx.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@gps-v2.invalid`, fullName: 'GPS v2 rollback' },
    })
    const destination = await tx.destination.create({ data: { name: 'GPS v2 rollback' } })
    const trip = await tx.trip.create({
      data: {
        tripType: 'PRIVATE',
        creatorId: user.id,
        destinationId: destination.id,
        title: 'GPS v2 rollback',
        startAt: new Date(),
        endAt: new Date(Date.now() + 86400000),
        maxPax: 5,
        status: 'IN_PROGRESS',
      },
    })
    await tx.tripMember.create({ data: { tripId: trip.id, userId: user.id, role: 'HOST' } })
    await tx.gpsPolicy.create({
      data: {
        policyCode: randomUUID(),
        versionNo: 1,
        syncIntervalSeconds: 10,
        deviationThresholdM: 50,
        deviationConsecutiveSamples: 3,
        defaultCheckpointRadiusM: 30,
        rawLocationRetentionDays: 30,
        effectiveFrom: new Date(Date.now() - 1000),
      },
    })
    const access = new GpsAccessService(),
      projection = new GpsProjectionService(access)
    const tracks = new GpsTrackService(new PrismaCheckpointGpsArrivalAdapter(), projection)
    const prisma = { $transaction: async (run: any) => run(tx), trip: tx.trip } as unknown as PrismaService
    const recording = new TripGpsRecordingService(prisma, access, projection, tracks)
    const sync = new GpsSyncService(prisma, access)
    const started: any = gpsSessionV2ResponseSchema.parse(
      await recording.start(trip.id, user.id, {
        clientSessionId: randomUUID(),
        deviceId: 'phone',
        protocolVersion: 2,
      }),
    )
    return { user, trip, sync, recording, tracks, access, session: started.session }
  }
  it(
    'keeps v2 session active after leader completion; commits/replays offline finish and batches without refresh jobs',
    async () =>
      rollback(async (tx) => {
        const f = await fixture(tx)
        const { sync, recording, session, trip, user } = f
        const args = [trip.id, user.id, session.id, 'phone'] as const
        await recording.endTrip(trip.id, user.id)
        expect((await tx.gpsSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe('ACTIVE')
        const init = {
          requestId: randomUUID(),
          revision: 1,
          baseMetadataRevision: 0,
          commands: [],
          recordingStatus: 'ACTIVE' as const,
        }
        await sync.metadata(...args, init)
        const samples = [
          {
            clientSampleId: randomUUID(),
            recordedAt: new Date().toISOString(),
            latitude: 10,
            longitude: 106,
            accuracyM: 5,
          },
        ]
        const endedAt = new Date(Date.now() + 1).toISOString()
        const finish = {
          requestId: randomUUID(),
          revision: 2,
          baseMetadataRevision: 1,
          commands: [{ commandId: randomUUID(), sequence: 2, action: 'FINISH' as const, occurredAt: endedAt }],
          recordingStatus: 'STOPPED' as const,
          endedAt,
        }
        const ack: any = syncMetadataResponseSchema.parse(await sync.metadata(...args, finish))
        expect(ack.recordingStatus).toBe('STOPPED')
        expect(await sync.metadata(...args, finish)).toEqual(ack)
        const batch = {
          batchId: randomUUID(),
          payloadHash: gpsHash(samples),
          metadataRevision: 2,
          snapshotRevision: 1,
          samples,
        }
        const uploaded: any = syncBatchResponseSchema.parse(await sync.batches(...args, batch))
        expect(uploaded.acceptedSampleIds).toEqual([samples[0].clientSampleId])
        expect(await sync.batches(...args, batch)).toEqual(uploaded)
        expect(await tx.gpsLocation.count({ where: { sessionId: session.id } })).toBe(1)
        expect(await tx.gpsOutboxEvent.count({ where: { aggregateId: trip.id, eventType: 'gps:track.refresh' } })).toBe(
          0,
        )
        expect(() => sync.batches(...args, { ...batch, payloadHash: gpsHash([]) })).toThrow(AppError)
        const manifestId = randomUUID(),
          entries = [{ batchId: batch.batchId, payloadHash: batch.payloadHash, sampleCount: 1 }]
        await sync.manifest(...args, {
          manifestId,
          snapshotRevision: 1,
          pageIndex: 0,
          pageCount: 1,
          entries,
          pageHash: gpsHash(entries),
        })
        const complete = {
          completionId: randomUUID(),
          snapshotRevision: 1,
          metadataRevision: 2,
          snapshotMaxSequence: 1,
          final: true as const,
          expectedSampleCount: 1,
          manifestId,
          manifestHash: gpsHash(entries),
          endedAt,
        }
        const pending = syncCompleteResponseSchema.parse(await sync.complete(...args, complete))
        expect(await sync.complete(...args, complete)).toEqual(pending)
        expect((await sync.status(...args)).syncStatus).toBe('FINALIZE_PENDING')
        // Simulate another process dying after claim; this worker must recover the expired lease.
        await tx.gpsSyncState.update({
          where: { sessionId: session.id },
          data: {
            status: 'PROCESSING',
            leaseToken: randomUUID(),
            leaseUntil: new Date(Date.now() - 1000),
            attempts: 1,
          },
        })
        const workerDb = {
          $transaction: async (run: any) => run(tx),
          gpsSyncState: {
            findMany: (query: any) =>
              tx.gpsSyncState.findMany({ ...query, where: { ...query.where, sessionId: session.id } }),
            updateMany: (query: any) =>
              tx.gpsSyncState.updateMany({ ...query, where: { ...query.where, sessionId: session.id } }),
          },
        } as unknown as PrismaService
        await new GpsSyncWorker(workerDb, f.access, f.tracks).process()
        expect(syncStatusResponseSchema.parse(JSON.parse(JSON.stringify(await sync.status(...args)))).syncStatus).toBe(
          'COMPLETE',
        )
        expect((await sync.status(...args)).processedSnapshotRevision).toBe(1)
        expect((await sync.status(...args)).attempts).toBe(2)
        expect(
          (
            await tx.tripActualRoute.findUniqueOrThrow({
              where: { tripId_userId: { tripId: trip.id, userId: user.id } },
            })
          ).pointCount,
        ).toBe(1)
      }),
    65000,
  )
  it(
    'rejects incomplete manifests and stale live points; latest publish does not insert history',
    async () =>
      rollback(async (tx) => {
        const { sync, recording, session, trip, user } = await fixture(tx)
        const args = [trip.id, user.id, session.id, 'phone'] as const
        const point = {
          clientSampleId: randomUUID(),
          recordedAt: new Date().toISOString(),
          latitude: 10,
          longitude: 106,
          accuracyM: 5,
        }
        const input = {
          requestId: randomUUID(),
          tripId: trip.id,
          sessionId: session.id,
          deviceId: 'phone',
          sequence: 2,
          location: point,
        }
        expect((await sync.publish(user.id, input)).applied).toBe(true)
        gpsContextV2ResponseSchema.parse(await recording.context(trip.id, user.id, true))
        const state = gpsStateV2ResponseSchema.parse(await recording.stateSnapshot(trip.id, user.id, true))
        expect(state.members.find((m) => m.userId === user.id)?.locationVersion).toBe(1)
        expect((await sync.publish(user.id, { ...input, sequence: 1 })).applied).toBe(false)
        expect(await tx.gpsLocation.count({ where: { sessionId: session.id } })).toBe(0)
        await expect(sync.publish(user.id, { ...input, deviceId: 'other' })).rejects.toMatchObject({
          code: 'GPS_DEVICE_CONFLICT',
        })
        await sync.metadata(...args, {
          requestId: randomUUID(),
          revision: 1,
          baseMetadataRevision: 0,
          commands: [],
          recordingStatus: 'ACTIVE',
        })
        const entries = [{ batchId: randomUUID(), payloadHash: gpsHash([point]), sampleCount: 1 }],
          manifestId = randomUUID()
        const endedAt = new Date().toISOString()
        await sync.metadata(...args, {
          requestId: randomUUID(),
          revision: 2,
          baseMetadataRevision: 1,
          commands: [{ commandId: randomUUID(), sequence: 2, action: 'FINISH', occurredAt: endedAt }],
          recordingStatus: 'STOPPED',
          endedAt,
        })
        await sync.manifest(...args, {
          manifestId,
          snapshotRevision: 1,
          pageIndex: 0,
          pageCount: 1,
          entries,
          pageHash: gpsHash(entries),
        })
        await expect(
          sync.complete(...args, {
            completionId: randomUUID(),
            snapshotRevision: 1,
            metadataRevision: 2,
            snapshotMaxSequence: 1,
            expectedSampleCount: 1,
            final: true,
            endedAt,
            manifestId,
            manifestHash: gpsHash(entries),
          }),
        ).rejects.toMatchObject({ code: 'GPS_SYNC_INCOMPLETE' })
      }),
    65000,
  )
})
