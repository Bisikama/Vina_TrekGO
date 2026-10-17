import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  computeMetricsAcrossSegments,
  I_ELEVATION_PROVIDER,
  LatLng,
  ProcessedRouteResult,
} from '../ports/elevation-provider.port'
import type { IElevationProvider } from '../ports/elevation-provider.port'
import { AppError } from '../../../../shared/errors/app-error'
import { PersonalTrailErrorCode } from '../../../../shared/errors/codes/personal-trail.error-codes'

export interface InputPoint extends LatLng {
  segmentId?: number
  recordedAt?: Date | string
}

@Injectable()
export class ProcessTrailElevationUseCase {
  private readonly logger = new Logger(ProcessTrailElevationUseCase.name)

  constructor(
    @Inject(I_ELEVATION_PROVIDER)
    private readonly elevationProvider: IElevationProvider,
  ) {}

  async execute(inputPoints: InputPoint[]): Promise<ProcessedRouteResult> {
    if (!inputPoints || inputPoints.length < 2) {
      throw new AppError({
        code: PersonalTrailErrorCode.INSUFFICIENT_GPS_POINTS,
        message: 'Cung đường cần tối thiểu 2 điểm GPS hợp lệ để xử lý',
      })
    }

    // 1. Group points by segmentId
    const segmentMap = new Map<number, InputPoint[]>()
    for (const pt of inputPoints) {
      const segId = pt.segmentId ?? 0
      if (!segmentMap.has(segId)) {
        segmentMap.set(segId, [])
      }
      segmentMap.get(segId)!.push(pt)
    }

    // 2. Validate segments (at least one segment must have >= 2 points)
    const validSegments: Array<{ segmentId: number; points: InputPoint[] }> = []
    for (const [segmentId, pts] of segmentMap.entries()) {
      if (pts.length >= 2) {
        validSegments.push({ segmentId, points: pts })
      }
    }

    if (validSegments.length === 0) {
      throw new AppError({
        code: PersonalTrailErrorCode.INSUFFICIENT_GPS_POINTS,
        message: 'Cần ít nhất một đoạn (segment) có từ 2 điểm GPS trở lên để dựng đường mòn',
      })
    }

    // 3. Flatten points to query DEM provider
    const allPointsToQuery = validSegments.flatMap((s) => s.points)
    let elevations: (number | null)[] = []

    try {
      elevations = await this.elevationProvider.getElevations(allPointsToQuery)
    } catch (err: any) {
      this.logger.warn(`Elevation provider failed: ${err.message}. Using fallback device altitudes.`)
      elevations = allPointsToQuery.map((p) => p.altitudeM ?? null)
    }

    // 4. Map back elevations into segments
    let elevIdx = 0
    const processedSegments = validSegments.map((seg) => {
      const pointsWithElev = seg.points.map((p) => {
        const elev = elevations[elevIdx++] ?? p.altitudeM ?? null
        return {
          ...p,
          elevationM: elev !== null ? Number(elev) : null,
        }
      })
      return { segmentId: seg.segmentId, points: pointsWithElev }
    })

    // 5. Build MultiLineString coordinates
    // MultiLineString: [ [ [lng, lat, elev], ... ], [ ... ] ]
    const multiLineCoordinates: number[][][] = processedSegments.map((seg) =>
      seg.points.map((p) => {
        const lng = Number(p.longitude)
        const lat = Number(p.latitude)
        if (p.elevationM !== null && Number.isFinite(p.elevationM)) {
          return [lng, lat, Math.round(p.elevationM)]
        }
        return [lng, lat]
      }),
    )

    // 6. Compute official telemetry metrics
    const metrics = computeMetricsAcrossSegments(processedSegments)

    return {
      processedGeojson: {
        type: 'MultiLineString',
        coordinates: multiLineCoordinates,
      },
      metrics,
    }
  }
}
