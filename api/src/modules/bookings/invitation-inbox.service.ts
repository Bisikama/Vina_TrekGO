import { Injectable } from '@nestjs/common'
import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, COMMON_ERROR_CODES as C } from '../../shared/errors'
import { assertTicketActor } from './participant-claim.service'
import type { InboxQuery } from './invitation-inbox.controller'

const cursorSchema = z
  .object({
    v: z.literal(1),
    fingerprint: z.string(),
    at: z.iso.datetime({ precision: 6 }).refine((s) => !s.startsWith('0000')),
    type: z.enum(['PUBLIC', 'PRIVATE']),
    id: z.string().uuid(),
  })
  .strict()
type Row = {
  id: string
  type: 'PUBLIC' | 'PRIVATE'
  tripId: string
  tripTitle: string
  createdAt: string
  expiresAt: string
  storedStatus: string
}
@Injectable()
export class InvitationInboxService {
  constructor(private readonly db: PrismaService) {}
  async list(userId: string, query: InboxQuery) {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([1, userId, query.type, query.limit]))
      .digest('hex')
    let cursor: z.infer<typeof cursorSchema> | undefined
    if (query.cursor) {
      try {
        cursor = cursorSchema.parse(JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')))
        if (cursor.fingerprint !== fingerprint) throw new Error('scope')
      } catch {
        throw AppError.fromCode(C.VALIDATION_ERROR, { details: { reason: 'INVALID_INBOX_CURSOR' } })
      }
    }
    return this.db.$transaction(
      async (tx) => {
        await assertTicketActor(tx, userId)
        // One UNION/keyset, never merging independent offset pages. Preserve PostgreSQL microseconds.
        const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
        WITH invitations AS (
          SELECT i.id, 'PRIVATE'::text AS type, i.trip_id, i.created_at, i.expires_at, i.status::text AS status
          FROM private_trip_member_invitations i WHERE i.recipient_user_id=${userId}::uuid
          UNION ALL
          SELECT i.id, 'PUBLIC'::text AS type, b.trip_id, i.created_at, i.expires_at, i.status::text AS status
          FROM booking_participant_invitations i
          JOIN booking_participants p ON p.id=i.booking_participant_id
          JOIN bookings b ON b.id=p.booking_id WHERE i.recipient_user_id=${userId}::uuid
        )
        SELECT i.id, i.type, i.trip_id AS "tripId", t.title AS "tripTitle", i.status AS "storedStatus",
          to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
          to_char(i.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "expiresAt"
        FROM invitations i JOIN trips t ON t.id=i.trip_id
        WHERE (${query.type}='ALL' OR i.type=${query.type})
        ${cursor ? Prisma.sql`AND (i.created_at, i.type COLLATE "C", i.id) < (${cursor.at}::timestamptz, ${cursor.type} COLLATE "C", ${cursor.id}::uuid)` : Prisma.empty}
        ORDER BY i.created_at DESC, i.type COLLATE "C" DESC, i.id DESC LIMIT ${query.limit + 1}
      `)
        const hasMore = rows.length > query.limit
        const items = rows.slice(0, query.limit).map((row) => ({ ...row, previewRequired: true as const }))
        const last = items.at(-1)
        return {
          items,
          hasMore,
          nextCursor:
            hasMore && last
              ? Buffer.from(
                  JSON.stringify({ v: 1, fingerprint, at: last.createdAt, type: last.type, id: last.id }),
                ).toString('base64url')
              : null,
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }
}
