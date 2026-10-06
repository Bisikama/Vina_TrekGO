import { DeviationStatus, GpsSessionStatus } from '@prisma/client'

export interface TripMapStateRawData {
  tripExists: boolean
  hasAccess: boolean
  activeSession: {
    id: string
    status: GpsSessionStatus
    startedAt: Date
    totalDistanceMeters: number | null
  } | null
  lastLocation: {
    latitude: number
    longitude: number
    accuracyM: number | null
    speedMps: number | null
    headingDeg: number | null
    altitudeM: number | null
    recordedAt: Date
  } | null
  latestDeviation: {
    status: DeviationStatus
    maxDeviationDistanceM: number | null
    recoveredAt: Date | null
    startAt: Date
  } | null
  totalCheckpoints: number
  arrivedCheckpointIds: string[]
}

export abstract class TripMapStatePort {
  abstract getMapStateData(tripId: string, userId: string): Promise<TripMapStateRawData>
}
