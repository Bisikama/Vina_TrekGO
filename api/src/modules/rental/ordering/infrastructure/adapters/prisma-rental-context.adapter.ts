import { Injectable } from '@nestjs/common'
import { Prisma, RentalOrderStatus } from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_ORDERING_ERROR_CODES as RT } from 'src/shared/errors/codes/rental-ordering.error-codes'
import { VALID_PUBLIC_BOOKING_STATUSES } from '../../../shared/public-booking-membership'
import type {
  RentalContextPort,
  RentalEligibilityContext,
  RentalPolicySnapshot,
  RentalRecipientOption,
  RentalReturnOption,
} from '../../application/ports/rental-context.port'

const OPEN_STATUSES: RentalOrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'PREPARING',
  'READY_FOR_HANDOVER',
  'ACTIVE',
  'RETURN_PENDING',
  'RETURN_PROCESSING',
] as RentalOrderStatus[]
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
function parseDate(value: unknown, field: string): Date {
  const date = new Date(typeof value === 'string' || typeof value === 'number' ? value : NaN)
  if (!Number.isFinite(date.getTime()))
    throw new AppError({
      code: 'AREA_A_CONTEXT_UNAVAILABLE',
      message: `Invalid ${field} in TripRentalContext`,
      retryable: true,
    })
  return date
}
@Injectable()
export class PrismaRentalContextAdapter implements RentalContextPort {
  constructor(private readonly prisma: PrismaService) {}

  async getByTripId(tripId: string, userId: string, now: Date): Promise<RentalEligibilityContext | null> {
    const policy = await this.prisma.rentalPolicy.findFirst({
      where: { isActive: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
      orderBy: [{ effectiveFrom: 'desc' }, { versionNo: 'desc' }],
    })
    //thiết lập policy
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
    const existing = await this.prisma.rentalOrder.findFirst({
      where: { tripId, userId, status: { in: OPEN_STATUSES } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })
    // Production calls Area A's authoritative resolver; do not silently fall back to a stale DB on HTTP errors.
    if (process.env.AREA_A_INTERNAL_BASE_URL) {
      const base = process.env.AREA_A_INTERNAL_BASE_URL.replace(/\/$/, '')
      const response = await fetch(
        `${base}/internal/trips/${tripId}/rental-context?userId=${encodeURIComponent(userId)}`,
        {
          headers: { 'x-api-key': process.env.RENTAL_INTEGRATION_API_KEY ?? '' },
          signal: AbortSignal.timeout(Number(process.env.RENTAL_HTTP_TIMEOUT_MS ?? '5000')),
        },
      )
      if (response.status === 404) return null
      if (!response.ok)
        throw new AppError({
          code: 'AREA_A_CONTEXT_UNAVAILABLE',
          message: `Area A Trip context returned ${response.status}`,
          retryable: response.status >= 500,
        })
      const envelope = await response.json()
      const data = envelope.data ?? envelope
      if (data.tripId !== tripId || data.userId !== userId || !String(data.membershipRef ?? data.membershipId ?? ''))
        throw new AppError({ code: 'AREA_A_CONTEXT_UNAVAILABLE', message: 'Trip context identity/membership mismatch' })
      if (!Number.isSafeInteger(Number(data.contextVersion)) || Number(data.contextVersion) < 1)
        throw new AppError({ code: 'AREA_A_CONTEXT_UNAVAILABLE', message: 'Trip context version missing or invalid' })
      const options: RentalReturnOption[] = (data.returnOptions ?? []).map((o: any) => ({
        id: String(o.returnOptionId ?? o.id),
        pointId: String(o.pointId ?? o.point?.id),
        pointName: String(o.point?.name ?? o.pointName ?? ''),
        method: String(o.method),
        available: o.available === true,
        windowStart: parseDate(o.timeWindow?.startAt ?? o.windowStart, 'returnOption.windowStart'),
        windowEnd: parseDate(o.timeWindow?.endAt ?? o.windowEnd, 'returnOption.windowEnd'),
      }))
      const pickup = data.pickupPoint ?? data.pickup
      const dropoff = data.baseReturnPoint ?? data.dropoff
      if (!pickup?.id || !dropoff?.id)
        throw new AppError({ code: 'AREA_A_CONTEXT_UNAVAILABLE', message: 'Trip delivery point missing' })
      return {
        userId,
        membershipRef: String(data.membershipRef ?? data.membershipId ?? ''),
        membershipStatus: String(data.membershipStatus ?? 'UNKNOWN'),
        membershipRole: String(data.membershipRole ?? 'MEMBER'),
        rentalEligible: data.rentalEligible === true,
        ineligibleReason: data.ineligibleReason ?? null,
        bookingId: typeof data.bookingId === 'string' ? data.bookingId : null,
        trip: {
          id: tripId,
          name: String(data.trip?.name ?? data.tripName ?? ''),
          status: String(data.tripStatus ?? data.trip?.status),
          tripType: String(data.tripType ?? data.trip?.tripType),
          startAt: parseDate(data.tripStartAt ?? data.trip?.startAt, 'tripStartAt'),
          endAt: parseDate(data.tripEndAt ?? data.trip?.endAt, 'tripEndAt'),
          timezone: String(data.timezone ?? 'Asia/Ho_Chi_Minh'),
          difficulty: data.difficulty ?? null,
          weatherSummary: data.weatherSummary ?? null,
          rainProbabilityPercent: data.rainProbabilityPercent ?? null,
        },
        recipientOptions: (
          data.recipientOptions ?? [
            {
              memberId: data.membershipRef ?? data.membershipId,
              userId,
              displayName: data.displayName ?? '',
              status: data.membershipStatus,
            },
          ]
        ).map((m: any) => ({
          memberId: String(m.memberId ?? m.membershipRef ?? m.id),
          userId: String(m.userId),
          displayName: String(m.displayName ?? ''),
          phone: m.phone ?? null,
          status: String(m.status),
        })),
        pickup: {
          id: String(pickup.id),
          name: String(pickup.name ?? ''),
          address: String(pickup.address ?? ''),
          scheduledAt: parseDate(data.plannedHandoverAt, 'plannedHandoverAt'),
        },
        dropoff: {
          id: String(dropoff.id),
          name: String(dropoff.name ?? ''),
          address: String(dropoff.address ?? ''),
          scheduledAt: parseDate(data.plannedReturnAt, 'plannedReturnAt'),
        },
        returnOptions: options,
        rentalCutoffAt: parseDate(data.rentalCutoffAt, 'rentalCutoffAt'),
        contextVersion: Number(data.contextVersion),
        existingOpenOrderId: existing?.id ?? null,
        activePolicy,
      }
    }
    // Cầu nối nội bộ (monolith / dev bridge): Phân giải ngữ cảnh đa hình giữa Thành viên Private Trip, Leader Public Trip, và Khách hàng Public Trip (Chủ đơn đặt / Người đi cùng).
    const trip = await this.prisma.trip.findUnique({
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
      timezone: process.env.TREKGO_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
      difficulty,
      weatherSummary,
      rainProbabilityPercent,
    }

    // TRƯỜNG HỢP 1: CHUYẾN ĐI RIÊNG TƯ (PRIVATE TRIP) -> Tra cứu bảng trip_members
    if (trip.tripType === 'PRIVATE') {
      const member = await this.prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId } },
        include: {
          user: { select: { fullName: true, phone: true } },
          pickupPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
        },
      })
      if (!member) return null

      // Xác định phương tiện di chuyển và điểm tập trung/trả đồ tương ứng
      const transport =
        trip.tripTransportsViaTripId.find(
          (t) => t.status !== 'CANCELLED' && t.pickupPointId === (member.pickupPointId ?? trip.pickupPointId),
        ) ?? trip.tripTransportsViaTripId.find((t) => t.status !== 'CANCELLED')
      const pickup = member.pickupPoint ?? transport?.pickupPoint ?? trip.pickupPoint
      const returnPoint = transport?.returnPoint ?? transport?.pickupPoint ?? pickup
      if (!pickup || !returnPoint)
        throw new AppError({ code: 'TRIP_LOGISTICS_UNAVAILABLE', message: 'No verified pickup/return point for Trip' })

      // Điều kiện hợp lệ: Thành viên ACTIVE và chuyến đi không bị huỷ hay kết thúc
      const eligibleStatus =
        member.status === 'ACTIVE' &&
        !['DRAFT', 'CANCEL_PENDING', 'CANCELLED', 'INTERRUPTED', 'COMPLETED'].includes(trip.status)
      const rentalCutoffAt = new Date(
        (transport?.meetingAt ?? trip.startAt).getTime() - policy.cutoffHoursBeforeTrip * 3_600_000,
      )
      const cutoffPassed = now.getTime() >= rentalCutoffAt.getTime()
      const rentalEligible = eligibleStatus && !cutoffPassed
      const ineligibleReason = !eligibleStatus
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
        membershipRef: member.id,
        membershipStatus: member.status,
        membershipRole: member.role,
        rentalEligible,
        ineligibleReason,
        bookingId: null, // Chuyến đi Private không phát sinh đơn đặt vé Booking
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
          scheduledAt: transport?.meetingAt ?? trip.startAt,
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
    
    // TRƯỜNG HỢP 2: CHUYẾN ĐI CÔNG KHAI (PUBLIC TRIP) & NGƯỜI DÙNG LÀ TRƯỞNG ĐOÀN (LEADER)
    if (trip.leaderId === userId) {
      const transport = trip.tripTransportsViaTripId.find((t) => t.status !== 'CANCELLED')
      const pickup = transport?.pickupPoint ?? trip.pickupPoint
      const returnPoint = transport?.returnPoint ?? transport?.pickupPoint ?? pickup
      if (!pickup || !returnPoint)
        throw new AppError({ code: 'TRIP_LOGISTICS_UNAVAILABLE', message: 'No verified pickup/return point for Trip' })

      const eligibleStatus =
        !['DRAFT', 'CANCEL_PENDING', 'CANCELLED', 'INTERRUPTED', 'COMPLETED'].includes(trip.status)
      const rentalCutoffAt = new Date(
        (transport?.meetingAt ?? trip.startAt).getTime() - policy.cutoffHoursBeforeTrip * 3_600_000,
      )
      const cutoffPassed = now.getTime() >= rentalCutoffAt.getTime()
      const rentalEligible = eligibleStatus && !cutoffPassed
      const ineligibleReason = !eligibleStatus
        ? 'TRIP_MEMBERSHIP_NOT_ELIGIBLE'
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
        membershipRef: trip.leaderId,
        membershipStatus: 'ACTIVE',
        membershipRole: 'LEADER',
        rentalEligible,
        ineligibleReason,
        bookingId: null, // Leader là người tổ chức chuyến đi, không đặt vé qua Booking
        trip: tripContext,
        recipientOptions: [
          // Tuân thủ Policy v1.5.2 Bảng 1: Chỉ cho phép Leader nhận thiết bị cho chính mình (không gom đồ cho cả đoàn)
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
          scheduledAt: transport?.meetingAt ?? trip.startAt,
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

    // TRƯỜNG HỢP 3: CHUYẾN ĐI CÔNG KHAI (PUBLIC TRIP) & NGƯỜI DÙNG LÀ KHÁCH HÀNG
    // Tra cứu danh sách BookingParticipant của chính authenticated userId trên chuyến đi này
    const participants = await this.prisma.bookingParticipant.findMany({
      where: {
        userId,
        booking: { tripId },
      },
      include: {
        user: { select: { fullName: true, phone: true } },
        booking: {
          include: {
            user: { select: { fullName: true, phone: true } },
            pickupPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
            returnPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
          },
        },
      },
      orderBy: [
        { booking: { createdAt: 'desc' } },
        { createdAt: 'desc' },
      ],
    })

    const activeParticipant = participants.find(
      (p) => VALID_PUBLIC_BOOKING_STATUSES.includes(p.booking.status) && p.status === 'ACTIVE',
    )
    if (!activeParticipant) {
      // Booking owners can rent even when Area A left participant.userId null.
      const bookingInclude = {
        user: { select: { fullName: true, phone: true } },
        pickupPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
        returnPoint: { select: { id: true, name: true, address: true, updatedAt: true } },
      } as const
      const confirmedBooking = await this.prisma.booking.findFirst({
        where: { tripId, userId, status: { in: VALID_PUBLIC_BOOKING_STATUSES } },
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
      })
      const userBooking = confirmedBooking ?? (participants.length === 0
        ? await this.prisma.booking.findFirst({
            where: { tripId, userId },
            include: bookingInclude,
            orderBy: { createdAt: 'desc' },
          })
        : null)

      if (!userBooking) {
        if (participants.length === 0) return null
      } else {
        const transport = trip.tripTransportsViaTripId.find((t) => t.status !== 'CANCELLED')
        const pickup = userBooking.pickupPoint ?? transport?.pickupPoint ?? trip.pickupPoint
        const returnPoint = userBooking.returnPoint ?? transport?.returnPoint ?? transport?.pickupPoint ?? pickup
        if (!pickup || !returnPoint)
          throw new AppError({ code: 'TRIP_LOGISTICS_UNAVAILABLE', message: 'No verified pickup/return point for Trip' })

        const rentalCutoffAt = new Date(
          (transport?.meetingAt ?? trip.startAt).getTime() - policy.cutoffHoursBeforeTrip * 3_600_000,
        )
        const bookingConfirmed = VALID_PUBLIC_BOOKING_STATUSES.includes(userBooking.status)
        const tripActive = !['DRAFT', 'CANCEL_PENDING', 'CANCELLED', 'INTERRUPTED', 'COMPLETED'].includes(trip.status)
        const cutoffPassed = now.getTime() >= rentalCutoffAt.getTime()
        const rentalEligible = bookingConfirmed && tripActive && !cutoffPassed
        const contextVersion = hashVersion({
          tripVersion: trip.version,
          bookingVersion: userBooking.version,
          transportVersion: transport?.version ?? 0,
          pickupUpdatedAt: pickup.updatedAt,
          returnUpdatedAt: returnPoint.updatedAt,
        })

        return {
          userId,
          membershipRef: userBooking.id,
          membershipStatus: bookingConfirmed ? 'ACTIVE' : userBooking.status,
          membershipRole: 'BOOKER',
          rentalEligible,
          ineligibleReason: !bookingConfirmed || !tripActive
            ? 'TRIP_MEMBERSHIP_NOT_ELIGIBLE'
            : (cutoffPassed ? 'RENTAL_CUTOFF_PASSED' : null),
          bookingId: userBooking.id,
          trip: tripContext,
          recipientOptions: [{
            memberId: userBooking.id,
            userId,
            displayName: userBooking.user.fullName,
            phone: userBooking.user.phone,
            status: bookingConfirmed ? 'ACTIVE' : userBooking.status,
          }],
          pickup: {
            id: pickup.id,
            name: pickup.name,
            address: pickup.address,
            scheduledAt: transport?.meetingAt ?? trip.startAt,
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

    // Chọn canonical participation an toàn và rõ ràng:
    // Ưu tiên bản ghi participant ACTIVE nằm trong đơn booking hợp lệ (CONFIRMED, PARTIAL_CHECKIN, CHECKED_IN, COMPLETED)
    const canonical = activeParticipant ?? participants[0]

    const transport = trip.tripTransportsViaTripId.find((t) => t.status !== 'CANCELLED')
    const pickup = canonical.booking.pickupPoint ?? transport?.pickupPoint ?? trip.pickupPoint
    const returnPoint = canonical.booking.returnPoint ?? transport?.returnPoint ?? transport?.pickupPoint ?? pickup
    if (!pickup || !returnPoint)
      throw new AppError({ code: 'TRIP_LOGISTICS_UNAVAILABLE', message: 'No verified pickup/return point for Trip' })

    const rentalCutoffAt = new Date(
      (transport?.meetingAt ?? trip.startAt).getTime() - policy.cutoffHoursBeforeTrip * 3_600_000,
    )

    const isBookingConfirmed = VALID_PUBLIC_BOOKING_STATUSES.includes(canonical.booking.status)
    const isParticipantActive = canonical.status === 'ACTIVE'
    const isTripActive = !['DRAFT', 'CANCEL_PENDING', 'CANCELLED', 'INTERRUPTED', 'COMPLETED'].includes(trip.status)
    const isCutoffPassed = now.getTime() >= rentalCutoffAt.getTime()

    const rentalEligible = isBookingConfirmed && isParticipantActive && isTripActive && !isCutoffPassed
    const ineligibleReason = !isBookingConfirmed || !isParticipantActive || !isTripActive
      ? 'TRIP_MEMBERSHIP_NOT_ELIGIBLE'
      : (isCutoffPassed ? 'RENTAL_CUTOFF_PASSED' : null)

    const membershipStatus = (isBookingConfirmed && isParticipantActive)
      ? 'ACTIVE'
      : (canonical.status !== 'ACTIVE' ? canonical.status : canonical.booking.status)

    const contextVersion = hashVersion({
      tripVersion: trip.version,
      bookingVersion: canonical.booking.version,
      participantId: canonical.id,
      participantStatus: canonical.status,
      transportVersion: transport?.version ?? 0,
      pickupUpdatedAt: pickup.updatedAt,
      returnUpdatedAt: returnPoint.updatedAt,
    })

    const recipientOptions: RentalRecipientOption[] = [
      {
        memberId: canonical.id,
        userId,
        displayName: canonical.user?.fullName ?? canonical.fullName,
        phone: canonical.user?.phone ?? canonical.phone ?? null,
        status: canonical.status === 'ACTIVE' && isBookingConfirmed ? 'ACTIVE' : canonical.status,
      },
    ]

    return {
      userId,
      membershipRef: canonical.id,
      membershipStatus,
      membershipRole: 'PARTICIPANT',
      rentalEligible,
      ineligibleReason,
      bookingId: canonical.bookingId,
      trip: tripContext,
      recipientOptions,
      pickup: {
        id: pickup.id,
        name: pickup.name,
        address: pickup.address,
        scheduledAt: transport?.meetingAt ?? trip.startAt,
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
