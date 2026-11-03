/**
 * PG thật: nhắc staff khi đơn vẫn thiếu hàng do hạ hạng và sắp tới giờ nhận đồ.
 * Chạy trong một transaction rồi ROLLBACK; dữ liệu tối thiểu sau `SET LOCAL session_replication_role = replica`.
 */
import { randomUUID } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { emitGradeShortageDeadlineAlerts } from './infrastructure/grade-shortage-deadline'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (testDatabaseUrl && testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must point to an isolated PostgreSQL test database, not DATABASE_URL')
}
const describeIfTestDb = testDatabaseUrl ? describe : describe.skip
const HOUR = 3_600_000

class Rollback extends Error {
  constructor(readonly result: unknown) {
    super('rollback')
  }
}

describeIfTestDb('Grade shortage handover deadline — PostgreSQL', () => {
  jest.setTimeout(60_000)
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

  async function order(
    tx: Prisma.TransactionClient,
    now: Date,
    opts: {
      startInHours: number
      status?: 'PENDING_PAYMENT' | 'PAID' | 'PREPARING' | 'ACTIVE'
      exception?: 'ACTION_REQUIRED' | 'NONE'
    },
  ) {
    const start = new Date(now.getTime() + opts.startInHours * HOUR)
    const end = new Date(start.getTime() + 48 * HOUR)
    const created = await tx.rentalOrder.create({
      data: {
        quoteId: randomUUID(),
        rentalPolicyId: randomUUID(),
        userId: randomUUID(),
        tripId: randomUUID(),
        recipientSnapshot: {},
        pickupPointId: randomUUID(),
        returnPointId: randomUUID(),
        contextVersionSnapshot: 1,
        rentalStartAt: start,
        rentalEndAt: end,
        plannedHandoverAt: start,
        plannedReturnAt: end,
        occupiedStartAt: start,
        occupiedEndAt: end,
        rentalFee: 100_000,
        totalDeposit: 600_000,
        totalAmount: 700_000,
        policySnapshot: {},
        paymentExpiresAt: start,
        status: opts.status ?? 'PAID',
        financialStatus: 'PAID',
        exceptionStatus: opts.exception ?? 'ACTION_REQUIRED',
      },
    })
    return created.id
  }

  const shortage = (
    tx: Prisma.TransactionClient,
    orderId: string,
    reviewId: string,
    reason = 'GRADE_DOWNGRADE_CAPACITY_SHORTAGE',
    createdAt?: Date,
  ) =>
    tx.rentalOutboxEvent.create({
      data: {
        deduplicationKey: `grade-downgrade-shortage:${orderId}:${reviewId}`,
        eventType: 'RENTAL_ACTION_REQUIRED',
        aggregateType: 'RentalOrder',
        aggregateId: orderId,
        payload: { orderId, reason, gradeReviewId: reviewId },
        ...(createdAt ? { createdAt } : {}),
      },
    })

  it('alerts once per shortage for pre-handover orders near pickup, and skips everything else', async () => {
    let outcome: any
    try {
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica')
        const now = new Date((await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now)
        const near = await order(tx, now, { startInHours: 10 })
        const far = await order(tx, now, { startInHours: 30 })
        const resolved = await order(tx, now, { startInHours: 10, exception: 'NONE' })
        const handedOver = await order(tx, now, { startInHours: 10, status: 'ACTIVE' })
        const otherReason = await order(tx, now, { startInHours: 10 })
        const unpaid = await order(tx, now, { startInHours: 10, status: 'PENDING_PAYMENT' })
        const startPassed = await order(tx, now, { startInHours: -2, status: 'PREPARING' })
        const reviewA = randomUUID()
        for (const id of [near, far, resolved, handedOver, unpaid, startPassed])
          await shortage(tx, id, id === near ? reviewA : randomUUID())
        await shortage(tx, otherReason, randomUUID(), 'RESCHEDULE_CAPACITY_CONFLICT')

        const first = await emitGradeShortageDeadlineAlerts(tx, { now, alertHours: 24 })
        const second = await emitGradeShortageDeadlineAlerts(tx, { now, alertHours: 24 })
        // Hạ hạng lần nữa cho cùng đơn → một lần thiếu mới → được nhắc thêm một lần.
        const reviewB = randomUUID()
        await shortage(tx, near, reviewB, undefined, new Date(now.getTime() + 60_000))
        const third = await emitGradeShortageDeadlineAlerts(tx, { now, alertHours: 24 })
        const alerts = await tx.rentalOutboxEvent.findMany({
          where: { aggregateId: near, deduplicationKey: { startsWith: 'grade-shortage-deadline:' } },
        })
        throw new Rollback({ startPassed, near, first, second, third, alerts, reviewA, reviewB })
      })
    } catch (error) {
      if (!(error instanceof Rollback)) throw error
      outcome = error.result
    }

    // Đơn đã quá giờ nhận nhưng chưa bàn giao vẫn được nhắc (PENDING_PAYMENT thì không).
    expect(outcome.first).toEqual([outcome.startPassed, outcome.near])
    expect(outcome.second).toEqual([])
    expect(outcome.third).toEqual([outcome.near])
    expect(outcome.alerts.map((a: any) => a.deduplicationKey).sort()).toEqual(
      [
        `grade-shortage-deadline:${outcome.near}:${outcome.reviewA}`,
        `grade-shortage-deadline:${outcome.near}:${outcome.reviewB}`,
      ].sort(),
    )
    for (const alert of outcome.alerts)
      expect(alert).toMatchObject({
        eventType: 'RENTAL_ACTION_REQUIRED',
        payload: expect.objectContaining({ kind: 'GRADE_SHORTAGE_HANDOVER_DEADLINE', alertHours: 24 }),
      })
  })
})
