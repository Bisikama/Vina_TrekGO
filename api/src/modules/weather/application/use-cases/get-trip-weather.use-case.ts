import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { WeatherPort, WeatherSnapshotRecord } from '../ports/weather.port'
import { OpenMeteoClient } from '../../infrastructure/external/open-meteo.client'
import { mapWmoCode } from '../../infrastructure/external/weather-wmo.mapper'
import { evaluateWeatherRisk } from '../../infrastructure/external/weather-risk.evaluator'
import {
  TripWeatherResponseDto,
  WeatherDaySummaryDto,
} from '../../presentation/dtos/weather-response.dto'

@Injectable()
export class GetTripWeatherUseCase {
  constructor(
    private readonly weatherPort: WeatherPort,
    private readonly openMeteoClient: OpenMeteoClient,
  ) {}

  async execute(tripId: string, userId: string, userRole: string): Promise<TripWeatherResponseDto> {
    // 1. Kiểm tra tồn tại Chuyến đi và bối cảnh (ngày đi, ngày về, tọa độ điểm đến)
    const trip = await this.weatherPort.findTripContext(tripId)
    if (!trip) {
      throw new NotFoundException('Chuyến đi không tồn tại')
    }

    // 2. Kiểm tra quyền truy cập (Người tham gia, Leader, Creator hoặc Admin)
    const hasAccess =
      userRole === 'ADMIN' ||
      trip.creatorId === userId ||
      trip.leaderId === userId ||
      trip.memberUserIds.includes(userId) ||
      trip.bookingUserIds.includes(userId)

    if (!hasAccess) {
      throw new ForbiddenException('Bạn không có quyền truy cập vào thông tin thời tiết của chuyến đi này')
    }

    const startDateStr = this.formatDate(trip.startAt)
    const effectiveEndDate = trip.endAt && trip.endAt >= trip.startAt ? trip.endAt : trip.startAt
    const endDateStr = this.formatDate(effectiveEndDate)
    const durationDays = Math.max(
      1,
      Math.round((effectiveEndDate.getTime() - trip.startAt.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    )

    // 3. QUY TẮC MẤU CHỐT: Nếu chuyến đi ĐÃ CÓ snapshot trong DB -> LẤY NGAY TỪ DB, KHÔNG GỌI OPEN-METEO
    const existingSnapshot = await this.weatherPort.findLatestByTripId(tripId)
    if (existingSnapshot) {
      return this.buildResponse(
        trip.destinationName,
        startDateStr,
        endDateStr,
        durationDays,
        existingSnapshot,
        true,
      )
    }

    // 4. Nếu CHƯA CÓ snapshot: Gọi Open-Meteo lấy dự báo chính xác theo DẢI NGÀY ĐI (startAt -> endAt)
    let freshSnapshot: WeatherSnapshotRecord
    try {
      const openMeteoData = await this.openMeteoClient.fetchForecastForDateRange(
        trip.latitude,
        trip.longitude,
        trip.startAt,
        trip.endAt,
      )

      const wmo = mapWmoCode(openMeteoData.weatherCode)
      const risk = evaluateWeatherRisk({
        weatherCode: openMeteoData.weatherCode,
        windSpeedMps: openMeteoData.windSpeedMps,
        windGustMps: openMeteoData.windGustMps,
        precipitationMm: openMeteoData.precipitationMm,
        rainProbabilityPercent: openMeteoData.rainProbabilityPercent,
        temperatureC: openMeteoData.temperatureC,
      })

      // Lưu bản ghi snapshot mới vào cơ sở dữ liệu
      freshSnapshot = await this.weatherPort.createSnapshot({
        tripId: trip.id,
        latitude: trip.latitude,
        longitude: trip.longitude,
        provider: 'OPEN_METEO',
        temperatureC: openMeteoData.temperatureC,
        apparentTemperatureC: openMeteoData.apparentTemperatureC,
        humidityPercent: openMeteoData.humidityPercent,
        windSpeedMps: openMeteoData.windSpeedMps,
        windGustMps: openMeteoData.windGustMps,
        precipitationMm: openMeteoData.precipitationMm,
        rainProbabilityPercent: openMeteoData.rainProbabilityPercent,
        weatherCode: openMeteoData.weatherCode,
        weatherCondition: wmo.descriptionVi,
        riskLevel: risk.riskLevel,
        riskSummary: risk.riskSummary,
        forecastData: {
          daily: openMeteoData.rawDaily,
        },
        observedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Hạn dùng 1 giờ
      })
    } catch (error: any) {
      // Cơ chế an toàn (RC-BR-11): Nếu lỗi Open-Meteo mà chưa có dữ liệu, trả về trạng thái UNKNOWN an toàn
      freshSnapshot = await this.weatherPort.createSnapshot({
        tripId: trip.id,
        latitude: trip.latitude,
        longitude: trip.longitude,
        provider: 'OPEN_METEO',
        temperatureC: null,
        apparentTemperatureC: null,
        humidityPercent: null,
        windSpeedMps: null,
        windGustMps: null,
        precipitationMm: null,
        rainProbabilityPercent: null,
        weatherCode: null,
        weatherCondition: 'Chưa có dữ liệu trạm khí tượng',
        riskLevel: 'UNKNOWN',
        riskSummary: 'Không thể kết nối đến nhà cung cấp thời tiết tại thời điểm hiện tại.',
        forecastData: null,
        observedAt: new Date(),
        expiresAt: null,
      })
    }

    return this.buildResponse(
      trip.destinationName,
      startDateStr,
      endDateStr,
      durationDays,
      freshSnapshot,
      false,
    )
  }

  private buildResponse(
    destinationName: string,
    startDate: string,
    endDate: string,
    durationDays: number,
    snapshot: WeatherSnapshotRecord,
    isFromCache: boolean,
  ): TripWeatherResponseDto {
    const forecastDays: WeatherDaySummaryDto[] = []

    // Trích xuất dự báo từng ngày từ JSON forecastData
    const daily = snapshot.forecastData?.daily
    if (daily && Array.isArray(daily.time)) {
      for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i]
        // Chỉ lấy các ngày nằm trong khoảng chuyến đi nếu có nhiều ngày trong payload
        if (daily.time.length > 1 && (dateStr < startDate || dateStr > endDate)) {
          continue
        }

        const code = daily.weather_code?.[i] ?? null
        const wmo = mapWmoCode(code)
        forecastDays.push({
          date: dateStr,
          weatherCode: code,
          condition: wmo.descriptionVi,
          temperatureMaxC: daily.temperature_2m_max?.[i] ?? null,
          temperatureMinC: daily.temperature_2m_min?.[i] ?? null,
          precipitationSumMm: daily.precipitation_sum?.[i] ?? null,
          rainProbabilityPercent: daily.precipitation_probability_max?.[i] ?? null,
          windSpeedMaxMps: daily.wind_speed_10m_max?.[i] ?? null,
          windGustMaxMps: daily.wind_gusts_10m_max?.[i] ?? null,
        })
      }
    }

    return {
      tripId: snapshot.tripId || '',
      destinationName,
      startDate,
      endDate,
      targetTripDate: startDate === endDate ? startDate : `${startDate} -> ${endDate}`,
      durationDays,
      isFromCache,
      snapshot: {
        id: snapshot.id,
        provider: snapshot.provider,
        observedAt: snapshot.observedAt.toISOString(),
        temperatureC: snapshot.temperatureC,
        apparentTemperatureC: snapshot.apparentTemperatureC,
        humidityPercent: snapshot.humidityPercent,
        windSpeedMps: snapshot.windSpeedMps,
        windGustMps: snapshot.windGustMps,
        precipitationMm: snapshot.precipitationMm,
        rainProbabilityPercent: snapshot.rainProbabilityPercent,
        weatherCode: snapshot.weatherCode,
        weatherCondition: snapshot.weatherCondition,
        riskLevel: snapshot.riskLevel,
        riskSummary: snapshot.riskSummary,
      },
      forecast: forecastDays,
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}
