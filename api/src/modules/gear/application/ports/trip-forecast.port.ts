export const TRIP_FORECAST_PORT = Symbol('TRIP_FORECAST_PORT')

export interface TripForecastQuery {
  lat: number
  lng: number
  startAt: Date
  endAt: Date
}

/** Khí hậu dự báo cho khoảng ngày của chuyến, cùng dạng với gợi ý khí hậu của kế hoạch trang bị. */
export interface ForecastClimate {
  temp_min_c: number
  temp_max_c: number
  temp_min_night_c: number
  rain_prob_pct: number
  source: 'FORECAST'
  provider: string
  forecastFrom: string
  forecastTo: string
  fetchedAt: string
}

export interface TripForecastPort {
  /**
   * Dự báo thật cho chuyến sắp diễn ra. Chỉ đọc (không ghi DB).
   * Trả `null` khi chuyến nằm ngoài tầm dự báo, nhà cung cấp lỗi hoặc thiếu dữ liệu — không bao giờ ném lỗi.
   */
  getForecastClimate(query: TripForecastQuery): Promise<ForecastClimate | null>
}
