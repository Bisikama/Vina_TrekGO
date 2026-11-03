import { Injectable } from '@nestjs/common'
import { Prisma, Trip } from '@prisma/client'
import { createHash } from 'node:crypto'
import { CheckpointGpsArrivalPort } from '../../checkpoint/application/ports/checkpoint-gps-arrival.port'
import { GpsMember } from './gps-access.service'
import { GpsProjectionService, enqueueGps, fingerprint, json } from './gps-projection.service'
import { recordingState } from './gps-recording-state'
import { assembleRoute, distanceToRoute, gapReason, inInterval, TrackPoint } from './gps-geometry'
import type { MemberStateDto } from './trip-gps.contract'

function eventId(key: string) {
  const h = createHash('sha256').update(key).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

@Injectable()
export class GpsTrackService {
  constructor(
    private readonly checkpoints: CheckpointGpsArrivalPort,
    private readonly projection: GpsProjectionService,
  ) {}

  async load(tx: Prisma.TransactionClient, tripId: string, userId: string) {
    const sessions = await tx.gpsSession.findMany({
      where: { tripId, userId },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    })
    const rows = await tx.gpsLocation.findMany({
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      orderBy: [{ recordedAt: 'asc' }, { clientSampleId: 'asc' }],
    })
    const intervals = new Map(
      sessions.map((s) => [
        s.id,
        recordingState(s)?.intervals ?? [{ start: s.startedAt.toISOString(), end: s.endedAt?.toISOString() ?? null }],
      ]),
    )
    const points: TrackPoint[] = rows
      .map((p) => ({
        sessionId: p.sessionId,
        clientSampleId: p.clientSampleId,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        accuracyM: Number(p.accuracyM ?? 0),
        altitudeM: p.altitudeM == null ? null : Number(p.altitudeM),
        speedMps: p.speedMps == null ? null : Number(p.speedMps),
        headingDeg: p.headingDeg == null ? null : Number(p.headingDeg),
        recordedAt: p.recordedAt.toISOString(),
        receivedAt: p.receivedAt.toISOString(),
      }))
      .filter((p) => inInterval(p, intervals.get(p.sessionId) ?? []) >= 0)
    return { sessions, intervals, points }
  }

  async sync(tx: Prisma.TransactionClient, trip: Trip, member: GpsMember, forceResult = false) {
    const track = await this.load(tx, trip.id, member.userId)
    const latest = track.sessions.at(-1)
    if (!latest || !recordingState(latest)?.policy?.id || recordingState(latest).rawPurgedAt) return track
    const policy = recordingState(latest).policy
    const context = await this.projection.routeContext(tx, trip)
    const switches = await tx.tripTrailSwitch.findMany({ where: { tripId: trip.id }, orderBy: { switchedAt: 'asc' } })
    const hash = fingerprint({
      points: track.points.map((p) => [p.clientSampleId, p.recordedAt, p.latitude, p.longitude]),
      sessions: track.sessions.map((s) => [s.id, s.status, s.endedAt, recordingState(s)?.intervals]),
      context,
      switches,
    })
    const oldRoute = await tx.tripActualRoute.findUnique({
      where: { tripId_userId: { tripId: trip.id, userId: member.userId } },
    })
    if (
      recordingState(latest).trackHash === hash &&
      (!forceResult || (oldRoute && ['READY', 'EMPTY'].includes(oldRoute.resultStatus)))
    )
      return track
    await this.checkpoints.record(
      tx,
      trip.id,
      member.userId,
      member.role,
      trip.tripType === 'PRIVATE',
      policy.defaultCheckpointRadiusM,
      track.points.map((p) => ({ ...p, recordedAt: new Date(p.recordedAt) })),
    )
    const deviation = await this.deviations(tx, trip, member.userId, track, context, switches)
    for (const session of track.sessions) {
      const state = recordingState(session)
      if (!state) continue
      const own = track.points.filter((p) => p.sessionId === session.id)
      const route = assembleRoute(own, track.intervals, state.policy.signalGapSeconds)
      const last = own.at(-1)
      if (state.protocolVersion !== 2 || !state.lastLocation ||
          (last && last.recordedAt > state.lastLocation.recordedAt)) state.lastLocation = last ? this.location(last) : null
      state.trackHash = hash
      state.trackContextHash = fingerprint(context)
      if (session.id === latest.id) state.deviation = deviation
      const updated = await tx.gpsSession.update({
        where: { id: session.id },
        data: {
          sampleCount: own.length,
          actualPathGeojson: route.routeGeojson ? json(route.routeGeojson) : Prisma.JsonNull,
          totalDistanceMeters: route.totalDistanceMeters,
          recordingState: json(state),
        },
      })
      Object.assign(session, updated)
    }
    if (track.sessions.length && track.sessions.every((s) => s.status === 'STOPPED')) {
      const route = assembleRoute(track.points, track.intervals, policy.signalGapSeconds)
      const metadata = {
        sourceSessionIds: track.sessions.map((s) => s.id),
        gapConnections: route.gapConnections,
        distanceMethod: 'SUM_WITHIN_ACTIVE_INTERVALS',
      }
      const result = await tx.tripActualRoute.upsert({
        where: { tripId_userId: { tripId: trip.id, userId: member.userId } },
        create: {
          tripId: trip.id,
          userId: member.userId,
          sourceSessionId: latest.id,
          routeGeojson: route.routeGeojson ? json(route.routeGeojson) : Prisma.JsonNull,
          totalDistanceMeters: route.totalDistanceMeters,
          pointCount: route.pointCount,
          resultStatus: route.routeGeojson ? 'READY' : 'EMPTY',
          metadata: json(metadata),
        },
        update: {
          routeGeojson: route.routeGeojson ? json(route.routeGeojson) : Prisma.JsonNull,
          totalDistanceMeters: route.totalDistanceMeters,
          pointCount: route.pointCount,
          resultStatus: route.routeGeojson ? 'READY' : 'EMPTY',
          version: { increment: 1 },
          generatedAt: new Date(),
          sourceSessionId: latest.id,
          metadata: json(metadata),
        },
      })
      await enqueueGps(
        tx,
        trip.id,
        'gps:route.ready',
        { userId: member.userId, actualRouteId: result.id, version: result.version, resultStatus: result.resultStatus },
        member.userId,
      )
    }
    return track
  }

  location(p: TrackPoint) {
    const { sessionId, clientSampleId, ...location } = p
    return location
  }

  private async deviations(
    tx: Prisma.TransactionClient,
    trip: Trip,
    userId: string,
    track: Awaited<ReturnType<GpsTrackService['load']>>,
    context: Awaited<ReturnType<GpsProjectionService['routeContext']>>,
    switches: { fromPlanId: string | null; toPlanId: string; switchedAt: Date }[],
  ) {
    const latest = track.sessions.at(-1)!,
      policy = recordingState(latest).policy
    let current: any = null,
      consecutive = 0,
      recovered = 0,
      previous: TrackPoint | null = null,
      previousPlan = ''
    let lastDistance: number | null = null,
      checkedAt: string | null = null,
      liveEventId: string | null = null
    const events: any[] = []
    const activePlan =
      context.routePlans.find((p) => p.trailPlanId === context.activeTrailPlanId) ?? context.routePlans[0]
    const applicable = distanceToRoute({ latitude: 0, longitude: 0 }, activePlan?.geometry ?? null) != null
    for (const p of track.points) {
      const switched = switches.filter((s) => s.switchedAt.getTime() <= Date.parse(p.recordedAt)).at(-1)
      const planId = switched?.toPlanId ?? switches[0]?.fromPlanId ?? activePlan?.trailPlanId
      const plan = context.routePlans.find((r) => r.trailPlanId === planId)
      const d = distanceToRoute(p, plan?.geometry ?? null)
      const reset =
        previous && (previousPlan !== planId || gapReason(previous, p, track.intervals, policy.signalGapSeconds))
      if (reset) {
        consecutive = 0
        recovered = 0
        current = null
      }
      previous = p
      previousPlan = planId ?? ''
      checkedAt = p.recordedAt
      lastDistance = d
      if (d == null) {
        consecutive = 0
        recovered = 0
        current = null
        continue
      }
      if (!current) {
        consecutive = d > policy.deviationThresholdM ? consecutive + 1 : 0
        if (consecutive >= policy.deviationConsecutiveSamples) {
          current = {
            id: eventId(`${trip.id}:${userId}:${p.clientSampleId}:${planId}`),
            tripId: trip.id,
            userId,
            sessionId: p.sessionId,
            tripTrailPlanId: planId,
            status: 'DEVIATED',
            startAt: new Date(p.recordedAt),
            recoveredAt: null,
            maxDeviationDistanceM: d,
            lastLatitude: p.latitude,
            lastLongitude: p.longitude,
            thresholdMSnapshot: policy.deviationThresholdM,
            gpsManaged: true,
          }
          events.push(current)
        }
      } else {
        current.maxDeviationDistanceM = Math.max(current.maxDeviationDistanceM, d)
        current.lastLatitude = p.latitude
        current.lastLongitude = p.longitude
        recovered = d <= policy.recoveryThresholdM ? recovered + 1 : 0
        if (recovered >= policy.recoveryConsecutiveSamples) {
          current.status = 'RECOVERED'
          current.recoveredAt = new Date(p.recordedAt)
          current = null
          consecutive = 0
          recovered = 0
        }
      }
      liveEventId = current?.id ?? null
    }
    await tx.routeDeviationEvent.deleteMany({
      where: { tripId: trip.id, userId, gpsManaged: true, id: { notIn: events.map((e) => e.id) } },
    })
    for (const event of events)
      await tx.routeDeviationEvent.upsert({ where: { id: event.id }, create: event, update: event })
    const fresh = checkedAt && Date.now() - Date.parse(checkedAt) <= policy.liveLocationMaxAgeSeconds * 1000
    const status: MemberStateDto['deviation']['status'] = !applicable
      ? 'NOT_APPLICABLE'
      : !fresh || lastDistance == null || previousPlan !== activePlan?.trailPlanId
        ? 'UNKNOWN'
        : current
          ? 'DEVIATED'
          : consecutive
            ? 'UNKNOWN'
            : 'NORMAL'
    return {
      status,
      eventId: status === 'DEVIATED' ? liveEventId : null,
      distanceToRouteMeters: lastDistance,
      checkedAt,
    }
  }
}
