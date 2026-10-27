import {
  BookingStatus,
  DeliveryMode,
  EquipmentCondition,
  EquipmentUnitStatus,
  ParticipantCheckinStatus,
  ParticipantStatus,
  PrismaClient,
  RentalDayCountMode,
  RentalOrderStatus,
  RentalProductStatus,
  RentalQuoteStatus,
  RentalReservationStatus,
  ServicePointStatus,
  ServicePointType,
  TripStatus,
  TripType,
  UserRole,
  UserStatus,
} from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { BookingParticipationContextService } from '../../../../bookings/booking-participation-context.service'
import { PrismaTripLifecycleAdapter } from '../../../lifecycle/infrastructure/adapters/prisma-trip-lifecycle.adapter'
import { PrismaRentalContextAdapter } from './prisma-rental-context.adapter'
import { PrismaRentalOrderAdapter } from './prisma-rental-order.adapter'
import type { PrismaService } from '../../../../../shared/services/prisma.service'

const testDatabaseUrl = process.env.TEST_DATABASE_URL

if (testDatabaseUrl && testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL must point to an isolated PostgreSQL test database, not DATABASE_URL',
  )
}

const describeIfTestDb = testDatabaseUrl ? describe : describe.skip

describeIfTestDb(
  'Rental M9 PostgreSQL Integration — Membership-Revoke vs Create-Order & Last-Stock Concurrency',
  () => {
    jest.setTimeout(60_000)

    let db: PrismaClient
    let bookingContextService: BookingParticipationContextService
    let contextAdapter: PrismaRentalContextAdapter
    let orderAdapter: PrismaRentalOrderAdapter
    let lifecycleAdapter: PrismaTripLifecycleAdapter

    const createdTripIds: string[] = []
    const createdUserIds: string[] = []
    const createdProductIds: string[] = []
    const createdCategoryIds: string[] = []
    const createdLocationIds: string[] = []
    const createdServicePointIds: string[] = []
    const createdPolicyIds: string[] = []

    beforeAll(async () => {
      db = new PrismaClient({ datasourceUrl: testDatabaseUrl })
      await db.$connect()

      bookingContextService = new BookingParticipationContextService()
      contextAdapter = new PrismaRentalContextAdapter(
        db as unknown as PrismaService,
        bookingContextService,
      )
      orderAdapter = new PrismaRentalOrderAdapter(
        db as unknown as PrismaService,
        contextAdapter,
      )
      lifecycleAdapter = new PrismaTripLifecycleAdapter(
        db as unknown as PrismaService,
      )
    })

    afterAll(async () => {
      if (db) {
        if (createdTripIds.length > 0) {
          const orders = await db.rentalOrder.findMany({
            where: { tripId: { in: createdTripIds } },
            select: { id: true },
          })
          const orderIds = orders.map((o) => o.id)
          if (orderIds.length > 0) {
            await db.rentalOutboxEvent.deleteMany({
              where: { aggregateId: { in: orderIds } },
            })
            await db.rentalQuantityReservation.deleteMany({
              where: { orderLine: { orderId: { in: orderIds } } },
            })
            await db.rentalOrderLine.deleteMany({
              where: { orderId: { in: orderIds } },
            })
            await db.rentalOrder.deleteMany({
              where: { id: { in: orderIds } },
            })
          }
          await db.rentalQuoteLine.deleteMany({
            where: { quote: { tripId: { in: createdTripIds } } },
          })
          await db.rentalQuote.deleteMany({
            where: { tripId: { in: createdTripIds } },
          })
          await db.bookingParticipant.deleteMany({
            where: { booking: { tripId: { in: createdTripIds } } },
          })
          await db.booking.deleteMany({
            where: { tripId: { in: createdTripIds } },
          })
          await db.tripLogisticsConfig.deleteMany({
            where: { tripId: { in: createdTripIds } },
          })
          await db.trip.deleteMany({
            where: { id: { in: createdTripIds } },
          })
        }
        if (createdProductIds.length > 0) {
          await db.equipmentUnit.deleteMany({
            where: { productId: { in: createdProductIds } },
          })
          await db.rentalProduct.deleteMany({
            where: { id: { in: createdProductIds } },
          })
        }
        if (createdCategoryIds.length > 0) {
          await db.rentalCategory.deleteMany({
            where: { id: { in: createdCategoryIds } },
          })
        }
        if (createdLocationIds.length > 0) {
          await db.inventoryLocation.deleteMany({
            where: { id: { in: createdLocationIds } },
          })
        }
        if (createdServicePointIds.length > 0) {
          await db.servicePoint.deleteMany({
            where: { id: { in: createdServicePointIds } },
          })
        }
        if (createdPolicyIds.length > 0) {
          await db.rentalPolicy.deleteMany({
            where: { id: { in: createdPolicyIds } },
          })
        }
        if (createdUserIds.length > 0) {
          await db.user.deleteMany({
            where: { id: { in: createdUserIds } },
          })
        }
        await db.$disconnect()
      }
    })

    async function seedSharedInfra() {
      let location = await db.inventoryLocation.findFirst({
        where: { status: 'ACTIVE' },
      })
      if (!location) {
        location = await db.inventoryLocation.create({
          data: {
            code: `WH-M9-${randomUUID().slice(0, 8)}`,
            name: 'M9 Concurrency Warehouse',
            address: '1 TrekGo Way',
            status: 'ACTIVE',
          },
        })
        createdLocationIds.push(location.id)
      }

      let policy = await db.rentalPolicy.findFirst({
        where: { isActive: true },
      })
      if (!policy) {
        const admin = await db.user.create({
          data: {
            id: randomUUID(),
            authUserId: randomUUID(),
            email: `admin-${randomUUID()}@m9.test`,
            fullName: 'M9 Admin',
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
          },
        })
        createdUserIds.push(admin.id)

        policy = await db.rentalPolicy.create({
          data: {
            policyCode: `M9_POL_${randomUUID().slice(0, 8)}`,
            versionNo: 1,
            currency: 'VND',
            dayCountMode: RentalDayCountMode.CEIL_24H,
            quoteTtlMinutes: 15,
            paymentHoldMinutes: 15,
            freeCancellationHours: 24,
            cutoffHoursBeforeTrip: 24,
            prepBufferMinutes: 720,
            returnBufferMinutes: 1440,
            cleaningBufferMinutes: 0,
            deepInspectionBufferMinutes: 2880,
            pickupCodeTtlMinutes: 15,
            pickupVerificationTtlMinutes: 10,
            overdueReviewMinutes: 120,
            deepInspectionReviewMinutes: 2880,
            adminApprovalMinutes: 1440,
            userAssessmentReviewMinutes: 2880,
            lostConfirmationMinutes: null,
            maxRentalAfterTripHours: 48,
            extensionRequestCutoffMinutes: 120,
            extensionHoldMinutes: 15,
            maxExtensionCount: 2,
            maxTotalRentalDays: 14,
            returnInspectionSlaHours: 72,
            deepInspectionSlaHours: 24,
            returnToInventoryAllowanceHours: 8,
            postInspectionCleaningAllowanceHours: 8,
            cancellationRules: [],
            effectiveFrom: new Date('2026-01-01T00:00:00Z'),
            isActive: true,
            createdBy: admin.id,
          },
        })
        createdPolicyIds.push(policy.id)
      }

      const servicePoint = await db.servicePoint.create({
        data: {
          code: `SP-M9-${randomUUID().slice(0, 8)}`,
          name: 'M9 Handover Hub',
          type: ServicePointType.TRAILHEAD,
          address: 'Trailhead Gate 1',
          latitude: 10.77,
          longitude: 106.69,
          status: ServicePointStatus.ACTIVE,
          isVerified: true,
        },
      })
      createdServicePointIds.push(servicePoint.id)

      const category = await db.rentalCategory.create({
        data: {
          name: `M9 Cat ${randomUUID().slice(0, 6)}`,
          slug: `m9-cat-${randomUUID().slice(0, 8)}`,
        },
      })
      createdCategoryIds.push(category.id)

      const product = await db.rentalProduct.create({
        data: {
          categoryId: category.id,
          sku: `SKU-M9-${randomUUID().slice(0, 8)}`,
          name: 'M9 Trekking Tent',
          dailyPrice: 150000,
          depositValue: 500000,
          replacementValue: 2000000,
          status: RentalProductStatus.ACTIVE,
        },
      })
      createdProductIds.push(product.id)

      const unit = await db.equipmentUnit.create({
        data: {
          productId: product.id,
          homeInventoryLocationId: location.id,
          currentInventoryLocationId: location.id,
          assetCode: `ASSET-M9-${randomUUID().slice(0, 8)}`,
          qrCode: `QR-M9-${randomUUID().slice(0, 8)}`,
          status: EquipmentUnitStatus.AVAILABLE,
          condition: EquipmentCondition.GOOD,
        },
      })

      return { location, policy, servicePoint, product, unit }
    }

    it('race membership-revoke vs create-order: serializes on Trip lock and never leaves an active order on a revoked source', async () => {
      const { policy, servicePoint, product } = await seedSharedInfra()
      const now = new Date('2026-10-27T08:00:00.000Z')
      const startAt = new Date('2026-11-05T08:00:00.000Z')
      const endAt = new Date('2026-11-07T18:00:00.000Z')

      const leader = await db.user.create({
        data: {
          id: randomUUID(),
          authUserId: randomUUID(),
          email: `leader-${randomUUID()}@m9.test`,
          fullName: 'Trip Leader',
          role: UserRole.LEADER,
          status: UserStatus.ACTIVE,
        },
      })
      const user = await db.user.create({
        data: {
          id: randomUUID(),
          authUserId: randomUUID(),
          email: `renter-${randomUUID()}@m9.test`,
          fullName: 'Renter Participant',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      })
      createdUserIds.push(leader.id, user.id)

      const trip = await db.trip.create({
        data: {
          title: 'M9 Concurrency Public Trip',
          tripType: TripType.PUBLIC,
          status: TripStatus.PUBLISHED,
          leaderId: leader.id,
          createdBy: leader.id,
          startAt,
          endAt,
          version: 1,
        },
      })
      createdTripIds.push(trip.id)

      await db.tripLogisticsConfig.create({
        data: {
          tripId: trip.id,
          pickupPointId: servicePoint.id,
          returnPointId: servicePoint.id,
          plannedHandoverAt: startAt,
          plannedReturnAt: endAt,
          returnMode: DeliveryMode.PICKUP_AT_POINT,
        },
      })

      const booking = await db.booking.create({
        data: {
          bookingCode: `BK-M9-${randomUUID().slice(0, 8)}`,
          tripId: trip.id,
          userId: user.id,
          status: BookingStatus.CONFIRMED,
          participantCount: 1,
          unitPrice: 500000,
          totalAmount: 500000,
          currency: 'VND',
          version: 1,
        },
      })

      const participant = await db.bookingParticipant.create({
        data: {
          bookingId: booking.id,
          userId: user.id,
          fullName: user.fullName,
          status: ParticipantStatus.ACTIVE,
          checkinStatus: ParticipantCheckinStatus.NOT_CHECKED_IN,
          checkinCode: `CHK-${randomUUID().slice(0, 8)}`,
        },
      })

      const quote = await db.rentalQuote.create({
        data: {
          userId: user.id,
          tripId: trip.id,
          bookingId: booking.id,
          membershipKind: 'PUBLIC_PARTICIPANT',
          membershipRef: participant.id,
          membershipSourceVersion: 1,
          membershipSnapshot: {
            memberId: participant.id,
            membershipKind: 'PUBLIC_PARTICIPANT',
            membershipSourceVersion: 1,
            status: 'ACTIVE',
            role: 'MEMBER',
          },
          pickupPointId: servicePoint.id,
          returnPointId: servicePoint.id,
          rentalPolicyId: policy.id,
          policyVersion: policy.versionNo,
          contextVersion: 1,
          status: RentalQuoteStatus.ACTIVE,
          rentalStartAt: startAt,
          rentalEndAt: endAt,
          occupiedStartAt: new Date(startAt.getTime() - 12 * 3600_000),
          occupiedEndAt: new Date(endAt.getTime() + 24 * 3600_000),
          billableDays: 3,
          currency: 'VND',
          rentalFee: 450000,
          totalDeposit: 500000,
          totalAmount: 950000,
          expiresAt: new Date(now.getTime() + 15 * 60_000),
          rentalQuoteLinesViaQuoteId: {
            create: [
              {
                productId: product.id,
                productNameSnapshot: product.name,
                quantity: 1,
                billableDays: 3,
                dailyPrice: 150000,
                unitDeposit: 500000,
                unitReplacementValue: 2000000,
                lineRentalFee: 450000,
                lineDeposit: 500000,
              },
            ],
          },
        },
      })

      // Fire membership revocation and order creation concurrently
      const [revokeOutcome, createOrderOutcome] = await Promise.allSettled([
        db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM trips WHERE id = ${trip.id}::uuid FOR UPDATE`
          await tx.bookingParticipant.update({
            where: { id: participant.id },
            data: { status: ParticipantStatus.CANCELLED },
          })
          const updatedBooking = await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.CANCELLED,
              version: { increment: 1 },
            },
          })
          return updatedBooking
        }),
        orderAdapter.createOrder({
          userId: user.id,
          quoteId: quote.id,
          idempotencyKey: `idem-race-${randomUUID()}`,
          now,
        }),
      ])

      expect(revokeOutcome.status).toBe('fulfilled')

      if (createOrderOutcome.status === 'rejected') {
        // Revoke transaction won the Trip lock first -> createOrder rejected due to stale/ineligible membership
        expect((createOrderOutcome.reason as { code?: string })?.code).toMatch(
          /STALE_CONTEXT|TRIP_MEMBERSHIP_NOT_ELIGIBLE/,
        )
        const ordersInDb = await db.rentalOrder.count({
          where: { tripId: trip.id, userId: user.id },
        })
        expect(ordersInDb).toBe(0)
      } else {
        // createOrder won the Trip lock first -> subsequent lifecycle revocation event must expire the order
        await lifecycleAdapter.processMembershipSourceChanged({
          eventId: randomUUID(),
          eventType: 'BOOKING_CANCELLED',
          occurredAt: new Date(now.getTime() + 1000).toISOString(),
          payload: {
            tripId: trip.id,
            userId: user.id,
            membershipKind: 'PUBLIC_PARTICIPANT',
            membershipRef: participant.id,
            bookingId: booking.id,
            sourceVersion: 2,
            reason: 'CONCURRENT_REVOCATION',
          },
        })
        const finalOrder = await db.rentalOrder.findUniqueOrThrow({
          where: { id: createOrderOutcome.value.orderId },
        })
        expect([
          RentalOrderStatus.EXPIRED,
          RentalOrderStatus.CANCELLED,
        ]).toContain(finalOrder.status)
      }
    })

    it('last-stock concurrency: 2 participants racing for the last 1 unit result in exactly 1 order and 1 INSUFFICIENT_AVAILABLE_STOCK', async () => {
      const { policy, servicePoint, product } = await seedSharedInfra()
      const now = new Date('2026-10-27T08:00:00.000Z')
      const startAt = new Date('2026-12-01T08:00:00.000Z')
      const endAt = new Date('2026-12-03T18:00:00.000Z')

      const leader = await db.user.create({
        data: {
          id: randomUUID(),
          authUserId: randomUUID(),
          email: `leader2-${randomUUID()}@m9.test`,
          fullName: 'Leader 2',
          role: UserRole.LEADER,
          status: UserStatus.ACTIVE,
        },
      })
      const user1 = await db.user.create({
        data: {
          id: randomUUID(),
          authUserId: randomUUID(),
          email: `u1-${randomUUID()}@m9.test`,
          fullName: 'User 1',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      })
      const user2 = await db.user.create({
        data: {
          id: randomUUID(),
          authUserId: randomUUID(),
          email: `u2-${randomUUID()}@m9.test`,
          fullName: 'User 2',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      })
      createdUserIds.push(leader.id, user1.id, user2.id)

      const trip = await db.trip.create({
        data: {
          title: 'M9 Last Stock Concurrency Trip',
          tripType: TripType.PUBLIC,
          status: TripStatus.PUBLISHED,
          leaderId: leader.id,
          createdBy: leader.id,
          startAt,
          endAt,
          version: 1,
        },
      })
      createdTripIds.push(trip.id)

      await db.tripLogisticsConfig.create({
        data: {
          tripId: trip.id,
          pickupPointId: servicePoint.id,
          returnPointId: servicePoint.id,
          plannedHandoverAt: startAt,
          plannedReturnAt: endAt,
          returnMode: DeliveryMode.PICKUP_AT_POINT,
        },
      })

      async function createParticipantAndQuote(u: { id: string; fullName: string }) {
        const bk = await db.booking.create({
          data: {
            bookingCode: `BK-LS-${randomUUID().slice(0, 8)}`,
            tripId: trip.id,
            userId: u.id,
            status: BookingStatus.CONFIRMED,
            participantCount: 1,
            unitPrice: 500000,
            totalAmount: 500000,
            currency: 'VND',
            version: 1,
          },
        })
        const pt = await db.bookingParticipant.create({
          data: {
            bookingId: bk.id,
            userId: u.id,
            fullName: u.fullName,
            status: ParticipantStatus.ACTIVE,
            checkinStatus: ParticipantCheckinStatus.NOT_CHECKED_IN,
            checkinCode: `CHK-LS-${randomUUID().slice(0, 8)}`,
          },
        })
        const qt = await db.rentalQuote.create({
          data: {
            userId: u.id,
            tripId: trip.id,
            bookingId: bk.id,
            membershipKind: 'PUBLIC_PARTICIPANT',
            membershipRef: pt.id,
            membershipSourceVersion: 1,
            membershipSnapshot: {
              memberId: pt.id,
              membershipKind: 'PUBLIC_PARTICIPANT',
              membershipSourceVersion: 1,
              status: 'ACTIVE',
              role: 'MEMBER',
            },
            pickupPointId: servicePoint.id,
            returnPointId: servicePoint.id,
            rentalPolicyId: policy.id,
            policyVersion: policy.versionNo,
            contextVersion: 1,
            status: RentalQuoteStatus.ACTIVE,
            rentalStartAt: startAt,
            rentalEndAt: endAt,
            occupiedStartAt: new Date(startAt.getTime() - 12 * 3600_000),
            occupiedEndAt: new Date(endAt.getTime() + 24 * 3600_000),
            billableDays: 3,
            currency: 'VND',
            rentalFee: 450000,
            totalDeposit: 500000,
            totalAmount: 950000,
            expiresAt: new Date(now.getTime() + 15 * 60_000),
            rentalQuoteLinesViaQuoteId: {
              create: [
                {
                  productId: product.id,
                  productNameSnapshot: product.name,
                  quantity: 1,
                  billableDays: 3,
                  dailyPrice: 150000,
                  unitDeposit: 500000,
                  unitReplacementValue: 2000000,
                  lineRentalFee: 450000,
                  lineDeposit: 500000,
                },
              ],
            },
          },
        })
        return qt
      }

      const quote1 = await createParticipantAndQuote(user1)
      const quote2 = await createParticipantAndQuote(user2)

      const results = await Promise.allSettled([
        orderAdapter.createOrder({
          userId: user1.id,
          quoteId: quote1.id,
          idempotencyKey: `idem-ls-1-${randomUUID()}`,
          now,
        }),
        orderAdapter.createOrder({
          userId: user2.id,
          quoteId: quote2.id,
          idempotencyKey: `idem-ls-2-${randomUUID()}`,
          now,
        }),
      ])

      const fulfilled = results.filter((r) => r.status === 'fulfilled')
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )

      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect((rejected[0].reason as { code?: string })?.code).toBe(
        'INSUFFICIENT_AVAILABLE_STOCK',
      )

      const heldReservations = await db.rentalQuantityReservation.count({
        where: {
          productId: product.id,
          status: RentalReservationStatus.HELD,
        },
      })
      expect(heldReservations).toBe(1)
    })
  },
)

