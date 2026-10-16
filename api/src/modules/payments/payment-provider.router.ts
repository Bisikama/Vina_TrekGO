import {
  PaymentProvider,
  ProviderScope,
  ProviderPaymentInput,
  ProviderRefundInput,
  VerifiedProviderEvent,
} from './payment-provider.port'
import { AppError } from '../../shared/errors'

// The default remains unchanged for existing rental/trail callers. Booking can
// choose a gateway; callbacks and recovery always use the stored gateway scope.
export class PaymentProviderRouter extends PaymentProvider {
  readonly scope: ProviderScope
  constructor(
    private readonly providers: PaymentProvider[],
    defaultGateway: string,
  ) {
    super()
    const provider = this.forGateway(defaultGateway)
    if (!provider) throw new Error('Default payment provider is not enabled')
    this.scope = provider.scope
  }
  get scopes() {
    return this.providers.map((provider) => provider.scope)
  }
  forGateway(gateway: string) {
    return this.providers.find((provider) => provider.scope.gateway === gateway)
  }
  private resolve(scope: ProviderScope) {
    const provider = this.forGateway(scope.gateway)
    if (
      !provider ||
      provider.scope.environment !== scope.environment ||
      provider.scope.merchantAccountKey !== scope.merchantAccountKey
    )
      throw AppError.fromCode('PAYMENT_PROVIDER_UNAVAILABLE')
    return provider
  }
  createPayment(input: ProviderPaymentInput) {
    return this.resolve(input).createPayment(input)
  }
  queryPayment(input: ProviderScope & { merchantRequestRef: string }) {
    return this.resolve(input).queryPayment(input)
  }
  refund(input: ProviderRefundInput) {
    return this.resolve(input).refund(input)
  }
  queryRefund(input: ProviderScope & { merchantRefundRef: string }) {
    return this.resolve(input).queryRefund(input)
  }
  verifyWebhook(raw: Buffer, headers: Record<string, string>) {
    return this.resolve(this.scope).verifyWebhook(raw, headers)
  }
  observeVerifiedEvent(event: VerifiedProviderEvent) {
    return this.resolve(event).observeVerifiedEvent(event)
  }
}
