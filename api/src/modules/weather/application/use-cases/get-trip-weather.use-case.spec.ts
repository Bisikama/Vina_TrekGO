import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { WeatherRiskLevel } from '@prisma/client'
import { GetTripWeatherUseCase } from './get-trip-weather.use-case'
import { WeatherPort, WeatherSnapshotRecord, TripWeatherContext } from '../ports/weather.port'
import { OpenMeteoClient } from '../../infrastructure/external/open-meteo.client'

describe('GetTripWeatherUseCase', () => {
  let useCase: GetTripWeatherUseCase
  let weatherPortMock: jest.Mocked<WeatherPort>
  let openMeteoClientMock: jest.Mocked<OpenMeteoClient>

  const mockTripContext: TripWeatherContext = {
    id: 'd3b07384-d113-494d-9c32-b7b5f54316d2',
    title: 'Chinh phục Fansipan',
    startAt: new Date('2026-10-25T07:00:00Z'),
    endAt: new Date('2026-10-26T10:00:00Z'), // 2 ngày 1 đêm (17:00 UTC+7 ngày 26/10)
    destinationId: 'dest-1',
    destinationName: 'Vườn quốc gia Hoàng Liên',
    latitude: 22.3038,
    longitude: 103.7752,
    creatorId: 'user-creator',
    leaderId: 'user-leader',
    memberUserIds: ['user-member-1'],
    bookingUserIds: ['user-booking-1'],
  }

  const mockSnapshot: WeatherSnapshotRecord = {
    id: 'snap-1',
    tripId: mockTripContext.id,
    tripCheckpointId: null,
    latitude: 22.3038,
    longitude: 103.7752,
    provider: 'OPEN_METEO',
    temperatureC: 18.5,
    apparentTemperatureC: 16.2,
    humidityPercent: 78,
    windSpeedMps: 6.5,
    windGustMps: 11.2,
    precipitationMm: 2.5,
    rainProbabilityPercent: 45,
    weatherCode: 61,
    weatherCondition: 'Mưa nhẹ',
    riskLevel: WeatherRiskLevel.MEDIUM,
    riskSummary: 'Có khả năng mưa (mưa nhẹ), cần chuẩn bị áo mưa.',
    forecastData: {
      daily: {
        time: ['2026-10-25', '2026-10-26'],
        weather_code: [61, 0],
        temperature_2m_max: [22, 24],
        temperature_2m_min: [15, 16],
        precipitation_sum: [2.5, 0],
        precipitation_probability_max: [45, 10],
        wind_speed_10m_max: [6.5, 4.0],
        wind_gusts_10m_max: [11.2, 7.0],
      },
    },
    observedAt: new Date('2026-10-13T10:00:00Z'),
    expiresAt: new Date('2026-10-13T11:00:00Z'),
    createdAt: new Date('2026-10-13T10:00:00Z'),
  }

  beforeEach(() => {
    weatherPortMock = {
      findTripContext: jest.fn(),
      findLatestByTripId: jest.fn(),
      createSnapshot: jest.fn(),
    } as any

    openMeteoClientMock = {
      fetchForecastForDate: jest.fn(),
      fetchForecastForDateRange: jest.fn(),
    } as any

    useCase = new GetTripWeatherUseCase(weatherPortMock, openMeteoClientMock)
  })

  it('nên ném NotFoundException nếu chuyến đi không tồn tại', async () => {
    weatherPortMock.findTripContext.mockResolvedValue(null)

    await expect(useCase.execute('invalid-id', 'user-1', 'USER')).rejects.toThrow(
      NotFoundException,
    )
  })

  it('nên ném ForbiddenException nếu user không có quyền truy cập vào chuyến đi', async () => {
    weatherPortMock.findTripContext.mockResolvedValue(mockTripContext)

    await expect(useCase.execute(mockTripContext.id, 'stranger-user', 'USER')).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('QUY TẮC 1: Nếu chuyến đi ĐÃ CÓ snapshot trong DB -> Lấy ngay từ DB, KHÔNG ĐƯỢC gọi Open-Meteo', async () => {
    weatherPortMock.findTripContext.mockResolvedValue(mockTripContext)
    weatherPortMock.findLatestByTripId.mockResolvedValue(mockSnapshot)

    const result = await useCase.execute(mockTripContext.id, 'user-member-1', 'USER')

    expect(result.isFromCache).toBe(true)
    expect(result.snapshot.id).toBe('snap-1')
    expect(result.startDate).toBe('2026-10-25')
    expect(result.endDate).toBe('2026-10-26')
    expect(result.durationDays).toBe(2)
    expect(result.forecast).toHaveLength(2)
    expect(result.forecast[0].date).toBe('2026-10-25')
    expect(result.forecast[1].date).toBe('2026-10-26')

    // Tuyệt đối không gọi Open-Meteo
    expect(openMeteoClientMock.fetchForecastForDateRange).not.toHaveBeenCalled()
  })

  it('QUY TẮC 2: Nếu CHƯA CÓ snapshot -> Gọi Open-Meteo dải ngày (startAt -> endAt), lưu DB và trả về đủ các ngày', async () => {
    weatherPortMock.findTripContext.mockResolvedValue(mockTripContext)
    weatherPortMock.findLatestByTripId.mockResolvedValue(null) // Chưa có snapshot

    openMeteoClientMock.fetchForecastForDateRange.mockResolvedValue({
      startDate: '2026-10-25',
      endDate: '2026-10-26',
      temperatureC: 19.0,
      apparentTemperatureC: 17.0,
      humidityPercent: 80,
      windSpeedMps: 8.0,
      windGustMps: 16.0,
      precipitationMm: 18.0,
      rainProbabilityPercent: 80,
      weatherCode: 65,
      rawDaily: {
        time: ['2026-10-25', '2026-10-26'],
        weather_code: [65, 0],
        temperature_2m_max: [20, 24],
        temperature_2m_min: [14, 16],
        precipitation_sum: [18.0, 0],
        precipitation_probability_max: [80, 10],
        wind_speed_10m_max: [8.0, 4.0],
        wind_gusts_10m_max: [16.0, 6.0],
      },
    })

    const createdRecord: WeatherSnapshotRecord = {
      ...mockSnapshot,
      id: 'snap-created-new',
      temperatureC: 19.0,
      weatherCode: 65,
      weatherCondition: 'Mưa to',
      riskLevel: WeatherRiskLevel.HIGH,
      riskSummary: 'Gió mạnh trên các đỉnh/sống lưng núi. Mưa to (18mm), đường trơn trượt nguy hiểm.',
      forecastData: {
        daily: {
          time: ['2026-10-25', '2026-10-26'],
          weather_code: [65, 0],
          temperature_2m_max: [20, 24],
          temperature_2m_min: [14, 16],
          precipitation_sum: [18.0, 0],
          precipitation_probability_max: [80, 10],
          wind_speed_10m_max: [8.0, 4.0],
          wind_gusts_10m_max: [16.0, 6.0],
        },
      },
    }
    weatherPortMock.createSnapshot.mockResolvedValue(createdRecord)

    const result = await useCase.execute(mockTripContext.id, 'user-leader', 'LEADER')

    // Xác nhận gọi Open-Meteo đúng dải ngày startAt và endAt
    expect(openMeteoClientMock.fetchForecastForDateRange).toHaveBeenCalledWith(
      22.3038,
      103.7752,
      mockTripContext.startAt,
      mockTripContext.endAt,
    )

    // Xác nhận đã lưu snapshot vào DB và trả về kết quả
    expect(weatherPortMock.createSnapshot).toHaveBeenCalledTimes(1)
    expect(result.isFromCache).toBe(false)
    expect(result.durationDays).toBe(2)
    expect(result.forecast).toHaveLength(2)
    expect(result.forecast[0].date).toBe('2026-10-25')
    expect(result.forecast[1].date).toBe('2026-10-26')
  })
})
