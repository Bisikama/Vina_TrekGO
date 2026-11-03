import { createHash, randomUUID } from 'node:crypto'

/** Nested create keeps every manual refund and its work item in one transaction. */
export function manualRefundReservation(gateway: string | null) {
  return gateway === 'payos'
    ? {
        executionMode: 'MANUAL_BANK_TRANSFER' as const,
        reconcileStatus: 'IDLE' as const,
        nextRetryAt: null,
        manualRefund: { create: {} },
      }
    : {}
}

/** Legacy direct rental intake has no shared request identity; only enrich the newly supported payOS branch. */
export function manualLateRentalRefund(payment: {
  id: string
  paymentGateway: string
  providerEnvironment: unknown
  merchantAccountKey: string | null
}) {
  if (payment.paymentGateway !== 'payos') return {}
  return {
    paymentGateway: 'payos',
    providerEnvironment: 'PRODUCTION' as const,
    merchantAccountKey: payment.merchantAccountKey,
    merchantRefundRef: `refund:${randomUUID()}`,
    businessActionId: `rental-late-payment:${payment.id}`,
    requestHash: createHash('sha256').update(`rental-late-payment:${payment.id}`).digest('hex'),
    requestHashVersion: 1,
    ...manualRefundReservation('payos'),
  }
}
