jest.mock('@nestjs/schedule', () => ({ Interval: () => () => {}, Cron: () => () => {} }))
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

import Ajv from 'ajv'
import { Test } from '@nestjs/testing'
import type { ArgumentsHost, INestApplication } from '@nestjs/common'
import { LeaderCheckinController } from './leader-checkin.controller'
import { LeaderCheckinService } from './leader-checkin.service'
import {
  leaderCheckinBodySchema,
  leaderParticipantsQuerySchema,
  manualParticipantCheckinBodySchema,
} from './leader-checkin.dto'
import { TicketsController } from './tickets.controller'
import { TicketsService } from './tickets.service'
import { ParticipantClaimService } from './participant-claim.service'
import { BookingsController } from './bookings.controller'
import { BookingsService } from './bookings.service'
import { BookingPolicyService } from './booking-policy.service'
import { PrismaService } from '../../shared/services/prisma.service'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { GlobalErrorFilter } from '../../shared/errors'

describe('Leader Check-in and Ticket QR Contract', () => {
  let app: INestApplication
  let leaderController: LeaderCheckinController
  let ticketsController: TicketsController
  let bookingsController: BookingsController

  const now = new Date('2026-10-25T08:00:00.000Z')
  const leaderId = '00000000-0000-4000-8000-000000000001'
  const otherLeaderId = '00000000-0000-4000-8000-000000000002'
  const buyerId = '00000000-0000-4000-8000-000000000003'
  const friendId = '00000000-0000-4000-8000-000000000004'
  const tripId = '00000000-0000-4000-8000-000000000010'
  const bookingId = '00000000-0000-4000-8000-000000000020'
  const p1Id = '00000000-0000-4000-8000-000000000031'
  const p2Id = '00000000-0000-4000-8000-000000000032'
  const inviteId = '00000000-0000-4000-8000-000000000041'

  const users = new Map<string, any>([
    [
      leaderId,
      {
        id: leaderId,
        authUserId: leaderId,
        email: 'leader@trek.test',
        fullName: 'Leader One',
        role: 'LEADER',
        status: 'ACTIVE',
        phone: '0900000001',
        avatarUrl: null,
      },
    ],
    [
      otherLeaderId,
      {
        id: otherLeaderId,
        authUserId: otherLeaderId,
        email: 'other@trek.test',
        fullName: 'Leader Two',
        role: 'LEADER',
        status: 'ACTIVE',
        phone: '0900000002',
        avatarUrl: null,
      },
    ],
    [
      buyerId,
      {
        id: buyerId,
        authUserId: buyerId,
        email: 'buyer@trek.test',
        fullName: 'Buyer Trekker',
        role: 'USER',
        status: 'ACTIVE',
        phone: '0900000003',
        avatarUrl: null,
      },
    ],
    [
      friendId,
      {
        id: friendId,
        authUserId: friendId,
        email: 'friend@trek.test',
        fullName: 'Friend Trekker',
        role: 'USER',
        status: 'ACTIVE',
        phone: '0900000004',
        avatarUrl: null,
      },
    ],
  ])

  let tripState: any
  let bookingState: any
  let participantsState: any[]
  let invitationsState: any[]
  let auditLogs: any[]
  let outboxEvents: any[]

  const resetState = () => {
    tripState = {
      id: tripId,
      tripType: 'PUBLIC',
      creatorId: leaderId,
      leaderId,
      title: 'Ta Nang - Phan Dung Public Trek',
      status: 'CLOSED',
      startAt: new Date('2026-10-26T06:00:00.000Z'),
      endAt: new Date('2026-10-27T18:00:00.000Z'),
      publishedAt: new Date('2026-10-20T06:00:00.000Z'),
      closedAt: new Date('2026-10-25T06:00:00.000Z'),
      startedAt: null,
      completedAt: null,
      maxPax: 15,
      minPax: 5,
      destination: { id: '00000000-0000-4000-8000-000000000099', name: 'Ta Nang' },
      tripTransportsViaTripId: [],
    }
    bookingState = {
      id: bookingId,
      tripId,
      userId: buyerId,
      pickupPointId: '00000000-0000-4000-8000-000000000088',
      returnPointId: '00000000-0000-4000-8000-000000000088',
      bookingPolicyId: '00000000-0000-4000-8000-000000000077',
      status: 'CONFIRMED',
      participantCount: 2,
      pricePerPaxSnapshot: 1500000,
      subtotalAmount: 3000000,
      discountAmount: 0,
      totalAmount: 3000000,
      currency: 'VND',
      version: 1,
      expiresAt: new Date('2026-10-25T08:15:00.000Z'),
      confirmedAt: new Date('2026-10-25T07:30:00.000Z'),
      cancelledAt: null,
      cancellationReason: null,
      policySnapshot: {},
      createdAt: new Date('2026-10-25T07:00:00.000Z'),
      updatedAt: new Date('2026-10-25T07:30:00.000Z'),
    }
    participantsState = [
      {
        id: p1Id,
        bookingId,
        userId: buyerId,
        fullName: 'Buyer Trekker',
        phone: '0900000003',
        idDocumentNo: '079000000001',
        dateOfBirth: null,
        gender: null,
        emergencyContactName: 'Emergency Contact',
        emergencyContactPhone: '0900000099',
        medicalNotes: null,
        dietaryNotes: null,
        specialRequests: null,
        status: 'ACTIVE',
        checkinCode: 'ROTATED_QR_CODE_P1',
        checkinStatus: 'NOT_CHECKED_IN',
        checkinMethod: null,
        checkedInAt: null,
        checkedInBy: null,
        createdAt: new Date('2026-10-25T07:00:00.000Z'),
        updatedAt: new Date('2026-10-25T07:35:00.000Z'),
      },
      {
        id: p2Id,
        bookingId,
        userId: null,
        fullName: 'Companion Trekker',
        phone: '0900000005',
        idDocumentNo: '079000000002',
        dateOfBirth: null,
        gender: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        medicalNotes: null,
        dietaryNotes: null,
        specialRequests: null,
        status: 'ACTIVE',
        checkinCode: 'INITIAL_QR_CODE_P2',
        checkinStatus: 'NOT_CHECKED_IN',
        checkinMethod: null,
        checkedInAt: null,
        checkedInBy: null,
        createdAt: new Date('2026-10-25T07:00:00.000Z'),
        updatedAt: new Date('2026-10-25T07:00:00.000Z'),
      },
    ]
    invitationsState = [
      {
        id: inviteId,
        bookingParticipantId: p2Id,
        senderUserId: buyerId,
        recipientUserId: friendId,
        recipientEmailSnapshot: 'friend@trek.test',
        status: 'PENDING',
        reason: null,
        version: 1,
        expiresAt: new Date('2026-10-26T00:00:00.000Z'),
        respondedAt: null,
        createdAt: new Date('2026-10-25T07:40:00.000Z'),
        updatedAt: new Date('2026-10-25T07:40:00.000Z'),
      },
    ]
    auditLogs = []
    outboxEvents = []
  }

  const attachRelations = (p: any) => ({
    ...p,
    user: p.userId ? users.get(p.userId) ?? null : null,
    invitations: invitationsState
      .filter((i) => i.bookingParticipantId === p.id && i.status === 'PENDING')
      .map((i) => ({ ...i, recipient: users.get(i.recipientUserId) ?? null })),
    booking: {
      ...bookingState,
      user: users.get(bookingState.userId),
      trip: tripState,
      pickupPoint: { id: bookingState.pickupPointId, code: 'PK01', name: 'Bitexco', address: 'District 1' },
      returnPoint: { id: bookingState.returnPointId, code: 'PK01', name: 'Bitexco', address: 'District 1' },
    },
  })

  const formatError = (exception: unknown) => {
    const filter = new GlobalErrorFilter()
    let statusCode = 500
    let jsonBody: any = null
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, url: '/test' }),
        getResponse: () => ({
          setHeader: () => undefined,
          status: (code: number) => {
            statusCode = code
            return {
              json: (payload: any) => {
                jsonBody = payload
              },
            }
          },
        }),
      }),
    } as unknown as ArgumentsHost
    filter.catch(exception, host)
    return { statusCode, body: jsonBody }
  }

  const mockPrisma: any = {
    $transaction: async (fn: any) => fn(mockPrisma),
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ')
      if (sql.includes('clock_timestamp')) return [{ now }]
      return []
    },
    user: {
      findUnique: async ({ where }: any) => {
        if (where.id) return users.get(where.id) ?? null
        if (where.authUserId) return [...users.values()].find((u) => u.authUserId === where.authUserId) ?? null
        return null
      },
    },
    trip: {
      findUnique: async ({ where }: any) => (where.id === tripState.id ? { ...tripState } : null),
      findUniqueOrThrow: async ({ where }: any) => {
        if (where.id !== tripState.id) throw new Error('Trip not found')
        return { ...tripState }
      },
    },
    booking: {
      findMany: async () => [],
      findUnique: async ({ where }: any) => (where.id === bookingState.id ? { ...bookingState } : null),
      findUniqueOrThrow: async ({ where }: any) => {
        if (where.id !== bookingState.id) throw new Error('Booking not found')
        return {
          ...bookingState,
          trip: tripState,
          pickupPoint: { id: bookingState.pickupPointId, code: 'PK01', name: 'Bitexco', address: 'District 1' },
          returnPoint: { id: bookingState.returnPointId, code: 'PK01', name: 'Bitexco', address: 'District 1' },
          bookingParticipantsViaBookingId: participantsState
            .filter((p) => ['ACTIVE', 'NO_SHOW', 'COMPLETED'].includes(p.status))
            .map((p) => attachRelations(p)),
          invoicesViaBookingId: [],
        }
      },
      findFirst: async ({ where }: any) => {
        if (where.id && where.id !== bookingState.id) return null
        if (where.userId && where.userId !== bookingState.userId) return null
        return {
          ...bookingState,
          trip: tripState,
          pickupPoint: { id: bookingState.pickupPointId, code: 'PK01', name: 'Bitexco', address: 'District 1' },
          returnPoint: { id: bookingState.returnPointId, code: 'PK01', name: 'Bitexco', address: 'District 1' },
          participants: participantsState
            .filter((p) => ['ACTIVE', 'NO_SHOW', 'COMPLETED'].includes(p.status))
            .map((p) => attachRelations(p)),
          invoices: [],
        }
      },
      update: async ({ where, data }: any) => {
        if (where.id !== bookingState.id) throw new Error('Booking not found')
        if (data.status) bookingState.status = data.status
        if (data.version?.increment) bookingState.version += data.version.increment
        return { ...bookingState }
      },
    },
    bookingParticipant: {
      count: async ({ where }: any) => {
        if (where?.userId) return 0
        return participantsState.filter((p) => {
          if (p.status === 'CANCELLED') return false
          if (where?.checkinStatus && p.checkinStatus !== where.checkinStatus) return false
          return true
        }).length
      },
      findMany: async ({ where }: any) => {
        let rows = participantsState.filter((p) => p.status !== 'CANCELLED')
        if (where?.bookingId) rows = rows.filter((p) => p.bookingId === where.bookingId)
        return rows.map((p) => attachRelations(p))
      },
      findFirst: async ({ where }: any) => {
        const match = participantsState.find((p) => {
          if (where.id && p.id !== where.id) return false
          if (where.userId && p.userId !== where.userId) return false
          if (where.checkinCode && p.checkinCode !== where.checkinCode) return false
          if (where.booking?.tripId && bookingState.tripId !== where.booking.tripId) return false
          return true
        })
        return match ? attachRelations(match) : null
      },
      findUnique: async ({ where }: any) => {
        const match = participantsState.find((p) => {
          if (where.id && p.id !== where.id) return false
          if (where.checkinCode && p.checkinCode !== where.checkinCode) return false
          return true
        })
        return match ? attachRelations(match) : null
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const match = participantsState.find((p) => {
          if (where.id && p.id !== where.id) return false
          if (where.checkinCode && p.checkinCode !== where.checkinCode) return false
          return true
        })
        if (!match) throw new Error('Participant not found')
        return attachRelations(match)
      },
      update: async ({ where, data }: any) => {
        const idx = participantsState.findIndex((p) => p.id === where.id)
        if (idx === -1) throw new Error('Participant not found')
        participantsState[idx] = { ...participantsState[idx], ...data }
        return attachRelations(participantsState[idx])
      },
    },
    bookingParticipantInvitation: {
      findFirst: async ({ where }: any) => {
        return (
          invitationsState.find(
            (i) => i.bookingParticipantId === where.bookingParticipantId && i.status === where.status,
          ) ?? null
        )
      },
      findUnique: async ({ where }: any) => {
        return invitationsState.find((i) => i.id === where.id) ?? null
      },
      update: async ({ where, data }: any) => {
        const idx = invitationsState.findIndex((i) => i.id === where.id)
        if (idx === -1) throw new Error('Invitation not found')
        invitationsState[idx] = {
          ...invitationsState[idx],
          status: data.status ?? invitationsState[idx].status,
          reason: data.reason !== undefined ? data.reason : invitationsState[idx].reason,
          respondedAt: data.respondedAt !== undefined ? data.respondedAt : invitationsState[idx].respondedAt,
          version: invitationsState[idx].version + (data.version?.increment ?? 0),
        }
        return invitationsState[idx]
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0
        invitationsState = invitationsState.map((i) => {
          if (i.id === where.id && i.status === where.status && i.version === where.version) {
            count++
            return {
              ...i,
              status: data.status,
              reason: data.reason,
              respondedAt: data.respondedAt,
              version: i.version + (data.version?.increment ?? 0),
            }
          }
          return i
        })
        return { count }
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data)
        return data
      },
    },
    bookingOutboxEvent: {
      create: async ({ data }: any) => {
        outboxEvents.push(data)
        return data
      },
    },
  }

  beforeEach(() => {
    resetState()
  })

  beforeAll(async () => {
    resetState()
    const moduleRef = await Test.createTestingModule({
      controllers: [LeaderCheckinController, TicketsController, BookingsController],
      providers: [
        LeaderCheckinService,
        TicketsService,
        ParticipantClaimService,
        {
          provide: BookingsService,
          useValue: new BookingsService(mockPrisma as unknown as PrismaService, {} as BookingPolicyService),
        },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
    leaderController = moduleRef.get(LeaderCheckinController)
    ticketsController = moduleRef.get(TicketsController)
    bookingsController = moduleRef.get(BookingsController)
  })

  afterAll(async () => {
    await app?.close()
  })

  it('exposes checkinCode on active personal ticket and hides it once booking/ticket is cancelled', async () => {
    const activeTicket = await ticketsController.detail({ id: buyerId }, p1Id)
    expect(activeTicket).toMatchObject({
      id: p1Id,
      checkinStatus: 'NOT_CHECKED_IN',
      checkinMethod: null,
      checkedInAt: null,
      checkinCode: 'ROTATED_QR_CODE_P1',
      permissions: {
        participantActive: true,
        canCheckIn: true,
      },
    })

    // Buyer detail exposes checkinCode for own slot (p1) and unlinked companion slot (p2),
    // but hides checkinCode if p2 is claimed by another account (friendId).
    const buyerDetailBefore = await bookingsController.detail(bookingId, buyerId)
    expect(buyerDetailBefore.participants.find((p: any) => p.id === p1Id)?.checkinCode).toBe('ROTATED_QR_CODE_P1')
    expect(buyerDetailBefore.participants.find((p: any) => p.id === p2Id)?.checkinCode).toBe('INITIAL_QR_CODE_P2')

    participantsState[1].userId = friendId
    const buyerDetailAfterFriendClaim = await bookingsController.detail(bookingId, buyerId)
    expect(buyerDetailAfterFriendClaim.participants.find((p: any) => p.id === p2Id)?.checkinCode).toBeNull()

    // When booking is CANCELLED, personal ticket hides checkinCode
    bookingState.status = 'CANCELLED'
    const cancelledTicket = await ticketsController.detail({ id: buyerId }, p1Id)
    expect(cancelledTicket.checkinCode).toBeNull()
    expect(cancelledTicket.permissions.participantActive).toBe(false)
    expect(cancelledTicket.permissions.canCheckIn).toBe(false)
  })

  it('handles leader participants list, QR check-in, idempotent replay, manual check-in, booking status sync and invitation invalidation', async () => {
    // Non-owner leader gets 403 FORBIDDEN in standard GlobalErrorFilter envelope
    let forbiddenErr: unknown
    try {
      await leaderController.listParticipants(
        { id: otherLeaderId },
        tripId,
        new ZodValidationPipe(leaderParticipantsQuerySchema).transform({}, { type: 'query' }) as any,
      )
    } catch (err) {
      forbiddenErr = err
    }
    const formattedForbidden = formatError(forbiddenErr)
    expect(formattedForbidden.statusCode).toBe(403)
    expect(formattedForbidden.body.error.code).toBe('FORBIDDEN')

    // Trip leader lists participants and attendance summary
    const listRes = await leaderController.listParticipants(
      { id: leaderId },
      tripId,
      new ZodValidationPipe(leaderParticipantsQuerySchema).transform({}, { type: 'query' }) as any,
    )
    expect(listRes.summary).toMatchObject({
      totalParticipants: 2,
      checkedInCount: 0,
      notCheckedInCount: 2,
      noShowCount: 0,
      capacity: 15,
      minPax: 5,
      progressPercent: 0,
    })

    // Invalid QR code returns 422 CHECKIN_TOKEN_INVALID
    let invalidQrErr: unknown
    try {
      await leaderController.checkin(
        { id: leaderId },
        tripId,
        new ZodValidationPipe(leaderCheckinBodySchema).transform(
          { checkinCode: 'WRONG_OR_ROTATED_OLD_CODE', method: 'QR' },
          { type: 'body' },
        ) as any,
      )
    } catch (err) {
      invalidQrErr = err
    }
    const formattedInvalidQr = formatError(invalidQrErr)
    expect(formattedInvalidQr.statusCode).toBe(422)
    expect(formattedInvalidQr.body.error.code).toBe('CHECKIN_TOKEN_INVALID')

    // First QR scan of p1 transitions booking to PARTIAL_CHECKIN
    const qrScan1 = await leaderController.checkin(
      { id: leaderId },
      tripId,
      new ZodValidationPipe(leaderCheckinBodySchema).transform(
        { checkinCode: 'ROTATED_QR_CODE_P1', method: 'QR' },
        { type: 'body' },
      ) as any,
    )
    expect(qrScan1).toMatchObject({
      alreadyCheckedIn: false,
      replayed: false,
      participant: {
        id: p1Id,
        checkinStatus: 'CHECKED_IN',
        checkinMethod: 'QR',
        bookingStatus: 'PARTIAL_CHECKIN',
      },
      summary: {
        totalParticipants: 2,
        checkedInCount: 1,
        notCheckedInCount: 1,
        noShowCount: 0,
      },
    })
    expect(bookingState.status).toBe('PARTIAL_CHECKIN')
    expect(bookingState.version).toBe(2)

    // Re-scanning same QR code is idempotent (alreadyCheckedIn: true, replayed: true)
    const qrScanReplay = await leaderController.checkin(
      { id: leaderId },
      tripId,
      new ZodValidationPipe(leaderCheckinBodySchema).transform(
        { checkinCode: 'ROTATED_QR_CODE_P1', method: 'QR' },
        { type: 'body' },
      ) as any,
    )
    expect(qrScanReplay).toMatchObject({
      alreadyCheckedIn: true,
      replayed: true,
    })
    expect(bookingState.version).toBe(2)

    // Manual check-in of p2 transitions booking to CHECKED_IN and invalidates p2's PENDING invitation
    const manualRes = await leaderController.manualParticipantCheckin(
      { id: leaderId },
      tripId,
      p2Id,
      new ZodValidationPipe(manualParticipantCheckinBodySchema).transform(
        { checkinStatus: 'CHECKED_IN' },
        { type: 'body' },
      ) as any,
    )
    expect(manualRes).toMatchObject({
      alreadyCheckedIn: false,
      replayed: false,
      participant: {
        id: p2Id,
        checkinStatus: 'CHECKED_IN',
        checkinMethod: 'MANUAL',
        bookingStatus: 'CHECKED_IN',
      },
      summary: {
        totalParticipants: 2,
        checkedInCount: 2,
        notCheckedInCount: 0,
        noShowCount: 0,
      },
    })
    expect(bookingState.status).toBe('CHECKED_IN')
    expect(invitationsState[0].status).toBe('INVALIDATED')
    expect(invitationsState[0].reason).toBe('PARTICIPANT_NOT_ELIGIBLE')

    // Validate OpenAPI schemas with Ajv
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth(undefined, 'bearer').build())
    const ajv = new Ajv({ strict: false, nullable: true })
    for (const [path, method, body] of [
      ['/leader/public-trips/{id}/participants', 'get', listRes],
      ['/leader/trips/{id}/checkin', 'post', qrScan1],
      ['/leader/public-trips/{id}/participants/{participantId}/checkin', 'post', manualRes],
    ] as const) {
      const op = doc.paths[path]![method]!
      const schema = (op.responses['200'] as any).content['application/json'].schema
      const validate = ajv.compile(schema)
      validate(body)
      expect(validate.errors).toBeNull()
    }
  })
})
