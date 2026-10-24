import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

const eventEnvelopeProperties: SchemaObject['properties'] = {
  eventId: { type: 'string', minLength: 1, maxLength: 220, example: 'evt-rental-20261018-001' },
  entityId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
  entityVersion: { type: 'integer', minimum: 1, example: 2 },
  correlationId: { type: 'string', minLength: 1, maxLength: 220, example: 'corr-rental-20261018-001' },
  occurredAt: { type: 'string', format: 'date-time', example: '2026-10-18T09:00:00.000Z' },
}

export const TRIP_RESCHEDULED_EVENT_SCHEMA: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['eventId', 'eventType', 'entityId', 'entityVersion', 'correlationId', 'occurredAt', 'payload'],
  properties: {
    ...eventEnvelopeProperties,
    eventType: { type: 'string', enum: ['TRIP_RESCHEDULED'] },
    payload: {
      type: 'object',
      additionalProperties: false,
      required: ['tripId', 'newStartAt', 'newEndAt', 'contextVersion'],
      properties: {
        tripId: { type: 'string', format: 'uuid' },
        newStartAt: { type: 'string', format: 'date-time' },
        newEndAt: { type: 'string', format: 'date-time' },
        oldStartAt: { type: 'string', format: 'date-time' },
        oldEndAt: { type: 'string', format: 'date-time' },
        plannedHandoverAt: { type: 'string', format: 'date-time' },
        plannedReturnAt: { type: 'string', format: 'date-time' },
        contextVersion: { type: 'integer', minimum: 1 },
      },
    },
  },
  example: {
    eventId: 'evt-rental-20261018-001',
    eventType: 'TRIP_RESCHEDULED',
    entityId: '550e8400-e29b-41d4-a716-446655440000',
    entityVersion: 2,
    correlationId: 'corr-rental-20261018-001',
    occurredAt: '2026-10-18T09:00:00.000Z',
    payload: {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      newStartAt: '2026-10-20T01:00:00.000Z',
      newEndAt: '2026-10-22T10:00:00.000Z',
      contextVersion: 2,
    },
  },
}

export const TRIP_CANCELLED_EVENT_SCHEMA: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['eventId', 'eventType', 'entityId', 'entityVersion', 'correlationId', 'occurredAt', 'payload'],
  properties: {
    ...eventEnvelopeProperties,
    eventType: { type: 'string', enum: ['TRIP_CANCELLED', 'TRIP_ABORTED'] },
    payload: {
      type: 'object',
      additionalProperties: false,
      required: ['tripId', 'reason', 'effectiveAt', 'tripVersion'],
      properties: {
        tripId: { type: 'string', format: 'uuid' },
        reason: { type: 'string', minLength: 1, maxLength: 500 },
        effectiveAt: { type: 'string', format: 'date-time' },
        tripVersion: { type: 'integer', minimum: 1 },
      },
    },
  },
  example: {
    eventId: 'evt-rental-20261018-002',
    eventType: 'TRIP_CANCELLED',
    entityId: '550e8400-e29b-41d4-a716-446655440000',
    entityVersion: 3,
    correlationId: 'corr-rental-20261018-002',
    occurredAt: '2026-10-18T09:00:00.000Z',
    payload: {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'Trip cancelled by operator',
      effectiveAt: '2026-10-18T09:00:00.000Z',
      tripVersion: 3,
    },
  },
}

export const BOOKING_CANCELLED_EVENT_SCHEMA: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['eventId', 'eventType', 'entityId', 'entityVersion', 'correlationId', 'occurredAt', 'payload'],
  properties: {
    ...eventEnvelopeProperties,
    eventType: { type: 'string', enum: ['BOOKING_CANCELLED'] },
    payload: {
      type: 'object',
      additionalProperties: false,
      required: ['bookingId', 'reason', 'effectiveAt', 'version'],
      properties: {
        bookingId: { type: 'string', format: 'uuid' },
        tripId: { type: 'string', format: 'uuid' },
        reason: { type: 'string', minLength: 1, maxLength: 500 },
        effectiveAt: { type: 'string', format: 'date-time' },
        version: { type: 'integer', minimum: 1 },
      },
    },
  },
  example: {
    eventId: 'evt-rental-20261018-003',
    eventType: 'BOOKING_CANCELLED',
    entityId: '550e8400-e29b-41d4-a716-446655440001',
    entityVersion: 1,
    correlationId: 'corr-rental-20261018-003',
    occurredAt: '2026-10-18T09:00:00.000Z',
    payload: {
      bookingId: '550e8400-e29b-41d4-a716-446655440001',
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'Booking cancelled by user',
      effectiveAt: '2026-10-18T09:00:00.000Z',
      version: 1,
    },
  },
}

export const RENTAL_LIFECYCLE_EVENT_RESULT_SCHEMA: SchemaObject = {
  type: 'object',
  required: ['eventId', 'status'],
  properties: {
    eventId: { type: 'string' },
    status: { type: 'string', enum: ['PROCESSED', 'SKIPPED_DUPLICATE', 'SKIPPED_OUT_OF_ORDER', 'FAILED'] },
    affectedOrderCount: { type: 'integer', minimum: 0 },
    affectedOrderIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
    cancelledOrderIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
    actionRequiredOrderIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['orderId', 'reason'],
        properties: {
          orderId: { type: 'string', format: 'uuid' },
          reason: { type: 'string' },
        },
      },
    },
    scheduleNoticesIssued: {
      type: 'array',
      items: {
        type: 'object',
        required: ['orderId', 'documentId'],
        properties: {
          orderId: { type: 'string', format: 'uuid' },
          documentId: { type: 'string', format: 'uuid' },
        },
      },
    },
  },
  example: {
    eventId: 'evt-rental-20261018-001',
    status: 'PROCESSED',
    affectedOrderCount: 1,
    affectedOrderIds: ['550e8400-e29b-41d4-a716-446655440010'],
    conflicts: [],
    scheduleNoticesIssued: [],
  },
}
