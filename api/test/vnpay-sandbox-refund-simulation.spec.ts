jest.mock('@nestjs/schedule', () => ({
  Cron: jest.fn(() => () => {}),
  CronExpression: {},
  Interval: jest.fn(() => () => {}),
}))

import { createHmac, randomUUID } from 'node:crypto'
import {
  CustodyTransferStatus,
  DeliveryTaskStatus,
  DeliveryTaskType,
  DepositItemStatus,
  DepositSettlementStatus,
  PackageStatus,
  Prisma,
  RentalFinancialStatus,
  RentalOrderStatus,
  ReturnInspectionOutcome,
  UserRole,
} from '@prisma/client'
import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, ForbiddenException, INestApplication } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import request from 'supertest'
import { GlobalErrorFilter } from '../src/shared/errors'
import { ROLES_KEY } from '../src/shared/decorators/roles.decorator'
import { RolesGuard } from '../src/shared/guards/roles.guard'
import { REQUEST_USER_KEY } from '../src/shared/constants/auth.constant'
import { AppError, PAYMENT_ERROR_CODES as P } from '../src/shared/errors'
import { PaymentOperationsController } from '../src/modules/payments/payment-operations.controller'
import { PaymentRecoveryService } from '../src/modules/payments/payment-recovery.service'
import { SandboxRefundSimulationService } from '../src/modules/payments/sandbox-refund-simulation.service'
import { VnpayPaymentProvider, vnpaySignature } from '../src/modules/payments/vnpay-payment.provider'
import { RefundsService, refundSummary } from '../src/modules/payments/refunds.service'
import { PrismaRentalReturnAdapter } from '../src/modules/rental/returns/infrastructure/adapters/prisma-rental-return.adapter'
import * as paymentUtils from '../src/modules/payments/payment-utils'

describe('VNPay Sandbox Admin Refund Simulation (Prompt V2, 23/10/2026 - Reworked for MERGE Review)', () => {
  const originalEnv = { ...process.env }
  const vnpaySecret = 'merchant-test-secret-1234'
  const hmac = (text: string) => createHmac('sha512', vnpaySecret).update(text).digest('hex')

  const signedVnpayFields = (fields: Record<string, string>, orderedKeys: string[]) => {
    const hashData = orderedKeys.map((k) => fields[k] ?? '').join('|')
    return {
      ...fields,
      vnp_SecureHash: hmac(hashData),
    }
  }

  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PAYMENT_PROVIDER_ENVIRONMENT: 'SANDBOX',
      PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED: 'true',
      VNPAY_SANDBOX_TMN_CODE: 'TEST1234',
      VNPAY_SANDBOX_HASH_SECRET: vnpaySecret,
      VNPAY_SANDBOX_RETURN_URL: 'https://merchant.test/return',
      VNPAY_SANDBOX_API_IP: '203.0.113.5',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/vina_trekgo_test',
    })
    delete process.env.PAYMENT_TEST_DATABASE_URL
    delete process.env.AREAB_TEST_DATABASE_URL
    delete process.env.CF02_TEST_DATABASE_URL
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  // =========================================================================
  // SCENARIO 1: VNPay Sandbox Checkout & IPN Verification (Regression)
  // =========================================================================
  describe('1. VNPay Sandbox Checkout & IPN Verification (Regression)', () => {
    it('creates a signed VNPay Sandbox checkout URL and verifies incoming IPN with valid HMAC-SHA512', async () => {
      const paymentId = randomUUID()
      const mockDb: any = {
        payment: {
          findFirst: jest.fn().mockResolvedValue({
            id: paymentId,
            merchantRequestRef: `payment:${paymentId}`,
            amount: new Prisma.Decimal(780000),
            currency: 'VND',
            paymentGateway: 'vnpay',
            providerEnvironment: 'SANDBOX',
            merchantAccountKey: 'TEST1234',
            status: 'PENDING',
          }),
        },
      }
      const provider = new VnpayPaymentProvider(mockDb)
      const checkoutRes = await provider.createPayment({
        ...provider.scope,
        merchantRequestRef: `payment:${paymentId}`,
        amount: '780000',
        currency: 'VND',
        paymentMethod: 'REDIRECT',
        clientIp: '127.0.0.1',
        expiresAt: new Date(Date.now() + 600000),
      })

      expect(checkoutRes.kind).toBe('CONFIRMED_RESULT')
      if (checkoutRes.kind !== 'CONFIRMED_RESULT') return
      expect(checkoutRes.checkout.url).toContain('https://sandbox.vnpayment.vn')
      expect(checkoutRes.checkout.url).toContain('vnp_SecureHash=')

      // Simulate incoming valid webhook IPN from VNPay Sandbox
      const rawTxnRef = paymentId.replace(/-/g, '')
      const ipnPayload: Record<string, string> = {
        vnp_TmnCode: 'TEST1234',
        vnp_Amount: '78000000', // x100 for VND
        vnp_BankCode: 'NCB',
        vnp_BankTranNo: 'VNP12345678',
        vnp_CardType: 'ATM',
        vnp_PayDate: '20261023120000',
        vnp_OrderInfo: 'Thanh toan don hang TrekGo',
        vnp_TransactionNo: '14567890',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_TxnRef: rawTxnRef,
      }
      ipnPayload.vnp_SecureHash = vnpaySignature(ipnPayload, vnpaySecret)

      const parsed = await provider.verifyWebhook(Buffer.from(JSON.stringify(ipnPayload)))
      expect(parsed).not.toBeNull()
      if (parsed) {
        expect(parsed.status).toBe('SUCCEEDED')
        expect(parsed.gateway).toBe('vnpay')
        expect(parsed.environment).toBe('SANDBOX')
        expect(parsed.amount).toBe('780000')
      }

      // Tampered hash rejected
      const tamperedPayload = { ...ipnPayload, vnp_SecureHash: 'invalid-hash'.repeat(10) }
      const tamperedRes = await provider.verifyWebhook(Buffer.from(JSON.stringify(tamperedPayload)))
      expect(tamperedRes).toBeNull()
    })
  })

  // =========================================================================
  // SCENARIO 2: Refund 05/06 -> Stays PROCESSING, Simulation Not Auto-Triggered
  // =========================================================================
  describe('2. Refund 05/06 -> Stays PROCESSING, Simulation Not Auto-Triggered', () => {
    it('maps VNPay responseCode=00 with transactionStatus=05 or 06 to PROCESSING and leaves provider truth untouched', async () => {
      const paymentId = randomUUID()
      const refundId = randomUUID()

      const provider = new VnpayPaymentProvider({} as any)
      const checkoutRes = await provider.createPayment({
        ...provider.scope,
        merchantRequestRef: `payment:${paymentId}`,
        amount: '780000',
        currency: 'VND',
        paymentMethod: 'REDIRECT',
        clientIp: '127.0.0.1',
        expiresAt: new Date(Date.now() + 600000),
      })
      if (checkoutRes.kind !== 'CONFIRMED_RESULT') throw new Error('Checkout fixture creation failed')

      const payment = {
        id: paymentId,
        merchantRequestRef: `payment:${paymentId}`,
        amount: new Prisma.Decimal(780000),
        currency: 'VND',
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        status: 'SUCCEEDED',
        transactionRef: '14567890',
        createdAt: new Date('2026-10-23T05:00:00Z'),
        reconcileStatus: 'RESOLVED',
        checkoutData: checkoutRes.checkout,
      }

      const refund = {
        id: refundId,
        paymentId,
        merchantRefundRef: `refund:${refundId}`,
        amount: new Prisma.Decimal(780000),
        currency: 'VND',
        requestHashVersion: 1,
        version: 1,
        status: 'PENDING',
        reconcileStatus: 'SCHEDULED',
        createdAt: new Date('2026-10-23T06:00:00Z'),
        providerPayload: null,
        refundTransactionRef: null,
        payment,
      }

      const mockDb: any = {
        payment: { findFirst: jest.fn().mockResolvedValue(payment) },
        refund: {
          findFirst: jest.fn().mockResolvedValue(refund),
          updateMany: jest.fn().mockImplementation(({ where, data }) => {
            Object.assign(refund, data)
            return Promise.resolve({ count: 1 })
          }),
        },
      }

      const providerWithDb = new VnpayPaymentProvider(mockDb)

      const vnpayFields: Record<string, string> = {
        vnp_ResponseId: 'res-1',
        vnp_Command: 'refund',
        vnp_ResponseCode: '00',
        vnp_Message: 'Refund request received and processing',
        vnp_TmnCode: 'TEST1234',
        vnp_TxnRef: paymentId.replace(/-/g, ''),
        vnp_Amount: '78000000',
        vnp_BankCode: 'NCB',
        vnp_PayDate: '20261023120000',
        vnp_TransactionNo: '987654',
        vnp_TransactionType: '02',
        vnp_TransactionStatus: '05', // PROCESSING
        vnp_OrderInfo: `Refund TrekGo ${refund.id}`,
      }
      const responseOrder = [
        'vnp_ResponseId', 'vnp_Command', 'vnp_ResponseCode', 'vnp_Message',
        'vnp_TmnCode', 'vnp_TxnRef', 'vnp_Amount', 'vnp_BankCode',
        'vnp_PayDate', 'vnp_TransactionNo', 'vnp_TransactionType',
        'vnp_TransactionStatus', 'vnp_OrderInfo',
      ]
      const signedRefundRes = signedVnpayFields(vnpayFields, responseOrder)

      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(signedRefundRes), { status: 200 })
      )

      const result = await providerWithDb.refund({
        ...providerWithDb.scope,
        merchantRequestRef: payment.merchantRequestRef,
        merchantRefundRef: refund.merchantRefundRef,
        amount: '780000',
        currency: 'VND',
      })

      expect(result.kind).toBe('CONFIRMED_RESULT')
      if (result.kind === 'CONFIRMED_RESULT') {
        expect(result.event.status).toBe('PROCESSING') // Strictly PROCESSING, NOT SUCCEEDED!
        expect(result.event.refundTransactionRef).toBe('987654')
      }
    })
  })

  // =========================================================================
  // SCENARIO 3: Fail-Closed Environment Guards (MERGE-01 Hardening)
  // =========================================================================
  describe('3. Strict Fail-Closed Environment Guards (MERGE-01 Hardening)', () => {
    let service: SandboxRefundSimulationService

    beforeEach(() => {
      service = new SandboxRefundSimulationService({} as any)
    })

    it('rejects simulation if NODE_ENV is production (SANDBOX_SIMULATION_ENV_UNSAFE)', () => {
      process.env.NODE_ENV = 'production'
      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE })
      )
    })

    it('rejects simulation if PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED is false (SANDBOX_SIMULATION_DISABLED)', () => {
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED = 'false'
      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_DISABLED })
      )
    })

    it('rejects simulation if PAYMENT_PROVIDER_ENVIRONMENT is not SANDBOX (SANDBOX_SIMULATION_ENV_UNSAFE)', () => {
      process.env.PAYMENT_PROVIDER_ENVIRONMENT = 'PRODUCTION'
      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE })
      )
    })

    it('MERGE-01: rejects simulation if DATABASE_URL is shared NeonDB even if test override is provided', () => {
      process.env.DATABASE_URL = 'postgresql://neondb_owner:secret@ep-gentle-hall-azteeoa7-pooler.ap-southeast-1.aws.neon.tech/neondb'
      process.env.PAYMENT_TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/test'

      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE })
      )
    })

    it('MERGE-01: rejects simulation if DATABASE_URL is missing or empty', () => {
      delete process.env.DATABASE_URL
      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE })
      )
    })

    it('MERGE-01: rejects simulation if DATABASE_URL points to non-local cloud host', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.mycompany-cloud.internal:5432/db'
      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE })
      )
    })

    it('RG-01: rejects simulation if DATABASE_URL has masquerading attacker domain (localhost.attacker.example)', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost.attacker.example:5432/app'
      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE })
      )
    })

    it('RG-01: rejects simulation if DATABASE_URL has query param application_name=localhost', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@db.example.com:5432/app?application_name=localhost'
      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE })
      )
    })

    it('RG-01: rejects simulation if DATABASE_URL has username localhost pointing to remote host', () => {
      process.env.DATABASE_URL = 'postgresql://user:localhost@remote.database.example:5432/app'
      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_ENV_UNSAFE })
      )
    })

    it('RG-01: permits simulation on exact 127.0.0.1 and [::1] local test DB', () => {
      process.env.NODE_ENV = 'test'
      process.env.PAYMENT_PROVIDER_ENVIRONMENT = 'SANDBOX'
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED = 'true'

      process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/vina_trekgo_test'
      expect(() => service.assertEnvironmentSafe()).not.toThrow()

      process.env.DATABASE_URL = 'postgresql://postgres:postgres@[::1]:5432/vina_trekgo_test'
      expect(() => service.assertEnvironmentSafe()).not.toThrow()
    })

    it('permits simulation when environment is SANDBOX on verified isolated local test DB and flag is enabled', () => {
      process.env.NODE_ENV = 'test'
      process.env.PAYMENT_PROVIDER_ENVIRONMENT = 'SANDBOX'
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED = 'true'
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/vina_trekgo_test'

      expect(() => service.assertEnvironmentSafe()).not.toThrow()
    })
  })

  // =========================================================================
  // SCENARIO 4: Role-Based Access Control (RBAC) & Route Security (MERGE-09)
  // =========================================================================
  describe('4. Role-Based Access Control (RBAC) & Route Security (MERGE-09)', () => {
    const mockSimulationService = {
      simulateRefundSettlement: jest.fn().mockResolvedValue({ status: 'OK' }),
      getSimulationDetail: jest.fn(),
    }
    const mockRecoveryService = { schedule: jest.fn() }
    const reflector = new Reflector()
    const rolesGuard = new RolesGuard(reflector)

    const createMockExecutionContext = (role: UserRole, userStatus = 'ACTIVE'): ExecutionContext =>
      ({
        getHandler: () => PaymentOperationsController.prototype.simulateRefund,
        getClass: () => PaymentOperationsController,
        switchToHttp: () => ({
          getRequest: () => ({
            [REQUEST_USER_KEY]: {
              id: 'user-test-id',
              role,
              status: userStatus,
            },
          }),
          getResponse: () => ({}),
          getNext: () => ({}),
        }),
      }) as unknown as ExecutionContext

    it('verifies Roles metadata on controller is strictly ADMIN', () => {
      const controllerRoles = Reflect.getMetadata(ROLES_KEY, PaymentOperationsController)
      expect(controllerRoles).toEqual(['ADMIN'])
    })

    it('MERGE-09: rejects non-ADMIN role USER with HTTP 403 Forbidden', () => {
      const ctx = createMockExecutionContext(UserRole.USER)
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException)
    })

    it('MERGE-09: rejects non-ADMIN role STAFF_DELIVERY with HTTP 403 Forbidden', () => {
      const ctx = createMockExecutionContext(UserRole.STAFF_DELIVERY)
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException)
    })

    it('allows ADMIN role through RolesGuard', () => {
      const ctx = createMockExecutionContext(UserRole.ADMIN)
      expect(rolesGuard.canActivate(ctx)).toBe(true)
    })

    it('rejects requests missing Idempotency-Key header with 400 Bad Request', async () => {
      const controller = new PaymentOperationsController(
        mockRecoveryService as any,
        mockSimulationService as any,
      )
      await expect(
        controller.simulateRefund({ refundId: 'refund-1' }, {} as any, undefined, 'admin-1'),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        }),
      )
    })
  })

  // =========================================================================
  // SCENARIO 5: Admin Sandbox Simulation Happy Path (MERGE-02 & MERGE-06)
  // =========================================================================
  describe('5. Admin Sandbox Simulation Happy Path (Dual-Layer Provenance & Lock Order)', () => {
    it('executes simulation atomically: leaves provider truth PROCESSING, DOES NOT MUTATE policySnapshot, locks canonically, and settles demo', async () => {
      const refundId = randomUUID()
      const paymentId = randomUUID()
      const orderId = randomUUID()
      const settlementId = randomUUID()
      const itemId = randomUUID()
      const adminId = randomUUID()
      const now = new Date('2026-10-23T12:00:00Z')

      const initialPolicySnapshot = Object.freeze({
        rate: 50000,
        depositPerUnit: 780000,
        cancellationPolicy: 'STANDARD_STRICT',
        frozenAt: '2026-10-20T10:00:00Z',
      })

      const refundRecord: any = {
        id: refundId,
        paymentId,
        rentalOrderId: orderId,
        depositSettlementId: settlementId,
        depositSettlementItemId: itemId,
        depositRefundItems: [],
        amount: new Prisma.Decimal(780000),
        currency: 'VND',
        status: 'PROCESSING',
        purpose: 'DEPOSIT',
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        version: 1,
        providerPayload: {
          vnpayDispatch: { vnp_Command: 'refund', vnp_Amount: '78000000' },
          vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '05' },
        },
      }

      const settlementItemRecord: any = {
        id: itemId,
        settlementId,
        depositAmount: new Prisma.Decimal(780000),
        refundAmount: new Prisma.Decimal(780000),
        deductionAmount: new Prisma.Decimal(0),
        status: DepositItemStatus.REFUND_PENDING,
        reason: null,
        decisionSnapshot: {},
        version: 1,
      }

      const settlementRecord: any = {
        id: settlementId,
        orderId,
        totalDeposit: new Prisma.Decimal(780000),
        totalDeduction: new Prisma.Decimal(0),
        refundAmount: new Prisma.Decimal(0),
        status: DepositSettlementStatus.REFUND_PENDING,
        depositSettlementItemsViaSettlementId: [settlementItemRecord],
        version: 1,
      }

      const rentalOrderRecord: any = {
        id: orderId,
        status: RentalOrderStatus.RETURN_PROCESSING,
        financialStatus: RentalFinancialStatus.DEPOSIT_HELD,
        policySnapshot: { ...initialPolicySnapshot },
        rentalOrderLinesViaOrderId: [{ rentalUnitAssignmentsViaOrderLineId: [{ status: 'CLOSED' }] }],
        depositSettlementViaOrderId: settlementRecord,
        rentalExceptionCasesViaOrderId: [],
        deliveryTasksViaOrderId: [
          { taskType: DeliveryTaskType.RETURN, status: DeliveryTaskStatus.INVENTORY_RECEIVED },
        ],
        packageViaOrderId: { status: PackageStatus.RETURNED_TO_INVENTORY },
        returnCustodyTransfersViaOrderId: [
          { status: CustodyTransferStatus.RECEIVED },
        ],
        rentalReturnSessionsViaOrderId: [],
        version: 1,
      }

      const createdOutbox: any[] = []
      const createdAudits: any[] = []
      const lockTrace: string[] = []

      const mockTx: any = {
        idempotencyRecord: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        $queryRaw: jest.fn().mockImplementation((queryParts: any, ...args: any[]) => {
          const sql = Array.isArray(queryParts) ? queryParts.join('?') : String(queryParts)
          if (sql.includes('SELECT id FROM rental_orders')) lockTrace.push('LOCK_RENTAL_ORDERS')
          if (sql.includes('SELECT id FROM deposit_settlements')) lockTrace.push('LOCK_DEPOSIT_SETTLEMENTS')
          if (sql.includes('SELECT id FROM deposit_settlement_items')) lockTrace.push('LOCK_DEPOSIT_SETTLEMENT_ITEMS')
          if (sql.includes('SELECT id FROM refunds')) lockTrace.push('LOCK_REFUNDS')
          return Promise.resolve([{ now }])
        }),
        refund: {
          findUnique: jest.fn().mockResolvedValue(refundRecord),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refundRecord),
          update: jest.fn().mockImplementation(({ data }) => {
            Object.assign(refundRecord, data)
            return Promise.resolve(refundRecord)
          }),
        },
        depositSettlementItem: {
          findMany: jest.fn().mockResolvedValue([settlementItemRecord]),
          update: jest.fn().mockImplementation(({ data }) => {
            Object.assign(settlementItemRecord, data)
            return Promise.resolve(settlementItemRecord)
          }),
        },
        depositSettlement: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(settlementRecord),
          update: jest.fn().mockImplementation(({ data }) => {
            Object.assign(settlementRecord, data)
            return Promise.resolve(settlementRecord)
          }),
        },
        rentalOrder: {
          findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve(rentalOrderRecord)),
          findUnique: jest.fn().mockImplementation(() => Promise.resolve(rentalOrderRecord)),
          update: jest.fn().mockImplementation(({ data }) => {
            Object.assign(rentalOrderRecord, data)
            return Promise.resolve(rentalOrderRecord)
          }),
        },
        rentalExceptionCase: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        deliveryTask: { update: jest.fn().mockResolvedValue({}) },
        package: { update: jest.fn().mockResolvedValue({}) },
        rentalOutboxEvent: { upsert: jest.fn().mockResolvedValue({}) },
        mockPaymentOperation: {
          upsert: jest.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: jest.fn().mockImplementation(({ data }) => {
            createdAudits.push(data)
            return Promise.resolve(data)
          }),
        },
        paymentOutboxEvent: {
          create: jest.fn().mockImplementation(({ data }) => {
            createdOutbox.push(data)
            return Promise.resolve(data)
          }),
        },
      }

      const mockPrisma: any = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
      }

      const service = new SandboxRefundSimulationService(mockPrisma)
      const res = await service.simulateRefundSettlement({
        refundId,
        actorUserId: adminId,
        idempotencyKey: 'idemp-test-key-001',
        body: {
          reason: 'Xac nhan hoan coc mo phong cho khao sat demo',
          acknowledgeSandboxSimulation: true,
          expectedProviderStatus: 'PROCESSING',
        },
      })

      // Assert Response Contract
      expect(res.simulationStatus).toBe('SIMULATED')
      expect(res.settlementMode).toBe('SANDBOX_SIMULATED')
      expect(res.providerRefundStatus).toBe('PROCESSING') // Provider truth NOT corrupted
      expect(res.simulatedAmount).toBe('780000')
      expect(res.currency).toBe('VND')
      expect(res.orderStatus).toBe(RentalOrderStatus.COMPLETED)
      expect(res.financialStatus).toBe(RentalFinancialStatus.SETTLED)
      expect(res.completionMode).toBe('SANDBOX_SIMULATED')
      expect(res.warnings).toContain('TEST_ONLY')
      expect(res.warnings).toContain('NO_REAL_MONEY_RETURNED')

      // MERGE-02 Invariant: PolicySnapshot MUST NOT be mutated!
      expect(rentalOrderRecord.policySnapshot).toEqual(initialPolicySnapshot)

      // MERGE-06 Invariant: Canonical lock order (rental_orders -> settlements -> items -> refunds)
      expect(lockTrace.slice(0, 4)).toEqual([
        'LOCK_RENTAL_ORDERS',
        'LOCK_DEPOSIT_SETTLEMENTS',
        'LOCK_DEPOSIT_SETTLEMENT_ITEMS',
        'LOCK_REFUNDS',
      ])

      // Assert Item mutations
      expect(settlementItemRecord.status).toBe(DepositItemStatus.SETTLED)
      expect(settlementItemRecord.decisionSnapshot.settlementMode).toBe('SANDBOX_SIMULATED')
      expect(settlementRecord.status).toBe(DepositSettlementStatus.SETTLED)
      expect(rentalOrderRecord.financialStatus).toBe(RentalFinancialStatus.SETTLED)
      expect(rentalOrderRecord.status).toBe(RentalOrderStatus.COMPLETED)

      // Assert Dedicated Outbox & Audit Log
      expect(createdOutbox).toHaveLength(1)
      expect(createdOutbox[0].eventType).toBe('SANDBOX_REFUND_SIMULATED')
      expect(createdAudits.some((a) => a.action === 'ADMIN_SANDBOX_REFUND_SIMULATED')).toBe(true)
    })
  })

  // =========================================================================
  // SCENARIO 6: Idempotency & Replay Safety (MERGE-05)
  // =========================================================================
  describe('6. Idempotency & Replay Safety (MERGE-05)', () => {
    it('replays identical cached response on same idempotency key, and rejects payload conflict with 409', async () => {
      const refundId = randomUUID()
      const adminId = randomUUID()
      const key = 'idemp-test-repeat-001'

      const cachedResponse = {
        simulationId: 'sim-1',
        refundId,
        simulationStatus: 'SIMULATED',
        settlementMode: 'SANDBOX_SIMULATED',
      }

      const mockTxSame: any = {
        idempotencyRecord: {
          findUnique: jest.fn().mockResolvedValue({
            requestHash: 'e697cfc1f365d95d8cddeee0dcf3824f8d9bfa3732c253d7ca9704eefeb4b30e',
            responseBody: cachedResponse,
          }),
        },
      }
      const mockPrismaSame: any = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTxSame)),
      }
      const serviceSame = new SandboxRefundSimulationService(mockPrismaSame)

      jest.spyOn(paymentUtils, 'paymentHash').mockReturnValue('e697cfc1f365d95d8cddeee0dcf3824f8d9bfa3732c253d7ca9704eefeb4b30e')

      const replayRes = await serviceSame.simulateRefundSettlement({
        refundId,
        actorUserId: adminId,
        idempotencyKey: key,
        body: {
          reason: 'Original reason',
          acknowledgeSandboxSimulation: true,
          expectedProviderStatus: 'PROCESSING',
        },
      })
      expect(replayRes).toEqual(cachedResponse)

      // Reusing key with different hash throws 409
      jest.spyOn(paymentUtils, 'paymentHash').mockReturnValue('different-hash-value-1234')
      await expect(
        serviceSame.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: key,
          body: {
            reason: 'Tampered different reason',
            acknowledgeSandboxSimulation: true,
            expectedProviderStatus: 'PROCESSING',
          },
        })
      ).rejects.toThrow(
        expect.objectContaining({ code: P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD })
      )
    })

    it('RG-04: recovers outside transaction when concurrent race triggers P2002 on idempotency creation', async () => {
      const refundId = randomUUID()
      const adminId = randomUUID()
      const orderId = randomUUID()
      const settlementId = randomUUID()
      const itemId = randomUUID()
      const key = 'idemp-p2002-race-001'
      const cachedResponse = { simulationId: 'cached-sim-p2002' }

      const mockTx = {
        idempotencyRecord: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockRejectedValue({ code: 'P2002', message: 'Unique constraint failed on idempotency_records' }),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ now: new Date() }]),
        refund: {
          findUnique: jest.fn().mockResolvedValue({
            id: refundId,
            rentalOrderId: orderId,
            depositSettlementId: settlementId,
          }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: refundId,
            purpose: 'DEPOSIT',
            paymentGateway: 'vnpay',
            providerEnvironment: 'SANDBOX',
            status: 'PROCESSING',
            version: 1,
            amount: new Prisma.Decimal(500000),
            currency: 'VND',
            depositRefundItems: [],
            depositSettlementId: settlementId,
            depositSettlementItemId: itemId,
            providerPayload: {
              vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '05' },
            },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        depositSettlementItem: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: itemId,
              settlementId: settlementId,
              depositAmount: new Prisma.Decimal(500000),
              refundAmount: new Prisma.Decimal(500000),
              deductionAmount: new Prisma.Decimal(0),
              status: DepositItemStatus.REFUND_PENDING,
              currency: 'VND',
              decisionSnapshot: {},
            },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
        depositSettlement: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: settlementId, depositSettlementItemsViaSettlementId: [] }),
          update: jest.fn().mockResolvedValue({}),
        },
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue(null),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: orderId, status: 'COMPLETED', financialStatus: 'SETTLED' }),
          update: jest.fn().mockResolvedValue({}),
        },
        mockPaymentOperation: { upsert: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        paymentOutboxEvent: { create: jest.fn().mockResolvedValue({}) },
        rentalExceptionCase: { findFirst: jest.fn().mockResolvedValue(null) },
      }

      const mockPrisma: any = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
        idempotencyRecord: {
          findUnique: jest.fn().mockResolvedValue({
            requestHash: 'e697cfc1f365d95d8cddeee0dcf3824f8d9bfa3732c253d7ca9704eefeb4b30e',
            responseBody: cachedResponse,
          }),
        },
      }

      const service = new SandboxRefundSimulationService(mockPrisma)
      jest.spyOn(paymentUtils, 'paymentHash').mockReturnValue('e697cfc1f365d95d8cddeee0dcf3824f8d9bfa3732c253d7ca9704eefeb4b30e')

      const res = await service.simulateRefundSettlement({
        refundId,
        actorUserId: adminId,
        idempotencyKey: key,
        body: {
          reason: 'Race test reason',
          acknowledgeSandboxSimulation: true,
          expectedProviderStatus: 'PROCESSING',
        },
      })

      expect(res).toEqual(cachedResponse)
    })
  })

  // =========================================================================
  // SCENARIO 7: Eligibility & Safety Validation Guards (MERGE-03 & MERGE-08)
  // =========================================================================
  describe('7. Eligibility & Safety Validation Guards (MERGE-03 & MERGE-08)', () => {
    const adminId = randomUUID()
    const refundId = randomUUID()
    const settlementId = randomUUID()
    const orderId = randomUUID()
    const itemId = randomUUID()

    const setupMockTxWithRefund = (refundOverrides: Partial<any>, itemOverrides: Partial<any> = {}) => {
      const refund = {
        id: refundId,
        purpose: 'DEPOSIT',
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        status: 'PROCESSING',
        version: 1,
        rentalOrderId: orderId,
        depositSettlementId: settlementId,
        depositSettlementItemId: itemId,
        depositRefundItems: [],
        providerPayload: {
          vnpayDispatch: { vnp_Command: 'refund' },
          vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '05' },
        },
        amount: new Prisma.Decimal(500000),
        currency: 'VND',
        ...refundOverrides,
      }
      const item = {
        id: itemId,
        settlementId,
        depositAmount: new Prisma.Decimal(500000),
        refundAmount: new Prisma.Decimal(500000),
        deductionAmount: new Prisma.Decimal(0),
        status: DepositItemStatus.REFUND_PENDING,
        ...itemOverrides,
      }
      const mockTx: any = {
        idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
        $queryRaw: jest.fn().mockResolvedValue([{ now: new Date() }]),
        refund: {
          findUnique: jest.fn().mockResolvedValue(refund),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refund),
        },
        depositSettlementItem: {
          findMany: jest.fn().mockResolvedValue([item]),
        },
        rentalExceptionCase: { findFirst: jest.fn().mockResolvedValue(null) },
      }
      return new SandboxRefundSimulationService({
        $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
      } as any)
    }

    it('rejects refund whose purpose is not DEPOSIT (e.g. BOOKING_CANCELLATION)', async () => {
      const service = setupMockTxWithRefund({ purpose: 'BOOKING_CANCELLATION' })
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-err-1',
          body: { reason: 'Test reason', acknowledgeSandboxSimulation: true, expectedProviderStatus: 'PROCESSING' },
        })
      ).rejects.toThrow(expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }))
    })

    it('rejects refund whose gateway is not vnpay', async () => {
      const service = setupMockTxWithRefund({ paymentGateway: 'momo' })
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-err-2',
          body: { reason: 'Test reason', acknowledgeSandboxSimulation: true, expectedProviderStatus: 'PROCESSING' },
        })
      ).rejects.toThrow(expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }))
    })

    it('RG-02: rejects refund if vnpayResponse is missing entirely (dispatch-only)', async () => {
      const service = setupMockTxWithRefund({
        providerPayload: {
          vnpayDispatch: { vnp_Command: 'refund' },
          // No vnpayResponse!
        },
      })
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-no-resp',
          body: { reason: 'Test reason', acknowledgeSandboxSimulation: true, expectedProviderStatus: 'PROCESSING' },
        })
      ).rejects.toThrow(expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }))
    })

    it('RG-02: rejects refund if vnp_ResponseCode is not 00 (e.g. 99 error)', async () => {
      const service = setupMockTxWithRefund({
        providerPayload: {
          vnpayResponse: { vnp_ResponseCode: '99', vnp_TransactionStatus: '05' },
        },
      })
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-err-code-99',
          body: { reason: 'Test reason', acknowledgeSandboxSimulation: true, expectedProviderStatus: 'PROCESSING' },
        })
      ).rejects.toThrow(expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }))
    })

    it('RG-02: rejects refund if vnp_TransactionStatus is 01 (pending payment, not refund processing)', async () => {
      const service = setupMockTxWithRefund({
        providerPayload: {
          vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '01' },
        },
      })
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-status-01',
          body: { reason: 'Test reason', acknowledgeSandboxSimulation: true, expectedProviderStatus: 'PROCESSING' },
        })
      ).rejects.toThrow(expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }))
    })

    it('RG-02: rejects refund if provider status is 02 (FAILED)', async () => {
      const service = setupMockTxWithRefund({
        providerPayload: {
          vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '02' }, // FAILED
        },
      })
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-err-vnpay',
          body: { reason: 'Test reason', acknowledgeSandboxSimulation: true, expectedProviderStatus: 'PROCESSING' },
        })
      ).rejects.toThrow(expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }))
    })

    it('MERGE-03: rejects refund if linked item belongs to foreign settlement', async () => {
      const service = setupMockTxWithRefund({}, { settlementId: randomUUID() }) // Foreign settlement
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-err-foreign',
          body: { reason: 'Test reason', acknowledgeSandboxSimulation: true, expectedProviderStatus: 'PROCESSING' },
        })
      ).rejects.toThrow(expect.objectContaining({ code: P.REFUND_SOURCE_INVALID }))
    })

    it('MERGE-03: rejects refund if item is not in REFUND_PENDING status', async () => {
      const service = setupMockTxWithRefund({}, { status: DepositItemStatus.SETTLED })
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-err-status',
          body: { reason: 'Test reason', acknowledgeSandboxSimulation: true, expectedProviderStatus: 'PROCESSING' },
        })
      ).rejects.toThrow(expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }))
    })

    it('MERGE-03: rejects refund if sum of item refund amounts mismatches refund amount', async () => {
      const service = setupMockTxWithRefund({ amount: new Prisma.Decimal(500000) }, { refundAmount: new Prisma.Decimal(400000) })
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-err-amount',
          body: { reason: 'Test reason', acknowledgeSandboxSimulation: true, expectedProviderStatus: 'PROCESSING' },
        })
      ).rejects.toThrow(expect.objectContaining({ code: P.SANDBOX_SIMULATION_INVALID_REFUND }))
    })

    it('rejects simulation on version mismatch (VERSION_CONFLICT)', async () => {
      const service = setupMockTxWithRefund({ version: 2 })
      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: adminId,
          idempotencyKey: 'idemp-err-7',
          body: {
            reason: 'Test reason',
            expectedVersion: 1, // Mismatches current version 2
            acknowledgeSandboxSimulation: true,
            expectedProviderStatus: 'PROCESSING',
          },
        })
      ).rejects.toThrow(expect.objectContaining({ code: 'VERSION_CONFLICT' }))
    })
  })

  // =========================================================================
  // SCENARIO 8: Grouped Refund Items & Precision Handling
  // =========================================================================
  describe('8. Grouped Refund Items & Precision Handling', () => {
    it('correctly settles multiple deposit settlement items grouped under a single refund with exact VND amounts', async () => {
      const refundId = randomUUID()
      const orderId = randomUUID()
      const settlementId = randomUUID()
      const item1Id = randomUUID()
      const item2Id = randomUUID()
      const now = new Date()

      const item1 = {
        id: item1Id,
        settlementId,
        depositAmount: new Prisma.Decimal(300000),
        refundAmount: new Prisma.Decimal(300000),
        deductionAmount: new Prisma.Decimal(0),
        status: DepositItemStatus.REFUND_PENDING,
        decisionSnapshot: {},
        version: 1,
      }
      const item2 = {
        id: item2Id,
        settlementId,
        depositAmount: new Prisma.Decimal(480000),
        refundAmount: new Prisma.Decimal(480000),
        deductionAmount: new Prisma.Decimal(0),
        status: DepositItemStatus.REFUND_PENDING,
        decisionSnapshot: {},
        version: 1,
      }

      const settlement = {
        id: settlementId,
        orderId,
        totalDeposit: new Prisma.Decimal(780000),
        totalDeduction: new Prisma.Decimal(0),
        refundAmount: new Prisma.Decimal(0),
        status: DepositSettlementStatus.REFUND_PENDING,
        depositSettlementItemsViaSettlementId: [item1, item2],
        version: 1,
      }

      const refundRecord: any = {
        id: refundId,
        purpose: 'DEPOSIT',
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        status: 'PROCESSING',
        amount: new Prisma.Decimal(780000), // 300k + 480k
        currency: 'VND',
        version: 1,
        rentalOrderId: orderId,
        depositSettlementId: settlementId,
        depositRefundItems: [
          { depositSettlementItemId: item1Id },
          { depositSettlementItemId: item2Id },
        ],
        providerPayload: {
          vnpayDispatch: { vnp_Command: 'refund' },
          vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '05' },
        },
      }

      const mockTx: any = {
        idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
        $queryRaw: jest.fn().mockResolvedValue([{ now }]),
        refund: {
          findUnique: jest.fn().mockResolvedValue(refundRecord),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refundRecord),
          update: jest.fn().mockResolvedValue({}),
        },
        depositSettlementItem: {
          findMany: jest.fn().mockImplementation(({ where }) => {
            if (where.id?.in) return Promise.resolve([item1, item2])
            return Promise.resolve([item1, item2])
          }),
          update: jest.fn().mockImplementation(({ where, data }) => {
            const target = where.id === item1Id ? item1 : item2
            Object.assign(target, data)
            return Promise.resolve(target)
          }),
        },
        depositSettlement: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(settlement),
          update: jest.fn().mockResolvedValue({}),
        },
        rentalOrder: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: orderId,
            status: RentalOrderStatus.COMPLETED,
            financialStatus: RentalFinancialStatus.SETTLED,
            policySnapshot: {},
          }),
          findUnique: jest.fn().mockResolvedValue({
            id: orderId,
            status: RentalOrderStatus.COMPLETED,
            financialStatus: RentalFinancialStatus.SETTLED,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        rentalExceptionCase: { findFirst: jest.fn().mockResolvedValue(null) },
        mockPaymentOperation: { upsert: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        paymentOutboxEvent: { create: jest.fn().mockResolvedValue({}) },
      }

      const service = new SandboxRefundSimulationService({
        $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
      } as any)

      const res = await service.simulateRefundSettlement({
        refundId,
        actorUserId: randomUUID(),
        idempotencyKey: 'idemp-grouped-001',
        body: {
          reason: 'Grouped refund test simulation',
          acknowledgeSandboxSimulation: true,
          expectedProviderStatus: 'PROCESSING',
        },
      })

      expect(res.simulatedAmount).toBe('780000')
      expect(item1.status).toBe(DepositItemStatus.SETTLED)
      expect(item2.status).toBe(DepositItemStatus.SETTLED)
    })
  })

  // =========================================================================
  // SCENARIO 9: Domain Gate Preservation (Physical Assets & Custody)
  // =========================================================================
  describe('9. Domain Gate Preservation (Incomplete Custody Blocks Order Closure)', () => {
    it('sets financialStatus to SETTLED but prevents RentalOrder from completing when physical custody transfer is not terminal', async () => {
      const refundId = randomUUID()
      const orderId = randomUUID()
      const settlementId = randomUUID()
      const itemId = randomUUID()
      const now = new Date()

      const item = {
        id: itemId,
        settlementId,
        depositAmount: new Prisma.Decimal(500000),
        refundAmount: new Prisma.Decimal(500000),
        deductionAmount: new Prisma.Decimal(0),
        status: DepositItemStatus.REFUND_PENDING,
        version: 1,
      }

      const settlement = {
        id: settlementId,
        orderId,
        totalDeposit: new Prisma.Decimal(500000),
        totalDeduction: new Prisma.Decimal(0),
        refundAmount: new Prisma.Decimal(0),
        status: DepositSettlementStatus.REFUND_PENDING,
        depositSettlementItemsViaSettlementId: [item],
        version: 1,
      }

      const rentalOrder: any = {
        id: orderId,
        status: RentalOrderStatus.RETURN_PROCESSING,
        financialStatus: RentalFinancialStatus.DEPOSIT_HELD,
        policySnapshot: {},
        rentalOrderLinesViaOrderId: [],
        depositSettlementViaOrderId: { depositSettlementItemsViaSettlementId: [item] },
        rentalExceptionCasesViaOrderId: [],
        deliveryTasksViaOrderId: [
          { taskType: DeliveryTaskType.RETURN, status: DeliveryTaskStatus.SCHEDULED }, // NOT INVENTORY_RECEIVED!
        ],
        packageViaOrderId: { status: PackageStatus.HANDED_OVER }, // NOT RETURNED_TO_INVENTORY!
        returnCustodyTransfersViaOrderId: [
          { status: 'PENDING_RECEIPT' }, // NOT RECEIVED!
        ],
        rentalReturnSessionsViaOrderId: [],
        version: 1,
      }

      const refundRecord: any = {
        id: refundId,
        purpose: 'DEPOSIT',
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        status: 'PROCESSING',
        amount: new Prisma.Decimal(500000),
        currency: 'VND',
        version: 1,
        rentalOrderId: orderId,
        depositSettlementId: settlementId,
        depositSettlementItemId: itemId,
        depositRefundItems: [],
        providerPayload: {
          vnpayDispatch: { vnp_Command: 'refund' },
          vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '05' },
        },
      }

      const mockTx: any = {
        idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
        $queryRaw: jest.fn().mockResolvedValue([{ now }]),
        refund: {
          findUnique: jest.fn().mockResolvedValue(refundRecord),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refundRecord),
          update: jest.fn().mockResolvedValue({}),
        },
        depositSettlementItem: {
          findMany: jest.fn().mockResolvedValue([item]),
          update: jest.fn().mockImplementation(({ data }) => Object.assign(item, data)),
        },
        depositSettlement: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(settlement),
          update: jest.fn().mockResolvedValue({}),
        },
        rentalOrder: {
          findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve(rentalOrder)),
          findUnique: jest.fn().mockImplementation(() => Promise.resolve(rentalOrder)),
          update: jest.fn().mockImplementation(({ data }) => Object.assign(rentalOrder, data)),
        },
        rentalExceptionCase: { findFirst: jest.fn().mockResolvedValue(null) },
        mockPaymentOperation: { upsert: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        paymentOutboxEvent: { create: jest.fn().mockResolvedValue({}) },
      }

      const service = new SandboxRefundSimulationService({
        $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
      } as any)

      const res = await service.simulateRefundSettlement({
        refundId,
        actorUserId: randomUUID(),
        idempotencyKey: 'idemp-gate-001',
        body: {
          reason: 'Physical gate verification test',
          acknowledgeSandboxSimulation: true,
          expectedProviderStatus: 'PROCESSING',
        },
      })

      // Order must NOT complete because physical return tasks and custody are incomplete!
      expect(res.financialStatus).toBe(RentalFinancialStatus.SETTLED)
      expect(res.orderStatus).toBe(RentalOrderStatus.RETURN_PROCESSING)
      expect(res.completionMode).toBe('STANDARD') // NOT completed!
    })
  })

  // =========================================================================
  // SCENARIO 10: Real REFUND_SUCCEEDED Independent Path Untouched
  // =========================================================================
  describe('10. Real REFUND_SUCCEEDED Independent Path Untouched', () => {
    it('applies real verified provider refund event without simulation provenance or interference', async () => {
      const refundId = randomUUID()
      const paymentId = randomUUID()
      const now = new Date()

      const refundRecord: any = {
        id: refundId,
        paymentId,
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        merchantRefundRef: `refund:${refundId}`,
        amount: new Prisma.Decimal(500000),
        currency: 'VND',
        status: 'PROCESSING',
        reconcileStatus: 'SCHEDULED',
        providerPayload: null,
        payment: {
          id: paymentId,
          invoiceId: randomUUID(),
          merchantRequestRef: `pay-${paymentId}`,
          currency: 'VND',
          amount: new Prisma.Decimal(500000),
          transactionRef: 'PAY-TRX-1234',
          application: { status: 'APPLIED' },
        },
      }

      const mockTx: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ now }]),
        refund: {
          findFirst: jest.fn().mockImplementation(({ where }) => where?.id?.not ? Promise.resolve(null) : Promise.resolve(refundRecord)),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refundRecord),
          update: jest.fn().mockImplementation(({ data }) => Object.assign(refundRecord, data)),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(500000) } }),
        },
        invoice: { update: jest.fn().mockResolvedValue({}) },
        rentalOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        paymentOutboxEvent: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }

      const refundsService = new RefundsService(
        { $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)) } as any,
        {} as any
      )

      await refundsService.applyEvent({
        gateway: 'vnpay',
        environment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        merchantRefundRef: `refund:${refundId}`,
        merchantRequestRef: `pay-${paymentId}`,
        transactionRef: 'PAY-TRX-1234',
        amount: '500000',
        currency: 'VND',
        status: 'SUCCEEDED',
        refundTransactionRef: 'REAL-VNP-REFUND-9999',
        occurredAt: now.toISOString(),
      })

      expect(refundRecord.status).toBe('SUCCEEDED')
      expect(refundRecord.refundTransactionRef).toBe('REAL-VNP-REFUND-9999')
      expect(refundRecord.providerPayload).toBeNull() // Untouched standard flow
    })
  })

  // =========================================================================
  // SCENARIO 11: Late Real Provider Confirmation After Simulation (MERGE-04)
  // =========================================================================
  describe('11. Late Real Provider Confirmation After Simulation (MERGE-04)', () => {
    it('records REAL_PROVIDER_REFUND_CONFIRMED_AFTER_SIMULATION audit when late provider SUCCEEDED arrives', async () => {
      const refundId = randomUUID()
      const paymentId = randomUUID()
      const now = new Date()

      const simulationProvenance = {
        simulationId: 'sim-abc-123',
        simulatedAt: '2026-10-23T10:00:00Z',
        actorAdminId: 'admin-001',
      }

      const refundRecord: any = {
        id: refundId,
        paymentId,
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        merchantRefundRef: `refund:${refundId}`,
        amount: new Prisma.Decimal(500000),
        currency: 'VND',
        status: 'PROCESSING', // Remains PROCESSING in simulation!
        reconcileStatus: 'SCHEDULED',
        providerPayload: { sandboxSimulation: simulationProvenance },
        payment: {
          id: paymentId,
          invoiceId: randomUUID(),
          merchantRequestRef: `pay-${paymentId}`,
          currency: 'VND',
          amount: new Prisma.Decimal(500000),
          transactionRef: 'PAY-TRX-5678',
          application: { status: 'APPLIED' },
        },
      }

      const auditEntries: any[] = []
      const mockTx: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ now }]),
        refund: {
          findFirst: jest.fn().mockImplementation(({ where }) => where?.id?.not ? Promise.resolve(null) : Promise.resolve(refundRecord)),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refundRecord),
          update: jest.fn().mockImplementation(({ data }) => Object.assign(refundRecord, data)),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(500000) } }),
        },
        invoice: { update: jest.fn().mockResolvedValue({}) },
        rentalOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        paymentOutboxEvent: { create: jest.fn().mockResolvedValue({}) },
        auditLog: {
          create: jest.fn().mockImplementation(({ data }) => {
            auditEntries.push(data)
            return Promise.resolve(data)
          }),
        },
      }

      const refundsService = new RefundsService(
        { $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)) } as any,
        {} as any
      )

      await refundsService.applyEvent({
        gateway: 'vnpay',
        environment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        merchantRefundRef: `refund:${refundId}`,
        merchantRequestRef: `pay-${paymentId}`,
        transactionRef: 'PAY-TRX-5678',
        amount: '500000',
        currency: 'VND',
        status: 'SUCCEEDED',
        refundTransactionRef: 'LATE-REAL-VNP-REF-8888',
        occurredAt: now.toISOString(),
      })

      expect(refundRecord.status).toBe('SUCCEEDED')
      expect(refundRecord.refundTransactionRef).toBe('LATE-REAL-VNP-REF-8888')

      const simAudit = auditEntries.find(
        (a) => a.action === 'REAL_PROVIDER_REFUND_CONFIRMED_AFTER_SIMULATION'
      )
      expect(simAudit).toBeDefined()
      expect(simAudit.newValues.refundTransactionRef).toBe('LATE-REAL-VNP-REF-8888')
      expect(simAudit.newValues.simulationProvenance).toEqual(simulationProvenance)
    })

    it('MERGE-04: flags NEEDS_REVIEW and records discrepancy when late provider FAILED arrives after simulation', async () => {
      const refundId = randomUUID()
      const paymentId = randomUUID()
      const now = new Date()

      const simulationProvenance = {
        simulationId: 'sim-fail-case',
        simulatedAt: '2026-10-23T10:00:00Z',
        actorAdminId: 'admin-001',
      }

      const refundRecord: any = {
        id: refundId,
        paymentId,
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        merchantRefundRef: `refund:${refundId}`,
        amount: new Prisma.Decimal(500000),
        currency: 'VND',
        status: 'PROCESSING',
        reconcileStatus: 'SCHEDULED',
        providerPayload: { sandboxSimulation: simulationProvenance },
        payment: {
          id: paymentId,
          invoiceId: randomUUID(),
          merchantRequestRef: `pay-${paymentId}`,
          currency: 'VND',
          amount: new Prisma.Decimal(500000),
          transactionRef: 'PAY-TRX-9999',
          application: { status: 'APPLIED' },
        },
      }

      const auditEntries: any[] = []
      const mockTx: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ now }]),
        refund: {
          findFirst: jest.fn().mockImplementation(({ where }) => where?.id?.not ? Promise.resolve(null) : Promise.resolve(refundRecord)),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refundRecord),
          update: jest.fn().mockImplementation(({ data }) => Object.assign(refundRecord, data)),
        },
        invoice: { update: jest.fn().mockResolvedValue({}) },
        rentalOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        paymentOutboxEvent: { create: jest.fn().mockResolvedValue({}) },
        auditLog: {
          create: jest.fn().mockImplementation(({ data }) => {
            auditEntries.push(data)
            return Promise.resolve(data)
          }),
        },
      }

      const refundsService = new RefundsService(
        { $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)) } as any,
        {} as any
      )

      await refundsService.applyEvent({
        gateway: 'vnpay',
        environment: 'SANDBOX',
        merchantAccountKey: 'TEST1234',
        merchantRefundRef: `refund:${refundId}`,
        merchantRequestRef: `pay-${paymentId}`,
        transactionRef: 'PAY-TRX-9999',
        amount: '500000',
        currency: 'VND',
        status: 'FAILED',
        occurredAt: now.toISOString(),
      })

      expect(refundRecord.status).toBe('FAILED')
      expect(refundRecord.reconcileStatus).toBe('NEEDS_REVIEW')
      expect(refundRecord.lastErrorCode).toBe('LATE_PROVIDER_REFUND_FAILED_AFTER_SIMULATION')

      const failAudit = auditEntries.find(
        (a) => a.action === 'REAL_PROVIDER_REFUND_FAILED_AFTER_SIMULATION'
      )
      expect(failAudit).toBeDefined()

      // Assert read model surfaces discrepancy
      const summary = refundSummary(refundRecord)
      expect(summary.discrepancy).toBe('SIMULATION_DIVERGED_FROM_PROVIDER_FAILURE')
    })
  })

  // =========================================================================
  // SCENARIO 12: VnpayPaymentProvider Keeps 05/06 Strictly Mapped to PROCESSING
  // =========================================================================
  describe('12. VnpayPaymentProvider Keeps 05/06 Strictly Mapped to PROCESSING', () => {
    it('ensures VnpayPaymentProvider maps 05/06 to PROCESSING and never converts to SUCCEEDED', async () => {
      const provider = new VnpayPaymentProvider({} as any)

      // Test webhook with transactionStatus 05
      const query05: Record<string, string> = {
        vnp_TmnCode: 'TEST1234',
        vnp_Amount: '50000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '05',
        vnp_TxnRef: 'a'.repeat(32),
      }
      query05.vnp_SecureHash = vnpaySignature(query05, vnpaySecret)

      const res05 = await provider.verifyWebhook(Buffer.from(JSON.stringify(query05)))
      expect(res05).not.toBeNull()
      if (res05) {
        expect(res05.status).toBe('PROCESSING') // NOT SUCCEEDED!
      }

      // Test webhook with transactionStatus 06
      const query06: Record<string, string> = {
        vnp_TmnCode: 'TEST1234',
        vnp_Amount: '50000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '06',
        vnp_TxnRef: 'b'.repeat(32),
      }
      query06.vnp_SecureHash = vnpaySignature(query06, vnpaySecret)

      const res06 = await provider.verifyWebhook(Buffer.from(JSON.stringify(query06)))
      expect(res06).not.toBeNull()
      if (res06) {
        expect(res06.status).toBe('PROCESSING') // NOT SUCCEEDED!
      }
    })
  })

  // =========================================================================
  // SCENARIO 13: Transaction Rollback on Failure
  // =========================================================================
  describe('13. Transaction Rollback on Failure', () => {
    it('rolls back database mutations entirely if any transaction step fails', async () => {
      const refundId = randomUUID()
      const settlementId = randomUUID()
      const orderId = randomUUID()
      const itemId = randomUUID()

      const item = {
        id: itemId,
        settlementId,
        depositAmount: new Prisma.Decimal(500000),
        refundAmount: new Prisma.Decimal(500000),
        deductionAmount: new Prisma.Decimal(0),
        status: DepositItemStatus.REFUND_PENDING,
      }

      const refundRecord: any = {
        id: refundId,
        purpose: 'DEPOSIT',
        paymentGateway: 'vnpay',
        providerEnvironment: 'SANDBOX',
        status: 'PROCESSING',
        amount: new Prisma.Decimal(500000),
        currency: 'VND',
        version: 1,
        rentalOrderId: orderId,
        depositSettlementId: settlementId,
        depositSettlementItemId: itemId,
        depositRefundItems: [],
        providerPayload: {
          vnpayDispatch: { vnp_Command: 'refund' },
          vnpayResponse: { vnp_ResponseCode: '00', vnp_TransactionStatus: '05' },
        },
      }

      const mockTx: any = {
        idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null) },
        $queryRaw: jest.fn().mockResolvedValue([{ now: new Date() }]),
        refund: {
          findUnique: jest.fn().mockResolvedValue(refundRecord),
          findUniqueOrThrow: jest.fn().mockResolvedValue(refundRecord),
          update: jest.fn().mockResolvedValue({}),
        },
        depositSettlementItem: { findMany: jest.fn().mockResolvedValue([item]) },
        rentalExceptionCase: { findFirst: jest.fn().mockResolvedValue(null) },
        mockPaymentOperation: { upsert: jest.fn().mockResolvedValue({}) },
        auditLog: {
          create: jest.fn().mockRejectedValue(new Error('DATABASE_CONNECTION_LOST')),
        },
      }

      const service = new SandboxRefundSimulationService({
        $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
      } as any)

      await expect(
        service.simulateRefundSettlement({
          refundId,
          actorUserId: randomUUID(),
          idempotencyKey: 'idemp-rollback-001',
          body: {
            reason: 'Testing transaction rollback',
            acknowledgeSandboxSimulation: true,
            expectedProviderStatus: 'PROCESSING',
          },
        })
      ).rejects.toThrow('DATABASE_CONNECTION_LOST')
    })
  })

  // =========================================================================
  // SCENARIO 14: Clear Simulation Notices & Warnings on Read Models (MERGE-07)
  // =========================================================================
  describe('14. Clear Simulation Notices & Warnings on Read Models (MERGE-07)', () => {
    it('exposes simulationStatus: SIMULATED and explicit warnings in refundSummary()', () => {
      const simulatedRefund: any = {
        id: randomUUID(),
        paymentId: randomUUID(),
        purpose: 'DEPOSIT',
        reasonCode: 'RETURN_SETTLEMENT',
        amount: new Prisma.Decimal(780000),
        currency: 'VND',
        status: 'PROCESSING',
        refundedAt: null,
        reconcileStatus: 'SCHEDULED',
        providerPayload: {
          sandboxSimulation: {
            simulationId: 'sim-999',
            settlementMode: 'SANDBOX_SIMULATED',
          },
        },
      }

      const summary = refundSummary(simulatedRefund)
      expect(summary.simulationStatus).toBe('SIMULATED')
      expect(summary.settlementMode).toBe('SANDBOX_SIMULATED')
      expect(summary.warnings).toEqual(['TEST_ONLY', 'NO_REAL_MONEY_RETURNED'])
      expect(summary.simulationNotice).toContain('Hoàn cọc mô phỏng')
      expect(summary.simulationNotice).toContain('Không phải tiền đã về tài khoản khách')
    })

    it('MERGE-07: getDeposit() read model strictly separates financialTruth from simulationMetrics', async () => {
      const settlementId = randomUUID()
      const orderId = randomUUID()
      const actorUserId = randomUUID()
      const mockPrisma: any = {
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: orderId,
            userId: actorUserId,
            recipientSnapshot: null,
            depositSettlementViaOrderId: {
              id: settlementId,
              depositSettlementItemsViaSettlementId: [
                {
                  id: 'item-sim-1',
                  unitId: 'unit-1',
                  depositAmount: new Prisma.Decimal(780000),
                  deductionAmount: new Prisma.Decimal(0),
                  refundAmount: new Prisma.Decimal(780000),
                  status: DepositItemStatus.SETTLED,
                  decisionSnapshot: {
                    settlementMode: 'SANDBOX_SIMULATED',
                    simulationProvenance: { notice: 'Simulation Notice' },
                  },
                  unit: { id: 'unit-1', assetCode: 'TENT-001' },
                  inspection: { outcome: ReturnInspectionOutcome.NORMAL },
                  depositRefundAllocations: [],
                  refundViaDepositSettlementItemId: {
                    id: 'refund-vnp-1',
                    status: 'PROCESSING', // Raw truth: VNPay still processing!
                    amount: new Prisma.Decimal(780000),
                    currency: 'VND',
                  },
                  reason: null,
                },
              ],
            },
          }),
        },
        returnInspectionTask: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      }

      const adapter = new PrismaRentalReturnAdapter(mockPrisma)
      const depositDto = await adapter.getDeposit({ orderId, actorUserId })

      expect(depositDto.settlementMode).toBe('SANDBOX_SIMULATED')
      // Financial truth: Provider has NOT refunded real money yet
      expect(depositDto.financialTruth).toBeDefined()
      expect(depositDto.financialTruth.providerRefundedAmount).toBe(0)
      expect(depositDto.financialTruth.providerRefundPendingAmount).toBe(780000)
      expect(depositDto.financialTruth.realMoneyReturned).toBe(false)

      // Simulation metric: Demo settled
      expect(depositDto.simulatedSettledAmount).toBe(780000)
      expect(depositDto.unconfirmedSimulatedAmount).toBe(780000)
      expect(depositDto.effectiveHeldAmount).toBe(0)
      expect(depositDto.warnings).toContain('NO_REAL_MONEY_RETURNED')
    })

    it('RG-03: getDeposit() prevents double-subtraction when late provider SUCCEEDED arrives on simulated item', async () => {
      const settlementId = randomUUID()
      const orderId = randomUUID()
      const actorUserId = randomUUID()
      const mockPrisma: any = {
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: orderId,
            userId: actorUserId,
            recipientSnapshot: null,
            depositSettlementViaOrderId: {
              id: settlementId,
              depositSettlementItemsViaSettlementId: [
                {
                  id: 'item-sim-1',
                  unitId: 'unit-1',
                  depositAmount: new Prisma.Decimal(780000),
                  deductionAmount: new Prisma.Decimal(0),
                  refundAmount: new Prisma.Decimal(780000),
                  status: DepositItemStatus.SETTLED,
                  decisionSnapshot: {
                    settlementMode: 'SANDBOX_SIMULATED',
                  },
                  unit: { id: 'unit-1', assetCode: 'TENT-001' },
                  inspection: { outcome: ReturnInspectionOutcome.NORMAL },
                  depositRefundAllocations: [],
                  refundViaDepositSettlementItemId: {
                    id: 'refund-vnp-1',
                    status: 'SUCCEEDED', // Real provider SUCCEEDED arrived late!
                    amount: new Prisma.Decimal(780000),
                    currency: 'VND',
                  },
                  reason: null,
                },
              ],
            },
          }),
        },
        returnInspectionTask: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      }

      const adapter = new PrismaRentalReturnAdapter(mockPrisma)
      const depositDto = await adapter.getDeposit({ orderId, actorUserId })

      // Financial truth: Real provider SUCCEEDED!
      expect(depositDto.financialTruth.providerRefundedAmount).toBe(780000)
      expect(depositDto.financialTruth.providerRefundPendingAmount).toBe(0)
      expect(depositDto.financialTruth.realMoneyReturned).toBe(true)

      // RG-03 Invariant: unconfirmedSimulatedAmount is 0 (since provider already confirmed)
      expect(depositDto.unconfirmedSimulatedAmount).toBe(0)
      // effectiveHeldAmount: 780000 - 780000 - 0 = 0 (NO double deduction!)
      expect(depositDto.effectiveHeldAmount).toBe(0)
      expect(depositDto.heldAmount).toBe(0)
    })

    it('RG-03: getDeposit() accurately calculates partial settlement with 1M deposit, 300k confirmed, 700k pending', async () => {
      const settlementId = randomUUID()
      const orderId = randomUUID()
      const actorUserId = randomUUID()
      const mockPrisma: any = {
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: orderId,
            userId: actorUserId,
            recipientSnapshot: null,
            depositSettlementViaOrderId: {
              id: settlementId,
              depositSettlementItemsViaSettlementId: [
                {
                  id: 'item-1',
                  unitId: 'unit-1',
                  depositAmount: new Prisma.Decimal(300000),
                  deductionAmount: new Prisma.Decimal(0),
                  refundAmount: new Prisma.Decimal(300000),
                  status: DepositItemStatus.SETTLED,
                  decisionSnapshot: { settlementMode: 'SANDBOX_SIMULATED' },
                  unit: { id: 'unit-1', assetCode: 'GEAR-01' },
                  inspection: { outcome: ReturnInspectionOutcome.NORMAL },
                  depositRefundAllocations: [],
                  refundViaDepositSettlementItemId: {
                    id: 'refund-1',
                    status: 'SUCCEEDED', // Confirmed late
                    amount: new Prisma.Decimal(300000),
                    currency: 'VND',
                  },
                  reason: null,
                },
                {
                  id: 'item-2',
                  unitId: 'unit-2',
                  depositAmount: new Prisma.Decimal(700000),
                  deductionAmount: new Prisma.Decimal(0),
                  refundAmount: new Prisma.Decimal(700000),
                  status: DepositItemStatus.REFUND_PENDING,
                  decisionSnapshot: {},
                  unit: { id: 'unit-2', assetCode: 'GEAR-02' },
                  inspection: { outcome: ReturnInspectionOutcome.NORMAL },
                  depositRefundAllocations: [],
                  refundViaDepositSettlementItemId: {
                    id: 'refund-2',
                    status: 'PROCESSING', // Still unconfirmed
                    amount: new Prisma.Decimal(700000),
                    currency: 'VND',
                  },
                  reason: null,
                },
              ],
            },
          }),
        },
        returnInspectionTask: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      }

      const adapter = new PrismaRentalReturnAdapter(mockPrisma)
      const depositDto = await adapter.getDeposit({ orderId, actorUserId })

      // Collected: 1,000,000. Refunded: 300,000.
      expect(depositDto.collectedAmount).toBe(1000000)
      expect(depositDto.refundedAmount).toBe(300000)
      expect(depositDto.refundPendingAmount).toBe(700000)

      // unconfirmedSimulatedAmount is 0 for item 1 (SUCCEEDED) and 0 for item 2 (standard, not simulated)
      expect(depositDto.unconfirmedSimulatedAmount).toBe(0)
      // effectiveHeldAmount is exactly 700,000 (NOT 400,000)!
      expect(depositDto.effectiveHeldAmount).toBe(700000)
      expect(depositDto.heldAmount).toBe(700000)
    })
  })

  // =========================================================================
  // SCENARIO 15: Flag Toggle Safety (Dynamic Kill-Switch)
  // =========================================================================
  describe('15. Flag Toggle Safety (Dynamic Kill-Switch)', () => {
    it('immediately halts simulation capability when flag is toggled to false', () => {
      const service = new SandboxRefundSimulationService({} as any)

      // 1. When flag is true -> passes
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED = 'true'
      expect(() => service.assertEnvironmentSafe()).not.toThrow()

      // 2. Kill switch triggered -> immediately fails closed with 403
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED = 'false'
      expect(() => service.assertEnvironmentSafe()).toThrow(
        expect.objectContaining({ code: P.SANDBOX_SIMULATION_DISABLED })
      )
    })
  })
})