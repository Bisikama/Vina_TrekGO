import { Injectable, Logger } from '@nestjs/common'

export interface OpenMeteoDayData {
  startDate: string
  endDate: string
  temperatureC: number
  apparentTemperatureC: number
  humidityPercent: number
  windSpeedMps: number
  windGustMps: number
  precipitationMm: number
  rainProbabilityPercent: number
  weatherCode: number
  rawHourly?: any
  rawDaily?: any
}

@Injectable()
export class OpenMeteoClient {
  private readonly logger = new Logger(OpenMeteoClient.name)
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast'

  /**
   * Lấy dự báo thời tiết cho một khoảng thời gian của chuyến đi (từ startDate đến endDate).
   */
  async fetchForecastForDateRange(
    latitude: number,
    longitude: number,
    startDate: Date,
    endDate?: Date | null,
  ): Promise<OpenMeteoDayData> {
    const startDateStr = this.formatDate(startDate)
    const effectiveEndDate = endDate && endDate >= startDate ? endDate : startDate
    const endDateStr = this.formatDate(effectiveEndDate)

    const today = new Date()
    const diffDaysStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const diffDaysEnd = Math.ceil((effectiveEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    let url: string
    // Open-Meteo forecast API hỗ trợ truy vấn dải ngày từ hôm nay tới 16 ngày tới
    if (diffDaysStart >= 0 && diffDaysEnd <= 16) {
      url = `${this.baseUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${startDateStr}&end_date=${endDateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=Asia%2FHo_Chi_Minh`
    } else {
      this.logger.warn(
        `Trip dates [${startDateStr} -> ${endDateStr}] outside 0-16 days range. Fetching standard forecast instead.`,
      )
      url = `${this.baseUrl}?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=Asia%2FHo_Chi_Minh`
    }

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000), // Timeout 8s
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Open-Meteo HTTP ${response.status}: ${errorText}`)
      }

      const json = await response.json()
      return this.extractRangeData(json, startDateStr, endDateStr)
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch Open-Meteo weather for [${latitude}, ${longitude}] from ${startDateStr} to ${endDateStr}: ${error.message}`,
      )
      throw error
    }
  }

  /**
   * Giữ tương thích ngược với lệnh gọi 1 ngày.
   */
  async fetchForecastForDate(latitude: number, longitude: number, targetDate: Date): Promise<OpenMeteoDayData> {
    return this.fetchForecastForDateRange(latitude, longitude, targetDate, targetDate)
  }

  private extractRangeData(data: any, startDateStr: string, endDateStr: string): OpenMeteoDayData {
    const daily = data.daily || {}
    const dates: string[] = daily.time || []

    // Lọc ra các index thuộc khoảng ngày [startDateStr, endDateStr]
    const matchedIndices: number[] = []
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] >= startDateStr && dates[i] <= endDateStr) {
        matchedIndices.push(i)
      }
    }

    // Nếu không match được, lấy index 0 làm mặc định
    const indicesToUse = matchedIndices.length > 0 ? matchedIndices : [0]

    let totalTempMax = 0
    let totalTempMin = 0
    let totalAppMax = 0
    let totalAppMin = 0
    let maxWindSpeed = 0
    let maxWindGust = 0
    let totalPrecipitation = 0
    let maxRainProbability = 0
    let mostSevereWeatherCode = 0

    // Bảng ưu tiên mã thời tiết nguy hiểm hơn (95,96,99 bão > 65 mưa to > 61 mưa nhẹ > 0 quang)
    const getSeverityScore = (code: number) => {
      if (code >= 95) return 100 // Dông bão
      if (code === 82 || code === 65) return 80 // Mưa to
      if (code >= 61 || code >= 80) return 60 // Mưa vừa/rào
      if (code >= 51) return 40 // Mưa phùn
      if (code === 45 || code === 48) return 30 // Sương mù
      return 10 // Ít mây, quang đãng
    }

    for (const idx of indicesToUse) {
      const tempMax = daily.temperature_2m_max?.[idx] ?? 25
      const tempMin = daily.temperature_2m_min?.[idx] ?? 20
      const appMax = daily.apparent_temperature_max?.[idx] ?? tempMax
      const appMin = daily.apparent_temperature_min?.[idx] ?? tempMin
      const windSpeed = daily.wind_speed_10m_max?.[idx] ?? 0
      const windGust = daily.wind_gusts_10m_max?.[idx] ?? windSpeed
      const precip = daily.precipitation_sum?.[idx] ?? 0
      const precipProb = daily.precipitation_probability_max?.[idx] ?? 0
      const code = daily.weather_code?.[idx] ?? 0

      totalTempMax += tempMax
      totalTempMin += tempMin
      totalAppMax += appMax
      totalAppMin += appMin

      if (windSpeed > maxWindSpeed) maxWindSpeed = windSpeed
      if (windGust > maxWindGust) maxWindGust = windGust
      totalPrecipitation += precip
      if (precipProb > maxRainProbability) maxRainProbability = precipProb

      if (getSeverityScore(code) > getSeverityScore(mostSevereWeatherCode)) {
        mostSevereWeatherCode = code
      }
    }

    const n = indicesToUse.length
    const avgTemp = Math.round(((totalTempMax + totalTempMin) / (2 * n)) * 10) / 10
    const avgAppTemp = Math.round(((totalAppMax + totalAppMin) / (2 * n)) * 10) / 10

    // Tính độ ẩm trung bình từ hourly nếu có
    const hourly = data.hourly || {}
    const humidities: number[] = hourly.relative_humidity_2m || []
    let avgHumidity = 75
    if (humidities.length > 0) {
      const hoursToSample = Math.min(24 * n, humidities.length)
      const sum = humidities.slice(0, hoursToSample).reduce((acc, val) => acc + (val ?? 0), 0)
      avgHumidity = Math.round((sum / hoursToSample) * 10) / 10
    }

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      temperatureC: avgTemp,
      apparentTemperatureC: avgAppTemp,
      humidityPercent: avgHumidity,
      windSpeedMps: Math.round(maxWindSpeed * 10) / 10,
      windGustMps: Math.round(maxWindGust * 10) / 10,
      precipitationMm: Math.round(totalPrecipitation * 10) / 10,
      rainProbabilityPercent: maxRainProbability,
      weatherCode: mostSevereWeatherCode,
      rawHourly: data.hourly,
      rawDaily: data.daily,
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}
