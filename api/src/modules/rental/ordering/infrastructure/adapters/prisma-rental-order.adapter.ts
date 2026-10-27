import { cancelPendingRentalChargesWithTx, reserveRentalCancellationRefundWithTx } from '../../../payments/rental-cancellation-refund'
import { validateRentalOrderPaymentMembershipWithTx } from '../../../payments/rental-membership.guard'
import { resolveActivePrimaryRentalLocation } from '../../../shared/primary-inventory-location'
import { createHash } from 'node:crypto'
import { consumeExtensionPaymentWithTx, releaseExtensionWithTx } from '../../extension/rental-extension.service'
import { evaluateRentalEligibility } from '../../application/services/rental-ordering.rules'
import { Inject, Injectable } from '@nestjs/common'
import {
  InvoiceStatus,
  InvoiceType,
  PaymentStatus,
  Prisma,
  RecordStatus,
  RefundPurpose,
  RefundStatus,
  RentalFinancialStatus,
  RentalOrderStatus,
  RentalQuoteStatus,
  ReservationStatus,
} from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_ORDERING_ERROR_CODES as RT } from 'src/shared/errors/codes/rental-ordering.error-codes'
import type {
  CancelRentalOrderCommand,
  CancelRentalOrderResult,
  CreateRentalOrderCommand,
  CreateRentalOrderResult,
  GetRentalOrderQuery,
  GetRentalPaymentQuery,
  ListRentalOrdersQuery,
  PaginatedRentalOrdersResult,
  PreviewRentalCancellationQuery,
  RentalCancellationPreviewResult,
  RentalOrderPort,
  RentalOrderSummary,
  RentalPaymentEventCommand,
  RentalPaymentResult,
} from '../../application/ports/rental-order.port'
import { RENTAL_CONTEXT_PORT, type RentalContextPort } from '../../application/ports/rental-context.port'
import { parseWholeVnd, rentalOccupiedFrom, toSafeNumber } from '../../application/services/rental-ordering.rules'
import { getAvailableCountWithTx } from './prisma-rental-availability-tx.helper'

const IDEMPOTENCY_SCOPE_CREATE_ORDER = 'RB-API-201:create-rental-order'
const OPEN_RENTAL_ORDER_STATUSES: RentalOrderStatus[] = [
  RentalOrderStatus.PENDING_PAYMENT,
  RentalOrderStatus.PAID,
  RentalOrderStatus.PREPARING,
  RentalOrderStatus.READY_FOR_HANDOVER,
  RentalOrderStatus.ACTIVE,
  RentalOrderStatus.RETURN_PENDING,
  RentalOrderStatus.RETURN_PROCESSING,
]


async function runWithTransactionRetry<T>(
  action: () => Promise<T>,
  maxAttempts = 3,
  initialBackoffMs = 50,
): Promise<T> {
  let attempt = 0
  while (attempt < maxAttempts) {
    try {
      return await action()
    } catch (err: any) {
      attempt++
      const isDeadlockOrConflict =
        err?.code === 'P2034' ||
        err?.code === '40P01' ||
        (typeof err?.message === 'string' &&
          (err.message.includes('40P01') ||
            err.message.includes('deadlock detected') ||
            err.message.includes('could not serialize access')))
      if (isDeadlockOrConflict && attempt < maxAttempts) {
        const backoff = initialBackoffMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 20)
        await new Promise((resolve) => setTimeout(resolve, backoff))
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

@Injectable()
export class PrismaRentalOrderAdapter implements RentalOrderPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RENTAL_CONTEXT_PORT) private readonly contextPort: RentalContextPort,
  ) {}

  // RB-API-201
  async createOrder(command: CreateRentalOrderCommand): Promise<CreateRentalOrderResult> {
    const requestHash = sha256(JSON.stringify({ quoteId: command.quoteId }))
    const quotePointer = await this.prisma.rentalQuote.findUnique({
      where: { id: command.quoteId },
      select: { tripId: true },
    })
    if (!quotePointer) throw AppError.fromCode(RT.QUOTE_NOT_FOUND)

    try {
      return await runWithTransactionRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            // Contract M9 same-database: Area B coordinates locking with Area A in the same transaction.
            // Lock order is strictly: Trip -> Booking/Participant -> Quote -> Order -> Product/stock.
            const currentContext = await this.contextPort.lockAndRead(
              tx,
              quotePointer.tripId,
              command.userId,
              command.now,
            )
            if (!currentContext) throw AppError.fromCode(RT.STALE_CONTEXT)
          const cached = await tx.idempotencyRecord.findUnique({
            where: {
              scope_userId_idempotencyKey: {
                scope: IDEMPOTENCY_SCOPE_CREATE_ORDER,
                userId: command.userId,
                idempotencyKey: command.idempotencyKey,
              },
            },
          })
          if (cached) {
            if (cached.requestHash !== requestHash) throw AppError.fromCode(RT.IDEMPOTENCY_KEY_REUSED)
            if (cached.responseBody) return cached.responseBody as unknown as CreateRentalOrderResult
            throw AppError.fromCode(RT.OPERATION_CONFLICT)
          }
          await tx.idempotencyRecord.create({
            data: {
              scope: IDEMPOTENCY_SCOPE_CREATE_ORDER,
              userId: command.userId,
              idempotencyKey: command.idempotencyKey,
              requestHash,
            },
          })

          await tx.$queryRaw`SELECT id FROM rental_quotes WHERE id = ${command.quoteId}::uuid FOR UPDATE`
          const quote = await tx.rentalQuote.findUnique({
            where: { id: command.quoteId },
            include: {
              rentalQuoteLinesViaQuoteId: true,
              rentalPolicy: true,
            },
          })
          if (!quote) throw AppError.fromCode(RT.QUOTE_NOT_FOUND)
          if (quote.userId !== command.userId) throw AppError.fromCode('FORBIDDEN')
          if (quote.status !== RentalQuoteStatus.ACTIVE) throw AppError.fromCode(RT.QUOTE_NOT_ACTIVE)
          if (quote.expiresAt.getTime() <= command.now.getTime()) throw AppError.fromCode(RT.QUOTE_EXPIRED)
          // Quote cũ giữ công suất ngắn hơn 12 giờ không được chuyển thành đơn mới.
          const baselineOccupiedFrom = rentalOccupiedFrom(quote.rentalStartAt)
          if (quote.occupiedStartAt > baselineOccupiedFrom ||
              quote.rentalQuoteLinesViaQuoteId.some((line) =>
                (line.occupiedFrom ?? quote.occupiedStartAt) > baselineOccupiedFrom))
            throw AppError.fromCode(RT.STALE_CONTEXT)
          const kindMismatch = Boolean(quote.membershipKind && quote.membershipKind !== currentContext.membershipKind)
          const versionMismatch = Boolean(
            quote.membershipSourceVersion != null &&
              quote.membershipSourceVersion !== currentContext.membershipSourceVersion,
          )
          const refMismatch = quote.membershipRef !== currentContext.membershipRef
          const userMismatch = currentContext.userId !== command.userId || quote.userId !== command.userId
          const tripMismatch = currentContext.trip.id !== quote.tripId
          const contextVersionMismatch = currentContext.contextVersion !== quote.contextVersion

          if (
            kindMismatch ||
            versionMismatch ||
            refMismatch ||
            userMismatch ||
            tripMismatch ||
            contextVersionMismatch
          ) {
            throw AppError.fromCode(RT.STALE_CONTEXT)
          }

          const primaryRentalLocationId = await resolveActivePrimaryRentalLocation(tx)
          const snap = quote.policySnapshot as Record<string, unknown> | null
          if (
            snap?.primaryRentalInventoryLocationId &&
            snap.primaryRentalInventoryLocationId !== primaryRentalLocationId
          ) {
            throw AppError.fromCode(RT.STALE_CONTEXT, {
              details: { reason: 'PRIMARY_RENTAL_LOCATION_CHANGED_OR_NOT_SNAPSHOTTED' },
            })
          }

          assertContextStillRentalEligible({
            rentalEligible: currentContext.rentalEligible,
            membershipStatus: currentContext.membershipStatus,
            rentalCutoffAt: currentContext.rentalCutoffAt,
            now: command.now,
          })

          const openOrder = await tx.rentalOrder.findFirst({
            where: { userId: quote.userId, tripId: quote.tripId, status: { in: OPEN_RENTAL_ORDER_STATUSES } },
            select: { id: true },
          })
          if (openOrder) throw AppError.fromCode(RT.OPEN_ORDER_EXISTS, { details: { rentalOrderId: openOrder.id } })

          const productIds = [...new Set(quote.rentalQuoteLinesViaQuoteId.map((line) => line.productId))].sort()
          for (const productId of productIds) {
            await tx.$queryRaw`SELECT id FROM rental_products WHERE id = ${productId}::uuid FOR UPDATE`
          }
          const lockedProducts = await tx.rentalProduct.findMany({
            where: { id: { in: productIds } },
            select: { id: true, status: true },
          })
          const statusMap = new Map(lockedProducts.map((p) => [p.id, p.status]))
          for (const productId of productIds) {
            if (statusMap.get(productId) !== 'ACTIVE')
              throw AppError.fromCode(RT.EQUIPMENT_NOT_AVAILABLE, { details: { productId } })
          }
          for (const line of quote.rentalQuoteLinesViaQuoteId) {
            const lineOccupiedFrom = line.occupiedFrom ?? quote.occupiedStartAt
            const lineOccupiedUntil = line.occupiedUntil ?? quote.occupiedEndAt
            const availableCount = await getAvailableCountWithTx(tx, {
              productId: line.productId,
              inventoryLocationId: primaryRentalLocationId,
              occupiedFrom: lineOccupiedFrom,
              occupiedUntil: lineOccupiedUntil,
              now: command.now,
            })
            if (line.quantity > availableCount) {
              throw AppError.fromCode(RT.INSUFFICIENT_AVAILABLE_QUANTITY, {
                details: {
                  productId: line.productId,
                  requestedQuantity: line.quantity,
                  availableCount,
                  occupiedFrom: lineOccupiedFrom,
                  occupiedUntil: lineOccupiedUntil,
                },
              })
            }
          }

          const paymentExpiresAt = new Date(command.now.getTime() + quote.rentalPolicy.paymentHoldMinutes * 60_000)
          const order = await tx.rentalOrder.create({
            data: {
              quoteId: quote.id,
              rentalPolicyId: quote.rentalPolicyId,
              userId: quote.userId,
              tripId: quote.tripId,
              bookingId: quote.bookingId,
              membershipKind: quote.membershipKind,
              membershipRef: quote.membershipRef,
              membershipSourceVersion: quote.membershipSourceVersion,
              membershipSnapshot: (quote.membershipSnapshot ?? Prisma.JsonNull) as any,
              returnOptionSnapshot: (quote.returnOptionSnapshot ?? Prisma.JsonNull) as any,
              recipientUserId: quote.recipientUserId,
              recipientParticipantId: quote.recipientParticipantId,
              recipientSnapshot: quote.recipientSnapshot as any,
              pickupPointId: quote.pickupPointId!,
              returnPointId: quote.returnPointId!,
              contextVersionSnapshot: quote.contextVersion,
              rentalStartAt: quote.rentalStartAt,
              rentalEndAt: quote.rentalEndAt,
              plannedHandoverAt: quote.plannedHandoverAt,
              plannedReturnAt: quote.plannedReturnAt,
              occupiedStartAt: quote.occupiedStartAt,
              occupiedEndAt: quote.occupiedEndAt,
              status: RentalOrderStatus.PENDING_PAYMENT,
              financialStatus: RentalFinancialStatus.UNPAID,
              rentalFee: quote.rentalFee,
              totalDeposit: quote.totalDeposit,
              totalAmount: quote.totalAmount,
              currency: quote.currency,
              policySnapshot: quote.policySnapshot as any,
              paymentExpiresAt,
              rentalOrderLinesViaOrderId: {
                create: quote.rentalQuoteLinesViaQuoteId.map((line) => ({
                  productId: line.productId,
                  quantity: line.quantity,
                  dailyPriceSnapshot: line.dailyPriceSnapshot,
                  depositPerUnitSnapshot: line.depositPerUnitSnapshot,
                  replacementValueSnapshot: line.replacementValueSnapshot,
                  chargedDays: line.chargedDays,
                  lineRentalFee: line.lineRentalFee,
                  lineDeposit: line.lineDeposit,
                })),
              },
            },
            include: { rentalOrderLinesViaOrderId: true },
          })

          const quantityReservations: CreateRentalOrderResult['quantityReservations'] = []
          for (const line of order.rentalOrderLinesViaOrderId) {
            const quoteLine = quote.rentalQuoteLinesViaQuoteId.find((ql) => ql.productId === line.productId)
            const lineOccupiedFrom = quoteLine?.occupiedFrom ?? quote.occupiedStartAt
            const lineOccupiedUntil = quoteLine?.occupiedUntil ?? quote.occupiedEndAt
            const r = await tx.rentalQuantityReservation.create({
              data: {
                orderLineId: line.id,
                productId: line.productId,
                quantity: line.quantity,
                occupiedFrom: lineOccupiedFrom,
                occupiedUntil: lineOccupiedUntil,
                status: ReservationStatus.HELD,
                holdExpiresAt: paymentExpiresAt,
              },
            })
            quantityReservations.push(mapReservation(r))
          }

          await tx.invoice.create({
            data: {
              invoiceNo: buildRentalInvoiceNo(order.id),
              userId: quote.userId,
              invoiceType: InvoiceType.RENTAL,
              rentalOrderId: order.id,
              revisionNo: 1,
              subtotalAmount: quote.totalAmount,
              discountAmount: 0,
              totalAmount: quote.totalAmount,
              currency: quote.currency,
              status: InvoiceStatus.PENDING_PAYMENT,
              expiresAt: paymentExpiresAt,
              invoiceLinesViaInvoiceId: {
                create: order.rentalOrderLinesViaOrderId.flatMap((line) => {
                  const arr: any[] = []
                  if (line.lineRentalFee.gt(0))
                    arr.push({
                      lineCode: 'RENTAL_FEE',
                      description: 'Rental fee',
                      quantity: 1,
                      unitAmount: line.lineRentalFee,
                      lineAmount: line.lineRentalFee,
                      referenceType: 'RentalOrderLine',
                      referenceId: line.id,
                    })
                  if (line.lineDeposit.gt(0))
                    arr.push({
                      lineCode: 'RENTAL_DEPOSIT',
                      description: 'Rental deposit',
                      quantity: 1,
                      unitAmount: line.lineDeposit,
                      lineAmount: line.lineDeposit,
                      referenceType: 'RentalOrderLine',
                      referenceId: line.id,
                    })
                  return arr
                }),
              },
            },
          })
          await tx.rentalQuote.update({
            where: { id: quote.id },
            data: { status: RentalQuoteStatus.CONVERTED, version: { increment: 1 } },
          })

          const result: CreateRentalOrderResult = { order: mapOrderSummary(order), quantityReservations }
          await tx.idempotencyRecord.update({
            where: {
              scope_userId_idempotencyKey: {
                scope: IDEMPOTENCY_SCOPE_CREATE_ORDER,
                userId: command.userId,
                idempotencyKey: command.idempotencyKey,
              },
            },
            data: { responseBody: result as unknown as Prisma.InputJsonValue, completedAt: command.now },
          })
          return result
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 15000,
          timeout: 30000,
        },
      ))
    } catch (error) {
      if (error instanceof AppError) {
        if (error.code === RT.INSUFFICIENT_AVAILABLE_QUANTITY && error.details) {
          const details = error.details as {
            productId: string
            requestedQuantity: number
            availableCount: number
            occupiedFrom?: Date
            occupiedUntil?: Date
          }
          const occupiedFrom = details.occupiedFrom
          const occupiedUntil = details.occupiedUntil
          if (occupiedFrom && occupiedUntil && occupiedFrom < occupiedUntil) {
            const alertKey = createHash('sha256')
              .update([details.productId, occupiedFrom.toISOString(), occupiedUntil.toISOString()].join(':'))
              .digest('hex')
            try {
              await this.prisma.rentalCapacityAlert.upsert({
                where: { alertKey },
                update: {
                  requestedQuantity: details.requestedQuantity,
                  availableCount: details.availableCount,
                  status: 'ACTION_REQUIRED',
                },
                create: {
                  alertKey,
                  productId: details.productId,
                  occupiedFrom,
                  occupiedUntil,
                  requestedQuantity: details.requestedQuantity,
                  availableCount: details.availableCount,
                  unknownUnitCount: 0,
                  reason: 'CAPACITY_INSUFFICIENT',
                  status: 'ACTION_REQUIRED',
                },
              })
            } catch (alertErr) {
              console.error('[RentalCapacityAlert] Failed to persist shortage alert:', alertErr)
            }
          } else {
            console.error(
              '[RentalCapacityAlert] Missing valid occupied window for capacity alert, skipping alert creation to avoid fake interval',
            )
          }
        }
        throw error
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string) ?? ''

        if (target.includes('quote_id')) throw AppError.fromCode(RT.QUOTE_NOT_ACTIVE)
        if (target.includes('user_id') || target.includes('uq_rental_order_user_trip_open'))
          throw AppError.fromCode(RT.OPEN_ORDER_EXISTS)
        if (target.includes('idempotency')) throw AppError.fromCode(RT.OPERATION_CONFLICT)
      }
      throw error
    }
  }

  // RB-API-202
  async listOrders(query: ListRentalOrdersQuery): Promise<PaginatedRentalOrdersResult> {
    if (query.status && !Object.values(RentalOrderStatus).includes(query.status as RentalOrderStatus)) {
      throw AppError.fromCode('VALIDATION_ERROR', { message: 'Invalid rental order status' })
    }
    const where: Prisma.RentalOrderWhereInput = {
      userId: query.userId,
      ...(query.bookingId ? { bookingId: query.bookingId } : {}),
      ...(query.tripId ? { tripId: query.tripId } : {}),
      ...(query.status ? { status: query.status as RentalOrderStatus } : {}),
    }
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.rentalOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.rentalOrder.count({ where }),
    ])
    return {
      items: items.map(mapOrderSummary),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    }
  }

  // RB-API-203
  async getOrder(query: GetRentalOrderQuery): Promise<Record<string, unknown>> {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { id: query.orderId },
      include: {
        rentalOrderLinesViaOrderId: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
            rentalQuantityReservationsViaOrderLineId: { orderBy: { reservationCycle: 'desc' } },
            rentalUnitAssignmentsViaOrderLineId: {
              include: { equipmentUnit: { select: { id: true, assetCode: true, status: true, condition: true } } },
            },
          },
        },
        invoicesViaRentalOrderId: {
          include: {
            paymentsViaInvoiceId: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { application: true },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        pickupPoint: { select: { id: true, name: true, address: true } },
        returnPoint: { select: { id: true, name: true, address: true } },
        depositSettlementViaOrderId: {
          include: {
            depositSettlementItemsViaSettlementId: {
              include: {
                unit: { select: { id: true, assetCode: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    })
    if (!order) throw AppError.fromCode(RT.RENTAL_ORDER_NOT_FOUND)
    const canInspectAllOrders = ['STAFF_INVENTORY', 'STAFF_DELIVERY', 'ADMIN'].includes(query.actorRole)
    if (!canInspectAllOrders && order.userId !== query.actorUserId) throw AppError.fromCode('FORBIDDEN')

    const latestPayment = order.invoicesViaRentalOrderId[0]?.paymentsViaInvoiceId[0] ?? null
    const assignedUnits = order.rentalOrderLinesViaOrderId.flatMap((line) =>
      line.rentalUnitAssignmentsViaOrderLineId.map((a) => ({
        assignmentId: a.id,
        orderLineId: line.id,
        productId: line.productId,
        unitId: a.equipmentUnit.id,
        assetCode: a.equipmentUnit.assetCode,
        assignmentStatus: a.status,
        physicalStatus: a.equipmentUnit.status,
        condition: a.equipmentUnit.condition,
      })),
    )

    return {
      order: mapOrderSummary(order),
      items: order.rentalOrderLinesViaOrderId.map((line) => ({
        id: line.id,
        product: line.product,
        quantity: line.quantity,
        dailyPrice: decimalVndToApiInteger(line.dailyPriceSnapshot.toString()),
        depositPerUnit: decimalVndToApiInteger(line.depositPerUnitSnapshot.toString()),
        replacementValue: decimalVndToApiInteger(line.replacementValueSnapshot.toString()),
        chargedDays: line.chargedDays,
        feeAmount: decimalVndToApiInteger(line.lineRentalFee.toString()),
        depositAmount: decimalVndToApiInteger(line.lineDeposit.toString()),
      })),
      quantityReservations: order.rentalOrderLinesViaOrderId.flatMap((line) =>
        line.rentalQuantityReservationsViaOrderLineId.map(mapReservation),
      ),
      ...(assignedUnits.length ? { assignedUnits } : {}),
      payment: latestPayment
        ? mapPayment(latestPayment, order.paymentExpiresAt, order.invoicesViaRentalOrderId[0]?.status ?? null)
        : null,
      trip: {
        id: order.tripId,
        rentalStartAt: order.rentalStartAt.toISOString(),
        dueAt: order.rentalEndAt.toISOString(),
        occupiedUntil: order.occupiedEndAt.toISOString(),
      },
      pickupPoint: order.pickupPoint,
      returnPoint: order.returnPoint,
      deposit: mapDepositLifecycle(order),
      timeline: buildTimeline(order),
      allowedActions: buildAllowedActions(
        query.actorRole,
        order.status,
        order.financialStatus,
        jsonValue(order.policySnapshot),
        order.rentalEndAt,
      ),
    }
  }

  // RB-API-206
  async getPayment(query: GetRentalPaymentQuery): Promise<RentalPaymentResult> {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { id: query.orderId },
      include: {
        invoicesViaRentalOrderId: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          include: {
            paymentsViaInvoiceId: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { application: true },
            },
          },
        },
        refundsViaRentalOrderId: { where: { status: RefundStatus.SUCCEEDED } },
      },
    })
    if (!order) throw AppError.fromCode(RT.RENTAL_ORDER_NOT_FOUND)
    if (order.userId !== query.userId) throw AppError.fromCode('FORBIDDEN')
    const payment = order.invoicesViaRentalOrderId[0]?.paymentsViaInvoiceId[0]
    if (!payment)
      return {
        paymentRef: '',
        status: 'NOT_STARTED',
        nextAction: { type: 'CREATE_PAYMENT' },
        expiresAt: order.paymentExpiresAt.toISOString(),
        amount: decimalVndToApiInteger(order.totalAmount.toString()),
        refundedAmount: 0,
        invoiceStatus: order.invoicesViaRentalOrderId[0]?.status ?? null,
        applicationStatus: null,
        applicationReasonCode: null,
        reconciliationStatus: null,
        reconciliationRequired: false,
        gateway: null,
        providerEnvironment: null,
        paymentMethod: null,
        orderStatus: order.status,
        financialStatus: order.financialStatus,
      }
    return {
      ...mapPayment(payment, order.paymentExpiresAt, order.invoicesViaRentalOrderId[0]?.status ?? null),
      orderStatus: order.status,
      financialStatus: order.financialStatus,
      refundedAmount: order.refundsViaRentalOrderId.reduce(
        (sum, r) => sum + decimalVndToApiInteger(r.amount.toString()),
        0,
      ),
    }
  }

  // RB-API-207
  async previewCancellation(query: PreviewRentalCancellationQuery): Promise<RentalCancellationPreviewResult> {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { id: query.orderId },
      include: { rentalPolicy: true },
    })
    if (!order) throw AppError.fromCode(RT.RENTAL_ORDER_NOT_FOUND)
    if (order.userId !== query.userId) throw AppError.fromCode('FORBIDDEN')
    return calculateCancellationPreview(order, query.now)
  }

  // RB-API-205
  async cancelOrder(command: CancelRentalOrderCommand): Promise<CancelRentalOrderResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${command.orderId}::uuid FOR UPDATE`
      const order = await tx.rentalOrder.findUnique({
        where: { id: command.orderId },
        include: {
          rentalPolicy: true,
          rentalOrderLinesViaOrderId: { select: { id: true } },
          inventoryTaskViaOrderId: true,
          rentalHandoverViaOrderId: true,
          invoicesViaRentalOrderId: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            include: {
              paymentsViaInvoiceId: {
                where: { status: PaymentStatus.SUCCEEDED },
                orderBy: { paidAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      })
      if (!order) throw AppError.fromCode(RT.RENTAL_ORDER_NOT_FOUND)
      if (order.userId !== command.userId) throw AppError.fromCode('FORBIDDEN')
      if (order.version !== command.expectedVersion) throw AppError.fromCode(RT.VERSION_CONFLICT)
      if (
        order.rentalHandoverViaOrderId ||
        (
          [
            RentalOrderStatus.ACTIVE,
            RentalOrderStatus.RETURN_PENDING,
            RentalOrderStatus.RETURN_PROCESSING,
            RentalOrderStatus.COMPLETED,
          ] as string[]
        ).includes(order.status)
      ) {
        throw AppError.fromCode(RT.INVALID_RENTAL_STATE)
      }
      if (([RentalOrderStatus.CANCELLED, RentalOrderStatus.EXPIRED] as string[]).includes(order.status))
        throw AppError.fromCode(RT.INVALID_RENTAL_STATE)
      if (order.inventoryTaskViaOrderId?.status === 'TRANSFERRED')
        throw AppError.fromCode(RT.CANCELLATION_REQUIRES_CUSTODY_RETURN)
      // Applied extension fees are charged through separate invoicesViaRentalOrderId. Automatic cancellation must NOT
      // refund the combined fee from only the original payment. Require reconciled multi-payment refund flow.
      const appliedExtensions = await tx.rentalExtensionRequest.count({
        where: { orderId: order.id, status: 'APPLIED' },
      })
      if (appliedExtensions) throw AppError.fromCode('EXTENSION_CANCELLATION_REVIEW_REQUIRED')
      // Pending extension delta holds cannot survive cancellation of the parent Rental Order.
      const pendingExtensions = await tx.rentalExtensionRequest.findMany({
        where: { orderId: order.id, status: 'PENDING_PAYMENT' },
      })
      for (const pending of pendingExtensions) await releaseExtensionWithTx(tx, pending, 'CANCELLED', command.now)

      const preview = calculateCancellationPreview(order, command.now)
      if (preview.previewVersion !== command.previewVersion)
        throw AppError.fromCode(RT.VERSION_CONFLICT, { details: { reason: 'CANCELLATION_PREVIEW_STALE' } })

      const lineIds = order.rentalOrderLinesViaOrderId.map((l) => l.id)
      await tx.rentalQuantityReservation.updateMany({
        where: { orderLineId: { in: lineIds }, status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] } },
        data: { status: ReservationStatus.RELEASED, releasedAt: command.now, version: { increment: 1 } },
      })
      if (
        order.inventoryTaskViaOrderId &&
        ['OPEN', 'PICKING', 'CONDITION_CAPTURED'].includes(order.inventoryTaskViaOrderId.status)
      ) {
        await tx.inventoryTask.update({
          where: { id: order.inventoryTaskViaOrderId.id },
          data: { status: 'CANCELLED', version: { increment: 1 } },
        })
      }

      let refund: CancelRentalOrderResult['refund'] = null
      const refundAmount = preview.feeRefund + preview.depositRefund
      if (refundAmount > 0 && order.status !== RentalOrderStatus.PENDING_PAYMENT) {
        const payment = order.invoicesViaRentalOrderId[0]?.paymentsViaInvoiceId[0]
        if (!payment) throw AppError.fromCode(RT.PAYMENT_RECONCILIATION_REQUIRED)
        const refundRow = await reserveRentalCancellationRefundWithTx(tx, {
          orderId: order.id,
          paymentId: payment.id,
          amount: new Prisma.Decimal(refundAmount),
          reason: command.reason,
          idempotencyKey: `rental-cancel:${order.id}:v${order.version}`,
          now: command.now,
        })
        await tx.rentalOutboxEvent.upsert({
          where: { deduplicationKey: `refund-request:${refundRow.id}` },
          update: {},
          create: {
            deduplicationKey: `refund-request:${refundRow.id}`,
            eventType: 'RENTAL_REFUND_REQUESTED',
            aggregateType: 'RentalOrder',
            aggregateId: order.id,
            payload: jsonValue({
              refundRef: refundRow.id,
              paymentRef: payment.id,
              rentalOrderId: order.id,
              component: 'ORDER_CANCELLATION',
              amount: refundAmount,
              currency: order.currency,
              reason: command.reason,
            }),
          },
        })
        refund = { refundRef: refundRow.id, amount: refundAmount, status: refundRow.status }
      }

      const updated = await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.CANCELLED,
          financialStatus: refund
            ? RentalFinancialStatus.REFUND_PENDING
            : order.status === RentalOrderStatus.PENDING_PAYMENT
              ? RentalFinancialStatus.UNPAID
              : order.financialStatus,
          cancelledAt: command.now,
          version: { increment: 1 },
        },
      })
      await cancelPendingRentalChargesWithTx(tx, order.id)
      return { order: mapOrderSummary(updated), refund, quantityReleaseStatus: 'RELEASED' }
    })
  }

  //
  // Shared Payment -> Area B consumer for RB-FR-203/205/206.
  // This is intentionally an application consumer, not a public USER endpoint.
  //
  async processPaymentEvent(command: RentalPaymentEventCommand): Promise<void> {
    const now = new Date() // evaluate deadline against server processing clock, NOT provider's event timestamp
    const pointer = await this.prisma.payment.findUnique({
      where: { id: command.paymentRef },
      select: { invoiceId: true, invoice: { select: { rentalOrder: { select: { userId: true, tripId: true } } } } },
    })
    const isExtensionPayment = pointer?.invoiceId
      ? Boolean(
          await this.prisma.rentalExtensionRequest.findFirst({
            where: { invoiceId: pointer.invoiceId },
            select: { id: true },
          }),
        )
      : false
    // Existing rental settlement MUST survive Trip completion / temporary Area A unavailability.
    // Only the INITIAL order authorization performs the fresh membership check inside transaction.
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: command.paymentRef }, include: { invoice: true } })
      if (!payment || !payment.invoice.rentalOrderId) throw AppError.fromCode(RT.PAYMENT_NOT_FOUND)

      const existingEvent = await tx.paymentWebhookEvent.findFirst({
        where: { paymentGateway: payment.paymentGateway, providerEventId: command.eventId },
      })
      if (existingEvent?.processed) return
      const event =
        existingEvent ??
        (await tx.paymentWebhookEvent.create({
          data: {
            paymentGateway: payment.paymentGateway,
            providerEventId: command.eventId,
            paymentId: payment.id,
            payload: (command.payload ?? {}) as Prisma.InputJsonValue,
          },
        }))

      await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${payment.invoice.rentalOrderId}::uuid FOR UPDATE`
      const order = await tx.rentalOrder.findUnique({
        where: { id: payment.invoice.rentalOrderId },
        include: { rentalOrderLinesViaOrderId: { select: { id: true } } },
      })
      if (!order) throw AppError.fromCode(RT.RENTAL_ORDER_NOT_FOUND)

      if (
        payment.currency !== command.currency ||
        normalizeDecimal(payment.amount.toString()) !== normalizeDecimal(command.amount)
      ) {
        await tx.paymentWebhookEvent.update({
          where: { id: event.id },
          data: { processed: true, processedAt: now, errorMessage: 'PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH' },
        })
        throw AppError.fromCode(RT.PAYMENT_AMOUNT_MISMATCH)
      }

      // Extension invoice uses the same normalized Payment ingress but NEVER replays the base-order PAID transition.
      const extension = await tx.rentalExtensionRequest.findFirst({
        where: { invoiceId: payment.invoiceId },
        select: { id: true },
      })
      if (extension) {
        await consumeExtensionPaymentWithTx(tx, extension.id, payment, command.status, command.providerRef, now)
        await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processed: true, processedAt: now } })
        return
      }

      if (command.status === 'FAILED') {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            transactionRef: command.providerRef ?? payment.transactionRef,
            version: { increment: 1 },
          },
        })
        await tx.rentalOutboxEvent.upsert({
          where: { deduplicationKey: `payment-failed:${payment.id}:${command.eventId}` },
          update: {},
          create: {
            deduplicationKey: `payment-failed:${payment.id}:${command.eventId}`,
            eventType: 'RENTAL_PAYMENT_FAILED',
            aggregateType: 'RentalOrder',
            aggregateId: order.id,
            payload: jsonValue({ orderId: order.id, paymentRef: payment.id, occurredAt: now.toISOString() }),
          },
        })
        await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processed: true, processedAt: now } })
        return
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          transactionRef: command.providerRef ?? payment.transactionRef,
          paidAt: now,
          version: { increment: 1 },
        },
      })
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: InvoiceStatus.PAID, paidAt: now, version: { increment: 1 } },
      })

      const memberEligible = await validateRentalOrderPaymentMembershipWithTx(tx, order)

      if (
        order.status === RentalOrderStatus.EXPIRED ||
        order.status === RentalOrderStatus.CANCELLED ||
        now > order.paymentExpiresAt ||
        !memberEligible
      ) {
        if (order.status === RentalOrderStatus.PENDING_PAYMENT) await expireOrderWithTx(tx, order.id, now)
        const lateRefund = await tx.refund.upsert({
          where: { idempotencyKey: `late-payment:${payment.id}` },
          update: {},
          create: {
            paymentId: payment.id,
            purpose: RefundPurpose.RENTAL_CANCELLATION,
            amount: payment.amount,
            currency: payment.currency,
            reason: 'LATE_PAYMENT_EXPIRED_ORDER',
            status: RefundStatus.PENDING,
            idempotencyKey: `late-payment:${payment.id}`,
            rentalOrderId: order.id,
          },
        })
        await tx.rentalOutboxEvent.upsert({
          where: { deduplicationKey: `refund-request:${lateRefund.id}` },
          update: {},
          create: {
            deduplicationKey: `refund-request:${lateRefund.id}`,
            eventType: 'RENTAL_REFUND_REQUESTED',
            aggregateType: 'RentalOrder',
            aggregateId: order.id,
            payload: jsonValue({
              refundRef: lateRefund.id,
              paymentRef: payment.id,
              rentalOrderId: order.id,
              component: 'LATE_PAYMENT',
              amount: decimalVndToApiInteger(payment.amount.toString()),
              currency: payment.currency,
              reason: 'LATE_PAYMENT_EXPIRED_ORDER',
            }),
          },
        })
        await tx.rentalOrder.update({
          where: { id: order.id },
          data: { financialStatus: RentalFinancialStatus.REFUND_PENDING, version: { increment: 1 } },
        })
        await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processed: true, processedAt: now } })
        return
      }

      if (order.status === RentalOrderStatus.PAID) {
        await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processed: true, processedAt: now } })
        return
      }
      if (order.status !== RentalOrderStatus.PENDING_PAYMENT) throw AppError.fromCode(RT.INVALID_RENTAL_STATE)

      await tx.rentalQuantityReservation.updateMany({
        where: {
          orderLineId: { in: order.rentalOrderLinesViaOrderId.map((l) => l.id) },
          status: ReservationStatus.HELD,
        },
        data: { status: ReservationStatus.CONFIRMED, confirmedAt: now, version: { increment: 1 } },
      })
      await tx.rentalOrder.update({
        where: { id: order.id },
        data: {
          status: RentalOrderStatus.PAID,
          financialStatus: RentalFinancialStatus.PAID,
          paidAt: now,
          version: { increment: 1 },
        },
      })

      const existingTask = await tx.inventoryTask.findUnique({ where: { orderId: order.id } })
      if (!existingTask) {
        const locationId = await resolveInventoryLocationId(tx)
        await tx.inventoryTask.create({
          data: {
            orderId: order.id,
            inventoryLocationId: locationId,
            status: 'OPEN',
            deadline: order.plannedHandoverAt,
          },
        })
      }
      await tx.rentalOutboxEvent.upsert({
        where: { deduplicationKey: `payment-succeeded:${payment.id}` },
        update: {},
        create: {
          deduplicationKey: `payment-succeeded:${payment.id}`,
          eventType: 'RENTAL_PAYMENT_SUCCEEDED',
          aggregateType: 'RentalOrder',
          aggregateId: order.id,
          payload: jsonValue({ orderId: order.id, paymentRef: payment.id, paidAt: now.toISOString() }),
        },
      })
      await tx.paymentWebhookEvent.update({ where: { id: event.id }, data: { processed: true, processedAt: now } })
    })
  }

  async expirePendingOrders(now: Date): Promise<number> {
    const candidates = await this.prisma.rentalOrder.findMany({
      where: { status: RentalOrderStatus.PENDING_PAYMENT, paymentExpiresAt: { lte: now } },
      select: { id: true },
      take: 200,
    })
    let expired = 0
    for (const candidate of candidates) {
      const changed = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${candidate.id}::uuid FOR UPDATE`
        const current = await tx.rentalOrder.findUnique({
          where: { id: candidate.id },
          select: { status: true, paymentExpiresAt: true },
        })
        if (!current || current.status !== RentalOrderStatus.PENDING_PAYMENT || current.paymentExpiresAt > now)
          return false
        await expireOrderWithTx(tx, candidate.id, now)
        return true
      })
      if (changed) expired += 1
    }
    return expired
  }
}

async function expireOrderWithTx(tx: Prisma.TransactionClient, orderId: string, now: Date): Promise<void> {
  const lines = await tx.rentalOrderLine.findMany({ where: { orderId }, select: { id: true } })
  await tx.rentalQuantityReservation.updateMany({
    where: { orderLineId: { in: lines.map((l) => l.id) }, status: ReservationStatus.HELD },
    data: { status: ReservationStatus.EXPIRED, releasedAt: now, version: { increment: 1 } },
  })
  await tx.rentalOrder.update({
    where: { id: orderId },
    data: {
      status: RentalOrderStatus.EXPIRED,
      financialStatus: RentalFinancialStatus.UNPAID,
      version: { increment: 1 },
    },
  })
  await tx.invoice.updateMany({
    where: { rentalOrderId: orderId, status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.PENDING_PAYMENT] } },
    data: { status: InvoiceStatus.EXPIRED, version: { increment: 1 } },
  })
  const invoicesViaRentalOrderId = await tx.invoice.findMany({
    where: { rentalOrderId: orderId },
    select: { id: true },
  })
  await tx.payment.updateMany({
    where: {
      invoiceId: { in: invoicesViaRentalOrderId.map((i) => i.id) },
      status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
    },
    data: { status: PaymentStatus.EXPIRED, version: { increment: 1 } },
  })
  await tx.rentalOutboxEvent.upsert({
    where: { deduplicationKey: `payment-hold-expired:${orderId}` },
    update: {},
    create: {
      deduplicationKey: `payment-hold-expired:${orderId}`,
      eventType: 'RENTAL_PAYMENT_HOLD_EXPIRED',
      aggregateType: 'RentalOrder',
      aggregateId: orderId,
      payload: jsonValue({ orderId, expiredAt: now.toISOString() }),
    },
  })
}

async function resolveInventoryLocationId(tx: Prisma.TransactionClient): Promise<string> {
  return resolveActivePrimaryRentalLocation(tx)
}

function calculateCancellationPreview(
  order: {
    id: string
    version: number
    status: RentalOrderStatus
    rentalFee: Prisma.Decimal
    totalDeposit: Prisma.Decimal
    rentalStartAt: Date
    rentalPolicy: { versionNo: number; freeCancellationHours: number }
  },
  now: Date,
): RentalCancellationPreviewResult {
  const cancellable = (
    [
      RentalOrderStatus.PENDING_PAYMENT,
      RentalOrderStatus.PAID,
      RentalOrderStatus.PREPARING,
      RentalOrderStatus.READY_FOR_HANDOVER,
    ] as string[]
  ).includes(order.status)
  if (!cancellable)
    return {
      canCancel: false,
      feeRefund: 0,
      depositRefund: 0,
      reason: 'INVALID_RENTAL_STATE',
      previewVersion: cancellationPreviewHash(order, 0, 0),
    }
  if (order.status === RentalOrderStatus.PENDING_PAYMENT)
    return {
      canCancel: true,
      feeRefund: 0,
      depositRefund: 0,
      reason: 'UNPAID_ORDER',
      previewVersion: cancellationPreviewHash(order, 0, 0),
    }

  const freeCancelDeadline = new Date(
    order.rentalStartAt.getTime() - order.rentalPolicy.freeCancellationHours * 3_600_000,
  )
  const feeRefund = now <= freeCancelDeadline ? decimalVndToApiInteger(order.rentalFee.toString()) : 0
  // Before actual handover, asset deposit is never forfeited.
  const depositRefund = decimalVndToApiInteger(order.totalDeposit.toString())
  const reason = feeRefund > 0 ? 'BEFORE_FREE_CANCELLATION_DEADLINE' : 'AFTER_FREE_CANCELLATION_DEADLINE'
  return {
    canCancel: true,
    feeRefund,
    depositRefund,
    reason,
    previewVersion: cancellationPreviewHash(order, feeRefund, depositRefund),
  }
}

function cancellationPreviewHash(
  order: { id: string; version: number; rentalPolicy: { versionNo: number } },
  feeRefund: number,
  depositRefund: number,
): string {
  return sha256(
    JSON.stringify({
      orderId: order.id,
      version: order.version,
      policyVersion: order.rentalPolicy.versionNo,
      feeRefund,
      depositRefund,
    }),
  ).slice(0, 32)
}

function mapOrderSummary(order: {
  id: string
  quoteId: string
  bookingId: string | null
  tripId: string
  status: unknown
  exceptionStatus: unknown
  financialStatus: unknown
  rentalFee: Prisma.Decimal
  totalDeposit: Prisma.Decimal
  totalAmount: Prisma.Decimal
  currency: string
  paymentExpiresAt: Date
  plannedReturnAt: Date
  rentalEndAt: Date
  version: number
  createdAt: Date
}): RentalOrderSummary {
  return {
    id: order.id,
    quoteId: order.quoteId,
    bookingId: order.bookingId,
    tripId: order.tripId,
    status: String(order.status),
    exceptionStatus: String(order.exceptionStatus),
    financialStatus: String(order.financialStatus),
    rentalFee: decimalVndToApiInteger(order.rentalFee.toString()),
    totalDeposit: decimalVndToApiInteger(order.totalDeposit.toString()),
    totalAmount: decimalVndToApiInteger(order.totalAmount.toString()),
    currency: order.currency,
    paymentExpiresAt: order.paymentExpiresAt.toISOString(),
    dueAt: order.rentalEndAt.toISOString(),
    version: order.version,
    createdAt: order.createdAt.toISOString(),
  }
}

function mapDepositLifecycle(order: any) {
  const settlement = order.depositSettlementViaOrderId ?? null
  if (!settlement) {
    const collected =
      order.financialStatus === RentalFinancialStatus.PAID ? decimalVndToApiInteger(order.totalDeposit.toString()) : 0
    return { collectedAmount: collected, heldAmount: collected, refundedAmount: 0, deductionAmount: 0, items: [] }
  }
  const items = settlement.depositSettlementItemsViaSettlementId.map((item: any) => ({
    unitId: item.unitId,
    assetCode: item.unit?.assetCode ?? null,
    amount: decimalVndToApiInteger(item.depositAmount.toString()),
    status: item.status,
    refundAmount: decimalVndToApiInteger(item.refundAmount.toString()),
    deductionAmount: decimalVndToApiInteger(item.deductionAmount.toString()),
    reason: item.reason,
  }))
  const collectedAmount = decimalVndToApiInteger(settlement.totalDeposit.toString())
  const refundedAmount = items.reduce((sum: number, item: any) => sum + item.refundAmount, 0)
  const deductionAmount = items.reduce((sum: number, item: any) => sum + item.deductionAmount, 0)
  const heldAmount = items
    .filter((item: any) => ['HELD', 'REVIEW_REQUIRED', 'REFUND_PENDING', 'REFUND_FAILED'].includes(item.status))
    .reduce((sum: number, item: any) => sum + Math.max(0, item.amount - item.refundAmount - item.deductionAmount), 0)
  return { collectedAmount, heldAmount, refundedAmount, deductionAmount, items }
}

function mapReservation(r: {
  id: string
  orderLineId: string
  productId: string
  quantity: number
  occupiedFrom: Date
  occupiedUntil: Date
  status: unknown
  holdExpiresAt: Date | null
}) {
  return {
    id: r.id,
    orderLineId: r.orderLineId,
    productId: r.productId,
    quantity: r.quantity,
    occupiedFrom: r.occupiedFrom.toISOString(),
    occupiedUntil: r.occupiedUntil.toISOString(),
    status: String(r.status),
    holdExpiresAt: r.holdExpiresAt?.toISOString() ?? null,
  }
}

function mapPayment(
  payment: {
    id: string
    status: PaymentStatus
    amount: Prisma.Decimal
    paidAt: Date | null
    reconcileStatus?: string
    paymentGateway?: string
    providerEnvironment?: string | null
    paymentMethod?: string | null
    application?: { status: string; reasonCode: string | null } | null
  },
  expiresAt: Date,
  invoiceStatus: InvoiceStatus | null = null,
): RentalPaymentResult {
  return {
    paymentRef: payment.id,
    status: payment.status,
    nextAction:
      payment.status === PaymentStatus.SUCCEEDED
        ? null
        : { type: payment.status === PaymentStatus.FAILED ? 'RETRY_PAYMENT' : 'AWAIT_PAYMENT_RESULT' },
    expiresAt: payment.status === PaymentStatus.SUCCEEDED ? null : expiresAt.toISOString(),
    amount: decimalVndToApiInteger(payment.amount.toString()),
    paidAt: payment.paidAt?.toISOString() ?? null,
    invoiceStatus,
    applicationStatus: payment.application?.status ?? null,
    applicationReasonCode: payment.application?.reasonCode ?? null,
    reconciliationStatus: payment.reconcileStatus ?? null,
    reconciliationRequired: payment.reconcileStatus
      ? ['SCHEDULED', 'RUNNING', 'NEEDS_REVIEW'].includes(payment.reconcileStatus)
      : false,
    gateway: payment.paymentGateway ?? null,
    providerEnvironment: payment.providerEnvironment ?? null,
    paymentMethod: payment.paymentMethod ?? null,
  }
}

function buildTimeline(order: {
  createdAt: Date
  paidAt: Date | null
  cancelledAt: Date | null
  completedAt: Date | null
  status: unknown
}) {
  const timeline: Array<{ type: string; at: string }> = [{ type: 'ORDER_CREATED', at: order.createdAt.toISOString() }]
  if (order.paidAt) timeline.push({ type: 'PAID', at: order.paidAt.toISOString() })
  if (order.cancelledAt) timeline.push({ type: 'CANCELLED', at: order.cancelledAt.toISOString() })
  if (order.completedAt) timeline.push({ type: 'COMPLETED', at: order.completedAt.toISOString() })
  return timeline
}

function decimalVndToApiInteger(value: string): number {
  return toSafeNumber(parseWholeVnd(value))
}
function buildRentalInvoiceNo(orderId: string): string {
  return `RNT-${orderId.replace(/-/g, '').slice(0, 20).toUpperCase()}`
}
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
function normalizeDecimal(value: string): string {
  return new Prisma.Decimal(value).toFixed(2)
}

function assertContextStillRentalEligible(input: {
  rentalEligible: boolean
  membershipStatus: string
  rentalCutoffAt: Date
  now: Date
}) {
  if (!input.rentalEligible || input.membershipStatus !== 'ACTIVE')
    throw AppError.fromCode(RT.TRIP_MEMBERSHIP_NOT_ELIGIBLE)
  if (input.now.getTime() > input.rentalCutoffAt.getTime()) throw AppError.fromCode(RT.RENTAL_CUTOFF_PASSED)
}

function buildAllowedActions(
  actorRole: string,
  status: RentalOrderStatus,
  financialStatus: RentalFinancialStatus,
  policy: unknown,
  dueAt: Date,
): string[] {
  const actions: string[] = []
  if (actorRole === 'USER') {
    if (status === RentalOrderStatus.PENDING_PAYMENT) actions.push('PAY', 'CANCEL')
    if (
      (
        [RentalOrderStatus.PAID, RentalOrderStatus.PREPARING, RentalOrderStatus.READY_FOR_HANDOVER] as string[]
      ).includes(status)
    )
      actions.push('CANCEL')
    if (status === RentalOrderStatus.READY_FOR_HANDOVER) actions.push('VIEW_PICKUP_CODE', 'VIEW_HANDOVER_PREVIEW')
    const snapshot = policy && typeof policy === 'object' ? (policy as Record<string, unknown>) : {}
    if (
      Number.isInteger(snapshot.extensionHoldMinutes) &&
      Number.isInteger(snapshot.extensionRequestCutoffMinutes) &&
      Number.isInteger(snapshot.maxExtensionCount) &&
      Number.isInteger(snapshot.maxTotalRentalDays) &&
      status === RentalOrderStatus.ACTIVE &&
      new Date().getTime() + Number(snapshot.extensionRequestCutoffMinutes) * 60000 <= dueAt.getTime()
    )
      actions.push('EXTEND_RENTAL')
    if (
      (
        [
          RentalOrderStatus.ACTIVE,
          RentalOrderStatus.RETURN_PENDING,
          RentalOrderStatus.RETURN_PROCESSING,
          RentalOrderStatus.COMPLETED,
        ] as string[]
      ).includes(status)
    )
      actions.push('VIEW_DEPOSIT')
  }
  if (
    actorRole === 'STAFF_INVENTORY' &&
    ([RentalOrderStatus.PAID, RentalOrderStatus.PREPARING] as string[]).includes(status)
  )
    actions.push('PREPARE_WAREHOUSE')
  if (actorRole === 'STAFF_DELIVERY' && status === RentalOrderStatus.READY_FOR_HANDOVER) actions.push('HANDOVER')
  if (
    actorRole === 'STAFF_DELIVERY' &&
    (
      [RentalOrderStatus.ACTIVE, RentalOrderStatus.RETURN_PENDING, RentalOrderStatus.RETURN_PROCESSING] as string[]
    ).includes(status)
  )
    actions.push('RETURN_SCAN')
  if (actorRole === 'ADMIN') actions.push('VIEW_ADMIN_TASKS', 'VIEW_EXCEPTIONS')
  if (financialStatus === RentalFinancialStatus.REFUND_PENDING) actions.push('VIEW_REFUND_STATUS')
  return [...new Set(actions)]
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}
