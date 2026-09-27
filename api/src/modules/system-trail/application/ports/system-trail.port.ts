export const I_SYSTEM_TRAIL_REPOSITORY = 'I_SYSTEM_TRAIL_REPOSITORY'

export interface SystemTrailSummary {
  id: string
  code: string
  name: string
  description: string | null
  difficulty: string
  distanceKm: number
  elevationGainM: number | null
  estimatedDurationMinutes: number | null
  destination: {
    id: string
    name: string
    region: string | null
    centerLat: number | null
    centerLng: number | null
  }
  checkpointCount: number
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

export interface ISystemTrailRepository {
  findAll(destinationId?: string): Promise<SystemTrailSummary[]>
  findByIdOrCode(idOrCode: string): Promise<SystemTrailDetail | null>
}
