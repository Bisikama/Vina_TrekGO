import { WeatherRiskLevel } from '@prisma/client'

export interface CreateWeatherSnapshotInput {
  tripId: string
  tripCheckpointId?: string | null
  latitude: number
  longitude: number
  provider: string
  temperatureC?: number | null
  apparentTemperatureC?: number | null
  humidityPercent?: number | null
  windSpeedMps?: number | null
  windGustMps?: number | null
  precipitationMm?: number | null
  rainProbabilityPercent?: number | null
  weatherCode?: number | null
  weatherCondition?: string | null
  riskLevel: WeatherRiskLevel
  riskSummary?: string | null
  forecastData?: any
  observedAt: Date
  expiresAt?: Date | null
}

export interface WeatherSnapshotRecord {
  id: string
  tripId: string | null
  tripCheckpointId: string | null
  latitude: number
  longitude: number
  provider: string
  temperatureC: number | null
  apparentTemperatureC: number | null
  humidityPercent: number | null
  windSpeedMps: number | null
  windGustMps: number | null
  precipitationMm: number | null
  rainProbabilityPercent: number | null
  weatherCode: number | null
  weatherCondition: string | null
  riskLevel: WeatherRiskLevel
  riskSummary: string | null
  forecastData: any
  observedAt: Date
  expiresAt: Date | null
  createdAt: Date
}

export interface TripWeatherContext {
  id: string
  title: string
  startAt: Date
  endAt: Date
  destinationId: string
  destinationName: string
  latitude: number
  longitude: number
  creatorId: string
  leaderId: string | null
  memberUserIds: string[]
  bookingUserIds: string[]
}

export abstract class WeatherPort {
  abstract findLatestByTripId(tripId: string): Promise<WeatherSnapshotRecord | null>
  abstract createSnapshot(data: CreateWeatherSnapshotInput): Promise<WeatherSnapshotRecord>
  abstract findTripContext(tripId: string): Promise<TripWeatherContext | null>
}
