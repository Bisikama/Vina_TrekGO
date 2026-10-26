import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { GpsSession, Prisma, Trip } from '@prisma/client'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError, TRIP_GPS_ERROR_CODES as E } from '../../../../shared/errors'
import { GpsControl, GpsSamples, GpsStart } from '../../presentation/dtos/trip-gps.dto'
import { GPS_V2_LIMITS } from '../../application/gps-sync.service'
import { GpsAccessService } from '../../application/gps-access.service'
import {
  GpsProjectionService,
  enqueueGps,
  fingerprint,
  Projection,
  json,
  sessionDto,
} from '../../application/gps-projection.service'
import { freezeGpsPolicy, publicPolicy, FrozenGpsPolicy } from '../../application/gps-policy'
import { RecordingState, recordingState } from '../../application/gps-recording-state'
import { GpsTrackService } from '../../application/gps-track.service'
import { assembleRoute, gapReason, meters, simplifyLiveRoute, TrackPoint } from '../../application/gps-geometry'
import type {
  ActualRouteResponse,
  GpsContextResponse,
  SampleRejectCode,
  SamplesResponse,
  SessionResponse,
} from '../../application/trip-gps.contract'

const RECORDABLE = ['OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS']
type Tx = Prisma.TransactionClient
const fail = (code: string, details?: Record<string, unknown>): never => {
  throw new AppError({ code, details })
}

@Injectable()
export class TripGpsRecordingService {
  private readonly logger = new Logger(TripGpsRecordingService.name)
  private reconciling = false
  private cleaning = false
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GpsAccessService,
    private readonly projection: GpsProjectionService,
    private readonly tracks: GpsTrackService,
  ) {}

  // Lock hierarchy: User lock first, then Trip lock. This matches the lock hierarchy
  // across TripAdapter and MembershipAdapter to prevent deadlocks (PostgreSQL 40P01).
  private async transaction<T>(tripId: string, userId: string | null, run: (tx: Tx, trip: Trip) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            if (userId) await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`
            await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
            const trip = await tx.trip.findUnique({ where: { id: tripId } })
            if (!trip) return fail(E.NOT_FOUND)
            return run(tx, trip)
          },
          { timeout: 60000 },
        )
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))
        if (retryable && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, 25 + Math.floor(Math.random() * 50)))
          continue
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2028', 'P2024', 'P2034', 'P1001', 'P1002', 'P1017'].includes(error.code))
          throw new AppError({ code: E.SYNC_UNAVAILABLE })
        throw error
      }
    }
  }

  // Uploads serialize only with the same recording session.  A position update
  // must not hold the trip-wide lifecycle lock used by administrative commands.
  private async uploadTransaction<T>(tripId: string, sessionId: string, run: (tx: Tx, trip: Trip) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM gps_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`
      const trip = await tx.trip.findUnique({ where: { id: tripId } })
      if (!trip) return fail(E.NOT_FOUND)
      return run(tx, trip)
    }, { timeout: 15000 })
  }

  private state(session: GpsSession): RecordingState {
    const state = recordingState(session)
    if (!state?.policy?.id) return fail(E.INVALID_STATE)
    return state
  }

  private response(session: GpsSession): SessionResponse {
    return { session: sessionDto(session), policy: publicPolicy(this.state(session).policy),
      ...((recordingState(session) as any)?.protocolVersion === 2 ? { protocolVersion: 2, limits: GPS_V2_LIMITS } : {}) }
  }

  private async effectivePolicy(tx: Tx): Promise<FrozenGpsPolicy> {
    const now = new Date()
    const policy = await tx.gpsPolicy.findFirst({
      where: { isActive: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
      orderBy: [{ effectiveFrom: 'desc' }, { versionNo: 'desc' }, { id: 'asc' }],
    })
    if (!policy) return fail(E.POLICY_UNAVAILABLE)
    return freezeGpsPolicy(policy)
  }

  private async currentPolicy(tx: Tx, tripId: string, userId: string) {
    const sessions = await tx.gpsSession.findMany({ where: { tripId, userId }, orderBy: { createdAt: 'desc' } })
    const session = sessions.find((s) => s.status !== 'STOPPED') ?? sessions[0]
    return session && recordingState(session)?.policy?.id ? this.state(session).policy : this.effectivePolicy(tx)
  }

  private async session(tx: Tx, tripId: string, userId: string, sessionId: string, deviceId?: string) {
    const session = await tx.gpsSession.findFirst({ where: { id: sessionId, tripId, userId } })
    if (!session) return fail(E.SESSION_NOT_FOUND)
    if (deviceId !== undefined && session.deviceId !== deviceId) fail(E.DEVICE_CONFLICT)
    this.state(session)
    return session
  }

  async authorizeRoster(tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } })
    if (!trip) return fail(E.NOT_FOUND)
    return this.access.roster(this.prisma, trip)
  }

  async authorize(tripId: string, userId: string, refresh = false) {
    return this.transaction(tripId, userId, async (tx, trip) => {
      await this.access.require(tx, trip, userId)
      const saved = refresh ? null : await tx.tripGpsProjection.findUnique({ where: { tripId } })
      const data = saved ? (saved.data as unknown as Projection) : await this.projection.refresh(tx, trip)
      return { tripId, rosterVersion: data.rosterVersion, serverTime: new Date().toISOString() }
    })
  }

  async context(tripId: string, userId: string, v2 = false): Promise<GpsContextResponse> {
    return this.transaction(tripId, userId, async (tx, trip) => {
      const member = await this.access.require(tx, trip, userId)
      await this.reconcile(tx, trip)
      const data = await this.projection.refresh(tx, trip)
      const routes = await this.projection.routeContext(tx, trip)
      const sessions = await tx.gpsSession.findMany({ where: { userId, status: { in: ['ACTIVE', 'PAUSED'] } } })
      const reason = !RECORDABLE.includes(trip.status)
        ? E.TRIP_NOT_RECORDABLE
        : sessions.some((s) => s.tripId !== tripId)
          ? E.ACTIVE_SESSION_EXISTS
          : null
      const policy = await this.currentPolicy(tx, tripId, userId)
      return {
        contractVersion: 'trip-gps/1.0.0',
        tripId,
        tripType: trip.tripType,
        tripStatus: trip.status,
        routeSource: routes.routePlans[0]?.source ?? 'SYSTEM',
        routeVersion: data.routeVersion,
        rosterVersion: data.rosterVersion,
        ...routes,
        checkpointMode: routes.checkpoints.length ? 'GEOFENCE_ONCE' : 'NONE',
        permissions: {
          canViewGroupLocations: true,
          canRecord: reason == null,
          cannotRecordReason: reason,
          canManageTrip: member.tripRole === 'HOST' || member.tripRole === 'LEADER',
          ...(v2 ? {
            canStartNewSession: reason == null,
            canContinueExistingSession: ['IN_PROGRESS', 'OPEN', 'FULL', 'CLOSED', 'COMPLETED'].includes(trip.status) &&
              sessions.some((s) => s.tripId === tripId && (recordingState(s) as any)?.protocolVersion === 2),
          } : {}),
        },
        policy: publicPolicy(policy),
        ...(v2 ? { capabilities: { supportedSyncProtocols: process.env.TRIP_GPS_V2_ENABLED === 'false' ? [1] : [1, 2], socketPublishSupported: true, ...GPS_V2_LIMITS } } : {}),
        serverTime: new Date().toISOString(),
      }
    })
  }

  async endTrip(tripId: string, userId: string) {
    return this.transaction(tripId, userId, async (tx, trip) => {
      const member = await this.access.require(tx, trip, userId)
      if (member.tripRole !== 'HOST' && member.tripRole !== 'LEADER') fail(E.ACCESS_DENIED)
      // The trip lock serializes completion; retries preserve the original timestamp.
      if (trip.status !== 'COMPLETED') {
        if (trip.status !== 'IN_PROGRESS') fail(E.INVALID_STATE)
        await tx.auditLog.create({
          data: {
            userId,
            action: 'GEO_TRIP_COMPLETED',
            entityType: 'Trip',
            entityId: tripId,
            oldValues: { status: trip.status },
            newValues: { status: 'COMPLETED' },
          },
        })
        Object.assign(
          trip,
          await tx.trip.update({
            where: { id: tripId },
            data: { status: 'COMPLETED', completedAt: new Date(), version: { increment: 1 } },
          }),
        )
      }
      await this.reconcile(tx, trip)
      await this.projection.refresh(tx, trip)
      return { tripId, tripStatus: trip.status, completedAt: trip.completedAt?.toISOString() }
    })
  }

  async stateSnapshot(tripId: string, userId: string, v2 = false) {
    return this.transaction(tripId, userId, async (tx, trip) => {
      await this.access.require(tx, trip, userId)
      await this.reconcile(tx, trip)
      const snapshot = this.projection.state(trip, userId, await this.projection.refresh(tx, trip))
      if (!v2) return snapshot
      const presences = await tx.gpsSocketPresence.findMany({ where: { tripId, expiresAt: { gt: new Date() } }, select: { userId: true } })
      const online = new Set(presences.map((p) => p.userId))
      const versions = await tx.gpsPresenceState.findMany({ where: { tripId }, select: { userId: true, version: true, locationVersion: true } })
      const presenceVersions = new Map(versions.map((v) => [v.userId, v.version]))
      const locationVersions = new Map(versions.map((v) => [v.userId, v.locationVersion]))
      return { ...snapshot, members: snapshot.members.map((m) => ({ ...m,
        connectionStatus: online.has(m.userId) ? 'ONLINE' : 'OFFLINE',
        presenceVersion: presenceVersions.get(m.userId) ?? 0,
        locationVersion: locationVersions.get(m.userId) ?? 0,
        locationFreshness: !m.lastLocation ? 'NO_DATA' : Date.now() - Date.parse(m.lastLocation.recordedAt) > 30000 ? 'STALE' : 'FRESH',
      })) }
    })
  }

  async start(tripId: string, userId: string, input: GpsStart): Promise<SessionResponse> {
    return this.transaction(tripId, userId, async (tx, trip) => {
      const member = await this.access.require(tx, trip, userId)
      const receipt = await tx.gpsStartReceipt.findUnique({
        where: { userId_clientSessionId: { userId, clientSessionId: input.clientSessionId } },
      })
      if (receipt) {
        const recorded = await this.session(tx, tripId, userId, receipt.sessionId)
        if (((recordingState(recorded) as any).protocolVersion ?? 1) !== (input.protocolVersion ?? 1)) fail(E.PROTOCOL_CONFLICT)
        if (receipt.tripId !== tripId || receipt.deviceId !== input.deviceId) fail(E.IDEMPOTENCY_CONFLICT)
        return this.response(await this.session(tx, tripId, userId, receipt.sessionId))
      }
      // Recognize start keys written by the first recording migration too.
      const existing = await tx.gpsSession.findUnique({
        where: { userId_clientSessionId: { userId, clientSessionId: input.clientSessionId } },
      })
      if (existing) {
        if (((recordingState(existing) as any).protocolVersion ?? 1) !== (input.protocolVersion ?? 1)) fail(E.PROTOCOL_CONFLICT)
        if (existing.tripId !== tripId || existing.deviceId !== input.deviceId) fail(E.IDEMPOTENCY_CONFLICT)
        return this.response(existing)
      }
      if (!RECORDABLE.includes(trip.status)) fail(E.TRIP_NOT_RECORDABLE)
      if (input.protocolVersion === 2 && process.env.TRIP_GPS_V2_ENABLED === 'false') fail(E.PROTOCOL_CONFLICT)
      if ((member.tripRole === 'HOST' || member.tripRole === 'LEADER') && trip.status !== 'IN_PROGRESS') {
        await tx.auditLog.create({
          data: {
            userId,
            action: 'GEO_TRIP_STARTED',
            entityType: 'Trip',
            entityId: tripId,
            oldValues: { status: trip.status },
            newValues: { status: 'IN_PROGRESS' },
          },
        })
        Object.assign(
          trip,
          await tx.trip.update({
            where: { id: tripId },
            data: { status: 'IN_PROGRESS', startedAt: new Date(), version: { increment: 1 } },
          }),
        )
      }
      const open = await tx.gpsSession.findFirst({ where: { userId, status: { in: ['ACTIVE', 'PAUSED'] } } })
      if (open) {
        if (((recordingState(open) as any).protocolVersion ?? 1) !== (input.protocolVersion ?? 1)) fail(E.PROTOCOL_CONFLICT)
        if (open.tripId !== tripId) fail(E.ACTIVE_SESSION_EXISTS)
        if (open.deviceId !== input.deviceId) fail(E.DEVICE_CONFLICT)
        await tx.gpsStartReceipt.create({ data: { userId, tripId, clientSessionId: input.clientSessionId, deviceId: input.deviceId, sessionId: open.id } })
        await this.projection.refresh(tx, trip)
        return this.response(open)
      }
      const now = new Date(),
        policy = await this.effectivePolicy(tx)
      const state: RecordingState = {
        protocolVersion: input.protocolVersion ?? 1,
        policy,
        intervals: [{ start: now.toISOString(), end: null }],
        commands: {},
        lastControlAt: now.toISOString(),
        controlStatus: 'ACTIVE',
      }
      const session = await tx.gpsSession.create({
        data: {
          tripId,
          userId,
          clientSessionId: input.clientSessionId,
          deviceId: input.deviceId,
          gpsPolicyId: policy.id,
          startedAt: now,
          recordingState: json(state),
        },
      })
      if (input.protocolVersion === 2) await tx.gpsSyncState.create({ data: { sessionId: session.id } })
      await tx.gpsStartReceipt.create({ data: { userId, tripId, clientSessionId: input.clientSessionId, deviceId: input.deviceId, sessionId: session.id } })
      await this.projection.refresh(tx, trip)
      return this.response(session)
    })
  }

  private async close(tx: Tx, session: GpsSession, endedAt: Date, reason: NonNullable<RecordingState['closedReason']>) {
    const state = this.state(session)
    if (endedAt < session.startedAt) endedAt = session.startedAt
    const end = endedAt.toISOString()
    state.controlStatus = session.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'
    state.closedReason = reason
    if (reason !== 'USER_FINISHED') state.autoClosedAt = end
    else state.lastControlAt = end
    state.intervals = state.intervals
      .filter((i) => i.start <= end)
      .map((i) => ({ start: i.start, end: !i.end || i.end > end ? end : i.end }))
    return tx.gpsSession.update({
      where: { id: session.id },
      data: {
        status: 'STOPPED',
        endedAt,
        uploadDeadline: ['CANCELLED', 'ACCESS_REVOKED'].includes(reason)
          ? null
          : new Date(endedAt.getTime() + state.policy.lateSyncGraceSeconds * 1000),
        version: { increment: 1 },
        recordingState: json(state),
      },
    })
  }

  private async closeForTrip(tx: Tx, trip: Trip, session: GpsSession) {
    if ((recordingState(session) as any)?.protocolVersion === 2 && trip.status === 'COMPLETED') return session
    if (session.status === 'STOPPED' || !['COMPLETED', 'INTERRUPTED', 'CANCELLED'].includes(trip.status)) return session
    let end = trip.status === 'CANCELLED' ? trip.cancelledAt : trip.completedAt
    if (!end) {
      end = trip.updatedAt ?? new Date()
      const data = trip.status === 'CANCELLED' ? { cancelledAt: end } : { completedAt: end }
      await tx.trip.update({ where: { id: trip.id }, data })
      Object.assign(trip, data)
    }
    return this.close(tx, session, end, trip.status === 'CANCELLED' ? 'CANCELLED' : 'TRIP_ENDED')
  }

  private async reconcile(tx: Tx, trip: Trip) {
    const roster = await this.access.roster(tx, trip)
    const members = new Map(roster.map((m) => [m.userId, m]))
    const contextHash = fingerprint(await this.projection.routeContext(tx, trip))
    const sessions = await tx.gpsSession.findMany({
      where: { tripId: trip.id, recordingState: { not: Prisma.DbNull } },
    })
    for (const session of sessions) {
      if (!recordingState(session)?.policy?.id) continue
      let closed = session
      if (!members.has(session.userId) && session.status !== 'STOPPED')
        closed = await this.close(tx, session, await this.access.revokedAt(tx, trip, session.userId), 'ACCESS_REVOKED')
      else closed = await this.closeForTrip(tx, trip, session)
      // Revoked users keep already-recorded results; do not grant them read access.
      const member = members.get(session.userId) ?? {
        userId: session.userId,
        fullName: '',
        avatarUrl: null,
        tripRole: 'MEMBER' as const,
        role: 'USER' as const,
      }
      if ((recordingState(session) as any)?.protocolVersion === 2) continue
      if (
        closed !== session ||
        (members.has(session.userId) &&
          (recordingState(session)?.trackContextHash !== contextHash || !recordingState(session)?.trackHash))
      )
        await this.tracks.sync(tx, trip, member, closed.status === 'STOPPED')
    }
  }

  private throttle(state: RecordingState) {
    const minute = Math.floor(Date.now() / 60000)
    state.rate = state.rate?.minute === minute ? { minute, count: state.rate.count + 1 } : { minute, count: 1 }
    if (state.rate.count > 120) fail(E.RATE_LIMITED, { retryAfterSeconds: 60 - (Math.floor(Date.now() / 1000) % 60) })
  }

  async upload(
    tripId: string,
    userId: string,
    sessionId: string,
    deviceId: string,
    input: GpsSamples,
  ): Promise<SamplesResponse> {
    const started = Date.now()
    const result = await this.uploadTransaction(tripId, sessionId, async (tx, trip) => {
      const member = await this.access.require(tx, trip, userId)
      if (![...RECORDABLE, 'COMPLETED', 'INTERRUPTED'].includes(trip.status)) fail(E.TRIP_NOT_RECORDABLE)
      let session = await this.session(tx, tripId, userId, sessionId, deviceId)
      if ((recordingState(session) as any)?.protocolVersion === 2) fail(E.PROTOCOL_CONFLICT)
      session = await this.closeForTrip(tx, trip, session)
      const state = this.state(session),
        now = new Date()
      if (session.status === 'STOPPED' && (!session.uploadDeadline || now > session.uploadDeadline))
        fail(E.UPLOAD_CLOSED)
      if (input.samples.length > state.policy.maxBatchSamples)
        throw new BadRequestException({
          message: 'GPS batch exceeds the frozen policy limit',
          details: { maxBatchSamples: state.policy.maxBatchSamples },
        })
      this.throttle(state)
      const acceptedSampleIds: string[] = [],
        duplicateSampleIds: string[] = []
      const rejectedSamples: SamplesResponse['rejectedSamples'] = []
      const ordered = [...input.samples].sort(
        (a, b) =>
          Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.clientSampleId.localeCompare(b.clientSampleId),
      )
      const rows = await tx.gpsLocation.findMany({
        where: { sessionId, clientSampleId: { in: ordered.map((s) => s.clientSampleId) } },
      })
      const existingById = new Map(rows.map((row) => [row.clientSampleId, row]))
      const insert: Prisma.GpsLocationCreateManyInput[] = []
      for (const sample of ordered) {
        const recordedAt = new Date(sample.recordedAt),
          time = recordedAt.toISOString()
        const existing = existingById.get(sample.clientSampleId)
        if (existing) {
          const same =
            existing.recordedAt.getTime() === recordedAt.getTime() &&
            ['latitude', 'longitude', 'accuracyM', 'altitudeM', 'speedMps', 'headingDeg'].every((key) => {
              const a = existing[key as keyof typeof existing],
                b = sample[key as keyof typeof sample]
              return a == null
                ? b == null
                : b != null &&
                    Number(a) ===
                      new Prisma.Decimal(Number(b))
                        .toDecimalPlaces(['latitude', 'longitude'].includes(key) ? 7 : 2)
                        .toNumber()
            })
          if (same) duplicateSampleIds.push(sample.clientSampleId)
          else rejectedSamples.push({ clientSampleId: sample.clientSampleId, code: 'SAMPLE_ID_CONFLICT' })
          continue
        }
        let code: SampleRejectCode | null =
          recordedAt < session.startedAt
            ? 'BEFORE_SESSION_START'
            : session.endedAt && recordedAt > session.endedAt
              ? 'AFTER_SESSION_END'
              : recordedAt.getTime() > now.getTime() + state.policy.maxFutureSkewSeconds * 1000
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
          receivedAt: now.toISOString(),
          altitudeM: sample.altitudeM ?? null,
          speedMps: sample.speedMps ?? null,
          headingDeg: sample.headingDeg ?? null,
        }
        if (!code && state.policy.maxPlausibleSpeedMps > 0) {
          // Only neighbouring points can establish an implausible speed. Avoid
          // loading and reprocessing the entire historical track on every ping.
          const [before, after] = await Promise.all([
            tx.gpsLocation.findFirst({ where: { sessionId, recordedAt: { lt: recordedAt } }, orderBy: [{ recordedAt: 'desc' }, { clientSampleId: 'desc' }] }),
            tx.gpsLocation.findFirst({ where: { sessionId, recordedAt: { gt: recordedAt } }, orderBy: [{ recordedAt: 'asc' }, { clientSampleId: 'asc' }] }),
          ])
          const point = (row: typeof before): TrackPoint | null => row ? ({
            sessionId: row.sessionId, clientSampleId: row.clientSampleId, latitude: Number(row.latitude), longitude: Number(row.longitude),
            accuracyM: Number(row.accuracyM ?? 0), altitudeM: row.altitudeM == null ? null : Number(row.altitudeM), speedMps: row.speedMps == null ? null : Number(row.speedMps), headingDeg: row.headingDeg == null ? null : Number(row.headingDeg), recordedAt: row.recordedAt.toISOString(), receivedAt: row.receivedAt.toISOString(),
          }) : null
          const all = [point(before), candidate, point(after)].filter((p): p is TrackPoint => p !== null).sort(
            (a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.clientSampleId.localeCompare(b.clientSampleId),
          )
          const index = all.indexOf(candidate)
          for (const neighbor of [all[index - 1], all[index + 1]].filter(Boolean)) {
            const [a, b] = neighbor.recordedAt <= time ? [neighbor, candidate] : [candidate, neighbor]
            if (gapReason(a, b, new Map([[sessionId, state.intervals]]), state.policy.signalGapSeconds)) continue
            const seconds = (Date.parse(b.recordedAt) - Date.parse(a.recordedAt)) / 1000
            if (seconds > 0 && meters(a, b) / seconds > state.policy.maxPlausibleSpeedMps) code = 'IMPLAUSIBLE_JUMP'
          }
        }
        if (code) {
          rejectedSamples.push({ clientSampleId: sample.clientSampleId, code })
          continue
        }
        insert.push({ ...sample, sessionId, recordedAt })
        acceptedSampleIds.push(sample.clientSampleId)
      }
      if (insert.length) await tx.gpsLocation.createMany({ data: insert })
      state.lastSyncAt = now.toISOString()
      const newest = insert.sort((a, b) => Date.parse(String(b.recordedAt)) - Date.parse(String(a.recordedAt)))[0]
      if (newest)
        state.lastLocation = {
          latitude: Number(newest.latitude), longitude: Number(newest.longitude), accuracyM: Number(newest.accuracyM),
          altitudeM: newest.altitudeM == null ? null : Number(newest.altitudeM), speedMps: newest.speedMps == null ? null : Number(newest.speedMps),
          headingDeg: newest.headingDeg == null ? null : Number(newest.headingDeg), recordedAt: new Date(newest.recordedAt).toISOString(), receivedAt: now.toISOString(),
        }
      state.trackRefreshPending = state.trackRefreshPending || insert.length > 0
      await tx.gpsSession.update({ where: { id: sessionId }, data: { recordingState: json(state) } })
      session = await this.session(tx, tripId, userId, sessionId)
      const data = await this.projection.updateLiveMember(tx, trip, session, userId)
      if (insert.length)
        await enqueueGps(tx, tripId, 'gps:track.refresh', { sessionId, userId }, null, `track-refresh:${sessionId}:${Math.floor(now.getTime() / 1000)}`)
      return {
        sessionId,
        acceptedSampleIds,
        duplicateSampleIds,
        rejectedSamples,
        sampleCount: session.sampleCount,
        totalDistanceMeters: session.totalDistanceMeters == null ? null : Number(session.totalDistanceMeters),
        lastLocation: this.state(session).lastLocation ?? null,
        memberVersion: data.members[userId].version,
        routeRebuildPending: insert.length > 0,
        serverTime: now.toISOString(),
      }
    })
    // Keep normal GPS sampling quiet. Slow requests remain actionable without
    // flooding the development console at the mobile sampling rate.
    const durationMs = Date.now() - started
    if (durationMs >= 2000)
      this.logger.warn(JSON.stringify({ event: 'gps_upload_slow', tripId, sessionId, userId, accepted: result.acceptedSampleIds.length, durationMs }))
    return result
  }

  async rebuildTrack(tripId: string, userId: string, sessionId: string) {
    return this.transaction(tripId, userId, async (tx, trip) => {
      // Serialize the slow projection with the same session's short upload lock,
      // so a rebuild cannot overwrite a newer live marker.
      await tx.$queryRaw`SELECT id FROM gps_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`
      const session = await this.session(tx, tripId, userId, sessionId)
      const state = this.state(session)
      if (!state.trackRefreshPending) return
      const member = await this.access.require(tx, trip, userId)
      await this.tracks.sync(tx, trip, member, session.status === 'STOPPED')
      const refreshed = await this.session(tx, tripId, userId, sessionId)
      const refreshedState = this.state(refreshed)
      refreshedState.trackRefreshPending = false
      await tx.gpsSession.update({ where: { id: sessionId }, data: { recordingState: json(refreshedState) } })
      await this.projection.refresh(tx, trip)
    })
  }

  async control(
    tripId: string,
    userId: string,
    sessionId: string,
    deviceId: string,
    action: 'pause' | 'resume' | 'finish',
    input: GpsControl,
  ) {
    return this.transaction(tripId, userId, async (tx, trip) => {
      const member = await this.access.require(tx, trip, userId)
      let session = await this.session(tx, tripId, userId, sessionId, deviceId),
        state = this.state(session)
      if ((state as any).protocolVersion === 2) fail(E.PROTOCOL_CONFLICT)
      const payload = fingerprint({
        action,
        commandId: input.commandId,
        expectedVersion: input.expectedVersion,
        occurredAt: input.occurredAt,
        ...(action === 'finish' ? { reason: 'USER_FINISHED' } : {}),
      })
      const receipt = state.commands[input.commandId]
      if (receipt) {
        if (receipt.payload !== payload && receipt.payload !== JSON.stringify({ action, ...input }))
          fail(E.IDEMPOTENCY_CONFLICT)
        return receipt.response
      }
      if (![...RECORDABLE, 'COMPLETED', 'INTERRUPTED'].includes(trip.status)) fail(E.TRIP_NOT_RECORDABLE)
      session = await this.closeForTrip(tx, trip, session)
      state = this.state(session)
      if (action !== 'finish' || session.status !== 'STOPPED') {
        if (session.version !== input.expectedVersion) fail(E.VERSION_CONFLICT, { currentVersion: session.version })
        const historical = session.status === 'STOPPED' && state.closedReason === 'TRIP_ENDED'
        if (session.status === 'STOPPED' && !historical) fail(E.INVALID_STATE)
        if (historical && (!session.uploadDeadline || new Date() > session.uploadDeadline)) fail(E.UPLOAD_CLOSED)
        const occurredAt = new Date(input.occurredAt),
          time = occurredAt.toISOString()
        if (
          occurredAt < session.startedAt ||
          occurredAt < new Date(state.lastControlAt) ||
          occurredAt.getTime() > Date.now() + state.policy.maxFutureSkewSeconds * 1000 ||
          (historical && occurredAt > session.endedAt!)
        )
          fail(E.INVALID_STATE)
        if (
          action !== 'resume' &&
          (await tx.gpsLocation.findFirst({
            where: {
              sessionId,
              recordedAt: {
                gt: occurredAt,
                ...(session.endedAt ? { lte: session.endedAt } : {}),
              },
            },
          }))
        )
          fail(E.INVALID_STATE)
        if (action === 'finish') session = await this.close(tx, session, occurredAt, 'USER_FINISHED')
        else {
          const controlStatus = historical ? state.controlStatus : session.status
          if (action === 'pause') {
            if (controlStatus !== 'ACTIVE') fail(E.INVALID_STATE)
            const interval = state.intervals.at(-1)
            if (!interval || time < interval.start) return fail(E.INVALID_STATE)
            interval.end = time
          } else {
            if (controlStatus !== 'PAUSED') fail(E.INVALID_STATE)
            state.intervals.push({ start: time, end: historical ? session.endedAt!.toISOString() : null })
          }
          state.controlStatus = action === 'pause' ? 'PAUSED' : 'ACTIVE'
          state.lastControlAt = time
          session = await tx.gpsSession.update({
            where: { id: sessionId },
            data: {
              status: historical ? 'STOPPED' : state.controlStatus,
              version: { increment: 1 },
              recordingState: json(state),
            },
          })
        }
      }
      await this.tracks.sync(tx, trip, member, action === 'finish' || session.status === 'STOPPED')
      session = await this.session(tx, tripId, userId, sessionId)
      const route =
        action === 'finish'
          ? await tx.tripActualRoute.findUnique({ where: { tripId_userId: { tripId, userId } } })
          : null
      const response =
        action === 'finish'
          ? {
              session: sessionDto(session),
              resultStatus: route?.resultStatus ?? 'EMPTY',
              actualRouteId: route?.id ?? null,
            }
          : this.response(session)
      state = this.state(session)
      state.commands[input.commandId] = { payload, response: JSON.parse(JSON.stringify(response)) }
      await tx.gpsSession.update({ where: { id: sessionId }, data: { recordingState: json(state) } })
      await this.projection.refresh(tx, trip)
      return response
    })
  }

  async getSession(tripId: string, userId: string, sessionId: string) {
    return this.transaction(tripId, userId, async (tx, trip) => {
      await this.access.require(tx, trip, userId)
      await this.reconcile(tx, trip)
      await this.projection.refresh(tx, trip)
      return this.response(await this.session(tx, tripId, userId, sessionId))
    })
  }

  async liveRoute(tripId: string, userId: string) {
    return this.transaction(tripId, userId, async (tx, trip) => {
      const member = await this.access.require(tx, trip, userId)
      await this.reconcile(tx, trip)
      const track = await this.tracks.load(tx, tripId, userId)
      const data = await this.projection.refresh(tx, trip)
      const policy = await this.currentPolicy(tx, tripId, userId)
      const route = assembleRoute(track.points, track.intervals, policy.signalGapSeconds)
      const retained = track.sessions.some((s) => recordingState(s)?.rawPurgedAt)
        ? await tx.tripActualRoute.findUnique({ where: { tripId_userId: { tripId, userId } } })
        : null
      return {
        tripId,
        userId,
        version: data.members[userId]?.version ?? 0,
        routeGeojson: retained ? retained.routeGeojson : simplifyLiveRoute(route),
        pointCount: retained?.pointCount ?? route.pointCount,
        totalDistanceMeters:
          retained?.totalDistanceMeters == null ? route.totalDistanceMeters : Number(retained.totalDistanceMeters),
        serverTime: new Date().toISOString(),
      }
    })
  }

  async result(tripId: string, userId: string): Promise<ActualRouteResponse> {
    return this.transaction(tripId, userId, async (tx, trip) => {
      await this.access.require(tx, trip, userId)
      await this.reconcile(tx, trip)
      await this.projection.refresh(tx, trip)
      const sessions = await tx.gpsSession.findMany({ where: { tripId, userId } })
      const route = await tx.tripActualRoute.findUnique({ where: { tripId_userId: { tripId, userId } } })
      const meta = route?.metadata as any
      return {
        tripId,
        userId,
        actualRouteId: route?.id ?? null,
        resultStatus: sessions.some((s) => s.status !== 'STOPPED')
          ? 'RECORDING'
          : route
            ? (route.resultStatus as ActualRouteResponse['resultStatus'])
            : sessions.length
              ? 'PROCESSING'
              : 'NOT_STARTED',
        version: route?.version ?? 0,
        generatedAt: route?.generatedAt.toISOString() ?? null,
        routeGeojson: (route?.routeGeojson as ActualRouteResponse['routeGeojson']) ?? null,
        pointCount: route?.pointCount ?? 0,
        totalDistanceMeters: route?.totalDistanceMeters == null ? null : Number(route.totalDistanceMeters),
        distanceMethod: 'SUM_CONSECUTIVE_VALID_POINTS',
        gapConnections: meta?.gapConnections ?? [],
        checkpointProgress: await this.projection.progress(tx, tripId, userId),
        sourceSessionIds: meta?.sourceSessionIds ?? [],
        uploadDeadline:
          sessions
            .map((s) => s.uploadDeadline?.toISOString())
            .filter((d): d is string => !!d)
            .sort()
            .at(-1) ?? null,
      }
    })
  }

  private async reportResultFailure(tripId: string) {
    try {
      await this.transaction(tripId, null, async (tx) => {
        const sessions = await tx.gpsSession.findMany({
          where: { tripId, status: 'STOPPED', recordingState: { not: Prisma.DbNull } },
        })
        for (const session of sessions) {
          await enqueueGps(
            tx,
            tripId,
            'gps:route.failed',
            { userId: session.userId, code: E.POLICY_UNAVAILABLE, retryable: true },
            session.userId,
            `gps-failed:${session.id}:${session.version}:${session.updatedAt.getTime()}`,
          )
          const existing = await tx.tripActualRoute.findUnique({
            where: { tripId_userId: { tripId, userId: session.userId } },
          })
          if (!existing)
            await tx.tripActualRoute.create({
              data: {
                tripId,
                userId: session.userId,
                sourceSessionId: session.id,
                routeGeojson: Prisma.JsonNull,
                resultStatus: 'FAILED',
                totalDistanceMeters: null,
                metadata: json({ sourceSessionIds: [session.id], gapConnections: [] }),
              },
            })
        }
      })
    } catch {
      this.logger.error(`Could not persist GPS failure notification for trip ${tripId}`)
    }
  }

  @Interval(5000)
  async finalizeEndedTrips() {
    if (this.reconciling) return
    this.reconciling = true
    try { await this.reconcileRows() }
    catch { this.logger.warn('GPS reconciliation deferred; database unavailable') }
    finally { this.reconciling = false }
  }

  private async reconcileRows() {
    const rows = await this.prisma.tripGpsProjection.findMany({
      where: {
        OR: [
          { trip: { status: { in: ['DRAFT', 'OPEN', 'FULL', 'CLOSED', 'CANCEL_PENDING', 'IN_PROGRESS'] } } },
          { trip: { gpsSessionsViaTripId: { some: { status: { in: ['ACTIVE', 'PAUSED'] } } } } },
          { trip: { tripActualRoutesViaTripId: { some: { resultStatus: 'FAILED' } } } },
          ...(['COMPLETED', 'INTERRUPTED', 'CANCELLED'] as const).map((status) => ({
            trip: { status },
            data: { path: ['tripStatus'], not: status },
          })),
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    })
    for (const row of rows) {
      try {
        await this.transaction(row.tripId, null, async (tx, trip) => {
          await this.reconcile(tx, trip)
          await this.projection.refresh(tx, trip)
        })
      } catch (error) {
        this.logger.error(
          `GPS reconciliation failed for trip ${row.tripId}`,
          error instanceof Error ? error.stack : undefined,
        )
        await this.reportResultFailure(row.tripId)
      }
    }
  }

  @Interval(3600000)
  async cleanupRawPoints() {
    if (process.env.TRIP_GPS_RETENTION_ENABLED !== 'true') return
    if (this.cleaning) return
    this.cleaning = true
    try { await this.cleanupRows() }
    catch { this.logger.warn('GPS raw cleanup deferred; database unavailable') }
    finally { this.cleaning = false }
  }

  private async cleanupRows() {
    const rows = await this.prisma.tripActualRoute.findMany({
      where: { resultStatus: { in: ['READY', 'EMPTY'] } },
      orderBy: { generatedAt: 'asc' },
      take: 100,
    })
    for (const row of rows)
      await this.transaction(row.tripId, row.userId, async (tx, trip) => {
        const sessions = await tx.gpsSession.findMany({ where: { tripId: row.tripId, userId: row.userId } })
        if (
          !sessions.length ||
          sessions.some(
            (s) => s.status !== 'STOPPED' || !recordingState(s)?.policy?.id || recordingState(s)?.rawPurgedAt,
          )
        )
          return
        const v2 = await tx.gpsSyncState.findMany({ where: { sessionId: { in: sessions.map((s) => s.id) } } })
        if (v2.some((s) => s.status !== 'COMPLETE' || s.processedRevision !== s.snapshotRevision)) return
        const age = Math.max(...sessions.map((s) => this.state(s).policy.rawLocationRetentionDays)) * 86400000
        const current = await tx.tripActualRoute.findUniqueOrThrow({ where: { id: row.id } })
        if (!['READY', 'EMPTY'].includes(current.resultStatus)) return
        if (
          Date.now() < current.generatedAt.getTime() + age ||
          sessions.some((s) => s.uploadDeadline && s.uploadDeadline.getTime() >= Date.now())
        )
          return
        for (const session of sessions) {
          const state = this.state(session)
          state.rawPurgedAt = new Date().toISOString()
          await tx.gpsLocation.deleteMany({ where: { sessionId: session.id } })
          await tx.gpsSession.update({ where: { id: session.id }, data: { recordingState: json(state) } })
        }
      })
  }
}
