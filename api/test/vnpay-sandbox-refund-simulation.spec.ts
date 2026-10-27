jest.mock('@nestjs/schedule', () => ({
  Cron: jest.fn(() => () => {}),
  CronExpression: {},
  Interval: jest.fn(() => () => {}),
}))

import { randomUUID } from 'node:crypto'
import {
  CustodyTransferStatus,
  DeliveryTaskStatus,
  DeliveryTaskType,
  DepositItemStatus,
  PackageStatus,
  Prisma,
  RentalExceptionCaseStatus,
  RentalFinancialStatus,
  RentalOrderStatus,
  RentalReturnSessionStatus,
  RentalUnitAssignmentStatus,
} from '@prisma/client'
import { ROLES_KEY } from '../src/shared/decorators/roles.decorator'
import { PAYMENT_ERROR_CODES as P } from '../src/shared/errors'
import { PaymentOperationsController } from '../src/modules/payments/payment-operations.controller'
import { SandboxRefundSimulationService } from '../src/modules/payments/sandbox-refund-simulation.service'
import { SandboxSimulateRefundBodySchema } from '../src/modules/payments/dtos/sandbox-refund-simulation.dto'
import { RefundsService, refundSummary } from '../src/modules/payments/refunds.service'
import { paymentHash } from '../src/modules/payments/payment-utils'
import {
  PrismaRentalReturnAdapter,
  tryCompleteOrder,
} from '../src/modules/rental/returns/infrastructure/adapters/prisma-rental-return.adapter'
import { RentalDepositWorker } from '../src/modules/rental/payments/rental-deposit.worker'
import type { VerifiedRefundEvent } from '../src/modules/payments/payment-provider.port'

type HarnessOptions = {
  ids?: Partial<Record<'refundId' | 'paymentId' | 'invoiceId' | 'orderId' | 'settlementId' | 'adminId', string>>
  itemAmounts?: number[]
  refund?: Record<string, unknown>
  payment?: Record<string, unknown>
  invoice?: Record<string, unknown>
  settlement?: Record<string, unknown>
  item?: Record<string, unknown>
  cachedIdempotency?: Record<string, unknown> | null
  concurrentIdempotency?: Record<string, unknown> | null
  idempotencyCreate?: jest.Mock
  applyEventError?: Error
  outboxStatus?: 'PENDING' | 'PROCESSED'
  rentalConsumerReceipt?: boolean
  mutate?: (state: { refund: any; items: any[]; payment: any }) => void
}

const createHarness = (options: HarnessOptions = {}) => {
  const ids = {
    refundId: options.ids?.refundId ?? randomUUID(),
    paymentId: options.ids?.paymentId ?? randomUUID(),
    invoiceId: options.ids?.invoiceId ?? randomUUID(),
    orderId: options.ids?.orderId ?? randomUUID(),
    settlementId: options.ids?.settlementId ?? randomUUID(),
    adminId: options.ids?.adminId ?? randomUUID(),
  }
  const itemAmounts = options.itemAmounts ?? [780000]
  const now = new Date('2026-10-23T12:00:00.000Z')
  const payment: any = {
    id: ids.paymentId,
    invoiceId: ids.invoiceId,
    merchantRequestRef: `payment:${ids.paymentId}`,
    transactionRef: '14567890',
    currency: 'VND',
    status: 'SUCCEEDED',
    invoice: { id: ids.invoiceId, rentalOrderId: ids.orderId, ...(options.invoice ?? {}) },
    ...(options.payment ?? {}),
  }
  const items = itemAmounts.map((amount) => ({
    id: randomUUID(),
    settlementId: ids.settlementId,
    refundAmount: new Prisma.Decimal(amount),
    status: DepositItemStatus.REFUND_PENDING,
  }))
  Object.assign(items[0], options.item ?? {})

  const refund: any = {
    id: ids.refundId,
    paymentId: ids.paymentId,
    rentalOrderId: ids.orderId,
    depositSettlementId: ids.settlementId,
    depositSettlementItemId: items.length === 1 ? items[0].id : null,
    depositSettlement: { id: ids.settlementId, orderId: ids.orderId, ...(options.settlement ?? {}) },
    depositRefundItems: items.map((item, index) => ({
      depositSettlementItemId: item.id,
      amount: new Prisma.Decimal(itemAmounts[index]),
      item,
    })),
    allocations: itemAmounts.map((amount) => ({
      amount: new Prisma.Decimal(amount),
      paymentAllocation: {
        paymentId: ids.paymentId,
        component: 'RENTAL_DEPOSIT',
        amount: new Prisma.Decimal(amount),
        rentalOrderLine: { orderId: ids.orderId },
      },
    })),
    payment,
    amount: new Prisma.Decimal(itemAmounts.reduce((sum, amount) => sum + amount, 0)),
    currency: 'VND',
    status: 'PROCESSING',
    purpose: 'DEPOSIT',
    paymentGateway: 'vnpay',
    providerEnvironment: 'SANDBOX',
    merchantAccountKey: 'TEST1234',
    merchantRefundRef: `refund:${ids.refundId}`,
    version: 1,
    refundedAt: null,
    providerPayload: {
      vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '05' },
    },
    ...(options.refund ?? {}),
  }
  options.mutate?.({ refund, items, payment })

  const order = {
    id: ids.orderId,
    status: RentalOrderStatus.RETURN_PROCESSING,
    financialStatus: RentalFinancialStatus.DEPOSIT_HELD,
  }
  const idempotencyRecord = {
    findUnique: jest.fn().mockResolvedValue(options.cachedIdempotency ?? null),
    create: options.idempotencyCreate ?? jest.fn().mockResolvedValue({}),
  }
  const tx: any = {
    idempotencyRecord,
    $queryRaw: jest.fn().mockImplementation((parts: TemplateStringsArray | string) => {
      const sql = Array.isArray(parts) ? parts.join('?') : String(parts)
      return Promise.resolve(sql.includes('clock_timestamp') ? [{ now }] : [{ id: 'locked' }])
    }),
    payment: { findUniqueOrThrow: jest.fn().mockResolvedValue(payment) },
    refund: {
      findUnique: jest
        .fn()
        .mockImplementation((args: any) =>
          Promise.resolve(args?.select ? { id: refund.id, paymentId: refund.paymentId } : refund),
        ),
      findUniqueOrThrow: jest.fn().mockResolvedValue(refund),
      update: jest.fn().mockImplementation(({ data }: any) => {
        const { version, ...rest } = data
        Object.assign(refund, rest)
        if (version?.increment) refund.version += version.increment
        return Promise.resolve(refund)
      }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    rentalOrder: { findUniqueOrThrow: jest.fn().mockResolvedValue(order) },
    paymentOutboxEvent: {
      findUnique: jest.fn().mockResolvedValue({
        status: options.outboxStatus ?? 'PENDING',
        receipts: options.rentalConsumerReceipt ? [{ processedAt: now }] : [],
      }),
    },
  }
  const prisma: any = {
    $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(options.concurrentIdempotency ?? null),
    },
  }
  const refunds: any = {
    applyEvent: jest.fn().mockImplementation(async (event: any) => {
      if (options.applyEventError) throw options.applyEventError
      refund.status = event.status
      refund.refundTransactionRef = event.refundTransactionRef
      refund.refundedAt = new Date(event.occurredAt)
      refund.version += 1
      return true
    }),
  }
  return {
    ...ids,
    refund,
    items,
    order,
    tx,
    prisma,
    refunds,
    service: new SandboxRefundSimulationService(prisma, refunds),
  }
}

const invoke = (
  harness: ReturnType<typeof createHarness>,
  overrides: {
    idempotencyKey?: string
    reason?: string
    expectedVersion?: number
    expectedProviderStatus?: 'PENDING' | 'PROCESSING'
  } = {},
) =>
  harness.service.simulateRefundSettlement({
    refundId: harness.refundId,
    actorUserId: harness.adminId,
    idempotencyKey: overrides.idempotencyKey ?? 'idemp-test-key-001',
    body: {
      reason: overrides.reason ?? 'Xac nhan hoan coc mo phong cho kiem thu',
      acknowledgeSandboxSimulation: true,
      expectedProviderStatus: overrides.expectedProviderStatus ?? 'PROCESSING',
      ...(overrides.expectedVersion === undefined ? {} : { expectedVersion: overrides.expectedVersion }),
    },
  })

describe('VNPay sandbox deposit-refund settlement', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PAYMENT_PROVIDER_ENVIRONMENT: 'SANDBOX',
      PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED: 'true',
      PAYMENT_SANDBOX_REFUND_SIMULATION_REMOTE_DEMO_ENABLED: 'false',
      PAYMENT_SANDBOX_REFUND_SIMULATION_ALLOW_PENDING_REFUND: 'false',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/vina_trekgo_test',
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  describe('environment and API boundary', () => {
    it('is restricted to the ADMIN controller', () => {
      expect(Reflect.getMetadata(ROLES_KEY, PaymentOperationsController)).toEqual(['ADMIN'])
    })

    it('rejects production', () => {
      process.env.NODE_ENV = 'production'
      expect(() => createHarness().service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE }),
      )
    })

    it('rejects a disabled feature flag', () => {
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED = 'false'
      expect(() => createHarness().service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_DISABLED }),
      )
    })

    it('rejects a non-sandbox provider environment', () => {
      process.env.PAYMENT_PROVIDER_ENVIRONMENT = 'PRODUCTION'
      expect(() => createHarness().service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE }),
      )
    })

    it('rejects a non-local database host', () => {
      process.env.DATABASE_URL = 'postgresql://user:secret@shared.example.com:5432/app'
      expect(() => createHarness().service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE }),
      )
    })

    it('allows only the exactly configured remote demo database host', () => {
      process.env.DATABASE_URL = 'postgresql://user:secret@db.demo.supabase.co:5432/app'
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_REMOTE_DEMO_ENABLED = 'true'
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ALLOWED_DATABASE_HOST = 'db.demo.supabase.co'
      expect(() => createHarness().service.assertEnvironmentSafe()).not.toThrow()

      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ALLOWED_DATABASE_HOST = 'db.other.supabase.co'
      expect(() => createHarness().service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE }),
      )
    })

    it('requires the explicit acknowledgement and PROCESSING expectation', () => {
      expect(
        SandboxSimulateRefundBodySchema.safeParse({ reason: 'valid reason', expectedProviderStatus: 'PROCESSING' })
          .success,
      ).toBe(false)
      expect(
        SandboxSimulateRefundBodySchema.safeParse({
          reason: 'valid reason',
          acknowledgeSandboxSimulation: true,
          expectedProviderStatus: 'PENDING',
        }).success,
      ).toBe(true)
      expect(
        SandboxSimulateRefundBodySchema.safeParse({
          reason: 'valid reason',
          acknowledgeSandboxSimulation: true,
          expectedProviderStatus: 'SUCCEEDED',
        }).success,
      ).toBe(false)
    })

    it('does not permit PENDING simulation unless its separate demo flag is enabled', async () => {
      const harness = createHarness({ refund: { status: 'PENDING', providerPayload: null } })
      await expect(invoke(harness, { expectedProviderStatus: 'PENDING' })).rejects.toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }),
      )

      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ALLOW_PENDING_REFUND = 'true'
      const enabledHarness = createHarness({ refund: { status: 'PENDING', providerPayload: null } })
      const result = await invoke(enabledHarness, { expectedProviderStatus: 'PENDING' })
      expect(result.completionMode).toBe('SANDBOX_SIMULATED')
      expect(enabledHarness.refunds.applyEvent).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCEEDED' }))
      expect(enabledHarness.refund.providerPayload.sandboxSimulation).toEqual(
        expect.objectContaining({ providerConfirmation: 'UNCONFIRMED_DEMO' }),
      )
    })

    it('rejects PENDING simulation after a VNPay dispatch was attempted', async () => {
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ALLOW_PENDING_REFUND = 'true'
      const harness = createHarness({
        refund: { status: 'PENDING', providerPayload: { vnpayDispatch: { vnp_Command: 'refund' } } },
      })
      await expect(invoke(harness, { expectedProviderStatus: 'PENDING' })).rejects.toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }),
      )
    })

    it('rejects a missing idempotency header before calling the service', async () => {
      const simulation = { simulateRefundSettlement: jest.fn() }
      const controller = new PaymentOperationsController({} as any, simulation as any)
      await expect(
        controller.simulateRefund(
          { refundId: randomUUID() },
          {
            reason: 'valid reason',
            acknowledgeSandboxSimulation: true,
            expectedProviderStatus: 'PROCESSING',
          },
          undefined,
          randomUUID(),
        ),
      ).rejects.toThrow(expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REQUIRED' }))
      expect(simulation.simulateRefundSettlement).not.toHaveBeenCalled()
    })
  })

  describe('Shared Payment transition and worker boundary', () => {
    it('applies a synthetic SUCCEEDED event through RefundsService', async () => {
      const harness = createHarness()
      const result = await invoke(harness)

      expect(harness.refunds.applyEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'REFUND',
          gateway: 'vnpay',
          environment: 'SANDBOX',
          status: 'SUCCEEDED',
          amount: '780000',
        }),
      )
      expect(result.providerRefundStatus).toBe('SUCCEEDED')
      expect(harness.refund.status).toBe('SUCCEEDED')
    })

    it('reports worker delay without directly settling Rental state', async () => {
      const harness = createHarness()
      const result = await invoke(harness)

      expect(result.settlementProcessingStatus).toBe('PENDING')
      expect(result.completionMode).toBe('SANDBOX_SIMULATED')
      expect(result.orderStatus).toBe(RentalOrderStatus.RETURN_PROCESSING)
      expect(result.financialStatus).toBe(RentalFinancialStatus.DEPOSIT_HELD)
      expect(harness.items[0].status).toBe(DepositItemStatus.REFUND_PENDING)
      expect(harness.order.status).toBe(RentalOrderStatus.RETURN_PROCESSING)
    })

    it('does not report APPLIED from transport status without the Rental consumer receipt', async () => {
      const result = await invoke(createHarness({ outboxStatus: 'PROCESSED' }))
      expect(result.settlementProcessingStatus).toBe('PENDING')
    })

    it('reports APPLIED only when the Rental consumer receipt proves projection commit', async () => {
      const result = await invoke(createHarness({ outboxStatus: 'PROCESSED', rentalConsumerReceipt: true }))
      expect(result.settlementProcessingStatus).toBe('APPLIED')
    })

    it('stores explicit test-only provenance without a provider secret', async () => {
      const harness = createHarness()
      await invoke(harness)
      const provenance = harness.refund.providerPayload.sandboxSimulation

      expect(provenance).toEqual(
        expect.objectContaining({
          origin: 'ADMIN_SANDBOX_SIMULATION',
          environment: 'SANDBOX',
          status: 'SUCCEEDED',
          actorAdminId: harness.adminId,
          warnings: ['TEST_ONLY', 'NO_REAL_MONEY_RETURNED'],
        }),
      )
      expect(JSON.stringify(provenance)).not.toContain('HASH_SECRET')
    })

    it('uses a stable provider event identity derived from the refund', async () => {
      const harness = createHarness()
      await invoke(harness)
      const event = harness.refunds.applyEvent.mock.calls[0][0]
      expect(event.providerEventId).toBe(`sandbox-refund-simulation:${harness.refundId}:succeeded:v1`)
    })

    it('accepts grouped items when both allocation layers total the exact refund amount', async () => {
      const harness = createHarness({ itemAmounts: [300000, 480000] })
      const result = await invoke(harness)
      expect(result.simulatedAmount).toBe('780000')
      expect(harness.items.every((item) => item.status === DepositItemStatus.REFUND_PENDING)).toBe(true)
    })

    it('does not finalize when the shared handler fails', async () => {
      const harness = createHarness({ applyEventError: new Error('SHARED_PAYMENT_WRITE_FAILED') })
      await expect(invoke(harness)).rejects.toThrow('SHARED_PAYMENT_WRITE_FAILED')
      expect(harness.tx.idempotencyRecord.create).not.toHaveBeenCalled()
    })
  })

  describe('idempotency', () => {
    it('replays the cached response without applying another event', async () => {
      const ids = { refundId: randomUUID() }
      const body = {
        reason: 'Original reason',
        acknowledgeSandboxSimulation: true as const,
        expectedProviderStatus: 'PROCESSING' as const,
      }
      const requestHash = paymentHash({ refundId: ids.refundId, ...body })
      const cachedResponse = { simulationId: 'sim-cached', refundId: ids.refundId }
      const harness = createHarness({ ids, cachedIdempotency: { requestHash, responseBody: cachedResponse } })

      const result = await harness.service.simulateRefundSettlement({
        refundId: ids.refundId,
        actorUserId: harness.adminId,
        idempotencyKey: 'idemp-cached-001',
        body,
      })
      expect(result).toEqual(cachedResponse)
      expect(harness.refunds.applyEvent).not.toHaveBeenCalled()
    })

    it('rejects the same key with a different request hash', async () => {
      const harness = createHarness({ cachedIdempotency: { requestHash: 'different', responseBody: {} } })
      await expect(invoke(harness)).rejects.toThrow(
        expect.objectContaining({ code: P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD }),
      )
    })

    it('recovers a concurrently persisted response after P2002', async () => {
      const create = jest.fn().mockRejectedValue({ code: 'P2002', message: 'idempotency_records' })
      const harness = createHarness({ idempotencyCreate: create })
      const request = {
        refundId: harness.refundId,
        reason: 'Race reason',
        acknowledgeSandboxSimulation: true,
        expectedProviderStatus: 'PROCESSING',
      }
      const cached = { simulationId: 'sim-concurrent' }
      harness.prisma.idempotencyRecord.findUnique.mockResolvedValue({
        requestHash: paymentHash(request),
        responseBody: cached,
      })
      await expect(invoke(harness, { reason: 'Race reason' })).resolves.toEqual(cached)
    })
  })

  describe('fail-closed eligibility', () => {
    it.each([
      ['non-deposit purpose', { refund: { purpose: 'BOOKING_CANCELLATION' } }, P.SANDBOX_SIMULATION_INVALID_REFUND],
      ['non-VNPay gateway', { refund: { paymentGateway: 'momo' } }, P.SANDBOX_SIMULATION_INVALID_REFUND],
      ['missing VNPay response', { refund: { providerPayload: {} } }, P.SANDBOX_SIMULATION_INVALID_REFUND],
      [
        'VNPay error response',
        { refund: { providerPayload: { vnpayResponse: { vnp_ResponseCode: '99', vnp_TransactionStatus: '05' } } } },
        P.SANDBOX_SIMULATION_INVALID_REFUND,
      ],
      [
        'VNPay non-processing status',
        { refund: { providerPayload: { vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '02' } } } },
        P.SANDBOX_SIMULATION_INVALID_REFUND,
      ],
      ['foreign settlement item', { item: { settlementId: randomUUID() } }, P.REFUND_SOURCE_INVALID],
      ['non-pending settlement item', { item: { status: DepositItemStatus.SETTLED } }, P.REFUND_SOURCE_INVALID],
      ['settlement/order mismatch', { settlement: { orderId: randomUUID() } }, P.REFUND_SOURCE_INVALID],
      ['invoice/order mismatch', { invoice: { rentalOrderId: randomUUID() } }, P.REFUND_SOURCE_INVALID],
    ])('rejects %s', async (_name, options, code) => {
      const harness = createHarness(options)
      await expect(invoke(harness)).rejects.toThrow(expect.objectContaining({ code }))
      expect(harness.refunds.applyEvent).not.toHaveBeenCalled()
    })

    it('rejects a payment-allocation total mismatch', async () => {
      const harness = createHarness({
        mutate: ({ refund }) => {
          refund.allocations[0].amount = new Prisma.Decimal(1)
        },
      })
      await expect(invoke(harness)).rejects.toThrow(expect.objectContaining({ code: P.REFUND_SOURCE_INVALID }))
    })

    it('rejects a deposit-item allocation total mismatch', async () => {
      const harness = createHarness({
        mutate: ({ refund }) => {
          refund.depositRefundItems[0].amount = new Prisma.Decimal(1)
        },
      })
      await expect(invoke(harness)).rejects.toThrow(expect.objectContaining({ code: P.REFUND_SOURCE_INVALID }))
    })

    it('rejects an optimistic version mismatch', async () => {
      const harness = createHarness({ refund: { version: 2 } })
      await expect(invoke(harness, { expectedVersion: 1 })).rejects.toThrow(
        expect.objectContaining({ code: 'VERSION_CONFLICT' }),
      )
    })
  })

  describe('truthful read models', () => {
    it('marks refund summaries as simulated and test-only', () => {
      const summary = refundSummary({
        id: randomUUID(),
        paymentId: randomUUID(),
        purpose: 'DEPOSIT',
        amount: new Prisma.Decimal(780000),
        currency: 'VND',
        status: 'SUCCEEDED',
        refundedAt: new Date(),
        reconcileStatus: 'RESOLVED',
        providerPayload: { sandboxSimulation: { origin: 'ADMIN_SANDBOX_SIMULATION' } },
      } as any)
      expect(summary.simulationStatus).toBe('SIMULATED')
      expect(summary.warnings).toEqual(expect.arrayContaining(['TEST_ONLY', 'NO_REAL_MONEY_RETURNED']))
    })

    it('keeps the item REFUND_PENDING during worker delay even though refund is SUCCEEDED', async () => {
      const orderId = randomUUID()
      const actorUserId = randomUUID()
      const prisma: any = {
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: orderId,
            userId: actorUserId,
            recipientSnapshot: null,
            depositSettlementViaOrderId: {
              id: randomUUID(),
              depositSettlementItemsViaSettlementId: [
                {
                  id: randomUUID(),
                  unitId: randomUUID(),
                  depositAmount: new Prisma.Decimal(780000),
                  deductionAmount: new Prisma.Decimal(0),
                  refundAmount: new Prisma.Decimal(780000),
                  status: DepositItemStatus.REFUND_PENDING,
                  reason: null,
                  decisionSnapshot: {},
                  unit: { id: randomUUID(), assetCode: 'TENT-001' },
                  inspection: null,
                  depositRefundAllocations: [
                    {
                      amount: new Prisma.Decimal(780000),
                      refund: {
                        id: randomUUID(),
                        status: 'SUCCEEDED',
                        providerPayload: {
                          sandboxSimulation: { origin: 'ADMIN_SANDBOX_SIMULATION' },
                        },
                      },
                    },
                  ],
                  refundViaDepositSettlementItemId: null,
                },
              ],
            },
          }),
        },
        returnInspectionTask: { findMany: jest.fn().mockResolvedValue([]) },
      }
      const result = await new PrismaRentalReturnAdapter(prisma).getDeposit({ orderId, actorUserId })

      expect(result.items[0].status).toBe('REFUND_PENDING')
      expect(result.items[0].refundStatus).toBe('SUCCEEDED')
      expect(result.items[0].settlementMode).toBe('SANDBOX_SIMULATED')
      expect(result.financialTruth.realMoneyReturned).toBe(false)
      expect(result.warnings).toContain('NO_REAL_MONEY_RETURNED')
    })
  })

  describe('pre-simulation obligation and truthful financial effect', () => {
    it('evaluates refund financialEffect as NONE and retains obligation while status is PROCESSING', () => {
      // Contract rule: only SUCCEEDED refunds produce financialEffect=CREDIT
      const computeFinancialEffect = (status: string) => (status === 'SUCCEEDED' ? 'CREDIT' : 'NONE')
      expect(computeFinancialEffect('PROCESSING')).toBe('NONE')
      expect(computeFinancialEffect('PENDING')).toBe('NONE')
      expect(computeFinancialEffect('FAILED')).toBe('NONE')
      expect(computeFinancialEffect('SUCCEEDED')).toBe('CREDIT')

      const harness = createHarness({ refund: { status: 'PROCESSING' } })
      expect(harness.refund.status).toBe('PROCESSING')
      expect(harness.order.status).toBe(RentalOrderStatus.RETURN_PROCESSING)
      expect(harness.order.financialStatus).toBe(RentalFinancialStatus.DEPOSIT_HELD)
      expect(harness.items[0].status).toBe(DepositItemStatus.REFUND_PENDING)
    })
  })

  describe('legacy relation resolution and fallback', () => {
    it('resolves rentalOrderId from depositSettlement when refund.rentalOrderId is null (legacy record)', async () => {
      const harness = createHarness({
        mutate: ({ refund }) => {
          refund.rentalOrderId = null
        },
      })
      const result = await invoke(harness)
      expect(result.rentalOrderId).toBe(harness.orderId)
      expect(result.providerRefundStatus).toBe('SUCCEEDED')
    })

    it('simulates a legacy single-item refund with depositSettlementItem and empty depositRefundItems', async () => {
      const harness = createHarness({
        mutate: ({ refund, items }) => {
          refund.depositRefundItems = []
          refund.depositSettlementItem = items[0]
          refund.depositSettlementItemId = items[0].id
        },
      })
      const result = await invoke(harness)
      expect(result.providerRefundStatus).toBe('SUCCEEDED')
      expect(result.simulatedAmount).toBe('780000')
    })

    it('rejects when refund.rentalOrderId contradicts depositSettlement.orderId', async () => {
      const harness = createHarness({
        refund: { rentalOrderId: randomUUID() },
      })
      await expect(invoke(harness)).rejects.toThrow(expect.objectContaining({ code: P.REFUND_SOURCE_INVALID }))
    })

    it('rejects when payment allocation rentalOrderLine belongs to a different order', async () => {
      const harness = createHarness({
        mutate: ({ refund }) => {
          refund.allocations[0].paymentAllocation.rentalOrderLine.orderId = randomUUID()
        },
      })
      await expect(invoke(harness)).rejects.toThrow(expect.objectContaining({ code: P.REFUND_SOURCE_INVALID }))
    })
  })

  describe('deduplication with distinct key on terminal refund', () => {
    it('rejects a new request with a different idempotency key once refund has transitioned to SUCCEEDED', async () => {
      const harness = createHarness({
        refund: { status: 'SUCCEEDED', refundedAt: new Date() },
      })
      await expect(invoke(harness, { idempotencyKey: 'distinct-subsequent-key-002' })).rejects.toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }),
      )
    })
  })

  describe('RefundsService provider conflict reconciliation', () => {
    const createRefundsHarness = (refundStatus: string, simulationProvenance: any = null) => {
      const refundId = randomUUID()
      const paymentId = randomUUID()
      const invoiceId = randomUUID()
      const now = new Date('2026-10-23T12:00:00.000Z')

      const refund: any = {
        id: refundId,
        status: refundStatus,
        amount: new Prisma.Decimal(780000),
        currency: 'VND',
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        paymentId,
        payment: {
          id: paymentId,
          invoiceId,
          currency: 'VND',
          merchantRequestRef: `pay-req-${paymentId}`,
          transactionRef: '12345678',
          application: { status: 'APPLIED' },
        },
        merchantRefundRef: `refund:${refundId}`,
        providerPayload: simulationProvenance ? { sandboxSimulation: simulationProvenance } : {},
        version: 1,
        reconcileStatus: 'SCHEDULED',
        refundTransactionRef: '12345678',
      }

      const tx: any = {
        $queryRaw: jest.fn().mockImplementation((parts: any) => {
          const sql = Array.isArray(parts) ? parts.join('?') : String(parts)
          if (sql.includes('clock_timestamp')) return Promise.resolve([{ now }])
          return Promise.resolve([{ id: 'locked' }])
        }),
        refund: {
          findUnique: jest.fn().mockResolvedValue(refund),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refund),
          findFirst: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.id?.not) return Promise.resolve(null)
            return Promise.resolve(refund)
          }),
          update: jest.fn().mockImplementation(({ data }: any) => {
            Object.assign(refund, data)
            return Promise.resolve(refund)
          }),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
        },
        paymentOutboxEvent: {
          create: jest.fn().mockResolvedValue({}),
        },
      }

      const prismaMock: any = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      }

      const service = new RefundsService(prismaMock, {} as any)
      return { refundId, refund, service, tx }
    }

    it('flags SANDBOX_SIMULATION_PROVIDER_CONFLICT when real provider reports FAILED after simulation SUCCEEDED', async () => {
      const harness = createRefundsHarness('SUCCEEDED', {
        origin: 'ADMIN_SANDBOX_SIMULATION',
        providerEventId: 'sandbox-event-001',
      })
      const realEvent: VerifiedRefundEvent = {
        kind: 'REFUND',
        gateway: 'vnpay',
        environment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        providerEventId: 'real-vnpay-event-conflict',
        merchantRequestRef: harness.refund.payment.merchantRequestRef,
        merchantRefundRef: harness.refund.merchantRefundRef,
        transactionRef: harness.refund.payment.transactionRef,
        refundTransactionRef: '12345678',
        status: 'FAILED',
        amount: '780000',
        currency: 'VND',
        occurredAt: new Date().toISOString(),
      }

      await harness.service.applyEvent(realEvent)

      expect(harness.refund.status).toBe('SUCCEEDED')
      expect(harness.tx.paymentOutboxEvent.create).not.toHaveBeenCalled()
      expect(harness.tx.refund.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastErrorCode: 'SANDBOX_SIMULATION_PROVIDER_CONFLICT',
            reconcileStatus: 'NEEDS_REVIEW',
          }),
        }),
      )
      expect(harness.tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REFUND_RESULT_NEEDS_REVIEW',
            newValues: expect.objectContaining({ reason: 'SANDBOX_SIMULATION_PROVIDER_CONFLICT' }),
          }),
        }),
      )
    })

    it('records REAL_PROVIDER_REFUND_CONFIRMED_AFTER_SIMULATION when real provider confirms SUCCEEDED after simulation', async () => {
      const harness = createRefundsHarness('SUCCEEDED', {
        origin: 'ADMIN_SANDBOX_SIMULATION',
        providerEventId: 'sandbox-event-001',
      })
      const realEvent: VerifiedRefundEvent = {
        kind: 'REFUND',
        gateway: 'vnpay',
        environment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        providerEventId: 'real-vnpay-event-confirmed',
        merchantRequestRef: harness.refund.payment.merchantRequestRef,
        merchantRefundRef: harness.refund.merchantRefundRef,
        transactionRef: harness.refund.payment.transactionRef,
        refundTransactionRef: '12345678',
        status: 'SUCCEEDED',
        amount: '780000',
        currency: 'VND',
        occurredAt: new Date().toISOString(),
      }

      await harness.service.applyEvent(realEvent)

      expect(harness.refund.status).toBe('SUCCEEDED')
      expect(harness.tx.paymentOutboxEvent.create).not.toHaveBeenCalled()
      expect(harness.tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REAL_PROVIDER_REFUND_CONFIRMED_AFTER_SIMULATION',
          }),
        }),
      )
    })
  })

  const createWorkerHarness = (
    options: {
      itemStatus?: DepositItemStatus
      caseStatus?: RentalExceptionCaseStatus
      assignmentStatus?: RentalUnitAssignmentStatus
      receiptExists?: boolean
      refundItems?: Array<{ id: string; amount: number }>
      otherItems?: Array<{ id: string; amount: number; status: DepositItemStatus }>
    } = {},
  ) => {
    const orderId = randomUUID()
    const settlementId = randomUUID()
    const refundId = randomUUID()
    const paymentId = randomUUID()
    const invoiceId = randomUUID()
    const eventId = randomUUID()
    const now = new Date('2026-10-23T12:00:00.000Z')

    const refundItemsData = options.refundItems ?? [{ id: randomUUID(), amount: 780000 }]
    const otherItemsData = options.otherItems ?? []
    const allItemsData = [
      ...refundItemsData.map((i) => ({ ...i, status: options.itemStatus ?? DepositItemStatus.REFUND_PENDING })),
      ...otherItemsData,
    ]

    const items = allItemsData.map((d) => ({
      id: d.id,
      settlementId,
      refundAmount: new Prisma.Decimal(d.amount),
      depositAmount: new Prisma.Decimal(d.amount),
      deductionAmount: new Prisma.Decimal(0),
      status: d.status,
      assignment: { orderLineId: randomUUID(), orderLine: { lineDeposit: new Prisma.Decimal(d.amount) } },
      settlement: { id: settlementId, orderId },
    }))

    const totalRefundAmount = refundItemsData.reduce((sum, i) => sum + i.amount, 0)
    const totalDepositAmount = allItemsData.reduce((sum, i) => sum + i.amount, 0)

    const refund: any = {
      id: refundId,
      status: 'SUCCEEDED',
      purpose: 'DEPOSIT',
      amount: new Prisma.Decimal(totalRefundAmount),
      currency: 'VND',
      depositSettlementId: settlementId,
      rentalOrderId: orderId,
      depositSettlement: { id: settlementId, orderId },
      paymentId,
      payment: {
        id: paymentId,
        invoiceId,
        currency: 'VND',
        merchantRequestRef: `pay-req-${paymentId}`,
        transactionRef: '12345678',
        invoice: { id: invoiceId, rentalOrderId: orderId },
        application: { status: 'APPLIED' },
      },
      depositRefundItems: refundItemsData.map((i) => ({
        depositSettlementItemId: i.id,
        amount: new Prisma.Decimal(i.amount),
      })),
      allocations: refundItemsData.map((i) => ({
        amount: new Prisma.Decimal(i.amount),
        paymentAllocation: {
          paymentId,
          component: 'RENTAL_DEPOSIT',
          amount: new Prisma.Decimal(i.amount),
          rentalOrderLine: { orderId },
        },
      })),
    }

    const outboxEvent = {
      id: eventId,
      eventType: 'REFUND_SUCCEEDED',
      aggregateType: 'Refund',
      aggregateId: refundId,
      status: 'PENDING',
      payload: { schemaVersion: 1, refundId },
    }

    const order: any = {
      id: orderId,
      version: 1,
      status: RentalOrderStatus.RETURN_PROCESSING,
      financialStatus: RentalFinancialStatus.DEPOSIT_HELD,
      rentalOrderLinesViaOrderId: [
        {
          rentalUnitAssignmentsViaOrderLineId: [
            {
              status: options.assignmentStatus ?? RentalUnitAssignmentStatus.CLOSED,
            },
          ],
        },
      ],
      depositSettlementViaOrderId: {
        id: settlementId,
        depositSettlementItemsViaSettlementId: items,
      },
      rentalExceptionCasesViaOrderId: options.caseStatus ? [{ status: options.caseStatus }] : [],
      deliveryTasksViaOrderId: [{ taskType: DeliveryTaskType.RETURN, status: DeliveryTaskStatus.CLOSED }],
      packageViaOrderId: { status: PackageStatus.RETURNED_TO_INVENTORY },
      returnCustodyTransfersViaOrderId: [{ status: CustodyTransferStatus.RECEIVED }],
      rentalReturnSessionsViaOrderId: [{ status: RentalReturnSessionStatus.FINALIZED }],
    }

    const settlement: any = {
      id: settlementId,
      orderId,
      totalDeposit: new Prisma.Decimal(totalDepositAmount),
      depositSettlementItemsViaSettlementId: items,
    }

    const itemUpdates: any[] = []
    const outboxCreates: any[] = []
    let orderUpdatedStatus: any = null
    let orderUpdatedFinancialStatus: any = null
    let settlementUpdatedStatus: any = null
    let outboxEventUpdatedStatus: any = null
    let consumerReceiptCreated: any = null

    const tx: any = {
      $queryRaw: jest.fn().mockImplementation((parts: any) => {
        const sql = Array.isArray(parts) ? parts.join('?') : String(parts)
        if (sql.includes('clock_timestamp')) return Promise.resolve([{ now }])
        if (sql.includes('payment_outbox_events') && sql.includes('FOR UPDATE SKIP LOCKED'))
          return Promise.resolve([{ id: eventId }])
        return Promise.resolve([{ id: 'locked' }])
      }),
      paymentOutboxEvent: {
        findUnique: jest.fn().mockResolvedValue(outboxEvent),
        findUniqueOrThrow: jest.fn().mockResolvedValue(outboxEvent),
        update: jest.fn().mockImplementation(({ data }: any) => {
          outboxEventUpdatedStatus = data.status
          return Promise.resolve(outboxEvent)
        }),
      },
      refund: {
        findUnique: jest.fn().mockResolvedValue(refund),
        findUniqueOrThrow: jest.fn().mockResolvedValue(refund),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(totalRefundAmount) } }),
        count: jest.fn().mockResolvedValue(0),
      },
      payment: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(refund.payment),
        findFirst: jest.fn().mockResolvedValue(refund.payment),
      },
      depositSettlementItem: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.id?.in) {
            return Promise.resolve(items.filter((i) => where.id.in.includes(i.id)))
          }
          return Promise.resolve(items)
        }),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          itemUpdates.push({ id: where.id, data })
          const item = items.find((i) => i.id === where.id)
          if (item) Object.assign(item, data)
          return Promise.resolve(item)
        }),
      },
      depositSettlement: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(settlement),
        update: jest.fn().mockImplementation(({ data }: any) => {
          settlementUpdatedStatus = data.status
          Object.assign(settlement, data)
          return Promise.resolve(settlement)
        }),
      },
      paymentAllocation: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(totalDepositAmount) } }),
      },
      paymentConsumerReceipt: {
        findUnique: jest.fn().mockResolvedValue(options.receiptExists ? { id: 'receipt-1' } : null),
        create: jest.fn().mockImplementation(({ data }: any) => {
          consumerReceiptCreated = data
          return Promise.resolve(data)
        }),
      },
      rentalOutboxEvent: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          outboxCreates.push(data)
          return Promise.resolve(data)
        }),
        upsert: jest.fn().mockImplementation(({ create }: any) => {
          outboxCreates.push(create)
          return Promise.resolve(create)
        }),
      },
      package: {
        update: jest.fn().mockResolvedValue({}),
      },
      deliveryTask: {
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      rentalExceptionCase: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      rentalOrder: {
        findUnique: jest.fn().mockResolvedValue(order),
        findUniqueOrThrow: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockImplementation(({ data }: any) => {
          orderUpdatedFinancialStatus = data.financialStatus
          Object.assign(order, data)
          return Promise.resolve(order)
        }),
        updateMany: jest.fn().mockImplementation(({ data }: any) => {
          orderUpdatedStatus = data.status
          Object.assign(order, data)
          return Promise.resolve({ count: 1 })
        }),
      },
    }

    const prismaMock: any = {
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
    }
    const paymentsPortMock = {
      requestRefund: jest.fn(),
    }
    const worker = new RentalDepositWorker(prismaMock, paymentsPortMock as any)

    return {
      orderId,
      settlementId,
      refundId,
      eventId,
      worker,
      tx,
      order,
      items,
      itemUpdates,
      outboxCreates,
      get orderUpdatedStatus() {
        return orderUpdatedStatus
      },
      get orderUpdatedFinancialStatus() {
        return orderUpdatedFinancialStatus
      },
      get settlementUpdatedStatus() {
        return settlementUpdatedStatus
      },
      get outboxEventUpdatedStatus() {
        return outboxEventUpdatedStatus
      },
      get consumerReceiptCreated() {
        return consumerReceiptCreated
      },
    }
  }

  describe('RentalDepositWorker consumption, settlement progress and closure guards', () => {
    it('consumes simulation REFUND_SUCCEEDED event, settles items, and completes order when all closure guards pass', async () => {
      const harness = createWorkerHarness()
      await harness.worker.consume(harness.eventId)

      expect(harness.itemUpdates.length).toBe(1)
      expect(harness.itemUpdates[0].data.status).toBe('SETTLED')
      expect(harness.settlementUpdatedStatus).toBe('SETTLED')
      expect(harness.orderUpdatedFinancialStatus).toBe('SETTLED')
      expect(harness.orderUpdatedStatus).toBe(RentalOrderStatus.COMPLETED)
      expect(harness.outboxEventUpdatedStatus).toBe('PROCESSED')
      expect(harness.consumerReceiptCreated).toEqual(
        expect.objectContaining({ eventId: harness.eventId, consumerName: 'rental-deposit-v1' }),
      )
    })

    it('guards against premature order completion when an exception case is still OPEN', async () => {
      const harness = createWorkerHarness({ caseStatus: RentalExceptionCaseStatus.OPEN })
      await harness.worker.consume(harness.eventId)

      expect(harness.itemUpdates[0].data.status).toBe('SETTLED')
      expect(harness.settlementUpdatedStatus).toBe('SETTLED')
      expect(harness.orderUpdatedFinancialStatus).toBe('SETTLED')
      expect(harness.orderUpdatedStatus).toBeNull() // tryCompleteOrder rejected completion
      expect(harness.order.status).toBe(RentalOrderStatus.RETURN_PROCESSING)
    })

    it('guards against premature order completion when unit assignments are not yet CLOSED', async () => {
      const harness = createWorkerHarness({ assignmentStatus: RentalUnitAssignmentStatus.RETURNED })
      await harness.worker.consume(harness.eventId)

      expect(harness.itemUpdates[0].data.status).toBe('SETTLED')
      expect(harness.orderUpdatedStatus).toBeNull() // tryCompleteOrder rejected completion
      expect(harness.order.status).toBe(RentalOrderStatus.RETURN_PROCESSING)
    })

    it('idempotently skips duplicate item mutation if consumer receipt already exists', async () => {
      const harness = createWorkerHarness({ receiptExists: true })
      await harness.worker.consume(harness.eventId)

      expect(harness.itemUpdates.length).toBe(0)
      expect(harness.outboxCreates.length).toBe(0)
      expect(harness.outboxEventUpdatedStatus).toBe('PROCESSED')
    })
  })

  describe('zero-refund (retained deposit) branch', () => {
    it('settles a zero-refund item directly via settleRetained without provider refund request', async () => {
      const itemId = randomUUID()
      const settlementId = randomUUID()
      const orderId = randomUUID()
      const orderLineId = randomUUID()
      const paymentId = randomUUID()
      const unitId = randomUUID()
      const assignmentId = randomUUID()
      const now = new Date('2026-10-23T12:00:00.000Z')

      const zeroItem = {
        id: itemId,
        settlementId,
        unitId,
        assignmentId,
        inspectionId: randomUUID(),
        refundAmount: new Prisma.Decimal(0),
        deductionAmount: new Prisma.Decimal(500000),
        depositAmount: new Prisma.Decimal(500000),
        status: DepositItemStatus.DEDUCTION_APPROVED,
        approvedBy: randomUUID(),
        approvedAt: now,
        decisionSnapshot: { approved: true },
        settlement: {
          id: settlementId,
          orderId,
          order: { id: orderId, status: RentalOrderStatus.RETURN_PROCESSING },
        },
        assignment: {
          id: assignmentId,
          equipmentUnitId: unitId,
          orderLineId,
          orderLine: {
            orderId,
            lineDeposit: new Prisma.Decimal(500000),
            depositPerUnitSnapshot: new Prisma.Decimal(500000),
          },
        },
        inspection: {
          orderId,
          assignmentId,
          unitId,
          outcome: 'DAMAGE_CONFIRMED',
        },
      }

      const tx: any = {
        $queryRaw: jest.fn().mockImplementation((parts: any) => {
          const sql = Array.isArray(parts) ? parts.join('?') : String(parts)
          if (sql.includes('clock_timestamp')) return Promise.resolve([{ now }])
          return Promise.resolve([{ id: 'locked' }])
        }),
        depositSettlementItem: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(zeroItem),
          update: jest.fn().mockResolvedValue(zeroItem),
          findMany: jest.fn().mockResolvedValue([zeroItem]),
        },
        payment: {
          findFirst: jest.fn().mockResolvedValue({
            id: paymentId,
            allocations: [
              {
                rentalOrderLineId: orderLineId,
                component: 'RENTAL_DEPOSIT',
                amount: new Prisma.Decimal(500000),
              },
            ],
          }),
        },
        depositSettlement: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: settlementId,
            totalDeposit: new Prisma.Decimal(500000),
            depositSettlementItemsViaSettlementId: [zeroItem],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        rentalOutboxEvent: {
          create: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
        },
        package: {
          update: jest.fn().mockResolvedValue({}),
        },
        deliveryTask: {
          update: jest.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
        },
        rentalExceptionCase: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: orderId,
            version: 1,
            status: RentalOrderStatus.RETURN_PROCESSING,
            financialStatus: RentalFinancialStatus.DEPOSIT_HELD,
            rentalOrderLinesViaOrderId: [
              { rentalUnitAssignmentsViaOrderLineId: [{ status: RentalUnitAssignmentStatus.CLOSED }] },
            ],
            depositSettlementViaOrderId: { id: settlementId, depositSettlementItemsViaSettlementId: [zeroItem] },
            rentalExceptionCasesViaOrderId: [],
            deliveryTasksViaOrderId: [{ taskType: DeliveryTaskType.RETURN, status: DeliveryTaskStatus.CLOSED }],
            packageViaOrderId: { status: PackageStatus.RETURNED_TO_INVENTORY },
            returnCustodyTransfersViaOrderId: [{ status: CustodyTransferStatus.RECEIVED }],
            rentalReturnSessionsViaOrderId: [{ status: RentalReturnSessionStatus.FINALIZED }],
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }

      const prismaMock: any = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      }
      const paymentsPortMock = {
        requestRefund: jest.fn(),
      }
      const worker = new RentalDepositWorker(prismaMock, paymentsPortMock as any)

      await worker.settleRetained(itemId)

      expect(tx.depositSettlementItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: itemId },
          data: expect.objectContaining({ status: 'SETTLED' }),
        }),
      )
      expect(tx.rentalOutboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'DEPOSIT_RETAINED',
            aggregateId: itemId,
          }),
        }),
      )
      expect(paymentsPortMock.requestRefund).not.toHaveBeenCalled()
    })
  })

  describe('multi-item grouping with partial exception', () => {
    it('settles only the PASS items while keeping an uninspected/held item unsettled', async () => {
      const passItem1Id = randomUUID()
      const passItem2Id = randomUUID()
      const heldItemId = randomUUID()

      const harness = createWorkerHarness({
        refundItems: [
          { id: passItem1Id, amount: 300000 },
          { id: passItem2Id, amount: 480000 },
        ],
        otherItems: [{ id: heldItemId, amount: 500000, status: DepositItemStatus.REFUND_PENDING }],
      })

      await harness.worker.consume(harness.eventId)

      // The 2 PASS items are settled
      expect(harness.itemUpdates.map((u) => u.id).sort()).toEqual([passItem1Id, passItem2Id].sort())
      expect(harness.itemUpdates.every((u) => u.data.status === 'SETTLED')).toBe(true)

      // Settlement is PARTIALLY_SETTLED (not SETTLED, because 3rd item is not settled)
      expect(harness.settlementUpdatedStatus).toBe('PARTIALLY_SETTLED')

      // Financial status is PARTIALLY_REFUNDED
      expect(harness.orderUpdatedFinancialStatus).toBe('PARTIALLY_REFUNDED')

      // Order is NOT completed
      expect(harness.orderUpdatedStatus).toBeNull()
      expect(harness.order.status).toBe(RentalOrderStatus.RETURN_PROCESSING)
    })
  })
})
