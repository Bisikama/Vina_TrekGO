/**
 * PG thật: receipt theo consumer cho thông báo từ rental_outbox_events.
 * Trước đây consumer chỉ đọc 25 event mới nhất nên event cũ hơn không bao giờ được gửi khi có > 25 event.
 * Dùng event_type riêng có tag để không đụng dữ liệu khác; dọn ở afterAll.
 */
import { randomUUID } from 'node:crypto'
import { Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import {
  drainNotificationOutbox,
  SLOW_RETRY_AFTER_ATTEMPTS,
  NOTIFICATION_OUTBOX_SOURCES,
  NotificationOutboxEvent,
} from './notification-outbox-drain'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (testDatabaseUrl && testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must point to an isolated PostgreSQL test database, not DATABASE_URL')
}
const describeIfTestDb = testDatabaseUrl ? describe : describe.skip

describeIfTestDb('Notification outbox drain — PostgreSQL receipts', () => {
  jest.setTimeout(120_000)
  let db: PrismaClient
  let pool: Pool
  const tag = randomUUID().slice(0, 8).toUpperCase()
  const consumer = `test-notifications-${tag}`
  const logger = new Logger('drain-test')
  logger.warn = jest.fn() as any

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl })
    db = new PrismaClient({ adapter: new PrismaPg(pool) })
    await db.$connect()
  })

  afterAll(async () => {
    if (db) {
      await db.$executeRaw`DELETE FROM rental_notification_receipts WHERE consumer LIKE ${`${consumer}%`}`
      await db.rentalOutboxEvent.deleteMany({ where: { eventType: { startsWith: `TEST_NOTIF_${tag}` } } })
      await db.$disconnect()
    }
    await pool?.end()
  })

  async function seed(eventType: string, count: number, base = Date.now() - 60_000) {
    const rows = Array.from({ length: count }, (_, i) => ({
      id: randomUUID(),
      deduplicationKey: `${eventType}:${i}:${randomUUID()}`,
      eventType,
      aggregateType: 'RentalOrder',
      aggregateId: randomUUID(),
      payload: { i },
      // Mỗi event cách nhau 1ms để thứ tự cũ → mới xác định.
      createdAt: new Date(base + i),
      // Status của outbox không được ảnh hưởng tới việc gửi thông báo.
      status: i % 2 ? ('PROCESSED' as const) : ('PENDING' as const),
    }))
    await db.rentalOutboxEvent.createMany({ data: rows })
    return rows.map((r) => r.id)
  }

  const drain = (eventType: string, deliver: (e: NotificationOutboxEvent) => Promise<void>) =>
    drainNotificationOutbox({
      db: db as any,
      source: NOTIFICATION_OUTBOX_SOURCES.rental,
      consumer,
      eventTypes: [eventType],
      deliver,
      logger,
    })

  const receipts = (ids: string[]) =>
    db.$queryRaw<{ event_id: string; completed_at: Date | null; attempts: number; last_error: string | null }[]>`
      SELECT event_id::text, completed_at, attempts, last_error FROM rental_notification_receipts
      WHERE consumer = ${consumer} AND event_id = ANY(${ids}::uuid[])`

  it('drains more than one batch, oldest first, and never delivers an event twice', async () => {
    const type = `TEST_NOTIF_${tag}_BULK`
    const ids = await seed(type, 130)
    const delivered: string[] = []
    const deliver = async (e: NotificationOutboxEvent) => {
      delivered.push(e.id)
    }

    expect(await drain(type, deliver)).toBe(100)
    expect(delivered).toEqual(ids.slice(0, 100))
    expect(await drain(type, deliver)).toBe(30)
    expect(await drain(type, deliver)).toBe(0)
    expect(delivered).toEqual(ids)
    expect((await receipts(ids)).filter((r) => r.completed_at)).toHaveLength(130)
  })

  it('backs off a failing event without blocking others, then retries it once due', async () => {
    const type = `TEST_NOTIF_${tag}_RETRY`
    const [bad, good] = await seed(type, 2)
    let fail = true
    const calls: string[] = []
    const deliver = async (e: NotificationOutboxEvent) => {
      calls.push(e.id)
      if (e.id === bad && fail) throw new Error('RENTAL_SCHEDULE_NOTICE_INVALID')
    }

    expect(await drain(type, deliver)).toBe(1)
    const [badReceipt] = await receipts([bad])
    expect(badReceipt).toMatchObject({ completed_at: null, attempts: 1, last_error: 'RENTAL_SCHEDULE_NOTICE_INVALID' })
    expect((await receipts([good]))[0].completed_at).not.toBeNull()

    // Đang trong backoff: không gọi lại ngay.
    expect(await drain(type, deliver)).toBe(0)
    expect(calls.filter((id) => id === bad)).toHaveLength(1)

    fail = false
    await db.$executeRaw`UPDATE rental_notification_receipts SET next_attempt_at = now() - interval '1 second'
      WHERE consumer = ${consumer} AND event_id = ${bad}::uuid`
    expect(await drain(type, deliver)).toBe(1)
    expect((await receipts([bad]))[0]).toMatchObject({ attempts: 2, last_error: null })
    expect(calls.filter((id) => id === good)).toHaveLength(1)
  })

  it('only picks the requested event types and ignores receipts of other consumers', async () => {
    const wanted = `TEST_NOTIF_${tag}_WANTED`
    const other = `TEST_NOTIF_${tag}_OTHER`
    const [wantedId] = await seed(wanted, 1)
    const [otherId] = await seed(other, 1)
    // Consumer khác đã xử lý xong event này: không được chặn consumer đang test.
    await db.$executeRaw`INSERT INTO rental_notification_receipts (event_id, consumer, completed_at, attempts)
      VALUES (${wantedId}::uuid, ${`${consumer}-other`}, now(), 1)`
    const delivered: string[] = []
    expect(await drain(wanted, async (e) => void delivered.push(e.id))).toBe(1)
    expect(delivered).toEqual([wantedId])
    expect(await receipts([otherId])).toHaveLength(0)
  })

  it('switches to hourly retries after repeated failures, skips events older than 3 days, hides raw errors', async () => {
    const type = `TEST_NOTIF_${tag}_SLOW`
    const [slow] = await seed(type, 1)
    const [stale] = await seed(type, 1, Date.now() - 4 * 24 * 3_600_000)
    // Đã lỗi đủ số lần để vào chế độ thử thưa nhưng tới hạn: vẫn phải được thử (không còn bị bỏ hẳn).
    await db.$executeRaw`INSERT INTO rental_notification_receipts (event_id, consumer, attempts, next_attempt_at, last_error)
      VALUES (${slow}::uuid, ${consumer}, ${SLOW_RETRY_AFTER_ATTEMPTS}, now() - interval '1 second', 'DELIVERY_FAILED')`
    const calls: string[] = []
    await drain(type, async (e) => {
      calls.push(e.id)
      throw new Error('duplicate key value violates unique constraint "x" (email=a@b.c)')
    })
    expect(calls).toEqual([slow])
    const [row] = await db.$queryRaw<{ attempts: number; last_error: string; hourly: boolean }[]>`
      SELECT attempts, last_error,
        (next_attempt_at - now() BETWEEN interval '59 minutes' AND interval '61 minutes') AS hourly
      FROM rental_notification_receipts WHERE consumer = ${consumer} AND event_id = ${slow}::uuid`
    expect(row).toEqual({ attempts: SLOW_RETRY_AFTER_ATTEMPTS + 1, last_error: 'DELIVERY_FAILED', hourly: true })
    expect((await receipts([stale])).length).toBe(0)

    // Hạ tầng hồi phục: lần thử kế tiếp gửi được và hoàn tất.
    await db.$executeRaw`UPDATE rental_notification_receipts SET next_attempt_at = now() - interval '1 second'
      WHERE consumer = ${consumer} AND event_id = ${slow}::uuid`
    await drain(type, async () => {})
    expect((await receipts([slow]))[0].completed_at).not.toBeNull()
  })
})
