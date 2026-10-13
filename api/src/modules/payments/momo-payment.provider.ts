import { Injectable } from '@nestjs/common'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { PrismaService } from '../../shared/services/prisma.service'
import {
  PaymentProvider,
  ProviderScope,
  ProviderPaymentInput,
  ProviderRefundInput,
  ProviderResult,
  ProviderFinancialResult,
  VerifiedPaymentEvent,
  VerifiedProviderEvent,
} from './payment-provider.port'
import { paymentHash, paymentRecoveryConfig } from './payment-utils'

type Payload = Record<string, unknown>
const UNKNOWN = { kind: 'UNKNOWN' } as const
const IPN_FIELDS =
  'amount extraData message orderId orderInfo orderType partnerCode payType requestId responseTime resultCode transId'
const QUERY_FIELDS = 'orderId partnerCode requestId'
const CREATE_FIELDS = 'amount extraData ipnUrl orderId orderInfo partnerCode redirectUrl requestId requestType'

// These are wire-format fields, not URL-encoded query parameters.
export function momoSignature(data: Payload, fields: string, accessKey: string, secret: string) {
  const raw =
    `accessKey=${accessKey}&` +
    fields
      .split(' ')
      .map((key) => {
        if (typeof data[key] !== 'string' && typeof data[key] !== 'number') throw new Error('Invalid MoMo field')
        return `${key}=${data[key]}`
      })
      .join('&')
  return createHmac('sha256', secret).update(raw).digest('hex')
}

function integer(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value)
  if (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && Number.isSafeInteger(Number(value))) return value
  return null
}
function timestamp(value: unknown) {
  const n = integer(value)
  return n && Number(n) > 0 && Number(n) <= 8640000000000000 ? new Date(Number(n)).toISOString() : null
}
function status(code: unknown): VerifiedPaymentEvent['status'] | null {
  if (code === 0) return 'SUCCEEDED'
  if ([1000, 7000, 7002, 9000].includes(code as number)) return 'PROCESSING'
  if (code === 1005) return 'EXPIRED'
  if ([1003, 1006, 1017].includes(code as number)) return 'CANCELLED'
  if ([98, 1001, 1002, 1004, 1007, 1026, 1080, 1081, 1088, 2019, 4001, 4002, 4100].includes(code as number))
    return 'FAILED'
  // Transport/authentication/unknown errors are not evidence that no money moved.
  return null
}
function orderId(ref: string, kind: 'payment' | 'refund') {
  if (!new RegExp(`^${kind}:[0-9a-f-]{36}$`).test(ref)) throw new Error('Invalid merchant reference')
  return ref.replace(':', '-')
}
function httpsConfig(name: string) {
  const value = process.env[name] ?? ''
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error(`Invalid ${name}`)
  return value
}

@Injectable()
export class MomoPaymentProvider extends PaymentProvider {
  readonly supportsIdempotentCreate = true
  readonly scope: ProviderScope
  private readonly partner: string
  private readonly accessKey: string
  private readonly secret: string
  private readonly ipnUrl: string
  private readonly redirectUrl: string

  constructor(private readonly db: PrismaService) {
    super()
    // No configurable endpoint: sandbox credentials cannot accidentally reach production.
    if (process.env.PAYMENT_PROVIDER_ENVIRONMENT !== 'SANDBOX') throw new Error('MoMo M9 requires SANDBOX')
    const required = (name: string) => {
      const value = process.env[name]
      if (!value || value.trim() !== value) throw new Error(`Missing or invalid ${name}`)
      return value
    }
    this.partner = required('MOMO_SANDBOX_PARTNER_CODE')
    this.accessKey = required('MOMO_SANDBOX_ACCESS_KEY')
    this.secret = required('MOMO_SANDBOX_SECRET_KEY')
    if (this.partner.length > 100) throw new Error('Invalid MoMo partner code')
    this.scope = { gateway: 'momo', environment: 'SANDBOX', merchantAccountKey: this.partner }
    this.ipnUrl = httpsConfig('MOMO_SANDBOX_IPN_URL')
    this.redirectUrl = httpsConfig('MOMO_SANDBOX_REDIRECT_URL')
    const config = paymentRecoveryConfig()
    if (config.timeoutSeconds < 31 || config.leaseSeconds <= config.timeoutSeconds * 3 + 5)
      throw new Error('MoMo requires provider timeout >=31s and recovery lease >3*timeout+5s')
  }

  private matches(scope: ProviderScope) {
    return (
      scope.gateway === this.scope.gateway &&
      scope.environment === this.scope.environment &&
      scope.merchantAccountKey === this.partner
    )
  }
  private where() {
    return { paymentGateway: 'momo', providerEnvironment: 'SANDBOX' as const, merchantAccountKey: this.partner }
  }
  private money(amount: string, currency: string) {
    return currency === 'VND' && integer(amount) !== null && Number(amount) >= 1000 && Number(amount) <= 50000000
  }
  private recent(createdAt: Date) {
    return Date.now() - createdAt.getTime() < 30 * 86400000
  }
  private async post(path: string, body: Payload, fields: string): Promise<Payload | null> {
    try {
      const signature = momoSignature(body, fields, this.accessKey, this.secret)
      const response = await fetch(`https://test-payment.momo.vn/v2/gateway/api/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, signature }),
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) return null
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null
      const result = data as Payload
      if (result.partnerCode !== this.partner || result.orderId !== body.orderId || result.requestId !== body.requestId)
        return null
      return result
    } catch {
      return null
    }
  }

  async createPayment(input: ProviderPaymentInput): Promise<ProviderResult> {
    if (!this.matches(input) || !this.money(input.amount, input.currency) || input.expiresAt.getTime() <= Date.now())
      return UNKNOWN
    const id = orderId(input.merchantRequestRef, 'payment')
    const body = {
      partnerCode: this.partner,
      requestId: id,
      orderId: id,
      amount: Number(input.amount),
      orderInfo: 'TrekGo payment',
      requestType: 'captureWallet',
      extraData: '',
      autoCapture: true,
      lang: 'vi',
      ipnUrl: this.ipnUrl,
      redirectUrl: this.redirectUrl,
    }
    const data = await this.post('create', body, CREATE_FIELDS)
    if (!data || data.resultCode !== 0 || integer(data.amount) !== input.amount) return UNKNOWN
    // Some sandbox versions omit the optional response signature. HTTPS still authenticates the response.
    if (
      data.signature !== undefined &&
      !this.validSignature(data, 'amount message orderId partnerCode payUrl requestId responseTime resultCode')
    )
      return UNKNOWN
    if (typeof data.payUrl !== 'string') return UNKNOWN
    try {
      const url = new URL(data.payUrl)
      if (url.origin !== 'https://test-payment.momo.vn' || url.username || url.password) return UNKNOWN
    } catch {
      return UNKNOWN
    }
    const qr = typeof data.qrCodeUrl === 'string' && data.qrCodeUrl.length > 0 ? data.qrCodeUrl : null
    return {
      kind: 'CONFIRMED_RESULT',
      status: 'PROCESSING',
      checkout: {
        type: input.paymentMethod,
        url: data.payUrl,
        qrData: input.paymentMethod === 'QR' ? (qr ?? data.payUrl) : null,
      },
    }
  }

  private paymentEvent(data: Payload, ref: string): VerifiedPaymentEvent | null {
    const mapped = status(data.resultCode),
      amount = integer(data.amount),
      at = timestamp(data.responseTime)
    const trans = integer(data.transId)
    if (!mapped || !amount || !at || (mapped === 'SUCCEEDED' && (!trans || trans === '0'))) return null
    return {
      ...this.scope,
      kind: 'PAYMENT',
      merchantRequestRef: ref,
      amount,
      currency: 'VND',
      status: mapped,
      transactionRef: trans && trans !== '0' ? trans : null,
      occurredAt: at,
      providerEventId: `momo:${paymentHash([data.orderId, data.transId, data.resultCode, data.responseTime])}`,
    }
  }
  async queryPayment(input: ProviderScope & { merchantRequestRef: string }): Promise<ProviderFinancialResult> {
    if (!this.matches(input)) return UNKNOWN
    const data = await this.post(
      'query',
      {
        partnerCode: this.partner,
        orderId: orderId(input.merchantRequestRef, 'payment'),
        requestId: randomUUID(),
        lang: 'vi',
      },
      QUERY_FIELDS,
    )
    if (!data) return UNKNOWN
    if (data.resultCode === 42) {
      const row = await this.db.payment.findFirst({
        where: { ...this.where(), merchantRequestRef: input.merchantRequestRef },
      })
      return row && this.recent(row.createdAt) ? { kind: 'NOT_FOUND' } : UNKNOWN
    }
    const event = this.paymentEvent(data, input.merchantRequestRef)
    return event ? { kind: 'CONFIRMED_RESULT', event } : UNKNOWN
  }

  private async refundRow(ref: string) {
    return this.db.refund.findFirst({ where: { ...this.where(), merchantRefundRef: ref }, include: { payment: true } })
  }
  private refundEvent(
    data: Payload,
    row: NonNullable<Awaited<ReturnType<MomoPaymentProvider['refundRow']>>>,
  ): ProviderFinancialResult {
    const mapped = status(data.resultCode),
      amount = integer(data.amount),
      at = timestamp(data.responseTime)
    const trans = integer(data.transId)
    if (!mapped || mapped === 'EXPIRED' || !amount || !at || (mapped === 'SUCCEEDED' && (!trans || trans === '0')))
      return UNKNOWN
    return {
      kind: 'CONFIRMED_RESULT',
      event: {
        ...this.scope,
        kind: 'REFUND',
        merchantRequestRef: row.payment.merchantRequestRef!,
        merchantRefundRef: row.merchantRefundRef!,
        transactionRef: row.payment.transactionRef,
        refundTransactionRef: trans && trans !== '0' ? trans : null,
        amount,
        currency: 'VND',
        status: mapped,
        occurredAt: at,
        providerEventId: `momo-refund:${paymentHash([data.orderId, data.transId, data.resultCode, data.responseTime])}`,
      },
    }
  }
  async refund(input: ProviderRefundInput): Promise<ProviderFinancialResult> {
    if (!this.matches(input) || !this.money(input.amount, input.currency)) return UNKNOWN
    const row = await this.refundRow(input.merchantRefundRef)
    if (
      !row ||
      !this.recent(row.createdAt) ||
      !row.amount.equals(input.amount) ||
      row.currency !== input.currency ||
      row.payment.merchantRequestRef !== input.merchantRequestRef ||
      row.payment.status !== 'SUCCEEDED' ||
      row.payment.paymentGateway !== this.scope.gateway ||
      row.payment.providerEnvironment !== this.scope.environment ||
      row.payment.merchantAccountKey !== this.partner ||
      !integer(row.payment.transactionRef) ||
      row.payment.transactionRef === '0'
    )
      return UNKNOWN
    const id = orderId(input.merchantRefundRef, 'refund')
    const data = await this.post(
      'refund',
      {
        partnerCode: this.partner,
        orderId: id,
        requestId: id,
        amount: Number(input.amount),
        transId: Number(row.payment.transactionRef),
        description: '',
        lang: 'vi',
      },
      'amount description orderId partnerCode requestId transId',
    )
    return data ? this.refundEvent(data, row) : UNKNOWN
  }
  async queryRefund(input: ProviderScope & { merchantRefundRef: string }): Promise<ProviderFinancialResult> {
    if (!this.matches(input)) return UNKNOWN
    const row = await this.refundRow(input.merchantRefundRef)
    if (!row) return UNKNOWN
    const id = orderId(input.merchantRefundRef, 'refund')
    const data = await this.post(
      'refund/query',
      { partnerCode: this.partner, orderId: id, requestId: randomUUID(), lang: 'vi' },
      QUERY_FIELDS,
    )
    if (!data) return UNKNOWN
    if (data.resultCode === 42) return this.recent(row.createdAt) ? { kind: 'NOT_FOUND' } : UNKNOWN
    if (data.resultCode !== 0 || !Array.isArray(data.refundTrans)) return UNKNOWN
    const matches = data.refundTrans.filter((x: Payload) => x && x.orderId === id)
    if (matches.length !== 1) return UNKNOWN
    return this.refundEvent({ ...matches[0], responseTime: matches[0].createdTime }, row)
  }

  private validSignature(data: Payload, fields: string) {
    try {
      if (typeof data.signature !== 'string' || !/^[a-fA-F0-9]{64}$/.test(data.signature)) return false
      const expected = momoSignature(data, fields, this.accessKey, this.secret)
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(data.signature, 'hex'))
    } catch {
      return false
    }
  }
  verifyWebhook(rawBody: Buffer): Promise<VerifiedProviderEvent | null> {
    try {
      if (rawBody.length > 16384) return Promise.resolve(null)
      const data: Payload = JSON.parse(rawBody.toString('utf8'))
      if (
        !data ||
        data.partnerCode !== this.partner ||
        !this.validSignature(data, IPN_FIELDS) ||
        typeof data.orderId !== 'string' ||
        !/^payment-[0-9a-f-]{36}$/.test(data.orderId) ||
        data.requestId !== data.orderId ||
        data.orderType !== 'momo_wallet'
      )
        return Promise.resolve(null)
      // Delayed signed notifications remain valid: durable inbox + domain expiry govern their application.
      return Promise.resolve(this.paymentEvent(data, data.orderId.replace('payment-', 'payment:')))
    } catch {
      return Promise.resolve(null)
    }
  }
}
