import { applyDecorators } from '@nestjs/common'
import { ApiResponse } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
const str: SchemaObject = { type: 'string' },
  uuid: SchemaObject = { type: 'string', format: 'uuid' },
  time: SchemaObject = { type: 'string', format: 'date-time' },
  bool: SchemaObject = { type: 'boolean' }
const obj = (properties: Record<string, SchemaObject>): SchemaObject => ({
  type: 'object',
  required: Object.keys(properties),
  properties,
})
const base = {
  id: uuid,
  participantId: uuid,
  status: {
    type: 'string',
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED', 'INVALIDATED'],
  } as SchemaObject,
  reason: { type: 'string', nullable: true } as SchemaObject,
  version: { type: 'integer', minimum: 1 } as SchemaObject,
  expiresAt: time,
  createdAt: time,
  recipientDisplay: str,
}
const preview = obj({
  ...base,
  senderDisplay: str,
  participantName: str,
  participantStatus: str,
  checkinStatus: str,
  bookingStatus: str,
  trip: obj({
    id: uuid,
    title: str,
    status: str,
    startAt: time,
    endAt: time,
    destination: obj({ id: uuid, name: str }),
  }),
  actions: obj({ canAccept: bool, canDecline: bool, canRevoke: bool }),
  ticketId: { ...uuid, nullable: true },
  currentAccess: obj({
    participantActive: bool,
    canNavigate: { type: 'boolean' },
    canRent: { type: 'boolean', enum: [false] },
    canCheckIn: bool,
    reason: { type: 'string', enum: ['INTEGRATION_NOT_VERIFIED'] },
  }),
})
const error: SchemaObject = {
  type: 'object',
  required: ['error', 'meta'],
  properties: {
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
  },
}
export const bookingLinkageSchema = obj({
  participants: {
    type: 'array',
    items: obj({
      id: uuid,
      fullName: str,
      checkinStatus: { type: 'string', enum: ['NOT_CHECKED_IN', 'CHECKED_IN', 'NO_SHOW'] },
      checkinMethod: { type: 'string', enum: ['QR', 'MANUAL', null], nullable: true },
      checkedInAt: { ...time, nullable: true },
      checkinCode: { type: 'string', nullable: true },
      linkageStatus: { type: 'string', enum: ['UNLINKED', 'INVITATION_PENDING', 'CLAIMED'] },
      pendingInvitationId: { ...uuid, nullable: true },
      recipientDisplay: { type: 'string', nullable: true },
      invitations: {
        type: 'array',
        maxItems: 10,
        items: obj({
          id: uuid,
          status: base.status,
          reason: base.reason,
          version: base.version,
          expiresAt: time,
          recipientDisplay: str,
        }),
      },
      actions: obj({ canInvite: bool, canSelfClaim: bool, canRevoke: bool }),
    }),
  },
})
export const ApiBookingLinkage = () =>
  ApiResponse({
    status: 200,
    description:
      'Existing buyer booking detail with additive participant linkage fields. This schema documents the M6 projection only; other booking fields are unchanged. Invitation history is limited to the latest 10 per participant.',
    schema: bookingLinkageSchema,
  })
export const ApiPublicInvitation = (kind: 'create' | 'preview' | 'list' | 'action') =>
  applyDecorators(
    ApiResponse({
      status: kind === 'create' ? 201 : 200,
      description:
        'Current projection, except create replay which returns its original snapshot. Read current state after replay.',
      schema:
        kind === 'create'
          ? obj(base)
          : kind === 'list'
            ? obj({
                items: { type: 'array', items: preview },
                page: { type: 'integer' },
                pageSize: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              })
            : preview,
      headers: {
        'Cache-Control': { schema: { type: 'string', enum: ['no-store'] } },
        ...(kind === 'create'
          ? { 'Idempotency-Replayed': { schema: { type: 'string', enum: ['true', 'false'] } } }
          : {}),
      },
    }),
    ...[400, 401, 403, 404, 409, 410, 422, 429, 500].map((status) =>
      ApiResponse({
        status,
        schema: error,
        description:
          'Shared error envelope; inspect error.code and details. No authority can be inferred from historical ACCEPTED.',
        ...(status === 429 ? { headers: { 'Retry-After': { schema: { type: 'integer', minimum: 1 } } } } : {}),
      }),
    ),
  )
