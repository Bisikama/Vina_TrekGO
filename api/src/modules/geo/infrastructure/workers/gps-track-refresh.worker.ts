import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { TripGpsRecordingService } from '../adapters/trip-gps-recording.service'

/** Consumes coalesced post-commit route/checkpoint/deviation refresh jobs. */
@Injectable()
export class GpsTrackRefreshWorker {
  private readonly logger = new Logger(GpsTrackRefreshWorker.name)
  private running = false
  constructor(private readonly prisma: PrismaService, private readonly recording: TripGpsRecordingService) {}

  @Interval(250)
  async process() {
    if (this.running) return
    this.running = true
    try {
      const jobs = await this.prisma.gpsOutboxEvent.findMany({ where: { aggregateType: 'TripGps', eventType: 'gps:track.refresh', status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 10 })
      for (const job of jobs) {
        const claimed = await this.prisma.gpsOutboxEvent.updateMany({ where: { id: job.id, status: 'PENDING' }, data: { status: 'PUBLISHED', publishedAt: new Date() } })
        if (!claimed.count) continue
        const data = job.payload as any
        try {
          await this.recording.rebuildTrack(job.aggregateId, data.envelope.data.userId, data.envelope.data.sessionId)
          await this.prisma.gpsOutboxEvent.update({ where: { id: job.id }, data: { status: 'PROCESSED' } })
        } catch (error) {
          await this.prisma.gpsOutboxEvent.update({ where: { id: job.id }, data: { status: 'PENDING', lastError: error instanceof Error ? error.message : 'Track refresh failed' } })
        }
      }
    } catch (error) {
      this.logger.error('GPS track refresh poll failed', error instanceof Error ? error.stack : undefined)
    } finally { this.running = false }
  }
}
