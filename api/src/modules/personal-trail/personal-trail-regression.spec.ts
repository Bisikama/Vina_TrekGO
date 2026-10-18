import { Controller, Get, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { PrismaPersonalTrailAdapter } from './infrastructure/adapters/prisma-personal-trail.adapter'
import { AppError, GlobalErrorFilter, PersonalTrailErrorCode } from '../../shared/errors'
import { PersonalTrailUseCase } from './application/use-cases/personal-trail.use-case'

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
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'recording', userId: 'owner', status: 'STOPPED', updatedAt, startedAt: updatedAt }),
        update: jest.fn().mockResolvedValue({ id: 'recording', status: 'READY' }),
      },
      trailRecordingPoint: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
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
    adapter = new PrismaPersonalTrailAdapter({ ...tx, $transaction: (fn: any) => fn(tx) })
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
    expect(tx.personalTrail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ trailSubmissionsViaPersonalTrailId: { some: { status: 'APPROVED' } } }),
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
  @Get()
  conflict() {
    throw new AppError({ code: PersonalTrailErrorCode.RECORDING_CHANGED })
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
})
