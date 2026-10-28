import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { DemoConfig, SOURCE, DAY, scenarios, startTime, demoPricing } from './booking-demo.config'
import { policyContentSchema, PUBLIC_BOOKING_POLICY_CODE } from '../../src/modules/bookings/booking-policy'
import { publicInvitationExpiry } from '../../src/modules/bookings/public-invitation.policy'
import { privateInvitationExpiry } from '../../src/modules/trips/application/private-invitation.policy'
import { OCCUPYING_STATES } from '../../src/modules/trips/application/trip.policy'
import { paymentHash } from '../../src/modules/payments/payment-utils'

type DB = Prisma.TransactionClient
export const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
const fail = (message: string): never => {
  throw new Error(message)
}

export async function preflight(db: DB, config: DemoConfig, now: Date, oldTrips: string[]) {
  const users = await db.user.findMany({ where: { id: { in: Object.values(config.actors) } } })
  const actors = Object.fromEntries(
    Object.entries(config.actors).map(([key, id]) => {
      const user = users.find((u) => u.id === id)
      const role = key === 'admin' ? 'ADMIN' : key === 'leader' ? 'LEADER' : 'USER'
      if (!user || user.status !== 'ACTIVE' || user.role !== role)
        fail(`${key} must reference an existing ACTIVE ${role}`)
      return [key, user!]
    }),
  ) as Record<keyof DemoConfig['actors'], (typeof users)[number]>
  // Read-only identity check: no Auth admin calls and no fabricated auth_user_id.
  const auth = await db.$queryRaw<
    { id: string }[]
  >`SELECT id FROM auth.users WHERE id=ANY(${users.map((u) => u.authUserId)}::uuid[])`
  if (auth.length !== users.length) fail('All configured users must have an existing Supabase Auth identity')
  const policies = await db.bookingPolicy.findMany({
    where: {
      policyCode: PUBLIC_BOOKING_POLICY_CODE,
      isActive: true,
      publishedAt: { not: null },
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
  })
  if (policies.length !== 1) fail('Exactly one published, effective PUBLIC_BOOKING_DEFAULT policy is required')
  const policy = policies[0]
  policyContentSchema.parse({ holdTtlMinutes: policy.holdTtlMinutes, cancellationRules: policy.cancellationRules })
  const routes = await Promise.all(
    scenarios.map(async (s) => {
      const ref = config.routes[s.key]
      const destination = await db.destination.findUniqueOrThrow({ where: { id: ref.destinationId } })
      const trail = await db.systemTrail.findUniqueOrThrow({ where: { id: ref.systemTrailId } })
      const pickup = await db.pickupPoint.findUniqueOrThrow({ where: { id: ref.pickupPointId } })
      const back = await db.pickupPoint.findUniqueOrThrow({ where: { id: ref.returnPointId } })
      const points = await db.trailCheckpoint.findMany({
        where: { systemTrailId: trail.id },
        include: { checkpoint: true },
        orderBy: { sequence: 'asc' },
      })
      if (
        destination.status !== 'ACTIVE' ||
        trail.status !== 'ACTIVE' ||
        trail.archivedAt ||
        trail.destinationId !== destination.id ||
        !trail.routeGeojson ||
        !points.length ||
        !points.some((p) => p.isRequired) ||
        new Set(points.map((p) => p.checkpointId)).size !== points.length ||
        points.some((p) => p.checkpoint.status !== 'ACTIVE' || p.checkpoint.destinationId !== destination.id) ||
        [pickup, back].some((p) => p.status !== 'ACTIVE' || (p.destinationId && p.destinationId !== destination.id))
      )
        fail(`${s.key}: invalid/incomplete active source route or pickup points`)
      // Private creation requires destination-specific pickup, unlike public pickup discovery.
      if (s.type === 'PRIVATE' && pickup.destinationId !== destination.id)
        fail(`${s.key}: private pickup must belong to destination`)
      if (
        s.type === 'PRIVATE' &&
        !(await db.trailAccess.findFirst({
          where: {
            userId: actors.host.id,
            systemTrailId: trail.id,
            status: 'ACTIVE',
            revokedAt: null,
          },
        }))
      )
        fail(`${s.key}: host needs existing ACTIVE trail_access`)
      const startAt = startTime(now, s.days)
      const endAt = new Date(+startAt + Math.max(480, trail.estimatedDurationMinutes ?? 0) * 60000)
      const actorIds =
        s.type === 'PUBLIC'
          ? [actors.leader.id, actors.booker1.id, actors.booker2.id, actors.claimedMember.id, actors.invitedMember.id]
          : [actors.host.id, actors.claimedMember.id, actors.invitedMember.id]
      const overlap = await db.trip.findFirst({
        where: {
          id: { notIn: oldTrips },
          status: { in: [...OCCUPYING_STATES] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
          OR: [
            { leaderId: { in: actorIds } },
            { creatorId: { in: actorIds } },
            { tripMembersViaTripId: { some: { userId: { in: actorIds }, status: 'ACTIVE' } } },
            {
              bookingsViaTripId: {
                some: {
                  status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN'] },
                  bookingParticipantsViaBookingId: { some: { userId: { in: actorIds }, status: 'ACTIVE' } },
                },
              },
            },
          ],
        },
      })
      if (overlap) fail(`${s.key}: actor schedule overlaps trip ${overlap.id}`)
      return { scenario: s, destination, trail, pickup, back, points, startAt, endAt }
    }),
  )
  for (let i = 0; i < routes.length; i++)
    for (let j = i + 1; j < routes.length; j++) {
      if (routes[i].startAt < routes[j].endAt && routes[j].startAt < routes[i].endAt)
        fail('Configured trail durations make demo scenarios overlap')
    }
  const profile = await db.leaderProfile.findUnique({ where: { userId: actors.leader.id } })
  if (profile && profile.verifyStatus !== 'APPROVED')
    fail('Existing leader profile is not approved; do not overwrite real state')
  const applications = await db.leaderApplication.findMany({
    where: { userId: actors.leader.id },
    include: { leaderCertificatesViaApplicationId: true },
  })
  if (applications.some((a) => ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'].includes(a.status)))
    fail('Leader has an unfinished application; resolve on web before seeding')
  const today = new Date(+now + 7 * 3600000).toISOString().slice(0, 10)
  const approved = applications.find(
    (a) =>
      a.status === 'APPROVED' &&
      a.leaderCertificatesViaApplicationId.some(
        (c) =>
          c.status === 'VERIFIED' &&
          c.mediaAssetId &&
          (!c.issuedAt || c.issuedAt.toISOString().slice(0, 10) <= today) &&
          (!c.expiresAt || c.expiresAt.toISOString().slice(0, 10) >= today),
      ),
  )
  if (!approved && applications.length)
    fail('Existing leader application lacks valid verified media; repair on web rather than overwrite')
  if (!approved) {
    if (!config.certificateMediaId) fail('certificateMediaId is required to supplement missing leader application')
    const media = await db.mediaAsset.findUniqueOrThrow({
      where: { id: config.certificateMediaId! },
      include: { leaderCertificate: true },
    })
    if (
      media.ownerUserId !== actors.leader.id ||
      media.scope !== 'LEADER_CERTIFICATE' ||
      media.status !== 'READY' ||
      media.deliveryType !== 'authenticated' ||
      !media.providerAssetId ||
      !media.providerPublicId ||
      !['jpg', 'jpeg', 'png', 'pdf'].includes(media.format ?? '') ||
      media.leaderCertificate ||
      media.retentionUntil
    )
      fail(
        'Certificate media must be an existing retained READY authenticated document owned by leader, not already linked',
      )
  }
  for (const s of scenarios.filter((s) => s.type === 'PUBLIC')) demoPricing(s.capacity)
  return { actors, policy, routes, profile, approved }
}

export async function createFixtures(
  db: DB,
  config: DemoConfig,
  ctx: Awaited<ReturnType<typeof preflight>>,
  now: Date,
  runId: string,
) {
  const { actors, policy } = ctx
  const trips: { id: string; scenario: string; startAt: string; endAt: string; status: string }[] = []
  const eventIds: string[] = []
  const paymentEventIds: string[] = []
  const audit = async (action: string, entityType: string, entityId: string, userId: string, values: any) =>
    db.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        newValues: json({ ...values, seedSource: SOURCE, batch: config.batch, runId }),
      },
    })
  const event = async (eventType: string, aggregateId: string, key: string, payload: any) => {
    const e = await db.bookingOutboxEvent.create({
      data: {
        eventType,
        aggregateType: eventType.startsWith('PRIVATE_') ? 'PRIVATE_TRIP' : 'Booking',
        aggregateId,
        deduplicationKey: key,
        payload: json({ schemaVersion: 1, ...payload, source: SOURCE, runId }),
        status: 'PROCESSED',
        processedAt: now,
      },
    })
    eventIds.push(e.id)
    return e
  }
  if (!ctx.approved) {
    const app = await db.leaderApplication.create({
      data: {
        userId: actors.leader.id,
        status: 'APPROVED',
        motivation: `[DEMO ${config.batch}] Hồ sơ phục vụ trình diễn`,
        experienceSummary: 'Kinh nghiệm dẫn đoàn demo',
        submittedAt: new Date(+now - DAY),
        reviewedAt: now,
        reviewedBy: actors.admin.id,
        version: 2,
        leaderCertificatesViaApplicationId: {
          create: {
            userId: actors.leader.id,
            certificateType: 'FIRST_AID',
            certificateNumber: `DEMO-${runId.slice(0, 8)}`,
            issuer: 'Chứng chỉ demo, không dùng xác minh thực tế',
            mediaAssetId: config.certificateMediaId!,
            fileUrl: `media:${config.certificateMediaId}`,
            issuedAt: new Date(+now - 30 * DAY),
            expiresAt: new Date(+now + 365 * DAY),
            status: 'VERIFIED',
            verifiedAt: now,
            verifiedBy: actors.admin.id,
          },
        },
      },
    })
    await audit('DEMO_LEADER_SUPPLEMENTED', 'LeaderApplication', app.id, actors.admin.id, {})
  }
  if (!ctx.profile)
    await db.leaderProfile.create({
      data: {
        userId: actors.leader.id,
        verifyStatus: 'APPROVED',
        verifiedBy: actors.admin.id,
        verifiedAt: now,
        experienceYears: 3,
        completedTripCount: 0,
      },
    })

  for (const r of ctx.routes) {
    const s = r.scenario,
      pub = s.type === 'PUBLIC',
      pricing = pub ? demoPricing(s.capacity) : null
    const creatorId = pub ? actors.leader.id : actors.host.id
    const trip = await db.trip.create({
      data: {
        tripType: s.type,
        title: `[DEMO ${config.batch}] ${r.destination.name} · ${s.key}`,
        description: 'Chuyến đi minh họa booking; tuyến đường lấy từ dữ liệu quản trị đã nhập.',
        destinationId: r.destination.id,
        pickupPointId: r.pickup.id,
        creatorId,
        leaderId: pub ? creatorId : null,
        startAt: r.startAt,
        endAt: r.endAt,
        registrationOpenAt: pub ? now : null,
        registrationDeadlineAt: pub ? new Date(+r.startAt - 2 * DAY) : null,
        minPax: pub ? 2 : 1,
        maxPax: s.capacity,
        pricePerPax: pub ? 450000 : null,
        priceExplanation: pricing?.evaluation.generatedPriceExplanation,
        status: s.key === 'PUBLIC_D28' ? 'FULL' : 'OPEN',
        publishedAt: pub ? now : null,
        version: 2,
      },
    })
    const plan = await db.tripTrailPlan.create({
      data: {
        tripId: trip.id,
        systemTrailId: r.trail.id,
        sequence: 1,
        snapshotName: r.trail.name,
        snapshotDifficulty: r.trail.difficulty,
        snapshotGeojson: json(r.trail.routeGeojson),
        snapshotDistanceKm: r.trail.distanceKm,
        snapshotElevationGainM: r.trail.elevationGainM,
        sourceTrailVersion: r.trail.version,
        snapshotCheckpointIds: r.points.map((p) => p.checkpointId),
      },
    })
    await db.tripCheckpoint.createMany({
      data: r.points.map((p, i) => ({
        tripId: trip.id,
        sourceCheckpointId: p.checkpointId,
        name: p.checkpoint.name,
        description: p.checkpoint.description,
        latitude: p.checkpoint.latitude,
        longitude: p.checkpoint.longitude,
        radiusMeters: p.checkpoint.defaultRadiusMeters,
        sequence: i + 1,
        isRequired: p.isRequired,
      })),
    })
    if (pub && pricing) {
      await db.tripActiveTrailPlan.create({ data: { tripId: trip.id, trailPlanId: plan.id, changedBy: creatorId } })
      await db.tripTransport.create({
        data: {
          tripId: trip.id,
          pickupPointId: r.pickup.id,
          returnPointId: r.back.id,
          sequence: 1,
          sourceType: 'THIRD_PARTY',
          vehicleType: 'Xe du lịch demo',
          seatCapacity: 16,
          providerName: 'Đơn vị vận chuyển demo',
          driverName: 'Tài xế demo',
          driverPhone: '0900000001',
          meetingAt: new Date(+r.startAt - 1800000),
          departureAt: r.startAt,
          returnAt: r.endAt,
        },
      })
      await db.tripCostPlan.create({
        data: {
          tripId: trip.id,
          targetPax: s.capacity,
          selectedPrice: 450000,
          selectedMinPax: 2,
          targetMarginBps: 1200,
          contingencyBps: 500,
          status: 'PUBLISHED',
          version: 2,
          policyVersionRef: pricing.input.feePolicy.policyVersion,
          items: {
            create: pricing.input.items.map((item, i) => ({
              category: item.category,
              nameSnapshot: item.name,
              kind: item.kind,
              basis: item.basis,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              durationUnits: item.durationUnits,
              extraNonPayingPax: item.extraNonPayingPax,
              includedInPrice: item.includedInPrice,
              isEnabled: true,
              sortOrder: i,
            })),
          },
        },
      })
      await db.tripPricingVersion.create({
        data: {
          tripId: trip.id,
          versionNo: 1,
          selectedPrice: 450000,
          selectedMinPax: 2,
          targetPax: s.capacity,
          costInputSnapshot: json(pricing.input.items),
          feeAssumptionSnapshot: json(pricing.input.feePolicy),
          pricingResultSnapshot: json({
            summary: pricing.evaluation.summary,
            riskIntervals: pricing.evaluation.riskIntervals,
            scenarios: pricing.evaluation.scenarios,
          }),
          createdBy: creatorId,
          publishedAt: now,
        },
      })
      const groups =
        s.key === 'PUBLIC_D7' ? [] : s.key === 'PUBLIC_D14' ? [1, 3] : s.key === 'PUBLIC_D21' ? [3] : [3, 3]
      for (const [n, count] of groups.entries()) {
        const payer = n === 0 ? actors.booker1 : actors.booker2
        const bookingId = randomUUID(),
          invoiceId = randomUUID(),
          paymentId = randomUUID(),
          amount = count * 450000
        const expiresAt = new Date(+now + policy.holdTtlMinutes * 60000)
        const confirmationKey = `payment:${paymentId}`
        await db.booking.create({
          data: {
            id: bookingId,
            tripId: trip.id,
            userId: payer.id,
            pickupPointId: r.pickup.id,
            returnPointId: r.back.id,
            bookingPolicyId: policy.id,
            status: 'CONFIRMED',
            participantCount: count,
            pricePerPaxSnapshot: 450000,
            subtotalAmount: amount,
            totalAmount: amount,
            policySnapshot: json({
              policyCode: policy.policyCode,
              versionNo: policy.versionNo,
              holdTtlMinutes: policy.holdTtlMinutes,
              cancellationRules: policy.cancellationRules,
              noShowRules: policy.noShowRules,
              participantRules: policy.participantRules,
            }),
            expiresAt,
            confirmedAt: now,
            confirmationIdempotencyKey: confirmationKey,
            version: 2,
          },
        })
        for (let j = 0; j < count; j++) {
          const claimed = s.key === 'PUBLIC_D21' && j === 1,
            pending = s.key === 'PUBLIC_D21' && j === 2
          const user = j === 0 ? payer : claimed ? actors.claimedMember : null
          const participant = await db.bookingParticipant.create({
            data: {
              bookingId,
              userId: user?.id ?? null,
              fullName: user?.fullName ?? (pending ? actors.invitedMember.fullName : `Khách demo ${n + 1}.${j + 1}`),
              phone: user?.phone ?? '0900000000',
              emergencyContactName: 'Liên hệ demo',
              emergencyContactPhone: '0900000002',
              status: 'ACTIVE',
              checkinCode: randomUUID(),
              checkinStatus: 'NOT_CHECKED_IN',
            },
          })
          if (claimed || pending) {
            const recipient = claimed ? actors.claimedMember : actors.invitedMember
            const invitation = await db.bookingParticipantInvitation.create({
              data: {
                bookingParticipantId: participant.id,
                senderUserId: payer.id,
                recipientUserId: recipient.id,
                recipientEmailSnapshot: recipient.email.trim().toLowerCase(),
                status: claimed ? 'ACCEPTED' : 'PENDING',
                respondedAt: claimed ? now : null,
                version: claimed ? 2 : 1,
                expiresAt: publicInvitationExpiry(now, trip.startAt),
              },
            })
            const eventType = claimed ? 'PUBLIC_PARTICIPANT_CLAIMED' : 'PUBLIC_PARTICIPANT_INVITED'
            await event(eventType, bookingId, `${eventType}:${invitation.id}:${invitation.version}`, {
              invitationId: invitation.id,
              participantId: participant.id,
              bookingId,
              tripId: trip.id,
              buyerUserId: payer.id,
              senderUserId: payer.id,
              recipientUserId: recipient.id,
              status: invitation.status,
              version: invitation.version,
            })
            await audit(eventType, 'BookingParticipantInvitation', invitation.id, claimed ? recipient.id : payer.id, {
              bookingId,
              participantId: participant.id,
              tripId: trip.id,
              status: invitation.status,
            })
          }
        }
        await db.invoice.create({
          data: {
            id: invoiceId,
            invoiceNo: `DEMO-${runId.slice(0, 8)}-${s.key}-${n}`,
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
                description: 'Vé tham gia chuyến trekking demo',
                quantity: count,
                unitAmount: 450000,
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
          runId,
          paymentId,
          invoiceId,
          amount: String(amount),
          currency: 'VND',
          status: 'SUCCEEDED',
        }
        await db.payment.create({
          data: {
            id: paymentId,
            invoiceId,
            amount,
            paymentGateway: 'mock',
            providerEnvironment: 'MOCK',
            merchantAccountKey: 'trekgo-mock-v1',
            merchantRequestRef: paymentId,
            transactionRef: `mock:${paymentId}`,
            requestHash: hash(payload),
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
        await db.paymentApplication.create({
          data: { paymentId, invoiceId, status: 'APPLIED', appliedAt: now, decidedAt: now },
        })
        const scope = { gateway: 'mock', environment: 'MOCK', merchantAccountKey: 'trekgo-mock-v1' }
        const request = {
          ...scope,
          merchantRequestRef: paymentId,
          amount: String(amount),
          currency: 'VND',
          paymentMethod: 'QR',
          expiresAt: expiresAt.toISOString(),
        }
        await db.mockPaymentOperation.create({
          data: {
            id: paymentHash([scope, 'PAYMENT', paymentId]),
            kind: 'PAYMENT',
            requestHash: paymentHash(request),
            request,
            result: {
              kind: 'CONFIRMED_RESULT',
              event: {
                ...scope,
                kind: 'PAYMENT',
                providerEventId: `seed:${paymentId}`,
                merchantRequestRef: paymentId,
                transactionRef: `mock:${paymentId}`,
                status: 'SUCCEEDED',
                amount: String(amount),
                currency: 'VND',
                occurredAt: now.toISOString(),
              },
            },
          },
        })
        await db.paymentWebhookEvent.create({
          data: {
            paymentGateway: 'mock',
            providerEnvironment: 'MOCK',
            merchantAccountKey: 'trekgo-mock-v1',
            providerEventId: `seed:${paymentId}`,
            paymentId,
            eventKind: 'PAYMENT',
            payload,
            payloadHash: hash(payload),
            processingStatus: 'PROCESSED',
            verifiedAt: now,
            processed: true,
            processedAt: now,
            attemptCount: 1,
          },
        })
        const pe = await db.paymentOutboxEvent.create({
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
        paymentEventIds.push(pe.id)
        await db.paymentConsumerReceipt.create({
          data: { eventId: pe.id, consumerName: 'booking-payment-application-v1', processedAt: now },
        })
        await event('BOOKING_CONFIRMED', bookingId, `booking:${bookingId}:confirmed:v1`, {
          bookingId,
          tripId: trip.id,
          userId: payer.id,
          paymentId,
          invoiceId,
          confirmationIdempotencyKey: confirmationKey,
          confirmedAt: now.toISOString(),
        })
        await audit('DEMO_BOOKING_CONFIRMED', 'Booking', bookingId, payer.id, { tripId: trip.id, invoiceId, paymentId })
      }
    } else {
      await db.tripMember.create({
        data: { tripId: trip.id, userId: actors.host.id, role: 'HOST', pickupPointId: r.pickup.id },
      })
      const link = await db.privateTripInvite.create({
        data: {
          tripId: trip.id,
          code: randomUUID(),
          createdBy: actors.host.id,
          maxUses: 7,
          usedCount: s.key === 'PRIVATE_D10' ? 2 : 0,
          expiresAt: privateInvitationExpiry(now, trip.startAt),
        },
      })
      const members = s.key === 'PRIVATE_D10' ? [actors.claimedMember, actors.invitedMember] : [actors.claimedMember]
      for (const member of members) {
        const joined = await db.tripMember.create({
          data: {
            tripId: trip.id,
            userId: member.id,
            role: 'MEMBER',
            pickupPointId: r.pickup.id,
            joinedByInviteId: s.key === 'PRIVATE_D10' ? link.id : null,
          },
        })
        if (s.key === 'PRIVATE_D17')
          await db.privateTripMemberInvitation.create({
            data: {
              tripId: trip.id,
              senderUserId: actors.host.id,
              recipientUserId: member.id,
              recipientEmailSnapshot: member.email.trim().toLowerCase(),
              status: 'ACCEPTED',
              expiresAt: privateInvitationExpiry(now, trip.startAt),
              respondedAt: now,
              acceptedMemberId: joined.id,
              membershipVersionAtAccept: joined.version,
              version: 2,
            },
          })
        await event('PRIVATE_TRIP_MEMBER_JOINED', trip.id, `PRIVATE_TRIP_MEMBER_JOINED:${joined.id}:1`, {
          tripId: trip.id,
          userId: member.id,
          memberId: joined.id,
          memberRole: 'MEMBER',
          status: 'ACTIVE',
          memberVersion: joined.version,
          actorId: member.id,
          tripType: 'PRIVATE',
          occurredAt: now.toISOString(),
        })
      }
      if (s.key === 'PRIVATE_D17') {
        const invitation = await db.privateTripMemberInvitation.create({
          data: {
            tripId: trip.id,
            senderUserId: actors.host.id,
            recipientUserId: actors.invitedMember.id,
            recipientEmailSnapshot: actors.invitedMember.email.trim().toLowerCase(),
            expiresAt: privateInvitationExpiry(now, trip.startAt),
            status: 'PENDING',
          },
        })
        await event('PRIVATE_TRIP_MEMBER_INVITED', trip.id, `PRIVATE_TRIP_MEMBER_INVITED:${invitation.id}:1`, {
          tripId: trip.id,
          invitationId: invitation.id,
          senderUserId: actors.host.id,
          recipientUserId: actors.invitedMember.id,
        })
      }
    }
    await audit('DEMO_TRIP_SEEDED', 'Trip', trip.id, creatorId, { scenario: s.key })
    trips.push({
      id: trip.id,
      scenario: s.key,
      startAt: trip.startAt.toISOString(),
      endAt: trip.endAt.toISOString(),
      status: trip.status,
    })
  }
  return {
    trips,
    eventIds,
    paymentEventIds,
    actors: Object.entries(actors).map(([role, user]) => ({ role, id: user.id, email: user.email })),
  }
}
