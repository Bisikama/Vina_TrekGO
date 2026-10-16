import { createHash } from 'node:crypto'

export const paymentHash = (value: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item: unknown) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
          : item,
      ),
    )
    .digest('hex')

function seconds(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isInteger(value) || value < 1 || value > 86400) throw new Error(`Invalid ${name}`)
  return value
}
export const paymentRecoveryConfig = () => ({
  leaseSeconds: seconds('PAYMENT_RECOVERY_LEASE_SECONDS', momoEnabled() ? 120 : 30),
  retrySeconds: seconds('PAYMENT_RECOVERY_RETRY_SECONDS', 30),
  maxAttempts: seconds('PAYMENT_RECOVERY_MAX_ATTEMPTS', 8),
  timeoutSeconds: seconds('PAYMENT_PROVIDER_TIMEOUT_SECONDS', momoEnabled() ? 35 : 8),
})
const momoEnabled = () => process.env.PAYMENT_PROVIDER === 'momo' ||
  (process.env.PAYMENT_ENABLED_PROVIDERS ?? '').split(',').some((value) => value.trim() === 'momo')
export const trailCheckoutTtlSeconds = () => seconds('PAYMENT_TRAIL_CHECKOUT_TTL_SECONDS', 900)

export async function providerCall<T>(operation: () => Promise<T>): Promise<T | { kind: 'UNKNOWN' }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation(),
      new Promise<{ kind: 'UNKNOWN' }>((resolve) => {
        timer = setTimeout(() => resolve({ kind: 'UNKNOWN' }), paymentRecoveryConfig().timeoutSeconds * 1000)
      }),
    ])
  } catch {
    return { kind: 'UNKNOWN' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
