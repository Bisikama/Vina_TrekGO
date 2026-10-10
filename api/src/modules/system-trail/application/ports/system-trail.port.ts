import { DifficultyLevel, RecordStatus } from '@prisma/client'

export const I_SYSTEM_TRAIL_REPOSITORY = 'I_SYSTEM_TRAIL_REPOSITORY'

export interface PaginatedResult<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface SystemTrailSummary {
  id: string
  code: string
  name: string
  description: string | null
  difficulty: DifficultyLevel
  distanceKm: number
  elevationGainM: number | null
  estimatedDurationMinutes: number | null
  price: number
  status: RecordStatus
  destination: {
    id: string
    name: string
    region: string | null
    centerLat: number | null
    centerLng: number | null
  }
  checkpointCount: number
  createdAt?: Date
  updatedAt?: Date
}

export interface CheckpointDetail {
  id: string
  code: string | null
  name: string
  description: string | null
  sequence: number
  isRequired: boolean
  latitude: number
  longitude: number
  radiusMeters: number
}

export interface SystemTrailDetail extends SystemTrailSummary {
  routeGeojson: any
  version: number
  checkpoints: CheckpointDetail[]
  bounds?: {
    minLng: number
    minLat: number
    maxLng: number
    maxLat: number
  } | null
  initialCamera?: {
    center: [number, number]
    zoom: number
    pitch: number
    bearing: number
  } | null
}

export interface TrailCheckpointInput {
  checkpointId: string
  sequence: number
  isRequired?: boolean
}

export interface CreateSystemTrailData {
  destinationId: string
  code: string
  name: string
  description?: string | null
  difficulty: DifficultyLevel
  distanceKm: number
  elevationGainM?: number | null
  estimatedDurationMinutes?: number | null
  price?: number
  routeGeojson: any
  checkpoints?: TrailCheckpointInput[]
  status?: RecordStatus
  createdBy: string
}

export interface UpdateSystemTrailData {
  destinationId?: string
  code?: string
  name?: string
  description?: string | null
  difficulty?: DifficultyLevel
  distanceKm?: number
  elevationGainM?: number | null
  estimatedDurationMinutes?: number | null
  price?: number
  routeGeojson?: any
  checkpoints?: TrailCheckpointInput[]
  status?: RecordStatus
}

export interface GetSystemTrailsFilter {
  destinationId?: string
  keyword?: string
  difficulty?: DifficultyLevel
  status?: RecordStatus
  minDistance?: number
  maxDistance?: number
  page?: number
  pageSize?: number
}

export interface SystemTrailRelatedCounts {
  accesses: number
  trips: number
}

export interface ISystemTrailRepository {
  findAll(filter?: GetSystemTrailsFilter): Promise<PaginatedResult<SystemTrailSummary>>
  findByIdOrCode(idOrCode: string): Promise<SystemTrailDetail | null>
  findByCode(code: string): Promise<SystemTrailSummary | null>
  validateDestination(destinationId: string): Promise<boolean>
  validateCheckpoints(destinationId: string, checkpointIds: string[]): Promise<boolean>
  create(data: CreateSystemTrailData): Promise<SystemTrailDetail>
  update(id: string, data: UpdateSystemTrailData): Promise<SystemTrailDetail>
  softDelete(id: string): Promise<void>
  countRelated(id: string): Promise<SystemTrailRelatedCounts>
}
