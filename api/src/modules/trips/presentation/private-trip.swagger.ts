import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'
import { inviteCodeSchema } from './dtos/private-membership.dto'

// Documentation only. Raw Prisma responses allow additional database fields.
const uuid = z.string().uuid()
const time = z.string().datetime({ offset: true })
const integer = z.number().int()
const memberStatus = z.enum(['ACTIVE', 'LEFT', 'REMOVED', 'COMPLETED', 'NO_SHOW'])
const baseTrip = z.looseObject({
  id: uuid,
  tripType: z.literal('PRIVATE'),
  creatorId: uuid,
  leaderId: uuid.nullable(),
  destinationId: uuid,
  title: z.string(),
  description: z.string().nullable(),
  startAt: time,
  endAt: time,
  pickupPointId: uuid.nullable(),
  maxPax: integer,
  pricePerPax: z.string().nullable(),
  status: z.string(),
  version: integer,
  createdAt: time,
  updatedAt: time,
  cancelledAt: time.nullable(),
})
const checkpoint = z.object({
  id: uuid,
  sequence: integer,
  name: z.string(),
  description: z.string().nullable(),
  latitude: z.string(),
  longitude: z.string(),
  radiusMeters: integer,
  isRequired: z.boolean(),
  isEnabled: z.boolean(),
})
const trip = baseTrip.extend({
  tripTrailPlansViaTripId: z.array(
    z.looseObject({
      id: uuid,
      tripId: uuid,
      systemTrailId: uuid.nullable(),
      personalTrailId: uuid.nullable(),
      sequence: integer,
      snapshotName: z.string(),
      snapshotDifficulty: z.string().nullable(),
      snapshotDistanceKm: z.string().nullable(),
      snapshotElevationGainM: integer.nullable(),
      snapshotGeojson: z.unknown(),
      snapshotCheckpointIds: z.unknown(),
      sourceTrailVersion: integer.nullable(),
    }),
  ),
  tripCheckpointsViaTripId: z.array(
    checkpoint.loose().extend({
      tripId: uuid,
      sourceCheckpointId: uuid.nullable(),
      sourcePersonalCheckpointId: uuid.nullable(),
    }),
  ),
})
const personalTrail = z.looseObject({
  id: uuid,
  userId: uuid,
  destinationId: uuid.nullable(),
  title: z.string(),
  description: z.string().nullable(),
  difficulty: z.string().nullable(),
  distanceKm: z.string().nullable(),
  elevationGainM: integer.nullable(),
  routeGeojson: z.unknown(),
  status: z.string(),
  version: integer,
  personalCheckpointsViaPersonalTrailId: z.array(
    z.looseObject({
      id: uuid,
      personalTrailId: uuid,
      name: z.string(),
      sequence: integer,
      latitude: z.string(),
      longitude: z.string(),
      radiusMeters: integer,
      info: z.string().nullable(),
    }),
  ),
})
const trailAccess = z.looseObject({
  id: uuid,
  userId: uuid,
  systemTrailId: uuid,
  status: z.string(),
  purchasedAt: time.nullable(),
  systemTrail: z.looseObject({
    id: uuid,
    destinationId: uuid,
    name: z.string(),
    difficulty: z.string(),
    distanceKm: z.string(),
    elevationGainM: integer.nullable(),
    routeGeojson: z.unknown(),
    status: z.string(),
    version: integer,
    trailCheckpointsViaSystemTrailId: z.array(
      z.looseObject({
        id: uuid,
        systemTrailId: uuid,
        checkpointId: uuid,
        sequence: integer,
        isRequired: z.boolean(),
        checkpoint: z.looseObject({
          id: uuid,
          destinationId: uuid,
          name: z.string(),
          description: z.string().nullable(),
          latitude: z.string(),
          longitude: z.string(),
          defaultRadiusMeters: integer,
          status: z.string(),
        }),
      }),
    ),
  }),
})
const membership = z.object({
  id: uuid,
  role: z.enum(['HOST', 'MEMBER']),
  status: memberStatus,
  joinedAt: time,
  version: integer,
})
const roomTrip = z.object({
  id: uuid,
  tripType: z.literal('PRIVATE'),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  version: integer,
  startAt: time,
  endAt: time,
  capacity: integer,
  activeMemberCount: integer,
  pickupPoint: z
    .object({ id: uuid, name: z.string(), address: z.string(), latitude: z.string(), longitude: z.string() })
    .nullable(),
})

export const privateTripResponses = {
  trip,
  trips: z.array(trip),
  cancelled: baseTrip,
  personalTrails: z.array(personalTrail),
  trailAccesses: z.array(trailAccess),
  pickups: z.array(z.object({ id: uuid, name: z.string(), destinationId: uuid })),
  access: z.object({ hasAccess: z.boolean(), accessId: uuid.nullable(), purchasedAt: time.nullable() }),
  invitation: z.object({
    inviteId: uuid,
    inviteCode: inviteCodeSchema,
    inviteUrl: z.string().url(),
    expiresAt: time,
    status: z.literal('ACTIVE'),
    tripVersion: integer,
  }),
  revoked: z.object({ tripId: uuid, revokedCount: integer, tripVersion: integer }),
  preview: z.object({
    trip: roomTrip.omit({ description: true, version: true, pickupPoint: true }).extend({
      host: z.object({ displayName: z.string() }),
      remainingSlots: integer,
    }),
    invite: z.object({ expiresAt: time, status: z.literal('ACTIVE') }),
    joinable: z.boolean(),
    joinDisabledReason: z.enum(['CAPACITY_CONFLICT', 'INVITE_USAGE_LIMIT_REACHED']).nullable(),
  }),
  joined: z.object({
    tripId: uuid,
    membership: membership.nullable(),
    alreadyMember: z.boolean(),
    rejoined: z.boolean(),
    isHost: z.boolean(),
    activeMemberCount: integer,
    capacity: integer,
    tripVersion: integer,
    redirectTo: z.string(),
  }),
  room: z.object({
    trip: roomTrip,
    viewer: z.object({
      isHost: z.boolean(),
      membershipId: uuid.nullable(),
      membershipVersion: integer.nullable(),
      membershipStatus: memberStatus.nullable(),
    }),
    permissions: z.object({
      canInvite: z.boolean(),
      canRemoveMembers: z.boolean(),
      canLeave: z.boolean(),
      canRent: z.literal(false),
    }),
    rental: z.object({ eligible: z.literal(false), reason: z.literal('PRIVATE_TRIP_RENTAL_DISABLED') }),
    plannedRoutes: z.array(
      z.object({
        id: uuid,
        sequence: integer,
        sourceType: z.enum(['PERSONAL', 'SYSTEM']),
        name: z.string(),
        difficulty: z.string().nullable(),
        distanceKm: z.string().nullable(),
        elevationGainM: integer.nullable(),
        geojson: z.unknown(),
      }),
    ),
    requiredCheckpoints: z.array(checkpoint),
  }),
  members: z.object({
    items: z.array(membership.extend({ userId: uuid, displayName: z.string(), isHost: z.boolean() })),
    page: integer,
    pageSize: integer,
    total: integer,
    activeMemberCount: integer,
    capacity: integer,
  }),
  left: z.object({
    tripId: uuid,
    membershipId: uuid,
    status: z.literal('LEFT'),
    memberVersion: integer,
    tripVersion: integer,
    changed: z.boolean(),
  }),
  removed: z.object({
    tripId: uuid,
    membershipId: uuid,
    status: z.literal('REMOVED'),
    memberVersion: integer,
    tripVersion: integer,
    changed: z.boolean(),
  }),
}

export const ApiPrivateResponse = (
  summary: string,
  response: keyof typeof privateTripResponses,
  status = 200,
  description?: string,
) =>
  applyDecorators(
    ApiOperation({ summary, description }),
    ApiResponse({
      status,
      description:
        'JSON trả trực tiếp. Mảng [] nghĩa là không có dữ liệu ở trang này; Example Value chỉ là mẫu cấu trúc.',
      schema: z.toJSONSchema(privateTripResponses[response], { target: 'openapi-3.0' }) as SchemaObject,
    }),
  )
export const ApiPrivateId = (
  name = 'id',
  description = 'UUID private trip, lấy từ tạo chuyến hoặc danh sách của host',
) =>
  ApiParam({
    name,
    required: true,
    description,
    schema: { type: 'string', format: 'uuid' },
  })
export const ApiPrivateCode = () =>
  ApiParam({
    name: 'code',
    required: true,
    description: 'Dùng inviteCode từ CF03, không dùng inviteId hay toàn bộ inviteUrl.',
    schema: z.toJSONSchema(inviteCodeSchema, { target: 'openapi-3.0' }) as SchemaObject,
  })
export const ApiPrivatePage = (withStatus = true) =>
  applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      description: '20 dòng/trang cố định; không gửi pageSize.',
      schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
    }),
    ...(withStatus
      ? [
          ApiQuery({
            name: 'status',
            required: false,
            schema: { type: 'string', enum: ['ACTIVE'] },
            description: 'Tùy chọn tương thích. Options đã lọc ACTIVE; tham số này không lọc trạng thái private trip.',
          }),
        ]
      : []),
  )
