import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

const nullableText = { type: 'string', nullable: true } as const
const uuid = { type: 'string', format: 'uuid' } as const
const nullableUuid = { ...uuid, nullable: true }
const timestamp = { type: 'string', format: 'date-time', nullable: true } as const
export const MANUAL_REFUND_DETAIL_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'refundId',
    'paymentId',
    'amount',
    'currency',
    'status',
    'executionMode',
    'confirmationSource',
    'manualRefund',
    'availableActions',
  ],
  properties: {
    refundId: uuid,
    paymentId: uuid,
    purpose: { type: 'string' },
    reasonCode: nullableText,
    amount: { type: 'string', pattern: '^[0-9]+$', example: '150000' },
    currency: { type: 'string', enum: ['VND'] },
    status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] },
    refundedAt: timestamp,
    source: { type: 'string', enum: ['BOOKING', 'RENTAL', 'TRAIL_ACCESS'] },
    sourceId: nullableUuid,
    executionMode: { type: 'string', enum: ['PROVIDER_API', 'MANUAL_BANK_TRANSFER'] },
    confirmationSource: {
      type: 'string',
      nullable: true,
      enum: ['ADMIN_MANUAL', 'PROVIDER', 'SANDBOX_SIMULATION'],
      description: 'ADMIN_MANUAL means admin declaration, not independent provider/bank confirmation.',
    },
    reconciliationRequired: { type: 'boolean' },
    settlementProcessingStatus: {
      ...nullableText,
      description: 'DEPOSIT downstream outbox state PENDING/PROCESSED/FAILED; null for other purposes.',
    },
    availableActions: {
      type: 'array',
      items: { type: 'string', enum: ['recipient', 'claim', 'release', 'review', 'reassign', 'complete'] },
    },
    manualRefund: {
      type: 'object',
      nullable: true,
      properties: {
        manualStatus: {
          type: 'string',
          enum: ['AWAITING_RECIPIENT', 'READY', 'PROCESSING', 'NEEDS_REVIEW', 'COMPLETED'],
        },
        version: { type: 'integer', minimum: 1 },
        assignedAdminId: nullableUuid,
        claimedAt: timestamp,
        recipient: {
          type: 'object',
          nullable: true,
          properties: {
            bankBin: nullableText,
            accountNumber: nullableText,
            accountHolderName: nullableText,
            ownershipConfirmedAt: timestamp,
          },
        },
        bankTransactionRef: nullableText,
        transferredAt: timestamp,
        confirmedBy: nullableUuid,
        evidenceMediaId: nullableUuid,
        note: nullableText,
        sourceBankBin: nullableText,
        sourceAccountNumber: nullableText,
      },
    },
    invoiceOwner: {
      type: 'object',
      nullable: true,
      description: 'Admin detail only; reference for manual account-name check.',
      properties: { id: uuid, fullName: { type: 'string' } },
    },
    sourcePayment: {
      type: 'object',
      properties: {
        paymentId: uuid,
        gateway: { type: 'string' },
        amount: { type: 'string' },
        status: { type: 'string' },
      },
    },
    allocations: {
      type: 'array',
      items: { type: 'object', properties: { paymentAllocationId: uuid, amount: { type: 'string' } } },
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: uuid, action: { type: 'string' }, actorId: uuid, createdAt: timestamp },
      },
    },
  },
}
export const MANUAL_REFUND_LIST_SCHEMA: SchemaObject = {
  type: 'object',
  properties: {
    items: { type: 'array', items: MANUAL_REFUND_DETAIL_SCHEMA },
    pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  },
}
