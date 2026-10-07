import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'

// Documentation only: runtime validation remains in public-trip.dto.ts.
const uuid = z.string().uuid()
const time = z.string().datetime({ offset: true })
const issue = z.object({ code: z.string(), field: z.string(), message: z.string() })
const publicTrip = z.object({
  id: uuid,
  title: z.string(),
  description: z.string().nullable(),
  destinationId: uuid,
  startAt: time,
  endAt: time,
  capacity: z.number().int(),
  price: z.string().nullable(),
  pickupPointId: uuid.nullable(),
  status: z.string(),
  publishedAt: time.nullable(),
})
const checkpoint = z.object({
  id: uuid,
  destinationId: uuid,
  name: z.string(),
  description: z.string().nullable(),
  latitude: z.string(),
  longitude: z.string(),
  defaultRadiusMeters: z.number().int(),
  status: z.string(),
})
const trail = z.object({
  id: uuid,
  destinationId: uuid,
  name: z.string(),
  difficulty: z.string(),
  status: z.string(),
  version: z.number().int(),
  routeGeojson: z.unknown(),
  distanceKm: z.string(),
  elevationGainM: z.number().int().nullable(),
  checkpointIds: z.array(uuid),
})
const trip = publicTrip.extend({
  tripType: z.literal('PUBLIC'),
  creatorId: uuid,
  leaderId: uuid.nullable(),
  version: z.number().int(),
  checkpoints: z.array(
    z.object({
      sourceCheckpointId: uuid.nullable(),
      name: z.string(),
      description: z.string().nullable(),
      latitude: z.string(),
      longitude: z.string(),
      radiusMeters: z.number().int(),
      sequence: z.number().int(),
      isRequired: z.boolean(),
      isEnabled: z.boolean(),
    }),
  ),
  trails: z.array(
    z.object({
      systemTrailId: uuid,
      sequence: z.number().int(),
      snapshotName: z.string(),
      snapshotDifficulty: z.string(),
      snapshotGeojson: z.unknown(),
      snapshotDistanceKm: z.string().nullable(),
      snapshotElevationGainM: z.number().int().nullable(),
      sourceTrailVersion: z.number().int().nullable(),
      snapshotCheckpointIds: z.unknown(),
    }),
  ),
})

export const cf01Responses = {
  trip,
  trips: z.array(trip),
  publicTrip,
  publicTrips: z.array(publicTrip),
  options: z.array(z.object({ id: uuid, name: z.string() })),
  checkpoints: z.array(checkpoint),
  trail,
  suggestions: z.array(trail.extend({ canAppend: z.boolean(), coveredCheckpointIds: z.array(uuid) })),
  readiness: z.object({ canPublish: z.boolean(), issues: z.array(issue), version: z.number().int() }),
  conflicts: z.object({
    hasConflict: z.boolean(),
    conflicts: z.array(z.object({ id: uuid, title: z.string(), status: z.string(), startAt: time, endAt: time })),
  }),
}

export const ApiCf01Page = () =>
  applyDecorators(
    ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 } }),
    ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }),
  )
export const ApiCf01Destination = () =>
  ApiQuery({
    name: 'destinationId',
    required: true,
    description: 'UUID địa điểm lấy từ GET /api/v1/leader/trip-options/destinations',
    schema: { type: 'string', format: 'uuid' },
  })
export const ApiCf01Id = (description = 'UUID chuyến đi, lấy từ API tạo hoặc danh sách chuyến') =>
  ApiParam({
    name: 'id',
    required: true,
    description,
    schema: { type: 'string', format: 'uuid' },
  })
export const ApiCf01Response = (
  summary: string,
  response: keyof typeof cf01Responses,
  status = 200,
  description?: string,
) =>
  applyDecorators(
    ApiOperation({ summary, description }),
    ApiResponse({
      status,
      description:
        response === 'trips' ||
        response === 'publicTrips' ||
        response === 'options' ||
        response === 'checkpoints' ||
        response === 'suggestions'
          ? 'Mảng kết quả trực tiếp. [] nghĩa là không có dữ liệu phù hợp ở trang này; không có envelope data/total.'
          : 'Kết quả trả trực tiếp dưới dạng JSON.',
      schema: z.toJSONSchema(cf01Responses[response], { target: 'openapi-3.0' }) as SchemaObject,
    }),
  )
