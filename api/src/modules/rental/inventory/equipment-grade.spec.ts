import { RentalOrderStatus } from '@prisma/client'
import { AppError } from 'src/shared/errors/app-error'
import {
  assertGradeDecision,
  effectiveReservedQuantity,
  findShortageWindows,
} from './application/services/equipment-grade.rules'
import { applyGradeDecision, GRADE_DOWNGRADE_SHORTAGE_REASON } from './infrastructure/equipment-grade-transfer'
import { PrismaRentalReturnAdapter } from '../returns/infrastructure/adapters/prisma-rental-return.adapter'
import { PrismaDeliveryAdapter } from '../delivery/infrastructure/adapters/prisma-delivery.adapter'
import { PrismaEquipmentUnitAdapter } from './infrastructure/adapters/prisma-equipment-unit.adapter'

const LIKE_NEW = { id: 'p-like', gradeGroupId: 'g-1', grade: 'LIKE_NEW' as const }
const GOOD_USED = { id: 'p-good', gradeGroupId: 'g-1', grade: 'GOOD_USED' as const }
const PLAIN = { id: 'p-plain', gradeGroupId: null, grade: null }
const NOW = new Date('2026-11-01T00:00:00Z')
const at = (h: number) => new Date(NOW.getTime() + h * 3_600_000)

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (e) {
    return (e as AppError).code
  }
  return undefined
}

describe('Equipment grade rules', () => {
  it('requires a decision for graded products and rejects one for plain products', () => {
    expect(codeOf(() => assertGradeDecision(LIKE_NEW, undefined, { required: true }))).toBe(
      'RENTAL_GRADE_DECISION_REQUIRED',
    )
    expect(codeOf(() => assertGradeDecision(PLAIN, { decision: 'KEEP' }, { required: true }))).toBe(
      'RENTAL_GRADE_DECISION_NOT_APPLICABLE',
    )
    expect(assertGradeDecision(PLAIN, undefined, { required: true })).toBeNull()
    expect(assertGradeDecision(LIKE_NEW, { decision: 'KEEP' }, { required: true })).toEqual({ decision: 'KEEP' })
  })

  it('only allows downgrade from LIKE_NEW', () => {
    expect(
      codeOf(() => assertGradeDecision(GOOD_USED, { decision: 'DOWNGRADE', reason: 'mòn' }, { required: true })),
    ).toBe('RENTAL_GRADE_DOWNGRADE_NOT_ALLOWED')
    expect(assertGradeDecision(GOOD_USED, { decision: 'KEEP' }, { required: true })).toEqual({ decision: 'KEEP' })
  })

  it('counts only units still out for handed-over orders', () => {
    expect(effectiveReservedQuantity(true, 2, 0)).toBe(2)
    expect(effectiveReservedQuantity(false, 2, 1)).toBe(1)
    expect(effectiveReservedQuantity(false, 2, 0)).toBe(0)
  })

  it('flags reservations only where demand exceeds supply', () => {
    const reservations = [
      { id: 'r1', orderId: 'o1', quantity: 1, occupiedFrom: at(10), occupiedUntil: at(20) },
      { id: 'r2', orderId: 'o2', quantity: 1, occupiedFrom: at(15), occupiedUntil: at(25) },
      { id: 'r3', orderId: 'o3', quantity: 1, occupiedFrom: at(40), occupiedUntil: at(50) },
    ]
    expect(findShortageWindows(2, reservations, NOW)).toEqual([])
    const short = findShortageWindows(1, reservations, NOW)
    expect(short.map((w) => w.reservation.orderId)).toEqual(['o1', 'o2'])
    expect(short[0].peakReserved).toBe(2)
  })

  it('ignores the part of a reservation that is already in the past', () => {
    const reservations = [
      { id: 'r1', orderId: 'o1', quantity: 1, occupiedFrom: at(-20), occupiedUntil: at(-5) },
      { id: 'r2', orderId: 'o2', quantity: 1, occupiedFrom: at(-10), occupiedUntil: at(5) },
    ]
    expect(findShortageWindows(1, reservations, NOW)).toEqual([])
  })
})

function makeTx(opts: { supply?: number; reservations?: any[] } = {}) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    rentalProduct: {
      findFirst: jest.fn().mockResolvedValue({ id: GOOD_USED.id }),
      findUnique: jest.fn(),
    },
    equipmentUnit: {
      update: jest.fn().mockResolvedValue({ id: 'u-1', version: 9 }),
      count: jest.fn().mockResolvedValue(opts.supply ?? 0),
    },
    equipmentGradeReview: { create: jest.fn().mockResolvedValue({ id: 'rev-1' }) },
    rentalQuantityReservation: { findMany: jest.fn().mockResolvedValue(opts.reservations ?? []) },
    rentalCapacityAlert: { upsert: jest.fn().mockResolvedValue({}) },
    rentalOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    rentalOutboxEvent: { upsert: jest.fn().mockResolvedValue({}) },
  } as any
}

const reservationRow = (
  id: string,
  orderId: string,
  status: RentalOrderStatus,
  from: number,
  until: number,
  openAssignments = 0,
) => ({
  id,
  quantity: 1,
  occupiedFrom: at(from),
  occupiedUntil: at(until),
  orderLine: {
    order: { id: orderId, status, tripId: `trip-${orderId}` },
    rentalUnitAssignmentsViaOrderLineId: Array.from({ length: openAssignments }, (_, i) => ({ id: `a-${i}` })),
  },
})

describe('applyGradeDecision', () => {
  it('KEEP only records a review', async () => {
    const tx = makeTx()
    const result = await applyGradeDecision(tx, {
      unitId: 'u-1',
      product: LIKE_NEW,
      decision: { decision: 'KEEP' },
      actorId: 'staff-1',
      now: NOW,
      assignmentId: 'as-1',
    })
    expect(result.decision).toBe('KEEP')
    expect(tx.equipmentGradeReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decision: 'KEEP',
        fromProductId: LIKE_NEW.id,
        fromGrade: 'LIKE_NEW',
        assignmentId: 'as-1',
      }),
    })
    expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
    expect(tx.$queryRaw).not.toHaveBeenCalled()
  })

  it('DOWNGRADE moves the unit and records the review without flagging when stock is enough', async () => {
    const tx = makeTx({ supply: 1, reservations: [reservationRow('r1', 'o1', RentalOrderStatus.PAID, 10, 20)] })
    const result = await applyGradeDecision(tx, {
      unitId: 'u-1',
      product: LIKE_NEW,
      decision: { decision: 'DOWNGRADE', reason: 'Vải lều bạc màu' },
      actorId: 'staff-1',
      now: NOW,
    })
    expect(tx.equipmentUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-1' }, data: { productId: GOOD_USED.id, version: { increment: 1 } } }),
    )
    expect(tx.equipmentGradeReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decision: 'DOWNGRADE',
        toProductId: GOOD_USED.id,
        toGrade: 'GOOD_USED',
        reason: 'Vải lều bạc màu',
      }),
    })
    expect(result).toEqual(
      expect.objectContaining({ toProductId: GOOD_USED.id, unitVersion: 9, shortage: { orderIds: [], alertKeys: [] } }),
    )
    expect(tx.rentalOrder.updateMany).not.toHaveBeenCalled()
  })

  it('fails when the group has no GOOD_USED product', async () => {
    const tx = makeTx()
    tx.rentalProduct.findFirst.mockResolvedValue(null)
    await expect(
      applyGradeDecision(tx, {
        unitId: 'u-1',
        product: LIKE_NEW,
        decision: { decision: 'DOWNGRADE', reason: 'mòn' },
        actorId: 's',
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'RENTAL_GRADE_TARGET_NOT_FOUND' })
    expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
  })

  it('flags pre-handover orders on real shortage without touching money or reservations', async () => {
    const tx = makeTx({
      supply: 1,
      reservations: [
        reservationRow('r1', 'o-paid', RentalOrderStatus.PAID, 10, 20),
        reservationRow('r2', 'o-prep', RentalOrderStatus.PREPARING, 12, 22),
        reservationRow('r3', 'o-later', RentalOrderStatus.PAID, 40, 50),
      ],
    })
    const result = await applyGradeDecision(tx, {
      unitId: 'u-1',
      product: LIKE_NEW,
      decision: { decision: 'DOWNGRADE', reason: 'mòn' },
      actorId: 's',
      now: NOW,
    })
    expect(result.shortage.orderIds).toEqual(['o-paid', 'o-prep'])
    expect(tx.rentalCapacityAlert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ productId: LIKE_NEW.id, reason: GRADE_DOWNGRADE_SHORTAGE_REASON }),
      }),
    )
    expect(tx.rentalOrder.updateMany).toHaveBeenCalledTimes(2)
    expect(tx.rentalOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'o-paid', status: { in: ['PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY_FOR_HANDOVER'] }, exceptionStatus: { not: 'ACTION_REQUIRED' } },
      data: { exceptionStatus: 'ACTION_REQUIRED', version: { increment: 1 } },
    })
    expect(tx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          eventType: 'RENTAL_ACTION_REQUIRED',
          aggregateId: 'o-paid',
          payload: expect.objectContaining({ reason: GRADE_DOWNGRADE_SHORTAGE_REASON }),
        }),
      }),
    )
  })

  it('does not report a false shortage from the reservation of the order that just returned', async () => {
    // Đơn vừa trả: reservation còn CONFIRMED tới hết buffer, nhưng không còn món nào ở chỗ khách.
    const tx = makeTx({
      supply: 1,
      reservations: [
        reservationRow('r-own', 'o-returned', RentalOrderStatus.RETURN_PROCESSING, -48, 6, 0),
        reservationRow('r-next', 'o-next', RentalOrderStatus.PAID, 2, 30),
      ],
    })
    const result = await applyGradeDecision(tx, {
      unitId: 'u-1',
      product: LIKE_NEW,
      decision: { decision: 'DOWNGRADE', reason: 'mòn' },
      actorId: 's',
      now: NOW,
    })
    expect(result.shortage.orderIds).toEqual([])
    expect(tx.rentalOrder.updateMany).not.toHaveBeenCalled()
  })
})

describe('markUnitReady with grade decision', () => {
  function makeAdapter(product: typeof LIKE_NEW | typeof PLAIN) {
    const tx: any = {
      ...makeTx(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-1', role: 'STAFF_INVENTORY' }) },
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      rentalUnitAssignment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'as-1', orderLineId: 'line-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      returnInspection: { findUnique: jest.fn().mockResolvedValue({ id: 'ins-1', outcome: 'NORMAL' }) },
      returnInspectionTask: { findUnique: jest.fn().mockResolvedValue({ status: 'COMPLETED' }) },
      rentalOrderLine: { findUnique: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    }
    tx.equipmentUnit.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'u-1', productId: product.id, status: 'CLEANING', version: 3, assetCode: 'TENT-1' })
    tx.equipmentUnit.update = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'u-1',
        productId: product.id,
        status: 'AVAILABLE',
        condition: 'GOOD',
        version: 4,
        assetCode: 'TENT-1',
      })
      .mockResolvedValueOnce({ id: 'u-1', version: 5 })
    tx.rentalProduct.findUnique.mockResolvedValue(product)
    const prisma: any = { $transaction: jest.fn((cb: any) => cb(tx)) }
    return { adapter: new PrismaRentalReturnAdapter(prisma), tx }
  }
  const base = {
    actorUserId: 'staff-1',
    unitId: 'u-1',
    accessoriesChecked: true,
    expectedVersion: 3,
    idempotencyKey: 'k-1',
    now: NOW,
  }

  it('rejects a graded unit without gradeDecision before changing anything', async () => {
    const { adapter, tx } = makeAdapter(LIKE_NEW)
    await expect(adapter.markUnitReady(base)).rejects.toMatchObject({ code: 'RENTAL_GRADE_DECISION_REQUIRED' })
    expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
  })

  it('keeps plain products working as before', async () => {
    const { adapter, tx } = makeAdapter(PLAIN)
    const result = await adapter.markUnitReady(base)
    expect(result.unit).toEqual(expect.objectContaining({ status: 'AVAILABLE', productId: PLAIN.id, version: 4 }))
    expect(result.gradeReview).toBeNull()
    expect(tx.equipmentGradeReview.create).not.toHaveBeenCalled()
  })

  it('DOWNGRADE returns the unit under the GOOD_USED product with the review', async () => {
    const { adapter, tx } = makeAdapter(LIKE_NEW)
    const result = await adapter.markUnitReady({
      ...base,
      gradeDecision: { decision: 'DOWNGRADE', reason: 'Khoá kéo mòn' },
    })
    expect(result.unit).toEqual(expect.objectContaining({ status: 'AVAILABLE', productId: GOOD_USED.id, version: 5 }))
    expect(result.gradeReview).toEqual(
      expect.objectContaining({
        id: 'rev-1',
        decision: 'DOWNGRADE',
        fromProductId: LIKE_NEW.id,
        toProductId: GOOD_USED.id,
      }),
    )
    expect(tx.equipmentGradeReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ assignmentId: 'as-1' }),
    })
  })
})

describe('downgradeGrade (standalone, unit in stock)', () => {
  function makeAdapter(
    opts: {
      product?: typeof LIKE_NEW | typeof GOOD_USED | typeof PLAIN
      status?: string
      openAssignment?: boolean
      commitment?: boolean
      cached?: { requestHash: string; responseBody: unknown } | null
    } = {},
  ) {
    const product = opts.product ?? LIKE_NEW
    const tx: any = {
      ...makeTx(),
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(opts.cached ?? null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      rentalUnitAssignment: {
        findFirst: jest.fn().mockResolvedValue(opts.openAssignment ? { id: 'as-open', status: 'ASSIGNED' } : null),
      },
      rentalReadinessCommitment: {
        findUnique: jest.fn().mockResolvedValue(opts.commitment ? { id: 'rc-1' } : null),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    }
    tx.$queryRaw = jest.fn().mockResolvedValue([{ now: NOW }])
    tx.equipmentUnit.findUnique = jest.fn().mockResolvedValue({
      id: 'u-1',
      status: opts.status ?? 'AVAILABLE',
      version: 5,
      productId: product.id,
      product,
    })
    tx.equipmentUnit.findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'u-1',
      assetCode: 'TENT-1',
      qrCode: null,
      serialNumber: null,
      status: 'AVAILABLE',
      condition: 'GOOD',
      expectedReadyAt: null,
      acquiredAt: null,
      retiredAt: null,
      version: 9,
      product: { id: GOOD_USED.id, sku: 'TENT-GU', name: 'Lều – Đã sử dụng tốt' },
      homeInventoryLocation: { id: 'loc', code: 'WH', name: 'Kho' },
      currentInventoryLocation: { id: 'loc', code: 'WH', name: 'Kho' },
    })
    const prisma: any = { $transaction: jest.fn((cb: any) => cb(tx)) }
    return { adapter: new PrismaEquipmentUnitAdapter(prisma), tx }
  }
  const payload = {
    unitId: 'u-1',
    expectedVersion: 5,
    actorId: 'staff-1',
    idempotencyKey: 'grade-down-1',
    reason: 'Vải lều bạc màu',
  }

  it('moves an AVAILABLE LIKE_NEW unit to GOOD_USED and stores the response for replay', async () => {
    const { adapter, tx } = makeAdapter()
    const result = await adapter.downgradeGrade(payload)
    expect(result.unit).toEqual(
      expect.objectContaining({ product: expect.objectContaining({ id: GOOD_USED.id }), version: 9 }),
    )
    expect(result.gradeReview).toEqual({
      id: 'rev-1',
      decision: 'DOWNGRADE',
      fromProductId: LIKE_NEW.id,
      toProductId: GOOD_USED.id,
      shortageOrderIds: [],
    })
    expect(tx.equipmentGradeReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ decision: 'DOWNGRADE', assignmentId: null, reason: 'Vải lều bạc màu' }),
    })
    expect(tx.auditLog.create).toHaveBeenCalled()
    expect(tx.idempotencyRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ responseBody: expect.anything() }) }),
    )
  })

  it.each([
    ['status is not AVAILABLE', { status: 'PICKED' }, 'STATUS_NOT_AVAILABLE'],
    ['unit has an open assignment', { openAssignment: true }, 'OPEN_ASSIGNMENT'],
    ['unit has a readiness commitment', { commitment: true }, 'READINESS_COMMITMENT'],
  ])('blocks when %s', async (_label, opts, reason) => {
    const { adapter, tx } = makeAdapter(opts)
    await expect(adapter.downgradeGrade(payload)).rejects.toMatchObject({
      code: 'EQUIPMENT_UNIT_NOT_REGRADABLE',
      details: expect.objectContaining({ reason }),
    })
    expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
  })

  it.each([
    ['GOOD_USED (upgrade not allowed)', GOOD_USED, 'RENTAL_GRADE_DOWNGRADE_NOT_ALLOWED'],
    ['plain product', PLAIN, 'RENTAL_GRADE_DECISION_NOT_APPLICABLE'],
  ])('rejects a %s unit', async (_label, product, code) => {
    const { adapter, tx } = makeAdapter({ product })
    await expect(adapter.downgradeGrade(payload)).rejects.toMatchObject({ code })
    expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
  })

  it('rejects a stale expectedVersion', async () => {
    const { adapter } = makeAdapter()
    await expect(adapter.downgradeGrade({ ...payload, expectedVersion: 4 })).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
    })
  })

  it('replays the stored response for the same key and body, and rejects a different body', async () => {
    const first = makeAdapter()
    const stored = await first.adapter.downgradeGrade(payload)
    const requestHash = first.tx.idempotencyRecord.create.mock.calls[0][0].data.requestHash

    const replay = makeAdapter({ cached: { requestHash, responseBody: stored } })
    await expect(replay.adapter.downgradeGrade(payload)).resolves.toEqual(stored)
    expect(replay.tx.equipmentUnit.update).not.toHaveBeenCalled()

    const reused = makeAdapter({ cached: { requestHash, responseBody: stored } })
    await expect(reused.adapter.downgradeGrade({ ...payload, reason: 'Lý do khác' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    })
  })
})

describe('renter view shows the rented grade', () => {
  it('handover-preview trả tên và hạng sản phẩm của từng món trong package', async () => {
    const unit = (id: string, product: { id: string; name: string; grade: string | null }) => ({
      equipmentUnitId: id,
      equipmentUnit: { assetCode: `A-${id}`, condition: 'GOOD', product },
    })
    const prisma: any = {
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'renter-1',
          recipientSnapshot: {},
          status: 'READY_FOR_HANDOVER',
          pickupPoint: { id: 'pp', name: 'Điểm', address: 'x' },
          packageViaOrderId: {
            id: 'pkg',
            packageCode: 'PKG-1',
            status: 'READY',
            version: 1,
            packageItemsViaPackageId: [
              unit('u-1', { id: LIKE_NEW.id, name: 'Lều – Rất mới', grade: 'LIKE_NEW' }),
              unit('u-2', { id: PLAIN.id, name: 'Lều thường', grade: null }),
            ],
          },
          conditionSnapshotsViaOrderId: [],
        }),
      },
    }
    const result = await new PrismaDeliveryAdapter(prisma).getHandoverPreview({ orderId: 'o-1', actorUserId: 'renter-1' })
    expect((result.package as any).units.map((u: any) => u.product)).toEqual([
      { id: LIKE_NEW.id, name: 'Lều – Rất mới', grade: 'LIKE_NEW' },
      { id: PLAIN.id, name: 'Lều thường', grade: null },
    ])
    await expect(
      new PrismaDeliveryAdapter(prisma).getHandoverPreview({ orderId: 'o-1', actorUserId: 'someone-else' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
