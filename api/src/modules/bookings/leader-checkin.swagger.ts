import { applyDecorators } from '@nestjs/common'
import { ApiResponse } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

const str: SchemaObject = { type: 'string' },
  uuid: SchemaObject = { type: 'string', format: 'uuid' },
  time: SchemaObject = { type: 'string', format: 'date-time' },
  bool: SchemaObject = { type: 'boolean' },
  int: SchemaObject = { type: 'integer', minimum: 0 }

const obj = (properties: Record<string, SchemaObject>): SchemaObject => ({
  type: 'object',
  required: Object.keys(properties),
  properties,
})

const summarySchema = obj({
  capacity: { type: 'integer', minimum: 1 },
  minPax: { type: 'integer', minimum: 1 },
  totalParticipants: int,
  checkedInCount: int,
  notCheckedInCount: int,
  noShowCount: int,
  progressPercent: { type: 'integer', minimum: 0, maximum: 100 },
})

const participantItemSchema = obj({
  id: uuid,
  bookingId: uuid,
  bookingStatus: {
    type: 'string',
    enum: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW'],
  },
  fullName: str,
  phone: { type: 'string', nullable: true },
  dateOfBirth: { type: 'string', nullable: true },
  idDocumentNo: { type: 'string', nullable: true },
  emergencyContactName: { type: 'string', nullable: true },
  emergencyContactPhone: { type: 'string', nullable: true },
  participantStatus: {
    type: 'string',
    enum: ['ACTIVE', 'NO_SHOW', 'COMPLETED'],
  },
  checkinStatus: {
    type: 'string',
    enum: ['NOT_CHECKED_IN', 'CHECKED_IN', 'NO_SHOW'],
  },
  checkinMethod: {
    type: 'string',
    enum: ['QR', 'MANUAL', null as unknown as string],
    nullable: true,
  },
  checkedInAt: { ...time, nullable: true },
  checkedInBy: { ...uuid, nullable: true },
  isLinkedAccount: bool,
  linkedUserDisplay: { type: 'string', nullable: true },
  buyerDisplay: str,
  buyerPhone: { type: 'string', nullable: true },
  pickupPoint: obj({
    id: uuid,
    name: str,
    address: str,
  }),
})

const listResponseSchema = obj({
  trip: obj({
    id: uuid,
    title: str,
    status: str,
    startAt: time,
    endAt: time,
    publishedAt: { ...time, nullable: true },
    closedAt: { ...time, nullable: true },
    startedAt: { ...time, nullable: true },
    completedAt: { ...time, nullable: true },
    capacity: { type: 'integer', minimum: 1 },
    minPax: { type: 'integer', minimum: 1 },
  }),
  summary: summarySchema,
  items: { type: 'array', items: participantItemSchema },
  page: { type: 'integer', minimum: 1 },
  pageSize: { type: 'integer', minimum: 1, maximum: 100 },
  total: int,
  totalPages: int,
})

const checkinResponseSchema = obj({
  alreadyCheckedIn: bool,
  replayed: bool,
  bookingStatus: {
    type: 'string',
    enum: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'NO_SHOW'],
  },
  bookingVersion: { type: 'integer', minimum: 1 },
  participant: participantItemSchema,
  summary: summarySchema,
})

const errorSchema = obj({
  error: {
    type: 'object',
    required: ['code', 'message', 'retryable'],
    properties: {
      code: str,
      message: str,
      retryable: bool,
      details: {
        oneOf: [
          { type: 'object', additionalProperties: true },
          { type: 'array', items: { type: 'object', additionalProperties: true } },
        ],
      },
    },
  },
  meta: obj({ requestId: str, serverTime: time, contractVersion: str }),
})

export const ApiLeaderCheckin = (kind: 'list' | 'checkin') =>
  applyDecorators(
    ApiResponse({
      status: 200,
      schema: kind === 'list' ? listResponseSchema : checkinResponseSchema,
      headers: { 'Cache-Control': { schema: { type: 'string', enum: ['no-store'] } } },
    }),
    ...[400, 401, 403, 404, ...(kind === 'checkin' ? [409, 422] : []), 500].map((status) =>
      ApiResponse({
        status,
        schema: errorSchema,
        description: 'Shared GlobalErrorFilter envelope `{ error, meta }`.',
      }),
    ),
  )
