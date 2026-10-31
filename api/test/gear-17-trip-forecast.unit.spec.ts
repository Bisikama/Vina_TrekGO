import { OpenMeteoTripForecastAdapter } from '../src/modules/gear/infrastructure/adapters/open-meteo-trip-forecast.adapter'
import {
  resolveClimateDestination,
  resolveTripCoordinates,
} from '../src/modules/gear/infrastructure/adapters/prisma-trip-context-read.adapter'
import { GearPlanService } from '../src/modules/gear/application/services/gear-plan.service'

const NOW = new Date('2026-11-01T03:00:00Z') // 10:00 giờ Việt Nam
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000)

function rawDaily() {
  return {
    time: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
    temperature_2m_min: [14, 9.6, 11, 12, 3],
    temperature_2m_max: [24, 21, 25.4, 22, 30],
    apparent_temperature_min: [13, 7.2, 10, 11, 1],
    precipitation_probability_max: [10, 70, 40, 20, 99],
  }
}

function makeAdapter(impl: jest.Mock) {
  const adapter = new OpenMeteoTripForecastAdapter({ fetchForecastForDateRange: impl } as any)
  adapter.now = () => NOW
  return adapter
}

describe('Gear — dự báo thời tiết cho gợi ý khí hậu', () => {
  describe('OpenMeteoTripForecastAdapter', () => {
    it('tính min/max/mưa chỉ trên các ngày của chuyến', async () => {
      const fetch = jest.fn(async () => ({ rawDaily: rawDaily() }))
      const adapter = makeAdapter(fetch)

      // Chuyến 02/11 → 04/11 (giờ VN): bỏ ngày 01 và 05.
      const res = await adapter.getForecastClimate({ lat: 11.9, lng: 108.4, startAt: day(1), endAt: day(3) })

      expect(fetch).toHaveBeenCalledWith(11.9, 108.4, day(1), day(3))
      expect(res).toMatchObject({
        temp_min_c: 10, // round(9.6)
        temp_max_c: 25, // round(25.4)
        temp_min_night_c: 7, // cảm nhận thấp nhất 7.2
        rain_prob_pct: 70,
        source: 'FORECAST',
        provider: 'open-meteo',
        forecastFrom: '2026-11-02',
        forecastTo: '2026-11-04',
      })
    })

    it('ngoài tầm 16 ngày → null, không gọi nhà cung cấp', async () => {
      const fetch = jest.fn()
      const res = await makeAdapter(fetch).getForecastClimate({ lat: 1, lng: 1, startAt: day(15), endAt: day(18) })

      expect(res).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('chuyến đã kết thúc → null', async () => {
      const fetch = jest.fn()
      expect(
        await makeAdapter(fetch).getForecastClimate({ lat: 1, lng: 1, startAt: day(-3), endAt: day(-1) }),
      ).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('chuyến đang diễn ra → chỉ dự báo phần còn lại (từ hôm nay)', async () => {
      const fetch = jest.fn(async () => ({ rawDaily: rawDaily() }))
      const res = await makeAdapter(fetch).getForecastClimate({ lat: 1, lng: 1, startAt: day(-2), endAt: day(1) })

      expect(fetch).toHaveBeenCalledWith(1, 1, NOW, day(1))
      expect(res).toMatchObject({ forecastFrom: '2026-11-01', forecastTo: '2026-11-02', temp_min_c: 10 })
    })

    it('nhà cung cấp lỗi hoặc không có ngày khớp → null, không ném lỗi', async () => {
      const failing = jest.fn(async () => {
        throw new Error('Open-Meteo HTTP 500')
      })
      expect(
        await makeAdapter(failing).getForecastClimate({ lat: 1, lng: 1, startAt: day(1), endAt: day(2) }),
      ).toBeNull()

      const noMatch = jest.fn(async () => ({ rawDaily: { ...rawDaily(), time: ['2030-01-01'] } }))
      expect(
        await makeAdapter(noMatch).getForecastClimate({ lat: 1, lng: 1, startAt: day(1), endAt: day(2) }),
      ).toBeNull()
    })
  })

  describe('Chuẩn hoá điểm đến và toạ độ', () => {
    it('nhận tên gọi khác của Fansipan / Tà Năng; không có tên thì không còn rơi về bidoup', () => {
      expect(resolveClimateDestination('Chinh phục Phan Xi Păng 2 ngày')).toBe('fansipan')
      expect(resolveClimateDestination('Trek Tà Năng - Phan Dũng')).toBe('ta nang')
      expect(resolveClimateDestination('Núi Chứa Chan')).toBe('núi chứa chan')
      expect(resolveClimateDestination('')).toBeUndefined()
      expect(resolveClimateDestination(undefined)).toBeUndefined()
    })

    it('toạ độ: tâm điểm đến, nếu thiếu thì checkpoint đầu tiên, không có thì null', () => {
      expect(resolveTripCoordinates({ destination: { centerLat: '11.9', centerLng: '108.4' } })).toEqual({
        lat: 11.9,
        lng: 108.4,
      })
      expect(
        resolveTripCoordinates({
          destination: { centerLat: null, centerLng: null },
          tripCheckpointsViaTripId: [{ latitude: '22.3', longitude: '103.77' }],
        }),
      ).toEqual({ lat: 22.3, lng: 103.77 })
      expect(resolveTripCoordinates({ destination: null, tripCheckpointsViaTripId: [] })).toBeNull()
    })
  })

  describe('GearPlanService.getTripPrefill', () => {
    const baseFacts = {
      tripId: 'trip-1',
      status: 'UPCOMING',
      startAt: day(2),
      endAt: day(3),
      days: 2,
      difficulty: 3,
      terrain: ['forest'],
      contextVersion: 'ctx-1',
    }
    const forecast = {
      temp_min_c: 10,
      temp_max_c: 25,
      temp_min_night_c: 7,
      rain_prob_pct: 70,
      source: 'FORECAST' as const,
      provider: 'open-meteo',
      forecastFrom: '2026-11-03',
      forecastTo: '2026-11-04',
      fetchedAt: NOW.toISOString(),
    }

    function makeService(facts: Record<string, unknown>, forecastPort: any) {
      const tripPort = { getTripContext: jest.fn(async () => facts) }
      // Tham số theo thứ tự constructor; các port không dùng tới để trống.
      return new GearPlanService(
        {} as any,
        {} as any,
        {} as any,
        tripPort as any,
        {} as any,
        undefined,
        undefined,
        undefined,
        undefined,
        forecastPort,
      )
    }

    it('có bảng ước tính và có dự báo → gợi ý chính theo bảng ước tính, kèm forecastClimate', async () => {
      const forecastPort = { getForecastClimate: jest.fn(async () => forecast) }
      const service = makeService(
        { ...baseFacts, destination: 'bidoup', coordinates: { lat: 12.1, lng: 108.6 } },
        forecastPort,
      )

      const res: any = await service.getTripPrefill('trip-1', 'user-1')

      expect(res.suggestedClimate.source).toBe('CLIMATE_ESTIMATE')
      expect(res.forecastClimate).toMatchObject({ source: 'FORECAST', temp_min_c: 10, noteVi: expect.any(String) })
      expect(forecastPort.getForecastClimate).toHaveBeenCalledWith({
        lat: 12.1,
        lng: 108.6,
        startAt: day(2),
        endAt: day(3),
      })
    })

    it('không có bảng ước tính → dự báo thành gợi ý chính (source FORECAST) và vẫn tính requirements', async () => {
      const forecastPort = { getForecastClimate: jest.fn(async () => forecast) }
      const service = makeService(
        { ...baseFacts, destination: 'núi chứa chan', coordinates: { lat: 10.9, lng: 107.4 } },
        forecastPort,
      )

      const res: any = await service.getTripPrefill('trip-1', 'user-1')

      expect(res.suggestedClimate).toMatchObject({ source: 'FORECAST', temp_min_night_c: 7 })
      expect(res.requirements.length).toBeGreaterThan(0)
    })

    it('không có toạ độ → không gọi dự báo', async () => {
      const forecastPort = { getForecastClimate: jest.fn() }
      const service = makeService({ ...baseFacts, destination: 'núi chứa chan', coordinates: null }, forecastPort)

      const res: any = await service.getTripPrefill('trip-1', 'user-1')

      expect(forecastPort.getForecastClimate).not.toHaveBeenCalled()
      expect(res.suggestedClimate).toBeNull()
      expect(res.forecastClimate).toBeNull()
    })
  })
})
