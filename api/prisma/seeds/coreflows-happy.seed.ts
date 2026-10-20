import { config } from 'dotenv'
import { createHash } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { loadBookingPolicySeeds } from './booking-policy.seed'
import { policyContentSchema, PUBLIC_BOOKING_POLICY_CODE } from '../../src/modules/bookings/booking-policy'
import { OCCUPYING_STATES } from '../../src/modules/trips/application/trip.policy'

const SOURCE = 'CF01_CF04_HAPPY_V1'
const DAY = 86400000
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const scenarios = [
  { key: 'PUBLIC_D2', type: 'PUBLIC', days: 2, personal: false, price: 450000 },
  { key: 'PUBLIC_D7', type: 'PUBLIC', days: 7, personal: false, price: 650000 },
  { key: 'PRIVATE_D2', type: 'PRIVATE', days: 2, personal: false, price: 0 },
  { key: 'PRIVATE_D7', type: 'PRIVATE', days: 7, personal: true, price: 0 },
] as const

export type SeedOptions = { batch: string; leaderId?: string; hostId?: string; memberId?: string }

/** Additive fixtures: an existing batch is returned unchanged, never repaired or rescheduled. */
export async function seedCoreflowsHappy(db: PrismaClient, options: SeedOptions) {
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(options.batch)) throw new Error('batch must contain 1–32 letters, digits, _ or -')
  const { batch } = options
  const id = (key: string) => {
    const h = hash(`${SOURCE}:${batch}:${key}`)
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
  }
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${SOURCE}:${batch}`}, 0))::text`
      const previous = await tx.auditLog.findFirst({ where: { action: SOURCE, entityId: id('batch') } })
      if (previous) {
        const stored = previous.newValues as Prisma.JsonObject
        const actors = stored.options as Prisma.JsonObject
        if (
          ['leaderId', 'hostId', 'memberId'].some(
            (key) => (actors[key] ?? null) !== (options[key as keyof SeedOptions] ?? null),
          )
        )
          throw new Error('Batch already exists with different actors; use a new --batch')
        return { action: 'UNCHANGED', ...stored }
      }
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const description = `${SOURCE}:${batch}. Dữ liệu mô phỏng, không dùng dẫn đường thực tế.`
      async function actor(key: string, fullName: string, role: 'LEADER' | 'USER', existingId?: string) {
        if (existingId) {
          const user = await tx.user.findUniqueOrThrow({ where: { id: existingId } })
          if (user.role !== role || user.status !== 'ACTIVE') throw new Error(`${key} must be an ACTIVE ${role}`)
          return user
        }
        return tx.user.create({
          data: {
            id: id(key),
            authUserId: id(`${key}:auth`),
            email: `${batch}.${key}@coreflows.example.test`,
            fullName,
            phone: '0900000000',
            role,
            status: 'ACTIVE',
          },
        })
      }
      const leader = await actor('leader', 'Leader Demo CF01', 'LEADER', options.leaderId)
      const host = await actor('host', 'Chủ nhóm Demo CF03', 'USER', options.hostId)
      const member = await actor('member', 'Thành viên Demo CF04', 'USER', options.memberId)
      const companion = await actor('companion', 'Bạn đồng hành Demo', 'USER')
      const booker = await actor('booker', 'Người đặt Public Demo CF02', 'USER')
      if (host.id === member.id) throw new Error('host-id and member-id must be different users')
      // Public passengers and private members are separate people to avoid overlapping itineraries.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${leader.id}::uuid FOR UPDATE`
      for (const s of scenarios.filter((s) => s.type === 'PUBLIC')) {
        const startAt = new Date(now.getTime() + s.days * DAY)
        if (
          await tx.trip.findFirst({
            where: {
              leaderId: leader.id,
              status: { in: [...OCCUPYING_STATES] },
              startAt: { lt: new Date(startAt.getTime() + 8 * 3600000) },
              endAt: { gt: startAt },
            },
          })
        )
          throw new Error('Leader already has an overlapping trip; select another leader or batch time')
      }
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('booking-policy:PUBLIC_BOOKING_DEFAULT', 0))::text`
      const policies = await tx.bookingPolicy.findMany({
        where: {
          policyCode: PUBLIC_BOOKING_POLICY_CODE,
          isActive: true,
          publishedAt: { not: null },
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
      })
      if (policies.length > 1) throw new Error('Multiple current booking policies')
      let policy = policies[0]
      if (!policy) {
        if (await tx.bookingPolicy.count({ where: { policyCode: PUBLIC_BOOKING_POLICY_CODE } }))
          throw new Error('Publish a current PUBLIC_BOOKING_DEFAULT policy before seeding')
        const template = loadBookingPolicySeeds().find((p) => p.policy_code === PUBLIC_BOOKING_POLICY_CODE)!
        policy = await tx.bookingPolicy.create({
          data: {
            id: id('policy'),
            policyCode: PUBLIC_BOOKING_POLICY_CODE,
            versionNo: 1,
            holdTtlMinutes: template.hold_ttl_minutes,
            cancellationRules: template.cancellation_rules as Prisma.InputJsonValue,
            effectiveFrom: now,
            publishedAt: now,
            isActive: true,
          },
        })
      }
      policyContentSchema.parse({ holdTtlMinutes: policy.holdTtlMinutes, cancellationRules: policy.cancellationRules })
      await tx.destination.create({
        data: {
          id: id('destination'),
          name: `[DEMO ${batch}] Núi Bà Đen`,
          description,
          region: 'SOUTH',
          centerLat: 11.374,
          centerLng: 106.153,
        },
      })
      await tx.pickupPoint.create({
        data: {
          id: id('pickup'),
          destinationId: id('destination'),
          code: `HAPPY_${batch}_PICKUP`,
          name: 'Điểm tập kết demo',
          address: 'Khu vực mô phỏng Núi Bà Đen, Tây Ninh',
          latitude: 11.374,
          longitude: 106.153,
          createdBy: leader.id,
        },
      })
      const points = ['Xuất phát', 'Điểm nghỉ', 'Đỉnh', 'Kết thúc'].map((name, i) => ({
        id: id(`cp${i}`),
        name,
        latitude: 11.374 + i * 0.002,
        longitude: 106.153 + i * 0.002,
      }))
      const geo = { type: 'LineString', coordinates: points.map((p) => [p.longitude, p.latitude]) }
      await tx.checkpoint.createMany({
        data: points.map((p, i) => ({
          ...p,
          destinationId: id('destination'),
          code: `HAPPY_${batch}_CP${i}`,
          description,
          defaultRadiusMeters: 50,
        })),
      })
      await tx.systemTrail.create({
        data: {
          id: id('trail'),
          destinationId: id('destination'),
          code: `HAPPY_${batch}_TRAIL`,
          name: 'Cung đường hệ thống demo',
          description,
          difficulty: 'EASY',
          distanceKm: 1,
          elevationGainM: 100,
          estimatedDurationMinutes: 120,
          routeGeojson: geo,
          price: 0,
          createdBy: leader.id,
        },
      })
      await tx.trailCheckpoint.createMany({
        data: points.map((p, i) => ({
          systemTrailId: id('trail'),
          checkpointId: p.id,
          sequence: i + 1,
          isRequired: true,
        })),
      })
      await tx.trailAccess.create({
        data: {
          userId: host.id,
          systemTrailId: id('trail'),
          sourceType: 'PROMOTION',
          priceSnapshot: 0,
          status: 'ACTIVE',
          activatedAt: now,
        },
      })
      await tx.personalTrail.create({
        data: {
          id: id('personal'),
          userId: host.id,
          destinationId: id('destination'),
          title: 'Cung đường cá nhân demo',
          description,
          difficulty: 'EASY',
          distanceKm: 1,
          elevationGainM: 100,
          routeGeojson: geo,
        },
      })
      await tx.personalCheckpoint.createMany({
        data: points.map((p, i) => ({
          id: id(`personal-cp${i}`),
          personalTrailId: id('personal'),
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          sequence: i + 1,
          radiusMeters: 50,
          info: description,
        })),
      })

      const trips: Prisma.JsonObject[] = []
      for (const s of scenarios) {
        const tripId = id(s.key),
          creatorId = s.type === 'PUBLIC' ? leader.id : host.id
        const startAt = new Date(now.getTime() + s.days * DAY),
          endAt = new Date(startAt.getTime() + 8 * 3600000)
        await tx.trip.create({
          data: {
            id: tripId,
            tripType: s.type,
            title: `[HAPPY ${batch}] ${s.key}`,
            description,
            destinationId: id('destination'),
            pickupPointId: id('pickup'),
            creatorId,
            leaderId: s.type === 'PUBLIC' ? leader.id : null,
            startAt,
            endAt,
            minPax: 1,
            maxPax: 8,
            pricePerPax: s.type === 'PUBLIC' ? s.price : null,
            status: 'OPEN',
            publishedAt: s.type === 'PUBLIC' ? now : null,
            version: s.type === 'PRIVATE' ? 4 : 2,
          },
        })
        const plan = await tx.tripTrailPlan.create({
          data: {
            tripId,
            systemTrailId: s.personal ? null : id('trail'),
            personalTrailId: s.personal ? id('personal') : null,
            sequence: 1,
            snapshotName: s.personal ? 'Cung đường cá nhân demo' : 'Cung đường hệ thống demo',
            snapshotDifficulty: 'EASY',
            snapshotDistanceKm: 1,
            snapshotElevationGainM: 100,
            snapshotGeojson: geo,
            sourceTrailVersion: 1,
            snapshotCheckpointIds: points.map((p, i) => (s.personal ? id(`personal-cp${i}`) : p.id)),
          },
        })
        // CF01 selects an active route at publication; CF03 only creates its route snapshot.
        if (s.type === 'PUBLIC') {
          await tx.tripActiveTrailPlan.create({ data: { tripId, trailPlanId: plan.id, changedBy: creatorId } })
          await tx.tripTransport.create({
            data: {
              tripId,
              pickupPointId: id('pickup'),
              returnPointId: id('pickup'),
              sequence: 1,
              vehicleType: 'Xe 16 chỗ demo',
              seatCapacity: 16,
              driverName: 'Tài xế demo',
              driverPhone: '0900000001',
              meetingAt: new Date(startAt.getTime() - 1800000),
              departureAt: startAt,
              returnAt: endAt,
              note: description,
            },
          })
        }
        await tx.tripCheckpoint.createMany({
          data: points.map((p, i) => ({
            tripId,
            sourceCheckpointId: s.personal ? null : p.id,
            sourcePersonalCheckpointId: s.personal ? id(`personal-cp${i}`) : null,
            name: p.name,
            description,
            latitude: p.latitude,
            longitude: p.longitude,
            sequence: i + 1,
            radiusMeters: 50,
            isRequired: true,
          })),
        })
        const bookings: Prisma.JsonObject[] = []
        if (s.type === 'PUBLIC') {
          // Two paid bookings: one registered passenger, and a group with a registered passenger + guest.
          for (const [n, payer] of [booker, companion].entries()) {
            const bookingId = id(`${s.key}:booking${n}`),
              invoiceId = id(`${s.key}:invoice${n}`),
              paymentId = id(`${s.key}:payment${n}`)
            const count = n === 0 ? 1 : 2,
              amount = count * s.price
            const expiresAt = new Date(now.getTime() + policy.holdTtlMinutes * 60000)
            const confirmationKey = `payment:${paymentId}`
            await tx.booking.create({
              data: {
                id: bookingId,
                tripId,
                userId: payer.id,
                pickupPointId: id('pickup'),
                returnPointId: id('pickup'),
                bookingPolicyId: policy.id,
                status: 'CONFIRMED',
                participantCount: count,
                pricePerPaxSnapshot: s.price,
                subtotalAmount: amount,
                totalAmount: amount,
                policySnapshot: {
                  policyCode: policy.policyCode,
                  versionNo: policy.versionNo,
                  holdTtlMinutes: policy.holdTtlMinutes,
                  cancellationRules: policy.cancellationRules,
                },
                expiresAt,
                confirmedAt: now,
                confirmationIdempotencyKey: confirmationKey,
                version: 2,
              },
            })
            await tx.bookingParticipant.createMany({
              data: Array.from({ length: count }, (_, j) => ({
                bookingId,
                userId: j === 0 ? payer.id : null,
                fullName: j === 0 ? payer.fullName : 'Khách đi cùng demo',
                phone: payer.phone ?? '0900000000',
                status: 'ACTIVE' as const,
                checkinCode: id(`${s.key}:checkin${n}:${j}`),
                checkinStatus: 'NOT_CHECKED_IN' as const,
              })),
            })
            await tx.invoice.create({
              data: {
                id: invoiceId,
                invoiceNo: `HAPPY-${batch}-${s.key}-${n}`,
                userId: payer.id,
                invoiceType: 'BOOKING',
                bookingId,
                revisionNo: 1,
                subtotalAmount: amount,
                totalAmount: amount,
                status: 'PAID',
                expiresAt,
                paidAt: now,
                version: 2,
                invoiceLinesViaInvoiceId: {
                  create: {
                    lineCode: 'TRIP',
                    description: 'Public trip participation (seed demo)',
                    quantity: count,
                    unitAmount: s.price,
                    lineAmount: amount,
                    referenceType: 'Booking',
                    referenceId: bookingId,
                  },
                },
              },
            })
            const payload = {
              schemaVersion: 1,
              source: SOURCE,
              paymentId,
              invoiceId,
              amount: String(amount),
              currency: 'VND',
              status: 'SUCCEEDED',
            }
            await tx.payment.create({
              data: {
                id: paymentId,
                invoiceId,
                amount,
                paymentGateway: 'mock',
                providerEnvironment: 'MOCK',
                merchantAccountKey: 'coreflows-seed',
                merchantRequestRef: paymentId,
                transactionRef: `seed-${paymentId}`,
                requestHash: hash(JSON.stringify(payload)),
                requestHashVersion: 1,
                paymentMethod: 'QR',
                status: 'SUCCEEDED',
                reconcileStatus: 'RESOLVED',
                idempotencyKey: `seed:${paymentId}`,
                gatewayPayload: payload,
                paidAt: now,
                expiresAt,
              },
            })
            await tx.paymentApplication.create({
              data: { paymentId, invoiceId, status: 'APPLIED', appliedAt: now, decidedAt: now },
            })
            await tx.paymentWebhookEvent.create({
              data: {
                paymentGateway: 'mock',
                providerEnvironment: 'MOCK',
                merchantAccountKey: 'coreflows-seed',
                providerEventId: `seed:${paymentId}`,
                paymentId,
                eventKind: 'PAYMENT',
                payload,
                payloadHash: hash(JSON.stringify(payload)),
                processingStatus: 'PROCESSED',
                verifiedAt: now,
                processed: true,
                processedAt: now,
                attemptCount: 1,
              },
            })
            const event = await tx.paymentOutboxEvent.create({
              data: {
                deduplicationKey: `payment:${paymentId}:succeeded:v1`,
                eventType: 'PAYMENT_SUCCEEDED',
                aggregateType: 'Payment',
                aggregateId: paymentId,
                payload,
                status: 'PROCESSED',
                processedAt: now,
              },
            })
            await tx.paymentConsumerReceipt.create({
              data: { eventId: event.id, consumerName: 'booking-payment-application-v1', processedAt: now },
            })
            await tx.bookingOutboxEvent.create({
              data: {
                deduplicationKey: `booking:${bookingId}:confirmed:v1`,
                eventType: 'BOOKING_CONFIRMED',
                aggregateType: 'Booking',
                aggregateId: bookingId,
                payload: {
                  schemaVersion: 1,
                  source: SOURCE,
                  bookingId,
                  tripId,
                  userId: payer.id,
                  paymentId,
                  invoiceId,
                  confirmationIdempotencyKey: confirmationKey,
                  confirmedAt: now.toISOString(),
                },
                status: 'PROCESSED',
                processedAt: now,
              },
            })
            bookings.push({
              bookingId,
              invoiceId,
              paymentId,
              payerId: payer.id,
              participantCount: count,
              totalAmount: amount,
            })
          }
        } else {
          const invite = await tx.privateTripInvite.create({
            data: {
              id: id(`${s.key}:invite`),
              tripId,
              code: `happy-${hash(`${batch}:${s.key}`).slice(0, 32)}`,
              maxUses: 7,
              usedCount: 1,
              expiresAt: new Date(startAt.getTime() - 3600000),
              createdBy: host.id,
            },
          })
          await tx.tripMember.create({ data: { tripId, userId: host.id, role: 'HOST', pickupPointId: id('pickup') } })
          const joined = await tx.tripMember.create({
            data: {
              tripId,
              userId: member.id,
              role: 'MEMBER',
              joinedByInviteId: invite.id,
              pickupPointId: id('pickup'),
            },
          })
          await tx.bookingOutboxEvent.create({
            data: {
              deduplicationKey: `PRIVATE_TRIP_MEMBER_JOINED:${joined.id}:1`,
              eventType: 'PRIVATE_TRIP_MEMBER_JOINED',
              aggregateType: 'PRIVATE_TRIP',
              aggregateId: tripId,
              payload: {
                schemaVersion: 1,
                source: SOURCE,
                tripId,
                tripType: 'PRIVATE',
                memberId: joined.id,
                userId: member.id,
                actorId: member.id,
                memberRole: 'MEMBER',
                previousStatus: null,
                status: 'ACTIVE',
                memberVersion: 1,
                tripVersion: 4,
                inviteId: invite.id,
                rejoined: false,
                occurredAt: now.toISOString(),
              },
              status: 'PROCESSED',
              processedAt: now,
            },
          })
          trips.push({
            scenario: s.key,
            tripId,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            creatorId,
            inviteCode: invite.code,
            hostId: host.id,
            memberId: member.id,
            route: s.personal ? 'PERSONAL' : 'SYSTEM',
          })
        }
        if (s.type === 'PUBLIC')
          trips.push({
            scenario: s.key,
            tripId,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            creatorId,
            bookings,
          })
        await tx.auditLog.create({
          data: {
            userId: creatorId,
            action: 'HAPPY_TRIP_SEEDED',
            entityType: 'Trip',
            entityId: tripId,
            newValues: { source: SOURCE, batch, tripType: s.type },
          },
        })
      }
      const manifest = {
        source: SOURCE,
        batch,
        options: { ...options },
        seededAt: now.toISOString(),
        users: [leader, host, member, companion, booker].map((u) => ({ id: u.id, email: u.email, role: u.role })),
        trips,
      }
      await tx.auditLog.create({
        data: { action: SOURCE, entityType: 'SeedBatch', entityId: id('batch'), newValues: manifest },
      })
      return { action: 'CREATED', ...manifest }
    },
    { timeout: 60000, maxWait: 10000 },
  )
}

if (require.main === module) {
  config({ quiet: true })
  const args = process.argv.slice(2)
  const usage = 'npm run seed:coreflows -- [--batch=NAME] [--leader-id=UUID] [--host-id=UUID] [--member-id=UUID]'
  if (args.includes('--help')) console.log(usage)
  else {
    const db = new PrismaClient()
    const read = (key: string) => args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3)
    const valid =
      args.every((a) => /^--(batch|leader-id|host-id|member-id)=.+$/.test(a)) &&
      new Set(args.map((a) => a.split('=')[0])).size === args.length
    Promise.resolve()
      .then(() => {
        if (!valid) throw new Error(usage)
        return seedCoreflowsHappy(db, {
          batch: read('batch') ?? new Date().toISOString().replace(/[-:.TZ]/g, ''),
          ...(read('leader-id') ? { leaderId: read('leader-id') } : {}),
          ...(read('host-id') ? { hostId: read('host-id') } : {}),
          ...(read('member-id') ? { memberId: read('member-id') } : {}),
        })
      })
      .then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch((error) => {
        console.error(error instanceof Error ? error.message : 'Seed failed')
        process.exitCode = 1
      })
      .finally(() => db.$disconnect())
  }
}
