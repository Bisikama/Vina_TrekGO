import { Controller, Get, Injectable, Param, Query } from '@nestjs/common'
import { ApiQuery, ApiTags } from '@nestjs/swagger'
import { Prisma } from '@prisma/client'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { AppError } from '../../shared/errors'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { PrismaService } from '../../shared/services/prisma.service'
import { bookingIdSchema, tripSearchSchema } from './booking.dto'
import type { TripSearch } from './booking.dto'
import { effectiveRegistrationDeadline, effectiveRegistrationOpen, occupiedSeats } from './booking-capacity'

const include = {
  destination: { select: { id: true, name: true } },
  leader: { select: { id: true, fullName: true } },
  pickupPoint: { select: { id: true, name: true, address: true } },
  tripTrailPlansViaTripId: {
    orderBy: { sequence: 'asc' as const },
    select: { id: true, snapshotName: true, snapshotDifficulty: true, snapshotDistanceKm: true, sequence: true },
  },
  tripCheckpointsViaTripId: {
    where: { isEnabled: true },
    orderBy: { sequence: 'asc' as const },
    select: { id: true, name: true, sequence: true, isRequired: true },
  },
  tripTransportsViaTripId: { where: { status: { not: 'CANCELLED' as const } }, select: { vehicleType: true } },
  tripCostPlanViaTripId: {
    select: {
      items: {
        where: { isEnabled: true },
        orderBy: { sortOrder: 'asc' as const },
        select: { nameSnapshot: true, includedInPrice: true, sourceNote: true },
      },
    },
  },
} satisfies Prisma.TripInclude

@Injectable()
export class BookingDiscoveryService {
  constructor(private readonly db: PrismaService) {}
  private async project(trip: Prisma.TripGetPayload<{ include: typeof include }>) {
    const costItems = trip.tripCostPlanViaTripId?.items ?? []
    const includedServices = costItems.filter((i) => i.includedInPrice).map((i) => i.nameSnapshot)
    const excludedServices = costItems
      .filter((i) => !i.includedInPrice)
      .map((i) => (i.sourceNote?.trim() ? `${i.nameSnapshot} (${i.sourceNote.trim()})` : i.nameSnapshot))

    const now = new Date()
    const openAt = effectiveRegistrationOpen(trip)
    const deadlineAt = effectiveRegistrationDeadline(trip)
    const remainingSlots = Math.max(0, trip.maxPax - (await occupiedSeats(this.db, trip.id, now)))
    const isPastDeadline = now >= deadlineAt
    const effectiveStatus =
      isPastDeadline && ['OPEN', 'FULL'].includes(trip.status)
        ? 'CLOSED'
        : remainingSlots === 0 && trip.status === 'OPEN'
          ? 'FULL'
          : trip.status

    return {
      id: trip.id,
      title: trip.title,
      description: trip.description,
      status: effectiveStatus,
      startAt: trip.startAt,
      endAt: trip.endAt,
      registrationOpenAt: openAt,
      registrationDeadlineAt: deadlineAt,
      publishedAt: trip.publishedAt,
      closedAt: trip.closedAt ?? (effectiveStatus === 'CLOSED' ? deadlineAt : null),
      startedAt: trip.startedAt,
      completedAt: trip.completedAt,
      cancelledAt: trip.cancelledAt,
      destination: trip.destination,
      leader: trip.leader,
      pricePerPax: trip.pricePerPax?.toFixed() ?? null,
      currency: 'VND',
      minPax: trip.minPax,
      capacity: trip.maxPax,
      remainingSlots,
      pickup: trip.pickupPoint,
      routes: trip.tripTrailPlansViaTripId,
      checkpoints: trip.tripCheckpointsViaTripId,
      transportAvailable: trip.tripTransportsViaTripId.length > 0,
      transport: trip.tripTransportsViaTripId,
      includedServices,
      excludedServices,
    }
  }
  async list(query: TripSearch) {
    const now = new Date()
    const where: Prisma.TripWhereInput = {
      tripType: 'PUBLIC',
      status: { in: ['OPEN', 'FULL', 'CLOSED'] },
      publishedAt: { not: null },
      startAt: {
        gt: now,
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lt: new Date(new Date(query.dateTo).getTime() + 86_400_000) } : {}),
      },
      ...(query.destinationId ? { destinationId: query.destinationId } : {}),
      ...(query.price !== undefined ? { pricePerPax: { lte: query.price } } : {}),
      ...(query.difficulty ? { tripTrailPlansViaTripId: { some: { snapshotDifficulty: query.difficulty } } } : {}),
    }
    const [total, rows] = await this.db.$transaction([
      this.db.trip.count({ where }),
      this.db.trip.findMany({
        where,
        include,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])
    return {
      items: await Promise.all(rows.map((row) => this.project(row))),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }
  async detail(id: string) {
    const trip = await this.db.trip.findFirst({
      where: {
        id,
        tripType: 'PUBLIC',
        status: { in: ['OPEN', 'FULL', 'CLOSED'] },
        publishedAt: { not: null },
        startAt: { gt: new Date() },
      },
      include,
    })
    if (!trip) throw AppError.fromCode('NOT_FOUND')
    return this.project(trip)
  }
}
@ApiTags('Public booking discovery')
@Auth([AuthType.None])
@Controller('trips')
export class BookingDiscoveryController {
  constructor(private readonly discovery: BookingDiscoveryService) {}
  @Get()
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 12 } })
  @ApiQuery({ name: 'destinationId', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'dateFrom', required: false, schema: { type: 'string', format: 'date' } })
  @ApiQuery({ name: 'dateTo', required: false, schema: { type: 'string', format: 'date' } })
  @ApiQuery({ name: 'difficulty', required: false, enum: ['EASY', 'MEDIUM', 'HARD', 'EXTREME'] })
  @ApiQuery({ name: 'price', required: false, description: 'Maximum price per participant', schema: { type: 'integer', minimum: 0 } })
  list(@Query(new ZodValidationPipe(tripSearchSchema)) query: TripSearch) {
    return this.discovery.list(query)
  }
  @Get(':id')
  detail(@Param('id', new ZodValidationPipe(bookingIdSchema)) id: string) {
    return this.discovery.detail(id)
  }
}
