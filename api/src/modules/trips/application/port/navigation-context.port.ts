import { DifficultyLevel, TripStatus } from '@prisma/client'

export interface TripNavigationData {
  id: string
  title: string
  status: TripStatus // <-- Enum Prisma
  creatorId: string
  leaderId: string | null
  isMemberOrBooked: boolean
  activeTrailPlanId: string | null
  trailPlans: Array<{
    id: string
    sequence: number
    snapshotName: string
    snapshotDifficulty: DifficultyLevel | null // <-- Enum Prisma
    snapshotDistanceKm: number | null
    snapshotElevationGainM: number | null
    snapshotGeojson: any
  }>
  checkpoints: Array<{
    id: string
    sequence: number
    name: string
    latitude: number
    longitude: number
    radiusMeters: number
    isRequired: boolean
    isEnabled: boolean
    missionTitle: string | null
    missionDescription: string | null
    missionType: string | null
    rewardPoints: number
  }>
}

export interface SwitchTrailResult {
  previousPlanId: string | null
  newPlan: {
    id: string
    snapshotName: string
    snapshotDifficulty: DifficultyLevel | null // <-- Enum Prisma
    snapshotDistanceKm: number | null
    snapshotElevationGainM: number | null
    snapshotGeojson: any
  }
}

export abstract class NavigationContextPort {
  abstract getTripNavigationData(tripId: string, userId: string): Promise<TripNavigationData | null>
  abstract switchActiveTrail(
    tripId: string,
    toPlanId: string,
    userId: string,
    reason?: string,
  ): Promise<SwitchTrailResult>
}
