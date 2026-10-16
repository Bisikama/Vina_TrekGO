export interface LatLng {
  latitude: number
  longitude: number
  altitudeM?: number | null
}

export interface ElevationProfilePoint {
  distanceKm: number
  elevationM: number
}

export interface ElevationMetrics {
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  minElevationM: number
  maxElevationM: number
  elevationProfile: ElevationProfilePoint[]
}

export interface ProcessedRouteResult {
  processedGeojson: {
    type: 'MultiLineString'
    coordinates: number[][][] // [segmentIndex][pointIndex][lng, lat, elev]
  }
  metrics: ElevationMetrics
}

export const I_ELEVATION_PROVIDER = 'I_ELEVATION_PROVIDER'

export interface IElevationProvider {
  /**
   * Retrieves elevation in meters for a list of coordinates.
   * Returns null for coordinates where elevation cannot be fetched/decoded.
   */
  getElevations(points: LatLng[]): Promise<(number | null)[]>
}

const EARTH_RADIUS_METERS = 6371000

/**
 * Calculates great-circle distance between two points in meters using Haversine formula
 */
export function calculateHaversineDistanceM(p1: LatLng, p2: LatLng): number {
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180

  const lat1 = (p1.latitude * Math.PI) / 180
  const lat2 = (p2.latitude * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

/**
 * Calculates elevation gain and loss with a hysteresis threshold (default 5m)
 * to filter out high-frequency noise and GPS jitter.
 */
export function calculateGainLoss(
  elevations: Array<number | null>,
  thresholdM = 5,
): { gainM: number; lossM: number } {
  let anchor: number | null = null
  let gainM = 0
  let lossM = 0

  for (const elevation of elevations) {
    if (elevation === null || !Number.isFinite(elevation)) {
      anchor = null
      continue
    }

    if (anchor === null) {
      anchor = elevation
      continue
    }

    const delta = elevation - anchor

    if (delta >= thresholdM) {
      gainM += delta
      anchor = elevation
    } else if (delta <= -thresholdM) {
      lossM += -delta
      anchor = elevation
    }
  }

  return {
    gainM: Math.round(gainM),
    lossM: Math.round(lossM),
  }
}

/**
 * Computes complete elevation metrics across multiple segments
 */
export function computeMetricsAcrossSegments(
  segments: Array<{ points: Array<LatLng & { elevationM: number | null }> }>,
): ElevationMetrics {
  let totalDistanceM = 0
  const validElevations: number[] = []
  const profile: ElevationProfilePoint[] = []

  let lastPoint: (LatLng & { elevationM: number | null }) | null = null

  for (const segment of segments) {
    for (const point of segment.points) {
      if (lastPoint) {
        const d = calculateHaversineDistanceM(lastPoint, point)
        totalDistanceM += d
      }

      if (point.elevationM !== null && Number.isFinite(point.elevationM)) {
        validElevations.push(point.elevationM)
        profile.push({
          distanceKm: Number((totalDistanceM / 1000).toFixed(3)),
          elevationM: Math.round(point.elevationM),
        })
      }

      lastPoint = point
    }
    lastPoint = null
  }

  const allElevations = segments.flatMap((s) => s.points.map((p) => p.elevationM))
  const { gainM, lossM } = calculateGainLoss(allElevations, 5)

  const minElev = validElevations.length > 0 ? Math.min(...validElevations) : 0
  const maxElev = validElevations.length > 0 ? Math.max(...validElevations) : 0

  return {
    distanceKm: Number((totalDistanceM / 1000).toFixed(3)),
    elevationGainM: gainM,
    elevationLossM: lossM,
    minElevationM: Math.round(minElev),
    maxElevationM: Math.round(maxElev),
    elevationProfile: profile,
  }
}
