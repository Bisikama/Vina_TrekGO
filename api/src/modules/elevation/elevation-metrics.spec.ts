import {
  calculateGainLoss,
  calculateHaversineDistanceM,
  computeMetricsAcrossSegments,
} from './application/ports/elevation-provider.port'

describe('Elevation Metrics & Domain Calculations', () => {
  describe('calculateHaversineDistanceM', () => {
    it('calculates distance between two known coordinates accurately', () => {
      // Hanoi to Da Nang approx 600km
      const p1 = { latitude: 21.0285, longitude: 105.8542 }
      const p2 = { latitude: 16.0544, longitude: 108.2022 }
      const distance = calculateHaversineDistanceM(p1, p2)
      expect(distance).toBeGreaterThan(600_000)
      expect(distance).toBeLessThan(650_000)
    })

    it('returns 0 when coordinates are identical', () => {
      const p = { latitude: 11.58312, longitude: 108.52904 }
      expect(calculateHaversineDistanceM(p, p)).toBe(0)
    })
  })

  describe('calculateGainLoss with Hysteresis (threshold = 5m)', () => {
    it('ignores fluctuations smaller than threshold', () => {
      // Points fluctuating by 2m should not accumulate gain/loss
      const elevations = [100, 102, 101, 103, 101, 100]
      const { gainM, lossM } = calculateGainLoss(elevations, 5)
      expect(gainM).toBe(0)
      expect(lossM).toBe(0)
    })

    it('accumulates continuous ascent correctly', () => {
      // 100 -> 110 (+10) -> 125 (+15)
      const elevations = [100, 110, 125]
      const { gainM, lossM } = calculateGainLoss(elevations, 5)
      expect(gainM).toBe(25)
      expect(lossM).toBe(0)
    })

    it('accumulates ascent and descent properly with hysteresis', () => {
      // 100 -> 120 (+20) -> 118 (ignored) -> 100 (-20)
      const elevations = [100, 120, 118, 100]
      const { gainM, lossM } = calculateGainLoss(elevations, 5)
      expect(gainM).toBe(20)
      expect(lossM).toBe(20)
    })

    it('handles null and non-finite values safely by resetting anchor across gaps', () => {
      // 100 -> null (resets anchor) -> 115 (new anchor) -> 95 (-20 loss)
      const elevations = [100, null, NaN, 115, 95]
      const { gainM, lossM } = calculateGainLoss(elevations, 5)
      expect(gainM).toBe(0)
      expect(lossM).toBe(20)
    })
  })

  describe('computeMetricsAcrossSegments', () => {
    it('computes metrics across multiple segments without jumping distance between segments', () => {
      const segments = [
        {
          points: [
            { latitude: 11.58312, longitude: 108.52904, elevationM: 1400 },
            { latitude: 11.58350, longitude: 108.52950, elevationM: 1420 },
          ],
        },
        {
          points: [
            { latitude: 11.59000, longitude: 108.54000, elevationM: 1450 },
            { latitude: 11.59050, longitude: 108.54050, elevationM: 1470 },
          ],
        },
      ]

      const metrics = computeMetricsAcrossSegments(segments)
      expect(metrics.distanceKm).toBeGreaterThan(0)
      expect(metrics.elevationGainM).toBe(40)
      expect(metrics.minElevationM).toBe(1400)
      expect(metrics.maxElevationM).toBe(1470)
      expect(metrics.elevationProfile.length).toBe(4)
    })

    it('does not count ascent or descent during a paused gap', () => {
      const segment = (elevations: number[]) => ({
        points: elevations.map((elevationM, index) => ({ latitude: 11 + index * 0.001, longitude: 108, elevationM })),
      })
      expect(computeMetricsAcrossSegments([segment([100, 110]), segment([500, 510])]).elevationGainM).toBe(20)
      expect(computeMetricsAcrossSegments([segment([500, 490]), segment([100, 90])]).elevationLossM).toBe(20)
    })
  })
})
