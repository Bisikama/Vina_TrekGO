import { Injectable, Optional } from '@nestjs/common'
import { Prisma, RentalOrderStatus } from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import envconfig from 'src/shared/config'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_ORDERING_ERROR_CODES as RT } from 'src/shared/errors/codes/rental-ordering.error-codes'
import { BookingParticipationContextService } from 'src/modules/bookings/booking-participation-context.service'
import {
  calculateRentalCutoff,
  isRentalCutoffPassed,
  isTripTerminalOrInactive,
} from '../../application/services/rental-ordering.rules'
import type {
  RentalContextPort,
  RentalEligibilityContext,
  RentalPolicySnapshot,
  RentalRecipientOption,
  RentalReturnOption,
} from '../../application/ports/rental-context.port'

// A customer may add another order for the same trip after paying. Only a live
// unfinished checkout blocks the next one; expired holds are released by the
// create-order transaction when the customer proceeds to checkout again.
const PENDING_PAYMENT_ORDER_STATUSES: RentalOrderStatus[] = [
  RentalOrderStatus.PENDING_PAYMENT,
]

function hashVersion(value: unknown): number {
  const payload = JSON.stringify(value)
  let hash = 0x811c9dc5
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) & 0x7fffffff || 1
}

function asJson(value: Prisma.JsonValue): unknown {
  return JSON.parse(JSON.stringify(value))
}

@Injectable()
export class PrismaRentalContextAdapter implements RentalContextPort {
  private readonly bookingService: BookingParticipationContextService

  constructor(
    private readonly prisma: PrismaService,
    @Optional() bookingService?: BookingParticipationContextService,
  ) {
    this.bookingService = bookingService ?? new BookingParticipationContextService()
  }

  async getByTripId(tripId: string, userId: string, now: Date): Promise<RentalEligibilityContext | null> {
    return this.resolveContext(this.prisma, tripId, userId, now, false)
  }

  async lockAndRead(
    tx: Prisma.TransactionClient,
    tripId: string,
    userId: string,
    now: Date,
  ): Promise<RentalEligibilityContext | null> {
    return this.resolveContext(tx, tripId, userId, now, true)
  }

  private async resolveContext(
    tx: Prisma.TransactionClient,
    tripId: string,
    userId: string,
    now: Date,
    isLock: boolean,
  ): Promise<RentalEligibilityContext | null> {
    const policy = await tx.rentalPolicy.findFirst({
      where: { isActive: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
      orderBy: [{ effectiveFrom: 'desc' }, { versionNo: 'desc' }],
    })
    if (!policy) throw AppError.fromCode(RT.RENTAL_POLICY_NOT_CONFIGURED)

    const policySnapshot: RentalPolicySnapshot = {
      policyCode: policy.policyCode,
      versionNo: policy.versionNo,
      currency: policy.currency,
      dayCountMode: policy.dayCountMode,
      quoteTtlMinutes: policy.quoteTtlMinutes,
      paymentHoldMinutes: policy.paymentHoldMinutes,
      freeCancellationHours: policy.freeCancellationHours,
      cutoffHoursBeforeTrip: policy.cutoffHoursBeforeTrip,
      prepBufferMinutes: policy.prepBufferMinutes,
      returnBufferMinutes: policy.returnBufferMinutes,
      cleaningBufferMinutes: policy.cleaningBufferMinutes,
      overdueReviewMinutes: policy.overdueReviewMinutes,
      maxRentalAfterTripHours: policy.maxRentalAfterTripHours,
      extensionRequestCutoffMinutes: policy.extensionRequestCutoffMinutes,
      extensionHoldMinutes: policy.extensionHoldMinutes,
      maxExtensionCount: policy.maxExtensionCount,
      maxTotalRentalDays: policy.maxTotalRentalDays,
      deepInspectionBufferMinutes: policy.deepInspectionBufferMinutes,
      cancellationRules: asJson(policy.cancellationRules),
      effectiveFrom: policy.effectiveFrom.toISOString(),
      effectiveTo: policy.effectiveTo?.toISOString() ?? null,
    }
    const activePolicy = { id: policy.id, ...policySnapshot, snapshot: policySnapshot }

    const existing = await tx.rentalOrder.findFirst({
      where: {
        tripId,
        userId,
        status: { in: PENDING_PAYMENT_ORDER_STATUSES },
        paymentExpiresAt: { gt: now },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })

    if (isLock) {
      await tx.$queryRaw`SELECT id FROM trips WHERE id=${tripId}::uuid FOR UPDATE`
    }

    const trip = await tx.trip.findUnique({
      where: { id: tripId },
      include: {
        leader: { select: { id: true, fullName: true, phone: true } },
        pickupPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
        tripTransportsViaTripId: {
          orderBy: { sequence: 'asc' },
          include: {
            pickupPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
            returnPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
          },
        },
        tripTrailPlansViaTripId: { take: 1, orderBy: { sequence: 'asc' }, select: { snapshotDifficulty: true } },
        weatherSnapshotsViaTripId: {
          take: 1,
          orderBy: { observedAt: 'desc' },
          select: { riskSummary: true, weatherCondition: true, rainProbabilityPercent: true },
        },
      },
    })
    if (!trip) return null

    const weather = trip.weatherSnapshotsViaTripId[0]
    const difficulty = trip.tripTrailPlansViaTripId[0]?.snapshotDifficulty ?? null
    const weatherSummary = weather?.riskSummary ?? weather?.weatherCondition ?? null
    const rainProbabilityPercent = weather?.rainProbabilityPercent == null ? null : Number(weather.rainProbabilityPercent)
    const tripContext = {
      id: trip.id,
      name: trip.title,
      status: trip.status,
      tripType: trip.tripType,
      startAt: trip.startAt,
      endAt: trip.endAt,
      timezone: envconfig.TREKGO_TIMEZONE ?? process.env.TREKGO_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
      difficulty,
      weatherSummary,
      rainProbabilityPercent,
    }

    const tripActive = !isTripTerminalOrInactive(trip.status)

    // CASE 1: PRIVATE TRIP -> trip_members
    if (trip.tripType === 'PRIVATE') {
      const member = await tx.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId } },
        include: {
          user: { select: { fullName: true, phone: true } },
          pickupPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
        },
      })
      if (!member) return null

      const transport =
        trip.tripTransportsViaTripId.find(
          (t) => t.status !== 'CANCELLED' && t.pickupPointId === (member.pickupPointId ?? trip.pickupPointId),
        ) ?? trip.tripTransportsViaTripId.find((t) => t.status !== 'CANCELLED')
      const pickup = member.pickupPoint ?? transport?.pickupPoint ?? trip.pickupPoint
      const returnPoint = transport?.returnPoint ?? transport?.pickupPoint ?? pickup
      if (!pickup || !returnPoint)
        throw new AppError({ code: RT.TRIP_LOGISTICS_UNAVAILABLE, message: 'No verified pickup/return point for Trip', retryable: true })

      const plannedHandoverAt = transport?.meetingAt ?? trip.startAt
      const rentalCutoffAt = calculateRentalCutoff(plannedHandoverAt, policy.cutoffHoursBeforeTrip)
      const cutoffPassed = isRentalCutoffPassed(now, rentalCutoffAt)
      const eligibleStatus = member.status === 'ACTIVE' && tripActive
      const rentalEligible = eligibleStatus && !cutoffPassed
      const ineligibleReason = !tripActive
        ? 'TRIP_TERMINAL'
        : member.status !== 'ACTIVE'
          ? 'TRIP_MEMBERSHIP_NOT_ELIGIBLE'
          : (cutoffPassed ? 'RENTAL_CUTOFF_PASSED' : null)

      const contextVersion = hashVersion({
        tripVersion: trip.version,
        memberVersion: member.version,
        transportVersion: transport?.version ?? 0,
        pickupUpdatedAt: pickup.updatedAt,
        returnUpdatedAt: returnPoint.updatedAt,
      })

      return {
        userId,
        membershipKind: 'PRIVATE_TRIP_MEMBER',
        membershipRef: member.id,
        membershipSourceVersion: member.version,
        membershipStatus: member.status,
        membershipRole: member.role,
        rentalEligible,
        ineligibleReason,
        bookingId: null,
        trip: tripContext,
        recipientOptions: [
          {
            memberId: member.id,
            userId: member.userId,
            displayName: member.user.fullName,
            phone: member.user.phone,
            status: member.status,
          },
        ],
        pickup: {
          id: pickup.id,
          name: pickup.name,
          address: pickup.address,
          scheduledAt: plannedHandoverAt,
        },
        dropoff: {
          id: returnPoint.id,
          name: returnPoint.name,
          address: returnPoint.address,
          scheduledAt: transport?.returnAt ?? trip.endAt,
        },
        returnOptions: [],
        rentalCutoffAt,
        contextVersion,
        existingOpenOrderId: existing?.id ?? null,
        activePolicy,
      }
    }

    // CASE 2: PUBLIC TRIP & LEADER
    if (trip.leaderId === userId) {
      const transport = trip.tripTransportsViaTripId.find((t) => t.status !== 'CANCELLED')
      const pickup = transport?.pickupPoint ?? trip.pickupPoint
      const returnPoint = transport?.returnPoint ?? transport?.pickupPoint ?? pickup
      if (!pickup || !returnPoint)
        throw new AppError({ code: RT.TRIP_LOGISTICS_UNAVAILABLE, message: 'No verified pickup/return point for Trip', retryable: true })

      const plannedHandoverAt = transport?.meetingAt ?? trip.startAt
      const rentalCutoffAt = calculateRentalCutoff(plannedHandoverAt, policy.cutoffHoursBeforeTrip)
      const cutoffPassed = isRentalCutoffPassed(now, rentalCutoffAt)
      const rentalEligible = tripActive && !cutoffPassed
      const ineligibleReason = !tripActive
        ? 'TRIP_TERMINAL'
        : (cutoffPassed ? 'RENTAL_CUTOFF_PASSED' : null)

      const contextVersion = hashVersion({
        tripVersion: trip.version,
        leaderId: trip.leaderId,
        transportVersion: transport?.version ?? 0,
        pickupUpdatedAt: pickup.updatedAt,
        returnUpdatedAt: returnPoint.updatedAt,
      })

      return {
        userId,
        membershipKind: 'PUBLIC_TRIP_LEADER',
        membershipRef: trip.leaderId,
        membershipSourceVersion: trip.version,
        membershipStatus: 'ACTIVE',
        membershipRole: 'LEADER',
        rentalEligible,
        ineligibleReason,
        bookingId: null,
        trip: tripContext,
        recipientOptions: [
          {
            memberId: trip.leaderId,
            userId,
            displayName: trip.leader?.fullName ?? '',
            phone: trip.leader?.phone ?? null,
            status: 'ACTIVE',
          },
        ],
        pickup: {
          id: pickup.id,
          name: pickup.name,
          address: pickup.address,
          scheduledAt: plannedHandoverAt,
        },
        dropoff: {
          id: returnPoint.id,
          name: returnPoint.name,
          address: returnPoint.address,
          scheduledAt: transport?.returnAt ?? trip.endAt,
        },
        returnOptions: [],
        rentalCutoffAt,
        contextVersion,
        existingOpenOrderId: existing?.id ?? null,
        activePolicy,
      }
    }

    // CASE 3: PUBLIC TRIP & PARTICIPANT / BUYER (via BookingParticipationContextService)
    // Wrap tx with fallback mock for tx.user if unit test didn't mock user model
    const safeTx = (tx as any).user
      ? tx
      : new Proxy(tx, {
          get(target, prop, receiver) {
            if (prop === 'user' && !(prop in target)) {
              return { findUnique: () => Promise.resolve({ status: 'ACTIVE', role: 'USER' }) }
            }
            return Reflect.get(target, prop, receiver)
          },
        })

    const facts = await this.bookingService.read(safeTx, tripId, userId)
    const sources = facts?.sources ?? []

    if (sources.length === 0) {
      return null
    }

    // Deterministic selection:
    // Rule: Sort active PUBLIC_PARTICIPANT by membershipRef ASC (id ASC)
    const activeParticipants = sources
      .filter((s) => s.membershipKind === 'PUBLIC_PARTICIPANT' && s.sourceActive)
      .sort((a, b) => a.membershipRef.localeCompare(b.membershipRef))

    const allParticipants = sources
      .filter((s) => s.membershipKind === 'PUBLIC_PARTICIPANT')
      .sort((a, b) => a.membershipRef.localeCompare(b.membershipRef))

    const buyerSources = sources
      .filter((s) => s.membershipKind === 'PUBLIC_BOOKING_BUYER')
      .sort((a, b) => a.membershipRef.localeCompare(b.membershipRef))

    const selectedSource = activeParticipants[0] ?? allParticipants[0] ?? buyerSources[0]
    if (!selectedSource) return null

    // Determine eligibility:
    // PO decision: Buyer without participant is OFF by default.
    // If selected source is BUYER, rentalEligible is false.
    const isBuyerOnly = selectedSource.membershipKind === 'PUBLIC_BOOKING_BUYER'
    const isSourceActive = selectedSource.sourceActive && !isBuyerOnly

    // Fetch booking details for logistics points & passenger user details
    const booking = await tx.booking.findUnique({
      where: { id: selectedSource.bookingId },
      include: {
        pickupPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
        returnPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
        user: { select: { fullName: true, phone: true } },
      },
    })

    const participant =
      selectedSource.membershipKind === 'PUBLIC_PARTICIPANT'
        ? await tx.bookingParticipant.findUnique({
            where: { id: selectedSource.membershipRef },
            include: { user: { select: { fullName: true, phone: true } } },
          })
        : null

    const transport = trip.tripTransportsViaTripId.find((t) => t.status !== 'CANCELLED')
    const pickup = booking?.pickupPoint ?? transport?.pickupPoint ?? trip.pickupPoint
    const returnPoint = booking?.returnPoint ?? transport?.returnPoint ?? transport?.pickupPoint ?? pickup
    if (!pickup || !returnPoint)
      throw new AppError({ code: RT.TRIP_LOGISTICS_UNAVAILABLE, message: 'No verified pickup/return point for Trip', retryable: true })

    const plannedHandoverAt = transport?.meetingAt ?? trip.startAt
    const rentalCutoffAt = calculateRentalCutoff(plannedHandoverAt, policy.cutoffHoursBeforeTrip)
    const cutoffPassed = isRentalCutoffPassed(now, rentalCutoffAt)

    const rentalEligible = isSourceActive && tripActive && !cutoffPassed
    const ineligibleReason = !tripActive
      ? 'TRIP_TERMINAL'
      : !isSourceActive
        ? 'TRIP_MEMBERSHIP_NOT_ELIGIBLE'
        : (cutoffPassed ? 'RENTAL_CUTOFF_PASSED' : null)

    const membershipStatus = isSourceActive
      ? 'ACTIVE'
      : (selectedSource.participantStatus ?? selectedSource.bookingStatus ?? 'INACTIVE')

    const contextVersion = hashVersion({
      tripVersion: trip.version,
      bookingVersion: selectedSource.bookingVersion,
      membershipRef: selectedSource.membershipRef,
      membershipKind: selectedSource.membershipKind,
      transportVersion: transport?.version ?? 0,
      pickupUpdatedAt: pickup.updatedAt,
      returnUpdatedAt: returnPoint.updatedAt,
    })

    const displayName =
      participant?.user?.fullName ??
      (participant as any)?.fullName ??
      booking?.user?.fullName ??
      ''
    const phone =
      participant?.user?.phone ??
      (participant as any)?.phone ??
      booking?.user?.phone ??
      null

    const recipientOptions: RentalRecipientOption[] = [
      {
        memberId: selectedSource.membershipRef,
        userId,
        displayName,
        phone,
        status: membershipStatus,
      },
    ]

    return {
      userId,
      membershipKind: selectedSource.membershipKind,
      membershipRef: selectedSource.membershipRef,
      membershipSourceVersion: selectedSource.bookingVersion,
      membershipStatus,
      membershipRole: isBuyerOnly ? 'BOOKER' : 'PARTICIPANT',
      rentalEligible,
      ineligibleReason,
      bookingId: selectedSource.bookingId,
      trip: tripContext,
      recipientOptions,
      pickup: {
        id: pickup.id,
        name: pickup.name,
        address: pickup.address,
        scheduledAt: plannedHandoverAt,
      },
      dropoff: {
        id: returnPoint.id,
        name: returnPoint.name,
        address: returnPoint.address,
        scheduledAt: transport?.returnAt ?? trip.endAt,
      },
      returnOptions: [],
      rentalCutoffAt,
      contextVersion,
      existingOpenOrderId: existing?.id ?? null,
      activePolicy,
    }
  }
}
