import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { PrismaPersonalTrailAdapter } from './infrastructure/adapters/prisma-personal-trail.adapter'
import { AppError, GlobalErrorFilter, PersonalTrailErrorCode } from '../../shared/errors'
import { PersonalTrailUseCase } from './application/use-cases/personal-trail.use-case'
import { Prisma } from '@prisma/client'
import { finishRecordingSchema, rawSamplesBatchSchema } from './presentation/dtos/personal-trail.dto'
import type { RawSamplesBatchInput } from './presentation/dtos/personal-trail.dto'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'

describe('Personal trail repository regressions', () => {
  let adapter: PrismaPersonalTrailAdapter
  let tx: any
  const updatedAt = new Date('2026-10-17T00:00:00Z')
  const params = {
    recordingId: 'recording',
    userId: 'owner',
    expectedUpdatedAt: updatedAt,
    endedAt: updatedAt,
    processedGeojson: {
      type: 'MultiLineString',
      coordinates: [
        [
          [106.1, 11.1, 100],
          [106.2, 11.2, 120],
        ],
      ],
    },
    metrics: {
      distanceKm: 1,
      elevationGainM: 20,
      elevationLossM: 0,
      minElevationM: 0,
      maxElevationM: 20,
      elevationProfile: [],
    },
  }

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      trailRecording: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'recording', userId: 'owner', status: 'STOPPED', updatedAt, startedAt: updatedAt }),
        update: jest.fn().mockResolvedValue({ id: 'recording', status: 'READY' }),
      },
      trailRecordingPoint: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      destination: {
        findFirst: jest.fn().mockResolvedValue({ id: 'hcm' }),
        create: jest.fn().mockResolvedValue({ id: 'hcm' }),
      },
      personalTrail: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'trail' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      personalCheckpoint: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      trailSubmission: { create: jest.fn().mockResolvedValue({ createdAt: updatedAt }) },
    }
    adapter = new PrismaPersonalTrailAdapter({ ...tx, $transaction: jest.fn((fn: any) => fn(tx)) })
  })

  it('recovers a concurrent start conflict only for the same owner', async () => {
    tx.trailRecording.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '6.3.1' }),
    )
    tx.trailRecording.findFirst.mockResolvedValue({ id: 'existing', userId: 'owner' })
    const start = { clientRecordingId: 'client-id', userId: 'owner', startedAt: updatedAt, status: 'RECORDING' }
    await expect(adapter.createRecording(start)).resolves.toMatchObject({ id: 'existing' })
    tx.trailRecording.findFirst.mockResolvedValue(null)
    await expect(adapter.createRecording(start)).rejects.toMatchObject({ code: 'CLIENT_RECORDING_ID_CONFLICT' })
    expect(tx.trailRecording.findFirst).toHaveBeenLastCalledWith({
      where: { clientRecordingId: 'client-id', userId: 'owner' },
    })
  })

  it.each([
    ['P2028', undefined, 'PERSONAL_TRAIL_TRANSACTION_UNAVAILABLE'],
    ['P2034', undefined, 'PERSONAL_TRAIL_STORAGE_BUSY'],
    ['P2010', { code: '55P03' }, 'PERSONAL_TRAIL_STORAGE_BUSY'],
  ])('maps %s without replaying a failed transaction', async (code, meta, expectedCode) => {
    tx.$queryRaw.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('failed', { code, meta, clientVersion: '6.3.1' }),
    )
    await expect(adapter.updateRecordingStatus('recording', 'PAUSED')).rejects.toMatchObject({ code: expectedCode })
    expect(tx.trailRecording.update).not.toHaveBeenCalled()
  })

  it('preserves zero elapsed time and saves ordered custom checkpoints in the finish transaction', async () => {
    await adapter.completeRecordingAndCreateTrail({
      ...params,
      provisionalTelemetry: { elapsedSeconds: 0, duration: '00:00:00' },
      checkpoints: [{ name: 'Water', latitude: 11.15, longitude: 106.15, radiusMeters: 50 }],
    })
    expect(tx.trailRecording.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ elapsedSeconds: 0, duration: '00:00:00' }) }),
    )
    expect(tx.personalCheckpoint.createMany.mock.calls[0][0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ info: 'START', sequence: 1 }),
        expect.objectContaining({ name: 'Water', sequence: 2, radiusMeters: 50 }),
        expect.objectContaining({ info: 'END', sequence: 3 }),
      ]),
    )
  })

  it('stops before READY if checkpoint creation fails', async () => {
    tx.personalCheckpoint.createMany.mockRejectedValue(new Error('checkpoint failed'))
    await expect(adapter.completeRecordingAndCreateTrail(params)).rejects.toThrow('checkpoint failed')
    expect(tx.trailRecording.update).not.toHaveBeenCalled()
  })

  it('rejects a finish time before start', async () => {
    await expect(
      adapter.completeRecordingAndCreateTrail({ ...params, endedAt: new Date(updatedAt.getTime() - 1) }),
    ).rejects.toMatchObject({ code: 'INVALID_RECORDING_TIME' })
    expect(tx.personalTrail.create).not.toHaveBeenCalled()
  })

  it('filters PENDING by the latest submission including UNDER_REVIEW', async () => {
    tx.$queryRaw.mockResolvedValue([{ personal_trail_id: 'pending-trail' }])
    await adapter.findMyPersonalTrails('owner', { page: 1, limit: 20, verificationStatus: 'PENDING' })
    const sql = tx.$queryRaw.mock.calls[0][0]
    expect(sql.sql).toContain('DISTINCT ON')
    expect(sql.values).toEqual(expect.arrayContaining(['SUBMITTED', 'UNDER_REVIEW']))
    expect(tx.personalTrail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['pending-trail'] } }) }),
    )
  })

  it('locks soft deletion before checking ownership and does not delete another owner trail', async () => {
    tx.personalTrail.findUnique.mockResolvedValue({ userId: 'other' })
    await expect(adapter.softDeletePersonalTrail('trail', 'owner')).rejects.toMatchObject({
      code: 'TRAIL_ACCESS_DENIED',
    })
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.personalTrail.findUnique.mock.invocationCallOrder[0],
    )
    expect(tx.personalTrail.update).not.toHaveBeenCalled()
  })

  it('locks the recording before creating and reuses the committed trail on replay', async () => {
    await adapter.completeRecordingAndCreateTrail(params)
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.trailRecording.findUnique.mock.invocationCallOrder[0],
    )
    expect(tx.trailRecording.findUnique.mock.invocationCallOrder[0]).toBeLessThan(
      tx.personalTrail.create.mock.invocationCallOrder[0],
    )
    tx.trailRecording.findUnique.mockResolvedValue({
      id: 'recording',
      userId: 'owner',
      status: 'READY',
      createdPersonalTrailId: 'trail',
      updatedAt,
    })
    tx.personalTrail.findUniqueOrThrow.mockResolvedValue({ id: 'trail' })
    expect((await adapter.completeRecordingAndCreateTrail(params)).personalTrail.id).toBe('trail')
    expect(tx.personalTrail.create).toHaveBeenCalledTimes(1)
    expect(tx.destination.create).not.toHaveBeenCalled()
  })

  it('links the manually prepared HCM destination without creating it', async () => {
    await adapter.completeRecordingAndCreateTrail(params)
    expect(tx.destination.create).not.toHaveBeenCalled()
    expect(tx.personalTrail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ destinationId: 'hcm' }),
    })
  })

  it('reuses the active HCM destination instead of creating another one', async () => {
    tx.destination.findFirst.mockResolvedValue({ id: 'existing-hcm' })
    await adapter.completeRecordingAndCreateTrail(params)
    expect(tx.destination.create).not.toHaveBeenCalled()
    expect(tx.personalTrail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ destinationId: 'existing-hcm' }),
    })
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.destination.findFirst.mock.invocationCallOrder[0])
  })

  it('does not create a replacement destination or trail when HCM is unavailable', async () => {
    tx.destination.findFirst.mockResolvedValue(null)
    await expect(adapter.completeRecordingAndCreateTrail(params)).rejects.toMatchObject({
      code: 'PERSONAL_TRAIL_DESTINATION_UNAVAILABLE',
    })
    expect(tx.destination.create).not.toHaveBeenCalled()
    expect(tx.personalTrail.create).not.toHaveBeenCalled()
    expect(tx.trailRecording.update).not.toHaveBeenCalled()
  })

  it('creates START and END personal checkpoints from the route endpoints', async () => {
    await adapter.completeRecordingAndCreateTrail(params)

    expect(tx.personalCheckpoint.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          personalTrailId: 'trail',
          name: 'Điểm bắt đầu',
          longitude: 106.1,
          latitude: 11.1,
          sequence: 1,
          info: 'START',
        }),
        expect.objectContaining({
          personalTrailId: 'trail',
          name: 'Điểm kết thúc',
          longitude: 106.2,
          latitude: 11.2,
          sequence: 2,
          info: 'END',
        }),
      ],
    })
  })

  it('refuses to commit metrics calculated before a new upload', async () => {
    tx.trailRecording.findUnique.mockResolvedValue({
      userId: 'owner',
      status: 'STOPPED',
      updatedAt: new Date(updatedAt.getTime() + 1),
    })
    await expect(adapter.completeRecordingAndCreateTrail(params)).rejects.toMatchObject({ code: 'RECORDING_CHANGED' })
    expect(tx.personalTrail.create).not.toHaveBeenCalled()
  })

  it('rechecks READY under the same recording lock before accepting samples or status changes', async () => {
    tx.trailRecording.findUnique.mockResolvedValue({ status: 'READY' })
    const sample = {
      clientSampleId: 'sample',
      latitude: 11,
      longitude: 108,
      recordedAt: updatedAt.toISOString(),
      segmentId: 0,
      accepted: true,
    }
    await expect(adapter.saveRawSamplesBatch('recording', [sample])).rejects.toMatchObject({
      code: 'RECORDING_ALREADY_FINISHED',
    })
    await expect(adapter.updateRecordingStatus('recording', 'RECORDING')).rejects.toMatchObject({
      code: 'RECORDING_ALREADY_FINISHED',
    })
    expect(tx.trailRecordingPoint.createMany).not.toHaveBeenCalled()
    expect(tx.trailRecording.update).not.toHaveBeenCalled()
  })

  it('maps VERIFIED to the Prisma APPROVED enum', async () => {
    await adapter.findMyPersonalTrails('owner', { page: 1, limit: 20, verificationStatus: 'VERIFIED' })
    expect(tx.$queryRaw.mock.calls[0][0].values).toContain('APPROVED')
    expect(tx.personalTrail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [] } }),
      }),
    )
  })

  it('excludes archived trails from detail reads', async () => {
    tx.personalTrail.findUnique.mockResolvedValue(null)
    const useCase = new PersonalTrailUseCase(adapter)
    await expect(useCase.getDetail({ id: 'owner' } as any, 'trail')).rejects.toMatchObject({
      code: 'PERSONAL_TRAIL_NOT_FOUND',
    })
    expect(tx.personalTrail.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'trail', status: 'ACTIVE' } }),
    )
  })

  it('returns personal checkpoints ordered by sequence for an authorized reader', async () => {
    tx.personalTrail.findUnique.mockResolvedValue({
      id: 'trail',
      userId: 'owner',
      visibility: 'PRIVATE',
      routeGeojson: { coordinates: [] },
      trailSubmissionsViaPersonalTrailId: [],
      trailRecordingsViaCreatedPersonalTrailId: [],
    })
    tx.personalCheckpoint.findMany.mockResolvedValue([
      { id: 'start', latitude: '11.1', longitude: '106.1', sequence: 1 },
    ])
    const useCase = new PersonalTrailUseCase(adapter)

    await expect(useCase.getCheckpoints({ id: 'owner' } as any, 'trail')).resolves.toEqual([
      expect.objectContaining({ id: 'start', latitude: 11.1, longitude: 106.1 }),
    ])
    expect(tx.personalCheckpoint.findMany).toHaveBeenCalledWith({
      where: { personalTrailId: 'trail' },
      orderBy: { sequence: 'asc' },
    })
  })

  it.each(['SUBMITTED', 'UNDER_REVIEW'])('reuses an existing %s submission', async (status) => {
    tx.personalTrail.findUnique.mockResolvedValue({
      id: 'trail',
      userId: 'owner',
      distanceKm: 1,
      trailSubmissionsViaPersonalTrailId: [{ status, createdAt: updatedAt }],
    })
    expect(await adapter.submitTrailVerification('trail', 'owner')).toMatchObject({ verificationStatus: 'PENDING' })
    expect(tx.trailSubmission.create).not.toHaveBeenCalled()
    expect(tx.$queryRaw).toHaveBeenCalled()
  })

  it('blocks resubmission and editing when an older submission was approved', async () => {
    tx.personalTrail.findUnique.mockResolvedValue({
      id: 'trail',
      userId: 'owner',
      distanceKm: 1,
      trailSubmissionsViaPersonalTrailId: [{ status: 'SUBMITTED' }, { status: 'APPROVED' }],
    })
    await expect(adapter.submitTrailVerification('trail', 'owner')).rejects.toMatchObject({
      code: 'CANNOT_MODIFY_VERIFIED_TRAIL',
    })
    await expect(adapter.updatePersonalTrail('trail', 'owner', { title: 'changed' })).rejects.toMatchObject({
      code: 'CANNOT_MODIFY_VERIFIED_TRAIL',
    })
    expect(tx.trailSubmission.create).not.toHaveBeenCalled()
    expect(tx.personalTrail.update).not.toHaveBeenCalled()
  })
})

@Controller('trail-error-test')
class TrailErrorController {
  @Post('samples')
  samples(@Body(new ZodValidationPipe(rawSamplesBatchSchema)) input: RawSamplesBatchInput) {
    return { receivedCount: input.samples.length }
  }
  @Get()
  conflict() {
    throw new AppError({ code: PersonalTrailErrorCode.RECORDING_CHANGED })
  }
  @Get('busy')
  busy() {
    throw new AppError({ code: PersonalTrailErrorCode.PERSONAL_TRAIL_STORAGE_BUSY })
  }
  @Get('transaction')
  transaction() {
    throw new AppError({ code: PersonalTrailErrorCode.PERSONAL_TRAIL_TRANSACTION_UNAVAILABLE })
  }
  @Get('destination')
  destination() {
    throw new AppError({ code: PersonalTrailErrorCode.PERSONAL_TRAIL_DESTINATION_UNAVAILABLE })
  }
}

describe('Recording conflict HTTP error contract', () => {
  let app: INestApplication
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [TrailErrorController] }).compile()
    app = module.createNestApplication()
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })
  afterAll(async () => {
    await app.close()
  })
  it('uses the shared 409 envelope and marks a stale calculation retryable', async () => {
    const response = await request(app.getHttpServer())
      .get('/trail-error-test')
      .set('x-request-id', 'trail-request')
      .expect(409)
    expect(response.body.error).toMatchObject({ code: 'RECORDING_CHANGED', retryable: true })
    expect(response.body.meta).toMatchObject({ requestId: 'trail-request', contractVersion: '0.2.0-final-flow' })
    expect(response.body.meta.serverTime).toEqual(expect.any(String))
  })
  it.each([
    ['busy', 'PERSONAL_TRAIL_STORAGE_BUSY', true],
    ['transaction', 'PERSONAL_TRAIL_TRANSACTION_UNAVAILABLE', false],
    ['destination', 'PERSONAL_TRAIL_DESTINATION_UNAVAILABLE', false],
  ])('uses the shared 503 contract for %s', async (route, code, retryable) => {
    const response = await request(app.getHttpServer()).get(`/trail-error-test/${route}`).expect(503)
    expect(response.body.error).toMatchObject({ code, retryable })
    expect(response.body.meta).toHaveProperty('requestId')
  })
  it('returns shared validation errors for an oversized GPS batch', async () => {
    const sample = {
      clientSampleId: '11111111-1111-4111-8111-111111111111',
      latitude: 11,
      longitude: 106,
      recordedAt: '2026-10-27T00:00:00Z',
    }
    const response = await request(app.getHttpServer())
      .post('/trail-error-test/samples')
      .send({ samples: Array(501).fill(sample) })
      .expect(400)
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      retryable: false,
      details: expect.arrayContaining([expect.objectContaining({ field: 'samples' })]),
    })
  })
})

describe('Personal trail input limits', () => {
  const sample = {
    clientSampleId: '11111111-1111-4111-8111-111111111111',
    latitude: 11,
    longitude: 106,
    recordedAt: '2026-10-27T00:00:00Z',
  }
  it('accepts 500 GPS samples and rejects 501', () => {
    expect(rawSamplesBatchSchema.safeParse({ samples: Array(500).fill(sample) }).success).toBe(true)
    expect(rawSamplesBatchSchema.safeParse({ samples: Array(501).fill(sample) }).success).toBe(false)
  })
  it.each([-1, 1.5, 2_147_483_648])('rejects invalid elapsedSeconds %s', (elapsedSeconds) => {
    expect(finishRecordingSchema.safeParse({ provisionalTelemetry: { elapsedSeconds } }).success).toBe(false)
  })
  it('validates duration and custom checkpoint payloads', () => {
    expect(finishRecordingSchema.safeParse({ provisionalTelemetry: { duration: 'x'.repeat(101) } }).success).toBe(false)
    expect(
      finishRecordingSchema.safeParse({ checkpoints: [{ name: 'Water', latitude: 91, longitude: 106 }] }).success,
    ).toBe(false)
    expect(
      finishRecordingSchema.parse({ checkpoints: [{ name: 'Water', latitude: 11, longitude: 106 }] }).checkpoints?.[0]
        .radiusMeters,
    ).toBe(50)
  })
})
