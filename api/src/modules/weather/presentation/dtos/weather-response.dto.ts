import { WeatherRiskLevel } from '@prisma/client'

export interface WeatherDaySummaryDto {
  date: string
  weatherCode: number | null
  condition: string | null
  temperatureMaxC: number | null
  temperatureMinC: number | null
  precipitationSumMm: number | null
  rainProbabilityPercent: number | null
  windSpeedMaxMps: number | null
  windGustMaxMps: number | null
}

export interface TripWeatherResponseDto {
  tripId: string
  destinationName: string
  startDate: string      // YYYY-MM-DD (Ngày bắt đầu chuyến)
  endDate: string        // YYYY-MM-DD (Ngày kết thúc chuyến)
  targetTripDate: string // YYYY-MM-DD (Giữ tương thích ngược)
  durationDays: number   // Số ngày của chuyến đi (ví dụ 2 ngày)
  isFromCache: boolean   // True nếu lấy từ snapshot DB đã có; False nếu vừa gọi Open-Meteo và lưu mới
  snapshot: {
    id: string
    provider: string
    observedAt: string
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
  }
  forecast: WeatherDaySummaryDto[]
}
