import { applyDecorators } from '@nestjs/common'
import { ApiParam, ApiResponse } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

const uuid: SchemaObject = { type: 'string', format: 'uuid' }
const date: SchemaObject = { type: 'string', format: 'date-time' }
const integer: SchemaObject = { type: 'integer', minimum: 1 }
const nullable = (schema: SchemaObject): SchemaObject => ({ ...schema, nullable: true })
const object = (properties: Record<string, SchemaObject>): SchemaObject => ({ type: 'object', properties, required: Object.keys(properties) })
const bool: SchemaObject = { type: 'boolean' }
const status: SchemaObject = { type: 'string', enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED', 'INVALIDATED'] }
const invitationProperties = {
  id: uuid, tripId: uuid, status, expiresAt: date, createdAt: date,
  reason: nullable({ type: 'string' }), version: integer, reservesCapacity: { type: 'boolean', enum: [false] } as SchemaObject,
}
const invitation = object(invitationProperties)
const displayed = object({ ...invitationProperties, recipientDisplay: { type: 'string' } })
const accepted = object({
  invitationStatus: status, resolutionReason: nullable({ type: 'string' }), tripId: uuid,
  memberId: nullable(uuid), membershipStatus: nullable({ type: 'string', enum: ['ACTIVE','LEFT','REMOVED','COMPLETED','NO_SHOW'] }),
  membershipVersion: nullable(integer), membershipVersionAtAccept: nullable(integer),
  canEnterRoom: bool, alreadyMember: bool, rejoined: bool,
})
const preview = object({
  ...invitationProperties, senderDisplay: { type: 'string' }, recipientDisplay: { type: 'string' },
  trip: object({ id: uuid, title: { type: 'string' }, startAt: date, endAt: date, status: { type: 'string' } }),
  actions: object({ canAccept: bool, canEnterRoom: bool, canDecline: bool, canRevoke: bool }),
})
const page = object({ items: { type: 'array', items: displayed }, page: integer, pageSize: { ...integer, maximum: 50 },
  total: { type: 'integer', minimum: 0 }, totalPages: { type: 'integer', minimum: 0 } })
const error: SchemaObject = object({
  error: { type: 'object', required: ['code','message','retryable'], properties: {
    code: { type: 'string' }, message: { type: 'string' }, retryable: bool,
    details: { description: 'Business object (reason/retryAfterSeconds) or validation field array.', oneOf: [
      { type: 'object', additionalProperties: true }, { type: 'array', items: { type: 'object', additionalProperties: true } },
    ] },
  } },
  meta: object({ requestId: { type: 'string' }, serverTime: date, contractVersion: { type: 'string', example: '0.2.0-final-flow' } }),
})
export function ApiMemberInvitation(kind: 'create' | 'page' | 'preview' | 'accept' | 'change', hasId = true) {
  const schemas = { create: displayed, page, preview, accept: accepted, change: invitation }
  const codes = kind === 'create' ? [400,401,403,404,409,422,429,500]
    : kind === 'accept' || kind === 'change' ? [400,401,403,404,409,410,429,500] : [400,401,403,404,500]
  return applyDecorators(
    ...(hasId ? [ApiParam({ name: 'id', required: true, schema: uuid })] : []),
    ApiResponse({ status: kind === 'create' ? 201 : 200, schema: schemas[kind],
      description: kind === 'accept' ? 'Current membership access; accepted replay never rejoins. Only navigate when canEnterRoom=true.' : 'Success; timestamps are ISO UTC.',
      headers: { 'Cache-Control': { schema: { type: 'string', enum: ['no-store'] } },
        ...(kind === 'create' ? { 'Idempotency-Replayed': { schema: { type: 'string', enum: ['true','false'] } } } : {}) },
    }),
    ...codes.map(code => ApiResponse({ status: code, schema: error,
      description: code === 429 ? 'INVITE_RATE_LIMITED. Wait Retry-After seconds.' : 'Shared GlobalErrorFilter contract; inspect error.code.',
      ...(code === 429 ? { headers: { 'Retry-After': { schema: { type: 'integer', minimum: 1 } } } } : {}),
    })),
  )
}
