import { TrailRecordingUseCase } from './application/use-cases/trail-recording.use-case'
import { IPersonalTrailRepository } from './application/ports/personal-trail.port'
import { ProcessTrailElevationUseCase } from '../elevation/application/use-cases/process-trail-elevation.use-case'
import { ActiveUserData } from '../../shared/types/user.type'
import { AppError } from '../../shared/errors/app-error'

describe('TrailRecordingUseCase Unit Tests', () => {
  let useCase: TrailRecordingUseCase
  let mockRepo: jest.Mocked<IPersonalTrailRepository>
  let mockElevationUseCase: jest.Mocked<ProcessTrailElevationUseCase>

  const mockUser: ActiveUserData = {
    id: '11111111-1111-1111-1111-111111111111',
    authUserId: 'auth-001',
    email: 'trekker@example.com',
    role: 'USER',
    status: 'ACTIVE',
  }

  beforeEach(() => {
    mockRepo = {
      findRecordingById: jest.fn(),
      findRecordingByClientRecordingId: jest.fn(),
      createRecording: jest.fn(),
      saveRawSamplesBatch: jest.fn(),
      getPointsByRecordingId: jest.fn(),
      updateRecordingStatus: jest.fn(),
      completeRecordingAndCreateTrail: jest.fn(),
      findPersonalTrailById: jest.fn(),
      findMyPersonalTrails: jest.fn(),
      updatePersonalTrail: jest.fn(),
      softDeletePersonalTrail: jest.fn(),
      submitTrailVerification: jest.fn(),
    }

    mockElevationUseCase = {
      execute: jest.fn(),
    } as any

    useCase = new TrailRecordingUseCase(mockRepo, mockElevationUseCase)
  })

  describe('start', () => {
    it('creates a new recording if clientRecordingId does not exist', async () => {
      mockRepo.findRecordingByClientRecordingId.mockResolvedValue(null)
      mockRepo.createRecording.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        clientRecordingId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        userId: mockUser.id,
        title: null,
        status: 'RECORDING',
        startedAt: new Date('2026-10-15T14:30:00Z'),
        endedAt: null,
        processedGeojson: null,
        elevationProfile: null,
        distanceKm: null,
        elevationGainM: null,
        elevationLossM: null,
        createdPersonalTrailId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await useCase.start(mockUser, {
        clientRecordingId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        startedAt: '2026-10-15T14:30:00.000Z',
      })

      expect(res.serverRecordingId).toBe('22222222-2222-2222-2222-222222222222')
      expect(res.status).toBe('RECORDING')
      expect(mockRepo.createRecording.mock.calls).toHaveLength(1)
    })

    it('returns existing recording if clientRecordingId is retried (Idempotent)', async () => {
      mockRepo.findRecordingByClientRecordingId.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        clientRecordingId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        userId: mockUser.id,
        title: null,
        status: 'RECORDING',
        startedAt: new Date('2026-10-15T14:30:00Z'),
        endedAt: null,
        processedGeojson: null,
        elevationProfile: null,
        distanceKm: null,
        elevationGainM: null,
        elevationLossM: null,
        createdPersonalTrailId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await useCase.start(mockUser, {
        clientRecordingId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      })

      expect(res.serverRecordingId).toBe('22222222-2222-2222-2222-222222222222')
      expect(mockRepo.createRecording.mock.calls).toHaveLength(0)
    })
  })

  describe('finish', () => {
    it('returns the original trail when finish is retried after READY', async () => {
      mockRepo.findRecordingById.mockResolvedValue({ id: 'rec-01', userId: mockUser.id, status: 'READY', createdPersonalTrailId: 'trail-01' } as any)
      expect(await useCase.finish(mockUser, 'rec-01', {})).toMatchObject({ serverPersonalTrailId: 'trail-01', status: 'READY' })
      expect(mockElevationUseCase.execute.mock.calls).toHaveLength(0)
      expect(mockRepo.completeRecordingAndCreateTrail.mock.calls).toHaveLength(0)
    })
    it('throws INSUFFICIENT_GPS_POINTS when fewer than 2 points exist', async () => {
      mockRepo.findRecordingById.mockResolvedValue({
        id: 'rec-01',
        userId: mockUser.id,
        status: 'RECORDING',
      } as any)
      mockRepo.getPointsByRecordingId.mockResolvedValue([
        {
          id: BigInt(1),
          recordingId: 'rec-01',
          clientSampleId: 'smp-01',
          latitude: 11.58,
          longitude: 108.52,
          segmentId: 0,
          recordedAt: new Date(),
          receivedAt: new Date(),
          accuracyM: null,
          speedMps: null,
          headingDeg: null,
          altitudeM: null,
          altitudeAccuracyM: null,
          accepted: true,
          rejectReason: null,
        },
      ])

      await expect(
        useCase.finish(mockUser, 'rec-01', {
          trailMetadata: { title: 'Test Trail' },
        }),
      ).rejects.toThrow(AppError)
    })

    it('processes DEM and completes recording successfully', async () => {
      mockRepo.findRecordingById.mockResolvedValue({
        id: 'rec-01',
        userId: mockUser.id,
        status: 'RECORDING',
      } as any)

      mockRepo.getPointsByRecordingId.mockResolvedValue([
        {
          id: BigInt(1),
          recordingId: 'rec-01',
          clientSampleId: 'smp-01',
          latitude: 11.58,
          longitude: 108.52,
          segmentId: 0,
          recordedAt: new Date(),
          receivedAt: new Date(),
          accuracyM: null,
          speedMps: null,
          headingDeg: null,
          altitudeM: 1400,
          altitudeAccuracyM: null,
          accepted: true,
          rejectReason: null,
        },
        {
          id: BigInt(2),
          recordingId: 'rec-01',
          clientSampleId: 'smp-02',
          latitude: 11.59,
          longitude: 108.53,
          segmentId: 0,
          recordedAt: new Date(),
          receivedAt: new Date(),
          accuracyM: null,
          speedMps: null,
          headingDeg: null,
          altitudeM: 1420,
          altitudeAccuracyM: null,
          accepted: true,
          rejectReason: null,
        },
      ])

      mockElevationUseCase.execute.mockResolvedValue({
        processedGeojson: {
          type: 'MultiLineString',
          coordinates: [
            [
              [108.52, 11.58, 1400],
              [108.53, 11.59, 1420],
            ],
          ],
        },
        metrics: {
          distanceKm: 1.5,
          elevationGainM: 20,
          elevationLossM: 0,
          minElevationM: 1400,
          maxElevationM: 1420,
          elevationProfile: [
            { distanceKm: 0, elevationM: 1400 },
            { distanceKm: 1.5, elevationM: 1420 },
          ],
        },
      })

      mockRepo.completeRecordingAndCreateTrail.mockResolvedValue({
        recording: { id: 'rec-01', status: 'READY' } as any,
        personalTrail: { id: 'trail-01' } as any,
      })

      const res = await useCase.finish(mockUser, 'rec-01', {
        trailMetadata: { title: 'Test Trail', difficulty: 'MODERATE' },
      })

      expect(res.serverRecordingId).toBe('rec-01')
      expect(res.serverPersonalTrailId).toBe('trail-01')
      expect(res.status).toBe('READY')
      expect(mockElevationUseCase.execute.mock.calls).toHaveLength(1)
      expect(mockRepo.completeRecordingAndCreateTrail.mock.calls).toHaveLength(1)
    })
  })

  it('rejects late GPS uploads after READY', async () => {
    mockRepo.findRecordingById.mockResolvedValue({ id: 'rec-01', userId: mockUser.id, status: 'READY' } as any)
    await expect(useCase.saveRawSamples(mockUser, 'rec-01', { samples: [] })).rejects.toMatchObject({ code: 'RECORDING_ALREADY_FINISHED' })
    expect(mockRepo.saveRawSamplesBatch.mock.calls).toHaveLength(0)
  })
})
