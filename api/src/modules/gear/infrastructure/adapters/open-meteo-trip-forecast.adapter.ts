import { Injectable, Logger } from '@nestjs/common'
import { OpenMeteoClient } from '../../../weather/infrastructure/external/open-meteo.client'
import type { ForecastClimate, TripForecastPort, TripForecastQuery } from '../../application/ports/trip-forecast.port'

/** Open-Meteo chỉ dự báo tới 16 ngày tới. */
export const FORECAST_HORIZON_DAYS = 16
const DAY_MS = 24 * 60 * 60 * 1000

/** Ngày dạng YYYY-MM-DD theo giờ Việt Nam (Open-Meteo được gọi với timezone Asia/Ho_Chi_Minh). */
function vnDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function numbersAt(series: unknown, indices: number[]): number[] {
  if (!Array.isArray(series)) return []
  return indices.map((i) => series[i]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
}

/**
 * Dự báo khí hậu cho chuyến từ `OpenMeteoClient` của module weather (chỉ đọc, không ghi snapshot).
 * Không dùng `GetTripWeatherUseCase` vì use case đó ghi DB và giữ snapshot đầu tiên mãi.
 */
@Injectable()
export class OpenMeteoTripForecastAdapter implements TripForecastPort {
  private readonly logger = new Logger(OpenMeteoTripForecastAdapter.name)
  /** Đồng hồ; test ghi đè để cố định "hôm nay". */
  now: () => Date = () => new Date()

  constructor(private readonly client: OpenMeteoClient) {}

  async getForecastClimate(query: TripForecastQuery): Promise<ForecastClimate | null> {
    const now = this.now()
    const { startAt, endAt } = query
    if (!(startAt instanceof Date) || !(endAt instanceof Date) || endAt < startAt) return null
    if (endAt.getTime() < now.getTime()) return null
    // Ngoài tầm dự báo thì client tự lấy thời tiết hôm nay thay thế — không dùng được làm gợi ý.
    if (Math.ceil((endAt.getTime() - now.getTime()) / DAY_MS) > FORECAST_HORIZON_DAYS) return null

    // Chuyến đang diễn ra: chỉ dự báo phần còn lại.
    const from = startAt.getTime() < now.getTime() ? now : startAt

    try {
      const result = await this.client.fetchForecastForDateRange(query.lat, query.lng, from, endAt)
      const daily = result?.rawDaily ?? {}
      const dates: unknown[] = Array.isArray(daily.time) ? daily.time : []
      const fromStr = vnDate(from)
      const toStr = vnDate(endAt)
      const indices = dates
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => typeof d === 'string' && d >= fromStr && d <= toStr)
        .map(({ i }) => i)
      if (indices.length === 0) return null

      const mins = numbersAt(daily.temperature_2m_min, indices)
      const maxs = numbersAt(daily.temperature_2m_max, indices)
      const apparentMins = numbersAt(daily.apparent_temperature_min, indices)
      const rainProbs = numbersAt(daily.precipitation_probability_max, indices)
      if (mins.length === 0 || maxs.length === 0) return null

      const tempMin = Math.min(...mins)
      return {
        temp_min_c: Math.round(tempMin),
        temp_max_c: Math.round(Math.max(...maxs)),
        // Nhiệt độ thấp nhất trong ngày thường rơi vào đêm/sáng sớm; cảm nhận (gió) thấp hơn thì lấy cảm nhận.
        temp_min_night_c: Math.round(Math.min(tempMin, ...apparentMins)),
        rain_prob_pct: rainProbs.length > 0 ? Math.round(Math.max(...rainProbs)) : 0,
        source: 'FORECAST',
        provider: 'open-meteo',
        forecastFrom: fromStr,
        forecastTo: toStr,
        fetchedAt: now.toISOString(),
      }
    } catch (err: any) {
      this.logger.warn(`Trip forecast unavailable, using climate estimate only: ${err?.message}`)
      return null
    }
  }
}
