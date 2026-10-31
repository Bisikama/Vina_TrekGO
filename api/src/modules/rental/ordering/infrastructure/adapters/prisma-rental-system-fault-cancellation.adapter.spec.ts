import { Prisma } from '@prisma/client'
import { PrismaRentalSystemFaultCancellationAdapter } from './prisma-rental-system-fault-cancellation.adapter'

const NOW = new Date('2026-11-01T00:00:00Z')
const PRIMARY = '00000000-0000-4000-8000-000000000001'

jest.mock('../../../shared/primary-inventory-location', () => ({
  resolveActivePrimaryRentalLocation: jest.fn().mockResolvedValue('00000000-0000-4000-8000-000000000001'),
}))

function makeOrder(over: Record<string, any> = {}) {
  return {
    id: 'o-1',
    tripId: 't-1',
    status: 'PREPARING',
    financialStatus: 'PAID',
    exceptionStatus: 'ACTION_REQUIRED',
    version: 3,
    currency: 'VND',
    rentalFee: new Prisma.Decimal(600_000),
    totalDeposit: new Prisma.Decimal(1_200_000),
    rentalHandoverViaOrderId: null,
    inventoryTaskViaOrderId: { id: 'it-1', status: 'PICKING' },
    packageViaOrderId: { id: 'pkg-1', status: 'OPEN' },
    deliveryTasksViaOrderId: [],
    rentalOrderLinesViaOrderId: [
      {
        id: 'l-1',
        rentalUnitAssignmentsViaOrderLineId: [
          {
            id: 'a-1',
            status: 'ASSIGNED',
            equipmentUnitId: 'u-1',
            equipmentUnit: {
              id: 'u-1',
              status: 'PICKED',
              condition: 'GOOD',
              currentInventoryLocationId: PRIMARY,
            },
          },
        ],
      },
    ],
    ...over,
  }
}

function makeAdapter(order: any) {
  const tx: any = {
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ now: NOW }]),
    trip: { findUnique: jest.fn().mockResolvedValue({ status: 'OPEN' }) },
    rentalOrder: {
      findUnique: jest.fn().mockResolvedValue({ tripId: order.tripId }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(order),
      update: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ ...order, ...data, version: order.version + 1 })),
    },
    rentalExtensionRequest: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    payment: { findFirst: jest.fn().mockResolvedValue({ id: 'pay-1' }) },
    rentalOutboxEvent: { upsert: jest.fn().mockResolvedValue({}) },
    invoice: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    rentalQuantityReservation: { updateMany: jest.fn() },
    rentalPickupCode: { updateMany: jest.fn() },
    package: { update: jest.fn() },
    rentalUnitAssignment: { update: jest.fn() },
    equipmentUnit: { update: jest.fn() },
    inventoryTask: { update: jest.fn() },
    deliveryTask: { update: jest.fn() },
    custodyTransfer: { updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
  }
  const prisma: any = { $transaction: jest.fn((cb: any) => cb(tx)) }
  return { adapter: new PrismaRentalSystemFaultCancellationAdapter(prisma), tx }
}

jest.mock('../../../payments/rental-cancellation-refund', () => ({
  cancelPendingRentalChargesWithTx: jest.fn().mockResolvedValue(undefined),
  reserveRentalCancellationRefundWithTx: jest.fn().mockResolvedValue({ id: 'ref-1', status: 'PENDING' }),
}))

const command = {
  orderId: 'o-1',
  actorUserId: 'admin-1',
  idempotencyKey: 'sysfault-k1',
  reasonCode: 'GRADE_DOWNGRADE_CAPACITY_SHORTAGE' as const,
  note: 'Không còn lều hạng Rất mới',
  expectedVersion: 3,
}

describe('PrismaRentalSystemFaultCancellationAdapter', () => {
  it('cancels a pre-handover order with a 100% refund and returns picked units to stock', async () => {
    const { adapter, tx } = makeAdapter(makeOrder())
    const { reserveRentalCancellationRefundWithTx } = jest.requireMock('../../../payments/rental-cancellation-refund')

    const result = await adapter.cancel(command)

    expect(reserveRentalCancellationRefundWithTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ orderId: 'o-1', paymentId: 'pay-1', amount: new Prisma.Decimal(1_800_000) }),
    )
    expect(result.refund).toEqual({
      refundRef: 'ref-1',
      amount: 1_800_000,
      feeRefund: 600_000,
      depositRefund: 1_200_000,
      status: 'PENDING',
    })
    expect(result.order).toEqual(
      expect.objectContaining({ status: 'CANCELLED', financialStatus: 'REFUND_PENDING', exceptionStatus: 'NONE' }),
    )
    expect(result.releasedUnitIds).toEqual(['u-1'])
    expect(tx.equipmentUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1' }, data: expect.objectContaining({ status: 'AVAILABLE' }) }),
    )
    expect(tx.rentalQuantityReservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RELEASED' }) }),
    )
    expect(tx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          eventType: 'RENTAL_ORDER_CANCELLED',
          payload: expect.objectContaining({ reason: 'SYSTEM_FAULT_CANCELLATION' }),
        }),
      }),
    )
  })

  it.each([
    ['ACTIVE order', { status: 'ACTIVE' }, 'RENTAL_SYSTEM_FAULT_CANCELLATION_NOT_ALLOWED'],
    [
      'order already handed over',
      { rentalHandoverViaOrderId: { id: 'h-1' } },
      'RENTAL_SYSTEM_FAULT_CANCELLATION_NOT_ALLOWED',
    ],
    [
      'package with delivery staff',
      { status: 'READY_FOR_HANDOVER', packageViaOrderId: { id: 'pkg-1', status: 'TRANSFERRED_TO_DELIVERY' } },
      'CANCELLATION_REQUIRES_CUSTODY_RETURN',
    ],
    ['order not PAID', { financialStatus: 'REFUND_PENDING' }, 'PAYMENT_RECONCILIATION_REQUIRED'],
  ])('rejects %s without touching money or stock', async (_label, over, code) => {
    const { adapter, tx } = makeAdapter(makeOrder(over))
    await expect(adapter.cancel(command)).rejects.toMatchObject({ code })
    expect(tx.rentalOrder.update).not.toHaveBeenCalled()
    expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
  })

  it('rejects an order with an applied extension', async () => {
    const { adapter, tx } = makeAdapter(makeOrder())
    tx.rentalExtensionRequest.count.mockResolvedValue(1)
    await expect(adapter.cancel(command)).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
      details: expect.objectContaining({ reason: 'MULTI_PAYMENT_RENTAL_CANCELLATION_REVIEW_REQUIRED' }),
    })
  })
})
