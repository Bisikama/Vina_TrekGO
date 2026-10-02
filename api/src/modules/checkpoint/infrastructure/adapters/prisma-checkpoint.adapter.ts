import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RecordStatus, Prisma } from '@prisma/client'
import {
  CheckpointPort,
  CheckpointRelatedCounts,
  CheckpointSummary,
  CreateCheckpointData,
  GetCheckpointsFilter,
  PaginatedResult,
  UpdateCheckpointData,
} from '../../application/ports/checkpoint.port'

@Injectable()
export class PrismaCheckpointAdapter implements CheckpointPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapToSummary(record: any): CheckpointSummary {
    return {
      id: record.id,
      destinationId: record.destinationId,
      code: record.code,
      name: record.name,
      description: record.description,
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      defaultRadiusMeters: record.defaultRadiusMeters,
      checkpointType: record.checkpointType,
      status: record.status,
      destination: record.destination
        ? {
            id: record.destination.id,
            name: record.destination.name,
            region: record.destination.region,
          }
        : undefined,
      trailCount: record._count?.trailCheckpointsViaCheckpointId ?? 0,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  async findAll(filter?: GetCheckpointsFilter): Promise<PaginatedResult<CheckpointSummary>> {
    const page = filter?.page ?? 1
    const pageSize = filter?.pageSize ?? 20
    const skip = (page - 1) * pageSize

    const where: Prisma.CheckpointWhereInput = {
      ...(filter?.status ? { status: filter.status } : { status: RecordStatus.ACTIVE }),
      ...(filter?.destinationId ? { destinationId: filter.destinationId } : {}),
      ...(filter?.checkpointType ? { checkpointType: filter.checkpointType } : {}),
      ...(filter?.keyword
        ? {
            OR: [
              { name: { contains: filter.keyword.trim(), mode: 'insensitive' } },
              { code: { contains: filter.keyword.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.checkpoint.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          destination: {
            select: { id: true, name: true, region: true },
          },
          _count: {
            select: { trailCheckpointsViaCheckpointId: true },
          },
        },
      }),
      this.prisma.checkpoint.count({ where }),
    ])

    return {
      items: items.map((item) => this.mapToSummary(item)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    }
  }

  async findById(id: string): Promise<CheckpointSummary | null> {
    const record = await this.prisma.checkpoint.findUnique({
      where: { id },
      include: {
        destination: {
          select: { id: true, name: true, region: true },
        },
        _count: {
          select: { trailCheckpointsViaCheckpointId: true },
        },
      },
    })

    if (!record) return null
    return this.mapToSummary(record)
  }

  async findByCode(code: string): Promise<CheckpointSummary | null> {
    const record = await this.prisma.checkpoint.findUnique({
      where: { code },
      include: {
        destination: {
          select: { id: true, name: true, region: true },
        },
        _count: {
          select: { trailCheckpointsViaCheckpointId: true },
        },
      },
    })

    if (!record) return null
    return this.mapToSummary(record)
  }

  async checkDestinationExists(destinationId: string): Promise<boolean> {
    const destination = await this.prisma.destination.findUnique({
      where: { id: destinationId },
      select: { id: true },
    })
    return !!destination
  }

  async create(data: CreateCheckpointData): Promise<CheckpointSummary> {
    const created = await this.prisma.checkpoint.create({
      data: {
        destinationId: data.destinationId,
        code: data.code?.trim() || null,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        latitude: new Prisma.Decimal(data.latitude),
        longitude: new Prisma.Decimal(data.longitude),
        defaultRadiusMeters: data.defaultRadiusMeters ?? 50,
        checkpointType: data.checkpointType ?? null,
        status: data.status ?? RecordStatus.ACTIVE,
      },
      include: {
        destination: {
          select: { id: true, name: true, region: true },
        },
        _count: {
          select: { trailCheckpointsViaCheckpointId: true },
        },
      },
    })

    return this.mapToSummary(created)
  }

  async update(id: string, data: UpdateCheckpointData): Promise<CheckpointSummary> {
    const updatePayload: Prisma.CheckpointUpdateInput = {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.code !== undefined ? { code: data.code ? data.code.trim() : null } : {}),
      ...(data.description !== undefined ? { description: data.description ? data.description.trim() : null } : {}),
      ...(data.latitude !== undefined ? { latitude: new Prisma.Decimal(data.latitude) } : {}),
      ...(data.longitude !== undefined ? { longitude: new Prisma.Decimal(data.longitude) } : {}),
      ...(data.defaultRadiusMeters !== undefined ? { defaultRadiusMeters: data.defaultRadiusMeters } : {}),
      ...(data.checkpointType !== undefined ? { checkpointType: data.checkpointType } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.destinationId !== undefined
        ? {
            destination: {
              connect: { id: data.destinationId },
            },
          }
        : {}),
    }

    const updated = await this.prisma.checkpoint.update({
      where: { id },
      data: updatePayload,
      include: {
        destination: {
          select: { id: true, name: true, region: true },
        },
        _count: {
          select: { trailCheckpointsViaCheckpointId: true },
        },
      },
    })

    return this.mapToSummary(updated)
  }

  async countRelated(id: string): Promise<CheckpointRelatedCounts> {
    const counts = await this.prisma.checkpoint.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            trailCheckpointsViaCheckpointId: true,
            tripCheckpointsViaSourceCheckpointId: true,
          },
        },
      },
    })

    return {
      trails: counts?._count.trailCheckpointsViaCheckpointId ?? 0,
      trips: counts?._count.tripCheckpointsViaSourceCheckpointId ?? 0,
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.checkpoint.update({
      where: { id },
      data: { status: RecordStatus.INACTIVE },
    })
  }
}
