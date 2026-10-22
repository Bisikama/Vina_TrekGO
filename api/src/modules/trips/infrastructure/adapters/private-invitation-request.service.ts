import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../../shared/services/prisma.service'
import {
  AppError,
  BOOKING_ERROR_CODES as B,
  COMMON_ERROR_CODES as C,
  PAYMENT_ERROR_CODES as P,
} from '../../../../shared/errors'
import { paymentHash } from '../../../payments/payment-utils'
import { databaseTime } from '../../../bookings/booking-capacity'
import { privateInvitationConfig } from '../../application/private-invitation.policy'
import { invitationIdempotencyKeySchema } from '../../presentation/dtos/private-member-invitation.dto'

/** M1 foundation; M2 must authorize actor/Trip and validate DTO before invoking. */
@Injectable()
export class PrivateInvitationRequestService {
  constructor(private readonly db: PrismaService) {}

  /** Standalone mutation admission; invoke before opening its business transaction. */
  async consumeRate(actorId: string, action: 'create' | 'mutation'): Promise<void> {
    const retryAfterSeconds = await this.db.$transaction((tx) => this.consumeRateInTransaction(tx, actorId, action))
    if (retryAfterSeconds) throw AppError.fromCode(B.INVITE_RATE_LIMITED, { details: { retryAfterSeconds } })
  }

  private async consumeRateInTransaction(tx: Prisma.TransactionClient, actorId: string, action: 'create' | 'mutation') {
    const config = privateInvitationConfig()
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`private-invitation-rate:${actorId}`}, 0))::text`
    const now = await databaseTime(tx)
    const windows =
      action === 'create'
        ? [
            { bucket: 'create-minute', seconds: 60, limit: config.createPerMinute },
            { bucket: 'create-day', seconds: 86400, limit: config.createPerDay },
          ]
        : [{ bucket: 'mutation-minute', seconds: 60, limit: config.mutatePerMinute }]
    let retry = 0
    for (const window of windows) {
      const row = await tx.privateInvitationRateBucket.findUnique({
        where: { actorId_bucket: { actorId, bucket: window.bucket } },
      })
      if (row && row.resetsAt > now && row.count >= window.limit) {
        retry = Math.max(retry, Math.ceil((row.resetsAt.getTime() - now.getTime()) / 1000))
      }
    }
    if (retry) return retry
    for (const window of windows) {
      const key = { actorId_bucket: { actorId, bucket: window.bucket } }
      const old = await tx.privateInvitationRateBucket.findUnique({ where: key })
      const fresh = !old || old.resetsAt <= now
      const resetsAt = fresh
        ? new Date((Math.floor(now.getTime() / (window.seconds * 1000)) + 1) * window.seconds * 1000)
        : old.resetsAt
      await tx.privateInvitationRateBucket.upsert({
        where: key,
        create: { actorId, bucket: window.bucket, count: 1, resetsAt },
        update: { count: fresh ? 1 : { increment: 1 }, resetsAt },
      })
    }
    return 0
  }

  /** Create only: callback owns its User→Trip locks and writes audit/outbox using this tx.
   * The callback must return a JSON-safe snapshot, never QR tokens or other private data.
   * M2 controller translates retryAfterSeconds to Retry-After before rethrowing to GlobalErrorFilter.
   */
  async create<T extends Prisma.InputJsonObject>(
    actorId: string,
    tripId: string,
    key: string,
    payload: Prisma.InputJsonObject,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<{ replayed: boolean; status: number; body: T }> {
    if (!invitationIdempotencyKeySchema.safeParse(key).success) throw AppError.fromCode(C.VALIDATION_ERROR)
    const scope = `private-invitation:create:${tripId}`
    const requestHash = paymentHash(payload)
    const outcome = await this.db.$transaction(
      async (tx) => {
        // READ COMMITTED + advisory lock: a waiter reads the previous winner's committed result.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${paymentHash([scope, actorId, key])}, 0))::text`
        const now = await databaseTime(tx)
        const identity = { scope_userId_idempotencyKey: { scope, userId: actorId, idempotencyKey: key } }
        const existing = await tx.idempotencyRecord.findUnique({ where: identity })
        const replayUntil = (existing?.completedAt ?? existing?.createdAt)?.getTime()
        if (
          existing &&
          replayUntil !== undefined &&
          replayUntil + privateInvitationConfig().replaySeconds * 1000 > now.getTime()
        ) {
          if (existing.requestHash !== requestHash)
            throw AppError.fromCode(P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
          if (!existing.completedAt || !existing.responseBody || existing.responseStatus !== 201) {
            throw AppError.fromCode(B.PRIVATE_TRIP_VERSION_CONFLICT)
          }
          return { replayed: true, status: existing.responseStatus, body: existing.responseBody as T }
        }
        // Only a first attempt consumes quota, before any recipient lookup in work().
        const retryAfterSeconds = await this.consumeRateInTransaction(tx, actorId, 'create')
        if (retryAfterSeconds)
          return { error: AppError.fromCode(B.INVITE_RATE_LIMITED, { details: { retryAfterSeconds } }) }
        // Savepoint preserves admitted quota while rolling back failed business writes.
        // One connection per request: nested transactions would exhaust a small pool.
        await tx.$executeRawUnsafe('SAVEPOINT private_invitation_work')
        try {
          const body = await work(tx)
          const completedAt = await databaseTime(tx)
          const data = { requestHash, responseBody: body, responseStatus: 201, completedAt }
          await tx.idempotencyRecord.upsert({
            where: identity,
            create: { scope, userId: actorId, idempotencyKey: key, ...data },
            update: data,
          })
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT private_invitation_work')
          return { replayed: false, status: 201, body }
        } catch (error) {
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT private_invitation_work')
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT private_invitation_work')
          return { error }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 },
    )
    if ('error' in outcome) throw outcome.error
    return outcome
  }
}
