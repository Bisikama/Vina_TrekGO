import { PrismaTripContextReadAdapter } from '../src/modules/gear/infrastructure/adapters/prisma-trip-context-read.adapter'

// Quyền dùng Gear theo chuyến: chuyến PUBLIC không có trip_members, người tham gia nằm ở bookings / booking_participants.
const FUTURE = () => new Date(Date.now() + 7 * 24 * 3600 * 1000)

function build(opts: {
  tripType?: 'PUBLIC' | 'PRIVATE'
  tripStatus?: string
  member?: boolean
  buyerBooking?: boolean
  participant?: boolean
  actor?: { role: string; status: string }
}) {
  const startAt = FUTURE()
  const trip = {
    id: 'trip-1',
    title: 'Bidoup',
    tripType: opts.tripType ?? 'PUBLIC',
    status: opts.tripStatus ?? 'OPEN',
    creatorId: 'host-1',
    leaderId: 'leader-1',
    startAt,
    endAt: new Date(startAt.getTime() + 2 * 24 * 3600 * 1000),
    updatedAt: new Date(),
    tripActiveTrailPlanViaTripId: null,
    tripTrailPlansViaTripId: [
      { id: 'plan-1', snapshotDifficulty: 'MEDIUM', snapshotGeojson: { terrain: ['forest'] }, updatedAt: new Date() },
    ],
    destination: null,
    tripCheckpointsViaTripId: [],
  }
  const prisma = {
    trip: { findUnique: jest.fn().mockResolvedValue(trip) },
    tripMember: { findFirst: jest.fn().mockResolvedValue(opts.member ? { id: 'm-1' } : null) },
    booking: { findFirst: jest.fn().mockResolvedValue(opts.buyerBooking ? { id: 'b-1' } : null) },
    bookingParticipant: { findFirst: jest.fn().mockResolvedValue(opts.participant ? { id: 'p-1' } : null) },
    user: { findUnique: jest.fn().mockResolvedValue(opts.actor ?? { role: 'USER', status: 'ACTIVE' }) },
  }
  return { prisma, adapter: new PrismaTripContextReadAdapter(prisma as never) }
}

describe('Gear — quyền theo chuyến đi (getTripContext)', () => {
  it('người mua vé chuyến PUBLIC có booking đã xác nhận được dùng Gear', async () => {
    const { prisma, adapter } = build({ buyerBooking: true })

    await expect(adapter.getTripContext('trip-1', 'buyer-1')).resolves.toMatchObject({ tripId: 'trip-1' })
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripId: 'trip-1', userId: 'buyer-1', status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN'] } },
      }),
    )
  })

  it('người đã nhận vé (participant ACTIVE) chuyến PUBLIC được dùng Gear', async () => {
    const { prisma, adapter } = build({ participant: true })

    await expect(adapter.getTripContext('trip-1', 'guest-1')).resolves.toMatchObject({ tripId: 'trip-1' })
    expect(prisma.bookingParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'guest-1',
          status: 'ACTIVE',
          booking: { tripId: 'trip-1', status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN'] } },
        }),
      }),
    )
  })

  it('không có booking hợp lệ (đã huỷ / chưa thanh toán) → GEAR_FORBIDDEN', async () => {
    const { adapter } = build({})

    await expect(adapter.getTripContext('trip-1', 'stranger-1')).rejects.toMatchObject({ code: 'GEAR_FORBIDDEN' })
  })

  it('participant khi Trip đang chờ huỷ hoặc tài khoản không ACTIVE → GEAR_FORBIDDEN', async () => {
    const pending = build({ participant: true, tripStatus: 'CANCEL_PENDING' })
    await expect(pending.adapter.getTripContext('trip-1', 'guest-1')).rejects.toMatchObject({ code: 'GEAR_FORBIDDEN' })
    expect(pending.prisma.bookingParticipant.findFirst).not.toHaveBeenCalled()

    const locked = build({ participant: true, actor: { role: 'USER', status: 'LOCKED' } })
    await expect(locked.adapter.getTripContext('trip-1', 'guest-1')).rejects.toMatchObject({ code: 'GEAR_FORBIDDEN' })
  })

  it('chuyến PRIVATE vẫn chỉ dựa trên trip_members ACTIVE, không xét booking', async () => {
    const outsider = build({ tripType: 'PRIVATE', buyerBooking: true, participant: true })
    await expect(outsider.adapter.getTripContext('trip-1', 'user-1')).rejects.toMatchObject({ code: 'GEAR_FORBIDDEN' })
    expect(outsider.prisma.booking.findFirst).not.toHaveBeenCalled()

    const member = build({ tripType: 'PRIVATE', member: true })
    await expect(member.adapter.getTripContext('trip-1', 'user-1')).resolves.toMatchObject({ tripId: 'trip-1' })
  })
})
