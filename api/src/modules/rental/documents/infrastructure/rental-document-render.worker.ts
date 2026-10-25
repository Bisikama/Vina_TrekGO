import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RentalDocumentRenderStatus } from '@prisma/client';
import envconfig from 'src/shared/config';
import { PrismaService } from 'src/shared/services/prisma.service';
import { snapshotHash } from '../application/rental-document-events';
import { DOCUMENT_STORAGE_PORT, documentObjectKey, pdfDigest } from './document-storage.port';
import type { DocumentStoragePort } from './document-storage.port';
import { RentalPdfRenderer } from './rental-pdf.renderer';

type Claimed = { id: string; aggregate_id: string; published_at: Date };
type ClaimResult = Claimed | 'SKIP_CURRENT_ITEM' | null;
@Injectable()
export class RentalDocumentRenderWorker {
  private readonly logger = new Logger(RentalDocumentRenderWorker.name);
  private running = false;
  readonly metrics = { processed: 0, failed: 0, recovered: 0 };
  constructor(private readonly prisma: PrismaService, private readonly renderer: RentalPdfRenderer,
    @Inject(DOCUMENT_STORAGE_PORT) private readonly storage: DocumentStoragePort) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const isEnabled = envconfig.RENTAL_DOCUMENT_WORKER_ENABLED || process.env.RENTAL_DOCUMENT_WORKER_ENABLED === 'true';
    if (!isEnabled || this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 20; i++) {
        const claimed = await this.claim();
        if (!claimed) break;
        if (claimed === 'SKIP_CURRENT_ITEM') continue;
        await this.process(claimed);
      }
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<ClaimResult> {
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Claimed[]>`
        WITH candidate AS (
          SELECT id FROM rental_outbox_events
          WHERE event_type = 'RENTAL_DOCUMENT_RENDER_REQUESTED'
            AND ((status = 'PENDING' AND (published_at IS NULL OR published_at <= clock_timestamp()))
              OR (status = 'PUBLISHED' AND published_at < clock_timestamp() - interval '5 minutes'))
          ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE rental_outbox_events e SET status = 'PUBLISHED',
          published_at = date_trunc('milliseconds', clock_timestamp())
        FROM candidate WHERE e.id = candidate.id RETURNING e.id, e.aggregate_id, e.published_at`;
      const event = rows[0];
      if (!event) return null;
      const doc = await tx.rentalDocument.findUnique({ where: { id: event.aggregate_id } });
      if (!doc || doc.renderStatus === RentalDocumentRenderStatus.READY) {
        await tx.rentalOutboxEvent.update({ where: { id: event.id },
          data: { status: 'PROCESSED', processedAt: new Date() } });
        return 'SKIP_CURRENT_ITEM';
      }
      if (doc.renderAttemptCount >= 5) {
        await tx.rentalDocument.update({ where: { id: doc.id },
          data: { renderStatus: RentalDocumentRenderStatus.RENDER_FAILED } });
        await tx.rentalOutboxEvent.update({ where: { id: event.id }, data: { status: 'FAILED' } });
        return 'SKIP_CURRENT_ITEM';
      }
      await tx.rentalDocument.update({ where: { id: doc.id },
        data: { renderAttemptCount: { increment: 1 }, renderStatus: RentalDocumentRenderStatus.PENDING_RENDER } });
      return event;
    });
  }

  private async process(event: Claimed) {
    const doc = await this.prisma.rentalDocument.findUnique({ where: { id: event.aggregate_id } });
    if (!doc) return;
    let lease = event.published_at;
    let leaseLost = false;
    let heartbeatInFlight: Promise<void> | undefined;
    const heartbeat = async () => {
      const renewed = await this.prisma.$queryRaw<Array<{ published_at: Date }>>`
        UPDATE rental_outbox_events SET published_at = date_trunc('milliseconds', clock_timestamp())
        WHERE id = ${event.id}::uuid AND status = 'PUBLISHED' AND published_at = ${lease}
        RETURNING published_at`;
      if (!renewed.length) leaseLost = true;
      else lease = renewed[0].published_at;
    };
    const timer = setInterval(() => {
      if (leaseLost || heartbeatInFlight) return;
      heartbeatInFlight = heartbeat().catch(error => {
        leaseLost = true;
        this.logger.error(`Rental PDF lease renewal failed for ${doc.id}: ${error instanceof Error ? error.message : String(error)}`);
      }).finally(() => { heartbeatInFlight = undefined; });
    }, 30_000);
    timer.unref();
    const stopHeartbeat = async () => {
      clearInterval(timer);
      if (heartbeatInFlight) await heartbeatInFlight;
    };
    try {
      if (snapshotHash(doc.snapshotJson) !== doc.snapshotHash) throw new Error('SNAPSHOT_HASH_MISMATCH');
      const bytes = await this.renderer.render(doc);
      if (leaseLost) return;
      const digest = pdfDigest(bytes);
      const key = documentObjectKey(doc.id, doc.templateVersion, doc.snapshotHash);
      await this.storage.put(key, bytes);
      if (leaseLost) return;
      // Verify the stored bytes; an upload acknowledgement alone is insufficient.
      if (pdfDigest(await this.storage.read(key)) !== digest) throw new Error('PDF_STORAGE_HASH_MISMATCH');
      await stopHeartbeat();
      if (leaseLost) return;
      const finalized = await this.prisma.$transaction(async tx => {
        // The timestamp is a fencing token. An expired claimant may finish its
        // upload, but it cannot publish metadata after another worker claims.
        const owned = await tx.rentalOutboxEvent.updateMany({
          where: { id: event.id, status: 'PUBLISHED', publishedAt: lease },
          data: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
        });
        if (owned.count !== 1) return false;
        await tx.$queryRaw`SELECT id FROM rental_documents WHERE id = ${doc.id}::uuid FOR UPDATE`;
        const latest = await tx.rentalDocument.findUnique({ where: { id: doc.id } });
        if (!latest || latest.snapshotHash !== doc.snapshotHash) throw new Error('DOCUMENT_CHANGED_DURING_RENDER');
        if (latest.renderStatus !== RentalDocumentRenderStatus.READY) {
          await tx.rentalDocument.update({ where: { id: doc.id }, data: {
            renderStatus: RentalDocumentRenderStatus.READY, pdfStorageKey: key,
            pdfHash: digest, renderError: null, renderedAt: new Date() } });
        }
        return true;
      });
      if (finalized) this.metrics.processed += 1;
    } catch (error) {
      await stopHeartbeat();
      if (leaseLost) return;
      const reason = error instanceof Error ? error.message.slice(0, 120) : 'RENDER_ERROR';
      const attempts = doc.renderAttemptCount;
      const terminal = attempts >= 5;
      const backoffSeconds = Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
      const recorded = await this.prisma.$transaction(async tx => {
        const owned = await tx.rentalOutboxEvent.updateMany({
          where: { id: event.id, status: 'PUBLISHED', publishedAt: lease },
          data: { status: terminal ? 'FAILED' : 'PENDING', retryCount: { increment: 1 },
            lastError: reason,
            publishedAt: terminal ? null : new Date(Date.now() + backoffSeconds * 1000) },
        });
        if (owned.count !== 1) return false;
        await tx.$queryRaw`SELECT id FROM rental_documents WHERE id = ${doc.id}::uuid FOR UPDATE`;
        const latest = await tx.rentalDocument.findUnique({ where: { id: doc.id } });
        if (latest?.renderStatus === RentalDocumentRenderStatus.READY) {
          await tx.rentalOutboxEvent.update({ where: { id: event.id },
            data: { status: 'PROCESSED', processedAt: new Date() } });
          return false;
        }
        await tx.rentalDocument.update({ where: { id: doc.id }, data: {
          renderStatus: RentalDocumentRenderStatus.RENDER_FAILED,
          renderError: reason } });
        return true;
      });
      if (recorded) {
        this.metrics.failed += 1;
        this.logger.error(`Rental PDF render failed for ${doc.id}, attempt ${attempts}/5: ${reason}`);
      }
    } finally {
      await stopHeartbeat();
    }
  }
}
