import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RecordStatus } from '@prisma/client'
import {
  ISystemTrailRepository,
  SystemTrailSummary,
  SystemTrailDetail,
  CheckpointDetail,
  CreateSystemTrailData,
  UpdateSystemTrailData,
  GetSystemTrailsFilter,
  PaginatedResult,
  SystemTrailRelatedCounts,
} from '../../application/ports/system-trail.port'

@Injectable()
export class PrismaSystemTrailAdapter implements ISystemTrailRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter?: GetSystemTrailsFilter): Promise<PaginatedResult<SystemTrailSummary>> {
    const page = filter?.page ?? 1
    const pageSize = filter?.pageSize ?? 20
    const skip = (page - 1) * pageSize

    const where: any = {
      status: filter?.status ?? RecordStatus.ACTIVE,
    }

    if (filter?.destinationId) {
      where.destinationId = filter.destinationId
    }

    if (filter?.difficulty) {
      where.difficulty = filter.difficulty
    }

    if (filter?.keyword) {
      where.OR = [
        { name: { contains: filter.keyword, mode: 'insensitive' } },
        { code: { contains: filter.keyword, mode: 'insensitive' } },
        { description: { contains: filter.keyword, mode: 'insensitive' } },
      ]
    }

    if (filter?.minDistance !== undefined || filter?.maxDistance !== undefined) {
      where.distanceKm = {}
      if (filter.minDistance !== undefined) where.distanceKm.gte = filter.minDistance
      if (filter.maxDistance !== undefined) where.distanceKm.lte = filter.maxDistance
    }

    const [total, trails] = await Promise.all([
      this.prisma.systemTrail.count({ where }),
      this.prisma.systemTrail.findMany({
        where,
        include: {
          destination: true,
          _count: {
            select: { trailCheckpointsViaSystemTrailId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ])

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    return {
      items: trails.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        difficulty: t.difficulty,
        distanceKm: Number(t.distanceKm),
        elevationGainM: t.elevationGainM,
        estimatedDurationMinutes: t.estimatedDurationMinutes,
        price: Number(t.price),
        status: t.status,
        destination: {
          id: t.destination.id,
          name: t.destination.name,
          region: t.destination.region,
          centerLat: t.destination.centerLat ? Number(t.destination.centerLat) : null,
          centerLng: t.destination.centerLng ? Number(t.destination.centerLng) : null,
        },
        checkpointCount: t._count.trailCheckpointsViaSystemTrailId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages,
      },
    }
  }

  async findByIdOrCode(idOrCode: string): Promise<SystemTrailDetail | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode)

    const trail = await this.prisma.systemTrail.findFirst({
      where: {
        ...(isUuid ? { id: idOrCode } : { code: idOrCode }),
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
      price: Number(trail.price),
      status: trail.status,
      version: trail.version,
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
      createdAt: trail.createdAt,
      updatedAt: trail.updatedAt,
    }
  }

  async findByCode(code: string): Promise<SystemTrailSummary | null> {
    const t = await this.prisma.systemTrail.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        destination: true,
        _count: {
          select: { trailCheckpointsViaSystemTrailId: true },
        },
      },
    })

    if (!t) return null

    return {
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      difficulty: t.difficulty,
      distanceKm: Number(t.distanceKm),
      elevationGainM: t.elevationGainM,
      estimatedDurationMinutes: t.estimatedDurationMinutes,
      price: Number(t.price),
      status: t.status,
      destination: {
        id: t.destination.id,
        name: t.destination.name,
        region: t.destination.region,
        centerLat: t.destination.centerLat ? Number(t.destination.centerLat) : null,
        centerLng: t.destination.centerLng ? Number(t.destination.centerLng) : null,
      },
      checkpointCount: t._count.trailCheckpointsViaSystemTrailId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }
  }

  async validateDestination(destinationId: string): Promise<boolean> {
    const d = await this.prisma.destination.findUnique({
      where: { id: destinationId, status: RecordStatus.ACTIVE },
    })
    return !!d
  }

  async validateCheckpoints(destinationId: string, checkpointIds: string[]): Promise<boolean> {
    if (checkpointIds.length === 0) return true
    const uniqueIds = Array.from(new Set(checkpointIds))
    const count = await this.prisma.checkpoint.count({
      where: {
        id: { in: uniqueIds },
        destinationId,
        status: RecordStatus.ACTIVE,
      },
    })
    return count === uniqueIds.length
  }

  async create(data: CreateSystemTrailData): Promise<SystemTrailDetail> {
    const created = await this.prisma.$transaction(async (tx) => {
      const trail = await tx.systemTrail.create({
        data: {
          destinationId: data.destinationId,
          code: data.code.trim().toUpperCase(),
          name: data.name.trim(),
          description: data.description,
          difficulty: data.difficulty,
          distanceKm: data.distanceKm,
          elevationGainM: data.elevationGainM,
          estimatedDurationMinutes: data.estimatedDurationMinutes,
          price: data.price ?? 0,
          routeGeojson: data.routeGeojson,
          status: data.status ?? RecordStatus.ACTIVE,
          createdBy: data.createdBy,
          version: 1,
        },
      })

      if (data.checkpoints && data.checkpoints.length > 0) {
        await tx.trailCheckpoint.createMany({
          data: data.checkpoints.map((cp) => ({
            systemTrailId: trail.id,
            checkpointId: cp.checkpointId,
            sequence: cp.sequence,
            isRequired: cp.isRequired ?? false,
          })),
        })
      }

      return trail
    })

    const detail = await this.findByIdOrCode(created.id)
    return detail!
  }

  async update(id: string, data: UpdateSystemTrailData): Promise<SystemTrailDetail> {
    const isRouteOrCheckpointsChanged = data.routeGeojson !== undefined || data.checkpoints !== undefined

    await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        ...(data.destinationId !== undefined ? { destinationId: data.destinationId } : {}),
        ...(data.code !== undefined ? { code: data.code.trim().toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
        ...(data.distanceKm !== undefined ? { distanceKm: data.distanceKm } : {}),
        ...(data.elevationGainM !== undefined ? { elevationGainM: data.elevationGainM } : {}),
        ...(data.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: data.estimatedDurationMinutes } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.routeGeojson !== undefined ? { routeGeojson: data.routeGeojson } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      }

      if (isRouteOrCheckpointsChanged) {
        updateData.version = { increment: 1 }
      }

      await tx.systemTrail.update({
        where: { id },
        data: updateData,
      })

      if (data.checkpoints !== undefined) {
        await tx.trailCheckpoint.deleteMany({
          where: { systemTrailId: id },
        })

        if (data.checkpoints.length > 0) {
          await tx.trailCheckpoint.createMany({
            data: data.checkpoints.map((cp) => ({
              systemTrailId: id,
              checkpointId: cp.checkpointId,
              sequence: cp.sequence,
              isRequired: cp.isRequired ?? false,
            })),
          })
        }
      }
    })

    const updated = await this.findByIdOrCode(id)
    return updated!
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.systemTrail.update({
      where: { id },
      data: {
        status: RecordStatus.INACTIVE,
        archivedAt: new Date(),
      },
    })
  }

  async countRelated(id: string): Promise<SystemTrailRelatedCounts> {
    const counts = await this.prisma.systemTrail.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            trailAccesssViaSystemTrailId: true,
            tripTrailPlansViaSystemTrailId: true,
          },
        },
      },
    })

    return {
      accesses: counts?._count.trailAccesssViaSystemTrailId ?? 0,
      trips: counts?._count.tripTrailPlansViaSystemTrailId ?? 0,
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
