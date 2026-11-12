/**
 * PG thật: thứ tự SQL của hàng đợi kho phải khớp preparationTaskRank (JS).
 * Chạy trên dữ liệu VALUES, không ghi bảng nào. Chỉ chạy khi có TEST_DATABASE_URL.
 */
import { randomUUID } from 'node:crypto'
import { InventoryTaskStatus, Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { preparationTaskRank } from './domain/preparation-task-priority'
import { PREPARATION_TASK_ORDER_BY_SQL } from './infrastructure/adapters/prisma-preparation-task.adapter'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const describeIfTestDb = testDatabaseUrl ? describe : describe.skip

describeIfTestDb('Preparation queue order — PostgreSQL', () => {
  jest.setTimeout(60_000)
  let pool: Pool
  let db: PrismaClient

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl })
    db = new PrismaClient({ adapter: new PrismaPg(pool) })
    await db.$connect()
  })

  afterAll(async () => {
    await db?.$disconnect()
    await pool?.end()
  })

  it('SQL ORDER BY khớp hạng JS, deadline null xếp cuối nhóm, cùng deadline theo lúc tới kho', async () => {
    const now = new Date()
    const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000)
    const rows = [
      { status: InventoryTaskStatus.CLOSED, deadline: at(-48), createdAt: at(-50) },
      { status: InventoryTaskStatus.READY, deadline: at(5), createdAt: at(-10) },
      { status: InventoryTaskStatus.OPEN, deadline: null, createdAt: at(-9) },
      { status: InventoryTaskStatus.OPEN, deadline: at(24), createdAt: at(-3) },
      { status: InventoryTaskStatus.PICKING, deadline: at(24), createdAt: at(-8) },
      { status: InventoryTaskStatus.PACKED, deadline: at(-24), createdAt: at(-7) },
      { status: InventoryTaskStatus.OPEN, deadline: at(-2), createdAt: at(-6) },
      { status: InventoryTaskStatus.BLOCKED, deadline: at(48), createdAt: at(-5) },
      { status: InventoryTaskStatus.TRANSFERRED, deadline: null, createdAt: at(-4) },
    ].map((row) => ({ ...row, id: randomUUID() }))

    const values = Prisma.join(
      rows.map(
        (r) =>
          Prisma.sql`(${r.id}::uuid, ${r.status}::inventory_task_status, ${r.deadline}::timestamptz, ${r.createdAt}::timestamptz)`,
      ),
    )
    const sqlOrder = await db.$queryRaw<Array<{ id: string }>>`
      SELECT t.id::text AS id
      FROM (VALUES ${values}) AS t(id, status, deadline, created_at)
      ORDER BY ${PREPARATION_TASK_ORDER_BY_SQL}`

    const jsOrder = [...rows].sort(
      (a, b) =>
        preparationTaskRank(a.status, a.deadline, now) - preparationTaskRank(b.status, b.deadline, now) ||
        (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )

    expect(sqlOrder.map((r) => r.id)).toEqual(jsOrder.map((r) => r.id))
    expect(jsOrder.map((r) => r.status)).toEqual([
      InventoryTaskStatus.BLOCKED,
      InventoryTaskStatus.PACKED, // trễ 24 giờ
      InventoryTaskStatus.OPEN, // trễ 2 giờ
      InventoryTaskStatus.PICKING, // cùng deadline, tới kho sớm hơn
      InventoryTaskStatus.OPEN,
      InventoryTaskStatus.OPEN, // không có deadline
      InventoryTaskStatus.READY,
      InventoryTaskStatus.TRANSFERRED,
      InventoryTaskStatus.CLOSED,
    ])
  })
})
