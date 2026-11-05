import { Prisma } from '@prisma/client'
import { PrismaRentalOrderAdapter } from './prisma-rental-order.adapter'
import { PrismaPreparationTaskAdapter } from '../../../preparation/infrastructure/adapters/prisma-preparation-task.adapter'

// Khách huỷ đơn khi kho đã pick/đóng gói: unit phải về kho, task/kiện/lượt giao phải đóng.
const PRIMARY = '0b6f1c2e-4d5a-4b7c-8e9f-0a1b2c3d4e5f'
const OTHER_LOCATION = '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const NOW = new Date('2026-11-04T03:00:00.000Z')

type Overrides = {
  task?: { id: string; status: string } | null
  pkg?: { id: string; status: string } | null
  deliveryTasks?: Array<{ id: string; status: string }>
  assignments?: Array<{
    id: string
    status: string
    unit: { id: string; status: string; condition?: string; location: string | null }
  }>
}

function build(overrides: Overrides = {}) {
  const task = overrides.task === undefined ? { id: 'task-1', status: 'PICKING' } : overrides.task
  const assignments = (overrides.assignments ?? []).map((a) => ({
    id: a.id,
    status: a.status,
    equipmentUnit: {
      id: a.unit.id,
      status: a.unit.status,
      condition: a.unit.condition ?? 'GOOD',
      currentInventoryLocationId: a.unit.location,
    },
  }))
  const order = {
    id: 'order-1',
    userId: 'user-1',
    tripId: 'trip-1',
    version: 3,
    status: 'PREPARING',
    financialStatus: 'PAID',
    currency: 'VND',
    // Không có tiền hoàn để test chỉ tập trung vào phần kho.
    rentalFee: new Prisma.Decimal(0),
    totalDeposit: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(0),
    quoteId: 'quote-1',
    bookingId: null,
    exceptionStatus: 'NONE',
    paymentExpiresAt: NOW,
    plannedReturnAt: new Date('2026-11-12T00:00:00.000Z'),
    rentalEndAt: new Date('2026-11-12T00:00:00.000Z'),
    createdAt: NOW,
    rentalStartAt: new Date('2026-11-10T00:00:00.000Z'),
    rentalPolicy: { versionNo: 1, freeCancellationHours: 48 },
    rentalHandoverViaOrderId: null,
    invoicesViaRentalOrderId: [],
    inventoryTaskViaOrderId: task,
    packageViaOrderId: overrides.pkg ?? null,
    deliveryTasksViaOrderId: overrides.deliveryTasks ?? [],
    rentalOrderLinesViaOrderId: [{ id: 'line-1', rentalUnitAssignmentsViaOrderLineId: assignments }],
  }
  const locks: string[] = []
  const db = {
    $queryRaw: jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join('?')
      locks.push(sql.includes('trips') ? 'trip' : sql.includes('inventory_tasks') ? 'task' : 'order')
      return Promise.resolve([])
    }),
    rentalOrder: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ ...order, ...data, version: order.version + 1 })),
    },
    trip: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN' }) },
    rentalExtensionRequest: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    rentalQuantityReservation: { updateMany: jest.fn() },
    rentalPickupCode: { updateMany: jest.fn() },
    inventoryLocation: { findUnique: jest.fn().mockResolvedValue({ id: PRIMARY, status: 'ACTIVE' }) },
    package: { update: jest.fn() },
    rentalUnitAssignment: { update: jest.fn() },
    equipmentUnit: { update: jest.fn() },
    inventoryTask: { update: jest.fn() },
    deliveryTask: { update: jest.fn() },
    custodyTransfer: { updateMany: jest.fn() },
    rentalOutboxEvent: { upsert: jest.fn() },
    invoice: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    payment: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  }
  db.$transaction.mockImplementation((cb: (tx: typeof db) => unknown) => cb(db))
  const adapter = new PrismaRentalOrderAdapter(db as never, {} as never)
  const cancel = async () => {
    const preview = await adapter.previewCancellation({ orderId: 'order-1', userId: 'user-1', now: NOW })
    return adapter.cancelOrder({
      orderId: 'order-1',
      userId: 'user-1',
      reason: 'Đổi kế hoạch',
      expectedVersion: 3,
      previewVersion: preview.previewVersion,
      now: NOW,
    })
  }
  return { db, locks, cancel }
}

describe('PrismaRentalOrderAdapter.cancelOrder — trả đồ về kho', () => {
  const previousPrimary = process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID
  beforeAll(() => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = PRIMARY
  })
  afterAll(() => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = previousPrimary
  })

  it('đưa unit đã pick về AVAILABLE, đóng assignment, huỷ task và thu hồi pickup code; khoá task trước đơn', async () => {
    const { db, locks, cancel } = build({
      assignments: [
        { id: 'as-1', status: 'ASSIGNED', unit: { id: 'u-1', status: 'PICKED', location: PRIMARY } },
        { id: 'as-old', status: 'REPLACED', unit: { id: 'u-old', status: 'AVAILABLE', location: PRIMARY } },
      ],
    })

    await cancel()

    expect(locks).toEqual(['trip', 'task', 'order'])
    expect(db.rentalUnitAssignment.update).toHaveBeenCalledTimes(1)
    expect(db.rentalUnitAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'as-1' },
        data: expect.objectContaining({ status: 'CLOSED', closedAt: NOW }),
      }),
    )
    expect(db.equipmentUnit.update).toHaveBeenCalledTimes(1)
    expect(db.equipmentUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1' }, data: expect.objectContaining({ status: 'AVAILABLE' }) }),
    )
    expect(db.inventoryTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1' }, data: expect.objectContaining({ status: 'CANCELLED' }) }),
    )
    expect(db.rentalPickupCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: 'order-1', usedAt: null, revokedAt: null } }),
    )
    expect(db.rentalOrder.update.mock.calls[0][0].data).not.toHaveProperty('exceptionStatus')
    expect(db.rentalOutboxEvent.upsert).not.toHaveBeenCalled()
  })

  it('đơn đã đóng gói xong (task READY): huỷ kiện, lượt giao đang chờ và đưa unit PACKED về kho', async () => {
    const { db, cancel } = build({
      task: { id: 'task-1', status: 'READY' },
      pkg: { id: 'pkg-1', status: 'PACKED' },
      deliveryTasks: [{ id: 'dt-1', status: 'SCHEDULED' }],
      assignments: [{ id: 'as-1', status: 'PACKED', unit: { id: 'u-1', status: 'PACKED', location: PRIMARY } }],
    })

    await cancel()

    expect(db.package.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
    )
    expect(db.deliveryTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dt-1' }, data: expect.objectContaining({ status: 'CANCELLED' }) }),
    )
    expect(db.equipmentUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'AVAILABLE' }) }),
    )
    expect(db.inventoryTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
    )
    expect(db.custodyTransfer.updateMany).toHaveBeenCalled()
  })

  it('unit không ở kho chính: không tự trả về kho, task BLOCKED, đơn ACTION_REQUIRED kèm outbox cho nhân viên', async () => {
    const { db, cancel } = build({
      assignments: [
        { id: 'as-1', status: 'ASSIGNED', unit: { id: 'u-1', status: 'PICKED', location: OTHER_LOCATION } },
      ],
    })

    await cancel()

    expect(db.equipmentUnit.update).not.toHaveBeenCalled()
    expect(db.inventoryTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'BLOCKED' }) }),
    )
    expect(db.rentalOrder.update.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED',
      exceptionStatus: 'ACTION_REQUIRED',
    })
    expect(db.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          eventType: 'RENTAL_ACTION_REQUIRED',
          payload: expect.objectContaining({ reason: 'UNSAFE_CUSTODY_UNIT_ON_CANCELLATION' }),
        }),
      }),
    )
  })

  it('kiện đã giao cho nhân viên giao → 409 CANCELLATION_REQUIRES_CUSTODY_RETURN, không đổi gì', async () => {
    const { db, cancel } = build({
      task: { id: 'task-1', status: 'READY' },
      pkg: { id: 'pkg-1', status: 'TRANSFERRED_TO_DELIVERY' },
      assignments: [{ id: 'as-1', status: 'PACKED', unit: { id: 'u-1', status: 'PACKED', location: null } }],
    })

    await expect(cancel()).rejects.toMatchObject({ code: 'CANCELLATION_REQUIRES_CUSTODY_RETURN' })
    expect(db.rentalQuantityReservation.updateMany).not.toHaveBeenCalled()
    expect(db.equipmentUnit.update).not.toHaveBeenCalled()
    expect(db.rentalOrder.update).not.toHaveBeenCalled()
  })

  it('đơn chưa pick món nào: không cần kho chính, chỉ huỷ task', async () => {
    const { db, cancel } = build({ task: { id: 'task-1', status: 'OPEN' } })

    await cancel()

    expect(db.inventoryLocation.findUnique).not.toHaveBeenCalled()
    expect(db.inventoryTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
    )
  })
})

describe('PrismaPreparationTaskAdapter.listTasks — hàng đợi kho', () => {
  function adapterWith(findMany: jest.Mock) {
    const prisma = {
      inventoryTask: { findMany, count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    }
    return new PrismaPreparationTaskAdapter(prisma as never)
  }

  it('không lọc trạng thái thì ẩn task CANCELLED; lọc status=CANCELLED vẫn xem được', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const adapter = adapterWith(findMany)

    await adapter.listTasks({ actorUserId: 'staff-1', page: 1, pageSize: 20 })
    await adapter.listTasks({ actorUserId: 'staff-1', page: 1, pageSize: 20, status: 'CANCELLED' })

    expect(findMany.mock.calls[0][0].where.AND).toContainEqual({ status: { not: 'CANCELLED' } })
    expect(findMany.mock.calls[1][0].where.AND).toContainEqual({ status: 'CANCELLED' })
  })
})
