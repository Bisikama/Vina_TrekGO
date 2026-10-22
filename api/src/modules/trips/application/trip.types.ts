export type Actor = { id: string; role: string; status: string }
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
export type TripStatus =
  'DRAFT' | 'OPEN' | 'FULL' | 'CLOSED' | 'CANCEL_PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'INTERRUPTED'
export interface TripInput {
  destinationId: string
  title: string
  description?: string | null
  startAt: string
  endAt: string
  pickupPointId: string
  minPax?: number
  capacity: number
  price?: string | null
  priceExplanation?: string | null
}
export interface Checkpoint {
  id: string
  destinationId: string
  name: string
  description: string | null
  latitude: string
  longitude: string
  defaultRadiusMeters: number
  status: string
}
export interface Trail {
  id: string
  destinationId: string
  name: string
  difficulty: string
  status: string
  version: number
  routeGeojson: Json
  distanceKm: string
  elevationGainM: number | null
  checkpointIds: string[]
}
export interface PlannedTrail {
  systemTrailId: string
  sequence: number
  snapshotName: string
  snapshotDifficulty: string
  snapshotGeojson: Json
  snapshotDistanceKm: string | null
  snapshotElevationGainM: number | null
  sourceTrailVersion: number | null
  snapshotCheckpointIds: Json
}
export interface PlannedCheckpoint {
  sourceCheckpointId: string | null
  name: string
  description: string | null
  latitude: string
  longitude: string
  radiusMeters: number
  sequence: number
  isRequired: boolean
  isEnabled: boolean
}
export interface TripView {
  id: string
  tripType: string
  creatorId: string
  leaderId: string | null
  destinationId: string
  title: string
  description: string | null
  startAt: string
  endAt: string
  pickupPointId: string | null
  minPax?: number
  capacity: number
  price: string | null
  priceExplanation?: string | null
  costPlanStatus?: string | null
  includedServices?: string[]
  excludedServices?: string[]
  status: TripStatus
  version: number
  publishedAt: string | null
  checkpoints: PlannedCheckpoint[]
  trails: PlannedTrail[]
}
export interface Issue {
  code: string
  field: string
  message: string
}
export interface Readiness {
  canPublish: boolean
  issues: Issue[]
  version: number
}
export interface Conflict {
  id: string
  title: string
  startAt: string
  endAt: string
  status: string
}
export interface Option {
  id: string
  name: string
}
export interface Page {
  page: number
  pageSize: number
}
export interface CatalogReader {
  destination(id: string): Promise<{ id: string; status: string } | null>
  pickup(id: string): Promise<{ id: string; status: string; destinationId: string | null } | null>
  checkpoints(ids: string[]): Promise<Checkpoint[]>
  trails(ids: string[]): Promise<Trail[]>
  isPersonalTrail(id: string): Promise<boolean>
  destinations(page: Page): Promise<Option[]>
  pickups(destinationId: string, page: Page): Promise<Option[]>
  checkpointOptions(destinationId: string, page: Page): Promise<Checkpoint[]>
  trailCandidates(destinationId: string, page: Page): Promise<Trail[]>
}
export interface TripSession extends CatalogReader {
  actor(id: string): Promise<Actor | null>
  find(id: string): Promise<TripView | null>
  conflicts(leaderId: string, startAt: string, endAt: string, excludeId?: string): Promise<Conflict[]>
  create(actorId: string, data: TripInput): Promise<TripView>
  update(id: string, data: Partial<TripInput>): Promise<TripView>
  replaceCheckpoints(id: string, checkpoints: Checkpoint[]): Promise<TripView>
  replaceTrails(id: string, trails: Trail[]): Promise<TripView>
  publish(id: string): Promise<TripView>
  cancel(
    id: string,
    actorId: string,
    previousStatus: TripStatus,
    reason: string,
    evidenceUrls: string[],
  ): Promise<TripView>
  pendingCancellation(id: string): Promise<boolean>
}
export const TRIP_STORE = Symbol('TRIP_STORE')
export interface TripStore {
  // Implementations must serialize every mutation by actor, then Trip, and read catalog consistently.
  transaction<T>(actorId: string, tripId: string | undefined, work: (session: TripSession) => Promise<T>): Promise<T>
  read<T>(work: (session: TripSession) => Promise<T>): Promise<T>
  list(ownerId: string | undefined, page: Page): Promise<TripView[]>
  publicDetail(id: string): Promise<TripView | null>
}
