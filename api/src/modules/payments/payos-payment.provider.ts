import { Prisma, Payment, PayosCheckout } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError } from '../../shared/errors'
import {
  PaymentProvider,
  ProviderScope,
  ProviderPaymentInput,
  ProviderResult,
  ProviderFinancialResult,
  VerifiedPaymentEvent,
} from './payment-provider.port'
import { PayosData, PayosMerchantClient, payosVerified } from './payos-merchant.client'
import { paymentHash } from './payment-utils'

const UNKNOWN = { kind: 'UNKNOWN' } as const
const object = (value: unknown): value is PayosData => !!value && typeof value === 'object' && !Array.isArray(value)
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
function transactionTime(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value))
    return null
  const time = new Date(value.replace(' ', 'T') + (/(Z|[+-]\d\d:\d\d)$/.test(value) ? '' : '+07:00'))
  return Number.isFinite(time.getTime()) && time.getTime() <= Date.now() + 60000 ? time.toISOString() : null
}

export class PayosPaymentProvider extends PaymentProvider {
  readonly supportsIdempotentCreate = true // Only recreate on local proof that no mapping/dispatch exists.
  readonly waitForCheckoutExpiry = true
  readonly scope: ProviderScope
  private readonly client: PayosMerchantClient
  private readonly secret: string
  private readonly returnUrl: string
  private readonly cancelUrl: string
  private readonly bankBin: string
  private readonly account: string

  constructor(private readonly db: PrismaService) {
    super()
    const required = (key: string) => {
      const value = process.env[key]
      if (!value || value.trim() !== value) throw new Error(`Missing or invalid ${key}`)
      return value
    }
    if (process.env.PAYOS_ENABLED !== 'true') throw new Error('payOS is disabled')
    if (process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED === 'true')
      throw new Error('Sandbox refund simulation cannot coexist with payOS production')
    const clientId = required('PAYOS_CLIENT_ID')
    if (clientId.length > 100) throw new Error('Invalid PAYOS_CLIENT_ID')
    this.secret = required('PAYOS_CHECKSUM_KEY')
    this.client = new PayosMerchantClient(clientId, required('PAYOS_API_KEY'), this.secret)
    this.scope = { gateway: 'payos', environment: 'PRODUCTION', merchantAccountKey: clientId }
    this.returnUrl = required('PAYOS_RETURN_URL')
    this.cancelUrl = required('PAYOS_CANCEL_URL')
    for (const value of [this.returnUrl, this.cancelUrl]) {
      const url = new URL(value)
      if (url.protocol !== 'https:' || url.username || url.password || url.hash)
        throw new Error('payOS return/cancel URLs must be HTTPS')
    }
    this.bankBin = required('PAYOS_RECEIVING_BANK_BIN')
    this.account = required('PAYOS_RECEIVING_ACCOUNT_NUMBER')
    if (!/^\d{6}$/.test(this.bankBin) || !/^\d{1,40}$/.test(this.account))
      throw new Error('Invalid payOS receiving account')
  }

  private matches(input: ProviderScope) {
    return (
      input.gateway === this.scope.gateway &&
      input.environment === this.scope.environment &&
      input.merchantAccountKey === this.scope.merchantAccountKey
    )
  }
  private where() {
    return {
      paymentGateway: 'payos',
      providerEnvironment: 'PRODUCTION' as const,
      merchantAccountKey: this.scope.merchantAccountKey,
    }
  }
  private async mapping(paymentId: string) {
    return this.db.payosCheckout.findUnique({ where: { paymentId } })
  }

  async createPayment(input: ProviderPaymentInput): Promise<ProviderResult> {
    if (
      !this.matches(input) ||
      input.currency !== 'VND' ||
      !/^[1-9]\d{0,9}$/.test(input.amount) ||
      input.expiresAt <= new Date()
    )
      return UNKNOWN
    const payment = await this.db.payment.findFirst({
      where: { ...this.where(), merchantRequestRef: input.merchantRequestRef },
    })
    if (!payment || !payment.amount.equals(input.amount) || payment.expiresAt?.getTime() !== input.expiresAt.getTime())
      return UNKNOWN
    const row = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${payment.id}::uuid FOR UPDATE`
      let mapping = await tx.payosCheckout.findUnique({ where: { paymentId: payment.id } })
      if (!mapping) mapping = await tx.payosCheckout.create({ data: { paymentId: payment.id } })
      if (mapping.orderCode > BigInt(Number.MAX_SAFE_INTEGER)) throw AppError.fromCode('PAYMENT_INVALID_STATE')
      if (!mapping.requestSnapshot) {
        const returnUrl = input.returnPath ? new URL(input.returnPath, this.returnUrl).toString() : this.returnUrl
        if (new URL(returnUrl).origin !== new URL(this.returnUrl).origin) throw AppError.fromCode('VALIDATION_ERROR')
        mapping = await tx.payosCheckout.update({
          where: { paymentId: payment.id },
          data: {
            requestSnapshot: {
              orderCode: Number(mapping.orderCode),
              amount: Number(input.amount),
              description: 'TREKGO',
              returnUrl,
              cancelUrl: this.cancelUrl,
              expiredAt: Math.floor(input.expiresAt.getTime() / 1000),
            },
          },
        })
      }
      return mapping
    })
    // A duplicate create can occur after a caller retry. Always query the same order first.
    let data = await this.client.request('GET', `/${row.orderCode}`)
    if (data) return this.checkoutResult(data, row, input.paymentMethod, payment)
    // Claim the initial transport durably. An ambiguous timeout is never resent blindly.
    const claimed = await this.db.payosCheckout.updateMany({
      where: { paymentId: row.paymentId, lastResponse: { equals: Prisma.DbNull } },
      data: { lastResponse: { dispatchStarted: true } },
    })
    if (claimed.count !== 1) return UNKNOWN
    data = await this.client.request('POST', '', row.requestSnapshot as PayosData)
    if (!data) return UNKNOWN
    return this.checkoutResult(data, row, input.paymentMethod, payment)
  }

  private async checkoutResult(
    data: PayosData,
    row: PayosCheckout,
    method: string,
    payment: Payment,
  ): Promise<ProviderResult> {
    const link = data.paymentLinkId ?? data.id
    if (
      data.orderCode !== Number(row.orderCode) ||
      data.amount !== payment.amount.toNumber() ||
      typeof link !== 'string' ||
      !/^[A-Za-z0-9-]{1,180}$/.test(link) ||
      (row.paymentLinkId && row.paymentLinkId !== link)
    )
      return UNKNOWN
    const snapshot = row.requestSnapshot as PayosData
    const saved = row.lastResponse as PayosData | null
    const url =
      typeof data.checkoutUrl === 'string'
        ? data.checkoutUrl
        : (saved?.checkoutUrl ?? `https://pay.payos.vn/web/${link}`)
    const qr = typeof data.qrCode === 'string' ? data.qrCode : saved?.qrCode
    if (
      (data.accountNumber !== undefined && data.accountNumber !== this.account) ||
      (data.bin !== undefined && data.bin !== this.bankBin)
    ) {
      await this.review(payment.id, data, 'PAYOS_RECEIVING_ACCOUNT_MISMATCH')
      return UNKNOWN
    }
    await this.db.payosCheckout.update({
      where: { paymentId: row.paymentId },
      data: {
        paymentLinkId: link,
        lastResponse: {
          ...data,
          ...(typeof url === 'string' ? { checkoutUrl: url } : {}),
          ...(typeof qr === 'string' ? { qrCode: qr } : {}),
        } as Prisma.InputJsonObject,
      },
    })
    if (typeof url !== 'string' || new URL(url).origin !== 'https://pay.payos.vn' || snapshot.amount !== data.amount)
      return UNKNOWN
    return {
      kind: 'CONFIRMED_RESULT',
      status: 'PROCESSING',
      checkout: { type: method === 'QR' ? 'QR' : 'REDIRECT', url, qrData: typeof qr === 'string' ? qr : null },
    }
  }

  private async review(paymentId: string, data: PayosData, reason: string) {
    await this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } })
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${payment.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE`
      await tx.payosCheckout.update({ where: { paymentId }, data: { lastResponse: data as Prisma.InputJsonObject } })
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          reconcileStatus: 'NEEDS_REVIEW',
          lastErrorCode: reason,
          nextRetryAt: null,
          leaseToken: null,
          leaseUntil: null,
          version: { increment: 1 },
        },
      })
      await tx.auditLog.create({
        data: {
          action: 'PAYOS_PAYMENT_NEEDS_REVIEW',
          entityType: 'Payment',
          entityId: paymentId,
          newValues: { reason, evidenceHash: paymentHash(data), verifiedEvidence: data as Prisma.InputJsonObject },
        },
      })
    })
  }

  async queryPayment(input: ProviderScope & { merchantRequestRef: string }): Promise<ProviderFinancialResult> {
    if (!this.matches(input)) return UNKNOWN
    const payment = await this.db.payment.findFirst({
      where: { ...this.where(), merchantRequestRef: input.merchantRequestRef },
    })
    if (!payment) return UNKNOWN
    const row = await this.mapping(payment.id)
    if (!row) return { kind: 'NOT_FOUND' }
    if (!row.lastResponse && !row.paymentLinkId) return { kind: 'NOT_FOUND' }
    const data = await this.client.request('GET', `/${row.orderCode}`)
    if (!data) return UNKNOWN
    const link = data.id ?? data.paymentLinkId
    if (
      data.orderCode !== Number(row.orderCode) ||
      typeof link !== 'string' ||
      (row.paymentLinkId && link !== row.paymentLinkId) ||
      data.amount !== payment.amount.toNumber()
    ) {
      await this.review(payment.id, data, 'PAYOS_PAYMENT_MAPPING_MISMATCH')
      return UNKNOWN
    }
    if (!row.paymentLinkId)
      await this.db.payosCheckout.update({ where: { paymentId: payment.id }, data: { paymentLinkId: link } })
    const transactions = Array.isArray(data.transactions) ? data.transactions : []
    if (
      typeof data.amountPaid !== 'number' ||
      !Number.isSafeInteger(data.amountPaid) ||
      data.amountPaid < 0 ||
      transactions.length > 1 ||
      (data.amountPaid > 0 && data.amountPaid !== payment.amount.toNumber()) ||
      (data.status === 'PAID' && data.amountRemaining !== undefined && data.amountRemaining !== 0) ||
      (data.accountNumber !== undefined && data.accountNumber !== this.account)
    ) {
      await this.review(payment.id, data, 'PAYOS_PAYMENT_AMOUNT_REVIEW')
      return UNKNOWN
    }
    let status: VerifiedPaymentEvent['status'] = 'PROCESSING'
    let reference: string | null = null,
      occurredAt = payment.createdAt.toISOString()
    if (data.status === 'PAID') {
      const transfer = transactions[0]
      if (
        !object(transfer) ||
        transfer.amount !== payment.amount.toNumber() ||
        data.amountPaid !== payment.amount.toNumber() ||
        typeof transfer.reference !== 'string' ||
        !transfer.reference ||
        transfer.reference.length > 180 ||
        !transactionTime(transfer.transactionDateTime)
      ) {
        await this.review(payment.id, data, 'PAYOS_PAYMENT_AMOUNT_REVIEW')
        return UNKNOWN
      }
      reference = transfer.reference
      occurredAt = transactionTime(transfer.transactionDateTime)!
      status = 'SUCCEEDED'
    } else if (data.status === 'CANCELLED' && !transactions.length && data.amountPaid === 0) status = 'CANCELLED'
    else if (data.status === 'EXPIRED' && !transactions.length && data.amountPaid === 0) status = 'EXPIRED'
    else if (!['PENDING', 'PROCESSING'].includes(String(data.status))) return UNKNOWN
    const snapshot = row.lastResponse as PayosData | null
    const checkout = /^[A-Za-z0-9-]{1,180}$/.test(link)
      ? {
          type: payment.paymentMethod === 'QR' ? ('QR' as const) : ('REDIRECT' as const),
          url: typeof snapshot?.checkoutUrl === 'string' ? snapshot.checkoutUrl : `https://pay.payos.vn/web/${link}`,
          qrData: typeof snapshot?.qrCode === 'string' ? snapshot.qrCode : null,
        }
      : undefined
    return {
      kind: 'CONFIRMED_RESULT',
      event: {
        ...this.scope,
        kind: 'PAYMENT',
        merchantRequestRef: input.merchantRequestRef,
        providerEventId: `payos-query:${paymentHash(data)}`,
        transactionRef: reference,
        amount: payment.amount.toFixed(0),
        currency: 'VND',
        status,
        occurredAt,
      },
      ...(checkout ? { checkout } : {}),
    }
  }

  async isConnectionProbe(raw: Buffer): Promise<boolean> {
    try {
      const payload = JSON.parse(raw.toString('utf8')),
        d = payload.data
      return (
        payosVerified(d, payload.signature, this.secret) &&
        d.orderCode === 123 &&
        d.amount === 3000 &&
        d.accountNumber === '12345678' &&
        d.reference === 'TF230204212323' &&
        d.paymentLinkId === '124c33293c43417ab7879e14c8d9eb18'
      )
    } catch {
      return false
    }
  }

  async verifyWebhook(raw: Buffer): Promise<VerifiedPaymentEvent | null> {
    try {
      if (raw.length > 16384) return null
      const payload = JSON.parse(raw.toString('utf8')),
        d = payload.data
      if (
        !payosVerified(d, payload.signature, this.secret) ||
        d.code !== '00' ||
        !positive(d.orderCode) ||
        !positive(d.amount) ||
        d.currency !== 'VND' ||
        typeof d.reference !== 'string' ||
        !d.reference ||
        d.reference.length > 180 ||
        typeof d.paymentLinkId !== 'string' ||
        !transactionTime(d.transactionDateTime)
      )
        return null
      const row = await this.db.payosCheckout.findUnique({
        where: { orderCode: BigInt(d.orderCode) },
        include: { payment: true },
      })
      if (
        !row ||
        !this.matches({
          gateway: row.payment.paymentGateway,
          environment: row.payment.providerEnvironment!,
          merchantAccountKey: row.payment.merchantAccountKey!,
        })
      )
        return null
      if (d.accountNumber !== this.account || (row.paymentLinkId && row.paymentLinkId !== d.paymentLinkId)) {
        await this.review(row.paymentId, d, 'PAYOS_PAYMENT_MAPPING_MISMATCH')
        return null
      }
      if (!row.payment.amount.equals(d.amount)) {
        await this.review(row.paymentId, d, 'PAYOS_PAYMENT_AMOUNT_REVIEW')
        return null
      }
      if (!row.paymentLinkId)
        await this.db.payosCheckout.update({
          where: { paymentId: row.paymentId },
          data: { paymentLinkId: d.paymentLinkId },
        })
      return {
        ...this.scope,
        kind: 'PAYMENT',
        merchantRequestRef: row.payment.merchantRequestRef!,
        providerEventId: `payos:${paymentHash([d.paymentLinkId, d.reference])}`,
        transactionRef: d.reference,
        amount: String(d.amount),
        currency: 'VND',
        status: 'SUCCEEDED',
        occurredAt: transactionTime(d.transactionDateTime)!,
      }
    } catch (error) {
      if (error instanceof SyntaxError) return null
      throw error // Storage failure must remain retryable, never acknowledged as a valid intake.
    }
  }

  refund(): Promise<ProviderFinancialResult> {
    return Promise.resolve(UNKNOWN)
  }
  queryRefund(): Promise<ProviderFinancialResult> {
    return Promise.resolve(UNKNOWN)
  }
}
