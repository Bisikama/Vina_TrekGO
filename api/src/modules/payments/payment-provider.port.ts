export type PaymentMethod = 'QR' | 'REDIRECT'
export type CheckoutData = { type: PaymentMethod; url: string | null; qrData: string | null }
export type ProviderScope = {
  gateway: string
  environment: 'MOCK' | 'SANDBOX' | 'PRODUCTION'
  merchantAccountKey: string
}
export type ProviderPaymentInput = ProviderScope & {
  merchantRequestRef: string
  amount: string
  currency: string
  paymentMethod: PaymentMethod
  expiresAt: Date
  clientIp?: string
  returnPath?: string
}
export type ProviderResult =
  { kind: 'UNKNOWN' } | { kind: 'CONFIRMED_RESULT'; status: 'PROCESSING'; checkout: CheckoutData }

type ProviderEventBase = ProviderScope & {
  providerEventId: string
  merchantRequestRef: string
  transactionRef: string | null
  status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
  amount: string
  currency: string
  occurredAt: string
}
export type VerifiedPaymentEvent = ProviderEventBase & { kind: 'PAYMENT' }
export type VerifiedRefundEvent = Omit<ProviderEventBase, 'status'> & {
  kind: 'REFUND'
  merchantRefundRef: string
  refundTransactionRef: string | null
  status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
}
export type VerifiedProviderEvent = VerifiedPaymentEvent | VerifiedRefundEvent
export type ProviderFinancialResult =
  | { kind: 'UNKNOWN' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'CONFIRMED_RESULT'; event: VerifiedProviderEvent; checkout?: CheckoutData }
export type ProviderRefundInput = ProviderScope & {
  merchantRequestRef: string
  merchantRefundRef: string
  amount: string
  currency: string
}

export abstract class PaymentProvider {
  readonly supportsIdempotentCreate: boolean = false
  // Providers with a durable one-shot refund dispatch may opt in without allowing payment recreation.
  readonly supportsRefundDispatch: boolean = false
  readonly waitForCheckoutExpiry: boolean = false
  abstract readonly scope: ProviderScope
  get scopes(): ProviderScope[] { return [this.scope] }
  forGateway(gateway: string): PaymentProvider | undefined {
    return gateway === this.scope.gateway ? this : undefined
  }
  abstract createPayment(input: ProviderPaymentInput): Promise<ProviderResult>
  abstract queryPayment(input: ProviderScope & { merchantRequestRef: string }): Promise<ProviderFinancialResult>
  abstract refund(input: ProviderRefundInput): Promise<ProviderFinancialResult>
  abstract queryRefund(input: ProviderScope & { merchantRefundRef: string }): Promise<ProviderFinancialResult>
  abstract verifyWebhook(rawBody: Buffer, headers: Record<string, string>): Promise<VerifiedProviderEvent | null>
  observeVerifiedEvent(_event: VerifiedProviderEvent): Promise<void> {
    return Promise.resolve()
  }
}
