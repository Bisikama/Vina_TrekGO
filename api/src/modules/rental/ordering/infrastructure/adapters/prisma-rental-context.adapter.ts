import { Injectable } from '@nestjs/common';
import {
  ParticipantStatus,
  Prisma,
  RentalOrderStatus,
} from '@prisma/client';
import { PrismaService } from 'src/shared/services/prisma.service';
import { AppError } from 'src/shared/errors/app-error';
import { RENTAL_ORDERING_ERROR_CODES } from 'src/shared/errors/codes/rental-ordering.error-codes';
import type {
  RentalContextPort,
  RentalEligibilityContext,
  RentalPolicySnapshot,
} from '../../application/ports/rental-context.port';

const OPEN_RENTAL_ORDER_STATUSES: RentalOrderStatus[] = [
  RentalOrderStatus.PENDING_PAYMENT,
  RentalOrderStatus.PAID,
  RentalOrderStatus.PREPARING,
  RentalOrderStatus.READY_FOR_HANDOVER,
  RentalOrderStatus.ACTIVE,
  RentalOrderStatus.RETURN_PENDING,
  RentalOrderStatus.RETURN_PROCESSING,
];

@Injectable()
export class PrismaRentalContextAdapter implements RentalContextPort {
  constructor(private readonly prisma: PrismaService) {}

  async getByBookingId(
    bookingId: string,
    now: Date,
  ): Promise<RentalEligibilityContext | null> {
    // Bước hạ tầng 1: đọc Booking + Trip + logistics context từ DB hiện tại.
    // QUAN TRỌNG: đây là bridge tạm thời vì source hiện chưa có Area A internal rental-context contract.
    // Khi Area A expose GET /internal/bookings/:id/rental-context, chỉ thay adapter này; Use Case không đổi.
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        tripId: true,
        userId: true,
        status: true,
        currency: true,
        version: true,
        pickupPointId: true,
        returnPointId: true,
        pickupPoint: {
          select: {
            id: true,
            name: true,
            address: true,
            updatedAt: true,
          },
        },
        returnPoint: {
          select: {
            id: true,
            name: true,
            address: true,
            updatedAt: true,
          },
        },
        bookingParticipantsViaBookingId: {
          where: { status: ParticipantStatus.ACTIVE },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            userId: true,
            fullName: true,
            phone: true,
            status: true,
          },
        },
        rentalOrdersViaBookingId: {
          where: { status: { in: OPEN_RENTAL_ORDER_STATUSES } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
        trip: {
          select: {
            id: true,
            title: true,
            tripType: true,
            status: true,
            startAt: true,
            endAt: true,
            version: true,
            tripTransportsViaTripId: {
              orderBy: { sequence: 'asc' },
              select: {
                pickupPointId: true,
                returnPointId: true,
                meetingAt: true,
                returnAt: true,
                status: true,
                version: true,
              },
            },
            tripTrailPlansViaTripId: {
              orderBy: { sequence: 'asc' },
              take: 1,
              select: {
                snapshotDifficulty: true,
              },
            },
            weatherSnapshotsViaTripId: {
              orderBy: { observedAt: 'desc' },
              take: 1,
              select: {
                weatherCondition: true,
                riskSummary: true,
                rainProbabilityPercent: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      return null;
    }

    // Bước hạ tầng 2: lấy đúng policy đang có hiệu lực tại thời điểm request.
    // Không chỉ dựa vào isActive vì policy cũ có thể vẫn active nhưng đã hết effectiveTo.
    const policy = await this.prisma.rentalPolicy.findFirst({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { versionNo: 'desc' }],
    });

    if (!policy) {
      throw AppError.fromCode(
        RENTAL_ORDERING_ERROR_CODES.RENTAL_POLICY_NOT_CONFIGURED,
      );
    }

    // Bước hạ tầng 3: chọn transport row khớp điểm nhận/trả của Booking.
    // Nếu chưa có transport schedule chi tiết, fallback về Trip start/end để B1 vẫn hoạt động.
    const matchingTransport = booking.trip.tripTransportsViaTripId.find((item) => {
      const effectiveReturnPointId = item.returnPointId ?? item.pickupPointId;
      return (
        item.pickupPointId === booking.pickupPointId &&
        effectiveReturnPointId === booking.returnPointId &&
        item.status !== 'CANCELLED'
      );
    });

    const pickupScheduledAt = matchingTransport?.meetingAt ?? booking.trip.startAt;
    const dropoffScheduledAt = matchingTransport?.returnAt ?? booking.trip.endAt;

    // Bước hạ tầng 4: tách policyVersion khỏi contextVersion.
    // contextVersion bên dưới là fingerprint TẠM THỜI vì Area A chưa có contract riêng trong source hiện tại.
    // Fingerprint thay đổi khi Booking/Trip/recipient/logistics context thay đổi, nhưng không phụ thuộc RentalPolicy.
    const contextVersion = buildTemporaryContextVersion({
      bookingVersion: booking.version,
      tripVersion: booking.trip.version,
      transportVersion: matchingTransport?.version ?? 0,
      pickupUpdatedAt: booking.pickupPoint.updatedAt,
      returnUpdatedAt: booking.returnPoint.updatedAt,
      participantKeys: booking.bookingParticipantsViaBookingId.map(
        (item) => `${item.id}:${item.userId ?? ''}:${item.status}`,
      ),
    });

    const latestWeather = booking.trip.weatherSnapshotsViaTripId[0] ?? null;
    const weatherSummary =
      latestWeather?.riskSummary ?? latestWeather?.weatherCondition ?? null;

    const policySnapshot: RentalPolicySnapshot = {
      policyCode: policy.policyCode,
      versionNo: policy.versionNo,
      quoteTtlMinutes: policy.quoteTtlMinutes,
      cutoffHoursBeforeTrip: policy.cutoffHoursBeforeTrip,
      prepBufferMinutes: policy.prepBufferMinutes,
      returnBufferMinutes: policy.returnBufferMinutes,
      cleaningBufferMinutes: policy.cleaningBufferMinutes,
      cancellationRules: toJsonSafeValue(policy.cancellationRules),
      effectiveFrom: policy.effectiveFrom.toISOString(),
      effectiveTo: policy.effectiveTo?.toISOString() ?? null,
    };

    return {
      booking: {
        id: booking.id,
        ownerUserId: booking.userId,
        tripId: booking.tripId,
        status: booking.status,
        currency: booking.currency,
      },
      trip: {
        id: booking.trip.id,
        name: booking.trip.title,
        status: booking.trip.status,
        tripType: booking.trip.tripType,
        startAt: booking.trip.startAt,
        endAt: booking.trip.endAt,
        timezone: process.env.TREKGO_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
        difficulty:
          booking.trip.tripTrailPlansViaTripId[0]?.snapshotDifficulty ?? null,
        weatherSummary,
        rainProbabilityPercent:
          latestWeather?.rainProbabilityPercent != null
            ? Number(latestWeather.rainProbabilityPercent)
            : null,
      },
      recipientOptions: booking.bookingParticipantsViaBookingId.map((item) => ({
        participantId: item.id,
        userId: item.userId,
        displayName: item.fullName,
        phone: item.phone,
        status: item.status,
      })),
      pickup: {
        id: booking.pickupPoint.id,
        name: booking.pickupPoint.name,
        address: booking.pickupPoint.address,
        scheduledAt: pickupScheduledAt,
      },
      dropoff: {
        id: booking.returnPoint.id,
        name: booking.returnPoint.name,
        address: booking.returnPoint.address,
        scheduledAt: dropoffScheduledAt,
      },
      rentalCutoffAt: new Date(
        booking.trip.startAt.getTime() - policy.cutoffHoursBeforeTrip * 3_600_000,
      ),
      contextVersion,
      existingOpenOrderId: booking.rentalOrdersViaBookingId[0]?.id ?? null,
      activePolicy: {
        id: policy.id,
        policyCode: policy.policyCode,
        versionNo: policy.versionNo,
        quoteTtlMinutes: policy.quoteTtlMinutes,
        cutoffHoursBeforeTrip: policy.cutoffHoursBeforeTrip,
        prepBufferMinutes: policy.prepBufferMinutes,
        returnBufferMinutes: policy.returnBufferMinutes,
        cleaningBufferMinutes: policy.cleaningBufferMinutes,
        snapshot: policySnapshot,
      },
    };
  }
}

function buildTemporaryContextVersion(input: {
  bookingVersion: number;
  tripVersion: number;
  transportVersion: number;
  pickupUpdatedAt: Date;
  returnUpdatedAt: Date;
  participantKeys: string[];
}): number {
  const payload = JSON.stringify({
    bookingVersion: input.bookingVersion,
    tripVersion: input.tripVersion,
    transportVersion: input.transportVersion,
    pickupUpdatedAt: input.pickupUpdatedAt.toISOString(),
    returnUpdatedAt: input.returnUpdatedAt.toISOString(),
    participantKeys: input.participantKeys,
  });

  // FNV-1a 32-bit, ép về positive 31-bit để vừa Prisma Int/PostgreSQL INTEGER.
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0) & 0x7fffffff || 1;
}

function toJsonSafeValue(value: Prisma.JsonValue): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}