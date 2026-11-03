/**
 * PG thật: hạ hạng một món vừa được khách trả (markUnitReady + DOWNGRADE) không được sinh khấu trừ cọc,
 * không đổi snapshot giá/cọc của đơn, không đổi reservation và không tạo khoản hoàn/thu nào.
 *
 * Mỗi kịch bản chạy trong một transaction rồi ROLLBACK: dữ liệu dựng tối thiểu sau
 * `SET LOCAL session_replication_role = replica` (chỉ tắt FK trong transaction đó; CHECK/unique vẫn kiểm).
 * Chỉ chạy khi TEST_DATABASE_URL trỏ tới DB tách riêng (khác DATABASE_URL) và user có quyền superuser.
 */
import { randomUUID } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaRentalReturnAdapter } from '../returns/infrastructure/adapters/prisma-rental-return.adapter'
import { primaryRentalInventoryLocationId } from '../shared/primary-inventory-location'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (testDatabaseUrl && testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must point to an isolated PostgreSQL test database, not DATABASE_URL')
}
const describeIfTestDb = testDatabaseUrl ? describe : describe.skip

const HOUR = 3_600_000

class Rollback extends Error {
  constructor(readonly snapshot: ScenarioResult) {
    super('rollback')
  }
}

type Fixture = {
  staffId: string
  likeNewId: string
  goodUsedId: string
  unitId: string
  returnedOrderId: string
  nextOrderId: string
}

type ScenarioResult = {
  before: any
  after: any
  unitProductGrade: string | null
  gradeReview: { decision: string; shortageOrderIds: string[] } | null
  returnedOrderStatus: string
  nextOrderExceptionStatus: string
  fixture: Fixture
}

/** Dựng một đơn vừa trả (món LIKE_NEW đang CLEANING, FINAL = NORMAL) và một đơn PAID sắp tới cần món LIKE_NEW. */
async function buildFixture(tx: Prisma.TransactionClient, depositItemStatus: 'REFUND_PENDING' | 'SETTLED') {
  const tag = randomUUID().slice(0, 8)
  const now = new Date()
  const locationId = primaryRentalInventoryLocationId()
  const policyId = randomUUID()

  const staff = await tx.user.create({
    data: {
      authUserId: randomUUID(),
      email: `gm-staff-${tag}@t.test`,
      fullName: 'Grade money staff',
      role: 'STAFF_INVENTORY',
      status: 'ACTIVE',
    },
  })
  const customerId = randomUUID()
  const category = await tx.rentalCategory.create({ data: { name: `GM ${tag}`, slug: `gm-${tag}` } })
  const gradeGroupId = randomUUID()
  const product = (grade: 'LIKE_NEW' | 'GOOD_USED', dailyPrice: number, deposit: number) =>
    tx.rentalProduct.create({
      data: {
        categoryId: category.id,
        sku: `GM-${tag}-${grade}`,
        name: `GM tent ${grade}`,
        dailyPrice,
        replacementValue: 3_000_000,
        depositPolicyType: 'FIXED',
        depositValue: deposit,
        status: 'ACTIVE',
        gradeGroupId,
        grade,
      },
    })
  const likeNew = await product('LIKE_NEW', 140_000, 900_000)
  const goodUsed = await product('GOOD_USED', 100_000, 600_000)

  const unit = await tx.equipmentUnit.create({
    data: {
      productId: likeNew.id,
      homeInventoryLocationId: locationId,
      currentInventoryLocationId: locationId,
      assetCode: `GM-${tag}-U1`,
      status: 'CLEANING',
    },
  })

  const order = async (status: 'RETURN_PROCESSING' | 'PAID', startOffsetH: number, endOffsetH: number) => {
    const rentalStartAt = new Date(now.getTime() + startOffsetH * HOUR)
    const rentalEndAt = new Date(now.getTime() + endOffsetH * HOUR)
    const created = await tx.rentalOrder.create({
      data: {
        quoteId: randomUUID(),
        rentalPolicyId: policyId,
        userId: customerId,
        tripId: randomUUID(),
        recipientSnapshot: {},
        pickupPointId: randomUUID(),
        returnPointId: randomUUID(),
        contextVersionSnapshot: 1,
        rentalStartAt,
        rentalEndAt,
        plannedHandoverAt: rentalStartAt,
        plannedReturnAt: rentalEndAt,
        occupiedStartAt: rentalStartAt,
        occupiedEndAt: new Date(rentalEndAt.getTime() + 6 * HOUR),
        rentalFee: 280_000,
        totalDeposit: 900_000,
        totalAmount: 1_180_000,
        policySnapshot: {},
        paymentExpiresAt: rentalStartAt,
        status,
        financialStatus: 'PAID',
      },
    })
    const line = await tx.rentalOrderLine.create({
      data: {
        orderId: created.id,
        productId: likeNew.id,
        quantity: 1,
        dailyPriceSnapshot: 140_000,
        depositPerUnitSnapshot: 900_000,
        replacementValueSnapshot: 3_000_000,
        chargedDays: 2,
        lineRentalFee: 280_000,
        lineDeposit: 900_000,
      },
    })
    await tx.rentalQuantityReservation.create({
      data: {
        orderLineId: line.id,
        productId: likeNew.id,
        quantity: 1,
        occupiedFrom: rentalStartAt,
        occupiedUntil: new Date(rentalEndAt.getTime() + 6 * HOUR),
        status: 'CONFIRMED',
      },
    })
    return { order: created, line }
  }

  // Đơn vừa trả: reservation còn CONFIRMED tới hết buffer.
  const returned = await order('RETURN_PROCESSING', -48, -1)
  // Đơn sắp tới cần đúng một món LIKE_NEW; hạ hạng món duy nhất sẽ làm đơn này thiếu hàng.
  const next = await order('PAID', 2, 26)

  const assignment = await tx.rentalUnitAssignment.create({
    data: {
      orderLineId: returned.line.id,
      equipmentUnitId: unit.id,
      status: 'RETURNED',
      returnedAt: new Date(now.getTime() - HOUR),
    },
  })
  await tx.returnInspection.create({
    data: {
      orderId: returned.order.id,
      assignmentId: assignment.id,
      unitId: unit.id,
      inspectorId: staff.id,
      stage: 'FINAL',
      outcome: 'NORMAL',
    },
  })
  await tx.returnInspectionTask.create({
    data: {
      orderId: returned.order.id,
      assignmentId: assignment.id,
      unitId: unit.id,
      inventoryLocationId: locationId,
      receivedAt: new Date(now.getTime() - HOUR),
      inspectionDueAt: new Date(now.getTime() + HOUR),
      status: 'COMPLETED',
    },
  })
  const settled = depositItemStatus === 'SETTLED'
  const settlement = await tx.depositSettlement.create({
    data: {
      orderId: returned.order.id,
      rentalPolicyId: policyId,
      idempotencyKey: `gm-settlement-${tag}`,
      totalDeposit: 900_000,
      refundAmount: settled ? 900_000 : 0,
      status: settled ? 'SETTLED' : 'OPEN',
      policySnapshot: {},
    },
  })
  await tx.depositSettlementItem.create({
    data: {
      settlementId: settlement.id,
      assignmentId: assignment.id,
      unitId: unit.id,
      depositAmount: 900_000,
      refundAmount: 900_000,
      status: depositItemStatus,
      outcome: 'FULL_REFUND',
    },
  })

  return {
    staffId: staff.id,
    likeNewId: likeNew.id,
    goodUsedId: goodUsed.id,
    unitId: unit.id,
    returnedOrderId: returned.order.id,
    nextOrderId: next.order.id,
  }
}

/** Mọi dữ liệu tiền/snapshot của hai đơn, đã bỏ id và thời điểm để so được giữa các lần chạy. */
async function moneySnapshot(tx: Prisma.TransactionClient, f: Fixture) {
  const grade = (productId: string) =>
    productId === f.likeNewId ? 'LIKE_NEW' : productId === f.goodUsedId ? 'GOOD_USED' : productId
  const orderIds = [f.returnedOrderId, f.nextOrderId]
  const orders = await tx.rentalOrder.findMany({
    where: { id: { in: orderIds } },
    orderBy: { rentalStartAt: 'asc' },
    select: {
      rentalFee: true,
      totalDeposit: true,
      totalAmount: true,
      financialStatus: true,
      rentalOrderLinesViaOrderId: {
        select: {
          productId: true,
          quantity: true,
          dailyPriceSnapshot: true,
          depositPerUnitSnapshot: true,
          replacementValueSnapshot: true,
          chargedDays: true,
          lineRentalFee: true,
          lineDeposit: true,
          rentalQuantityReservationsViaOrderLineId: {
            select: { productId: true, quantity: true, status: true, occupiedFrom: true, occupiedUntil: true },
          },
        },
      },
      depositSettlementViaOrderId: {
        select: {
          totalDeposit: true,
          totalDeduction: true,
          refundAmount: true,
          status: true,
          outcome: true,
          depositSettlementItemsViaSettlementId: {
            select: { depositAmount: true, deductionAmount: true, refundAmount: true, status: true, outcome: true },
          },
        },
      },
    },
  })
  const [refunds, exceptionCases, moneyEvents] = await Promise.all([
    tx.refund.count({ where: { rentalOrderId: { in: orderIds } } }),
    tx.rentalExceptionCase.count({ where: { orderId: { in: orderIds } } }),
    tx.rentalOutboxEvent.findMany({
      where: { aggregateId: { in: orderIds }, eventType: { not: 'RENTAL_ACTION_REQUIRED' } },
      select: { eventType: true },
      orderBy: { eventType: 'asc' },
    }),
  ])
  return JSON.parse(
    JSON.stringify({
      orders: orders.map((o) => ({
        ...o,
        rentalOrderLinesViaOrderId: o.rentalOrderLinesViaOrderId.map((l) => ({
          ...l,
          productId: grade(l.productId),
          rentalQuantityReservationsViaOrderLineId: l.rentalQuantityReservationsViaOrderLineId.map((r) => ({
            ...r,
            productId: grade(r.productId),
            occupiedFrom: undefined,
            occupiedUntil: undefined,
            durationMs: r.occupiedUntil.getTime() - r.occupiedFrom.getTime(),
          })),
        })),
      })),
      refunds,
      exceptionCases,
      moneyEvents: moneyEvents.map((e) => e.eventType),
    }),
  )
}

describeIfTestDb('Grade downgrade money invariants — PostgreSQL', () => {
  jest.setTimeout(120_000)

  let db: PrismaClient
  let pool: Pool

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl })
    db = new PrismaClient({ adapter: new PrismaPg(pool) })
    await db.$connect()
  })

  afterAll(async () => {
    await db?.$disconnect()
    await pool?.end()
  })

  async function runScenario(
    decision: 'KEEP' | 'DOWNGRADE',
    depositItemStatus: 'REFUND_PENDING' | 'SETTLED',
  ): Promise<ScenarioResult> {
    try {
      await db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica')
          const fixture = await buildFixture(tx, depositItemStatus)
          const before = await moneySnapshot(tx, fixture)
          // Adapter chạy trong chính transaction này để rollback được toàn bộ.
          const adapter = new PrismaRentalReturnAdapter({ $transaction: (work: any) => work(tx) } as any)
          const result = await adapter.markUnitReady({
            actorUserId: fixture.staffId,
            unitId: fixture.unitId,
            accessoriesChecked: true,
            expectedVersion: 1,
            gradeDecision:
              decision === 'DOWNGRADE' ? { decision: 'DOWNGRADE', reason: 'Vải lều bạc màu' } : { decision: 'KEEP' },
            idempotencyKey: `gm-ready-${randomUUID()}`,
            now: new Date(),
          })
          const after = await moneySnapshot(tx, fixture)
          const [unit, returnedOrder, nextOrder] = await Promise.all([
            tx.equipmentUnit.findUniqueOrThrow({ where: { id: fixture.unitId }, select: { productId: true } }),
            tx.rentalOrder.findUniqueOrThrow({ where: { id: fixture.returnedOrderId }, select: { status: true } }),
            tx.rentalOrder.findUniqueOrThrow({ where: { id: fixture.nextOrderId }, select: { exceptionStatus: true } }),
          ])
          throw new Rollback({
            before,
            after,
            unitProductGrade:
              unit.productId === fixture.likeNewId
                ? 'LIKE_NEW'
                : unit.productId === fixture.goodUsedId
                  ? 'GOOD_USED'
                  : null,
            gradeReview: result.gradeReview,
            returnedOrderStatus: returnedOrder.status,
            nextOrderExceptionStatus: nextOrder.exceptionStatus,
            fixture,
          })
        },
        { timeout: 60_000 },
      )
    } catch (error) {
      if (error instanceof Rollback) return error.snapshot
      throw error
    }
    throw new Error('scenario did not roll back')
  }

  it('downgrading a just-returned unit keeps deposit, order snapshot and reservations unchanged', async () => {
    const run = await runScenario('DOWNGRADE', 'REFUND_PENDING')

    // Hạ hạng thật sự xảy ra và gây thiếu hàng cho đơn sắp tới.
    expect(run.unitProductGrade).toBe('GOOD_USED')
    expect(run.gradeReview).toMatchObject({ decision: 'DOWNGRADE', shortageOrderIds: [run.fixture.nextOrderId] })
    expect(run.nextOrderExceptionStatus).toBe('ACTION_REQUIRED')

    // Nhưng không có gì về tiền thay đổi: dòng đơn vẫn LIKE_NEW với giá/cọc cũ, cọc không bị khấu trừ.
    expect(run.after).toEqual(run.before)
    const returnedLine = run.after.orders[0].rentalOrderLinesViaOrderId[0]
    expect(returnedLine).toMatchObject({
      productId: 'LIKE_NEW',
      dailyPriceSnapshot: '140000',
      depositPerUnitSnapshot: '900000',
    })
    expect(run.after.orders[0].depositSettlementViaOrderId.depositSettlementItemsViaSettlementId[0]).toMatchObject({
      deductionAmount: '0',
      refundAmount: '900000',
    })
    expect(run.after.refunds).toBe(0)
    expect(run.after.moneyEvents).toEqual([])
  })

  it('order completion after the return is identical for KEEP and DOWNGRADE', async () => {
    const keep = await runScenario('KEEP', 'SETTLED')
    const downgrade = await runScenario('DOWNGRADE', 'SETTLED')

    expect(keep.unitProductGrade).toBe('LIKE_NEW')
    expect(downgrade.unitProductGrade).toBe('GOOD_USED')
    // Đơn vừa trả hoàn tất như nhau; hạ hạng không chặn hay đổi kết quả quyết toán.
    expect(keep.returnedOrderStatus).toBe('COMPLETED')
    expect(downgrade.returnedOrderStatus).toBe('COMPLETED')
    expect(downgrade.after).toEqual(keep.after)
  })
})
