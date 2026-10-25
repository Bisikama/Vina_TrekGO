jest.mock('@nestjs/schedule', () => ({ Interval: () => () => {} }))
import { Test } from '@nestjs/testing'
import { APP_GUARD } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import request from 'supertest'
import { evaluateTripPricing } from './pricing-calculator'
import { TripPricingController } from './trip-pricing.controller'
import { TripPricingService } from './trip-pricing.service'
import { BookingsService } from '../../bookings/bookings.service'
import { BookingPolicyService } from '../../bookings/booking-policy.service'
import { PrismaService } from '../../../shared/services/prisma.service'
import { GlobalErrorFilter } from '../../../shared/errors'
import { RolesGuard } from '../../../shared/guards/roles.guard'

describe('Trekking Pricing Simulator math & HTTP flow (TG-PTR-PRICING-01)', () => {
  const defaultFeePolicy = {
    policyVersion: 'fee-2026-v1',
    platformFeeBps: 800,
    paymentFeeBps: 200,
    defaultContingencyBps: 500,
    defaultTargetMarginBps: 1200,
    roundingStepVnd: '10000',
  }

  const demoItems = [
    {
      category: 'TRANSPORT' as const,
      name: 'Thuê xe 16 chỗ cố định',
      kind: 'FIXED' as const,
      basis: 'PER_TRIP' as const,
      unitPrice: '6000000',
      quantity: 1,
      durationUnits: 1,
      extraNonPayingPax: 0,
      includedInPrice: true,
      isEnabled: true,
    },
    {
      category: 'TRANSPORT' as const,
      name: 'Tăng thêm 2.000.000đ chi phí xe khi vượt 15 khách',
      kind: 'STEP' as const,
      basis: 'PER_GROUP_TIER' as const,
      unitPrice: '0',
      quantity: 1,
      durationUnits: 1,
      extraNonPayingPax: 0,
      includedInPrice: true,
      isEnabled: true,
      stepTiers: [
        {
          triggerMinPax: 16,
          triggerMaxPax: 20,
          operation: 'ADDITIVE' as const,
          amount: '2000000',
        },
      ],
    },
    {
      category: 'FOOD' as const,
      name: 'Chi phí ăn uống & vé theo khách',
      kind: 'VARIABLE' as const,
      basis: 'PER_PERSON' as const,
      unitPrice: '300000',
      quantity: 1,
      durationUnits: 1,
      extraNonPayingPax: 0,
      includedInPrice: true,
      isEnabled: true,
    },
    {
      category: 'OTHER' as const,
      name: 'Đồ uống cá nhân ngoài chương trình',
      kind: 'VARIABLE' as const,
      basis: 'PER_PERSON' as const,
      unitPrice: '0',
      quantity: 1,
      durationUnits: 1,
      extraNonPayingPax: 0,
      includedInPrice: false,
      isEnabled: true,
      sourceNote: 'Khách tự túc',
    },
  ]

  it('matches the Trekking Pricing Simulator screenshot and design table at N=14 and N=15 (P=950,000)', () => {
    const res14 = evaluateTripPricing({
      maxPax: 20,
      targetPax: 14,
      targetMarginBps: 1200,
      contingencyBps: 500,
      selectedPrice: '950000',
      selectedMinPax: 12,
      items: demoItems,
      feePolicy: defaultFeePolicy,
    })

    expect(res14.summary).toMatchObject({
      baseFixedCost: '6000000',
      unitVariableCost: '300000',
      evaluatedPrice: '950000',
      suggestedPriceAtTargetPax: '990000',
      firstBreakEvenPax: 12,
      firstTargetPax: 15,
    })
    expect(res14.summary.atTargetPax).toMatchObject({
      pax: 14,
      revenue: '13300000',
      totalCost: '10710000',
      feeAmount: '1330000',
      profit: '1260000',
      marginBps: 947,
    })

    // Check N=12 (break-even), N=15 (12.63%), N=16 (step cost +2m -> profit 240k, margin 1.58%)
    const sc12 = res14.scenarios.find((s) => s.pax === 12)!
    expect(sc12).toMatchObject({ profit: '180000', marginBps: 157 })
    const sc15 = res14.scenarios.find((s) => s.pax === 15)!
    expect(sc15).toMatchObject({ profit: '1800000', marginBps: 1263, status: 'TARGET_MET' })
    const sc16 = res14.scenarios.find((s) => s.pax === 16)!
    expect(sc16).toMatchObject({
      fixedCost: '8000000',
      totalCost: '13440000',
      profit: '240000',
      marginBps: 157,
      stepTriggered: true,
    })

    // Risk interval at 16..19 for margin below 12% target after step cost
    expect(res14.riskIntervals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          minPax: 16,
          maxPax: 19,
          type: 'MARGIN_BELOW_TARGET_AFTER_STEP_COST',
        }),
      ]),
    )
    expect(res14.includedServices).toHaveLength(3)
    expect(res14.excludedServices).toEqual(['Đồ uống cá nhân ngoài chương trình (Khách tự túc)'])
  })

  it('detects non-monotonic loss intervals at N=16 when P=900,000 and computes PER_CAPACITY_UNIT with staff allowance', () => {
    const res900 = evaluateTripPricing({
      maxPax: 20,
      targetPax: 15,
      targetMarginBps: 1200,
      contingencyBps: 500,
      selectedPrice: '900000',
      selectedMinPax: 13,
      items: demoItems,
      feePolicy: defaultFeePolicy,
    })

    expect(res900.summary.firstBreakEvenPax).toBe(13)
    const sc13 = res900.scenarios.find((s) => s.pax === 13)!
    expect(Number(sc13.profit)).toBeGreaterThan(0)

    const sc16 = res900.scenarios.find((s) => s.pax === 16)!
    expect(sc16.profit).toBe('-480000')
    expect(res900.riskIntervals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          minPax: 16,
          maxPax: 16,
          type: 'LOSS_IN_OPERATING_RANGE',
        }),
      ]),
    )

    // PER_CAPACITY_UNIT: 4-person tent with 1 extra staff (Leader) -> at N=3 (3+1=4 -> 1 tent), at N=4 (4+1=5 -> 2 tents)
    const tentEval = evaluateTripPricing({
      maxPax: 10,
      targetPax: 4,
      targetMarginBps: 1000,
      contingencyBps: 0,
      selectedPrice: '500000',
      items: [
        {
          category: 'ACCOMMODATION',
          name: 'Lều 4 người',
          kind: 'STEP',
          basis: 'PER_CAPACITY_UNIT',
          unitPrice: '200000',
          quantity: 1,
          durationUnits: 1,
          capacityPerUnit: 4,
          extraNonPayingPax: 1,
          includedInPrice: true,
          isEnabled: true,
        },
      ],
      feePolicy: defaultFeePolicy,
    })
    expect(tentEval.scenarios[2].fixedCost).toBe('200000') // N=3 (+1 = 4) -> 1 tent
    expect(tentEval.scenarios[3].fixedCost).toBe('400000') // N=4 (+1 = 5) -> 2 tents
  })

  describe('HTTP controller, post-publish price update & GlobalErrorFilter contract', () => {
    const leaderId = '00000000-0000-4000-8000-000000000010'
    const tripId = '00000000-0000-4000-8000-000000000020'
    let app: INestApplication
    let role = 'LEADER'
    let tripRow: any
    let planRow: any
    let itemRows: any[] = []
    let pricingVersions: any[] = []

    const db: any = {
      user: {
        findUnique: jest.fn(async () => ({ id: leaderId, role, status: 'ACTIVE' })),
      },
      systemConfig: {
        findUnique: jest.fn(async () => null),
      },
      trip: {
        findUnique: jest.fn(async () =>
          tripRow
            ? {
                ...tripRow,
                tripCostPlanViaTripId: planRow
                  ? {
                      ...planRow,
                      items: itemRows,
                    }
                  : null,
                tripPricingVersionsViaTripId: [...pricingVersions].sort((a, b) => b.versionNo - a.versionNo),
              }
            : null,
        ),
        update: jest.fn(async ({ data }) => {
          tripRow = {
            ...tripRow,
            ...(data.pricePerPax !== undefined ? { pricePerPax: data.pricePerPax } : {}),
            ...(data.minPax !== undefined ? { minPax: data.minPax } : {}),
            ...(data.priceExplanation !== undefined ? { priceExplanation: data.priceExplanation } : {}),
            version: tripRow.version + 1,
          }
          return tripRow
        }),
      },
      tripCostPlan: {
        create: jest.fn(async ({ data }) => {
          planRow = { id: 'plan-1', version: 1, ...data }
          return planRow
        }),
        update: jest.fn(async ({ data }) => {
          planRow = {
            ...planRow,
            ...Object.fromEntries(Object.entries(data).filter(([k, v]) => k !== 'version' && v !== undefined)),
            version: (planRow?.version ?? 1) + 1,
          }
          return planRow
        }),
      },
      tripCostItem: {
        deleteMany: jest.fn(async () => {
          itemRows = []
        }),
        create: jest.fn(async ({ data }) => {
          const item = { id: `item-${itemRows.length + 1}`, ...data, stepTiers: [] }
          itemRows.push(item)
          return item
        }),
      },
      tripCostStepTier: {
        createMany: jest.fn(async ({ data }) => {
          const lastItem = itemRows[itemRows.length - 1]
          lastItem.stepTiers = data.map((t: any, i: number) => ({ id: `tier-${i + 1}`, ...t }))
        }),
      },
      tripPricingVersion: {
        create: jest.fn(async ({ data }) => {
          const v = { id: `pv-${pricingVersions.length + 1}`, publishedAt: new Date(), ...data }
          pricingVersions.push(v)
          return v
        }),
      },
      auditLog: {
        create: jest.fn(async () => ({})),
      },
      $queryRaw: jest.fn(async () => []),
      $transaction: jest.fn(async (work) => work(db)),
    }

    beforeAll(async () => {
      const mod = await Test.createTestingModule({
        controllers: [TripPricingController],
        providers: [
          TripPricingService,
          { provide: PrismaService, useValue: db },
          { provide: APP_GUARD, useClass: RolesGuard },
        ],
      }).compile()
      app = mod.createNestApplication()
      app.setGlobalPrefix('api/v1')
      app.useGlobalFilters(new GlobalErrorFilter())
      app.use((req: any, _res: unknown, next: () => void) => {
        req.user = { id: leaderId, role }
        next()
      })
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    beforeEach(() => {
      role = 'LEADER'
      tripRow = {
        id: tripId,
        tripType: 'PUBLIC',
        creatorId: leaderId,
        leaderId,
        status: 'DRAFT',
        minPax: 1,
        maxPax: 20,
        pricePerPax: null,
        priceExplanation: null,
        version: 1,
        startAt: new Date('2099-05-01T06:00:00Z'),
        endAt: new Date('2099-05-02T18:00:00Z'),
      }
      planRow = null
      itemRows = []
      pricingVersions = []
      jest.clearAllMocks()
    })

    it('saves cost plan, blocks confirm on loss interval, confirms valid price, and supports post-publish price update with new TripPricingVersion', async () => {
      const cfg = await request(app.getHttpServer()).get('/api/v1/leader/pricing-config').expect(200)
      expect(cfg.body).toMatchObject({ platformFeeBps: 800, paymentFeeBps: 200, totalFeeBps: 1000 })

      // 1. Save draft cost plan
      const saved = await request(app.getHttpServer())
        .put(`/api/v1/leader/public-trips/${tripId}/cost-plan`)
        .send({
          expectedVersion: 1,
          targetPax: 14,
          targetMarginBps: 1200,
          contingencyBps: 500,
          selectedPrice: '950000',
          selectedMinPax: 12,
          items: demoItems,
        })
        .expect(200)

      expect(saved.body.tripVersion).toBe(2)
      expect(saved.body.summary.suggestedPriceAtTargetPax).toBe('990000')
      expect(saved.body.summary.atTargetPax.profit).toBe('1260000')

      // 2. Attempt to confirm a price (900,000) that causes a loss at N=16..17 -> blocked with 409 TRIP_PRICING_LOSS_INTERVAL
      const lossConfirm = await request(app.getHttpServer())
        .post(`/api/v1/leader/public-trips/${tripId}/pricing/confirm`)
        .send({
          expectedVersion: 2,
          selectedPrice: '900000',
          selectedMinPax: 13,
          targetPax: 15,
        })
        .expect(409)

      expect(lossConfirm.body.error.code).toBe('TRIP_PRICING_LOSS_INTERVAL')
      expect(lossConfirm.body.meta.requestId).toBeTruthy()

      // 3. Confirm valid price (950,000, minPax=12) while DRAFT
      const confirmed = await request(app.getHttpServer())
        .post(`/api/v1/leader/public-trips/${tripId}/pricing/confirm`)
        .send({
          expectedVersion: 2,
          selectedPrice: '950000',
          selectedMinPax: 12,
          targetPax: 15,
        })
        .expect(201)

      expect(confirmed.body).toMatchObject({
        tripVersion: 3,
        costPlanStatus: 'CONFIRMED',
        selectedPrice: '950000',
        selectedMinPax: 12,
        pricingVersionNo: null,
      })
      expect(tripRow.pricePerPax.toFixed(0)).toBe('950000')
      expect(tripRow.minPax).toBe(12)

      // 4. Simulate Trip published to OPEN (versionNo = 1 already created at publish)
      tripRow.status = 'OPEN'
      pricingVersions.push({
        id: 'pv-1',
        tripId,
        versionNo: 1,
        selectedPrice: new Prisma.Decimal('950000'),
        selectedMinPax: 12,
        targetPax: 15,
        publishedAt: new Date(),
      })

      // 5. Leader adjusts price post-publish to 1,050,000 while Trip is OPEN -> creates TripPricingVersion v2 and updates Trip.pricePerPax
      const postPublishConfirm = await request(app.getHttpServer())
        .post(`/api/v1/leader/public-trips/${tripId}/pricing/confirm`)
        .send({
          expectedVersion: 3,
          selectedPrice: '1050000',
          selectedMinPax: 12,
          targetPax: 15,
        })
        .expect(201)

      expect(postPublishConfirm.body).toMatchObject({
        tripVersion: 4,
        tripStatus: 'OPEN',
        costPlanStatus: 'PUBLISHED',
        selectedPrice: '1050000',
        pricingVersionNo: 2,
      })
      expect(tripRow.pricePerPax.toFixed(0)).toBe('1050000')
      expect(pricingVersions).toHaveLength(2)
    })

    it('updates PENDING_PAYMENT booking to the latest trip pricePerPax when participants are edited after a post-publish price change', async () => {
      let currentBooking: any = {
        id: '00000000-0000-4000-8000-000000000099',
        tripId,
        userId: 'user-1',
        status: 'PENDING_PAYMENT',
        version: 1,
        participantCount: 1,
        pricePerPaxSnapshot: new Prisma.Decimal('950000'),
        subtotalAmount: new Prisma.Decimal('950000'),
        totalAmount: new Prisma.Decimal('950000'),
        discountAmount: new Prisma.Decimal('0'),
        insuranceAmount: new Prisma.Decimal('0'),
        currency: 'VND',
        expiresAt: new Date('2099-04-30T00:00:00Z'),
        confirmedAt: null,
        policySnapshot: {
          version: 1,
          tiers: [{ minHoursBeforeStart: 0, refundPercent: 100 }],
        },
        pickupPoint: { id: 'p1', name: 'Pickup', address: 'Addr', latitude: new Prisma.Decimal(10), longitude: new Prisma.Decimal(106) },
        returnPoint: { id: 'p1', name: 'Pickup', address: 'Addr', latitude: new Prisma.Decimal(10), longitude: new Prisma.Decimal(106) },
      }
      const createdInvoices: any[] = []

      // Leader has adjusted the OPEN trip price from 950,000 to 1,050,000
      tripRow.status = 'OPEN'
      tripRow.pricePerPax = new Prisma.Decimal('1050000')

      const bookingDb: any = {
        trip: {
          findUnique: jest.fn(async () => tripRow),
          update: jest.fn(async () => tripRow),
        },
        booking: {

          findMany: jest.fn(async () => []),
          findUnique: jest.fn(async () => currentBooking),
          findUniqueOrThrow: jest.fn(async () => ({
            ...currentBooking,
            trip: { ...tripRow, tripTransportsViaTripId: [] },
            bookingParticipantsViaBookingId: [
              { id: 'part-1', fullName: 'Khách 1', status: 'ACTIVE', createdAt: new Date() },
            ],
            invoicesViaBookingId: [],
          })),
          update: jest.fn(async ({ data }) => {
            currentBooking = {
              ...currentBooking,
              participantCount: data.participantCount,
              pricePerPaxSnapshot: data.pricePerPaxSnapshot,
              subtotalAmount: data.subtotalAmount,
              totalAmount: data.totalAmount,
              version: currentBooking.version + 1,
            }
            return currentBooking
          }),
          updateMany: jest.fn(async () => ({ count: 0 })),
        },
        bookingParticipant: {
          findMany: jest.fn(async () => []),
          count: jest.fn(async () => 0),
          updateMany: jest.fn(async () => ({ count: 0 })),
          update: jest.fn(async () => ({})),
          create: jest.fn(async () => ({})),
        },

        payment: {
          findFirst: jest.fn(async () => null),
        },
        invoice: {
          findFirst: jest.fn(async () => ({ id: 'inv-1', revisionNo: 1 })),
          updateMany: jest.fn(async () => ({ count: 1 })),
          create: jest.fn(async ({ data }) => {
            createdInvoices.push(data)
            return data
          }),
        },
        $queryRaw: jest.fn(async () => [{ now: new Date('2026-10-22T10:00:00Z'), count: 0 }]),
        $transaction: jest.fn(async (work) => work(bookingDb)),
      }

      const bookingsService = new BookingsService(bookingDb as PrismaService, {} as BookingPolicyService)
      const detail = await bookingsService.updateParticipants(currentBooking.id, 'user-1', {
        expectedVersion: 1,
        participantCount: 2,
        participants: [{ fullName: 'Khách 1' }, { fullName: 'Khách 2' }],
      })

      expect(detail.pricePerPax).toBe('1050000')
      expect(detail.totalAmount).toBe('2100000')
      expect(createdInvoices).toHaveLength(1)
      expect(createdInvoices[0].subtotalAmount.toFixed(0)).toBe('2100000')
    })
  })
})
