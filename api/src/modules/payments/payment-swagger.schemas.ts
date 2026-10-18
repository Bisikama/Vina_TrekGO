import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

const paymentStatusEnum = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']
const invoiceStatusEnum = [
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'CANCELLED',
  'EXPIRED',
]
const applicationStatusEnum = ['PENDING', 'APPLIED', 'REJECTED']
const reconciliationStatusEnum = ['IDLE', 'SCHEDULED', 'RUNNING', 'NEEDS_REVIEW', 'RESOLVED']

export const PAYMENT_CHECKOUT_RESPONSE_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'paymentId',
    'invoiceId',
    'invoiceType',
    'status',
    'amount',
    'currency',
    'providerEnvironment',
    'gateway',
    'checkout',
    'expiresAt',
    'reconciliationRequired',
  ],
  properties: {
    paymentId: { type: 'string', format: 'uuid' },
    invoiceId: { type: 'string', format: 'uuid' },
    invoiceType: { type: 'string', enum: ['BOOKING', 'TRAIL_ACCESS', 'RENTAL'] },
    status: { type: 'string', enum: paymentStatusEnum },
    amount: { type: 'string', description: 'Số tiền nguyên ở dạng chuỗi để không mất độ chính xác', example: '150000' },
    currency: { type: 'string', example: 'VND' },
    providerEnvironment: { type: 'string', enum: ['MOCK', 'SANDBOX', 'PRODUCTION'] },
    gateway: { type: 'string', enum: ['momo', 'vnpay'] },
    checkout: {
      nullable: true,
      oneOf: [
        {
          type: 'object',
          required: ['type', 'url', 'qrData'],
          properties: {
            type: { type: 'string', enum: ['QR', 'REDIRECT'] },
            url: { type: 'string', format: 'uri', nullable: true },
            qrData: { type: 'string', nullable: true },
          },
        },
      ],
    },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    reconciliationRequired: { type: 'boolean' },
  },
  example: {
    paymentId: '550e8400-e29b-41d4-a716-446655440010',
    invoiceId: '550e8400-e29b-41d4-a716-446655440011',
    invoiceType: 'RENTAL',
    status: 'PROCESSING',
    amount: '150000',
    currency: 'VND',
    providerEnvironment: 'SANDBOX',
    gateway: 'vnpay',
    checkout: {
      type: 'REDIRECT',
      url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
      qrData: null,
    },
    expiresAt: '2026-10-18T10:15:00.000Z',
    reconciliationRequired: true,
  },
}

export const PAYMENT_PENDING_RESPONSE_SCHEMA: SchemaObject = {
  ...PAYMENT_CHECKOUT_RESPONSE_SCHEMA,
  example: {
    ...(PAYMENT_CHECKOUT_RESPONSE_SCHEMA.example as Record<string, unknown>),
    checkout: null,
    reconciliationRequired: true,
  },
}

export const PAYMENT_OPTIONS_RESPONSE_SCHEMA: SchemaObject = {
  type: 'object',
  required: ['defaultGateway', 'gateways'],
  properties: {
    defaultGateway: { type: 'string', enum: ['momo', 'vnpay'], nullable: true },
    gateways: {
      type: 'array',
      items: {
        type: 'object',
        required: ['gateway', 'environment', 'methods'],
        properties: {
          gateway: { type: 'string', enum: ['momo', 'vnpay'] },
          environment: { type: 'string', enum: ['SANDBOX', 'PRODUCTION'] },
          methods: { type: 'array', items: { type: 'string', enum: ['QR', 'REDIRECT'] } },
        },
      },
    },
  },
  example: {
    defaultGateway: 'vnpay',
    gateways: [
      { gateway: 'vnpay', environment: 'SANDBOX', methods: ['QR', 'REDIRECT'] },
      { gateway: 'momo', environment: 'SANDBOX', methods: ['QR', 'REDIRECT'] },
    ],
  },
}

export const RENTAL_PAYMENT_STATUS_RESPONSE_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'paymentRef',
    'status',
    'nextAction',
    'expiresAt',
    'amount',
    'refundedAmount',
    'invoiceStatus',
    'applicationStatus',
    'applicationReasonCode',
    'reconciliationStatus',
    'reconciliationRequired',
    'gateway',
    'providerEnvironment',
    'paymentMethod',
    'orderStatus',
    'financialStatus',
  ],
  properties: {
    paymentRef: { type: 'string', description: 'Rỗng khi chưa tạo payment' },
    status: { type: 'string', enum: ['NOT_STARTED', ...paymentStatusEnum] },
    nextAction: {
      type: 'object',
      nullable: true,
      properties: { type: { type: 'string', enum: ['CREATE_PAYMENT', 'AWAIT_PAYMENT_RESULT', 'RETRY_PAYMENT'] } },
    },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    amount: { type: 'integer', format: 'int64', description: 'Số tiền nguyên VND', example: 150000 },
    refundedAmount: { type: 'integer', format: 'int64', example: 0 },
    paidAt: { type: 'string', format: 'date-time', nullable: true },
    invoiceStatus: { type: 'string', enum: invoiceStatusEnum, nullable: true },
    applicationStatus: { type: 'string', enum: applicationStatusEnum, nullable: true },
    applicationReasonCode: { type: 'string', nullable: true },
    reconciliationStatus: { type: 'string', enum: reconciliationStatusEnum, nullable: true },
    reconciliationRequired: { type: 'boolean' },
    gateway: { type: 'string', enum: ['momo', 'vnpay'], nullable: true },
    providerEnvironment: { type: 'string', enum: ['MOCK', 'SANDBOX', 'PRODUCTION'], nullable: true },
    paymentMethod: { type: 'string', enum: ['QR', 'REDIRECT'], nullable: true },
    orderStatus: { type: 'string' },
    financialStatus: { type: 'string' },
  },
  example: {
    paymentRef: '550e8400-e29b-41d4-a716-446655440010',
    status: 'SUCCEEDED',
    nextAction: null,
    expiresAt: null,
    amount: 150000,
    refundedAmount: 0,
    paidAt: '2026-10-18T09:05:00.000Z',
    invoiceStatus: 'PAID',
    applicationStatus: 'APPLIED',
    applicationReasonCode: null,
    reconciliationStatus: 'RESOLVED',
    reconciliationRequired: false,
    gateway: 'vnpay',
    providerEnvironment: 'SANDBOX',
    paymentMethod: 'REDIRECT',
    orderStatus: 'PAID',
    financialStatus: 'PAID',
  },
}

export const RENTAL_EXTENSION_PAYMENT_STATUS_RESPONSE_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'extensionId',
    'rentalOrderId',
    'extensionStatus',
    'invoiceStatus',
    'paymentRef',
    'paymentStatus',
    'applicationStatus',
    'applicationReasonCode',
    'reconciliationStatus',
    'reconciliationRequired',
    'amount',
    'currency',
    'expiresAt',
    'paidAt',
  ],
  properties: {
    extensionId: { type: 'string', format: 'uuid' },
    rentalOrderId: { type: 'string', format: 'uuid' },
    extensionStatus: {
      type: 'string',
      enum: ['QUOTED', 'PENDING_PAYMENT', 'APPLIED', 'REJECTED_CAPACITY', 'EXPIRED', 'PAYMENT_FAILED', 'CANCELLED'],
    },
    invoiceStatus: { type: 'string', enum: invoiceStatusEnum, nullable: true },
    paymentRef: { type: 'string', format: 'uuid', nullable: true },
    paymentStatus: { type: 'string', enum: ['NOT_STARTED', ...paymentStatusEnum] },
    applicationStatus: { type: 'string', enum: applicationStatusEnum, nullable: true },
    applicationReasonCode: { type: 'string', nullable: true },
    reconciliationStatus: { type: 'string', enum: reconciliationStatusEnum, nullable: true },
    reconciliationRequired: { type: 'boolean' },
    amount: { type: 'string', example: '50000' },
    currency: { type: 'string', example: 'VND' },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    paidAt: { type: 'string', format: 'date-time', nullable: true },
  },
  example: {
    extensionId: '550e8400-e29b-41d4-a716-446655440020',
    rentalOrderId: '550e8400-e29b-41d4-a716-446655440021',
    extensionStatus: 'APPLIED',
    invoiceStatus: 'PAID',
    paymentRef: '550e8400-e29b-41d4-a716-446655440022',
    paymentStatus: 'SUCCEEDED',
    applicationStatus: 'APPLIED',
    applicationReasonCode: null,
    reconciliationStatus: 'RESOLVED',
    reconciliationRequired: false,
    amount: '50000',
    currency: 'VND',
    expiresAt: null,
    paidAt: '2026-10-18T09:05:00.000Z',
  },
}
