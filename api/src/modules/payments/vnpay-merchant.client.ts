import { createHmac, timingSafeEqual } from 'node:crypto'
import { paymentRecoveryConfig } from './payment-utils'

export type VnpayFields = Record<string, string>
const QUERY_REQUEST = 'vnp_RequestId vnp_Version vnp_Command vnp_TmnCode vnp_TxnRef vnp_TransactionDate vnp_CreateDate vnp_IpAddr vnp_OrderInfo'
const REFUND_REQUEST = 'vnp_RequestId vnp_Version vnp_Command vnp_TmnCode vnp_TransactionType vnp_TxnRef vnp_Amount vnp_TransactionNo vnp_TransactionDate vnp_CreateBy vnp_CreateDate vnp_IpAddr vnp_OrderInfo'
const RESPONSE = 'vnp_ResponseId vnp_Command vnp_ResponseCode vnp_Message vnp_TmnCode vnp_TxnRef vnp_Amount vnp_BankCode vnp_PayDate vnp_TransactionNo vnp_TransactionType vnp_TransactionStatus vnp_OrderInfo'

// Merchant API uses ordered, pipe-delimited HMAC, not the checkout/IPN query encoding.
function signature(data: VnpayFields, fields: string, secret: string) {
  return createHmac('sha512', secret).update(fields.split(' ').map((key) => data[key] ?? '').join('|')).digest('hex')
}

export class VnpayMerchantClient {
  constructor(private readonly secret: string) {}

  verified(value: unknown, command: 'querydr' | 'refund'): value is VnpayFields {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const data = value as VnpayFields
    if (Object.values(data).some((item) => typeof item !== 'string') || data.vnp_Command !== command ||
      !/^[a-fA-F0-9]{128}$/.test(data.vnp_SecureHash ?? '')) return false
    const fields = RESPONSE + (command === 'querydr' ? ' vnp_PromotionCode vnp_PromotionAmount' : '')
    return timingSafeEqual(Buffer.from(data.vnp_SecureHash, 'hex'), Buffer.from(signature(data, fields, this.secret), 'hex'))
  }

  async post(data: VnpayFields): Promise<VnpayFields | null> {
    const command = data.vnp_Command as 'querydr' | 'refund'
    try {
      const response = await fetch('https://sandbox.vnpayment.vn/merchant_webapi/api/transaction', {
        method: 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(paymentRecoveryConfig().timeoutSeconds * 1000),
        body: JSON.stringify({ ...data, vnp_SecureHash: signature(data, command === 'refund' ? REFUND_REQUEST : QUERY_REQUEST, this.secret) }),
      })
      if (!response.ok) return null
      const raw = await response.text()
      if (raw.length > 65536) return null
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      const result = Object.fromEntries(Object.entries(parsed).map(([key, value]) =>
        [key, typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : value]))
      return this.verified(result, command) ? result : null
    } catch {
      return null
    }
  }
}
