import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { TripGpsRecordingService } from '../adapters/trip-gps-recording.service'

/** Consumes coalesced post-commit route/checkpoint/deviation refresh jobs. */
@Injectable()
export class GpsTrackRefreshWorker {
  private readonly logger = new Logger(GpsTrackRefreshWorker.name)
  private running = false
  private nextPollAt = 0
  private pollDelay = 500
  constructor(private readonly prisma: PrismaService, private readonly recording: TripGpsRecordingService) {}

  @Interval(500)
  async process() {
    if (this.running || Date.now() < this.nextPollAt) return
    this.running = true
    try {
      const jobs = await this.prisma.gpsOutboxEvent.findMany({ where: { aggregateType: 'TripGps', eventType: 'gps:track.refresh', status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 10 })
      this.pollDelay = jobs.length ? 500 : Math.min(5000, this.pollDelay * 2)
      for (const job of jobs) {
        const claimed = await this.prisma.gpsOutboxEvent.updateMany({ where: { id: job.id, status: 'PENDING' }, data: { status: 'PUBLISHED', publishedAt: new Date() } })
        if (!claimed.count) continue
        const data = job.payload as any
        try {
          await this.recording.rebuildTrack(job.aggregateId, data.envelope.data.userId, data.envelope.data.sessionId)
          await this.prisma.gpsOutboxEvent.update({ where: { id: job.id }, data: { status: 'PROCESSED' } })
        } catch (error) {
          await this.prisma.gpsOutboxEvent.update({ where: { id: job.id }, data: { status: job.retryCount >= 3 ? 'FAILED' : 'PENDING', retryCount: { increment: 1 }, lastError: 'GPS track refresh deferred' } })
          this.pollDelay = Math.max(this.pollDelay, 5000)
        }
      }
    } catch (error) {
      this.logger.error('GPS track refresh poll failed', error instanceof Error ? error.stack : undefined)
    } finally { this.nextPollAt = Date.now() + this.pollDelay; this.running = false }
  }
}
