import { randomUUID } from 'node:crypto'
import {
  DepositItemStatus,
  InspectionStage,
  Prisma,
  RentalExceptionCaseStatus,
  RentalFinancialStatus,
  RentalOrderStatus,
  ReturnInspectionOutcome,
} from '@prisma/client'
import { RentalDepositWorker } from '../src/modules/rental/payments/rental-deposit.worker'
import { planDepositRefundGroups } from '../src/modules/rental/returns/application/deposit-grouping.policy'

describe('Rental Grouped Refund Flow & Self-Healing Scanner', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PAYMENT_PROVIDER_ENVIRONMENT: 'SANDBOX',
      PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED: 'true',
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  describe('Section 14.1 & 14.2: Grouping Planner Logic', () => {
    it('groups multiple eligible clean items under the same payment into one batch', () => {
      const paymentId = randomUUID()
      const candidates = [
        {
          itemId: 'item-1',
          paymentId,
          currency: 'VND',
          amount: 200000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-2',
          paymentId,
          currency: 'VND',
          amount: 300000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-3',
          paymentId,
          currency: 'VND',
          amount: 500000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
      ]

      const groups = planDepositRefundGroups(candidates)
      expect(groups).toHaveLength(1)
      expect(groups[0].paymentId).toBe(paymentId)
      expect(groups[0].itemIds).toEqual(['item-1', 'item-2', 'item-3'])
      expect(groups[0].totalAmount).toBe(1000000)
    })

    it('separates PASS items from items with open exception cases', () => {
      const paymentId = randomUUID()
      const candidates = [
        {
          itemId: 'item-pass-1',
          paymentId,
          currency: 'VND',
          amount: 250000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-pass-2',
          paymentId,
          currency: 'VND',
          amount: 250000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-damaged-3',
          paymentId,
          currency: 'VND',
          amount: 100000,
          isFinalPass: false,
          inventoryCustodyReceived: true,
          openCase: true, // open case for damage
          alreadyAllocated: false,
        },
      ]

      const groups = planDepositRefundGroups(candidates)
      // PASS items group together; damaged item is excluded from grouping
      expect(groups).toHaveLength(1)
      expect(groups[0].itemIds).toEqual(['item-pass-1', 'item-pass-2'])
      expect(groups[0].totalAmount).toBe(500000)
    })

    it('partitions refunds across different source payments', () => {
      const paymentId1 = randomUUID()
      const paymentId2 = randomUUID()
      const candidates = [
        {
          itemId: 'item-1',
          paymentId: paymentId1,
          currency: 'VND',
          amount: 200000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-2',
          paymentId: paymentId2,
          currency: 'VND',
          amount: 300000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
      ]

      const groups = planDepositRefundGroups(candidates)
      expect(groups).toHaveLength(2)
      expect(groups.find((g) => g.paymentId === paymentId1)?.totalAmount).toBe(200000)
      expect(groups.find((g) => g.paymentId === paymentId2)?.totalAmount).toBe(300000)
    })
  })

  describe('Sequential Inspection & Order-Level Grouped Dispatch in Worker', () => {
    it('defers dispatching until all items of the order have finished inspection', async () => {
      const orderId = randomUUID()
      const paymentId = randomUUID()
      const settlementId = randomUUID()
      const line1Id = randomUUID()
      const line2Id = randomUUID()
      const asgn1Id = randomUUID()
      const asgn2Id = randomUUID()

      const assignments = [{ id: asgn1Id }, { id: asgn2Id }]

      // Mock only 1 assignment inspected so far
      const finalInspections = [{ assignmentId: asgn1Id }]
      const missingPrelims: any[] = []

      const items: any[] = [
        {
          id: 'item-1',
          settlementId,
          assignmentId: asgn1Id,
          refundAmount: new Prisma.Decimal(250000),
          status: 'REFUND_PENDING',
          settlement: { orderId },
          assignment: { orderLineId: line1Id },
          inspection: { outcome: 'NORMAL' },
        },
      ]

      const paymentsPort = { requestRefund: jest.fn().mockResolvedValue({ id: 'refund-1' }) }

      const dbMock: any = {
        rentalUnitAssignment: {
          findMany: jest.fn().mockResolvedValue(assignments),
        },
        returnInspection: {
          findMany: jest.fn().mockImplementation(({ where }: any) => {
            if (where.stage === 'FINAL') return Promise.resolve(finalInspections)
            return Promise.resolve(missingPrelims)
          }),
        },
        payment: {
          findFirst: jest.fn(),
          findUniqueOrThrow: jest.fn(),
        },
        rentalExceptionCase: {
          findFirst: jest.fn(),
        },
      }

      const worker = new RentalDepositWorker(dbMock, paymentsPort as any)
      await worker.dispatchGroupedRefunds(items)

      // Since only 1 of 2 assignments is complete, worker must NOT dispatch refund yet!
      expect(paymentsPort.requestRefund).not.toHaveBeenCalled()
    })

    it('dispatches exactly 1 grouped refund for all items once all inspections are complete', async () => {
      const orderId = randomUUID()
      const paymentId = randomUUID()
      const settlementId = randomUUID()
      const line1Id = randomUUID()
      const line2Id = randomUUID()
      const line3Id = randomUUID()
      const asgn1Id = randomUUID()
      const asgn2Id = randomUUID()
      const asgn3Id = randomUUID()
      const payAlloc1Id = randomUUID()
      const payAlloc2Id = randomUUID()
      const payAlloc3Id = randomUUID()

      const assignments = [{ id: asgn1Id }, { id: asgn2Id }, { id: asgn3Id }]
      const finalInspections = [
        { assignmentId: asgn1Id },
        { assignmentId: asgn2Id },
        { assignmentId: asgn3Id },
      ]

      const payment = {
        id: paymentId,
        currency: 'VND',
        allocations: [
          { id: payAlloc1Id, rentalOrderLineId: line1Id, component: 'RENTAL_DEPOSIT' },
          { id: payAlloc2Id, rentalOrderLineId: line2Id, component: 'RENTAL_DEPOSIT' },
          { id: payAlloc3Id, rentalOrderLineId: line3Id, component: 'RENTAL_DEPOSIT' },
        ],
      }

      const items: any[] = [
        {
          id: 'item-1',
          settlementId,
          assignmentId: asgn1Id,
          refundAmount: new Prisma.Decimal(200000),
          status: 'REFUND_PENDING',
          settlement: { orderId },
          assignment: { orderLineId: line1Id },
          inspection: { outcome: 'NORMAL' },
        },
        {
          id: 'item-2',
          settlementId,
          assignmentId: asgn2Id,
          refundAmount: new Prisma.Decimal(300000),
          status: 'REFUND_PENDING',
          settlement: { orderId },
          assignment: { orderLineId: line2Id },
          inspection: { outcome: 'NORMAL' },
        },
        {
          id: 'item-3',
          settlementId,
          assignmentId: asgn3Id,
          refundAmount: new Prisma.Decimal(500000),
          status: 'REFUND_PENDING',
          settlement: { orderId },
          assignment: { orderLineId: line3Id },
          inspection: { outcome: 'NORMAL' },
        },
      ]

      const paymentsPort = { requestRefund: jest.fn().mockResolvedValue({ id: 'refund-batch-1' }) }

      const dbMock: any = {
        rentalUnitAssignment: {
          findMany: jest.fn().mockResolvedValue(assignments),
        },
        returnInspection: {
          findMany: jest.fn().mockImplementation(({ where }: any) => {
            if (where.stage === 'FINAL') return Promise.resolve(finalInspections)
            return Promise.resolve([])
          }),
        },
        payment: {
          findFirst: jest.fn().mockResolvedValue(payment),
          findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
        },
        rentalExceptionCase: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      }

      const worker = new RentalDepositWorker(dbMock, paymentsPort as any)
      await worker.dispatchGroupedRefunds(items)

      // Worker must make EXACTLY ONE call to requestRefund with total amount 1,000,000
      expect(paymentsPort.requestRefund).toHaveBeenCalledTimes(1)
      const callArg = paymentsPort.requestRefund.mock.calls[0][0]
      expect(callArg.paymentId).toBe(paymentId)
      expect(callArg.amount).toBe('1000000')
      expect(callArg.purpose).toBe('DEPOSIT')
      expect(callArg.businessActionId).toBe(`deposit-group:${paymentId}:item-1,item-2,item-3:v1`)
      expect(callArg.source.depositSettlementItemIds).toEqual(['item-1', 'item-2', 'item-3'])
      expect(callArg.itemAllocations).toEqual([
        { depositSettlementItemId: 'item-1', amount: '200000' },
        { depositSettlementItemId: 'item-2', amount: '300000' },
        { depositSettlementItemId: 'item-3', amount: '500000' },
      ])
      expect(callArg.allocations).toEqual([
        { paymentAllocationId: payAlloc1Id, amount: '200000' },
        { paymentAllocationId: payAlloc2Id, amount: '300000' },
        { paymentAllocationId: payAlloc3Id, amount: '500000' },
      ])
    })

    it('handles 2 PASS + 1 MISSING: groups PASS items without requiring fake custody for missing unit', async () => {
      const orderId = randomUUID()
      const paymentId = randomUUID()
      const settlementId = randomUUID()
      const line1Id = randomUUID()
      const line2Id = randomUUID()
      const line3Id = randomUUID()
      const asgn1Id = randomUUID()
      const asgn2Id = randomUUID()
      const asgn3Id = randomUUID()
      const payAlloc1Id = randomUUID()
      const payAlloc2Id = randomUUID()

      const assignments = [{ id: asgn1Id }, { id: asgn2Id }, { id: asgn3Id }]
      // Units 1 and 2 reached FINAL, Unit 3 was MISSING in PRELIMINARY
      const finalInspections = [{ assignmentId: asgn1Id }, { assignmentId: asgn2Id }]
      const missingPrelims = [{ assignmentId: asgn3Id }]

      const payment = {
        id: paymentId,
        currency: 'VND',
        allocations: [
          { id: payAlloc1Id, rentalOrderLineId: line1Id, component: 'RENTAL_DEPOSIT' },
          { id: payAlloc2Id, rentalOrderLineId: line2Id, component: 'RENTAL_DEPOSIT' },
        ],
      }

      const passItems: any[] = [
        {
          id: 'item-1',
          settlementId,
          assignmentId: asgn1Id,
          refundAmount: new Prisma.Decimal(200000),
          status: 'REFUND_PENDING',
          settlement: { orderId },
          assignment: { orderLineId: line1Id },
          inspection: { outcome: 'NORMAL' },
        },
        {
          id: 'item-2',
          settlementId,
          assignmentId: asgn2Id,
          refundAmount: new Prisma.Decimal(300000),
          status: 'REFUND_PENDING',
          settlement: { orderId },
          assignment: { orderLineId: line2Id },
          inspection: { outcome: 'NORMAL' },
        },
      ]

      const paymentsPort = { requestRefund: jest.fn().mockResolvedValue({ id: 'refund-batch-2' }) }

      const dbMock: any = {
        rentalUnitAssignment: {
          findMany: jest.fn().mockResolvedValue(assignments),
        },
        returnInspection: {
          findMany: jest.fn().mockImplementation(({ where }: any) => {
            if (where.stage === 'FINAL') return Promise.resolve(finalInspections)
            return Promise.resolve(missingPrelims)
          }),
        },
        payment: {
          findFirst: jest.fn().mockResolvedValue(payment),
          findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
        },
        rentalExceptionCase: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      }

      const worker = new RentalDepositWorker(dbMock, paymentsPort as any)
      await worker.dispatchGroupedRefunds(passItems)

      expect(paymentsPort.requestRefund).toHaveBeenCalledTimes(1)
      const callArg = paymentsPort.requestRefund.mock.calls[0][0]
      expect(callArg.amount).toBe('500000')
      expect(callArg.source.depositSettlementItemIds).toEqual(['item-1', 'item-2'])
    })
  })

  describe('Self-Healing Scanner in Worker tick()', () => {
    it('scans and releases stuck FINAL_PASS_AWAIT_GROUPED_REFUND items when inspections are complete', async () => {
      const orderId = randomUUID()
      const settlementId = randomUUID()
      const asgn1Id = randomUUID()
      const asgn2Id = randomUUID()

      const awaitingGroups = [
        {
          settlementId,
          settlement: { orderId },
        },
      ]

      const assignments = [{ id: asgn1Id }, { id: asgn2Id }]
      const finalInspections = [{ assignmentId: asgn1Id }, { assignmentId: asgn2Id }]

      const updateManyMock = jest.fn().mockResolvedValue({ count: 2 })

      const dbMock: any = {
        depositSettlementItem: {
          findMany: jest.fn().mockImplementation(({ where }: any) => {
            if (where?.status === 'REVIEW_REQUIRED') return Promise.resolve(awaitingGroups)
            return Promise.resolve([]) // No further items for dispatch in this test
          }),
          updateMany: updateManyMock,
        },
        rentalUnitAssignment: {
          findMany: jest.fn().mockResolvedValue(assignments),
        },
        returnInspection: {
          findMany: jest.fn().mockImplementation(({ where }: any) => {
            if (where.stage === 'FINAL') return Promise.resolve(finalInspections)
            return Promise.resolve([])
          }),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
      }

      const paymentsPort = { requestRefund: jest.fn() }
      const worker = new RentalDepositWorker(dbMock, paymentsPort as any)

      await worker.tick()

      // Scanner must have detected that all assignments are inspected,
      // and transitioned items from FINAL_PASS_AWAIT_GROUPED_REFUND to REFUND_PENDING!
      expect(updateManyMock).toHaveBeenCalledWith({
        where: {
          settlementId,
          status: 'REVIEW_REQUIRED',
          reason: 'FINAL_PASS_AWAIT_GROUPED_REFUND',
        },
        data: expect.objectContaining({
          status: 'REFUND_PENDING',
          reason: 'INVENTORY_FINAL_PASS',
        }),
      })
    })

    it('leaves items in FINAL_PASS_AWAIT_GROUPED_REFUND if inspections are still pending', async () => {
      const orderId = randomUUID()
      const settlementId = randomUUID()
      const asgn1Id = randomUUID()
      const asgn2Id = randomUUID()

      const awaitingGroups = [
        {
          settlementId,
          settlement: { orderId },
        },
      ]

      // 2 assignments in order, but only 1 final inspection so far
      const assignments = [{ id: asgn1Id }, { id: asgn2Id }]
      const finalInspections = [{ assignmentId: asgn1Id }]

      const updateManyMock = jest.fn().mockResolvedValue({ count: 0 })

      const dbMock: any = {
        depositSettlementItem: {
          findMany: jest.fn().mockImplementation(({ where }: any) => {
            if (where?.status === 'REVIEW_REQUIRED') return Promise.resolve(awaitingGroups)
            return Promise.resolve([])
          }),
          updateMany: updateManyMock,
        },
        rentalUnitAssignment: {
          findMany: jest.fn().mockResolvedValue(assignments),
        },
        returnInspection: {
          findMany: jest.fn().mockImplementation(({ where }: any) => {
            if (where.stage === 'FINAL') return Promise.resolve(finalInspections)
            return Promise.resolve([])
          }),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
      }

      const paymentsPort = { requestRefund: jest.fn() }
      const worker = new RentalDepositWorker(dbMock, paymentsPort as any)

      await worker.tick()

      // Scanner must NOT release items when inspection is incomplete
      expect(updateManyMock).not.toHaveBeenCalled()
    })
  })

  describe('Consumer & Multi-Item Settlement Order Closure Integrity', () => {
    it('updates all items in a multi-item refund batch upon REFUND_SUCCEEDED', async () => {
      const orderId = randomUUID()
      const settlementId = randomUUID()
      const refundId = randomUUID()
      const eventId = randomUUID()
      const paymentId = randomUUID()
      const invoiceId = randomUUID()
      const item1Id = randomUUID()
      const item2Id = randomUUID()

      const now = new Date('2026-10-26T04:00:00.000Z')

      const payment = {
        id: paymentId,
        invoiceId,
        currency: 'VND',
        application: { status: 'APPLIED' },
        invoice: { id: invoiceId, rentalOrderId: orderId },
      }

      const refund = {
        id: refundId,
        paymentId,
        depositSettlementId: settlementId,
        depositSettlement: { id: settlementId, orderId },
        rentalOrderId: orderId,
        status: 'SUCCEEDED',
        purpose: 'DEPOSIT',
        amount: new Prisma.Decimal(500000),
        currency: 'VND',
        payment,
        allocations: [
          {
            id: 'a1',
            amount: new Prisma.Decimal(500000),
            paymentAllocation: {
              paymentId,
              component: 'RENTAL_DEPOSIT',
              amount: new Prisma.Decimal(500000),
              rentalOrderLine: { orderId },
            },
          },
        ],
        depositRefundItems: [
          { depositSettlementItemId: item1Id, amount: new Prisma.Decimal(200000) },
          { depositSettlementItemId: item2Id, amount: new Prisma.Decimal(300000) },
        ],
      }

      const items = [
        { id: item1Id, settlementId, status: DepositItemStatus.REFUND_PENDING },
        { id: item2Id, settlementId, status: DepositItemStatus.REFUND_PENDING },
      ]

      const itemUpdates: any[] = []
      const outboxCreates: any[] = []

      const tx: any = {
        $queryRaw: jest.fn().mockImplementation((parts: any) => {
          const sql = Array.isArray(parts) ? parts.join('?') : String(parts)
          if (sql.includes('clock_timestamp() AS now')) return Promise.resolve([{ now }])
          return Promise.resolve([{ id: eventId }])
        }),
        paymentOutboxEvent: {
          findUnique: jest.fn().mockResolvedValue({
            id: eventId,
            eventType: 'REFUND_SUCCEEDED',
            aggregateType: 'Refund',
            aggregateId: refundId,
            payload: { schemaVersion: 1, refundId },
          }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: eventId,
            eventType: 'REFUND_SUCCEEDED',
            aggregateType: 'Refund',
            aggregateId: refundId,
            payload: { schemaVersion: 1, refundId },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue(refund),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refund),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(500000) } }),
          count: jest.fn().mockResolvedValue(0),
        },
        payment: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
        },
        depositSettlementItem: {
          findMany: jest.fn().mockImplementation(({ where }: any) => {
            if (where.settlementId) {
              return Promise.resolve([
                { id: item1Id, status: 'SETTLED' },
                { id: item2Id, status: 'SETTLED' },
              ])
            }
            return Promise.resolve(items)
          }),
          update: jest.fn().mockImplementation(({ where, data }: any) => {
            itemUpdates.push({ id: where.id, data })
            return Promise.resolve({ id: where.id, ...data })
          }),
        },
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: orderId,
            status: RentalOrderStatus.RETURN_PROCESSING,
            financialStatus: RentalFinancialStatus.DEPOSIT_HELD,
            assignments: [
              { id: 'asgn-1', status: 'CLOSED' },
              { id: 'asgn-2', status: 'CLOSED' },
            ],
            exceptionCases: [],
            deliveryTasks: [],
            returnSessions: [{ status: 'COMPLETED' }],
          }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: orderId,
            status: RentalOrderStatus.RETURN_PROCESSING,
            financialStatus: RentalFinancialStatus.DEPOSIT_HELD,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        depositSettlement: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: settlementId,
            orderId,
            totalDeposit: new Prisma.Decimal(500000),
            depositSettlementItemsViaSettlementId: [
              { id: item1Id, status: 'SETTLED', depositAmount: new Prisma.Decimal(200000), refundAmount: new Prisma.Decimal(200000), deductionAmount: new Prisma.Decimal(0) },
              { id: item2Id, status: 'SETTLED', depositAmount: new Prisma.Decimal(300000), refundAmount: new Prisma.Decimal(300000), deductionAmount: new Prisma.Decimal(0) },
            ],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        paymentConsumerReceipt: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        rentalOutboxEvent: {
          create: jest.fn().mockImplementation(({ data }: any) => {
            outboxCreates.push(data)
            return Promise.resolve(data)
          }),
        },
        paymentAllocation: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(500000) } }),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
        rentalUnitAssignment: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'asgn-1', status: 'CLOSED' },
            { id: 'asgn-2', status: 'CLOSED' },
          ]),
        },
        rentalExceptionCase: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        deliveryTask: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        rentalReturnSession: {
          findFirst: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
        },
      }

      const dbMock: any = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      }

      const paymentsPort = { requestRefund: jest.fn() }
      const worker = new RentalDepositWorker(dbMock, paymentsPort as any)

      await worker.consume(eventId)

      // Both items updated to SETTLED
      expect(itemUpdates).toHaveLength(2)
      expect(itemUpdates[0].data.status).toBe('SETTLED')
      expect(itemUpdates[1].data.status).toBe('SETTLED')

      // Events emitted for each item
      expect(outboxCreates).toHaveLength(2)
      expect(outboxCreates.map((o) => o.aggregateId)).toEqual([item1Id, item2Id])
    })
  })
})
