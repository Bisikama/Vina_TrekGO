import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import envconfig from '../../shared/config'
import { AppError } from '../../shared/errors'
import { PAYMENT_ERROR_CODES as P } from '../../shared/errors/codes/payment.error-codes'
import type { VerifiedRefundEvent } from './payment-provider.port'
import { paymentHash } from './payment-utils'
import { RefundsService } from './refunds.service'
import type {
  SandboxSimulateRefundBodyDto,
  SandboxSimulateRefundResponseDto,
} from './dtos/sandbox-refund-simulation.dto'

type PreparedSimulation = {
  cachedResponse?: SandboxSimulateRefundResponseDto
  simulationId: string
  event: VerifiedRefundEvent
  refundId: string
  rentalOrderId: string
  depositSettlementId: string
  amount: string
  currency: string
  actorUserId: string
  reason: string
}

@Injectable()
export class SandboxRefundSimulationService {
  constructor(
    private readonly db: PrismaService,
    private readonly refunds: RefundsService,
  ) {}

  /**
   * Simulation is fail-closed and limited to an isolated local database. The
   * refund row is checked again for VNPay SANDBOX provenance before use.
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

    const environment = process.env.PAYMENT_PROVIDER_ENVIRONMENT ?? envconfig.PAYMENT_PROVIDER_ENVIRONMENT
    if (environment !== 'SANDBOX') {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_ENV_UNSAFE, {
        message: 'Payment provider environment must be configured as SANDBOX for simulation',
      })
    }

    const databaseUrl = process.env.DATABASE_URL || ''
    if (!databaseUrl) {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_ENV_UNSAFE, {
        message: 'No DATABASE_URL configured. Simulation cannot be verified safe.',
      })
    }

    let hostname = ''
    try {
      hostname = new URL(databaseUrl).hostname
        .toLowerCase()
        .trim()
        .replace(/^\[|\]$/g, '')
    } catch {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_ENV_UNSAFE, {
        message: 'DATABASE_URL is not a valid URL format',
      })
    }

    if (!new Set(['localhost', '127.0.0.1', '::1']).has(hostname)) {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_ENV_UNSAFE, {
        message: `Database host "${hostname}" is not an isolated local instance`,
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

    const scope = `admin-simulate-refund:${input.refundId}`
    const requestHash = paymentHash({ refundId: input.refundId, ...input.body })
    const prepared = await this.prepareSimulation(input, scope, requestHash)
    if (prepared.cachedResponse) return prepared.cachedResponse

    // The shared handler atomically persists Refund SUCCEEDED and the durable
    // REFUND_SUCCEEDED outbox event. Rental projections remain worker-owned.
    await this.refunds.applyEvent(prepared.event)

    return this.finalizeSimulation(prepared, scope, requestHash, input.idempotencyKey)
  }

  private async prepareSimulation(
    input: {
      refundId: string
      actorUserId: string
      idempotencyKey: string
      body: SandboxSimulateRefundBodyDto
    },
    scope: string,
    requestHash: string,
  ): Promise<PreparedSimulation> {
    return this.db.$transaction(async (tx) => {
      const existingIdempotency = await tx.idempotencyRecord.findUnique({
        where: {
          scope_userId_idempotencyKey: {
            scope,
            userId: input.actorUserId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      })
      if (existingIdempotency) {
        if (existingIdempotency.requestHash !== requestHash) {
          throw AppError.fromCode(P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        }
        if (existingIdempotency.responseBody) {
          return {
            cachedResponse: existingIdempotency.responseBody as unknown as SandboxSimulateRefundResponseDto,
          } as PreparedSimulation
        }
      }

      const initial = await tx.refund.findUnique({
        where: { id: input.refundId },
        select: { id: true, paymentId: true },
      })
      if (!initial) throw AppError.fromCode(P.PAYMENT_NOT_FOUND, { message: 'Refund does not exist' })

      const payment = await tx.payment.findUniqueOrThrow({ where: { id: initial.paymentId } })
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${payment.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${payment.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM refunds WHERE id = ${input.refundId}::uuid FOR UPDATE`

      const refund = await tx.refund.findUniqueOrThrow({
        where: { id: input.refundId },
        include: {
          payment: { include: { invoice: true } },
          depositSettlement: true,
          depositSettlementItem: true,
          depositRefundItems: { include: { item: true } },
          allocations: { include: { paymentAllocation: { include: { rentalOrderLine: true } } } },
        },
      })

      const settlementOrderId = refund.depositSettlement?.orderId ?? null
      if (!settlementOrderId || !refund.depositSettlementId) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID, {
          message: 'Deposit refund is not linked to a valid settlement and rental order',
        })
      }
      if (refund.rentalOrderId && refund.rentalOrderId !== settlementOrderId) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID, {
          message: 'Refund rental order does not match its deposit settlement',
        })
      }
      if (refund.payment.invoice.rentalOrderId !== settlementOrderId) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID, {
          message: 'Refund source payment belongs to a different rental order',
        })
      }
      if (refund.purpose !== 'DEPOSIT') {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: 'Only DEPOSIT refunds can be simulated by this operation',
        })
      }
      if (refund.paymentGateway !== 'vnpay' || refund.providerEnvironment !== 'SANDBOX') {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: 'Only VNPay SANDBOX refunds can be simulated',
        })
      }

      const providerPayload = refund.providerPayload as Prisma.JsonObject | null
      const existingSimulation = providerPayload?.sandboxSimulation as Record<string, unknown> | undefined
      if (existingSimulation) {
        if (existingSimulation.requestHash !== requestHash) {
          throw AppError.fromCode(P.SANDBOX_SIMULATION_ALREADY_SIMULATED)
        }
        // The same request may recover after a crash before response persistence.
      } else if (refund.status !== 'PROCESSING') {
        throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
          message: `Refund status is ${refund.status}; only PROCESSING can be simulated`,
        })
      }

      if (
        !existingSimulation &&
        typeof input.body.expectedVersion === 'number' &&
        refund.version !== input.body.expectedVersion
      ) {
        throw AppError.fromCode('VERSION_CONFLICT', {
          message: `Refund version changed (current ${refund.version}, expected ${input.body.expectedVersion})`,
        })
      }

      this.assertVnpayProcessingProvenance(providerPayload)
      this.assertAllocations(refund, settlementOrderId)

      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const simulationId = paymentHash(['ADMIN_SANDBOX_SIMULATION', refund.id, 'v1'])
      const providerEventId = `sandbox-refund-simulation:${refund.id}:succeeded:v1`
      const refundTransactionRef = this.simulatedTransactionRef(refund.id)
      const requestedAt =
        typeof existingSimulation?.requestedAt === 'string' ? existingSimulation.requestedAt : now.toISOString()

      const event: VerifiedRefundEvent = {
        kind: 'REFUND',
        gateway: refund.paymentGateway,
        environment: refund.providerEnvironment,
        merchantAccountKey: refund.merchantAccountKey!,
        providerEventId,
        merchantRequestRef: refund.payment.merchantRequestRef!,
        merchantRefundRef: refund.merchantRefundRef!,
        transactionRef: refund.payment.transactionRef,
        refundTransactionRef,
        status: 'SUCCEEDED',
        amount: refund.amount.toFixed(0),
        currency: refund.currency,
        occurredAt: requestedAt,
      }

      if (!existingSimulation) {
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            providerPayload: {
              ...(providerPayload ?? {}),
              sandboxSimulation: {
                simulationId,
                requestHash,
                providerEventId,
                refundTransactionRef,
                requestedAt,
                actorAdminId: input.actorUserId,
                reason: input.body.reason,
                testEvidenceRef: input.body.testEvidenceRef ?? null,
                origin: 'ADMIN_SANDBOX_SIMULATION',
                environment: 'SANDBOX',
                status: 'REQUESTED',
                warnings: ['TEST_ONLY', 'NO_REAL_MONEY_RETURNED'],
              },
            },
            version: { increment: 1 },
          },
        })
        await tx.auditLog.create({
          data: {
            userId: input.actorUserId,
            action: 'ADMIN_SANDBOX_REFUND_SIMULATION_REQUESTED',
            entityType: 'Refund',
            entityId: refund.id,
            newValues: {
              simulationId,
              providerEventId,
              rentalOrderId: settlementOrderId,
              depositSettlementId: refund.depositSettlementId,
              paymentId: refund.paymentId,
              environment: 'SANDBOX',
              origin: 'ADMIN_SANDBOX_SIMULATION',
              warnings: ['TEST_ONLY', 'NO_REAL_MONEY_RETURNED'],
            },
          },
        })
      }

      return {
        simulationId,
        event,
        refundId: refund.id,
        rentalOrderId: settlementOrderId,
        depositSettlementId: refund.depositSettlementId,
        amount: refund.amount.toFixed(0),
        currency: refund.currency,
        actorUserId: input.actorUserId,
        reason: input.body.reason,
      }
    })
  }

  private async finalizeSimulation(
    prepared: PreparedSimulation,
    scope: string,
    requestHash: string,
    idempotencyKey: string,
  ): Promise<SandboxSimulateRefundResponseDto> {
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM refunds WHERE id = ${prepared.refundId}::uuid FOR UPDATE`
        const refund = await tx.refund.findUniqueOrThrow({ where: { id: prepared.refundId } })
        if (refund.status !== 'SUCCEEDED' || !refund.refundedAt) {
          throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
            message: 'Shared Payment did not accept the simulated provider success event',
          })
        }

        const existingIdempotency = await tx.idempotencyRecord.findUnique({
          where: {
            scope_userId_idempotencyKey: {
              scope,
              userId: prepared.actorUserId,
              idempotencyKey,
            },
          },
        })
        if (existingIdempotency?.responseBody) {
          if (existingIdempotency.requestHash !== requestHash) {
            throw AppError.fromCode(P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
          }
          return existingIdempotency.responseBody as unknown as SandboxSimulateRefundResponseDto
        }

        const order = await tx.rentalOrder.findUniqueOrThrow({
          where: { id: prepared.rentalOrderId },
          select: { status: true, financialStatus: true },
        })
        const successOutbox = await tx.paymentOutboxEvent.findUnique({
          where: { deduplicationKey: `refund:${refund.id}:succeeded:v1` },
          select: { status: true },
        })
        if (!successOutbox) {
          throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
            message: 'Refund succeeded without its durable Shared Payment outbox event',
          })
        }

        const payload = refund.providerPayload as Prisma.JsonObject
        const previous = payload.sandboxSimulation as Prisma.JsonObject
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            providerPayload: {
              ...payload,
              sandboxSimulation: {
                ...previous,
                status: 'SUCCEEDED',
                committedAt: refund.refundedAt.toISOString(),
              },
            },
          },
        })

        const response: SandboxSimulateRefundResponseDto = {
          simulationId: prepared.simulationId,
          refundId: refund.id,
          rentalOrderId: prepared.rentalOrderId,
          depositSettlementId: prepared.depositSettlementId,
          provider: 'VNPAY_SANDBOX',
          providerRefundStatus: 'SUCCEEDED',
          simulationStatus: 'SIMULATED',
          simulatedAmount: prepared.amount,
          currency: prepared.currency,
          orderStatus: order.status,
          financialStatus: order.financialStatus,
          completionMode: 'STANDARD',
          settlementMode: 'SANDBOX_SIMULATED',
          settlementProcessingStatus: successOutbox.status === 'PROCESSED' ? 'APPLIED' : 'PENDING',
          simulatedAt: refund.refundedAt.toISOString(),
          actorAdminId: prepared.actorUserId,
          reason: prepared.reason,
          warnings: ['TEST_ONLY', 'NO_REAL_MONEY_RETURNED'],
          notices: {
            userNotice: 'Sandbox provider result simulated successfully; no real bank transfer occurred.',
            adminNotice:
              'Shared Payment recorded SUCCEEDED. Rental settlement remains asynchronous through the outbox worker.',
          },
        }

        if (!existingIdempotency) {
          await tx.idempotencyRecord.create({
            data: {
              scope,
              userId: prepared.actorUserId,
              idempotencyKey,
              requestHash,
              responseStatus: 200,
              responseBody: response as unknown as Prisma.InputJsonValue,
              completedAt: refund.refundedAt,
            },
          })
        }
        return response
      })
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.message?.includes('idempotency_records')) {
        const concurrent = await this.db.idempotencyRecord.findUnique({
          where: {
            scope_userId_idempotencyKey: {
              scope,
              userId: prepared.actorUserId,
              idempotencyKey,
            },
          },
        })
        if (concurrent?.requestHash !== requestHash) {
          throw AppError.fromCode(P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        }
        if (concurrent?.responseBody) {
          return concurrent.responseBody as unknown as SandboxSimulateRefundResponseDto
        }
      }
      throw error
    }
  }

  private assertVnpayProcessingProvenance(payload: Prisma.JsonObject | null): void {
    const response = payload?.vnpayResponse as Record<string, unknown> | undefined
    const rawResponseCode = response?.vnp_ResponseCode
    const rawTransactionStatus = response?.vnp_TransactionStatus
    const responseCode =
      typeof rawResponseCode === 'string' || typeof rawResponseCode === 'number' ? String(rawResponseCode) : ''
    const transactionStatus =
      typeof rawTransactionStatus === 'string' || typeof rawTransactionStatus === 'number'
        ? String(rawTransactionStatus)
        : ''
    if (responseCode !== '00' || !['05', '06'].includes(transactionStatus)) {
      throw AppError.fromCode(P.SANDBOX_SIMULATION_INVALID_REFUND, {
        message: 'Refund lacks a verified VNPay SANDBOX 05/06 processing response',
      })
    }
  }

  private assertAllocations(refund: any, orderId: string): void {
    if (!refund.merchantAccountKey || !refund.merchantRefundRef || !refund.payment.merchantRequestRef) {
      throw AppError.fromCode(P.REFUND_SOURCE_INVALID)
    }
    if (refund.currency !== 'VND' || refund.payment.currency !== refund.currency) {
      throw AppError.fromCode(P.REFUND_SOURCE_INVALID)
    }

    const paymentAllocationTotal = refund.allocations.reduce(
      (sum: Prisma.Decimal, allocation: any) => sum.plus(allocation.amount),
      new Prisma.Decimal(0),
    )
    if (!paymentAllocationTotal.equals(refund.amount) || refund.allocations.length === 0) {
      throw AppError.fromCode(P.REFUND_SOURCE_INVALID)
    }
    for (const allocation of refund.allocations) {
      if (
        allocation.paymentAllocation.paymentId !== refund.paymentId ||
        allocation.paymentAllocation.component !== 'RENTAL_DEPOSIT' ||
        allocation.paymentAllocation.rentalOrderLine.orderId !== orderId ||
        allocation.amount.lte(0) ||
        allocation.amount.gt(allocation.paymentAllocation.amount)
      ) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID)
      }
    }

    const hasGroupedItems = refund.depositRefundItems && refund.depositRefundItems.length > 0
    if (hasGroupedItems) {
      const itemAllocationTotal = refund.depositRefundItems.reduce(
        (sum: Prisma.Decimal, allocation: any) => sum.plus(allocation.amount),
        new Prisma.Decimal(0),
      )
      if (!itemAllocationTotal.equals(refund.amount)) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID)
      }
      for (const allocation of refund.depositRefundItems) {
        if (
          allocation.item.settlementId !== refund.depositSettlementId ||
          allocation.item.status !== 'REFUND_PENDING' ||
          allocation.amount.lte(0) ||
          allocation.amount.gt(allocation.item.refundAmount)
        ) {
          throw AppError.fromCode(P.REFUND_SOURCE_INVALID)
        }
      }
    } else if (refund.depositSettlementItem) {
      const item = refund.depositSettlementItem
      if (
        item.settlementId !== refund.depositSettlementId ||
        item.status !== 'REFUND_PENDING' ||
        refund.amount.lte(0) ||
        refund.amount.gt(item.refundAmount)
      ) {
        throw AppError.fromCode(P.REFUND_SOURCE_INVALID)
      }
    } else {
      throw AppError.fromCode(P.REFUND_SOURCE_INVALID)
    }
  }

  private simulatedTransactionRef(refundId: string): string {
    const hash = paymentHash(['ADMIN_SANDBOX_SIMULATION', refundId, 'transaction-ref-v1'])
    return ((BigInt(`0x${hash.slice(0, 16)}`) % 999_999_999_999_999n) + 1n).toString()
  }

  async getSimulationDetail(refundId: string) {
    this.assertEnvironmentSafe()
    const refund = await this.db.refund.findUnique({ where: { id: refundId } })
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
