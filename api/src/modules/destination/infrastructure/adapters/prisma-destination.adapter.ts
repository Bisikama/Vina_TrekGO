import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RecordStatus } from '@prisma/client'
import {
  CreateDestinationData,
  UpdateDestinationData,
  DestinationRelatedCounts,
  DestinationPort,
  DestinationSummary,
  GetDestinationsFilter,
  PaginatedResult,
} from '../../application/ports/destination.port'

@Injectable()
export class PrismaDestinationAdapter implements DestinationPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter?: GetDestinationsFilter): Promise<PaginatedResult<DestinationSummary>> {
    const page = filter?.page ?? 1
    const pageSize = filter?.pageSize ?? 20
    const skip = (page - 1) * pageSize

    const where: any = {
      status: filter?.status ?? RecordStatus.ACTIVE,
    }

    if (filter?.region) {
      where.region = { equals: filter.region, mode: 'insensitive' }
    }

    if (filter?.keyword) {
      where.OR = [
        { name: { contains: filter.keyword, mode: 'insensitive' } },
        { description: { contains: filter.keyword, mode: 'insensitive' } },
      ]
    }

    const [total, items] = await Promise.all([
      this.prisma.destination.count({ where }),
      this.prisma.destination.findMany({
        where,
        include: {
          _count: {
            select: { systemTrailsViaDestinationId: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
    ])

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        region: item.region,
        centerLat: item.centerLat ? Number(item.centerLat) : null,
        centerLng: item.centerLng ? Number(item.centerLng) : null,
        status: item.status,
        trailCount: item._count.systemTrailsViaDestinationId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages,
      },
    }
  }

  async findById(id: string): Promise<DestinationSummary | null> {
    const item = await this.prisma.destination.findUnique({
      where: { id },
      include: {
        _count: {
          select: { systemTrailsViaDestinationId: true },
        },
      },
    })

    if (!item) return null

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      region: item.region,
      centerLat: item.centerLat ? Number(item.centerLat) : null,
      centerLng: item.centerLng ? Number(item.centerLng) : null,
      status: item.status,
      trailCount: item._count.systemTrailsViaDestinationId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }
    async findByName(name: string): Promise<DestinationSummary | null> {
    const item = await this.prisma.destination.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
      },
    })

    if (!item) return null

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      region: item.region,
      centerLat: item.centerLat ? Number(item.centerLat) : null,
      centerLng: item.centerLng ? Number(item.centerLng) : null,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }

  async create(data: CreateDestinationData): Promise<DestinationSummary> {
    const created = await this.prisma.destination.create({
      data: {
        name: data.name.trim(),
        description: data.description,
        region: data.region,
        centerLat: data.centerLat !== undefined && data.centerLat !== null ? data.centerLat : null,
        centerLng: data.centerLng !== undefined && data.centerLng !== null ? data.centerLng : null,
        status: data.status ?? RecordStatus.ACTIVE,
      },
    })

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      region: created.region,
      centerLat: created.centerLat ? Number(created.centerLat) : null,
      centerLng: created.centerLng ? Number(created.centerLng) : null,
      status: created.status,
      trailCount: 0,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    }
  }

  async update(id: string, data: UpdateDestinationData): Promise<DestinationSummary> {
    const updated = await this.prisma.destination.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.region !== undefined ? { region: data.region } : {}),
        ...(data.centerLat !== undefined ? { centerLat: data.centerLat } : {}),
        ...(data.centerLng !== undefined ? { centerLng: data.centerLng } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: {
        _count: {
          select: { systemTrailsViaDestinationId: true },
        },
      },
    })

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      region: updated.region,
      centerLat: updated.centerLat ? Number(updated.centerLat) : null,
      centerLng: updated.centerLng ? Number(updated.centerLng) : null,
      status: updated.status,
      trailCount: updated._count.systemTrailsViaDestinationId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  async countRelated(id: string): Promise<DestinationRelatedCounts> {
    const counts = await this.prisma.destination.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            systemTrailsViaDestinationId: true,
            checkpointsViaDestinationId: true,
            tripsViaDestinationId: true,
          },
        },
      },
    })

    return {
      trails: counts?._count.systemTrailsViaDestinationId ?? 0,
      checkpoints: counts?._count.checkpointsViaDestinationId ?? 0,
      trips: counts?._count.tripsViaDestinationId ?? 0,
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.destination.update({
      where: { id },
      data: { status: RecordStatus.INACTIVE },
    })
  }
}
