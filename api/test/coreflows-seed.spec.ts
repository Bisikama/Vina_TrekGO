import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { seedCoreflowsHappy } from '../prisma/seeds/coreflows-happy.seed'

const url = process.env.CORE_FLOWS_TEST_DATABASE_URL
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.startsWith('/cf04_test')
)
  throw new Error('Use an isolated localhost cf04_test* database')

describe('CF01–CF04 happy fixtures', () => {
  const db = new PrismaClient({ datasourceUrl: url })
  const batch = `happy_${randomUUID().slice(0, 8)}`
  afterAll(() => db.$disconnect())

  it('creates future public/private trips with coherent routes, membership and settled payments', async () => {
    const before = Date.now()
    const result = await seedCoreflowsHappy(db, { batch })
    expect(result.action).toBe('CREATED')
    const trips = await db.trip.findMany({
      where: { title: { startsWith: `[HAPPY ${batch}]` } },
      include: {
        creator: true,
        tripTrailPlansViaTripId: true,
        tripCheckpointsViaTripId: true,
        tripMembersViaTripId: true,
        privateTripInvitesViaTripId: true,
        bookingsViaTripId: {
          include: {
            bookingParticipantsViaBookingId: true,
            invoicesViaBookingId: {
              include: { invoiceLinesViaInvoiceId: true, paymentsViaInvoiceId: { include: { application: true } } },
            },
          },
        },
      },
    })
    expect(trips).toHaveLength(4)
    for (const trip of trips) {
      const offset = trip.title.endsWith('D2') ? 2 : 7
      expect(trip.startAt.getTime()).toBeGreaterThanOrEqual(before + offset * 86400000)
      expect(trip.startAt.getTime()).toBeLessThanOrEqual(Date.now() + offset * 86400000)
      expect(trip.status).toBe('OPEN')
      expect(trip.tripCheckpointsViaTripId).toHaveLength(4)
      expect(trip.tripTrailPlansViaTripId).toHaveLength(1)
      if (trip.tripType === 'PRIVATE') {
        expect(trip.creator.role).toBe('USER')
        expect(trip.leaderId).toBeNull()
        expect(trip.bookingsViaTripId).toHaveLength(0)
        expect(trip.tripMembersViaTripId).toHaveLength(2)
        expect(
          trip.tripMembersViaTripId.every((m) => m.status === 'ACTIVE' && m.attendanceStatus === 'NOT_MARKED'),
        ).toBe(true)
        const invite = trip.privateTripInvitesViaTripId[0]
        expect(invite.usedCount).toBe(1)
        expect(trip.tripMembersViaTripId.find((m) => m.role === 'MEMBER')?.joinedByInviteId).toBe(invite.id)
        const plan = trip.tripTrailPlansViaTripId[0]
        if (offset === 7) expect(plan.personalTrailId).not.toBeNull()
        else
          expect(
            await db.trailAccess.count({
              where: { userId: trip.creatorId, systemTrailId: plan.systemTrailId!, status: 'ACTIVE' },
            }),
          ).toBe(1)
      } else {
        expect(trip.creator.role).toBe('LEADER')
        expect(trip.tripMembersViaTripId).toHaveLength(0)
        expect(trip.bookingsViaTripId).toHaveLength(2)
        for (const booking of trip.bookingsViaTripId) {
          expect(booking.status).toBe('CONFIRMED')
          expect(booking.bookingParticipantsViaBookingId).toHaveLength(booking.participantCount)
          expect(
            booking.bookingParticipantsViaBookingId.every(
              (p) => p.status === 'ACTIVE' && p.checkinStatus === 'NOT_CHECKED_IN',
            ),
          ).toBe(true)
          const invoice = booking.invoicesViaBookingId[0],
            payment = invoice.paymentsViaInvoiceId[0]
          expect(invoice.status).toBe('PAID')
          expect(invoice.totalAmount.equals(booking.totalAmount)).toBe(true)
          expect(invoice.invoiceLinesViaInvoiceId[0].lineAmount.equals(invoice.totalAmount)).toBe(true)
          expect(payment.amount.equals(invoice.totalAmount)).toBe(true)
          expect(payment.status).toBe('SUCCEEDED')
          expect(payment.providerEnvironment).toBe('MOCK')
          expect(payment.application?.status).toBe('APPLIED')
          expect(booking.confirmedAt!.getTime()).toBeLessThan(booking.expiresAt.getTime())
        }
      }
    }
  })

  it('replays a batch without duplicating or moving dates, including user edits', async () => {
    const trip = await db.trip.findFirstOrThrow({ where: { title: { startsWith: `[HAPPY ${batch}]` } } })
    await db.trip.update({ where: { id: trip.id }, data: { description: 'Preserve manual edits' } })
    const counts = [await db.trip.count(), await db.booking.count(), await db.payment.count()]
    expect((await seedCoreflowsHappy(db, { batch })).action).toBe('UNCHANGED')
    expect([await db.trip.count(), await db.booking.count(), await db.payment.count()]).toEqual(counts)
    const replay = await db.trip.findUniqueOrThrow({ where: { id: trip.id } })
    expect(replay.startAt).toEqual(trip.startAt)
    expect(replay.description).toBe('Preserve manual edits')
  })

  it('rolls the whole batch back when an existing actor is invalid', async () => {
    const users = await db.user.count(),
      trips = await db.trip.count()
    await expect(seedCoreflowsHappy(db, { batch: `${batch}_fail`, memberId: randomUUID() })).rejects.toThrow()
    expect(await db.user.count()).toBe(users)
    expect(await db.trip.count()).toBe(trips)
  })
})
