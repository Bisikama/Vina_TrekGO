import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B } from '../../shared/errors'
import { assertTicketActor, ticketAccess } from './participant-claim.service'

const include = {
  booking: { include: { trip: { include: { destination: { select: { id: true, name: true } } } } } },
} as const
type Ticket = Prisma.BookingParticipantGetPayload<{ include: typeof include }>
@Injectable()
export class TicketsService {
  constructor(private readonly db: PrismaService) {}
  private view(row: Ticket) {
    const permissions = ticketAccess(row, row.booking, row.booking.trip)
    return {
      id: row.id,
      participantName: row.fullName,
      participantStatus: row.status,
      checkinStatus: row.checkinStatus,
      checkinMethod: row.checkinMethod ?? null,
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      checkinCode: permissions.participantActive ? row.checkinCode : null,
      trip: {
        id: row.booking.trip.id,
        title: row.booking.trip.title,
        status: row.booking.trip.status,
        startAt: row.booking.trip.startAt.toISOString(),
        endAt: row.booking.trip.endAt.toISOString(),
        destination: row.booking.trip.destination,
      },
      bookingStatus: row.booking.status,
      permissions,
    }
  }
  async list(userId: string, page: number, pageSize: number) {
    return this.db.$transaction(
      async (tx) => {
        await assertTicketActor(tx, userId)
        const where = { userId, booking: { trip: { tripType: 'PUBLIC' as const } } }
        const total = await tx.bookingParticipant.count({ where })
        const rows = await tx.bookingParticipant.findMany({
          where,
          include,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        })
        return { items: rows.map((r) => this.view(r)), page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }
  async detail(userId: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        await assertTicketActor(tx, userId)
        const row = await tx.bookingParticipant.findFirst({
          where: { id, userId, booking: { trip: { tripType: 'PUBLIC' } } },
          include,
        })
        if (!row) throw AppError.fromCode(B.NOT_FOUND)
        return this.view(row)
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }
}
