import { RecordStatus, CheckpointType } from '@prisma/client'

export interface CheckpointDestinationSummary {
  id: string
  name: string
  region: string | null
}

export interface CheckpointSummary {
  id: string
  destinationId: string
  code: string | null
  name: string
  description: string | null
  latitude: number
  longitude: number
  defaultRadiusMeters: number
  checkpointType: CheckpointType | null
  status: RecordStatus
  destination?: CheckpointDestinationSummary
  trailCount?: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateCheckpointData {
  destinationId: string
  code?: string | null
  name: string
  description?: string | null
  latitude: number
  longitude: number
  defaultRadiusMeters?: number
  checkpointType?: CheckpointType | null
  status?: RecordStatus
}

export type UpdateCheckpointData = Partial<CreateCheckpointData>

export interface PaginatedResult<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface GetCheckpointsFilter {
  page?: number
  pageSize?: number
  destinationId?: string
  checkpointType?: CheckpointType
  keyword?: string
  status?: RecordStatus
}

export interface CheckpointRelatedCounts {
  trails: number
  trips: number
}

export abstract class CheckpointPort {
  abstract findAll(filter?: GetCheckpointsFilter): Promise<PaginatedResult<CheckpointSummary>>
  abstract findById(id: string): Promise<CheckpointSummary | null>
  abstract findByCode(code: string): Promise<CheckpointSummary | null>
  abstract create(data: CreateCheckpointData): Promise<CheckpointSummary>
  abstract update(id: string, data: UpdateCheckpointData): Promise<CheckpointSummary>
  abstract delete(id: string): Promise<void>
  abstract countRelated(id: string): Promise<CheckpointRelatedCounts>
  abstract checkDestinationExists(destinationId: string): Promise<boolean>
}
