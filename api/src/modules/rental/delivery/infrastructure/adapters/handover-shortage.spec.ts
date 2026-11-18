import { Prisma } from '@prisma/client'
import { PrismaDeliveryAdapter, handoverShortageAmounts, handoverShortageDescriptions } from './prisma-delivery.adapter'
import { issueHandoverDocumentTx } from '../../../documents/application/rental-document-events'
import { handoverShortageByLine } from '../../../shared/handover-shortage'
import { publishRefundSettlement } from '../../../../payments/refund-settlement'

jest.mock('../../../documents/application/rental-document-events', () => ({
  issueHandoverDocumentTx: jest.fn().mockResolvedValue({ id: 'doc-1' }),
}))
jest.mock('../../../lifecycle/application/services/rental-return-task', () => ({
  ensureReturnTaskWithTx: jest.fn().mockResolvedValue(undefined),
  returnTaskScheduleAt: jest.fn((_snapshot: unknown, due: Date) => due),
}))

const D = (value: number | string) => new Prisma.Decimal(value)
const NOW = new Date('2026-11-17T08:00:00Z')
const STAFF = 'staff-1'
const ORDER_ID = 'order-1'

// Line A: 2 tents (fee 2 × 100k × 2 days = 400k, deposit 600k each). Line B: 1 pack (fee 2 × 50k, deposit 300k).
const LINE_A = {
  id: 'line-a',
  orderId: ORDER_ID,
  quantity: 2,
  lineRentalFee: D(400000),
  depositPerUnitSnapshot: D(600000),
}
const LINE_B = {
  id: 'line-b',
  orderId: ORDER_ID,
  quantity: 1,
  lineRentalFee: D(100000),
  depositPerUnitSnapshot: D(300000),
}

function packageItem(unitId: string, line: typeof LINE_A) {
  return {
    assignmentId: `as-${unitId}`,
    equipmentUnitId: unitId,
    assignment: { id: `as-${unitId}`, status: 'PACKED', orderLine: line },
    equipmentUnit: {
      id: unitId,
      assetCode: `CODE-${unitId}`,
      status: 'PACKED',
      condition: 'GOOD',
      currentInventoryLocationId: 'loc-1',
      homeInventoryLocationId: 'loc-1',
      product: { name: unitId.startsWith('tent') ? 'Lều 3 người' : 'Balo 45L' },
    },
  }
}

function buildTx() {
  const order = {
    id: ORDER_ID,
    userId: 'user-1',
    tripId: 'trip-1',
    bookingId: null,
    membershipRef: 'member-1',
    recipientSnapshot: { userId: 'user-1', memberId: 'member-1' },
    status: 'READY_FOR_HANDOVER',
    exceptionStatus: 'NONE',
    financialStatus: 'PAID',
    version: 3,
    rentalPolicyId: 'policy-1',
    policySnapshot: {},
    totalDeposit: D(1500000),
    currency: 'VND',
    pickupPointId: 'point-1',
    plannedHandoverAt: new Date('2026-11-17T07:00:00Z'),
    rentalStartAt: new Date('2026-11-17T00:00:00Z'),
    rentalEndAt: new Date('2026-11-19T00:00:00Z'),
    operationalReturnDueAt: null,
    occupiedEndAt: new Date('2026-11-20T00:00:00Z'),
    returnOptionSnapshot: null,
  }
  const items = [packageItem('tent-1', LINE_A), packageItem('tent-2', LINE_A), packageItem('pack-1', LINE_B)]
  const allocations = [
    { id: 'alloc-a-fee', rentalOrderLineId: 'line-a', component: 'RENTAL_FEE', amount: D(400000) },
    { id: 'alloc-a-dep', rentalOrderLineId: 'line-a', component: 'RENTAL_DEPOSIT', amount: D(1200000) },
    { id: 'alloc-b-fee', rentalOrderLineId: 'line-b', component: 'RENTAL_FEE', amount: D(100000) },
    { id: 'alloc-b-dep', rentalOrderLineId: 'line-b', component: 'RENTAL_DEPOSIT', amount: D(300000) },
  ]
  const payment = {
    id: 'pay-1',
    status: 'SUCCEEDED',
    amount: D(2000000),
    currency: 'VND',
    paymentGateway: 'vnpay',
    providerEnvironment: 'SANDBOX',
    merchantAccountKey: 'merchant',
    merchantRequestRef: 'req-1',
    reconcileStatus: 'IDLE',
    invoice: { rentalOrderId: ORDER_ID, invoiceType: 'RENTAL' },
    application: { status: 'APPLIED' },
    allocations,
  }
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    rentalOrder: {
      findUnique: jest.fn().mockResolvedValue(order),
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve({ ...order, status: 'ACTIVE' })),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...order, ...data, version: 4 })),
    },
    deliveryTask: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'task-1', staffId: STAFF, status: 'RECIPIENT_VERIFIED', packageId: 'pkg-1' }),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'task-1', ...data })),
    },
    package: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'pkg-1',
        orderId: ORDER_ID,
        status: 'TRANSFERRED_TO_DELIVERY',
        version: 2,
        packageItemsViaPackageId: items,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    rentalOrderLine: { aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 3 } }) },
    rentalPickupCode: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'code-1',
        verifiedAt: new Date(NOW.getTime() - 60_000),
        expiresAt: new Date(NOW.getTime() + 600_000),
        packageVersionSnapshot: 2,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    rentalPolicy: { findUnique: jest.fn().mockResolvedValue({ id: 'policy-1', pickupVerificationTtlMinutes: 10 }) },
    trip: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'trip-1', status: 'OPEN', tripType: 'PRIVATE', leaderId: 'leader-1' }),
    },
    tripMember: { findUnique: jest.fn().mockResolvedValue({ id: 'member-1', status: 'ACTIVE' }) },
    conditionSnapshot: {
      findMany: jest.fn().mockResolvedValue(items.map((item) => ({ assignmentId: item.assignmentId }))),
    },
    rentalHandover: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'handover-1', ...data })),
    },
    rentalUnitAssignment: { update: jest.fn().mockResolvedValue({}) },
    equipmentUnit: { update: jest.fn().mockResolvedValue({}) },
    maintenanceRecord: { create: jest.fn().mockResolvedValue({}) },
    rentalExceptionCase: { create: jest.fn().mockResolvedValue({}) },
    rentalQuantityReservation: {
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: any) =>
          Promise.resolve({ id: `res-${where.orderLineId}`, quantity: where.orderLineId === 'line-a' ? 2 : 1 }),
        ),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(payment),
      count: jest.fn().mockResolvedValue(1),
      findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
    },
    refund: {
      findUnique: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data })),
    },
    refundAllocation: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    rentalOutboxEvent: { upsert: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    depositSettlement: { upsert: jest.fn().mockResolvedValue({ id: 'settlement-1' }) },
    depositSettlementItem: { upsert: jest.fn().mockResolvedValue({}) },
    custodyEvent: { create: jest.fn().mockResolvedValue({}) },
  }
  const prisma: any = { $transaction: jest.fn((work: (tx: any) => Promise<unknown>) => work(tx)) }
  return { tx, adapter: new PrismaDeliveryAdapter(prisma) }
}

function handover(
  adapter: PrismaDeliveryAdapter,
  reportedIssues: Array<{ unitId?: string; type: string; description: string }>,
) {
  return adapter.commitHandover({
    actorUserId: STAFF,
    orderId: ORDER_ID,
    packageId: 'pkg-1',
    verificationRef: 'verify-ref-1',
    reportedIssues,
    expectedVersion: 3,
    idempotencyKey: 'handover-key-1',
    now: NOW,
  })
}

describe('RB-API-404 partial handover (units missing from the package)', () => {
  it('hands over the rest, takes the missing unit out of the order and refunds its fee + deposit from its own line', async () => {
    const { tx, adapter } = buildTx()

    const result = await handover(adapter, [
      { unitId: 'tent-2', type: 'UNIT_MISSING', description: 'Kiện không có lều thứ hai' },
      { unitId: 'pack-1', type: 'DAMAGED', description: 'Trầy nhẹ quai đeo' },
    ])

    // Only the two units the customer received are rented and carry a deposit.
    expect(result.units.map((unit) => unit.unitId)).toEqual(['tent-1', 'pack-1'])
    const rentedUnitIds = tx.equipmentUnit.update.mock.calls
      .filter(([arg]: any) => arg.data.status === 'RENTED')
      .map(([arg]: any) => arg.where.id)
    expect(rentedUnitIds).toEqual(['tent-1', 'pack-1'])
    expect(tx.depositSettlement.upsert.mock.calls[0][0].create.totalDeposit.toString()).toBe('900000')
    expect(tx.depositSettlementItem.upsert.mock.calls.map(([arg]: any) => arg.create.unitId)).toEqual([
      'tent-1',
      'pack-1',
    ])

    // The missing unit is withdrawn for the warehouse to find, with an internal case.
    expect(tx.rentalUnitAssignment.update).toHaveBeenCalledWith({
      where: { id: 'as-tent-2' },
      data: { status: 'UNASSIGNED', closedAt: NOW, version: { increment: 1 } },
    })
    expect(tx.equipmentUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tent-2' }, data: expect.objectContaining({ status: 'MAINTENANCE' }) }),
    )
    expect(tx.maintenanceRecord.create.mock.calls[0][0].data).toMatchObject({
      unitId: 'tent-2',
      reason: 'HANDOVER_SHORTAGE',
    })
    expect(tx.rentalExceptionCase.create.mock.calls[0][0].data).toMatchObject({
      caseType: 'OTHER',
      unitId: 'tent-2',
      reason: 'HANDOVER_SHORTAGE: Kiện không có lều thứ hai',
    })
    expect(tx.rentalQuantityReservation.update).toHaveBeenCalledWith({
      where: { id: 'res-line-a' },
      data: { quantity: 1, version: { increment: 1 } },
    })

    // Fee 200k + deposit 600k of the tent, taken from line A's allocations only.
    const refund = tx.refund.create.mock.calls[0][0].data
    expect(refund).toMatchObject({
      purpose: 'RENTAL_CANCELLATION',
      reason: 'HANDOVER_SHORTAGE',
      rentalOrderId: ORDER_ID,
    })
    expect(refund.amount.toString()).toBe('800000')
    expect(refund.allocations.create.map((row: any) => [row.paymentAllocationId, row.amount.toString()])).toEqual([
      ['alloc-a-fee', '200000'],
      ['alloc-a-dep', '600000'],
    ])
    expect(result.shortage).toMatchObject({
      units: [{ unitId: 'tent-2', assetCode: 'CODE-tent-2', description: 'Kiện không có lều thứ hai' }],
      refund: {
        amount: 800000,
        rentalFeeAmount: 200000,
        depositAmount: 600000,
        status: 'PENDING',
        failureReason: null,
      },
    })

    // Customer + staff are told, and the handover document lists the tent as not delivered.
    const shortageEvent = tx.rentalOutboxEvent.upsert.mock.calls.find(
      ([arg]: any) => arg.create.eventType === 'RENTAL_HANDOVER_SHORTAGE',
    )
    expect(shortageEvent[0].create.payload).toMatchObject({ refundAmount: 800000, refundCreated: true })
    expect((issueHandoverDocumentTx as jest.Mock).mock.calls.at(-1)[4]).toMatchObject({
      missingUnitIds: ['tent-2'],
      refund: { rentalFee: '200000', deposit: '600000', total: '800000' },
    })
    // Custody to the customer covers only the units handed over.
    const unitCustody = tx.custodyEvent.create.mock.calls.map(([arg]: any) => arg.data.unitId).filter(Boolean)
    expect(unitCustody).toEqual(['tent-1', 'pack-1'])
  })

  it('refuses a handover where every unit is missing (the courier must record a no-show instead)', async () => {
    const { tx, adapter } = buildTx()

    await expect(
      handover(adapter, [
        { unitId: 'tent-1', type: 'UNIT_MISSING', description: 'thiếu' },
        { unitId: 'tent-2', type: 'UNIT_MISSING', description: 'thiếu' },
        { unitId: 'pack-1', type: 'UNIT_MISSING', description: 'thiếu' },
      ]),
    ).rejects.toMatchObject({ code: 'PACKAGE_INCOMPLETE', details: { reason: 'ALL_UNITS_MISSING' } })
    expect(tx.rentalHandover.create).not.toHaveBeenCalled()
  })

  it('still hands over when the refund cannot be reserved: admin case on the missing unit, order not flagged, no refund promised', async () => {
    const { tx, adapter } = buildTx()
    tx.payment.count.mockResolvedValue(2) // e.g. a second applied payment → needs reconciliation

    const result = await handover(adapter, [{ unitId: 'pack-1', type: 'UNIT_MISSING', description: 'Không thấy balo' }])

    expect(result.shortage?.refund).toMatchObject({
      refundRef: null,
      amount: 400000,
      failureReason: 'MULTI_PAYMENT_RENTAL_CANCELLATION_REVIEW_REQUIRED',
    })
    expect(tx.rentalExceptionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseType: 'REFUND_FAILURE',
          assignmentId: 'as-pack-1',
          reason: expect.stringMatching(/^HANDOVER_SHORTAGE_REFUND_REQUIRED: /),
        }),
      }),
    )
    // Extensions stay possible: the order keeps its normal standing.
    const orderUpdates = tx.rentalOrder.update.mock.calls.map(([arg]: any) => arg.data.exceptionStatus)
    expect(orderUpdates).not.toContain('ACTION_REQUIRED')
    expect((issueHandoverDocumentTx as jest.Mock).mock.calls.at(-1)[4]).toMatchObject({ refund: null })
  })

  it('treats MISSING (sent by apps from the start) as a whole unit missing too', async () => {
    const { tx, adapter } = buildTx()

    const result = await handover(adapter, [{ unitId: 'pack-1', type: 'MISSING', description: 'Balo bị giao thiếu' }])

    expect(result.units.map((unit) => unit.unitId)).toEqual(['tent-1', 'tent-2'])
    expect(result.shortage?.units.map((unit) => unit.unitId)).toEqual(['pack-1'])
    expect(tx.refund.create.mock.calls[0][0].data.amount.toString()).toBe('400000')
  })

  it('only records a damaged unit or missing accessory; the unit is still handed over', async () => {
    const { tx, adapter } = buildTx()

    const result = await handover(adapter, [{ unitId: 'tent-1', type: 'DAMAGED', description: 'Thiếu túi cọc lều' }])

    expect(result.shortage).toBeNull()
    expect(result.units.map((unit) => unit.unitId)).toEqual(['tent-1', 'tent-2', 'pack-1'])
    expect(tx.refund.create).not.toHaveBeenCalled()
  })
})

describe('handover shortage helpers', () => {
  it('treats MISSING / UNIT_MISSING issues with a unit as missing units', () => {
    const missing = handoverShortageDescriptions([
      { unitId: 'u1', type: 'unit_missing', description: ' thiếu ' },
      { unitId: 'u2', type: 'DAMAGED', description: 'hỏng' },
      { unitId: 'u3', type: 'MISSING', description: 'không có trong kiện' },
      { type: 'UNIT_MISSING', description: 'không gắn món' },
    ])
    expect([...missing]).toEqual([
      ['u1', 'thiếu'],
      ['u3', 'không có trong kiện'],
    ])
  })

  it('prices extensions off the missing units’ contract fee, whatever happened to their refund', async () => {
    // 2 tents × 3 days × 100k = 600k, one missing; a later extension added 200k for the tent still held.
    const db: any = {
      rentalUnitAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ orderLineId: 'line-a', orderLine: { quantity: 2, lineRentalFee: D(800000) } }]),
      },
      rentalExtensionLine: {
        findMany: jest.fn().mockResolvedValue([{ orderLineId: 'line-a', additionalFee: D(200000) }]),
      },
    }
    const byLine = await handoverShortageByLine(db, ORDER_ID)
    expect(byLine.get('line-a')).toEqual({ count: 1, missingFee: 300000n })
  })

  it('opens an admin case, without flagging the live order, when a shortage refund fails at the provider', async () => {
    const tx: any = {
      invoice: { update: jest.fn() },
      paymentOutboxEvent: { create: jest.fn() },
      rentalOrder: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      rentalExceptionCase: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      rentalUnitAssignment: { findFirst: jest.fn().mockResolvedValue({ id: 'as-tent-2', equipmentUnitId: 'tent-2' }) },
    }
    const refund: any = {
      id: 'refund-9',
      purpose: 'RENTAL_CANCELLATION',
      reason: 'HANDOVER_SHORTAGE',
      rentalOrderId: ORDER_ID,
      amount: D(800000),
      payment: { application: { status: 'APPLIED' } },
    }
    await publishRefundSettlement(tx, refund, { status: 'FAILED', refundTransactionRef: null })

    expect(tx.rentalOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ORDER_ID, status: 'CANCELLED' } }),
    )
    expect(tx.rentalExceptionCase.create.mock.calls[0][0].data).toMatchObject({
      caseType: 'REFUND_FAILURE',
      assignmentId: 'as-tent-2',
      reason: expect.stringMatching(/^\[refund:refund-9\] HANDOVER_SHORTAGE_REFUND_REQUIRED: /),
    })
  })

  it('splits fee per unit from the line and adds the deposit per unit', () => {
    const amounts = handoverShortageAmounts([LINE_A, LINE_A, LINE_B] as any)
    expect(
      amounts.perLine.map((line) => [
        line.rentalOrderLineId,
        line.count,
        line.rentalFee.toString(),
        line.deposit.toString(),
      ]),
    ).toEqual([
      ['line-a', 2, '400000', '1200000'],
      ['line-b', 1, '100000', '300000'],
    ])
    expect(amounts.total.toString()).toBe('2000000')
  })
})
