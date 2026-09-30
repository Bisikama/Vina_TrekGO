import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import {
  ISystemTrailRepository,
  SystemTrailSummary,
  SystemTrailDetail,
  CheckpointDetail,
} from '../../application/ports/system-trail.port'

@Injectable()
export class PrismaSystemTrailAdapter implements ISystemTrailRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(destinationId?: string): Promise<SystemTrailSummary[]> {
    const trails = await this.prisma.systemTrail.findMany({
      where: {
        status: 'ACTIVE',
        ...(destinationId ? { destinationId } : {}),
      },
      include: {
        destination: true,
        _count: {
          select: { trailCheckpointsViaSystemTrailId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return trails.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      difficulty: t.difficulty,
      distanceKm: Number(t.distanceKm),
      elevationGainM: t.elevationGainM,
      estimatedDurationMinutes: t.estimatedDurationMinutes,
      destination: {
        id: t.destination.id,
        name: t.destination.name,
        region: t.destination.region,
        centerLat: t.destination.centerLat ? Number(t.destination.centerLat) : null,
        centerLng: t.destination.centerLng ? Number(t.destination.centerLng) : null,
      },
      checkpointCount: t._count.trailCheckpointsViaSystemTrailId,
    }))
  }

  async findByIdOrCode(idOrCode: string): Promise<SystemTrailDetail | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode)

    const trail = await this.prisma.systemTrail.findFirst({
      where: {
        ...(isUuid ? { id: idOrCode } : { code: idOrCode }),
        status: 'ACTIVE',
      },
      include: {
        destination: true,
        trailCheckpointsViaSystemTrailId: {
          include: {
            checkpoint: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    })

    if (!trail) return null

    const checkpoints: CheckpointDetail[] = trail.trailCheckpointsViaSystemTrailId.map((tc) => ({
      id: tc.checkpoint.id,
      code: tc.checkpoint.code,
      name: tc.checkpoint.name,
      description: tc.checkpoint.description,
      sequence: tc.sequence,
      isRequired: tc.isRequired,
      latitude: Number(tc.checkpoint.latitude),
      longitude: Number(tc.checkpoint.longitude),
      radiusMeters: tc.checkpoint.defaultRadiusMeters,
    }))

    const bounds = this.extractBounds(trail.routeGeojson)
    const initialCamera = bounds
      ? {
          center: [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2] as [number, number],
          zoom: 13.5,
          pitch: 60,
          bearing: -20,
        }
      : null

    return {
      id: trail.id,
      code: trail.code,
      name: trail.name,
      description: trail.description,
      difficulty: trail.difficulty,
      distanceKm: Number(trail.distanceKm),
      elevationGainM: trail.elevationGainM,
      estimatedDurationMinutes: trail.estimatedDurationMinutes,
      destination: {
        id: trail.destination.id,
        name: trail.destination.name,
        region: trail.destination.region,
        centerLat: trail.destination.centerLat ? Number(trail.destination.centerLat) : null,
        centerLng: trail.destination.centerLng ? Number(trail.destination.centerLng) : null,
      },
      checkpointCount: checkpoints.length,
      routeGeojson: trail.routeGeojson,
      checkpoints,
      bounds,
      initialCamera,
    }
  }

  private extractBounds(geojson: any): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
    if (!geojson) return null

    const coords: number[][] = []

    const parseCoordinates = (geom: any) => {
      if (!geom) return
      if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
        coords.push(...geom.coordinates)
      } else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
        geom.coordinates.forEach((line: any) => {
          if (Array.isArray(line)) coords.push(...line)
        })
      } else if (geom.type === 'FeatureCollection' && Array.isArray(geom.features)) {
        geom.features.forEach((f: any) => parseCoordinates(f.geometry))
      } else if (geom.type === 'Feature' && geom.geometry) {
        parseCoordinates(geom.geometry)
      }
    }

    parseCoordinates(geojson)

    if (coords.length === 0) return null

    let minLng = Infinity
    let maxLng = -Infinity
    let minLat = Infinity
    let maxLat = -Infinity

    for (const [lng, lat] of coords) {
      if (lng !== undefined && lat !== undefined) {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }

    if (minLng === Infinity) return null

    return { minLng, minLat, maxLng, maxLat }
  }
}