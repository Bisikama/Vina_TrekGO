import { config } from 'dotenv'
import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { basicIssues, routeIssues, OCCUPYING_STATES } from '../../src/modules/trips/application/trip.policy'
import {
  policyContentSchema,
  PUBLIC_BOOKING_POLICY_CODE,
  refundPercentAt,
} from '../../src/modules/bookings/booking-policy'

config({ quiet: true })
const MARKER = 'CF02_SEED_V1'
const DEMO = `${MARKER}: Dữ liệu mô phỏng để test booking/payment; không dùng tuyến đường này để trekking thực tế.`
const scenarios = [
  { key: 'MOCK', hours: 240, capacity: 12, price: 10000, name: 'Thanh toán giả lập / hoàn 100%' },
  { key: 'MOMO', hours: 288, capacity: 12, price: 10000, name: 'MoMo sandbox / hoàn 100%' },
  { key: 'REFUND80', hours: 120, capacity: 12, price: 20000, name: 'Hủy từ 72 đến dưới 168 giờ / hoàn 80%' },
  { key: 'REFUND50', hours: 48, capacity: 12, price: 20000, name: 'Hủy từ 24 đến dưới 72 giờ / hoàn 50%' },
  { key: 'REFUND0', hours: 12, capacity: 12, price: 10000, name: 'Hủy dưới 24 giờ / hoàn 0%' },
  { key: 'LAST_SEAT', hours: 360, capacity: 1, price: 10000, name: 'Chỉ 1 chỗ / test tranh chỗ và hết hạn' },
]
function seedId(batch: string, key: string) {
  const h = createHash('sha256').update(`${MARKER}:${batch}:${key}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

async function main() {
  const args = process.argv.slice(2)
  const usage = 'npm run seed:cf02 -- [--dry-run|--validate-only] [--leader-id=users.id] [--batch=NAME]'
  if (args.includes('--help')) {
    console.log(usage)
    return
  }
  if (
    args.some((a) => !['--dry-run', '--validate-only'].includes(a) && !/^--(leader-id|batch)=/.test(a)) ||
    args.filter((a) => a.startsWith('--leader-id=')).length > 1 ||
    args.filter((a) => a.startsWith('--batch=')).length > 1 ||
    (args.includes('--dry-run') && args.includes('--validate-only'))
  )
    throw new Error(usage)
  const leaderId = args.find((a) => a.startsWith('--leader-id='))?.slice(12)
  if (leaderId && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(leaderId))
    throw new Error('leader-id must be users.id UUID')
  const batch =
    args.find((a) => a.startsWith('--batch='))?.slice(8) ??
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(batch)) throw new Error('batch: 1–32 letters, digits, underscore or hyphen')
  const id = (key: string) => seedId(batch, key)
  const checkpoints = ['Xuất phát', 'Đích'].map((name, i) => ({
    id: id(`cp${i}`),
    destinationId: id('destination'),
    code: `CF02_${batch}_CP${i}`,
    name: `[DEMO CF02] ${name}`,
    description: DEMO,
    latitude: 11.374 + i * 0.003,
    longitude: 106.153 + i * 0.003,
    defaultRadiusMeters: 50,
    status: 'ACTIVE' as const,
  }))
  const geo = { type: 'LineString', coordinates: checkpoints.map((c) => [c.longitude, c.latitude]) }
  const route = routeIssues(
    checkpoints.map((c) => c.id),
    [{ id: id('trail'), checkpointIds: checkpoints.map((c) => c.id) }],
  )
  if (route.length) throw new Error(route[0].message)
  if (args.includes('--validate-only')) {
    console.log(JSON.stringify({ valid: true, batch, scenarios, databaseAccess: false }, null, 2))
    return
  }
  const dryRun = args.includes('--dry-run')
  const db = new PrismaClient()
  try {
    const output = await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${MARKER}:${batch}`}, 0))::text`
        const existing = await tx.trip.findMany({ where: { id: { in: scenarios.map((s) => id(s.key)) } } })
        const selectedLeader = leaderId ?? existing[0]?.leaderId
        const leaders = await tx.user.findMany({
          where: { role: 'LEADER', status: 'ACTIVE', ...(selectedLeader ? { id: selectedLeader } : {}) },
          select: { id: true },
          take: 2,
        })
        if (leaders.length !== 1)
          throw new Error(
            'Specify an existing ACTIVE LEADER using --leader-id=users.id. No user/role is created or changed.',
          )
        const actorId = leaders[0].id
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${actorId}::uuid FOR UPDATE`
        const lockedLeader = await tx.user.findUniqueOrThrow({ where: { id: actorId } })
        if (lockedLeader.role !== 'LEADER' || lockedLeader.status !== 'ACTIVE')
          throw new Error('Leader is no longer ACTIVE')
        await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended('booking-policy:PUBLIC_BOOKING_DEFAULT', 0))::text`
        const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
        const policies = await tx.bookingPolicy.findMany({
          where: {
            policyCode: PUBLIC_BOOKING_POLICY_CODE,
            isActive: true,
            publishedAt: { not: null },
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
        })
        if (policies.length !== 1)
          throw new Error('Publish exactly one valid PUBLIC_BOOKING_DEFAULT policy first; seeder never changes policy.')
        const policy = policies[0]
        policyContentSchema.parse({
          holdTtlMinutes: policy.holdTtlMinutes,
          cancellationRules: policy.cancellationRules,
        })
        const anchor = existing[0]
        const origin = anchor
          ? new Date(anchor.startAt.getTime() - scenarios.find((s) => id(s.key) === anchor.id)!.hours * 3600000)
          : now
        const planned = scenarios.map((s) => ({
          ...s,
          id: id(s.key),
          startAt: new Date(origin.getTime() + s.hours * 3600000),
          endAt: new Date(origin.getTime() + (s.hours + 3) * 3600000),
        }))
        const busy = await tx.trip.findMany({
          where: { leaderId: actorId, tripType: 'PUBLIC', status: { in: [...OCCUPYING_STATES] }, endAt: { gt: now } },
          select: { startAt: true, endAt: true },
        })
        for (const trip of [...planned].sort((a, b) => a.hours - b.hours)) {
          const old = existing.find((t) => t.id === trip.id)
          if (old) {
            if (
              old.creatorId !== actorId ||
              old.leaderId !== actorId ||
              old.tripType !== 'PUBLIC' ||
              old.destinationId !== id('destination') ||
              !old.description?.startsWith(MARKER)
            )
              throw new Error(`ID collision or edited ownership: ${trip.id}; nothing overwritten`)
            continue
          }
          const issues = basicIssues(
            {
              startAt: trip.startAt.toISOString(),
              endAt: trip.endAt.toISOString(),
              capacity: trip.capacity,
              price: String(trip.price),
            },
            now,
          )
          if (issues.length)
            throw new Error('Seed dates have expired; use a new --batch instead of changing existing trips')
          const targetRefund = refundPercentAt({ cancellationRules: policy.cancellationRules }, trip.startAt, now)
          for (const interval of busy.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
            if (interval.startAt < trip.endAt && interval.endAt > trip.startAt) {
              trip.startAt = new Date(interval.endAt.getTime() + 3600000)
              trip.endAt = new Date(trip.startAt.getTime() + 3 * 3600000)
            }
          }
          if (refundPercentAt({ cancellationRules: policy.cancellationRules }, trip.startAt, now) !== targetRefund)
            throw new Error(
              `No later free slot within the same refund tier for ${trip.key}; choose another leader. Existing schedule is preserved.`,
            )
          busy.push({ startAt: trip.startAt, endAt: trip.endAt })
        }
        // Creation is all-or-nothing. A complete existing batch is read only, preserving bookings and date/price edits.
        if (existing.length > 0 && existing.length !== scenarios.length)
          throw new Error('Incomplete batch; use a new --batch. No partial repair or overwrite.')
        if (!existing.length && !dryRun) {
          await tx.destination.create({
            data: {
              id: id('destination'),
              name: `[DEMO CF02 ${batch}] Núi Bà Đen`,
              description: DEMO,
              region: 'SOUTH',
              centerLat: 11.374,
              centerLng: 106.153,
              status: 'ACTIVE',
            },
          })
          await tx.pickupPoint.create({
            data: {
              id: id('pickup'),
              destinationId: id('destination'),
              code: `CF02_${batch}_PICKUP`,
              name: `[DEMO CF02] Điểm tập kết ${batch}`,
              address: 'Địa chỉ mô phỏng CF02',
              latitude: 11.374,
              longitude: 106.153,
              note: DEMO,
              status: 'ACTIVE',
              createdBy: actorId,
            },
          })
          await tx.checkpoint.createMany({ data: checkpoints })
          await tx.systemTrail.create({
            data: {
              id: id('trail'),
              destinationId: id('destination'),
              code: `CF02_${batch}_TRAIL`,
              name: `[DEMO CF02] Tuyến mẫu ${batch}`,
              description: DEMO,
              difficulty: 'EASY',
              distanceKm: 0.5,
              elevationGainM: 0,
              estimatedDurationMinutes: 60,
              routeGeojson: geo,
              price: 0,
              status: 'ACTIVE',
              createdBy: actorId,
            },
          })
          await tx.trailCheckpoint.createMany({
            data: checkpoints.map((c, i) => ({
              systemTrailId: id('trail'),
              checkpointId: c.id,
              sequence: i + 1,
              isRequired: true,
            })),
          })
          for (const trip of planned) {
            await tx.trip.create({
              data: {
                id: trip.id,
                tripType: 'PUBLIC',
                title: `[DEMO CF02 ${batch}] ${trip.name}`,
                description: DEMO,
                destinationId: id('destination'),
                pickupPointId: id('pickup'),
                creatorId: actorId,
                leaderId: actorId,
                startAt: trip.startAt,
                endAt: trip.endAt,
                minPax: 1,
                maxPax: trip.capacity,
                pricePerPax: trip.price,
                status: 'OPEN',
                publishedAt: now,
              },
            })
            await tx.tripCheckpoint.createMany({
              data: checkpoints.map((c, i) => ({
                tripId: trip.id,
                sourceCheckpointId: c.id,
                name: c.name,
                description: c.description,
                latitude: c.latitude,
                longitude: c.longitude,
                radiusMeters: c.defaultRadiusMeters,
                sequence: i + 1,
                isRequired: true,
                isEnabled: true,
              })),
            })
            const plan = await tx.tripTrailPlan.create({
              data: {
                tripId: trip.id,
                systemTrailId: id('trail'),
                sequence: 1,
                snapshotName: `[DEMO CF02] Tuyến mẫu ${batch}`,
                snapshotDifficulty: 'EASY',
                snapshotGeojson: geo,
                snapshotDistanceKm: 0.5,
                snapshotElevationGainM: 0,
                sourceTrailVersion: 1,
                snapshotCheckpointIds: checkpoints.map((c) => c.id),
              },
            })
            await tx.tripActiveTrailPlan.create({ data: { tripId: trip.id, trailPlanId: plan.id, changedBy: actorId } })
            await tx.tripTransport.create({
              data: {
                tripId: trip.id,
                pickupPointId: id('pickup'),
                sequence: 1,
                vehicleType: 'Xe demo CF02',
                seatCapacity: trip.capacity,
                plateNumber: 'DEMO-CF02',
                driverName: 'Tài xế mô phỏng',
                driverPhone: '0000000000',
                meetingAt: new Date(trip.startAt.getTime() - 1800000),
                departureAt: trip.startAt,
                returnAt: trip.endAt,
                note: DEMO,
              },
            })
            await tx.auditLog.create({
              data: {
                action: 'CF02_DEMO_TRIP_SEEDED',
                entityType: 'Trip',
                entityId: trip.id,
                newValues: { source: MARKER, batch, leaderId: actorId },
              },
            })
          }
        }
        return {
          batch,
          leaderId: actorId,
          action: existing.length ? 'UNCHANGED' : dryRun ? 'WOULD_CREATE' : 'CREATED',
          destinationId: id('destination'),
          policyCode: policy.policyCode,
          policyVersion: policy.versionNo,
          holdTtlMinutes: policy.holdTtlMinutes,
          trips: planned.map((p) => {
            const row = existing.find((t) => t.id === p.id)
            const start = row?.startAt ?? p.startAt
            return {
              scenario: p.key,
              id: p.id,
              startAt: start.toISOString(),
              status: row?.status ?? 'OPEN',
              pricePerPax: row?.pricePerPax?.toFixed() ?? String(p.price),
              maxPax: row?.maxPax ?? p.capacity,
              refundPercentNow: refundPercentAt({ cancellationRules: policy.cancellationRules }, start, now),
              detailUrl: `/api/v1/trips/${p.id}`,
              expired: start <= now,
            }
          }),
        }
      },
      { timeout: 60000, maxWait: 10000 },
    )
    console.log(JSON.stringify(output, null, 2))
  } finally {
    await db.$disconnect()
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'CF02 seed failed')
  process.exitCode = 1
})
