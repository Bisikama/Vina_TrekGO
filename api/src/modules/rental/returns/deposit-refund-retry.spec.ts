jest.mock('@nestjs/schedule', () => ({
  Cron: jest.fn(() => () => {}),
  CronExpression: {},
  Interval: jest.fn(() => () => {}),
}))

import { Prisma } from '@prisma/client'
import { PrismaRentalReturnAdapter } from './infrastructure/adapters/prisma-rental-return.adapter'
import { RentalDepositWorker, depositRefundAttempt } from '../payments/rental-deposit.worker'

/** R5: a deposit refund the provider FAILED must not leave the order stuck forever. */

const ORDER = 'order-1'
const REFUND = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = new Date('2026-11-20T10:00:00.000Z')

/** Prisma-like tx: given models/methods as-is, anything else an empty-result jest.fn. */
function autoTx(overrides: Record<string, any> = {}) {
  const defaultFor = (method: string) =>
    method === 'findMany' ? [] : method === 'count' ? 0 : method.endsWith('Many') ? { count: 0 } : null
  const models: Record<string, any> = {}
  return new Proxy(overrides, {
    get(target, prop: string) {
      if (prop === 'then') return undefined
      if (prop === '$queryRaw') return target.$queryRaw ?? (target.$queryRaw = jest.fn().mockResolvedValue([]))
      if (!models[prop])
        models[prop] = new Proxy(target[prop] ?? {}, {
          get(model, method: string) {
            if (!(method in model)) model[method] = jest.fn().mockResolvedValue(defaultFor(method))
            return model[method]
          },
        })
      return models[prop]
    },
  }) as any
}

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return error as { code: string; details?: Record<string, unknown> }
  }
  throw new Error('expected promise to reject')
}

describe('RB-API-610 RETRY_REFUND', () => {
  function makeTx(opts: { caseType?: string; refundStatus?: string; grouped?: boolean; itemStatus?: string } = {}) {
    const exceptionCase = {
      id: 'case-1',
      orderId: ORDER,
      version: 1,
      status: 'OPEN',
      caseType: opts.caseType ?? 'REFUND_FAILURE',
      reason: `[refund:${REFUND}] PROVIDER_REJECTED`,
      assignmentId: 'as-1',
      unitId: 'unit-1',
      inspectionId: null,
      inspection: null,
      evidenceCompleteAt: null,
      order: { rentalPolicy: {} },
    }
    return autoTx({
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN' }) },
      rentalExceptionCase: {
        findUnique: jest.fn().mockResolvedValueOnce({ orderId: ORDER }).mockResolvedValue(exceptionCase),
        update: jest.fn().mockResolvedValue({ status: 'RESOLVED' }),
      },
      refund: {
        findUnique: jest.fn().mockResolvedValue({
          id: REFUND,
          purpose: 'DEPOSIT',
          status: opts.refundStatus ?? 'FAILED',
          depositSettlementItemId: opts.grouped ? null : 'item-1',
          depositRefundItems: opts.grouped
            ? [{ depositSettlementItemId: 'item-1' }, { depositSettlementItemId: 'item-2' }]
            : [{ depositSettlementItemId: 'item-1' }],
          depositSettlement: { orderId: ORDER },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      depositSettlementItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 'item-1' }),
        findMany: jest.fn(async ({ where }: any) =>
          where.id.in.map((id: string) => ({
            id,
            status: opts.itemStatus ?? 'REFUND_FAILED',
            decisionSnapshot: id === 'item-2' ? { approvalRef: 'APR-2', refundAttempt: 2 } : { approvalRef: 'APR-1' },
          })),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
    })
  }
  const retry = (tx: any) =>
    new PrismaRentalReturnAdapter({ $transaction: jest.fn((cb: any) => cb(tx)) } as any).resolveException({
      actorUserId: 'admin-1',
      exceptionId: 'case-1',
      decision: 'RETRY_REFUND',
      reason: 'Cổng thanh toán đã ổn định lại',
      expectedVersion: 1,
      idempotencyKey: 'retry-1',
      now: NOW,
    } as any)

  it('frees the item from the failed refund and queues it again as the next attempt', async () => {
    const tx = makeTx()
    const result: any = await retry(tx)
    expect(result.nextAction).toBe('DEPOSIT_REFUND_RETRY_QUEUED')
    expect(tx.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REFUND },
        data: expect.objectContaining({ depositSettlementItemId: null }),
      }),
    )
    expect(tx.depositRefundItemAllocation.deleteMany).toHaveBeenCalledWith({ where: { refundId: REFUND } })
    const update = tx.depositSettlementItem.update.mock.calls[0][0]
    expect(update.where).toEqual({ id: 'item-1' })
    expect(update.data).toMatchObject({ status: 'REFUND_PENDING', reason: 'REFUND_RETRY_QUEUED' })
    // Approval data is kept; only the attempt and the failure trail are added.
    expect(update.data.decisionSnapshot).toEqual({ approvalRef: 'APR-1', refundAttempt: 2, failedRefundIds: [REFUND] })
    expect(tx.rentalExceptionCase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RESOLVED' }) }),
    )
  })

  it('requeues every item of a failed grouped refund, each one attempt further', async () => {
    const tx = makeTx({ grouped: true })
    await retry(tx)
    expect(tx.refund.update).not.toHaveBeenCalled()
    const attempts = tx.depositSettlementItem.update.mock.calls.map(([arg]: any) => [
      arg.where.id,
      arg.data.decisionSnapshot.refundAttempt,
    ])
    expect(attempts).toEqual([
      ['item-1', 2],
      ['item-2', 3],
    ])
  })

  it.each(['PENDING', 'PROCESSING'])(
    'refuses a %s refund: it may still succeed at the provider',
    async (refundStatus) => {
      const tx = makeTx({ refundStatus })
      const error = await errorOf(retry(tx))
      expect(error.code).toBe('REFUND_RECONCILIATION_REQUIRED')
      expect(error.details).toMatchObject({ reason: 'REFUND_NOT_FAILED' })
      expect(tx.depositSettlementItem.update).not.toHaveBeenCalled()
      expect(tx.depositRefundItemAllocation.deleteMany).not.toHaveBeenCalled()
    },
  )

  it('is only offered on REFUND_FAILURE cases', async () => {
    const tx = makeTx({ caseType: 'DAMAGE' })
    expect((await errorOf(retry(tx))).details).toMatchObject({ reason: 'RETRY_REFUND_ONLY_FOR_REFUND_FAILURE' })
  })

  it('does nothing when no item is still REFUND_FAILED', async () => {
    const tx = makeTx({ itemStatus: 'SETTLED' })
    expect((await errorOf(retry(tx))).details).toMatchObject({ reason: 'NO_FAILED_DEPOSIT_ITEM' })
    expect(tx.depositRefundItemAllocation.deleteMany).not.toHaveBeenCalled()
  })
})

describe('deposit worker refund attempts', () => {
  it('reads the attempt from the decision snapshot, defaulting to 1', () => {
    expect(depositRefundAttempt(null)).toBe(1)
    expect(depositRefundAttempt({ approvalRef: 'x' })).toBe(1)
    expect(depositRefundAttempt({ refundAttempt: 3 })).toBe(3)
    expect(depositRefundAttempt({ refundAttempt: 'bad' })).toBe(1)
  })

  it('dispatches a retried item under a new idempotency key', async () => {
    const requestRefund = jest.fn().mockResolvedValue({ id: 'refund-2' })
    const item = {
      id: 'item-1',
      settlementId: 'settlement-1',
      refundAmount: new Prisma.Decimal(300000),
      decisionSnapshot: { refundAttempt: 2 },
      settlement: { orderId: ORDER, order: {} },
      assignment: { orderLineId: 'line-1' },
    }
    const db: any = {
      depositSettlementItem: { findUniqueOrThrow: jest.fn().mockResolvedValue(item) },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay-1',
          allocations: [{ id: 'alloc-1', rentalOrderLineId: 'line-1', component: 'RENTAL_DEPOSIT' }],
        }),
      },
    }
    await new RentalDepositWorker(db, { requestRefund } as any).dispatch('item-1')
    expect(requestRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        businessActionId: 'deposit-item:item-1:refund:v2',
        idempotencyKey: 'deposit-item:item-1:refund:v2',
      }),
    )
  })
})

describe('R11 damage deductions are whole VND', () => {
  // Imported lazily so the module-level jest.mock above stays first.
  const { calculateRuleDeduction } = require('./infrastructure/adapters/prisma-rental-return.adapter')

  it('rounds a percentage deduction down to whole VND (customer favour)', () => {
    const amount = calculateRuleDeduction(
      { deductionType: 'PERCENT_DEPOSIT', deductionValue: new Prisma.Decimal('12.5') },
      {},
      new Prisma.Decimal('99999'),
      1,
    )
    expect(amount.toString()).toBe('12499') // 12,499.875
  })

  it('keeps exact amounts and multiplies by quantity before rounding', () => {
    expect(
      calculateRuleDeduction({ deductionType: 'FIXED', deductionValue: new Prisma.Decimal('50000') }, {}, new Prisma.Decimal(0), 2).toString(),
    ).toBe('100000')
    expect(
      calculateRuleDeduction(
        { deductionType: 'PERCENT_REPLACEMENT_VALUE', deductionValue: new Prisma.Decimal('33.33') },
        { replacementValueSnapshot: '1000000' },
        new Prisma.Decimal(0),
        3,
      ).toString(),
    ).toBe('999900')
  })
})

describe('R10 settlement on behalf of a deactivated approver', () => {
  function makeTx() {
    return autoTx({
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      // The approving Admin has since been deactivated: an ACTIVE-only lookup finds nobody.
      user: {
        findFirst: jest.fn(async ({ where }: any) => (where.status === 'ACTIVE' ? null : { id: 'admin-old' })),
      },
      // Stop right after the role gate.
      rentalOrder: { findUnique: jest.fn().mockResolvedValue(null) },
    })
  }
  const settle = (tx: any, systemTriggered: boolean) =>
    new PrismaRentalReturnAdapter({ $transaction: jest.fn((cb: any) => cb(tx)) } as any).createDepositSettlement({
      actorUserId: 'admin-old',
      orderId: ORDER,
      assessmentId: 'final-1',
      approvalRef: 'APR-1',
      idempotencyKey: 'auto-settlement:item-1:APR-1',
      now: NOW,
      systemTriggered,
    })

  it('lets the worker / 617 settle a decision recorded by an Admin no longer active', async () => {
    expect((await errorOf(settle(makeTx(), true))).code).toBe('RENTAL_NOT_FOUND')
  })

  it('still requires an active Admin for a manual 606 call', async () => {
    expect((await errorOf(settle(makeTx(), false))).code).toBe('FORBIDDEN')
  })
})
