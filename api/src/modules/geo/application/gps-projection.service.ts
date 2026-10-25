import { Injectable } from '@nestjs/common'
import { Prisma, Trip, GpsSession, CheckpointEvent } from '@prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { GpsAccessService, GpsMember } from './gps-access.service'
import type { FrozenGpsPolicy } from './gps-policy'
import type {
  CheckpointProgressDto,
  EventEnvelope,
  MemberStateDto,
  PlannedRouteDto,
  SessionDto,
  GpsStateResponse,
} from './trip-gps.contract'

export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
export const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export interface Projection {
  routeVersion: number
  rosterVersion: number
  routeHash: string
  rosterHash: string
  tripStatus: string
  members: Record<string, { version: number; hash: string; active: boolean; value: MemberStateDto }>
}
export function sessionDto(session: GpsSession): SessionDto {
  return {
    id: session.id,
    tripId: session.tripId,
    userId: session.userId,
    clientSessionId: session.clientSessionId!,
    deviceId: session.deviceId!,
    gpsPolicyId: session.gpsPolicyId,
    status: session.status,
    version: session.version,
    recordingIntervals: (session.recordingState as any)?.intervals ?? [],
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    uploadDeadline: session.uploadDeadline?.toISOString() ?? null,
    sampleCount: session.sampleCount,
    totalDistanceMeters: session.totalDistanceMeters == null ? null : Number(session.totalDistanceMeters),
  }
}
export async function enqueueGps(
  tx: Prisma.TransactionClient,
  tripId: string,
  eventType: string,
  data: unknown,
  recipientUserId: string | null = null,
  deduplicationKey?: string,
) {
  const id = randomUUID()
  const envelope: EventEnvelope<unknown> = {
    eventId: id,
    contractVersion: 'trip-gps/1.0.0',
    tripId,
    occurredAt: new Date().toISOString(),
    data,
  }
  const row = {
    id,
    deduplicationKey: deduplicationKey ?? id,
    eventType,
    aggregateType: 'TripGps',
    aggregateId: tripId,
    payload: json({ envelope, recipientUserId }),
  }
  await tx.gpsOutboxEvent.upsert({ where: { deduplicationKey: row.deduplicationKey }, create: row, update: {} })
}

@Injectable()
export class GpsProjectionService {
  constructor(private readonly access: GpsAccessService) {}

  async routeContext(tx: Prisma.TransactionClient, trip: Trip) {
    const plans = await tx.tripTrailPlan.findMany({
      where: { tripId: trip.id },
      orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
    })
    const active = await tx.tripActiveTrailPlan.findUnique({ where: { tripId: trip.id } })
    const routePlans: PlannedRouteDto[] = plans.map((p) => ({
      trailPlanId: p.id,
      source: p.personalTrailId ? 'PERSONAL' : 'SYSTEM',
      sourceTrailId: (p.personalTrailId ?? p.systemTrailId)!,
      sequence: p.sequence,
      name: p.snapshotName,
      geometry: this.geometry(p.snapshotGeojson),
    }))
    const rows = await tx.tripCheckpoint.findMany({
      where: { tripId: trip.id, isEnabled: true },
      orderBy: { sequence: 'asc' },
    })
    const checkpoints = rows.map((c) => ({
      id: c.id,
      name: c.name,
      sequence: c.sequence,
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      radiusMeters: c.radiusMeters,
      isRequired: c.isRequired,
    }))
    return { routePlans, activeTrailPlanId: active?.trailPlanId ?? null, checkpoints }
  }

  private geometry(raw: Prisma.JsonValue): PlannedRouteDto['geometry'] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    if (raw.type === 'Feature') return this.geometry(raw.geometry ?? null)
    if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) {
      const geometries = raw.features.map((f) => this.geometry(f)).filter((g) => g != null)
      if (!geometries.length) return null
      return {
        type: 'MultiLineString',
        coordinates: geometries.flatMap((g) => (g.type === 'LineString' ? [g.coordinates] : g.coordinates)),
      }
    }
    if (raw.type !== 'LineString' && raw.type !== 'MultiLineString') return null
    const input = raw.type === 'LineString' ? [raw.coordinates] : raw.coordinates
    if (!Array.isArray(input)) return null
    const lines = input
      .filter(
        (line): line is number[][] =>
          Array.isArray(line) &&
          line.length >= 2 &&
          line.every(
            (p) =>
              Array.isArray(p) &&
              typeof p[0] === 'number' &&
              typeof p[1] === 'number' &&
              Number.isFinite(p[0]) &&
              Number.isFinite(p[1]) &&
              Math.abs(p[0]) <= 180 &&
              Math.abs(p[1]) <= 90,
          ),
      )
      .map((line) => line.map((p) => [p[0], p[1]] as [number, number]))
    if (!lines.length) return null
    return raw.type === 'LineString'
      ? { type: 'LineString', coordinates: lines[0] }
      : { type: 'MultiLineString', coordinates: lines }
  }

  async progress(tx: Prisma.TransactionClient, tripId: string, userId: string): Promise<CheckpointProgressDto> {
    const checkpoints = await tx.tripCheckpoint.findMany({
      where: { tripId, isEnabled: true },
      orderBy: { sequence: 'asc' },
      select: { id: true },
    })
    const events = await tx.checkpointEvent.findMany({
      where: { tripId, userId, tripCheckpointId: { in: checkpoints.map((c) => c.id) } },
      orderBy: [{ arrivalAt: 'desc' }, { id: 'asc' }],
    })
    return this.progressValue(checkpoints, events)
  }

  private progressValue(checkpoints: { id: string }[], events: CheckpointEvent[]): CheckpointProgressDto {
    const ids = new Set(events.map((e) => e.tripCheckpointId))
    const last = events[0]
    return {
      applicable: checkpoints.length > 0,
      total: checkpoints.length,
      passed: ids.size,
      percentage: checkpoints.length ? Math.round((ids.size / checkpoints.length) * 100) : null,
      arrivedCheckpointIds: checkpoints.filter((c) => ids.has(c.id)).map((c) => c.id),
      lastArrival: last
        ? {
            checkpointId: last.tripCheckpointId,
            arrivalAt: last.arrivalAt.toISOString(),
            distanceToCheckpointM: Number(last.distanceToCheckpointM ?? 0),
          }
        : null,
    }
  }

  private member(
    trip: Trip,
    member: GpsMember,
    hasGeometry: boolean,
    routeHash: string,
    sessions: GpsSession[],
    progress: CheckpointProgressDto,
  ): Omit<MemberStateDto, 'memberVersion'> {
    const chosen = sessions.find((s) => s.status !== 'STOPPED') ?? sessions[0]
    const states = sessions.map((s) => s.recordingState as any).filter(Boolean)
    const lastLocation =
      states
        .map((s) => s.lastLocation)
        .filter(Boolean)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] ?? null
    const state = chosen?.recordingState as any
    const policy = state?.policy as FrozenGpsPolicy | undefined
    const age = lastLocation ? (Date.now() - Date.parse(lastLocation.recordedAt)) / 1000 : Infinity
    const locationStatus = !lastLocation
      ? 'NO_DATA'
      : chosen?.status === 'STOPPED' || trip.status !== 'IN_PROGRESS'
        ? 'STOPPED'
        : chosen?.status === 'PAUSED'
          ? 'PAUSED'
          : age > (policy?.offlineAfterSeconds ?? 120)
            ? 'OFFLINE'
            : age > (policy?.staleAfterSeconds ?? 30)
              ? 'STALE'
              : 'LIVE'
    let deviation: MemberStateDto['deviation'] = state?.deviation ?? {
      status: 'UNKNOWN',
      eventId: null,
      distanceToRouteMeters: null,
      checkedAt: null,
    }
    if (!hasGeometry)
      deviation = { status: 'NOT_APPLICABLE', eventId: null, distanceToRouteMeters: null, checkedAt: null }
    else if (
      state?.trackContextHash !== routeHash ||
      (deviation.checkedAt &&
        Date.now() - Date.parse(deviation.checkedAt) > (policy?.liveLocationMaxAgeSeconds ?? 30) * 1000)
    )
      deviation = { ...deviation, status: 'UNKNOWN' }
    const lastSyncAt =
      states
        .map((s) => s.lastSyncAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null
    const dto = chosen ? sessionDto(chosen) : null
    return {
      userId: member.userId,
      fullName: member.fullName,
      avatarUrl: member.avatarUrl,
      tripRole: member.tripRole,
      session: dto
        ? {
            id: dto.id,
            status: dto.status,
            startedAt: dto.startedAt,
            endedAt: dto.endedAt,
            sampleCount: dto.sampleCount,
            totalDistanceMeters: dto.totalDistanceMeters,
          }
        : null,
      lastLocation,
      locationStatus,
      lastSyncAt,
      checkpointProgress: progress,
      deviation,
    }
  }

  async refresh(tx: Prisma.TransactionClient, trip: Trip): Promise<Projection> {
    const prior = await tx.tripGpsProjection.findUnique({ where: { tripId: trip.id } })
    const data: Projection = (prior?.data as unknown as Projection) ?? {
      routeVersion: 0,
      rosterVersion: 0,
      routeHash: '',
      rosterHash: '',
      tripStatus: '',
      members: {},
    }
    const routes = await this.routeContext(tx, trip)
    const roster = await this.access.roster(tx, trip)
    const sessions = await tx.gpsSession.findMany({
      where: { tripId: trip.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    })
    const events = await tx.checkpointEvent.findMany({
      where: { tripId: trip.id, tripCheckpointId: { in: routes.checkpoints.map((c) => c.id) } },
      orderBy: [{ arrivalAt: 'desc' }, { id: 'asc' }],
    })
    const routeHash = fingerprint(routes),
      rosterHash = fingerprint(roster)
    const tripChanged =
      data.routeHash !== routeHash || data.rosterHash !== rosterHash || data.tripStatus !== trip.status
    if (data.routeHash !== routeHash) {
      data.routeVersion++
      data.routeHash = routeHash
    }
    if (data.rosterHash !== rosterHash) {
      data.rosterVersion++
      data.rosterHash = rosterHash
    }
    data.tripStatus = trip.status
    const activeIds = new Set(roster.map((m) => m.userId))
    for (const [userId, saved] of Object.entries(data.members)) {
      if (saved.active && !activeIds.has(userId)) {
        saved.active = false
        await enqueueGps(tx, trip.id, 'gps:access.revoked', { code: 'FORBIDDEN' }, userId)
      }
    }
    const activePlan = routes.routePlans.find((p) => p.trailPlanId === routes.activeTrailPlanId) ?? routes.routePlans[0]
    const hasGeometry = !!activePlan?.geometry
    for (const member of roster) {
      const value = this.member(
          trip,
          member,
          hasGeometry,
          routeHash,
          sessions.filter((s) => s.userId === member.userId),
          this.progressValue(
            routes.checkpoints,
            events.filter((e) => e.userId === member.userId),
          ),
        ),
        hash = fingerprint(value)
      const saved = data.members[member.userId]
      if (!saved || saved.hash !== hash || !saved.active) {
        const version = (saved?.version ?? 0) + 1
        const dto = { ...value, memberVersion: version }
        data.members[member.userId] = { version, hash, value: dto, active: true }
        await enqueueGps(tx, trip.id, 'gps:member.updated', { member: dto })
      }
    }
    await tx.tripGpsProjection.upsert({
      where: { tripId: trip.id },
      create: { tripId: trip.id, data: json(data) },
      update: { data: json(data) },
    })
    if (tripChanged)
      await enqueueGps(tx, trip.id, 'gps:trip.changed', {
        tripStatus: trip.status,
        routeVersion: data.routeVersion,
        rosterVersion: data.rosterVersion,
      })
    return data
  }

  state(trip: Trip, userId: string, data: Projection): GpsStateResponse {
    return {
      tripId: trip.id,
      tripStatus: trip.status,
      routeVersion: data.routeVersion,
      rosterVersion: data.rosterVersion,
      serverTime: new Date().toISOString(),
      selfUserId: userId,
      members: Object.values(data.members)
        .filter((m) => m.active)
        .map((m) => m.value),
    }
  }
}
