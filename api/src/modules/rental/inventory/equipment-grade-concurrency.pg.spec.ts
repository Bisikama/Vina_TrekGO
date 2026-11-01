/**
 * PG thật, hai transaction song song: hạ hạng món LIKE_NEW cuối cùng vs tạo order cho chính món đó.
 * Chỉ chạy khi TEST_DATABASE_URL trỏ tới DB tách riêng (khác DATABASE_URL). Dữ liệu được dọn ở afterAll.
 *
 * Bất biến: không bao giờ có order mới mà không ai biết là thiếu hàng.
 * - order thắng khoá sản phẩm trước → hạ hạng thấy thiếu → order ACTION_REQUIRED + outbox.
 * - hạ hạng thắng trước → createOrder bị từ chối INSUFFICIENT_AVAILABLE_QUANTITY.
 */
import { randomUUID } from 'node:crypto'
import { PrismaClient, RentalGrade } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaEquipmentUnitAdapter } from './infrastructure/adapters/prisma-equipment-unit.adapter'
import { PrismaRentalOrderAdapter } from '../ordering/infrastructure/adapters/prisma-rental-order.adapter'
import { rentalOccupiedFrom } from '../ordering/application/services/rental-ordering.rules'
import { primaryRentalInventoryLocationId } from '../shared/primary-inventory-location'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (testDatabaseUrl && testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must point to an isolated PostgreSQL test database, not DATABASE_URL')
}
const describeIfTestDb = testDatabaseUrl ? describe : describe.skip

describeIfTestDb('Grade downgrade vs create order — PostgreSQL concurrency', () => {
  jest.setTimeout(120_000)

  let db: PrismaClient
  let pool: Pool
  let unitAdapter: PrismaEquipmentUnitAdapter
  let orderAdapter: PrismaRentalOrderAdapter
  const tag = randomUUID().slice(0, 8)
  const created = {
    users: [] as string[],
    products: [] as string[],
    quotes: [] as string[],
    units: [] as string[],
    categoryId: '',
    destinationId: '',
    pickupPointId: '',
    tripId: '',
    policyId: '',
    locationCreated: false,
  }
  let staffId = ''
  let locationId = ''

  // Context giả khớp với quote: test tập trung vào khoá sản phẩm và kiểm số lượng, không phải membership Area A.
  const contextPort = {
    lockAndRead: jest.fn(async (_tx: unknown, tripId: string, userId: string) => ({
      userId,
      trip: { id: tripId },
      membershipKind: null,
      membershipRef: null,
      membershipSourceVersion: null,
      contextVersion: 1,
      rentalEligible: true,
      membershipStatus: 'ACTIVE',
      rentalCutoffAt: new Date(Date.now() + 30 * 24 * 3_600_000),
    })),
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl })
    db = new PrismaClient({ adapter: new PrismaPg(pool) })
    await db.$connect()
    unitAdapter = new PrismaEquipmentUnitAdapter(db as any)
    orderAdapter = new PrismaRentalOrderAdapter(db as any, contextPort as any)

    locationId = primaryRentalInventoryLocationId()
    const existing = await db.inventoryLocation.findUnique({ where: { id: locationId } })
    if (!existing) {
      await db.inventoryLocation.create({
        data: { id: locationId, code: `INV-GC-${tag}`, name: 'Grade concurrency', address: 'test', status: 'ACTIVE' },
      })
      created.locationCreated = true
    }
    const staff = await db.user.create({
      data: {
        authUserId: randomUUID(),
        email: `gc-staff-${tag}@t.test`,
        fullName: 'GC Staff',
        role: 'STAFF_INVENTORY',
      },
    })
    staffId = staff.id
    created.users.push(staff.id)
    const destination = await db.destination.create({ data: { name: `GC dest ${tag}` } })
    created.destinationId = destination.id
    const pickup = await db.pickupPoint.create({
      data: {
        code: `GC-${tag}`,
        name: 'GC point',
        address: 'test',
        latitude: 10.7,
        longitude: 106.6,
        createdBy: staff.id,
      },
    })
    created.pickupPointId = pickup.id
    const startAt = new Date(Date.now() + 7 * 24 * 3_600_000)
    const trip = await db.trip.create({
      data: {
        tripType: 'PUBLIC',
        title: `GC trip ${tag}`,
        destinationId: destination.id,
        creatorId: staff.id,
        startAt,
        endAt: new Date(startAt.getTime() + 48 * 3_600_000),
        maxPax: 10,
      },
    })
    created.tripId = trip.id
    const policy = await db.rentalPolicy.create({
      data: {
        policyCode: `GC_${tag}`,
        versionNo: 1,
        quoteTtlMinutes: 15,
        paymentHoldMinutes: 15,
        cutoffHoursBeforeTrip: 24,
        cancellationRules: [],
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      },
    })
    created.policyId = policy.id
    const category = await db.rentalCategory.create({ data: { name: `GC cat ${tag}`, slug: `gc-cat-${tag}` } })
    created.categoryId = category.id
  })

  afterAll(async () => {
    if (!db) return
    const orders = await db.rentalOrder.findMany({ where: { tripId: created.tripId }, select: { id: true } })
    const orderIds = orders.map((o) => o.id)
    const invoices = await db.invoice.findMany({ where: { rentalOrderId: { in: orderIds } }, select: { id: true } })
    await db.invoiceLine.deleteMany({ where: { invoiceId: { in: invoices.map((i) => i.id) } } })
    await db.invoice.deleteMany({ where: { rentalOrderId: { in: orderIds } } })
    await db.rentalOutboxEvent.deleteMany({ where: { aggregateId: { in: orderIds } } })
    await db.rentalQuantityReservation.deleteMany({ where: { productId: { in: created.products } } })
    await db.rentalOrderLine.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.rentalOrder.deleteMany({ where: { id: { in: orderIds } } })
    await db.rentalCapacityAlert.deleteMany({ where: { productId: { in: created.products } } })
    await db.equipmentGradeReview.deleteMany({ where: { unitId: { in: created.units } } })
    await db.auditLog.deleteMany({ where: { entityId: { in: created.units } } })
    await db.rentalQuoteLine.deleteMany({ where: { quoteId: { in: created.quotes } } })
    await db.rentalQuote.deleteMany({ where: { id: { in: created.quotes } } })
    await db.equipmentUnit.deleteMany({ where: { id: { in: created.units } } })
    await db.rentalProduct.deleteMany({ where: { id: { in: created.products } } })
    await db.rentalCategory.deleteMany({ where: { id: created.categoryId } })
    await db.rentalPolicy.deleteMany({ where: { id: created.policyId } })
    await db.trip.deleteMany({ where: { id: created.tripId } })
    await db.pickupPoint.deleteMany({ where: { id: created.pickupPointId } })
    await db.destination.deleteMany({ where: { id: created.destinationId } })
    await db.idempotencyRecord.deleteMany({ where: { userId: { in: created.users } } })
    await db.user.deleteMany({ where: { id: { in: created.users } } })
    if (created.locationCreated) await db.inventoryLocation.deleteMany({ where: { id: locationId } })
    await db.$disconnect()
    await pool.end()
  })

  /** Một cặp hạng mới, đúng 1 unit LIKE_NEW AVAILABLE, và một quote ACTIVE thuê đúng 1 món đó. */
  async function arrange(i: number) {
    const group = randomUUID()
    const mk = (grade: RentalGrade, price: number, deposit: number) =>
      db.rentalProduct.create({
        data: {
          categoryId: created.categoryId,
          sku: `GC-${tag}-${i}-${grade}`,
          name: `GC ${grade}`,
          dailyPrice: price,
          replacementValue: 3_000_000,
          depositValue: deposit,
          gradeGroupId: group,
          grade,
        },
      })
    const likeNew = await mk(RentalGrade.LIKE_NEW, 140_000, 900_000)
    const goodUsed = await mk(RentalGrade.GOOD_USED, 100_000, 600_000)
    created.products.push(likeNew.id, goodUsed.id)
    const unit = await db.equipmentUnit.create({
      data: {
        productId: likeNew.id,
        homeInventoryLocationId: locationId,
        currentInventoryLocationId: locationId,
        assetCode: `GC-${tag}-${i}`,
      },
    })
    created.units.push(unit.id)
    const renter = await db.user.create({
      data: { authUserId: randomUUID(), email: `gc-renter-${tag}-${i}@t.test`, fullName: 'GC Renter' },
    })
    created.users.push(renter.id)
    const rentalStartAt = new Date(Date.now() + 7 * 24 * 3_600_000)
    const rentalEndAt = new Date(rentalStartAt.getTime() + 48 * 3_600_000)
    const quote = await db.rentalQuote.create({
      data: {
        userId: renter.id,
        tripId: created.tripId,
        pickupPointId: created.pickupPointId,
        returnPointId: created.pickupPointId,
        recipientSnapshot: {},
        contextVersion: 1,
        rentalPolicyId: created.policyId,
        rentalStartAt,
        rentalEndAt,
        plannedHandoverAt: rentalStartAt,
        plannedReturnAt: rentalEndAt,
        occupiedStartAt: rentalOccupiedFrom(rentalStartAt),
        occupiedEndAt: new Date(rentalEndAt.getTime() + 24 * 3_600_000),
        rentalFee: 280_000,
        totalDeposit: 900_000,
        totalAmount: 1_180_000,
        policySnapshot: {},
        expiresAt: new Date(Date.now() + 15 * 60_000),
        rentalQuoteLinesViaQuoteId: {
          create: [
            {
              productId: likeNew.id,
              quantity: 1,
              dailyPriceSnapshot: 140_000,
              depositPerUnitSnapshot: 900_000,
              replacementValueSnapshot: 3_000_000,
              chargedDays: 2,
              lineRentalFee: 280_000,
              lineDeposit: 900_000,
            },
          ],
        },
      },
    })
    created.quotes.push(quote.id)
    const downgrade = () =>
      unitAdapter.downgradeGrade({
        unitId: unit.id,
        expectedVersion: unit.version,
        actorId: staffId,
        idempotencyKey: `gc-down-${tag}-${i}`,
        reason: 'Vải lều bạc màu',
      })
    const createOrder = () =>
      orderAdapter.createOrder({
        userId: renter.id,
        quoteId: quote.id,
        idempotencyKey: `gc-order-${tag}-${i}`,
        now: new Date(),
      })
    return { likeNew, goodUsed, unit, renter, downgrade, createOrder }
  }

  /** Kiểm bất biến sau khi cả hai thao tác xong, bất kể ai thắng. */
  async function assertInvariant(
    a: Awaited<ReturnType<typeof arrange>>,
    down: PromiseSettledResult<Awaited<ReturnType<PrismaEquipmentUnitAdapter['downgradeGrade']>>>,
    order: PromiseSettledResult<Awaited<ReturnType<PrismaRentalOrderAdapter['createOrder']>>>,
  ): Promise<'ORDER_FIRST' | 'DOWNGRADE_FIRST'> {
    expect(down.status).toBe('fulfilled')
    const unit = await db.equipmentUnit.findUniqueOrThrow({ where: { id: a.unit.id } })
    expect(unit.productId).toBe(a.goodUsed.id)

    if (order.status === 'fulfilled') {
      const orderId = order.value.order.id
      const row = await db.rentalOrder.findUniqueOrThrow({ where: { id: orderId } })
      expect(row.exceptionStatus).toBe('ACTION_REQUIRED')
      expect(down.status === 'fulfilled' && down.value.gradeReview.shortageOrderIds).toEqual([orderId])
      const events = await db.rentalOutboxEvent.count({
        where: { aggregateId: orderId, eventType: 'RENTAL_ACTION_REQUIRED' },
      })
      expect(events).toBe(1)
      return 'ORDER_FIRST'
    }
    expect((order.reason as { code?: string }).code).toBe('INSUFFICIENT_AVAILABLE_QUANTITY')
    expect(await db.rentalOrder.count({ where: { userId: a.renter.id } })).toBe(0)
    if (down.status === 'fulfilled') expect(down.value.gradeReview.shortageOrderIds).toEqual([])
    return 'DOWNGRADE_FIRST'
  }

  it('order trước rồi hạ hạng: đơn được đánh dấu ACTION_REQUIRED', async () => {
    const a = await arrange(1)
    const order = await Promise.allSettled([a.createOrder()])
    const down = await Promise.allSettled([a.downgrade()])
    await expect(assertInvariant(a, down[0], order[0])).resolves.toBe('ORDER_FIRST')
  })

  it('hạ hạng trước rồi order: order bị từ chối vì hết hàng', async () => {
    const a = await arrange(2)
    const down = await Promise.allSettled([a.downgrade()])
    const order = await Promise.allSettled([a.createOrder()])
    await expect(assertInvariant(a, down[0], order[0])).resolves.toBe('DOWNGRADE_FIRST')
  })

  it('chạy song song nhiều lần: luôn giữ bất biến, không deadlock', async () => {
    const outcomes: string[] = []
    // createOrder làm nhiều bước trước khi khoá sản phẩm; cho hạ hạng khởi động trễ dần để cả hai phía đều có lúc thắng khoá.
    const delaysMs = [0, 0, 10, 20, 30, 40, 60, 80, 120, 160]
    for (const [k, delay] of delaysMs.entries()) {
      const a = await arrange(10 + k)
      const [order, down] = await Promise.allSettled([
        a.createOrder(),
        new Promise((r) => setTimeout(r, delay)).then(() => a.downgrade()),
      ])
      outcomes.push(await assertInvariant(a, down, order))
    }
    expect(outcomes).toHaveLength(delaysMs.length)
    if (process.env.GRADE_RACE_DEBUG) console.log('race outcomes:', outcomes.join(', '))
  })
})
