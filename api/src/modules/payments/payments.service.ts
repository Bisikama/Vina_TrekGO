import { Injectable } from '@nestjs/common'
import { Payment, Prisma } from '@prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B, PAYMENT_ERROR_CODES as E } from '../../shared/errors'
import { PaymentMethod, PaymentProvider, ProviderResult } from './payment-provider.port'
import { paymentRecoveryConfig, providerCall, trailCheckoutTtlSeconds } from './payment-utils'
import {
  RentalCheckoutService,
  RentalCheckoutCommand,
  RentalExtensionCheckoutCommand,
} from '../rental/payments/rental-checkout.service'
import { paymentReturnPath } from './payment-return-path'

// PostgreSQL JSONB does not preserve object key order.
const hash = (value: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item: unknown) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
          : item,
      ),
    )
    .digest('hex')
function fail(code: string): never {
  throw AppError.fromCode(code)
}
export type CheckoutCommand = {
  bookingId: string
  actorUserId: string
  idempotencyKey: string
  paymentMethod: PaymentMethod
  gateway?: 'momo' | 'vnpay'
  clientIp?: string
}
export type InvoiceCheckoutCommand = Omit<CheckoutCommand, 'bookingId'> & { invoiceId: string }

@Injectable()
export class PaymentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly provider: PaymentProvider,
    private readonly rental: RentalCheckoutService,
  ) {}

  async createRentalExtensionCheckout(input: RentalExtensionCheckoutCommand) {
    const provider = this.checkoutProvider(input.gateway)
    return this.submit(
      await this.rental.reserveExtension(input, provider.scope),
      input.paymentMethod,
      'RENTAL',
      input.clientIp,
    )
  }
  async createRentalCheckout(input: RentalCheckoutCommand) {
    const provider = this.checkoutProvider(input.gateway)
    return this.submit(await this.rental.reserve(input, provider.scope), input.paymentMethod, 'RENTAL', input.clientIp)
  }

  private checkoutProvider(gateway?: string) {
    const provider = this.provider.forGateway(gateway ?? this.provider.scope.gateway)
    if (!provider) fail(E.PAYMENT_PROVIDER_UNAVAILABLE)
    return provider
  }

  async createBookingCheckout(input: CheckoutCommand) {
    const key = hash([input.actorUserId, 'booking-checkout', input.idempotencyKey])
    const reserved = await this.reserve(input, key)
    return this.submit(reserved, input.paymentMethod, 'BOOKING', input.clientIp)
  }

  paymentOptions() {
    const gateways = this.provider.scopes
      .filter((scope) => ['momo', 'vnpay'].includes(scope.gateway))
      .map((scope) => ({
        gateway: scope.gateway,
        environment: scope.environment,
        methods: ['QR', 'REDIRECT'] as PaymentMethod[],
      }))

    return {
      defaultGateway: gateways.some((item) => item.gateway === this.provider.scope.gateway)
        ? this.provider.scope.gateway
        : null,
      gateways,
    }
  }

  async getRentalExtensionPayment(input: { extensionId: string; actorUserId: string }) {
    const extension = await this.db.rentalExtensionRequest.findUnique({
      where: { id: input.extensionId },
      select: {
        id: true,
        orderId: true,
        userId: true,
        status: true,
        invoiceId: true,
        paymentRef: true,
        additionalFee: true,
        currency: true,
        holdExpiresAt: true,
      },
    })
    if (!extension || extension.userId !== input.actorUserId) fail(E.PAYMENT_NOT_FOUND)

    const invoice = extension.invoiceId
      ? await this.db.invoice.findUnique({
          where: { id: extension.invoiceId },
          select: { id: true, status: true, invoiceType: true, rentalOrderId: true, userId: true },
        })
      : null
    if (
      invoice &&
      (invoice.invoiceType !== 'RENTAL' ||
        invoice.rentalOrderId !== extension.orderId ||
        invoice.userId !== input.actorUserId)
    )
      fail(E.PAYMENT_INVALID_STATE)
    const payment = extension.paymentRef
      ? await this.db.payment.findFirst({
          where: { id: extension.paymentRef, invoiceId: extension.invoiceId ?? undefined },
          include: { application: true },
        })
      : null
    if (extension.paymentRef && !payment) fail(E.PAYMENT_INVALID_STATE)

    return {
      extensionId: extension.id,
      rentalOrderId: extension.orderId,
      extensionStatus: extension.status,
      invoiceStatus: invoice?.status ?? null,
      paymentRef: payment?.id ?? null,
      paymentStatus: payment?.status ?? 'NOT_STARTED',
      applicationStatus: payment?.application?.status ?? null,
      applicationReasonCode: payment?.application?.reasonCode ?? null,
      reconciliationStatus: payment?.reconcileStatus ?? null,
      reconciliationRequired: payment
        ? ['SCHEDULED', 'RUNNING', 'NEEDS_REVIEW'].includes(payment.reconcileStatus)
        : false,
      amount: payment?.amount.toFixed(0) ?? extension.additionalFee.toFixed(0),
      currency: payment?.currency ?? extension.currency,
      expiresAt: payment?.expiresAt?.toISOString() ?? extension.holdExpiresAt?.toISOString() ?? null,
      paidAt: payment?.paidAt?.toISOString() ?? null,
    }
  }

  async createCheckout(input: InvoiceCheckoutCommand) {
    const provider = this.checkoutProvider(input.gateway)
    const key = hash([input.actorUserId, 'trail-checkout', input.idempotencyKey])
    const reserved = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`
      const initial = await tx.invoice.findUnique({ where: { id: input.invoiceId } })
      if (
        !initial ||
        initial.invoiceType !== 'TRAIL_ACCESS' ||
        !initial.trailAccessId ||
        initial.userId !== input.actorUserId
      )
        fail(E.PAYMENT_NOT_FOUND)
      const initialAccess = await tx.trailAccess.findUniqueOrThrow({ where: { id: initial.trailAccessId } })
      await tx.$queryRaw`SELECT id FROM system_trails WHERE id = ${initialAccess.systemTrailId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM trail_accesses WHERE id = ${initialAccess.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${initial.id}::uuid FOR UPDATE`
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: initial.id },
        include: { invoiceLinesViaInvoiceId: true },
      })
      const access = await tx.trailAccess.findUniqueOrThrow({
        where: { id: initialAccess.id },
        include: { systemTrail: true },
      })
      if (
        invoice.trailAccessId !== access.id ||
        access.userId !== input.actorUserId ||
        invoice.userId !== input.actorUserId ||
        access.systemTrailId !== initialAccess.systemTrailId
      )
        fail(E.PAYMENT_NOT_FOUND)
      const previous = await tx.payment.findUnique({ where: { idempotencyKey: key } })
      if (previous) {
        const snapshot = previous.gatewayPayload as Prisma.JsonObject | null
        if (
          previous.invoiceId !== invoice.id ||
          previous.paymentMethod !== input.paymentMethod ||
          (input.gateway !== undefined && previous.paymentGateway !== input.gateway) ||
          previous.requestHashVersion !== 1 ||
          !snapshot?.requestSnapshot ||
          hash(snapshot.requestSnapshot) !== previous.requestHash
        )
          fail(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return { payment: previous, created: false }
      }
      if (
        provider.scope.environment === 'MOCK' &&
        process.env.NODE_ENV === 'production' &&
        process.env.PAYMENT_MOCK_ENABLED !== 'true'
      )
        fail(E.PAYMENT_PROVIDER_UNAVAILABLE)
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      if (
        invoice.invoiceType !== 'TRAIL_ACCESS' ||
        !invoice.revisionNo ||
        access.status !== 'PENDING_PAYMENT' ||
        access.sourceType !== 'PURCHASE' ||
        access.systemTrail.status !== 'ACTIVE' ||
        access.systemTrail.archivedAt ||
        !['DRAFT', 'PENDING_PAYMENT'].includes(invoice.status) ||
        (invoice.expiresAt && invoice.expiresAt <= now)
      )
        fail(E.PAYMENT_INVALID_STATE)
      const lines = invoice.invoiceLinesViaInvoiceId
      if (
        invoice.currency !== 'VND' ||
        !invoice.totalAmount.isPositive() ||
        !invoice.totalAmount.isInteger() ||
        !invoice.totalAmount.equals(access.priceSnapshot) ||
        !invoice.discountAmount.isZero() ||
        !invoice.subtotalAmount.equals(invoice.totalAmount) ||
        lines.length !== 1 ||
        lines[0].lineCode !== 'TRAIL_ACCESS' ||
        !lines[0].quantity.equals(1) ||
        !lines[0].unitAmount.equals(invoice.totalAmount) ||
        !lines[0].lineAmount.equals(invoice.totalAmount)
      )
        fail(E.PAYMENT_AMOUNT_MISMATCH)
      if (await tx.payment.findFirst({ where: { invoiceId: invoice.id, status: { in: ['PENDING', 'PROCESSING'] } } }))
        fail(E.PAYMENT_ATTEMPT_IN_PROGRESS)
      if (await tx.payment.findFirst({ where: { invoiceId: invoice.id, status: 'SUCCEEDED' } }))
        fail(E.PAYMENT_INVALID_STATE)
      const requestSnapshot = {
        actor: input.actorUserId,
        operation: 'trail-checkout',
        invoiceId: invoice.id,
        trailAccessId: access.id,
        revision: invoice.revisionNo,
        amount: invoice.totalAmount.toFixed(),
        currency: invoice.currency,
        paymentMethod: input.paymentMethod,
      }
      const id = randomUUID()
      const payment = await tx.payment.create({
        data: {
          id,
          invoiceId: invoice.id,
          amount: invoice.totalAmount,
          currency: invoice.currency,
          paymentGateway: provider.scope.gateway,
          providerEnvironment: provider.scope.environment,
          merchantAccountKey: provider.scope.merchantAccountKey,
          merchantRequestRef: `payment:${id}`,
          idempotencyKey: key,
          requestHash: hash(requestSnapshot),
          requestHashVersion: 1,
          paymentMethod: input.paymentMethod,
          gatewayPayload: { requestSnapshot },
          expiresAt: invoice.expiresAt ?? new Date(now.getTime() + trailCheckoutTtlSeconds() * 1000),
          reconcileStatus: 'SCHEDULED',
          nextRetryAt: new Date(now.getTime() + paymentRecoveryConfig().retrySeconds * 1000),
        },
      })
      if (invoice.status === 'DRAFT')
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PENDING_PAYMENT', version: { increment: 1 } },
        })
      return { payment, created: true }
    })
    return this.submit(reserved, input.paymentMethod, 'TRAIL_ACCESS', input.clientIp)
  }

  private async submit(
    reserved: { payment: Payment; created: boolean },
    paymentMethod: PaymentMethod,
    invoiceType: 'BOOKING' | 'TRAIL_ACCESS' | 'RENTAL',
    clientIp?: string,
  ) {
    if (!reserved.created) return this.response(reserved.payment, false, invoiceType)
    const payment = reserved.payment
    let result: ProviderResult
    const requestSnapshot = (payment.gatewayPayload as Prisma.JsonObject)?.requestSnapshot as
      Record<string, unknown> | undefined
    const returnPath = paymentReturnPath(requestSnapshot)
    try {
      result = await providerCall(() =>
        this.provider.createPayment({
          gateway: payment.paymentGateway,
          environment: payment.providerEnvironment!,
          merchantAccountKey: payment.merchantAccountKey!,
          merchantRequestRef: payment.merchantRequestRef!,
          amount: payment.amount.toFixed(0),
          currency: payment.currency,
          paymentMethod,
          expiresAt: payment.expiresAt!,
          clientIp,
          ...(returnPath ? { returnPath } : {}),
        }),
      )
    } catch {
      // A timeout is not evidence of failure. Keep the original ref and open-attempt guard.
      result = { kind: 'UNKNOWN' }
    }
    await this.db.payment.updateMany({
      where: { id: payment.id, version: payment.version, status: 'PENDING' },
      data:
        result.kind === 'UNKNOWN'
          ? {
              status: 'PROCESSING',
              lastErrorCode: E.PAYMENT_PROVIDER_UNAVAILABLE,
              reconcileStatus: 'SCHEDULED',
              version: { increment: 1 },
            }
          : {
              status: 'PROCESSING',
              checkoutData: result.checkout,
              reconcileStatus: 'SCHEDULED',
              nextRetryAt: new Date(Date.now() + paymentRecoveryConfig().retrySeconds * 1000),
              version: { increment: 1 },
            },
    })
    return this.response(await this.db.payment.findUniqueOrThrow({ where: { id: payment.id } }), true, invoiceType)
  }

  private async reserve(input: CheckoutCommand, key: string) {
    const provider = this.provider.forGateway(input.gateway ?? this.provider.scope.gateway)
    if (!provider) fail(E.PAYMENT_PROVIDER_UNAVAILABLE)
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(async (tx) => {
          // Serialize one actor/key even when concurrent requests name different bookings.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`
          const initial = await tx.booking.findUnique({ where: { id: input.bookingId } })
          if (!initial || initial.userId !== input.actorUserId) fail(E.PAYMENT_NOT_FOUND)
          await tx.$queryRaw`SELECT id FROM trips WHERE id = ${initial.tripId}::uuid FOR UPDATE`
          await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${input.bookingId}::uuid FOR UPDATE`
          const booking = await tx.booking.findUniqueOrThrow({
            where: { id: input.bookingId },
            include: { trip: true },
          })
          if (booking.userId !== input.actorUserId || booking.tripId !== initial.tripId) fail(E.PAYMENT_NOT_FOUND)
          const previous = await tx.payment.findUnique({ where: { idempotencyKey: key }, include: { invoice: true } })
          if (previous) {
            const snapshot = previous.gatewayPayload as Prisma.JsonObject | null
            if (
              previous.invoice.userId !== input.actorUserId ||
              previous.invoice.bookingId !== input.bookingId ||
              previous.paymentMethod !== input.paymentMethod ||
              (input.gateway !== undefined && previous.paymentGateway !== input.gateway) ||
              previous.requestHashVersion !== 1 ||
              !snapshot?.requestSnapshot ||
              hash(snapshot.requestSnapshot) !== previous.requestHash
            )
              fail(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
            return { payment: previous, created: false }
          }
          if (
            provider.scope.environment === 'MOCK' &&
            process.env.NODE_ENV === 'production' &&
            process.env.PAYMENT_MOCK_ENABLED !== 'true'
          )
            fail(E.PAYMENT_PROVIDER_UNAVAILABLE)
          let [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
          if (booking.expiresAt <= now || booking.status === 'EXPIRED') fail(B.BOOKING_HOLD_EXPIRED)
          if (
            booking.status !== 'PENDING_PAYMENT' ||
            booking.trip.tripType !== 'PUBLIC' ||
            !['OPEN', 'FULL'].includes(booking.trip.status) ||
            booking.trip.startAt <= now
          )
            fail(E.PAYMENT_INVALID_STATE)
          const candidate = await tx.invoice.findFirst({
            where: { bookingId: booking.id, status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
          })
          if (!candidate) fail(E.PAYMENT_INVALID_STATE)
          await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${candidate.id}::uuid FOR UPDATE`
          // The invoice lock may have waited across the hold deadline.
          ;[{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
          if (booking.expiresAt <= now) fail(B.BOOKING_HOLD_EXPIRED)
          if (booking.trip.startAt <= now) fail(E.PAYMENT_INVALID_STATE)
          const invoice = await tx.invoice.findUniqueOrThrow({
            where: { id: candidate.id },
            include: { invoiceLinesViaInvoiceId: true },
          })
          if (
            invoice.userId !== input.actorUserId ||
            invoice.bookingId !== booking.id ||
            invoice.invoiceType !== 'BOOKING' ||
            invoice.rentalOrderId ||
            invoice.trailAccessId ||
            !['DRAFT', 'PENDING_PAYMENT'].includes(invoice.status) ||
            (invoice.expiresAt && invoice.expiresAt <= now)
          )
            fail(E.PAYMENT_INVALID_STATE)
          const lines = invoice.invoiceLinesViaInvoiceId
          if (
            invoice.currency !== 'VND' ||
            booking.currency !== invoice.currency ||
            !invoice.totalAmount.isPositive() ||
            !invoice.totalAmount.isInteger() ||
            !invoice.totalAmount.equals(booking.totalAmount) ||
            !invoice.subtotalAmount.equals(booking.subtotalAmount.plus(booking.insuranceAmount)) ||
            !invoice.discountAmount.equals(booking.discountAmount) ||
            !invoice.totalAmount.equals(invoice.subtotalAmount.minus(invoice.discountAmount)) ||
            !lines.length ||
            lines.some(
              (line) =>
                !line.unitAmount.isInteger() ||
                !line.lineAmount.isInteger() ||
                !line.quantity.isPositive() ||
                line.unitAmount.isNegative() ||
                !line.lineAmount.equals(line.quantity.mul(line.unitAmount).toDecimalPlaces(2)),
            ) ||
            !lines
              .reduce((sum, line) => sum.plus(line.lineAmount), new Prisma.Decimal(0))
              .equals(invoice.subtotalAmount)
          )
            fail(E.PAYMENT_AMOUNT_MISMATCH)
          if (
            await tx.payment.findFirst({ where: { invoiceId: invoice.id, status: { in: ['PENDING', 'PROCESSING'] } } })
          )
            fail(E.PAYMENT_ATTEMPT_IN_PROGRESS)
          // A collected but unapplied payment must be resolved before collecting again.
          if (await tx.payment.findFirst({ where: { invoiceId: invoice.id, status: 'SUCCEEDED' } }))
            fail(E.PAYMENT_INVALID_STATE)
          const requestSnapshot = {
            actor: input.actorUserId,
            operation: 'booking-checkout',
            gateway: provider.scope.gateway,
            bookingId: booking.id,
            invoiceId: invoice.id,
            revision: invoice.revisionNo,
            amount: invoice.totalAmount.toFixed(0),
            currency: invoice.currency,
            paymentMethod: input.paymentMethod,
          }
          const id = randomUUID()
          const expiresAt =
            invoice.expiresAt && invoice.expiresAt < booking.expiresAt ? invoice.expiresAt : booking.expiresAt
          const payment = await tx.payment.create({
            data: {
              id,
              invoiceId: invoice.id,
              amount: invoice.totalAmount,
              currency: invoice.currency,
              paymentGateway: provider.scope.gateway,
              providerEnvironment: provider.scope.environment,
              merchantAccountKey: provider.scope.merchantAccountKey,
              merchantRequestRef: `payment:${id}`,
              idempotencyKey: key,
              requestHash: hash(requestSnapshot),
              requestHashVersion: 1,
              paymentMethod: input.paymentMethod,
              gatewayPayload: { requestSnapshot },
              expiresAt,
              reconcileStatus: 'SCHEDULED',
              nextRetryAt: new Date(now.getTime() + paymentRecoveryConfig().retrySeconds * 1000),
            },
          })
          if (invoice.status === 'DRAFT')
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: 'PENDING_PAYMENT', version: { increment: 1 } },
            })
          return { payment, created: true }
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          fail(E.PAYMENT_ATTEMPT_IN_PROGRESS)
        throw error
      }
    }
  }

  private response(payment: Payment, created: boolean, invoiceType: 'BOOKING' | 'TRAIL_ACCESS' | 'RENTAL') {
    const unresolved = ['PENDING', 'PROCESSING'].includes(payment.status) && !payment.checkoutData
    return {
      httpStatus: unresolved ? 202 : created ? 201 : 200,
      body: {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        invoiceType,
        status: payment.status,
        amount: payment.amount.toFixed(0),
        currency: payment.currency,
        providerEnvironment: payment.providerEnvironment,
        gateway: payment.paymentGateway,
        checkout: payment.checkoutData,
        expiresAt: payment.expiresAt?.toISOString() ?? null,
        reconciliationRequired: ['SCHEDULED', 'RUNNING', 'NEEDS_REVIEW'].includes(payment.reconcileStatus),
      },
    }
  }
}
