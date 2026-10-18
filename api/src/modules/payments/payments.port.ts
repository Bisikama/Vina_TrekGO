import { Injectable } from '@nestjs/common'
import { RefundCommand, RefundsService, refundSummary } from './refunds.service'
import { PaymentRecoveryService } from './payment-recovery.service'
import { InvoiceCheckoutCommand, PaymentsService } from './payments.service'
import {
  RentalCheckoutCommand,
  RentalExtensionCheckoutCommand,
} from '../rental/payments/rental-checkout.service'

export abstract class PaymentsPort {
  abstract createRentalExtensionCheckout(
    input: RentalExtensionCheckoutCommand,
  ): ReturnType<PaymentsService['createRentalExtensionCheckout']>
  abstract getRentalExtensionPayment(input: {
    extensionId: string
    actorUserId: string
  }): ReturnType<PaymentsService['getRentalExtensionPayment']>
  abstract createRentalCheckout(input: RentalCheckoutCommand): ReturnType<PaymentsService['createRentalCheckout']>
  abstract createCheckout(input: InvoiceCheckoutCommand): ReturnType<PaymentsService['createCheckout']>
  abstract requestRefund(input: RefundCommand): Promise<ReturnType<typeof refundSummary>>
  abstract reconcilePayment(paymentId: string): Promise<boolean>
  abstract reconcileRefund(refundId: string): Promise<boolean>
}

@Injectable()
export class SharedPaymentsPort extends PaymentsPort {
  constructor(
    private readonly refunds: RefundsService,
    private readonly recovery: PaymentRecoveryService,
    private readonly checkout: PaymentsService,
  ) {
    super()
  }
  createCheckout(input: InvoiceCheckoutCommand) {
    return this.checkout.createCheckout(input)
  }
  createRentalExtensionCheckout(input: RentalExtensionCheckoutCommand) {
    return this.checkout.createRentalExtensionCheckout(input)
  }
  getRentalExtensionPayment(input: { extensionId: string; actorUserId: string }) {
    return this.checkout.getRentalExtensionPayment(input)
  }
  createRentalCheckout(input: RentalCheckoutCommand) {
    return this.checkout.createRentalCheckout(input)
  }
  requestRefund(input: RefundCommand) {
    return this.refunds.requestRefund(input)
  }
  reconcilePayment(id: string) {
    return this.recovery.reconcilePayment(id)
  }
  reconcileRefund(id: string) {
    return this.recovery.reconcileRefund(id)
  }
}
