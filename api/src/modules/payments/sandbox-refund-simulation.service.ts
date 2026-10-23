import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import {
  DepositItemStatus,
  DepositSettlementOutcome,
  DepositSettlementStatus,
  Prisma,
  RentalFinancialStatus,
  RentalOrderStatus,
} from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import envconfig from '../../shared/config'
import { AppError } from '../../shared/errors'
import { PAYMENT_ERROR_CODES as P } from '../../shared/errors/codes/payment.error-codes'
import { paymentHash } from './payment-utils'
import { updateSettlementProgress } from '../rental/payments/settlement-progress'
import { tryCompleteOrder } from '../rental/returns/infrastructure/adapters/prisma-rental-return.adapter'
import type {
  SandboxSimulateRefundBodyDto,
  SandboxSimulateRefundResponseDto,
} from './dtos/sandbox-refund-simulation.dto'

@Injectable()
export class SandboxRefundSimulationService {
  private readonly logger = new Logger(SandboxRefundSimulationService.name)

  constructor(private readonly db: PrismaService) {}

  /**
   * MERGE-01 Hardening: Strict fail-closed environment & database guard.
   * Simulation is NEVER allowed in production or against shared/cloud databases.
   * Disallows unverified test DB env overrides when the main connection is a shared cloud database.
   */
  assertEnvironmentSafe(): void {
    if (process.env.NODE_ENV === 'production') {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_ENV_UNSAFE, {
        message: 'Sandbox simulation is strictly forbidden in production environment',
      })
    }

    const isEnabled =
      process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED === 'true' ||
      (!process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED &&
        envconfig.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED === true)
    if (!isEnabled) {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_DISABLED, {
        message: 'Sandbox refund simulation is disabled (PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED=false)',
      })
    }

    const env = process.env.PAYMENT_PROVIDER_ENVIRONMENT ?? envconfig.PAYMENT_PROVIDER_ENVIRONMENT
    if (env !== 'SANDBOX') {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_ENV_UNSAFE, {
        message: 'Payment provider environment must be configured as SANDBOX for simulation',
      })
    }

    // Fail-closed verification of DATABASE_URL:
    // Disallow shared NeonDB, AWS pooler, RDS, Supabase, Azure, GCP, or any non-local database
    const dbUrl = process.env.DATABASE_URL || ''
    if (!dbUrl) {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_ENV_UNSAFE, {
        message: 'No DATABASE_URL configured. Simulation cannot be verified safe.',
      })
    }

    const isSharedHost = /neon\.tech|pooler|\.aws\.|\.azure\.|\.supabase\.|cloudsql|prod/i.test(dbUrl)
    if (isSharedHost) {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_ENV_UNSAFE, {
        message:
          'Shared/cloud database (e.g. NeonDB) detected in DATABASE_URL. Simulation requires an isolated local test database.',
      })
    }

    const isExplicitLocal = /localhost|127\.0\.0\.1|::1|host\.docker\.internal/i.test(dbUrl)
    if (!isExplicitLocal) {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_ENV_UNSAFE, {
        message: 'Database host is not recognized as an isolated local instance. Simulation requires localhost/127.0.0.1.',
      })
    }
  }

  async simulateRefundSettlement(input: {
    refundId: string
    actorUserId: string
    idempotencyKey: string
    body: SandboxSimulateRefundBodyDto
  }): Promise<SandboxSimulateRefundResponseDto> {
    this.assertEnvironmentSafe()

    const { refundId, actorUserId, idempotencyKey, body } = input
    const scope = `admin-simulate-refund:${refundId}`
    const requestHash = paymentHash({ refundId, ...body })

    return this.db.$transaction(async (tx) => {
      // 1. Check idempotency record first
      const existingIdempotency = await tx.idempotencyRecord.findUnique({
        where: {
          scope_userId_idempotencyKey: {
            scope,
            userId: actorUserId,
            idempotencyKey,
          },
        },
      })

      if (existingIdempotency) {
        if (existingIdempotency.requestHash !== requestHash) {
          throw AppError.fromCode(P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        }
        if (existingIdempotency.responseBody) {
          return existingIdempotency.responseBody as unknown as SandboxSimulateRefundResponseDto
        }
      }

      // MERGE-06 Fix: Canonical lock order to eliminate deadlock risks
      // Order of acquisition:
      // 1) Read initial refund row to identify associated aggregates
      const initialRefund = await tx.refund.findUnique({
        where: { id: refundId },
        select: {
          id: true,
          rentalOrderId: true,
          depositSettlementId: true,
          paymentId: true,
        },
      })

      if (!initialRefund) {
        throw AppError.fromCode(P.PAYMENT_NOT_FOUND, {
          message: 'Lệnh hoàn tiền không tồn tại',
        })
      }

      if (!initialRefund.rentalOrderId || !initialRefund.depositSettlementId) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID, {
          message: 'Lệnh hoàn cọc không liên kết với DepositSettlement hoặc RentalOrder hợp lệ',
        })
      }

      const orderId = initialRefund.rentalOrderId
      const settlementId = initialRefund.depositSettlementId

      // 2) Lock hierarchy in canonical order:
      //    rental_orders -> deposit_settlements -> deposit_settlement_items -> refunds
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${orderId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlements WHERE id = ${settlementId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM deposit_settlement_items WHERE settlement_id = ${settlementId}::uuid ORDER BY id FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM refunds WHERE id = ${refundId}::uuid FOR UPDATE`

      // 3) Retrieve fresh refund record with relations under lock
      const refund = await tx.refund.findUniqueOrThrow({
        where: { id: refundId },
        include: {
          payment: true,
          depositSettlement: true,
          depositSettlementItem: true,
          depositRefundItems: true,
        },
      })

      // MERGE-05 Fix: Concurrent same-key idempotency race handling
      const existingPayload = refund.providerPayload as Prisma.JsonObject | null
      if (existingPayload && existingPayload.sandboxSimulation) {
        // Re-check if idempotency record was committed by a concurrent same-key request
        const concurrentIdempotency = await tx.idempotencyRecord.findUnique({
          where: {
            scope_userId_idempotencyKey: {
              scope,
              userId: actorUserId,
              idempotencyKey,
            },
          },
        })
        if (concurrentIdempotency) {
          if (concurrentIdempotency.requestHash !== requestHash) {
            throw AppError.fromCode(P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
          }
          if (concurrentIdempotency.responseBody) {
            return concurrentIdempotency.responseBody as unknown as SandboxSimulateRefundResponseDto
          }
        }
        throw AppError.fromCode(P.SANDBOX_SIMULATION_ALREADY_SIMULATED, {
          message: 'Lệnh hoàn tiền này đã được mô phỏng trước đó',
        })
      }

      // Domain & gateway safety validations
      if (refund.purpose !== 'DEPOSIT') {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: 'Chỉ hỗ trợ mô phỏng hoàn cọc cho mục đích DEPOSIT',
        })
      }

      if (refund.paymentGateway !== 'vnpay' || refund.providerEnvironment !== 'SANDBOX') {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: 'Chỉ hỗ trợ mô phỏng hoàn tiền cho các giao dịch VNPay Sandbox',
        })
      }

      if (refund.status !== 'PROCESSING') {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: `Trạng thái hoàn tiền hiện tại là ${refund.status}, chỉ hỗ trợ mô phỏng khi đang ở PROCESSING (05/06)`,
        })
      }

      // MERGE-08 Fix: Server-side verification that refund has genuine VNPay 05/06 dispatch provenance
      const vnpayDispatch = existingPayload?.vnpayDispatch as Record<string, unknown> | undefined
      const vnpayResponse = existingPayload?.vnpayResponse as Record<string, unknown> | undefined
      const vnpayTxnStatus = (vnpayResponse?.vnp_TransactionStatus ??
        vnpayDispatch?.vnp_TransactionStatus) as string | undefined

      if (vnpayResponse && vnpayTxnStatus && !['01', '05', '06'].includes(vnpayTxnStatus)) {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: `Lệnh hoàn tiền có mã trạng thái VNPay ${vnpayTxnStatus}, không thuộc nhóm 05/06 PROCESSING`,
        })
      }

      // MERGE-05 Fix: Explicit expectedVersion number check
      if (typeof body.expectedVersion === 'number' && refund.version !== body.expectedVersion) {
        throw AppError.fromCode('VERSION_CONFLICT', {
          message: `Phiên bản hoàn tiền đã thay đổi (hiện tại: ${refund.version}, kỳ vọng: ${body.expectedVersion})`,
        })
      }

      // MERGE-03 Fix: Invariant verification of linked settlement items
      const itemIds =
        refund.depositRefundItems.length > 0
          ? refund.depositRefundItems.map((d) => d.depositSettlementItemId)
          : refund.depositSettlementItemId
            ? [refund.depositSettlementItemId]
            : []

      if (!itemIds.length) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID, {
          message: 'Không tìm thấy DepositSettlementItem liên kết với lệnh hoàn tiền',
        })
      }

      const items = await tx.depositSettlementItem.findMany({
        where: { id: { in: itemIds } },
        include: {
          inspection: true,
          assignment: true,
        },
      })

      if (items.length !== itemIds.length) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID, {
          message: 'Một số DepositSettlementItem liên kết không tồn tại trong hệ thống',
        })
      }

      for (const item of items) {
        if (item.settlementId !== settlementId) {
          throw AppError.fromCode(P.REFUND_SOURCE_INVALID, {
            message: `DepositSettlementItem ${item.id} không thuộc settlement ${settlementId}`,
          })
        }
        if (item.status !== DepositItemStatus.REFUND_PENDING) {
          throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
            message: `DepositSettlementItem ${item.id} có trạng thái ${item.status}, chỉ chấp nhận REFUND_PENDING`,
          })
        }
      }

      // Verify exact sum of item refund amounts matches refund.amount
      const sumRefundAmounts = items.reduce(
        (acc, i) => acc.plus(i.refundAmount ?? i.depositAmount.minus(i.deductionAmount)),
        new Prisma.Decimal(0),
      )
      if (!sumRefundAmounts.equals(refund.amount)) {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: `Tổng số tiền hoàn của các item (${sumRefundAmounts.toFixed()}) không khớp với số tiền hoàn của lệnh (${refund.amount.toFixed()})`,
        })
      }

      if (refund.currency !== 'VND') {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: 'Chỉ hỗ trợ tiền tệ VND cho mô phỏng hoàn cọc VNPay Sandbox',
        })
      }

      // Ensure no unresolved exception cases block this settlement
      const openCases = await tx.rentalExceptionCase.findFirst({
        where: {
          orderId,
          status: { in: ['OPEN', 'UNDER_REVIEW'] },
          OR: [
            { assignmentId: { in: items.map((i) => i.assignmentId) } },
            { inspectionId: { in: items.map((i) => i.inspectionId).filter(Boolean) as string[] } },
            { assignmentId: null, inspectionId: null },
          ],
        },
      })

      if (openCases) {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: 'Không thể mô phỏng hoàn cọc khi vẫn còn trường hợp khiếu nại (RentalExceptionCase) đang xử lý',
        })
      }

      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const simulationId = randomUUID()

      // Record Layer 1 (Untouched Provider Truth) + Simulation Provenance
      // Notice: refund.status stays PROCESSING! Raw provider truth is preserved without forgery.
      const simulationProvenance = {
        simulationId,
        simulatedAt: now.toISOString(),
        actorAdminId: actorUserId,
        reason: body.reason,
        testEvidenceRef: body.testEvidenceRef ?? null,
        providerStatusAtSimulation: refund.status,
        origin: 'ADMIN_SANDBOX_SIMULATION',
        settlementMode: 'SANDBOX_SIMULATED',
        notices: {
          userNotice: 'Hoàn cọc mô phỏng cho mục đích thử nghiệm — chưa có xác nhận hoàn tiền từ VNPay',
          adminNotice: 'Đã xử lý hoàn cọc (mô phỏng — VNPay Sandbox). Kết quả demo: SIMULATED (VNPay refund: PROCESSING)',
        },
      }

      const updatedPayload: Prisma.JsonObject = {
        ...(existingPayload || {}),
        sandboxSimulation: simulationProvenance,
      }

      await tx.refund.update({
        where: { id: refund.id },
        data: {
          providerPayload: updatedPayload,
          version: { increment: 1 },
        },
      })

      // Record Layer 2 Simulation Evidence in mock_payment_operations
      const operationId = paymentHash(['SANDBOX_SIMULATION', refund.id])
      await tx.mockPaymentOperation.upsert({
        where: { id: operationId },
        create: {
          id: operationId,
          kind: 'REFUND',
          requestHash,
          request: {
            refundId: refund.id,
            actorAdminId: actorUserId,
            reason: body.reason,
            testEvidenceRef: body.testEvidenceRef ?? null,
            simulatedAt: now.toISOString(),
          },
          result: {
            status: 'SIMULATED',
            settlementMode: 'SANDBOX_SIMULATED',
            provider: 'VNPAY_SANDBOX',
            providerStatus: refund.status,
            simulatedAmount: refund.amount.toFixed(0),
            currency: refund.currency,
          },
        },
        update: {},
      })

      // Record in audit_logs table
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: 'ADMIN_SANDBOX_REFUND_SIMULATED',
          entityType: 'Refund',
          entityId: refund.id,
          newValues: {
            refundId: refund.id,
            rentalOrderId: orderId,
            depositSettlementId: settlementId,
            amount: refund.amount.toFixed(0),
            currency: refund.currency,
            reason: body.reason,
            providerStatus: refund.status,
            settlementMode: 'SANDBOX_SIMULATED',
            notice: 'Hoàn cọc mô phỏng (VNPay Sandbox) - Không phải tiền đã về tài khoản khách',
          },
        },
      })

      // Update each linked DepositSettlementItem to SETTLED with simulation provenance
      for (const item of items) {
        await tx.depositSettlementItem.update({
          where: { id: item.id },
          data: {
            status: DepositItemStatus.SETTLED,
            settledAt: now,
            outcome: item.deductionAmount.greaterThan(0)
              ? DepositSettlementOutcome.PARTIAL_REFUND
              : DepositSettlementOutcome.FULL_REFUND,
            decisionSnapshot: {
              ...((item.decisionSnapshot as Prisma.JsonObject) || {}),
              settlementMode: 'SANDBOX_SIMULATED',
              simulationProvenance: {
                simulationId,
                simulatedAt: now.toISOString(),
                actorAdminId: actorUserId,
                origin: 'ADMIN_SANDBOX_SIMULATION',
                notice: 'Hoàn cọc mô phỏng (VNPay Sandbox) - Không phải tiền đã về tài khoản khách',
              },
            },
            version: { increment: 1 },
          },
        })
      }

      // Update DepositSettlement progress and status
      await updateSettlementProgress(tx, settlementId, now)
      const allSettlementItems = await tx.depositSettlementItem.findMany({
        where: { settlementId },
      })
      const allSettled =
        allSettlementItems.length > 0 &&
        allSettlementItems.every((i) => i.status === DepositItemStatus.SETTLED)

      if (allSettled) {
        await tx.depositSettlement.update({
          where: { id: settlementId },
          data: {
            status: DepositSettlementStatus.SETTLED,
            settledAt: now,
            version: { increment: 1 },
          },
        })
      }

      // MERGE-02 Fix: RentalOrder.policySnapshot MUST NOT be mutated!
      // In accordance with SOT BA04, policySnapshot is an immutable checkout contract.
      // We only update financialStatus to SETTLED without touching policySnapshot.
      if (allSettled) {
        await tx.rentalOrder.update({
          where: { id: orderId },
          data: {
            financialStatus: RentalFinancialStatus.SETTLED,
            version: { increment: 1 },
          },
        })
      }

      // Attempt domain order completion
      // (Respects all existing physical custody, inspection, delivery task positive gates)
      const completed = await tryCompleteOrder(tx, orderId, now)

      // Emit dedicated outbox event for simulation
      await tx.paymentOutboxEvent.create({
        data: {
          deduplicationKey: `sandbox-simulation:${refund.id}:v1`,
          eventType: 'SANDBOX_REFUND_SIMULATED',
          aggregateType: 'Refund',
          aggregateId: refund.id,
          payload: {
            schemaVersion: 1,
            simulationId,
            refundId: refund.id,
            paymentId: refund.paymentId,
            rentalOrderId: orderId,
            depositSettlementId: settlementId,
            amount: refund.amount.toFixed(0),
            currency: refund.currency,
            actorAdminId: actorUserId,
            settlementMode: 'SANDBOX_SIMULATED',
            provider: 'VNPAY_SANDBOX',
            providerStatus: refund.status,
            completed,
            warnings: [
              'TEST_ONLY',
              'NO_REAL_MONEY_RETURNED',
              'VNPay Sandbox refund remains in PROCESSING status; no real bank credit occurred.',
            ],
          },
        },
      })

      // Read latest order status
      const latestOrder = await tx.rentalOrder.findUniqueOrThrow({
        where: { id: orderId },
        select: { status: true, financialStatus: true },
      })

      const responseData: SandboxSimulateRefundResponseDto = {
        simulationId,
        refundId: refund.id,
        rentalOrderId: orderId,
        depositSettlementId: settlementId,
        provider: 'VNPAY_SANDBOX',
        providerRefundStatus: refund.status,
        simulationStatus: 'SIMULATED',
        simulatedAmount: refund.amount.toFixed(0),
        currency: refund.currency,
        orderStatus: latestOrder.status,
        financialStatus: latestOrder.financialStatus,
        completionMode:
          latestOrder.status === RentalOrderStatus.COMPLETED
            ? 'SANDBOX_SIMULATED'
            : 'STANDARD',
        settlementMode: 'SANDBOX_SIMULATED',
        simulatedAt: now.toISOString(),
        actorAdminId: actorUserId,
        reason: body.reason,
        warnings: [
          'TEST_ONLY',
          'NO_REAL_MONEY_RETURNED',
          'VNPay Sandbox refund remains in PROCESSING status; no real bank transfer occurred.',
        ],
        notices: {
          userNotice: 'Hoàn cọc mô phỏng cho mục đích thử nghiệm — chưa có xác nhận hoàn tiền từ VNPay',
          adminNotice: 'Đã xử lý hoàn cọc (mô phỏng — VNPay Sandbox). Kết quả demo: SIMULATED (VNPay refund: PROCESSING)',
        },
      }

      // Record in IdempotencyRecord table (with race safety)
      try {
        await tx.idempotencyRecord.create({
          data: {
            scope,
            userId: actorUserId,
            idempotencyKey,
            requestHash,
            responseStatus: 200,
            responseBody: responseData as unknown as Prisma.InputJsonValue,
            completedAt: now,
          },
        })
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err
      }

      return responseData
    })
  }

  async getSimulationDetail(refundId: string) {
    this.assertEnvironmentSafe()
    const refund = await this.db.refund.findUnique({
      where: { id: refundId },
      include: {
        payment: true,
        depositSettlement: true,
        depositSettlementItem: true,
      },
    })
    if (!refund) throw AppError.fromCode(P.PAYMENT_NOT_FOUND)
    const payload = refund.providerPayload as Prisma.JsonObject | null
    const simulation = payload?.sandboxSimulation as Record<string, unknown> | undefined
    return {
      refundId: refund.id,
      paymentId: refund.paymentId,
      amount: refund.amount.toFixed(0),
      currency: refund.currency,
      providerRefundStatus: refund.status,
      simulationStatus: simulation ? 'SIMULATED' : 'NOT_SIMULATED',
      simulationProvenance: simulation ?? null,
      warnings: simulation ? ['TEST_ONLY', 'NO_REAL_MONEY_RETURNED'] : [],
    }
  }
}
