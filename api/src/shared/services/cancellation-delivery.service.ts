import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from './prisma.service'
export type CancellationEvent = {
  id: string
  eventType: string
  aggregateId: string
  payload: Prisma.JsonValue
  createdAt: Date
}
export const CANCELLATION_CONSUMERS = ['trip-bookings-v1', 'rental-lifecycle-v1'] as const
@Injectable()
export class CancellationDeliveryService {
  private readonly logger = new Logger(CancellationDeliveryService.name)
  constructor(private readonly db: PrismaService) {}
  async run(consumer: string, types: string[], handle: (event: CancellationEvent) => Promise<unknown>, size = 25) {
    await this.db
      .$executeRaw`UPDATE cancellation_deliveries SET status='FAILED',lease_owner=NULL,lease_until=NULL,last_error='LEASE_EXHAUSTED'
      WHERE consumer=${consumer} AND status='RUNNING' AND attempts>=8 AND lease_until<=now()`
    const events = await this.db.$queryRaw<CancellationEvent[]>(Prisma.sql`
      SELECT e.id, e.event_type AS "eventType", e.aggregate_id AS "aggregateId", e.payload, e.created_at AS "createdAt"
      FROM booking_outbox_events e CROSS JOIN cancellation_worker_settings w
      LEFT JOIN cancellation_deliveries d ON d.event_id=e.id AND d.consumer=${consumer}
      WHERE w.id=1 AND e.event_type IN (${Prisma.join(types)})
        AND (e.created_at >= w.started_at OR d.event_id IS NOT NULL)
        AND (d.event_id IS NULL OR (d.status IN ('PENDING','RUNNING') AND d.attempts < 8
          AND d.next_attempt_at <= now() AND (d.lease_until IS NULL OR d.lease_until <= now())))
      ORDER BY e.created_at, e.id LIMIT ${size}`)
    for (const event of events) {
      const owner = randomUUID()
      const claim = await this.db.$queryRaw<{ attempts: number }[]>`
        INSERT INTO cancellation_deliveries(event_id,consumer,status,attempts,lease_owner,lease_until)
        VALUES (${event.id}::uuid,${consumer},'RUNNING',1,${owner}::uuid,now()+interval '120 seconds')
        ON CONFLICT(event_id,consumer) DO UPDATE SET status='RUNNING',attempts=cancellation_deliveries.attempts+1,
          lease_owner=${owner}::uuid,lease_until=now()+interval '120 seconds'
        WHERE cancellation_deliveries.status IN ('PENDING','RUNNING') AND cancellation_deliveries.attempts < 8
          AND cancellation_deliveries.next_attempt_at <= now()
          AND (cancellation_deliveries.lease_until IS NULL OR cancellation_deliveries.lease_until <= now())
        RETURNING attempts`
      if (!claim.length) continue
      try {
        await handle(event)
        await this.db.$executeRaw`UPDATE cancellation_deliveries SET status='COMPLETED',completed_at=now(),
          lease_owner=NULL,lease_until=NULL,last_error=NULL WHERE event_id=${event.id}::uuid AND consumer=${consumer} AND lease_owner=${owner}::uuid`
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String(error.code).slice(0, 160)
            : 'CANCELLATION_DELIVERY_FAILED'
        const failed = claim[0].attempts >= 8
        const seconds = Math.min(300, 2 ** claim[0].attempts)
        await this.db.$executeRaw`UPDATE cancellation_deliveries SET status=${failed ? 'FAILED' : 'PENDING'},
          next_attempt_at=now()+interval '1 second'*${seconds},lease_owner=NULL,lease_until=NULL,last_error=${code}
          WHERE event_id=${event.id}::uuid AND consumer=${consumer} AND lease_owner=${owner}::uuid`
        this.logger.warn(`Cancellation delivery deferred: ${consumer}/${event.id}/${code}`)
      }
    }
    return events.length
  }
}
