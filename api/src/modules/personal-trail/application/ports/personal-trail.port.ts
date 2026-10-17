import { DifficultyLevel, PersonalTrailVisibility, RecordStatus } from '@prisma/client'
import { MyTrailsQuery, RawSamplesBatchInput } from '../../presentation/dtos/personal-trail.dto'

export interface TrailRecordingModel {
  id: string
  clientRecordingId: string | null
  userId: string
  title: string | null
  status: string
  startedAt: Date
  endedAt: Date | null
  processedGeojson: any
  elevationProfile: any
  distanceKm: any
  elevationGainM: number | null
  elevationLossM: number | null
  createdPersonalTrailId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TrailRecordingPointModel {
  id: bigint
  recordingId: string
  clientSampleId: string
  latitude: any
  longitude: any
  accuracyM: any
  speedMps: any
  headingDeg: any
  altitudeM: any
  altitudeAccuracyM: any
  segmentId: number
  accepted: boolean | null
  rejectReason: string | null
  recordedAt: Date
  receivedAt: Date
}

export interface PersonalTrailModel {
  id: string
  userId: string
  destinationId: string | null
  title: string
  description: string | null
  difficulty: DifficultyLevel | null
  distanceKm: any
  elevationGainM: number | null
  elevationLossM: number | null
  elevationProfile: any
  routeGeojson: any
  visibility: PersonalTrailVisibility
  status: RecordStatus
  version: number
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}

export interface OfficialTelemetry {
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  maxElevationM: number
  minElevationM: number
}

export const I_PERSONAL_TRAIL_REPOSITORY = 'I_PERSONAL_TRAIL_REPOSITORY'

export interface IPersonalTrailRepository {
  findRecordingById(id: string): Promise<TrailRecordingModel | null>
  findRecordingByClientRecordingId(clientRecordingId: string, userId: string): Promise<TrailRecordingModel | null>
  createRecording(data: {
    clientRecordingId: string
    userId: string
    startedAt: Date
    status: string
  }): Promise<TrailRecordingModel>

  saveRawSamplesBatch(
    recordingId: string,
    samples: RawSamplesBatchInput['samples'],
  ): Promise<{ receivedCount: number; insertedCount: number; duplicatedCount: number }>

  getPointsByRecordingId(recordingId: string, acceptedOnly?: boolean): Promise<TrailRecordingPointModel[]>

  updateRecordingStatus(recordingId: string, status: string): Promise<TrailRecordingModel>

  completeRecordingAndCreateTrail(params: {
    recordingId: string
    userId: string
    expectedUpdatedAt: Date
    endedAt: Date
    processedGeojson: any
    metrics: {
      distanceKm: number
      elevationGainM: number
      elevationLossM: number
      minElevationM: number
      maxElevationM: number
      elevationProfile: any
    }
    provisionalTelemetry?: {
      duration?: string
      elapsedSeconds?: number
    }
    trailMetadata?: {
      title?: string
      description?: string | null
      difficulty?: string | null
      visibility?: string | null
    }
  }): Promise<{ recording: TrailRecordingModel; personalTrail: PersonalTrailModel }>

  findPersonalTrailById(id: string): Promise<any>
  findMyPersonalTrails(userId: string, query: MyTrailsQuery): Promise<{ items: any[]; totalItems: number }>
  updatePersonalTrail(id: string, userId: string, data: any): Promise<PersonalTrailModel>
  softDeletePersonalTrail(id: string, userId: string): Promise<void>
  submitTrailVerification(trailId: string, userId: string, note?: string): Promise<any>
}
