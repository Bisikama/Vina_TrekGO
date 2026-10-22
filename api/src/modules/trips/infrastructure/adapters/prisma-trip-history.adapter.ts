import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { TripHistoryPort } from '../../application/trip-history.port'
import type { HistoryTripType } from '../../application/trip-history.port'
import type { Page } from '../../application/trip.types'

@Injectable()
export class PrismaTripHistoryAdapter extends TripHistoryPort {
  constructor(private readonly db: PrismaService) {
    super()
  }

  async list(userId: string, type: HistoryTripType, page: Page) {
    const where: Prisma.TripWhereInput = {
      tripType: type,
      status: { in: ['COMPLETED', 'CANCELLED', 'INTERRUPTED'] },
      ...(type === 'PUBLIC'
        ? {
            // Unpaid/expired reservations do not establish trip participation.
            bookingsViaTripId: { some: { userId, confirmedAt: { not: null } } },
          }
        : {
            // Keep historical membership even after leaving or being removed.
            OR: [{ creatorId: userId }, { tripMembersViaTripId: { some: { userId } } }],
          }),
    }
    const [items, total] = await this.db.$transaction(
      [
        this.db.trip.findMany({
          where,
          select: {
            id: true,
            tripType: true,
            title: true,
            status: true,
            startAt: true,
            endAt: true,
            completedAt: true,
            cancelledAt: true,
            destination: { select: { id: true, name: true } },
          },
          orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
          skip: (page.page - 1) * page.pageSize,
          take: page.pageSize,
        }),
        this.db.trip.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
    return { items, ...page, total, totalPages: Math.ceil(total / page.pageSize) }
  }
}
