import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { Payment, Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import { VnpayFields, VnpayMerchantClient } from './vnpay-merchant.client'
import {
  PaymentProvider,
  ProviderScope,
  ProviderPaymentInput,
  ProviderResult,
  ProviderFinancialResult,
  VerifiedPaymentEvent,
  ProviderRefundInput,
} from './payment-provider.port'
import { paymentHash } from './payment-utils'

const UNKNOWN = { kind: 'UNKNOWN' } as const
const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, '+')
export function vnpayQuery(data: Record<string, string>) {
  return Object.keys(data)
    .filter((key) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
    .sort()
    .map((key) => `${encode(key)}=${encode(data[key])}`)
    .join('&')
}
export function vnpaySignature(data: Record<string, string>, secret: string) {
  return createHmac('sha512', secret).update(vnpayQuery(data), 'utf8').digest('hex')
}
function localDate(date: Date) {
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace(/[-T:]/g, '')
}
function parseDate(value: string) {
  if (!/^\d{14}$/.test(value)) return null
  const date = new Date(
    `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+07:00`,
  )
  return Number.isFinite(date.getTime()) && localDate(date) === value ? date.toISOString() : null
}

export class VnpayPaymentProvider extends PaymentProvider {
  readonly supportsRefundDispatch = true
  readonly waitForCheckoutExpiry = true
  readonly scope: ProviderScope
  private readonly secret: string
  private readonly returnUrl: string
  private readonly merchant: VnpayMerchantClient
  constructor(private readonly db: PrismaService) {
    super()
    if (process.env.PAYMENT_PROVIDER_ENVIRONMENT !== 'SANDBOX') throw new Error('VNPAY requires SANDBOX')
    const required = (name: string) => {
      const value = process.env[name]
      if (!value || value.trim() !== value) throw new Error(`Missing or invalid ${name}`)
      return value
    }
    const merchant = required('VNPAY_SANDBOX_TMN_CODE')
    if (!/^[A-Za-z0-9]{8}$/.test(merchant)) throw new Error('Invalid VNPAY terminal code')
    this.secret = required('VNPAY_SANDBOX_HASH_SECRET')
    this.merchant = new VnpayMerchantClient(this.secret)
    this.returnUrl = required('VNPAY_SANDBOX_RETURN_URL')
    const url = new URL(this.returnUrl)
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((!local && url.protocol !== 'https:') || url.username || url.password || url.hash)
      throw new Error('Invalid VNPAY_SANDBOX_RETURN_URL')
    this.scope = { gateway: 'vnpay', environment: 'SANDBOX', merchantAccountKey: merchant }
  }
  createPayment(input: ProviderPaymentInput): Promise<ProviderResult> {
    const ip = input.clientIp?.replace(/^::ffff:/, '')
    if (
      input.gateway !== this.scope.gateway ||
      input.environment !== this.scope.environment ||
      input.merchantAccountKey !== this.scope.merchantAccountKey ||
      input.currency !== 'VND' ||
      !/^[1-9]\d{0,9}$/.test(input.amount) ||
      BigInt(input.amount) < 5000n ||
      !/^payment:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.merchantRequestRef) ||
      !ip ||
      !isIP(ip) ||
      input.expiresAt.getTime() <= Date.now()
    )
      return Promise.resolve(UNKNOWN)
    const ref = input.merchantRequestRef.slice(8).replace(/-/g, '')
    const data: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.scope.merchantAccountKey,
      vnp_Amount: (BigInt(input.amount) * 100n).toString(),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: ref,
      vnp_OrderInfo: `Thanh toan TrekGo ${ref}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_IpAddr: ip,
      vnp_ReturnUrl: input.returnPath ? new URL(input.returnPath, this.returnUrl).toString() : this.returnUrl,
      vnp_CreateDate: localDate(new Date()),
      vnp_ExpireDate: localDate(input.expiresAt),
      ...(input.paymentMethod === 'QR' ? { vnp_BankCode: 'VNPAYQR' } : {}),
    }
    const url = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${vnpayQuery(data)}&vnp_SecureHash=${vnpaySignature(data, this.secret)}`
    return Promise.resolve({ kind: 'CONFIRMED_RESULT', status: 'PROCESSING', checkout: { type: 'REDIRECT', url, qrData: null } })
  }
  private matches(scope: ProviderScope) {
    return scope.gateway === this.scope.gateway && scope.environment === this.scope.environment &&
      scope.merchantAccountKey === this.scope.merchantAccountKey
  }
  private where() {
    return { paymentGateway: this.scope.gateway, providerEnvironment: this.scope.environment,
      merchantAccountKey: this.scope.merchantAccountKey }
  }
  private serverIp() {
    const ip = process.env.VNPAY_SANDBOX_API_IP?.replace(/^::ffff:/, '')
    return ip && isIP(ip) ? ip : null
  }
  private transactionDate(payment: Payment) {
    // Query/refund require the exact original vnp_CreateDate, NOT paid_at or today's date.
    try {
      const checkout = payment.checkoutData as { url?: string } | null
      const url = new URL(checkout?.url ?? '')
      const date = url.searchParams.get('vnp_CreateDate') ?? ''
      if (url.origin !== 'https://sandbox.vnpayment.vn' ||
        url.searchParams.get('vnp_TxnRef') !== payment.merchantRequestRef?.slice(8).replace(/-/g, '') ||
        url.searchParams.get('vnp_TmnCode') !== this.scope.merchantAccountKey || !parseDate(date)) return null
      return date
    } catch { return null }
  }
  private async query(payment: Payment, transactionNo?: string) {
    const ip = this.serverIp(), date = this.transactionDate(payment)
    if (!ip || !date || !payment.merchantRequestRef) return null
    return this.merchant.post({
      vnp_RequestId: randomUUID().replace(/-/g, ''), vnp_Version: '2.1.0', vnp_Command: 'querydr',
      vnp_TmnCode: this.scope.merchantAccountKey, vnp_TxnRef: payment.merchantRequestRef.slice(8).replace(/-/g, ''),
      vnp_TransactionDate: date, vnp_CreateDate: localDate(new Date()), vnp_IpAddr: ip,
      vnp_OrderInfo: `Query TrekGo ${payment.id}`, ...(transactionNo ? { vnp_TransactionNo: transactionNo } : {}),
    })
  }
  private sameTransaction(data: VnpayFields, payment: Payment) {
    return data.vnp_TmnCode === this.scope.merchantAccountKey &&
      data.vnp_TxnRef === payment.merchantRequestRef?.slice(8).replace(/-/g, '')
  }
  async queryPayment(input: ProviderScope & { merchantRequestRef: string }): Promise<ProviderFinancialResult> {
    if (!this.matches(input)) return UNKNOWN
    const payment = await this.db.payment.findFirst({ where: { ...this.where(), merchantRequestRef: input.merchantRequestRef } })
    if (!payment || payment.currency !== 'VND' || !payment.amount.isInteger() || !payment.amount.isPositive()) return UNKNOWN
    const data = await this.query(payment)
    if (!data || !this.sameTransaction(data, payment) || data.vnp_ResponseCode !== '00' ||
      data.vnp_TransactionType !== '01' || data.vnp_Amount !== payment.amount.mul(100).toFixed(0)) return UNKNOWN
    const status = data.vnp_TransactionStatus === '00' ? 'SUCCEEDED' :
      data.vnp_TransactionStatus === '02' ? 'FAILED' :
        ['01', '05', '06'].includes(data.vnp_TransactionStatus) ? 'PROCESSING' : null
    const paidAt = parseDate(data.vnp_PayDate ?? '')
    if (!status || (status === 'SUCCEEDED' && (!paidAt || !/^[1-9]\d{0,14}$/.test(data.vnp_TransactionNo)))) return UNKNOWN
    if (payment.transactionRef && payment.transactionRef !== data.vnp_TransactionNo) return UNKNOWN
    return { kind: 'CONFIRMED_RESULT', event: {
      ...this.scope, kind: 'PAYMENT', merchantRequestRef: input.merchantRequestRef,
      transactionRef: /^[1-9]\d{0,14}$/.test(data.vnp_TransactionNo ?? '') ? data.vnp_TransactionNo : null,
      amount: payment.amount.toFixed(0), currency: payment.currency, status,
      occurredAt: paidAt ?? payment.createdAt.toISOString(),
      providerEventId: `vnpay-query:${paymentHash(data)}`,
    } }
  }
  private async refundRow(ref: string) {
    return this.db.refund.findFirst({ where: { ...this.where(), merchantRefundRef: ref }, include: { payment: true } })
  }
  private refundResult(data: VnpayFields, row: NonNullable<Awaited<ReturnType<VnpayPaymentProvider['refundRow']>>>, knownRef?: string): ProviderFinancialResult {
    if (!this.sameTransaction(data, row.payment) || data.vnp_ResponseCode !== '00' ||
      data.vnp_Amount !== row.amount.mul(100).toFixed(0) ||
      data.vnp_TransactionType !== (row.amount.equals(row.payment.amount) ? '02' : '03') ||
      !/^[1-9]\d{0,14}$/.test(data.vnp_TransactionNo ?? '') ||
      (knownRef ? data.vnp_TransactionNo !== knownRef : data.vnp_OrderInfo !== `Refund TrekGo ${row.id}`)) return UNKNOWN
    const status = data.vnp_TransactionStatus === '00' ? 'SUCCEEDED' :
      ['02', '09'].includes(data.vnp_TransactionStatus) ? 'FAILED' :
        ['01', '05', '06'].includes(data.vnp_TransactionStatus) ? 'PROCESSING' : null
    const date = parseDate(data.vnp_PayDate ?? '')
    if (!status || (status === 'SUCCEEDED' && !date)) return UNKNOWN
    return { kind: 'CONFIRMED_RESULT', event: {
      ...this.scope, kind: 'REFUND', merchantRequestRef: row.payment.merchantRequestRef!,
      merchantRefundRef: row.merchantRefundRef!, transactionRef: row.payment.transactionRef,
      refundTransactionRef: data.vnp_TransactionNo, amount: row.amount.toFixed(0), currency: row.currency,
      status, occurredAt: date ?? row.createdAt.toISOString(), providerEventId: `vnpay-refund:${paymentHash(data)}`,
    } }
  }
  async refund(input: ProviderRefundInput): Promise<ProviderFinancialResult> {
    if (!this.matches(input)) return UNKNOWN
    const row = await this.refundRow(input.merchantRefundRef)
    const ip = this.serverIp(), date = row && this.transactionDate(row.payment)
    if (!row || !ip || !date || row.payment.merchantRequestRef !== input.merchantRequestRef ||
      row.payment.paymentGateway !== this.scope.gateway || row.payment.providerEnvironment !== this.scope.environment ||
      row.payment.merchantAccountKey !== this.scope.merchantAccountKey || row.payment.status !== 'SUCCEEDED' ||
      row.payment.reconcileStatus === 'NEEDS_REVIEW' || !['PENDING', 'PROCESSING'].includes(row.status) ||
      row.reconcileStatus === 'NEEDS_REVIEW' || row.requestHashVersion !== 1 ||
      row.currency !== 'VND' || row.payment.currency !== 'VND' || row.currency !== input.currency || !row.amount.equals(input.amount) ||
      !row.amount.isInteger() || !row.amount.isPositive() || row.amount.gt(row.payment.amount) ||
      !/^[1-9]\d{0,14}$/.test(row.payment.transactionRef ?? '')) return UNKNOWN
    const body: VnpayFields = {
      vnp_RequestId: row.id.replace(/-/g, ''), vnp_Version: '2.1.0', vnp_Command: 'refund',
      vnp_TmnCode: this.scope.merchantAccountKey, vnp_TransactionType: row.amount.equals(row.payment.amount) ? '02' : '03',
      vnp_TxnRef: input.merchantRequestRef.slice(8).replace(/-/g, ''), vnp_Amount: row.amount.mul(100).toFixed(0),
      vnp_TransactionNo: row.payment.transactionRef!, vnp_TransactionDate: date,
      vnp_CreateBy: 'TrekGo', vnp_CreateDate: localDate(new Date()), vnp_IpAddr: ip,
      vnp_OrderInfo: `Refund TrekGo ${row.id}`,
    }
    // Persist before transport. Even after a timeout/crash no process may send this refund twice.
    const claimed = await this.db.refund.updateMany({
      where: { id: row.id, version: row.version, providerPayload: { equals: Prisma.DbNull },
        reconcileStatus: { not: 'NEEDS_REVIEW' }, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { providerPayload: { vnpayDispatch: body } },
    })
    if (claimed.count !== 1) return UNKNOWN
    const data = await this.merchant.post(body)
    if (!data) return UNKNOWN
    // Retain the signed response so a crash before shared applyEvent is recoverable.
    await this.db.refund.updateMany({ where: { id: row.id }, data: { providerPayload: { vnpayDispatch: body, vnpayResponse: data } } })
    return this.refundResult(data, row)
  }
  async queryRefund(input: ProviderScope & { merchantRefundRef: string }): Promise<ProviderFinancialResult> {
    if (!this.matches(input)) return UNKNOWN
    const row = await this.refundRow(input.merchantRefundRef)
    if (!row || row.requestHashVersion !== 1 || row.payment.paymentGateway !== this.scope.gateway ||
      row.payment.providerEnvironment !== this.scope.environment || row.payment.merchantAccountKey !== this.scope.merchantAccountKey)
      return UNKNOWN
    if (row.providerPayload === null && !row.refundTransactionRef && ['PENDING', 'PROCESSING'].includes(row.status))
      return { kind: 'NOT_FOUND' } // Local proof that this adapter has never dispatched it.
    const metadata = row.providerPayload as Prisma.JsonObject | null
    const saved = metadata?.vnpayResponse
    let knownRef = row.refundTransactionRef ?? undefined
    if (this.merchant.verified(saved, 'refund')) {
      const cached = this.refundResult(saved, row)
      if (cached.kind === 'CONFIRMED_RESULT' && cached.event.kind === 'REFUND') {
        if (cached.event.status !== 'PROCESSING') return cached
        knownRef = cached.event.refundTransactionRef ?? undefined
      }
    }
    const data = await this.query(row.payment, knownRef)
    // querydr is keyed by the original payment, not our refund ID. Never apply an
    // unrelated refund (including another partial refund of the same amount).
    return data ? this.refundResult(data, row, knownRef) : UNKNOWN
  }

  verifyWebhook(raw: Buffer): Promise<VerifiedPaymentEvent | null> {
    try {
      if (raw.length > 16384) return Promise.resolve(null)
      const data: Record<string, string> = JSON.parse(raw.toString('utf8'))
      if (
        !data ||
        Array.isArray(data) ||
        Object.entries(data).some(([key, value]) => !key.startsWith('vnp_') || typeof value !== 'string')
      )
        return Promise.resolve(null)
      const signature = data.vnp_SecureHash
      if (
        !/^[a-fA-F0-9]{128}$/.test(signature ?? '') ||
        !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(vnpaySignature(data, this.secret), 'hex')) ||
        data.vnp_TmnCode !== this.scope.merchantAccountKey ||
        !/^[a-f0-9]{32}$/.test(data.vnp_TxnRef ?? '') ||
        !/^[1-9]\d{0,11}$/.test(data.vnp_Amount ?? '') ||
        BigInt(data.vnp_Amount) % 100n !== 0n ||
        !/^\d{2}$/.test(data.vnp_ResponseCode ?? '') ||
        !/^\d{2}$/.test(data.vnp_TransactionStatus ?? '')
      )
        return Promise.resolve(null)
      const succeeded = data.vnp_ResponseCode === '00' && data.vnp_TransactionStatus === '00'
      if (succeeded && !/^[1-9]\d{0,14}$/.test(data.vnp_TransactionNo ?? '')) return Promise.resolve(null)
      // PayDate is optional in VNPAY's IPN contract. When absent use receipt
      // time; inbox deduplication is based on the signed payload, not this time.
      const occurredAt = data.vnp_PayDate ? parseDate(data.vnp_PayDate) : new Date().toISOString()
      if (!occurredAt) return Promise.resolve(null)
      const ref = data.vnp_TxnRef.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
      return Promise.resolve({
        ...this.scope,
        kind: 'PAYMENT',
        merchantRequestRef: `payment:${ref}`,
        amount: (BigInt(data.vnp_Amount) / 100n).toString(),
        currency: 'VND',
        status: succeeded
          ? 'SUCCEEDED'
          : data.vnp_TransactionStatus !== '00' &&
              ['09', '10', '11', '12', '13', '24', '51', '65', '75', '79'].includes(data.vnp_ResponseCode)
            ? data.vnp_ResponseCode === '24'
              ? 'CANCELLED'
              : data.vnp_ResponseCode === '11'
                ? 'EXPIRED'
                : 'FAILED'
            : 'PROCESSING',
        transactionRef: /^[1-9]\d{0,14}$/.test(data.vnp_TransactionNo ?? '') ? data.vnp_TransactionNo : null,
        occurredAt,
        providerEventId: `vnpay:${paymentHash([data.vnp_TxnRef, data.vnp_TransactionNo, data.vnp_ResponseCode, data.vnp_TransactionStatus, data.vnp_PayDate])}`,
      })
    } catch {
      return Promise.resolve(null)
    }
  }
}
