import type { GpsSession } from '@prisma/client'
import type { FrozenGpsPolicy } from './gps-policy'
import type { ActiveInterval } from './gps-geometry'
import type { LastLocationDto, MemberStateDto } from './trip-gps.contract'

export interface RecordingState {
  policy: FrozenGpsPolicy
  intervals: ActiveInterval[]
  commands: Record<string, { payload: string; response: any }>
  lastControlAt: string
  controlStatus?: 'ACTIVE' | 'PAUSED'
  closedReason?: 'USER_FINISHED' | 'TRIP_ENDED' | 'CANCELLED' | 'ACCESS_REVOKED'
  autoClosedAt?: string
  lastLocation?: LastLocationDto | null
  lastSyncAt?: string | null
  deviation?: MemberStateDto['deviation']
  trackHash?: string
  trackContextHash?: string
  rawPurgedAt?: string
  rate?: { minute: number; count: number }
  /** A durable, coalesced request for the post-commit track processor. */
  trackRefreshPending?: boolean
}
export const recordingState = (s: GpsSession) => s.recordingState as unknown as RecordingState
