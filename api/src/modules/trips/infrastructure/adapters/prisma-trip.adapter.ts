import { Injectable } from '@nestjs/common'
import { DifficultyLevel, Prisma } from '@prisma/client'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { OCCUPYING_STATES } from '../../application/trip.policy'
import { evaluateTripPricing } from '../../pricing/pricing-calculator'
import type {
  Checkpoint,
  Json,
  Page,
  Trail,
  TripInput,
  TripSession,
  TripStatus,
  TripStore,
  TripView,
} from '../../application/trip.types'

const include = {
  tripCheckpointsViaTripId: { orderBy: { sequence: 'asc' as const } },
  tripTrailPlansViaTripId: { orderBy: { sequence: 'asc' as const } },
  tripCostPlanViaTripId: {
    include: {
      items: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          stepTiers: { orderBy: { triggerMinPax: 'asc' as const } },
        },
      },
    },
  },
}
type Row = Prisma.TripGetPayload<{ include: typeof include }>
function view(row: Row): TripView {
  const plan = row.tripCostPlanViaTripId
  const activeItems = plan?.items?.filter((i) => i.isEnabled) ?? []
  const includedServices = activeItems.filter((i) => i.includedInPrice).map((i) => i.nameSnapshot)
  const excludedServices = activeItems
    .filter((i) => !i.includedInPrice)
    .map((i) => (i.sourceNote?.trim() ? `${i.nameSnapshot} (${i.sourceNote.trim()})` : i.nameSnapshot))

  return {
    id: row.id,
    tripType: row.tripType,
    creatorId: row.creatorId,
    leaderId: row.leaderId,
    title: row.title,
    description: row.description,
    destinationId: row.destinationId,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    pickupPointId: row.pickupPointId,
    minPax: row.minPax,
    capacity: row.maxPax,
    price: row.pricePerPax?.toString() ?? null,
    priceExplanation: row.priceExplanation,
    costPlanStatus: plan?.status ?? null,
    ...(plan ? { includedServices, excludedServices } : {}),
    status: row.status,
    version: row.version,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    checkpoints: row.tripCheckpointsViaTripId.map((c) => ({
      sourceCheckpointId: c.sourceCheckpointId,
      name: c.name,
      description: c.description,
      latitude: c.latitude.toString(),
      longitude: c.longitude.toString(),
      radiusMeters: c.radiusMeters,
      sequence: c.sequence,
      isRequired: c.isRequired,
      isEnabled: c.isEnabled,
    })),
    trails: row.tripTrailPlansViaTripId.map((t) => ({
      systemTrailId:
        t.systemTrailId ??
        (() => {
          throw new Error('Public trip requires system trail')
        })(),
      sequence: t.sequence,
      snapshotName: t.snapshotName,
      snapshotDifficulty:
        t.snapshotDifficulty ??
        (() => {
          throw new Error('Public trip requires trail difficulty')
        })(),
      snapshotGeojson: t.snapshotGeojson as Json,
      snapshotDistanceKm: t.snapshotDistanceKm?.toString() ?? null,
      snapshotElevationGainM: t.snapshotElevationGainM,
      sourceTrailVersion: t.sourceTrailVersion,
      snapshotCheckpointIds: t.snapshotCheckpointIds as Json,
    })),
  }
}
function checkpoint(row: Prisma.CheckpointGetPayload<object>): Checkpoint {
  return {
    id: row.id,
    destinationId: row.destinationId,
    name: row.name,
    description: row.description,
    latitude: row.latitude.toString(),
    longitude: row.longitude.toString(),
    defaultRadiusMeters: row.defaultRadiusMeters,
    status: row.status,
  }
}
const trailInclude = { trailCheckpointsViaSystemTrailId: { orderBy: { sequence: 'asc' as const } } }
function trail(row: Prisma.SystemTrailGetPayload<{ include: typeof trailInclude }>): Trail {
  return {
    id: row.id,
    destinationId: row.destinationId,
    name: row.name,
    difficulty: row.difficulty,
    status: row.status,
    version: row.version,
    routeGeojson: row.routeGeojson as Json,
    distanceKm: row.distanceKm.toString(),
    elevationGainM: row.elevationGainM,
    checkpointIds: row.trailCheckpointsViaSystemTrailId.map((c) => c.checkpointId),
  }
}
const pagination = (p: Page) => ({ skip: (p.page - 1) * p.pageSize, take: p.pageSize })
function tripData(data: Partial<TripInput>) {
  return {
    title: data.title,
    description: data.description,
    destinationId: data.destinationId,
    startAt: data.startAt ? new Date(data.startAt) : undefined,
    endAt: data.endAt ? new Date(data.endAt) : undefined,
    pickupPointId: data.pickupPointId,
    minPax: data.minPax,
    maxPax: data.capacity,
    pricePerPax: data.price,
    priceExplanation: data.priceExplanation,
  }
}
class Session implements TripSession {
  constructor(private readonly db: Prisma.TransactionClient) {}
  actor(id: string) {
    return this.db.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } })
  }
  async find(id: string) {
    const row = await this.db.trip.findUnique({ where: { id }, include })
    return row ? view(row) : null
  }
  destination(id: string) {
    return this.db.destination.findUnique({ where: { id }, select: { id: true, status: true } })
  }
  pickup(id: string) {
    return this.db.pickupPoint.findUnique({ where: { id }, select: { id: true, destinationId: true, status: true } })
  }
  async checkpoints(ids: string[]) {
    return (await this.db.checkpoint.findMany({ where: { id: { in: ids } } })).map(checkpoint)
  }
  async trails(ids: string[]) {
    return (await this.db.systemTrail.findMany({ where: { id: { in: ids } }, include: trailInclude })).map(trail)
  }
  async isPersonalTrail(id: string) {
    return !!(await this.db.personalTrail.findUnique({ where: { id }, select: { id: true } }))
  }
  destinations(p: Page) {
    return this.db.destination.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
      ...pagination(p),
    })
  }
  pickups(destinationId: string, p: Page) {
    return this.db.pickupPoint.findMany({
      where: { status: 'ACTIVE', OR: [{ destinationId }, { destinationId: null }] },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
      ...pagination(p),
    })
  }
  async checkpointOptions(destinationId: string, p: Page) {
    return (
      await this.db.checkpoint.findMany({
        where: { destinationId, status: 'ACTIVE' },
        orderBy: { id: 'asc' },
        ...pagination(p),
      })
    ).map(checkpoint)
  }
  async trailCandidates(destinationId: string, p: Page) {
    return (
      await this.db.systemTrail.findMany({
        where: { destinationId, status: 'ACTIVE' },
        include: trailInclude,
        orderBy: { id: 'asc' },
        ...pagination(p),
      })
    ).map(trail)
  }
  async conflicts(leaderId: string, startAt: string, endAt: string, excludeId?: string) {
    const rows = await this.db.trip.findMany({
      where: {
        leaderId,
        tripType: 'PUBLIC',
        status: { in: [...OCCUPYING_STATES] },
        id: excludeId ? { not: excludeId } : undefined,
        startAt: { lt: new Date(endAt) },
        endAt: { gt: new Date(startAt) },
      },
      select: { id: true, title: true, status: true, startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    })
    return rows.map((r) => ({ ...r, startAt: r.startAt.toISOString(), endAt: r.endAt.toISOString() }))
  }
  async create(actorId: string, d: TripInput) {
    return view(
      await this.db.trip.create({
        data: {
          ...tripData(d),
          title: d.title,
          destinationId: d.destinationId,
          startAt: new Date(d.startAt),
          endAt: new Date(d.endAt),
          minPax: d.minPax ?? 1,
          maxPax: d.capacity,
          tripType: 'PUBLIC',
          creatorId: actorId,
          leaderId: actorId,
          status: 'DRAFT',
        },
        include,
      }),
    )
  }
  async update(id: string, data: Partial<TripInput>) {
    return view(
      await this.db.trip.update({ where: { id }, data: { ...tripData(data), version: { increment: 1 } }, include }),
    )
  }
  async replaceCheckpoints(id: string, rows: Checkpoint[]) {
    await this.db.tripCheckpoint.deleteMany({ where: { tripId: id } })
    if (rows.length)
      await this.db.tripCheckpoint.createMany({
        data: rows.map((c, index) => ({
          tripId: id,
          sourceCheckpointId: c.id,
          name: c.name,
          description: c.description,
          latitude: c.latitude,
          longitude: c.longitude,
          radiusMeters: c.defaultRadiusMeters,
          isRequired: true,
          isEnabled: true,
          sequence: index + 1,
        })),
      })
    return this.update(id, {})
  }
  async replaceTrails(id: string, rows: Trail[]) {
    await this.db.tripTrailPlan.deleteMany({ where: { tripId: id } })
    if (rows.length)
      await this.db.tripTrailPlan.createMany({
        data: rows.map((t, index) => ({
          tripId: id,
          systemTrailId: t.id,
          sequence: index + 1,
          snapshotName: t.name,
          snapshotDifficulty: t.difficulty as DifficultyLevel,
          snapshotGeojson: t.routeGeojson === null ? Prisma.JsonNull : t.routeGeojson,
          snapshotDistanceKm: t.distanceKm,
          snapshotElevationGainM: t.elevationGainM,
          sourceTrailVersion: t.version,
          snapshotCheckpointIds: t.checkpointIds,
        })),
      })
    return this.update(id, {})
  }
  async publish(id: string) {
    const existing = await this.db.trip.findUnique({ where: { id }, include })
    if (existing?.tripCostPlanViaTripId) {
      const plan = existing.tripCostPlanViaTripId
      await this.db.tripCostPlan.update({
        where: { id: plan.id },
        data: { status: 'PUBLISHED', version: { increment: 1 } },
      })
      const items = plan.items.map((item) => ({
        category: item.category,
        name: item.nameSnapshot,
        kind: item.kind,
        basis: item.basis,
        unitPrice: item.unitPrice.toFixed(0),
        quantity: item.quantity,
        durationUnits: item.durationUnits,
        capacityPerUnit: item.capacityPerUnit,
        extraNonPayingPax: item.extraNonPayingPax,
        includedInPrice: item.includedInPrice,
        isEnabled: item.isEnabled,
        sourceNote: item.sourceNote,
        stepTiers: item.stepTiers.map((t) => ({
          triggerMinPax: t.triggerMinPax,
          triggerMaxPax: t.triggerMaxPax,
          operation: t.operation,
          amount: t.amount.toFixed(0),
          note: t.note,
        })),
      }))
      const feePolicy = {
        policyVersion: plan.policyVersionRef ?? 'fee-2026-v1',
        platformFeeBps: 800,
        paymentFeeBps: 200,
        defaultContingencyBps: 500,
        defaultTargetMarginBps: 1200,
        roundingStepVnd: '10000',
      }
      const evaluation = evaluateTripPricing({
        maxPax: existing.maxPax,
        targetPax: Math.min(plan.targetPax, existing.maxPax),
        targetMarginBps: plan.targetMarginBps,
        contingencyBps: plan.contingencyBps,
        selectedPrice: (plan.selectedPrice ?? existing.pricePerPax)!.toFixed(0),
        selectedMinPax: plan.selectedMinPax ?? existing.minPax,
        items,
        feePolicy,
      })
      await this.db.tripPricingVersion.create({
        data: {
          tripId: id,
          versionNo: 1,
          selectedPrice: plan.selectedPrice ?? existing.pricePerPax!,
          selectedMinPax: plan.selectedMinPax ?? existing.minPax,
          targetPax: plan.targetPax,
          costInputSnapshot: {
            currency: plan.currency,
            targetPax: plan.targetPax,
            targetMarginBps: plan.targetMarginBps,
            contingencyBps: plan.contingencyBps,
            items,
          },
          feeAssumptionSnapshot: evaluation.feePolicy as unknown as Prisma.InputJsonValue,
          pricingResultSnapshot: {
            summary: evaluation.summary,
            riskIntervals: evaluation.riskIntervals,
            scenarios: evaluation.scenarios,
          } as unknown as Prisma.InputJsonValue,
          createdBy: existing.leaderId ?? existing.creatorId,
        },
      })
    }
    return view(
      await this.db.trip.update({
        where: { id },
        data: { status: 'OPEN', publishedAt: new Date(), version: { increment: 1 } },
        include,
      }),
    )
  }
  async pendingCancellation(id: string) {
    return !!(await this.db.tripCancellationRequest.findFirst({
      where: { tripId: id, status: 'PENDING' },
      select: { id: true },
    }))
  }
  async cancel(id: string, actorId: string, previousStatus: TripStatus, reason: string, evidenceUrls: string[]) {
    await this.db.tripCancellationRequest.create({
      data: { tripId: id, requestedBy: actorId, previousTripStatus: previousStatus, reason, evidenceUrls },
    })
    return view(
      await this.db.trip.update({
        where: { id },
        data: { status: 'CANCEL_PENDING', version: { increment: 1 } },
        include,
      }),
    )
  }
}
@Injectable()
export class PrismaTripAdapter implements TripStore {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(actorId: string, tripId: string | undefined, work: (s: TripSession) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id = ${actorId}::uuid FOR UPDATE`
            if (tripId) await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
            return work(new Session(tx))
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
        )
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))
        if (!retryable || attempt >= 2) throw error
      }
    }
  }
  read<T>(work: (s: TripSession) => Promise<T>) {
    return this.prisma.$transaction((tx) => work(new Session(tx)), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    })
  }
  async list(ownerId: string | undefined, p: Page) {
    return (
      await this.prisma.trip.findMany({
        where: {
          tripType: 'PUBLIC',
          ...(ownerId
            ? { creatorId: ownerId, leaderId: ownerId }
            : { status: { in: ['OPEN', 'FULL'] }, publishedAt: { not: null } }),
        },
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pagination(p),
      })
    ).map(view)
  }
  async publicDetail(id: string) {
    const row = await this.prisma.trip.findFirst({
      where: { id, tripType: 'PUBLIC', status: { in: ['OPEN', 'FULL'] }, publishedAt: { not: null } },
      include,
    })
    return row ? view(row) : null
  }
}
