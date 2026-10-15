import { createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import {
  PaymentProvider,
  ProviderScope,
  ProviderPaymentInput,
  ProviderResult,
  ProviderFinancialResult,
  VerifiedPaymentEvent,
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
  readonly paymentResultsViaIpnOnly = true
  readonly scope: ProviderScope
  private readonly secret: string
  private readonly returnUrl: string
  constructor() {
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
    this.returnUrl = required('VNPAY_SANDBOX_RETURN_URL')
    const url = new URL(this.returnUrl)
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((!local && url.protocol !== 'https:') || url.username || url.password || url.hash)
      throw new Error('Invalid VNPAY_SANDBOX_RETURN_URL')
    this.scope = { gateway: 'vnpay', environment: 'SANDBOX', merchantAccountKey: merchant }
  }
  async createPayment(input: ProviderPaymentInput): Promise<ProviderResult> {
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
      return UNKNOWN
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
    return { kind: 'CONFIRMED_RESULT', status: 'PROCESSING', checkout: { type: 'REDIRECT', url, qrData: null } }
  }
  // This adapter's scope is collection through IPN. Unknown results are retained
  // for review by shared recovery; never infer failure or issue a blind refund.
  async queryPayment(): Promise<ProviderFinancialResult> {
    return UNKNOWN
  }
  async refund(): Promise<ProviderFinancialResult> {
    return UNKNOWN
  }
  async queryRefund(): Promise<ProviderFinancialResult> {
    return UNKNOWN
  }

  async verifyWebhook(raw: Buffer): Promise<VerifiedPaymentEvent | null> {
    try {
      if (raw.length > 16384) return null
      const data: Record<string, string> = JSON.parse(raw.toString('utf8'))
      if (
        !data ||
        Array.isArray(data) ||
        Object.entries(data).some(([key, value]) => !key.startsWith('vnp_') || typeof value !== 'string')
      )
        return null
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
        return null
      const succeeded = data.vnp_ResponseCode === '00' && data.vnp_TransactionStatus === '00'
      if (succeeded && !/^[1-9]\d{0,14}$/.test(data.vnp_TransactionNo ?? '')) return null
      // PayDate is optional in VNPAY's IPN contract. When absent use receipt
      // time; inbox deduplication is based on the signed payload, not this time.
      const occurredAt = data.vnp_PayDate ? parseDate(data.vnp_PayDate) : new Date().toISOString()
      if (!occurredAt) return null
      const ref = data.vnp_TxnRef.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
      return {
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
      }
    } catch {
      return null
    }
  }
}
