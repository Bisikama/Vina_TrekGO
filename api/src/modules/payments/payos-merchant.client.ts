import { createHmac, timingSafeEqual } from 'node:crypto'
import { paymentRecoveryConfig } from './payment-utils'

export type PayosData = Record<string, unknown>
// payOS signs sorted fields, not JSON or URL-encoded strings.
export function payosSignature(data: PayosData, secret: string): string {
  const normalize = (value: unknown): string => {
    if (value === null || value === undefined || value === 'null' || value === 'undefined') return ''
    if (Array.isArray(value))
      return JSON.stringify(
        value.map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
            : item,
        ),
      )
    return String(value)
  }
  return createHmac('sha256', secret)
    .update(
      Object.keys(data)
        .filter((k) => data[k] !== undefined)
        .sort()
        .map((k) => `${k}=${normalize(data[k])}`)
        .join('&'),
    )
    .digest('hex')
}

export function payosVerified(data: unknown, signature: unknown, secret: string): data is PayosData {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    typeof signature !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return false
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(payosSignature(data as PayosData, secret), 'hex'))
}

export class PayosMerchantClient {
  constructor(
    private readonly clientId: string,
    private readonly apiKey: string,
    private readonly checksumKey: string,
  ) {}

  async request(method: 'GET' | 'POST', path: string, body?: PayosData): Promise<PayosData | null> {
    try {
      const response = await fetch(`https://api-merchant.payos.vn/v2/payment-requests${path}`, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(paymentRecoveryConfig().timeoutSeconds * 1000),
        headers: { 'x-client-id': this.clientId, 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
        ...(body
          ? {
              body: JSON.stringify({
                ...body,
                signature: payosSignature(
                  {
                    amount: body.amount,
                    cancelUrl: body.cancelUrl,
                    description: body.description,
                    orderCode: body.orderCode,
                    returnUrl: body.returnUrl,
                  },
                  this.checksumKey,
                ),
              }),
            }
          : {}),
      })
      if (!response.ok) return null
      const raw = await response.text()
      if (raw.length > 65536) return null
      const result = JSON.parse(raw)
      // Never infer NOT_FOUND from unauthenticated or undocumented errors.
      if (result.code !== '00' || !payosVerified(result.data, result.signature, this.checksumKey)) return null
      return result.data
    } catch {
      return null
    }
  }
}
