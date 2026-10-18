import { RecordStatus } from '@prisma/client'

export interface PickupPointSummary {
  id: string
  destinationId: string | null
  code: string
  name: string
  address: string
  latitude: number
  longitude: number
  note: string | null
  status: RecordStatus
  createdAt: Date
  updatedAt: Date
}

export interface CreatePickupPointData {
  name: string
  address: string
  latitude: number
  longitude: number
  code?: string | null
  note?: string | null
  status?: RecordStatus
}

export interface UpdatePickupPointData {
  id?: string
  name: string
  address: string
  latitude: number
  longitude: number
  code?: string | null
  note?: string | null
  status?: RecordStatus
}

export interface DestinationSummary {
  id: string
  name: string
  description: string | null
  region: string | null
  centerLat: number | null
  centerLng: number | null
  status: RecordStatus
  trailCount?: number
  pickupPointCount?: number
  pickupPoints?: PickupPointSummary[]
  createdAt: Date
  updatedAt: Date
}

export interface CreateDestinationData {
  name: string
  description?: string | null
  region?: string | null
  centerLat?: number | null
  centerLng?: number | null
  status?: RecordStatus
  actorId?: string
  pickupPoints?: CreatePickupPointData[]
}

export interface PaginatedResult<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface GetDestinationsFilter {
  keyword?: string
  region?: string
  status?: RecordStatus
  page?: number
  pageSize?: number
}

export interface UpdateDestinationData {
  name?: string
  description?: string | null
  region?: string | null
  centerLat?: number | null
  centerLng?: number | null
  status?: RecordStatus
  actorId?: string
  pickupPoints?: UpdatePickupPointData[]
}

export interface DestinationRelatedCounts {
  trails: number
  checkpoints: number
  trips: number
}

export abstract class DestinationPort {
  abstract findAll(filter?: GetDestinationsFilter): Promise<PaginatedResult<DestinationSummary>>
  abstract findById(id: string): Promise<DestinationSummary | null>
  abstract findByName(name: string): Promise<DestinationSummary | null>
  abstract create(data: CreateDestinationData): Promise<DestinationSummary>
  abstract update(id: string, data: UpdateDestinationData): Promise<DestinationSummary>
  abstract delete(id: string): Promise<void>
  abstract countRelated(id: string): Promise<DestinationRelatedCounts>
}
