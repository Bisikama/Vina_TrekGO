import { Injectable } from '@nestjs/common'
import { BookingStatus, ParticipantStatus, Prisma, Trip } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B, COMMON_ERROR_CODES as C } from '../../shared/errors'
import { databaseTime, expireTripHolds } from './booking-capacity'
import { transitionPublicInvitation } from './public-invitation.policy'
import type { LeaderCheckinInput, LeaderParticipantsQuery } from './leader-checkin.dto'

const participantInclude = {
  user: { select: { fullName: true } },
  booking: {
    include: {
      user: { select: { fullName: true, phone: true } },
      pickupPoint: { select: { id: true, name: true, address: true } },
    },
  },
} as const

type ParticipantRow = Prisma.BookingParticipantGetPayload<{ include: typeof participantInclude }>

const ELIGIBLE_ROSTER_BOOKING_STATUSES: BookingStatus[] = [
  'CONFIRMED',
  'PARTIAL_CHECKIN',
  'CHECKED_IN',
  'COMPLETED',
  'NO_SHOW',
]

const ELIGIBLE_ROSTER_PARTICIPANT_STATUSES: ParticipantStatus[] = ['ACTIVE', 'NO_SHOW', 'COMPLETED']

@Injectable()
export class LeaderCheckinService {
  constructor(private readonly db: PrismaService) {}

  private async assertLeaderActor(tx: Prisma.TransactionClient, actorId: string) {
    if (!actorId) throw AppError.fromCode(C.UNAUTHENTICATED)
    const user = await tx.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, status: true },
    })
    if (!user) throw AppError.fromCode(C.UNAUTHENTICATED)
    if (user.status !== 'ACTIVE' || user.role !== 'LEADER') {
      throw AppError.fromCode(C.FORBIDDEN)
    }
  }

  private assertOwnedPublicTrip(trip: Trip | null, actorId: string): asserts trip is Trip {
    if (!trip || trip.tripType !== 'PUBLIC') {
      throw AppError.fromCode(B.NOT_FOUND)
    }
    const isOwner = trip.leaderId
      ? trip.creatorId === actorId && trip.leaderId === actorId
      : trip.creatorId === actorId
    if (!isOwner) {
      throw AppError.fromCode(C.FORBIDDEN)
    }
  }

  private tripSummary(trip: Trip) {
    return {
      id: trip.id,
      title: trip.title,
      status: trip.status,
      startAt: trip.startAt.toISOString(),
      endAt: trip.endAt.toISOString(),
      publishedAt: trip.publishedAt?.toISOString() ?? null,
      closedAt: trip.closedAt?.toISOString() ?? null,
      startedAt: trip.startedAt?.toISOString() ?? null,
      completedAt: trip.completedAt?.toISOString() ?? null,
      capacity: trip.maxPax,
      minPax: trip.minPax,
    }
  }

  private participantView(row: ParticipantRow) {
    return {
      id: row.id,
      bookingId: row.bookingId,
      bookingStatus: row.booking.status,
      fullName: row.fullName,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      idDocumentNo: row.idDocumentNo,
      emergencyContactName: row.emergencyContactName,
      emergencyContactPhone: row.emergencyContactPhone,
      participantStatus: row.status,
      checkinStatus: row.checkinStatus,
      checkinMethod: row.checkinMethod ?? null,
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      checkedInBy: row.checkedInBy ?? null,
      isLinkedAccount: Boolean(row.userId),
      linkedUserDisplay: row.user?.fullName ?? null,
      buyerDisplay: row.booking.user.fullName,
      buyerPhone: row.booking.user.phone,
      pickupPoint: row.booking.pickupPoint,
    }
  }

  private async computeSummary(tx: Prisma.TransactionClient, trip: Trip) {
    const baseWhere: Prisma.BookingParticipantWhereInput = {
      status: { in: ELIGIBLE_ROSTER_PARTICIPANT_STATUSES },
      booking: {
        tripId: trip.id,
        status: { in: ELIGIBLE_ROSTER_BOOKING_STATUSES },
      },
    }
    const [totalParticipants, checkedInCount, notCheckedInCount, noShowCount] = await Promise.all([
      tx.bookingParticipant.count({ where: baseWhere }),
      tx.bookingParticipant.count({ where: { ...baseWhere, checkinStatus: 'CHECKED_IN' } }),
      tx.bookingParticipant.count({ where: { ...baseWhere, checkinStatus: 'NOT_CHECKED_IN' } }),
      tx.bookingParticipant.count({ where: { ...baseWhere, checkinStatus: 'NO_SHOW' } }),
    ])
    return {
      capacity: trip.maxPax,
      minPax: trip.minPax,
      totalParticipants,
      checkedInCount,
      notCheckedInCount,
      noShowCount,
      progressPercent: totalParticipants > 0 ? Math.round((checkedInCount / totalParticipants) * 100) : 0,
    }
  }

  async listParticipants(actorId: string, tripId: string, query: LeaderParticipantsQuery) {
    return this.db.$transaction(
      async (tx) => {
        await this.assertLeaderActor(tx, actorId)
        const initialTrip = await tx.trip.findUnique({ where: { id: tripId } })
        this.assertOwnedPublicTrip(initialTrip, actorId)

        await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
        const now = await databaseTime(tx)
        await expireTripHolds(tx, tripId, now)

        const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId } })
        this.assertOwnedPublicTrip(trip, actorId)

        const summary = await this.computeSummary(tx, trip)
        const where: Prisma.BookingParticipantWhereInput = {
          status: { in: ELIGIBLE_ROSTER_PARTICIPANT_STATUSES },
          booking: {
            tripId,
            status: { in: ELIGIBLE_ROSTER_BOOKING_STATUSES },
          },
          ...(query.checkinStatus ? { checkinStatus: query.checkinStatus } : {}),
          ...(query.search
            ? {
                OR: [
                  { fullName: { contains: query.search, mode: 'insensitive' } },
                  { phone: { contains: query.search, mode: 'insensitive' } },
                  { idDocumentNo: { contains: query.search, mode: 'insensitive' } },
                  { emergencyContactName: { contains: query.search, mode: 'insensitive' } },
                  { emergencyContactPhone: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        }

        const total = await tx.bookingParticipant.count({ where })
        const rows = await tx.bookingParticipant.findMany({
          where,
          include: participantInclude,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        })

        return {
          trip: this.tripSummary(trip),
          summary,
          items: rows.map((r) => this.participantView(r)),
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        }
      },
      { timeout: 15000 },
    )
  }

  async checkin(actorId: string, tripId: string, input: LeaderCheckinInput) {
    return this.db.$transaction(
      async (tx) => {
        await this.assertLeaderActor(tx, actorId)
        const initialTrip = await tx.trip.findUnique({ where: { id: tripId } })
        this.assertOwnedPublicTrip(initialTrip, actorId)

        // Canonical lock order: Trip -> Booking -> Participant -> Invitation
        await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
        const now = await databaseTime(tx)
        await expireTripHolds(tx, tripId, now)

        const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId } })
        this.assertOwnedPublicTrip(trip, actorId)
        await this.assertLeaderActor(tx, actorId)

        if (
          !['OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS'].includes(trip.status) ||
          Boolean(trip.cancelledAt) ||
          Boolean(trip.completedAt)
        ) {
          throw AppError.fromCode(B.CHECKIN_NOT_ALLOWED, {
            details: { reason: 'TRIP_NOT_ELIGIBLE', tripStatus: trip.status },
          })
        }

        let targetParticipantId: string
        let targetBookingId: string

        if (input.method === 'QR') {
          const found = await tx.bookingParticipant.findUnique({
            where: { checkinCode: input.checkinCode },
            select: { id: true, bookingId: true, booking: { select: { tripId: true } } },
          })
          if (!found || found.booking.tripId !== tripId) {
            throw AppError.fromCode(B.CHECKIN_TOKEN_INVALID)
          }
          targetParticipantId = found.id
          targetBookingId = found.bookingId
        } else {
          const found = await tx.bookingParticipant.findFirst({
            where: { id: input.participantId, booking: { tripId } },
            select: { id: true, bookingId: true },
          })
          if (!found) {
            throw AppError.fromCode(B.NOT_FOUND)
          }
          targetParticipantId = found.id
          targetBookingId = found.bookingId
        }

        await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${targetBookingId}::uuid FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM booking_participants WHERE id = ${targetParticipantId}::uuid AND booking_id = ${targetBookingId}::uuid FOR UPDATE`

        const booking = await tx.booking.findUniqueOrThrow({ where: { id: targetBookingId } })
        const participant = await tx.bookingParticipant.findUniqueOrThrow({
          where: { id: targetParticipantId },
          include: participantInclude,
        })

        if (input.method === 'QR' && participant.checkinCode !== input.checkinCode) {
          throw AppError.fromCode(B.CHECKIN_TOKEN_INVALID)
        }

        if (!['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'NO_SHOW'].includes(booking.status)) {
          throw AppError.fromCode(B.CHECKIN_NOT_ALLOWED, {
            details: { reason: 'BOOKING_NOT_ELIGIBLE', bookingStatus: booking.status },
          })
        }

        if (!['ACTIVE', 'NO_SHOW'].includes(participant.status)) {
          throw AppError.fromCode(B.CHECKIN_NOT_ALLOWED, {
            details: { reason: 'PARTICIPANT_NOT_ELIGIBLE', participantStatus: participant.status },
          })
        }

        const targetCheckinStatus = input.method === 'QR' ? 'CHECKED_IN' : input.checkinStatus
        const nextParticipantStatus: ParticipantStatus =
          targetCheckinStatus === 'NO_SHOW' ? 'NO_SHOW' : 'ACTIVE'

        if (
          participant.checkinStatus === targetCheckinStatus &&
          participant.status === nextParticipantStatus
        ) {
          const summary = await this.computeSummary(tx, trip)
          return {
            alreadyCheckedIn: targetCheckinStatus === 'CHECKED_IN',
            replayed: true,
            bookingStatus: booking.status,
            bookingVersion: booking.version,
            participant: this.participantView(participant),
            summary,
          }
        }

        if (targetCheckinStatus !== 'NOT_CHECKED_IN') {
          const pending = await tx.bookingParticipantInvitation.findFirst({
            where: { bookingParticipantId: participant.id, status: 'PENDING' },
          })
          if (pending) {
            await tx.$queryRaw`SELECT id FROM booking_participant_invitations WHERE id = ${pending.id}::uuid FOR UPDATE`
            const freshPending = await tx.bookingParticipantInvitation.findUnique({ where: { id: pending.id } })
            if (freshPending && freshPending.status === 'PENDING') {
              await transitionPublicInvitation(
                tx,
                freshPending,
                booking,
                actorId,
                now,
                'INVALIDATED',
                'PARTICIPANT_NOT_ELIGIBLE',
              )
            }
          }
        }

        const updatedParticipant = await tx.bookingParticipant.update({
          where: { id: participant.id },
          data:
            targetCheckinStatus === 'NOT_CHECKED_IN'
              ? {
                  status: 'ACTIVE',
                  checkinStatus: 'NOT_CHECKED_IN',
                  checkinMethod: null,
                  checkedInAt: null,
                  checkedInBy: null,
                }
              : {
                  status: nextParticipantStatus,
                  checkinStatus: targetCheckinStatus,
                  checkinMethod: input.method,
                  checkedInAt: now,
                  checkedInBy: actorId,
                },
          include: participantInclude,
        })

        const siblings = await tx.bookingParticipant.findMany({
          where: { bookingId: booking.id, status: { not: 'CANCELLED' } },
          select: { checkinStatus: true },
        })
        const totalActive = siblings.length
        const checkedInSiblings = siblings.filter((s) => s.checkinStatus === 'CHECKED_IN').length
        const noShowSiblings = siblings.filter((s) => s.checkinStatus === 'NO_SHOW').length

        let nextBookingStatus: BookingStatus = 'CONFIRMED'
        if (totalActive > 0 && checkedInSiblings === totalActive) {
          nextBookingStatus = 'CHECKED_IN'
        } else if (checkedInSiblings > 0) {
          nextBookingStatus = 'PARTIAL_CHECKIN'
        } else if (totalActive > 0 && noShowSiblings === totalActive) {
          nextBookingStatus = 'NO_SHOW'
        }

        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: nextBookingStatus,
            version: { increment: 1 },
          },
        })

        const eventType =
          targetCheckinStatus === 'CHECKED_IN'
            ? 'PUBLIC_PARTICIPANT_CHECKED_IN'
            : targetCheckinStatus === 'NO_SHOW'
              ? 'PUBLIC_PARTICIPANT_MARKED_NO_SHOW'
              : 'PUBLIC_PARTICIPANT_CHECKIN_RESET'

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: eventType,
            entityType: 'BookingParticipant',
            entityId: participant.id,
            oldValues: {
              status: participant.status,
              checkinStatus: participant.checkinStatus,
              checkinMethod: participant.checkinMethod,
              bookingStatus: booking.status,
              bookingVersion: booking.version,
            },
            newValues: {
              status: updatedParticipant.status,
              checkinStatus: updatedParticipant.checkinStatus,
              checkinMethod: updatedParticipant.checkinMethod,
              checkedInAt: updatedParticipant.checkedInAt?.toISOString() ?? null,
              checkedInBy: actorId,
              bookingStatus: updatedBooking.status,
              bookingVersion: updatedBooking.version,
            },
          },
        })

        await tx.bookingOutboxEvent.create({
          data: {
            eventType,
            aggregateType: 'Booking',
            aggregateId: booking.id,
            deduplicationKey: `${eventType}:${participant.id}:${updatedBooking.version}`,
            payload: {
              schemaVersion: 1,
              tripId: trip.id,
              bookingId: booking.id,
              participantId: participant.id,
              participantUserId: participant.userId,
              checkinStatus: updatedParticipant.checkinStatus,
              checkinMethod: updatedParticipant.checkinMethod,
              checkedInAt: updatedParticipant.checkedInAt?.toISOString() ?? null,
              checkedInBy: actorId,
              bookingStatus: updatedBooking.status,
              bookingVersion: updatedBooking.version,
              occurredAt: now.toISOString(),
            },
          },
        })

        const summary = await this.computeSummary(tx, trip)
        return {
          alreadyCheckedIn: false,
          replayed: false,
          bookingStatus: updatedBooking.status,
          bookingVersion: updatedBooking.version,
          participant: {
            ...this.participantView(updatedParticipant),
            bookingStatus: updatedBooking.status,
          },
          summary,
        }
      },
      { timeout: 15000 },
    )
  }
}
