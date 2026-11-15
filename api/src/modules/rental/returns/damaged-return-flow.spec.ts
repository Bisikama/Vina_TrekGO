import { MediaScope } from '@prisma/client'
import { AcceptAssessmentUseCase } from './application/use-cases/accept-assessment.use-case'
import {
  PrismaRentalReturnAdapter,
  closeSettledAssignment,
} from './infrastructure/adapters/prisma-rental-return.adapter'

const NOW = new Date('2026-11-15T08:00:00.000Z')
const UNIT = '11111111-1111-4111-8111-111111111111'
const ASSIGNMENT = 'as-1'
const ORDER = 'order-1'
const TASK = 'task-1'

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return error as { code: string; details?: Record<string, unknown> }
  }
  throw new Error('expected promise to reject')
}

function idempotency() {
  return {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  }
}

function adapterFor(tx: any) {
  const prisma: any = { $transaction: jest.fn((cb: any) => cb(tx)) }
  return new PrismaRentalReturnAdapter(prisma)
}

function returnOrder() {
  return {
    id: ORDER,
    rentalPolicy: { adminApprovalMinutes: 60 },
    rentalOrderLinesViaOrderId: [
      {
        id: 'line-1',
        productId: 'product-1',
        product: { requiresDeepReturnInspection: false },
        rentalUnitAssignmentsViaOrderLineId: [{ id: ASSIGNMENT, equipmentUnitId: UNIT }],
      },
    ],
  }
}

describe('closeSettledAssignment', () => {
  function makeTx(opts: { outcome?: string; stage?: string; assignmentStatus?: string; unitStatus?: string } = {}) {
    return {
      returnInspection: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ outcome: opts.outcome ?? 'DAMAGE_CONFIRMED', stage: opts.stage ?? 'FINAL' }),
      },
      rentalUnitAssignment: {
        findUnique: jest.fn().mockResolvedValue({
          id: ASSIGNMENT,
          status: opts.assignmentStatus ?? 'RETURNED',
          equipmentUnitId: UNIT,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      equipmentUnit: {
        findUnique: jest.fn().mockResolvedValue({ status: opts.unitStatus ?? 'MAINTENANCE' }),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as any
  }
  const input = { assignmentId: ASSIGNMENT, inspectionId: 'ins-final', actorUserId: 'admin-1', now: NOW }

  it.each(['DAMAGE_CONFIRMED', 'ISSUE'])('closes the assignment and marks a %s unit DAMAGED', async (outcome) => {
    const tx = makeTx({ outcome })
    await expect(closeSettledAssignment(tx, input)).resolves.toBe(true)
    expect(tx.rentalUnitAssignment.update).toHaveBeenCalledWith({
      where: { id: ASSIGNMENT },
      data: { status: 'CLOSED', closedAt: NOW, version: { increment: 1 } },
    })
    expect(tx.equipmentUnit.update).toHaveBeenCalledWith({
      where: { id: UNIT },
      data: { status: 'DAMAGED', condition: 'DAMAGED', version: { increment: 1 } },
    })
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'RETURN_DAMAGED_UNIT_AUTO_CLOSED' }) }),
    )
  })

  it('closes the assignment but leaves a unit that staff already moved out of MAINTENANCE', async () => {
    const tx = makeTx({ unitStatus: 'AVAILABLE' })
    await expect(closeSettledAssignment(tx, input)).resolves.toBe(true)
    expect(tx.rentalUnitAssignment.update).toHaveBeenCalled()
    expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
  })

  it('closes a LOST_CONFIRMED assignment and marks the unit LOST', async () => {
    const tx = makeTx({ outcome: 'LOST_CONFIRMED', assignmentStatus: 'HANDED_OVER', unitStatus: 'RENTED' })
    await expect(closeSettledAssignment(tx, input)).resolves.toBe(true)
    expect(tx.rentalUnitAssignment.update).toHaveBeenCalled()
    expect(tx.equipmentUnit.update).toHaveBeenCalledWith({
      where: { id: UNIT },
      data: { status: 'LOST', condition: 'LOST', version: { increment: 1 } },
    })
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'RETURN_LOST_UNIT_AUTO_CLOSED' }) }),
    )
  })

  it.each([
    ['a NORMAL inspection', { outcome: 'NORMAL' }],
    ['a PRELIMINARY inspection', { stage: 'PRELIMINARY' }],
    ['an already CLOSED assignment', { assignmentStatus: 'CLOSED' }],
  ])('does nothing for %s', async (_label, opts) => {
    const tx = makeTx(opts)
    await expect(closeSettledAssignment(tx, input)).resolves.toBe(false)
    expect(tx.rentalUnitAssignment.update).not.toHaveBeenCalled()
    expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })
})

describe('RB-API-605 final inspection with damage', () => {
  function makeTx(opts: { baseline: boolean }) {
    return {
      $queryRaw: jest.fn().mockResolvedValue([]),
      idempotencyRecord: idempotency(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-1', role: 'STAFF_INVENTORY' }) },
      deliveryTask: {
        findUnique: jest.fn().mockResolvedValue({
          id: TASK,
          taskType: 'RETURN',
          status: 'INVENTORY_RECEIVED',
          version: 3,
          orderId: ORDER,
        }),
      },
      rentalOrder: { findUnique: jest.fn().mockResolvedValue(returnOrder()) },
      custodyEvent: { findFirst: jest.fn().mockResolvedValue({ id: 'custody-1' }) },
      depositSettlementItem: { findUnique: jest.fn().mockResolvedValue({ id: 'dep-1', depositAmount: 500000 }) },
      returnInspection: { findUnique: jest.fn().mockResolvedValue({ id: 'ins-pre', outcome: 'NORMAL' }) },
      returnInspectionTask: { findUnique: jest.fn().mockResolvedValue({ status: 'PENDING' }) },
      mediaAsset: {
        findMany: jest.fn(async ({ where }: any) => where.id.in.map((id: string) => ({ id }))),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      conditionSnapshot: {
        findUnique: jest.fn().mockResolvedValue(opts.baseline ? { condition: 'GOOD' } : null),
      },
    } as any
  }
  const command = (evidence: { item: string[]; damage: string[] }) => ({
    actorUserId: 'staff-1',
    returnId: TASK,
    expectedVersion: 3,
    idempotencyKey: 'final-inspection-key',
    now: NOW,
    items: [
      {
        issueUnitId: UNIT,
        outcome: 'ISSUE' as const,
        condition: 'DAMAGED' as const,
        damage: [{ ruleId: 'rule-1', quantity: 1, evidenceIds: evidence.damage }],
        evidenceIds: evidence.item,
      },
    ],
  })

  it('accepts CONDITION_EVIDENCE photos on damage findings, like on the item itself', async () => {
    // Without a baseline the flow stops right after evidence validation, which is what we inspect.
    const tx = makeTx({ baseline: false })
    const error = await errorOf(
      adapterFor(tx).finalInspection(command({ item: ['media-1'], damage: ['media-1'] }) as any),
    )
    expect(error.code).toBe('CONDITION_BASELINE_MISSING')
    expect(tx.mediaAsset.findMany).toHaveBeenCalledTimes(2)
    for (const [args] of tx.mediaAsset.findMany.mock.calls)
      expect(args.where.scope.in).toEqual(
        expect.arrayContaining([
          MediaScope.CONDITION_EVIDENCE,
          MediaScope.RETURN_EVIDENCE,
          MediaScope.EXCEPTION_EVIDENCE,
        ]),
      )
  })

  it('rejects damage that carries no evidence at all', async () => {
    const tx = makeTx({ baseline: true })
    const error = await errorOf(adapterFor(tx).finalInspection(command({ item: [], damage: [] }) as any))
    expect(error.code).toBe('EVIDENCE_NOT_READY')
    expect(error.details).toEqual(expect.objectContaining({ reason: 'DAMAGE_EVIDENCE_REQUIRED', unitId: UNIT }))
  })
})

describe('RB-API-608 finalize DAMAGED', () => {
  function makeTx(finalOutcome: string) {
    return {
      $queryRaw: jest.fn().mockResolvedValue([]),
      idempotencyRecord: idempotency(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-1', role: 'STAFF_INVENTORY' }) },
      deliveryTask: {
        findUnique: jest.fn().mockResolvedValue({ id: TASK, taskType: 'RETURN', version: 4, orderId: ORDER }),
      },
      rentalOrder: { findUnique: jest.fn().mockResolvedValue(returnOrder()) },
      custodyEvent: { findFirst: jest.fn().mockResolvedValue({ id: 'custody-1' }) },
      returnInspection: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ins-final', outcome: finalOutcome, version: 1 }),
      },
      equipmentUnit: {
        findUnique: jest.fn().mockResolvedValue({ status: 'CLEANING' }),
        update: jest.fn().mockResolvedValue({}),
      },
      depositSettlementItem: { findUnique: jest.fn().mockResolvedValue({ id: 'dep-1', status: 'REFUND_PENDING' }) },
      rentalUnitAssignment: { update: jest.fn().mockResolvedValue({}) },
    } as any
  }

  it('refuses to mark a unit that passed FINAL inspection as DAMAGED', async () => {
    const tx = makeTx('NORMAL')
    const error = await errorOf(
      adapterFor(tx).finalizeReturn({
        actorUserId: 'staff-1',
        returnId: TASK,
        unitOutcomes: [{ unitId: UNIT, outcome: 'DAMAGED' }],
        inspectionVersion: 1,
        expectedVersion: 4,
        idempotencyKey: 'finalize-key-1',
        now: NOW,
      } as any),
    )
    expect(error.code).toBe('RETURN_ITEM_REVIEW_REQUIRED')
    expect(error.details).toEqual(expect.objectContaining({ reason: 'FINAL_OUTCOME_MISMATCH', unitId: UNIT }))
    expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
    expect(tx.rentalUnitAssignment.update).not.toHaveBeenCalled()
  })
})

describe('RB-API-606 settlement heals damaged units', () => {
  it('closes a damaged unit when replaying an already-settled item', async () => {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      idempotencyRecord: idempotency(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN' }) },
      rentalOrder: {
        // Status outside RETURN_PROCESSING makes tryCompleteOrder bail out early; it is covered elsewhere.
        findUnique: jest.fn().mockResolvedValue({ id: ORDER, status: 'ACTIVE', rentalPolicy: {} }),
      },
      returnInspection: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ins-final' }),
        findUnique: jest.fn().mockResolvedValue({ outcome: 'DAMAGE_CONFIRMED', stage: 'FINAL' }),
      },
      depositSettlementItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'dep-1',
          assignmentId: ASSIGNMENT,
          status: 'SETTLED',
          deductionAmount: 500000,
          refundAmount: 0,
          decisionSnapshot: { approvalRef: 'APR-1' },
        }),
      },
      rentalExceptionCase: { findFirst: jest.fn().mockResolvedValue({ id: 'case-1' }) },
      rentalUnitAssignment: {
        findUnique: jest.fn().mockResolvedValue({ id: ASSIGNMENT, status: 'RETURNED', equipmentUnitId: UNIT }),
        update: jest.fn().mockResolvedValue({}),
      },
      equipmentUnit: {
        findUnique: jest.fn().mockResolvedValue({ status: 'MAINTENANCE' }),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      depositSettlement: { findUnique: jest.fn().mockResolvedValue(null) },
      refund: { findUnique: jest.fn().mockResolvedValue(null) },
      depositRefundItemAllocation: { findUnique: jest.fn().mockResolvedValue(null) },
    }
    const result: any = await adapterFor(tx).createDepositSettlement({
      actorUserId: 'admin-1',
      orderId: ORDER,
      assessmentId: 'ins-final',
      approvalRef: 'APR-1',
      idempotencyKey: 'settlement-key-1',
      now: NOW,
    } as any)
    expect(result.status).toBe('SETTLED')
    expect(tx.rentalUnitAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED' }) }),
    )
    expect(tx.equipmentUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DAMAGED' }) }),
    )
  })
})

describe('RB-API-617 customer accepts a published deduction', () => {
  const CUSTOMER = 'customer-1'
  const accessibleAt = new Date('2026-11-15T07:00:00.000Z')
  function makeTx(
    opts: {
      owner?: string
      review?: object | null
      itemStatus?: string
      approvedDeduction?: string
      published?: Record<string, unknown> | null
      dbNow?: Date
    } = {},
  ) {
    return {
      $queryRaw: jest.fn().mockResolvedValue([{ now: opts.dbNow ?? NOW }]),
      idempotencyRecord: idempotency(),
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: ORDER,
          userId: opts.owner ?? CUSTOMER,
          rentalPolicy: { userAssessmentReviewMinutes: 2880 },
        }),
      },
      returnInspection: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ins-final', assignmentId: ASSIGNMENT, unitId: UNIT }),
      },
      rentalAssessmentReview: { findUnique: jest.fn().mockResolvedValue(opts.review ?? null) },
      depositSettlementItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'dep-1',
          status: opts.itemStatus ?? 'DEDUCTION_APPROVED',
          approvedBy: 'admin-1',
          decisionSnapshot: { approvedDeduction: opts.approvedDeduction ?? '100000', approvalRef: 'APR-1' },
        }),
      },
      rentalExceptionCase: {
        findFirst: jest.fn().mockResolvedValue(
          opts.published === undefined
            ? {
                id: 'case-1',
                evidenceAccessibleAt: accessibleAt,
                dueAt: new Date(accessibleAt.getTime() + 2880 * 60_000),
              }
            : opts.published,
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as any
  }
  const command = {
    actorUserId: CUSTOMER,
    orderId: ORDER,
    assessmentId: 'ins-final',
    idempotencyKey: 'accept-key-1',
    now: NOW,
  }

  it('closes the review window now and hands back what settlement needs', async () => {
    const tx = makeTx()
    const result = await adapterFor(tx).acceptAssessment(command)
    expect(tx.rentalExceptionCase.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: { customerAcceptedAt: NOW, dueAt: NOW, version: { increment: 1 } },
    })
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'RENTAL_DEDUCTION_ACCEPTED_BY_CUSTOMER' }) }),
    )
    expect(result).toEqual({
      caseId: 'case-1',
      assessmentId: 'ins-final',
      acceptedAt: NOW.toISOString(),
      settlement: {
        orderId: ORDER,
        assessmentId: 'ins-final',
        approvalRef: 'APR-1',
        approvedBy: 'admin-1',
        depositItemId: 'dep-1',
      },
    })
  })

  it.each([
    ['someone other than the order owner', { owner: 'other-user' }, 'FORBIDDEN', undefined],
    [
      'a dispute was already submitted',
      { review: { id: 'review-1' } },
      'INVALID_RETURN_STATE',
      'REVIEW_ALREADY_SUBMITTED',
    ],
    ['the deduction is zero', { approvedDeduction: '0' }, 'INVALID_RETURN_STATE', 'NO_APPROVED_DEDUCTION'],
    [
      'it was already accepted',
      { published: { id: 'case-1', evidenceAccessibleAt: accessibleAt, customerAcceptedAt: accessibleAt } },
      'INVALID_RETURN_STATE',
      'DEDUCTION_ALREADY_ACCEPTED',
    ],
    [
      'settlement already started',
      { itemStatus: 'REFUND_PENDING' },
      'INVALID_RETURN_STATE',
      'SETTLEMENT_ALREADY_STARTED',
    ],
    ['evidence was never published', { published: null }, 'INVALID_RETURN_STATE', 'EVIDENCE_NOT_ACCESSIBLE'],
    [
      'evidence access is interrupted',
      { published: { id: 'case-1', evidenceAccessibleAt: accessibleAt, evidenceAccessBlockedAt: NOW } },
      'INVALID_RETURN_STATE',
      'EVIDENCE_ACCESS_INTERRUPTED',
    ],
    [
      'the review window already ended',
      { dbNow: new Date(accessibleAt.getTime() + 2880 * 60_000) },
      'INVALID_RETURN_STATE',
      'USER_REVIEW_WINDOW_EXPIRED',
    ],
  ])('rejects when %s', async (_label, opts, code, reason) => {
    const tx = makeTx(opts as any)
    const error = await errorOf(adapterFor(tx).acceptAssessment(command))
    expect(error.code).toBe(code)
    if (reason) expect(error.details).toEqual(expect.objectContaining({ reason }))
    expect(tx.rentalExceptionCase.update).not.toHaveBeenCalled()
  })
})

describe('AcceptAssessmentUseCase', () => {
  const accepted = {
    caseId: 'case-1',
    assessmentId: 'ins-final',
    acceptedAt: NOW.toISOString(),
    settlement: {
      orderId: ORDER,
      assessmentId: 'ins-final',
      approvalRef: 'APR-1',
      approvedBy: 'admin-1',
      depositItemId: 'dep-1',
    },
  }
  const command = {
    actorUserId: 'customer-1',
    orderId: ORDER,
    assessmentId: 'ins-final',
    idempotencyKey: 'accept-key-1',
    now: NOW,
  }

  it('settles right away as the approving Admin, with the same idempotency key as the worker', async () => {
    const port = {
      acceptAssessment: jest.fn().mockResolvedValue(accepted),
      createDepositSettlement: jest
        .fn()
        .mockResolvedValue({ status: 'REFUND_PENDING', deductionAmount: 100000, refundAmount: 400000 }),
    }
    const result = await new AcceptAssessmentUseCase(port as any).execute(command)
    expect(port.createDepositSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER,
        assessmentId: 'ins-final',
        approvalRef: 'APR-1',
        actorUserId: 'admin-1',
        idempotencyKey: 'auto-settlement:dep-1:APR-1',
      }),
    )
    expect(result).toMatchObject({
      settlementStatus: 'SETTLED',
      settlement: { status: 'REFUND_PENDING', deductionAmount: 100000, refundAmount: 400000 },
    })
  })

  it('keeps the acceptance and defers to the worker when settlement fails', async () => {
    const port = {
      acceptAssessment: jest.fn().mockResolvedValue(accepted),
      createDepositSettlement: jest.fn().mockRejectedValue(new Error('USER_DISPUTE_MUST_BE_RESOLVED')),
    }
    const result = await new AcceptAssessmentUseCase(port as any).execute(command)
    expect(result).toMatchObject({ caseId: 'case-1', settlementStatus: 'DEFERRED', settlement: null })
  })
})

describe('Inventory view of a return where Delivery flagged 2 of 4 units', () => {
  const units = [
    { id: 'as-gps', unit: 'u-gps', asset: '001001', product: 'GPS', flagged: true },
    { id: 'as-bag1', unit: 'u-bag1', asset: '002004', product: 'BAG', flagged: true },
    { id: 'as-bag2', unit: 'u-bag2', asset: '2GU005', product: 'BAG', flagged: false },
    { id: 'as-bag3', unit: 'u-bag3', asset: '2GU003', product: 'BAG', flagged: false },
  ]
  const returnedAt = new Date('2026-11-15T06:00:00.000Z')
  const order = {
    id: ORDER,
    trip: { title: 'Test return' },
    user: { fullName: 'Customer' },
    recipientParticipant: null,
    // RB-API-404: Delivery noted a defect on bag 2GU005 (and one general remark) when handing over.
    rentalHandoverViaOrderId: {
      handedOverAt: new Date('2026-11-10T02:00:00.000Z'),
      reportedIssues: [
        { unitId: 'u-bag2', type: 'DAMAGE', description: 'Khoá kéo hỏng sẵn' },
        { type: 'NOTE', description: 'Khách nhận thiếu túi đựng' },
        { unitId: 'u-bag2', type: 'bad' }, // malformed entry is ignored
      ],
    },
    conditionSnapshotsViaOrderId: units.map((u) => ({
      assignmentId: u.id,
      unitId: u.unit,
      snapshotStage: 'PRE_HANDOVER',
      condition: 'GOOD',
      accessories: null,
      notes: null,
      evidenceIds: [`handover-${u.asset}`],
    })),
    returnInspectionsViaOrderId: units.map((u) => ({
      id: `pre-${u.id}`,
      assignmentId: u.id,
      stage: 'PRELIMINARY',
      outcome: u.flagged ? 'ISSUE' : 'NORMAL',
      notes: u.flagged ? 'Screen cracked' : null,
      evidenceIds: u.flagged ? [`pickup-${u.asset}`] : [],
      observations: { visibleDamage: u.flagged, accessoryObservations: u.flagged ? ['Strap missing'] : [] },
      version: 1,
      createdAt: returnedAt,
      findingsViaInspectionId: [],
    })),
    returnInspectionTasks: units.map((u) => ({ assignmentId: u.id, receivedAt: NOW, inspectionDueAt: NOW })),
    rentalExceptionCasesViaOrderId: [],
    depositSettlementViaOrderId: {
      depositSettlementItemsViaSettlementId: units.map((u) => ({
        assignmentId: u.id,
        status: 'REVIEW_REQUIRED',
        depositAmount: 500000,
        deductionAmount: 0,
        refundAmount: 0,
      })),
    },
    rentalOrderLinesViaOrderId: ['GPS', 'BAG'].map((productId) => ({
      product: { id: productId, name: productId, requiresDeepReturnInspection: false },
      rentalUnitAssignmentsViaOrderLineId: units
        .filter((u) => u.product === productId)
        .map((u) => ({
          id: u.id,
          status: 'RETURNED',
          returnedAt,
          equipmentUnitId: u.unit,
          equipmentUnit: { assetCode: u.asset, status: 'MAINTENANCE', condition: 'GOOD', version: 2 },
        })),
    })),
  }
  const task = {
    id: TASK,
    orderId: ORDER,
    taskType: 'RETURN',
    status: 'INVENTORY_RECEIVED',
    version: 5,
    scheduledAt: null,
    order,
  }

  function prismaWith(extra: Record<string, unknown>) {
    return {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-1', role: 'STAFF_INVENTORY' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1', role: 'STAFF_INVENTORY', status: 'ACTIVE' }),
      },
      ...extra,
    } as any
  }

  it('queue shows "waiting for FINAL inspection", not "needs Admin review", with the delivery-reported count', async () => {
    const prisma = prismaWith({ deliveryTask: { findMany: jest.fn().mockResolvedValue([task]) } })
    const result: any = await new PrismaRentalReturnAdapter(prisma).listReturns({
      actorUserId: 'staff-1',
      page: 1,
      pageSize: 20,
    } as any)
    expect(result.items[0]).toMatchObject({
      status: 'INVENTORY_RECEIVED',
      normalCount: 2,
      issueCount: 2,
      deliveryReportedIssueCount: 2,
      handoverReportedIssueCount: 2,
      pendingInspectionCount: 4,
      missingCount: 0,
    })
  })

  it('detail gives each unit its stage, what Delivery saw, the handover baseline and the evidence rule', async () => {
    const prisma = prismaWith({
      deliveryTask: {
        findUnique: jest.fn().mockResolvedValue({ ...task, returnCustodyTransfersViaDeliveryTaskId: [] }),
      },
    })
    const detail: any = await new PrismaRentalReturnAdapter(prisma).getReturn({
      actorUserId: 'staff-1',
      actorRole: 'STAFF_INVENTORY',
      returnId: TASK,
    } as any)
    const gps = detail.units.find((u: any) => u.assetCode === '001001')
    const bag = detail.units.find((u: any) => u.assetCode === '2GU005')
    expect(gps).toMatchObject({
      stage: 'AWAITING_FINAL_INSPECTION',
      evidenceRequired: true,
      deliveryObservation: {
        outcome: 'ISSUE',
        visibleDamage: true,
        accessoryObservations: ['Strap missing'],
        notes: 'Screen cracked',
        evidenceIds: ['pickup-001001'],
      },
      handoverBaseline: { condition: 'GOOD', evidenceIds: ['handover-001001'] },
      deposit: { depositAmount: 500000 },
      finalInspection: null,
    })
    expect(bag).toMatchObject({ stage: 'AWAITING_FINAL_INSPECTION', evidenceRequired: false })
    expect(bag.deliveryObservation).toMatchObject({ outcome: 'NORMAL', visibleDamage: false })
    // Pickup said "normal", but the defect recorded at handover still reaches Inventory.
    expect(bag.handoverReportedIssues).toEqual([{ type: 'DAMAGE', description: 'Khoá kéo hỏng sẵn' }])
    expect(gps.handoverReportedIssues).toEqual([])
    expect(detail.summary).toMatchObject({
      totalUnits: 4,
      queueStatus: 'INVENTORY_RECEIVED',
      deliveryReportedIssueCount: 2,
      handoverReportedIssueCount: 2,
      handoverOrderLevelIssues: [{ type: 'NOTE', description: 'Khách nhận thiếu túi đựng' }],
      handedOverAt: '2026-11-10T02:00:00.000Z',
      evidenceRequiredPendingCount: 2,
    })
    // Legacy fields stay for current clients.
    expect(detail.expectedUnits).toHaveLength(4)
    expect(detail.inspection).toHaveLength(4)
  })
})

describe('RB-API-602 keeps what Delivery observed', () => {
  function makeTx() {
    return {
      $queryRaw: jest.fn().mockResolvedValue([]),
      idempotencyRecord: idempotency(),
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'driver-1', role: 'STAFF_DELIVERY' }) },
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: ORDER,
          version: 2,
          status: 'RETURN_PROCESSING',
          deliveryTasksViaOrderId: [{ id: TASK, taskType: 'RETURN', staffId: 'driver-1', status: 'COLLECTING' }],
          rentalOrderLinesViaOrderId: [
            {
              product: { requiresDeepReturnInspection: false },
              rentalUnitAssignmentsViaOrderLineId: [
                { id: ASSIGNMENT, equipmentUnitId: UNIT, status: 'RETURNED', returnedAt: NOW },
              ],
            },
          ],
        }),
      },
      custodyEvent: { findFirst: jest.fn().mockResolvedValue(null) },
      mediaAsset: {
        findMany: jest.fn(async ({ where }: any) => where.id.in.map((id: string) => ({ id }))),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      conditionSnapshot: { findUnique: jest.fn().mockResolvedValue({ condition: 'GOOD' }), upsert: jest.fn() },
      returnInspection: { upsert: jest.fn().mockResolvedValue({ id: 'pre-1' }) },
      rentalExceptionCase: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      // Stop right after the observation is written; the rest of 602 is covered elsewhere.
      depositSettlementItem: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any
  }

  it.each([
    [
      'canonical request',
      {
        unitId: UNIT,
        outcome: 'OBSERVED_ISSUE',
        visibleDamage: true,
        accessoryIssues: ['Strap missing'],
        evidenceIds: ['m-1'],
      },
      { visibleDamage: true, accessoryObservations: ['Strap missing'] },
    ],
    [
      'legacy request with condition',
      { unitId: UNIT, outcome: 'OBSERVED_ISSUE', condition: 'DAMAGED', accessoryIssues: [], evidenceIds: [] },
      { visibleDamage: true, accessoryObservations: [] },
    ],
    [
      'normal pickup',
      { unitId: UNIT, outcome: 'OBSERVED_RECEIVED', visibleDamage: false, accessoryIssues: [], evidenceIds: [] },
      { visibleDamage: false, accessoryObservations: [] },
    ],
  ])('stores observations for a %s', async (_label, item, expected) => {
    const tx = makeTx()
    const error = await errorOf(
      adapterFor(tx).returnInspection({
        actorUserId: 'driver-1',
        orderId: ORDER,
        items: [item as any],
        expectedVersion: 2,
        idempotencyKey: 'obs-key-1',
        now: NOW,
      }),
    )
    expect(error.code).toBe('DEPOSIT_ITEM_NOT_FOUND')
    const args = tx.returnInspection.upsert.mock.calls[0][0]
    expect(args.create.observations).toEqual(expected)
    expect(args.update.observations).toEqual(expected)
  })
})

describe('Admin exception detail shows defects recorded at handover', () => {
  it('lists the handover issues of the unit and of the order next to the assessment', async () => {
    const prisma: any = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin-1' }) },
      rentalExceptionCase: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          orderId: ORDER,
          unitId: 'u-bag2',
          caseType: 'DAMAGE',
          status: 'OPEN',
          reason: 'DAMAGE',
          evidenceIds: [],
          version: 1,
          unit: { id: 'u-bag2', assetCode: '2GU005' },
          inspection: null,
          rentalAssessmentReviewsViaExceptionCaseId: [],
          order: {
            id: ORDER,
            trip: { title: 'Trip' },
            user: { fullName: 'Customer' },
            recipientParticipant: null,
            refundsViaRentalOrderId: [],
            rentalHandoverViaOrderId: {
              handedOverAt: new Date('2026-11-10T02:00:00.000Z'),
              reportedIssues: [
                { unitId: 'u-bag2', type: 'DAMAGE', description: 'Khoá kéo hỏng sẵn' },
                { unitId: 'u-other', type: 'DAMAGE', description: 'Không liên quan' },
                { type: 'NOTE', description: 'Khách nhận thiếu túi đựng' },
              ],
            },
          },
        }),
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const detail: any = await new PrismaRentalReturnAdapter(prisma).getException({
      actorUserId: 'admin-1',
      actorRole: 'ADMIN',
      exceptionId: 'case-1',
    } as any)
    expect(detail.handoverReportedIssues).toEqual({
      handedOverAt: '2026-11-10T02:00:00.000Z',
      unit: [{ type: 'DAMAGE', description: 'Khoá kéo hỏng sẵn' }],
      orderLevel: [{ type: 'NOTE', description: 'Khách nhận thiếu túi đựng' }],
    })
  })
})
