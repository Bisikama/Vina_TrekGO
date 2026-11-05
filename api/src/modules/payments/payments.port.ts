import { Injectable } from '@nestjs/common'
import { RefundCommand, RefundsService, refundSummary } from './refunds.service'
import { PaymentRecoveryService } from './payment-recovery.service'
import { SandboxRefundSimulationService } from './sandbox-refund-simulation.service'
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
import type {
  AdminCashflowSummaryQueryDto,
  AdminCashflowSummaryResponseDto,
  AdminPaymentDetailResponseDto,
  AdminRefundDetailResponseDto,
  AdminTransactionsQueryDto,
  AdminTransactionsResponseDto,
} from './dtos/admin-cashflow.dto'

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
  abstract getAdminTransactions(input: {
    query: AdminTransactionsQueryDto
  }): Promise<AdminTransactionsResponseDto>
  abstract getAdminCashflowSummary(input: {
    query: AdminCashflowSummaryQueryDto
  }): Promise<AdminCashflowSummaryResponseDto>
  abstract getAdminPaymentDetail(input: {
    paymentId: string
  }): Promise<AdminPaymentDetailResponseDto>
  abstract getAdminRefundDetail(input: {
    refundId: string
  }): Promise<AdminRefundDetailResponseDto>
}

@Injectable()
export class SharedPaymentsPort extends PaymentsPort {
  constructor(
    private readonly refunds: RefundsService,
    private readonly recovery: PaymentRecoveryService,
    private readonly checkout: PaymentsService,
    private readonly history: PaymentHistoryService,
    private readonly simulation: SandboxRefundSimulationService,
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
  async requestRefund(input: RefundCommand) {
    const refund = await this.refunds.requestRefund(input)
    return refund.executionMode === 'SANDBOX_SIMULATED'
      ? this.simulation.settleAutomaticBookingRefund(refund.refundId)
      : refund
  }
  reconcilePayment(id: string) {
    return this.recovery.reconcilePayment(id)
  }
  async reconcileRefund(id: string) {
    const refund = await this.simulation.settleAutomaticBookingRefund(id)
    return refund.executionMode === 'SANDBOX_SIMULATED' ? true : this.recovery.reconcileRefund(id)
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
  getAdminTransactions(input: { query: AdminTransactionsQueryDto }) {
    return this.history.getAdminTransactions(input)
  }
  getAdminCashflowSummary(input: { query: AdminCashflowSummaryQueryDto }) {
    return this.history.getAdminCashflowSummary(input)
  }
  getAdminPaymentDetail(input: { paymentId: string }) {
    return this.history.getAdminPaymentDetail(input)
  }
  getAdminRefundDetail(input: { refundId: string }) {
    return this.history.getAdminRefundDetail(input)
  }
}
