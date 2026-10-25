import { Injectable } from '@nestjs/common'
import { RefundCommand, RefundsService, refundSummary } from './refunds.service'
import { PaymentRecoveryService } from './payment-recovery.service'
import { InvoiceCheckoutCommand, PaymentsService } from './payments.service'
import {
  RentalCheckoutCommand,
  RentalExtensionCheckoutCommand,
} from '../rental/payments/rental-checkout.service'
import { PaymentHistoryService } from './payment-history.service'
import type {
  RentalOrderPaymentHistoryQueryDto,
  RentalOrderPaymentHistoryResponseDto,
} from './dtos/rental-order-payment-history.dto'
import type {
  UserTransactionsQueryDto,
  UserTransactionsResponseDto,
} from './dtos/user-transactions.dto'

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
  abstract getRentalOrderPaymentHistory(input: {
    rentalOrderId: string
    actorUserId: string
    query: RentalOrderPaymentHistoryQueryDto
  }): Promise<RentalOrderPaymentHistoryResponseDto>
  abstract getUserTransactions(input: {
    actorUserId: string
    query: UserTransactionsQueryDto
  }): Promise<UserTransactionsResponseDto>
}

@Injectable()
export class SharedPaymentsPort extends PaymentsPort {
  constructor(
    private readonly refunds: RefundsService,
    private readonly recovery: PaymentRecoveryService,
    private readonly checkout: PaymentsService,
    private readonly history: PaymentHistoryService,
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
  getRentalOrderPaymentHistory(input: {
    rentalOrderId: string
    actorUserId: string
    query: RentalOrderPaymentHistoryQueryDto
  }) {
    return this.history.getRentalOrderPaymentHistory(input)
  }
  getUserTransactions(input: {
    actorUserId: string
    query: UserTransactionsQueryDto
  }) {
    return this.history.getUserTransactions(input)
  }
}

