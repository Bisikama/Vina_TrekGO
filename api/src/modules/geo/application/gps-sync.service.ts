import { Injectable } from '@nestjs/common'
import { Prisma, GpsSession } from '@prisma/client'
import { createHash } from 'node:crypto'
import { PrismaService } from '../../../shared/services/prisma.service'
import { AppError, TRIP_GPS_ERROR_CODES as E } from '../../../shared/errors'
import { GpsAccessService } from './gps-access.service'
import { recordingState } from './gps-recording-state'
import { enqueueGps, json } from './gps-projection.service'
import { gapReason, meters, TrackPoint } from './gps-geometry'
import type {
  SyncMetadata,
  SyncBatch,
  SyncManifest,
  SyncComplete,
  LocationPublish,
} from '../presentation/dtos/trip-gps-sync.dto'

// Canonical JSON: sorted object keys, unchanged array order; no undefined keys.
export function canonicalGpsJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalGpsJson).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .filter((k) => (value as any)[k] !== undefined)
        .map((k) => JSON.stringify(k) + ':' + canonicalGpsJson((value as any)[k]))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
export const gpsHash = (v: unknown) => createHash('sha256').update(canonicalGpsJson(v)).digest('hex')
const fail = (code: string, details?: Record<string, unknown>): never => {
  throw new AppError({ code, details })
}
export const GPS_V2_LIMITS = {
  maxBatchSamples: 200,
  maxBodyBytes: 262144,
  maxCommandsPerRequest: 100,
  maxManifestEntriesPerPage: 100,
  maxSnapshotSamples: 10000,
  publishMinIntervalSeconds: 5,
  publishMinDistanceM: 5,
  publishMovingMaxIntervalSeconds: 15,
  retryDelaysSeconds: [5, 15, 30],
}

@Injectable()
export class GpsSyncService {
  private inFlight = 0
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GpsAccessService,
  ) {}

  async transaction<T>(
    tripId: string,
    userId: string,
    sessionId: string,
    deviceId: string,
    run: (tx: Prisma.TransactionClient, session: GpsSession) => Promise<T>,
  ): Promise<T> {
    if (this.inFlight >= 8) fail(E.RATE_LIMITED, { retryAfterSeconds: 5 })
    this.inFlight++
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`
          await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`
          await tx.$queryRaw`SELECT id FROM gps_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`
          const session = await tx.gpsSession.findFirst({ where: { id: sessionId, tripId, userId } })
          if (!session) return fail(E.SESSION_NOT_FOUND)
          if (session.deviceId !== deviceId) fail(E.DEVICE_CONFLICT)
          if ((recordingState(session) as any)?.protocolVersion !== 2) fail(E.PROTOCOL_CONFLICT)
          const trip = await tx.trip.findUnique({ where: { id: tripId } })
          if (!trip) return fail(E.NOT_FOUND)
          await this.access.require(tx, trip, userId)
          if (['CANCELLED', 'INTERRUPTED'].includes(trip.status)) fail(E.TRIP_NOT_RECORDABLE)
          return run(tx, session)
        },
        { timeout: 10000, maxWait: 2000 },
      )
    } catch (error) {
      if (error instanceof AppError) throw error
      // Never continue a dead tx or retry uncertain commits with a new key.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientInitializationError ||
        ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(String((error as any)?.code))
      )
        throw new AppError({ code: E.SYNC_UNAVAILABLE, details: { retryAfterSeconds: 5 } })
      throw error
    } finally {
      this.inFlight--
    }
  }

  private async receipt(tx: Prisma.TransactionClient, sessionId: string, kind: string, key: string, payload: unknown) {
    const row = await tx.gpsSyncReceipt.findUnique({ where: { sessionId_kind_key: { sessionId, kind, key } } })
    if (row && row.payloadHash !== gpsHash(payload)) fail(E.IDEMPOTENCY_CONFLICT)
    return row
  }
  private async save(
    tx: Prisma.TransactionClient,
    sessionId: string,
    kind: string,
    key: string,
    payload: unknown,
    response: unknown,
  ) {
    if ((await tx.gpsSyncReceipt.count({ where: { sessionId } })) >= 5000)
      fail(E.RATE_LIMITED, { reason: 'SESSION_RECEIPT_LIMIT' })
    await tx.gpsSyncReceipt.create({
      data: { sessionId, kind, key, payloadHash: gpsHash(payload), payload: json(payload), response: json(response) },
    })
    return response
  }
  private window(session: GpsSession) {
    if (session.status === 'STOPPED' && (!session.uploadDeadline || session.uploadDeadline < new Date()))
      fail(E.UPLOAD_CLOSED)
  }

  private requireStopped(session: GpsSession) {
    if (session.status !== 'STOPPED')
      fail(E.INVALID_STATE, {
        reason: 'FINISH_REQUIRED_BEFORE_HISTORY_SYNC',
        recordingStatus: session.status,
      })
  }

  metadata(tripId: string, userId: string, sessionId: string, deviceId: string, input: SyncMetadata) {
    return this.transaction(tripId, userId, sessionId, deviceId, async (tx, session) => {
      const replay = await this.receipt(tx, sessionId, 'metadata', input.requestId, input)
      if (replay) return replay.response
      this.window(session)
      const sync = await tx.gpsSyncState.findUniqueOrThrow({ where: { sessionId } })
      if (
        sync.metadataRevision !== input.baseMetadataRevision ||
        ['FINALIZE_PENDING', 'PROCESSING'].includes(sync.status)
      )
        fail(E.SYNC_CONFLICT, { metadataRevision: sync.metadataRevision, syncStatus: sync.status })
      const state = recordingState(session)
      let status = session.status
      let endedAt = session.endedAt
      let sequence = sync.metadataRevision
      for (const command of input.commands) {
        if (command.sequence !== sequence + 1) fail(E.SYNC_CONFLICT, { nextSequence: sequence + 1 })
        const time = new Date(command.occurredAt).toISOString()
        if (
          time < state.lastControlAt ||
          time < session.startedAt.toISOString() ||
          Date.parse(time) > Date.now() + state.policy.maxFutureSkewSeconds * 1000 ||
          status === 'STOPPED'
        )
          fail(E.INVALID_STATE)
        if (
          command.action !== 'RESUME' &&
          (await tx.gpsLocation.findFirst({
            where: { sessionId, recordedAt: { gt: new Date(time) } },
            select: { id: true },
          }))
        )
          fail(E.INVALID_STATE, { reason: 'SAMPLES_AFTER_COMMAND' })
        const prior = await this.receipt(tx, sessionId, 'command', command.commandId, command)
        if (prior) fail(E.SYNC_CONFLICT)
        if (command.action === 'PAUSE') {
          if (status !== 'ACTIVE') fail(E.INVALID_STATE)
          state.intervals[state.intervals.length - 1].end = time
          status = 'PAUSED'
        } else if (command.action === 'RESUME') {
          if (status !== 'PAUSED') fail(E.INVALID_STATE)
          state.intervals.push({ start: time, end: null })
          status = 'ACTIVE'
        } else {
          if (status === 'ACTIVE') state.intervals[state.intervals.length - 1].end = time
          status = 'STOPPED'
          endedAt = new Date(time)
          state.closedReason = 'USER_FINISHED'
        }
        sequence = command.sequence
        state.lastControlAt = time
        state.controlStatus = status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'
        await this.save(tx, sessionId, 'command', command.commandId, command, { sequence })
      }
      // Revision 1 initializes an empty timeline; subsequent revisions are command sequences.
      if (sequence === 0 && input.commands.length === 0) sequence = 1
      if (
        input.revision !== sequence ||
        input.recordingStatus !== status ||
        (status === 'STOPPED' && (!input.endedAt || new Date(input.endedAt).getTime() !== endedAt?.getTime()))
      )
        fail(E.SYNC_CONFLICT)
      const deadline = endedAt ? new Date(endedAt.getTime() + state.policy.lateSyncGraceSeconds * 1000) : null
      if (deadline && deadline < new Date()) fail(E.UPLOAD_CLOSED)
      await tx.gpsSession.update({
        where: { id: sessionId },
        data: {
          status,
          endedAt,
          uploadDeadline: deadline,
          recordingState: json(state),
          version: { increment: 1 },
        },
      })
      await tx.gpsSyncState.update({ where: { sessionId }, data: { metadataRevision: sequence, status: 'RECEIVING' } })
      return this.save(tx, sessionId, 'metadata', input.requestId, input, {
        sessionId,
        metadataRevision: sequence,
        acknowledgedCommandIds: input.commands.map((c) => c.commandId),
        recordingStatus: status,
        effectiveEndedAt: endedAt?.toISOString() ?? null,
        uploadDeadline: deadline?.toISOString() ?? null,
        syncStatus: 'RECEIVING',
        serverTime: new Date().toISOString(),
      })
    })
  }

  batches(tripId: string, userId: string, sessionId: string, deviceId: string, input: SyncBatch) {
    if (gpsHash(input.samples) !== input.payloadHash) fail('VALIDATION_ERROR', { field: 'payloadHash' })
    return this.transaction(tripId, userId, sessionId, deviceId, async (tx, session) => {
      this.requireStopped(session)
      const replay = await this.receipt(tx, sessionId, 'batch', input.batchId, input)
      if (replay) return replay.response
      this.window(session)
      const sync = await tx.gpsSyncState.findUniqueOrThrow({ where: { sessionId } })
      if (
        sync.metadataRevision !== input.metadataRevision ||
        input.snapshotRevision !== sync.snapshotRevision + 1 ||
        ['FINALIZE_PENDING', 'PROCESSING'].includes(sync.status)
      )
        fail(E.SYNC_CONFLICT)
      const state = recordingState(session)
      if (input.samples.length > Math.min(200, state.policy.maxBatchSamples)) fail('VALIDATION_ERROR')
      const existing = await tx.gpsLocation.findMany({
        where: { sessionId, clientSampleId: { in: input.samples.map((p) => p.clientSampleId) } },
      })
      const ids = new Map(existing.map((p) => [p.clientSampleId, p]))
      const acceptedSampleIds: string[] = [],
        duplicateSampleIds: string[] = []
      const rejectedSamples: { clientSampleId: string; code: string }[] = []
      const insert: Prisma.GpsLocationCreateManyInput[] = []
      const historical =
        state.policy.maxPlausibleSpeedMps > 0
          ? await tx.gpsLocation.findMany({ where: { sessionId }, orderBy: { recordedAt: 'asc' }, take: 10001 })
          : []
      if (historical.length > 10000) fail('VALIDATION_ERROR')
      const neighbors: TrackPoint[] = historical.map((p) => ({
        sessionId,
        clientSampleId: p.clientSampleId,
        recordedAt: p.recordedAt.toISOString(),
        receivedAt: p.receivedAt.toISOString(),
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        accuracyM: Number(p.accuracyM ?? 0),
        altitudeM: p.altitudeM == null ? null : Number(p.altitudeM),
        speedMps: p.speedMps == null ? null : Number(p.speedMps),
        headingDeg: p.headingDeg == null ? null : Number(p.headingDeg),
      }))
      for (const sample of [...input.samples].sort(
        (a, b) =>
          Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.clientSampleId.localeCompare(b.clientSampleId),
      )) {
        const old = ids.get(sample.clientSampleId),
          time = new Date(sample.recordedAt).toISOString()
        if (old) {
          const same =
            old.recordedAt.getTime() === Date.parse(time) &&
            ['latitude', 'longitude', 'accuracyM', 'altitudeM', 'speedMps', 'headingDeg'].every((k) => {
              const a = old[k],
                b = sample[k]
              return a == null
                ? b == null
                : b != null &&
                    Number(a) ===
                      new Prisma.Decimal(b).toDecimalPlaces(['latitude', 'longitude'].includes(k) ? 7 : 2).toNumber()
            })
          if (same) duplicateSampleIds.push(sample.clientSampleId)
          else rejectedSamples.push({ clientSampleId: sample.clientSampleId, code: 'SAMPLE_ID_CONFLICT' })
          continue
        }
        let code: string | null =
          Date.parse(time) < session.startedAt.getTime()
            ? 'BEFORE_SESSION_START'
            : session.endedAt && Date.parse(time) > session.endedAt.getTime()
              ? 'AFTER_SESSION_END'
              : Date.parse(time) > Date.now() + state.policy.maxFutureSkewSeconds * 1000
                ? 'FUTURE_TIMESTAMP'
                : sample.accuracyM > state.policy.maxAcceptedAccuracyM
                  ? 'LOW_ACCURACY'
                  : !state.intervals.some((i) => time >= i.start && (!i.end || time <= i.end))
                    ? 'OUTSIDE_ACTIVE_INTERVAL'
                    : null
        const candidate: TrackPoint = {
          ...sample,
          sessionId,
          recordedAt: time,
          receivedAt: new Date().toISOString(),
          altitudeM: sample.altitudeM ?? null,
          speedMps: sample.speedMps ?? null,
          headingDeg: sample.headingDeg ?? null,
        }
        if (!code && state.policy.maxPlausibleSpeedMps > 0) {
          const ordered = [...neighbors, candidate].sort(
            (a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.clientSampleId.localeCompare(b.clientSampleId),
          )
          const index = ordered.indexOf(candidate)
          for (const neighbor of [ordered[index - 1], ordered[index + 1]].filter(Boolean)) {
            const [a, b] = neighbor.recordedAt <= time ? [neighbor, candidate] : [candidate, neighbor]
            const seconds = (Date.parse(b.recordedAt) - Date.parse(a.recordedAt)) / 1000
            if (
              seconds > 0 &&
              !gapReason(a, b, new Map([[sessionId, state.intervals]]), state.policy.signalGapSeconds) &&
              meters(a, b) / seconds > state.policy.maxPlausibleSpeedMps
            )
              code = 'IMPLAUSIBLE_JUMP'
          }
        }
        if (code) {
          rejectedSamples.push({ clientSampleId: sample.clientSampleId, code })
          continue
        }
        if (state.policy.maxPlausibleSpeedMps > 0) neighbors.push(candidate)
        insert.push({ ...sample, sessionId, recordedAt: new Date(time) })
        acceptedSampleIds.push(sample.clientSampleId)
      }
      // Bound the eventual historical rebuild, not just each HTTP payload.
      if ((await tx.gpsLocation.count({ where: { sessionId } })) + insert.length > 10000)
        fail('VALIDATION_ERROR', { maxSessionSamples: 10000 })
      if (insert.length) await tx.gpsLocation.createMany({ data: insert })
      if (sync.status === 'COMPLETE')
        await tx.gpsSyncState.update({ where: { sessionId }, data: { status: 'RECEIVING' } })
      return this.save(tx, sessionId, 'batch', input.batchId, input, {
        sessionId,
        batchId: input.batchId,
        snapshotRevision: input.snapshotRevision,
        acceptedSampleIds,
        duplicateSampleIds,
        rejectedSamples,
        progress: {
          acceptedCount: acceptedSampleIds.length + duplicateSampleIds.length,
          rejectedCount: rejectedSamples.length,
        },
        serverTime: new Date().toISOString(),
      })
    })
  }

  manifest(tripId: string, userId: string, sessionId: string, deviceId: string, input: SyncManifest) {
    if (gpsHash(input.entries) !== input.pageHash) fail('VALIDATION_ERROR', { field: 'pageHash' })
    return this.transaction(tripId, userId, sessionId, deviceId, async (tx, session) => {
      this.requireStopped(session)
      const key = `${input.manifestId}:${input.pageIndex}`
      const replay = await this.receipt(tx, sessionId, 'manifest', key, input)
      if (replay) return replay.response
      this.window(session)
      const sync = await tx.gpsSyncState.findUniqueOrThrow({ where: { sessionId } })
      if (
        input.snapshotRevision !== sync.snapshotRevision + 1 ||
        ['FINALIZE_PENDING', 'PROCESSING'].includes(sync.status)
      )
        fail(E.SYNC_CONFLICT)
      return this.save(tx, sessionId, 'manifest', key, input, {
        manifestId: input.manifestId,
        pageIndex: input.pageIndex,
        acknowledged: true,
        serverTime: new Date().toISOString(),
      })
    })
  }

  complete(tripId: string, userId: string, sessionId: string, deviceId: string, input: SyncComplete) {
    return this.transaction(tripId, userId, sessionId, deviceId, async (tx, session) => {
      this.requireStopped(session)
      if (input.final !== true) fail(E.INVALID_STATE)
      const replay = await this.receipt(tx, sessionId, 'complete', input.completionId, input)
      if (replay) return replay.response
      this.window(session)
      const sync = await tx.gpsSyncState.findUniqueOrThrow({ where: { sessionId } })
      // completionId changes on explicit manual retry; compare snapshot contents without that key.
      const sameSnapshot =
        sync.snapshot && gpsHash({ ...(sync.snapshot as any), completionId: input.completionId }) === gpsHash(input)
      if (
        input.metadataRevision !== sync.metadataRevision ||
        (input.snapshotRevision !== sync.snapshotRevision + 1 && !(sync.status === 'NEEDS_ATTENTION' && sameSnapshot))
      )
        fail(E.SYNC_CONFLICT)
      if (
        input.final !== (session.status === 'STOPPED') ||
        (input.final && Date.parse(input.endedAt ?? '') !== session.endedAt?.getTime())
      )
        fail(E.INVALID_STATE)
      const pages = await tx.gpsSyncReceipt.findMany({
        where: { sessionId, kind: 'manifest', key: { startsWith: input.manifestId + ':' } },
        take: 101,
      })
      const payloads = pages.map((p) => p.payload as any).sort((a, b) => a.pageIndex - b.pageIndex)
      const entries: any[] = payloads.flatMap((p) => p.entries)
      if (entries.length > 1000 || entries.reduce((sum, e) => sum + e.sampleCount, 0) > 10000) fail('VALIDATION_ERROR')
      if (input.expectedSampleCount === 0) {
        if (entries.length || input.manifestHash !== gpsHash([])) fail(E.SYNC_INCOMPLETE)
      } else if (
        !payloads.length ||
        payloads.length !== payloads[0].pageCount ||
        payloads.some(
          (p, i) =>
            p.pageIndex !== i || p.pageCount !== payloads.length || p.snapshotRevision !== input.snapshotRevision,
        )
      )
        fail(E.SYNC_INCOMPLETE)
      if (gpsHash(entries) !== input.manifestHash || new Set(entries.map((e) => e.batchId)).size !== entries.length)
        fail(E.SYNC_CONFLICT)
      const batches = await tx.gpsSyncReceipt.findMany({
        where: { sessionId, kind: 'batch', key: { in: entries.map((e) => e.batchId) } },
      })
      const byId = new Map(batches.map((b) => [b.key, b]))
      const missing = entries.filter((e) => !byId.has(e.batchId)).map((e) => e.batchId)
      if (missing.length)
        fail(E.SYNC_INCOMPLETE, { missingBatchIds: missing.slice(0, 100), missingCount: missing.length })
      const sampleIds = new Set<string>()
      for (const entry of entries) {
        const batch = byId.get(entry.batchId)!.payload as any
        if (
          batch.payloadHash !== entry.payloadHash ||
          batch.samples.length !== entry.sampleCount ||
          batch.snapshotRevision !== input.snapshotRevision ||
          batch.metadataRevision !== input.metadataRevision
        )
          fail(E.SYNC_CONFLICT)
        for (const p of batch.samples) {
          if (sampleIds.has(p.clientSampleId)) fail(E.SYNC_CONFLICT)
          sampleIds.add(p.clientSampleId)
        }
      }
      if (sampleIds.size !== input.expectedSampleCount) fail(E.SYNC_INCOMPLETE, { receivedCount: sampleIds.size })
      await tx.gpsSyncState.update({
        where: { sessionId },
        data: {
          snapshotRevision: input.snapshotRevision,
          snapshot: json(input),
          status: 'FINALIZE_PENDING',
          attempts: 0,
          lastError: null,
          leaseToken: null,
          leaseUntil: null,
          availableAt: new Date(),
        },
      })
      return this.save(tx, sessionId, 'complete', input.completionId, input, {
        sessionId,
        snapshotRevision: input.snapshotRevision,
        syncStatus: 'FINALIZE_PENDING',
        processedSnapshotRevision: sync.processedRevision,
        statusUrl: `/api/v1/geo/trips/${tripId}/gps/sessions/${sessionId}/sync/status`,
        serverTime: new Date().toISOString(),
      })
    })
  }

  status(
    tripId: string,
    userId: string,
    sessionId: string,
    deviceId: string,
    query: { snapshotRevision?: number; cursor?: number; limit?: number } = {},
  ) {
    return this.transaction(tripId, userId, sessionId, deviceId, async (tx) => {
      const s = await tx.gpsSyncState.findUniqueOrThrow({ where: { sessionId } })
      const route = await tx.tripActualRoute.findUnique({ where: { tripId_userId: { tripId, userId } } })
      const revision =
        query.snapshotRevision ?? s.snapshotRevision + (s.status === 'RECEIVING' || s.status === 'OPEN' ? 1 : 0)
      // Never pull historical coordinates back across the network for a status poll.
      const receipts = await tx.gpsSyncReceipt.findMany({
        where: { sessionId, kind: 'manifest', payload: { path: ['snapshotRevision'], equals: revision } },
        select: { payload: true },
        take: 100,
      })
      const batches = await tx.gpsSyncReceipt.findMany({
        where: { sessionId, kind: 'batch', payload: { path: ['snapshotRevision'], equals: revision } },
        select: { key: true },
        take: 5000,
      })
      const batchIds = new Set(batches.map((b) => b.key))
      const entries = receipts.flatMap((r) => (r.payload as any).entries as { batchId: string }[])
      const missing = [...new Set(entries.map((e) => e.batchId))].filter((id) => !batchIds.has(id))
      const cursor = query.cursor ?? 0,
        limit = query.limit ?? 100
      const [counts] = await tx.$queryRaw<{ acceptedCount: number; rejectedCount: number }[]>`
        WITH batches AS (SELECT response FROM gps_sync_receipts
          WHERE session_id = ${sessionId}::uuid AND kind = 'batch'
          AND payload->>'snapshotRevision' = ${String(revision)})
        SELECT
          (SELECT count(DISTINCT ids.value)::int FROM batches b,
            LATERAL jsonb_array_elements_text((b.response->'acceptedSampleIds') || (b.response->'duplicateSampleIds')) ids) AS "acceptedCount",
          (SELECT count(DISTINCT item->>'clientSampleId')::int FROM batches b,
            LATERAL jsonb_array_elements(b.response->'rejectedSamples') item) AS "rejectedCount"`
      return {
        sessionId,
        metadataRevision: s.metadataRevision,
        receivedSnapshotRevision: s.snapshotRevision,
        processedSnapshotRevision: s.processedRevision,
        syncStatus: s.status,
        resultStatus: route?.resultStatus ?? null,
        actualRouteId: route?.id ?? null,
        lastError: s.lastError
          ? { code: s.lastError, retryable: s.status !== 'NEEDS_ATTENTION', nextRetryAt: s.availableAt }
          : null,
        attempts: s.attempts,
        acceptedCount: counts.acceptedCount,
        rejectedCount: counts.rejectedCount,
        missingBatchIds: missing.slice(cursor, cursor + limit),
        nextCursor: cursor + limit < missing.length ? cursor + limit : null,
        serverTime: new Date().toISOString(),
      }
    })
  }

  publish(userId: string, input: LocationPublish) {
    return this.transaction(input.tripId, userId, input.sessionId, input.deviceId, async (tx, session) => {
      if (session.status !== 'ACTIVE') fail(E.INVALID_STATE)
      const state = recordingState(session) as any,
        now = Date.now(),
        point = input.location
      const age = now - Date.parse(point.recordedAt)
      if (
        age > state.policy.liveLocationMaxAgeSeconds * 1000 ||
        age < -state.policy.maxFutureSkewSeconds * 1000 ||
        Date.parse(point.recordedAt) < session.startedAt.getTime() ||
        point.accuracyM > state.policy.maxAcceptedAccuracyM
      )
        fail('VALIDATION_ERROR')
      if (
        input.sequence <= (state.liveSequence ?? 0) ||
        (state.lastLocation && Date.parse(point.recordedAt) < Date.parse(state.lastLocation.recordedAt))
      )
        return {
          sessionId: session.id,
          sequence: input.sequence,
          applied: false,
          locationVersion: state.locationVersion ?? 0,
          serverTime: new Date().toISOString(),
        }
      if (now - (state.lastPublishedMs ?? 0) < 1000) fail(E.RATE_LIMITED, { retryAfterSeconds: 1 })
      state.liveSequence = input.sequence
      state.lastPublishedMs = now
      const marker = await tx.gpsPresenceState.upsert({
        where: { tripId_userId: { tripId: input.tripId, userId } },
        create: { tripId: input.tripId, userId, status: 'UNKNOWN', version: 0, locationVersion: 1 },
        update: { locationVersion: { increment: 1 } },
      })
      state.locationVersion = marker.locationVersion
      state.lastLocation = {
        latitude: point.latitude,
        longitude: point.longitude,
        accuracyM: point.accuracyM,
        altitudeM: point.altitudeM ?? null,
        speedMps: point.speedMps ?? null,
        headingDeg: point.headingDeg ?? null,
        recordedAt: new Date(point.recordedAt).toISOString(),
        receivedAt: new Date().toISOString(),
      }
      state.lastSyncAt = new Date().toISOString()
      await tx.gpsSession.update({ where: { id: session.id }, data: { recordingState: json(state) } })
      await enqueueGps(tx, input.tripId, 'gps:location.updated', {
        userId,
        sessionId: session.id,
        sequence: input.sequence,
        locationVersion: marker.locationVersion,
        location: state.lastLocation,
      })
      return {
        sessionId: session.id,
        sequence: input.sequence,
        applied: true,
        locationVersion: marker.locationVersion,
        serverTime: new Date().toISOString(),
      }
    })
  }
}
