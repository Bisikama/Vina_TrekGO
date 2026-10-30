import { ApiError } from '@/lib/api-client';
import { generateUUID } from '@/services/storage/recordingDatabase';
import { acknowledgeSnapshot, changeLocalTrip, readLocalTrip, prepareMetadata, prepareSnapshot } from './trip-gps.v2-storage';
import { gpsSyncRequest, type BatchAck, type MetadataAck, type SyncStatus } from './trip-gps.sync-api';

type Run = { timer?: ReturnType<typeof setTimeout>; busy: boolean; retries: number; rerun: boolean; cancelled: boolean; queuedManual?: boolean };
export class TripGpsCoordinator {
  private runs = new Map<string, Run>();
  private concurrent = 0;
  constructor(private account: string, private active: () => boolean, private changed: (processed?: boolean) => void) {}
  stop() { this.runs.forEach(run => { run.cancelled = true; clearTimeout(run.timer); }); this.runs.clear(); }
  trigger(id: string, manual = false) {
    let run = this.runs.get(id);
    if (!run) { run = { busy: false, retries: 0, rerun: false, cancelled: false }; this.runs.set(id, run); }
    if (manual) { run.retries = 0; clearTimeout(run.timer); }
    if (run.busy) { run.rerun = true; run.queuedManual ||= manual; return; }
    void this.execute(id, run, manual).catch(error => console.warn('[TripGps sync storage]', error));
  }
  private schedule(id: string, run: Run, delay: number, manual = false) {
    clearTimeout(run.timer);
    run.timer = setTimeout(() => { if (!run.cancelled && this.active()) this.trigger(id, manual); }, delay);
  }
  private async execute(id: string, run: Run, manual: boolean) {
    if (!this.active() || run.cancelled) return;
    if (this.concurrent >= 1) { this.schedule(id, run, 1000, manual); return; }
    run.busy = true;
    this.concurrent++;
    const check = () => { if (!this.active() || run.cancelled) throw new ApiError('GPS account changed', 401, 'GPS_ACCOUNT_CHANGED'); };
    try {
      let trip = await readLocalTrip(this.account, id);
      if (trip.accessBlocked) return;
      if (trip.session.status !== 'STOPPED' && trip.controlSyncMode === 'LOCAL_UNTIL_FINISH') return;
      if (manual) {
        trip = await changeLocalTrip(this.account, id, t => { t.retryCount = 0; t.nextRetryAt = null; });
        run.retries = 0;
      } else {
        run.retries = trip.retryCount ?? 0;
        if (run.retries >= 3 && !trip.nextRetryAt && trip.syncStatus === 'WAITING_NETWORK') return;
      }
      if (trip.finalProcessed) return;
      if (!manual && trip.nextRetryAt && Date.parse(trip.nextRetryAt) > Date.now()) {
        this.schedule(id, run, Date.parse(trip.nextRetryAt) - Date.now()); return;
      }
      const request = async <T>(endpoint: string, payload?: unknown): Promise<T> => {
        check();
        const result = await gpsSyncRequest<T>(trip.session.tripId, id, trip.session.deviceId, this.account, endpoint, payload);
        check(); return result;
      };
      const sendMetadata = async () => {
        while (true) {
          const metadata = await prepareMetadata(this.account, id);
          if (!metadata) break;
          const ack = await request<MetadataAck>('metadata', metadata);
          if (ack.metadataRevision !== metadata.revision || metadata.commands.some(c => !ack.acknowledgedCommandIds.includes(c.commandId))) throw new Error('ACK metadata không khớp.');
          if (metadata.recordingStatus === 'STOPPED' && (ack.recordingStatus !== 'STOPPED' || Date.parse(ack.effectiveEndedAt ?? '') !== Date.parse(metadata.endedAt ?? ''))) {
            throw new Error('Máy chủ chưa xác nhận đúng thời điểm kết thúc. Giữ timeline và tọa độ trên máy.');
          }
          await changeLocalTrip(this.account, id, t => { t.metadataRevision = ack.metadataRevision; t.metadata = undefined; t.session.uploadDeadline = ack.uploadDeadline; });
        }
      };
      // Recording controls may sync while open; historical points must stay on the device.
      if (trip.session.status !== 'STOPPED') {
        if (trip.snapshot) throw new Error('Còn snapshot lịch sử từ phiên bản cũ. Giữ dữ liệu và kết thúc phiên trước khi đối soát.');
        await sendMetadata();
        await changeLocalTrip(this.account, id, t => { t.syncStatus = 'PENDING'; t.lastError = null; t.nextRetryAt = null; t.retryCount = 0; });
        this.changed();
        // Finish may have committed while a metadata request was in flight.
        if ((await readLocalTrip(this.account, id)).session.status === 'STOPPED') run.rerun = true;
        return;
      }
      const statusQuery = trip.snapshot ? `status?snapshotRevision=${trip.snapshot.complete.snapshotRevision}` : 'status';
      const status = await request<SyncStatus>(statusQuery);
      if (trip.snapshot && status.syncStatus === 'RECEIVING' && status.missingBatchIds?.length) {
        const missing = new Set(status.missingBatchIds);
        let cursor = status.nextCursor;
        while (cursor != null) {
          const page = await request<SyncStatus>(`${statusQuery}&cursor=${cursor}`);
          page.missingBatchIds.forEach(id => missing.add(id));
          if (page.nextCursor != null && page.nextCursor <= cursor) throw new Error('Cursor GPS status không tăng.');
          cursor = page.nextCursor;
        }
        if ([...missing].some(batchId => !trip.snapshot!.batches.some(b => b.payload.batchId === batchId))) throw new Error('Manifest server không khớp snapshot local.');
        trip = await changeLocalTrip(this.account, id, t => {
          t.snapshot!.batches.forEach(batch => { if (missing.has(batch.payload.batchId)) batch.ack = undefined; });
        });
      }
      if (trip.snapshot && status.processedSnapshotRevision >= trip.snapshot.complete.snapshotRevision && status.syncStatus === 'COMPLETE') {
        trip = await acknowledgeSnapshot(this.account, id);
        this.changed(true);
        if (trip.finalProcessed) return;
      }
      if (status.syncStatus === 'FINALIZE_PENDING' || status.syncStatus === 'PROCESSING') {
        await changeLocalTrip(this.account, id, t => { t.syncStatus = 'PROCESSING'; t.nextRetryAt = null; });
        // Status polling is independent of upload retry budget; no new snapshot while the worker owns this one.
        this.schedule(id, run, 5000); this.changed(); return;
      }
      if (trip.snapshot && (trip.snapshot.complete.final !== true || !trip.snapshot.complete.endedAt)) {
        throw new Error('Snapshot cũ chưa phải snapshot kết thúc. Dữ liệu được giữ để đối soát; không gửi final=false lên API mới.');
      }
      if (status.syncStatus === 'NEEDS_ATTENTION') {
        if (!manual || !trip.snapshot) {
          await changeLocalTrip(this.account, id, t => { t.syncStatus = 'NEEDS_ATTENTION'; t.lastError = status.lastError?.code ?? 'GPS_WORKER_FAILED'; });
          this.changed(); return;
        }
        // A new completion ID starts a new bounded worker run, retaining the same manifest/batches.
        trip = await changeLocalTrip(this.account, id, t => { t.snapshot!.complete.completionId = generateUUID(); t.snapshot!.submitted = false; });
      }
      await changeLocalTrip(this.account, id, t => { t.syncStatus = 'SYNCING'; t.nextRetryAt = null; });
      this.changed();
      if (!trip.snapshot) {
        await sendMetadata();
      }
      let snapshot = await prepareSnapshot(this.account, id);
      if (!snapshot) {
        const current = await changeLocalTrip(this.account, id, t => { t.syncStatus = t.localRevision === t.metadataRevision && t.sampleSequence === t.processedMaxSequence ? 'SYNCED' : 'PENDING'; t.lastError = null; });
        if (current.localRevision !== current.metadataRevision) run.rerun = true;
        this.changed(); return;
      }
      if (snapshot.complete.final !== true || !snapshot.complete.endedAt) throw new Error('Snapshot cũ chưa phải snapshot kết thúc. Dữ liệu được giữ để đối soát; không gửi final=false lên API mới.');
      for (const batch of snapshot.batches) {
        if (batch.ack) continue;
        const ack = await request<BatchAck>('batches', batch.payload);
        const ids = new Set([...ack.acceptedSampleIds, ...ack.duplicateSampleIds, ...ack.rejectedSamples.map(p => p.clientSampleId)]);
        if (ack.batchId !== batch.payload.batchId || ack.snapshotRevision !== batch.payload.snapshotRevision || batch.payload.samples.some(p => !ids.has(p.clientSampleId))) throw new Error('ACK batch không đầy đủ.');
        await changeLocalTrip(this.account, id, t => { t.snapshot!.batches.find(b => b.payload.batchId === batch.payload.batchId)!.ack = ack; });
      }
      for (const page of snapshot.pages) {
        if (page.ack) continue;
        const ack = await request<{ manifestId: string; pageIndex: number; acknowledged: boolean }>('manifests/pages', page.payload);
        if (!ack.acknowledged || ack.manifestId !== page.payload.manifestId || ack.pageIndex !== page.payload.pageIndex) throw new Error('ACK manifest không khớp.');
        await changeLocalTrip(this.account, id, t => { t.snapshot!.pages[page.payload.pageIndex].ack = true; });
      }
      snapshot = (await readLocalTrip(this.account, id)).snapshot!;
      if (!snapshot.submitted) {
        await request('complete', snapshot.complete);
        await changeLocalTrip(this.account, id, t => { t.snapshot!.submitted = true; });
      }
      await changeLocalTrip(this.account, id, t => { t.syncStatus = 'PROCESSING'; t.lastError = null; });
      run.retries = 0;
      this.schedule(id, run, 5000); this.changed();
    } catch (error) {
      if (!this.active() || run.cancelled) return;
      const retryable = error instanceof ApiError && (error.status === 0 || error.status === 429 || (error.status >= 500 && error.retryable !== false));
      const baseDelay = [5000, 15000, 30000][run.retries];
      const retryAfter = error instanceof ApiError ? Number((error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds ?? 0) * 1000 : 0;
      const delay = baseDelay === undefined ? undefined : Math.max(baseDelay, Number.isFinite(retryAfter) ? retryAfter : 0);
      const retry = retryable && delay !== undefined;
      await changeLocalTrip(this.account, id, t => {
        if (error instanceof ApiError && error.status === 403) t.accessBlocked = true;
        t.lastError = error instanceof ApiError ? `${error.code ?? 'NETWORK'}: ${error.message}` : String(error);
        t.syncStatus = retryable ? 'WAITING_NETWORK' : 'NEEDS_ATTENTION';
        t.nextRetryAt = retry ? new Date(Date.now() + delay).toISOString() : null;
        t.retryCount = retry ? run.retries + 1 : run.retries;
      });
      if (retry) { run.retries++; this.schedule(id, run, delay); }
      this.changed();
    } finally {
      run.busy = false;
      this.concurrent--;
      if (run.rerun && !run.cancelled) {
        const queuedManual = run.queuedManual ?? false;
        run.rerun = false; run.queuedManual = false;
        this.trigger(id, queuedManual);
      }
    }
  }
}
