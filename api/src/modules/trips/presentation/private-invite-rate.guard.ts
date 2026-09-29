import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AppError, BOOKING_ERROR_CODES as B } from '../../../shared/errors'
import { REQUEST_USER_KEY } from '../../../shared/constants/auth.constant'

/** Per-process abuse protection. Multi-instance deployments also need gateway/shared rate limiting. */
@Injectable()
export class PrivateInviteRateGuard implements CanActivate {
  private readonly buckets = new Map<string, { count: number; until: number }>()
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ ip?: string; method: string; [REQUEST_USER_KEY]?: { id: string } }>()
    const now = Date.now()
    for (const [key, value] of this.buckets) if (value.until <= now) this.buckets.delete(key)
    const join = req.method === 'POST'
    const limit = join ? 30 : 60
    // Do not key by invite code or bearer token; rotation must not bypass the limit.
    const keys = [`${join ? 'join' : 'preview'}:ip:${req.ip || 'unknown'}`]
    if (join && req[REQUEST_USER_KEY]?.id) keys.push(`join:user:${req[REQUEST_USER_KEY].id}`)
    for (const key of keys) {
      const bucket = this.buckets.get(key)
      if ((bucket && bucket.count >= limit) || (!bucket && this.buckets.size >= 10000)) {
        context
          .switchToHttp()
          .getResponse<{ setHeader: (name: string, value: string) => void }>()
          .setHeader('Retry-After', String(Math.max(1, Math.ceil(((bucket?.until ?? now + 60000) - now) / 1000))))
        throw AppError.fromCode(B.INVITE_RATE_LIMITED)
      }
    }
    for (const key of keys) {
      const bucket = this.buckets.get(key)
      this.buckets.set(key, { count: (bucket?.count ?? 0) + 1, until: bucket?.until ?? now + 60000 })
    }
    return true
  }
}
