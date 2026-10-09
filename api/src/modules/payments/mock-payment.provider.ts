import { Injectable } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../shared/errors'
import { PrismaService } from '../../shared/services/prisma.service'
import { Prisma } from '@prisma/client'
import { paymentHash } from './payment-utils'
import {
  PaymentProvider,
  ProviderPaymentInput,
  ProviderResult,
  ProviderScope,
  VerifiedProviderEvent,
  ProviderFinancialResult,
  ProviderRefundInput,
} from './payment-provider.port'

const eventFields = {
  providerEventId: z.string().min(1).max(220),
  merchantRequestRef: z.string().min(1).max(180),
  transactionRef: z.string().min(1).max(180).nullable(),
  status: z.enum(['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']),
  amount: z.string().regex(/^(0|[1-9][0-9]{0,9})$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  occurredAt: z.string().datetime(),
}
const eventSchema = z
  .discriminatedUnion('kind', [
    z.object({ ...eventFields, kind: z.literal('PAYMENT') }).strict(),
    z
      .object({
        ...eventFields,
        kind: z.literal('REFUND'),
        merchantRefundRef: z.string().min(1).max(180),
        refundTransactionRef: z.string().min(1).max(180).nullable(),
        status: z.enum(['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
      })
      .strict(),
  ])
  .refine(
    (event) =>
      event.status !== 'SUCCEEDED' ||
      (event.kind === 'PAYMENT' ? event.transactionRef !== null : event.refundTransactionRef !== null),
  )

@Injectable()
export class MockPaymentProvider extends PaymentProvider {
  readonly supportsIdempotentCreate = true
  readonly scope: ProviderScope = { gateway: 'mock', environment: 'MOCK', merchantAccountKey: 'trekgo-mock-v1' }
  constructor(private readonly db: PrismaService) {
    super()
  }

  private assertScope(input: ProviderScope) {
    if (
      input.gateway !== this.scope.gateway ||
      input.environment !== this.scope.environment ||
      input.merchantAccountKey !== this.scope.merchantAccountKey
    )
      throw new Error('Mock provider scope mismatch')
  }
  private identity(kind: 'PAYMENT' | 'REFUND', reference: string) {
    return paymentHash([this.scope, kind, reference])
  }

  async createPayment(input: ProviderPaymentInput): Promise<ProviderResult> {
    if (
      input.gateway !== this.scope.gateway ||
      input.environment !== this.scope.environment ||
      input.merchantAccountKey !== this.scope.merchantAccountKey
    )
      throw new Error('Mock provider scope mismatch')
    // Reserved .invalid domain: this is a demo checkout, never a real payment link.
    const identity = encodeURIComponent(input.merchantRequestRef)
    const checkout = {
      type: input.paymentMethod,
      url: input.paymentMethod === 'REDIRECT' ? `https://checkout.trekgo.invalid/mock/${identity}` : null,
      qrData: input.paymentMethod === 'QR' ? `trekgo-mock:${identity}:${input.amount}:${input.currency}` : null,
    }
    const event: VerifiedProviderEvent = {
      ...this.scope,
      kind: 'PAYMENT',
      providerEventId: `mock:${this.identity('PAYMENT', input.merchantRequestRef)}:PROCESSING`,
      merchantRequestRef: input.merchantRequestRef,
      transactionRef: `mock:${input.merchantRequestRef}`,
      status: 'PROCESSING',
      amount: input.amount,
      currency: input.currency,
      occurredAt: new Date().toISOString(),
    }
    const stored = await this.reserve(
      'PAYMENT',
      input.merchantRequestRef,
      { ...input, expiresAt: input.expiresAt.toISOString() },
      { kind: 'CONFIRMED_RESULT', event, checkout },
    )
    return {
      kind: 'CONFIRMED_RESULT',
      status: 'PROCESSING',
      checkout: stored.kind === 'CONFIRMED_RESULT' && stored.checkout ? stored.checkout : checkout,
    }
  }

  private async reserve(
    kind: 'PAYMENT' | 'REFUND',
    reference: string,
    request: Prisma.InputJsonObject,
    result: ProviderFinancialResult,
  ): Promise<ProviderFinancialResult> {
    const id = this.identity(kind, reference)
    const requestHash = paymentHash(request)
    const row = await this.db.mockPaymentOperation.upsert({
      where: { id },
      update: {},
      create: {
        id,
        kind,
        requestHash,
        request,
        result: result,
      },
    })
    if (row.requestHash !== requestHash) throw new Error('Mock idempotency reference reused with different payload')
    return row.result as unknown as ProviderFinancialResult
  }
  async queryPayment(input: ProviderScope & { merchantRequestRef: string }): Promise<ProviderFinancialResult> {
    this.assertScope(input)
    const row = await this.db.mockPaymentOperation.findUnique({
      where: { id: this.identity('PAYMENT', input.merchantRequestRef) },
    })
    return row ? (row.result as unknown as ProviderFinancialResult) : { kind: 'NOT_FOUND' }
  }
  async refund(input: ProviderRefundInput): Promise<ProviderFinancialResult> {
    this.assertScope(input)
    const payment = await this.queryPayment(input)
    if (payment.kind !== 'CONFIRMED_RESULT' || payment.event.status !== 'SUCCEEDED') return { kind: 'UNKNOWN' }
    const event: VerifiedProviderEvent = {
      ...this.scope,
      kind: 'REFUND',
      providerEventId: `mock:${this.identity('REFUND', input.merchantRefundRef)}:SUCCEEDED`,
      merchantRequestRef: input.merchantRequestRef,
      merchantRefundRef: input.merchantRefundRef,
      transactionRef: payment.event.transactionRef,
      refundTransactionRef: `mock:${input.merchantRefundRef}`,
      status: 'SUCCEEDED',
      amount: input.amount,
      currency: input.currency,
      occurredAt: new Date().toISOString(),
    }
    return this.reserve('REFUND', input.merchantRefundRef, { ...input }, { kind: 'CONFIRMED_RESULT', event })
  }
  async queryRefund(input: ProviderScope & { merchantRefundRef: string }): Promise<ProviderFinancialResult> {
    this.assertScope(input)
    const row = await this.db.mockPaymentOperation.findUnique({
      where: { id: this.identity('REFUND', input.merchantRefundRef) },
    })
    return row ? (row.result as unknown as ProviderFinancialResult) : { kind: 'NOT_FOUND' }
  }

  // Simulator-only control: allows a provider result to exist even when its callback is lost.
  async setResult(kind: 'PAYMENT' | 'REFUND', reference: string, status: VerifiedProviderEvent['status']) {
    const row = await this.db.mockPaymentOperation.findUniqueOrThrow({ where: { id: this.identity(kind, reference) } })
    const result = row.result as unknown as Extract<ProviderFinancialResult, { kind: 'CONFIRMED_RESULT' }>
    if (kind === 'REFUND' && status === 'EXPIRED') throw new Error('Refund cannot expire')
    const event = {
      ...result.event,
      status,
      occurredAt: new Date().toISOString(),
      providerEventId: `mock:${row.id}:${status}`,
    }
    await this.db.mockPaymentOperation.update({ where: { id: row.id }, data: { result: { ...result, event } } })
  }

  async observeVerifiedEvent(event: VerifiedProviderEvent) {
    this.assertScope(event)
    const reference = event.kind === 'PAYMENT' ? event.merchantRequestRef : event.merchantRefundRef
    const id = this.identity(event.kind, reference)
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM mock_payment_operations WHERE id = ${id} FOR UPDATE`
      const row = await tx.mockPaymentOperation.findUnique({ where: { id } })
      if (!row) return
      const previous = row.result as unknown as Extract<ProviderFinancialResult, { kind: 'CONFIRMED_RESULT' }>
      if (previous.event.amount !== event.amount || previous.event.currency !== event.currency) return
      // Late non-success callbacks cannot erase an already collected/refunded result.
      if (previous.event.status === 'SUCCEEDED' && event.status !== 'SUCCEEDED') return
      await tx.mockPaymentOperation.update({ where: { id }, data: { result: { ...previous, event: { ...event } } } })
    })
  }
  verifyWebhook(rawBody: Buffer, headers: Record<string, string>): Promise<VerifiedProviderEvent | null> {
    const secret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET
    if (
      !secret ||
      Buffer.byteLength(secret) < 32 ||
      (process.env.NODE_ENV === 'production' && process.env.PAYMENT_MOCK_ENABLED !== 'true')
    )
      throw AppError.fromCode(E.PAYMENT_PROVIDER_UNAVAILABLE)
    const timestamp = headers['x-mock-timestamp'] ?? ''
    const signature = headers['x-mock-signature'] ?? ''
    if (
      !/^\d{10}$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !/^[0-9a-f]{64}$/.test(signature)
    )
      return Promise.resolve(null)
    const expected = createHmac('sha256', secret).update(timestamp).update('.').update(rawBody).digest()
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return Promise.resolve(null)
    let input: unknown
    try {
      input = JSON.parse(rawBody.toString('utf8'))
    } catch {
      throw AppError.fromCode('VALIDATION_ERROR')
    }
    const parsed = eventSchema.safeParse(input)
    if (!parsed.success || new Date(parsed.data.occurredAt).getTime() > Date.now() + 300000)
      throw AppError.fromCode('VALIDATION_ERROR')
    return Promise.resolve({ ...parsed.data, ...this.scope })
  }
}
