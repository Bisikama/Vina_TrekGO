import { AppError, COMMON_ERROR_CODES as C } from '../../../shared/errors'

export function privateInvitationConfig(env: NodeJS.ProcessEnv = process.env) {
  const integer = (key: string, fallback: number, max: number) => {
    const value = Number(env[key] ?? fallback)
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${key}`)
    return value
  }
  return {
    ttlSeconds: integer('PRIVATE_INVITATION_TTL_SECONDS', 604800, 2592000),
    replaySeconds: integer('PRIVATE_INVITATION_REPLAY_SECONDS', 86400, 604800),
    createPerMinute: integer('PRIVATE_INVITATION_CREATE_PER_MINUTE', 10, 1000),
    createPerDay: integer('PRIVATE_INVITATION_CREATE_PER_DAY', 50, 10000),
    mutatePerMinute: integer('PRIVATE_INVITATION_MUTATE_PER_MINUTE', 30, 1000),
  }
}

/** Pass database time obtained AFTER the Trip lock, not process time. */
export function privateInvitationExpiry(
  now: Date,
  startAt: Date,
  requested?: string,
  ttlSeconds = privateInvitationConfig().ttlSeconds,
) {
  const requestedAt = requested ? new Date(requested).getTime() : now.getTime() + ttlSeconds * 1000
  const expiry = Math.min(requestedAt, now.getTime() + ttlSeconds * 1000, startAt.getTime() - 1000)
  if (![now.getTime(), startAt.getTime(), requestedAt, expiry].every(Number.isFinite) || expiry <= now.getTime()) {
    throw AppError.fromCode(C.VALIDATION_ERROR, { details: { reason: 'INVALID_INVITATION_EXPIRY' } })
  }
  return new Date(expiry)
}
