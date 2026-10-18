import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { Prisma, RecordStatus } from '@prisma/client'
import {
  CreateDestinationData,
  UpdateDestinationData,
  DestinationRelatedCounts,
  DestinationPort,
  DestinationSummary,
  PickupPointSummary,
  GetDestinationsFilter,
  PaginatedResult,
} from '../../application/ports/destination.port'

function generatePickupCode(destinationName: string, index: number): string {
  const cleanName = destinationName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6)
  const time = Date.now().toString(36).slice(-4).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `PKP-${cleanName || 'DEST'}-${time}${rand}-${index + 1}`.slice(0, 50)
}

@Injectable()
export class PrismaDestinationAdapter implements DestinationPort {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveActorId(tx: Prisma.TransactionClient, explicitActorId?: string): Promise<string> {
    if (explicitActorId) return explicitActorId
    const fallbackUser = await tx.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    })
    if (fallbackUser) return fallbackUser.id
    const anyUser = await tx.user.findFirst({ select: { id: true } })
    if (anyUser) return anyUser.id
    throw new Error('Không tìm thấy người dùng hợp lệ để tạo điểm tập kết.')
  }

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
            select: {
              systemTrailsViaDestinationId: true,
              pickupPointsViaDestinationId: { where: { status: RecordStatus.ACTIVE } },
            },
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
        pickupPointCount: item._count.pickupPointsViaDestinationId,
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
          select: {
            systemTrailsViaDestinationId: true,
            pickupPointsViaDestinationId: { where: { status: RecordStatus.ACTIVE } },
          },
        },
        pickupPointsViaDestinationId: {
          orderBy: { createdAt: 'asc' },
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
      pickupPointCount: item._count.pickupPointsViaDestinationId,
      pickupPoints: item.pickupPointsViaDestinationId.map((p) => ({
        id: p.id,
        destinationId: p.destinationId,
        code: p.code,
        name: p.name,
        address: p.address,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        note: p.note,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
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
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.destination.create({
        data: {
          name: data.name.trim(),
          description: data.description,
          region: data.region,
          centerLat: data.centerLat !== undefined && data.centerLat !== null ? data.centerLat : null,
          centerLng: data.centerLng !== undefined && data.centerLng !== null ? data.centerLng : null,
          status: data.status ?? RecordStatus.ACTIVE,
        },
      })

      const pickupPoints: PickupPointSummary[] = []
      if (data.pickupPoints && data.pickupPoints.length > 0) {
        const actorId = await this.resolveActorId(tx, data.actorId)
        for (const [index, p] of data.pickupPoints.entries()) {
          const code = p.code?.trim() || generatePickupCode(created.name, index)
          const item = await tx.pickupPoint.create({
            data: {
              destinationId: created.id,
              code,
              name: p.name.trim(),
              address: p.address.trim(),
              latitude: new Prisma.Decimal(p.latitude),
              longitude: new Prisma.Decimal(p.longitude),
              note: p.note?.trim() || null,
              status: p.status ?? RecordStatus.ACTIVE,
              createdBy: actorId,
            },
          })

          pickupPoints.push({
            id: item.id,
            destinationId: item.destinationId,
            code: item.code,
            name: item.name,
            address: item.address,
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
            note: item.note,
            status: item.status,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })
        }
      }

      return {
        id: created.id,
        name: created.name,
        description: created.description,
        region: created.region,
        centerLat: created.centerLat ? Number(created.centerLat) : null,
        centerLng: created.centerLng ? Number(created.centerLng) : null,
        status: created.status,
        trailCount: 0,
        pickupPointCount: pickupPoints.length,
        pickupPoints,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      }
    })
  }

  async update(id: string, data: UpdateDestinationData): Promise<DestinationSummary> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.destination.update({
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

      if (data.pickupPoints !== undefined) {
        const actorId = await this.resolveActorId(tx, data.actorId)
        const incomingIds = data.pickupPoints
          .map((p) => p.id)
          .filter((pId): pId is string => Boolean(pId))

        // Soft-delete (set INACTIVE) any existing pickup point of this destination not present in payload
        await tx.pickupPoint.updateMany({
          where: {
            destinationId: id,
            id: { notIn: incomingIds },
            status: { not: RecordStatus.INACTIVE },
          },
          data: { status: RecordStatus.INACTIVE },
        })

        for (const [index, p] of data.pickupPoints.entries()) {
          if (p.id) {
            await tx.pickupPoint.update({
              where: { id: p.id },
              data: {
                name: p.name.trim(),
                address: p.address.trim(),
                latitude: new Prisma.Decimal(p.latitude),
                longitude: new Prisma.Decimal(p.longitude),
                note: p.note?.trim() ?? null,
                ...(p.code?.trim() ? { code: p.code.trim() } : {}),
                status: p.status ?? RecordStatus.ACTIVE,
              },
            })
          } else {
            const code = p.code?.trim() || generatePickupCode(updated.name, index)
            await tx.pickupPoint.create({
              data: {
                destinationId: id,
                code,
                name: p.name.trim(),
                address: p.address.trim(),
                latitude: new Prisma.Decimal(p.latitude),
                longitude: new Prisma.Decimal(p.longitude),
                note: p.note?.trim() || null,
                status: p.status ?? RecordStatus.ACTIVE,
                createdBy: actorId,
              },
            })
          }
        }
      }

      const allPickups = await tx.pickupPoint.findMany({
        where: { destinationId: id },
        orderBy: { createdAt: 'asc' },
      })

      const activePickupsCount = allPickups.filter((p) => p.status === RecordStatus.ACTIVE).length

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        region: updated.region,
        centerLat: updated.centerLat ? Number(updated.centerLat) : null,
        centerLng: updated.centerLng ? Number(updated.centerLng) : null,
        status: updated.status,
        trailCount: updated._count.systemTrailsViaDestinationId,
        pickupPointCount: activePickupsCount,
        pickupPoints: allPickups.map((p) => ({
          id: p.id,
          destinationId: p.destinationId,
          code: p.code,
          name: p.name,
          address: p.address,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          note: p.note,
          status: p.status,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      }
    })
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
    await this.prisma.$transaction(async (tx) => {
      await tx.destination.update({
        where: { id },
        data: { status: RecordStatus.INACTIVE },
      })
      await tx.pickupPoint.updateMany({
        where: { destinationId: id },
        data: { status: RecordStatus.INACTIVE },
      })
    })
  }
}
