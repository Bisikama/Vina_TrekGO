import { HttpException, Inject, Injectable } from '@nestjs/common'
import { TRIP_STORE } from '../trip.types'
import type {
  Actor,
  Checkpoint,
  Issue,
  Page,
  Readiness,
  Trail,
  TripInput,
  TripSession,
  TripStore,
  TripView,
} from '../trip.types'
import { basicIssues, routeIssues } from '../trip.policy'

export function fail(status: number, code: string, message: string, issues?: Issue[]): never {
  throw new HttpException({ statusCode: status, code, message, ...(issues ? { issues } : {}) }, status)
}
function leader(actor: Actor | null): asserts actor is Actor {
  if (!actor?.id || actor.role !== 'LEADER' || actor.status !== 'ACTIVE')
    fail(403, 'FORBIDDEN', 'Cần tài khoản LEADER ACTIVE.')
}
function owned(trip: TripView | null, actor: Actor): asserts trip is TripView {
  if (!trip) fail(404, 'NOT_FOUND', 'Không tìm thấy Trip.')
  if (trip.creatorId !== actor.id || trip.leaderId !== actor.id) fail(403, 'FORBIDDEN', 'Bạn không sở hữu Trip này.')
  if (trip.tripType !== 'PUBLIC') fail(409, 'INVALID_STATE_TRANSITION', 'CF01 chỉ áp dụng Public Trip.')
}
function version(trip: TripView, expected: number) {
  if (trip.version !== expected) fail(409, 'VERSION_CONFLICT', 'Trip đã thay đổi. Hãy tải lại trước khi tiếp tục.')
}
function draft(trip: TripView) {
  if (trip.status !== 'DRAFT') fail(409, 'INVALID_STATE_TRANSITION', 'Chỉ được chỉnh sửa/publish Trip DRAFT.')
}
function ordered<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  return ids.map((id) => {
    const row = rows.find((r) => r.id === id)
    if (!row) fail(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu đã chọn.')
    return row
  })
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length) fail(400, 'VALIDATION_ERROR', 'Danh sách không được chứa ID trùng.')
}
const publicProjection = (t: TripView) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  destinationId: t.destinationId,
  startAt: t.startAt,
  endAt: t.endAt,
  capacity: t.capacity,
  price: t.price,
  pickupPointId: t.pickupPointId,
  status: t.status,
  publishedAt: t.publishedAt,
})

@Injectable()
export class PublicTripUseCase {
  constructor(@Inject(TRIP_STORE) private readonly store: TripStore) {}
  private write<T>(actor: Actor, id: string | undefined, work: (s: TripSession, trip?: TripView) => Promise<T>) {
    leader(actor)
    return this.store.transaction(actor.id, id, async (s) => {
      leader(await s.actor(actor.id))
      if (!id) return work(s)
      const trip = await s.find(id)
      owned(trip, actor)
      return work(s, trip)
    })
  }
  private async basic(s: TripSession, data: TripInput) {
    const issues = basicIssues(data, new Date())
    if (issues.length) fail(400, 'VALIDATION_ERROR', 'Thông tin Trip không hợp lệ.', issues)
    const destination = await s.destination(data.destinationId)
    if (!destination) fail(404, 'NOT_FOUND', 'Destination không tồn tại.')
    if (destination.status !== 'ACTIVE') fail(400, 'VALIDATION_ERROR', 'Destination không sử dụng được.')
    const pickup = await s.pickup(data.pickupPointId)
    if (!pickup) fail(404, 'NOT_FOUND', 'Điểm tập kết không tồn tại.')
    if (pickup.status !== 'ACTIVE' || (pickup.destinationId && pickup.destinationId !== data.destinationId))
      fail(400, 'VALIDATION_ERROR', 'Điểm tập kết không phù hợp.')
  }
  private async conflict(
    s: TripSession,
    actorId: string,
    data: { startAt: string; endAt: string },
    excludeId?: string,
  ) {
    if ((await s.conflicts(actorId, data.startAt, data.endAt, excludeId)).length)
      fail(409, 'LEADER_SCHEDULE_CONFLICT', 'Lịch Leader trùng với Public Trip khác.')
  }
  create(actor: Actor, data: TripInput) {
    return this.write(actor, undefined, async (s) => {
      await this.basic(s, data)
      await this.conflict(s, actor.id, data)
      return s.create(actor.id, data)
    })
  }
  update(actor: Actor, id: string, expected: number, data: Partial<TripInput>) {
    return this.write(actor, id, async (s, existing) => {
      const trip = existing!
      draft(trip)
      version(trip, expected)
      if (
        data.destinationId &&
        data.destinationId !== trip.destinationId &&
        (trip.checkpoints.length || trip.trails.length)
      )
        fail(409, 'INVALID_STATE_TRANSITION', 'Xóa kế hoạch checkpoint/trail trước khi đổi Destination.')
      const next = { ...trip, ...data }
      if (!next.pickupPointId || !next.price) fail(400, 'VALIDATION_ERROR', 'Cần giá và điểm tập kết.')
      await this.basic(s, { ...next, pickupPointId: next.pickupPointId, price: next.price })
      await this.conflict(s, actor.id, next, id)
      return s.update(id, data)
    })
  }
  setCheckpoints(actor: Actor, id: string, expected: number, ids: string[]) {
    unique(ids)
    return this.write(actor, id, async (s, existing) => {
      const trip = existing!
      draft(trip)
      version(trip, expected)
      const rows = ordered(ids, await s.checkpoints(ids))
      if (rows.some((c) => c.status !== 'ACTIVE' || c.destinationId !== trip.destinationId))
        fail(400, 'VALIDATION_ERROR', 'Checkpoint phải ACTIVE và cùng Destination.')
      return s.replaceCheckpoints(id, rows)
    })
  }
  setTrails(actor: Actor, id: string, expected: number, ids: string[]) {
    unique(ids)
    return this.write(actor, id, async (s, existing) => {
      const trip = existing!
      draft(trip)
      version(trip, expected)
      const found = await s.trails(ids)
      for (const missing of ids.filter((id) => !found.some((t) => t.id === id))) {
        if (await s.isPersonalTrail(missing))
          fail(422, 'INVALID_TRAIL_FOR_TRIP_TYPE', 'Public Trip không sử dụng Personal Trail.')
      }
      const rows = ordered(ids, found)
      if (rows.some((t) => t.status !== 'ACTIVE' || t.destinationId !== trip.destinationId))
        fail(422, 'INVALID_TRAIL_FOR_TRIP_TYPE', 'System Trail phải ACTIVE và cùng Destination.')
      return s.replaceTrails(id, rows)
    })
  }
  private async readinessIn(s: TripSession, trip: TripView): Promise<Readiness> {
    const issues = basicIssues(trip, new Date())
    const add = (field: string, message: string, code = 'TRIP_NOT_READY_TO_PUBLISH') =>
      issues.push({ code, field, message })
    if (trip.status !== 'DRAFT') add('status', 'Trip không còn ở DRAFT.', 'INVALID_STATE_TRANSITION')
    if ((await s.destination(trip.destinationId))?.status !== 'ACTIVE')
      add('destinationId', 'Destination không sử dụng được.')
    const pickup = trip.pickupPointId ? await s.pickup(trip.pickupPointId) : null
    if (!pickup || pickup.status !== 'ACTIVE' || (pickup.destinationId && pickup.destinationId !== trip.destinationId))
      add('pickupPointId', 'Điểm tập kết không hợp lệ.')
    if ((await s.conflicts(trip.leaderId!, trip.startAt, trip.endAt, trip.id)).length)
      add('startAt', 'Lịch Leader bị trùng.', 'LEADER_SCHEDULE_CONFLICT')
    const ids = trip.checkpoints.map((c) => c.sourceCheckpointId).filter((id): id is string => !!id)
    const checkpoints = await s.checkpoints(ids)
    for (const c of trip.checkpoints) {
      const master = checkpoints.find((m) => m.id === c.sourceCheckpointId)
      if (
        !master ||
        master.status !== 'ACTIVE' ||
        master.destinationId !== trip.destinationId ||
        !c.isRequired ||
        !c.isEnabled
      )
        add('checkpoints', 'Checkpoint không còn hợp lệ.')
      else if (!sameCheckpoint(c, master))
        add('checkpoints', 'Checkpoint nguồn thay đổi; hãy chọn lại.', 'PLAN_SOURCE_CHANGED')
    }
    const sources = await s.trails(trip.trails.map((t) => t.systemTrailId))
    for (const t of trip.trails) {
      const master = sources.find((m) => m.id === t.systemTrailId)
      if (!master || master.status !== 'ACTIVE' || master.destinationId !== trip.destinationId)
        add('trails', 'System Trail không còn hợp lệ.', 'INVALID_TRAIL_FOR_TRIP_TYPE')
      else if (
        t.sourceTrailVersion !== master.version ||
        JSON.stringify(t.snapshotCheckpointIds) !== JSON.stringify(master.checkpointIds) ||
        JSON.stringify(t.snapshotGeojson) !== JSON.stringify(master.routeGeojson) ||
        t.snapshotName !== master.name ||
        t.snapshotDifficulty !== master.difficulty ||
        t.snapshotDistanceKm !== master.distanceKm ||
        t.snapshotElevationGainM !== master.elevationGainM
      )
        add('trails', 'Trail nguồn thay đổi; hãy chọn lại.', 'PLAN_SOURCE_CHANGED')
    }
    const routeIds = sources.flatMap((t) => t.checkpointIds)
    const routeCheckpoints = await s.checkpoints([...new Set(routeIds)])
    if (
      routeIds.some(
        (id) =>
          !routeCheckpoints.some((c) => c.id === id && c.status === 'ACTIVE' && c.destinationId === trip.destinationId),
      )
    )
      add('trails', 'Route chứa checkpoint không sử dụng được.')
    if (trip.checkpoints.some((c, i) => c.sequence !== i + 1) || trip.trails.some((t, i) => t.sequence !== i + 1))
      add('sequence', 'Thứ tự kế hoạch không liên tục.')
    issues.push(
      ...routeIssues(
        ids,
        trip.trails.map((t) => ({
          id: t.systemTrailId,
          checkpointIds: Array.isArray(t.snapshotCheckpointIds)
            ? t.snapshotCheckpointIds.filter((v): v is string => typeof v === 'string')
            : [],
        })),
      ),
    )
    return { canPublish: issues.length === 0, issues, version: trip.version }
  }
  publish(actor: Actor, id: string, expected: number) {
    return this.write(actor, id, async (s, existing) => {
      const trip = existing!
      draft(trip)
      version(trip, expected)
      await this.conflict(s, actor.id, trip, id)
      const readiness = await this.readinessIn(s, trip)
      if (!readiness.canPublish) fail(422, 'TRIP_NOT_READY_TO_PUBLISH', 'Trip chưa sẵn sàng publish.', readiness.issues)
      return s.publish(id)
    })
  }
  cancel(actor: Actor, id: string, expected: number, reason: string, evidenceUrls: string[]) {
    return this.write(actor, id, async (s, existing) => {
      const trip = existing!
      version(trip, expected)
      if (!['DRAFT', 'OPEN', 'FULL'].includes(trip.status) || (await s.pendingCancellation(id)))
        fail(409, 'INVALID_STATE_TRANSITION', 'Không thể gửi yêu cầu hủy ở trạng thái này.')
      return s.cancel(id, actor.id, trip.status, reason, evidenceUrls)
    })
  }
  private ownerRead<T>(actor: Actor, id: string, work: (s: TripSession, t: TripView) => Promise<T>) {
    leader(actor)
    return this.store.read(async (s) => {
      const trip = await s.find(id)
      owned(trip, actor)
      return work(s, trip)
    })
  }
  detail(actor: Actor, id: string) {
    return this.ownerRead(actor, id, (_s, t) => Promise.resolve(t))
  }
  readiness(actor: Actor, id: string) {
    return this.ownerRead(actor, id, (s, t) => this.readinessIn(s, t))
  }
  suggestions(actor: Actor, id: string, page: Page) {
    return this.ownerRead(actor, id, async (s, t) => {
      const selectedIds = t.trails.map((p) => p.systemTrailId)
      const last = t.trails.at(-1)?.snapshotCheckpointIds
      const lastId = Array.isArray(last) ? last.at(-1) : undefined
      const required = t.checkpoints.map((c) => c.sourceCheckpointId)
      return (await s.trailCandidates(t.destinationId, page)).map((candidate) => ({
        ...candidate,
        canAppend: !selectedIds.includes(candidate.id) && (!lastId || candidate.checkpointIds[0] === lastId),
        coveredCheckpointIds: candidate.checkpointIds.filter((id) => required.includes(id)),
      }))
    })
  }
  conflicts(actor: Actor, startAt: string, endAt: string, excludeId?: string) {
    leader(actor)
    if (Date.parse(startAt) >= Date.parse(endAt)) fail(400, 'VALIDATION_ERROR', 'startAt phải trước endAt.')
    return this.store.read(async (s) => {
      if (excludeId) owned(await s.find(excludeId), actor)
      const conflicts = await s.conflicts(actor.id, startAt, endAt, excludeId)
      return { hasConflict: !!conflicts.length, conflicts }
    })
  }
  list(actor: Actor, page: Page) {
    leader(actor)
    return this.store.list(actor.id, page)
  }
  async publicList(page: Page) {
    return (await this.store.list(undefined, page)).map(publicProjection)
  }
  async publicDetail(id: string) {
    const trip = await this.store.publicDetail(id)
    if (!trip) fail(404, 'NOT_FOUND', 'Không tìm thấy Public Trip.')
    return publicProjection(trip)
  }
  options(actor: Actor, kind: 'destinations' | 'pickups' | 'checkpoints', page: Page, destinationId?: string) {
    leader(actor)
    return this.store.read(async (s) => {
      if (kind === 'destinations') return s.destinations(page)
      if (!destinationId) fail(400, 'VALIDATION_ERROR', 'Cần destinationId.')
      if ((await s.destination(destinationId))?.status !== 'ACTIVE')
        fail(404, 'NOT_FOUND', 'Destination không sử dụng được.')
      return kind === 'pickups' ? s.pickups(destinationId, page) : s.checkpointOptions(destinationId, page)
    })
  }
  trailDetail(actor: Actor, id: string) {
    leader(actor)
    return this.store.read(async (s) => {
      const [t] = await s.trails([id])
      if (!t || t.status !== 'ACTIVE') fail(404, 'NOT_FOUND', 'Trail không sử dụng được.')
      return t
    })
  }
}
function sameCheckpoint(snapshot: TripView['checkpoints'][number], master: Checkpoint) {
  return (
    snapshot.name === master.name &&
    snapshot.description === master.description &&
    snapshot.latitude === master.latitude &&
    snapshot.longitude === master.longitude &&
    snapshot.radiusMeters === master.defaultRadiusMeters
  )
}
