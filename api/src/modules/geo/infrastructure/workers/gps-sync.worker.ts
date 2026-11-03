import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { GpsAccessService } from '../../application/gps-access.service'
import { GpsTrackService } from '../../application/gps-track.service'

/** One bounded job per instance; expired leases are recoverable after process failure. */
@Injectable()
export class GpsSyncWorker {
  private running = false
  private readonly logger = new Logger(GpsSyncWorker.name)
  constructor(
    private readonly db: PrismaService,
    private readonly access: GpsAccessService,
    private readonly tracks: GpsTrackService,
  ) {}
  @Interval(2000)
  async process() {
    if (this.running) return
    this.running = true
    try {
      const now = new Date()
      await this.db.gpsSyncState.updateMany({
        where: { status: 'PROCESSING', leaseUntil: { lt: now }, attempts: { gte: 4 } },
        data: { status: 'NEEDS_ATTENTION', leaseUntil: null, leaseToken: null, lastError: 'GPS_SYNC_UNAVAILABLE' },
      })
      const candidates = await this.db.gpsSyncState.findMany({
        where: {
          attempts: { lt: 4 },
          OR: [
            { status: 'FINALIZE_PENDING', availableAt: { lte: now } },
            { status: 'PROCESSING', leaseUntil: { lt: now } },
          ],
        },
        orderBy: { availableAt: 'asc' },
        take: 1,
      })
      for (const candidate of candidates) {
        const token = randomUUID()
        const claim = await this.db.gpsSyncState.updateMany({
          where: {
            sessionId: candidate.sessionId,
            snapshotRevision: candidate.snapshotRevision,
            attempts: { lt: 4 },
            OR: [
              { status: 'FINALIZE_PENDING', availableAt: { lte: now } },
              { status: 'PROCESSING', leaseUntil: { lt: now } },
            ],
          },
          data: {
            status: 'PROCESSING',
            leaseToken: token,
            leaseUntil: new Date(Date.now() + 30000),
            attempts: { increment: 1 },
          },
        })
        if (!claim.count) continue
        try {
          await this.db.$transaction(
            async (tx) => {
              await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`
              await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`
              const owner = await tx.gpsSession.findUniqueOrThrow({
                where: { id: candidate.sessionId },
                select: { userId: true, tripId: true },
              })
              await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${owner.tripId + ':' + owner.userId + ':sync'}))::text`
              await tx.$queryRaw`SELECT id FROM gps_sessions WHERE id = ${candidate.sessionId}::uuid FOR UPDATE`
              await tx.$queryRaw`SELECT session_id FROM gps_sync_states WHERE session_id = ${candidate.sessionId}::uuid FOR UPDATE`
              const sync = await tx.gpsSyncState.findUniqueOrThrow({ where: { sessionId: candidate.sessionId } })
              if (sync.leaseToken !== token || sync.snapshotRevision !== candidate.snapshotRevision) return
              const session = await tx.gpsSession.findUniqueOrThrow({ where: { id: candidate.sessionId } })
              const trip = await tx.trip.findUniqueOrThrow({ where: { id: session.tripId } })
              const member = await this.access.require(tx, trip, session.userId)
              const count = await tx.gpsLocation.count({
                where: { session: { tripId: session.tripId, userId: session.userId } },
              })
              if (count > 10000) throw new Error('GPS_HISTORY_LIMIT')
              await this.tracks.sync(tx, trip, member, session.status === 'STOPPED')
              await tx.gpsSyncState.update({
                where: { sessionId: session.id },
                data: {
                  status: 'COMPLETE',
                  processedRevision: sync.snapshotRevision,
                  leaseUntil: null,
                  leaseToken: null,
                  lastError: null,
                },
              })
            },
            { timeout: 10000, maxWait: 2000 },
          )
        } catch {
          const attempts = candidate.attempts + 1
          await this.db.gpsSyncState.updateMany({
            where: { sessionId: candidate.sessionId, leaseToken: token },
            data: {
              status: attempts >= 4 ? 'NEEDS_ATTENTION' : 'FINALIZE_PENDING',
              leaseToken: null,
              leaseUntil: null,
              lastError: 'GPS_SYNC_UNAVAILABLE',
              availableAt: new Date(Date.now() + [5000, 15000, 30000][Math.min(attempts - 1, 2)]),
            },
          })
        }
      }
    } catch (error) {
      this.logger.warn(`GPS sync worker deferred: ${(error)?.code ?? 'DATABASE_UNAVAILABLE'}`)
    } finally {
      this.running = false
    }
  }
}
