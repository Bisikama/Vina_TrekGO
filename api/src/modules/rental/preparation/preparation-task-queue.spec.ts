import { InventoryTaskStatus } from '@prisma/client'
import { preparationTaskPriority, preparationTaskRank } from './domain/preparation-task-priority'
import { PrismaPreparationTaskAdapter } from './infrastructure/adapters/prisma-preparation-task.adapter'

const NOW = new Date('2026-11-11T05:00:00.000Z')
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000)

describe('preparationTaskPriority', () => {
  it.each([
    [InventoryTaskStatus.BLOCKED, null, 'URGENT', false],
    [InventoryTaskStatus.OPEN, minutes(-1), 'URGENT', true],
    [InventoryTaskStatus.PACKED, minutes(-30), 'URGENT', true],
    [InventoryTaskStatus.PICKING, minutes(120), 'HIGH', false],
    [InventoryTaskStatus.OPEN, minutes(121), 'NORMAL', false],
    [InventoryTaskStatus.OPEN, null, 'NORMAL', false],
    [InventoryTaskStatus.READY, minutes(-60), 'LOW', false],
    [InventoryTaskStatus.CLOSED, minutes(-60), 'LOW', false],
  ] as const)('%s, deadline %s → %s (overdue %s)', (status, deadline, priority, isOverdue) => {
    expect(preparationTaskPriority(status, deadline, NOW)).toEqual({ priority, isOverdue })
  })

  it('xếp BLOCKED → trễ hạn → đang chờ → kho đã xong → đã kết thúc', () => {
    const ranks = [
      preparationTaskRank(InventoryTaskStatus.BLOCKED, null, NOW),
      preparationTaskRank(InventoryTaskStatus.OPEN, minutes(-5), NOW),
      preparationTaskRank(InventoryTaskStatus.OPEN, minutes(5), NOW),
      preparationTaskRank(InventoryTaskStatus.TRANSFERRED, null, NOW),
      preparationTaskRank(InventoryTaskStatus.CANCELLED, null, NOW),
    ]
    expect(ranks).toEqual([0, 1, 2, 3, 4])
  })
})

describe('PrismaPreparationTaskAdapter.listTasks', () => {
  const task = (id: string, status: InventoryTaskStatus, deadline: Date | null, createdAt: Date) => ({
    id,
    orderId: `order-${id}`,
    status,
    staffId: null,
    deadline,
    createdAt,
    version: 1,
    staff: null,
    inventoryLocation: { id: 'loc', name: 'Kho' },
    order: {
      tripId: 'trip',
      pickupPoint: { id: 'pp', name: 'Điểm' },
      rentalOrderLinesViaOrderId: [
        { quantity: 1, product: { id: 'p', name: 'Balo' }, rentalUnitAssignmentsViaOrderLineId: [] },
      ],
    },
  })

  it('giữ thứ tự id từ SQL và trả thời điểm tới kho + mức ưu tiên', async () => {
    const createdAt = new Date('2026-11-11T02:00:00.000Z')
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      $queryRaw: jest.fn(async () => [
        { id: 'blocked', now: NOW },
        { id: 'late', now: NOW },
        { id: 'ready', now: NOW },
      ]),
      inventoryTask: {
        count: jest.fn(async () => 3),
        // findMany không bảo đảm thứ tự: trả ngược để kiểm adapter sắp lại.
        findMany: jest.fn(async () => [
          task('ready', InventoryTaskStatus.READY, minutes(60), createdAt),
          task('late', InventoryTaskStatus.OPEN, minutes(-10), createdAt),
          task('blocked', InventoryTaskStatus.BLOCKED, null, createdAt),
        ]),
      },
    }
    const adapter = new PrismaPreparationTaskAdapter(prisma as any)

    const result = await adapter.listTasks({ actorUserId: 'staff', page: 1, pageSize: 20 })

    expect(result.items.map((item) => [item.id, item.priority, item.isOverdue])).toEqual([
      ['blocked', 'URGENT', false],
      ['late', 'URGENT', true],
      ['ready', 'LOW', false],
    ])
    expect(result.items[0].sentToInventoryAt).toBe(createdAt.toISOString())
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1 })
  })
})
