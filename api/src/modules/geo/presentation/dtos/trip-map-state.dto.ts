import { z } from 'zod'
import { GpsSessionStatus } from '@prisma/client'

// Regex kiểm tra định dạng UUID 8-4-4-4-12 chuẩn xác (hỗ trợ cả RFC 4122 và UUID từ database/seed)
export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// 1. Validate Param đầu vào: tripId
export const tripMapStateParamSchema = z.object({
  tripId: z.string().regex(UUID_REGEX, { message: 'tripId phải là UUID hợp lệ' }),
})
export type TripMapStateParam = z.infer<typeof tripMapStateParamSchema>

// 2. Enum trạng thái hiển thị bản đồ cho Mobile (Client-side)
export enum MapDeviationDisplayStatus {
  NORMAL = 'NORMAL',
  DEVIATED = 'DEVIATED',
}

// 3. Cấu trúc Response trả về
export interface GpsSessionSummaryDto {
  id: string
  status: GpsSessionStatus // 
  startedAt: string
  totalDistanceMeters: number | null
}

export interface LastLocationDto {
  latitude: number
  longitude: number
  accuracyM: number | null
  speedMps: number | null
  headingDeg: number | null
  altitudeM: number | null
  recordedAt: string
}

export interface DeviationStatusDto {
  status: MapDeviationDisplayStatus // 
  maxDeviationDistanceM: number | null
  lastCheckedAt: string | null
}

export interface TripProgressDto {
  totalCheckpoints: number
  passedCheckpoints: number
  completedPercentage: number
  arrivedCheckpointIds: string[]
}

export interface TripMapStateResponse {
  tripId: string
  gpsSession: GpsSessionSummaryDto | null
  lastLocation: LastLocationDto | null
  deviation: DeviationStatusDto
  progress: TripProgressDto
}
