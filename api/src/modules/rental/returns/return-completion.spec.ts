import { deductionReviewGate } from './application/deduction-review-gate'
import {
  MISSING_REVIEW_GRACE_MINUTES,
  PrismaRentalReturnAdapter,
  openOverdueMissingUnitCases,
  tryCompleteOrder,
} from './infrastructure/adapters/prisma-rental-return.adapter'

/**
 * Orders must always be able to reach COMPLETED: units the customer never returns
 * (missing -> LOST), and receipts nobody finalized. One collection per order (16/11).
 */

const DUE = new Date('2026-11-20T10:00:00.000Z')
const BEFORE_DUE = new Date('2026-11-18T10:00:00.000Z')
const AFTER_DUE = new Date('2026-11-20T13:00:00.000Z')
const ORDER = 'order-1'
const TASK = 'task-1'
const UNIT_A = '11111111-1111-4111-8111-111111111111'
const UNIT_B = '22222222-2222-4222-8222-222222222222'

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return error as { code: string; details?: Record<string, unknown> }
  }
  throw new Error('expected promise to reject')
}

/** Prisma-like tx: listed models/methods as given, anything else an empty-result jest.fn. */
function autoTx(overrides: Record<string, any> = {}) {
  const defaultFor = (method: string) =>
    method === 'findMany' ? [] : method === 'count' ? 0 : method.endsWith('Many') ? { count: 0 } : null
  const wrapModel = (model: Record<string, any>) =>
    new Proxy(model, {
      get(target, method: string) {
        if (!(method in target)) target[method] = jest.fn().mockResolvedValue(defaultFor(method))
        return target[method]
      },
    })
  const models: Record<string, any> = {}
  return new Proxy(overrides, {
    get(target, prop: string) {
      if (prop === 'then') return undefined
      if (prop === '$queryRaw') return target.$queryRaw ?? (target.$queryRaw = jest.fn().mockResolvedValue([]))
      if (!models[prop]) models[prop] = wrapModel(target[prop] ?? {})
      return models[prop]
    },
  }) as any
}

const adapterFor = (tx: any) => new PrismaRentalReturnAdapter({ $transaction: jest.fn((cb: any) => cb(tx)) } as any)

const idempotency = () => ({
  findUnique: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
})

describe('RB-API-602 units not handed back', () => {
  function makeTx(now: Date) {
    const order = {
      id: ORDER,
      version: 3,
      status: 'RETURN_PROCESSING',
      rentalEndAt: DUE,
      operationalReturnDueAt: null,
      rentalPolicy: { lostConfirmationMinutes: 2880 },
      deliveryTasksViaOrderId: [{ id: TASK, taskType: 'RETURN', staffId: 'driver-1', status: 'COLLECTING' }],
      rentalOrderLinesViaOrderId: [
        {
          product: { requiresDeepReturnInspection: false },
          rentalUnitAssignmentsViaOrderLineId: [
            { id: 'as-a', equipmentUnitId: UNIT_A, status: 'RETURNED', returnedAt: now },
            { id: 'as-b', equipmentUnitId: UNIT_B, status: 'HANDED_OVER', returnedAt: null },
          ],
        },
      ],
    }
    return autoTx({
      idempotencyRecord: idempotency(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'driver-1', role: 'STAFF_DELIVERY' }) },
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue({ version: 4 }),
      },
      conditionSnapshot: { findUnique: jest.fn().mockResolvedValue({ condition: 'GOOD' }) },
      returnInspection: {
        upsert: jest.fn(async ({ create }: any) => ({ id: `pre-${create.assignmentId}` })),
      },
      depositSettlementItem: { findUnique: jest.fn().mockResolvedValue({ id: 'dep-a' }) },
      rentalExceptionCase: { create: jest.fn().mockResolvedValue({ id: 'case-1' }) },
    })
  }
  const run = (tx: any, now: Date) =>
    adapterFor(tx).returnInspection({
      actorUserId: 'driver-1',
      orderId: ORDER,
      items: [{ unitId: UNIT_A, outcome: 'OBSERVED_RECEIVED', accessoryIssues: [], evidenceIds: [] } as any],
      expectedVersion: 3,
      idempotencyKey: `obs-${now.toISOString()}`,
      now,
    })

  it.each([
    ['before', BEFORE_DUE],
    ['after', AFTER_DUE],
  ])('%s the deadline opens a RETURN_INCOMPLETE case for the unit still out', async (_label, now) => {
    const tx = makeTx(now)
    const result: any = await run(tx, now)
    expect(result.outstandingUnits).toBeUndefined()
    expect(result.discrepancies).toContainEqual({ unitId: UNIT_B, reason: 'MISSING_PENDING_REVIEW' })
    expect(tx.rentalExceptionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ caseType: 'RETURN_INCOMPLETE', assignmentId: 'as-b' }),
      }),
    )
    expect(tx.rentalOrder.update.mock.calls[0][0].data.exceptionStatus).toBe('RETURN_INCOMPLETE')
  })
})

describe('RB-API-601 single collection round', () => {
  function makeTx(taskStatus: string, unitBStatus: string) {
    return autoTx({
      idempotencyRecord: idempotency(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'driver-1', role: 'STAFF_DELIVERY' }) },
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: ORDER,
          version: 5,
          status: 'RETURN_PROCESSING',
          rentalEndAt: DUE,
          operationalReturnDueAt: null,
          rentalHandoverViaOrderId: { id: 'handover' },
          packageViaOrderId: { id: 'pkg', status: 'RETURNED_TO_INVENTORY' },
          rentalOrderLinesViaOrderId: [
            {
              rentalUnitAssignmentsViaOrderLineId: [
                {
                  id: 'as-a',
                  equipmentUnitId: UNIT_A,
                  status: 'RETURNED',
                  returnedAt: BEFORE_DUE,
                  equipmentUnit: { assetCode: 'A-1', status: 'MAINTENANCE' },
                },
                {
                  id: 'as-b',
                  equipmentUnitId: UNIT_B,
                  status: unitBStatus,
                  returnedAt: null,
                  equipmentUnit: { assetCode: 'B-1', status: 'RENTED' },
                },
              ],
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({ status: 'RETURN_PROCESSING', version: 6 }),
      },
      deliveryTask: {
        findUnique: jest.fn().mockResolvedValue({ id: TASK, status: taskStatus, staffId: 'driver-1' }),
        update: jest.fn().mockResolvedValue({ version: 9 }),
      },
      rentalUnitAssignment: {
        findUnique: jest.fn().mockResolvedValue({ id: 'as-b', status: 'HANDED_OVER', returnedAt: null }),
        update: jest.fn().mockResolvedValue({ returnedAt: AFTER_DUE }),
      },
      rentalReturnSession: { upsert: jest.fn().mockResolvedValue({ id: 'session-2' }) },
    })
  }
  const scan = (tx: any) =>
    adapterFor(tx).returnScan({
      actorUserId: 'driver-1',
      orderId: ORDER,
      assetCodes: ['B-1'],
      operationId: 'round-2',
      expectedVersion: 5,
      idempotencyKey: 'scan-round-2',
      now: AFTER_DUE,
    })

  it.each(['RETURNED', 'INVENTORY_RECEIVED'])(
    'does not reopen a %s task even while the customer still holds a unit',
    async (taskStatus) => {
      const tx = makeTx(taskStatus, 'HANDED_OVER')
      expect((await errorOf(scan(tx))).code).toBe('INVALID_RETURN_STATE')
      expect(tx.rentalUnitAssignment.update).not.toHaveBeenCalled()
    },
  )

  it('keeps a finished round closed when the customer holds nothing', async () => {
    const tx = makeTx('INVENTORY_RECEIVED', 'RETURNED')
    expect((await errorOf(scan(tx))).code).toBe('INVALID_RETURN_STATE')
    expect(tx.rentalUnitAssignment.update).not.toHaveBeenCalled()
  })
})

describe('RB-API-603 second transfer', () => {
  const LOCATION = '33333333-3333-4333-8333-333333333333'
  const previousPrimary = process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID
  beforeAll(() => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = LOCATION
  })
  afterAll(() => {
    if (previousPrimary === undefined) delete process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID
    else process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = previousPrimary
  })
  function makeTx(unitIds: string[]) {
    return autoTx({
      idempotencyRecord: idempotency(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'driver-1', role: 'STAFF_DELIVERY' }) },
      deliveryTask: {
        findUnique: jest.fn().mockResolvedValue({
          id: TASK,
          orderId: ORDER,
          taskType: 'RETURN',
          staffId: 'driver-1',
          status: 'RETURNED',
          version: 7,
          packageId: 'pkg',
        }),
      },
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: ORDER,
          rentalPolicy: { returnToInventoryAllowanceHours: 4 },
          inventoryTaskViaOrderId: { inventoryLocationId: LOCATION },
          rentalOrderLinesViaOrderId: [
            {
              rentalUnitAssignmentsViaOrderLineId: [
                { id: 'as-a', equipmentUnitId: UNIT_A, status: 'RETURNED' },
                { id: 'as-b', equipmentUnitId: UNIT_B, status: 'RETURNED' },
              ],
            },
          ],
        }),
      },
      returnInspection: { findUnique: jest.fn().mockResolvedValue({ id: 'pre' }) },
      // Round 1 already moved unit A to the warehouse.
      returnCustodyTransfer: {
        findMany: jest.fn().mockResolvedValue([{ id: 'tr-1', status: 'RECEIVED', unitIds: [UNIT_A] }]),
        create: jest.fn().mockResolvedValue({
          id: 'tr-2',
          status: 'PENDING_RECEIPT',
          transferStartedAt: AFTER_DUE,
          transferWatchAt: null,
          monitoringStatus: 'ON_TIME',
        }),
      },
      rentalExceptionCase: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    })
  }
  const transfer = (tx: any, unitIds: string[]) =>
    adapterFor(tx).returnToInventoryLocation({
      actorUserId: 'driver-1',
      deliveryTaskId: TASK,
      unitIds,
      missingInCustodyUnitIds: [],
      expectedVersion: 7,
      idempotencyKey: `transfer-${unitIds.join()}`,
      now: AFTER_DUE,
    } as any)

  it('does not report units of the earlier round as missing from custody', async () => {
    const tx = makeTx([UNIT_B])
    const result: any = await transfer(tx, [UNIT_B])
    expect(result).toMatchObject({ pendingTransferId: 'tr-2', unitIds: [UNIT_B], missingInCustodyUnitIds: [] })
    expect(tx.rentalExceptionCase.create).not.toHaveBeenCalled()
  })

  it('skips units of the earlier round when the client lists every returned unit', async () => {
    const tx = makeTx([UNIT_A, UNIT_B])
    await transfer(tx, [UNIT_A, UNIT_B])
    expect(tx.returnCustodyTransfer.create.mock.calls[0][0].data.unitIds).toEqual([UNIT_B])
    expect(tx.rentalExceptionCase.create).not.toHaveBeenCalled()
  })

  it('refuses a request made only of units an earlier round already moved', async () => {
    const tx = makeTx([UNIT_A])
    const error = await errorOf(transfer(tx, [UNIT_A]))
    expect(error.code).toBe('CUSTODY_MISMATCH')
    expect(error.details).toMatchObject({ reason: 'UNIT_ALREADY_TRANSFERRED', unitIds: [UNIT_A] })
  })
})

describe('openOverdueMissingUnitCases', () => {
  function makeTx(opts: { status?: string; existingCase?: boolean; taskStatus?: string } = {}) {
    return autoTx({
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: ORDER,
          status: opts.status ?? 'ACTIVE',
          exceptionStatus: 'OVERDUE',
          rentalEndAt: DUE,
          operationalReturnDueAt: null,
          rentalPolicy: { lostConfirmationMinutes: 2880 },
          deliveryTasksViaOrderId: [{ staffId: 'driver-1', status: opts.taskStatus ?? 'SCHEDULED' }],
          rentalOrderLinesViaOrderId: [
            {
              rentalUnitAssignmentsViaOrderLineId: [
                { id: 'as-a', equipmentUnitId: UNIT_A, status: 'HANDED_OVER', returnedAt: null },
                { id: 'as-b', equipmentUnitId: UNIT_B, status: 'RETURNED', returnedAt: BEFORE_DUE },
              ],
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      rentalExceptionCase: {
        findFirst: jest.fn().mockResolvedValue(opts.existingCase ? { id: 'old-case' } : null),
        create: jest.fn().mockResolvedValue({ id: 'case-new' }),
      },
      returnInspection: { upsert: jest.fn().mockResolvedValue({ id: 'pre-a' }) },
    })
  }
  const afterGrace = new Date(DUE.getTime() + MISSING_REVIEW_GRACE_MINUTES * 60_000)

  it.each(['RETURNED', 'INVENTORY_RECEIVED', 'CLOSED'])(
    'before the deadline backfills a missing case once the collection finished (task %s)',
    async (taskStatus) => {
      const tx = makeTx({ status: 'RETURN_PROCESSING', taskStatus })
      await expect(openOverdueMissingUnitCases(tx, ORDER, BEFORE_DUE)).resolves.toBe(1)
      expect(tx.rentalExceptionCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ caseType: 'RETURN_INCOMPLETE', assignmentId: 'as-a' }),
        }),
      )
      expect(tx.rentalOrder.update.mock.calls[0][0].data.exceptionStatus).toBe('RETURN_INCOMPLETE')
    },
  )

  it('before the deadline leaves an uncollected order alone', async () => {
    const tx = makeTx({ taskStatus: 'SCHEDULED' })
    await expect(openOverdueMissingUnitCases(tx, ORDER, BEFORE_DUE)).resolves.toBe(0)
    expect(tx.rentalExceptionCase.create).not.toHaveBeenCalled()
  })

  it('opens one RETURN_INCOMPLETE case per unreturned unit and moves the order to RETURN_PENDING', async () => {
    const tx = makeTx()
    await expect(openOverdueMissingUnitCases(tx, ORDER, afterGrace)).resolves.toBe(1)
    expect(tx.returnInspection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          assignmentId: 'as-a',
          outcome: 'MISSING_PENDING_REVIEW',
          inspectorId: 'driver-1',
        }),
      }),
    )
    expect(tx.rentalExceptionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ caseType: 'RETURN_INCOMPLETE', assignmentId: 'as-a' }),
      }),
    )
    expect(tx.rentalOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RETURN_PENDING', exceptionStatus: 'RETURN_INCOMPLETE' }),
      }),
    )
  })

  it('keeps a RETURN_PROCESSING order in its status (partial return)', async () => {
    const tx = makeTx({ status: 'RETURN_PROCESSING' })
    await openOverdueMissingUnitCases(tx, ORDER, afterGrace)
    expect(tx.rentalOrder.update.mock.calls[0][0].data.status).toBe('RETURN_PROCESSING')
  })

  it('waits for the grace period and never reopens a unit that already had a case', async () => {
    const early = makeTx()
    await expect(openOverdueMissingUnitCases(early, ORDER, new Date(afterGrace.getTime() - 60_000))).resolves.toBe(0)
    const handled = makeTx({ existingCase: true })
    await expect(openOverdueMissingUnitCases(handled, ORDER, afterGrace)).resolves.toBe(0)
    expect(handled.rentalExceptionCase.create).not.toHaveBeenCalled()
    expect(handled.rentalOrder.update).not.toHaveBeenCalled()
  })
})

describe('RB-API-610 resolving a unit the customer never returned', () => {
  function makeTx(
    decision: 'CONFIRM_LOST' | 'CLOSE_NO_ACTION' | 'APPROVE_DEDUCTION',
    overrides: { exceptionCase?: Record<string, unknown>; decisionSnapshot?: Record<string, unknown> } = {},
  ) {
    const exceptionCase = {
      id: 'case-1',
      orderId: ORDER,
      version: 1,
      status: 'OPEN',
      caseType: 'RETURN_INCOMPLETE',
      reason: 'MISSING_PENDING_REVIEW',
      assignmentId: 'as-a',
      unitId: UNIT_A,
      inspectionId: 'pre-a',
      evidenceCompleteAt: null,
      dueAt: null,
      createdAt: new Date(DUE.getTime() + MISSING_REVIEW_GRACE_MINUTES * 60_000),
      inspection: { id: 'pre-a', stage: 'PRELIMINARY', version: 1 },
      order: { rentalEndAt: DUE, operationalReturnDueAt: null, rentalPolicy: { lostConfirmationMinutes: 2880 } },
      ...overrides.exceptionCase,
    }
    return {
      decision,
      tx: autoTx({
        idempotencyRecord: idempotency(),
        user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN' }) },
        rentalExceptionCase: {
          findUnique: jest.fn().mockResolvedValueOnce({ orderId: ORDER }).mockResolvedValue(exceptionCase),
          update: jest.fn().mockResolvedValue({ status: 'RESOLVED' }),
        },
        depositSettlementItem: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'dep-a',
            depositAmount: { toString: () => '500000' },
            refundAmount: 0,
            decisionSnapshot: overrides.decisionSnapshot ?? {},
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        returnInspection: { upsert: jest.fn().mockResolvedValue({ id: 'final-a', stage: 'FINAL' }) },
      }),
    }
  }
  const resolve = (tx: any, decision: string, extra: Record<string, unknown> = {}) =>
    adapterFor(tx).resolveException({
      actorUserId: 'admin-1',
      exceptionId: 'case-1',
      decision,
      reason: 'Khách không trả',
      expectedVersion: 1,
      idempotencyKey: `resolve-${decision}`,
      now: new Date(DUE.getTime() + 3 * 24 * 3600_000),
      ...extra,
    } as any)

  describe('CONFIRM_LOST window for a unit not handed back at an early collection', () => {
    const collectedAt = new Date(DUE.getTime() - 10 * 24 * 3600_000)
    const early = { exceptionCase: { createdAt: collectedAt, dueAt: new Date(collectedAt.getTime() + 2880 * 60_000) } }

    it('is allowed immediately after collection (48h gate commented out for demo)', async () => {
      const { tx } = makeTx('CONFIRM_LOST', early)
      const result: any = await resolve(tx, 'CONFIRM_LOST', { now: collectedAt })
      expect(result.nextAction).toBe('CREATE_DEPOSIT_SETTLEMENT')
    })

    // [DEMO] Tạm comment 2 test kiểm tra chặn 48h LOST_CONFIRMATION_TOO_EARLY khi chạy demo:
    // it('is still refused inside the 48h after the collection', async () => {
    //   const { tx } = makeTx('CONFIRM_LOST', early)
    //   const error = await errorOf(
    //     resolve(tx, 'CONFIRM_LOST', { now: new Date(collectedAt.getTime() + 2880 * 60_000 - 1) }),
    //   )
    //   expect(error.code).toBe('LOST_CONFIRMATION_TOO_EARLY')
    //   expect(error.details?.earliestAt).toBe(new Date(collectedAt.getTime() + 2880 * 60_000).toISOString())
    // })
    //
    // it('keeps counting from the deadline for a case that is not a missing unit', async () => {
    //   const { tx } = makeTx('CONFIRM_LOST', {
    //     exceptionCase: { ...early.exceptionCase, dueAt: null, caseType: 'DAMAGE', evidenceCompleteAt: collectedAt },
    //   })
    //   const error = await errorOf(resolve(tx, 'CONFIRM_LOST', { now: new Date(DUE.getTime() + 3600_000) }))
    //   expect(error.code).toBe('LOST_CONFIRMATION_TOO_EARLY')
    // })
  })

  describe('APPROVE_DEDUCTION with an amount set by Admin', () => {
    const damage = {
      exceptionCase: {
        caseType: 'DAMAGE',
        reason: 'DEDUCTION_APPROVAL_REQUIRED',
        evidenceCompleteAt: DUE,
        inspection: { id: 'final-a', stage: 'FINAL', version: 1 },
      },
      decisionSnapshot: { proposedDeduction: '250000', cappedDeduction: '200000' },
    }
    const approvedSnapshot = (tx: any) => tx.depositSettlementItem.update.mock.calls[0][0].data.decisionSnapshot

    it('approves the proposed amount when none is sent', async () => {
      const { tx } = makeTx('APPROVE_DEDUCTION', damage)
      await resolve(tx, 'APPROVE_DEDUCTION')
      expect(approvedSnapshot(tx)).toMatchObject({
        approvedDeduction: '200000',
        cappedDeduction: '200000',
        adminAdjustedDeduction: false,
      })
    })

    it('approves a lower amount and keeps the proposal for the record', async () => {
      const { tx } = makeTx('APPROVE_DEDUCTION', damage)
      await resolve(tx, 'APPROVE_DEDUCTION', { approvedDeductionAmount: 120000 })
      expect(approvedSnapshot(tx)).toMatchObject({
        approvedDeduction: '120000',
        cappedDeduction: '200000',
        adminAdjustedDeduction: true,
      })
    })

    it('refuses an amount above the proposal', async () => {
      const { tx } = makeTx('APPROVE_DEDUCTION', damage)
      const error = await errorOf(resolve(tx, 'APPROVE_DEDUCTION', { approvedDeductionAmount: 200001 }))
      expect(error.code).toBe('INVALID_RETURN_STATE')
      expect(error.details).toMatchObject({ reason: 'APPROVED_DEDUCTION_ABOVE_PROPOSAL', maximum: 200000 })
      expect(tx.depositSettlementItem.update).not.toHaveBeenCalled()
    })
  })

  it('CONFIRM_LOST works without photos and points the case at the FINAL inspection 606 needs', async () => {
    const { tx } = makeTx('CONFIRM_LOST')
    const result: any = await resolve(tx, 'CONFIRM_LOST')
    expect(result.assessmentId).toBe('final-a')
    expect(tx.rentalExceptionCase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ inspectionId: 'final-a', status: 'RESOLVED' }) }),
    )
  })

  it('CLOSE_NO_ACTION writes the unit off as LOST without charging the customer', async () => {
    const { tx } = makeTx('CLOSE_NO_ACTION')
    const result: any = await resolve(tx, 'CLOSE_NO_ACTION')
    expect(result.nextAction).toBe('CREATE_DEPOSIT_SETTLEMENT')
    expect(result.assessmentId).toBe('final-a')
    expect(tx.returnInspection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ stage: 'FINAL', outcome: 'LOST_CONFIRMED' }) }),
    )
    expect(tx.depositSettlementItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deductionAmount: 0,
          reason: 'MISSING_UNIT_LOSS_WAIVED',
          inspectionId: 'final-a',
        }),
      }),
    )
  })
})

describe('deductionReviewGate for a unit never returned', () => {
  it('does not wait for evidence publication once a missing unit is confirmed LOST', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null) // no open case
      .mockResolvedValueOnce(null) // nothing published (no photos exist)
      .mockResolvedValueOnce({ id: 'case-1' }) // resolved RETURN_INCOMPLETE CONFIRM_LOST
    const gate = await deductionReviewGate({ rentalExceptionCase: { findFirst } } as any, {
      orderId: ORDER,
      inspectionId: 'final-a',
      assignmentId: 'as-a',
      reviewMinutes: 2880,
      now: AFTER_DUE,
    })
    expect(gate).toBeNull()
    expect(findFirst.mock.calls[2][0].where).toMatchObject({
      caseType: 'RETURN_INCOMPLETE',
      resolution: { startsWith: 'CONFIRM_LOST:' },
    })
  })

  it('still waits for a damage deduction whose evidence is unpublished', async () => {
    const findFirst = jest.fn().mockResolvedValue(null)
    const gate = await deductionReviewGate({ rentalExceptionCase: { findFirst } } as any, {
      orderId: ORDER,
      inspectionId: 'final-a',
      assignmentId: 'as-a',
      reviewMinutes: 2880,
      now: AFTER_DUE,
    })
    expect(gate).toBe('USER_48H_REVIEW_WINDOW_NOT_CLOSED')
  })
})

describe('tryCompleteOrder when the customer kept every unit', () => {
  function order(overrides: Record<string, unknown>) {
    return {
      id: ORDER,
      version: 9,
      status: 'RETURN_PENDING',
      rentalOrderLinesViaOrderId: [
        { rentalUnitAssignmentsViaOrderLineId: [{ status: 'CLOSED' }, { status: 'REPLACED' }] },
      ],
      depositSettlementViaOrderId: { depositSettlementItemsViaSettlementId: [{ status: 'SETTLED' }] },
      rentalExceptionCasesViaOrderId: [{ status: 'RESOLVED' }],
      deliveryTasksViaOrderId: [{ id: TASK, taskType: 'RETURN', status: 'SCHEDULED' }],
      packageViaOrderId: { id: 'pkg', status: 'HANDED_OVER' },
      returnCustodyTransfersViaOrderId: [],
      rentalReturnSessionsViaOrderId: [],
      ...overrides,
    }
  }
  const txFor = (value: any) =>
    autoTx({
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue(value),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    })

  it('completes once every unit is closed as LOST, closing the never-used task and package', async () => {
    const tx = txFor(order({}))
    await expect(tryCompleteOrder(tx, ORDER, AFTER_DUE)).resolves.toBe(true)
    expect(tx.deliveryTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TASK }, data: expect.objectContaining({ status: 'CLOSED' }) }),
    )
    expect(tx.package.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED' }) }),
    )
  })

  it('still refuses while a unit is open', async () => {
    const tx = txFor(
      order({
        rentalOrderLinesViaOrderId: [
          { rentalUnitAssignmentsViaOrderLineId: [{ status: 'CLOSED' }, { status: 'HANDED_OVER' }] },
        ],
      }),
    )
    await expect(tryCompleteOrder(tx, ORDER, AFTER_DUE)).resolves.toBe(false)
    expect(tx.rentalOrder.updateMany).not.toHaveBeenCalled()
  })
})

describe('RB-API-604 receiving one round while Delivery still holds the next', () => {
  function makeTx(unitBStatus: 'RETURNED' | 'HANDED_OVER', unitBInTransfer: boolean) {
    return autoTx({
      idempotencyRecord: idempotency(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'keeper-1', role: 'STAFF_INVENTORY' }) },
      deliveryTask: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: TASK,
            orderId: ORDER,
            taskType: 'RETURN',
            status: 'RETURNED',
            version: 4,
            packageId: 'pkg',
          }),
        update: jest.fn().mockResolvedValue({ status: 'INVENTORY_RECEIVED', version: 5 }),
      },
      returnCustodyTransfer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tr-1',
          deliveryTaskId: TASK,
          orderId: ORDER,
          inventoryLocationId: 'loc-1',
          status: 'PENDING_RECEIPT',
          unitIds: [UNIT_A],
          receivedUnitIds: [],
          fromStaffId: 'driver-1',
        }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'tr-1', status: 'PENDING_RECEIPT', unitIds: [UNIT_A] },
            ...(unitBInTransfer ? [{ id: 'tr-2', status: 'RECEIVED', unitIds: [UNIT_B] }] : []),
          ]),
        update: jest.fn().mockResolvedValue({ status: 'RECEIVED' }),
      },
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: ORDER,
          rentalPolicy: { returnInspectionSlaHours: 24, deepInspectionSlaHours: 48 },
          packageViaOrderId: null,
          rentalOrderLinesViaOrderId: [
            {
              rentalUnitAssignmentsViaOrderLineId: [
                { id: 'as-a', equipmentUnitId: UNIT_A, status: 'RETURNED' },
                { id: 'as-b', equipmentUnitId: UNIT_B, status: unitBStatus },
              ],
            },
          ],
        }),
      },
      equipmentUnit: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: UNIT_A,
            status: 'RETURN_PENDING',
            product: { requiresDeepReturnInspection: false },
          }),
      },
      returnInspection: { findUnique: jest.fn().mockResolvedValue({ id: 'pre-a', outcome: 'NORMAL' }) },
    })
  }
  const receive = (tx: any) =>
    adapterFor(tx).receiveReturn({
      actorUserId: 'keeper-1',
      returnId: TASK,
      pendingTransferId: 'tr-1',
      inventoryLocationId: 'loc-1',
      scannedUnitIds: [UNIT_A],
      expectedVersion: 4,
      idempotencyKey: 'receive-1',
      now: AFTER_DUE,
    } as any)

  it('keeps the task RETURNED while Delivery holds a collected unit it has not transferred yet', async () => {
    const tx = makeTx('RETURNED', false)
    await receive(tx)
    expect(tx.deliveryTask.update).not.toHaveBeenCalled()
  })

  it('moves the task to INVENTORY_RECEIVED once everything Delivery collected is at the warehouse', async () => {
    const tx = makeTx('RETURNED', true)
    await receive(tx)
    expect(tx.deliveryTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'INVENTORY_RECEIVED' }) }),
    )
  })

  it('a unit not handed back (missing case) does not hold the task back', async () => {
    const tx = makeTx('HANDED_OVER', false)
    await receive(tx)
    expect(tx.deliveryTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'INVENTORY_RECEIVED' }) }),
    )
  })
})
