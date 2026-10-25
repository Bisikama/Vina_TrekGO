import { Injectable } from '@nestjs/common'
import { Prisma, Trip, UserRole } from '@prisma/client'
import { AppError, TRIP_GPS_ERROR_CODES as E } from '../../../shared/errors'

export interface GpsMember {
  userId: string
  fullName: string
  avatarUrl: string | null
  tripRole: 'HOST' | 'LEADER' | 'MEMBER'
  role: UserRole
}
const profile = { id: true, fullName: true, avatarUrl: true, role: true, status: true } as const
export const isHistorical = (trip: Trip) => ['COMPLETED', 'INTERRUPTED', 'CANCELLED'].includes(trip.status)

@Injectable()
export class GpsAccessService {
  async roster(tx: Prisma.TransactionClient, trip: Trip): Promise<GpsMember[]> {
    const members = new Map<string, GpsMember>()
    const add = (
      u: { id: string; fullName: string; avatarUrl: string | null; role: UserRole; status: string },
      tripRole: GpsMember['tripRole'],
    ) => {
      if (u.status === 'ACTIVE')
        members.set(u.id, { userId: u.id, fullName: u.fullName, avatarUrl: u.avatarUrl, role: u.role, tripRole })
    }
    const historical = isHistorical(trip)
    if (trip.tripType === 'PRIVATE') {
      const rows = await tx.tripMember.findMany({
        where: { tripId: trip.id, status: { in: historical ? ['ACTIVE', 'COMPLETED'] : ['ACTIVE'] } },
        include: { user: { select: profile } },
      })
      for (const row of rows) add(row.user, row.role === 'HOST' ? 'HOST' : 'MEMBER')
    } else {
      const rows = await tx.bookingParticipant.findMany({
        where: {
          userId: { not: null },
          status: { in: historical ? ['ACTIVE', 'COMPLETED'] : ['ACTIVE'] },
          booking: {
            tripId: trip.id,
            status: {
              in: historical
                ? ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED']
                : ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN'],
            },
          },
        },
        include: { user: { select: profile } },
      })
      for (const row of rows) if (row.user) add(row.user, 'MEMBER')
      if (trip.leaderId) {
        const leader = await tx.user.findUnique({ where: { id: trip.leaderId }, select: profile })
        if (leader) add(leader, 'LEADER')
      }
    }
    return [...members.values()].sort((a, b) => a.userId.localeCompare(b.userId))
  }

  async require(tx: Prisma.TransactionClient, trip: Trip, userId: string) {
    const member = (await this.roster(tx, trip)).find((m) => m.userId === userId)
    if (!member) throw new AppError({ code: E.ACCESS_DENIED })
    return member
  }

  async revokedAt(tx: Prisma.TransactionClient, trip: Trip, userId: string) {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true, updatedAt: true } })
    if (user && user.status !== 'ACTIVE') return user.updatedAt
    if (trip.tripType === 'PRIVATE') {
      const member = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId: trip.id, userId } } })
      if (member) return member.updatedAt
    } else {
      const rows = await tx.bookingParticipant.findMany({
        where: { userId, booking: { tripId: trip.id } },
        include: { booking: { select: { updatedAt: true, status: true } } },
      })
      const dates = rows.map((r) => (['ACTIVE', 'COMPLETED'].includes(r.status) ? r.booking.updatedAt : r.updatedAt))
      if (dates.length) return new Date(Math.max(...dates.map((d) => d.getTime())))
    }
    return new Date()
  }
}
